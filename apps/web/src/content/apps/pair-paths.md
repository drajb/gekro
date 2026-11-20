---
title: "Pair Paths"
category: "fun"
job: "Play a free path puzzle: join each pair of matching dots across a grid so that no paths cross and every cell is used. Three sizes, a daily puzzle, a hint and a check."
description: "Free Pair Paths puzzle on a 4x4, 5x5 or 6x6 grid. Join matching dots with paths that never cross and fill every cell. One answer each. No signup."
aiSummary: "A free browser puzzle on a 4x4, 5x5 or 6x6 grid with 4, 5 or 6 pairs of matching dots. The player draws a path between the two dots of every pair. Paths run through neighbouring cells, never cross and never share a cell. By default every cell must also be used; an option turns that rule off. Pairs are told apart by colour and by a shape drawn on the dot. Each puzzle is made by cutting a random path that visits every cell into pieces and placing a dot on both ends of each piece, then an exact search counts the ways to join the pairs and the puzzle is kept only when the count is exactly one. Tests compare that search with a second, independent search that decides edges cell by cell, on many generated puzzles of every size and on random dot layouts that the generator never made. The same seed always gives the same puzzle, and the daily puzzle comes from the local date. A hint draws one pair along the only answer, and Check outlines finished paths that cannot be part of it. Best times per size stay in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I find interesting is that a small search can prove a puzzle has exactly one answer, so every board on the page can be solved by reasoning alone and no guessing is ever needed."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔗"
---

## How to play

The board is a square grid with pairs of dots. Each pair has its own colour and its own shape: circle, square, triangle, diamond, star, plus or hexagon. Join the two dots of every pair with a path through neighbouring cells. Paths turn at right angles, never go diagonally, never cross and never share a cell. With the default rule, **Fill every cell**, the finished board has no empty cell left.

Press on a dot and drag to draw. Drag back over your own path to make it shorter. If you draw over a different path, that path is cut off just before the cell you took, so you can reroute without erasing anything first. You cannot draw through another pair's dot. Tap a dot to start that pair again from scratch.

Pick a size from 4 x 4 (four pairs) to 6 x 6 (six pairs). **New puzzle** deals a fresh board, **Today's puzzle** gives the puzzle for your local date at the chosen size, **Restart** clears the board, and **Undo** takes back the last stroke. The page address holds the size and the seed, so you can send someone the exact puzzle.

**Hint** draws one pair, the one with the shortest route, the way the only answer joins it. It marks the puzzle as helped, and a helped puzzle does not set a best time. **Check** outlines any finished path that cannot be part of the answer. It does not mark the puzzle as helped, so it is a way to find a slip without being told the answer. Switch the fill rule off if you only want to join the pairs. Then more than one way can be right, Check is not available, and best times are not recorded.

**What you see.** The key beside the board lists each pair with its colour name, its shape and whether it is joined yet. Colour never works alone: every dot carries its shape, and a joined pair gets a bold ring around its dots. Above the board you can see how many pairs are joined, how many cells are used, a quiet clock that starts with your first stroke and pauses when the tab is hidden, and your best time for the size.

**Keyboard.** Arrow keys, Home and End move the cursor. Enter or Space picks up the dot or path under the cursor, then the arrow keys draw it, and Enter puts it down. Moving back along your path shortens it. Backspace clears the path under the cursor, **U** undoes a stroke, **H** gives a hint and **C** checks. The keys only work while the focus is on the board. Screen readers get a description of every cell ("Row 2, column 3: path of the blue circle") and a sentence after each stroke.

## How it works

**Puzzles are grown from a finished answer.** The generator makes a random path that visits every cell once. It starts from a snake that runs along the rows and then repeatedly joins one end of the path to a neighbouring cell and flips the stretch in between, which keeps it a single path through every cell. It cuts that path into as many pieces as the size has pairs, each piece at least three cells long, and puts a dot on both ends of each piece. The pieces are one way to join the pairs, but not necessarily the only way.

**An exact search keeps only puzzles with one answer.** The search grows one pair's path at a time, always the pair with the fewest choices. It drops a position as soon as an empty cell cannot get two path neighbours, or as soon as a pair can no longer reach its other dot through empty cells. It counts answers and stops at two. The generator keeps a puzzle only when the count is exactly one, and otherwise cuts again. The number of tries is capped by a count, not by the clock, so a seed gives the same puzzle on every device. If every try failed, a built-in puzzle for that size is used, and the tests check that one too.

**The hint and the check use that answer.** Because the answer is unique, a finished path that differs from it can never be part of a full solution, which is what Check relies on.

## What the tests check

- The seeded random numbers match a second implementation, and the random path always visits every cell exactly once.
- For 60 seeds at 4 x 4, 40 at 5 x 5 and 12 at 6 x 6, the generated puzzle has exactly one answer according to a second search that does not grow paths at all. It picks which neighbours each cell is joined to, forbids loops, and checks that every chain joins the two dots of one pair.
- On 300 random dot layouts at 4 x 4 and 60 at 5 x 5, layouts the generator never made, the engine and the second search report the same number of answers, including zero.
- The same seed gives the same puzzle, and the built-in fallback puzzles have one answer too.
- Drawing, stepping back, cutting another path, refusing another pair's dot and refusing to extend a joined path behave as described above. 4000 random drawing steps never leave two paths on one cell or a gap in a path.
- Drawing the hint's pairs one after another always ends on a solved board, and Check lists exactly the finished paths that differ from the answer.
- A saved best time is accepted only as a whole number of seconds from 1 to 359999 for a known size. Anything else is ignored.

## Limits

- Sizes stop at 6 x 6. Larger boards are much slower to generate with a guarantee of one answer.
- With the fill rule off the puzzle may have many answers, so the hint, Check and best times are tied to the fill rule.
- The daily puzzle is the same for everyone in the same time zone on the same day and size, but it is not fetched from anywhere. It is computed on your device from the date.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your best times stay on your device.
