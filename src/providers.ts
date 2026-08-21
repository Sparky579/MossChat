import type { ChatModelAdapter, ThreadMessage } from "@assistant-ui/react";
import type { AppSettings } from "./types";

type ContentPart = {
  type: string;
  text?: string;
  image?: string;
  data?: string;
  mimeType?: string;
  filename?: string;
  name?: string;
  response?: unknown;
  callId?: string;
  inputTokens?: number;
  outputTokens?: number;
  extractedText?: string;
};

type NativeFunctionDeclaration = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

type NativeFunctionCall = {
  name: string;
  args: unknown;
  callId?: string;
};

type WireMessage = {
  role: string;
  content: readonly ContentPart[];
  attachments?: readonly { content?: readonly ContentPart[] }[];
};

const trimSlash = (url: string) => url.replace(/\/+$/, "");

const isOpenRouter = (baseUrl: string) => /(^|\.)openrouter\.ai(?:\/|$)/i.test(trimSlash(baseUrl).replace(/^https?:\/\//, ""));
const supportsOpenAiUsageStream = (baseUrl: string) => isOpenRouter(baseUrl) || /^https:\/\/api\.openai\.com(?:\/|$)/i.test(trimSlash(baseUrl));

/**
 * A narrowly scoped same-origin relay for a legacy endpoint whose Cloudflare
 * edge blocks CORS preflight requests. Keep this an explicit allowlist: a
 * generic URL relay would become an unsafe public proxy.
 */
const corsRelayEndpoint = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    if (url.hostname !== "openai-key.sparky.qzz.io" || !url.pathname.startsWith("/v1/")) return endpoint;
    const appOrigin = typeof window === "undefined" ? "https://mosschat.xyz" : window.location.origin;
    return `${appOrigin}/llm/openai-key${url.pathname}${url.search}`;
  } catch {
    return endpoint;
  }
};

const displayEndpoint = (value: string) => {
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (/(?:^|[_-])(key|token|secret|password)(?:$|[_-])/i.test(key) || /^(?:key|token|secret|password)$/i.test(key)) url.searchParams.set(key, "REDACTED");
    }
    return url.toString();
  } catch {
    return value.replace(/([?&](?:api[_-]?key|key|token|secret|password)=)[^&]*/gi, "$1REDACTED");
  }
};

const redactErrorDetails = (value: string) => value
  .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|(?:cfut|re)_[A-Za-z0-9_-]{12,})\b/g, "[redacted]")
  .replace(/((?:api[_ -]?key|authorization|token|password)\s*[=:]\s*["']?)[^\s,"'}\]]+/gi, "$1[redacted]");

const conciseErrorBody = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : JSON.stringify(value, null, 2);
  if (!raw) return "";
  const cleaned = redactErrorDetails(raw);
  return cleaned.length > 2_000 ? `${cleaned.slice(0, 2_000)}\n… (truncated)` : cleaned;
};

const streamErrorDetails = (event: Record<string, unknown>) => {
  if (!event.error && event.type !== "error") return "";
  return conciseErrorBody(event.error ?? event);
};

const providerFailure = ({ language, provider, endpoint, summary, details }: {
  language: AppSettings["language"];
  provider: { name: string; kind: string };
  endpoint: string;
  summary: string;
  details?: string;
}) => {
  const isChinese = language === "zh";
  return [
    isChinese ? "API 请求失败。" : "API request failed.",
    `${isChinese ? "提供商" : "Provider"}: ${provider.name} (${provider.kind})`,
    `${isChinese ? "请求地址" : "Endpoint"}: \`${displayEndpoint(endpoint)}\``,
    summary,
    ...(details ? [`${isChinese ? "服务端返回" : "Server response"}:\n\`\`\`text\n${details}\n\`\`\``] : []),
  ].join("\n\n");
};

const thinkingBudget = (settings: AppSettings): number | null => {
  if (settings.thinkingLevel === "custom") return settings.thinkingBudget > 0 ? settings.thinkingBudget : null;
  const presetBudget: Record<string, number | null> = { off: null, low: 1024, medium: 2048, high: 4096 };
  return presetBudget[settings.thinkingLevel] ?? (settings.thinkingBudget > 0 ? settings.thinkingBudget : 2048);
};

const openAiReasoningEffort = (settings: AppSettings): string | null => {
  if (settings.thinkingLevel === "off") return null;
  if (settings.thinkingLevel !== "custom") return settings.thinkingLevel;
  return settings.thinkingBudget <= 1024 ? "low" : settings.thinkingBudget >= 4096 ? "high" : "medium";
};

const openRouterReasoning = (settings: AppSettings, budget: number | null) => {
  if (settings.thinkingLevel === "off") return undefined;
  return settings.thinkingLevel === "custom"
    ? (budget ? { max_tokens: budget } : { enabled: true })
    : { effort: settings.thinkingLevel };
};

const textFromUnknown = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textFromUnknown).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return [item.text, item.summary, item.reasoning, item.reasoning_content, item.delta].map(textFromUnknown).filter(Boolean).join("\n");
  }
  return "";
};

const tokenValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;

function tokenUsage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const usage = value as Record<string, unknown>;
  const input = tokenValue(usage.input_tokens) ?? tokenValue(usage.prompt_tokens) ?? tokenValue(usage.promptTokenCount) ?? tokenValue(usage.inputTokens);
  const output = tokenValue(usage.output_tokens) ?? tokenValue(usage.completion_tokens) ?? tokenValue(usage.candidatesTokenCount) ?? tokenValue(usage.outputTokens);
  return input === undefined && output === undefined ? null : { input, output };
}

const reasoningFromDetails = (value: unknown): string => {
  if (!Array.isArray(value)) return "";
  return value.map((detail) => {
    if (!detail || typeof detail !== "object") return "";
    const item = detail as Record<string, unknown>;
    const visible = textFromUnknown(item.text) || textFromUnknown(item.summary) || textFromUnknown(item.content);
    return visible || (item.type === "reasoning.encrypted" ? "[Reasoning is encrypted by the provider.]" : "");
  }).filter(Boolean).join("\n");
};

const asParts = (message: ThreadMessage): ContentPart[] => {
  const wire = message as unknown as WireMessage;
  const attachmentParts = wire.attachments?.flatMap((attachment) => attachment.content ?? []) ?? [];
  return [...wire.content, ...attachmentParts];
};

const textFor = (message: ThreadMessage): string =>
  asParts(message)
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");

const getBase64 = (value: string): string => {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma !== -1 ? value.slice(comma + 1) : value;
};

const getMime = (value: string, fallback: string): string => {
  const match = /^data:([^;,]+)/.exec(value);
  return match?.[1] ?? fallback;
};

const attachmentText = (part: ContentPart) => {
  const name = part.filename ?? "document";
  const extracted = part.extractedText?.trim();
  return extracted ? `[Attachment: ${name}]\n${extracted}` : `[Attachment: ${name}]`;
};

async function* parseSseEvents(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        yield JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // Providers are allowed to send non-data SSE events; ignore those.
      }
    }
    if (done) break;
  }
}

function openAiMessages(messages: readonly ThreadMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const parts = asParts(message);
      const functionResult = parts.find((part) => part.type === "function-result" && part.name);
      if (functionResult) {
        return {
          role: "tool",
          tool_call_id: functionResult.callId ?? functionResult.name,
          content: JSON.stringify(functionResult.response ?? {}),
        };
      }
      const functionCall = message.role === "assistant"
        ? parts.filter((part) => part.type === "text" && part.text).map((part) => functionCallFromTranscript(part.text ?? "")).find(Boolean)
        : null;
      if (functionCall) {
        return {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: functionCall.callId ?? functionCall.name,
            type: "function",
            function: { name: functionCall.name, arguments: JSON.stringify(functionCall.args) },
          }],
        };
      }
      const content: Array<Record<string, unknown>> = [];
      const text = textFor(message);
      if (text) content.push({ type: "text", text });
      for (const part of parts) {
        if (part.type === "image" && part.image) {
          content.push({ type: "image_url", image_url: { url: part.image } });
        }
        if (part.type === "file") {
          content.push({ type: "text", text: attachmentText(part) });
        }
      }
      return {
        role: message.role === "assistant" ? "assistant" : "user",
        content: content.length === 1 && content[0]?.type === "text" ? content[0].text : content,
      };
    });
}

