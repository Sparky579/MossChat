"use client";

import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  Eraser,
  FileText,
  GitBranch,
  ImagePlus,
  Menu,
  MessageSquarePlus,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  PanelLeftClose,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  TextQuote,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createBrowserAdapter, generateChatTitle } from "@/providers";
import { chooseAutomaticBackupFolder, createBackupZip, defaultSettings, deleteChat, deleteNotebook, download, escapeHtml, getStorageSafetyStatus, loadData, loadSettings, markManualBackup, newId, normalizeSettings, replaceData, requestPersistentStorage, saveChatDelta, saveChatMetadata, saveNotebook, saveSettings, type StorageSafetyStatus, writeAutomaticBackup } from "@/storage";
import { clearWebDavSync, emptySyncConfig, inspectWebDavSync, inspectWebDavTarget, isSyncConfigured, loadLastSyncAt, loadSyncConfig, parseSyncConfig, replaceWebDavSync, saveSyncConfig, SYNC_CONFIGURATION_CHANGED_ERROR, syncConfigJson, synchronizeWebDav, verifyWebDavSync, type SyncConfig, type SyncInspection, type SyncResolution } from "@/sync";
import type { AppData, AppSettings, Chat, Notebook, NotebookPromptMode, PromptPreset, ProviderId, ProviderKind, SavedAttachment, SavedMessage, ThinkingLevel } from "@/types";

type Locale = "en" | "zh";

const StreamingMarkdown = lazy(() => import("@/components/streaming-markdown").then((module) => ({ default: module.StreamingMarkdown })));

const COPY = {
  en: {
    newChat: "New chat", searchChats: "Search chats", library: "Library", notebooks: "Notebooks", recent: "Recents", localWorkspace: "Local workspace", browserOnly: "This browser only", export: "Export", settings: "Settings", manageApi: "Manage API & models", ask: "Ask ai-chat", explore: "What would you like to explore?", hero: "Chat with your own API, entirely in your browser.", mistakes: "AI may make mistakes. Check important info.", localStart: "Start a local conversation", localStartDetail: "Add an API key in Settings, or create a new chat.", createNotebook: "Create your first Notebook", newNotebook: "New Notebook", notebookSaved: "Auto-saved locally", notebookPlaceholder: "Write research notes here, or drop in documents and images…", sources: "Sources", addSources: "Add sources", askNotebook: "Chat with Notebook", localLibrary: "Local library", libraryDetail: "Drop images, PDFs, and text into a chat or Notebook. Files stay in this browser.", newSourceNotebook: "New source Notebook", backup: "Full local backup", includeKeys: "Include API keys (sensitive)", exportMd: "Export current chat as Markdown", exportWord: "Export current chat as Word", defaultProvider: "Default chat provider", apiModels: "API & models", behavior: "Conversation & naming", tools: "Native tools", privacy: "Local data", apiTitle: "API keys & default chat model", apiDetail: "Keys remain in this browser’s localStorage. Requests go directly from your browser to the chosen API.", key: "API key", baseUrl: "Base URL", defaultModel: "Default chat model", behaviorTitle: "Conversation & automatic naming", systemPrompt: "System prompt", systemDetail: "Optional: sent with every new request.", namingProvider: "Default naming provider", namingModel: "Default naming model", namingDetail: "When this is blank, the first part of the first user message becomes the chat title.", enterSends: "Press Enter to send; Shift + Enter for a new line", language: "Language", toolsTitle: "Native provider tools", toolsDetail: "Function declarations are translated to the active provider’s native tool protocol. When a model asks for one, enter the JSON result locally and it is returned to the same provider. This app does not execute arbitrary code.", googleSearch: "Google Search grounding", codeExecution: "Code execution", functionDeclarations: "Function declarations (JSON array)", functionDetail: "Example: [{\"name\":\"get_weather\",\"description\":\"…\",\"parameters\":{\"type\":\"object\",\"properties\":{}}}]", privacyTitle: "Local data & privacy", privacyDetail: "Chats, notebooks, and attachments are stored in browser IndexedDB. API keys and preferences are stored in localStorage. This app has no server, account, or cloud sync.", privacyHint: "Clearing site data, private browsing, or manually clearing localStorage/IndexedDB removes this data. Export backups regularly.", done: "Done", search: "Search chat history", unnamedNotebook: "Untitled notebook", untitled: "New chat", create: "Create", upload: "Upload", noText: "(The model returned no text.)",
  },
  zh: {
    newChat: "新建对话", searchChats: "搜索对话", library: "资料库", notebooks: "笔记本", recent: "最近对话", localWorkspace: "本地工作台", browserOnly: "仅此浏览器", export: "导出", settings: "设置", manageApi: "管理 API 与模型", ask: "询问 ai-chat", explore: "今天想探索什么？", hero: "使用你自己的 API，在你的浏览器里聊天。", mistakes: "AI 可能会出错，请核查重要信息。", localStart: "开始一段本地对话", localStartDetail: "先在设置中填入 API Key，或直接新建对话。", createNotebook: "创建你的第一个 Notebook", newNotebook: "新建 Notebook", notebookSaved: "自动保存到本机", notebookPlaceholder: "在这里写下你的研究笔记，或把文档、图片直接拖进来…", sources: "资料", addSources: "添加资料", askNotebook: "基于 Notebook 对话", localLibrary: "本地资料库", libraryDetail: "把图片、PDF、文本拖入对话或 Notebook；文件只保存在本机浏览器。", newSourceNotebook: "新建资料 Notebook", backup: "完整本地备份", includeKeys: "包含 API Key（敏感）", exportMd: "导出当前对话 Markdown", exportWord: "导出当前对话 Word", defaultProvider: "默认聊天提供商", apiModels: "API 与模型", behavior: "对话与命名", tools: "原生工具", privacy: "本地数据", apiTitle: "API 与默认聊天模型", apiDetail: "密钥仅保存在此浏览器的 localStorage；请求会从你的浏览器直接发往所选 API。", key: "API Key", baseUrl: "Base URL", defaultModel: "默认聊天模型", behaviorTitle: "对话与自动命名", systemPrompt: "System prompt", systemDetail: "可选：每个新请求都会带上这段系统提示词。", namingProvider: "默认命名提供商", namingModel: "默认命名模型", namingDetail: "命名模型留空时，会用用户首条消息的第一段作为会话标题。", enterSends: "Enter 发送，Shift + Enter 换行", language: "语言", toolsTitle: "提供商原生工具", toolsDetail: "函数声明会转换为当前提供商的原生工具协议。模型请求调用时，在本地填写 JSON 结果后会回传给同一提供商；本应用不会执行任意代码。", googleSearch: "Google 搜索 Grounding", codeExecution: "代码执行", functionDeclarations: "函数声明（JSON 数组）", functionDetail: "示例：[{\"name\":\"get_weather\",\"description\":\"…\",\"parameters\":{\"type\":\"object\",\"properties\":{}}}]", privacyTitle: "本地数据与隐私", privacyDetail: "会话、笔记和附件保存在浏览器 IndexedDB。API Key 与界面偏好保存在 localStorage。此应用没有服务器、账号或云同步功能。", privacyHint: "浏览器清除网站数据、无痕模式或手动清除 localStorage/IndexedDB 会删除这些内容；请定期使用导出备份。", done: "完成", search: "搜索聊天记录", unnamedNotebook: "未命名笔记", untitled: "新对话", create: "创建", upload: "上传", noText: "（模型没有返回文本内容）",
  },
} as const;

const LocaleContext = createContext<Locale>("en");
const useCopy = () => COPY[useContext(LocaleContext)];

function useCopyFeedback() {
  const locale = useContext(LocaleContext);
  const [copied, setCopied] = useState<string | null>(null);
  const timeout = useRef<number | null>(null);
  useEffect(() => () => { if (timeout.current) window.clearTimeout(timeout.current); }, []);
  const copyText = useCallback(async (value: string, id = "default") => {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      if (timeout.current) window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setCopied(null), 1_800);
      return true;
    } catch { return false; }
  }, []);
  return { copied, copyText, copiedLabel: locale === "zh" ? "已复制" : "Copied" };
}

function MossMark({ className, size = 24 }: { className?: string; size?: number }) {
  return <svg className={`moss-mark ${className ?? ""}`} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="9" fill="#E7F5EC" /><path d="M16.3 25.5c-4.9-1.6-7.2-5.2-6.5-10.7 4.9.5 8.2 3.2 8.3 8.4-.5.9-1.1 1.7-1.8 2.3Z" fill="#198754" /><path d="M17.2 16.9c.5-5 3.6-8.1 8.6-8.5.2 5.5-2.4 9-7.8 9.4l-.8-.9Z" fill="#46B96C" /><path d="M12.1 10.1c2.9.1 5.1 1.5 6 4.2-3 .6-5.2-.6-6-4.2Z" fill="#75CA8D" /><path d="M16.3 25.5c.2-4.1.6-6.6 3.8-10.8M16.4 21.8c-1.1-2.2-2.6-4-4.8-5.5" stroke="#0F5F37" strokeWidth="1.45" strokeLinecap="round" /></svg>;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechWindow = {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const orderedProviders = (settings: AppSettings) => settings.providerOrder
  .filter((id) => settings.providers[id])
  .map((id) => [id, settings.providers[id]] as const);

const providerEmoji = (provider: AppSettings["providers"][string] | undefined) => provider?.emoji?.trim() || "🤖";
const COMMON_PROVIDER_EMOJIS = ["🤖", "🧠", "✨", "🔮", "⚡", "🚀", "🦙", "🐱", "🐳", "🦉", "🧩", "🌿"];

const combinedNotebookPrompt = (chat: Chat | null, notebook: Notebook | undefined, globalPrompt: string) => {
  if (chat?.systemPrompt !== undefined) return chat.systemPrompt;
  const notebookPrompt = notebook?.systemPrompt?.trim() ?? "";
  if (!notebookPrompt) return globalPrompt;
  if ((notebook?.promptMode ?? "replace") === "replace") return notebookPrompt;
  return [globalPrompt.trim(), notebookPrompt].filter(Boolean).join("\n\n");
};

const PROVIDER_PRESETS = {
  google: { label: "Gemini", name: "Google Gemini", kind: "google" as ProviderKind, baseUrl: "https://generativelanguage.googleapis.com" },
  openai: { label: "OpenAI", name: "OpenAI", kind: "openai" as ProviderKind, baseUrl: "https://api.openai.com/v1" },
  anthropic: { label: "Anthropic", name: "Anthropic", kind: "anthropic" as ProviderKind, baseUrl: "https://api.anthropic.com" },
  openrouter: { label: "OpenRouter", name: "OpenRouter", kind: "openai" as ProviderKind, baseUrl: "https://openrouter.ai/api/v1" },
} as const;

type ProviderPresetId = keyof typeof PROVIDER_PRESETS;

function presetFromProviderName(name: string): ProviderPresetId | null {
  const value = name.trim().toLocaleLowerCase();
  if (value.includes("openrouter")) return "openrouter";
  if (value.includes("gemini") || value === "google") return "google";
  if (value.includes("anthropic") || value.includes("anthro")) return "anthropic";
  if (value.includes("openai")) return "openai";
  return null;
}

const shortDate = (time: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" }).format(new Date(time));

const formatBytes = (value?: number) => value === undefined ? "—" : value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;

const syncConnectionChanged = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  return message === SYNC_CONFIGURATION_CHANGED_ERROR || message === "WebDAV username or password is incorrect." || message === "The encryption passphrase does not match this server.";
};

const generatePassphrase = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (value) => value.toString(36).padStart(2, "0")).join("").slice(0, 48);

function syncAge(time: string | null, now: number, locale: Locale) {
  if (!time) return locale === "zh" ? "尚未同步" : "Not synced yet";
  const seconds = Math.max(0, Math.floor((now - Date.parse(time)) / 1000));
  if (seconds < 10) return locale === "zh" ? "已同步 · 刚刚" : "Synced · just now";
  if (seconds < 60) return locale === "zh" ? `已同步 · ${seconds} 秒前` : `Synced · ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === "zh" ? `已同步 · ${minutes} 分钟前` : `Synced · ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return locale === "zh" ? `已同步 · ${hours} 小时前` : `Synced · ${hours}h ago`;
}

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function inflateMessages(messages: SavedMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
    attachments: message.attachments,
  }));
}

function firstText(messages: SavedMessage[]): string {
  const first = messages.find((message) => message.role === "user");
  if (!first) return "";
  return first.content
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""))
    .join("\n")
    .trim();
}

function fallbackTitle(text: string): string {
  const firstChunk = text.split(/[\n。！？!?]/)[0]?.trim() || text.trim();
  return `${firstChunk.slice(0, 28)}${firstChunk.length > 28 ? "…" : ""}` || "New chat";
}

function chatToMarkdown(chat: Chat, locale: Locale): string {
  const turns = chat.messages.map((message) => {
    const label = message.role === "user" ? (locale === "zh" ? "你" : "You") : message.role === "assistant" ? "AI" : (locale === "zh" ? "系统" : "System");
    const content = message.content
      .map((part) => part.type === "text" ? String(part.text ?? "") : part.type === "image" ? "[图片附件]" : `[附件：${String(part.filename ?? "文件")}]`)
      .join("\n");
    const attachments = message.attachments?.map((attachment) => attachment.type === "image" ? `[${locale === "zh" ? "图片附件" : "Image attachment"}: ${attachment.name}]` : `[${locale === "zh" ? "附件" : "Attachment"}: ${attachment.name}]`).join("\n") ?? "";
    return `## ${label}\n\n${[content, attachments].filter(Boolean).join("\n")}`;
  });
  return `# ${chat.title}\n\n${locale === "zh" ? "导出时间" : "Exported"}: ${new Date().toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}\n\n${turns.join("\n\n---\n\n")}`;
}

type DraftAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

const MAX_FILES_PER_MESSAGE = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;
const MAX_CONTEXT_MESSAGES = 24;

type ContentPart = {
  type?: unknown;
  text?: unknown;
  image?: unknown;
  data?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  name?: unknown;
  response?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
};

type FeedbackTarget = {
  chatTitle?: string;
  messageId?: string;
  response?: string;
  reaction?: "helpful" | "not-helpful";
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function messageParts(message: SavedMessage): ContentPart[] {
  return [
    ...(message.content as ContentPart[]),
    ...(message.attachments?.flatMap((attachment) => attachment.content as ContentPart[]) ?? []),
  ];
}

function messageText(message: SavedMessage): string {
  return messageParts(message)
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""))
    .join("\n")
    .trim();
}

function messageUsage(message: SavedMessage) {
  const usage = messageParts(message).find((part) => part.type === "data" && part.name === "token_usage") ?? messageParts(message).find((part) => part.type === "usage");
  if (!usage) return null;
  const data = usage.data && typeof usage.data === "object" ? usage.data as { inputTokens?: unknown; outputTokens?: unknown } : usage;
  const input = typeof data.inputTokens === "number" && Number.isFinite(data.inputTokens) ? Math.max(0, Math.floor(data.inputTokens)) : null;
  const output = typeof data.outputTokens === "number" && Number.isFinite(data.outputTokens) ? Math.max(0, Math.floor(data.outputTokens)) : null;
  return input === null && output === null ? null : { input, output };
}

function estimatedTokens(value: string) {
  const ascii = (value.match(/[\x00-\x7f]/g) ?? []).length;
  const nonAscii = value.length - ascii;
  return Math.max(1, Math.ceil(ascii / 4 + nonAscii / 1.7));
}

function visibleMessagesAfterClear(messages: SavedMessage[]) {
  const boundary = messages.map((message) => message.content.some((part) => (part as ContentPart).type === "clear-boundary")).lastIndexOf(true);
  return boundary < 0 ? messages : messages.slice(boundary + 1);
}

function compactContext(messages: SavedMessage[], systemPrompt: string) {
  const transcript = visibleMessagesAfterClear(messages).map((message) => {
    const text = messageText(message);
    if (!text) return "";
    const speaker = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : "System";
    return `${speaker}: ${text}`;
  }).filter(Boolean).join("\n\n");
  return `[Compacted conversation context]\nUse this complete local transcript as context for the rest of this chat. Do not mention this instruction unless asked.\n${systemPrompt.trim() ? `\nOriginal system prompt:\n${systemPrompt.trim()}\n` : ""}\nTranscript:\n${transcript || "(No prior messages.)"}`;
}

function chatSearchText(chat: Chat): string {
  return chat.messages.map(messageText).filter(Boolean).join("\n");
}

