---
title: "Cell Garden"
category: "fun"
job: "Plant flowers on a grid and watch them grow by one simple rule, with ready-made patterns, wrap-around edges and colours that show a flower's age."
description: "Free cellular automaton garden devised by John Conway in 1970. Draw, play, step, wrap the edges, plant gliders and more. No signup."
aiSummary: "A free browser garden for the cellular automaton John Conway devised in 1970. An empty square with exactly 3 flower neighbours grows a flower, a flower with 2 or 3 neighbours stays, and every other flower fades. The garden is 32 x 24, 48 x 36 or 72 x 54 squares, with plain edges or wrap-around edges, and runs at 2, 4 or 6 generations a second so no pattern flashes more than 3 times a second. One generation is computed from the last into a second array and lists only the squares that changed, so only those are repainted. Flowers are coloured by age, from sky to teal to green to amber. Nine ready-made patterns include a glider, a spaceship, a pulsar and a ten-bar that settles into a period of 15. The page keeps the last 12 generations and says so when the garden repeats within that window (periods 1 to 12, such as the blinker, toad, beacon and pulsar); it does not announce the ten-bar's longer period of 15. The engine is tested against an independent implementation on random boards and against known patterns. Nothing is stored or uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A tiny rule with no randomness in it still produces gliders, blinkers and patterns that run for hundreds of generations, and the tests check the rule against a second, plainer implementation."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🌼"
---

## How to play

The garden is a grid of squares. A square either has a flower or is empty. Press **Play** and the garden changes again and again, one generation at a time, all squares at the same moment. Each square has eight neighbours (the squares around it, corners included) and the rule is:

- A flower with **2 or 3** flower neighbours stays.
- An empty square with **exactly 3** flower neighbours grows a new flower.
- Every other flower fades: it was too lonely or too crowded.

That is the cellular automaton John Conway devised in 1970. There is no luck in it. The same garden always grows the same way.

**Drawing.** Press or drag on the garden with a mouse, a finger or a pen. If you start on an empty square you plant flowers; if you start on a flower you pick flowers. A fast drag never leaves gaps.

**Buttons.**

- **Play / Pause** starts and stops the garden. **Step** moves it forward by one generation.
- **Random** scatters flowers over the whole garden. **Clear** removes them all. **Restart** goes back to the little starting garden.
- **Ready-made pattern** and **Plant pattern** clear the garden and put one pattern in the middle. The choices are Glider, Spaceship, Blinker, Toad, Beacon, Pulsar, Block, Ten bar and Burst, each with a short note under the menu.
- **Garden size** is Small (32 x 24), Medium (48 x 36) or Large (72 x 54). **Speed** is Slow, Medium or Fast.
- **Wrap-around edges** joins the left edge to the right and the top to the bottom, so the garden is a ring in both directions. Without it, squares past the edge count as empty.

**Colours.** A flower is a round shape that starts sky blue and turns teal, then green, then amber as it ages: 1 to 2 generations, 3 to 6, 7 to 14, and 15 or more. The colour only shows age. A flower is always a round shape and an empty square is plain, so you never need the colours to tell them apart, and the key beside the garden lists the four stages in words.

**Keyboard.** Press Tab until the garden is selected. A square cursor appears. Arrow keys move it, Space or Enter plants or picks a flower, P plays or pauses and S takes one step. A status line says what happened. When the garden has settled into a pattern that repeats, or when every flower has faded, it tells you.

## How it works

The garden is a list of ages, one number per square: 0 for empty, and 1 to 255 for the number of generations a flower has lived. To make the next generation the page reads the old list and writes a new one, so every square is worked out from the garden as it was and not from half-updated neighbours. As it writes, it records which squares became alive, died, or moved to a new colour stage. Only those squares are repainted, and the canvas is sized to its on-screen box times the device pixel ratio, capped at 2.

The rule is checked against a second implementation written differently, with neighbours found by coordinate arithmetic and ages tracked on their own. They agree on every square, every age and every changed-square list across more than 3,000 generations of random boards, in both edge modes, on sizes from 3 x 3 up to the Large garden.

Known patterns are checked by what they do:

| Pattern | What happens |
|---|---|
| Block | never changes |
| Blinker, Toad, Beacon | repeat every 2 generations |
| Pulsar | repeats every 3 generations |
| Ten bar | after 2 generations settles into a pattern that repeats every 15 |
| Glider | moves one square along the diagonal every 4 generations |
| Spaceship | moves two squares sideways every 4 generations |
| Burst | five flowers that keep changing for at least 100 generations in the Large garden |

The tests confirm each period exactly, and that no earlier generation matches. On a ring, a glider on an 8 x 8 garden returns to its starting square after 32 generations. On a garden with plain edges, a glider runs into the wall and ends as a block.

The speeds are 2, 4 and 6 generations a second, and there is nothing faster. A blinker repeats every 2 generations, so at the fastest speed it flashes 3 times a second at most, which keeps the garden under the usual limit for flashing. When you ask for reduced motion, the page starts at the slowest speed.

To spot a garden that has settled, the page keeps the last 12 generations and compares each new one with them. If one matches, the garden repeats with that period and the page says so. If it matches the one just before, nothing changes any more, and the page pauses.

## Privacy and limits

Nothing is uploaded and nothing is stored. The size, speed and wrap setting are kept in the page address, so a link opens the same settings. The garden itself is not saved.

- The three sizes are fixed. The Large garden has 3,888 squares so that a phone keeps up.
- The pattern menu clears the garden before it plants. There is no undo.
- A garden that settles into a very long cycle is not reported, because only the last 12 generations are compared.
- On a small phone the Large garden has very small squares. Use Small or Medium for drawing details.
