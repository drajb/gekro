---
title: "Word Counter"
category: "dev"
job: "Paste any text, see words, characters, sentences, paragraphs, reading time, reading level, and the top-10 most-used words - live as you type."
description: "Free browser-based word and character counter with live stats. Counts words, characters (with and without spaces), sentences, paragraphs; estimates reading time at 265 wpm and speaking time at 150 wpm; reports the Flesch-Kincaid reading grade level; surfaces the top-10 most-frequent words, average word length, average sentence length, unique-word count, and longest word. Includes a case converter (UPPER / lower / Title / Sentence / aLtErNaTiNg) and a word-goal progress bar. Browser-native spell check is enabled - right-click any underlined word for suggestions. No accounts, no ads, no uploads. Text never leaves your browser. Nothing is saved between visits."
aiSummary: "Client-side word counter with live stats: words, characters (with/without spaces), sentences, paragraphs, reading time (265 wpm), speaking time (150 wpm), Flesch-Kincaid grade level, average word length, average sentence length, unique word count, longest word, top-10 most-frequent words. Includes case converter (upper/lower/title/sentence/alternating) and word-goal progress bar. Textarea uses native spellcheck='true' for OS-level spell check (no JS dictionary shipped). Compute runs on every input event with an 80ms debounce. No localStorage / no persistent state."
personalUse: "I draft blog posts and LinkedIn drafts in plain textareas and constantly want to know 'is this 800 words yet?' without opening a Google Doc. Every free counter online is slow, ad-stuffed, or upsells a grammar checker. Built one that loads instantly and respects the reader."
status: "active"
publishedAt: "2026-05-23"
icon: "🔢"
license: "MIT"
---

## What It Does

Paste or type text on the left. Stats update live on the right.

- **Headline number** — big "X,XXX words · Y,YYY characters" at the top, the same way most counter sites lead
- **Full stats panel** — words, characters (with/without spaces), sentences, paragraphs, reading time, speaking time, reading level (Flesch-Kincaid grade), average word length, average sentence length, unique words, longest word
- **Top-10 most-used words** — collapsible list with counts. Spot repetition before your editor does
- **Word goal** — slider from 50 to 5000, live progress bar that turns green when you hit it
- **Case converter** — UPPER, lower, Title, Sentence, aLtErNaTiNg
- **Native spell check** — right-click any underlined word for suggestions. Works offline, in your locale, free

## How the numbers are calculated

| Metric | How |
|---|---|
| Words | Split text on whitespace runs (`/\s+/`), count non-empty |
| Characters | `text.length` including spaces and newlines |
| Characters (no spaces) | `text.replace(/\s/g, '').length` |
| Sentences | Count terminal-punctuation groups: `.`, `!`, `?`, `…` |
| Paragraphs | Split on blank-line runs (`/\n\s*\n/`), count non-empty |
| Reading time | `words / 265 minutes` (Brysbaert 2019 silent-reading meta-analysis) |
| Speaking time | `words / 150 minutes` (average conversational speech rate) |
| Reading level | Flesch-Kincaid grade: `0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59` |
| Syllables | Vowel-group counting with silent-`e` / `-ed` / `-es` stripping; minimum 1 per word |
| Unique words | Lowercase, strip non-letter/digit chars, count distinct |
| Longest word | Iterate cleaned words, keep the max |
| Top 10 | Frequency map → sort desc → slice 10 |

The Flesch-Kincaid label maps grade ranges to plain English: <6 = Elementary, 6-8 = Middle school, 9-12 = High school, 13-15 = College, 16+ = Graduate.

## Why no server-side grammar checker

Other counter sites bolt a paid "Check" button onto their UI that pings a remote LanguageTool-style backend. We don't.

- Your text never leaves your browser.
- The browser's native spell check (the `spellcheck="true"` attribute on the textarea) already catches misspellings and offers corrections via right-click. It uses your OS dictionary, your locale, and is offline.
- A real grammar checker (subject-verb agreement, passive voice, comma splices) needs ~5-10 MB of WASM or a server round-trip. Both would break the 100%-client-side promise. If you want that level, **LanguageTool** runs locally as a Java server and there are good browser extensions; that's the right home for it, not a side feature in a counter.

## When To Use It

- Drafting a blog post, essay, LinkedIn update, or newsletter and need a live word count
- Checking the reading level of marketing copy or technical docs
- Spotting overused words ("just", "really", "very") before your editor flags them
- Quick character count for tweet/title/meta-description length checks
- Estimating reading time for a piece of long-form content

## What's NOT Included

- **Grammar check** — see above, deliberate scope choice
- **Persistent state** — reload = blank slate, by design (every other Gekro app in this batch follows the same rule)
- **Thesaurus / synonyms** — would need a 1-2 MB word database; out of scope
- **Multi-document tabs** — one textarea, one counter; if you need multiple drafts use separate browser tabs
- **History / undo button** — the `<textarea>` has native Ctrl+Z / Ctrl+Y, no JS button needed

## Related Tools

- [Markdown Visualizer](/apps/markdown-visualizer/) - Markdown editor with live HTML preview and side word count
- [Prompt Token Counter](/apps/prompt-token-counter/) - Token estimation and API cost for LLM prompts
- [Tokenizer Visualizer](/apps/tokenizer/) - See exactly how an LLM splits your text into tokens
- [Text Diff](/apps/text-diff/) - Compare two versions of any text
- [Rich Text to Markdown](/apps/rich-text-to-markdown/) - Convert pasted formatted text to clean Markdown
