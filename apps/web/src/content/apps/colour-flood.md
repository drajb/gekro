---
title: "Colour Flood"
category: "fun"
job: "Play a free colour puzzle: flood a board from the corner until it is one colour, inside a move limit that is always beatable. Three board sizes and three levels."
description: "Free Colour Flood puzzle on 8x8, 12x12 or 16x16 boards with six colours. Flood from the corner, beat the move limit, use hints and undo. No signup."
aiSummary: "A free browser puzzle. A board of 64, 144 or 256 squares uses six colours, each with its own shape. The player owns the area joined to the top-left corner and picks a colour to recolour it; every neighbouring square of that colour joins the area. The aim is one colour before the move limit runs out. The limit comes from a greedy solver that always picks the colour giving the biggest area; Hard allows exactly the greedy plan's length, Medium a fifth more (at least 2) and Easy half as many again (at least 5), so every board can be finished in time. Over seeds 1 to 200 the greedy plan takes 12 to 20 moves on 8x8 (mean 15.5), 16 to 31 on 12x12 (mean 22.7) and 24 to 40 on 16x16 (mean 30.0). The flood fill is tested against a second, independently written fill, and the greedy plan against an exhaustive search on 3x3 and 4x4 boards. Best move counts are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the move limit: it is made by a small solver that plays the board first, so a level is never impossible, and every claim about it is checked by tests."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎨"
---

## How to play

The board is a grid of coloured squares. You own the top-left corner square and every square joined to it by a path of squares of the same colour. That group is your **area**. Pick one of the six colours and your whole area turns that colour. Any square touching your area that already has the colour you picked joins in, so the area grows. Make the whole board one colour before you run out of moves.

Choose a board size (8x8, 12x12 or 16x16) and a level (Easy, Medium or Hard). The level only changes the move limit. A new game is dealt each time you press **New game** or change a setting, and **Restart** puts the same board back to its start. The page address carries the board's seed, so you can send a friend the exact board.

Controls:

- Tap or click a colour button. Keys **1** to **6** do the same, **U** undoes the last move and **H** shows a hint.
- **Undo** takes back your last move and gives the move back. It is blocked once a game has finished.
- **Hint** points at the colour the computer's plan would pick next. A hint is fine to use, but a board where you used one does not count toward your best score, and that stays true if you restart the same board.
- If you run out of moves there is no penalty. **Play this board again** puts the same board back, or you can start a new one.

Colour never works alone. Each of the six colours has its own shape: Sky is a circle, Green a square, Amber a triangle, Rose a diamond, Violet a hexagon and Orange a plus. The shape is drawn on every square and on every colour button, along with the colour's name. Your area is shown with a thin light frame on each of its squares, and the corner square has a ring.

Screen readers get a short summary of the board (size, your colour, how many squares you own) and one sentence after each move, for example how many squares joined and how many moves are left. Motion is gentle: a small ripple rolls out of the corner after each move and a slow wave crosses the board on a win. Both are switched off if your device asks for reduced motion, and nothing flashes.

## How it works

Your area is found with a flood fill: start at the corner, step to any neighbour above, below, left or right that has the same colour, and keep going. Picking a colour recolours exactly those squares. The tests compare this against a second fill written a different way (repeated sweeps of the whole board instead of a stack), on thousands of random boards of every size, for every colour. They also check that the squares outside your area are never touched, that your area never shrinks, and that the input board is never modified.

### Why the move limit is always fair

A move limit is only fair if some sequence of moves finishes inside it. So the page does not guess a number. It plays the board itself first. At every step it picks the colour that makes the area biggest and repeats until the board is one colour. That sequence is the **computer's plan**. Every step must grow the area, because some neighbour of the area always has a different colour, so the plan finishes in at most one move fewer than the number of squares.

The limit is then the length of the plan plus an allowance:

| Level | Moves allowed |
|---|---|
| Hard | exactly the plan's length |
| Medium | the plan plus a fifth, rounded up, and at least 2 extra |
| Easy | the plan plus half, rounded up, and at least 5 extra |

Because the plan itself fits inside every one of these limits, a finish always exists. The tests replay the plan on boards of every size and check it floods the board inside the Hard limit.

The plan is not the best possible. On Hard you can match it by following the hint every time, and a careful player can beat it. To see how far the plan is from the true best, the tests run an exhaustive search on small boards (3x3 and 4x4, 6 colours) and check two things: the plan is never shorter than the true minimum, and the minimum is never less than the number of colours present minus one, since a move can remove at most one colour from the board. On the seeded small boards in the tests the greedy plan is longer than the true minimum on 48 of 120, so there is room to do better than it.

### Verified figures

The length of the computer's plan over seeds 1 to 200, as computed by the code:

| Board | Squares | Shortest plan | Longest plan | Mean |
|---|---|---|---|---|
| 8x8 | 64 | 12 | 20 | 15.5 |
| 12x12 | 144 | 16 | 31 | 22.7 |
| 16x16 | 256 | 24 | 40 | 30.0 |

Boards are drawn square by square from a seeded random number generator, so a seed always gives the same board. A board is never dealt already flooded.

### Your best score

Your best is the fewest moves you have used to flood a board of that size and level. Only wins count, and a win does not count if you used a hint on that board. Scores are kept for each size and level separately.

## Privacy and storage

Nothing is uploaded and there is no account. Your best move count for each size and level is saved in your browser's local storage as small whole numbers inside a small JSON object under one key. Anything read back is checked, so a damaged or edited value is ignored. Clearing site data removes it. The only other state is the page address, which holds the size, level and board seed.

## Limits

- The computer's plan is a quick rule, not a perfect solver, so Hard is not the hardest possible limit.
- The score is the number of moves, not time. There is no timer.
- Boards are always six colours.
- Once a game has finished you cannot undo; restart the board or start a new one.

Everything runs locally in your browser.
