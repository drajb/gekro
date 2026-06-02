---
title: "Translator (EN · ES · HI)"
category: "ai"
job: "Translate English, Spanish, and Hindi in any direction - live, in your browser, fully offline after the model loads once"
description: "A Google-Translate-style translator for English, Spanish, and Hindi that runs a real neural translation model (Meta's M2M-100) entirely in your browser via transformers.js. Translation happens live as you type, in any of the six directions - including Spanish to Hindi directly, with no English pivot. The model downloads once (~250 MB), caches locally, and from then on every translation runs offline. No text ever leaves your device because there is no server."
aiSummary: "A client-side translator for English, Spanish, and Hindi built on Meta's M2M-100 (418M-parameter many-to-many model) running in-browser with transformers.js and ONNX Runtime Web. It translates directly between any pair of the three languages, detects the source language, supports text-to-speech, and works fully offline after a one-time model download. No backend - all inference is local to the browser."
personalUse: "I move between English, Spanish, and Hindi often enough that I wanted a translator I could trust with private text - messages, notes, half-finished drafts - without it being logged on someone else's servers. So I built one that runs the model locally in the browser. After the first load it works on a plane with the Wi-Fi off."
status: "active"
publishedAt: "2026-06-02"
lastVerified: "2026-06-02"
companionPostSlug: ""
license: "MIT"
icon: "🌐"
---

## What It Does

This is a translator for three languages - **English, Spanish, and Hindi** - that works in every direction between them, including the pairs people forget about: Spanish to Hindi and Hindi to Spanish, translated **directly** rather than by quietly routing through English first.

What makes it different from the translation box you are used to: there is no backend. The actual translation model runs inside your browser tab. The first time you use it, a model file (~250 MB) downloads from a public CDN and is cached by your browser. After that, translation runs locally - offline, private, and with no API key, login, or rate limit. Whatever you type stays on your device because there is nowhere else for it to go.

## How to Use It

1. Pick your **From** and **To** languages. Leave **From** on "Detect language" and it will guess between the three for you.
2. Start typing or paste text into the left box.
3. The translation appears on the right, live, a moment after you stop typing.
4. Use **⇄** to swap the two languages (it also moves the translation back into the input, so you can translate a reply straight back).
5. Tap **🔊** on either side to hear it read aloud, or **Copy** to grab the result.

The very first translation is slow - that is the one-time model download, shown as a progress bar. Every translation after that is fast.

## How It Works

The engine is **M2M-100** (`Xenova/m2m100_418M`), a 418-million-parameter sequence-to-sequence translation model from Meta. The "M2M" stands for *many-to-many*: unlike older translation systems that are trained one language pair at a time and pivot everything through English, M2M-100 was trained to translate directly between 100 languages. That is why Spanish to Hindi here is a single direct translation, not two hops with English in the middle (which is where meaning usually gets lost).

The model runs through **transformers.js**, which executes the ONNX-exported weights using ONNX Runtime Web - WebAssembly under the hood, with WebGPU where available. The weights are quantized to keep the download to a few hundred megabytes instead of well over a gigabyte. The library and the model are both pulled from the jsDelivr CDN at runtime, so nothing is bundled into the site and your browser caches them after the first visit.

**Source detection** (the "Detect language" option) is deliberately simple because it only ever has to choose between three languages: any Devanagari characters mean Hindi; otherwise it scores the text for Spanish-specific accents and common words against English ones. For short or ambiguous phrases, picking the source language explicitly is more reliable.

## Privacy

This is the whole reason the app exists. Mainstream translation services send your text to their servers, where it can be logged, retained, and used as training data. For a quick word that is fine. For a private message, a draft you are not ready to share, or anything sensitive, it is not.

Here, the model is downloaded to your machine and runs there. The network is used exactly once - to fetch the model files - and never again for the translation itself. You can confirm it: load the page once, turn off your Wi-Fi, and keep translating.

## Limitations

- **One-time download is large (~250 MB).** That is the cost of running a real model locally instead of calling an API. It is cached after the first load, but the first translation makes you wait.
- **Three languages only.** English, Spanish, and Hindi. This is a focused personal tool, not a 100-language replacement for Google Translate.
- **Quality is good, not perfect.** A 418M-parameter model is strong for everyday text but will trail the largest cloud models on idioms, long complex sentences, and domain jargon. For anything high-stakes (legal, medical, contractual), have a fluent human check it.
- **Auto-detect is a heuristic.** It distinguishes the three supported languages well; it is not a general language identifier. When in doubt, set the source manually.
- **Text-to-speech uses your browser's built-in voices.** Quality and accent depend on your operating system, and a given device may not have a Hindi or Spanish voice installed.
- **Best in a recent Chrome, Edge, or Safari.** Older browsers without WebAssembly support for ONNX Runtime Web will not be able to load the model.

## Why I Built It

I built this for the same reason every tool here exists: I needed it, and I wanted it to be mine - no login, no logging, no asterisk. Running a translation model client-side is also a small proof of a bigger point I keep making on this site: a surprising amount of "AI" no longer needs a server. A few hundred megabytes of model, ONNX Runtime, and a browser tab is enough to translate between three languages privately on the device in your hand.
