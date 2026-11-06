---
title: "Tower Stack"
category: "fun"
job: "Play a timing game: drop a sliding block onto a tower, lose the overhang each time, and build as high as you can."
description: "Free tower-building timing game. Drop the sliding block, lose the overhang, land perfect drops to grow it back. Calm speed option. No signup."
aiSummary: "A free browser timing game. A block slides back and forth above a tower and you drop it with a tap, a click or the Space key. Whatever hangs over the edge of the floor below is cut off, so the next block is narrower. A drop whose left edge is within 1.5 units of the floor below (on a field 100 units wide) is perfect: nothing is cut and the block regrows by 2 units, up to its first width of 50. A drop that overlaps the tower by less than 1 unit misses and ends the game. The score is the number of floors. The block starts at 26 units a second and speeds up by half a unit a second per floor to a top speed of 60; Calm speed halves that and keeps its own best. The slide is a triangle wave of the distance travelled, the engine is deterministic with no random numbers, and tests check the cut against an independent whole-unit oracle, the edges of the perfect window, thousands of random games and 400 floors of perfect play. The best height in each speed is two small whole numbers in local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I like is how small the whole engine is: one triangle wave and one overlap sum, and every rule on this page is checked by a test."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🏗️"
---

## How to play

A block slides from side to side above your tower. Drop it so it lands on the floor below. Whatever hangs over the edge is cut off, so each block can only be as wide as the part that landed. Land it right on the edge below and nothing is lost.

- **Drop** by tapping or clicking the tower, or by pressing Space or Enter while the tower is selected. The first press starts the game; after that each press drops the block.
- **Score** is the number of floors you have built. Your best height is saved on your device.
- **Perfect drop.** If the left edge of your block is within 1.5 units of the edge below (the whole field is 100 units wide), the block snaps into line, nothing is cut, and the block grows back by 2 units, up to its first width of 50. A run of perfect drops builds a wide tower again.
- **Miss.** If the block lands with less than 1 unit on the tower, it falls past and the game ends. There is no timer and nothing else can end the game.
- **Calm speed** halves the sliding speed and keeps its own best height. It starts on if your device asks for reduced motion, and you can switch it only between games.
- **Pause** stops the block (or press P). The game also pauses by itself when you switch to another tab, and stays paused until you press Resume.
- **Sound** is off until you turn it on. When it is on, each drop makes one short, quiet tone. Perfect drops climb a five-note scale as the run grows; a trim is lower; a miss falls.
- After a miss, the next press waits a short moment before it starts a new game, so a late tap does not wipe your result by accident.

The colours cycle through six hues as the tower rises. They carry no meaning. A perfect floor has a pale edge along its top, so you can see them without relying on colour, and the status line under the tower says what each drop did.

**Keyboard and screen readers.** Tab to the tower; it is one large button whose label says what the next press does and how tall the tower is. Space and Enter drop the block, P pauses. Every drop is announced: "Perfect! 3 perfect drops in a row. 14 floors high, block back to 50 wide." The buttons below the tower are 56 pixels tall.

**Reduced motion.** With reduced motion on, the cut piece does not fall, the camera does not glide, and the perfect ring is left out. The block still slides, because sliding is the game, which is why Calm speed is there.

## How it works

**The slide.** The block's left edge is a triangle wave of the distance it has travelled: it runs from 0 to the range (the field minus the block's own width), turns, and runs back. Each floor it enters from the opposite side. The page tells the engine how many seconds passed, never more than 0.05 at a time, so a slow frame cannot throw the block across the tower. The tests check that the block never leaves the field, reaches both ends, and never moves faster than its speed allows.

**Speed.** The first floor slides at 26 units a second. Each floor adds half a unit a second, up to 60, which is reached at floor 68. Calm speed multiplies that by one half, so it runs from 13 to 30.

**The cut.** When you drop, the engine takes the overlap of the block and the floor below: the higher of the two left edges up to the lower of the two right edges. That overlap is the new floor, and the rest is the piece that falls. The tests compare this with an independent oracle that lists the whole units covered by each block and intersects the two sets, over 600 drops, and check that the kept part and the cut part always add up to the block's width.

**Perfect and miss.** The perfect window is tested on both sides: a drop 1.5 units off is perfect and 1.51 is a trim. A perfect floor is placed exactly over the one below, widened by 2 units (1 unit on each side), kept inside the field and never past 50. A miss is an overlap under 1 unit, and tests check 0.5 units is a miss and exactly 1 unit is a trim.

**No random numbers.** The engine uses none. The game number picks only the colour the first block starts on, so the same drops always build the same tower, and a test plays the same game twice to prove it.

| Fact | Value | Checked by |
|---|---|---|
| Field width | 100 units | constant test |
| First block | 50 units | constant test |
| Perfect window | 1.5 units | edge tests on both sides |
| Regrowth | 2 units | perfect-run test, capped at 50 |
| Miss | under 1 unit of overlap | boundary test |
| Speed | 26, plus 0.5 per floor, to 60 | speed test |
| Perfect play | 400 floors, block stays 50 wide | bot test |
| Random games | 3,000, every invariant held | fuzz test |

## What is stored

Two small whole numbers, from 0 to 9,999: your best height at the normal speed and at Calm speed. They live in your browser's local storage in a small object. Anything else found there is ignored: the loader reads only those two keys, rejects anything that is not a whole number in range, and builds a new object. Nothing is sent anywhere, and the page works if storage is blocked. Clearing site data resets your best heights.
