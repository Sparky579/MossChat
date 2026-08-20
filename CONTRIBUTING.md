# Contributing to MossChat

Thank you for taking the time to improve MossChat.

## Before you start

Open an issue before beginning a feature that changes data storage, provider requests, or the product scope. Include the provider and browser when reporting a bug.

Run the checks locally before opening a pull request.

```bash
npm ci
npm run build
```

## Pull requests

Keep each pull request focused. Explain the user facing change, the browsers or providers you tested, and any storage migration or compatibility impact.

Do not commit API keys, browser databases, `.next`, `node_modules`, generated backups, or screenshots containing private data.

For visual changes, include a screenshot or short recording when it helps reviewers compare behavior.

## Scope

MossChat keeps provider keys and conversation data in the browser. Changes that add a server side key store, accounts, billing, hosted RAG, or autonomous tool execution are outside the project scope. The reasons are described in the README.

## Documentation

Use direct wording and describe actual behavior rather than planned behavior.
