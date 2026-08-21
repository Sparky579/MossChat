import Dexie, { type EntityTable } from "dexie";
import { strToU8, zipSync } from "fflate";
import { normalizeAdapterConfig } from "./adapter-config";
import { randomUuid } from "./id";
import { DEFAULT_PROVIDER_CAPABILITIES, DEFAULT_THINKING_LEVELS, PROVIDER_CAPABILITIES, modelSettingsKey, type AppData, type AppSettings, type Chat, type ModelDisplayItem, type ModelThinkingSettings, type Notebook, type PromptPreset, type ProviderCapability, type ProviderKind, type ProviderSettings, type SavedAttachment, type SavedMessage, type ThinkingLevel } from "./types";

const DATA_KEY = "ai-chat.local.data.v1";
const SETTINGS_KEY = "ai-chat.local.settings.v1";

type ChatMeta = Omit<Chat, "messages">;
type StoredMessage = Omit<SavedMessage, "attachments"> & { key: string; chatId: string; seq: number };
type StoredAttachment = SavedAttachment & { key: string; chatId: string; messageId: string };
type MigrationSnapshot = { id: string; createdAt: string; fromVersion: number; data: AppData };
type StoredConfig = { key: string; value: unknown };
type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
};

export type BackupSelection = {
  chats: boolean;
  settings: boolean;
  attachments: boolean;
};

export type StorageSafetyStatus = {
  supported: boolean;
  persisted: boolean;
  usage?: number;
  quota?: number;
  automaticBackup: "unsupported" | "not-configured" | "granted" | "needs-permission";
  lastManualBackupAt?: string;
  lastAutomaticBackupAt?: string;
};

type BackupManifest = {
  version: 2;
  exportedAt: string;
  selections: BackupSelection;
};

class AiChatDatabase extends Dexie {
  chats!: EntityTable<ChatMeta, "id">;
  messages!: EntityTable<StoredMessage, "key">;
  attachments!: EntityTable<StoredAttachment, "key">;
  notebooks!: EntityTable<Notebook, "id">;
  config!: EntityTable<StoredConfig, "key">;
  migrationSnapshots!: EntityTable<MigrationSnapshot, "id">;

  constructor() {
    super("ai-chat-local");
    this.version(1).stores({
      chats: "id, updatedAt, pinned",
      notebooks: "id, updatedAt",
    });
    this.version(2).stores({
      chats: "id, updatedAt, pinned",
      messages: "key, chatId, messageId, [chatId+seq], createdAt",
      attachments: "key, chatId, messageId, [chatId+messageId]",
      notebooks: "id, updatedAt",
      config: "key",
      migrationSnapshots: "id, createdAt",
    }).upgrade(async (transaction) => {
      const oldChats = await transaction.table("chats").toArray() as Chat[];
      const oldNotebooks = await transaction.table("notebooks").toArray() as Notebook[];
      await transaction.table("migrationSnapshots").put({
        id: "pre-migration-v1",
        createdAt: new Date().toISOString(),
        fromVersion: 1,
        data: { chats: oldChats, notebooks: oldNotebooks },
      } satisfies MigrationSnapshot);
      await transaction.table("chats").clear();
      for (const chat of oldChats) {
        const { messages, ...meta } = chat;
        await transaction.table("chats").put(meta);
        for (const [seq, message] of messages.entries()) {
          await transaction.table("messages").put(toStoredMessage(chat.id, message, seq));
          for (const attachment of message.attachments ?? []) await transaction.table("attachments").put(toStoredAttachment(chat.id, message.id, attachment));
        }
      }
    });
    this.version(3).stores({
      chats: "id, updatedAt, pinned, notebookId",
      messages: "key, chatId, messageId, [chatId+seq], createdAt",
      attachments: "key, chatId, messageId, [chatId+messageId]",
      notebooks: "id, updatedAt",
      config: "key",
      migrationSnapshots: "id, createdAt",
    });
  }
}

export const db = new AiChatDatabase();

