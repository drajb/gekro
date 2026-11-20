---
title: "Skyscrapers"
category: "fun"
job: "Play a free Skyscrapers puzzle, 4x4 to 6x6: fill each row and column once, using edge numbers that count the towers you can see."
description: "Free Skyscrapers puzzle from 4x4 to 6x6. Use edge numbers that count visible towers to fill every row and column once. Notes, hints, daily puzzle. No signup."
aiSummary: "A free browser logic puzzle. An n by n grid, n from 4 to 6, is filled with tower heights 1 to n so that every row and every column holds each height exactly once. A number on the edge says how many towers can be seen looking along that line from that side, because a taller tower hides every shorter one behind it. A few heights may be given. Every puzzle has exactly one solution. The generator starts from a random Latin square with every height given and every edge number shown, then removes clues in random order, keeping a removal only if a solver that checks each row and column against all orderings still finds exactly one solution. Easy leaves 30 percent of the squares as given heights and 85 percent of the edge numbers, Medium 12 and 65 percent, each rounded up, and Hard removes every clue it can. The solver is checked against a separately written counter, against the number of Latin squares of orders 3 and 4, and against the Stirling numbers that count orderings by towers visible. There is a daily puzzle seeded from the date, hints that say why, pencil notes and a check. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is that every puzzle is proven to have exactly one answer before you see it, and the number of ways to line up n towers so that k show is a known sequence the tests use as a check."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🏙️"
---

## How to play

Fill the grid with tower heights 1 to n, where n is the side length, so that every row and every column holds each height once. The number on an edge tells you how many towers you can see when you look along that row or column from that edge. A tall tower hides every shorter tower behind it, so only towers that stick out past all the ones in front of them count.

Two small examples. Looking along a row of four towers with heights 1, 2, 3, 4 you see all four. With heights 4, 3, 2, 1 you see only the first. So an edge number of 1 means the tallest tower stands right next to it, and an edge number equal to the grid size means the heights climb one by one away from that edge.

Pick a size (4x4 to 6x6) and a level (Easy, Medium or Hard); the level only changes how many clues are shown. **Today's puzzle** gives the same puzzle to everyone on the same date, for the size and level you chose. **New random puzzle** deals a fresh one, **Restart** resets this one, and the page address carries the seed so you can send a friend the exact puzzle.

Controls:

- Tap a square, then a number on the pad; tapping the same number clears it.
- **Notes** switches the pad to pencil marks. Placing a height removes it from the notes in the same row and column.
- **Erase** clears the square and **Undo** takes back the last change. On the keyboard, arrow keys move, a number key fills, **0** or **Backspace** erases, **N** switches notes, **U** undoes and **H** asks for a hint.
- **Show mistakes** is on to start with. A square that repeats a height in its row or column gets a dashed red border and a mark. An edge number that cannot be met any more gets a dashed red border too.
- **Check** marks wrong heights with a solid red border and a cross.
- **Hint** fills in one square and tells you why, or says so if one of your heights is wrong. A hint means no best time for that puzzle, even after a restart.

Each height is drawn as a block: the taller the tower, the taller the block, and each height also has its own colour and its digit. An edge number that is met turns solid green with a tick. Colour never works alone: the digit, the block height, borders and marks all say the same thing, and the key under the board lists them. Screen readers hear each square's position, height or notes, and the edge numbers that point along its row and column. Nothing flashes, and the win animation is off under reduced motion.

## How it works

### A few facts you can check by hand

The tests lean on counts that can be worked out independently:

- A Latin square is a grid where every row and column holds each height once. There are 12 of order 3 and 576 of order 4. The solver and a separately written counter both get these numbers.
- The number of orderings of the heights 1 to n that show k towers is a known sequence, the unsigned Stirling numbers of the first kind. For n = 4 it is 6, 11, 6, 1 for k = 1 to 4, for n = 5 it is 24, 50, 35, 10, 1, and for n = 6 it is 120, 274, 225, 85, 15, 1. The tests walk through every ordering and match these numbers.
- Put one edge number on one row of an empty 4x4 grid. Every first row is followed by exactly 24 completions, so the grid has 24 times as many solutions as there are first rows that show that many towers: 144, 264, 144 and 24 for edge numbers 1 to 4. The solver and the separate counter agree, on rows and on columns, from every side.

### Making a puzzle with one answer

1. A random Latin square is built by a depth-first search that tries heights in random order. Every height is given and every edge number is read off it. That has exactly one solution.
2. Given heights are taken away one at a time in random order, then edge numbers. After each removal the solver counts the solutions, stopping at two, and the removal is kept only if exactly one remains.
3. Easy and Medium stop when they reach a target. Hard goes on until nothing more can go.

Targets are rounded up. Easy keeps 30 percent of the squares as given heights and 85 percent of the edge numbers, which is 5, 8 and 11 given heights and 14, 17 and 21 edge numbers on 4x4, 5x5 and 6x6. Medium keeps 12 and 65 percent: 2, 3 and 5 given heights and 11, 13 and 16 edge numbers. Hard has no target. Over seeds 1 to 20 Easy and Medium always hit their targets, and Hard ranges as follows:

| Size | Heights given (Hard) | Edge numbers shown (Hard) |
|---|---|---|
| 4x4 | 0 to 2 | 2 to 5 |
| 5x5 | 0 to 3 | 5 to 9 |
| 6x6 | 1 to 5 | 7 to 14 |

A Hard puzzle is minimal: on 4x4 and 5x5 the tests take away each remaining clue in turn and confirm the puzzle then has more than one solution. The search uses node counts, not clocks, so a seed gives the same puzzle on every device, and the daily puzzle is a hash of the date, size and level.

### The solver

Every square keeps a list of heights it could still be. Every row and column keeps a list of the orderings that still fit its squares and its two edge numbers, and the squares are narrowed to the heights those orderings use. That one step covers both the repeat rule and the visibility rule. When nothing changes, the solver tries each height of the square with the fewest options. It stops after two solutions, or at a budget of nodes.

### Hints

A hint first looks for a square that is the last gap in its row or column, then for one next to an edge number of 1 or of n, then for one that the row, column and edge numbers leave with one height. If it finds none of these, it reveals a square.

### What the tests check

- The facts above, with the solver and the separate counter.
- The solver's count of solutions against the separate counter. They agree on 150 generated, thinned and deliberately broken puzzles of every size, including ones with no solution and ones with many.
- Every 4x4 and 5x5 puzzle checked has exactly one solution by the separate counter, and so do 6x6 puzzles for four seeds of each level. A hint is always the right height for an empty square, and following hints from a fresh puzzle fills in the whole answer.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser's local storage as small whole numbers in a small JSON object, and anything read back is checked before use. The only other state is the page address.

## Limits

- Sizes stop at 6x6.
- The score is time, which starts on your first change and pauses when the tab is hidden.
- The daily puzzle follows the date on your own device.
