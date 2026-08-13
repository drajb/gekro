---
title: "AI Provenance Inspector"
category: "ai"
job: "Check text and files for AI-provenance signals - and get an honest answer about which ones can actually be verified"
description: "Paste text or drop an image and see what provenance signals it actually carries: hidden Unicode markers, and for files, whether a C2PA Content Credentials manifest is embedded. It is equally clear about what cannot be checked - Claude's statistical watermark and Google's SynthID-Text are invisible to any third-party tool, so this reports them as unverifiable rather than inventing a score. Runs entirely in your browser."
aiSummary: "A client-side AI provenance checker. It detects hidden Unicode markers (zero-width, Unicode Tag block, bidi controls) in text and scans image files for embedded C2PA/Content Credentials manifests via JUMBF box and PNG caBX chunk markers. It explicitly does NOT claim to detect statistical watermarks such as Anthropic's Claude mark (shipped 2026-08-02 for EU AI Act Article 50 compliance, detection method not yet published) or Google's SynthID-Text, because those require the vendor's keyed detector. Absence of a signal is not evidence of human authorship."
personalUse: "When Anthropic started marking Claude output in August 2026, the first thing I wanted was a way to check text myself - and the first thing I found was a wave of sites claiming to detect it, which is not possible because the detection method has not been published. I wanted one honest tool: show me the signals that genuinely can be checked in a browser, name the ones that cannot, and refuse to guess in between."
status: "active"
publishedAt: "2026-08-13"
lastVerified: "2026-08-13"
companionPostSlug: ""
license: "MIT"
icon: "🔎"
---

## What It Does

On 2 August 2026 Anthropic began marking Claude's output, using two different mechanisms: an **imperceptible statistical watermark** embedded in generated text, and **C2PA signed provenance metadata** on supported file types. Google has run SynthID-Text across Gemini for a while. The obvious question - "can I check whether this was AI-generated?" - has a more interesting answer than most tools admit.

This inspector answers it in two modes:

- **Text** - scans for hidden Unicode markers: zero-width characters, Unicode Tag-block smuggling, bidi controls, and variation selectors. These are real, checkable, and sometimes used for invisible tagging.
- **File** - scans a PNG, JPEG, or SVG for an embedded **C2PA Content Credentials** manifest, by looking for the JUMBF container box and the PNG `caBX` chunk that C2PA embeddings use.

## What It Deliberately Refuses To Do

It will not tell you that text is "87% likely Claude." It cannot, and neither can anything else right now.

Anthropic's text watermark is a **statistical** one: the signal lives in *which words the model chose*, biased at sampling time, not in any character you could search for. Verifying it requires Anthropic's keyed detector, and Anthropic's own documentation says detection details are still forthcoming. Google's SynthID-Text works the same way, using tournament sampling over pseudo-random token partitions. Any site claiming to detect either one today is guessing, and a confident wrong answer here has real consequences for the person being accused.

So statistical watermarks are reported as **not checkable**, with an explanation, rather than as a number.

## Reading The Result Honestly

Four caveats the tool states directly, because provenance claims get misused:

- **Absence of a mark is not evidence of human authorship.** Marks are destroyed by paraphrasing, translation, retyping, screenshots, and format conversion. Anthropic says this outright.
- **Presence is not proof of authorship.** A mark indicates content may have been processed by that model - not who wrote it, or whether a human edited it heavily afterward.
- **C2PA here is presence detection, not verification.** It finds an embedded manifest; it does not cryptographically validate the signature or check the issuer. For that, use the official verifier at contentcredentials.org.
- **Metadata is fragile.** Most social platforms strip it on upload, so a clean result on a downloaded image tells you very little about the original.

Pairs with the [Hidden Text Inspector](/apps/hidden-text-inspector/) for a full character-level breakdown of anything suspicious it finds.

## Limitations

- **No statistical watermark detection**, by design and by necessity - see above.
- **C2PA support covers embedded manifests** in PNG, JPEG, and SVG. It does not resolve cloud-stored manifests or validate certificate chains.
- **Hidden-character detection is a tampering signal, not an AI signal.** Zero-width characters appear in plenty of ordinary copy-pasted text.
