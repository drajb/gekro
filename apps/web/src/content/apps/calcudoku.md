---
title: "Calcudoku"
category: "fun"
job: "Play a free arithmetic grid puzzle from 4x4 to 6x6: fill each row and column with 1 to n once so every outlined cage reaches its target. One solution each."
description: "Free Calcudoku puzzle from 4x4 to 6x6. Fill rows and columns with 1 to n once so each cage reaches its target. Notes, hints, daily puzzle. No signup."
aiSummary: "A free browser logic puzzle. An n by n grid, n from 4 to 6, is filled with the digits 1 to n so that no digit repeats in any row or column. The grid is cut into outlined cages, each showing a target and an operation (add, subtract, multiply or divide); the digits in a cage must reach the target, a subtraction or division cage has two squares, and a cage of one square is a fixed digit. A digit may repeat inside a cage only when no row or column joins the two squares. Every puzzle has exactly one solution. The generator starts from a random Latin square, cuts the grid into random cages, reads each target off the square and runs a constraint solver; whenever the solver finds a second solution, one square where the two differ becomes a fixed digit, until exactly one is left. Medium and Hard then try to fold fixed digits back into neighbouring cages, keeping a change only if the solution stays unique. The solver is checked against two separately written counters, a full enumeration of Latin squares of orders 3 to 5 and a square-by-square search for all sizes. There is a daily puzzle seeded from the date, hints that say why, pencil notes and a check. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is that every puzzle is repaired until it has exactly one answer, and the solver is checked against two counters written separately from it, one of which tries every Latin square."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "➗"
---

## How to play

Fill the grid with the digits 1 to n, where n is the side length, so that every row and every column holds each digit once. The grid is cut into **cages**, groups of neighbouring squares drawn with a thick outline. In the top-left corner of each cage is a target and a sign:

- **+** the digits in the cage add up to the target.
- **x** the digits multiply to the target.
- **-** the cage has two squares and their difference is the target. The order does not matter.
- **division** the cage has two squares and the larger divided by the smaller is the target.

A cage of one square shows no sign. It is a fixed digit, already filled in, drawn bold in a box. Inside a cage a digit may repeat only if no row or column passes through both squares, for example the two ends of an L-shaped cage.

Pick a size (4x4 to 6x6) and a level (Easy, Medium or Hard). **Today's puzzle** gives the same puzzle to everyone on the same date, for the size and level you chose. **New random puzzle** deals a fresh one, **Restart** resets this one, and the page address carries the seed so you can send a friend the exact puzzle.

Controls:

- Tap a square, then a number on the pad; tapping the same number clears it.
- **Notes** switches the pad to pencil marks. Placing a digit removes it from the notes in the same row and column.
- **Erase** clears the square and **Undo** takes back the last change. On the keyboard, arrow keys move, a number key fills, **0** or **Backspace** erases, **N** switches notes, **U** undoes and **H** asks for a hint.
- **Show mistakes** is on to start with. A square that repeats a digit in its row or column is striped and gets a mark. A cage whose digits can no longer reach the target gets a dashed red label.
- **Check** marks wrong digits with a red frame and a cross.
- **Hint** fills in one square and tells you why, or says so if one of your digits is wrong. A hint means no best time for that puzzle, even after a restart.

A cage that is met gets a solid green label with a tick. Cages are also tinted in four soft colours so neighbours look different, but the tint carries no meaning: the thick lines do. Colour never works alone; the key under the board lists every mark. Screen readers hear each square's position, digit or notes, and the cage it belongs to in words, such as "cage of 2 squares, adds up to 7". Nothing flashes, and the win animation is off under reduced motion.

## How it works

### Facts you can check by hand