function anthropicMessages(messages: readonly ThreadMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const parts = asParts(message);
      const functionResult = parts.find((part) => part.type === "function-result" && part.name);
      if (functionResult) {
        return {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: functionResult.callId ?? functionResult.name, content: JSON.stringify(functionResult.response ?? {}) }],
        };
      }
      const functionCall = message.role === "assistant"
        ? parts.filter((part) => part.type === "text" && part.text).map((part) => functionCallFromTranscript(part.text ?? "")).find(Boolean)
        : null;
      if (functionCall) {
        return {
          role: "assistant",
          content: [{ type: "tool_use", id: functionCall.callId ?? functionCall.name, name: functionCall.name, input: functionCall.args }],
        };
      }
      const content: Array<Record<string, unknown>> = [];
      for (const part of parts) {
        if (part.type === "text" && part.text) content.push({ type: "text", text: part.text });
        if (part.type === "image" && part.image) {
          content.push({
            type: "image",
            source: { type: "base64", media_type: getMime(part.image, "image/png"), data: getBase64(part.image) },
          });
        }
        if (part.type === "file" && part.data && part.mimeType === "application/pdf") {
          content.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: getBase64(part.data) },
          });
        }
        if (part.type === "file" && part.extractedText) content.push({ type: "text", text: attachmentText(part) });
      }
      return { role: message.role === "assistant" ? "assistant" : "user", content };
    });
}

function googleContents(messages: readonly ThreadMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const parts: Array<Record<string, unknown>> = [];
      for (const part of asParts(message)) {
        if (part.type === "text" && part.text) {
          const call = message.role === "assistant" ? functionCallFromTranscript(part.text) : null;
          if (call) parts.push({ functionCall: call });
          else parts.push({ text: part.text });
        }
        if (part.type === "function-result" && part.name) {
          const response = part.response && typeof part.response === "object" && !Array.isArray(part.response) ? part.response : { result: part.response ?? "" };
          parts.push({ functionResponse: { name: part.name, response } });
        }
        if (part.type === "image" && part.image) {
          parts.push({ inline_data: { mime_type: getMime(part.image, "image/png"), data: getBase64(part.image) } });
        }
        if (part.type === "file" && part.data) {
          parts.push({ inline_data: { mime_type: part.mimeType ?? "application/octet-stream", data: getBase64(part.data) } });
        }
        if (part.type === "file" && part.extractedText) parts.push({ text: attachmentText(part) });
      }
      return { role: message.role === "assistant" ? "model" : "user", parts };
    });
}

function functionCallFromTranscript(text: string): NativeFunctionCall | null {
  const match = /\*\*Function call requested:\*\* `([^`]+)`(?:\n<!--ai-chat-tool-call:([^>]+)-->)?\n\n```json\n([\s\S]*?)\n```/.exec(text);
  if (!match) return null;
  try {
    return { name: match[1], callId: match[2] ? decodeURIComponent(match[2]) : undefined, args: JSON.parse(match[3]) };
  } catch {
    return null;
  }
}

function formatFunctionCall(call: NativeFunctionCall): string {
  const marker = call.callId ? `\n<!--ai-chat-tool-call:${encodeURIComponent(call.callId)}-->` : "";
  return `\n\n**Function call requested:** \`${call.name}\`${marker}\n\n\`\`\`json\n${JSON.stringify(call.args ?? {}, null, 2)}\n\`\`\``;
}

function functionDeclarations(settings: AppSettings): NativeFunctionDeclaration[] {
  const raw = settings.nativeTools.functionDeclarations.trim();
  if (!raw || raw === "[]") return [];
  try {
    const declarations = JSON.parse(raw) as unknown;
    if (!Array.isArray(declarations) || declarations.some((item) => !item || typeof item !== "object" || typeof (item as { name?: unknown }).name !== "string")) {
      throw new Error("Function declarations must be a JSON array of objects with a name.");
    }
    return declarations as NativeFunctionDeclaration[];
  } catch (error) {
    const details = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(settings.language === "zh" ? `函数声明不是有效的 JSON 数组：${details}` : `Function declarations must be a valid JSON array: ${details}`);
  }
}

function googleTools(declarations: NativeFunctionDeclaration[]): Array<Record<string, unknown>> {
  return declarations.length ? [{ function_declarations: declarations }] : [];
}

