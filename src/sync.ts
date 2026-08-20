import type { AppData, AppSettings, Chat, Notebook, SavedMessage } from "./types";

const CONFIG_KEY = "mosschat.webdav.sync.v1";
const INDEX_PREFIX = "mosschat.webdav.sync.index.v1";
const META_FILE = "meta.json";
const ITERATIONS = 600_000;

export type SyncConfig = {
  endpoint: string;
  username: string;
  password: string;
  passphrase: string;
  deviceId: string;
  includeKeys: boolean;
};

type EncryptedEnvelope = { v: 1; iv: string; data: string };
type SyncRecord = { type: "chat" | "message" | "notebook" | "settings" | "tomb"; id: string; updatedAt: string; payload: unknown };
type SyncIndex = Record<string, { hash: string; updatedAt: string }>;

export const emptySyncConfig = (): SyncConfig => ({ endpoint: "", username: "", password: "", passphrase: "", deviceId: crypto.randomUUID(), includeKeys: false });

export function loadSyncConfig(): SyncConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}") as Partial<SyncConfig>;
    return { ...emptySyncConfig(), ...parsed, endpoint: String(parsed.endpoint ?? "").trim(), username: String(parsed.username ?? ""), password: String(parsed.password ?? ""), passphrase: String(parsed.passphrase ?? ""), deviceId: String(parsed.deviceId ?? crypto.randomUUID()), includeKeys: parsed.includeKeys === true };
  } catch { return emptySyncConfig(); }
}

export function saveSyncConfig(config: SyncConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function isSyncConfigured(config: SyncConfig) {
  return Boolean(config.endpoint && config.username && config.password && config.passphrase);
}

function indexKey(config: SyncConfig) {
  return `${INDEX_PREFIX}:${config.deviceId}:${config.endpoint}`;
}

function loadIndex(config: SyncConfig): SyncIndex {
  try { return JSON.parse(localStorage.getItem(indexKey(config)) ?? "{}") as SyncIndex; } catch { return {}; }
}

function saveIndex(config: SyncConfig, index: SyncIndex) {
  localStorage.setItem(indexKey(config), JSON.stringify(index));
}

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

async function contentHash(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer(encoder.encode(JSON.stringify(value))));
  return bytesToBase64(new Uint8Array(digest));
}

function normalizedEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("WebDAV endpoint must use HTTPS.");
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

function authorization(config: SyncConfig) {
  return `Basic ${bytesToBase64(encoder.encode(`${config.username}:${config.password}`))}`;
}

async function request(config: SyncConfig, path: string, init: RequestInit = {}) {
  const response = await fetch(`${normalizedEndpoint(config.endpoint)}${path}`, { ...init, headers: { Authorization: authorization(config), ...(init.headers ?? {}) }, credentials: "omit" });
  return response;
}

async function getSalt(config: SyncConfig) {
  const current = await request(config, META_FILE);
  if (current.ok) {
    const meta = await current.json() as { salt?: string; version?: number };
    if (meta.version === 1 && typeof meta.salt === "string") return base64ToBytes(meta.salt);
    throw new Error("The sync endpoint has an unsupported metadata file.");
  }
  if (current.status !== 404) throw new Error(`Could not read sync metadata (${current.status}).`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const created = await request(config, META_FILE, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 1, salt: bytesToBase64(salt) }) });
  if (!created.ok) throw new Error(`Could not create sync metadata (${created.status}).`);
  return salt;
}

async function encryptionKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", arrayBuffer(encoder.encode(passphrase)), "PBKDF2", false, ["deriveBits"]);
  const master = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: arrayBuffer(salt), iterations: ITERATIONS }, material, 256);
  const hkdf = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: arrayBuffer(encoder.encode("MossChat WebDAV v1")), info: arrayBuffer(encoder.encode("enc")) }, hkdf, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encrypt(key: CryptoKey, value: unknown): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: arrayBuffer(iv) }, key, arrayBuffer(encoder.encode(JSON.stringify(value))));
  return { v: 1, iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(data)) };
}

async function decrypt<T>(key: CryptoKey, value: EncryptedEnvelope): Promise<T> {
  if (value.v !== 1) throw new Error("Unsupported encrypted sync record.");
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: arrayBuffer(base64ToBytes(value.iv)) }, key, arrayBuffer(base64ToBytes(value.data)));
  return JSON.parse(decoder.decode(data)) as T;
}

