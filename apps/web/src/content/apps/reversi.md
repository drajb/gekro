---
title: "Reversi"
category: "fun"
job: "Play free Reversi against the computer at three levels, or with a friend on the same screen. Legal moves are shown and passes happen automatically."
description: "Free Reversi on an 8 x 8 board: play the computer at three levels or a friend. Legal moves shown, automatic passes, undo. No ads, no signup, in your browser."
aiSummary: "A free browser Reversi on an 8 x 8 board for one player against the computer or two players on one screen. The move generator is checked against the published node counts from the starting position (4, 12, 56, 244, 1396 for depths 1 to 5). The computer has three levels: Easy plays a random legal move, Medium takes a corner or else the move that flips the most discs, and Hard runs an alpha-beta negamax search five moves deep that scores square values, corners and mobility. Passes are automatic, undo takes back your move and the reply, and best results are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A small engine with a move generator checked against published node counts, and three computer levels from a random mover to a five-move alpha-beta search."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "⚫"
---

## How to play

Two colours of disc share an 8 x 8 board. Dark moves first. On your turn you place a disc on an empty square so that at least one straight line of the other colour sits between the new disc and one of your own. Every disc in those lines flips to your colour. Lines can run along a row, a column or either diagonal, and one move can flip several lines at once. Small dots mark the squares where you can play. If you have no legal move you pass, and the page tells you when that happens. The game ends when neither player can move, and the player with more discs on the board wins.

The colours are not the only cue: Dark discs are solid and Light discs have a ring in the middle. The last move has a tinted square, and the discs it flipped are briefly highlighted (as a static outline if your system asks for reduced motion).

Controls:

- **Opponent:** the computer or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer.
- **You play:** Dark goes first, or Light goes second and the computer opens.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move.
- **New game:** starts again with the current settings. Changing the opponent starts a new game, and against the computer so does changing the difficulty or side.

On the keyboard, arrow keys move around the board (Home and End jump to the ends of a row) and Enter or Space places a disc. Each square is announced with its row, column, contents and whether it is a legal move.

The page address carries your opponent, difficulty and side, so you can bookmark a setup.

## How it works

The engine is a few hundred lines with no dependencies. For every square it precomputes the eight lines that run away from it to the edge. A move is legal when, along any of those lines, a run of the other colour is closed by one of your own discs. The same lookup gives the discs to flip.

The test suite pins the engine in several ways:

- **Opening:** the first player has exactly 4 legal moves, and each flips exactly one disc.
- **Node counts:** the number of possible move sequences from the starting position is 4, 12, 56, 244 and 1396 for depths 1 to 5, matching the published figures.
- **Flipping:** every one of the eight directions is tested alone, then all eight at once, then lines of different lengths in one move, and runs that are not closed are checked to flip nothing.
- **Corners:** across 40 random games a corner disc is never flipped.
- **Counting:** after every move the discs on the board equal 4 plus the moves played, and 300 random games all end with neither side able to move.
- **Passing:** games with automatic passes are played through, and a stuck player passes while the other moves again.

The computer comes in three levels:

- **Easy** picks any legal move at random.
- **Medium** takes a corner when one is on offer, and otherwise the move that flips the most discs. It does not look ahead.
- **Hard** searches five moves ahead with alpha-beta pruning. It scores a position by square values (corners high, the squares beside corners low), how many corners each side holds, and how many moves each side has. A pass costs no search depth, and a finished game is scored exactly, with any win outranking any heuristic score.

The search is checked against a plain minimax with no pruning, which gives the same value, and, on a few positions with six squares left, a depth-8 search was matched against the exact best final margin. The Hard level itself searches five moves. Moves that tie for best are chosen between at random. In the test suite, over 10 seeded games with colours alternating, Hard won at least 9 against Easy and at least 9 against Medium, and the suite fails if a depth-5 move takes 1.5 seconds. The computer waits about 0.4 seconds before replying so you can follow its move, and replies at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your best winning margin and your win count for each difficulty are saved in your browser's local storage, as plain numbers, under one key. Clearing site data removes them. The session tally (your wins, the computer's, draws) lives only on the page and resets when you leave it.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Hard is a fixed five-move search with no learning and no opening book.
- The evaluation is a simple hand-made one: it does not know, for example, that a square beside a corner becomes safe once you own that corner.
- The final score is the discs on the board. Empty squares at the end are not given to the winner.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
