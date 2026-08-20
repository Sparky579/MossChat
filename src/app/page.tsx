"use client";

import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Cloud,
  Copy,
  Download,
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
import { emptySyncConfig, isSyncConfigured, loadSyncConfig, saveSyncConfig, synchronizeWebDav, type SyncConfig } from "@/sync";
import type { AppData, AppSettings, Chat, Notebook, PromptPreset, ProviderId, ProviderKind, SavedAttachment, SavedMessage, ThinkingLevel } from "@/types";

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

function ChatMessage({ message, index, onFork, onEdit, onReload, onFunctionResult, onFeedback }: { message: SavedMessage; index: number; onFork: (index: number) => void; onEdit: (index: number, text: string) => void; onReload: (index: number) => void; onFunctionResult: (index: number, call: FunctionCallRequest) => void; onFeedback: (target: FeedbackTarget) => void }) {
  const user = message.role === "user";
  const hasThinking = !user && message.content.some((part) => part.type === "reasoning" && Boolean(part.text));
  const locale = useContext(LocaleContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => messageText(message));
  const functionCall = user ? null : functionCallFromText(messageText(message));
  const copyMessage = async () => {
    const text = messageText(message);
    if (text) await navigator.clipboard?.writeText(text);
  };
  return <article className={`message-row ${user ? "message-user" : "message-assistant"} ${hasThinking ? "has-thinking" : ""}`}>
    <div className="message-content">
      {!user && <div className="assistant-avatar"><MossMark size={15} /></div>}
      <div className={user ? "user-bubble" : "assistant-copy"}>{editing ? <div className="inline-message-editor"><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); const next = draft.trim(); if (next) { onEdit(index, next); setEditing(false); } } }} /><div><button type="button" onClick={() => setEditing(false)}>{locale === "zh" ? "取消" : "Cancel"}</button><button type="button" className="text-button" onClick={() => { const next = draft.trim(); if (next) { onEdit(index, next); setEditing(false); } }}>{locale === "zh" ? "保存并重试" : "Save & retry"}</button></div></div> : <MessageBody message={message} />}</div>
    </div>
    {!user && !message.status?.running && <div className="answer-feedback"><span>{locale === "zh" ? "这条回答怎么样？" : "How was this response?"}</span><button className="icon-button" type="button" aria-label={locale === "zh" ? "有帮助" : "Helpful"} title={locale === "zh" ? "有帮助" : "Helpful"} onClick={() => onFeedback({ messageId: message.id, response: messageText(message), reaction: "helpful" })}><ThumbsUp size={15} /></button><button className="icon-button" type="button" aria-label={locale === "zh" ? "没有帮助" : "Not helpful"} title={locale === "zh" ? "没有帮助" : "Not helpful"} onClick={() => onFeedback({ messageId: message.id, response: messageText(message), reaction: "not-helpful" })}><ThumbsDown size={15} /></button></div>}
    <div className="message-actions">
      <button className="icon-button" type="button" aria-label="Copy" title="Copy" onClick={() => void copyMessage()}><Copy size={16} /></button>
      {user && <button className="icon-button" type="button" aria-label="Edit" title="Edit" onClick={() => { setDraft(messageText(message)); setEditing(true); }}><Pencil size={16} /></button>}
      {!user && <button className="icon-button" type="button" aria-label="Regenerate" title="Regenerate" onClick={() => onReload(index)}><RefreshCw size={16} /></button>}
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
  const attachmentsRef = useRef<DraftAttachment[]>([]);
  const activeProvider = settings.providers[settings.activeProvider] ?? orderedProviders(settings)[0]?.[1];

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
    {attachments.length > 0 && <div className="composer-attachments">{attachments.map((attachment) => <span className="composer-attachment" key={attachment.id}><span className="attachment-icon">{attachment.file.type.startsWith("image/") ? <ImagePlus size={18} /> : <FileText size={18} />}</span><span className="attachment-name">{attachment.file.name}</span><button className="icon-button attachment-remove" type="button" aria-label="Remove attachment" onClick={() => removeAttachment(attachment.id)}><X size={14} /></button></span>)}</div>}
    <div className="composer-line">
      <input ref={fileInput} hidden type="file" multiple accept="image/*,application/pdf,.txt,.md,.csv,.doc,.docx" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
      <button type="button" className="icon-button composer-plus" aria-label="Attach files" onClick={() => fileInput.current?.click()}><Plus size={23} /></button>
      <textarea ref={composerInput} rows={1} value={text} placeholder={copy.ask} className="composer-input" onChange={(event) => setText(event.target.value)} onPaste={(event) => { const images = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file)); if (images.length) { event.preventDefault(); addFiles(images); } }} onKeyDown={(event) => { if (settings.sendWithEnter && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <div className={`composer-model-wrap ${text || attachments.length ? "has-draft" : ""}`}>
        <button type="button" className="model-button" title={activeProvider?.model ?? ""} onClick={() => setModelOpen((current) => !current)}><span className="model-name">{activeProvider?.model ?? "Select a model"}</span><ChevronDown size={15} /></button>
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

function GeminiThread({ chat, settings, systemPrompt, onSnapshot, onFork, onSettingsChange, onFeedback }: { chat: Chat; settings: AppSettings; systemPrompt: string; onSnapshot: (id: string, messages: SavedMessage[], dirtyMessageIds?: string[]) => void; onFork: (index: number) => void; onSettingsChange: (next: AppSettings) => void; onFeedback: (target: FeedbackTarget) => void }) {
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
      const context = baseMessages.slice(-MAX_CONTEXT_MESSAGES);
      const stream = adapter.run({ messages: inflateMessages(context), abortSignal: controller.signal } as never) as AsyncIterable<{ content?: ContentPart[] }>;
      for await (const update of stream) {
        const content = (update.content ?? [])
          .filter((part) => (part.type === "text" || part.type === "reasoning") && typeof part.text === "string")
          .map((part) => ({ type: part.type, text: String(part.text) }));
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
      nextMessages = nextMessages.map((message) => message.id === assistantId ? { ...message, status: undefined } : message);
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

  const send = useCallback(async (text: string, attachments: DraftAttachment[]) => {
    const savedAttachments = await Promise.all(attachments.map(async (attachment) => savedAttachmentFromDraft(attachment, await toDataUrl(attachment.file))));
    const user: SavedMessage = { id: newId("user"), role: "user", content: text ? [{ type: "text", text }] : [], attachments: savedAttachments, createdAt: new Date().toISOString() };
    await run([...chat.messages, user]);
  }, [chat.messages, run]);

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
  const empty = chat.messages.length === 0;
  return <div className="thread-root">
    {empty ? <div className="hero-state"><div className="hero-copy"><MossMark className="app-mark hero-mark" /><h1>{copy.explore}</h1><p>{copy.hero}</p></div><GeminiComposer settings={settings} isRunning={isRunning} onSend={send} onCancel={cancel} onSettingsChange={onSettingsChange} /><StarterPrompts onSend={(prompt) => void send(prompt, [])} /></div> : <><div ref={viewportRef} className="thread-viewport" onScroll={(event) => { const viewport = event.currentTarget; stickToBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96; }}>{chat.messages.map((message, index) => <ChatMessage key={message.id} message={message} index={index} onFork={onFork} onEdit={edit} onReload={reload} onFunctionResult={submitFunctionResult} onFeedback={(target) => onFeedback({ ...target, chatTitle: chat.title })} />)}</div><footer className="thread-footer"><GeminiComposer settings={settings} isRunning={isRunning} onSend={send} onCancel={cancel} onSettingsChange={onSettingsChange} /><p>{copy.mistakes}</p></footer></>}
  </div>;
}

function ModelMenuOptions({ settings, onChange, onClose }: { settings: AppSettings; onChange: (next: AppSettings) => void; onClose: () => void }) {
  const copy = useCopy();
  return <>
    {orderedProviders(settings).flatMap(([id, provider]) => provider.models.filter(Boolean).map((model) => <button key={`${id}:${model}`} type="button" className={id === settings.activeProvider && model === provider.model ? "active" : ""} onClick={() => { onChange({ ...settings, activeProvider: id, providers: { ...settings.providers, [id]: { ...provider, model } } }); onClose(); }}><span><strong>{provider.name}</strong><small>{model}</small></span>{id === settings.activeProvider && model === provider.model && <Check size={16} />}</button>))}
    <hr />
    <button type="button" onClick={() => { document.dispatchEvent(new CustomEvent("ai-chat:open-settings")); onClose(); }}><Settings size={16} />{copy.manageApi}</button>
  </>;
}

function ModelMenu({ settings, onChange }: { settings: AppSettings; onChange: (next: AppSettings) => void }) {
  const [open, setOpen] = useState(false);
  const provider = settings.providers[settings.activeProvider] ?? orderedProviders(settings)[0]?.[1];
  return <div className="model-menu-wrap">
    <button type="button" className="top-model" title={provider?.model ?? ""} onClick={() => setOpen((current) => !current)}><MossMark className="model-mark" size={18} /><span className="model-name">{provider?.model ?? "Select a model"}</span><ChevronDown size={16} /></button>
    {open && <div className="model-menu top-model-menu"><ModelMenuOptions settings={settings} onChange={onChange} onClose={() => setOpen(false)} /></div>}
  </div>;
}

function ThinkingMenu({ settings, onChange }: { settings: AppSettings; onChange: (next: AppSettings) => void }) {
  const [open, setOpen] = useState(false);
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
  return <div className="thinking-menu-wrap"><button type="button" className={`thinking-button ${settings.thinkingLevel !== "off" ? "active" : ""}`} title={locale === "zh" ? "调整思考等级" : "Adjust thinking level"} onClick={() => setOpen((current) => !current)}><Sparkles size={16} /><span>{labelFor(settings.thinkingLevel)}</span><ChevronDown size={15} /></button>{open && <div className="thinking-menu"><strong>{locale === "zh" ? "思考等级" : "Thinking level"}</strong>{choices.map((level) => <button key={level} type="button" className={settings.thinkingLevel === level ? "active" : ""} onClick={() => { onChange({ ...settings, thinkingLevel: level }); setOpen(false); }}>{labelFor(level)}</button>)}<label>{locale === "zh" ? "提供商预设值" : "Provider preset"}<input list="thinking-preset-values" value={customPreset} placeholder="e.g. xhigh" onChange={(event) => onChange({ ...settings, thinkingLevel: event.target.value.trim() || "off" })} /><datalist id="thinking-preset-values"><option value="minimal" /><option value="xhigh" /></datalist></label>{settings.thinkingLevel === "custom" && <label>{locale === "zh" ? "Token 预算" : "Token budget"}<input type="number" min="0" step="128" value={settings.thinkingBudget} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange({ ...settings, thinkingBudget: Number(event.target.value) || 0 })} /></label>}<small>{locale === "zh" ? "原生预设会原样传给兼容提供商，并在下一条请求生效" : "Provider presets are passed through to compatible APIs on the next request"}</small></div>}</div>;
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

function SettingsDialog({ settings, safety, onChange, onClose, onRequestPersistent, onChooseAutoBackup }: { settings: AppSettings; safety: StorageSafetyStatus | null; onChange: (settings: AppSettings) => void; onClose: () => void; onRequestPersistent: () => void; onChooseAutoBackup: () => void }) {
  const copy = useCopy();
  const [tab, setTab] = useState<"models" | "behavior" | "tools" | "privacy">("models");
  const updateProvider = (id: ProviderId, field: "name" | "kind" | "apiKey" | "baseUrl" | "model", value: string) => {
    const provider = settings.providers[id];
    const preset = field === "name" ? presetFromProviderName(value) : null;
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, [field]: value, ...(preset ? { kind: PROVIDER_PRESETS[preset].kind, baseUrl: PROVIDER_PRESETS[preset].baseUrl } : {}) } } });
  };
  const applyProviderPreset = (id: ProviderId, presetId: ProviderPresetId) => {
    const provider = settings.providers[id];
    const preset = PROVIDER_PRESETS[presetId];
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, name: provider.name === "New provider" ? preset.name : provider.name, kind: preset.kind, baseUrl: preset.baseUrl } } });
  };
  const updateModel = (id: ProviderId, index: number, value: string) => {
    const provider = settings.providers[id];
    const previous = provider.models[index];
    const models = [...provider.models];
    models[index] = value;
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, models, model: provider.model === previous ? value : provider.model } } });
  };
  const addModel = (id: ProviderId) => {
    const provider = settings.providers[id];
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, models: [...provider.models, ""] } } });
  };
  const removeModel = (id: ProviderId, index: number) => {
    const provider = settings.providers[id];
    if (provider.models.length <= 1) return;
    const removed = provider.models[index];
    const models = provider.models.filter((_, itemIndex) => itemIndex !== index);
    onChange({ ...settings, providers: { ...settings.providers, [id]: { ...provider, models, model: provider.model === removed ? models[0] : provider.model } } });
  };
  const addProvider = () => {
    const id = newId("provider");
    onChange({ ...settings, providers: { ...settings.providers, [id]: { name: "New provider", kind: "openai", apiKey: "", baseUrl: "", model: "", models: [""] } }, providerOrder: [id, ...settings.providerOrder] });
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
    <header><div><MossMark className="app-mark settings-mark" /><h2>{copy.settings}</h2></div><button className="icon-button" onClick={onClose} aria-label={copy.done}><X /></button></header>
    <div className="settings-body"><nav>{[["models", copy.apiModels], ["behavior", copy.behavior], ["tools", copy.tools], ["privacy", copy.privacy]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id as typeof tab)}>{label}</button>)}</nav>
      <div className="settings-content">
        {tab === "models" && <>
          <h3>{copy.apiTitle}</h3><p className="muted">{copy.apiDetail}</p>
          <div className="provider-actions"><button type="button" onClick={addProvider}>+ Add provider</button></div>
          {orderedProviders(settings).map(([id, provider], index) => <fieldset key={id}>
            <legend>{provider.name}</legend>
            <div className="provider-row-actions"><button type="button" disabled={!index} onClick={() => moveProvider(id, -1)} aria-label="Move provider up"><ArrowUp size={15} /></button><button type="button" disabled={index === settings.providerOrder.length - 1} onClick={() => moveProvider(id, 1)} aria-label="Move provider down"><ArrowDown size={15} /></button><button type="button" disabled={settings.providerOrder.length <= 1} onClick={() => removeProvider(id)} aria-label="Delete provider"><Trash2 size={15} /></button></div>
            <div className="provider-presets"><span>{settings.language === "zh" ? "端点预设" : "Endpoint preset"}</span>{(Object.keys(PROVIDER_PRESETS) as ProviderPresetId[]).map((presetId) => <button type="button" key={presetId} className={provider.baseUrl === PROVIDER_PRESETS[presetId].baseUrl ? "active" : ""} onClick={() => applyProviderPreset(id, presetId)}>{PROVIDER_PRESETS[presetId].label}</button>)}</div>
            <label>Provider name<input value={provider.name} onChange={(event) => updateProvider(id, "name", event.target.value)} /></label>
            <label>Protocol<select value={provider.kind} onChange={(event) => updateProvider(id, "kind", event.target.value as ProviderKind)}><option value="openai">OpenAI compatible</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option></select></label>
            <label>{copy.key}<input type="password" autoComplete="off" value={provider.apiKey} onChange={(event) => updateProvider(id, "apiKey", event.target.value)} placeholder="Paste your key" /></label>
            <label>{copy.baseUrl}<input value={provider.baseUrl} onChange={(event) => updateProvider(id, "baseUrl", event.target.value)} /></label>
            <div className="provider-models"><span>{copy.defaultModel}</span>{provider.models.map((model, modelIndex) => <div className="provider-model-row" key={modelIndex}><button type="button" className={provider.model === model ? "active" : ""} title={provider.model === model ? "Selected model" : "Use this model"} onClick={() => updateProvider(id, "model", model)}><Check size={14} /></button><input value={model} onChange={(event) => updateModel(id, modelIndex, event.target.value)} placeholder="e.g. gemini-2.5-flash" /><button type="button" disabled={provider.models.length <= 1} onClick={() => removeModel(id, modelIndex)} aria-label="Delete model"><Trash2 size={15} /></button></div>)}<button type="button" className="add-model" onClick={() => addModel(id)}>+ Add model</button></div>
          </fieldset>)}
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
        throw new Error(body?.error || "Feedback could not be sent.");
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (isChinese ? "发送失败，请稍后再试。" : "Could not send feedback. Try again later."));
    } finally {
      setSending(false);
    }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onMouseDown={(event) => event.stopPropagation()}><header><div><MessageSquareText size={20} /><h2 id="feedback-title">{isChinese ? "反馈" : "Feedback"}</h2></div><button className="icon-button" type="button" aria-label={isChinese ? "关闭" : "Close"} onClick={onClose}><X /></button></header>{sent ? <div className="feedback-sent"><h3>{isChinese ? "已发送，谢谢。" : "Thanks, your feedback was sent."}</h3><p>{isChinese ? "我们会查看每一条反馈。" : "We review every submission."}</p><button type="button" className="text-button" onClick={onClose}>{isChinese ? "完成" : "Done"}</button></div> : <form onSubmit={submit}><div className="feedback-body"><label>{isChinese ? "有什么坏了或者缺什么？" : "What is broken or missing?"}<textarea autoFocus value={message} maxLength={4000} onChange={(event) => setMessage(event.target.value)} /></label>{target?.response && <p className="feedback-context">{isChinese ? "这条回答会随反馈一同发送。" : "This response will be included with your feedback."}</p>}<label>{isChinese ? "邮箱（可选，想收到回复就填）" : "Email (optional, only if you want a reply)"}<input type="email" inputMode="email" autoComplete="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} /></label><label className="feedback-subscribe"><input type="checkbox" checked={subscribe} onChange={(event) => setSubscribe(event.target.checked)} />{isChinese ? "也通知我新版本（大约每月一封）" : "Also notify me about new versions (about one email a month)"}</label><p className="feedback-privacy">{isChinese ? "反馈会发送到 MossChat 的反馈邮箱。若勾选订阅，邮箱会加入新版本通知名单。" : "Feedback is sent to the MossChat feedback mailbox. If you opt in, your email is added to the release update list."}</p>{error && <p className="feedback-error" role="alert">{error}</p>}</div><footer><button type="button" className="feedback-cancel" onClick={onClose}>{isChinese ? "取消" : "Cancel"}</button><button type="submit" className="text-button" disabled={sending}>{sending ? (isChinese ? "发送中…" : "Sending…") : (isChinese ? "发送反馈" : "Send feedback")}</button></footer></form>}</section></div>;
}

