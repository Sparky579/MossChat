export type ProviderId = string;

export type ProviderKind = "openai" | "anthropic" | "google";

/** A provider-native reasoning effort (for example `xhigh`) or the local `custom` budget mode. */
export type ThinkingLevel = string;

export const DEFAULT_THINKING_LEVELS: ThinkingLevel[] = ["off", "low", "medium", "high", "custom"];

/** Features a model endpoint accepts. They are descriptive for built-ins and usable in custom adapter bodies. */
export type ProviderCapability = "streaming" | "reasoning" | "vision" | "pdf" | "tools" | "image-generation";

/** Every capability that can be described in provider/model settings or adapters. */
export const PROVIDER_CAPABILITIES: ProviderCapability[] = ["streaming", "reasoning", "vision", "pdf", "tools", "image-generation"];

/** Conservative defaults for ordinary chat models. Image generation is opt-in per model. */
export const DEFAULT_PROVIDER_CAPABILITIES: ProviderCapability[] = ["streaming", "reasoning", "vision", "pdf", "tools"];

export type AdapterBase = "openai-compatible" | "anthropic-messages" | "gemini-generate-content" | "ollama-chat" | "azure-openai" | "legacy-completions";
export type AdapterStreamFormat = "sse" | "ndjson" | "json-array" | "text";
export type AdapterMessageFormat = "openai" | "anthropic" | "gemini" | "prompt";

/**
 * Declarative, data-only request adapter. Values in `request.body`, headers and
 * query support safe {{placeholders}}; executable JavaScript is deliberately
 * not supported.
 */
export type AdapterConfig = {
  schema: 1;
  id?: string;
  extends?: AdapterBase;
  endpoint?: {
    chat?: string;
    models?: string;
    method?: "POST" | "GET";
    query?: Record<string, string>;
  };
  auth?: {
    type: "bearer" | "header" | "query" | "none";
    name?: string;
    prefix?: string;
  };
  extraHeaders?: Record<string, string>;
  request?: {
    messageFormat?: AdapterMessageFormat;
    body?: Record<string, unknown>;
    promptTemplate?: {
      system?: string;
      user?: string;
      assistant?: string;
      suffix?: string;
    };
  };
  stream?: {
    format?: AdapterStreamFormat;
    /** A simple JSON-path condition such as `$.done == true`, or `[DONE]`. */
    doneWhen?: string;
    events?: {
      text?: AdapterEventMapping[];
      reasoning?: AdapterEventMapping[];
      /** Extract a complete tool-call object when the provider streams one in a single record. */
      toolCall?: AdapterEventMapping[];
      usage?: AdapterEventMapping[];
      error?: AdapterEventMapping[];
    };
  };
  /** Mapping used when an endpoint returns one JSON document instead of a stream. */
  response?: {
    text?: string;
    reasoning?: string;
    usage?: string;
    error?: string;
  };
  capabilities?: ProviderCapability[];
  thinking?: {
    allowed?: ThinkingLevel[];
  };
};

export type AdapterEventMapping = {
  /** Optional simple predicate, for example `$.type == 'content_block_delta'`. */
  when?: string;
  extract: string;
};

/** A model is scoped to its provider so identical model names do not share preferences. */
export type ModelDisplayItem = {
  providerId: ProviderId;
  model: string;
};

export type ModelThinkingSettings = {
  defaultThinkingLevel: ThinkingLevel;
  availableThinkingLevels: ThinkingLevel[];
  /** Kept on the model rather than a provider because capability support is model-specific. */
  capabilities?: ProviderCapability[];
};

export const modelSettingsKey = (providerId: ProviderId, model: string) => JSON.stringify([providerId, model]);

export type ProviderSettings = {
  name: string;
  kind: ProviderKind;
  apiKey: string;
  baseUrl: string;
  model: string;
  models: string[];
  /** Display emoji for this provider in model selectors. */
  emoji: string;
  /** Optional entry-wide override. A model override below takes precedence. */
  adapter?: AdapterConfig;
  /** Optional overrides keyed by exact model id. */
  modelAdapters?: Record<string, AdapterConfig>;
};

export type PromptPreset = {
  id: string;
  title: string;
  content: string;
};

export type AppSettings = {
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderSettings>;
  providerOrder: ProviderId[];
  systemPrompt: string;
  promptPresets: PromptPreset[];
  namingModel: string;
  namingProvider: ProviderId;
  language: "en" | "zh";
  theme: "light" | "dark" | "system";
  sendWithEnter: boolean;
  thinkingLevel: ThinkingLevel;
  thinkingBudget: number;
  /** Ordered models shown before the fixed Others section; capped at ten entries. */
  modelDisplayOrder: ModelDisplayItem[];
  /** Per-provider-model reasoning defaults and the levels shown in the thinking menu. */
  modelThinking: Record<string, ModelThinkingSettings>;
  nativeTools: {
    functionDeclarations: string;
  };
  /** Provider IDs explicitly deleted by the user; excluded from every synced device. */
  deletedProviderIds: string[];
};

export type SavedPart = Record<string, unknown>;

export type SavedAttachment = {
  id: string;
  type: string;
  name: string;
  contentType?: string;
  content: SavedPart[];
  status?: Record<string, unknown>;
};

export type SavedMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: SavedPart[];
  attachments?: SavedAttachment[];
  createdAt: string;
  status?: Record<string, unknown>;
};

export type Chat = {
  id: string;
  title: string;
  messages: SavedMessage[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  notebookId?: string;
  /** Undefined means inherit from the Notebook or global default. */
  systemPrompt?: string;
};

export type NotebookAttachment = {
  id: string;
  name: string;
  type: string;
  data: string;
  text?: string;
};

export type NotebookPromptMode = "stack" | "replace";

export type Notebook = {
  id: string;
  title: string;
  content: string;
  attachments: NotebookAttachment[];
  /** Undefined means chats in this Notebook use the global default. */
  systemPrompt?: string;
  /** Existing notebooks without this field retain the legacy replacement behavior. */
  promptMode?: NotebookPromptMode;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  chats: Chat[];
  notebooks: Notebook[];
};
