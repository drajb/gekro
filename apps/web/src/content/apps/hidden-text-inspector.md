---
title: "Hidden Text Inspector"
category: "ai"
job: "Reveal invisible and dangerous Unicode hiding in text - zero-width characters, smuggled prompt injections, bidi tricks, and homoglyphs"
description: "Paste any text and see what's actually in it: zero-width characters, Unicode Tag-block smuggling (invisible prompt injection), bidirectional-override tricks (Trojan Source), variation selectors, homoglyphs, and unusual spaces. It decodes any hidden Tag-block message, shows every suspicious character as a labeled badge, and gives you a cleaned copy. Runs entirely in your browser and never renders your text as HTML."
aiSummary: "A client-side Unicode security inspector. It scans pasted text for zero-width characters, Unicode Tag-block smuggling (a vector for invisible prompt injection), bidi controls (Trojan Source), variation selectors, homoglyphs/confusables, and unusual spaces, decodes any smuggled Tag-block message, annotates each finding, and outputs a cleaned copy. It never assigns user data to innerHTML and never renders the input as HTML, so hostile pasted content cannot execute."
personalUse: "AI output and copy-pasted text increasingly carry invisible payloads - zero-width watermarks, and in the worst case Unicode Tag characters that smuggle instructions past a human reviewer straight into a model's context. I wanted a fast way to see whether a prompt, a document, or an email I'm about to feed an agent has anything hidden in it, and to strip it before it does damage."
status: "active"
publishedAt: "2026-08-08"
lastVerified: "2026-08-08"
companionPostSlug: ""
license: "MIT"
icon: "🕵️"
---

## What It Does

Text can carry characters you can't see. Sometimes they're harmless (a stray zero-width space from a copy-paste); sometimes they're a deliberate attack. This tool makes them visible. Paste anything and it flags:

- **Zero-width characters** - ZWSP, ZWNJ, ZWJ, word joiner, BOM. Used for invisible watermarking and to break up strings.
- **Unicode Tag smuggling** - characters in the U+E0000-E007F block that render as nothing but encode ASCII. This is a real **invisible prompt-injection** vector: instructions hidden in a document that a human reviewer never sees but a model reads. The tool decodes the hidden message.
- **Bidirectional controls** - the overrides behind "Trojan Source" attacks, where source code or text displays differently from how it's parsed.
- **Variation selectors, homoglyphs, and unusual spaces** - confusable Cyrillic/Greek look-alikes, and the many non-standard space characters.

You get a per-category count, the decoded hidden message (if any), an annotated view with every suspicious character shown as a labeled badge, and a **cleaned copy** with the dangerous characters removed.

## Built To Be Safe

The input to this tool is untrusted by design - the whole point is to paste text that might be hostile. So it is built to never trust that input:

- It **never renders your text as HTML**. The annotated view is constructed one DOM node at a time, and text is only ever inserted as literal text content, which browsers do not parse as markup. A pasted `<script>` is displayed as the five characters `<`, `s`, `c`... - it cannot execute.
- Every badge label and tooltip is a fixed string the app controls, never built from your input.
- Input is length-capped and the annotated render is bounded, so a huge paste can't hang the page.

In short: analyzing hostile text here cannot compromise the page.

Pairs well with the [JWT Decoder](/apps/jwt-decoder/) and [System Prompt Linter](/apps/system-prompt-linter/) when you're vetting untrusted input to an AI system.

## Limitations

- **Detection, not attribution.** It flags that a character is a homoglyph or zero-width; it can't tell you who put it there or why.
- **Homoglyphs are kept in the cleaned output**, not stripped - removing every non-Latin letter would corrupt legitimate multilingual text. They're flagged so you can decide.
- **Confusable detection is range-based** (Cyrillic, Greek, fullwidth), not a full Unicode confusables table, so it catches the common spoofing scripts rather than every possible look-alike.
