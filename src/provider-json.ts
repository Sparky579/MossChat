import type { ProviderKind, ProviderSettings } from "./types";

type ProviderJsonSource = Record<string, unknown>;

const isObject = (value: unknown): value is ProviderJsonSource => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isProviderKind = (value: string): value is ProviderKind => value === "openai" || value === "anthropic" || value === "google";

/** Parses the portable provider format used by Settings' JSON import/export controls. */
export function parseProviderJson(value: string): ProviderSettings[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("JSON 格式不正确。"); }
  const candidates = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.providers)
      ? parsed.providers
      : isObject(parsed) && isObject(parsed.providers)
        ? Object.values(parsed.providers)
        : [parsed];
  if (!candidates.length) throw new Error("至少需要一个渠道商配置。");
  if (candidates.length > 30) throw new Error("一次最多导入 30 个渠道商。");
  return candidates.map((candidate, index) => {
    if (!isObject(candidate)) throw new Error(`第 ${index + 1} 个渠道商必须是 JSON 对象。`);
    const text = (keys: string[], label: string, required = false) => {
      const field = keys.map((key) => candidate[key]).find((item) => item !== undefined);
      if (field === undefined && !required) return "";
      if (typeof field !== "string") throw new Error(`第 ${index + 1} 个渠道商的 ${label} 必须是文本。`);
      const trimmed = field.trim();
      if (required && !trimmed) throw new Error(`第 ${index + 1} 个渠道商缺少 ${label}。`);
      return trimmed;
    };
    const name = text(["name", "providerName"], "name", true).slice(0, 120);
    const kind = text(["kind", "protocol"], "kind", true);
    if (!isProviderKind(kind)) throw new Error(`第 ${index + 1} 个渠道商的 kind 必须是 openai、anthropic 或 google。`);
    const baseUrl = text(["baseUrl", "endpoint"], "baseUrl", true);
    const apiKey = text(["apiKey", "key"], "apiKey");
    const emoji = text(["emoji"], "emoji").slice(0, 16) || "🤖";
    const model = text(["model"], "model");
    const sourceModels = candidate.models;
    if (sourceModels !== undefined && (!Array.isArray(sourceModels) || sourceModels.some((item) => typeof item !== "string"))) throw new Error(`第 ${index + 1} 个渠道商的 models 必须是文本数组。`);
    const models = [...new Set([...(sourceModels ?? []), model].map((item) => String(item).trim()).filter(Boolean))];
    if (!models.length) throw new Error(`第 ${index + 1} 个渠道商至少需要一个 model 或 models。`);
    return { name, kind, apiKey, baseUrl, model: model && models.includes(model) ? model : models[0], models, emoji };
  });
}

/** Serializes one or more providers without their local ids, so imports never overwrite a provider. */
export function serializeProviderJson(providers: readonly ProviderSettings[]) {
  return JSON.stringify({ version: 1, providers }, null, 2);
}