- A Latin square is a grid where every row and column holds each digit once. The tests build every one by plain enumeration and find 12 of order 3, 576 of order 4 and 161,280 of order 5.
- Put a single two-square cage in the top row of an empty 4x4 grid. Each choice of the two digits leaves exactly 48 completed squares, so the number of squares is 48 times the number of digit pairs that fit. A sum of 3 fits 2 pairs, a quotient of 2 fits 4, a difference of 3 fits 2, a product of 12 fits 2 and a difference of 1 fits 6: that is 96, 192, 96, 96 and 288 squares. The tests count these on the enumeration.
- The number of ways to fill a cage is checked by hand on small cases. On a 6x6 grid a difference of 1 in two neighbouring squares fits 10 pairs, a quotient of 2 fits 6 and a product of 12 fits 4. An L-shaped cage of three squares adding to 6 on a 4x4 grid fits 7, one of which is 1, 4, 1, because the two squares at the ends of the L share no row or column.

### Making a puzzle with one answer

1. A random Latin square is built by a depth-first search that tries digits in random order.
2. The grid is cut into connected groups. Easy mostly uses cages of 1 to 3 squares, Medium of 1 to 4, and Hard mostly cages of 2 to 4. Each group gets an operation chosen at random from those that fit its size and digits, and a target worked out from the square.
3. The solver counts the solutions, stopping at two. If it finds a second one, a square where the two differ is cut out of its cage and becomes a fixed digit. That removes the second solution, and the solver runs again. When every square is fixed there is only one solution, so this always ends.
4. Medium and Hard then walk the fixed digits in random order and try to fold each into a neighbouring cage, keeping the change only if the solver still proves exactly one solution. Medium stops at about an eighth of the squares as fixed digits (2, 3 and 5 on 4x4, 5x5 and 6x6), and Hard goes on as far as it can.

Search limits are counts of nodes, never clocks, so a seed gives the same puzzle on every device. The daily puzzle is a hash of the date, size and level.

Over seeds 1 to 20 the puzzles come out like this:

| Size and level | Fixed digits | Cages | Largest cage |
|---|---|---|---|
| 4x4 Easy | 1 to 9 | 8 to 12 | 3 |
| 4x4 Medium | 1 to 2 | 6 to 8 | 4 |
| 4x4 Hard | 0 to 3 | 5 to 7 | 4 |
| 5x5 Easy | 2 to 14 | 11 to 19 | 3 |
| 5x5 Medium | 1 to 3 | 9 to 12 | 4 |
| 5x5 Hard | 0 to 3 | 8 to 11 | 4 |
| 6x6 Easy | 5 to 14 | 18 to 24 | 3 |
| 6x6 Medium | 2 to 5 | 14 to 18 | 4 |
| 6x6 Hard | 0 to 3 | 11 to 14 | 4 |

### The solver

Every square keeps a set of digits it could still be. A square down to one digit is removed from the rest of its row and column, and a digit with only one square left in a row or column goes there. Every cage keeps a list of the digit combinations that still fit its squares, and each square is narrowed to the digits those combinations use. When nothing changes, the solver tries each digit of the square with the fewest options. It stops after two solutions, or at a budget of nodes.

### Hints

A hint first looks for a square that is the last gap in its row or column, then for the last empty square of a cage, then for a square where the cage and the digits already in it leave only one choice, then for one that the row, column and cages leave with a single digit. If it finds none of these, it reveals a square.

### What the tests check

- The facts above, on the plain enumeration, the square-by-square counter and the solver.
- The solver's count of solutions against both counters. They agree on 120 random cage layouts of orders 3 and 4, including ones with no solution and ones with many, and on 24 layouts of orders 5 and 6.
- Every 4x4 and 5x5 puzzle checked has exactly one solution by the independent counter, and so do 6x6 puzzles for six seeds of each level. A hint is always the right digit for an empty square, and following hints from a fresh puzzle fills in the whole answer.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser's local storage as small whole numbers in a small JSON object, and anything read back is checked before use. The only other state is the page address.

## Limits

- Sizes stop at 6x6.
- The score is time, which starts on your first change and pauses when the tab is hidden.
- The daily puzzle follows the date on your own device.
