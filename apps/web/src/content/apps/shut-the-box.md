---
title: "Shut the Box"
category: "fun"
job: "Play Shut the Box, the dice game of shutting numbered tiles, solo or in a three-box race against the computer, with a hint from an exact solver."
description: "Free Shut the Box game: roll the dice and shut tiles 1 to 9 that add up to the roll. Solo or race the computer, with hints. No ads. No signup."
aiSummary: "A free browser version of the traditional dice game Shut the Box. Nine tiles start open. Roll two dice (one die once tiles 7, 8 and 9 are all shut), then shut any set of open tiles that adds up to the roll. When no set adds up the box is stuck and the score is the sum of the open tiles, lower being better; shutting all nine scores 0. Play a solo box or a race of three boxes each against the computer at three levels. The engine solves all 512 positions exactly: for each it finds the best average final score and the best chance of shutting the box. A fresh box has an average final score of 11.66 with best play for a low score, and a 7.4 percent chance of being shut completely with best play for shutting. The solver is checked against an unmemoised brute-force search and against 20,000 simulated games. Best scores are saved in the browser only."
personalUse: "Anyone is welcome to play and learn with this, with no ads. Every possible position of the box fits in a table of 512 numbers, so the Hard player and the hint do not guess: they look up the exact best choice, and the tests check that table by brute force."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

Nine tiles numbered 1 to 9 start open. On your turn press **Roll the dice**. Choose open tiles that add up to the total of the roll and press **Shut tiles**. Then roll again.

- You roll **two dice** while any of tiles 7, 8 or 9 is open. Once all three are shut, you roll **one die**.
- A roll can be made in more than one way. A total of 9, for example, can be the tile 9, or 1 and 8, or 4 and 5, or 2, 3 and 4. The page tells you how many ways exist.
- If no set of open tiles adds up to the roll, the box is stuck. Your score is the sum of the tiles still open, so **lower is better**.
- Shut all nine tiles and the score is **0**: you have shut the box.

Pick **Solo box** to play one box and beat your best, or **Race the computer** to play three boxes each. The lowest total over the three boxes wins. A race has three computer levels: Easy, Medium and Hard.

**Hints.** The Hint button shows the best set of tiles for the current roll with a star and a dashed green frame, and says what your average final score would be from there. A box where you used a hint still counts as played, but it never counts as a best score, and a race with a hint is not counted in your wins.

**Controls.** Tap tiles to choose them. From the keyboard, press **1 to 9** to choose a tile, **S** to shut the chosen tiles, **R** to roll, **H** for a hint and **C** or **Escape** to clear your choice. The arrow keys move between tiles, and Enter or Space on a focused tile chooses it. Chosen tiles show a tick, shut tiles are crossed out and striped, so colour is never the only signal. The status line says what happened after every roll and shut. Dice tumble only if your system allows motion, and sound is off until you press the sound button.

## How it works

Every position in this game is a set of open tiles, and a move only ever shuts tiles. So the value of a position depends only on smaller sets, and the whole game can be solved in one pass, smallest set first. For each of the 512 sets the solver adds up every possible roll (the 11 two-dice totals with their chances out of 36, or the six one-die totals), tries every set of tiles that adds up to the roll, and keeps the best. It records two things for each position: the average final score when you always shut for a low score, and the chance of shutting the box when you always shut for that.

- **Hard** and the hint use the first table: they pick the set that leaves the lowest average final score.
- **Medium** shuts the set containing the highest tiles, the usual rule of thumb.
- **Easy** picks any set that adds up, at random.

## What the tests check

| Claim | How it is checked |
|---|---|
| The list of tile sets for a roll is complete | Compared with a plain recursive enumeration for every position and many totals. A full box and a roll of 9 has exactly 8 ways. |
| The solver is exact | Compared with an unmemoised search over every ordered pair of dice on every position with up to four open tiles (and more), to nine decimal places. |
| A fresh box averages 11.66 | The table says 11.66. A simulation of 20,000 Hard games stays within 0.35 of it. |
| The best chance of shutting the box is 7.4 percent | The table says 7.4 percent. A simulation of 20,000 games that always play for it stays within 1.2 points. |
| Hard beats Medium beats Easy | 6,000 boxes each from the same seeds, ranked by average score. |
| Bad choices change nothing | Wrong sums, shut tiles, empty and out-of-range choices are refused and leave the box as it was. |
| Games always end | 4,000 random games, each finishing in at most 10 rolls with a score equal to the sum of the open tiles. |

## Storage and privacy

Your best score and a few counts (boxes played, boxes shut, races played and won) are small whole numbers kept in your browser under one key. The page address holds the mode, level and game number, so a shared link replays the same dice. Nothing is uploaded and there is no account.

## Limits

- The nine-tile box only. There are no larger boxes and no other scoring variants.
- A race is three boxes each, and ties are shared.
- The 11.66 and 7.4 percent figures are for this page's rules, in particular rolling one die once 7, 8 and 9 are all shut. Other rule sets give other numbers.
