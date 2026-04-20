---
title: "Code Snippet to PNG"
category: "dev"
job: "Turn code into beautiful shareable images with syntax highlighting and gradient backgrounds"
description: "Paste code, choose a language and theme, pick a background gradient, and export a high-resolution PNG. Syntax highlighting is powered by Shiki. The image is rendered client-side using html-to-image and exported at 2x pixel density for crisp displays. Nothing is uploaded."
aiSummary: "Client-side code-to-image tool using Shiki (browser bundle) for syntax highlighting and html-to-image for PNG export at 2x density. Offers 8 curated dark themes, 30 languages, customizable padding, border radius, window chrome toggle, and gradient backgrounds."
personalUse: "I use this for LinkedIn posts, README screenshots, and conference slide code snippets. The gradient backgrounds and window chrome toggle make the output look polished without opening Figma."
status: "active"
publishedAt: "2026-04-20"
icon: "📸"
license: "MIT"
---

## How this works

Paste your code into the editor, select the programming language, and choose a visual theme and background. The tool renders a styled HTML element and captures it as a PNG using `html-to-image`.

**Rendering pipeline**

1. Code is highlighted by Shiki's browser bundle (`shiki/bundle/web`) — a full-featured tokenizer with TextMate grammar support.
2. The highlighted HTML is placed inside a styled container with the chosen background and chrome.
3. `html-to-image` captures the DOM node as a canvas and exports it as a PNG data URL at 2x device pixel ratio.
4. The PNG is downloaded via a temporary `<a>` element.

**Themes**

GitHub Dark · Tokyo Night · Dracula · Nord · One Dark Pro · Catppuccin Mocha · Solarized Dark · Rose Pine

**Supported languages** (30+)

JavaScript · TypeScript · Python · Rust · Go · Java · C · C++ · C# · Bash · SQL · HTML · CSS · JSON · YAML · TOML · Markdown · Ruby · PHP · Swift · Kotlin · Scala · Dart · Elixir · Haskell · Lua · R · MATLAB · Dockerfile · GraphQL

## Limitations

- **Shiki load time** — Shiki's browser bundle is ~500 KB and loads on first use with a spinner. Subsequent highlights reuse the cached highlighter.
- **Very long code** — extremely tall snippets may overflow the viewport during capture. Trim to a meaningful excerpt for sharing.
- **Fonts** — the exported PNG uses the browser's monospace font stack. Install a code font (JetBrains Mono, Fira Code) for the best result.
