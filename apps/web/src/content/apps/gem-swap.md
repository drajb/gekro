---
title: "Gem Swap"
category: "fun"
job: "Play a swap-and-match puzzle on an 8 by 8 board: line up shapes, start chains, make special pieces and beat your best score."
description: "Free swap-and-match puzzle. Six shapes, chains that pay more each step, special pieces, 30 moves or 60 seconds. Never stuck. No signup."
aiSummary: "A free browser swap-and-match game on an 8 by 8 board with six kinds of piece that differ by shape as well as colour: circle, square, triangle, diamond, hexagon and star. Swap two neighbours to make a line of three or more of one kind. Cleared pieces make the ones above fall, new pieces drop in, and new lines clear in a chain. Each piece scores 10 times the step number of the chain, up to 8. A line of four makes a row or column sweeper, a line of five makes a colour clear, and a cross or corner makes a burst. Play 30 moves or 60 seconds. A new board never starts with a line and always has a move, checked on 3,000 seeds, and a board with no moves is reshuffled. Engine tests compare line finding and legal moves with brute-force searches, check hand-built scenes for exact cleared cells and scores, and run 150 random games of 40 moves. The best score for each game is two small whole numbers in local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I like is that the engine is checked two ways: hand-built boards where I know exactly what must clear, and brute-force searches that must agree with it on thousands of random boards."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔷"
---

## How to play

The board is 8 by 8 and holds six kinds of piece. Each kind has its own shape and its own colour: blue circle, yellow square, pink triangle, green diamond, purple hexagon and orange star. A key under the board shows them, and you never have to tell them apart by colour alone.

Swap two pieces that touch, up and down or left and right, so that three or more of the same kind line up in a row or a column. They clear, the pieces above fall, new pieces drop in from the top, and if that makes new lines they clear too. A swap that makes no line does not count: the pieces go back and you keep your move.

- **Tap and tap.** Tap a piece, then tap one next to it. Tap the same piece again to let go.
- **Slide.** Press a piece and slide a little way toward a neighbour to swap in that direction.
- **Keyboard.** Tab to the board and move with the arrow keys. Press Enter or Space to pick up a piece, then press an arrow key to swap it that way. Escape lets go. Every piece has a label such as "Row 2, column 3: green diamond", and the status line says what each move did.
- **Two games.** *30 moves* ends after your thirtieth swap. *60 seconds* starts its clock at your first swap, waits while a move plays out, and stops if you switch to another tab.
- **Show me a move** marks two pieces with dashed outlines. It picks the swap that clears the most in its first step. A game where you used it does not count as a best.
- **Sound** is off until you turn it on. Each step of a chain plays one short, quiet tone that climbs the scale, so a long chain sounds like it is rising.

**Scoring.** Every piece you clear is worth 10 points times the step of the chain: the move itself is step 1, the first chain is step 2, and so on, up to a multiplier of 8. Three pieces in step 1 score 30. The same three in step 2 score 60.

**Special pieces.**

| What you make | You get | What it does |
|---|---|---|
| A line of 4 | Row sweeper or column sweeper (an arrow on the piece) | When it clears, it clears its whole row or column |
| A line of 5 | Colour clear (a ring, filled with every colour) | Swap it with any neighbour to clear every piece of that kind |
| A cross or corner of two lines | Burst (a star) | When it clears, it clears the 3 by 3 square around it |

The special appears where you swapped. A special that is caught in the blast of another one goes off too. Two colour clears swapped together clear the whole board. If a chain leaves no moves, the board shuffles itself, keeping every piece and every special.

**Light and motion.** Pieces pop and fall once. Nothing loops and nothing flashes. If your device asks for reduced motion, a move shows its final board at once, with no pop, fall or shake.

## How it works

**The board.** A new board is filled cell by cell, banning any kind that would make a third in a row with the two cells before it, so no line ever forms. If the result has no legal move, it is rebuilt from the same seed. The same seed always gives the same board. A test builds 3,000 boards and checks each has no line, at least one move, and six kinds of piece.

**Finding lines.** The engine scans every row and column for runs of three or more. Colour clears never take part in lines. A test compares this with a second, independent finder that checks every window of three cells, on 4,000 random boards.

**Legal moves.** A swap is legal if it makes a line through one of the two swapped pieces, or if one of them is a colour clear. The tests compare the engine with a search that actually performs each swap on a copy of the board and looks for lines, on 400 boards at rest and part-way through games. A board with no legal move is reshuffled; a test uses a pattern with no move at all and checks the shuffle keeps every piece, ends with a move and leaves no line.

**Clearing.** Each step clears the lines, makes any special pieces, sets off any special that was cleared (and any inside its blast), then lets everything fall and fills the gaps with new pieces from the seeded generator. The engine keeps going until nothing lines up. Hand-built scenes in the tests pin the exact cells cleared and points scored: a plain three, a two-step chain (30 then 60 points), a four that makes a row sweeper at the swapped cell, a vertical four, a five that makes a colour clear, a cross that makes a burst, sweepers and a burst going off, a chain of two specials, and the colour clear on a swap and in a pair.

**Replays.** Everything random comes from one seeded generator, so a seed and a list of swaps always give the same game, which a test proves. The engine also never clears the wrong thing at rest: after each of 6,000 swaps in the random games, the board is full, has no line, has a legal move, and every piece has its own number.

| Fact | Value | Checked by |
|---|---|---|
| Board | 8 by 8, six kinds | constant tests |
| Points | 10 per piece, times step up to 8 | scoring tests |
| Games | 30 moves, or 60 seconds | game tests |
| New boards | no line, at least one move | 3,000 seeds |
| Lines and moves | match brute force | 4,000 and 400 boards |
| Random games | 150 games of 40 moves | invariant tests |

## What is stored

Two small whole numbers, from 1 to 9,999,999: your best score in the 30 move game and in the 60 second game. They live in your browser's local storage in a small object. Anything else found there is ignored: the loader reads only those two keys, rejects anything that is not a whole number in range, and builds a new object. Nothing is sent anywhere, and the page works if storage is blocked. The page address holds the game type and the board number, so a link opens the same starting board.
