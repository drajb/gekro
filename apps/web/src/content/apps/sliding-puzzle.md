---
title: "Sliding Puzzle"
category: "fun"
job: "Play the classic sliding tile puzzle in 3x3, 4x4 and 5x5 frames. Every shuffle is solvable, and the 3x3 frame can show the first step of a shortest solution."
description: "Free sliding tile puzzle in 3x3, 4x4 and 5x5. Every shuffle is solvable, with a shortest-path hint on 3x3. No ads, no signup, runs in your browser."
aiSummary: "A free browser sliding puzzle with numbered tiles in 3x3, 4x4 and 5x5 frames. Exactly half of all tile arrangements are impossible to solve, so each shuffle is a random permutation checked against the inversion-parity rule and repaired with one swap when it fails; the result is always solvable and never already solved. A tile in line with the gap slides the whole run at once. On 3x3 a breadth-first search over all 181,440 reachable boards powers a hint that is the first step of a shortest solution (at most 31 slides). The same seed gives the same puzzle and is kept in the page address. Fewest moves and fastest time per size are stored in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. Shuffling tiles at random hands you an impossible board half the time. This page checks the parity rule on every shuffle, and the test suite proves the rule by searching every 3x3 board."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🧩"
---

## How to play

Put the tiles in order, 1 up to the last number, with the empty gap in the bottom-right corner. Click or tap a tile to slide it into the gap. A tile that shares a row or column with the gap slides the whole run of tiles between them in one go, and that counts as a single move.

With the keyboard, Tab to a tile and press Enter or Space, or use the arrow keys. Each arrow is the direction a tile travels: Left slides the tile on the right side of the gap one step left, Up slides the tile below the gap one step up, and so on. Tiles are labelled for screen readers with their row, column and whether they can move.

Pick a frame size: 3x3 has 8 tiles, 4x4 has 15 and 5x5 has 24. **New puzzle** shuffles again, **Restart** puts the current puzzle back to where it began. The timer starts at your first move and pauses while the tab is hidden. The page address carries the size and a seed, so sending the link sends the exact same puzzle. Tiles that are already home are drawn in the accent colour, and the "In place" counter tracks them.

## How it works

### The parity rule: why half of all boards are impossible

Take the 3x3 frame. There are 9! = 362,880 ways to arrange eight tiles and a gap, and exactly half of them, 181,440, can ever be solved. The other half cannot, however long you slide.

The reason is a count that sliding cannot change. Read the tiles in order, left to right and top to bottom, skipping the gap, and count the **inversions**: pairs of tiles where the bigger number comes first. The solved board has none.

- A horizontal slide leaves the reading order untouched, so the count does not change.
- A vertical slide hops a tile over the n - 1 tiles between its old and new cell in reading order, so the count changes by an odd number when n - 1 is odd and an even number when n - 1 is even.

On an odd width (3x3, 5x5) n - 1 is even, so the inversion count stays even forever, and a board is solvable exactly when its count is even. On an even width (2x2, 4x4) every vertical slide flips the parity of the count and also moves the gap one row, so the sum of the inversion count and the gap's row (counted from the bottom, starting at 1) stays odd. A board is solvable exactly when that sum is odd. Any board that fails the check can never reach the solved one.

Swapping any two tiles flips the parity, which pairs every impossible board with a possible one, so exactly half of all boards pass. The famous 15 puzzle with only the 14 and 15 swapped fails the check, and the tests confirm it.

Checking is the easy half. The harder half is that every board that passes really is solvable. For 3x3 the test suite proves it the blunt way: a breadth-first search from the solved board reaches exactly 181,440 boards, and the parity rule agrees with that search on all 362,880 arrangements, with no exceptions. The same search on the 2x2 frame reaches 12 of 24. For 4x4 and 5x5 the search is out of reach, so the tests instead check that no legal slide ever breaks the invariant, over thousands of slides at each size. That every passing board is reachable on those sizes is the classical parity result, not something this page re-proves.

For scale, 4x4 has 16! = 20,922,789,888,000 arrangements, so 10,461,394,944,000 of them (about 10.5 trillion) are solvable. 5x5 has 25! arrangements and about 7.8 x 10^24 solvable ones.

### The shuffle

A naive shuffle that drops the tiles at random produces an impossible board half the time. This one builds a random permutation, runs the parity check, and if it fails swaps the first two tiles, which flips the parity. Because a swap pairs impossible boards with possible ones one to one, every solvable board is equally likely, and the tests check that on the 2x2 frame, where each of the 11 non-solved boards turns up about equally often. A shuffle that lands exactly on the solved board is thrown away and drawn again, so you never start finished.

The shuffle takes a random number function as an input. The page seeds it from the browser's secure random source, and the same seed always rebuilds the same board, which is how the shareable link works.

### The 3x3 hint

On 3x3 the hint button runs a breadth-first search outward from the solved board once, recording how many slides each of the 181,440 reachable boards is from solved. The hint is then a neighbouring board that is one slide closer, which is the first step of a shortest solution. The search takes a moment the first time (the test allows up to three seconds) and the table is reused after that. The hardest 3x3 boards need 31 slides, and only two boards need that many. Tests follow the hint from 40 shuffled boards and check that each reaches solved in exactly the shortest possible number of slides.

Hint slides are counted one tile at a time, while the move counter counts each click once even when a run of tiles slides, so a hint's "slides remaining" can be higher than the moves you end up using.

## Best results

After you solve a puzzle without using a hint, the page records your fewest moves and your fastest time for that frame size, and keeps them if they beat the previous best. Only wins count, a solve that used a hint never sets a best, and restarting a puzzle clears its counters.

## Privacy and storage

Nothing is uploaded and there is no account. Your best results are saved in your browser's local storage as plain numbers, under one key, for each size. Clearing site data removes them. The page address holds the frame size and puzzle seed so a link reproduces the puzzle.

## Limits

- Hints work on 3x3 only. 4x4 and 5x5 hold far too many arrangements to search in a browser, and a hint there would need a heuristic that cannot promise the shortest route.
- The move counter counts clicks, so sliding a run of three tiles is one move. Other implementations may count each tile separately and show larger numbers.
- The timer starts at your first move and counts whole seconds, so a result does not include thinking time before you move.
- Tiles show numbers only; there is no picture mode.
- Best results belong to one browser on one device. They do not sync.
- For 4x4 and 5x5 the claim that every passing board is solvable rests on the classical theorem, with the invariant checked by tests rather than proved by search.

Everything runs locally in your browser.
