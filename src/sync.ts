import type { AppData, AppSettings, Chat, Notebook, SavedAttachment, SavedMessage } from "./types";

const CONFIG_KEY = "mosschat.webdav.sync.v1";
const INDEX_PREFIX = "mosschat.webdav.sync.index.v2";
const CLOCK_PREFIX = "mosschat.webdav.sync.clock.v1";
const LAST_SYNC_PREFIX = "mosschat.webdav.sync.last-success.v1";
const SERVER_ID_PREFIX = "mosschat.webdav.sync.server-id.v1";
const META_FILE = "meta.json";
const ITERATIONS = 600_000;
const MAX_SYNC_IMAGE_EDGE = 2048;
const DAILY_AUTO_MERGE_MIN_OVERLAP = 0.85;

export type SyncConfig = {
  endpoint: string;
  username: string;
  password: string;
  passphrase: string;
  passphraseInitialized: boolean;
  deviceId: string;
  deviceName: string;
  includeKeys: boolean;
};

type SyncConfigPayload = { endpoint?: unknown; url?: unknown; username?: unknown; password?: unknown; protocol?: unknown; path?: unknown; deviceName?: unknown; includeKeys?: unknown };
type SyncMeta = { serverId: string; salt: string; schema: 1; createdAt: string };
type EncryptedEnvelope = { v: 1; iv: string; data: string };
type SyncRecord = { type: "chat" | "message" | "notebook" | "settings" | "tomb"; id: string; updatedAt: string; payload: unknown; clock?: number; deviceId?: string; deviceName?: string };
type ContentSyncRecord = SyncRecord & { type: "chat" | "message" | "notebook" };
/** Only sync metadata is kept locally: no chat body, attachment bytes, or encrypted record cache. */
type SyncIndexEntry = { hash: string; clock: number; deviceId: string };
type SyncIndex = Record<string, SyncIndexEntry>;

export type SyncResolution = "merge" | "prefer-local" | "prefer-remote";
export type SyncSummary = { chats: number; messages: number; notebooks: number; firstUpdatedAt: string | null; lastUpdatedAt: string | null };
export type SyncDifference = { type: "chat" | "message" | "notebook"; id: string; local: string | null; remote: string | null };
export type SyncInspection = { state: "empty" | "ready" | "missing-meta"; serverId: string | null; previousServerId: string | null; createdAt: string | null; local: SyncSummary; remote: SyncSummary; common: Pick<SyncSummary, "chats" | "messages" | "notebooks">; conflicts: number; remoteLastWrite: { at: string; deviceId: string; deviceName: string } | null; differences: SyncDifference[]; needsDecision: boolean };
export type SyncVerification = { state: "empty" | "ready"; serverId: string | null; records: number };
export type SyncTargetInspection = { hasExistingData: boolean; records: number };

export const emptySyncConfig = (): SyncConfig => ({ endpoint: "", username: "", password: "", passphrase: "", passphraseInitialized: false, deviceId: crypto.randomUUID(), deviceName: "", includeKeys: false });

export function loadSyncConfig(): SyncConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}") as Partial<SyncConfig>;
    const passphrase = String(parsed.passphrase ?? "");
    return { ...emptySyncConfig(), ...parsed, endpoint: String(parsed.endpoint ?? "").trim(), username: String(parsed.username ?? ""), password: String(parsed.password ?? ""), passphrase, passphraseInitialized: parsed.passphraseInitialized === true || Boolean(passphrase), deviceId: String(parsed.deviceId ?? crypto.randomUUID()), deviceName: String(parsed.deviceName ?? ""), includeKeys: parsed.includeKeys === true };
  } catch { return emptySyncConfig(); }
}

