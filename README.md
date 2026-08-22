<div align="center">

<img src="src/app/icon.svg" width="72" height="72" alt="MossChat icon">

# MossChat

Browser based chat client for your own model API keys. Keys, chats, files, and settings stay in the browser.

<p>
  <a href="https://mosschat.xyz">Try it now</a>
  · <a href="#getting-started">Docs</a>
  · <a href="CHANGELOG.md">Changelog</a>
</p>

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-198754.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.11-198754.svg)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-111111.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)

</div>

## Why

Most self hosted chat clients require a server, a database, and a place to keep API keys. Many polished clients are closed source.

MossChat keeps the client side simple. Open the app, add a provider key, and start a conversation. Requests go from the browser directly to the provider you selected.

There is no MossChat account service, API proxy, or server side key store.

## Features

| Area | What it does |
| --- | --- |
| Providers | Google Gemini, Anthropic, OpenRouter, OpenAI, OpenAI-compatible endpoints, and safe declarative adapters for custom gateways |
| Messages | Streaming responses, stop, regenerate, edit, branch, pin, full text search, and conversation system prompts |
| Rendering | Markdown, syntax highlighted code, tables, and KaTeX math with streaming friendly layout |
| Thinking | Collapsible reasoning output with provider preset or token budget controls |
| Files | Drag files in, select them, or paste images from the clipboard. Images and PDFs can go directly to supported providers; plain text and DOCX are extracted locally for every provider |
| Notebooks | Group conversations, rename notebooks, and set a notebook system prompt inherited by its chats |
| Local data | Per message IndexedDB storage, persistent storage request, ZIP backup, automatic folder backup, and legacy JSON import |
| Optional sync | Encrypted WebDAV sync with per-record files, logical-clock conflict handling, background updates, image compression, and Caddy setup guidance |
| Interface | English by default, Simplified Chinese option, voice input, responsive layout, browser local settings, and a PWA that can be added to the desktop |

## Getting started

To run your own copy, use a current Node.js release.

```bash
git clone git@github.com:Sparky579/MossChat.git
cd MossChat
npm ci
npm run build
npm run start
```

Open `http://localhost:3000`, then add a provider under **Settings → API & models**. The production app is served by Next.js, so keep the Node process running behind your preferred reverse proxy or process manager.

### Provider JSON examples

In **Settings → API & models → Add by JSON**, use the OpenAI, Anthropic, or Gemini sample buttons to fill the same portable provider shape. Replace only `apiKey` and the model IDs you can access; no key is included in these examples.

```json
[
  {
    "name": "OpenAI",
    "emoji": "✨",
    "kind": "openai",
    "apiKey": "",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-5.6-sol",
    "models": ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.3-codex-spark"]
  },
  {
    "name": "Anthropic",
    "emoji": "🧠",
    "kind": "anthropic",
    "apiKey": "",
    "baseUrl": "https://api.anthropic.com",
    "model": "claude-sonnet-4-20250514",
    "models": ["claude-sonnet-4-20250514"]
  },
  {
    "name": "Google Gemini",
    "emoji": "✨",
    "kind": "google",
    "apiKey": "",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "model": "gemini-3.7-flash",
    "models": ["gemini-3.7-flash", "gemini-3.1-flash-image", "gemini-3-pro-image"]
  }
]
```

For a native Gemini provider, the Base URL is the API origin only: do not append `/models`, a model name, or a MossChat page URL. MossChat adds the required `/v1beta/models/{model}:generateContent` route itself. This is required for Gemini preview models and streamed GenerateContent requests.

## Data and privacy

API keys and preferences are stored in `localStorage`. Chats, messages, notebooks, and attachments are stored in IndexedDB. The app has no API route that receives your conversation data or provider keys.

Each message is saved separately. Streaming assistant output is written incrementally, so a tab close or network failure does not require waiting for the full response to finish before anything is stored.

ZIP backups can include chat history, settings and API keys, and attachment binaries independently. Treat any backup that includes keys as sensitive.

## Non goals

These boundaries keep the security model and maintenance scope clear.

| Not included | Reason |
| --- | --- |
| Server side API key storage | Provider keys are intended to remain in the browser |
| Billing, credits, or top ups | MossChat is a client, not a model reseller |
| Multi user accounts and roles | The project has no authentication service |
| Hosted vector search or server RAG | This requires a server, indexing pipeline, and separate data security model |
| Autonomous multi step agents | Tool execution needs a wider permission and safety model than this client provides |

For those workflows, projects such as Open WebUI and LibreChat are a better fit.

## Known limitations

Browser storage is controlled by the browser. Persistent storage can be requested in Settings, but it is not guaranteed everywhere. Export a backup regularly, especially when storing large files.

Large attachments count against the browser storage quota. Browsers can remove site data when users clear it or when storage pressure is high.

Provider requests are made from the browser. A custom endpoint must allow browser CORS requests. Some providers also restrict which reasoning preset values their models accept.

### CORS for self-hosted providers

MossChat calls provider endpoints directly from the browser; it does not proxy API requests through the MossChat server. When exposing a local gateway or OpenAI-compatible service to the web, configure its CORS allowlist for the MossChat origin (for example `https://mosschat.xyz`) and ensure `OPTIONS` preflight requests return `204` or `200` with at least:

- `Access-Control-Allow-Origin: https://mosschat.xyz` (or your own MossChat deployment origin)
- `Access-Control-Allow-Methods` including `POST` and `OPTIONS`
- `Access-Control-Allow-Headers` explicitly including `Authorization` and `Content-Type`

