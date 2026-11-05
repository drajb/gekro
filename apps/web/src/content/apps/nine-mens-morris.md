---
title: "Nine Men's Morris"
category: "fun"
job: "Play free Nine Men's Morris against the computer at three levels, or with a friend on the same screen. Place, slide and fly pieces to make mills."
description: "Free Nine Men's Morris: place nine pieces, make mills of three, then slide and fly. Play the computer at three levels or a friend, with undo. No ads. No signup."
aiSummary: "A free browser Nine Men's Morris game for one player against the computer or two players on one screen. Each side has nine pieces and the board has 24 points, 32 links and 16 lines. The game has three phases: placing the pieces, sliding a piece along a line to a linked empty point, and flying to any empty point once a side is down to exactly three pieces with none left in hand. Three pieces in a line make a mill, which lets the mover take one opposing piece that is not in a mill, unless all of them are. A side loses when it has fewer than three pieces in all or cannot move, and the game is drawn after 40 moves in a row with no piece placed or taken. The board and rules are checked against a separately written model that uses coordinates instead of ring arithmetic. The computer has three levels: Easy plays a random legal move, Medium runs a 3-move alpha-beta search, and Hard deepens one move at a time up to 5 moves with a time budget of 0.4 seconds. Win counts and the most pieces kept in a win are stored in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The move generator is checked against a second one written with plain coordinates, so a mistake in the board links or lines would show up as a disagreement."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⚪"
---

## How to play

The board is three squares, one inside the other, joined by four lines through the middle of their sides. The 24 places where lines meet are the points. Each side has nine pieces. Amber moves first, and Amber pieces are plain discs while Violet pieces have a ring in the middle, so the two sides do not rely on colour alone.

The game has three phases:

- **Placing.** Take turns putting one piece from your hand on any empty point until both hands are empty.
- **Moving.** Slide one of your pieces along a line to the next point, if it is empty.
- **Flying.** When you are down to exactly three pieces and have none in hand, you may move a piece to any empty point.

Three of your pieces in a row along one line is a **mill**. Whenever you make a mill, by placing, sliding or flying, you take one of the other side's pieces off the board. You may not take a piece that is itself in a mill, unless every piece the other side has on the board is in a mill. Making two mills with one move still takes just one piece. Moving a piece out of a mill and back in later makes a new mill. If the other side has no piece on the board at all when you make a mill (they have only pieces in hand), there is nothing to take.

You lose when you are down to two pieces, counting the ones still in your hand, or when it is your turn and none of your pieces can move. The game is drawn after 40 moves in a row, counting both sides together, with no piece placed or taken. The page shows that count.

Controls:

- **Opponent:** the computer, or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer, and the menu is switched off in two-player games.
- **You play:** Amber, who moves first, or Violet, who moves second so the computer opens.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move. While a mill is waiting for you to pick a piece, Undo or Escape cancels that move instead. Once a game is over, undo is off.

To place a piece, click an empty point. To move, click one of your pieces (pieces that can move have a dashed outline), then click a marked point. After a mill, the pieces you may take are highlighted; click one. The last move is outlined and the point where a piece was taken is ringed. On the keyboard, arrow keys move to the nearest point in that direction, Enter or Space acts, and Escape puts a piece down. Every point is announced with its place on the board, what is on it and what you can do there, and the status line says what each move did. The page address carries the opponent, difficulty and side.

## How it works

Points are numbered by square and position: 0 to 7 clockwise from the top-left corner on the outer square, 8 to 15 on the middle square and 16 to 23 on the inner one. Each point is linked to its two neighbours on its own square, and each middle-of-a-side point is also linked to the same point on the next square in or out. The 16 lines are the four sides of each square and the four lines that join the squares.

The test suite pins the rules in several ways:

- **A second definition of the board.** Points are also given as coordinates on a 7 by 7 grid, with two points linked when they share a row or column with nothing between them (and the empty centre never in the way). The links agree exactly (32 of them), the 16 lines agree, and every point is on exactly two lines.
- **A second move generator.** A separate model of the whole game, written with coordinates, lists every legal move including which piece may be taken. It agrees with the engine in 4,000 random positions with any piece counts, hands and side to move, including flying and blocked positions, and move by move through 300 random games (same moves, boards, hands, quiet count and result).
- **The ending.** Losing at two pieces (hand included), being blocked, the draw at exactly 40 quiet moves and not at 39, and a loss outranking a draw are all checked. Games are bounded: the suite asserts that no random game runs past 618 moves, which is 18 placing moves plus at most 40 quiet moves before each of at most 15 pieces taken.
- **Illegal input.** Occupied or unlinked points, a missing or wrong choice of piece to take, taking a protected piece, and junk values are all refused.

The computer has three levels:

- **Easy** picks any legal move at random, including which piece to take.
- **Medium** runs an alpha-beta search 3 moves ahead.
- **Hard** searches up to 5 moves ahead, one move deeper at a time (iterative deepening), and stops deepening once about 0.4 of a second has passed or 110,000 positions have been looked at, whichever comes first, so one move never ties up the page for long, even on a slow device. The deepest finished search decides the move.

Both searches score a position by material first (a piece in hand counts like a piece on the board), then by the mills each side holds, the lines where a side needs just one more piece, and how many moves each side has. A lost position scores below any of those and a won one above. Moves that close a mill, and moves that block a mill the opponent threatens, are tried first so that pruning cuts more. Moves that tie for best are chosen between at random.

The alpha-beta search is checked against a plain minimax with no pruning, which gives the same value at depths 1 and 2 for more than 40 positions from random games, and at depth 3 where the move list is short. In the test suite, with the first move alternating, Medium won at least 5 of 6 games against Easy, and so did Hard searching 4 moves ahead. In a position where closing a mill wins the game, Medium and Hard close it, and in a position where losing a piece would lose the game they block the mill; the suite checks one of each. The suite asserts that Hard answers every position it is asked about in under 4 seconds, a bound loose enough for a slow machine; the design limit is about 0.4 of a second. The computer waits about 0.45 seconds before moving so you can follow along, and moves at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count and the most pieces you kept in a win, for each difficulty, are saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The session tally lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Hard is a fixed search of at most 5 moves with no learning and no opening book, and the evaluation is a simple hand-made one.
- The draw rule is the page's own: 40 quiet moves in a row. There is no draw by repeating a position.
- Pieces in hand count as pieces for the loss rule, so a side with one piece on the board and one in hand has already lost.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
