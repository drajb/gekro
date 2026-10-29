---
title: "Nonogram"
category: "fun"
job: "Play free Nonogram picture logic puzzles in three sizes with a daily puzzle. Every puzzle has one solution that logic alone will find, so you never have to guess."
description: "Free Nonogram picture puzzles in 5x5, 10x10 and 15x15 with a daily puzzle and explained hints. Every puzzle has one solution found by logic. No ads, no signup."
aiSummary: "A free browser Nonogram (picture logic puzzle) in 5x5, 10x10 and 15x15. A seeded generator draws a random picture, reads off the row and column clues, and keeps the picture only if a line solver can rebuild it from the clues alone. The solver only fills a cell that every possible arrangement of a clue agrees on, so a finished solve proves the answer is unique and reachable without guessing. The same seed always gives the same puzzle, which makes the daily puzzle identical for everyone with no server. Hints name the row or column they came from. Best times are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A Nonogram generator is easy to write badly: a random picture often has several valid answers, which turns a logic puzzle into a guessing game. This one throws away any picture its own line solver cannot finish, and the solver is small."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "🟦"
---

## How to play

Each number beside a row or above a column is the length of a run of filled cells in that line. A line with the clue **4 1** has a run of four filled cells, at least one gap, then a single filled cell. A **0** means the line is empty. Fill the grid until every row and every column matches its clue.

- **Fill** and **Mark X** set what a click or tap does. Mark X puts a cross on a cell you know is empty. Crosses are only a memory aid and are never needed to win.
- On a computer you can **drag** across a row or column to paint it. On a touch screen, tap one cell at a time.
- Keyboard: arrow keys move, **F** or **Space** fills, **X** marks, **Backspace** or **Delete** clears the cell, **M** switches Fill and Mark X, **U** undoes, **H** gives a hint.
- When a row or column already matches its clue, the clue is dimmed, crossed out and given a check mark. A line can match its clue and still sit in the wrong place, so this is a progress cue, not proof.
- **Check** reports how many lines match. **Show mistakes** compares your board with the answer and flags the cells that contradict it.

The puzzle is solved when every row and column matches its clue. That is judged by the clues, not by comparing with a stored picture. Because every puzzle has exactly one solution, the two are the same thing.

**Today's puzzle** is the same for everyone who picks the same size on the same date. There is no server: the date is turned into a seed, and the same seed always builds the same puzzle. It follows your own local date, so it changes at your midnight, not at a fixed time worldwide. **New random puzzle** uses a fresh seed, and the page address then contains that seed, so you can send a friend the exact puzzle.

## How it works

Making a Nonogram is easy. Making one that is fair is the interesting part.

1. A random picture is drawn from overlapping rectangles and ovals, a few holes are cut, one smoothing pass softens the edges, and about one cell in six is flipped so the picture is not just a handful of big blocks. A little over half of the cells end up filled.
2. The row and column clues are read off the picture.
3. A **line solver** tries to rebuild the picture from the clues alone. For one row or column it works out every way the clue could fit given what is already known, and fills in any cell that is the same in all of them. It sweeps every row and column, repeats, and stops when nothing changes.
4. The picture is kept only if the solver fills in every cell. If it gets stuck, a few cells in the stuck area are flipped and it tries again. If that fails, the picture is thrown away and a new one is drawn. After many failed attempts the generator falls back to a simple staircase picture, which the line solver can also finish.

Step 4 is the guarantee. The solver never writes a cell unless every possible arrangement agrees on it, so it can never be wrong. When it finishes, the finished picture is the only one that fits the clues, and each step you need is a deduction from a single line. No trial and error is ever required.

The per-line step is a small dynamic program. It records whether the first j blocks fit in the first i cells, and whether the remaining blocks fit in the cells from i on. A cell can be filled if some placement of a block covers it with both sides feasible, and empty if the blocks split cleanly around it. For a 15-cell line that is at most a couple of hundred table entries, so a full sweep of all 30 lines is cheap.

Hints use the same solver on what you have already got right. They pick a cell that one row or column forces, prefer a cell to fill over a cell to cross, and tell you which line and clue it came from. Cells you got wrong are ignored when the hint reasons, so it still works on a board with mistakes and ends up correcting them.

The test suite pins the claims above. The line solver is compared with a brute force over every arrangement on hundreds of random lines. Generated 5 x 5 puzzles are checked by exhaustive search to have exactly one solution, independent of the solver. At all three sizes, forty puzzles each are rebuilt by the line solver exactly. A 15 x 15 puzzle is tested to generate in under a second.

## Sizes

| Size | Cells |
|---|---|
| 5 x 5 | 25 |
| 10 x 10 | 100 |
| 15 x 15 | 225 |

Difficulty comes from size, not from a setting. There is no difficulty grading beyond that: a 10 x 10 can be quick or slow depending on the picture.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time per size is saved in your browser's local storage as a whole number of seconds, inside a small JSON object under one key. Only unaided solves count: using a hint on a puzzle means it will not set a best time. Clearing site data removes the times.

## Limits

- Sizes are 5, 10 and 15 square. There are no rectangular or colour puzzles.
- Difficulty is by size only. Puzzles are guaranteed to be solvable by single-line deductions, so they never need the harder two-line reasoning that large hand-made puzzles sometimes do.
- A 15 x 15 board is tight on a 375 px wide phone. The cells shrink to about 18 px and the clue text gets small. If the board is still wider than the screen it scrolls sideways inside its own box, and the page says so.
- Drag painting works with a mouse or pen. On a touch screen it is turned off so that scrolling the page keeps working, and you tap one cell at a time.
- The daily puzzle uses your local date, so two players in different time zones can briefly see different dates.
- Pictures are random shapes, not drawings, so a solved puzzle shows an abstract pattern rather than a recognisable image.

Everything runs locally in your browser.
