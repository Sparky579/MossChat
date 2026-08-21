import type { AdapterBase, AdapterConfig, AdapterEventMapping, AdapterMessageFormat, AdapterStreamFormat, ProviderCapability, ProviderKind, ProviderSettings, ThinkingLevel } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

const list = <T>(value: unknown, predicate: (item: unknown) => item is T): T[] => Array.isArray(value) ? value.filter(predicate) : [];

const text = (value: unknown, maximum = 240) => typeof value === "string" ? value.trim().slice(0, maximum) : "";

const stringRecord = (value: unknown, maximum = 1000): Record<string, string> | undefined => {
  if (!isObject(value)) return undefined;
  const result = Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const name = text(key, 100);
    const content = text(item, maximum);
    return name && content ? [[name, content]] : [];
  }));
  return Object.keys(result).length ? result : undefined;
};

const supportedBases: AdapterBase[] = ["openai-compatible", "anthropic-messages", "gemini-generate-content", "ollama-chat", "azure-openai", "legacy-completions"];
const supportedFormats: AdapterStreamFormat[] = ["sse", "ndjson", "json-array", "text"];
const supportedMessageFormats: AdapterMessageFormat[] = ["openai", "anthropic", "gemini", "prompt"];
const supportedCapabilities: ProviderCapability[] = ["streaming", "reasoning", "vision", "pdf", "tools"];

const eventMappings = (value: unknown): AdapterEventMapping[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const mappings = value.flatMap((item) => {
    if (!isObject(item)) return [];
    const extract = text(item.extract, 360);
    const when = text(item.when, 360);
    return extract.startsWith("$") ? [{ ...(when ? { when } : {}), extract }] : [];
  });
  return mappings.length ? mappings : undefined;
};

const normaliseCapabilities = (value: unknown) => [...new Set(list(value, (item): item is ProviderCapability => typeof item === "string" && supportedCapabilities.includes(item as ProviderCapability)))];
const normaliseLevels = (value: unknown) => [...new Set(list(value, (item): item is ThinkingLevel => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim().slice(0, 80)))];

