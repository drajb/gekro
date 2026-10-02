---
title: "Ambigram Generator"
category: "fun"
job: "Turn a word into a rotational ambigram that reads the same, or as a second word, when turned upside down"
description: "A free ambigram generator and maker that draws a word so it still reads when the design is rotated 180 degrees, or reads as a different word. Every letter pair gets a legibility score and a verdict, the optimiser picks lowercase, uppercase or alternate letterforms per slot, and you can download the result as SVG or PNG. Runs entirely in your browser."
aiSummary: "A client-side rotational ambigram generator. Each letter is a set of straight and quarter-arc strokes on a 4 by 8 grid whose x-height band is centred, so a 180 degree turn maps the grid onto itself. Each slot overlays the upright letter's strokes with the turned strokes of the letter it must become; the slot score is a penalty-weighted Jaccard overlap of the two stroke sets, discounted when the drawn glyph looks more like a different letter. An optimiser tries lowercase, uppercase and alternate forms (single- and double-storey a, straight and hooked y, pointed and rounded w) per slot. Natural pairs such as n/u, d/p, b/q, m/w, a/e and h/y score 100%. Exports SVG and 2x PNG with no upload."
personalUse: "Every ambigram generator I tried was a black box: pick a font, get an image, no idea why some letters worked and others turned to noise. I wanted the reasoning on screen - which strokes the two readings share, which ones are dead weight, and a number for every letter pair - so I can tell in a few seconds whether a word is worth drawing properly or should be swapped for one that flips cleanly."
status: "active"
publishedAt: "2026-10-02"
lastVerified: "2026-10-02"
license: "MIT"
icon: "🙃"
---

## How this works

A rotational ambigram reads correctly the right way up and again after a half turn. Turn the design and slot 1 lands where the last slot was, upside down, so slot `i` has to read as letter `A[i]` upright and as letter `B[n-1-i]` turned. For a single word, B is the same word.

Every letter is drawn as a few strokes on a small grid: 4 units wide, 8 tall, built from straight segments and quarter circles. The x-height band (where a, e, n, o and friends live) sits exactly in the middle, with the ascender zone above it and the descender zone below. That one decision does most of the work, because a 180 degree turn maps the grid onto itself and swaps ascenders for descenders. A `d` turned over lands on the `p` strokes exactly. So do b and q, n and u, m and a rounded w, h and a straight-tailed y, and a double-storey a and e.

For each slot the glyph is the **union** of the upright letter's strokes and the turned strokes of the other letter. Where the two sets coincide, nothing extra is drawn. Where they do not, both letters' strokes are drawn on top of each other and the reader has to pick out the one they want. Tick **Show stroke sources** to see which strokes belong to which reading.

## How the score works

Each slot gets a score from 0 to 100%:

1. **Overlap.** Shared stroke length divided by total stroke length (a weighted Jaccard index). A stroke that only one reading needs is noise for the other, and it costs 1.5x if it cuts through the inside of the letter rather than running along its outline.
2. **Confusion check.** The finished glyph is compared against every letterform in the table. If it looks more like a different letter than the one intended, the slot is discounted by that margin and the verdict says what it may be misread as. This catches cases like an n whose partner adds an ascender, which overlaps well but reads as h.

The optimiser tries every allowed combination for each slot - lowercase and uppercase, plus alternates such as single- and double-storey a, plain and tailed l, pointed and rounded w, hooked and straight y - and keeps the best. In Auto mode it only switches away from the case you typed when that gains more than 3 points. Uppercase is drawn as small caps in the x-height band, so mixed cases share a baseline.

A short table of hand-designed glyphs covers pairs where the plain union is worse than a deliberate drawing: an r whose terminal stops at the midline so it can sit over a u without reading as n, and a centred stroke for l over l. Designed glyphs are scored with exactly the same metric and are only used when they score at least as well as the best union, so they never inflate a number.

Tiers: **75% and up is clean**, 50 to 74% is readable, below 50% is weak. The overall number is the mean across slots.

## Inputs explained

- **Word A** - reads upright. Letters a-z only, up to 16; accents are folded to the base letter and anything else is dropped.
- **Word B** - optional second word that appears when the design is turned. If the two lengths differ by one or two letters, the shorter word is padded with gaps. Every gap position is tried and the best-scoring one is kept; a padded slot shows its letter in one orientation only and scores zero, because in the other reading it is a stray mark. Larger differences are refused rather than faked.
- **Case** - Auto picks per slot; lower and UPPER force one case throughout.
- **Style** - Rounded draws true arcs with round caps; Sharp chamfers the corners and uses square caps. Scores are identical.
- **Stroke weight and letter spacing** - visual only, in SVG pixels.
- **Colour and download background** - design-token colours. Downloads embed the resolved colour values, so the file looks the same outside this site.

Examples that score well with this engine: `swims` (100%), `NOON` (100%), `wow` turning into `mom` (100%), `dad` into `pep` (100%) and `dollop` (83%, held back by the two l's). For contrast, `gekro` manages 39%: k over k shares no strokes at all.

## Limitations

- **Some pairs are inherently weak.** k over k, r over r, t over t and v over v share almost nothing once turned, and no amount of optimising fixes that. The tool tells you so instead of hiding it.
- **The score measures stroke overlap, not beauty.** It cannot see that a glyph is elegant, only that its strokes line up. A lettering artist drawing by hand will beat any algorithm, especially on the weak pairs, by bending letterforms in ways a fixed grid cannot.
- **One glyph style.** Everything is built from one geometric segment alphabet. Script, serif and blackletter ambigrams are out of scope.
- **Rotational only.** Mirror (reflection) ambigrams, chain ambigrams and figure-ground designs are different problems.
- **Letters only.** Digits, punctuation and spaces are not drawn.

Everything runs locally in your browser. No word you type is uploaded, and the SVG and PNG files are built on your device.
