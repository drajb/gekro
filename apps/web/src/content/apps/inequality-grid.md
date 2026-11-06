---
title: "Inequality Grid"
category: "fun"
job: "Play a free digit-grid puzzle from 4x4 to 7x7: fill each row and column with 1 to n once, using greater-than signs and a few given digits. One solution each."
description: "Free Inequality Grid puzzle from 4x4 to 7x7. Use greater-than signs and given digits to fill every row and column once. Notes, hints, one solution. No signup."
aiSummary: "A free browser logic puzzle. An n by n grid, n from 4 to 7, must be filled with the digits 1 to n so that every row and every column holds each digit exactly once (a Latin square). Signs between neighbouring squares say which one is larger, and a few digits are given. Every puzzle has exactly one solution. The generator starts from a random Latin square with every digit and every sign shown, then removes clues in random order, keeping a removal only if a constraint-propagation solver still finds exactly one solution; Easy leaves 30 percent of the squares as given digits and 75 percent of the signs, Medium 12 and 55 percent, each rounded up, and Hard removes every clue it can. The solver is checked against known counts of Latin squares (2, 12, 576 and 161,280 of orders 2 to 5), against exact halving and quartering facts, and against an independently written counter. Hints say why a digit goes where it does. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is that every puzzle is checked to have exactly one answer, so it can always be solved by reasoning, and the solver is tested against facts about Latin squares that can be counted by hand."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔢"
---

## How to play

Fill the grid with the digits 1 to n, where n is the side length, so that every row and every column holds each digit once.

Between some neighbouring squares there is a sign, an arrowhead that points at the **smaller** of the two squares, so its open side faces the larger one. A sign pointing right means the left square is bigger; pointing down means the top square is bigger. A few digits are given, with a thick border and a bold digit, and cannot be changed.

Pick a size (4x4 to 7x7) and a level (Easy, Medium or Hard); the level only changes how many clues are shown. **New puzzle** deals a fresh one, **Restart** resets this one, and the page address carries the seed so you can send a friend the exact puzzle.

Controls:

- Tap a square, then a number on the pad; tapping the same number clears it.
- **Notes** switches the pad to pencil marks. Placing a digit removes it from the notes in the same row and column.
- **Erase** clears the square and **Undo** takes back the last change. On the keyboard, arrow keys move, a number key fills, **0** or **Backspace** erases, **N** switches notes, **U** undoes and **H** asks for a hint.
- **Show mistakes** is on to start with. A square that repeats a digit in its row or column, or sits at either end of a false sign, gets a dashed red border and a mark, and the false sign turns red.
- **Check** marks wrong digits with a solid red border and a cross.
- **Hint** fills in one square and tells you why, or says so if one of your digits is wrong. A hint means no best time for that puzzle, even after a restart.

A complete, correct row glows green with a tick, and a true sign between two filled squares turns green too. Colour never works alone: signs are shapes that point, given digits are bold with a thick border, rule breaks have a dashed border and a mark, and hints have a diamond. Screen readers hear each square's position, digit or notes, and what it must be larger or smaller than. Nothing flashes, and the win animation is off under reduced motion.

## How it works

### A few facts you can check by hand

A grid where every row and column holds each digit once is a Latin square. The solver counts 2 of order 2, 12 of order 3, 576 of order 4 and 161,280 of order 5, the known numbers; an independently written counter also reaches 576 for order 4. Two small facts give exact answers to check against:

- One sign between two neighbouring squares of a 4x4 grid leaves exactly half of the 576 grids: 288. Swapping the two columns it sits between flips the sign in every grid, so the halves match.
- One digit fixed in one square leaves exactly a quarter: 144, because the four digits are interchangeable.

### Making a puzzle with one answer

1. A random Latin square is built by a depth-first search that tries digits in random order, with every digit given and every sign shown. That has exactly one solution.
2. Given digits are taken away one at a time in random order, then signs. After each removal the solver counts the solutions, stopping at two, and the removal is kept only if exactly one remains.
3. Easy and Medium stop when they reach a target. Hard goes on until nothing more can go.

Targets are rounded up: Easy keeps 30 percent of the squares as digits and 75 percent of the possible signs, Medium 12 and 55 percent. That is 5, 8, 11 and 15 given digits on 4x4 to 7x7 for Easy, and 2, 3, 5 and 6 for Medium. Hard has no target. Over seeds 1 to 20 Easy and Medium always hit their targets, and Hard ranges as follows:

| Size | Digits given (Hard) | Signs shown (Hard) |
|---|---|---|
| 4x4 | 0 to 4 | 1 to 6 |
| 5x5 | 0 to 2 | 7 to 12 |
| 6x6 | 0 to 3 | 10 to 19 |
| 7x7 | 0 to 4 | 20 to 29 |

A Hard puzzle is minimal: on 4x4, 5x5 and 6x6 the tests take away each remaining clue in turn and confirm the puzzle then has more than one solution. Digits go first, so Hard puzzles lean on the signs.

### The solver

Every square keeps a list of digits it could still be. A square down to one digit is removed from the rest of its row and column, and a digit with only one square left in a row or column goes there. A sign narrows both ends: the larger square must beat the smallest the other could be, and the smaller must fall short of the largest. When nothing changes, the solver tries each digit of the square with the fewest options. It stops after two solutions, or at a budget of nodes.

### Hints

A hint first looks for a square that is the last gap in its row or column, then for one that the row, column and signs leave with one digit. If it finds neither, it reveals a square.

### What the tests check

- The Latin square counts above, and the halving and quartering facts, with the solver and, for order 4, the independent counter.
- The solver's count of solutions against the independent counter. They agree on 160 generated, thinned and deliberately broken puzzles of every size, including ones with no solution and ones with many.
- Every generated puzzle has exactly one solution by the independent counter, and a hint is always the right digit for an empty square. Following hints from a fresh puzzle fills in the whole answer.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser's local storage as small whole numbers in a small JSON object, and anything read back is checked before use. The only other state is the page address.

## Limits

- Sizes stop at 7x7.
- The score is time, which starts on your first change and pauses when the tab is hidden.
- On a 7x7 board the sign arrowheads and pencil notes are small. They are easier to read on a wider screen.
