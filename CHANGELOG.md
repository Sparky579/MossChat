# Changelog

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