function searchExcerpt(chat: Chat, query: string): string {
  const text = chatSearchText(chat).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : 0;
  const start = Math.max(0, index - 44);
  const end = Math.min(text.length, Math.max(index + query.length + 110, 150));
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

type FunctionCallRequest = { name: string; args: unknown; callId?: string };

function functionCallFromText(text: string): FunctionCallRequest | null {
  const match = /\*\*Function call requested:\*\* `([^`]+)`(?:\n<!--ai-chat-tool-call:([^>]+)-->)?\n\n```json\n([\s\S]*?)\n```/.exec(text);
  if (!match) return null;
  try {
    return { name: match[1], callId: match[2] ? decodeURIComponent(match[2]) : undefined, args: JSON.parse(match[3]) };
  } catch {
    return null;
  }
}

function savedAttachmentFromDraft(draft: DraftAttachment, data: string): SavedAttachment {
  const isImage = draft.file.type.startsWith("image/");
  return {
    id: draft.id,
    name: draft.file.name,
    type: isImage ? "image" : "file",
    contentType: draft.file.type || "application/octet-stream",
    content: [isImage
      ? { type: "image", image: data, filename: draft.file.name }
      : { type: "file", data, filename: draft.file.name, mimeType: draft.file.type || "application/octet-stream" }],
  };
}

function MessageMarkdown({ content, streaming }: { content: string; streaming: boolean }) {
  return <Suspense fallback={<div className="markdown markdown-fallback">{content}</div>}><StreamingMarkdown content={content} streaming={streaming} /></Suspense>;
}

function ThinkingBlock({ content, streaming }: { content: string; streaming: boolean }) {
  const locale = useContext(LocaleContext);
  const [open, setOpen] = useState(streaming);
  useEffect(() => setOpen(streaming), [streaming]);
  return <section className={`thinking-block ${streaming ? "is-streaming" : ""} ${open ? "is-open" : ""}`}><button type="button" className="thinking-summary" aria-expanded={open} onClick={() => setOpen((current) => !current)}><Sparkles size={15} /><span>{streaming ? (locale === "zh" ? "正在思考…" : "Thinking…") : (locale === "zh" ? "思考过程" : "Thinking")}</span><small>{streaming ? (locale === "zh" ? "流式更新" : "Streaming") : (locale === "zh" ? "点击展开" : "Click to expand")}</small><ChevronDown size={15} /></button><div className="thinking-panel"><div className="thinking-copy">{content}</div></div></section>;
}

function MessageBody({ message }: { message: SavedMessage }) {
  const parts = messageParts(message);
  const hasVisibleContent = parts.some((part) => (part.type === "text" || part.type === "reasoning") && String(part.text ?? "").trim());
  const isRunning = Boolean(message.status?.running);
  return <>
    {parts.map((part, index) => {
      if (part.type === "text" && part.text) return <MessageMarkdown key={`text-${index}`} content={String(part.text)} streaming={isRunning} />;
      if (part.type === "reasoning" && part.text) return <ThinkingBlock key={`reasoning-${index}`} content={String(part.text)} streaming={isRunning} />;
      if (part.type === "image" && part.image) return <img className="message-image" key={`image-${index}`} src={String(part.image)} alt={String(part.filename ?? "Uploaded image")} />;
      if (part.type === "file") return <span className="file-chip" key={`file-${index}`}><FileText size={16} />{String(part.filename ?? "Attachment")}<small>{String(part.mimeType ?? "file")}</small></span>;
      if (part.type === "function-result") return <span className="file-chip" key={`function-${index}`}><Sparkles size={16} />Function result: {String(part.name ?? "function")}</span>;
      return null;
    })}
    {!hasVisibleContent && isRunning && <span className="typing-dot">● ● ●</span>}
  </>;
}

function ChatMessage({ message, index, onFork, onEdit, onReload, onClear, onFunctionResult, onFeedback, canUndoClear, onUndoClear }: { message: SavedMessage; index: number; onFork: (index: number) => void; onEdit: (index: number, text: string) => void; onReload: (index: number) => void; onClear: () => void; onFunctionResult: (index: number, call: FunctionCallRequest) => void; onFeedback: (target: FeedbackTarget) => void; canUndoClear?: boolean; onUndoClear?: () => void }) {
  const user = message.role === "user";
  const cleared = message.content.some((part) => (part as ContentPart).type === "clear-boundary");
  const hasThinking = !user && message.content.some((part) => part.type === "reasoning" && Boolean(part.text));
  const locale = useContext(LocaleContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => messageText(message));
  const functionCall = user ? null : functionCallFromText(messageText(message));
  const { copied, copyText, copiedLabel } = useCopyFeedback();
  const copyMessage = async () => {
    const text = messageText(message);
    if (text) await copyText(text);
  };
  const usage = user ? null : messageUsage(message);
  if (cleared) return <div className="clear-boundary" role="status"><span>{locale === "zh" ? "上下文已清除；上方消息不会发送给模型" : "Context cleared; messages above are not sent to the model"}</span>{canUndoClear && <button type="button" onClick={onUndoClear}>{locale === "zh" ? "撤回" : "Undo"}</button>}</div>;
  return <article className={`message-row ${user ? "message-user" : "message-assistant"} ${hasThinking ? "has-thinking" : ""}`}>
    <div className="message-content">
      {!user && <div className="assistant-avatar"><MossMark size={15} /></div>}
      <div className={user ? "user-bubble" : "assistant-copy"}>{editing ? <div className="inline-message-editor"><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); const next = draft.trim(); if (next) { onEdit(index, next); setEditing(false); } } }} /><div><button type="button" onClick={() => setEditing(false)}>{locale === "zh" ? "取消" : "Cancel"}</button><button type="button" className="text-button" onClick={() => { const next = draft.trim(); if (next) { onEdit(index, next); setEditing(false); } }}>{locale === "zh" ? "保存并重试" : "Save & retry"}</button></div></div> : <MessageBody message={message} />}</div>
    </div>
    {!user && !message.status?.running && <div className="answer-feedback"><span>{locale === "zh" ? "这条回答怎么样？" : "How was this response?"}</span>{usage && <span className="token-usage">Input {usage.input?.toLocaleString() ?? "—"} · Output {usage.output?.toLocaleString() ?? "—"}</span>}<button className="icon-button" type="button" aria-label={locale === "zh" ? "有帮助" : "Helpful"} title={locale === "zh" ? "有帮助" : "Helpful"} onClick={() => onFeedback({ messageId: message.id, response: messageText(message), reaction: "helpful" })}><ThumbsUp size={15} /></button><button className="icon-button" type="button" aria-label={locale === "zh" ? "没有帮助" : "Not helpful"} title={locale === "zh" ? "没有帮助" : "Not helpful"} onClick={() => onFeedback({ messageId: message.id, response: messageText(message), reaction: "not-helpful" })}><ThumbsDown size={15} /></button></div>}
    <div className="message-actions">
      <button className={`icon-button copy-button ${copied ? "is-copied" : ""}`} type="button" aria-label={copied ? copiedLabel : (locale === "zh" ? "复制" : "Copy")} title={copied ? copiedLabel : (locale === "zh" ? "复制" : "Copy")} onClick={() => void copyMessage()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
      {user && <button className="icon-button" type="button" aria-label="Edit" title="Edit" onClick={() => { setDraft(messageText(message)); setEditing(true); }}><Pencil size={16} /></button>}
      {!user && <button className="icon-button" type="button" aria-label="Regenerate" title="Regenerate" onClick={() => onReload(index)}><RefreshCw size={16} /></button>}
      {!user && <button className="icon-button" type="button" aria-label={locale === "zh" ? "清除上下文" : "Clear context"} title={locale === "zh" ? "清除上下文" : "Clear context"} onClick={onClear}><Eraser size={16} /></button>}
      {functionCall && <button className="icon-button" type="button" aria-label="Return function result" title={locale === "zh" ? "填写函数结果" : "Return function result"} onClick={() => onFunctionResult(index, functionCall)}><MoreHorizontal size={16} /></button>}
      <button className="icon-button" type="button" title={locale === "zh" ? "从这里分支为新对话" : "Branch into a new chat"} onClick={() => onFork(index)}><GitBranch size={16} /></button>
    </div>
  </article>;
}

function GeminiComposer({ settings, isRunning, onSend, onCancel, onSettingsChange }: { settings: AppSettings; isRunning: boolean; onSend: (text: string, attachments: DraftAttachment[]) => Promise<void>; onCancel: () => void; onSettingsChange: (next: AppSettings) => void }) {
  const copy = useCopy();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const composerInput = useRef<HTMLTextAreaElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const attachmentsRef = useRef<DraftAttachment[]>([]);
  const activeProvider = settings.providers[settings.activeProvider] ?? orderedProviders(settings)[0]?.[1];
  const commandDraft = text.trimStart();
  const commandToken = commandDraft.split(/\s+/, 1)[0]?.toLocaleLowerCase() ?? "";
  const commandOptions = [
    { value: "/clear", description: settings.language === "zh" ? "保留消息显示，但不再将上方内容发送给模型" : "Keep messages visible, but stop sending earlier context to the model." },
    { value: "/compact", description: settings.language === "zh" ? "本地注入完整压缩上下文，不调用模型" : "Inject local compact context without calling the model." },
    { value: "/prompt", description: settings.language === "zh" ? "打开当前对话、Notebook 或全局 Prompt 设置" : "Open prompt settings for this chat, its Notebook, or the global default." },
  ];
  const commandMatches = !attachments.length && commandDraft === commandToken && commandToken.startsWith("/") ? commandOptions.filter((command) => command.value.startsWith(commandToken)) : [];
  const commandOpen = commandMatches.length > 0;
  const completeCommand = (value: string) => {
    setText(value);
    requestAnimationFrame(() => composerInput.current?.focus());
  };

  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  useLayoutEffect(() => {
    const input = composerInput.current;
    if (!input) return;
    const maxHeight = 23 * 6 + 10;
    input.style.height = "auto";
    const height = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${Math.max(34, height)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);
  useEffect(() => () => {
    recognition.current?.stop();
    attachmentsRef.current.forEach((attachment) => attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl));
  }, []);
  useEffect(() => {
    if (!modelOpen) return;
    const closeWhenOutside = (event: PointerEvent) => { if (!modelMenuRef.current?.contains(event.target as Node)) setModelOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setModelOpen(false); };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [modelOpen]);

  const addFiles = useCallback((files: File[]) => {
    let usedBytes = attachments.reduce((total, attachment) => total + attachment.file.size, 0);
    const accepted: File[] = [];
    for (const file of files) {
      if (accepted.length + attachments.length >= MAX_FILES_PER_MESSAGE || file.size > MAX_FILE_BYTES || usedBytes + file.size > MAX_MESSAGE_BYTES) continue;
      accepted.push(file);
      usedBytes += file.size;
    }
    if (accepted.length < files.length) {
      window.alert(settings.language === "zh" ? `每条最多 ${MAX_FILES_PER_MESSAGE} 个文件，单个文件不超过 10 MB，总计不超过 20 MB。` : `Up to ${MAX_FILES_PER_MESSAGE} files per message, 10 MB each and 20 MB in total.`);
    }
    setAttachments((current) => [...current, ...accepted.map((file) => ({ id: newId("draft-file"), file, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }))]);
  }, [attachments.length, settings.language]);

  const removeAttachment = (id: string) => setAttachments((current) => {
    const removed = current.find((attachment) => attachment.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    return current.filter((attachment) => attachment.id !== id);
  });

  const send = async () => {
    if (sending || isRunning || (!text.trim() && attachments.length === 0)) return;
    setSending(true);
    try {
      await onSend(text.trim(), attachments);
      attachments.forEach((attachment) => attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl));
      setText("");
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };

  const toggleDictation = () => {
    if (listening) return recognition.current?.stop();
    const speechWindow = window as unknown as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      window.alert(settings.language === "zh" ? "此浏览器不支持 Web Speech API。请使用 Chrome 或 Edge。" : "This browser does not support the Web Speech API. Try Chrome or Edge.");
      return;
    }
    const instance = new Recognition();
    recognition.current = instance;
    instance.lang = settings.language === "zh" ? "zh-CN" : "en-US";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => setText((current) => `${current}${Array.from(event.results).map((result) => result[0]?.transcript ?? "").join("")}`);
    instance.onend = () => setListening(false);
    instance.onerror = () => setListening(false);
    setListening(true);
    instance.start();
  };

  return <div className={`gemini-composer ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
    {commandOpen && <div className="composer-command-menu" role="listbox" aria-label={settings.language === "zh" ? "指令补全" : "Command completion"}>{commandMatches.map((command, index) => <button key={command.value} type="button" className={index === 0 ? "is-active" : ""} aria-selected={index === 0} onMouseDown={(event) => event.preventDefault()} onClick={() => completeCommand(command.value)}><span className="composer-command-title"><strong>{command.value}</strong>{index === 0 && <kbd>↵</kbd>}</span><span>{command.description}</span></button>)}</div>}
    {attachments.length > 0 && <div className="composer-attachments">{attachments.map((attachment) => <span className="composer-attachment" key={attachment.id}><span className="attachment-icon">{attachment.file.type.startsWith("image/") ? <ImagePlus size={18} /> : <FileText size={18} />}</span><span className="attachment-name">{attachment.file.name}</span><button className="icon-button attachment-remove" type="button" aria-label="Remove attachment" onClick={() => removeAttachment(attachment.id)}><X size={14} /></button></span>)}</div>}
    <div className="composer-line">
      <input ref={fileInput} hidden type="file" multiple accept="image/*,application/pdf,.txt,.md,.csv,.doc,.docx" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
      <button type="button" className="icon-button composer-plus" aria-label="Attach files" onClick={() => fileInput.current?.click()}><Plus size={23} /></button>
      <textarea ref={composerInput} rows={1} value={text} placeholder={copy.ask} className="composer-input" onChange={(event) => setText(event.target.value)} onPaste={(event) => { const images = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file)); if (images.length) { event.preventDefault(); addFiles(images); } }} onKeyDown={(event) => { const firstMatch = commandMatches[0]; if (firstMatch && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && commandToken !== firstMatch.value) { event.preventDefault(); completeCommand(firstMatch.value); return; } if (settings.sendWithEnter && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <div className={`composer-model-wrap ${text || attachments.length ? "has-draft" : ""}`} ref={modelMenuRef}>
        <button type="button" className="model-button" title={activeProvider?.model ?? ""} onClick={() => setModelOpen((current) => !current)}><span className="model-emoji" aria-hidden="true">{providerEmoji(activeProvider)}</span><span className="model-name">{activeProvider?.model ?? "Select a model"}</span><ChevronDown size={15} /></button>
        {modelOpen && <div className="model-menu composer-model-menu"><ModelMenuOptions settings={settings} onChange={onSettingsChange} onClose={() => setModelOpen(false)} /></div>}
      </div>
      <button type="button" className={`icon-button mic-button ${listening ? "is-listening" : ""}`} aria-label="Voice input" onClick={toggleDictation}><Mic size={20} /></button>
      {isRunning ? <button type="button" className="send-button" aria-label="Stop generating" onClick={onCancel}><Square size={14} fill="currentColor" /></button> : (text.trim() || attachments.length > 0) && <button type="button" className="send-button" aria-label="Send" onClick={() => void send()}><ArrowUp size={21} /></button>}
    </div>
  </div>;
}

function StarterPrompts({ onSend }: { onSend: (prompt: string) => void }) {
  const locale = useContext(LocaleContext);
  const prompts = locale === "zh" ? ["帮我规划今天的工作", "解释一个复杂概念", "分析我上传的图片或 PDF"] : ["Plan my work for today", "Explain a complex concept", "Analyze an image or PDF I upload"];
  return <div className="starter-prompts">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => onSend(prompt)}>{prompt}<SendHorizontal size={15} /></button>)}</div>;
}

