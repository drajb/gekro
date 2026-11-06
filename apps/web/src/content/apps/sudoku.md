---
title: "Sudoku"
category: "fun"
job: "Play free Sudoku in three difficulties with a daily puzzle, pencil notes and hints that explain themselves. Every puzzle has exactly one solution."
description: "Free Sudoku with a daily puzzle, three levels, pencil notes and explained hints. Every puzzle has one solution. No ads, no signup, runs in your browser."
aiSummary: "A free browser Sudoku. A seeded generator fills a random valid grid, removes digits in mirror-image pairs, and keeps each removal only if a solver still finds exactly one solution, so every puzzle is guaranteed unique. The same seed always gives the same puzzle, which makes the daily puzzle identical for everyone with no server. It has pencil notes, undo, a mistake checker, and hints that name the technique (naked single or hidden single). Best times are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A generator, a solver and a board in one small engine with its own tests. Every puzzle is checked to have exactly one answer before you see it."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🔢"
---

## How to play

Fill every row, column and 3 x 3 box with the digits 1 to 9, each exactly once. Pick a cell and a number, or type with the keyboard: arrow keys move, 1 to 9 fill the cell, Backspace erases, **N** switches pencil notes on and off, **U** undoes, **H** gives a hint. Repeating a number on its own cell clears it.

Pencil notes are small candidate digits. Placing a number, or taking a hint, removes that number from the notes of every cell that shares its row, column or box, so your notes stay honest. Undo puts the notes back.

**Today's puzzle** is the same for everyone who picks the same difficulty on the same date. There is no server: the date is turned into a seed, and the same seed always builds the same puzzle. It follows your own local date, so it changes at your midnight, not at a fixed time worldwide. **New random puzzle** uses a fresh seed, and the page address then contains that seed, so you can send a friend the exact puzzle.

## Why every puzzle has exactly one solution

A Sudoku with two solutions is a bad puzzle, because you can be right and still be told you are wrong. Each puzzle here is built to avoid that:

1. A randomised solver fills a full, valid grid.
2. Digits are removed in pairs that mirror each other through the centre, which is why the clues look hand-made.
3. After each removal the solver counts solutions, stopping as soon as it finds two. The removal is kept only if the answer is still exactly one.

The solver always branches on the empty cell with the fewest possible digits, which keeps the search tiny. The test suite checks the engine against a well-known published puzzle and its published answer, and checks generated puzzles at all three levels for exactly one solution that agrees with their clues.

## Difficulty

The three levels set how many clues remain: about 40 for Easy, 32 for Medium and 26 for Hard. These are targets: a puzzle can end up with a few more or one fewer. Fewer clues means more to work out, but clue count is only a rough guide to difficulty. A Hard puzzle here is not guaranteed to need advanced techniques, and the occasional Medium may feel tricky. The tool does not grade puzzles by technique.

## Hints that explain themselves

The hint button looks for the simplest next move and tells you why:

- **Naked single:** a cell where only one digit is still possible, because the other eight already appear in its row, column or box.
- **Hidden single:** a digit that can go in only one cell of a row, column or box.

If neither exists, the hint says so and reveals one digit from the solution. If you have a wrong digit on the board, the hint asks you to fix that first rather than build on a mistake. **Check** marks wrong digits without revealing the right ones. Using a hint means that solve sets no best time; using undo does not.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time per difficulty is saved in your browser's local storage as a whole number of seconds, inside a small JSON object under one key. Clearing site data removes it.

## Limits

- Difficulty is by clue count, not by technique.
- Hints use only singles, so on a hard grid they will sometimes fall back to revealing a digit.
- The daily puzzle uses your local date, so two players in different time zones can briefly see different dates.
- It does not detect puzzles from a photo or import them from elsewhere.

Everything runs locally in your browser.
