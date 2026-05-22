---
title: "HTML Viewer"
category: "dev"
job: "Paste HTML, see it rendered live in a sandboxed preview - resize the split, simulate phone/tablet/desktop, catch JS errors."
description: "Free browser-based HTML viewer with live preview. Paste HTML (with inline CSS and JavaScript), see it rendered in a sandboxed iframe in real time. Drag the divider to resize editor vs preview, simulate Phone (375 px) / Tablet (768 px) / Desktop viewports, fullscreen the preview, and catch any runtime JavaScript errors in a dedicated panel below the iframe. No accounts, no ads, no data leaves your browser. Bulletproof iframe sandbox - pasted scripts run inside a null-origin context and can't reach the host site."
aiSummary: "Client-side HTML viewer with live iframe-based preview. Editor + preview in a resizable side-by-side split on desktop, tabs on mobile. Preview iframe uses sandbox='allow-scripts allow-modals allow-forms allow-popups' (deliberately without allow-same-origin) so pasted scripts execute in a null-origin context and cannot read parent cookies, localStorage, or DOM. Outbound requests get referrerpolicy='no-referrer'. Error capture via injected wrapper script that uses postMessage to surface window.onerror and unhandledrejection events; parent listener filters by event.source identity and origin='null'. Viewport simulator constrains iframe max-width to 375 px (phone), 768 px (tablet), or 100% (desktop). Fullscreen API for full-viewport preview (keeps sandbox active - unlike opening in a new tab which would escape it, so that feature is deliberately omitted). Download as .html via Blob. No persistent state - reload starts fresh."
personalUse: "I needed a no-ads no-signup HTML scratchpad while debugging a layout someone Slacked me. Every free option is plastered with ads and most don't sandbox properly. Built one that respects both."
status: "active"
publishedAt: "2026-05-13"
icon: "👁️"
license: "MIT"
---

## What It Does

Paste HTML on the left, see it rendered on the right - live, as you type.

- **Resizable split** on desktop (drag the divider)
- **Mobile tabs** (Code / Preview)
- **Viewport simulator** - Desktop, Tablet (768 px), Phone (375 px)
- **Fullscreen preview** while keeping the sandbox active
- **JS error panel** under the iframe - catches `window.onerror` and unhandled promise rejections from your scripts
- **Download as .html**

## Security model

Everyone says "sandboxed iframe" - this one actually is.

The preview iframe is configured exactly as:
```html
<iframe sandbox="allow-scripts allow-modals allow-forms allow-popups"
        referrerpolicy="no-referrer"
        srcdoc="..."></iframe>
```

What that means for your pasted code:
- **Scripts execute** inside the iframe (you want this)
- **Origin is `null`** because `allow-same-origin` is deliberately NOT included
- **Cannot read** `document.cookie`, `localStorage`, `sessionStorage` of the parent site
- **Cannot access** `parent.document` or any parent DOM
- **Cannot navigate** the parent window (`top.location = ...` is blocked)
- **Cannot post credentialed requests** that would leak gekro.com cookies
- **Cannot leak referrer** to outbound fetches (no-referrer policy)

Why `allow-same-origin` is the danger: per MDN, combining `allow-scripts` with `allow-same-origin` lets the iframe's script remove the sandbox attribute and gain real-origin access. We never enable that combination.

### Why there's no "Open in new tab" button
Top-level navigation to a Blob URL or data URL would inherit gekro.com's origin and defeat the sandbox. Fullscreen API (the button labelled "⛶ Fullscreen") keeps the iframe sandbox active and is the safe equivalent.

## When To Use It

- Quick HTML scratchpad without signing into Codepen / JSFiddle
- Test someone's HTML snippet without trusting it
- Preview a downloaded `.html` file in a sandboxed context
- Validate that your snippet works at 375 px / 768 px / desktop widths
- Debug runtime JavaScript errors without opening DevTools

## What's NOT Included

- **Syntax highlighting** in the editor (would need a 30-50 KB dependency for marginal value)
- **Persistent state** across reloads (intentional - this is a scratchpad, not a project)
- **External resource loading restrictions** - your scripts CAN `fetch()` from any origin (without credentials)
- **PostCSS / Sass / TypeScript compilation** - vanilla HTML + CSS + JS only
- **Console output capture** - might add if there's demand. Errors are caught; `console.log` is not surfaced

## Related Tools

- [Markdown Visualizer](/apps/markdown-visualizer/) - similar pattern, markdown side-by-side
- [Code Snippet PNG](/apps/code-snippet-png/) - render code as a screenshot image
- [Rich Text to Markdown](/apps/rich-text-to-markdown/) - convert pasted formatted text
