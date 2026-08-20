# Changelog

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