export function saveSyncConfig(config: SyncConfig) { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
export function isSyncConfigured(config: SyncConfig) { return Boolean(config.endpoint && config.username && config.password && config.passphraseInitialized); }

/** Reads raw SYNC_CONFIG JSON or the optional ===SYNC_CONFIG_*=== wrapper. */
export function parseSyncConfig(value: string): Pick<SyncConfig, "endpoint" | "username" | "password" | "deviceName" | "includeKeys"> {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}") return { endpoint: "", username: "", password: "", deviceName: "", includeKeys: false };
  const match = trimmed.match(/===SYNC_CONFIG_START===\s*([\s\S]*?)\s*===SYNC_CONFIG_END===/);
  let parsed: SyncConfigPayload;
  try { parsed = JSON.parse(match?.[1] ?? trimmed) as SyncConfigPayload; } catch { throw new Error("SYNC_CONFIG must contain valid JSON."); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("SYNC_CONFIG must be a JSON object.");
  if (parsed.protocol !== undefined && parsed.protocol !== "webdav") throw new Error("SYNC_CONFIG is not for WebDAV.");
  let endpoint = "";
  if (typeof parsed.endpoint === "string") endpoint = parsed.endpoint.trim();
  else if (parsed.url !== undefined || parsed.path !== undefined) {
    if (typeof parsed.url !== "string" || typeof parsed.path !== "string") throw new Error("SYNC_CONFIG needs both url and path.");
    let source: URL;
    try { source = new URL(parsed.url); } catch { throw new Error("SYNC_CONFIG has an invalid URL."); }
    if (source.protocol !== "https:" && source.hostname !== "localhost" && source.hostname !== "127.0.0.1") throw new Error("SYNC_CONFIG URL must use HTTPS.");
    const path = parsed.path.trim();
    if (!path.startsWith("/")) throw new Error("SYNC_CONFIG path must start with a slash.");
    const joined = new URL(path, source.origin);
    joined.search = "";
    joined.hash = "";
    if (!joined.pathname.endsWith("/")) joined.pathname += "/";
    endpoint = joined.href;
  }
  for (const [name, field] of [["username", parsed.username], ["password", parsed.password], ["deviceName", parsed.deviceName]] as const) {
    if (field !== undefined && typeof field !== "string") throw new Error(`SYNC_CONFIG ${name} must be a string.`);
  }
  if (parsed.includeKeys !== undefined && typeof parsed.includeKeys !== "boolean") throw new Error("SYNC_CONFIG includeKeys must be true or false.");
  return { endpoint, username: typeof parsed.username === "string" ? parsed.username : "", password: typeof parsed.password === "string" ? parsed.password : "", deviceName: typeof parsed.deviceName === "string" ? parsed.deviceName : "", includeKeys: parsed.includeKeys === true };
}

export function syncConfigJson(config: Pick<SyncConfig, "endpoint" | "username" | "password" | "deviceName" | "includeKeys">) {
  const value: Record<string, string | boolean> = {};
  const endpoint = config.endpoint.trim();
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      value.url = url.origin;
      value.username = config.username;
      value.password = config.password;
      value.protocol = "webdav";
      value.path = url.pathname || "/";
    } catch { value.endpoint = endpoint; }
  } else {
    if (config.username) value.username = config.username;
    if (config.password) value.password = config.password;
  }
  if (config.deviceName) value.deviceName = config.deviceName;
  if (config.includeKeys) value.includeKeys = true;
  return JSON.stringify(value, null, 2);
}

function configScope(config: SyncConfig) { return `${config.deviceId}:${config.endpoint}`; }
function indexKey(config: SyncConfig) { return `${INDEX_PREFIX}:${configScope(config)}`; }
function clockKey(config: SyncConfig) { return `${CLOCK_PREFIX}:${configScope(config)}`; }
function lastSyncKey(config: SyncConfig) { return `${LAST_SYNC_PREFIX}:${configScope(config)}`; }
function serverIdKey(config: SyncConfig) { return `${SERVER_ID_PREFIX}:${configScope(config)}`; }

/** Disconnect this browser from a sync server without touching local or remote content. */
export function clearWebDavSync(config: SyncConfig) {
  localStorage.removeItem(CONFIG_KEY);
  clearLocalSyncState(config);
}

function clearLocalSyncState(config: SyncConfig) {
  localStorage.removeItem(indexKey(config));
  localStorage.removeItem(clockKey(config));
  localStorage.removeItem(lastSyncKey(config));
  localStorage.removeItem(serverIdKey(config));
}

