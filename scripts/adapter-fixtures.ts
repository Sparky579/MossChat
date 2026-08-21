import { adapterPreset, parseAdapterFixture, readAdapterPath } from "../src/adapter-config";

type Fixture = { name: string; preset: Parameters<typeof adapterPreset>[0]; raw: string; expected: { text: number; reasoning: number; usage: number } };

const fixtures: Fixture[] = [
  {
    name: "OpenAI Chat Completions SSE",
    preset: "openai-compatible",
    raw: "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"Checking\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\ndata: {\"usage\":{\"prompt_tokens\":4,\"completion_tokens\":2}}\n\ndata: [DONE]\n\n",
    expected: { text: 1, reasoning: 1, usage: 1 },
  },
  {
    name: "Anthropic Messages SSE",
    preset: "anthropic-messages",
    raw: "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"Plan\"}}\n\nevent: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Hello\"}}\n\nevent: message_delta\ndata: {\"type\":\"message_delta\",\"usage\":{\"input_tokens\":4,\"output_tokens\":2}}\n\n",
    expected: { text: 1, reasoning: 1, usage: 1 },
  },
  {
    name: "Gemini GenerateContent SSE",
    preset: "gemini-generate-content",
    raw: "data: {\"candidates\":[{\"content\":{\"parts\":[{\"thought\":true,\"text\":\"Plan\"}]}}]}\n\ndata: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hello\"}]}}],\"usageMetadata\":{\"promptTokenCount\":4,\"candidatesTokenCount\":2}}\n\n",
    expected: { text: 1, reasoning: 1, usage: 1 },
  },
  {
    name: "Ollama native NDJSON",
    preset: "ollama-chat",
    raw: "{\"model\":\"llama\",\"message\":{\"role\":\"assistant\",\"thinking\":\"Plan\"},\"done\":false}\n{\"model\":\"llama\",\"message\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"done\":true}\n",
    expected: { text: 1, reasoning: 1, usage: 0 },
  },
];

for (const fixture of fixtures) {
  const report = parseAdapterFixture(adapterPreset(fixture.preset), fixture.raw);
  if (report.textDeltas !== fixture.expected.text || report.reasoningDeltas !== fixture.expected.reasoning || report.usageEvents !== fixture.expected.usage || report.unrecognized.length) {
    throw new Error(`${fixture.name} failed: ${JSON.stringify(report)}`);
  }
  console.log(`✓ ${fixture.name}`);
}

const legacy = { choices: [{ text: "Hello from a non-streaming completion" }] };
if (readAdapterPath(legacy, "$.choices[0].text").join("") !== "Hello from a non-streaming completion") throw new Error("Legacy non-streaming completion mapping failed.");
console.log("✓ Legacy non-streaming completion JSON");
