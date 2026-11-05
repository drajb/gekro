---
title: "Binary Puzzle"
category: "fun"
job: "Play a free two-symbol logic puzzle on 6x6, 8x8 or 10x10 grids. Every puzzle has exactly one solution, and hints explain the rule they use."
description: "Free Binary Puzzle: fill the grid with circles and squares, no three alike in a row, equal counts, no repeated lines. Hints and one solution. No signup."
aiSummary: "A free browser logic puzzle. A grid of 6x6, 8x8 or 10x10 squares is filled with two symbols, a circle and a square, under three rules: no three equal symbols in a row across or down, every row and column holds exactly half of each symbol, and no two rows or two columns are identical. Puzzles are made by taking clues away from a full valid grid in random order, keeping a removal only if a constraint-propagation solver still finds exactly one solution; an independently written row-by-row counter confirms that every generated puzzle has one answer. There are 72 valid 4x4 grids and 4,140 valid 6x6 grids, counted both by the solver and by brute force. Easy keeps 20, 36 or 55 clues, Medium 16, 27 or 42, and Hard removes every clue it can (6 to 11 clues on 6x6, 12 to 18 on 8x8, 18 to 25 on 10x10 over seeds 1 to 30). Hints name the rule used. Best times are kept in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The interesting part is that every puzzle is checked to have one answer, so it can always be solved by reasoning and never by guessing, and the hints say which rule they use."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔵"
---

## How to play

Fill every square with a circle or a square so that three rules hold:

1. **No three alike in a row.** You may not have three circles or three squares side by side, across or down.
2. **Equal counts.** Every row and every column has exactly half circles and half squares. On a 6x6 grid that is three of each.
3. **No repeats.** No two rows are the same and no two columns are the same.

Some squares are already filled in. They have a thick border and cannot be changed. Everything else starts empty. Tap an empty square to put a circle in it, tap again for a square, and once more to clear it. The three buttons under the board (Circle, Square, Clear) set the selected square directly.

Pick a size (6x6, 8x8 or 10x10) and a level (Easy, Medium or Hard). The level only changes how many squares are given. **New puzzle** deals a fresh one, **Restart** resets this one, and the page address carries the seed so you can send a friend the exact puzzle.

Controls:

- Arrow keys move around the board. **1** puts a circle, **2** puts a square, **0** or **Backspace** clears. **U** undoes the last change and **H** asks for a hint. Enter and Space cycle the square, like a tap.
- **Show mistakes** is on to start with. A square that breaks a rule gets a dashed red border and a small mark. Turn it off if you want to find mistakes yourself.
- **Check** marks wrong squares with a solid red border and a cross.
- **Hint** fills in one square that the rules force and names the rule, or says so if one of your squares is wrong. A puzzle where you used a hint does not count toward your best time, even after a restart.

The two symbols differ in shape, not only in colour. A circle is a sky-blue disc and a square is an amber rounded square. Given squares are marked by border thickness, rule breaks by a dashed border and a mark, and hints by a diamond. Screen readers hear each square's row, column, symbol and state, and a short sentence after each change. Nothing flashes, and the win animation is off under reduced motion.

## How it works

### Making a puzzle with one answer

A puzzle with exactly one solution can always be reasoned out. The generator works backwards from a finished grid:

1. A solver builds a full grid that obeys all three rules, trying the two symbols in random order at each branch.
2. Clues are taken away one at a time in random order. After each removal the solver counts the solutions, stopping at two. The removal is kept only if there is still exactly one.
3. Easy and Medium stop when they reach their clue target. Hard keeps going until no clue can be taken away.

| Level | 6x6 | 8x8 | 10x10 |
|---|---|---|---|
| Easy (clues kept) | 20 | 36 | 55 |
| Medium (clues kept) | 16 | 27 | 42 |
| Hard (clues left, seeds 1 to 30) | 6 to 11 | 12 to 18 | 18 to 25 |

A Hard puzzle is minimal: the tests take away each remaining clue in turn and confirm that the puzzle then has more than one solution.

### The solver

The solver uses the rules to force squares before it ever guesses. Two equal neighbours force the squares at both ends. Two equal squares with a gap between force the gap. A row or column that already holds half of one symbol is filled with the other. A line with two squares left may not end up a copy of a finished line. When nothing more is forced it tries a symbol in the most constrained line and carries on. It stops after two solutions, or when it has used a budget of nodes, in which case the puzzle is not treated as unique.

### What the tests check

- The rules checker agrees with a separately written checker on all 65,536 possible 4x4 grids. Exactly 72 of them are valid.
- The same count is reached by three routes for the empty 6x6 grid: the solver, a row-by-row counter that shares no code with it, and a brute-force run through every combination of valid rows. All three give **4,140** valid grids.
- On hundreds of random partly filled grids, including ones with no solution and ones with many, the solver and the row-by-row counter give the same number of solutions.
- Every generated puzzle of every size and level has exactly one solution according to the independent counter, and its clues match the stored answer.
- A hint is always a correct square. The tests also check that each rule the hints name is sound: the square it forces has the same value in every solution of the board it was found on. Following hints from a fresh puzzle fills the whole grid with the right answer.

### Hints in order

A hint tries the simplest idea first: a pair, then a gap, then a full count, then a line that would copy another, and last a square where one symbol breaks a rule a few forced steps later. If none of those applies, which was rare in testing, it reveals a square.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser's local storage as small whole numbers in a small JSON object, and anything read back is checked before use. The only other state is the page address.

## Limits

- Hints and the Check button only work because the puzzle has a stored answer. Pasting in your own grid is not offered.
- The score is time, which starts on your first change and pauses when the tab is hidden.
- The 10x10 board has the smallest squares, so on a very narrow screen the 6x6 and 8x8 boards are easier to tap.
- Levels describe how many squares are given, not how deep the reasoning is.
