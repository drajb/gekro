---
title: "Peg Solitaire"
category: "fun"
job: "Play Peg Solitaire on the English (33 holes) or French (37 holes) board with unlimited undo and a hint that comes from a real search. Jump pegs and finish with as few left as you can."
description: "Free Peg Solitaire on the English and French boards. Jump pegs, undo without limit, and get a hint from a real solver. No ads, no signup, runs in your browser."
aiSummary: "A free browser Peg Solitaire. Two boards: the English cross with 33 holes and the French board with 37, both starting with every hole filled except the centre. A jump moves a peg orthogonally over a neighbour into the empty hole beyond and removes the neighbour, so every jump removes exactly one peg and a one-peg finish takes 31 moves on the English board. A one-peg finish is impossible on the French board from the centre start, so two pegs is the best possible result there. Ratings go from Perfect (one peg in the centre on the English board, two pegs on the French board) down to Keep trying. Undo is unlimited. The hint is a depth-first search over bitmask positions with a memo of dead ends and a work cap, so it can say a finish exists, say none exists, or admit it did not find one quickly. Using the hint disqualifies a game from the best result. Results are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A rules engine, a board and a small search, and the hint comes from running that search on your position, not from a stored answer."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "🔘"
---

## How to play

Every hole holds a peg except the centre one. A move jumps a peg in a straight line, up, down, left or right, over one neighbouring peg into the empty hole directly beyond it. The peg you jumped over is removed. There are no diagonal jumps. On the English board the aim is to finish with a single peg, best of all in the centre hole. On the French board a single peg is impossible (see below), so the aim is to finish with two.

Click or tap a peg to select it. Holes it can land in get a dashed ring and a dot. Click one to jump. Click anywhere else, or press **Escape**, to let go of the peg. With the keyboard, the arrow keys move a cursor around the board, **Enter** or **Space** selects a peg or jumps, **U** undoes and **H** asks for a hint. Pegs and holes are real buttons with names like "Row 4, column 4, peg, can jump" or "empty, legal landing", so a screen reader can play too.

The game ends when no jump is left. The rating depends on the pegs remaining. English board:

| Pegs left | Rating |
|---|---|
| 1, in the centre hole | Perfect |
| 1, anywhere else | Excellent |
| 2 | Very good |
| 3 | Good |
| 4 or more | Keep trying |

French board, where two is the best possible:

| Pegs left | Rating |
|---|---|
| 2 | Perfect |
| 3 | Excellent |
| 4 | Very good |
| 5 | Good |
| 6 or more | Keep trying |

**Board** switches between the English cross (33 holes, 32 pegs to start) and the French board (37 holes, 36 pegs to start). The French board is the English one plus four extra holes, each sitting diagonally outside an inner corner of the cross. **Undo** takes back one jump at a time with no limit and is not counted as help. Using **Hint** ends your chance at a best result for that game.

## Why a one-peg finish takes exactly 31 moves

Every jump removes exactly one peg: the jumper survives, the jumped peg goes. So the number of pegs left is always the starting count minus the number of moves made. The test suite checks this after every move of many random games on both boards. It means a finish with one peg always takes 31 moves on the English board, that a two-peg finish on the French board takes 34, and that a game can never run longer than the starting pegs minus one. The Moves counter is just pegs removed.

## Why the French board cannot end on one peg

Give every hole a 0 or a 1 so that, along every jump line of three holes, the three numbers add up to an even total. Then whether the number of pegs standing on holes marked 1 is odd or even can never change during a game, because a jump removes two pegs and adds one on the same line. The test suite works out every such marking from the real jump table. On the English board, the markings allow a single last peg only in the centre or at the tip of one of the four arms. On the French board they allow no hole at all. So from the centre start, nobody can finish on one peg on the French board, and the best possible result is two. The test suite also finds a two-peg finish there. The English board keeps its one-peg goal.

The English board has exactly four first moves, all into the centre hole, from the four arms of the cross. The French board also has exactly four.

## How the hint works

The hint is a depth-first search. A position is stored as a bitmask, two integer words for the up to 37 holes, and the search tries each legal jump in a fixed order, going as deep as it can. When a position has been fully explored and no jump from it leads to a single peg, it goes into a set of dead positions so it is never searched twice. A dead position is recorded only after every jump from it has been tried to the end, so a search that is cut short never marks a position dead by mistake.

The search stops after 80,000 positions so the page cannot freeze. It then has three honest answers:

- **A move is suggested.** A line from your position to the best possible finish (one peg on the English board, two on the French board) exists, and the hint shows the first jump of it. From the English starting position the search finds a full 31-move finish within the cap, and the test suite checks that following hint after hint really ends with one peg.
- **None exists.** The search finished and no sequence of jumps from here reaches that finish. The page says so and suggests undoing some moves.
- **No hint found quickly.** The cap was reached before the search could decide. Pressing Hint again keeps what the first search learned, so the next try can go further.

The suite also checks the solver against a plain recursive search with no shortcuts on late-game positions of both boards, and the two agree on every position tested, both when a finish exists and when it does not.

The hint looks for any best possible finish, not specifically one that ends in the centre. The test suite separately confirms that the solver can find a 31-move line from the English start that ends with one peg in the centre hole.

## Privacy and storage

Nothing is uploaded and there is no account. For each board the page stores your best result (fewest pegs left) and how many unaided games you finished with the best possible result (one peg on the English board, two on the French board), as small whole numbers kept under one key in your browser's local storage, inside a small JSON object. Clearing site data removes them. The only other state is the board you chose, kept in the page address.

A result counts toward your best only if the game was finished without using the hint. Reaching the best possible result counts toward that total once per game.

## Limits

- There are only the two classic boards, and the starting hole is always the centre. No other starting holes, no diagonal-jump variants.
- The hint only searches for the best possible finish. If none is found within the cap, it says so and does not offer a "least bad" move.
- Some positions cannot reach the best finish, and the hint says so when its search proves it.
- A game in progress is not saved if you reload the page.
- There is no timer or move limit.
- The Copy button puts a short text summary of your current game on the clipboard. There is nothing to download.

Everything runs locally in your browser.
