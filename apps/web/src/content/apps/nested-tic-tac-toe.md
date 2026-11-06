---
title: "Nested Tic Tac Toe"
category: "fun"
job: "Play Nested Tic Tac Toe, nine small boards in one big grid, against the computer at three levels or with a friend on one screen."
description: "Free Nested Tic Tac Toe: nine small boards, where your cell picks your opponent's board. Three levels, two players, undo. No ads, no signup."
aiSummary: "A free browser game of Nested Tic Tac Toe: a 3 x 3 grid of small 3 x 3 boards. The cell a player takes inside a small board decides which small board the opponent must play in next. If that board is already won or full, the opponent may play in any open board. Three in a row inside a small board wins it, and three won small boards in a row wins the game; if every board is decided with no line, the player with more small boards wins and equal counts are a draw. The engine is compared with a second implementation written with four coordinates on a thousand random games, move by move, and the number of possible move sequences is 81, 720, 6336 and 55080 for the first four moves. The computer has three levels: Easy plays a random legal cell, Medium searches up to 4 moves ahead with alpha-beta pruning, and Hard deepens one move at a time under a fixed budget of 90 thousand positions. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The rule that sends a player to a board is checked against a second, separately written version on a thousand random games, move by move."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⭕"
---

## How to play

The board is a 3 x 3 grid of small boards, each a 3 x 3 grid of cells, so there are 81 cells in all. The two sides are called Cross and Ring. Cross is drawn as two crossing strokes and Ring as a hollow circle, so the marks are told apart by shape as well as colour. Cross moves first and can play any cell.

**The one rule that matters.** The position of the cell you take inside its small board names the small board your opponent must play in next. If you take the top-right cell of a small board, your opponent must play somewhere in the top-right small board. If you take the centre cell, they go to the centre board, and if you play the centre cell of the centre board they are sent right back to the same board. The page highlights the board you must use and marks the legal cells.

**Winning a small board.** Make three in a row, across, down or diagonally, inside one small board and you win it. That board is closed: nobody plays in it again, and its cells fade behind a large mark. A small board that fills with no line is closed too, and counts for nobody.

**Free choice.** If you are sent to a board that is already closed, you may play in any open board.

**Winning the game.** Win three small boards in a row on the big grid and the game is yours. If every board is closed and no one has a line, the player with more small boards wins, and equal counts are a draw.

Controls:

- **Opponent:** the computer or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer.
- **You play:** Cross, which moves first, or Ring, in which case the computer opens.
- **Undo:** takes back your last move and the replies. Against a person it takes back one move. Once a game is over, undo is off.
- **New game:** starts again with the current settings.

Click a highlighted cell to place your mark. On the keyboard, arrow keys move around the 9 x 9 grid (Home and End jump to the ends of a row), and Enter or Space places a mark. Each cell is announced with its row, column, contents and whether it is a legal move, each small board with its row, column and state, and the status line says which board the next player must use. The page address carries your settings, so you can bookmark a setup.

## How it works

Cells are numbered from 0 to 80, board by board. Playing cell c names the small board c mod 9 for the next player; the engine checks whether that board is closed and, if so, opens the choice to every board that is not. The same code finds lines inside small boards and across the big grid.

The test suite pins the rules in several ways:

- **Hand-built positions:** the sent-to rule on the first moves, free choice after a closed board, a drawn board, all eight lines inside a small board, all eight lines of boards, a line that is broken by a closed board, and both ways the game can end without a line (a clear majority, and a tie).
- **Move counts:** the number of possible move sequences is 81 for one move and 720 for two (nine of the 81 first moves leave the opponent only eight replies, because the cell lies in its own board). For three and four moves the counts are 6336 and 55080, and the second implementation gives the same numbers.
- **A second implementation:** a separate version, written with four coordinates (big row, big column, row, column) and a different way of finding lines, is run alongside the engine on 1000 random games. At every move the two agree on the legal moves, the status of every small board, whose turn it is, and the result. Random games end by a line of boards, by a majority and by a tie.
- **Exact search:** on 40 positions with nine or fewer playable cells left, the full-depth alpha-beta search reaches the same win, draw or loss as an exhaustive search, and at depths 1 to 3 a pruned search returns exactly what an unpruned one does.

The computer comes in three levels:

- **Easy** picks any legal cell at random.
- **Medium** searches up to 4 moves ahead with alpha-beta pruning, within a budget of 12 thousand positions.
- **Hard** deepens one move at a time, up to 14, until it has used 90 thousand positions in total, and keeps the answer from the last depth it finished.

Both searching levels score a position by the small boards each side has won (the centre and the corners are worth more), the lines of small boards that are partly built, the chances still open inside each small board, and a small bonus for having a free choice of board. Moves that win a small board are searched first so that pruning works well. In the test suite, over 6 seeded games with sides alternating, Hard won at least 5 against Easy and lost none, Medium won at least 5, both took a game-winning move and blocked one when it was there, and the suite fails if a Hard move takes 2.5 seconds, even on a busy machine. The computer waits about half a second before replying so you can follow its move, and replies at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The session tally lives only on the page and resets when you leave it. A game in which you used Undo is not counted, so the saved figures are not inflated.

## Limits

- Hard is a fixed search with no learning and no opening book, and its judgement of a position is hand-made.
- The game is not solved, so the computer can lose and can miss a long plan.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
