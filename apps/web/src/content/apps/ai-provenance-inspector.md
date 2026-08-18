---
title: "AI Provenance Inspector"
category: "ai"
job: "Check text and files for AI-provenance signals - and get an honest answer about which ones can actually be verified"
description: "Paste text or drop an image and see what provenance signals it actually carries: hidden Unicode markers, and for files, whether a C2PA Content Credentials manifest is embedded. It is equally clear about what cannot be checked - Claude's statistical watermark and Google's SynthID-Text are invisible to any third-party tool, so this reports them as unverifiable rather than inventing a score. Runs entirely in your browser."
aiSummary: "A client-side AI provenance checker. It detects hidden Unicode markers (zero-width, Unicode Tag block, bidi controls) in text and scans image files for embedded C2PA/Content Credentials manifests via JUMBF box and PNG caBX chunk markers. It explicitly does NOT claim to detect statistical watermarks such as Anthropic's Claude mark (rolling out from 2026-08-02 for EU-launched models under the EU AI Act Article 50(2) transparency code, detection method not yet published) or Google's SynthID-Text, because those require the vendor's keyed detector. A third mode models how detection power falls to sqrt(f) when only a fraction f of a document is machine-written. Absence of a signal is not evidence of human authorship."
personalUse: "When Anthropic started marking Claude output in August 2026, the first thing I wanted was a way to check text myself - and the first thing I found was a wave of sites claiming to detect it, which is not possible because the detection method has not been published. What I actually needed was a tool willing to say 'I cannot check that'. Show me the signals a browser can genuinely verify, name the ones it cannot, and refuse to guess in the gap between them."
status: "active"
publishedAt: "2026-08-13"
lastVerified: "2026-08-13"
companionPostSlug: ""
license: "MIT"
icon: "🔎"
---

## What It Does

Anthropic has begun machine-readable marking of Claude's output, using two different mechanisms: an **imperceptible statistical watermark** embedded in generated text, and **C2PA signed provenance metadata** on `.svg`, `.png`, and `.jpg` files. Per Anthropic's documentation, models launched in the EU on or after 2 August 2026 support this at launch, with existing models in progress; the driver is the EU AI Act's Article 50(2) Code of Practice on transparency, which Anthropic signed. Google has run SynthID-Text across Gemini for a while. The obvious question - "can I check whether this was AI-generated?" - has a more interesting answer than most tools admit.

This inspector answers it in three modes:

- **Text** - scans for hidden Unicode markers: zero-width characters, Unicode Tag-block smuggling, bidi controls, and variation selectors. These are real, checkable, and sometimes used for invisible tagging.
- **File** - scans a PNG, JPEG, or SVG for an embedded **C2PA Content Credentials** manifest, by looking for the JUMBF container box and the PNG `caBX` chunk that C2PA embeddings use.
- **Mixed provenance** - a teaching model (it analyses no text) showing why documents written by several models, or by a model plus a human, defeat document-level detection. See below.

## What It Deliberately Refuses To Do

It will not tell you that text is "87% likely Claude." It cannot, and neither can anything else right now.

Anthropic's text watermark is a **statistical** one: the signal lives in *which words the model chose*, biased at sampling time, not in any character you could search for. Verifying it requires Anthropic's keyed detector, and Anthropic's own documentation says detection details are still forthcoming. Google's SynthID-Text works the same way, using tournament sampling over pseudo-random token partitions. Any site claiming to detect either one today is guessing, and a confident wrong answer here has real consequences for the person being accused.

So statistical watermarks are reported as **not checkable**, with an explanation, rather than as a number.

## Mixed Provenance: Why Documents Beat Detectors

Real documents are rarely written by one author. People switch models mid-draft, route through OpenRouter, paste between chatbots, and edit by hand. That breaks detection in a way that is worth seeing rather than being told.

Green-list watermark detection is a z-test over token counts:

```
z = (greens - γT) / sqrt(T · γ(1-γ))
```

If only `W` of a document's `T` tokens are machine-written, each lifting the green rate by `ε`, the expected green count is `Tγ + Wε`, so the whole-document statistic is `Wε / sqrt(T · γ(1-γ))`. Score just the machine-written span instead and you get `ε·sqrt(W) / sqrt(γ(1-γ))`. Divide one by the other and the whole thing collapses to a single number:

```
z_whole / z_span = sqrt(W/T) = sqrt(f)
```

Scoring the whole document keeps only **the square root of the machine-written fraction** of your detection power. At 10% AI-written, that is about 32%. A 300-token passage that would clear threshold comfortably on its own vanishes inside a 3,000-token document. The Mixed provenance tab lets you move those numbers and watch the two z-scores diverge.

The consequence is the important part: **mixing models is not an attack on the watermark, it is an attack on the detector's choice of window.** Sliding-window scoring recovers the power (the WinMax approach in the SynthID-Text paper), but scoring hundreds of windows means hundreds of hypothesis tests, so the threshold has to rise to keep false positives controlled. And windowing only ever localizes one vendor's mark, because each provider keys its own detector.

There is also a lane where the question never arises. Watermarking requires whoever runs inference to bias sampling, so open-weight models carry no mark at all. Routing to Claude or Gemini through OpenRouter preserves the watermark, because it is applied inside the provider's stack before tokens are returned. Routing to Llama or Qwen through the same service produces unmarked text, as does running them locally.

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
