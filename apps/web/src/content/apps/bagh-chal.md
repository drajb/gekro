---
title: "Bagh Chal"
category: "fun"
job: "Play Bagh Chal, the Nepali game of four tigers against twenty goats, as the tigers or the goats against the computer at three levels or a friend on one screen."
description: "Free Bagh Chal in your browser: 4 tigers hunt 20 goats on a 5 by 5 board with diagonals. Play either side against the computer or a friend. No signup."
aiSummary: "A free browser Bagh Chal, the traditional Nepali board game. The board is a 5 by 5 grid of 25 points joined by the straight lines and the diagonals of the big X and the diamond (56 links). Four tigers start on the corners and the goats have 20 goats in hand. The goats move first and place one goat per turn on any empty point until all 20 are down, then step one link at a time. A tiger steps one link or jumps in a straight line over an adjacent goat into the empty point beyond, capturing it; a capture is optional and a move holds one jump. The tigers win when 5 goats have been captured or when the goats cannot move. The goats win by trapping all four tigers so that none can step or jump; the tests build a full trap of the four corner tigers from 17 goats. A game is drawn after 100 moves in a row with no goat placed and none captured. The rules are checked against a separately written model built from lists of the board's lines, over thousands of random positions and hundreds of random games. You can play either side. The computer has three levels for both sides: Easy plays a random legal move, Medium runs a 4-move alpha-beta search, and Hard deepens one move at a time up to 8 moves with a limit of about 0.4 seconds or 60,000 positions. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. I wrote the rules a second time from the list of the board's lines and let the two versions play 500 random games side by side to be sure they never disagree."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🐯"
---

## How to play

The board is five rows of five points. Lines join each point to its neighbours up, down, left and right, and the points where the row number plus the column number is even also have diagonal lines (the big X and the diamond inside it). Four tigers start on the corners. The goats have 20 goats in hand and move first.

- **The goats** have two stages. While goats are still in hand, each turn places one goat on any empty point. Once all 20 are on the board, each turn steps one goat along a line to a neighbouring empty point.
- **The tigers** each turn either step one link to an empty point, or jump. A jump goes in a straight line over a goat next to the tiger and lands on the empty point just beyond it, and the goat is captured. A jump is optional, and a tiger makes one jump per move.

The tigers win when 5 goats have been captured, or if the goats have no legal move. The goats win by trapping all four tigers so that none of them can step or jump. The game is drawn after 100 moves in a row, counting both sides together, with no goat placed and none captured. The page shows that count.

Goats are round discs with a ring inside. Tigers are triangles with stripes. The shapes mean you never rely on colour alone. The last move is outlined with a dotted ring and a point where a goat was captured is ringed in rose.

Controls:

- **Opponent:** the computer, or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer, and the menu is switched off in two-player games.
- **You play:** the goats, who move first, or the tigers. When you are the tigers the computer opens.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move. Once a game is over, undo is off.

To place a goat, click any empty point. To move a piece, click it (pieces that can move have a dashed outline) and then a marked point: a filled green dot is a step, and a larger rose ring is a jump that captures a goat. On the keyboard, arrow keys move around the board, Enter or Space selects a piece or moves it, and Escape puts the piece down. Every point is announced with its row, column and contents, and the status line says what each move did. The page address carries the opponent, difficulty and side.

## How it works

Each point has up to eight directions. The engine builds a table of the point one link away in each direction, with diagonals only from points where row plus column is even, and a second table for the point two links away along the same line, which is where a tiger lands.

The test suite pins the rules in several ways:

- **The board:** 25 points and 56 links, built a second way in the tests from a list of the board's rows, columns, two long diagonals and the four sides of the diamond. Every point's neighbours and every possible jump match.
- **The opening:** four tigers on the corners, 20 goats in hand, and exactly 21 places for the first goat. A goat cannot step while any goat is in hand.
- **Tiger moves:** steps, jumps along rows, columns and diagonals (including from a corner), optional captures, no jump over a tiger, over two goats, over a goat with a piece behind it, off the edge, or along a diagonal through a point that has none.
- **Trapping:** the tests build a trap for all four tigers in the corners: 12 goats beside them and 5 behind them, 17 in all. Taking away any one of the 17 frees a tiger, so none of them is spare.
- **The ends of the game:** 5 captures, no tiger move, no goat move, and the draw after 100 quiet moves, with a loss outranking a draw.
- **A second implementation:** a separately written model, using sets of points and the list of lines, lists every legal move and decides every ending. It agrees with the engine in 5,000 random positions, in 1,500 more built around the full trap, and move by move through 500 random games (same moves, boards, goats in hand, captures, quiet count and result). In all of those, the 20 goats are always accounted for: in hand, on the board or captured.
- **Games end:** the only progress is 20 placements and 5 captures, and no more than 100 moves can pass between two of them. The suite asserts that no random game runs past that bound.

The computer comes in three levels and plays either side:

- **Easy** picks any legal move at random.
- **Medium** runs an alpha-beta search 4 moves ahead.
- **Hard** searches up to 8 moves ahead, one move deeper at a time (iterative deepening), and stops deepening once about 0.4 of a second has passed or 60,000 positions have been looked at, whichever comes first, so a move never ties up the page for long, even on a slow device. The deepest finished search decides the move.

Both searches score a position from the goats' side and the tigers play for the opposite score. The score counts goats captured (150 each, the largest part), minus 4 for each move the tigers have, plus 70 for each trapped tiger, minus a penalty for each goat the tigers could capture right now, plus a small bonus for goats on points where few lines pass through with a point on both sides (a goat on a corner can never be jumped). A tiger win or goat win scores far above or below those figures. Captures are tried first for the tigers, and moves that tie for best are chosen between at random.

The alpha-beta search is checked against a plain minimax with no pruning, which gives the same value at depths 1 to 3 (and 4 where the move list is short) in positions from random games, including positions with goats still in hand. In the test suite, Medium tigers won at least 5 of 6 games against Easy goats, Medium goats lost at most one of 6 games against Easy tigers and lost fewer goats than Easy goats did, and Hard tigers searching 4 moves ahead won at least 5 of 6 against Easy goats. In the suite's test positions, the tigers take the goat that wins the game when it is on offer, and the goats make a move after which the tigers have no capture. The suite asserts that Hard answers every position it is asked about in under 4 seconds, a bound loose enough for a slow machine; the design limit is about 0.4 of a second. The computer waits about 0.45 seconds before moving so you can follow along, and moves at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty (for both sides added together) is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes it. The session tally lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Hard is a fixed search of at most 8 moves with no learning and no opening book, and the evaluation is a simple hand-made one.
- Capturing is optional for the tigers, and a tiger makes only one jump per move; other rule sets differ on both.
- The draw rule is the page's own: 100 quiet moves in a row. A game in which neither side can make progress will be drawn.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.