const openAiTools = (declarations: NativeFunctionDeclaration[]) =>
  declarations.map((declaration) => ({ type: "function", function: declaration }));

const anthropicTools = (declarations: NativeFunctionDeclaration[]) =>
  declarations.map((declaration) => ({
    name: declaration.name,
    ...(declaration.description ? { description: declaration.description } : {}),
    input_schema: declaration.parameters ?? { type: "object", properties: {} },
  }));

function googlePartText(part: Record<string, unknown>): string {
  if (part.thought === true) return "";
  if (typeof part.text === "string") return part.text;
  const functionCall = part.functionCall as { name?: string; args?: unknown } | undefined;
  if (functionCall?.name) return formatFunctionCall({ name: functionCall.name, args: functionCall.args ?? {} });
  return "";
}

function googlePartReasoning(part: Record<string, unknown>): string {
  const summary = textFromUnknown(part.thoughtSummary) || textFromUnknown(part.thought_summary);
  if (summary) return summary;
  return part.thought === true ? textFromUnknown(part.text) : "";
}

export function createBrowserAdapter(getSettings: () => AppSettings): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const settings = getSettings();
      const provider = settings.providers[settings.activeProvider];
      if (!provider) throw new Error(settings.language === "zh" ? "当前提供商不存在。请在设置中选择一个提供商。" : "The active provider no longer exists. Select one in Settings.");
      if (!provider.apiKey.trim()) {
        throw new Error(settings.language === "zh" ? "请先在“设置 → API 与模型”中填写 API Key。密钥仅保存于当前浏览器。" : "Add an API key in Settings → API & models first. It remains in this browser only.");
      }

      const declarations = functionDeclarations(settings);
      const budget = thinkingBudget(settings);
      const reasoningEffort = openAiReasoningEffort(settings);
      let requestEndpoint = "";
      const request = async (endpoint: string, init: RequestInit) => {
        requestEndpoint = endpoint;
        const transportEndpoint = corsRelayEndpoint(endpoint);
        try {
          return await fetch(transportEndpoint, init);
        } catch (cause) {
          if (abortSignal.aborted) throw cause;
          const original = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
          throw new Error(providerFailure({
            language: settings.language,
            provider,
            endpoint,
            summary: settings.language === "zh" ? `网络请求未能建立：${original}\n请检查 Endpoint、网络、CORS 和代理证书。` : `The network request could not be established: ${original}\nCheck the endpoint, network, CORS, and any proxy certificate.`,
          }));
        }
      };
      let response: Response;
      if (provider.kind === "openai") {
        response = await request(`${trimSlash(provider.baseUrl)}/chat/completions`, {
          method: "POST",
          signal: abortSignal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            stream: true,
            ...(supportsOpenAiUsageStream(provider.baseUrl) ? { stream_options: { include_usage: true } } : {}),
            messages: [
              ...(settings.systemPrompt.trim() ? [{ role: "system", content: settings.systemPrompt.trim() }] : []),
              ...openAiMessages(messages),
            ],
            ...(declarations.length ? { tools: openAiTools(declarations) } : {}),
            ...(isOpenRouter(provider.baseUrl) ? { reasoning: openRouterReasoning(settings, budget) } : reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          }),
        });
      } else if (provider.kind === "anthropic") {
        response = await request(`${trimSlash(provider.baseUrl)}/v1/messages`, {
          method: "POST",
          signal: abortSignal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": provider.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: budget ? Math.max(4096, budget + 1024) : 4096,
            stream: true,
            ...(settings.systemPrompt.trim() ? { system: settings.systemPrompt.trim() } : {}),
            messages: anthropicMessages(messages),
            ...(declarations.length ? { tools: anthropicTools(declarations) } : {}),
            ...(budget ? { thinking: { type: "enabled", budget_tokens: budget } } : {}),
          }),
        });
      } else {
        const endpoint = `${trimSlash(provider.baseUrl)}/v1beta/models/${encodeURIComponent(provider.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`;
        const tools = googleTools(declarations);
        response = await request(endpoint, {
          method: "POST",
          signal: abortSignal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(settings.systemPrompt.trim() ? { system_instruction: { parts: [{ text: settings.systemPrompt.trim() }] } } : {}),
            ...(tools.length ? { tools } : {}),
            ...(budget ? { generationConfig: { thinkingConfig: { thinkingBudget: budget, includeThoughts: true } } } : {}),
            contents: googleContents(messages),
          }),
        });
      }

      if (!response.ok) {
        const details = conciseErrorBody(await response.text());
        throw new Error(providerFailure({
          language: settings.language,
          provider,
          endpoint: requestEndpoint,
          summary: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
          details,
        }));
      }

      let fullText = "";
      let fullReasoning = "";
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      const snapshot = () => ({
        content: [
          ...(fullReasoning ? [{ type: "reasoning" as const, text: fullReasoning }] : []),
          ...(fullText ? [{ type: "text" as const, text: fullText }] : []),
          ...(inputTokens === undefined && outputTokens === undefined ? [] : [{ type: "data" as const, name: "token_usage", data: { ...(inputTokens === undefined ? {} : { inputTokens }), ...(outputTokens === undefined ? {} : { outputTokens }) } }]),
        ],
      });
      const append = (value: string) => {
        fullText += value;
        return snapshot();
      };
      const appendReasoning = (value: string) => {
        fullReasoning += value;
        return snapshot();
      };
      const updateUsage = (value: unknown) => {
        const usage = tokenUsage(value);
        if (!usage) return null;
        if (usage.input !== undefined) inputTokens = usage.input;
        if (usage.output !== undefined) outputTokens = usage.output;
        return snapshot();
      };
      const openAiCalls = new Map<number, { id?: string; name?: string; arguments: string }>();
      const anthropicCalls = new Map<number, { id?: string; name?: string; input?: unknown; partialJson: string }>();
      let emittedToolCall = false;

      const emitOpenAiToolCall = () => {
        if (emittedToolCall) return null;
        const call = Array.from(openAiCalls.values()).find((item) => item.name);
        if (!call?.name) return null;
        let args: unknown = {};
        try { args = call.arguments ? JSON.parse(call.arguments) : {}; } catch { args = { raw: call.arguments }; }
        emittedToolCall = true;
        return append(formatFunctionCall({ name: call.name, args, callId: call.id }));
      };

      for await (const data of parseSseEvents(response)) {
        const streamedFailure = streamErrorDetails(data);
        if (streamedFailure) {
          throw new Error(providerFailure({
            language: settings.language,
            provider,
            endpoint: requestEndpoint,
            summary: settings.language === "zh" ? "流式响应返回错误。" : "The streaming response returned an error.",
            details: streamedFailure,
          }));
        }
        if (provider.kind === "openai") {
          const usageUpdate = updateUsage(data.usage ?? (data.response as Record<string, unknown> | undefined)?.usage);
          if (usageUpdate) { yield usageUpdate; continue; }
          const responseEvent = typeof data.type === "string" ? data.type : "";
          if (responseEvent === "response.reasoning_text.delta" || responseEvent === "response.reasoning_summary_text.delta") {
            const delta = textFromUnknown(data.delta);
            if (delta) yield appendReasoning(delta);
            continue;
          }
          if (responseEvent === "response.output_text.delta") {
            const delta = textFromUnknown(data.delta);
            if (delta) yield append(delta);
            continue;
          }
          if (responseEvent === "response.reasoning_summary_text.done" || responseEvent === "response.reasoning_text.done") {
            const text = textFromUnknown(data.text);
            if (text) yield appendReasoning(text);
            continue;
          }
          const choice = (data.choices as Array<{ finish_reason?: string | null; delta?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown; reasoning_details?: unknown; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }> | undefined)?.[0];
          const delta = choice?.delta;
          const reasoning = [textFromUnknown(delta?.reasoning), textFromUnknown(delta?.reasoning_content), reasoningFromDetails(delta?.reasoning_details)].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join("\n");
          if (reasoning) yield appendReasoning(reasoning);
          const content = textFromUnknown(delta?.content);
          if (content) yield append(content);
          for (const incoming of delta?.tool_calls ?? []) {
            const index = incoming.index ?? 0;
            const current = openAiCalls.get(index) ?? { arguments: "" };
            if (incoming.id) current.id = incoming.id;
            if (incoming.function?.name) current.name = incoming.function.name;
            if (incoming.function?.arguments) current.arguments += incoming.function.arguments;
            openAiCalls.set(index, current);
          }
          if (choice?.finish_reason === "tool_calls") {
            const update = emitOpenAiToolCall();
            if (update) yield update;
          }
          continue;
        }

        if (provider.kind === "anthropic") {
          const eventType = data.type;
          const usageUpdate = updateUsage(eventType === "message_start" ? (data.message as Record<string, unknown> | undefined)?.usage : data.usage);
          if (usageUpdate) yield usageUpdate;
          const index = typeof data.index === "number" ? data.index : 0;
          if (eventType === "content_block_start") {
            const block = data.content_block as { type?: string; id?: string; name?: string; input?: unknown; thinking?: string } | undefined;
            if (block?.type === "tool_use") anthropicCalls.set(index, { id: block.id, name: block.name, input: block.input, partialJson: "" });
            if (block?.type === "thinking" && block.thinking) yield appendReasoning(block.thinking);
            if (block?.type === "redacted_thinking") yield appendReasoning(settings.language === "zh" ? "[提供商已隐藏此思考块。]" : "[This thinking block was redacted by the provider.]");
          } else if (eventType === "content_block_delta") {
            const delta = data.delta as { type?: string; text?: string; thinking?: string; partial_json?: string } | undefined;
            if (delta?.type === "text_delta" && delta.text) yield append(delta.text);
            if (delta?.type === "thinking_delta" && delta.thinking) yield appendReasoning(delta.thinking);
            if (delta?.type === "input_json_delta") {
              const call = anthropicCalls.get(index);
              if (call && delta.partial_json) call.partialJson += delta.partial_json;
            }
          } else if (eventType === "content_block_stop") {
            const call = anthropicCalls.get(index);
            if (call?.name && !emittedToolCall) {
              let args = call.input ?? {};
              if (call.partialJson) {
                try { args = JSON.parse(call.partialJson); } catch { args = { raw: call.partialJson }; }
              }
              emittedToolCall = true;
              yield append(formatFunctionCall({ name: call.name, args, callId: call.id }));
            }
          }
          continue;
        }

        const usageUpdate = updateUsage(data.usageMetadata);
        if (usageUpdate) yield usageUpdate;
        const candidate = (data.candidates as Array<{ content?: { parts?: Array<Record<string, unknown>> } }> | undefined)?.[0];
        const parts = candidate?.content?.parts ?? [];
        const reasoning = parts.map(googlePartReasoning).filter(Boolean).join("");
        if (reasoning) yield appendReasoning(reasoning);
        const delta = parts.map(googlePartText).join("");
        if (delta) yield append(delta);
      }
      if (provider.kind === "openai") {
        const update = emitOpenAiToolCall();
        if (update) yield update;
      }
      if (!fullText) yield append(settings.language === "zh" ? "（模型没有返回文本内容）" : "(The model returned no text.)");
    },
  };
}

