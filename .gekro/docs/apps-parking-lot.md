# Gekro Apps — Parking Lot

Planned apps that are approved in concept but need a dep/architecture decision before build. One app per month cadence. See `.gekro/docs/apps-platform-standard.md` for the recipe.

---

## App #2 — Text to Markdown Visualizer

**Category:** `dev`
**JTBD:** "Write or paste Markdown and see it rendered instantly"
**Personal use:** Rohit's writing workflow — draft in raw Markdown, confirm rendering before pasting into docs/slides
**Status:** Concept approved. **Dep decision required before build.**

**What it does:**
Split-pane interface: left = raw Markdown input (textarea), right = rendered HTML preview. Live updates as user types. Export as `.md` (source) or copy rendered HTML. URL state encodes the markdown content (truncated to URL length limit, ~2000 chars). Mobile collapses to single pane with source/preview toggle.

**Backend:** None — 100% client-side.

**Dep decision needed:**
The app needs a Markdown parser to render the preview. Three options:
- **(A) Zero-dep micro-parser** (~60 lines of regex) — covers headings, bold, italic, inline code, fenced code blocks, ordered/unordered lists, blockquotes, links, images. Incomplete (no tables, no HTML passthrough) but works for 90% of use cases. Zero dep, no Override needed.
- **(B) CDN-loaded `marked.js`** (~6KB gzip) — full CommonMark compliance. Not an npm dep so technically doesn't trigger the "3+ apps" rule, but introduces a CDN trust dependency.
- **(C) Bundle `marked` as npm dep** — full compliance, npm managed. Requires Override since it's the first app needing it. Justified if ≥1 other app also needs Markdown rendering (e.g., App #3 exports transcripts as Markdown, Regex Playground shows regex matches in Markdown — possible future justification).

**Recommendation:** Option A for v1 (ship faster, zero risk), upgrade to C after 2+ apps need it. Document the known limitations clearly in the app UI.

---

## App #3 — Voice Recorder + Transcript Generator

**Category:** `ai`
**JTBD:** "Record audio and get a text transcript — nothing leaves your browser"
**Personal use:** Rohit's meeting notes, brainstorm captures, quick voice memos → searchable text
**Status:** Concept approved. **Architecture/dep decision required before build.**

**What it does:**
Record audio via `MediaRecorder API` (browser native, zero dep). Transcribe to text. Export transcript as `.txt`, `.md`, or CSV (timestamps + text segments). Copy to clipboard. URL state not applicable (audio cannot be URL-encoded).

**Backend:** None. Recording is fully local. The transcription method is the decision point.

**Architecture decision needed — transcription engine:**

| Option | How | Deps | Privacy claim | Quality | Feasibility |
|---|---|---|---|---|---|
| **A: Web Speech API** | Browser's built-in `SpeechRecognition` (Chrome/Edge only) | Zero deps | ⚠️ Audio goes to Google's servers — "no data leaves your browser" is FALSE | Good for English | Works today, Chrome/Edge only |
| **B: Whisper.js** (transformers.js) | 100% on-device WASM/WebGPU inference | `@huggingface/transformers` (~150MB model download, cached) | ✅ True — audio never leaves the device | Excellent (OpenAI Whisper small/base) | Needs Override; ~5s init, ~2–5x realtime |
| **C: Hybrid** | Record locally → download .webm → offer Option A with disclosure | Zero deps | ⚠️ Same as A with disclosure | Good | Ships fastest |

**Recommendation:** Option B (Whisper.js) — this IS the on-brand choice for an "AI engineer's lab." The "no audio leaves your browser, transcribed locally by Whisper" story is the perfect LinkedIn post. The 150MB download is a one-time cost (IndexedDB cache). Needs Override on `@huggingface/transformers`. This also becomes the first justified platform-level dep: any future AI-inference app (e.g., text classifier, embedding generator) would reuse it.

**Before building:** Get Override approval for `@huggingface/transformers`. If denied, fall back to Option C.

---

## Future ideas (not yet scoped)

- **Position sizer / Kelly criterion** (trading) — bet sizing math, no deps
- **Self-host vs cloud TCO** (infra) — mirrors LLM cost calc pattern, needs hardware pricing data
- **Tesla trip cost calculator** (ev) — inputs: distance, charger type, electricity rate, kWh/mile
- **Amortization calculator** (finance) — standard math, zero deps, high SEO traffic
- **Cron expression builder/explainer** (dev) — visual cron editor, zero deps
- **Regex playground** (dev) — test regex against sample text, zero deps
- **Prompt token counter** (ai) — estimate token count + cost for a prompt, could reuse LLM cost data

---

*Update this doc as concepts are approved/built. Remove apps from here when they graduate to a content/apps/{slug}.md file.*