function loadIndex(config: SyncConfig): SyncIndex {
  try {
    const source = JSON.parse(localStorage.getItem(indexKey(config)) ?? "{}") as Record<string, Partial<SyncIndexEntry>>;
    return Object.fromEntries(Object.entries(source).flatMap(([file, entry]) => typeof entry.hash !== "string" ? [] : [[file, { hash: entry.hash, clock: Number.isSafeInteger(entry.clock) && (entry.clock ?? 0) >= 0 ? Number(entry.clock) : 0, deviceId: typeof entry.deviceId === "string" ? entry.deviceId : "legacy" }]]));
  } catch { return {}; }
}

function saveIndex(config: SyncConfig, index: SyncIndex) { localStorage.setItem(indexKey(config), JSON.stringify(index)); }
function loadClock(config: SyncConfig) { return Math.max(0, Number(localStorage.getItem(clockKey(config)) ?? "0") || 0); }
function saveClock(config: SyncConfig, clock: number) { localStorage.setItem(clockKey(config), String(clock)); }
export function loadLastSyncAt(config: SyncConfig) { return localStorage.getItem(lastSyncKey(config)) || null; }
function saveLastSyncAt(config: SyncConfig, value: string) { localStorage.setItem(lastSyncKey(config), value); }
function loadRememberedServerId(config: SyncConfig) { return localStorage.getItem(serverIdKey(config)) || null; }
function saveRememberedServerId(config: SyncConfig, serverId: string) { localStorage.setItem(serverIdKey(config), serverId); }

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

async function contentHash(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer(encoder.encode(JSON.stringify(value))));
  return bytesToBase64(new Uint8Array(digest)).slice(0, 22);
}

function normalizedEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("WebDAV endpoint must use HTTPS.");
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

function authorization(config: SyncConfig) { return `Basic ${bytesToBase64(encoder.encode(`${config.username}:${config.password}`))}`; }
async function request(config: SyncConfig, path: string, init: RequestInit = {}) {
  return fetch(`${normalizedEndpoint(config.endpoint)}${path}`, { ...init, headers: { Authorization: authorization(config), ...(init.headers ?? {}) }, credentials: "omit" });
}

function newServerId() { return `srv_${crypto.randomUUID().replace(/-/g, "")}`; }

async function putMeta(config: SyncConfig, meta: SyncMeta) {
  const response = await request(config, META_FILE, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) });
  if (!response.ok) throw new Error(`Could not save sync metadata (${response.status}).`);
}

async function readMeta(config: SyncConfig): Promise<SyncMeta | null> {
  const current = await request(config, META_FILE);
  if (current.ok) {
    const source = await current.json() as { serverId?: unknown; salt?: unknown; schema?: unknown; version?: unknown; createdAt?: unknown };
    const schema = source.schema ?? source.version;
    if (schema !== 1 || typeof source.salt !== "string") throw new Error("The sync endpoint has an unsupported metadata file.");
    const meta: SyncMeta = { serverId: typeof source.serverId === "string" ? source.serverId : "", salt: source.salt, schema: 1, createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString() };
    try { base64ToBytes(meta.salt); } catch { throw new Error("The sync endpoint metadata has an invalid salt."); }
    return meta;
  }
  if (current.status === 404) return null;
  throw new Error(`Could not read sync metadata (${current.status}).`);
}

async function ensureMeta(config: SyncConfig) {
  const existing = await readMeta(config);
  if (existing) {
    if (existing.serverId) return existing;
    const upgraded = { ...existing, serverId: newServerId() };
    await putMeta(config, upgraded);
    return upgraded;
  }
  return createMeta(config);
}

async function createMeta(config: SyncConfig) {
  const meta: SyncMeta = { serverId: newServerId(), salt: bytesToBase64(crypto.getRandomValues(new Uint8Array(16))), schema: 1, createdAt: new Date().toISOString() };
  await putMeta(config, meta);
  return meta;
}

