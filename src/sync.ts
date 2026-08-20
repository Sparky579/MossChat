import type { AppData, AppSettings, Chat, Notebook, SavedAttachment, SavedMessage } from "./types";

const CONFIG_KEY = "mosschat.webdav.sync.v1";
const INDEX_PREFIX = "mosschat.webdav.sync.index.v2";
const CLOCK_PREFIX = "mosschat.webdav.sync.clock.v1";
const LAST_SYNC_PREFIX = "mosschat.webdav.sync.last-success.v1";
const META_FILE = "meta.json";
const ITERATIONS = 600_000;
const MAX_SYNC_IMAGE_EDGE = 2048;

export type SyncConfig = {
  endpoint: string;
  username: string;
  password: string;
  passphrase: string;
  deviceId: string;
  includeKeys: boolean;
};

type SyncConfigPayload = { endpoint?: unknown; url?: unknown; username?: unknown; password?: unknown; protocol?: unknown; path?: unknown; passphrase?: unknown; includeKeys?: unknown };
type EncryptedEnvelope = { v: 1; iv: string; data: string };
type SyncRecord = { type: "chat" | "message" | "notebook" | "settings" | "tomb"; id: string; updatedAt: string; payload: unknown; clock?: number; deviceId?: string };
/** Only sync metadata is kept locally: no chat body, attachment bytes, or encrypted record cache. */
type SyncIndexEntry = { hash: string; clock: number; deviceId: string };
type SyncIndex = Record<string, SyncIndexEntry>;

export const emptySyncConfig = (): SyncConfig => ({ endpoint: "", username: "", password: "", passphrase: "", deviceId: crypto.randomUUID(), includeKeys: false });

export function loadSyncConfig(): SyncConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}") as Partial<SyncConfig>;
    return { ...emptySyncConfig(), ...parsed, endpoint: String(parsed.endpoint ?? "").trim(), username: String(parsed.username ?? ""), password: String(parsed.password ?? ""), passphrase: String(parsed.passphrase ?? ""), deviceId: String(parsed.deviceId ?? crypto.randomUUID()), includeKeys: parsed.includeKeys === true };
  } catch { return emptySyncConfig(); }
}

export function saveSyncConfig(config: SyncConfig) { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
export function isSyncConfigured(config: SyncConfig) { return Boolean(config.endpoint && config.username && config.password && config.passphrase); }

/** Reads raw SYNC_CONFIG JSON or the optional ===SYNC_CONFIG_*=== wrapper. */
export function parseSyncConfig(value: string): Pick<SyncConfig, "endpoint" | "username" | "password" | "passphrase" | "includeKeys"> {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}") return { endpoint: "", username: "", password: "", passphrase: "", includeKeys: false };
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
  for (const [name, field] of [["username", parsed.username], ["password", parsed.password], ["passphrase", parsed.passphrase]] as const) {
    if (field !== undefined && typeof field !== "string") throw new Error(`SYNC_CONFIG ${name} must be a string.`);
  }
  if (parsed.includeKeys !== undefined && typeof parsed.includeKeys !== "boolean") throw new Error("SYNC_CONFIG includeKeys must be true or false.");
  return { endpoint, username: typeof parsed.username === "string" ? parsed.username : "", password: typeof parsed.password === "string" ? parsed.password : "", passphrase: typeof parsed.passphrase === "string" ? parsed.passphrase : "", includeKeys: parsed.includeKeys === true };
}

export function syncConfigJson(config: Pick<SyncConfig, "endpoint" | "username" | "password" | "passphrase" | "includeKeys">) {
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
  if (config.passphrase) value.passphrase = config.passphrase;
  if (config.includeKeys) value.includeKeys = true;
  return JSON.stringify(value, null, 2);
}

function configScope(config: SyncConfig) { return `${config.deviceId}:${config.endpoint}`; }
function indexKey(config: SyncConfig) { return `${INDEX_PREFIX}:${configScope(config)}`; }
function clockKey(config: SyncConfig) { return `${CLOCK_PREFIX}:${configScope(config)}`; }
function lastSyncKey(config: SyncConfig) { return `${LAST_SYNC_PREFIX}:${configScope(config)}`; }

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
  return { ...record, clock: recordClock(record), deviceId: typeof record.deviceId === "string" && record.deviceId ? record.deviceId : "legacy" };
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
      stamped.push({ ...record, clock: existing.clock, deviceId: existing.deviceId });
      clock = Math.max(clock, existing.clock);
      continue;
    }
    clock += 1;
    stamped.push({ ...record, clock, deviceId: config.deviceId });
  }
  return { records: stamped, clock };
}

async function indexRecords(records: SyncRecord[]): Promise<SyncIndex> {
  const entries = await Promise.all(records.map(async (record) => [recordFile(record), { hash: await contentHash(record.payload), clock: recordClock(record), deviceId: String(record.deviceId ?? "legacy") }] as const));
  return Object.fromEntries(entries);
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
    try { return normalizedRecord(await decrypt<SyncRecord>(key, await response.json() as EncryptedEnvelope)); } catch { return null; }
  }));
  return values.filter((value): value is SyncRecord => Boolean(value));
}

function resolveRecords(local: SyncRecord[], remote: SyncRecord[]) {
  const selected = new Map(local.map((record) => [recordFile(record), record]));
  for (const record of remote) {
    const file = recordFile(record);
    const current = selected.get(file);
    if (!current || compareRecords(record, current) > 0) selected.set(file, record);
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

export async function synchronizeWebDav({ config, data, settings }: { config: SyncConfig; data: AppData; settings: AppSettings; mode?: "merge" | "upload" }) {
  if (!isSyncConfigured(config)) throw new Error("Configure endpoint, WebDAV credentials, and passphrase first.");
  const salt = await getSalt(config);
  const key = await encryptionKey(config.passphrase, salt);
  const previousIndex = loadIndex(config);
  const remoteRecords = await readRecords(config, key, await listFiles(config));
  const maximumRemoteClock = Math.max(0, ...remoteRecords.map(recordClock));
  const local = await recordsFor(data, settings, config.includeKeys);
  const localFiles = new Set(local.records.map(recordFile));
  const tombs = Object.keys(previousIndex).filter((file) => !localFiles.has(file) && !file.startsWith("t-")).map((file) => ({ type: "tomb" as const, id: file, updatedAt: new Date().toISOString(), payload: { file } }));
  const stamped = await stampLocalRecords([...local.records, ...tombs], previousIndex, config, maximumRemoteClock);
  const resolved = resolveRecords(stamped.records, remoteRecords);
  const remoteByFile = new Map(remoteRecords.map((record) => [recordFile(record), record]));
  const uploads = resolved.filter((record) => {
    const remote = remoteByFile.get(recordFile(record));
    return !remote || compareRecords(record, remote) > 0;
  });
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
  const activeRecords = resolved.filter((record) => record.type !== "tomb");
  return { data: assembledData(activeRecords), settings: settingsForLocal(activeRecords.find((record) => record.type === "settings"), settings, config.includeKeys), uploaded: uploads.length, downloaded: remoteRecords.length, compressedImages: local.compressedImages, syncedAt: now };
}