function InstallDialog({ onClose }: { onClose: () => void }) {
  const locale = useContext(LocaleContext);
  const ios = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isChinese = locale === "zh";
  const steps = ios
    ? (isChinese ? "在 Safari 中点击底部的分享按钮，再选择“添加到主屏幕”。" : "In Safari, tap Share, then choose Add to Home Screen.")
    : (isChinese ? "在浏览器菜单中选择“安装 MossChat”或“添加到主屏幕”。" : "Open your browser menu and choose Install MossChat or Add to Home Screen.");
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="install-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><Download size={20} /><h2>{isChinese ? "安装 MossChat" : "Install MossChat"}</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header><div><MossMark className="app-mark" size={52} /><h3>{isChinese ? "像应用一样打开" : "Open it like an app"}</h3><p>{steps}</p><p>{isChinese ? "安装后可从桌面或应用列表启动，并使用独立窗口。" : "After installation it opens from your home screen or app list in its own window."}</p></div><footer><button className="text-button" type="button" onClick={onClose}>{isChinese ? "完成" : "Done"}</button></footer></section></div>;
}

function SyncDialog({ config, onSave, onClose }: { config: SyncConfig; onSave: (config: SyncConfig) => void; onClose: () => void }) {
  const locale = useContext(LocaleContext);
  const [draft, setDraft] = useState(config);
  const isChinese = locale === "zh";
  const origin = typeof window === "undefined" ? "https://yourapp.com" : window.location.origin;
  const caddyfile = `{
  order respond before basicauth
}

sync.example.com {
  @preflight method OPTIONS
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
  root * /data/chatsync
  basicauth {
    ${draft.username || "you"} <bcrypt-hash>
  }
  webdav
}`;
  const agentTask = `# Task: set up sync server for MossChat

You are configuring a WebDAV sync endpoint on this machine.

## Required outcome
An HTTPS endpoint that serves WebDAV at the root, allows CORS from ${origin}, allows GET, PUT, DELETE, PROPFIND, OPTIONS, answers OPTIONS with 204 before auth, and requires Basic Auth for all other methods.

## Steps
1. Detect Docker, Caddy, and Tailscale.
2. Prefer Docker Compose. Fall back to native Caddy.
3. Create a Caddy build with github.com/mholt/caddy-webdav and use this Caddyfile.
4. If no public domain is available, run tailscale serve --bg https / http://localhost:8080 and report the hostname.
5. Generate the bcrypt hash with caddy hash-password, generate a strong password, and verify the endpoint with the curl command below.

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
curl -X OPTIONS -i https://HOST/ -H "Origin: ${origin}" -H "Access-Control-Request-Method: PROPFIND"
curl -u USER:PASSWORD -X PROPFIND -i https://HOST/ -H "Depth: 1"
\`\`\`

Expect 204 for OPTIONS with PROPFIND in Access-Control-Allow-Methods. A 401 on OPTIONS means auth is handling the preflight. Report the final URL, username, and generated password.`;
  const copy = (value: string) => void navigator.clipboard?.writeText(value);
  const save = () => { onSave({ ...draft, endpoint: draft.endpoint.trim() }); };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sync-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><Cloud size={20} /><h2>{isChinese ? "配置同步" : "Configure sync"}</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header><div className="sync-dialog-body"><section className="sync-fields"><label>{isChinese ? "WebDAV endpoint" : "WebDAV endpoint"}<input type="url" autoComplete="url" placeholder="https://sync.example.com/" value={draft.endpoint} onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })} /></label><div className="two-fields"><label>{isChinese ? "用户名" : "Username"}<input autoComplete="username" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label><label>{isChinese ? "WebDAV 密码" : "WebDAV password"}<input type="password" autoComplete="current-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label></div><label>{isChinese ? "加密口令" : "Encryption passphrase"}<input type="password" autoComplete="new-password" value={draft.passphrase} onChange={(event) => setDraft({ ...draft, passphrase: event.target.value })} /></label><p>{isChinese ? "口令在上传前派生加密密钥。它和 WebDAV 凭据只保留在此浏览器，以便下次打开时自动同步。" : "The passphrase derives the encryption key before upload. It and the WebDAV credentials stay in this browser so sync can run on the next visit."}</p><label className="sync-toggle"><input type="checkbox" checked={draft.includeKeys} onChange={(event) => setDraft({ ...draft, includeKeys: event.target.checked })} />{isChinese ? "同步 API keys" : "Sync API keys"}</label>{draft.includeKeys && <p className="sync-warning">{isChinese ? "API keys 会先加密再上传。请使用足够长且独特的口令。" : "API keys are encrypted before upload. Use a long, unique passphrase."}</p>}<div className="sync-config-actions"><button type="button" className="text-button" onClick={save}>{isChinese ? "保存配置" : "Save configuration"}</button></div></section><section className="sync-guide"><h3>{isChinese ? "同步教程" : "Sync server guide"}</h3><p>{isChinese ? "需要 HTTPS，且 OPTIONS 必须在 Basic Auth 之前返回 204。" : "Use HTTPS. OPTIONS must return 204 before Basic Auth runs."}</p><details open><summary>{isChinese ? "给人的 Caddy 配置" : "Caddy setup"}</summary><pre>{caddyfile}</pre><button type="button" onClick={() => copy(caddyfile)}>{isChinese ? "复制 Caddyfile" : "Copy Caddyfile"}</button></details><details><summary>{isChinese ? "给 Agent 的一键配置任务" : "One click task for an agent"}</summary><p>{isChinese ? "内容包括检测环境、Docker 回退、Tailscale、验证命令和常见 CORS 问题。" : "Includes environment checks, Docker fallback, Tailscale, verification, and common CORS failures."}</p><button type="button" onClick={() => copy(agentTask)}>{isChinese ? "复制 Agent 任务" : "Copy agent task"}</button></details></section></div></section></div>;
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
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);
  const [addingNotebookForChatId, setAddingNotebookForChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null | undefined>(undefined);
  const [promptTarget, setPromptTarget] = useState<{ scope: "chat" | "notebook"; id: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [syncConfigOpen, setSyncConfigOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error" | "done">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [backupOptions, setBackupOptions] = useState({ chats: true, settings: true, attachments: true });
  const [storageSafety, setStorageSafety] = useState<StorageSafetyStatus | null>(null);
  const settingsRef = useRef(settings);
  const namingAttempts = useRef(new Set<string>());
  const autoSyncAttempt = useRef("");
  const deferredInstallPrompt = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setSyncConfig(loadSyncConfig());
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
  const activeSystemPrompt = activeChat?.systemPrompt ?? (activeChat?.notebookId ? data.notebooks.find((notebook) => notebook.id === activeChat.notebookId)?.systemPrompt : undefined) ?? settings.systemPrompt;
  const promptTargetItem = promptTarget?.scope === "chat" ? data.chats.find((chat) => chat.id === promptTarget.id) : promptTarget?.scope === "notebook" ? data.notebooks.find((notebook) => notebook.id === promptTarget.id) : null;
  const syncReady = isSyncConfigured(syncConfig);
  const updateSyncConfig = (next: SyncConfig) => { setSyncConfig(next); saveSyncConfig(next); };
  const runSync = useCallback(async (mode: "merge" | "upload" = "merge") => {
    if (!syncReady) return;
    setSyncStatus("syncing");
    setSyncMessage("");
    try {
      const result = await synchronizeWebDav({ config: syncConfig, data, settings, mode });
      setData(result.data);
      await replaceData(result.data);
      setSettings(normalizeSettings(result.settings));
      setSyncStatus("done");
      setSyncMessage(`${mode === "merge" ? "Synced" : "Uploaded"}: ${result.uploaded} uploaded, ${result.downloaded} remote records.`);
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(error instanceof Error ? error.message : "Sync failed.");
    }
  }, [data, settings, syncConfig, syncReady]);
  const installApp = async () => {
    const prompt = deferredInstallPrompt.current;
    if (!prompt) { setInstallGuideOpen(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") { deferredInstallPrompt.current = null; setInstalled(true); }
  };
  useEffect(() => {
    const key = `${syncConfig.endpoint}|${syncConfig.username}|${syncConfig.deviceId}`;
    if (!hydrated || !syncReady || autoSyncAttempt.current === key) return;
    autoSyncAttempt.current = key;
    void runSync("merge");
  }, [hydrated, runSync, syncConfig.deviceId, syncConfig.endpoint, syncConfig.username, syncReady]);

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
    const notebook: Notebook = { id: newId("notebook"), title: title.trim().slice(0, 120) || "Untitled notebook", content: "", attachments: [], createdAt: now, updatedAt: now };
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

  const removeNotebook = (notebookId: string) => {
    const target = data.notebooks.find((notebook) => notebook.id === notebookId);
    if (!target) return;
    const prompt = settings.language === "zh" ? `删除「${target.title}」？其中的会话会保留在最近对话中。` : `Delete “${target.title}”? Its chats will remain in Recents.`;
    if (!window.confirm(prompt)) return;
    const updatedChats = data.chats.filter((chat) => chat.notebookId === notebookId).map((chat) => ({ ...chat, notebookId: undefined, updatedAt: new Date().toISOString() }));
    setData((current) => ({ ...current, notebooks: current.notebooks.filter((notebook) => notebook.id !== notebookId), chats: current.chats.map((chat) => updatedChats.find((updated) => updated.id === chat.id) ?? chat) }));
    for (const chat of updatedChats) void saveChatMetadata(chat);
    void deleteNotebook(notebookId);
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

  const saveNotebookSystemPrompt = (notebookId: string, systemPrompt: string) => {
    const target = data.notebooks.find((notebook) => notebook.id === notebookId);
    if (!target) return;
    const nextNotebook = { ...target, systemPrompt: systemPrompt || undefined, updatedAt: new Date().toISOString() };
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
  return <LocaleContext.Provider value={settings.language}><main className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
    <aside className="sidebar">
      <div className="brand-row"><button type="button" className="brand" onClick={() => setSidebarOpen(false)}><MossMark className="app-mark brand-mark" /><span>MossChat</span></button><button className="icon-button collapse-button" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={19} /></button></div>
      <button className="new-chat" type="button" onClick={() => createChat()}><Pencil size={17} />{copy.newChat}<span>Ctrl + Shift + O</span></button>
      <div className="side-nav"><button onClick={() => setSearchOpen(true)}><Search size={17} />{copy.searchChats}</button></div>
      <div className="side-section notebook-section"><div className="section-label"><span>{copy.notebooks}</span><button className="icon-button" type="button" aria-label={copy.newNotebook} title={copy.newNotebook} onClick={() => beginCreateNotebook()}><Plus size={16} /></button></div>{notebookCreateOpen && <form className="new-notebook-form" onSubmit={(event) => { event.preventDefault(); saveNewNotebook(); }}><input autoFocus value={notebookTitleDraft} maxLength={120} aria-label={settings.language === "zh" ? "Notebook 名称" : "Notebook name"} placeholder={settings.language === "zh" ? "Notebook 名称" : "Notebook name"} onChange={(event) => setNotebookTitleDraft(event.target.value)} /><button type="submit" className="icon-button" aria-label={settings.language === "zh" ? "创建" : "Create"}><Check size={16} /></button><button type="button" className="icon-button" aria-label={settings.language === "zh" ? "取消" : "Cancel"} onClick={() => { setNotebookCreateOpen(false); setNotebookCreateChatId(null); }}><X size={16} /></button>{notebookCreateChatId && <small>{settings.language === "zh" ? "创建后会将当前对话加入其中" : "The current chat will be added"}</small>}</form>}{data.notebooks.map((notebook) => { const count = data.chats.filter((chat) => chat.notebookId === notebook.id).length; return <button key={notebook.id} className={`side-item notebook-item ${notebookViewOpen && activeNotebookId === notebook.id ? "active" : ""}`} type="button" onClick={() => openNotebook(notebook.id)}><BookOpen size={16} /><span>{notebook.title}</span><small>{count}</small></button>; })}</div>
      <div className="side-section recent-section"><div className="section-label"><span>{copy.recent}</span></div>{visibleChats.slice(0, 11).map((chat) => <div className={`side-item chat-item ${activeChatId === chat.id && !notebookViewOpen ? "active" : ""}`} key={chat.id}><div className="chat-row">{renamingChatId === chat.id ? <input className="chat-title-editor" autoFocus value={chatTitleDraft} aria-label={settings.language === "zh" ? "会话标题" : "Chat title"} onChange={(event) => setChatTitleDraft(event.target.value)} onBlur={() => saveRenamedChat(chat.id)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveRenamedChat(chat.id); } if (event.key === "Escape") setRenamingChatId(null); }} /> : <button className="chat-select" type="button" title={chat.title} onClick={() => selectChat(chat.id)}><span className="chat-title">{chat.title}</span>{chat.pinned && <Pin size={13} fill="currentColor" />}</button>}<button className="chat-more" type="button" aria-label={settings.language === "zh" ? "会话操作" : "Chat actions"} title={settings.language === "zh" ? "会话操作" : "Chat actions"} onClick={() => { setExpandedChatId((id) => id === chat.id ? null : chat.id); setAddingNotebookForChatId(null); }}><MoreHorizontal size={16} /></button></div>{expandedChatId === chat.id && <div className="chat-actions-panel"><button type="button" onClick={() => toggleChatPin(chat.id)}><Pin size={14} fill={chat.pinned ? "currentColor" : "none"} />{chat.pinned ? (settings.language === "zh" ? "取消置顶" : "Unpin") : (settings.language === "zh" ? "置顶" : "Pin")}</button><button type="button" onClick={() => beginRenameChat(chat.id)}><Pencil size={14} />{settings.language === "zh" ? "重命名" : "Rename"}</button><button type="button" onClick={() => setAddingNotebookForChatId((id) => id === chat.id ? null : chat.id)}><BookOpen size={14} />{settings.language === "zh" ? "添加到 Notebook" : "Add to notebook"}</button>{addingNotebookForChatId === chat.id && <div className="action-notebook-list">{data.notebooks.map((notebook) => <button type="button" key={notebook.id} onClick={() => addChatToNotebook(chat.id, notebook.id)}>{notebook.title}</button>)}<button type="button" onClick={() => createNotebookForChat(chat.id)}><Plus size={14} />{settings.language === "zh" ? "新建 Notebook" : "New notebook"}</button></div>}<button type="button" className="danger" onClick={() => removeChat(chat.id)}><Trash2 size={14} />{settings.language === "zh" ? "删除" : "Delete"}</button></div>}</div>)}</div>
      <div className="profile-row"><div className="profile-avatar">A</div><div><strong>{copy.localWorkspace}</strong><small>{copy.browserOnly}</small></div><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label={copy.settings}><Settings size={18} /></button></div>
    </aside>
    <section className="main-area">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu /></button>
        <div className="top-model-controls"><ModelMenu settings={settings} onChange={setSettings} /><ThinkingMenu settings={settings} onChange={setSettings} /></div>
        {(activeChat || (notebookViewOpen && activeNotebook)) && <button type="button" className="top-icon prompt-top-action" onClick={() => setPromptTarget(activeChat ? { scope: "chat", id: activeChat.id } : { scope: "notebook", id: activeNotebook!.id })}><TextQuote size={17} />{settings.language === "zh" ? "Prompts" : "Prompts"}</button>}
        {!installed && <button className="top-icon pwa-install-button" type="button" title={settings.language === "zh" ? "安装 MossChat" : "Install MossChat"} onClick={() => void installApp()}><Download size={17} />{settings.language === "zh" ? "安装" : "Install"}</button>}
        <div className="top-actions">{activeChat && <button className="top-icon" onClick={toggleActivePin} title={activeChat.pinned ? (settings.language === "zh" ? "取消置顶" : "Unpin chat") : (settings.language === "zh" ? "置顶会话" : "Pin chat")}><Pin size={16} fill={activeChat.pinned ? "currentColor" : "none"} />{activeChat.pinned ? (settings.language === "zh" ? "已置顶" : "Pinned") : (settings.language === "zh" ? "置顶" : "Pin")}</button>}<div className="sync-wrap"><button type="button" className={`top-icon ${syncStatus === "syncing" ? "is-syncing" : ""}`} title={syncReady ? (settings.language === "zh" ? "同步" : "Sync") : (settings.language === "zh" ? "请先配置同步" : "Configure sync first")} onClick={() => setSyncMenuOpen((value) => !value)}><RefreshCw size={17} />{settings.language === "zh" ? "同步" : "Sync"}</button>{syncMenuOpen && <div className="sync-menu"><strong>{syncReady ? (settings.language === "zh" ? "WebDAV 已配置" : "WebDAV configured") : (settings.language === "zh" ? "尚未配置同步" : "Sync is not configured")}</strong><button type="button" disabled={!syncReady || syncStatus === "syncing"} onClick={() => void runSync("upload")}><Upload size={15} />{settings.language === "zh" ? "上传" : "Upload"}</button><button type="button" disabled={!syncReady || syncStatus === "syncing"} onClick={() => void runSync("merge")}><RefreshCw size={15} />{settings.language === "zh" ? "同步远程" : "Sync remote"}</button><button type="button" onClick={() => { setSyncConfigOpen(true); setSyncMenuOpen(false); }}><Settings size={15} />{settings.language === "zh" ? "配置同步" : "Configure sync"}</button>{syncMessage && <small className={syncStatus === "error" ? "error" : ""}>{syncMessage}</small>}</div>}</div><div className="export-wrap"><button className="top-icon" onClick={() => setExportOpen((value) => !value)}><Upload size={17} />{copy.export}</button>{exportOpen && <div className="export-menu"><button onClick={() => exportCurrent("markdown")}>{copy.exportMd}</button><button onClick={() => exportCurrent("word")}>{copy.exportWord}</button><button onClick={() => setBackupOpen(true)}>{copy.backup}</button><label className="import-backup"><input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.currentTarget.value = ""; }} />{settings.language === "zh" ? "导入旧版 JSON 备份" : "Import legacy JSON backup"}</label></div>}</div><button className="top-icon" type="button" title={settings.language === "zh" ? "反馈" : "Feedback"} onClick={() => setFeedbackTarget(null)}><MessageSquareText size={17} />{settings.language === "zh" ? "反馈" : "Feedback"}</button></div>
      </header>
      {notebookViewOpen && activeNotebook ? <NotebookView notebook={activeNotebook} chats={visibleChats.filter((chat) => chat.notebookId === activeNotebook.id)} onBack={() => { setNotebookViewOpen(false); setActiveNotebookId(null); }} onCreateChat={() => createChat(activeNotebook.id)} onOpenChat={selectChat} onRename={(title) => renameNotebook(activeNotebook.id, title)} onDelete={() => removeNotebook(activeNotebook.id)} /> : activeChat ? <GeminiThread key={activeChat.id} chat={activeChat} settings={settings} systemPrompt={activeSystemPrompt} onSnapshot={handleSnapshot} onFork={forkChat} onSettingsChange={setSettings} onFeedback={setFeedbackTarget} /> : <div className="empty-chat"><MossMark className="app-mark hero-mark" /><h2>{copy.localStart}</h2><p>{copy.localStartDetail}</p><button className="new-chat" type="button" onClick={() => createChat()}><MessageSquarePlus size={17} />{copy.newChat}</button></div>}
    </section>
    {searchOpen && <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}><section className="search-dialog" onMouseDown={(event) => event.stopPropagation()}><Search size={19} /><input autoFocus placeholder={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} /><button className="icon-button" onClick={() => setSearchOpen(false)}><X /></button><div className="search-results"><p>{settings.language === "zh" ? "结果" : "Results"}</p>{searchResults.map((chat) => <button key={chat.id} onClick={() => { selectChat(chat.id); setSearchOpen(false); }}><span><strong>{chat.title}</strong><small>{searchExcerpt(chat, query)}</small></span><time>{shortDate(chat.updatedAt, settings.language)}</time></button>)}{query.trim() && !searchResults.length && <p className="search-empty">{settings.language === "zh" ? "没有匹配的对话内容。" : "No matching chat content."}</p>}</div></section></div>}
    {settingsOpen && <SettingsDialog settings={settings} safety={storageSafety} onChange={setSettings} onClose={() => setSettingsOpen(false)} onRequestPersistent={enablePersistentStorage} onChooseAutoBackup={configureAutomaticBackup} />}
    {promptTarget && promptTargetItem && <PromptDialog key={`${promptTarget.scope}:${promptTarget.id}`} target={promptTargetItem} scope={promptTarget.scope} settings={settings} onChange={setSettings} onSavePrompt={(prompt) => { if (promptTarget.scope === "chat") saveChatSystemPrompt(promptTarget.id, prompt); else saveNotebookSystemPrompt(promptTarget.id, prompt); }} onClose={() => setPromptTarget(null)} />}
    {feedbackTarget !== undefined && <FeedbackDialog target={feedbackTarget} onClose={() => setFeedbackTarget(undefined)} />}
    {installGuideOpen && <InstallDialog onClose={() => setInstallGuideOpen(false)} />}
    {syncConfigOpen && <SyncDialog config={syncConfig} onSave={updateSyncConfig} onClose={() => setSyncConfigOpen(false)} />}
    {backupOpen && <div className="modal-backdrop" onMouseDown={() => setBackupOpen(false)}><section className="backup-dialog" onMouseDown={(event) => event.stopPropagation()}><header><h2>{settings.language === "zh" ? "导出 ZIP 备份" : "Export ZIP backup"}</h2><button className="icon-button" onClick={() => setBackupOpen(false)}><X /></button></header><p>{settings.language === "zh" ? "选择要写入本地 ZIP 的内容。默认包含 API 配置与密钥。" : "Choose what goes into the local ZIP. API configuration and keys are included by default."}</p><label className="toggle-row"><input type="checkbox" checked={backupOptions.chats} onChange={(event) => setBackupOptions((current) => ({ ...current, chats: event.target.checked }))} />{settings.language === "zh" ? "聊天记录" : "Chat history"}</label><label className="toggle-row"><input type="checkbox" checked={backupOptions.settings} onChange={(event) => setBackupOptions((current) => ({ ...current, settings: event.target.checked }))} />{settings.language === "zh" ? "模型配置与 API" : "Model configuration & API keys"}</label><label className="toggle-row"><input type="checkbox" checked={backupOptions.attachments} onChange={(event) => setBackupOptions((current) => ({ ...current, attachments: event.target.checked }))} />{settings.language === "zh" ? "图片与文件二进制" : "Image and file binaries"}</label><footer><button className="text-button" onClick={() => void exportBackup()}>{settings.language === "zh" ? "导出 ZIP" : "Export ZIP"}</button></footer></section></div>}
  </main></LocaleContext.Provider>;
}
