export type ProviderId = string;

export type ProviderKind = "openai" | "anthropic" | "google";

/** A provider-native reasoning effort (for example `xhigh`) or the local `custom` budget mode. */
export type ThinkingLevel = string;

export type ProviderSettings = {
  name: string;
  kind: ProviderKind;
  apiKey: string;
  baseUrl: string;
  model: string;
  models: string[];
  /** Display emoji for this provider in model selectors. */
  emoji: string;
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
  nativeTools: {
    functionDeclarations: string;
  };
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