function safeSettings(settings: AppSettings, includeKeys: boolean) {
  const { providers, ...rest } = settings;
  return { ...rest, providers: Object.fromEntries(Object.entries(providers).map(([id, provider]) => [id, { ...provider, apiKey: includeKeys ? provider.apiKey : "" }])) } as AppSettings;
}

function recordsFor(data: AppData, settings: AppSettings, includeKeys: boolean): SyncRecord[] {
  const records: SyncRecord[] = [];
  for (const chat of data.chats) {
    const { messages, ...meta } = chat;
    records.push({ type: "chat", id: chat.id, updatedAt: chat.updatedAt, payload: meta });
    for (const [seq, message] of messages.entries()) records.push({ type: "message", id: `${chat.id}:${message.id}`, updatedAt: chat.updatedAt, payload: { chatId: chat.id, seq, message } });
  }
  for (const notebook of data.notebooks) records.push({ type: "notebook", id: notebook.id, updatedAt: notebook.updatedAt, payload: notebook });
  records.push({ type: "settings", id: "settings", updatedAt: new Date().toISOString(), payload: safeSettings(settings, includeKeys) });
  return records;
}

function recordFile(record: SyncRecord) {
  const prefix = record.type === "message" ? "m" : record.type === "chat" ? "c" : record.type === "notebook" ? "n" : record.type === "tomb" ? "t" : "s";
  return `${prefix}-${encodeURIComponent(record.id)}.bin`;
}

async function stampRecords(records: SyncRecord[], index: SyncIndex) {
  const next: SyncIndex = {};
  const stamped = await Promise.all(records.map(async (record) => {
    const file = recordFile(record);
    const hash = await contentHash(record.payload);
    const existing = index[file];
    const updatedAt = existing?.hash === hash ? existing.updatedAt : record.updatedAt;
    next[file] = { hash, updatedAt };
    return { ...record, updatedAt };
  }));
  return { records: stamped, index: next };
}

async function listFiles(config: SyncConfig) {
  const response = await request(config, "", { method: "PROPFIND", headers: { Depth: "1", "Content-Type": "text/xml" }, body: "<?xml version=\"1.0\"?><propfind xmlns=\"DAV:\"><prop><getcontentlength/></prop></propfind>" });
  if (!response.ok && response.status !== 207) throw new Error(`Could not list remote sync records (${response.status}).`);
  const xml = await response.text();
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const root = new URL(normalizedEndpoint(config.endpoint));
  return Array.from(document.querySelectorAll("response href")).map((node) => node.textContent ?? "").map((href) => {
    try { return decodeURIComponent(new URL(href, root).pathname.split("/").filter(Boolean).at(-1) ?? ""); } catch { return ""; }
  }).filter((file) => file.endsWith(".bin"));
}

async function readRecords(config: SyncConfig, key: CryptoKey, files: string[]) {
  const values = await Promise.all(files.map(async (file) => {
    const response = await request(config, file);
    if (!response.ok) return null;
    try { return await decrypt<SyncRecord>(key, await response.json() as EncryptedEnvelope); } catch { return null; }
  }));
  return values.filter((value): value is SyncRecord => Boolean(value));
}

function assembledData(records: SyncRecord[]) {
  const chats = new Map<string, Chat>();
  const notebooks = new Map<string, Notebook>();
  for (const record of records) {
    if (record.type === "chat") chats.set(record.id, { ...(record.payload as Omit<Chat, "messages">), messages: [] });
    if (record.type === "notebook") notebooks.set(record.id, record.payload as Notebook);
  }
  for (const record of records) {
    if (record.type !== "message") continue;
    const value = record.payload as { chatId: string; seq: number; message: SavedMessage };
    const chat = chats.get(value.chatId);
    if (chat) chat.messages[value.seq] = value.message;
  }
  for (const chat of chats.values()) chat.messages = chat.messages.filter(Boolean);
  return { chats: [...chats.values()], notebooks: [...notebooks.values()] };
}

function applyTombs(data: AppData, tombs: Set<string>): AppData {
  const chatIds = new Set([...tombs].filter((file) => file.startsWith("c-")).map((file) => decodeURIComponent(file.slice(2, -4))));
  const notebookIds = new Set([...tombs].filter((file) => file.startsWith("n-")).map((file) => decodeURIComponent(file.slice(2, -4))));
  const messageIds = new Set([...tombs].filter((file) => file.startsWith("m-")).map((file) => decodeURIComponent(file.slice(2, -4))));
  return { chats: data.chats.filter((chat) => !chatIds.has(chat.id)).map((chat) => ({ ...chat, messages: chat.messages.filter((message) => !messageIds.has(`${chat.id}:${message.id}`)) })), notebooks: data.notebooks.filter((notebook) => !notebookIds.has(notebook.id)) };
}