function GeminiThread({ chat, settings, systemPrompt, onSnapshot, onFork, onSettingsChange, onFeedback, onOpenPromptSettings }: { chat: Chat; settings: AppSettings; systemPrompt: string; onSnapshot: (id: string, messages: SavedMessage[], dirtyMessageIds?: string[]) => void; onFork: (index: number) => void; onSettingsChange: (next: AppSettings) => void; onFeedback: (target: FeedbackTarget) => void; onOpenPromptSettings: () => void }) {
  const copy = useCopy();
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const autoRunRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => () => abortRef.current?.abort(), []);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && stickToBottomRef.current) viewport.scrollTop = viewport.scrollHeight;
  }, [chat.messages, isRunning]);

  const run = useCallback(async (baseMessages: SavedMessage[]) => {
    const assistantId = newId("assistant");
    let nextMessages: SavedMessage[] = [...baseMessages, { id: assistantId, role: "assistant", content: [], createdAt: new Date().toISOString(), status: { running: true } }];
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    onSnapshot(chat.id, nextMessages, [assistantId, ...baseMessages.slice(-1).map((message) => message.id)]);
    let pendingSnapshot: SavedMessage[] | null = null;
    let frame = 0;
    let persistedLength = 0;
    const flush = () => {
      if (pendingSnapshot) onSnapshot(chat.id, pendingSnapshot);
      pendingSnapshot = null;
      frame = 0;
    };
    try {
      const adapter = createBrowserAdapter(() => ({ ...settings, systemPrompt }));
      const context = visibleMessagesAfterClear(baseMessages).slice(-MAX_CONTEXT_MESSAGES);
      const estimatedInput = estimatedTokens(`${systemPrompt}\n${context.map(messageText).join("\n")}`);
      const stream = adapter.run({ messages: inflateMessages(context), abortSignal: controller.signal } as never) as AsyncIterable<{ content?: ContentPart[] }>;
      for await (const update of stream) {
        const content = (update.content ?? [])
          .filter((part) => ((part.type === "text" || part.type === "reasoning") && typeof part.text === "string") || (part.type === "data" && part.name === "token_usage" && part.data && typeof part.data === "object"))
          .map((part) => part.type === "data" ? { type: "data", name: "token_usage", data: part.data } : { type: part.type, text: String(part.text) });
        const streamedLength = content.reduce((total, part) => total + String(part.text ?? "").length, 0);
        nextMessages = nextMessages.map((message) => message.id === assistantId ? { ...message, content, status: { running: true } } : message);
        pendingSnapshot = nextMessages;
        if (!frame) frame = window.requestAnimationFrame(flush);
        if (streamedLength - persistedLength >= 400) {
          persistedLength = streamedLength;
          onSnapshot(chat.id, nextMessages, [assistantId]);
        }
      }
      if (frame) window.cancelAnimationFrame(frame);
      nextMessages = nextMessages.map((message) => message.id === assistantId ? { ...message, content: message.content.some((part) => (part as ContentPart).type === "data" && (part as ContentPart).name === "token_usage") ? message.content : [...message.content, { type: "data", name: "token_usage", data: { inputTokens: estimatedInput, outputTokens: estimatedTokens(messageText(message)) } }], status: undefined } : message);
      onSnapshot(chat.id, nextMessages, [assistantId]);
    } catch (error) {
      const stopped = error instanceof DOMException && error.name === "AbortError";
      if (frame) window.cancelAnimationFrame(frame);
      if (stopped) {
        nextMessages = nextMessages.map((message) => message.id === assistantId ? { ...message, status: undefined } : message);
      } else {
        const details = error instanceof Error ? error.message : String(error);
        nextMessages = nextMessages.map((message) => message.id === assistantId ? { ...message, content: [{ type: "text", text: `**${settings.language === "zh" ? "请求失败" : "Request failed"}:** ${details}` }], status: undefined } : message);
      }
      onSnapshot(chat.id, nextMessages, [assistantId]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsRunning(false);
    }
  }, [chat.id, onSnapshot, settings, systemPrompt]);

  const clearConversation = useCallback(() => {
    if (isRunning) return;
    const marker: SavedMessage = { id: newId("clear"), role: "system", content: [{ type: "clear-boundary" }], createdAt: new Date().toISOString(), status: { clearBoundary: true } };
    onSnapshot(chat.id, [...chat.messages, marker], [marker.id]);
  }, [chat.id, chat.messages, isRunning, onSnapshot]);

  const compactConversation = useCallback(() => {
    if (isRunning) return;
    const now = new Date().toISOString();
    const marker: SavedMessage = { id: newId("clear"), role: "system", content: [{ type: "clear-boundary" }], createdAt: now, status: { clearBoundary: true } };
    const compacted: SavedMessage = { id: newId("compact"), role: "user", content: [{ type: "text", text: compactContext(chat.messages, systemPrompt) }], createdAt: now, status: { compactedContext: true } };
    const acknowledged: SavedMessage = { id: newId("compact-ack"), role: "assistant", content: [{ type: "text", text: settings.language === "zh" ? "收到。我会把这份压缩上下文作为后续对话的基础。" : "Got it. I’ll use this compacted context as the basis for the rest of this conversation." }, { type: "data", name: "token_usage", data: { inputTokens: 0, outputTokens: 0 } }], createdAt: now, status: { staticCompact: true } };
    onSnapshot(chat.id, [...chat.messages, marker, compacted, acknowledged], [marker.id, compacted.id, acknowledged.id]);
  }, [chat.id, chat.messages, isRunning, onSnapshot, settings.language, systemPrompt]);

  const send = useCallback(async (text: string, attachments: DraftAttachment[]) => {
    if (!attachments.length) {
      const command = text.trim().toLocaleLowerCase();
      if (command === "/clear") { clearConversation(); return; }
      if (command === "/compact") { compactConversation(); return; }
      if (command === "/prompt") { onOpenPromptSettings(); return; }
    }
    const savedAttachments = await Promise.all(attachments.map(async (attachment) => savedAttachmentFromDraft(attachment, await toDataUrl(attachment.file))));
    const user: SavedMessage = { id: newId("user"), role: "user", content: text ? [{ type: "text", text }] : [], attachments: savedAttachments, createdAt: new Date().toISOString() };
    await run([...chat.messages, user]);
  }, [chat.messages, clearConversation, compactConversation, onOpenPromptSettings, run]);

  useEffect(() => {
    const pending = chat.messages.at(-1);
    const pendingStatus = pending?.status;
    if (autoRunRef.current === chat.id || pending?.role !== "user" || !pendingStatus?.autoRun) return;
    // Delay an automatic Notebook run until React’s development effect replay is
    // complete. Otherwise its abort cleanup can cancel the first request.
    const timer = window.setTimeout(() => {
      if (autoRunRef.current === chat.id) return;
      autoRunRef.current = chat.id;
      const { autoRun: _autoRun, ...status } = pendingStatus;
      void run([...chat.messages.slice(0, -1), { ...pending, status: Object.keys(status).length ? status : undefined }]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [chat, run]);

  const edit = (index: number, edited: string) => {
    const target = chat.messages[index];
    if (!target || target.role !== "user") return;
    const existing = messageText(target);
    if (!edited || edited === existing) return;
    const before = chat.messages.slice(0, index);
    void run([...before, { ...target, content: [{ type: "text", text: edited }], createdAt: new Date().toISOString() }]);
  };

  const reload = (index: number) => {
    const withoutLastAssistant = chat.messages.slice(0, index);
    if (withoutLastAssistant.length) void run(withoutLastAssistant);
  };

  const submitFunctionResult = (index: number, call: FunctionCallRequest) => {
    const raw = window.prompt(settings.language === "zh" ? `填写 ${call.name} 的 JSON 结果` : `Enter a JSON result for ${call.name}`, JSON.stringify({}));
    if (raw === null) return;
    let response: unknown = raw;
    try { response = JSON.parse(raw); } catch { /* Plain text is a valid result payload. */ }
    const result: SavedMessage = { id: newId("function-result"), role: "user", content: [{ type: "function-result", name: call.name, response, callId: call.callId }], createdAt: new Date().toISOString() };
    void run([...chat.messages.slice(0, index + 1), result]);
  };

  const cancel = () => abortRef.current?.abort();
  const clearBoundary = chat.messages.map((message) => message.content.some((part) => (part as ContentPart).type === "clear-boundary")).lastIndexOf(true);
  const undoClear = () => {
    if (clearBoundary < 0 || clearBoundary !== chat.messages.length - 1) return;
    onSnapshot(chat.id, chat.messages.slice(0, clearBoundary));
  };
  const empty = chat.messages.length === 0;
  return <div className="thread-root">
    {empty ? <div className="hero-state"><div className="hero-copy"><MossMark className="app-mark hero-mark" /><h1>{copy.explore}</h1><p>{copy.hero}</p></div><GeminiComposer settings={settings} isRunning={isRunning} onSend={send} onCancel={cancel} onSettingsChange={onSettingsChange} /><StarterPrompts onSend={(prompt) => void send(prompt, [])} /></div> : <><div ref={viewportRef} className="thread-viewport" onScroll={(event) => { const viewport = event.currentTarget; stickToBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96; }}>{chat.messages.map((message, index) => <ChatMessage key={message.id} message={message} index={index} onFork={onFork} onEdit={edit} onReload={reload} onClear={clearConversation} onFunctionResult={submitFunctionResult} onFeedback={(target) => onFeedback({ ...target, chatTitle: chat.title })} canUndoClear={index === chat.messages.length - 1 && message.content.some((part) => (part as ContentPart).type === "clear-boundary")} onUndoClear={undoClear} />)}</div><footer className="thread-footer"><GeminiComposer settings={settings} isRunning={isRunning} onSend={send} onCancel={cancel} onSettingsChange={onSettingsChange} /><p>{copy.mistakes}</p></footer></>}
  </div>;
}

function ModelMenuOptions({ settings, onChange, onClose }: { settings: AppSettings; onChange: (next: AppSettings) => void; onClose: () => void }) {
  const copy = useCopy();
  return <>
    {orderedProviders(settings).flatMap(([id, provider]) => provider.models.filter(Boolean).map((model) => <button key={`${id}:${model}`} type="button" className={id === settings.activeProvider && model === provider.model ? "active" : ""} onClick={() => { onChange({ ...settings, activeProvider: id, providers: { ...settings.providers, [id]: { ...provider, model } } }); onClose(); }}><span className="model-menu-label"><i aria-hidden="true">{providerEmoji(provider)}</i><span><strong>{provider.name}</strong><small>{model}</small></span></span>{id === settings.activeProvider && model === provider.model && <Check size={16} />}</button>))}
    <hr />
    <button type="button" onClick={() => { document.dispatchEvent(new CustomEvent("ai-chat:open-settings")); onClose(); }}><Settings size={16} />{copy.manageApi}</button>
  </>;
}

function ModelMenu({ settings, onChange }: { settings: AppSettings; onChange: (next: AppSettings) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const provider = settings.providers[settings.activeProvider] ?? orderedProviders(settings)[0]?.[1];
  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  return <div className="model-menu-wrap" ref={menuRef}>
    <button type="button" className="top-model" title={provider?.model ?? ""} onClick={() => setOpen((current) => !current)}><span className="model-emoji" aria-hidden="true">{providerEmoji(provider)}</span><span className="model-name">{provider?.model ?? "Select a model"}</span><ChevronDown size={16} /></button>
    {open && <div className="model-menu top-model-menu"><ModelMenuOptions settings={settings} onChange={onChange} onClose={() => setOpen(false)} /></div>}
  </div>;
}

function ThinkingMenu({ settings, onChange }: { settings: AppSettings; onChange: (next: AppSettings) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const locale = useContext(LocaleContext);
  const labelFor = (level: ThinkingLevel) => ({
    off: locale === "zh" ? "思考：关闭" : "Thinking: Off",
    low: locale === "zh" ? "思考：低" : "Thinking: Low",
    medium: locale === "zh" ? "思考：中" : "Thinking: Medium",
    high: locale === "zh" ? "思考：高" : "Thinking: High",
    custom: locale === "zh" ? "思考：自定义" : "Thinking: Custom",
  }[level] ?? (locale === "zh" ? `思考：${level}` : `Thinking: ${level}`));
  const choices: ThinkingLevel[] = ["off", "low", "medium", "high", "custom"];
  const customPreset = choices.includes(settings.thinkingLevel) ? "" : settings.thinkingLevel;
  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  return <div className="thinking-menu-wrap" ref={menuRef}><button type="button" className={`thinking-button ${settings.thinkingLevel !== "off" ? "active" : ""}`} title={locale === "zh" ? "调整思考等级" : "Adjust thinking level"} onClick={() => setOpen((current) => !current)}><Sparkles size={16} /><span>{labelFor(settings.thinkingLevel)}</span><ChevronDown size={15} /></button>{open && <div className="thinking-menu"><strong>{locale === "zh" ? "思考等级" : "Thinking level"}</strong>{choices.map((level) => <button key={level} type="button" className={settings.thinkingLevel === level ? "active" : ""} onClick={() => { onChange({ ...settings, thinkingLevel: level }); setOpen(false); }}>{labelFor(level)}</button>)}<label>{locale === "zh" ? "提供商预设值" : "Provider preset"}<input list="thinking-preset-values" value={customPreset} placeholder="e.g. xhigh" onChange={(event) => onChange({ ...settings, thinkingLevel: event.target.value.trim() || "off" })} /><datalist id="thinking-preset-values"><option value="minimal" /><option value="xhigh" /></datalist></label>{settings.thinkingLevel === "custom" && <label>{locale === "zh" ? "Token 预算" : "Token budget"}<input type="number" min="0" step="128" value={settings.thinkingBudget} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange({ ...settings, thinkingBudget: Number(event.target.value) || 0 })} /></label>}<small>{locale === "zh" ? "原生预设会原样传给兼容提供商，并在下一条请求生效" : "Provider presets are passed through to compatible APIs on the next request"}</small></div>}</div>;
}

function PromptDialog({ target, scope, settings, onChange, onSavePrompt, onClose }: { target: Pick<Chat, "id" | "title" | "systemPrompt">; scope: "chat" | "notebook"; settings: AppSettings; onChange: (next: AppSettings) => void; onSavePrompt: (prompt: string) => void; onClose: () => void }) {
  const locale = useContext(LocaleContext);
  const [prompt, setPrompt] = useState(target.systemPrompt ?? "");
  const [presetTitle, setPresetTitle] = useState("");
  const [presetContent, setPresetContent] = useState("");
  const targetName = scope === "notebook" ? (locale === "zh" ? "Notebook" : "Notebook") : (locale === "zh" ? "对话" : "conversation");
  const addPreset = () => {
    const title = presetTitle.trim();
    const content = presetContent.trim();
    if (!title || !content) return;
    const preset: PromptPreset = { id: newId("prompt"), title: title.slice(0, 80), content };
    onChange({ ...settings, promptPresets: [preset, ...settings.promptPresets] });
    setPresetTitle("");
    setPresetContent("");
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="prompt-dialog" role="dialog" aria-modal="true" aria-label={locale === "zh" ? "系统提示词与预设" : "System prompt and presets"} onMouseDown={(event) => event.stopPropagation()}><header><div><TextQuote size={20} /><h2>{locale === "zh" ? "Prompts" : "Prompts"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={locale === "zh" ? "关闭" : "Close"}><X /></button></header><div className="prompt-dialog-body"><section><h3>{locale === "zh" ? `${targetName} system prompt` : `${targetName} system prompt`}</h3><p>{target.systemPrompt === undefined ? (locale === "zh" ? "留空时会继承 Notebook 或全局默认 system prompt。" : "Leave blank to inherit the Notebook or global default system prompt.") : (locale === "zh" ? "这是当前对象的独立覆盖值。" : "This is a local override for the current item.")}</p><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={locale === "zh" ? "输入此对话或 Notebook 的 system prompt…" : "Write a system prompt for this conversation or Notebook…"} rows={7} /><div className="prompt-dialog-actions"><button type="button" onClick={onClose}>{locale === "zh" ? "取消" : "Cancel"}</button><button type="button" className="text-button" onClick={() => { onSavePrompt(prompt.trim()); onClose(); }}>{locale === "zh" ? "保存" : "Save"}</button></div></section><section className="prompt-presets"><div><h3>{locale === "zh" ? "预设提示词" : "Prompt presets"}</h3><p>{locale === "zh" ? "选择后会填入上方 system prompt，可再修改后保存。" : "Choose one to fill the system prompt above, then edit or save it."}</p></div>{settings.promptPresets.length ? <div className="prompt-preset-list">{settings.promptPresets.map((preset) => <article key={preset.id}><div><strong>{preset.title}</strong><small>{preset.content}</small></div><button type="button" onClick={() => setPrompt(preset.content)}>{locale === "zh" ? "使用" : "Use"}</button><button type="button" className="icon-button" title={locale === "zh" ? "删除预设" : "Delete preset"} onClick={() => onChange({ ...settings, promptPresets: settings.promptPresets.filter((item) => item.id !== preset.id) })}><Trash2 size={15} /></button></article>)}</div> : <p className="prompt-empty">{locale === "zh" ? "还没有预设。可在下面保存常用提示词。" : "No presets yet. Save a frequently used prompt below."}</p>}<div className="new-preset"><input value={presetTitle} maxLength={80} placeholder={locale === "zh" ? "预设名称" : "Preset name"} onChange={(event) => setPresetTitle(event.target.value)} /><textarea value={presetContent} placeholder={locale === "zh" ? "预设内容" : "Preset content"} rows={4} onChange={(event) => setPresetContent(event.target.value)} /><button type="button" onClick={addPreset}><Plus size={15} />{locale === "zh" ? "保存为预设" : "Save preset"}</button></div></section></div></section></div>;
}

type PromptScope = "global" | "chat" | "notebook";

function PromptSettingsDialog({ chat, notebook, initialScope, settings, onChange, onSaveChat, onSaveNotebook, onSaveGlobal, onClose }: { chat: Chat | null; notebook: Notebook | null; initialScope: PromptScope; settings: AppSettings; onChange: (next: AppSettings) => void; onSaveChat: (prompt: string) => void; onSaveNotebook: (prompt: string, mode: NotebookPromptMode) => void; onSaveGlobal: (prompt: string) => void; onClose: () => void }) {
  const locale = useContext(LocaleContext);
  const [scope, setScope] = useState<PromptScope>(initialScope);
  const [prompt, setPrompt] = useState("");
  const [notebookMode, setNotebookMode] = useState<NotebookPromptMode>(notebook?.promptMode ?? "replace");
  const [presetTitle, setPresetTitle] = useState("");
  const [presetContent, setPresetContent] = useState("");
  const scopes = [
    chat ? { value: "chat" as const, label: locale === "zh" ? "当前对话" : "Current chat" } : null,
    { value: "global" as const, label: locale === "zh" ? "全局默认" : "Global default" },
    notebook ? { value: "notebook" as const, label: locale === "zh" ? "当前 Notebook" : "Current Notebook" } : null,
  ].filter((item): item is { value: PromptScope; label: string } => Boolean(item));
  const promptFor = (nextScope: PromptScope) => nextScope === "chat" ? chat?.systemPrompt ?? "" : nextScope === "notebook" ? notebook?.systemPrompt ?? "" : settings.systemPrompt;
  useEffect(() => {
    if (!scopes.some((item) => item.value === scope)) setScope("global");
  }, [scope, scopes]);
  useEffect(() => {
    setPrompt(promptFor(scope));
    if (scope === "notebook") setNotebookMode(notebook?.promptMode ?? "replace");
  }, [scope, chat?.id, chat?.systemPrompt, notebook?.id, notebook?.systemPrompt, notebook?.promptMode, settings.systemPrompt]);
  const addPreset = () => {
    const title = presetTitle.trim();
    const content = presetContent.trim();
    if (!title || !content) return;
    const preset: PromptPreset = { id: newId("prompt"), title: title.slice(0, 80), content };
    onChange({ ...settings, promptPresets: [preset, ...settings.promptPresets] });
    setPresetTitle("");
    setPresetContent("");
  };
  const description = scope === "chat"
    ? (locale === "zh" ? "当前对话 Prompt 优先级最高，会覆盖 Notebook 与全局 Prompt。" : "This chat prompt has the highest priority and overrides Notebook and global prompts.")
    : scope === "notebook"
      ? (locale === "zh" ? "设置后会应用到此 Notebook 内未单独设置 Prompt 的对话。" : "This applies to chats in this Notebook that do not have their own prompt.")
      : (locale === "zh" ? "这是所有未使用对话或 Notebook Prompt 的默认系统提示词。" : "This is the default system prompt when a chat or Notebook does not provide one.");
  const save = () => {
    const next = prompt.trim();
    if (scope === "chat") onSaveChat(next);
    else if (scope === "notebook") onSaveNotebook(next, notebookMode);
    else onSaveGlobal(next);
    onClose();
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="prompt-dialog" role="dialog" aria-modal="true" aria-label={locale === "zh" ? "Prompt 设置" : "Prompt settings"} onMouseDown={(event) => event.stopPropagation()}><header><div><TextQuote size={20} /><h2>{locale === "zh" ? "Prompts" : "Prompts"}</h2></div><div className="prompt-header-actions"><select value={scope} aria-label={locale === "zh" ? "编辑目标" : "Editing target"} onChange={(event) => setScope(event.target.value as PromptScope)}>{scopes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="button" className="icon-button" onClick={onClose} aria-label={locale === "zh" ? "关闭" : "Close"}><X /></button></div></header><div className="prompt-dialog-body"><section><h3>{scope === "global" ? (locale === "zh" ? "全局 System Prompt" : "Global system prompt") : scope === "chat" ? (locale === "zh" ? "当前对话 System Prompt" : "Current chat system prompt") : (locale === "zh" ? "当前 Notebook Prompt" : "Current Notebook prompt")}</h3><p>{description}</p>{scope === "notebook" && <label className="prompt-mode-control"><span>{locale === "zh" ? "应用方式" : "Application mode"}</span><select value={notebookMode} onChange={(event) => setNotebookMode(event.target.value as NotebookPromptMode)}><option value="stack">{locale === "zh" ? "堆叠：全局 Prompt + Notebook Prompt" : "Stack: global + Notebook prompt"}</option><option value="replace">{locale === "zh" ? "覆盖：只使用 Notebook Prompt" : "Replace: Notebook prompt only"}</option></select></label>}<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={locale === "zh" ? "输入系统提示词…" : "Write a system prompt…"} rows={7} /><div className="prompt-dialog-actions"><button type="button" onClick={onClose}>{locale === "zh" ? "取消" : "Cancel"}</button><button type="button" className="text-button" onClick={save}>{locale === "zh" ? "保存" : "Save"}</button></div></section><section className="prompt-presets"><div><h3>{locale === "zh" ? "预设提示词" : "Prompt presets"}</h3><p>{locale === "zh" ? "选择后会填入当前编辑目标，可再修改后保存。" : "Choose one to fill the current target, then edit or save it."}</p></div>{settings.promptPresets.length ? <div className="prompt-preset-list">{settings.promptPresets.map((preset) => <article key={preset.id}><div><strong>{preset.title}</strong><small>{preset.content}</small></div><button type="button" onClick={() => setPrompt(preset.content)}>{locale === "zh" ? "使用" : "Use"}</button><button type="button" className="icon-button" title={locale === "zh" ? "删除预设" : "Delete preset"} onClick={() => onChange({ ...settings, promptPresets: settings.promptPresets.filter((item) => item !== preset) })}><Trash2 size={15} /></button></article>)}</div> : <p className="prompt-empty">{locale === "zh" ? "还没有预设。可在下面保存常用提示词。" : "No presets yet. Save a frequently used prompt below."}</p>}<div className="new-preset"><input value={presetTitle} maxLength={80} placeholder={locale === "zh" ? "预设名称" : "Preset name"} onChange={(event) => setPresetTitle(event.target.value)} /><textarea value={presetContent} placeholder={locale === "zh" ? "预设内容" : "Preset content"} rows={4} onChange={(event) => setPresetContent(event.target.value)} /><button type="button" onClick={addPreset}><Plus size={15} />{locale === "zh" ? "保存为预设" : "Save preset"}</button></div></section></div></section></div>;
}

function SettingsDialog({ settings, safety, onChange, onClose, onRequestPersistent, onChooseAutoBackup }: { settings: AppSettings; safety: StorageSafetyStatus | null; onChange: (settings: AppSettings) => void; onClose: () => void; onRequestPersistent: () => void; onChooseAutoBackup: () => void }) {
  const copy = useCopy();
  const [tab, setTab] = useState<"models" | "behavior" | "tools" | "privacy">("models");
  const [editingProviderIds, setEditingProviderIds] = useState<Set<ProviderId>>(() => new Set());
  const [emojiPickerProviderId, setEmojiPickerProviderId] = useState<ProviderId | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const isEditingProvider = (id: ProviderId) => editingProviderIds.has(id);
  const setProviderEditing = (id: ProviderId, editing: boolean) => setEditingProviderIds((current) => {
    const next = new Set(current);
    if (editing) next.add(id);
    else next.delete(id);
    return next;
  });
  useEffect(() => {
    if (!emojiPickerProviderId) return;
    const closeWhenOutside = (event: PointerEvent) => { if (!emojiPickerRef.current?.contains(event.target as Node)) setEmojiPickerProviderId(null); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setEmojiPickerProviderId(null); };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [emojiPickerProviderId]);
  const updateProvider = (id: ProviderId, field: "name" | "kind" | "apiKey" | "baseUrl" | "model", value: string) => {
    if (!isEditingProvider(id)) return;
    const provider = settings.providers[id];
    const preset = field === "name" ? presetFromProviderName(value) : null;
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, [field]: value, ...(preset ? { kind: PROVIDER_PRESETS[preset].kind, baseUrl: PROVIDER_PRESETS[preset].baseUrl } : {}) } } });
  };
  const applyProviderPreset = (id: ProviderId, presetId: ProviderPresetId) => {
    if (!isEditingProvider(id)) return;
    const provider = settings.providers[id];
    const preset = PROVIDER_PRESETS[presetId];
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, name: provider.name === "New provider" ? preset.name : provider.name, kind: preset.kind, baseUrl: preset.baseUrl } } });
  };
  const updateModel = (id: ProviderId, index: number, value: string) => {
    if (!isEditingProvider(id)) return;
    const provider = settings.providers[id];
    const previous = provider.models[index];
    const models = [...provider.models];
    models[index] = value;
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, models, model: provider.model === previous ? value : provider.model } } });
  };
  const updateProviderEmoji = (id: ProviderId, value: string) => {
    if (!isEditingProvider(id)) return;
    const provider = settings.providers[id];
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, emoji: value.slice(0, 16) } } });
  };
  const addModel = (id: ProviderId) => {
    if (!isEditingProvider(id)) return;
    const provider = settings.providers[id];
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, models: [...provider.models, ""] } } });
  };
  const removeModel = (id: ProviderId, index: number) => {
    if (!isEditingProvider(id)) return;
    const provider = settings.providers[id];
    if (provider.models.length <= 1) return;
    const removed = provider.models[index];
    const models = provider.models.filter((_, itemIndex) => itemIndex !== index);
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, models, model: provider.model === removed ? models[0] : provider.model } } });
  };
  const addProvider = () => {
    const id = newId("provider");
    onChange({ ...settings, providers: { ...settings.providers, [id]: { name: "New provider", kind: "openai", apiKey: "", baseUrl: "", model: "", models: [""], emoji: "🤖" } }, providerOrder: [id, ...settings.providerOrder] });
    setProviderEditing(id, true);
  };
  const moveProvider = (id: ProviderId, direction: -1 | 1) => {
    const index = settings.providerOrder.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= settings.providerOrder.length) return;
    const providerOrder = [...settings.providerOrder];
    [providerOrder[index], providerOrder[target]] = [providerOrder[target], providerOrder[index]];
    onChange({ ...settings, providerOrder });
  };
  const removeProvider = (id: ProviderId) => {
    if (settings.providerOrder.length <= 1) return;
    const providerOrder = settings.providerOrder.filter((item) => item !== id);
    const providers = { ...settings.providers };
    delete providers[id];
    onChange({ ...settings, providers, providerOrder, activeProvider: settings.activeProvider === id ? providerOrder[0] : settings.activeProvider, namingProvider: settings.namingProvider === id ? providerOrder[0] : settings.namingProvider });
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="settings-dialog" role="dialog" aria-modal="true" aria-label={copy.settings} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><MossMark className="app-mark settings-mark" /><h2>{copy.settings}</h2></div><div className="settings-header-actions"><label>{settings.language === "zh" ? "语言" : "Language"}<select value={settings.language} aria-label={settings.language === "zh" ? "语言" : "Language"} onChange={(event) => onChange({ ...settings, language: event.target.value as Locale })}><option value="en">English</option><option value="zh">中文</option></select></label><button className="icon-button" onClick={onClose} aria-label={copy.done}><X /></button></div></header>
    <div className="settings-body"><nav>{[["models", copy.apiModels], ["behavior", copy.behavior], ["tools", copy.tools], ["privacy", copy.privacy]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id as typeof tab)}>{label}</button>)}</nav>
      <div className="settings-content">
        {tab === "models" && <>
          <h3>{copy.apiTitle}</h3><p className="muted">{copy.apiDetail}</p>
          <div className="provider-actions"><button type="button" onClick={addProvider}>+ Add provider</button></div>
          {orderedProviders(settings).map(([id, provider], index) => {
            const editing = isEditingProvider(id);
            return <fieldset key={id} className={editing ? "is-editing" : ""}>
              <legend>{provider.name}</legend>
              <div className="provider-title-actions"><div className="provider-order-actions"><span>{settings.language === "zh" ? "排序" : "Order"}</span><button type="button" disabled={!index} onClick={() => moveProvider(id, -1)} aria-label="Move provider up"><ArrowUp size={15} /></button><button type="button" disabled={index === settings.providerOrder.length - 1} onClick={() => moveProvider(id, 1)} aria-label="Move provider down"><ArrowDown size={15} /></button></div><div className="provider-row-actions"><button type="button" disabled={settings.providerOrder.length <= 1} onClick={() => removeProvider(id)} aria-label="Delete provider"><Trash2 size={15} /></button></div></div>
              <div className="provider-emoji-control" ref={emojiPickerProviderId === id ? emojiPickerRef : undefined}><span>Emoji</span><input disabled={!editing} aria-label={settings.language === "zh" ? `${provider.name} 的 Emoji` : `Emoji for ${provider.name}`} value={providerEmoji(provider)} maxLength={16} onChange={(event) => updateProviderEmoji(id, event.target.value)} onBlur={(event) => { if (!event.currentTarget.value.trim()) updateProviderEmoji(id, "🤖"); }} /><button type="button" disabled={!editing} onClick={() => setEmojiPickerProviderId((current) => current === id ? null : id)}>{settings.language === "zh" ? "常用 Emoji" : "Pick emoji"}</button>{emojiPickerProviderId === id && <div className="provider-emoji-picker" role="dialog" aria-label={settings.language === "zh" ? "选择渠道商 Emoji" : "Choose provider emoji"}>{COMMON_PROVIDER_EMOJIS.map((emoji) => <button type="button" key={emoji} className={providerEmoji(provider) === emoji ? "active" : ""} title={emoji} onClick={() => { updateProviderEmoji(id, emoji); setEmojiPickerProviderId(null); }}>{emoji}</button>)}</div>}</div>
              <div className="provider-presets"><span>{settings.language === "zh" ? "端点预设" : "Endpoint preset"}</span><button type="button" className="provider-edit-toggle" onClick={() => setProviderEditing(id, !editing)}><Pencil size={13} />{editing ? (settings.language === "zh" ? "完成编辑" : "Done editing") : (settings.language === "zh" ? "编辑配置" : "Edit provider")}</button>{(Object.keys(PROVIDER_PRESETS) as ProviderPresetId[]).map((presetId) => <button type="button" disabled={!editing} key={presetId} className={provider.baseUrl === PROVIDER_PRESETS[presetId].baseUrl ? "active" : ""} onClick={() => applyProviderPreset(id, presetId)}>{PROVIDER_PRESETS[presetId].label}</button>)}</div>
              {!editing && <p className="provider-saved-endpoint">{settings.language === "zh" ? "已保存端点" : "Saved endpoint"}<code>{provider.baseUrl || "—"}</code></p>}
              <label>Provider name<input disabled={!editing} value={provider.name} onChange={(event) => updateProvider(id, "name", event.target.value)} /></label>
              <label>Protocol<select disabled={!editing} value={provider.kind} onChange={(event) => updateProvider(id, "kind", event.target.value as ProviderKind)}><option value="openai">OpenAI compatible</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option></select></label>
              <label>{copy.key}<input disabled={!editing} type="password" autoComplete="off" value={provider.apiKey} onChange={(event) => updateProvider(id, "apiKey", event.target.value)} placeholder="Paste your key" /></label>
              <label>{copy.baseUrl}<input disabled={!editing} value={provider.baseUrl} onChange={(event) => updateProvider(id, "baseUrl", event.target.value)} /></label>
              <div className="provider-models"><span>{copy.defaultModel}</span>{provider.models.map((model, modelIndex) => <div className="provider-model-row" key={modelIndex}><button type="button" disabled={!editing} className={provider.model === model ? "active" : ""} title={provider.model === model ? "Selected model" : "Use this model"} onClick={() => updateProvider(id, "model", model)}><Check size={14} /></button><input disabled={!editing} value={model} onChange={(event) => updateModel(id, modelIndex, event.target.value)} placeholder="e.g. gemini-2.5-flash" /><button type="button" disabled={!editing || provider.models.length <= 1} onClick={() => removeModel(id, modelIndex)} aria-label="Delete model"><Trash2 size={15} /></button></div>)}<button type="button" disabled={!editing} className="add-model" onClick={() => addModel(id)}>+ Add model</button></div>
            </fieldset>;
          })}
        </>}
        {tab === "behavior" && <><h3>{copy.behaviorTitle}</h3><label>{copy.systemPrompt}<textarea value={settings.systemPrompt} onChange={(event) => onChange({ ...settings, systemPrompt: event.target.value })} placeholder={copy.systemDetail} rows={5} /></label><div className="two-fields"><label>{copy.namingProvider}<select value={settings.namingProvider} onChange={(event) => onChange({ ...settings, namingProvider: event.target.value })}>{orderedProviders(settings).map(([id, provider]) => <option key={id} value={id}>{provider.name}</option>)}</select></label><label>{copy.namingModel}<input value={settings.namingModel} onChange={(event) => onChange({ ...settings, namingModel: event.target.value })} placeholder="Leave blank to use first message" /></label></div><p className="muted">{copy.namingDetail}</p><div className="two-fields"><label>{settings.language === "zh" ? "Thinking 强度" : "Thinking level"}<select value={settings.thinkingLevel} onChange={(event) => onChange({ ...settings, thinkingLevel: event.target.value as ThinkingLevel })}><option value="off">{settings.language === "zh" ? "关闭" : "Off"}</option><option value="low">{settings.language === "zh" ? "低" : "Low"}</option><option value="medium">{settings.language === "zh" ? "中" : "Medium"}</option><option value="high">{settings.language === "zh" ? "高" : "High"}</option><option value="custom">{settings.language === "zh" ? "自定义" : "Custom"}</option></select></label>{settings.thinkingLevel === "custom" && <label>{settings.language === "zh" ? "Thinking token budget" : "Thinking token budget"}<input type="number" min="0" step="128" value={settings.thinkingBudget} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange({ ...settings, thinkingBudget: Number(event.target.value) || 0 })} /></label>}</div><p className="muted">{settings.language === "zh" ? "自定义预算会原样传给 Anthropic / Gemini。OpenAI 兼容协议仅支持 low / medium / high，会按预算映射到最接近的档位。" : "A custom budget is sent as-is to Anthropic and Gemini. OpenAI-compatible APIs only accept low / medium / high, so it is mapped to the nearest level."}</p><label>{copy.language}<select value={settings.language} onChange={(event) => onChange({ ...settings, language: event.target.value as Locale })}><option value="en">English</option><option value="zh">中文</option></select></label><label className="toggle-row"><input type="checkbox" checked={settings.sendWithEnter} onChange={(event) => onChange({ ...settings, sendWithEnter: event.target.checked })} />{copy.enterSends}</label></>}
        {tab === "tools" && <><h3>{copy.toolsTitle}</h3><p className="muted">{copy.toolsDetail}</p><label>{copy.functionDeclarations}<textarea value={settings.nativeTools.functionDeclarations} onChange={(event) => onChange({ ...settings, nativeTools: { functionDeclarations: event.target.value } })} placeholder={copy.functionDetail} rows={8} /></label></>}
        {tab === "privacy" && <><h3>{copy.privacyTitle}</h3><p>{copy.privacyDetail}</p><p className="muted">{copy.privacyHint}</p><section className="data-safety"><h4>{settings.language === "zh" ? "数据安全" : "Data safety"}</h4><dl><div><dt>{settings.language === "zh" ? "持久化存储" : "Persistent storage"}</dt><dd>{safety?.persisted ? (settings.language === "zh" ? "已启用" : "Enabled") : (settings.language === "zh" ? "尚未确认" : "Not confirmed")}</dd></div><div><dt>{settings.language === "zh" ? "存储用量" : "Storage usage"}</dt><dd>{formatBytes(safety?.usage)} / {formatBytes(safety?.quota)}</dd></div><div><dt>{settings.language === "zh" ? "自动备份" : "Automatic backup"}</dt><dd>{safety?.automaticBackup === "granted" ? (settings.language === "zh" ? "已授权文件夹" : "Folder authorized") : safety?.automaticBackup === "unsupported" ? (settings.language === "zh" ? "此浏览器不支持" : "Unsupported here") : safety?.automaticBackup === "needs-permission" ? (settings.language === "zh" ? "需要重新授权" : "Needs permission") : (settings.language === "zh" ? "未设置" : "Not configured")}</dd></div><div><dt>{settings.language === "zh" ? "上次手动导出" : "Last manual export"}</dt><dd>{safety?.lastManualBackupAt ? new Date(safety.lastManualBackupAt).toLocaleString(settings.language === "zh" ? "zh-CN" : "en-US") : "—"}</dd></div></dl>{Boolean(safety?.usage && safety?.quota && safety.usage / safety.quota >= .8) && <p className="storage-warning">{settings.language === "zh" ? "存储空间已使用 80% 以上，请清理附件或立即导出备份。" : "Storage is over 80% used. Clear attachments or export a backup now."}</p>}<div className="provider-actions">{!safety?.persisted && <button type="button" onClick={onRequestPersistent}>{settings.language === "zh" ? "申请持久化存储" : "Request persistent storage"}</button>}{safety?.automaticBackup !== "unsupported" && <button type="button" onClick={onChooseAutoBackup}>{settings.language === "zh" ? "选择自动备份文件夹" : "Choose auto-backup folder"}</button>}</div><p className="muted">{settings.language === "zh" ? "自动备份仅在 Chrome / Edge 桌面版的已授权文件夹中运行，每 6 小时最多一次；清除浏览器数据不会清除该文件夹内的备份。" : "Automatic backup uses an authorized Chrome or Edge desktop folder, at most once every six hours. Browser data clearing does not remove files in that folder."}</p></section></>}
      </div>
    </div>
    <footer><button className="text-button" onClick={onClose}>{copy.done}</button></footer>
  </section></div>;
}