/** Latest stable API shapes. Built-in providers still use their native implementation until a custom override is saved. */
export const ADAPTER_PRESETS: Record<AdapterBase, AdapterConfig> = {
  "openai-compatible": {
    schema: 1,
    id: "openai-compatible",
    endpoint: { chat: "/chat/completions", method: "POST" },
    auth: { type: "bearer" },
    request: {
      messageFormat: "openai",
      body: { model: "{{model}}", stream: true, messages: "{{messages.openai}}", tools: "{{tools.openai}}", reasoning_effort: "{{thinking.effort}}" },
    },
    stream: {
      format: "sse",
      doneWhen: "[DONE]",
      events: {
        text: [{ extract: "$.choices[0].delta.content" }, { when: "$.type == 'response.output_text.delta'", extract: "$.delta" }],
        reasoning: [{ extract: "$.choices[0].delta.reasoning_content" }, { extract: "$.choices[0].delta.reasoning" }, { when: "$.type == 'response.reasoning_text.delta'", extract: "$.delta" }],
        toolCall: [{ extract: "$.choices[0].delta.tool_calls[*]" }],
        usage: [{ extract: "$.usage" }, { extract: "$.response.usage" }],
        error: [{ when: "$.type == 'error'", extract: "$.error.message" }],
      },
    },
    response: { text: "$.choices[0].message.content", usage: "$.usage", error: "$.error.message" },
    capabilities: ["streaming", "reasoning", "vision", "tools"],
    thinking: { allowed: ["off", "minimal", "low", "medium", "high", "xhigh", "custom"] },
  },
  "anthropic-messages": {
    schema: 1,
    id: "anthropic-messages",
    endpoint: { chat: "/v1/messages", method: "POST" },
    auth: { type: "header", name: "x-api-key" },
    extraHeaders: { "anthropic-version": "2023-06-01" },
    request: {
      messageFormat: "anthropic",
      body: { model: "{{model}}", stream: true, max_tokens: "{{maxTokens}}", system: "{{system}}", messages: "{{messages.anthropic}}", tools: "{{tools.anthropic}}", thinking: "{{thinking.anthropic}}" },
    },
    stream: {
      format: "sse",
      events: {
        text: [{ when: "$.type == 'content_block_delta' && $.delta.type == 'text_delta'", extract: "$.delta.text" }],
        reasoning: [{ when: "$.type == 'content_block_delta' && $.delta.type == 'thinking_delta'", extract: "$.delta.thinking" }],
        usage: [{ when: "$.type == 'message_delta'", extract: "$.usage" }, { when: "$.type == 'message_start'", extract: "$.message.usage" }],
        error: [{ when: "$.type == 'error'", extract: "$.error.message" }],
      },
    },
    response: { text: "$.content[*].text", usage: "$.usage", error: "$.error.message" },
    capabilities: ["streaming", "reasoning", "vision", "pdf", "tools"],
    thinking: { allowed: ["off", "low", "medium", "high", "custom"] },
  },
  "gemini-generate-content": {
    schema: 1,
    id: "gemini-generate-content",
    endpoint: { chat: "/v1beta/models/{model}:streamGenerateContent", method: "POST", query: { alt: "sse" } },
    auth: { type: "query", name: "key" },
    request: {
      messageFormat: "gemini",
      body: { system_instruction: "{{system.gemini}}", contents: "{{messages.gemini}}", tools: "{{tools.gemini}}", generationConfig: "{{thinking.gemini}}" },
    },
    stream: {
      format: "sse",
      events: {
        text: [{ when: "$.candidates[0].content.parts[0].thought != true", extract: "$.candidates[0].content.parts[*].text" }],
        reasoning: [{ when: "$.candidates[0].content.parts[0].thought == true", extract: "$.candidates[0].content.parts[*].text" }],
        toolCall: [{ extract: "$.candidates[0].content.parts[*].functionCall" }],
        usage: [{ extract: "$.usageMetadata" }],
        error: [{ extract: "$.error.message" }],
      },
    },
    response: { text: "$.candidates[0].content.parts[*].text", usage: "$.usageMetadata", error: "$.error.message" },
    capabilities: ["streaming", "reasoning", "vision", "pdf", "tools"],
    thinking: { allowed: ["off", "minimal", "low", "medium", "high", "custom"] },
  },
  "ollama-chat": {
    schema: 1,
    id: "ollama-chat",
    extends: "openai-compatible",
    endpoint: { chat: "/api/chat", method: "POST" },
    auth: { type: "none" },
    request: { messageFormat: "openai", body: { model: "{{model}}", stream: true, messages: "{{messages.openai}}", tools: "{{tools.openai}}", think: "{{thinking.enabled}}" } },
    stream: { format: "ndjson", doneWhen: "$.done == true", events: { text: [{ extract: "$.message.content" }], reasoning: [{ extract: "$.message.thinking" }], toolCall: [{ extract: "$.message.tool_calls[*]" }], usage: [{ extract: "$.prompt_eval_count" }], error: [{ extract: "$.error" }] } },
    response: { text: "$.message.content", error: "$.error" },
    capabilities: ["streaming", "reasoning", "vision", "tools"],
    thinking: { allowed: ["off", "low", "medium", "high"] },
  },
  "azure-openai": {
    schema: 1,
    id: "azure-openai",
    extends: "openai-compatible",
    endpoint: { chat: "/openai/deployments/{model}/chat/completions", method: "POST", query: { "api-version": "2024-02-01" } },
    auth: { type: "header", name: "api-key" },
    capabilities: ["streaming", "reasoning", "vision", "tools"],
    thinking: { allowed: ["off", "minimal", "low", "medium", "high", "xhigh", "custom"] },
  },
  "legacy-completions": {
    schema: 1,
    id: "legacy-completions",
    endpoint: { chat: "/v1/completions", method: "POST" },
    auth: { type: "bearer" },
    request: {
      messageFormat: "prompt",
      promptTemplate: { system: "{content}\n\n", user: "\n\nHuman: {content}", assistant: "\n\nAssistant: {content}", suffix: "\n\nAssistant:" },
      body: { model: "{{model}}", stream: true, prompt: "{{prompt}}" },
    },
    stream: { format: "sse", doneWhen: "[DONE]", events: { text: [{ extract: "$.choices[0].text" }], error: [{ extract: "$.error.message" }] } },
    response: { text: "$.choices[0].text", error: "$.error.message" },
    capabilities: ["streaming"],
    thinking: { allowed: ["off"] },
  },
};

export const adapterBaseForProviderKind = (kind: ProviderKind): AdapterBase => kind === "anthropic" ? "anthropic-messages" : kind === "google" ? "gemini-generate-content" : "openai-compatible";