function mergeById<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]) {
  const merged = new Map(local.map((item) => [item.id, item]));
  for (const item of remote) {
    const current = merged.get(item.id);
    if (!current || item.updatedAt > current.updatedAt) merged.set(item.id, item);
  }
  return [...merged.values()];
}

function mergeData(local: AppData, remote: AppData): AppData {
  const chats = mergeById(local.chats, remote.chats).map((chat) => {
    const remoteChat = remote.chats.find((item) => item.id === chat.id);
    const localChat = local.chats.find((item) => item.id === chat.id);
    if (!remoteChat || !localChat) return chat;
    const messages = new Map(localChat.messages.map((message) => [message.id, message]));
    for (const message of remoteChat.messages) if (!messages.has(message.id)) messages.set(message.id, message);
    return { ...(remoteChat.updatedAt > localChat.updatedAt ? remoteChat : localChat), messages: [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
  });
  return { chats, notebooks: mergeById(local.notebooks, remote.notebooks) };
}

function mergeSettings(local: AppSettings, remote: AppSettings | undefined, includeKeys: boolean) {
  if (!remote) return local;
  const providers = { ...remote.providers, ...local.providers };
  if (!includeKeys) for (const [id, provider] of Object.entries(providers)) providers[id] = { ...provider, apiKey: local.providers[id]?.apiKey ?? "" };
  const presetMap = new Map([...remote.promptPresets, ...local.promptPresets].map((preset) => [preset.id, preset]));
  return { ...remote, ...local, providers, providerOrder: [...new Set([...local.providerOrder, ...remote.providerOrder])], promptPresets: [...presetMap.values()] };
}

export async function synchronizeWebDav({ config, data, settings, mode = "merge" }: { config: SyncConfig; data: AppData; settings: AppSettings; mode?: "merge" | "upload" }) {
  if (!isSyncConfigured(config)) throw new Error("Configure endpoint, WebDAV credentials, and passphrase first.");
  const salt = await getSalt(config);
  const key = await encryptionKey(config.passphrase, salt);
  const previousIndex = loadIndex(config);
  const files = mode === "merge" ? await listFiles(config) : [];
  const remoteRecords = mode === "merge" ? await readRecords(config, key, files) : [];
  const remoteTombs = new Set(remoteRecords.filter((record) => record.type === "tomb").map((record) => String((record.payload as { file?: string }).file ?? "")));
  const activeRemoteRecords = remoteRecords.filter((record) => record.type !== "tomb" && !remoteTombs.has(recordFile(record)));
  const localData = mode === "merge" ? applyTombs(data, remoteTombs) : data;
  const remoteData = assembledData(activeRemoteRecords);
  const remoteSettings = activeRemoteRecords.find((record) => record.type === "settings")?.payload as AppSettings | undefined;
  const mergedData = mode === "merge" ? mergeData(localData, remoteData) : localData;
  const mergedSettings = mode === "merge" ? mergeSettings(settings, remoteSettings, config.includeKeys) : settings;
  const current = recordsFor(mergedData, mergedSettings, config.includeKeys);
  const missingFiles = Object.keys(previousIndex).filter((file) => !current.some((record) => recordFile(record) === file) && !file.startsWith("t-"));
  const tombs = missingFiles.map((file) => ({ type: "tomb" as const, id: file, updatedAt: new Date().toISOString(), payload: { file } }));
  const stamped = await stampRecords([...current, ...tombs], previousIndex);
  const remoteByFile = new Map(activeRemoteRecords.map((record) => [recordFile(record), record]));
  const uploads = stamped.records.filter((record) => mode === "upload" || record.type === "tomb" || !remoteByFile.has(recordFile(record)) || record.updatedAt > remoteByFile.get(recordFile(record))!.updatedAt);
  await Promise.all(uploads.map(async (record) => {
    const response = await request(config, recordFile(record), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await encrypt(key, record)) });
    if (!response.ok) throw new Error(`Could not upload ${record.type} record (${response.status}).`);
  }));
  saveIndex(config, stamped.index);
  return { data: mergedData, settings: mergedSettings, uploaded: uploads.length, downloaded: activeRemoteRecords.length };
}
