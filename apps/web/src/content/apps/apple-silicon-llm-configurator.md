---
title: "Apple Silicon LLM Configurator"
category: "ai"
job: "Work out which Mac actually runs the model you want, and whether the expensive one is buying you speed or just headroom"
description: "Pick a model and a quantization, and see every current Mac config side by side: whether it fits in unified memory, the roofline tokens-per-second ceiling from published bandwidth, and the dollars per token per second. Covers the M6 and M5 Pro Mac mini and the M5 Max and M5 Ultra Mac Studio, including the 512 GB config. Runs entirely in your browser."
aiSummary: "A client-side Apple Silicon buy-decision tool for local LLM inference. It sizes total memory from weights plus KV cache and compares it against each Mac's usable unified memory after the macOS iogpu.wired_limit_mb reservation, then computes a roofline decode ceiling as memory bandwidth divided by active weight bytes. Covers Mac mini M6 (16-32 GB, up to 170 GB/s), Mac mini M5 Pro (up to 64 GB, 307 GB/s), Mac Studio M5 Max (36-128 GB, 460-614 GB/s) and Mac Studio M5 Ultra (96-512 GB, 1.2 TB/s), announced 25 August 2026 and shipping 22 September 2026. Its central point is that memory fit is driven by total parameters while decode speed is driven by active parameters, so a 671B mixture-of-experts model with 37B active outruns a dense 405B model on the same machine. Tokens per second is an explicitly labelled theoretical ceiling, never a benchmark."
personalUse: "I ran a 64 GB M4 Pro Mac mini for a long stretch, and it handled Llama 3 70B at q4_K_M through Ollama perfectly well, so when Apple announced a Mac Studio that takes 512 GB I wanted to know whether that was aimed at me or just at my wallet. The answer turned out to depend entirely on one thing nobody's calculator asks about: whether the model is dense or mixture-of-experts. Capacity and bandwidth are different purchases, and only one of them makes tokens come out faster."
status: "active"
publishedAt: "2026-08-28"
lastVerified: "2026-08-28"
companionPostSlug: ""
license: "MIT"
icon: "🍎"
---

## How this works

Two separate questions get answered, because they have different answers and people
conflate them constantly.

**Does it fit?** Memory has to hold the whole model, plus the KV cache, plus the runtime.
That is driven by **total parameters** - in a mixture-of-experts model every expert must be
resident even though most of them sit idle on any given token.

**How fast will it feel?** Generating a token means reading the weights that token actually
uses. That is driven by **active parameters**, and it is bandwidth-bound, so the ceiling is
simply `bandwidth ÷ active weight bytes`.

For a dense model those two numbers are the same, and a bigger machine mostly buys you the
ability to run something else later. For a mixture-of-experts model they diverge by an order
of magnitude, and that divergence is the entire buy decision.

## The trap

The M5 Ultra takes 512 GB. That sounds like it runs anything, and it does not.

At Q4, a dense 405B model needs about 220 GB including its KV cache. It fits comfortably. But
203 GB of that is weights, and every byte of them is read for every token, so 1.2 TB/s divided
by 203 GB gives a ceiling of roughly **6 tokens per second** - and a ceiling is the best case,
not the expected case. You would have spent five and a half thousand dollars to watch text
arrive one word at a time.

Now take DeepSeek V3, which is 671B parameters with about 37B active. It needs about 350 GB
resident, so it only runs on the biggest config. But it reads only 18.5 GB per token, which
puts the ceiling near **65 tokens per second**. Bigger model, far bigger memory requirement,
eleven times the speed.

Same machine, same memory, same bandwidth. The difference is architecture, and no other
configurator asks you about it.

## The lineup

Announced 25 August 2026, available 22 September, with the 512 GB Ultra following in late
October.

| Machine | Unified memory | Bandwidth | Published starting price |
|---|---|---|---|
| Mac mini M6 | 16 GB, up to 32 GB | up to 170 GB/s | $899 |
| Mac mini M5 Pro | up to 64 GB | 307 GB/s | $1,699 |
| Mac Studio M5 Max | 36 GB, up to 128 GB | 460 to 614 GB/s | $2,499 |
| Mac Studio M5 Ultra | 96 GB, up to 512 GB | 1.2 TB/s | $5,499 |

Two details in that table are easy to miss and both cost real performance:

**The M5 Max's bandwidth is tied to the GPU, not the chip name.** It starts at 460 GB/s and
only reaches 614 GB/s with the 40-core GPU. Choosing the cheaper GPU quietly costs you about
a quarter of your generation speed, on a machine you bought for generation speed.