export function adapterPreset(base: AdapterBase): AdapterConfig {
  return clone(ADAPTER_PRESETS[base]);
}

const merge = <T,>(base: T, override: unknown): T => {
  if (!isObject(base) || !isObject(override)) return clone((override === undefined ? base : override) as T);
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) result[key] = isObject(value) && isObject(result[key]) ? merge(result[key], value) : clone(value);
  return result as T;
};

/** Returns a safe normalized adapter, or throws a user-facing error explaining the invalid field. */
export function validateAdapterConfig(value: unknown): AdapterConfig {
  if (!isObject(value)) throw new Error("Adapter JSON must be an object.");
  if (value.schema !== 1) throw new Error("Adapter schema must be 1.");
  const base = text(value.extends, 80) as AdapterBase;
  if (base && !supportedBases.includes(base)) throw new Error(`Unknown adapter base: ${base}.`);
  const endpointRaw = isObject(value.endpoint) ? value.endpoint : undefined;
  const chat = text(endpointRaw?.chat, 500);
  if (chat && (!chat.startsWith("/") || chat.includes("://") || chat.includes("\\\\"))) throw new Error("endpoint.chat must be a relative path starting with '/'.");
  const models = text(endpointRaw?.models, 500);
  if (models && (!models.startsWith("/") || models.includes("://") || models.includes("\\\\"))) throw new Error("endpoint.models must be a relative path starting with '/'.");
  const method = endpointRaw?.method === "GET" ? "GET" : "POST";
  const authRaw = isObject(value.auth) ? value.auth : undefined;
  const authType = text(authRaw?.type, 30) || undefined;
  if (authType && !["bearer", "header", "query", "none"].includes(authType)) throw new Error("auth.type must be bearer, header, query, or none.");
  const auth = authType ? { type: authType as NonNullable<AdapterConfig["auth"]>["type"], ...(text(authRaw?.name, 100) ? { name: text(authRaw?.name, 100) } : {}), ...(text(authRaw?.prefix, 100) ? { prefix: text(authRaw?.prefix, 100) } : {}) } : undefined;
  const headers = stringRecord(value.extraHeaders);
  for (const name of Object.keys(headers ?? {})) if (/^(authorization|x-api-key|api-key|cookie)$/i.test(name)) throw new Error("Put API-key authentication in auth, not extraHeaders.");
  const requestRaw = isObject(value.request) ? value.request : undefined;
  const messageFormat = text(requestRaw?.messageFormat, 50) as AdapterMessageFormat;
  if (messageFormat && !supportedMessageFormats.includes(messageFormat)) throw new Error("request.messageFormat must be openai, anthropic, gemini, or prompt.");
  const body = isObject(requestRaw?.body) ? clone(requestRaw!.body) : undefined;
  const promptRaw = isObject(requestRaw?.promptTemplate) ? requestRaw.promptTemplate : undefined;
  const promptTemplate = promptRaw ? Object.fromEntries(["system", "user", "assistant", "suffix"].flatMap((key) => text(promptRaw[key], 4000) ? [[key, text(promptRaw[key], 4000)]] : [])) : undefined;
  const streamRaw = isObject(value.stream) ? value.stream : undefined;
  const format = text(streamRaw?.format, 30) as AdapterStreamFormat;
  if (format && !supportedFormats.includes(format)) throw new Error("stream.format must be sse, ndjson, json-array, or text.");
  const eventsRaw = isObject(streamRaw?.events) ? streamRaw.events : undefined;
  const stream = streamRaw ? {
    ...(format ? { format } : {}),
    ...(text(streamRaw.doneWhen, 360) ? { doneWhen: text(streamRaw.doneWhen, 360) } : {}),
    ...(eventsRaw ? { events: Object.fromEntries(["text", "reasoning", "toolCall", "usage", "error"].flatMap((key) => {
      const mappings = eventMappings(eventsRaw[key]);
      return mappings ? [[key, mappings]] : [];
    })) as NonNullable<AdapterConfig["stream"]>["events"] } : {}),
  } : undefined;
  const responseRaw = isObject(value.response) ? value.response : undefined;
  const response = responseRaw ? Object.fromEntries(["text", "reasoning", "usage", "error"].flatMap((key) => {
    const path = text(responseRaw[key], 360);
    return path.startsWith("$") ? [[key, path]] : [];
  })) as AdapterConfig["response"] : undefined;
  const capabilities = normaliseCapabilities(value.capabilities);
  const thinkingRaw = isObject(value.thinking) ? value.thinking : undefined;
  const allowed = normaliseLevels(thinkingRaw?.allowed);
  return {
    schema: 1,
    ...(text(value.id, 100) ? { id: text(value.id, 100) } : {}),
    ...(base ? { extends: base } : {}),
    ...(endpointRaw ? { endpoint: { ...(chat ? { chat } : {}), ...(models ? { models } : {}), method, ...(stringRecord(endpointRaw.query, 240) ? { query: stringRecord(endpointRaw.query, 240) } : {}) } } : {}),
    ...(auth ? { auth } : {}),
    ...(headers ? { extraHeaders: headers } : {}),
    ...(requestRaw ? { request: { ...(messageFormat ? { messageFormat } : {}), ...(body ? { body } : {}), ...(promptTemplate && Object.keys(promptTemplate).length ? { promptTemplate } : {}) } } : {}),
    ...(stream ? { stream } : {}),
    ...(response && Object.keys(response).length ? { response } : {}),
    ...(capabilities.length ? { capabilities } : {}),
    ...(allowed.length ? { thinking: { allowed } } : {}),
  };
}

