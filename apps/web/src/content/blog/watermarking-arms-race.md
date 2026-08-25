---
title: "The AI Watermarking Arms Race"
description: "Anthropic has started watermarking Claude's text output. How generative text watermarking actually works, why no third party can verify it yet, why detection power drops to the square root of the machine-written fraction once a document has two authors, and why I shipped a tool that says 'not checkable' instead of inventing a score."
publishedAt: "2026-08-24"
difficulty: "Intermediate"
topics: ["AI Engineering", "Security", "Provenance"]
readingTime: 12
aiSummary: "Anthropic has begun machine-readable marking of Claude output, with models launched on or after 2 August 2026 supporting it at launch worldwide, under the EU AI Act Article 50(2) Code of Practice on Transparency of AI-Generated Content. It uses a statistical watermark in text plus C2PA signed metadata on .svg, .png and .jpg files. This post covers how generative text watermarking works (green-list biasing and SynthID-Text tournament sampling), derives why whole-document scoring retains only sqrt(f) of detection power when a fraction f of the text is machine-written, explains why model switching and unwatermarked open-weight models bound the whole regime, and argues for tools that report unverifiable signals as unverifiable."
---

<TLDR>
  Anthropic has started marking Claude's output. Text gets a statistical watermark, files get C2PA signed metadata, and it rolls out model by model for anything launched from 2 August 2026, worldwide, under the EU AI Act transparency code. I set out to build a detector and could not. The method is unpublished, the signal is in the model's word choices rather than in any character you can search for, and once a document has two authors the statistics fall apart in a way you can derive in three lines. So I built the tool that reports what is checkable and says so when nothing is.
</TLDR>

I read Anthropic's announcement and opened a text editor to hunt for zero-width characters. There are none. The watermark is not hiding between the letters, it is in which words the model picked, and that took me longer to accept than it should have. It also means a "watermark remover" has nothing to remove.

## Three Things People Call a Watermark

Three different mechanisms get called a watermark. They have almost nothing in common.

| Mechanism | Where the signal lives | Removable by | Third-party detectable |
|---|---|---|---|
| Hidden Unicode | Zero-width chars, Tag block (U+E0000-E007F) | Any find-and-replace | Yes, trivially |
| C2PA metadata | Signed manifest in the file container | Screenshot, re-save, format conversion | Yes, presence is checkable |
| Statistical watermark | The model's token choices | Heavy paraphrase or translation | No, needs the vendor's key |

Anthropic ships two of them. Files get C2PA signed provenance metadata, the same Content Credentials standard the imaging industry uses, on `.svg`, `.png` and `.jpg`. Text gets the third row. Anthropic's documentation calls it "an imperceptible watermark directly into the text itself," one that "doesn't change the meaning, quality, or readability of Claude's response."

The rollout is narrower than the headlines suggested. Anthropic's wording is that "Claude models launched on or after August 2, 2026 will support machine-readable marking at launch," with support for existing models described as in progress. The cut is by model, not by country. The same page says marking applies to output from supported models wherever Claude is offered, worldwide. The driver is the EU AI Act's Article 50(2) Code of Practice on Transparency of AI-Generated Content, which Anthropic signed as both a model provider and a generative AI system provider. So it arrives model by model, and once a model has it, everyone gets it.

Google has run SynthID-Text across Gemini for a while, and the method is published in Nature. It changes only the sampling step. At each token it seeds a pseudo-random function with the preceding k tokens, partitions the vocabulary into a tournament bracket with m layers, and boosts the sampling probability of tokens that keep winning their matches. Spread that across enough layers and enough tokens and you get a measurable statistical bias, with no individual word looking wrong to a reader.

Detection does not need the original model. It needs the keyed pseudo-random function and a scoring pass over the candidate text. Watermarked text carries systematically higher g-values than unwatermarked text, and that gap is a hypothesis test.

That is where I got stuck.

```
Signal              Verifiable in a browser?     Why
------              ------------------------     ---
Zero-width chars    Yes                          Codepoint scan
Unicode Tag block   Yes                          Codepoint scan, decodes to ASCII
C2PA manifest       Presence, not signature      JUMBF box / PNG caBX chunk markers
Claude watermark    NO                           Keyed detector, method unpublished
SynthID-Text        NO                           Keyed detector, Google-side API
```

