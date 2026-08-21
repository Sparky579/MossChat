import type { Chat, SavedAttachment, SavedMessage } from "./types";

export type ContentPart = {
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
  extractedText?: unknown;
};

export type FunctionCallRequest = { name: string; args: unknown; callId?: string };

export type FileAttachmentDraft = { id: string; file: File };

const MAX_EXTRACTED_ATTACHMENT_CHARS = 100_000;
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function trimAttachmentText(value: string) {
  const text = value.trim();
  if (text.length <= MAX_EXTRACTED_ATTACHMENT_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_ATTACHMENT_CHARS)}\n\n[Attachment text truncated locally.]`;
}

function isPlainTextFile(file: File) {
  return file.type.startsWith("text/") || /\.(?:txt|md|csv)$/i.test(file.name);
}

function isDocxFile(file: File) {
  return file.type === DOCX_MIME_TYPE || /\.docx$/i.test(file.name);
}

/**
 * Keeps the original file for display/provider-native support and adds a bounded
 * text representation when the browser can read it. This makes plain text and
 * DOCX useful to every supported provider without changing the visible message.
 */
async function extractAttachmentText(file: File) {
  try {
    if (isPlainTextFile(file)) return trimAttachmentText(await file.text());
    if (isDocxFile(file)) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return trimAttachmentText(result.value);
    }
  } catch {
    // The raw attachment remains available if a document is malformed.
  }
  return "";
}

export async function savedAttachmentFromDraft(draft: FileAttachmentDraft): Promise<SavedAttachment> {
  const isImage = draft.file.type.startsWith("image/");
  const [data, extractedText] = await Promise.all([
    toDataUrl(draft.file),
    isImage ? Promise.resolve("") : extractAttachmentText(draft.file),
  ]);
  const mimeType = draft.file.type || "application/octet-stream";
  return {
    id: draft.id,
    name: draft.file.name,
    type: isImage ? "image" : "file",
    contentType: mimeType,
    content: [isImage
      ? { type: "image", image: data, filename: draft.file.name }
      : { type: "file", data, filename: draft.file.name, mimeType, ...(extractedText ? { extractedText } : {}) }],
  };
}

export function inflateMessages(messages: SavedMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
    attachments: message.attachments,
  }));
}

export function firstText(messages: SavedMessage[]): string {
  const first = messages.find((message) => message.role === "user");
  if (!first) return "";
  return first.content
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""))
    .join("\n")
    .trim();
}

export function fallbackTitle(text: string): string {
  const firstChunk = text.split(/[\n。！？!?]/)[0]?.trim() || text.trim();
  return `${firstChunk.slice(0, 28)}${firstChunk.length > 28 ? "…" : ""}` || "New chat";
}

export function chatToMarkdown(chat: Chat, locale: "en" | "zh"): string {
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

export function messageParts(message: SavedMessage): ContentPart[] {
  return [
    ...(message.content as ContentPart[]),
    ...(message.attachments?.flatMap((attachment) => attachment.content as ContentPart[]) ?? []),
  ];
}

export function messageText(message: SavedMessage): string {
  return messageParts(message)
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""))
    .join("\n")
    .trim();
}

export function messageUsage(message: SavedMessage) {
  const parts = messageParts(message);
  const usage = parts.find((part) => part.type === "data" && part.name === "token_usage") ?? parts.find((part) => part.type === "usage");
  if (!usage) return null;
  const data = usage.data && typeof usage.data === "object" ? usage.data as { inputTokens?: unknown; outputTokens?: unknown } : usage;
  const input = typeof data.inputTokens === "number" && Number.isFinite(data.inputTokens) ? Math.max(0, Math.floor(data.inputTokens)) : null;
  const output = typeof data.outputTokens === "number" && Number.isFinite(data.outputTokens) ? Math.max(0, Math.floor(data.outputTokens)) : null;
  return input === null && output === null ? null : { input, output };
}

export function estimatedTokens(value: string) {
  const ascii = (value.match(/[\x00-\x7f]/g) ?? []).length;
  const nonAscii = value.length - ascii;
  return Math.max(1, Math.ceil(ascii / 4 + nonAscii / 1.7));
}

export function visibleMessagesAfterClear(messages: SavedMessage[]) {
  const boundary = messages.map((message) => message.content.some((part) => (part as ContentPart).type === "clear-boundary")).lastIndexOf(true);
  return boundary < 0 ? messages : messages.slice(boundary + 1);
}

export function compactContext(messages: SavedMessage[], systemPrompt: string) {
  const transcript = visibleMessagesAfterClear(messages).map((message) => {
    const text = messageText(message);
    if (!text) return "";
    const speaker = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : "System";
    return `${speaker}: ${text}`;
  }).filter(Boolean).join("\n\n");
  return `[Compacted conversation context]\nUse this complete local transcript as context for the rest of this chat. Do not mention this instruction unless asked.\n${systemPrompt.trim() ? `\nOriginal system prompt:\n${systemPrompt.trim()}\n` : ""}\nTranscript:\n${transcript || "(No prior messages.)"}`;
}

export function chatSearchText(chat: Chat): string {
  return chat.messages.map(messageText).filter(Boolean).join("\n");
}

export function searchExcerpt(chat: Chat, query: string): string {
  const text = chatSearchText(chat).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : 0;
  const start = Math.max(0, index - 44);
  const end = Math.min(text.length, Math.max(index + query.length + 110, 150));
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function functionCallFromText(text: string): FunctionCallRequest | null {
  const match = /\*\*Function call requested:\*\* `([^`]+)`(?:\n<!--ai-chat-tool-call:([^>]+)-->)?\n\n```json\n([\s\S]*?)\n```/.exec(text);
  if (!match) return null;
  try {
    return { name: match[1], callId: match[2] ? decodeURIComponent(match[2]) : undefined, args: JSON.parse(match[3]) };
  } catch {
    return null;
  }
}