/** Invalid saved configurations are ignored rather than breaking an existing chat. */
export function normalizeAdapterConfig(value: unknown): AdapterConfig | undefined {
  try { return validateAdapterConfig(value); } catch { return undefined; }
}

/** Materializes `extends` while retaining the small, shareable source config in storage. */
export function materializeAdapter(config: AdapterConfig): AdapterConfig {
  const validated = validateAdapterConfig(config);
  return validated.extends ? merge(adapterPreset(validated.extends), { ...validated, extends: undefined }) : validated;
}

export function configuredAdapter(provider: ProviderSettings, model: string): AdapterConfig | undefined {
  return normalizeAdapterConfig(provider.modelAdapters?.[model]) ?? normalizeAdapterConfig(provider.adapter);
}

type JsonValue = string | number | boolean | null | Record<string, unknown> | JsonValue[];

/** A deliberately small JSONPath reader: $, .property, [0] and [*]. */
export function readAdapterPath(value: unknown, path: string): unknown[] {
  if (!path.startsWith("$")) return [];
  const tokens = path.slice(1).match(/(?:\.([A-Za-z0-9_-]+)|\[([0-9*]+)\])/g) ?? [];
  let values: unknown[] = [value];
  for (const token of tokens) {
    const property = /^\.([A-Za-z0-9_-]+)$/.exec(token)?.[1];
    const index = /^\[([0-9*]+)\]$/.exec(token)?.[1];
    values = values.flatMap((current) => {
      if (property) return isObject(current) && property in current ? [current[property]] : [];
      if (index === "*") return Array.isArray(current) ? current : [];
      const numeric = Number(index);
      return Array.isArray(current) && Number.isInteger(numeric) && numeric in current ? [current[numeric]] : [];
    });
  }
  return values;
}

const parseLiteral = (value: string): unknown => {
  const source = value.trim();
  if (source === "true") return true;
  if (source === "false") return false;
  if (source === "null") return null;
  if ((source.startsWith("'") && source.endsWith("'")) || (source.startsWith('"') && source.endsWith('"'))) return source.slice(1, -1);
  const numeric = Number(source);
  return Number.isFinite(numeric) && source !== "" ? numeric : source;
};

export function adapterWhenMatches(value: unknown, condition?: string): boolean {
  if (!condition?.trim()) return true;
  return condition.split("&&").every((part) => {
    const match = /^\s*(\$[A-Za-z0-9_.\[\]*-]*)\s*(==|!=)\s*(.*?)\s*$/.exec(part);
    if (!match) return false;
    const [ , path, operator, literal ] = match;
    const target = parseLiteral(literal);
    const matches = readAdapterPath(value, path).some((item) => item === target);
    return operator === "==" ? matches : !matches;
  });
}

const textFromValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textFromValue).filter(Boolean).join("");
  if (isObject(value)) return [value.text, value.content, value.message].map(textFromValue).filter(Boolean).join("");
  return "";
};

export type ParsedAdapterEvent = { text: string; reasoning: string; toolCalls: unknown[]; usage?: unknown; error: string; recognized: boolean };