Anthropic's help page is direct about it. They say they are "working to enable users and other third parties to detect Claude's embedded watermarks and provenance metadata" and that they "will share details on detection mechanisms in forthcoming technical documentation." Forthcoming means it does not exist yet. Until it does, nobody outside Anthropic can check the text watermark. Any tool that claims to is running a generic AI-text classifier under a different name, and those have a much worse error profile, particularly against people writing in a second language.

## Building the Inspector

So I built the version that only claims what it can check.

The C2PA side took the most code. A Content Credentials manifest lives in a JUMBF box, and where that box lands depends on the container. PNG puts it in a `caBX` chunk, JPEG carries it in an APP11 segment, SVG keeps it in XML metadata. Finding it means scanning the raw bytes for those markers:

```ts
const scanC2PA = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);

  const find = (needle: string): boolean => {
    const n = needle.length;
    const limit = bytes.length - n;
    for (let i = 0; i <= limit; i++) {
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (bytes[i + j] !== needle.charCodeAt(j)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  };

  const isPng = bytes[0] === 0x89 &&
    String.fromCharCode(bytes[1], bytes[2], bytes[3]) === 'PNG';

  const hasJumbf  = find('jumb') || find('jumd');
  const hasC2pa   = find('c2pa');
  const hasPngBox = isPng && find('caBX');

  return { found: hasC2pa || hasPngBox, hasJumbf, isPng };
};
```

That finds a manifest. It does not verify one. Validating means checking a certificate chain and a cryptographic signature, and I am not going to hand-roll that in a browser tab and present it as authoritative. The tool says so and points at the official verifier.

The scan has a failure mode I should name rather than bury. Searching raw bytes for a four-character marker can hit a false positive, since nothing stops the bytes `c2pa` turning up inside compressed image data. I kept it anyway. Parsing container structure properly across three formats is a lot of work for a tool whose whole claim is "something is here, go verify it elsewhere." It is a smoke alarm, and the label says as much. If that ever stops being good enough, the fix is real box parsing.

The text side reuses the codepoint scanner from my hidden-text inspector: zero-width characters, the Unicode Tag block that can smuggle whole ASCII messages invisibly, bidi controls, variation selectors. All of it is detectable and worth flagging.

The hardest part was not code. It was the wording of a single verdict. The tool has a signal called "Statistical watermark (Claude, SynthID-Text)" whose permanent state is `not checkable`, with an explanation attached. I sat on that for a while before shipping, because a tool that answers "I don't know" looks broken.

It matters because of how these results get used. Somebody runs a paragraph through a checker and carries the output into a disciplinary meeting. So the tool leads with four caveats. The first two are Anthropic's own position, the other two are mine about the limits of what I built:

- Absence of a mark is not evidence of human authorship. Anthropic lists heavy editing, paraphrasing, translation, and merging with other writing as conditions that leave marks undetectable.
- Presence is not proof of authorship either. It indicates content may have been processed by that model, not who wrote it or how much a human changed.
- C2PA presence is not C2PA verification. This tool finds a manifest, it does not validate the signature or the issuer.
- Metadata is fragile. Screenshots, re-saves, and most platform uploads strip it, so a clean result on a downloaded file says very little about the original.

## What Happens When a Document Has Two Authors

Everything above assumes one author per document. Almost nothing has one. People draft in one chatbot, rewrite a section in another, route through OpenRouter to whatever is cheapest that week, and hand-edit in between. That is not an exotic evasion technique, it is how people work now.

Anthropic already flags this. Their list of conditions under which a mark stops being detectable includes text that has been "heavily edited, paraphrased, translated, or merged with other writing." They state it as a caveat and leave it there. Here is the mechanism, because the size of the effect surprised me.

Green-list detection is a z-test over token counts. This is the published green-list construction with illustrative parameters. It is not Anthropic's scheme, which is unpublished. The shape of the result transfers, the specific numbers do not.

```
z = (greens - γT) / sqrt(T · γ(1-γ))
```

Say a document has `T` tokens, of which only `W` are machine-written, each lifting the green rate by `ε`. The human tokens contribute greens at the baseline rate `γ`, so the expected green count is `Tγ + Wε` and the whole-document statistic becomes:

