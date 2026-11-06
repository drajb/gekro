---
title: "Knight's Tour"
category: "fun"
job: "Walk a knight over a board from 5 by 5 to 8 by 8 so that it lands on every square exactly once, with a hint, undo, a warning when the tour can no longer be finished, and a solver."
description: "Free Knight's Tour puzzle on 5 by 5 to 8 by 8 boards: visit every square once, use the fewest-moves hint, and get warned before you are stuck. No signup."
aiSummary: "A free browser Knight's Tour puzzle. A knight starts on a square of a 5 by 5, 6 by 6, 7 by 7 or 8 by 8 board and must land on every square exactly once. Squares the knight can reach are marked, visited squares show the order of the visit, and a line follows the route. The hint uses the fewest-onward-moves rule: of the squares it can reach, go to the one with the fewest onward moves, then the one farthest from the middle, then the lowest square number. Following that rule on its own finishes a tour from every square of the 6 by 6 and 8 by 8 boards (so from all four corners of 8 by 8), from all 13 usable squares of 5 by 5 and from 15 of the 25 usable squares of 7 by 7. A warning appears when a complete tour is certainly impossible, using the facts that the knight has no move, a square is cut off, two squares could each only be the last, the squares left split into groups, or the shades of the squares do not add up. A test checks that warning against a plain search over thousands of random half-finished tours. Show a tour completes the walk with a depth-first search that stops after 300,000 squares. On 5 by 5 there are exactly 1728 complete tours, which a test counts. Your best tour and finished tours per size are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The check that tells you a tour has become impossible is tested against a plain search and has never said impossible about a position that could still be finished."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "♞"
---

## How to play

A knight moves two squares in one direction and then one square at a right angle. The aim is to move it so that it lands on every square of the board exactly once. The board is 5 by 5, 6 by 6, 7 by 7 or 8 by 8, and the default is 6 by 6.

- The knight starts in the top-left corner. **Before your first move** you can click any other square to start there instead.
- Squares the knight can reach and has not visited have a dashed green ring. Click or tap one to move.
- Visited squares are tinted and show the order of the visit, 1 for the start. A line follows the route, so the numbers and the line both say where you have been.
- Tick **Show how many moves each marked square leads to** to see a small number on each reachable square. The best choice is usually the one with the smallest number, because it is the square most at risk of being cut off later.
- **Hint** marks the square the fewest-onward-moves rule would pick. **Show a tour** finishes the walk from where the knight stands, if a tour can be finished. **Undo** takes back one move at a time. **New tour** starts again at the same size.

If a complete tour is no longer possible, a warning says so as soon as that is certain, and the status line repeats it. If the knight has no square left to go to, it is stuck, and Undo takes moves back. The tour is complete when every square is visited. A completed tour locks the board until you press New tour. A hint or a shown tour means that tour is not counted as finished.

On a board with an odd side (5 by 5 and 7 by 7) the squares are not evenly split between the two shades, and a knight changes shade at every move, so a complete tour has to start on a square with the same shade as the corners. The page tells you if you click a start where no complete tour exists. On 6 by 6 and 8 by 8 every square works as a start.

On the keyboard, the arrow keys move around the board, Home and End jump to the ends of a row, and Enter or Space moves the knight or, before the first move, picks the start. Every square is announced with its row and column and what is on it (the knight, a visited step number, or empty), marked squares are announced as places the knight can move, and the status line says what each move did.

## How it works

The engine keeps a table of the squares a knight can reach from each square. A move is any reachable square that has not been visited.

**The hint.** Among the reachable squares it picks the one with the fewest unvisited squares a knight could go to from there. Ties go to the square farther from the middle of the board, then to the lower square number. Squares with few exits are the ones in danger of being left behind, so visiting them first keeps the tour alive.

**The warning.** It only speaks when it is sure. A complete tour is impossible when the knight has no square to go to, when a square left can no longer be entered, when two squares could each only ever be the last one, when the knight's square and the squares left fall into separate groups, or when the shades do not add up: the squares still to visit have to alternate in shade starting with the opposite shade to the knight's, so their two counts must match that pattern exactly.

**Show a tour.** A depth-first search tries the squares in the hint's order and drops a branch when a square is cut off. It stops after 300,000 squares and says it could not decide.

The test suite checks these against independent code:

- **Moves:** the squares a knight reaches match a model using coordinates on every board, and there are 4(n-1)(n-2) knight jumps on an n by n board.
- **All the tours of the 5 by 5 board:** a plain recursive count finds exactly 1728, from the 13 squares with the corners' shade and from no other. The engine finds a tour exactly from those squares.
- **Larger boards:** the engine finds a tour from every usable start on 6 by 6, 7 by 7 and 8 by 8, and says at once there is none from the other squares of 7 by 7, because the shade count rules them out.
- **The hint rule:** in 600 random half-finished tours it always names a reachable square with the fewest onward moves. Following it alone finishes a tour from every square of 6 by 6 and of 8 by 8, which includes all four corners, from all 13 usable squares of 5 by 5, and from 15 of the 25 usable squares of 7 by 7. For the other ten, Show a tour does the finishing.
- **The warning is never wrong:** across thousands of random half-finished tours on 5 by 5 and 6 by 6, every time it said impossible, a plain search with no shortcuts found no way to finish. It is not complete: it can stay quiet about a position that is impossible but not obviously so.
- **The search:** on 5 by 5 it agrees with the plain search on whether a tour exists from random partial tours, and from partial tours on 8 by 8 it keeps every move you made.

## Privacy and storage

Nothing is uploaded and there is no account. Your longest tour and the number of tours you finished without help are saved for each size in your browser's local storage, as small whole numbers inside a small JSON object. Clearing site data removes them. The page address carries the board size and the counts switch.

## Limits

- The hint is a rule of thumb. On 7 by 7 it dead-ends from some starts, and the warning will tell you.
- Show a tour has a search limit; on a position that is impossible for a subtle reason it may stop without an answer instead of proving it.
- Tours are open: the knight does not have to end next to where it began.
- The boards are square, from 5 by 5 to 8 by 8. Larger boards would be too small to read on a phone.