export async function generateChatTitle(settings: AppSettings, prompt: string): Promise<string | null> {
  const providerId = settings.namingProvider;
  const provider = settings.providers[providerId];
  const model = settings.namingModel.trim();
  if (!model || !provider.apiKey.trim()) return null;
  const instruction = "用用户的语言为以下对话生成一个极短标题。只输出标题，不加引号或标点说明，最多 18 个汉字或 40 个字符。";
  let response: Response;

  if (!provider) return null;

  if (provider.kind === "openai") {
    response = await fetch(corsRelayEndpoint(`${trimSlash(provider.baseUrl)}/chat/completions`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: instruction }, { role: "user", content: prompt }],
        max_tokens: 60,
      }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return body.choices?.[0]?.message?.content?.trim() ?? null;
  }

  if (provider.kind === "anthropic") {
    response = await fetch(corsRelayEndpoint(`${trimSlash(provider.baseUrl)}/v1/messages`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 60, system: instruction, messages: [{ role: "user", content: prompt }] }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { content?: Array<{ text?: string }> };
    return body.content?.[0]?.text?.trim() ?? null;
  }

  response = await fetch(
    corsRelayEndpoint(`${trimSlash(provider.baseUrl)}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${instruction}\n\n${prompt}` }] }] }),
    },
  );
  if (!response.ok) return null;
  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? null;
}
