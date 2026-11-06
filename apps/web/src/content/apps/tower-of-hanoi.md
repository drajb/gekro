---
title: "Tower of Hanoi"
category: "fun"
job: "Play Tower of Hanoi with 3 to 8 discs, see the minimum move count, and watch the shortest solution play out step by step from wherever you are."
description: "Free Tower of Hanoi with 3 to 8 discs, a live minimum-move count, undo, keyboard play and an Auto-solve that plays the shortest solution. No ads, no signup."
aiSummary: "A free browser Tower of Hanoi with three pegs and 3 to 8 discs. It shows the minimum number of moves (2^n - 1) beside your move count, supports click, tap and keyboard play, undo, and an Auto-solve that plays the shortest possible solution from the current position (confirmed by exhaustive search for 3 to 6 discs). The engine is tested: the recursive solution is legal and has exactly 2^n - 1 moves for 1 to 12 discs, an exhaustive search of all 3^n positions confirms nothing shorter exists up to 8 discs, and the disc moved at step k is set by the trailing zero bits of k. Best moves and best time per disc count are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A small puzzle whose whole solution is one short recursive function, which makes it a clean case where you can prove the answer is the shortest possible instead of just trusting it."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🗼"
---

## How to play

Three pegs, and a stack of discs on the first one with the largest at the bottom. Move the whole stack to another peg, one disc at a time, and never put a larger disc on a smaller one.

- **Mouse or touch:** click a peg to pick up its top disc (it lifts), then click the peg to drop it on. Click the same peg again to put the disc back. Illegal moves show a short message instead of doing anything.
- **Keyboard:** left and right arrows move between pegs, **Enter** or **Space** picks up and drops, **1**, **2** and **3** choose a peg directly, **Escape** puts a disc back, **U** undoes.
- **Screen readers:** each peg is a button that names its contents from bottom to top, for example "Peg 2: discs 3 and 1, top is 1", and a status line says which disc moved and between which pegs.

Beside your move count the page shows the minimum possible for that many discs. When you finish it says **Perfect** if you matched it, or how many moves over the minimum you were. **Undo** takes a disc back, but the move still counts in your total, so the number stays honest. The timer starts at your first move and pauses when the tab is hidden.

## The minimum is 2^n - 1

To move a tower of n discs you have to move the n - 1 discs above the largest one out of the way, move the largest, then move those n - 1 discs back on top. So the minimum for n discs is twice the minimum for n - 1, plus one. That gives 2^n - 1: 7 moves for 3 discs, 15 for 4, 31 for 5, and 255 for 8. Each extra disc doubles the work.

The tests check this instead of assuming it:

- The recursive solution has exactly 2^n - 1 moves and every move is legal, for every disc count from 1 to 12.
- A breadth-first search over every position finds no shorter path for 1 to 8 discs. There are exactly 3^n reachable positions, because each disc can sit on any of the three pegs and the order within a peg is then forced. For 8 discs that is 6,561 positions, and the farthest any of them is from the start is also 255 moves.

## Patterns in the solution

Two regularities fall out of the shortest solution, and they are tested as described below:

- **Which disc moves at step k:** write k in binary and count the zeros at the end. The disc labelled d moves at step k exactly when k has d - 1 trailing zeros. So the smallest disc moves on every odd step. A disc labelled d moves 2^(n - d) times in total, which means the smallest does half the work and the largest moves once.
- **The smallest disc always travels the same way round.** From peg 1 to peg 3, an odd number of discs sends it 1, 3, 2, 1, and an even number sends it 1, 2, 3, 1. The same disc never moves twice in a row (tested at 8 discs).

## Auto-solve

**Auto-solve** plays the shortest solution one move at a time with a short delay (a minimal one if your device asks for reduced motion). **Stop** hands control back to you at any point. It works from where you are, not only from the start: it takes the largest disc, and if it is already in place it ignores it, otherwise it clears everything smaller onto the spare peg, moves it, and rebuilds. It plays the shorter of the plans for the two other pegs. For 3 to 6 discs the tests compare this against exhaustive search from every one of the possible positions and the lengths match.

Games that used Auto-solve are marked as such and do not count toward your best results.

## Privacy and storage

Nothing is uploaded and there is no account. Your best move count and best time for each disc count are saved in your browser's local storage as small whole numbers inside a small JSON object, under one key, and only for games you solved yourself. Clearing site data removes them. The page address holds the number of discs, so you can link to a particular size.

## Limits

- The game offers 3 to 8 discs. The engine is tested up to 12, but 12 discs is 4,095 moves and a poor fit for a phone screen.
- Best moves can only ever match the minimum, so the useful record is the best time.
- The timer counts whole seconds and does not run during or after Auto-solve.
- It plays the standard three-peg puzzle only. Variants with four pegs or restricted moves are not included.

Everything runs locally in your browser.