```
z_whole = W·ε / sqrt(T · γ(1-γ))
```

Now score only the machine-written span instead:

```
z_span  = ε·sqrt(W) / sqrt(γ(1-γ))
```

Divide one by the other and everything cancels into a single number:

```
z_whole / z_span = sqrt(W/T) = sqrt(f)
```

Scoring the whole document keeps only the square root of the machine-written fraction of your detection power. At `f = 0.1` that is 32%. Taking `γ = 0.5` and a green-rate lift of `ε = 0.25` as illustrative values, a 300-token machine-written passage scores `z = 8.66` on its own and would be flagged with enormous confidence. Drop that identical passage into a 3,000-token document and the whole-document score falls to `z = 2.74`, under any reasonable threshold. The watermark did not change. The detector measured the wrong unit.

So mixing models does not attack the watermark. It attacks the detector's choice of window.

The fix is to slide a window across the text and take the maximum score, roughly the WinMax idea from the SynthID-Text paper. It works, and it costs you something. Scoring hundreds of overlapping windows means running hundreds of hypothesis tests on one document, so you need multiple-comparison correction, which pushes the threshold up, which pushes short spans back under it. You trade a dilution problem for a false-positive problem, and no setting of that dial avoids both.

Windowing also only ever localizes one vendor's mark, because every provider keys its own pseudo-random function:

```
for each vendor key K:          # Anthropic, Google, OpenAI, ...
    for each window w in text:  # all of these need FPR correction together
        score(w, K)
```

Three vendors means three detectors, three API round-trips, three trust relationships. Nobody offers a federated version, and Anthropic's is not public yet.

Then there is the hole that makes most of the above academic. Watermarking requires whoever runs inference to bias the sampling step. That is a property of the serving stack, not of the text. So:

| Path | Watermarked? | Why |
|---|---|---|
| OpenRouter → Claude / Gemini / GPT | Yes | Applied inside the provider's stack before tokens are returned. The router just proxies finished text. |
| OpenRouter → Llama / Qwen / Mistral | No | Open-weight inference providers have no obligation and no incentive to implement biased sampling. |
| llama.cpp on your own laptop | No | Same reason, more so. |

OpenRouter does not defeat the watermark by routing. It offers a lane where the mark was never applied in the first place, and that lane is one config string away. So the regime covers proprietary frontier APIs and nothing else. Open weights are already good enough for most text work and sit outside it. Anyone who wants around this changes a model name.

I built the dilution effect into the inspector as a third tab. It analyses no text and detects nothing. It runs the z-test arithmetic and plots the two scores separating as you change the machine-written fraction.

## What I Got Wrong

I had assumed watermark durability was about surviving edits. It is about surviving paraphrase, which is much harder, because paraphrasing resamples the token choices and that is where the signal lives. My first plan was a checker with a confidence percentage, because that is what people expect and what ranks. I killed it. Any number I produced would have been a generic AI-text classifier under a different label, and those have documented false-positive problems, especially against non-native English writers.

The harder call was the watermark remover, the adjacent product that would actually pull traffic. I skipped it. It would be tooling to get around a disclosure commitment, and it does not work anyway. There is no character to strip, so removal means paraphrase aggressive enough to degrade the writing, and a browser tool cannot paraphrase without shipping a model. What stuck with me afterwards is that the punctuation fixer I shipped alongside this does strip zero-width characters, which is sanitization I wanted for my own drafts. Same regex, different product. The line is in what the page says the tool is for, not in the code.

## Where This Goes

A provenance signal only the vendor can verify is not public provenance yet. But the sqrt(f) result points somewhere more specific than "the arms race continues." Content-only forensics cannot answer the question people actually ask. Not whether a text was generated, but which parts, by whom, and how much a human changed. Every mechanism we have degrades exactly where real documents live, in files with several authors and a long edit history. So the useful move is probably to stop interrogating the text and start recording the environment. Editor revision history, commit timelines, and signed edit chains already capture authorship far more reliably than any statistical test on a finished artifact, and C2PA's assertion model targets that kind of layered, multi-actor provenance. The watermark's real job is narrower than the headlines suggested. It is a default-on disclosure for the machine text nobody is trying to hide, with the adversarial cases handled where they always belonged, in the tools that record how a document was made.
