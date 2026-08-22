# Changelog

## Unreleased

Refactored shared page utilities into focused content, provider JSON, and dismiss-on-outside modules. Plain text and DOCX attachments are now extracted locally before requests while retaining the original file. Provider JSON import/export, key-free backup imports, and message persistence have safer shared paths. The feedback Worker now enforces its payload limit while streaming. Updated the production stack to Next.js 16 and removed unused browser-test dependencies.

## 0.2.8

New installations now open on OpenAI with `gpt-5.6-sol` as the only main model-menu entry. `gpt-5.6-terra`, `gpt-5.3-codex-spark`, `gemini-3.7-flash`, and the remaining built-in models begin under Others. Provider JSON samples and the built-in Gemini default now use the updated model IDs. Existing saved provider and model-menu settings remain unchanged. Production builds explicitly use Webpack to avoid an incomplete Turbopack artifact on this host.

## 0.2.7

WebDAV now records a server ID in `meta.json`, remembers the last server locally, and asks before initializing an empty server, joining unrelated data, changing servers, or resolving same-ID conflicts. The review view compares local, server, and shared records and supports read-only preview plus merge choices. Sync setup now starts with a first-time or join-existing branch; a passphrase is set only during that initial setup and later changes require rebuilding sync. Existing setups can run a read-only validity check. Assistant feedback rows show Input and Output token counts. The composer now offers `/clear` with undo before the next message, and `/compact`, which creates a local compacted context and static acknowledgement without a model request.

## 0.2.6

Sync setup now has a bidirectional SYNC_CONFIG JSON editor. It starts as `{}`, accepts raw JSON or an optional marked block, and immediately mirrors endpoint, credentials, passphrase, and key-sync settings in either direction.

## 0.2.5

Saved providers are locked by default. Their endpoint and preset stay untouched until you choose Edit provider; new providers begin in edit mode.

## 0.2.4

The sync-server Agent task can now be read in the app before copying. It detects and prefers an existing Cloudflare Tunnel, uses Docker or Caddy when needed, and treats Tailscale as the final fallback. The Tailscale path explicitly tells the user that every syncing machine must join the same tailnet and satisfy its ACLs.

## 0.2.3

Notebook rows now have a three-dot menu for inline rename and delete. Copy controls confirm success, Settings keeps a stable height with a language selector in its header, and sync status is gray until configured. Configured clients show their last successful sync beside the Sync control and check remote changes every ten minutes. The incremental index contains compact metadata only, never duplicate chat or attachment data.

## 0.2.2

Background WebDAV sync now runs after local changes, on reconnect, and on a two-minute remote check. Manual **Sync now** uses the same merge path. Per-record Lamport clocks resolve concurrent edits deterministically, successful sync time is shown in the menu, and image replicas are compressed before encrypted upload without changing the local original.

## 0.2.1

PWA with an app manifest, offline shell cache, and add-to-desktop guidance for desktop and mobile browsers.

## 0.2.0

WebDAV sync with browser-side encryption, endpoint setup guidance, and a right-side sync control.

## 0.1.0

Initial public release of MossChat.

Includes browser local provider settings, direct provider requests, streaming chat, local conversation storage, notebooks, prompt presets, thinking controls, attachments, backups, and responsive UI.