const baseProviders: Record<string, ProviderSettings> = {
  google: { name: "Google Gemini", kind: "google", apiKey: "", baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash", models: ["gemini-2.5-flash", "gemini-3.1-flash-image", "gemini-3-pro-image"], emoji: "🤖" },
  openai: { name: "OpenAI compatible", kind: "openai", apiKey: "", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-image-2"], emoji: "🤖" },
  anthropic: { name: "Anthropic", kind: "anthropic", apiKey: "", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-20250514", models: ["claude-sonnet-4-20250514"], emoji: "🤖" },
};

export const defaultSettings: AppSettings = {
  activeProvider: "google",
  providers: baseProviders,
  providerOrder: ["google", "openai", "anthropic"],
  systemPrompt: "",
  promptPresets: [],
  namingModel: "",
  namingProvider: "google",
  language: "en",
  theme: "system",
  sendWithEnter: true,
  thinkingLevel: "off",
  thinkingBudget: 2048,
  modelDisplayOrder: [
    { providerId: "google", model: baseProviders.google.model },
    { providerId: "openai", model: baseProviders.openai.model },
    { providerId: "anthropic", model: baseProviders.anthropic.model },
  ],
  modelThinking: {},
  nativeTools: { functionDeclarations: "[]" },
};

export const emptyData = (): AppData => ({ chats: [], notebooks: [] });

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function inferProvider(id: string, input?: Partial<ProviderSettings> & { modelEmojis?: unknown }): ProviderSettings {
  const { modelEmojis: legacyModelEmojis, adapter: rawAdapter, modelAdapters: rawModelAdapters, ...providerInput } = input ?? {};
  const kind: ProviderKind = input?.kind ?? (id === "anthropic" ? "anthropic" : id === "google" ? "google" : "openai");
  const fallback = baseProviders[id] ?? (kind === "anthropic" ? baseProviders.anthropic : kind === "google" ? baseProviders.google : baseProviders.openai);
  // Upgrade the app-owned OpenAI/Gemini entries with current native image models
  // without adding guesses to a user-created compatible endpoint.
  const builtInModels = id === "google" || id === "openai" ? fallback.models : [];
  const models = [...new Set([...(Array.isArray(input?.models) ? input.models : []), input?.model?.trim() || fallback.model, ...builtInModels].map((model) => model.trim()).filter(Boolean))];
  const selectedModel = models.includes(input?.model?.trim() ?? "") ? input!.model!.trim() : models[0] ?? fallback.model;
  const legacyEmoji = Array.isArray(legacyModelEmojis) && typeof legacyModelEmojis[0] === "string" ? legacyModelEmojis[0] : "";
  const emoji = typeof providerInput.emoji === "string" && providerInput.emoji.trim() ? providerInput.emoji.trim().slice(0, 16) : legacyEmoji.trim().slice(0, 16) || "🤖";
  return {
    ...fallback,
    ...providerInput,
    name: input?.name?.trim() || fallback.name,
    kind,
    model: selectedModel,
    models,
    emoji,
    ...(normalizeAdapterConfig(rawAdapter) ? { adapter: normalizeAdapterConfig(rawAdapter) } : {}),
    ...(isObjectRecord(rawModelAdapters) ? {
      modelAdapters: Object.fromEntries(Object.entries(rawModelAdapters).flatMap(([model, adapter]) => {
        const normalized = normalizeAdapterConfig(adapter);
        return normalized && model.trim() ? [[model.trim(), normalized]] : [];
      })),
    } : {}),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function configuredModels(providers: Record<string, ProviderSettings>, providerOrder: string[]): ModelDisplayItem[] {
  return providerOrder.flatMap((providerId) => providers[providerId].models
    .map((model) => model.trim())
    .filter(Boolean)
    .map((model) => ({ providerId, model })));
}

function normalizedThinkingLevels(value: unknown): ThinkingLevel[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((level): level is string => typeof level === "string")
    .map((level) => level.trim().slice(0, 80))
    .filter(Boolean))];
}

function normalizedCapabilities(value: unknown): ProviderCapability[] {
  if (!Array.isArray(value)) return [...DEFAULT_PROVIDER_CAPABILITIES];
  const valid = new Set<ProviderCapability>(PROVIDER_CAPABILITIES);
  const capabilities = [...new Set(value.filter((item): item is ProviderCapability => typeof item === "string" && valid.has(item as ProviderCapability)))];
  return capabilities.length ? capabilities : [...DEFAULT_PROVIDER_CAPABILITIES];
}

function hasNativeImageGeneration(provider: ProviderSettings | undefined, model: string) {
  if (!provider) return false;
  if (provider.kind === "openai") return /^gpt-image-(?:1(?:\.5)?|2)(?:[-._]|$)/i.test(model);
  if (provider.kind === "google") return /^gemini-(?:2\.5-flash|3(?:\.1)?-(?:flash(?:-lite)?|pro))-image(?:[-._]|$)/i.test(model);
  return false;
}

function normalizeModelDisplayOrder(value: unknown, available: ModelDisplayItem[]): ModelDisplayItem[] {
  if (!Array.isArray(value)) return available.slice(0, 10);
  const valid = new Map(available.map((item) => [modelSettingsKey(item.providerId, item.model), item]));
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ModelDisplayItem>;
    if (typeof candidate.providerId !== "string" || typeof candidate.model !== "string") return [];
    const key = modelSettingsKey(candidate.providerId, candidate.model.trim());
    if (seen.has(key) || !valid.has(key)) return [];
    seen.add(key);
    return [valid.get(key)!];
  }).slice(0, 10);
}

function normalizeModelThinking(value: unknown, available: ModelDisplayItem[], fallback: ThinkingLevel, providers: Record<string, ProviderSettings>): Record<string, ModelThinkingSettings> {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(available.map((item) => {
    const raw = source[modelSettingsKey(item.providerId, item.model)];
    const candidate = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Partial<ModelThinkingSettings> : {};
    const defaultThinkingLevel = typeof candidate.defaultThinkingLevel === "string" && candidate.defaultThinkingLevel.trim()
      ? candidate.defaultThinkingLevel.trim().slice(0, 80)
      : fallback;
    const availableThinkingLevels = normalizedThinkingLevels(candidate.availableThinkingLevels);
    const levels = availableThinkingLevels.length ? availableThinkingLevels : [...DEFAULT_THINKING_LEVELS];
    if (!levels.includes(defaultThinkingLevel)) levels.unshift(defaultThinkingLevel);
    const explicitCapabilities = Array.isArray(candidate.capabilities);
    const capabilities = normalizedCapabilities(candidate.capabilities);
    if (!explicitCapabilities && hasNativeImageGeneration(providers[item.providerId], item.model)) capabilities.push("image-generation");
    return [modelSettingsKey(item.providerId, item.model), { defaultThinkingLevel, availableThinkingLevels: levels, capabilities: [...new Set(capabilities)] }];
  }));
}

export function normalizeSettings(input?: Partial<AppSettings>): AppSettings {
  const rawProviders = input?.providers ?? {};
  const providers = Object.fromEntries(Object.entries(rawProviders).map(([id, value]) => [id, inferProvider(id, value)]));
  if (!Object.keys(providers).length) Object.assign(providers, baseProviders);
  const providerOrder = [...new Set([...(input?.providerOrder ?? []), ...Object.keys(providers)])].filter((id) => providers[id]);
  const activeProvider = providers[input?.activeProvider ?? ""] ? input!.activeProvider! : providerOrder[0];
  const namingProvider = providers[input?.namingProvider ?? ""] ? input!.namingProvider! : activeProvider;
  const legacyTools = input as (Partial<AppSettings> & { geminiTools?: { functionDeclarations?: string } }) | undefined;
  const legacyThinkingLevel = typeof input?.thinkingLevel === "string" && input.thinkingLevel.trim() ? input.thinkingLevel.trim() : "off";
  const availableModels = configuredModels(providers, providerOrder);
  const modelDisplayOrder = normalizeModelDisplayOrder(input?.modelDisplayOrder, availableModels);
  const modelThinking = normalizeModelThinking(input?.modelThinking, availableModels, legacyThinkingLevel, providers);
  const activeModel = providers[activeProvider]?.model;
  const activeThinkingLevel = activeModel ? modelThinking[modelSettingsKey(activeProvider, activeModel)]?.defaultThinkingLevel : legacyThinkingLevel;
  return {
    ...defaultSettings,
    ...input,
    activeProvider,
    namingProvider,
    providers,
    providerOrder,
    nativeTools: { functionDeclarations: input?.nativeTools?.functionDeclarations ?? legacyTools?.geminiTools?.functionDeclarations ?? "[]" },
    thinkingLevel: activeThinkingLevel ?? legacyThinkingLevel,
    thinkingBudget: Number.isFinite(input?.thinkingBudget) ? Math.max(0, Math.floor(input!.thinkingBudget!)) : defaultSettings.thinkingBudget,
    modelDisplayOrder,
    modelThinking,
    promptPresets: Array.isArray(input?.promptPresets) ? input.promptPresets.filter((preset): preset is PromptPreset => Boolean(preset && typeof preset.id === "string" && typeof preset.title === "string" && typeof preset.content === "string")).map((preset) => ({ id: preset.id, title: preset.title.slice(0, 80), content: preset.content })) : [],
  };
}

/** Restores preferences from a key-free backup without silently dropping custom providers. */
export function settingsWithoutImportedKeys(imported: Partial<AppSettings>, local: AppSettings): AppSettings {
  const normalized = normalizeSettings(imported);
  return {
    ...normalized,
    providers: Object.fromEntries(Object.entries(normalized.providers).map(([id, provider]) => [
      id,
      { ...provider, apiKey: local.providers[id]?.apiKey ?? "" },
    ])),
  };
}

function toStoredMessage(chatId: string, message: SavedMessage, seq: number): StoredMessage {
  const { attachments: _attachments, ...body } = message;
  return { ...body, key: `${chatId}:${message.id}`, chatId, seq };
}

function toStoredAttachment(chatId: string, messageId: string, attachment: SavedAttachment): StoredAttachment {
  return { ...attachment, key: `${chatId}:${messageId}:${attachment.id}`, chatId, messageId };
}

function fromStoredMessage(message: StoredMessage, attachments: SavedAttachment[]): SavedMessage {
  const { key: _key, chatId: _chatId, seq: _seq, ...body } = message;
  return attachments.length ? { ...body, attachments } : body;
}

export async function loadData(): Promise<AppData> {
  try {
    const [metas, messages, attachments, notebooks] = await Promise.all([
      db.chats.orderBy("updatedAt").reverse().toArray(),
      db.messages.toArray(),
      db.attachments.toArray(),
      db.notebooks.orderBy("updatedAt").reverse().toArray(),
    ]);
    const attachmentsByMessage = new Map<string, SavedAttachment[]>();
    for (const attachment of attachments) {
      const { key: _key, chatId: _chatId, messageId: _messageId, ...body } = attachment;
      const list = attachmentsByMessage.get(`${attachment.chatId}:${attachment.messageId}`) ?? [];
      list.push(body);
      attachmentsByMessage.set(`${attachment.chatId}:${attachment.messageId}`, list);
    }
    const messagesByChat = new Map<string, StoredMessage[]>();
    for (const message of messages) {
      const list = messagesByChat.get(message.chatId) ?? [];
      list.push(message);
      messagesByChat.set(message.chatId, list);
    }
    const chats = metas.map((meta) => ({
      ...meta,
      messages: (messagesByChat.get(meta.id) ?? []).sort((a, b) => a.seq - b.seq).map((message) => fromStoredMessage(message, attachmentsByMessage.get(`${meta.id}:${message.id}`) ?? [])),
    }));
    if (!chats.length) {
      const legacy = safeParse<AppData>(localStorage.getItem(DATA_KEY), emptyData());
      if (legacy.chats.length || legacy.notebooks.length) {
        await replaceData(legacy);
        return legacy;
      }
    }
    return { chats, notebooks };
  } catch {
    return safeParse<AppData>(localStorage.getItem(DATA_KEY), emptyData());
  }
}

/** Writes chat metadata plus only changed message rows. Every message remains an independent record. */
export async function saveChatDelta(chat: Chat, dirtyMessageIds: readonly string[] = []): Promise<void> {
  const { messages, ...meta } = chat;
  const dirty = new Set(dirtyMessageIds);
  await db.transaction("rw", db.chats, db.messages, db.attachments, async () => {
    await db.chats.put(meta);
    const existing = await db.messages.where("chatId").equals(chat.id).toArray();
    const existingById = new Map(existing.map((message) => [message.id, message]));
    const currentIds = new Set(messages.map((message) => message.id));
    const removed = existing.filter((message) => !currentIds.has(message.id));
    if (removed.length) {
      await db.messages.bulkDelete(removed.map((message) => message.key));
      for (const message of removed) await db.attachments.where("[chatId+messageId]").equals([chat.id, message.id]).delete();
    }
    for (const [seq, message] of messages.entries()) {
      const existingMessage = existingById.get(message.id);
      if (!existingMessage || dirty.has(message.id)) {
        await db.messages.put(toStoredMessage(chat.id, message, seq));
        await db.attachments.where("[chatId+messageId]").equals([chat.id, message.id]).delete();
        const rows = (message.attachments ?? []).map((attachment) => toStoredAttachment(chat.id, message.id, attachment));
        if (rows.length) await db.attachments.bulkPut(rows);
      }
    }
  });
  localStorage.removeItem(DATA_KEY);
  document.cookie = "ai-chat-local=1; max-age=315360000; path=/; SameSite=Lax";
}

export async function saveChatMetadata(chat: Chat): Promise<void> {
  const { messages: _messages, ...meta } = chat;
  await db.chats.put(meta);
}

export async function deleteChat(chatId: string): Promise<void> {
  await db.transaction("rw", db.chats, db.messages, db.attachments, async () => {
    await db.chats.delete(chatId);
    const messages = await db.messages.where("chatId").equals(chatId).toArray();
    await db.messages.bulkDelete(messages.map((message) => message.key));
    for (const message of messages) await db.attachments.where("[chatId+messageId]").equals([chatId, message.id]).delete();
  });
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  await db.notebooks.put(notebook);
}

export async function deleteNotebook(notebookId: string): Promise<void> {
  await db.notebooks.delete(notebookId);
  const chats = await db.chats.where("notebookId").equals(notebookId).toArray();
  if (chats.length) await db.chats.bulkPut(chats.map((chat) => ({ ...chat, notebookId: undefined, updatedAt: new Date().toISOString() })));
}

export async function replaceData(data: AppData): Promise<void> {
  await db.transaction("rw", db.chats, db.messages, db.attachments, db.notebooks, async () => {
    await Promise.all([db.chats.clear(), db.messages.clear(), db.attachments.clear(), db.notebooks.clear()]);
    if (data.notebooks.length) await db.notebooks.bulkPut(data.notebooks);
    for (const chat of data.chats) {
      const { messages, ...meta } = chat;
      await db.chats.put(meta);
      if (messages.length) await db.messages.bulkPut(messages.map((message, seq) => toStoredMessage(chat.id, message, seq)));
      const attachments = messages.flatMap((message) => (message.attachments ?? []).map((attachment) => toStoredAttachment(chat.id, message.id, attachment)));
      if (attachments.length) await db.attachments.bulkPut(attachments);
    }
  });
  localStorage.removeItem(DATA_KEY);
}

export function loadSettings(): AppSettings {
  return normalizeSettings(safeParse<Partial<AppSettings>>(localStorage.getItem(SETTINGS_KEY), {}));
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  document.cookie = "ai-chat-local=1; max-age=315360000; path=/; SameSite=Lax";
}

export async function createBackupZip(selection: BackupSelection, settings: AppSettings): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const manifest: BackupManifest = { version: 2, exportedAt: new Date().toISOString(), selections: selection };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  if (selection.chats) {
    const data = await loadData();
    const chats = selection.attachments ? data.chats : data.chats.map((chat) => ({ ...chat, messages: chat.messages.map(({ attachments: _attachments, ...message }) => message) }));
    files["chats.json"] = strToU8(JSON.stringify({ chats, notebooks: data.notebooks }, null, 2));
  }
  if (selection.settings) files["settings.json"] = strToU8(JSON.stringify(normalizeSettings(settings), null, 2));
  if (selection.attachments) {
    const attachmentRows = await db.attachments.toArray();
    const inventory: Array<{ key: string; path: string; name: string; contentType?: string }> = [];
    for (const row of attachmentRows) {
      const payload = row.content.find((part) => typeof part.data === "string" || typeof part.image === "string");
      const value = typeof payload?.data === "string" ? payload.data : typeof payload?.image === "string" ? payload.image : "";
      if (!value.startsWith("data:")) continue;
      const base64 = value.slice(value.indexOf(",") + 1);
      const safeName = row.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "attachment";
      const path = `attachments/${row.chatId}/${row.messageId}/${row.id}-${safeName}`;
      files[path] = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      inventory.push({ key: row.key, path, name: row.name, contentType: row.contentType });
    }
    files["attachments-manifest.json"] = strToU8(JSON.stringify(inventory, null, 2));
  }
  return zipSync(files, { level: 6 });
}

