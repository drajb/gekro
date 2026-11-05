---
title: "Hex"
category: "fun"
job: "Play free Hex on a board of hexagons against the computer at three levels, or with a friend on the same screen. One game, no draws."
description: "Free Hex on a board of hexagons, 7, 9 or 11 across. Join your two sides first. Play the computer at three levels or a friend, with a swap rule. No signup."
aiSummary: "A free browser Hex game. Two players take turns placing stones on a diamond of hexagons, 7 x 7, 9 x 9 or 11 x 11. Sky wins by joining the left and right sides with an unbroken chain of its stones, Rose by joining the top and bottom sides, and the game cannot end in a draw because a completely filled board always has exactly one winner. An optional swap rule lets the second player take over the first stone. Win detection uses union-find and is checked against a separately written flood fill on every position of the 2 x 2 and 3 x 3 boards and on thousands of random boards. The computer has three levels: Easy places a stone next to an existing stone at random, Medium plays about 500 random games to pick a move, and Hard plays about 8000 within a time budget of 0.4 seconds. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The win check is a union-find that I tested against a separately written flood fill on every position of the small boards, and the computer plays by trying thousands of random finishes."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔷"
---

## How to play

The board is a diamond of hexagons. Two players take turns placing one stone on any empty hexagon. Sky goes first and wants an unbroken chain of Sky stones from the left side to the right side. Rose wants an unbroken chain of Rose stones from the top side to the bottom side. Each hexagon touches up to six others, and a chain follows those touching edges. The first player to complete a chain wins.

Every game has a winner. When the board is completely full, exactly one of the two chains exists, so there are no draws, and blocking your opponent is the same thing as building your own chain. This is the main idea of the game: a wall that stops Rose from going top to bottom is itself a chain from left to right.

The sides of the board are tinted so you can see whose edge is whose: the left and right edges are Sky, the top and bottom edges are Rose, and the corners are split. Colour is not the only clue. Sky stones carry a round dot and Rose stones carry a diamond. The last stone placed has an amber rim, and at the end the winning chain is outlined in amber and pulses a few times.

Controls:

- **Opponent:** the computer, or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer, and the menu is switched off in two-player games.
- **You play:** Sky, who joins left to right and moves first, or Rose, who joins top to bottom and moves second. When you play Rose the computer places the first stone.
- **Board:** 7 x 7, 9 x 9 or 11 x 11. When the page address does not name a size, the page picks the biggest size whose hexagons stay at least 28 pixels wide on your screen, so a phone starts on 7 x 7; a bigger board can be chosen and scrolled sideways.
- **Swap rule:** off by default. When it is on, the second player may use the Swap sides button right after the first stone. The first stone then becomes a Rose stone in the mirrored place (row and column exchanged), and Sky moves next. This takes the sting out of a strong opening move, because the first player has to open with a stone they would not mind giving away.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move. Once a game is over, undo is off.

On the keyboard, Left and Right move along a row, Up goes to the upper left neighbour and Down to the lower right one, Page Up goes to the upper right neighbour and Page Down to the lower left one, Home and End jump to the ends of a row, and Enter or Space places a stone. Each hexagon is announced with its row, column and contents, and the status line says what each move did. The page address carries the opponent, difficulty, side, board size and swap rule.

## How it works

The board is stored as a flat array of n times n cells. A cell's six neighbours are the cells left and right of it, the two above it (straight up and up-right) and the two below it (down-left and straight down). The test suite checks this against a second definition that uses cube coordinates, where two cells touch exactly when they are one step apart, and it checks the count: a board n across has (n - 1)(3n - 1) pairs of touching cells.

To decide whether a player has won, the engine joins every pair of touching stones of that colour in a union-find structure, with two extra nodes standing for the player's two sides. The player has won when the two side nodes end up in the same group. The test suite compares this with a flood fill written a different way:

- **Every position:** all 81 positions of the 2 x 2 board and all 19,683 positions of the 3 x 3 board give the same answer from both methods, and the two players are never both joined.
- **Random boards:** the same holds on 3,000 random boards from 4 x 4 to 8 x 8, from half full to completely full.
- **No draws:** on 1,500 random completely filled boards, from 2 x 2 up to 11 x 11, exactly one player is joined.
- **The winning chain:** the chain drawn at the end is a shortest chain, every cell in it is the winner's, consecutive cells touch, and it runs from the starting side to the far side.
- **The swap:** reflecting a board across its long diagonal and exchanging the colours keeps who is winning, so a swapped position is the same game seen from the other side.

The computer has three levels:

- **Easy** places a stone on a random empty hexagon that touches a stone already on the board.
- **Medium** plays about 500 random games to the end. For each candidate move it places the stone, fills every other empty hexagon in random order, and checks who won.
- **Hard** does the same with about 8000 random games, and stops early if 0.4 of a second has passed (on a slower device that can mean fewer); the clock is read every 32 games.

The candidate moves are the empty hexagons within two steps of a stone (or all of them when there are only a few). The random games are shared among the candidates by a rule that tries each once, then gives more games to the ones that win more often while still checking the others, and the move played is the one that received the most games. The computer opens in the centre. With the swap rule on, it opens one step in from the edge, and as the second player it swaps when the first stone is two or more steps in from the edge (Easy swaps at random, about half the time).

The suite counts the games through the random numbers they consume, so it proves that Medium plays 500 and Hard plays 8000. On 7 x 7 boards with colours alternating, Medium won at least 5 of 6 against Easy and so did Hard. Given a position where one stone completes its chain, Medium and Hard play that stone, which the suite checks on a 5 x 5 position with four different random seeds. The suite also asserts that Hard answers 11 x 11 positions in under 4 seconds, a bound loose enough for a slow machine; the design limit is 0.4 of a second. The computer waits about 0.4 seconds before moving so you can follow, and moves at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes it. The session tally lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figure is not inflated.

## Limits

- Medium and Hard are Monte Carlo players with no opening book and no knowledge of patterns such as bridges or ladders beyond what their random games show. A careful player can beat both, and on a big board Hard is not strong.
- Easy is very weak on purpose.
- The swap rule, when on, is applied to the first stone only.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