/** Maps one parsed JSON item into MossChat's neutral text/reasoning/usage event shape. */
export function mapAdapterEvent(adapter: AdapterConfig, value: unknown): ParsedAdapterEvent {
  const config = materializeAdapter(adapter);
  const events = config.stream?.events ?? {};
  const extract = (mappings: AdapterEventMapping[] | undefined, stringify = true) => (mappings ?? []).flatMap((mapping) => adapterWhenMatches(value, mapping.when) ? readAdapterPath(value, mapping.extract) : []).map((item) => stringify ? textFromValue(item) : item).filter((item) => typeof item === "string" ? Boolean(item) : item !== undefined);
  const textParts = extract(events.text) as string[];
  const reasoningParts = extract(events.reasoning) as string[];
  const toolCalls = extract(events.toolCall, false);
  const errors = extract(events.error) as string[];
  const usages = extract(events.usage, false);
  const recognized = Boolean(textParts.length || reasoningParts.length || toolCalls.length || errors.length || usages.length);
  return { text: textParts.join(""), reasoning: reasoningParts.join(""), toolCalls, ...(usages[0] === undefined ? {} : { usage: usages[0] }), error: errors.join("\n"), recognized };
}

export type AdapterFixtureReport = {
  textDeltas: number;
  reasoningDeltas: number;
  toolCalls: number;
  usageEvents: number;
  errorEvents: number;
  unrecognized: string[];
  parseError?: string;
};

/** Small client-side test bench for a recorded SSE/NDJSON/JSON array response. */
export function parseAdapterFixture(adapter: AdapterConfig, raw: string): AdapterFixtureReport {
  const config = materializeAdapter(adapter);
  const report: AdapterFixtureReport = { textDeltas: 0, reasoningDeltas: 0, toolCalls: 0, usageEvents: 0, errorEvents: 0, unrecognized: [] };
  if (config.stream?.format === "text") return raw ? { ...report, textDeltas: 1 } : report;
  const source = config.stream?.format === "sse"
    ? raw.split(/\r?\n/).flatMap((line) => line.startsWith("data:") ? [line.slice(5).trim()] : [])
    : config.stream?.format === "ndjson" ? raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : (() => { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map((item) => JSON.stringify(item)) : [raw]; } catch { return [raw]; } })();
  for (const line of source) {
    if (!line || line === "[DONE]") continue;
    try {
      const event = mapAdapterEvent(config, JSON.parse(line) as JsonValue);
      if (event.text) report.textDeltas += 1;
      if (event.reasoning) report.reasoningDeltas += 1;
      if (event.toolCalls.length) report.toolCalls += event.toolCalls.length;
      if (event.usage !== undefined) report.usageEvents += 1;
      if (event.error) report.errorEvents += 1;
      if (!event.recognized && report.unrecognized.length < 3) report.unrecognized.push(line.slice(0, 500));
    } catch {
      if (report.unrecognized.length < 3) report.unrecognized.push(line.slice(0, 500));
    }
  }
  return report;
}

export function adapterGenerationPrompt(base: AdapterBase, providerName: string, model?: string) {
  return `# Task: generate a MossChat request adapter\n\nTarget: ${providerName}${model ? ` / ${model}` : ""}\nBase: ${base}\n\nBefore writing JSON, ask for the official API documentation and one real raw streaming response. Do not guess undocumented stream fields.\n\nReturn one data-only JSON object. Never include JavaScript, an absolute URL, API key, Authorization header, or Cookie. Endpoint paths must be relative to the configured Base URL. Use \"extends\": \"${base}\" and override only what differs.\n\nSupported stream formats: sse, ndjson (Ollama uses done: true), json-array, text. Map text/reasoning/toolCall/usage/error with JSON paths. The UI accepts only $, .property, [0], and [*]. toolCall must extract a complete call object, not a partial argument delta.\n\nTemplate values allowed in request.body: {{model}}, {{stream}}, {{system}}, {{system.gemini}}, {{messages.openai}}, {{messages.anthropic}}, {{messages.gemini}}, {{tools.openai}}, {{tools.anthropic}}, {{tools.gemini}}, {{prompt}}, {{thinking.effort}}, {{thinking.anthropic}}, {{thinking.gemini}}, {{maxTokens}}.\n\nInclude capabilities (streaming, reasoning, vision, pdf, tools) and thinking.allowed. Then validate the mapping line by line against the supplied real stream and list unmapped lines.\n\n===ADAPTER_START===\n${JSON.stringify(adapterPreset(base), null, 2)}\n===ADAPTER_END===`;
}