Do not rely only on `Access-Control-Allow-Headers: *`: browsers treat `Authorization` as a non-wildcard request header, so the preflight can still fail. Keep the allowlist limited to the sites that should be able to use the gateway.

Custom function calling returns a model requested function payload to the conversation. MossChat does not execute arbitrary code or access local system tools.

### Official feedback archive

The official MossChat site posts feedback to `https://feedback.mosschat.xyz/feedback`. That receiver writes every accepted submission to the MossChat host before it relays the optional email notification, so a Resend outage cannot lose feedback. Records are private JSON files in `/home/chengsizhe/.local/share/mosschat-feedback/submissions/`, one file per submission with mode `0600`.

The receiver only accepts browser requests from `https://mosschat.xyz` and `https://www.mosschat.xyz`; `GET /health` is available for an uptime check. Deploy `deploy/mosschat-feedback.service` and `deploy/mosschat-feedback-tunnel.service` after creating the `mosschat-feedback` Cloudflare Tunnel with an ingress route for `feedback.mosschat.xyz`.

### Advanced request adapters

Most custom gateways differ only in their request path, authentication, thinking fields, or stream shape. MossChat can adapt those differences with **data-only JSON**, without adding a server proxy or executing code from an imported configuration.

Open **Settings → API & models**. Each model’s **Model capabilities & thinking** panel controls the normal things in the UI: the default and available thinking levels, plus Streaming, Reasoning, Images, Image generation, PDF, and Tools support. The **Advanced request adapter** button is for the uncommon wire-format details. A provider-level adapter is the default for all of its models; a model adapter overrides it; without either, MossChat continues using its built-in OpenAI, Claude, or Gemini implementation.

The included presets cover current OpenAI Chat Completions, Anthropic Messages, Gemini GenerateContent, Ollama `/api/chat`, Azure OpenAI deployments, and legacy text completions. The adapter test panel accepts a copied real SSE, NDJSON, JSON-array, or JSON response and shows how many text, reasoning, usage, error, and unrecognized records the mapping produced. Use **Copy generation prompt** if you want an AI coding tool to help make an adapter: it deliberately asks for both official API docs and a real stream sample.

Ready-to-import adapters, legacy compatibility examples, recorded fixtures, and current-model references live in the separate [MossChat Adapter Catalog](https://github.com/Sparky579/MossChat-Adapter). The catalog is tested against MossChat's schema and stream parser before publication.

Here is the small shape used by an adapter:

```json
{
  "schema": 1,
  "extends": "openai-compatible",
  "endpoint": {
    "chat": "/openai/deployments/{model}/chat/completions",
    "query": { "api-version": "2024-02-01" }
  },
  "auth": { "type": "header", "name": "api-key" },
  "request": {
    "messageFormat": "openai",
    "body": {
      "model": "{{model}}",
      "stream": true,
      "messages": "{{messages.openai}}",
      "reasoning_effort": "{{thinking.effort}}"
    }
  },
  "stream": {
    "format": "sse",
    "doneWhen": "[DONE]",
    "events": {
      "text": [{ "extract": "$.choices[0].delta.content" }],
      "reasoning": [{ "extract": "$.choices[0].delta.reasoning_content" }],
      "usage": [{ "extract": "$.usage" }]
    }
  },
  "capabilities": ["streaming", "reasoning", "vision", "tools"],
  "thinking": { "allowed": ["off", "minimal", "low", "medium", "high"] }
}
```

`extends` avoids repeating a whole common protocol. Endpoints must be relative to the provider’s Base URL, so imported JSON cannot redirect a request and its key to another site. Authentication is injected by MossChat from the provider key; adapter templates never receive that key. Supported stream formats are `sse`, `ndjson` (including Ollama’s `done: true`), `json-array`, and `text`. Non-streaming responses use the separate `response` mapping. The JSON-path subset is intentionally small and predictable: `$`, `.property`, `[0]`, `[*]`, and a safe array-item filter such as `[?(@.thought == true)]`. The built-in Gemini request enables `thinkingConfig.includeThoughts`, so thought parts are rendered separately from answer text.

Do not add executable JavaScript to an adapter. MossChat intentionally does not offer JS hooks or run imported code: a shared adapter must not be able to read `localStorage` or API keys. An adapter can still see the messages and responses for the provider you configured, so only import it from a source you trust. The vendor formats behind the presets are documented by [OpenAI](https://platform.openai.com/docs/api-reference/responses-streaming), [Claude](https://platform.claude.com/docs/en/build-with-claude/streaming), [Gemini](https://ai.google.dev/api/generate-content), and [Ollama](https://docs.ollama.com/api/chat).

## FAQ

### Where is my API key stored?

In browser local storage on the device running MossChat. It is sent directly to the model provider selected for the request.

### Can I use a custom endpoint, proxy, or self hosted gateway?

Yes. Add a provider with an OpenAI compatible base URL in **Settings → API & models**.

### Can I keep separate instructions for a project?

Yes. The Prompts button in the upper right saves a system prompt for the current conversation or Notebook. Notebook chats inherit the Notebook prompt unless the chat has its own prompt.

### Is my data safe from browser storage cleanup?

MossChat never receives the data, but browser storage is not a backup. Use ZIP export or configure an automatic backup folder from Settings.

## Contributing

Bug reports, fixes, tests, and translations are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting a larger change.

## License

MossChat is released under the [GNU Affero General Public License v3.0](LICENSE).

## Thanks

Special thanks to [Linux.do](https://linux.do/).
