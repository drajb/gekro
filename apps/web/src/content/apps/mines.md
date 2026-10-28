---
title: "Mines"
category: "fun"
job: "Play a free mine-clearing puzzle on three board sizes. The first click is always safe, and flags and chording work with mouse, touch or keyboard."
description: "Free mine-clearing puzzle with three board sizes. The first click is always safe. Flags and chording work by mouse, touch or keyboard. No ads, no signup."
aiSummary: "A free browser mine-clearing puzzle with three levels: Beginner (9 x 9, 10 mines), Intermediate (16 x 16, 40 mines) and Expert (30 columns x 16 rows, 99 mines). Mines are placed only after the first click, away from the clicked cell and its neighbours, so the first click always opens a region. Opening an empty cell opens its neighbours using an iterative flood fill with an explicit stack. Cells can be flagged by right-click, long-press, the F key or a Flag mode button, and a satisfied number can be chorded to open its unflagged neighbours. The timer starts at the first reveal and pauses when the tab is hidden. Best times are kept per level in the browser's local storage and only wins count; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A small engine with a test suite, and it behaves the same with a mouse, a finger or just a keyboard."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "💣"
---

## How to play

Open every cell that does not hold a mine. A number tells you how many of the eight cells around it are mines. An empty cell has none, so opening one opens everything around it, and that spreads until it reaches numbers.

- **Open a cell:** click, tap, or press Enter or Space on the focused cell.
- **Flag a suspected mine:** right-click, long-press for half a second on touch, press **F**, or turn on **Flag mode** and tap. Flag mode is there for phones, where a long-press is awkward.
- **Chord:** on an open number whose flags already match it, click or tap it, double-click, middle-click, or press **C**, and the rest of its neighbours open at once. If one of your flags was wrong, that opens a mine and the game ends.
- **Move around:** arrow keys move between cells, Home and End jump to the ends of the row.

The **Mines left** counter is the number of mines minus the number of flags, so it goes negative if you place too many flags. The timer starts at your first click and stops when you win or lose. When you win, the mines you had not flagged are flagged for you. When you lose, every mine is shown and each flag on a safe cell is marked with a cross.

Numbers and flags are drawn as symbols as well as colour, so the board does not depend on telling colours apart.

## Levels

| Level | Size | Mines |
|---|---|---|
| Beginner | 9 x 9 | 10 |
| Intermediate | 16 x 16 | 40 |
| Expert | 30 columns x 16 rows | 99 |

The Expert board is 480 cells, wider than a phone screen. It scrolls inside its own box rather than widening the page.

## How it works

**The first click is always safe.** Nothing is on the board until you click. At that moment the mines are drawn from every cell except the one you clicked and the cells touching it, so your first click always lands on a zero and opens a region. The draw is a partial shuffle, and the tests confirm that every allowed cell can end up holding a mine. They also check the rules on every first-click position of the Beginner and Intermediate boards, and on a spread of Expert positions including all four corners: exactly the right number of mines, never on the clicked cell, never next to it.

**The flood fill has no recursion.** Opening a zero uses an explicit stack. A recursive version can overflow the call stack on a large empty area, so the tests open a 400 x 400 board with no mines, 160 000 cells, in one click. The flood fill is also compared against a plain recursive reference on about two hundred random boards, with and without flags in the way, and the two always open exactly the same cells. Flagged cells are never opened by a flood.

**Chording follows one rule.** The number of flags around an open number must equal the number. Fewer or more does nothing. When it matches, every unflagged neighbour is opened, and a wrong flag means a mine among them.

**Only changed cells are redrawn.** Each move returns the list of cells whose appearance changed, and the page repaints just those. A click on the 480-cell board does not rebuild the board.

**The engine is plain functions.** Placement, counts, reveal, flag, chord and win and loss detection take the randomness as an argument, so with a seeded generator the same clicks give the same game. The page itself uses the browser's cryptographic random source.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each level is saved in your browser's local storage, as plain numbers, under one key. Only wins count. The level you last played is kept in the page address. Clearing site data removes the times.

## Limits

- Boards are random and are not checked for being solvable without a guess, so some games need one.
- The timer counts whole seconds and pauses while the tab is hidden.
- A long-press flags on touch and pen input only, not with a held mouse button.
- Best times are per browser. There is no leaderboard and no sync between devices.
- The share text is plain text, not an image.

Everything runs locally in your browser.