async function getEncryptionMaterial(config: SyncConfig) {
  const entries = await listEntries(config);
  const meta = entries.includes(META_FILE) ? await ensureMeta(config) : await createMeta(config);
  return { meta, salt: base64ToBytes(meta.salt) };
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

async function dataUrlFromBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function compressImageForSync(dataUrl: string): Promise<{ value: string; compressed: boolean }> {
  if (!/^data:image\/(?!svg\+xml|gif)/i.test(dataUrl)) return { value: dataUrl, compressed: false };
  try {
    const source = await fetch(dataUrl).then((response) => response.blob());
    const bitmap = await createImageBitmap(source);
    const ratio = Math.min(1, MAX_SYNC_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!compressed || compressed.size >= source.size) return { value: dataUrl, compressed: false };
    return { value: await dataUrlFromBlob(compressed), compressed: true };
  } catch { return { value: dataUrl, compressed: false }; }
}

async function compactAttachment(attachment: SavedAttachment) {
  if (attachment.type !== "image") return { attachment, compressed: 0 };
  let compressed = 0;
  const content = [] as SavedAttachment["content"];
  for (const part of attachment.content) {
    const image = typeof part.image === "string" ? part.image : "";
    if (!image) { content.push(part); continue; }
    const result = await compressImageForSync(image);
    if (result.compressed) compressed += 1;
    content.push(result.compressed ? { ...part, image: result.value } : part);
  }
  return { attachment: compressed ? { ...attachment, content, contentType: "image/webp" } : attachment, compressed };
}

async function compactMessage(message: SavedMessage) {
  if (!message.attachments?.length) return { message, compressed: 0 };
  let compressed = 0;
  const attachments: SavedAttachment[] = [];
  for (const attachment of message.attachments) {
    const result = await compactAttachment(attachment);
    attachments.push(result.attachment);
    compressed += result.compressed;
  }
  return { message: compressed ? { ...message, attachments } : message, compressed };
}

async function recordsFor(data: AppData, settings: AppSettings, includeKeys: boolean) {
  const records: SyncRecord[] = [];
  let compressedImages = 0;
  for (const chat of data.chats) {
    const { messages, ...meta } = chat;
    records.push({ type: "chat", id: chat.id, updatedAt: chat.updatedAt, payload: meta });
    for (const [seq, source] of messages.entries()) {
      const result = await compactMessage(source);
      compressedImages += result.compressed;
      records.push({ type: "message", id: `${chat.id}:${source.id}`, updatedAt: chat.updatedAt, payload: { chatId: chat.id, seq, message: result.message } });
    }
  }
  for (const notebook of data.notebooks) records.push({ type: "notebook", id: notebook.id, updatedAt: notebook.updatedAt, payload: notebook });
  records.push({ type: "settings", id: "settings", updatedAt: new Date().toISOString(), payload: safeSettings(settings, includeKeys) });
  return { records, compressedImages };
}

function recordFile(record: SyncRecord) {
  const prefix = record.type === "message" ? "m" : record.type === "chat" ? "c" : record.type === "notebook" ? "n" : record.type === "tomb" ? "t" : "s";
  return `${prefix}-${encodeURIComponent(record.id)}.bin`;
}

function recordClock(record: SyncRecord) {
  return Number.isSafeInteger(record.clock) && (record.clock ?? 0) >= 0 ? Number(record.clock) : Math.max(0, Date.parse(record.updatedAt) || 0);
}

function normalizedRecord(record: SyncRecord): SyncRecord {
  return { ...record, clock: recordClock(record), deviceId: typeof record.deviceId === "string" && record.deviceId ? record.deviceId : "legacy", deviceName: typeof record.deviceName === "string" && record.deviceName.trim() ? record.deviceName.trim().slice(0, 80) : "Unknown device" };
}

function compareRecords(left: SyncRecord, right: SyncRecord) {
  const clocks = recordClock(left) - recordClock(right);
  if (clocks) return clocks;
  const devices = String(left.deviceId ?? "legacy").localeCompare(String(right.deviceId ?? "legacy"));
  return devices;
}

async function stampLocalRecords(records: SyncRecord[], index: SyncIndex, config: SyncConfig, minimumClock: number) {
  let clock = Math.max(minimumClock, loadClock(config), ...Object.values(index).map((entry) => entry.clock));
  const stamped: SyncRecord[] = [];
  for (const record of records) {
    const file = recordFile(record);
    const hash = await contentHash(record.payload);
    const existing = index[file];
    if (existing?.hash === hash) {
      stamped.push({ ...record, clock: existing.clock, deviceId: existing.deviceId, deviceName: existing.deviceId === config.deviceId ? (config.deviceName.trim().slice(0, 80) || "This device") : "Unknown device" });
      clock = Math.max(clock, existing.clock);
      continue;
    }
    clock += 1;
    stamped.push({ ...record, clock, deviceId: config.deviceId, deviceName: config.deviceName.trim().slice(0, 80) || "This device" });
  }
  return { records: stamped, clock };
}

async function indexRecords(records: SyncRecord[]): Promise<SyncIndex> {
  const entries = await Promise.all(records.map(async (record) => [recordFile(record), { hash: await contentHash(record.payload), clock: recordClock(record), deviceId: String(record.deviceId ?? "legacy") }] as const));
  return Object.fromEntries(entries);
}

async function listEntries(config: SyncConfig) {
  const response = await request(config, "", { method: "PROPFIND", headers: { Depth: "1", "Content-Type": "text/xml" }, body: "<?xml version=\"1.0\"?><propfind xmlns=\"DAV:\"><prop><getcontentlength/></prop></propfind>" });
  if (!response.ok && response.status !== 207) {
    if (response.status === 401 || response.status === 403) throw new Error("WebDAV username or password is incorrect.");
    throw new Error(`Could not list remote sync records (${response.status}).`);
  }
  const xml = await response.text();
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const root = new URL(normalizedEndpoint(config.endpoint));
  return Array.from(document.querySelectorAll("response href")).map((node) => node.textContent ?? "").map((href) => {
    try { return decodeURIComponent(new URL(href, root).pathname.split("/").filter(Boolean).at(-1) ?? ""); } catch { return ""; }
  }).filter(Boolean);
}

async function listFiles(config: SyncConfig) { return (await listEntries(config)).filter((file) => file.endsWith(".bin")); }

async function readRecords(config: SyncConfig, key: CryptoKey, files: string[]) {
  const values = await Promise.all(files.map(async (file) => {
    const response = await request(config, file);
    if (!response.ok) return null;
    try { return normalizedRecord(await decrypt<SyncRecord>(key, await response.json() as EncryptedEnvelope)); } catch { return null; }
  }));
  return values.filter((value): value is SyncRecord => Boolean(value));
}

function resolveRecords(local: SyncRecord[], remote: SyncRecord[], resolution: SyncResolution = "merge") {
  const selected = new Map(local.map((record) => [recordFile(record), record]));
  for (const record of remote) {
    const file = recordFile(record);
    const current = selected.get(file);
    if (!current) { selected.set(file, record); continue; }
    if (resolution === "prefer-remote" || (resolution === "merge" && compareRecords(record, current) > 0)) selected.set(file, record);
  }
  const removed = new Set<string>();
  for (const tomb of selected.values()) {
    if (tomb.type !== "tomb") continue;
    const target = String((tomb.payload as { file?: string }).file ?? "");
    const current = selected.get(target);
    if (!current || compareRecords(tomb, current) >= 0) removed.add(target);
  }
  return [...selected.entries()].filter(([file]) => !removed.has(file)).map(([, record]) => record);
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
  for (const chat of chats.values()) chat.messages = chat.messages.filter(Boolean).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return { chats: [...chats.values()], notebooks: [...notebooks.values()] };
}

function settingsForLocal(selected: SyncRecord | undefined, local: AppSettings, includeKeys: boolean) {
  if (!selected || selected.type !== "settings") return local;
  const remote = selected.payload as AppSettings;
  if (includeKeys) return remote;
  return { ...remote, providers: Object.fromEntries(Object.entries(remote.providers).map(([id, provider]) => [id, { ...provider, apiKey: local.providers[id]?.apiKey ?? "" }])) };
}

const emptySummary = (): SyncSummary => ({ chats: 0, messages: 0, notebooks: 0, firstUpdatedAt: null, lastUpdatedAt: null });
const isContentRecord = (record: SyncRecord): record is ContentSyncRecord => record.type === "chat" || record.type === "message" || record.type === "notebook";

function summarizeRecords(records: SyncRecord[]): SyncSummary {
  const summary = emptySummary();
  for (const record of records) {
    if (record.type === "chat") summary.chats += 1;
    if (record.type === "message") summary.messages += 1;
    if (record.type === "notebook") summary.notebooks += 1;
    if (!isContentRecord(record) || !record.updatedAt) continue;
    if (!summary.firstUpdatedAt || record.updatedAt < summary.firstUpdatedAt) summary.firstUpdatedAt = record.updatedAt;
    if (!summary.lastUpdatedAt || record.updatedAt > summary.lastUpdatedAt) summary.lastUpdatedAt = record.updatedAt;
  }
  return summary;
}

/** A remote workspace is automatically accepted only when all content matches exactly. */
function hasExactContentMatch(local: SyncSummary, remote: SyncSummary, common: Pick<SyncSummary, "chats" | "messages" | "notebooks">) {
  const total = (summary: Pick<SyncSummary, "chats" | "messages" | "notebooks">) => summary.chats + summary.messages + summary.notebooks;
  return total(local) === total(remote) && total(local) === total(common);
}

/** Once a device is paired, small normal sync deltas should not require a decision. */
function hasDailyOverlap(local: SyncSummary, remote: SyncSummary, common: Pick<SyncSummary, "chats" | "messages" | "notebooks">) {
  const total = (summary: Pick<SyncSummary, "chats" | "messages" | "notebooks">) => summary.chats + summary.messages + summary.notebooks;
  const localTotal = total(local);
  const remoteTotal = total(remote);
  const commonTotal = total(common);
  if (!localTotal || !remoteTotal || !commonTotal) return false;
  return commonTotal / localTotal >= DAILY_AUTO_MERGE_MIN_OVERLAP && commonTotal / remoteTotal >= DAILY_AUTO_MERGE_MIN_OVERLAP;
}

function differencePreview(record: SyncRecord) {
  if (record.type === "message") {
    const message = (record.payload as { message?: SavedMessage }).message;
    if (!message) return "(message could not be read)";
    const content = message.content.map((part) => {
      if (part.type === "text" || part.type === "reasoning") return String(part.text ?? "");
      if (part.type === "image") return "[image]";
      if (part.type === "clear-boundary") return "[conversation cleared]";
      return `[${String(part.type ?? "content")}]`;
    }).filter(Boolean).join("\n");
    return `${message.role}\n${content || "(no text content)"}`;
  }
  if (record.type === "chat") {
    const chat = record.payload as Chat;
    return `${chat.title || "Untitled chat"}\n${record.id}`;
  }
  const notebook = record.payload as Notebook;
  return `${notebook.title || "Untitled notebook"}\n${notebook.content || "(no text content)"}`;
}

export async function inspectWebDavSync({ config, data, settings }: { config: SyncConfig; data: AppData; settings: AppSettings }): Promise<SyncInspection> {
  if (!isSyncConfigured(config)) throw new Error("Configure endpoint, WebDAV credentials, and passphrase first.");
  const local = await recordsFor(data, settings, config.includeKeys);
  const localSummary = summarizeRecords(local.records);
  const previousServerId = loadRememberedServerId(config);
  const entries = await listEntries(config);
  const initialMeta = entries.includes(META_FILE) ? await readMeta(config) : null;
  if (!initialMeta) {
    const files = entries.filter((file) => file.endsWith(".bin"));
    if (files.length) return { state: "missing-meta", serverId: null, previousServerId, createdAt: null, local: localSummary, remote: emptySummary(), common: { chats: 0, messages: 0, notebooks: 0 }, conflicts: 0, remoteLastWrite: null, differences: [], needsDecision: true };
    return { state: "empty", serverId: null, previousServerId, createdAt: null, local: localSummary, remote: emptySummary(), common: { chats: 0, messages: 0, notebooks: 0 }, conflicts: 0, remoteLastWrite: null, differences: [], needsDecision: true };
  }
  const meta = initialMeta.serverId ? initialMeta : await ensureMeta(config);
  const key = await encryptionKey(config.passphrase, base64ToBytes(meta.salt));
  const remoteRecords = await readRecords(config, key, entries.filter((file) => file.endsWith(".bin")));
  const remoteSummary = summarizeRecords(remoteRecords);
  const localByFile = new Map(local.records.map((record) => [recordFile(record), record]));
  const remoteByFile = new Map(remoteRecords.map((record) => [recordFile(record), record]));
  const common = { chats: 0, messages: 0, notebooks: 0 };
  const differences: SyncDifference[] = [];
  let conflicts = 0;
  for (const remote of remoteRecords) {
    if (!isContentRecord(remote)) continue;
    const localRecord = localByFile.get(recordFile(remote));
    if (!localRecord || !isContentRecord(localRecord)) {
      differences.push({ type: remote.type, id: remote.id, local: null, remote: differencePreview(remote) });
      continue;
    }
    if (remote.type === "chat") common.chats += 1;
    if (remote.type === "message") common.messages += 1;
    if (remote.type === "notebook") common.notebooks += 1;
    if (await contentHash(localRecord.payload) !== await contentHash(remote.payload)) {
      conflicts += 1;
      differences.push({ type: remote.type, id: remote.id, local: differencePreview(localRecord), remote: differencePreview(remote) });
    }
  }
  for (const localRecord of local.records) {
    if (!isContentRecord(localRecord) || remoteByFile.has(recordFile(localRecord))) continue;
    differences.push({ type: localRecord.type, id: localRecord.id, local: differencePreview(localRecord), remote: null });
  }
  const remoteContent = remoteRecords.filter(isContentRecord);
  const newest = remoteContent.reduce<SyncRecord | null>((current, record) => !current || recordClock(record) > recordClock(current) ? record : current, null);
  const exactMatch = hasExactContentMatch(localSummary, remoteSummary, common) && conflicts === 0;
  const needsDecision = !previousServerId ? !exactMatch : !hasDailyOverlap(localSummary, remoteSummary, common);
  return { state: "ready", serverId: meta.serverId, previousServerId, createdAt: meta.createdAt, local: localSummary, remote: remoteSummary, common, conflicts, remoteLastWrite: newest ? { at: newest.updatedAt, deviceId: String(newest.deviceId ?? "legacy"), deviceName: String(newest.deviceName ?? "Unknown device") } : null, differences, needsDecision };
}

/** Checks the endpoint, credentials, metadata and one encrypted record without writing anything. */
export async function verifyWebDavSync(config: SyncConfig): Promise<SyncVerification> {
  if (!config.endpoint.trim() || !config.username || !config.password) throw new Error("Enter the WebDAV endpoint, username, and password first.");
  let entries: string[];
  try { entries = await listEntries(config); }
  catch (error) {
    if (error instanceof TypeError) throw new Error("Could not reach the WebDAV server. Check its URL, HTTPS, and CORS settings.");
    throw error;
  }
  if (!entries.includes(META_FILE)) return { state: "empty", serverId: null, records: 0 };
  const meta = await readMeta(config);
  if (!meta) return { state: "empty", serverId: null, records: 0 };
  const key = await encryptionKey(config.passphrase, base64ToBytes(meta.salt));
  const files = entries.filter((file) => file.endsWith(".bin"));
  if (files[0]) {
    const response = await request(config, files[0]);
    if (!response.ok) throw new Error(`Could not read a sync record (${response.status}).`);
    try { await decrypt<SyncRecord>(key, await response.json() as EncryptedEnvelope); } catch { throw new Error("The encryption passphrase does not match this server."); }
  }
  return { state: "ready", serverId: meta.serverId || null, records: files.length };
}

/** Verifies endpoint credentials without trying to decrypt an existing sync. */
export async function inspectWebDavTarget(config: SyncConfig): Promise<SyncTargetInspection> {
  if (!config.endpoint.trim() || !config.username || !config.password) throw new Error("Enter the WebDAV endpoint, username, and password first.");
  let entries: string[];
  try { entries = await listEntries(config); }
  catch (error) {
    if (error instanceof TypeError) throw new Error("Could not reach the WebDAV server. Check its URL, HTTPS, and CORS settings.");
    throw error;
  }
  const records = entries.filter((file) => file.endsWith(".bin"));
  return { hasExistingData: entries.includes(META_FILE) || records.length > 0, records: records.length };
}

/** Replaces only MossChat's files in this WebDAV directory, then uploads the local data with a new key. */
export async function replaceWebDavSync({ config, data, settings }: { config: SyncConfig; data: AppData; settings: AppSettings }) {
  if (!isSyncConfigured(config)) throw new Error("Configure endpoint, WebDAV credentials, and passphrase first.");
  const entries = await listEntries(config);
  const targets = entries.filter((file) => file === META_FILE || file.endsWith(".bin"));
  await Promise.all(targets.map(async (file) => {
    const response = await request(config, file, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error(`Could not remove existing sync data (${response.status}).`);
  }));
  clearLocalSyncState(config);
  return synchronizeWebDav({ config, data, settings, resolution: "prefer-local" });
}

export async function synchronizeWebDav({ config, data, settings, resolution = "merge" }: { config: SyncConfig; data: AppData; settings: AppSettings; resolution?: SyncResolution }) {
  if (!isSyncConfigured(config)) throw new Error("Configure endpoint, WebDAV credentials, and passphrase first.");
  const { meta, salt } = await getEncryptionMaterial(config);
  const key = await encryptionKey(config.passphrase, salt);
  const previousIndex = loadIndex(config);
  const remoteRecords = await readRecords(config, key, await listFiles(config));
  const maximumRemoteClock = Math.max(0, ...remoteRecords.map(recordClock));
  const local = await recordsFor(data, settings, config.includeKeys);
  const localFiles = new Set(local.records.map(recordFile));
  const tombs = Object.keys(previousIndex).filter((file) => !localFiles.has(file) && !file.startsWith("t-")).map((file) => ({ type: "tomb" as const, id: file, updatedAt: new Date().toISOString(), payload: { file } }));
  const stamped = await stampLocalRecords([...local.records, ...tombs], previousIndex, config, maximumRemoteClock);
  const resolved = resolveRecords(stamped.records, remoteRecords, resolution);
  const remoteByFile = new Map(remoteRecords.map((record) => [recordFile(record), record]));
  // The selected record must win on the server even if its logical clock is older.
  // Without this payload comparison, an explicit choice could look successful
  // locally yet return as the same conflict after a reload.
  const uploads = (await Promise.all(resolved.map(async (record) => {
    const remote = remoteByFile.get(recordFile(record));
    if (!remote || compareRecords(record, remote) > 0) return record;
    return await contentHash(record.payload) === await contentHash(remote.payload) ? null : record;
  }))).filter((record): record is SyncRecord => record !== null);
  await Promise.all(uploads.map(async (record) => {
    const response = await request(config, recordFile(record), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await encrypt(key, record)) });
    if (!response.ok) throw new Error(`Could not upload ${record.type} record (${response.status}).`);
  }));
  const index = await indexRecords(resolved);
  const clock = Math.max(stamped.clock, ...resolved.map(recordClock));
  saveIndex(config, index);
  saveClock(config, clock);
  const now = new Date().toISOString();
  saveLastSyncAt(config, now);
  saveRememberedServerId(config, meta.serverId);
  const activeRecords = resolved.filter((record) => record.type !== "tomb");
  return { data: assembledData(activeRecords), settings: settingsForLocal(activeRecords.find((record) => record.type === "settings"), settings, config.includeKeys), uploaded: uploads.length, downloaded: remoteRecords.length, compressedImages: local.compressedImages, syncedAt: now, serverId: meta.serverId };
}
