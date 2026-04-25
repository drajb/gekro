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

## What It Does

Code Snippet to PNG turns a block of code into a shareable, polished image — ready for LinkedIn, a slide deck, a blog post, or a README. Syntax highlighting is powered by Shiki using full TextMate grammars. Export at 2x pixel density for crisp rendering on retina displays.

## How to Use It

1. Paste your code into the editor panel.
2. Select the programming language from the dropdown (30+ supported).
3. Pick a theme (8 curated dark themes) and a background gradient.
4. Toggle the macOS window chrome on or off depending on whether you want the traffic-light buttons.
5. Adjust padding and border radius to taste — the live preview updates instantly.
6. Click **Download PNG** to export.

**Supported themes:** GitHub Dark · Tokyo Night · Dracula · Nord · One Dark Pro · Catppuccin Mocha · Solarized Dark · Rose Pine

**Supported languages (30+):** JavaScript · TypeScript · Python · Rust · Go · Java · C · C++ · C# · Bash · SQL · HTML · CSS · JSON · YAML · TOML · Markdown · Ruby · PHP · Swift · Kotlin · Scala · Dart · Elixir · Haskell · Lua · R · MATLAB · Dockerfile · GraphQL

## The Math / How It Works

The rendering pipeline has three stages:

1. **Tokenization** — Shiki's browser bundle (`shiki/bundle/web`) runs a full TextMate grammar tokenizer, the same engine used by VS Code. It assigns semantic token types to each character, which is why the highlighting is accurate rather than approximate regex-based coloring.
2. **DOM rendering** — The tokenized HTML is placed into a styled container div with your chosen background gradient, padding, border-radius, and optional window chrome buttons. All styling is CSS — no canvas at this stage.
3. **DOM → PNG capture** — `html-to-image` walks the DOM node, inlines all computed styles, and renders it to an HTML5 canvas via `foreignObject`. The canvas is then exported as a PNG data URL at `window.devicePixelRatio * 2` (typically 4x on a retina screen), then downloaded via a temporary `<a>` element.

The 2x export size matters: at 1x, text on a retina display looks blurry when the image is displayed at native size. At 2x, a 600px-wide code window exports at 1200px — sharp on every device.

## Why Developers Need This (deep dive)

Technical communication happens increasingly in visual-first formats. A LinkedIn post with a code block rendered in plain text gets skipped. The same code as a well-styled image gets engagement. Same content, different packaging.

The problem with most online "code to image" tools is that they send your code to a server. That's a non-starter for anything proprietary. This tool renders entirely in the browser — Shiki is a browser-compatible library, html-to-image is pure client-side canvas work. Your code never leaves the tab.

The choice of Shiki specifically matters. Many "code screenshot" tools use Prism.js or highlight.js, which are regex-based tokenizers tuned for speed. Shiki uses VS Code's actual TextMate grammar engine, which produces accurate highlighting even for complex nested syntax — template literals, JSX expressions, Rust lifetimes, Python type annotations. The output looks like your actual editor, not like a generic code block.

Dark themes dominate code screenshots because they read better when embedded in dark-mode social feeds and slides. If you're embedding into a light-mode document, the GitHub Dark theme offers the least jarring contrast differential.

## Tips & Power Use

- **Trim to the interesting part.** The most impactful code screenshots are 5–15 lines — enough to convey the concept without requiring the viewer to scroll. Cut everything except the key insight.
- **Use the window chrome toggle for "real code" aesthetics.** The traffic-light buttons signal "this is my actual screen" which creates trust in technical audiences. For slides and documentation, turn chrome off for cleaner integration.
- **Dark themes for social, light backgrounds for docs.** Tokyo Night and Dracula export well against the dark backgrounds of Twitter/LinkedIn. For documentation or light-mode slides, add a white or light gradient as the background wrapper.
- **Long lines wrap awkwardly.** If your code has lines over ~80 characters, the image gets wide and readable on desktop but incomprehensible on mobile. Break long lines before exporting.
- **Pair with the [Dummy Data Generator](/apps/dummy-data-generator/)** when demoing data transformation code — generate realistic sample data, paste it as a comment above your transformation function, and export the full context as one clean image.

## Limitations

- **Shiki load time** — Shiki's browser bundle is ~500 KB and loads on first use with a brief spinner. Subsequent highlights reuse the cached highlighter.
- **Very long code** — extremely tall snippets may overflow the viewport during capture. Trim to a meaningful excerpt for sharing.
- **Fonts** — the exported PNG uses the browser's monospace font stack. Install a code font (JetBrains Mono, Fira Code) for the best result; it will be picked up automatically from your system.
- **No light themes** — the current build ships dark themes only; light theme support is on the roadmap.