function FeedbackDialog({ target, onClose }: { target: FeedbackTarget | null; onClose: () => void }) {
  const locale = useContext(LocaleContext);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [subscribe, setSubscribe] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const isChinese = locale === "zh";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = message.trim();
    if (!content) {
      setError(isChinese ? "请先填写反馈内容。" : "Please describe what is broken or missing.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_FEEDBACK_ENDPOINT || "/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          message: content,
          email: email.trim(),
          subscribe,
          reaction: target?.reaction,
          chatTitle: target?.chatTitle,
          messageId: target?.messageId,
          response: target?.response?.slice(0, 8000),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (response.status === 404) throw new Error(isChinese ? "反馈服务尚未部署，请稍后再试。" : "The feedback service has not been deployed yet.");
        throw new Error(body?.error || "Feedback could not be sent.");
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (isChinese ? "发送失败，请稍后再试。" : "Could not send feedback. Try again later."));
    } finally {
      setSending(false);
    }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onMouseDown={(event) => event.stopPropagation()}><header><div><MessageSquareText size={20} /><h2 id="feedback-title">{isChinese ? "反馈" : "Feedback"}</h2></div><button className="icon-button" type="button" aria-label={isChinese ? "关闭" : "Close"} onClick={onClose}><X /></button></header>{sent ? <div className="feedback-sent"><h3>{isChinese ? "已发送，谢谢。" : "Thanks, your feedback was sent."}</h3><p>{isChinese ? "我们会查看每一条反馈。" : "We review every submission."}</p><button type="button" className="text-button" onClick={onClose}>{isChinese ? "完成" : "Done"}</button></div> : <form onSubmit={submit}><div className="feedback-body"><label>{isChinese ? "有什么坏了或者缺什么？" : "What is broken or missing?"}<textarea autoFocus value={message} maxLength={4000} onChange={(event) => setMessage(event.target.value)} /></label>{target?.response && <p className="feedback-context">{isChinese ? "这条回答会随反馈一同发送。" : "This response will be included with your feedback."}</p>}<label>{isChinese ? "邮箱（可选，想收到回复就填）" : "Email (optional, only if you want a reply)"}<input type="email" inputMode="email" autoComplete="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} /></label><label className="feedback-subscribe"><input type="checkbox" checked={subscribe} onChange={(event) => setSubscribe(event.target.checked)} />{isChinese ? "也通知我新版本" : "Notify me about new versions"}</label><p className="feedback-privacy">{isChinese ? "反馈会发送到 MossChat 的反馈邮箱。若勾选订阅，邮箱会加入新版本通知名单。" : "Feedback is sent to the MossChat feedback mailbox. If you opt in, your email is added to the release update list."}</p>{error && <p className="feedback-error" role="alert">{error}</p>}</div><footer><button type="button" className="feedback-cancel" onClick={onClose}>{isChinese ? "取消" : "Cancel"}</button><button type="submit" className="text-button" disabled={sending}>{sending ? (isChinese ? "发送中…" : "Sending…") : (isChinese ? "发送反馈" : "Send feedback")}</button></footer></form>}</section></div>;
}

function InstallDialog({ onClose }: { onClose: () => void }) {
  const locale = useContext(LocaleContext);
  const ios = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isChinese = locale === "zh";
  const steps = ios
    ? (isChinese ? "在 Safari 中点击底部的分享按钮，再选择“添加到主屏幕”。" : "In Safari, tap Share, then choose Add to Home Screen.")
    : (isChinese ? "在浏览器菜单中选择“添加到桌面”或“添加到主屏幕”。" : "Open your browser menu and choose Add to desktop or Add to Home Screen.");
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="install-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><Download size={20} /><h2>{isChinese ? "添加 MossChat 到桌面" : "Add MossChat to desktop"}</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header><div><MossMark className="app-mark" size={52} /><h3>{isChinese ? "像应用一样打开" : "Open it like an app"}</h3><p>{steps}</p><p>{isChinese ? "添加后可从桌面或应用列表启动，并使用独立窗口。" : "After adding it, open it from your desktop, home screen, or app list in its own window."}</p></div><footer><button className="text-button" type="button" onClick={onClose}>{isChinese ? "完成" : "Done"}</button></footer></section></div>;
}

function SyncConfigEditor({ config, onChange }: { config: SyncConfig; onChange: (config: Pick<SyncConfig, "endpoint" | "username" | "password" | "deviceName" | "includeKeys">) => void }) {
  const locale = useContext(LocaleContext);
  const serialized = syncConfigJson(config);
  const [value, setValue] = useState(serialized);
  const [error, setError] = useState("");
  const lastSerialized = useRef(serialized);
  const isChinese = locale === "zh";
  useEffect(() => {
    if (lastSerialized.current === serialized) return;
    lastSerialized.current = serialized;
    setValue(serialized);
    setError("");
  }, [serialized]);
  const update = (next: string) => {
    setValue(next);
    try {
      onChange(parseSyncConfig(next));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "SYNC_CONFIG could not be read."); }
  };
  return <details className="sync-import" open><summary>{isChinese ? "粘贴 SYNC_CONFIG" : "Paste SYNC_CONFIG"}</summary><p>{isChinese ? "可直接粘贴 JSON，也兼容带 SYNC_CONFIG 标记的完整区块。这里和下方字段会即时双向同步。" : "Paste JSON directly, or a complete SYNC_CONFIG block. This editor and the fields below stay in sync instantly."}</p><textarea value={value} onChange={(event) => update(event.target.value)} placeholder="{}" spellCheck={false} aria-label="SYNC_CONFIG JSON" />{error && <p className="sync-import-error" role="alert">{error}</p>}</details>;
}

