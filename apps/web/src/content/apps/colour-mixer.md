---
title: "Colour Mixer"
category: "fun"
job: "Mix drops of rose, amber and sky blue paint to make 18 named colours, then match target colours for stars."
description: "Free Colour Mixer: add drops of three paints, learn colour names from orange to brown, and match target colours at three levels. No signup."
aiSummary: "A free browser colour-mixing game. The player adds 0 to 8 drops each of three paints (rose, amber and sky blue, taken from the site's locked colour tokens) and sees the resulting colour and its name. The mixing model works in OKLCH: lightness and chroma are averaged by share and the hues are averaged the short way round the colour wheel, then the mix is darkened by half the square of an evenness term and dulled by up to 55 percent when all three paints are present, so rose and amber give orange, amber and sky blue give green, rose and sky blue give purple and equal parts of all three give a dark brown. There are 18 colour names to collect. In Match the colour mode the player matches five targets per round at three levels (4, 10 or 88 possible targets) and earns up to 3 stars each; every target can be made exactly. A hint always leads to the target shares. Only the names found and the best star totals are stored locally."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The colours are not looked up in a table: a few lines of maths in OKLCH decide every swatch, and the tests check that each name matches where its colour really sits on the colour wheel."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎨"
---

## How to play

### Mix colours

There are three paints: rose, amber and sky blue. Each has its own shape as well as its colour (a circle, a square and a triangle). Use the plus and minus buttons to add or take away drops, up to 8 of each, and the big blob changes colour. Under it you see the colour's name and the recipe, such as "3 drops: 2 Rose, 1 Amber".

Rose and amber make orange, amber and sky blue make green, rose and sky blue make purple, and a drop of all three makes brown. There are 18 names in all, from Rose, Coral and Orange to Teal, Plum and Slate. Each time you make a colour for the first time, it is added to the "Colours you have made" collection below, and the page remembers them.

On a keyboard, **1**, **2** and **3** add a drop of rose, amber and sky blue, **4**, **5** and **6** take one away, and **0** empties the dish. Keys only work after you click or tap inside the game.

### Match the colour

Switch to **Match the colour** and a target colour appears. Mix the same colour and press **This is my match**. A bar shows how close you are, and 75 percent or more is a match. You earn up to 3 stars for each colour, and a round is five colours, so 15 stars at most.

- **Little** shows the target's name and uses orange, green, purple and brown.
- **Middle** adds mixes with 1 part to 2, such as a reddish orange or a bluish green, 10 targets in all.
- **Big** uses 88 different mixes with up to 4 drops of each paint. Some are so close to each other that either one will do.

Nothing ever goes wrong here. If you are not close enough, the page says how close you are and suggests one drop to add or take away. **Hint** gives that suggestion at any time, and following it always gets you to the target. **New colours** deals five different targets.

## How it works

Each paint is a colour in OKLCH: a lightness, a chroma (how vivid it is) and a hue (an angle on the colour wheel). The page reads the three paints from the site's own colour tokens when it starts. A mix uses only the shares of the drops, so 2 drops of rose and 2 of amber make exactly the same orange as 1 and 1. With shares w1, w2 and w3:

- **Evenness.** spread is 1 minus the sum of the squared shares. It is 0 for one paint, one half for two equal parts and two thirds for three equal parts. triple is 27 times the three shares multiplied together, which is 0 unless all three paints are present and 1 for three equal parts.
- **Hue.** The paints' hues are averaged as arrows on the wheel, weighted by share, so the result is the average the short way round. R is the length of that average arrow, and it is 1 when the hues agree.
- **Lightness.** The average by share, minus 0.5 times spread squared, because real paint gets darker as it gets muddier.
- **Chroma.** The average by share, times (0.8 + 0.2 times R), times (1 minus 0.55 times triple). Hues that disagree, and a third paint, both make the colour duller.

The tests check the model from several sides:

- A single paint comes out exactly as it went in, and doubling every amount changes nothing.
- Shuffling the paints together with their drops gives the same colour.
- Between any two paints the hue moves steadily along the short arc, and adding more of a paint always turns the hue closer to it.
- The colour maths agrees with published OKLCH values for pure red, green and blue, and the fallback paint values match the site's colour tokens read straight from its stylesheet.

### The names

A paint counts as present when it is at least a tenth of the drops. With one paint present the name is the paint's own. With two present, the name comes from the share of the second: a table such as Rose, Coral, Orange, Gold, Amber for rose and amber. With all three present the mix is dull, so it is named by its hue: Plum, Rust, Brown, Ochre, Olive or Slate. The tests check that all 728 recipes get a name, that all 18 names can be made, that a name does not change when the amounts are scaled, and that no recipe is named for a colour more than 65 degrees away on the wheel from where its swatch really is.

### Targets, stars and hints

How close two colours look is the straight-line distance between them in OKLab, a space designed so equal distances look about equally different. A match must be within a tolerance of 0.06 on Little, 0.015 on Middle and 0.012 on Big. Within a quarter of the tolerance is 3 stars, within half is 2 stars and within the whole tolerance is 1. The closeness bar is 100 for an exact match and 75 right at the edge of a match, so 75 or more always means a match.

Every target is a mix you can make exactly, using no more than 8 drops of a paint, so 3 stars is always possible. On Little and Middle, the targets are far enough apart that a colour matching one can never match another, and no single plain paint ever matches a target. The hint aims at the multiple of the target recipe closest to your dish and closes the biggest gap one drop at a time. The tests start from every possible dish (729, counting the empty one) and every possible target, and check that following the hint always reaches the target in at most 24 steps without going outside 0 to 8 drops. The same seed always deals the same five targets, and two in a row never have the same shares.

## Limits

- Three paints and whole drops only: there is no white, black or "a little bit".
- The model is a simple one. Real paints behave in more complicated ways.
- Colour names are plain English guesses. People disagree about where Teal ends and Green begins.
- The best star totals and the colours you have found stay on this device. Clearing site data removes them.

Nothing is uploaded and there is no account. Everything runs locally in your browser.
