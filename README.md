# Standard.site Publisher for Obsidian

Publish your Obsidian vault notes to the [AT Protocol](https://atproto.com/) as [Standard.site](https://standard.site) documents. Write in Obsidian, publish to the open social web — no static site generator, no deploy step, no hosting required.

Notes become `site.standard.document` records on your Personal Data Server (PDS), immediately discoverable by readers that support Standard.site lexicons.

## Features

- **Publish notes** from your vault to ATProto with a single command
- **Pull notes** back from ATProto into your vault
- **Sync diff** — detects creates, updates, and orphaned records
- **Multi-publication support** — manage multiple blogs/sites from one vault
- **Markdown transform** — converts Obsidian-flavored markdown (wikilinks, callouts, highlights, comments) to standard GFM
- **Cover images** — attach a vault image to any note via frontmatter; uploaded as an ATProto blob
- **Document references** — cross-document `at://` URIs are stored in records so ATProto indexers can discover backlinks
- **Frontmatter template** — command to scaffold publish frontmatter on any note
- **Static viewer** — included single-file HTML viewer that renders your publication directly from ATProto

## Installation

### Via BRAT (Beta Reviewers Auto-update Tester)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. In Obsidian, open Settings → BRAT
3. Click "Add Beta plugin"
4. Enter `SootyOwl/obsidian-standard-site` as the repository
5. Enable the plugin in Obsidian → Settings → Community Plugins

### Manual Installation

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
| **Base URL** | Your site URL (e.g. `https://myblog.example.com`); synced to the publication record |
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
coverImage: images/hero.png  # optional vault image path
---

Your content here...
```

Use the **Add publish frontmatter** command to scaffold these fields on any note automatically.

Run the **Publish to Standard.site** command from the command palette. After first publish, the plugin writes an `rkey` field back to your frontmatter for fast syncing on subsequent updates.

Wikilinks to other published notes (e.g. `[[My Other Post]]`) are resolved to standard markdown links and stored as `at://` references in the document record, enabling backlink discovery across ATProto.

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

- Client-side rendering with clean URL routing (History API)
- Open Graph and Twitter Card meta tags for social sharing
- Light/dark mode
- Post list with dates, descriptions, tags, and cover image thumbnails
- Cover images displayed as hero images on individual posts
- Backlinks section showing documents that reference the current post
- Inter-note link resolution
- Custom theming via `custom.css`
- 5-minute session cache with manual refresh
- Optional Cloudflare Pages Function for per-post social cards

### Deployment

The viewer works on any static host. For enhanced social sharing (per-post cards when links are shared on Twitter, Discord, etc.), deploy to Cloudflare Pages — the included Pages Function automatically injects Open Graph meta tags by fetching your content from ATProto at the edge.

| Host | Social cards | Clean URLs |
|------|-------------|------------|
| GitHub Pages | Homepage only | Yes (via 404.html) |
| Cloudflare Pages | Per-post | Yes (native) |
| Other static hosts | Homepage only | Yes (via 404.html) |

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
