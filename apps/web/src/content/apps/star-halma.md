---
title: "Star Halma"
category: "fun"
job: "Play Star Halma, a hop-and-step race on a 121-point star, against the computer at three levels or with friends on one screen, for 2 or 3 sides."
description: "Free Star Halma on a 121-point star: step or chain hops to cross the board, 2 or 3 sides, three computer levels, undo. No ads, no signup."
aiSummary: "A free browser game of Star Halma, a race on a 121-point star-shaped board, for 2 or 3 sides of 10 pieces. A move is one step to an empty neighbouring point, or a chain of hops over adjacent pieces into the empty point beyond, with no captures. The first side to fill the opposite point of the star wins, provided at least one of the pieces in it is its own, so a piece left behind cannot block the game forever. The geometry matches an independent table of the 17 rows (1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1 points) and has 312 neighbouring pairs; the first player has exactly 14 opening moves. Hop-chain destinations are compared with a second implementation on 3000 random boards and on every position of random games. The computer has three levels: Easy plays a random forward move, Medium takes the move that gains the most steps, and Hard looks at its own next move and the next side's best reply. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The hop-chain finder is compared with a second, separately written one on thousands of boards, and the board matches an independent table of its 17 rows."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "✴️"
---

## How to play

The board is a six-pointed star with 121 points: a hexagon of 61 points in the middle and six triangular points of 10. Each side has 10 pieces that start in one point, and the aim is to carry all of them across to the point on the opposite side.

The sides are named after the shape of their pieces, so you never rely on colour alone: **Circles** are sky blue discs, **Diamonds** are rose diamonds and **Triangles** are green triangles. With 2 sides, Circles start at the bottom and Diamonds at the top. With 3 sides, the sides take every other point, and each one heads for an empty point across the star. A point that is a side's target has a dashed edge in that side's colour.

**Moving.** On your turn you move one piece, in one of two ways:

- **Step:** to any empty point next to it.
- **Hop:** over an adjacent piece, yours or anyone else's, into the empty point directly beyond it. If you can hop again from there, you may, in any direction, as many times as you like. The piece simply ends where you stop. Nothing is ever captured.

Because hops chain, a good line of pieces acts as a ladder, and one move can carry a piece across half the board. That is the whole game: build ladders for yourself and avoid building them for your opponents.

**Winning.** You win when every point of your target is occupied and at least one of the pieces there is yours. Usually that means all 10 of yours, but a piece that another side leaves behind cannot hold the game up forever. If nobody can move, or 150 moves each have been played with no winner, the game is a draw.

Controls:

- **Sides:** 2 or 3 sides.
- **Opponents:** the computer plays every other side, or people take turns on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer.
- **You play:** which side is yours. Circles move first, then Diamonds, then Triangles.
- **Undo:** takes back your last move and the replies. Against people it takes back one move. Once a game is over, undo is off.
- **New game:** starts again with the current settings.

Click a piece with a bright outline, and every point it can reach (by a step or a whole chain of hops) shows a lime dot. Click a dot to move there. The last move is outlined in amber. The star needs room for comfortable targets, so on a narrow screen the board scrolls sideways inside its frame, and the page tells you so. On the keyboard, arrow keys move between neighbouring points: Left and Right go along the row, Up and Down go to the left-hand diagonal neighbour above or below, and Shift with Up or Down goes to the right-hand one. Enter or Space selects a piece or moves it, and Escape deselects. Every point is announced with its row and position in the row, what is on it, and whether it is a legal destination. The page address carries your settings, so you can bookmark a setup.

## How it works

The engine labels each point with three coordinates that add up to zero, which makes the six directions simple and keeps the star exact. Neighbours and the points beyond them are worked out once and stored, so finding a piece's destinations is a short search: one step each way, then a walk through every point reachable by a chain of hops, marking points already visited so each is listed once.

The test suite pins the rules in several ways:

- **The board:** the 17 rows hold 1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2 and 1 points, matching a separately typed table cell for cell. The six points hold 10 each, the middle hexagon holds 61, opposite tips are 16 steps apart, and there are 312 pairs of neighbouring points, the same as a brute-force count.
- **The opening:** each side starts with 10 pieces. The first player has exactly 14 moves: the 4 front pieces step to 2 points each (8), and the 3 pieces behind them each hop a front piece (6).
- **Hand-built positions:** steps, hops over any side's piece, no hop over two pieces in a row or over an empty point, chains that turn in several directions, and a moving piece that does not block its own chain.
- **A second implementation:** a separate generator, written with doubled row and column coordinates and recursion instead of numbered cube coordinates and a queue, gives exactly the same destinations for every piece on 3000 random boards (more than 50 thousand pieces in all) and on every position of 60 random games, with 2 and 3 sides.
- **Winning:** each side of each game size wins when its point is full, a piece left in your point by another side does not stop the win, a side that cannot move passes, and the game is drawn at 150 moves each.

The computer comes in three levels:

- **Easy** plays a random move that goes forward.
- **Medium** plays the move that gains the most steps toward the tip of its target point, counting a whole hop chain as one move, and it avoids pulling pieces out of the target.
- **Hard** takes the 14 best moves by that measure and picks the one with the best value after adding a share of its own next best gain and subtracting a share of the best reply of the side that moves next.

None of this is deep search: the evaluation is the distance to the goal tip. In the test suite, Medium and Hard each finish whole 2-side games with a winner well inside the move limit from several seeds, three Hard computers finish a 3-side game, Medium and Hard each beat Easy in all 6 games with sides alternating, a Hard move looks at no more than 30 positions, and the suite fails if a move takes 2.5 seconds, even on a busy machine. The computer waits a little before replying so you can follow its move, and replies at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The session tally lives only on the page and resets when you leave it. A game in which you used Undo is not counted, so the saved figures are not inflated.

## Limits

- The computer judges a position only by distance to the goal, so it is a fair opponent but a careful player can beat it by blocking.
- With 3 sides the computer looks at the next side only, not both.
- The rule that a left-behind piece cannot block the win is a house rule that keeps games from stalling.
- Two-player and three-player modes with people are for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
