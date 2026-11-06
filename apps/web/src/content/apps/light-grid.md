---
title: "Light Grid"
category: "fun"
job: "Play a free lamp-flipping puzzle in five sizes and three difficulties. Every board is solvable, and a hint and a shortest-solution tool are built in."
description: "Free Light Grid puzzle from 3x3 to 7x7. Press a cell to flip it and its neighbours, switch every lamp off. Hint and shortest solution included. No signup."
aiSummary: "A free browser puzzle. Pressing a cell flips it and its four orthogonal neighbours, and the goal is to turn every lamp off on a grid from 3x3 to 7x7. Boards are made by pressing random cells on a dark grid, so they are always solvable, whereas a random lit board on 5x5 is solvable only one time in four. Because presses commute and cancel in pairs, a game is a linear system over GF(2). The solver runs Gaussian elimination with bitmask rows, then enumerates the null space to find a minimum-size set of presses, which powers the Hint and Show a solution buttons. The null space has dimension 0 for 3x3, 6x6 and 7x7, 4 for 4x4 and 2 for 5x5. Best scores, fewest presses per size and difficulty, are kept in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A small puzzle where the interesting part is the solver. It shows how a page of linear algebra over a two-element field turns trial and error into a calculation, and every claim about it is checked by tests."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "💡"
---

## How to play

The board is a grid of lamps, each lit or dark. Pressing a cell flips that lamp and the lamps directly above, below, left and right of it. The edges do not wrap around. Turn every lamp off.

Pick a size (3x3 to 7x7) and a difficulty, then press cells with a tap, a click, or the keyboard: the arrow keys move, **Enter** or **Space** presses, **H** asks for a hint. Pressing the same cell twice puts everything back, so no undo button is needed. **Restart** returns to the same starting board; **New puzzle** deals a fresh one. The page address carries the board's seed, so you can send a friend the exact puzzle.

Each press is announced for screen readers, with the cell pressed and how many lamps are still lit. Lamps are never shown by colour alone. A lit lamp is a filled circle and a dark lamp is a small hollow square. The solution tool marks cells with a dashed border and a diamond, and a hint uses a solid border and a diamond.

**Difficulty.** Easy scrambles the dark grid with about *n* random presses and Normal with about 2*n*, where *n* is the side length. Because presses can overlap and cancel, the fewest presses needed can be lower than that. Hard is different: it picks a board uniformly at random from the boards that can be cleared, never one that is already clear.

## How it works

Three facts do all the work, and the test suite checks each one.

1. **Presses commute.** The order in which you press cells never changes the final board.
2. **Pressing a cell twice cancels.** So all that matters for each cell is whether it was pressed an odd or an even number of times.
3. **The result is a sum.** The final board is the starting board plus the flips from every pressed cell, where adding two flips of the same lamp gives no change (1 + 1 = 0).

That is arithmetic with only 0 and 1, called GF(2). With one yes or no per cell, solving the puzzle becomes a system of equations with one equation per lamp: "the presses that touch this lamp must flip it an odd number of times if it is lit, and an even number if it is dark." The solver does Gaussian elimination on that system, the same row-by-row method from school algebra, with each row stored as a bitmask and "subtract" replaced by XOR. The elimination matrix is worked out once per size and reused for every board.

### Why a random lit board often cannot be cleared

Some sets of presses change nothing at all. On 5x5, pressing the right pattern of cells leaves every lamp as it was. These quiet patterns form the **null space**, and its size decides how many boards are out of reach. The dimension of the null space for each size, as computed by the code:

| Size | Null-space dimension | Boards that can be cleared |
|---|---|---|
| 3x3 | 0 | all of them |
| 4x4 | 4 | 1 in 16 (2^12 of 2^16) |
| 5x5 | 2 | 1 in 4 (2^23 of 2^25) |
| 6x6 | 0 | all of them |
| 7x7 | 0 | all of them |

So on 5x5 only a quarter of the 33,554,432 possible patterns are solvable, and a board of randomly lit cells is unsolvable three times out of four. That is why Light Grid builds boards by pressing cells on a dark grid: the same presses undo them, so every board is solvable by construction.

### Finding the fewest presses

When the null space is empty (3x3, 6x6, 7x7), each solvable board has exactly one set of presses that clears it, and elimination finds it directly. When it is not empty (4x4 and 5x5), each solvable board has 2^4 = 16 or 2^2 = 4 different solutions, because you can add any quiet pattern to a solution and still clear the board. The solver finds one solution, then tries every combination of quiet patterns (using a Gray code, one XOR per step) and keeps the smallest. The **Show a solution** button marks that smallest set, and **Hint** points at one cell of it.

Checked against a method that does not use elimination at all:

- All 512 boards of 3x3 and all 65,536 boards of 4x4 give the same minimum press count from the solver and from brute force over every possible press set.
- On 5x5, the brute force covers all 2^25 press sets. It finds exactly 2^23 reachable boards, and the solver agrees with it on 2,000 random boards.
- The most presses any solvable 5x5 board needs is **15**. Exactly 7,350 boards need that many.

### Fewest presses and your best score

The "Fewest possible" figure under the board is the solver's minimum for the starting board. Your best is the fewest presses you have used to clear a board of that size and difficulty. Only wins count. A win does not count toward a best if you used the hint or the solution tool on that puzzle, and that stays true if you restart the same puzzle.

## Privacy and storage

Nothing is uploaded and there is no account. Your best press count for each size and difficulty is saved in your browser's local storage as small whole numbers inside a small JSON object under one key. Clearing site data removes it. The only other state is the page address, which holds the size, difficulty and board seed.

## Limits

- The solver covers sizes up to 7x7. Larger boards are not offered.
- The score is the number of presses, not time. The timer is shown but does not affect your best.
- Easy and Normal describe how a board is scrambled, not how hard it is to think through. A Normal board can be quick to solve.
- The hint always points at the lowest-numbered cell of a shortest solution, not at the most instructive one.
- There is no daily puzzle and no undo button; press a cell again to reverse it.

Everything runs locally in your browser.
