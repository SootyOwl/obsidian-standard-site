# Standard.site Publisher for Obsidian

Publish your Obsidian vault notes to the [AT Protocol](https://atproto.com/) as [Standard.site](https://standard.site) documents. Write in Obsidian, publish to the open social web — no static site generator, no deploy step, no hosting required.

Notes become `site.standard.document` records on your Personal Data Server (PDS), immediately discoverable by readers that support Standard.site lexicons.

## Features

- **Publish notes** from your vault to ATProto with a single command
- **Pull notes** back from ATProto into your vault
- **Sync diff** — detects creates, updates, and orphaned records
- **Multi-publication support** — manage multiple blogs/sites from one vault
- **Markdown transform** — converts Obsidian-flavored markdown (wikilinks, callouts, highlights, comments) to standard GFM
- **Static viewer** — included single-file HTML viewer that renders your publication directly from ATProto

## Installation

1. Clone this repo into your vault's `.obsidian/plugins/standard-site-publisher/` directory
2. `npm install`
3. `npm run build`
4. Enable the plugin in Obsidian → Settings → Community Plugins

## Configuration

Open the plugin settings in Obsidian and configure:

| Setting | Description |
|---|---|
| **Handle** | Your ATProto handle (e.g. `alice.bsky.social`) |
| **App Password** | An [app password](https://bsky.app/settings/app-passwords) for authentication |
| **PDS URL** | Your PDS URL (defaults to `https://bsky.social`) |
| **Publish Root** | Vault folder containing notes to publish (empty = entire vault) |
| **Pull Folder** | Where to save pulled notes (defaults to publish root) |

Select an existing publication or create a new one from the settings panel.

## Usage

### Publishing

Add `publish: true` to a note's frontmatter:

```yaml
---
title: My Post
publish: true
tags: [blog, tech]
description: A short summary
slug: custom-slug        # optional path override
---

Your content here...
```

Run the **Publish to Standard.site** command from the command palette. After first publish, the plugin writes an `rkey` field back to your frontmatter for fast syncing on subsequent updates.

### Pulling

Run the **Pull from Standard.site** command to import published documents back into your vault as markdown files.

## Viewer

The `viewer/` directory contains a zero-dependency static HTML site that renders your publication directly from ATProto.

### Setup

```bash
mkdir my-site && cd my-site
curl -fsSL https://raw.githubusercontent.com/SootyOwl/obsidian-standard-site/refs/heads/main/viewer/setup.sh | bash
```

The script downloads the viewer files, prompts for your handle, resolves your DID, lists your publications, and configures everything automatically.

Host the resulting directory on any static host (GitHub Pages, Cloudflare Pages, Netlify, etc.).

### Features

- Client-side rendering with hash-based routing
- Light/dark mode
- Post list with dates, descriptions, and tags
- Inter-note link resolution
- Custom theming via `custom.css`
- 5-minute session cache with manual refresh

## Network and data disclosure

This section is provided per Obsidian's developer policies to disclose how the plugin uses network requests and handles credentials.

**Network requests.** The plugin connects to your configured ATProto Personal Data Server (PDS) to publish, update, unpublish, and sync notes. All network traffic goes exclusively to the PDS. The default PDS is `https://bsky.social`, but you can configure any PDS URL in the plugin settings.

**Authentication.** An ATProto handle and app password are required. App passwords can be generated at <https://bsky.app/settings/app-passwords>. The plugin uses these credentials solely to authenticate with your configured PDS.

**Credential storage.** Your handle and app password are stored in the plugin's `data.json` file within your vault's `.obsidian/plugins/standard-site-publisher/` directory. This is Obsidian's standard local plugin storage mechanism. Credentials are never transmitted to any service other than the configured PDS.

**No telemetry.** The plugin does not collect analytics, telemetry, or tracking data of any kind.

## Development

```bash
npm run dev          # watch mode
npm run build        # type-check + production build
npm test             # run tests
npm run test:watch   # watch mode for tests
```

## ATProto Lexicons

| Lexicon | Usage |
|---|---|
| `site.standard.publication` | Blog/site identity |
| `site.standard.document` | Individual published note |
| `at.markpub.markdown` | Markdown content block within documents |

## License

MIT