export async function getStorageSafetyStatus(): Promise<StorageSafetyStatus> {
  const storage = navigator.storage;
  const [estimate, persisted, backupDirectory, lastManual, lastAutomatic] = await Promise.all([
    storage?.estimate?.(),
    storage?.persisted?.() ?? false,
    db.config.get("backupDirectory"),
    db.config.get("lastManualBackupAt"),
    db.config.get("lastAutomaticBackupAt"),
  ]);
  let automaticBackup: StorageSafetyStatus["automaticBackup"] = "not-configured";
  const handle = backupDirectory?.value as WritableDirectoryHandle | undefined;
  if (!("showDirectoryPicker" in window)) automaticBackup = "unsupported";
  else if (handle) automaticBackup = await handle.queryPermission({ mode: "readwrite" }) === "granted" ? "granted" : "needs-permission";
  return { supported: Boolean(storage?.persist), persisted: Boolean(persisted), usage: estimate?.usage, quota: estimate?.quota, automaticBackup, lastManualBackupAt: typeof lastManual?.value === "string" ? lastManual.value : undefined, lastAutomaticBackupAt: typeof lastAutomatic?.value === "string" ? lastAutomatic.value : undefined };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function chooseAutomaticBackupFolder(): Promise<boolean> {
  const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<WritableDirectoryHandle> }).showDirectoryPicker;
  if (!picker) return false;
  const handle = await picker({ mode: "readwrite" });
  await db.config.put({ key: "backupDirectory", value: handle });
  return true;
}

export async function writeAutomaticBackup(settings: AppSettings): Promise<boolean> {
  const directory = await db.config.get("backupDirectory");
  const handle = directory?.value as WritableDirectoryHandle | undefined;
  if (!handle || await handle.queryPermission({ mode: "readwrite" }) !== "granted") return false;
  const last = await db.config.get("lastAutomaticBackupAt");
  if (typeof last?.value === "string" && Date.now() - Date.parse(last.value) < 6 * 60 * 60 * 1000) return false;
  const archive = await createBackupZip({ chats: true, settings: false, attachments: true }, settings);
  const file = await handle.getFileHandle(`ai-chat-auto-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`, { create: true });
  const writer = await file.createWritable();
  await writer.write(archive.buffer as ArrayBuffer);
  await writer.close();
  await db.config.put({ key: "lastAutomaticBackupAt", value: new Date().toISOString() });
  return true;
}

export async function markManualBackup(): Promise<void> {
  await db.config.put({ key: "lastManualBackupAt", value: new Date().toISOString() });
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUuid()}`;
}

export function download(filename: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