**Apple does not publish intermediate memory tiers or upgrade pricing.** Only the
configurations above are stated, so those are the only ones modelled here, and the price
column in the tool is left blank wherever the published price does not correspond to that
exact configuration. Paste in whatever Apple's configurator quotes you and the dollars per
token per second fills itself in. Inventing those numbers would have been worse than leaving
them empty.

## The wired limit

macOS does not let the GPU wire all of unified memory. The cap lives in the
`iogpu.wired_limit_mb` sysctl, and the default leaves a generous slice to the operating
system - the tool models that as about 75%, matching the convention used across the rest of
this site.

You can raise it:

```
sudo sysctl iogpu.wired_limit_mb=<megabytes>
```

It takes effect immediately and resets on reboot. It is genuinely useful when a model just
barely misses fitting. It is also a good way to make your machine miserable: starve macOS
and it starts swapping, which is dramatically slower than the memory you just clawed back.
Leave at least 8 GB. The tool offers 75%, 85% and 92% so you can see what the extra headroom
actually buys before you go changing kernel parameters.

## Inputs explained

- **Model** - preset or custom. The presets carry both total and active parameter counts,
  which is the pair that matters.
- **Quantization** - bytes per parameter. Q4_K_M at 0.5 bytes is the usual local default;
  it is what a 70B needs to fit in 64 GB at all.
- **Context length and concurrent requests** - both scale the KV cache linearly. 128K context
  is not free, and neither is serving four people at once.
- **KV cache dtype** - FP8 halves the cache for a small quality cost on most modern models.

## Why the speed number is a ceiling

Decision log 2026-04-19 for this site says benchmarks are never estimated from specifications.
This tool honours that: the tokens-per-second column is a **roofline ceiling** derived from
published memory bandwidth, and it is labelled as such everywhere it appears. It is not a
benchmark, it is not a measurement, and real throughput under llama.cpp, Ollama or MLX lands
below it by an amount that depends on the runtime, the quantization kernel, the attention
implementation and how hot the machine has got.

Treat it as an upper bound and a comparison tool between configurations, which is exactly what
a buy decision needs. If you want the fuller latency picture including prefill and
time-to-first-token, use the
[Inference Latency Estimator](/apps/inference-latency-estimator/). For memory fit on NVIDIA
hardware, use the [GPU VRAM Calculator](/apps/gpu-vram-calculator/). To find a model that fits
what you already own, try the [Local Model Browser](/apps/local-model-recommender/).

## Sources

- [Apple introduces new Mac Studio with M5 Max and M5 Ultra](https://www.apple.com/newsroom/2026/08/apple-introduces-new-mac-studio-with-m5-max-and-m5-ultra/) - memory, bandwidth, GPU cores, pricing, availability, verified 2026-08-28
- [Apple unveils a more powerful Mac mini featuring the all-new M6 and M5 Pro](https://www.apple.com/newsroom/2026/08/apple-unveils-a-more-powerful-mac-mini-featuring-the-all-new-m6-and-m5-pro/) - memory tiers, bandwidth, pricing, verified 2026-08-28
- M3 Ultra bandwidth of 800 GB/s derived from Apple's own statement that the M5 Ultra's 1.2 TB/s is 50% higher than the previous generation, verified 2026-08-28
- Previous-generation M4 Max and M4 Pro bandwidth figures carried over from this site's Inference Latency Estimator dataset

## Limitations

- **Roofline only.** No prefill modelling, no time-to-first-token, no speculative decoding, no
  attention overhead, no thermal throttling. All of those move real numbers.
- **KV cache is estimated.** Layer counts, head counts and head dimensions come from the same
  architecture heuristic the GPU VRAM Calculator uses, not from each specific model's config.
  Models with unusual attention designs, particularly MLA as used by DeepSeek, will use
  materially less KV cache than shown here.
- **Only stated configurations.** Apple publishes no intermediate memory tiers or upgrade
  prices, so none are guessed at.
- **The wired-limit percentages are conventions, not published constants.** Apple documents
  neither the default nor the formula, and it has changed across macOS versions.
- **Unreleased hardware.** These machines ship 22 September 2026, so there are no measured
  benchmarks for any of them, which is precisely why this tool reports a ceiling instead.

## Disclaimer

**This tool is provided as is, with no warranty of any kind, express or implied**, including no
warranty of merchantability, fitness for a particular purpose, accuracy, completeness or
currency. There is no guarantee that any specification, price or figure here is correct or
current.

The tokens-per-second figures are theoretical ceilings computed from published bandwidth, not
benchmarks and not measurements. **This is not purchasing, financial or professional advice.**
Verify configurations, specifications and prices with Apple before spending money. To the
fullest extent permitted by law, no liability is accepted for any loss or damage arising from
use of this tool or reliance on its output. Use entirely at your own risk.