function SyncDialog({ config, onSave, onOverwrite, onClear, onClose }: { config: SyncConfig; onSave: (config: SyncConfig) => void; onOverwrite: (config: SyncConfig) => Promise<void>; onClear: () => void; onClose: () => void }) {
  const locale = useContext(LocaleContext);
  const [draft, setDraft] = useState(config);
  const [setupMode, setSetupMode] = useState<"new" | "join" | null>(null);
  const [generatedPassphrase, setGeneratedPassphrase] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [verification, setVerification] = useState<{ ok: boolean; text: string } | null>(null);
  const [overwriteTarget, setOverwriteTarget] = useState<SyncConfig | null>(null);
  const { copied, copyText, copiedLabel } = useCopyFeedback();
  const isChinese = locale === "zh";
  const existingSync = config.passphraseInitialized;
  const origin = typeof window === "undefined" ? "https://yourapp.com" : window.location.origin;
  const caddyfile = `{
  order respond before basicauth
}

sync.example.com {
  @preflight {
    method OPTIONS
    path /sync /sync/*
  }
  handle @preflight {
    header Access-Control-Allow-Origin "${origin}"
    header Access-Control-Allow-Methods "GET, PUT, DELETE, PROPFIND, OPTIONS"
    header Access-Control-Allow-Headers "Authorization, Content-Type, Depth"
    header Access-Control-Max-Age "86400"
    respond "" 204
  }

  header Access-Control-Allow-Origin "${origin}"
  header Access-Control-Allow-Methods "GET, PUT, DELETE, PROPFIND, OPTIONS"
  header Access-Control-Allow-Headers "Authorization, Content-Type, Depth"
  handle_path /sync/* {
    header Access-Control-Allow-Origin "${origin}"
    header Access-Control-Allow-Methods "GET, PUT, DELETE, PROPFIND, OPTIONS"
    header Access-Control-Allow-Headers "Authorization, Content-Type, Depth"
    root * /data/chatsync
    basicauth {
      ${draft.username || "you"} <bcrypt-hash>
    }
    webdav
  }
}`;
  const agentTask = `# Task: set up sync server for MossChat

You are configuring a WebDAV sync endpoint on this machine.

## Required outcome
An HTTPS endpoint that serves WebDAV at /sync, allows CORS from ${origin}, allows GET, PUT, DELETE, PROPFIND, OPTIONS, answers OPTIONS with 204 before auth, and requires Basic Auth for all other methods.

## Steps
1. First detect a usable public IPv4 or IPv6, an HTTPS-capable hostname/DNS route to it, and whether ports 80 and 443 can be reached from outside the local network. Also detect cloudflared, existing Cloudflare Tunnels and published hostnames, Docker, Caddy, and Tailscale.
2. If a usable public IP route is available, use it first: deploy the WebDAV service directly with Caddy on ports 80/443, obtain a trusted certificate for the hostname, and verify it externally. Use that HTTPS hostname as the final URL.
3. Only if there is no usable public IP route, use an existing Cloudflare Tunnel. Keep the existing tunnel and configure its ingress to the local WebDAV service. Use its HTTPS hostname as the final URL.
4. If neither route is usable, prefer Docker Compose. Fall back to native Caddy.
5. Create a Caddy build with github.com/mholt/caddy-webdav and use this Caddyfile.
6. Use Tailscale only when neither a usable public route nor a usable Cloudflare Tunnel is available. Run tailscale serve --bg https / http://localhost:8080 and report the hostname.
7. When Tailscale is selected, tell the user before the final output that every machine using MossChat sync must install Tailscale, sign in to the same tailnet, and be permitted by its ACLs.
8. Generate the bcrypt hash with caddy hash-password, generate a password, and verify HTTPS, CORS preflight, PROPFIND, authentication, and a temporary write/delete.

## Caddyfile
\`\`\`caddy
${caddyfile}
\`\`\`

## Dockerfile
\`\`\`dockerfile
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/mholt/caddy-webdav
FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
\`\`\`

## docker-compose.yml
\`\`\`yaml
services:
  caddy:
    build: .
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data:/data/chatsync
      - caddy_data:/data
      - caddy_config:/config
volumes:
  caddy_data:
  caddy_config:
\`\`\`

## Verification
\`\`\`bash
curl -X OPTIONS -i https://HOST/sync/ -H "Origin: ${origin}" -H "Access-Control-Request-Method: PROPFIND"
curl -u USER:PASSWORD -X PROPFIND -i https://HOST/sync/ -H "Depth: 1"
curl -u USER:PASSWORD -X PUT --data "ok" https://HOST/sync/.mosschat-write-test
curl -u USER:PASSWORD -X DELETE https://HOST/sync/.mosschat-write-test
\`\`\`

Expect 204 for OPTIONS with PROPFIND in Access-Control-Allow-Methods. Confirm unauthenticated WebDAV requests return 401. A 401 on OPTIONS means auth is handling the preflight.

## Output
Only after every verification check passes, print exactly these blocks in this order. Do not print anything after the second block.

===SYNC_CONFIG_START===
{
  "url": "https://box.tailnet.ts.net",
  "username": "chatsync",
  "password": "<generated>",
  "protocol": "webdav",
  "path": "/sync"
}
===SYNC_CONFIG_END===

===VERIFY_START===
{
  "https": true,
  "cors_preflight": true,
  "propfind_allowed": true,
  "auth": true,
  "write_test": true
}
===VERIFY_END===

If any check is false, do not print SYNC_CONFIG. Fix it first. If you cannot fix it, explain what remains broken and do not print a configuration block.`;
  const copy = (value: string, id = "sync") => void copyText(value, id);
  const verificationMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Verification failed.";
    if (!isChinese) return message;
    if (message === "WebDAV username or password is incorrect.") return "WebDAV 用户名或密码错误。";
    if (message === "Could not reach the WebDAV server. Check its URL, HTTPS, and CORS settings.") return "无法连接 WebDAV 服务器。请检查地址、HTTPS 和 CORS 配置。";
    if (message === "Enter the WebDAV endpoint and username first.") return "请先填写 WebDAV 地址和用户名。";
    if (message === "The encryption passphrase does not match this server.") return "加密口令与服务器不匹配。";
    return message;
  };
  const generate = () => {
    const passphrase = generatePassphrase();
    setDraft((current) => ({ ...current, passphrase }));
    setGeneratedPassphrase(passphrase);
  };
  const check = async () => {
    setChecking(true);
    setVerification(null);
    try {
      const result = await verifyWebDavSync({ ...draft, endpoint: draft.endpoint.trim() });
      setVerification({ ok: true, text: result.state === "empty" ? (isChinese ? "连接有效。服务器目前为空。" : "Connection is valid. The server is currently empty.") : (isChinese ? `连接、凭据和加密口令有效。已找到 ${result.records} 条同步记录。` : `Connection, credentials, and passphrase are valid. Found ${result.records} sync records.`) });
    } catch (error) { setVerification({ ok: false, text: verificationMessage(error) }); }
    finally { setChecking(false); }
  };
  const save = async () => {
    const next = { ...draft, endpoint: draft.endpoint.trim(), passphraseInitialized: true };
    if (existingSync) {
      onSave(next);
      onClose();
      return;
    }
    setChecking(true);
    setVerification(null);
    try {
      if (setupMode === "new") {
        const target = await inspectWebDavTarget(next);
        if (target.hasExistingData) {
          setOverwriteTarget(next);
          return;
        }
      } else await verifyWebDavSync(next);
      onSave(next);
      setGeneratedPassphrase(null);
      onClose();
    } catch (error) { setVerification({ ok: false, text: verificationMessage(error) }); }
    finally { setChecking(false); }
  };
  const overwrite = async () => {
    if (!overwriteTarget) return;
    setChecking(true);
    setVerification(null);
    try {
      await onOverwrite(overwriteTarget);
      setGeneratedPassphrase(null);
      onClose();
    } catch (error) { setVerification({ ok: false, text: verificationMessage(error) }); setOverwriteTarget(null); }
    finally { setChecking(false); }
  };
  const clear = () => { onClear(); onClose(); };
  if (!existingSync && !setupMode) return <div className="modal-backdrop" onMouseDown={onClose}><section className="sync-dialog sync-setup-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><Cloud size={20} /><h2>{isChinese ? "配置同步" : "Configure sync"}</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header><div className="sync-setup-choice"><h3>{isChinese ? "你想怎么开始？" : "How would you like to start?"}</h3><button type="button" onClick={() => setSetupMode("new")}><strong>{isChinese ? "我是第一次设置" : "I’m setting up for the first time"}</strong><span>{isChinese ? "创建新的本地加密口令和同步服务器。" : "Create a new local encryption passphrase and sync server."}</span></button><button type="button" onClick={() => setSetupMode("join")}><strong>{isChinese ? "我要把设备加入已有的同步" : "Join an existing sync"}</strong><span>{isChinese ? "填入已有服务器信息和首次保存的加密口令。" : "Enter the existing server details and the passphrase saved during first setup."}</span></button></div></section></div>;
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className={`sync-dialog${existingSync ? " sync-dialog-existing" : ""}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><Cloud size={20} /><h2>{isChinese ? "配置同步" : "Configure sync"}</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header>
      <div className="sync-dialog-body">
        <section className="sync-fields">
          {existingSync ? <>
            <section className="sync-config-locked"><strong>SYNC_CONFIG</strong><p>{isChinese ? "同步服务器、凭据、加密口令和 API key 同步选项已锁定。" : "The server, credentials, passphrase, and API key option are locked."}</p><pre>{syncConfigJson(draft)}</pre><button type="button" className={copied === "sync-config" ? "is-copied" : ""} onClick={() => copy(syncConfigJson(draft), "sync-config")}>{copied === "sync-config" ? copiedLabel : (isChinese ? "复制 SYNC_CONFIG" : "Copy SYNC_CONFIG")}</button></section>
            <label>{isChinese ? "设备名称" : "Device name"}<input autoComplete="off" placeholder={isChinese ? "例如 work-laptop" : "e.g. work-laptop"} value={draft.deviceName} onChange={(event) => setDraft({ ...draft, deviceName: event.target.value })} /></label>
            <section className="sync-existing"><strong>{isChinese ? "已有同步" : "Existing sync"}</strong><p>{isChinese ? "清除同步只会移除此浏览器与服务器的连接，不会删除本地或服务器数据。" : "Clearing sync disconnects this browser from the server. It does not delete local or remote data."}</p><div className="sync-existing-actions"><button type="button" onClick={() => void check()} disabled={checking}>{checking ? (isChinese ? "检测中…" : "Checking…") : (isChinese ? "检测有效性" : "Check validity")}</button><button type="button" className="sync-clear-button" onClick={clear} disabled={checking}>{isChinese ? "清除同步" : "Clear sync"}</button></div>{verification && <p className={verification.ok ? "sync-verify-ok" : "sync-import-error"}>{verification.text}</p>}</section>
            <div className="sync-config-actions"><button type="button" className="text-button" onClick={() => void save()} disabled={checking}>{isChinese ? "保存设备名称" : "Save device name"}</button></div>
          </> : <>
            <SyncConfigEditor config={draft} onChange={(imported) => setDraft((current) => ({ ...current, ...imported }))} />
            <label>{isChinese ? "WebDAV endpoint" : "WebDAV endpoint"}<input type="url" autoComplete="url" placeholder="https://sync.example.com/sync/" value={draft.endpoint} onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })} /></label>
            <div className="two-fields"><label>{isChinese ? "用户名" : "Username"}<input autoComplete="username" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label><label>{isChinese ? "WebDAV 密码" : "WebDAV password"}<input type="password" autoComplete="current-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label></div>
            <label>{isChinese ? "设备名称" : "Device name"}<input autoComplete="off" placeholder={isChinese ? "例如 work-laptop" : "e.g. work-laptop"} value={draft.deviceName} onChange={(event) => setDraft({ ...draft, deviceName: event.target.value })} /></label>
            <section className="sync-first"><strong>{setupMode === "join" ? (isChinese ? "加入已有同步" : "Join existing sync") : (isChinese ? "第一次设置" : "First-time setup")}</strong><p>{setupMode === "join" ? (isChinese ? "填入已有服务器首次保存的加密口令。保存前会验证服务器、凭据和口令。" : "Enter the passphrase saved during first setup. The server, credentials, and passphrase are verified before saving.") : (isChinese ? "可手动设置加密口令，也可让 MossChat 本地生成。保存前会验证服务器连接和凭据。" : "Set a passphrase yourself or generate one locally. The server connection and credentials are verified before saving.")}</p><label>{isChinese ? "加密口令（可为空，任意字符）" : "Encryption passphrase (any characters, including empty)"}<input type="password" autoComplete="off" value={draft.passphrase} onChange={(event) => { setDraft({ ...draft, passphrase: event.target.value }); setGeneratedPassphrase(null); }} /></label>{setupMode === "new" && <button type="button" onClick={generate}>{isChinese ? "生成加密口令" : "Generate passphrase"}</button>}{generatedPassphrase && <><code>{generatedPassphrase}</code><button type="button" className={copied === "passphrase" ? "is-copied" : ""} onClick={() => copy(generatedPassphrase, "passphrase")}>{copied === "passphrase" ? copiedLabel : (isChinese ? "复制口令" : "Copy passphrase")}</button></>}</section>
            <label className="sync-toggle"><input type="checkbox" checked={draft.includeKeys} onChange={(event) => setDraft({ ...draft, includeKeys: event.target.checked })} />{isChinese ? "同步 API keys" : "Sync API keys"}</label>
            {verification && <p className={verification.ok ? "sync-verify-ok" : "sync-import-error"}>{verification.text}</p>}
            <div className="sync-config-actions"><button type="button" className="text-button" onClick={() => void save()} disabled={checking}>{checking ? (isChinese ? "检测中…" : "Checking…") : (isChinese ? "验证并保存" : "Verify & save")}</button></div>
          </>}
        </section>
        {!existingSync && <section className="sync-guide"><h3>{isChinese ? "同步教程" : "Sync server guide"}</h3><p>{isChinese ? "需要 HTTPS，且 OPTIONS 必须在 Basic Auth 之前返回 204。" : "Use HTTPS. OPTIONS must return 204 before Basic Auth runs."}</p><details open><summary>{isChinese ? "给人的 Caddy 配置" : "Caddy setup"}</summary><pre>{caddyfile}</pre><button className={copied === "caddy" ? "is-copied" : ""} type="button" onClick={() => copy(caddyfile, "caddy")}>{copied === "caddy" ? copiedLabel : (isChinese ? "复制 Caddyfile" : "Copy Caddyfile")}</button></details><details><summary>{isChinese ? "给 Agent 的一键配置任务" : "One click task for an agent"}</summary><p>{isChinese ? "内容会优先检测可用公网 IP；没有可用公网路由时才使用 Cloudflare Tunnel，最后回退到 Tailscale。" : "Checks a usable public IP route first, then Cloudflare Tunnel only when needed, with Tailscale as the final fallback."}</p><pre className="agent-task-preview">{agentTask}</pre><button className={copied === "agent" ? "is-copied" : ""} type="button" onClick={() => copy(agentTask, "agent")}>{copied === "agent" ? copiedLabel : (isChinese ? "复制 Agent 任务" : "Copy agent task")}</button></details></section>}
      </div>
    </section>
    {overwriteTarget && <div className="modal-backdrop sync-overwrite-backdrop" onMouseDown={(event) => { event.stopPropagation(); if (!checking) setOverwriteTarget(null); }}><section className="sync-review-dialog" role="alertdialog" aria-modal="true" aria-label={isChinese ? "覆盖远程同步数据" : "Overwrite remote sync data"} onMouseDown={(event) => event.stopPropagation()}><header><div><Cloud size={20} /><h2>{isChinese ? "远程已有同步数据" : "Remote sync data already exists"}</h2></div><button className="icon-button" type="button" disabled={checking} onClick={() => setOverwriteTarget(null)}><X /></button></header><div className="sync-review-body"><p className="sync-review-warning">{isChinese ? "此操作会覆盖远程的已有数据。" : "This will overwrite the existing remote data."}</p><p>{isChinese ? "确认后，MossChat 会删除此目录中已有的同步记录，以当前本地数据重新上传，并使用你刚填写的新加密口令。其他设备需要用新口令重新加入。" : "After confirmation, MossChat will replace this directory's sync records with the current local data and the new passphrase. Other devices must rejoin with the new passphrase."}</p></div><footer><button type="button" className="sync-review-cancel" disabled={checking} onClick={() => setOverwriteTarget(null)}>{isChinese ? "取消" : "Cancel"}</button><button type="button" className="text-button" disabled={checking} onClick={() => void overwrite()}>{checking ? (isChinese ? "覆盖中…" : "Overwriting…") : (isChinese ? "确认覆盖" : "Overwrite")}</button></footer></section></div>}
  </div>;
}

function SyncReviewDialog({ inspection, onClose, onResolve }: { inspection: SyncInspection; onClose: () => void; onResolve: (resolution: SyncResolution) => void }) {
  const locale = useContext(LocaleContext);
  const isChinese = locale === "zh";
  const [preview, setPreview] = useState(false);
  const range = (first: string | null, last: string | null) => !first || !last ? "—" : `${new Intl.DateTimeFormat(isChinese ? "zh-CN" : "en-US", { year: "numeric", month: "short" }).format(new Date(first))} ${isChinese ? "至" : "to"} ${new Intl.DateTimeFormat(isChinese ? "zh-CN" : "en-US", { year: "numeric", month: "short" }).format(new Date(last))}`;
  const label = (value: SyncInspection["local"]) => ({ chats: value.chats.toLocaleString(), messages: value.messages.toLocaleString(), range: range(value.firstUpdatedAt, value.lastUpdatedAt) });
  const local = label(inspection.local);
  const remote = label(inspection.remote);
  const common = { chats: inspection.common.chats.toLocaleString(), messages: inspection.common.messages.toLocaleString() };
  const serverId = inspection.serverId ? `${inspection.serverId.slice(0, 12)}…` : "—";
  const differenceLabel = (type: "chat" | "message" | "notebook") => type === "message" ? (isChinese ? "消息" : "Message") : type === "chat" ? (isChinese ? "会话信息" : "Chat metadata") : (isChinese ? "笔记本" : "Notebook");
  if (inspection.state === "missing-meta") return <div className="modal-backdrop" onMouseDown={onClose}><section className="sync-review-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><Cloud size={20} /><h2>{isChinese ? "无法安全读取此服务器" : "This server cannot be read safely"}</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header><div className="sync-review-body"><p>{isChinese ? "服务器上已有同步记录，但缺少 MossChat 的 meta.json。为了避免用新的加密密钥覆盖已有数据，应用不会写入此服务器。" : "This server contains sync records but no MossChat meta.json. MossChat will not write to it with a new encryption key."}</p><p className="sync-review-warning">{isChinese ? "请恢复该服务器原有的 meta.json，或在确认文件可丢弃后使用一个新的空目录。" : "Restore the original meta.json, or use a new empty directory after confirming these files can be discarded."}</p></div><footer><button type="button" className="text-button" onClick={onClose}>{isChinese ? "关闭" : "Close"}</button></footer></section></div>;
  if (inspection.state === "empty") return <div className="modal-backdrop" onMouseDown={onClose}><section className="sync-review-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><Cloud size={20} /><h2>{isChinese ? "这是一个空同步服务器" : "This sync server is empty"}</h2></div></header><div className="sync-review-body"><p>{isChinese ? "首次上传会创建不加密的 meta.json，其中只包含服务器 ID、盐、版本和创建时间。会话内容仍会先加密。" : "The first upload creates an unencrypted meta.json with only a server ID, salt, schema, and creation time. Conversations remain encrypted."}</p><dl className="sync-review-summary"><div><dt>{isChinese ? "本地会话" : "Local chats"}</dt><dd>{local.chats}</dd></div><div><dt>{isChinese ? "本地消息" : "Local messages"}</dt><dd>{local.messages}</dd></div><div><dt>{isChinese ? "时间范围" : "Time range"}</dt><dd>{local.range}</dd></div></dl></div><footer><button type="button" className="sync-review-cancel" onClick={onClose}>{isChinese ? "取消" : "Cancel"}</button><button type="button" className="text-button" onClick={() => onResolve("merge")}>{isChinese ? "上传本地数据" : "Upload local data"}</button></footer></section></div>;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sync-review-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><Cloud size={20} /><h2>{isChinese ? "这个服务器上已有数据" : "This server already has data"}</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header><div className="sync-review-body"><p>{isChinese ? `服务器 ID ${serverId}${inspection.previousServerId && inspection.previousServerId !== inspection.serverId ? "，与上次同步的服务器不同。" : "。"}` : `Server ID ${serverId}${inspection.previousServerId && inspection.previousServerId !== inspection.serverId ? ", different from the last synced server." : "."}`}</p>{inspection.remoteLastWrite && <p>{isChinese ? "最后写入" : "Last write"} {new Date(inspection.remoteLastWrite.at).toLocaleString(isChinese ? "zh-CN" : "en-US")} · {inspection.remoteLastWrite.deviceName !== "Unknown device" ? inspection.remoteLastWrite.deviceName : inspection.remoteLastWrite.deviceId.slice(0, 12)}</p>}<table className="sync-review-table"><thead><tr><th></th><th>{isChinese ? "本地" : "Local"}</th><th>{isChinese ? "服务器" : "Server"}</th><th>{isChinese ? "共有" : "Shared"}</th></tr></thead><tbody><tr><th>{isChinese ? "会话" : "Chats"}</th><td>{local.chats}</td><td>{remote.chats}</td><td>{common.chats}</td></tr><tr><th>{isChinese ? "消息" : "Messages"}</th><td>{local.messages}</td><td>{remote.messages}</td><td>{common.messages}</td></tr><tr><th>{isChinese ? "时间范围" : "Time range"}</th><td>{local.range}</td><td>{remote.range}</td><td>—</td></tr></tbody></table>{inspection.differences.length > 0 && <p className="sync-review-warning">{isChinese ? `发现 ${inspection.differences.length} 条不同项。请选择处理方式，或先查看差异。` : `${inspection.differences.length} items differ. Choose how to handle them, or view the differences first.`}</p>}{preview && <section className="sync-difference-list"><strong>{isChinese ? `差异详情（${inspection.differences.length} 条）` : `Differences (${inspection.differences.length})`}</strong>{inspection.differences.map((difference) => <article key={`${difference.type}:${difference.id}`}><header><strong>{differenceLabel(difference.type)}</strong><small>{difference.id}</small></header><div><section><span>{isChinese ? "本地" : "Local"}</span><pre>{difference.local ?? (isChinese ? "此侧没有这条记录" : "Missing on this side")}</pre></section><section><span>{isChinese ? "服务器" : "Server"}</span><pre>{difference.remote ?? (isChinese ? "此侧没有这条记录" : "Missing on this side")}</pre></section></div></article>)}</section>}</div><footer><button type="button" className="sync-review-cancel" onClick={onClose}>{isChinese ? "取消" : "Cancel"}</button><button type="button" className="sync-review-preview" onClick={() => setPreview((value) => !value)}>{preview ? (isChinese ? "收起差异" : "Hide differences") : (isChinese ? "查看差异" : "View differences")}</button><button type="button" onClick={() => onResolve("prefer-local")}>{isChinese ? "保留本地版本" : "Keep local version"}</button><button type="button" onClick={() => onResolve("prefer-remote")}>{isChinese ? "保留服务器版本" : "Keep server version"}</button><button type="button" className="text-button" onClick={() => onResolve("merge")}>{isChinese ? "合并数据" : "Merge data"}</button></footer></section></div>;
}

function NotebookView({ notebook, chats, onBack, onCreateChat, onOpenChat, onRename, onDelete }: { notebook: Notebook; chats: Chat[]; onBack: () => void; onCreateChat: () => void; onOpenChat: (chatId: string) => void; onRename: (title: string) => void; onDelete: () => void }) {
  const locale = useContext(LocaleContext);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(notebook.title);
  useEffect(() => setTitleDraft(notebook.title), [notebook.id, notebook.title]);
  const saveTitle = () => {
    const title = titleDraft.trim().slice(0, 120);
    if (title) onRename(title);
    else setTitleDraft(notebook.title);
    setEditingTitle(false);
  };
  return <main className="notebook-view"><header><div className="notebook-title"><div className="notebook-heading"><BookOpen size={22} />{editingTitle ? <input autoFocus value={titleDraft} aria-label={locale === "zh" ? "笔记本名称" : "Notebook name"} onChange={(event) => setTitleDraft(event.target.value)} onBlur={saveTitle} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveTitle(); } if (event.key === "Escape") { setTitleDraft(notebook.title); setEditingTitle(false); } }} /> : <button type="button" className="notebook-title-button" title={locale === "zh" ? "重命名 Notebook" : "Rename Notebook"} onClick={() => setEditingTitle(true)}><span>{notebook.title}</span><Pencil size={16} /></button>}</div><span>{locale === "zh" ? `${chats.length} 个会话` : `${chats.length} chats`}</span></div><div className="notebook-actions"><button type="button" className="top-icon" onClick={onBack}><ChevronLeft size={16} />{locale === "zh" ? "返回" : "Back"}</button><button type="button" className="top-icon" onClick={() => setEditingTitle(true)}><Pencil size={16} />{locale === "zh" ? "重命名" : "Rename"}</button><button type="button" className="top-icon" onClick={onCreateChat}><MessageSquarePlus size={16} />{locale === "zh" ? "新建会话" : "New chat"}</button><button type="button" className="top-icon notebook-delete" onClick={onDelete}><Trash2 size={16} />{locale === "zh" ? "删除" : "Delete"}</button></div></header><section className="notebook-chats"><h3>{locale === "zh" ? "会话" : "Chats"}</h3>{chats.length ? chats.map((chat) => <button key={chat.id} type="button" onClick={() => onOpenChat(chat.id)}><span><strong>{chat.title}</strong><small>{searchExcerpt(chat, "") || (locale === "zh" ? "还没有消息" : "No messages yet")}</small></span><time>{shortDate(chat.updatedAt, locale)}</time></button>) : <div className="notebook-empty"><p>{locale === "zh" ? "这个 Notebook 还没有会话。" : "This Notebook has no chats yet."}</p><button className="new-chat" type="button" onClick={onCreateChat}><MessageSquarePlus size={17} />{locale === "zh" ? "创建第一条会话" : "Create the first chat"}</button></div>}</section></main>;
}

export default function Home() {
  const [data, setData] = useState<AppData>({ chats: [], notebooks: [] });
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(emptySyncConfig());
  const [hydrated, setHydrated] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [notebookViewOpen, setNotebookViewOpen] = useState(false);
  const [notebookCreateOpen, setNotebookCreateOpen] = useState(false);
  const [notebookTitleDraft, setNotebookTitleDraft] = useState("");
  const [notebookCreateChatId, setNotebookCreateChatId] = useState<string | null>(null);
  const [notebooksCollapsed, setNotebooksCollapsed] = useState(false);
  const [expandedNotebookId, setExpandedNotebookId] = useState<string | null>(null);
  const [renamingNotebookId, setRenamingNotebookId] = useState<string | null>(null);
  const [notebookRenameDraft, setNotebookRenameDraft] = useState("");
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);
  const [addingNotebookForChatId, setAddingNotebookForChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null | undefined>(undefined);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [promptDialogScope, setPromptDialogScope] = useState<PromptScope>("global");
  const [exportOpen, setExportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [syncConfigOpen, setSyncConfigOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error" | "done">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncReview, setSyncReview] = useState<SyncInspection | null>(null);
  const [syncReconfigureNotice, setSyncReconfigureNotice] = useState(false);
  const [syncNow, setSyncNow] = useState(() => Date.now());
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [backupOptions, setBackupOptions] = useState({ chats: true, settings: true, attachments: true });
  const [storageSafety, setStorageSafety] = useState<StorageSafetyStatus | null>(null);
  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const syncRunning = useRef(false);
  const syncMenuRef = useRef<HTMLDivElement>(null);
  const namingAttempts = useRef(new Set<string>());
  const autoSyncSignature = useRef("");
  const deferredInstallPrompt = useRef<InstallPromptEvent | null>(null);
  dataRef.current = data;

  useEffect(() => {
    setSettings(loadSettings());
    const loadedSync = loadSyncConfig();
    setSyncConfig(loadedSync);
    setLastSyncAt(loadLastSyncAt(loadedSync));
    void getStorageSafetyStatus().then(setStorageSafety).catch(() => undefined);
    void loadData().then((stored) => {
      const initialData = stored.chats.length
        ? stored
        : (() => {
            const now = new Date().toISOString();
            const chat: Chat = { id: newId("chat"), title: "New chat", messages: [], createdAt: now, updatedAt: now };
            return { ...stored, chats: [chat] };
          })();
      setData(initialData);
      setActiveChatId(initialData.chats[0]?.id ?? null);
      setActiveNotebookId(initialData.notebooks[0]?.id ?? null);
      if (!stored.chats.length) void saveChatDelta(initialData.chats[0], []);
      setHydrated(true);
    });
    const settingsHandler = () => setSettingsOpen(true);
    document.addEventListener("ai-chat:open-settings", settingsHandler);
    return () => document.removeEventListener("ai-chat:open-settings", settingsHandler);
  }, []);

  useEffect(() => { settingsRef.current = settings; if (hydrated) saveSettings(settings); }, [hydrated, settings]);
  useEffect(() => { if (window.matchMedia("(min-width: 761px)").matches) setSidebarOpen(true); }, []);
  useEffect(() => {
    const root = document.documentElement;
    const dark = settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
  }, [settings.theme]);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredInstallPrompt.current = event as InstallPromptEvent;
    };
    const onInstalled = () => { deferredInstallPrompt.current = null; setInstalled(true); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const activeChat = data.chats.find((chat) => chat.id === activeChatId) ?? null;
  const activeNotebook = data.notebooks.find((notebook) => notebook.id === activeNotebookId) ?? null;
  const promptNotebook = activeChat?.notebookId ? data.notebooks.find((notebook) => notebook.id === activeChat.notebookId) ?? null : notebookViewOpen ? activeNotebook : null;
  const activeSystemPrompt = combinedNotebookPrompt(activeChat, promptNotebook ?? undefined, settings.systemPrompt);
  const openPromptSettings = (scope: PromptScope) => { setPromptDialogScope(scope); setPromptDialogOpen(true); };
  const syncReady = isSyncConfigured(syncConfig);
  const hasStreamingMessage = data.chats.some((chat) => chat.messages.some((message) => Boolean(message.status?.running)));
  const syncSignature = useMemo(() => JSON.stringify({
    chats: data.chats.map((chat) => [chat.id, chat.updatedAt, chat.messages.length, chat.messages.at(-1)?.id]),
    notebooks: data.notebooks.map((notebook) => [notebook.id, notebook.updatedAt]),
    settings,
  }), [data, settings]);
  const updateSyncConfig = (next: SyncConfig) => {
    setSyncConfig(next);
    saveSyncConfig(next);
    setLastSyncAt(loadLastSyncAt(next));
    autoSyncSignature.current = "";
  };
  const clearSyncConfig = () => {
    clearWebDavSync(syncConfig);
    setSyncConfig(emptySyncConfig());
    setLastSyncAt(null);
    setSyncStatus("idle");
    setSyncMessage(settings.language === "zh" ? "已清除同步连接。本地数据未删除。" : "Sync connection cleared. Local data was not deleted.");
    autoSyncSignature.current = "";
  };
  const disconnectChangedSync = () => {
    clearWebDavSync(syncConfig);
    setSyncConfig(emptySyncConfig());
    setLastSyncAt(null);
    setSyncStatus("idle");
    setSyncMessage(settings.language === "zh" ? "当前服务器配置已更改，请重新配置。" : "The current server configuration changed. Please configure sync again.");
    setSyncReview(null);
    setSyncConfigOpen(false);
    setSyncReconfigureNotice(true);
    autoSyncSignature.current = "";
  };
  const overwriteRemoteSync = async (next: SyncConfig) => {
    const localData = dataRef.current;
    const localSettings = settingsRef.current;
    setSyncStatus("syncing");
    setSyncMessage("");
    try {
      const result = await replaceWebDavSync({ config: next, data: localData, settings: localSettings });
      setData(result.data);
      await replaceData(result.data);
      setSettings(normalizeSettings(result.settings));
      setSyncConfig(next);
      saveSyncConfig(next);
      setLastSyncAt(result.syncedAt);
      setSyncNow(Date.now());
      setSyncStatus("done");
      setSyncMessage(settings.language === "zh" ? "已覆盖远程同步数据，并使用新口令重新加密。" : "Remote sync data was replaced and encrypted with the new passphrase.");
      autoSyncSignature.current = "";
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(error instanceof Error ? error.message : "Sync failed.");
      throw error;
    }
  };
  const runSync = useCallback(async (resolution?: SyncResolution) => {
    if (!isSyncConfigured(syncConfig) || syncRunning.current) return false;
    const localData = dataRef.current;
    const localSettings = settingsRef.current;
    syncRunning.current = true;
    setSyncStatus("syncing");
    setSyncMessage("");
    try {
      const inspection = await inspectWebDavSync({ config: syncConfig, data: localData, settings: localSettings });
      if (!resolution && inspection.needsDecision) {
        setSyncReview(inspection);
        setSyncStatus("idle");
        setSyncMessage(settings.language === "zh" ? "请先确认服务器数据的处理方式。" : "Choose how to handle this server before syncing.");
        return false;
      }
      if (inspection.state === "missing-meta") throw new Error(settings.language === "zh" ? "服务器缺少 meta.json，无法安全同步。" : "The server is missing meta.json and cannot be synced safely.");
      const result = await synchronizeWebDav({ config: syncConfig, data: localData, settings: localSettings, ...(resolution ? { resolution } : {}) });
      if (dataRef.current !== localData || settingsRef.current !== localSettings) {
        setSyncStatus("done");
        setLastSyncAt(result.syncedAt);
        setSyncMessage(settings.language === "zh" ? "已同步，新的本地改动正在排队。" : "Synced. New local changes are queued.");
        return true;
      }
      setData(result.data);
      await replaceData(result.data);
      setSettings(normalizeSettings(result.settings));
      setSyncStatus("done");
      setLastSyncAt(result.syncedAt);
      setSyncNow(Date.now());
      setSyncMessage(`${settings.language === "zh" ? "已同步" : "Synced"}: ${result.uploaded} ${settings.language === "zh" ? "条上传" : "uploaded"}, ${result.downloaded} ${settings.language === "zh" ? "条远程记录" : "remote records"}${result.compressedImages ? `, ${result.compressedImages} ${settings.language === "zh" ? "张图片已压缩" : "images compressed"}` : ""}.`);
      return true;
    } catch (error) {
      if (syncConnectionChanged(error)) {
        disconnectChangedSync();
        return false;
      }
      setSyncStatus("error");
      setSyncMessage(error instanceof Error ? error.message : "Sync failed.");
      return false;
    } finally {
      syncRunning.current = false;
    }
  }, [settings.language, syncConfig]);
  const installApp = async () => {
    const prompt = deferredInstallPrompt.current;
    if (!prompt) { setInstallGuideOpen(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") { deferredInstallPrompt.current = null; setInstalled(true); }
  };
  useEffect(() => {
    if (!hydrated || !syncReady || hasStreamingMessage || autoSyncSignature.current === syncSignature) return;
    const timer = window.setTimeout(() => {
      void runSync().then((completed) => { if (completed) autoSyncSignature.current = syncSignature; });
    }, lastSyncAt ? 3_000 : 250);
    return () => window.clearTimeout(timer);
  }, [hasStreamingMessage, hydrated, lastSyncAt, runSync, syncReady, syncSignature]);
  useEffect(() => {
    if (!hydrated || !syncReady) return;
    const timer = window.setInterval(() => { if (!hasStreamingMessage) void runSync(); }, 600_000);
    const online = () => { if (!hasStreamingMessage) void runSync(); };
    window.addEventListener("online", online);
    return () => { window.clearInterval(timer); window.removeEventListener("online", online); };
  }, [hasStreamingMessage, hydrated, runSync, syncReady]);
  useEffect(() => {
    if (!syncReady) return;
    const timer = window.setInterval(() => setSyncNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [syncReady]);
  useEffect(() => {
    if (!syncMenuOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!syncMenuRef.current?.contains(event.target as Node)) setSyncMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSyncMenuOpen(false); };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [syncMenuOpen]);

  const createChat = useCallback((notebookId?: string) => {
    const now = new Date().toISOString();
    const chat: Chat = { id: newId("chat"), title: "New chat", messages: [], createdAt: now, updatedAt: now, ...(notebookId ? { notebookId } : {}) };
    setData((current) => ({ ...current, chats: [chat, ...current.chats] }));
    setActiveChatId(chat.id);
    setNotebookViewOpen(false);
    void saveChatDelta(chat, []);
  }, []);

  const createNotebook = (title = "", open = true) => {
    const now = new Date().toISOString();
    const notebook: Notebook = { id: newId("notebook"), title: title.trim().slice(0, 120) || "Untitled notebook", content: "", attachments: [], promptMode: "stack", createdAt: now, updatedAt: now };
    setData((current) => ({ ...current, notebooks: [notebook, ...current.notebooks] }));
    setActiveNotebookId(notebook.id);
    if (open) {
      setActiveChatId(null);
      setNotebookViewOpen(true);
    }
    void saveNotebook(notebook);
    return notebook;
  };

  const beginCreateNotebook = (chatId: string | null = null) => {
    setNotebookCreateChatId(chatId);
    setNotebookTitleDraft("");
    setNotebookCreateOpen(true);
  };

  const saveNewNotebook = () => {
    const title = notebookTitleDraft.trim();
    if (!title) return;
    const notebook = createNotebook(title, !notebookCreateChatId);
    if (notebookCreateChatId) addChatToNotebook(notebookCreateChatId, notebook.id);
    setNotebookCreateOpen(false);
    setNotebookTitleDraft("");
    setNotebookCreateChatId(null);
  };

  const handleSnapshot = useCallback((chatId: string, messages: SavedMessage[], dirtyMessageIds: string[] = []) => {
    setData((current) => {
      const target = current.chats.find((chat) => chat.id === chatId);
      if (!target) return current;
      const initialPrompt = firstText(messages);
      let nextTitle = target.title;
      if (target.title === "New chat" && initialPrompt) nextTitle = fallbackTitle(initialPrompt);
      const nextChat = { ...target, messages, title: nextTitle, updatedAt: messages.length ? new Date().toISOString() : target.updatedAt };
      const persisted = saveChatDelta(nextChat, dirtyMessageIds);
      void persisted.catch((error) => console.error("Unable to save chat", error));
      if (dirtyMessageIds.some((id) => messages.find((message) => message.id === id && message.role === "assistant" && !message.status?.running))) {
        void persisted.then(() => writeAutomaticBackup(settingsRef.current)).then((written) => { if (written) return getStorageSafetyStatus().then(setStorageSafety); }).catch(() => undefined);
      }
      return { ...current, chats: current.chats.map((chat) => chat.id === chatId ? nextChat : chat) };
    });

    const prompt = firstText(messages);
    const named = settingsRef.current.namingModel.trim();
    if (!named || !prompt || namingAttempts.current.has(chatId)) return;
    namingAttempts.current.add(chatId);
    void generateChatTitle(settingsRef.current, prompt).then((title) => {
      if (!title) return;
      setData((current) => {
        const next = current.chats.find((chat) => chat.id === chatId);
        if (!next) return current;
        const nextChat = { ...next, title: title.replace(/[\n"“”]/g, "").slice(0, 48) || next.title };
        void saveChatMetadata(nextChat);
        return { ...current, chats: current.chats.map((chat) => chat.id === chatId ? nextChat : chat) };
      });
    }).catch(() => undefined);
  }, []);

  const forkChat = (index: number) => {
    if (!activeChat) return;
    const now = new Date().toISOString();
    const fork: Chat = { id: newId("chat"), title: `${activeChat.title} · ${settings.language === "zh" ? "分支" : "branch"}`, messages: activeChat.messages.slice(0, index + 1), createdAt: now, updatedAt: now, ...(activeChat.notebookId ? { notebookId: activeChat.notebookId } : {}), ...(activeChat.systemPrompt !== undefined ? { systemPrompt: activeChat.systemPrompt } : {}) };
    setData((current) => ({ ...current, chats: [fork, ...current.chats] }));
    setActiveChatId(fork.id);
    void saveChatDelta(fork, fork.messages.map((message) => message.id));
  };

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setNotebookViewOpen(false);
    setExpandedChatId(null);
    setAddingNotebookForChatId(null);
    setRenamingChatId(null);
  };

  const toggleChatPin = (chatId: string) => {
    const target = data.chats.find((chat) => chat.id === chatId);
    if (!target) return;
    const nextChat = { ...target, pinned: !target.pinned, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === chatId ? nextChat : chat) }));
    void saveChatMetadata(nextChat);
  };

  const toggleActivePin = () => {
    if (activeChat) toggleChatPin(activeChat.id);
  };

  const beginRenameChat = (chatId: string) => {
    const target = data.chats.find((chat) => chat.id === chatId);
    if (!target) return;
    setChatTitleDraft(target.title);
    setRenamingChatId(chatId);
    setExpandedChatId(null);
  };

  const saveRenamedChat = (chatId: string) => {
    const target = data.chats.find((chat) => chat.id === chatId);
    const title = chatTitleDraft.trim().slice(0, 120);
    setRenamingChatId(null);
    if (!target || !title || title === target.title) return;
    const nextChat = { ...target, title, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === chatId ? nextChat : chat) }));
    void saveChatMetadata(nextChat);
  };

  const addChatToNotebook = (chatId: string, notebookId: string) => {
    const target = data.chats.find((chat) => chat.id === chatId);
    if (!target) return;
    const nextChat = { ...target, notebookId, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === chatId ? nextChat : chat) }));
    setAddingNotebookForChatId(null);
    setExpandedChatId(null);
    void saveChatMetadata(nextChat);
  };

  const createNotebookForChat = (chatId: string) => {
    beginCreateNotebook(chatId);
  };

  const openNotebook = (notebookId: string) => {
    setActiveNotebookId(notebookId);
    setActiveChatId(null);
    setNotebookViewOpen(true);
    setExpandedNotebookId(null);
    setRenamingNotebookId(null);
    setExpandedChatId(null);
    setAddingNotebookForChatId(null);
  };

  const renameNotebook = (notebookId: string, title: string) => {
    const target = data.notebooks.find((notebook) => notebook.id === notebookId);
    const nextTitle = title.trim().slice(0, 120);
    if (!target || !nextTitle || nextTitle === target.title) return;
    const nextNotebook = { ...target, title: nextTitle, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, notebooks: current.notebooks.map((notebook) => notebook.id === notebookId ? nextNotebook : notebook) }));
    void saveNotebook(nextNotebook);
  };

  const beginRenameNotebook = (notebookId: string) => {
    const target = data.notebooks.find((notebook) => notebook.id === notebookId);
    if (!target) return;
    setNotebookRenameDraft(target.title);
    setRenamingNotebookId(notebookId);
    setExpandedNotebookId(null);
  };

  const saveSidebarNotebookRename = (notebookId: string) => {
    renameNotebook(notebookId, notebookRenameDraft);
    setRenamingNotebookId(null);
  };

  const removeNotebook = (notebookId: string) => {
    const target = data.notebooks.find((notebook) => notebook.id === notebookId);
    if (!target) return;
    const prompt = settings.language === "zh" ? `删除「${target.title}」？其中的会话会保留在最近对话中。` : `Delete “${target.title}”? Its chats will remain in Recents.`;
    if (!window.confirm(prompt)) return;
    const updatedChats = data.chats.filter((chat) => chat.notebookId === notebookId).map((chat) => ({ ...chat, notebookId: undefined, updatedAt: new Date().toISOString() }));
    setData((current) => ({ ...current, notebooks: current.notebooks.filter((notebook) => notebook.id !== notebookId), chats: current.chats.map((chat) => updatedChats.find((updated) => updated.id === chat.id) ?? chat) }));
    for (const chat of updatedChats) void saveChatMetadata(chat);
    void deleteNotebook(notebookId);
    setExpandedNotebookId(null);
    setRenamingNotebookId(null);
    if (activeNotebookId === notebookId) {
      setActiveNotebookId(null);
      setNotebookViewOpen(false);
      setActiveChatId(updatedChats[0]?.id ?? data.chats.find((chat) => chat.id !== activeChatId)?.id ?? null);
    }
  };

  const saveChatSystemPrompt = (chatId: string, systemPrompt: string) => {
    const target = data.chats.find((chat) => chat.id === chatId);
    if (!target) return;
    const nextChat = { ...target, systemPrompt: systemPrompt || undefined, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === chatId ? nextChat : chat) }));
    void saveChatMetadata(nextChat);
  };

  const saveNotebookSystemPrompt = (notebookId: string, systemPrompt: string, promptMode: NotebookPromptMode) => {
    const target = data.notebooks.find((notebook) => notebook.id === notebookId);
    if (!target) return;
    const nextNotebook = { ...target, systemPrompt: systemPrompt || undefined, promptMode, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, notebooks: current.notebooks.map((notebook) => notebook.id === notebookId ? nextNotebook : notebook) }));
    void saveNotebook(nextNotebook);
  };

  const removeChat = (chatId: string) => {
    const target = data.chats.find((chat) => chat.id === chatId);
    if (!target) return;
    if (!window.confirm(settings.language === "zh" ? `删除「${target.title}」？此操作无法撤销。` : `Delete “${target.title}”? This cannot be undone.`)) return;
    const remaining = data.chats.filter((chat) => chat.id !== chatId);
    setData((current) => ({ ...current, chats: current.chats.filter((chat) => chat.id !== chatId) }));
    if (activeChatId === chatId) {
      setActiveChatId(remaining[0]?.id ?? null);
      setNotebookViewOpen(false);
    }
    setExpandedChatId(null);
    setAddingNotebookForChatId(null);
    void deleteChat(chatId);
  };

  const exportCurrent = (format: "markdown" | "word") => {
    if (activeChat) {
      const markdown = chatToMarkdown(activeChat, settings.language);
      if (format === "markdown") download(`${activeChat.title}.md`, markdown, "text/markdown;charset=utf-8");
      else download(`${activeChat.title}.doc`, `<!doctype html><html><meta charset="utf-8"><body><h1>${escapeHtml(activeChat.title)}</h1>${markdown.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</body></html>`, "application/msword");
    }
    setExportOpen(false);
  };

  const exportBackup = async () => {
    try {
      const archive = await createBackupZip(backupOptions, settings);
      download(`ai-chat-backup-${new Date().toISOString().slice(0, 10)}.zip`, archive.buffer as ArrayBuffer, "application/zip");
      await markManualBackup();
      setStorageSafety(await getStorageSafetyStatus());
      setBackupOpen(false);
      setExportOpen(false);
    } catch (error) {
      window.alert(settings.language === "zh" ? `无法创建备份：${error instanceof Error ? error.message : String(error)}` : `Could not create backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const importBackup = async (file: File) => {
    try {
      const backup = JSON.parse(await file.text()) as { data?: AppData; settings?: AppSettings; keysIncluded?: boolean };
      if (!backup.data || !Array.isArray(backup.data.chats) || !Array.isArray(backup.data.notebooks)) throw new Error("Invalid backup");
      const message = settings.language === "zh" ? "导入会替换此浏览器当前的本地会话和笔记。确定继续吗？" : "Importing replaces this browser’s current local chats and notebooks. Continue?";
      if (!window.confirm(message)) return;
      setData(backup.data);
      await replaceData(backup.data);
      if (backup.settings) {
        const imported = backup.keysIncluded === false
          ? { ...backup.settings, providers: Object.fromEntries((Object.keys(defaultSettings.providers) as ProviderId[]).map((id) => [id, { ...backup.settings!.providers[id], apiKey: settings.providers[id].apiKey }])) as AppSettings["providers"] }
          : backup.settings;
        setSettings(normalizeSettings(imported));
      }
      setActiveChatId(backup.data.chats[0]?.id ?? null);
      setActiveNotebookId(backup.data.notebooks[0]?.id ?? null);
    } catch {
      window.alert(settings.language === "zh" ? "无法读取此备份文件。请选择 ai-chat 导出的 JSON 备份。" : "This backup could not be read. Select a JSON backup exported by ai-chat.");
    } finally {
      setExportOpen(false);
    }
  };

  const visibleChats = [...data.chats].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt));
  const searchResults = query.trim() ? visibleChats.filter((chat) => `${chat.title}\n${chatSearchText(chat)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : visibleChats;
  const refreshStorageSafety = () => void getStorageSafetyStatus().then(setStorageSafety).catch(() => undefined);
  const enablePersistentStorage = () => void requestPersistentStorage().then(refreshStorageSafety).catch(refreshStorageSafety);
  const configureAutomaticBackup = () => void chooseAutomaticBackupFolder().then(refreshStorageSafety).catch(() => undefined);

  if (!hydrated) return <main className="boot-screen"><MossMark className="app-mark hero-mark" /><p>Opening local workspace…</p></main>;

  const copy = COPY[settings.language];
  const syncStatusText = syncAge(lastSyncAt, syncNow, settings.language);
  return <LocaleContext.Provider value={settings.language}><main className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
    <aside className="sidebar">
      <div className="brand-row"><button type="button" className="brand" onClick={() => setSidebarOpen(false)}><MossMark className="app-mark brand-mark" /><span>MossChat</span></button><button className="icon-button collapse-button" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={19} /></button></div>
      <button className="new-chat" type="button" onClick={() => createChat()}><Pencil size={17} />{copy.newChat}<span>Ctrl + Shift + O</span></button>
      <div className="side-nav"><button onClick={() => setSearchOpen(true)}><Search size={17} />{copy.searchChats}</button></div>
      <div className={`side-section notebook-section ${notebooksCollapsed ? "is-collapsed" : ""}`}>
        <div className="section-label"><span>{copy.notebooks}</span><button className="icon-button notebook-collapse-button" type="button" aria-label={notebooksCollapsed ? (settings.language === "zh" ? "展开 Notebook" : "Expand Notebooks") : (settings.language === "zh" ? "收起 Notebook" : "Collapse Notebooks")} title={notebooksCollapsed ? (settings.language === "zh" ? "展开" : "Expand") : (settings.language === "zh" ? "收起" : "Collapse")} aria-expanded={!notebooksCollapsed} onClick={() => setNotebooksCollapsed((value) => !value)}>{notebooksCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button><button className="icon-button notebook-add-button" type="button" aria-label={copy.newNotebook} title={copy.newNotebook} onClick={() => { setNotebooksCollapsed(false); beginCreateNotebook(); }}><Plus size={16} /></button></div>
        <div className="notebook-section-content">
        {notebookCreateOpen && <form className="new-notebook-form" onSubmit={(event) => { event.preventDefault(); saveNewNotebook(); }}><input autoFocus value={notebookTitleDraft} maxLength={120} aria-label={settings.language === "zh" ? "Notebook 名称" : "Notebook name"} placeholder={settings.language === "zh" ? "Notebook 名称" : "Notebook name"} onChange={(event) => setNotebookTitleDraft(event.target.value)} /><button type="submit" className="icon-button" aria-label={settings.language === "zh" ? "创建" : "Create"}><Check size={16} /></button><button type="button" className="icon-button" aria-label={settings.language === "zh" ? "取消" : "Cancel"} onClick={() => { setNotebookCreateOpen(false); setNotebookCreateChatId(null); }}><X size={16} /></button>{notebookCreateChatId && <small>{settings.language === "zh" ? "创建后会将当前对话加入其中" : "The current chat will be added"}</small>}</form>}
        {data.notebooks.map((notebook) => {
          const count = data.chats.filter((chat) => chat.notebookId === notebook.id).length;
          return <div key={notebook.id} className={`side-item notebook-item ${notebookViewOpen && activeNotebookId === notebook.id ? "active" : ""}`}>
            <div className="notebook-row">{renamingNotebookId === notebook.id ? <input className="chat-title-editor" autoFocus value={notebookRenameDraft} aria-label={settings.language === "zh" ? "Notebook 名称" : "Notebook name"} onChange={(event) => setNotebookRenameDraft(event.target.value)} onBlur={() => saveSidebarNotebookRename(notebook.id)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveSidebarNotebookRename(notebook.id); } if (event.key === "Escape") setRenamingNotebookId(null); }} /> : <button className="notebook-select" type="button" title={notebook.title} onClick={() => openNotebook(notebook.id)}><BookOpen size={16} /><span>{notebook.title}</span><small>{count}</small></button>}<button className="notebook-more" type="button" aria-label={settings.language === "zh" ? "Notebook 操作" : "Notebook actions"} title={settings.language === "zh" ? "Notebook 操作" : "Notebook actions"} onClick={() => setExpandedNotebookId((id) => id === notebook.id ? null : notebook.id)}><MoreHorizontal size={16} /></button></div>
            {expandedNotebookId === notebook.id && <div className="chat-actions-panel"><button type="button" onClick={() => beginRenameNotebook(notebook.id)}><Pencil size={14} />{settings.language === "zh" ? "重命名" : "Rename"}</button><button type="button" className="danger" onClick={() => removeNotebook(notebook.id)}><Trash2 size={14} />{settings.language === "zh" ? "删除" : "Delete"}</button></div>}
          </div>;
        })}
        </div>
      </div>
      <div className="side-section recent-section"><div className="section-label"><span>{copy.recent}</span></div>{visibleChats.slice(0, 11).map((chat) => <div className={`side-item chat-item ${activeChatId === chat.id && !notebookViewOpen ? "active" : ""}`} key={chat.id}><div className="chat-row">{renamingChatId === chat.id ? <input className="chat-title-editor" autoFocus value={chatTitleDraft} aria-label={settings.language === "zh" ? "会话标题" : "Chat title"} onChange={(event) => setChatTitleDraft(event.target.value)} onBlur={() => saveRenamedChat(chat.id)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveRenamedChat(chat.id); } if (event.key === "Escape") setRenamingChatId(null); }} /> : <button className="chat-select" type="button" title={chat.title} onClick={() => selectChat(chat.id)}><span className="chat-title">{chat.title}</span>{chat.pinned && <Pin size={13} fill="currentColor" />}</button>}<button className="chat-more" type="button" aria-label={settings.language === "zh" ? "会话操作" : "Chat actions"} title={settings.language === "zh" ? "会话操作" : "Chat actions"} onClick={() => { setExpandedChatId((id) => id === chat.id ? null : chat.id); setAddingNotebookForChatId(null); }}><MoreHorizontal size={16} /></button></div>{expandedChatId === chat.id && <div className="chat-actions-panel"><button type="button" onClick={() => toggleChatPin(chat.id)}><Pin size={14} fill={chat.pinned ? "currentColor" : "none"} />{chat.pinned ? (settings.language === "zh" ? "取消置顶" : "Unpin") : (settings.language === "zh" ? "置顶" : "Pin")}</button><button type="button" onClick={() => beginRenameChat(chat.id)}><Pencil size={14} />{settings.language === "zh" ? "重命名" : "Rename"}</button><button type="button" onClick={() => setAddingNotebookForChatId((id) => id === chat.id ? null : chat.id)}><BookOpen size={14} />{settings.language === "zh" ? "添加到 Notebook" : "Add to notebook"}</button>{addingNotebookForChatId === chat.id && <div className="action-notebook-list">{data.notebooks.map((notebook) => <button type="button" key={notebook.id} onClick={() => addChatToNotebook(chat.id, notebook.id)}>{notebook.title}</button>)}<button type="button" onClick={() => createNotebookForChat(chat.id)}><Plus size={14} />{settings.language === "zh" ? "新建 Notebook" : "New notebook"}</button></div>}<button type="button" className="danger" onClick={() => removeChat(chat.id)}><Trash2 size={14} />{settings.language === "zh" ? "删除" : "Delete"}</button></div>}</div>)}</div>
      <div className="profile-row"><div className="profile-avatar">A</div><div><strong>{copy.localWorkspace}</strong><small>{copy.browserOnly}</small></div><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label={copy.settings}><Settings size={18} /></button></div>
    </aside>
    <section className="main-area">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu /></button>
        <div className="top-model-controls"><ModelMenu settings={settings} onChange={setSettings} /><ThinkingMenu settings={settings} onChange={setSettings} /></div>
        {(activeChat || (notebookViewOpen && activeNotebook)) && <button type="button" className="top-icon prompt-top-action" onClick={() => openPromptSettings(activeChat ? "chat" : "notebook")}><TextQuote size={17} />{settings.language === "zh" ? "Prompts" : "Prompts"}</button>}
        {!installed && <button className="top-icon pwa-install-button" type="button" title={settings.language === "zh" ? "添加 MossChat 到桌面" : "Add MossChat to desktop"} onClick={() => void installApp()}><Download size={17} />{settings.language === "zh" ? "添加到桌面" : "Add to desktop"}</button>}
        <div className="top-actions">
          {activeChat && <button className="top-icon" onClick={toggleActivePin} title={activeChat.pinned ? (settings.language === "zh" ? "取消置顶" : "Unpin chat") : (settings.language === "zh" ? "置顶会话" : "Pin chat")}><Pin size={16} fill={activeChat.pinned ? "currentColor" : "none"} />{activeChat.pinned ? (settings.language === "zh" ? "已置顶" : "Pinned") : (settings.language === "zh" ? "置顶" : "Pin")}</button>}
          <div className="sync-wrap" ref={syncMenuRef}><button type="button" className={`top-icon ${syncStatus === "syncing" ? "is-syncing" : ""}`} title={syncReady ? (settings.language === "zh" ? "同步" : "Sync") : (settings.language === "zh" ? "请先配置同步" : "Configure sync first")} onClick={() => setSyncMenuOpen((value) => !value)}><RefreshCw size={17} />{settings.language === "zh" ? "同步" : "Sync"}</button>{syncReady && <span className="sync-age" aria-live="polite">{syncStatus === "syncing" ? (settings.language === "zh" ? "正在同步" : "Syncing") : syncStatusText}</span>}{syncMenuOpen && <div className="sync-menu"><strong className={`sync-state ${syncReady ? "is-ready" : "is-inactive"} ${syncStatus === "error" ? "error" : ""} ${syncStatus === "syncing" ? "is-syncing" : ""}`}><i />{syncStatus === "syncing" ? (settings.language === "zh" ? "正在同步" : "Syncing") : syncReady ? syncStatusText : (settings.language === "zh" ? "尚未配置同步" : "Sync is not configured")}</strong><button type="button" disabled={!syncReady || syncStatus === "syncing"} onClick={() => void runSync()}><RefreshCw size={15} />{settings.language === "zh" ? "立即同步" : "Sync now"}</button><button type="button" onClick={() => { setSyncConfigOpen(true); setSyncMenuOpen(false); }}><Settings size={15} />{settings.language === "zh" ? "配置同步" : "Configure sync"}</button>{syncMessage && <small className={syncStatus === "error" ? "error" : ""}>{syncMessage}</small>}</div>}</div>
          <div className="export-wrap"><button className="top-icon" onClick={() => setExportOpen((value) => !value)}><Upload size={17} />{copy.export}</button>{exportOpen && <div className="export-menu"><button onClick={() => exportCurrent("markdown")}>{copy.exportMd}</button><button onClick={() => exportCurrent("word")}>{copy.exportWord}</button><button onClick={() => setBackupOpen(true)}>{copy.backup}</button><label className="import-backup"><input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.currentTarget.value = ""; }} />{settings.language === "zh" ? "导入旧版 JSON 备份" : "Import legacy JSON backup"}</label></div>}</div>
          <button className="top-icon" type="button" title={settings.language === "zh" ? "反馈" : "Feedback"} onClick={() => setFeedbackTarget(null)}><MessageSquareText size={17} />{settings.language === "zh" ? "反馈" : "Feedback"}</button>
        </div>
      </header>
      {notebookViewOpen && activeNotebook ? <NotebookView notebook={activeNotebook} chats={visibleChats.filter((chat) => chat.notebookId === activeNotebook.id)} onBack={() => { setNotebookViewOpen(false); setActiveNotebookId(null); }} onCreateChat={() => createChat(activeNotebook.id)} onOpenChat={selectChat} onRename={(title) => renameNotebook(activeNotebook.id, title)} onDelete={() => removeNotebook(activeNotebook.id)} /> : activeChat ? <GeminiThread key={activeChat.id} chat={activeChat} settings={settings} systemPrompt={activeSystemPrompt} onSnapshot={handleSnapshot} onFork={forkChat} onSettingsChange={setSettings} onFeedback={setFeedbackTarget} onOpenPromptSettings={() => openPromptSettings("chat")} /> : <div className="empty-chat"><MossMark className="app-mark hero-mark" /><h2>{copy.localStart}</h2><p>{copy.localStartDetail}</p><button className="new-chat" type="button" onClick={() => createChat()}><MessageSquarePlus size={17} />{copy.newChat}</button></div>}
    </section>
    {searchOpen && <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}><section className="search-dialog" onMouseDown={(event) => event.stopPropagation()}><Search size={19} /><input autoFocus placeholder={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} /><button className="icon-button" onClick={() => setSearchOpen(false)}><X /></button><div className="search-results"><p>{settings.language === "zh" ? "结果" : "Results"}</p>{searchResults.map((chat) => <button key={chat.id} onClick={() => { selectChat(chat.id); setSearchOpen(false); }}><span><strong>{chat.title}</strong><small>{searchExcerpt(chat, query)}</small></span><time>{shortDate(chat.updatedAt, settings.language)}</time></button>)}{query.trim() && !searchResults.length && <p className="search-empty">{settings.language === "zh" ? "没有匹配的对话内容。" : "No matching chat content."}</p>}</div></section></div>}
    {settingsOpen && <SettingsDialog settings={settings} safety={storageSafety} onChange={setSettings} onClose={() => setSettingsOpen(false)} onRequestPersistent={enablePersistentStorage} onChooseAutoBackup={configureAutomaticBackup} />}
    {promptDialogOpen && <PromptSettingsDialog key={`${promptDialogScope}:${activeChat?.id ?? "none"}:${promptNotebook?.id ?? "none"}`} chat={activeChat} notebook={promptNotebook} initialScope={promptDialogScope} settings={settings} onChange={setSettings} onSaveChat={(prompt) => { if (activeChat) saveChatSystemPrompt(activeChat.id, prompt); }} onSaveNotebook={(prompt, mode) => { if (promptNotebook) saveNotebookSystemPrompt(promptNotebook.id, prompt, mode); }} onSaveGlobal={(prompt) => setSettings({ ...settings, systemPrompt: prompt })} onClose={() => setPromptDialogOpen(false)} />}
    {feedbackTarget !== undefined && <FeedbackDialog target={feedbackTarget} onClose={() => setFeedbackTarget(undefined)} />}
    {installGuideOpen && <InstallDialog onClose={() => setInstallGuideOpen(false)} />}
    {syncConfigOpen && <SyncDialog config={syncConfig} onSave={updateSyncConfig} onOverwrite={overwriteRemoteSync} onClear={clearSyncConfig} onClose={() => setSyncConfigOpen(false)} />}
    {syncReview && <SyncReviewDialog inspection={syncReview} onClose={() => setSyncReview(null)} onResolve={(resolution) => { setSyncReview(null); void runSync(resolution); }} />}
    {syncReconfigureNotice && <div className="modal-backdrop" onMouseDown={() => setSyncReconfigureNotice(false)}><section className="sync-review-dialog" role="alertdialog" aria-modal="true" aria-label={settings.language === "zh" ? "同步服务器已更改" : "Sync server changed"} onMouseDown={(event) => event.stopPropagation()}><header><div><Cloud size={20} /><h2>{settings.language === "zh" ? "同步需要重新配置" : "Sync needs to be reconfigured"}</h2></div><button className="icon-button" type="button" onClick={() => setSyncReconfigureNotice(false)}><X /></button></header><div className="sync-review-body"><p className="sync-review-warning">{settings.language === "zh" ? "当前服务器配置已更改，请重新配置。" : "The current server configuration has changed. Please configure sync again."}</p><p>{settings.language === "zh" ? "本机数据没有被删除；重新配置后可选择加入已有同步，或新建同步并确认是否覆盖远程数据。" : "Local data was not deleted. Reconfigure to join an existing sync or create a new sync and confirm any remote overwrite."}</p></div><footer><button type="button" className="sync-review-cancel" onClick={() => setSyncReconfigureNotice(false)}>{settings.language === "zh" ? "稍后" : "Later"}</button><button type="button" className="text-button" onClick={() => { setSyncReconfigureNotice(false); setSyncConfigOpen(true); }}>{settings.language === "zh" ? "重新配置" : "Reconfigure"}</button></footer></section></div>}
    {backupOpen && <div className="modal-backdrop" onMouseDown={() => setBackupOpen(false)}><section className="backup-dialog" onMouseDown={(event) => event.stopPropagation()}><header><h2>{settings.language === "zh" ? "导出 ZIP 备份" : "Export ZIP backup"}</h2><button className="icon-button" onClick={() => setBackupOpen(false)}><X /></button></header><p>{settings.language === "zh" ? "选择要写入本地 ZIP 的内容。默认包含 API 配置与密钥。" : "Choose what goes into the local ZIP. API configuration and keys are included by default."}</p><label className="toggle-row"><input type="checkbox" checked={backupOptions.chats} onChange={(event) => setBackupOptions((current) => ({ ...current, chats: event.target.checked }))} />{settings.language === "zh" ? "聊天记录" : "Chat history"}</label><label className="toggle-row"><input type="checkbox" checked={backupOptions.settings} onChange={(event) => setBackupOptions((current) => ({ ...current, settings: event.target.checked }))} />{settings.language === "zh" ? "模型配置与 API" : "Model configuration & API keys"}</label><label className="toggle-row"><input type="checkbox" checked={backupOptions.attachments} onChange={(event) => setBackupOptions((current) => ({ ...current, attachments: event.target.checked }))} />{settings.language === "zh" ? "图片与文件二进制" : "Image and file binaries"}</label><footer><button className="text-button" onClick={() => void exportBackup()}>{settings.language === "zh" ? "导出 ZIP" : "Export ZIP"}</button></footer></section></div>}
  </main></LocaleContext.Provider>;
}
