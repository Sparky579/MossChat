<div align="center">

<img src="src/app/icon.svg" width="72" height="72" alt="MossChat icon">

# MossChat

Browser based chat client for your own model API keys. Keys, chats, files, and settings stay in the browser.

<p>
  <a href="https://chat.utilgadgets.com">Try it now</a>
  · <a href="#getting-started">Docs</a>
  · <a href="CHANGELOG.md">Changelog</a>
</p>

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-198754.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.1-198754.svg)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-15-111111.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)

</div>

## Why

Most self hosted chat clients require a server, a database, and a place to keep API keys. Many polished clients are closed source.

MossChat keeps the client side simple. Open the app, add a provider key, and start a conversation. Requests go from the browser directly to the provider you selected.

There is no MossChat account service, API proxy, or server side key store.

## Features

| Area | What it does |
| --- | --- |
| Providers | Google Gemini, Anthropic, OpenRouter, OpenAI, and OpenAI compatible endpoints with a custom base URL |
| Messages | Streaming responses, stop, regenerate, edit, branch, pin, full text search, and conversation system prompts |
| Rendering | Markdown, syntax highlighted code, tables, and KaTeX math with streaming friendly layout |
| Thinking | Collapsible reasoning output with provider preset or token budget controls |
| Files | Drag files in, select them, or paste images from the clipboard. Images and PDFs can go directly to supported providers |
| Notebooks | Group conversations, rename notebooks, and set a notebook system prompt inherited by its chats |
| Local data | Per message IndexedDB storage, persistent storage request, ZIP backup, automatic folder backup, and legacy JSON import |
| Optional sync | Encrypted WebDAV sync with per-record files, device-side merge, and setup guidance for Caddy |
| Interface | English by default, Simplified Chinese option, voice input, responsive layout, and browser local settings |

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

Custom function calling returns a model requested function payload to the conversation. MossChat does not execute arbitrary code or access local system tools.

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
