---
title: "Checkers"
category: "fun"
job: "Play free Checkers (English draughts) against the computer at three levels, or with a friend on the same screen. Captures are forced and multi-jumps are enforced."
description: "Free Checkers (English draughts) on an 8 x 8 board: play the computer at three levels or a friend. Forced captures, multi-jumps, kings, undo. No ads, no signup."
aiSummary: "A free browser Checkers game with the traditional English rules on an 8 x 8 board, for one player against the computer or two players on one screen. Capturing is mandatory, multi-jumps must be continued, a man that reaches the far row becomes a king and its turn ends there, and a side with no legal move loses. A game is drawn after 40 moves in a row by both sides with no capture and no man moved. The move generator is checked against the published node counts from the starting position (7, 49, 302, 1469, 7361, 36768 and 179740 for depths 1 to 7). The computer has three levels: Easy plays a random legal move, Medium runs a 3-move alpha-beta search, and Hard deepens one move at a time up to 7 moves with a time cap of about a second. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A small engine with a move generator checked against the published node counts for English draughts, and three computer levels from a random mover to a seven-move alpha-beta search."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "🔴"
---

## How to play

Each side starts with 12 pieces on the darker squares of an 8 x 8 board. Solid moves first. A man moves one square diagonally forward; a king (a man that has reached the far row) moves one square diagonally in any direction. Capturing works by jumping an adjacent enemy piece into the empty square directly beyond it, and the jumped piece is removed.

The rules that decide most games:

- **Capturing is mandatory.** If any of your pieces can jump, you must jump. If several jumps are available you may pick any of them, not necessarily the longest.
- **Multi-jumps must be finished.** After a jump, if the same piece can jump again, it must. The page keeps that piece selected and marks the next landing squares.
- **Crowning ends the turn.** A man that lands on the far row becomes a king and its turn stops there, even if a king could have jumped on.
- **Men capture forward only.** Kings capture in all four diagonal directions, one square at a time.
- **No legal move means a loss.** You lose if you have no pieces left or every piece you have is blocked.
- **Draw rule.** The game is drawn after 40 moves in a row, counting both sides together, with no capture and no man moved. The page shows this count.

The two sides are called Solid and Ring, and they are not told apart by colour alone: Solid pieces are plain discs, Ring pieces have a ring inside, and a king carries a crown mark. Click a piece to select it. Pieces that can legally move have a dashed outline, and if a capture is mandatory only the pieces that can capture are marked and the page says "Capture available - you must capture". The legal landing squares show a dot, and the last move is tinted. On the keyboard, arrow keys move around the board (Home and End jump to the ends of a row), Enter or Space selects a piece or moves it, and Escape deselects. Every square is announced with its row, column, contents and whether it can move or is a legal destination.

Controls:

- **Opponent:** the computer or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer.
- **You play:** Solid, which moves first, or Ring, which moves second so the computer opens. Solid starts at the bottom of the board and Ring at the top.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move.
- **New game:** starts again with the current settings. Changing the opponent starts a new game, and against the computer so does changing the difficulty or side.

The page address carries your opponent, difficulty and side, so you can bookmark a setup.

## How it works

The engine is a few hundred lines with no dependencies. For every square it precomputes the neighbour one step away and the landing square two steps away in each of the four diagonal directions. Move generation looks for jump sequences first, following each one until the piece cannot jump any further, and only if no piece has a jump does it list the simple steps. A jumped piece stays on the board until the move ends, so it cannot be jumped twice or landed on, while the moving piece's own start square counts as empty, which lets a king circle round four pieces and finish where it began.

The test suite pins the rules and the engine in several ways:

- **Opening:** each side has 12 men, and Solid has exactly 7 legal first moves.
- **Node counts:** the number of possible move sequences from the starting position is 7, 49, 302, 1469, 7361, 36768 and 179740 for depths 1 to 7, matching the published figures for English draughts. A multi-jump counts as one move.
- **Captures:** a capture hides every simple move, a choice between captures is offered, a shorter capture is as legal as a longer one, men cannot capture backwards, and kings can.
- **Multi-jumps:** a double jump has no legal stopping point after the first jump, a jump with two continuations offers both, and a king's four-piece loop is found in both directions.
- **Crowning:** a man that jumps onto the far row stops there, while the same jump by a king carries on.
- **Ending:** a blocked side loses, a side with no pieces loses, and a loss outranks a draw. The 40-move rule is checked at exactly 39 and 40, and a capture or a man move resets it while a king step does not.
- **Fuzz:** 300 random games all end legally, with the piece counts conserved on every move, men only moving forward, and no simple move played while a capture existed.

The computer comes in three levels:

- **Easy** picks any legal move at random.
- **Medium** runs an alpha-beta search 3 moves ahead.
- **Hard** searches up to 7 moves ahead with alpha-beta pruning, one move deeper at a time (iterative deepening), and stops deepening if a search runs past about a second. The deepest finished search decides the move.

Both searches score a position by material (a man is worth 100 and a king 165), a small bonus for each row a man has advanced, and a small bonus for pieces nearer the centre. Hard also gives a bonus for men still on the back row. A side with no legal move scores as a loss, and at the depth limit the search keeps going while a capture is forced so that it never stops in the middle of an exchange.

The alpha-beta search is checked against a plain minimax with no pruning, which gives the same value at depths 1 to 3. In the test suite, over seeded games with colours alternating, Medium won at least 10 of 12 against Easy, and Hard searching 5 moves ahead won at least 5 of 6. The full 7-move search from the opening finishes inside five seconds with no time cap, and the real Hard setting answers in under 1.5 seconds in every position the suite asks about. The computer waits about 0.45 seconds before replying so you can follow its move, and replies at once if you have asked for reduced motion. Moves that tie for best are chosen between at random.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes it. The session tally (your wins, the computer's, draws) lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Hard is a fixed search of at most 7 moves with no learning and no opening book.
- The evaluation is a simple hand-made one. It has no special knowledge of endgames, so Hard may not convert every won ending with kings before the 40-move rule draws the game.
- Draws only come from the 40-move rule. There is no draw by agreement and no repetition rule.
- Solid is always at the bottom of the board. If you play Ring, your pieces start at the top and move down; the board is not turned around.
- Kings move one square at a time (the English rules), not the length of the diagonal as in some other variants.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
