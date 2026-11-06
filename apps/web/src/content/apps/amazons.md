---
title: "Amazons"
category: "fun"
job: "Play Amazons, the game of sliding queens and burning squares, on a 10 by 10 or 6 by 6 board against the computer at three levels or a friend on one screen."
description: "Free Amazons in your browser: slide a queen, shoot an arrow, and trap the other side. Play on 10 by 10 or 6 by 6 against the computer or a friend. No signup."
aiSummary: "A free browser Amazons. Each side has four queens on a 10 by 10 board (or a small 6 by 6 board). A move has two steps: slide one queen any distance along a row, column or diagonal over empty squares, then shoot an arrow from the square it landed on along any such line onto an empty square. The arrow square is blocked for the rest of the game; the square the queen left counts as empty, so the arrow may land there. The side that cannot move loses, so there are no draws, and every move adds an arrow so a game lasts at most 92 moves on 10 by 10 and 28 on 6 by 6. The opening position has 2176 legal moves on 10 by 10 and 576 on 6 by 6. The rules are checked against a separately written move generator in thousands of random positions and hundreds of random games. A search with every move tried agrees with a brute-force solver on small boards. You can play either side. The computer has three levels for both sides: Easy plays a random legal move, Medium ranks moves by how many squares each side's queens can reach and plays the best of the top 60 by a territory count, and Hard deepens one move at a time up to 4 moves with a limit of about 0.45 seconds or 6,000 positions. The territory count is the number of squares a side's queens can reach in fewer queen moves than the other side's, found by a breadth-first search. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The two numbers on the side cards, how many squares each side can reach first, come from a breadth-first search and are also what the computer uses to judge a position."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🏹"
---

## How to play

Each side has four queens. Sky starts at the bottom of the board and moves first; Amber starts at the top. The default board is 10 by 10, and there is a small 6 by 6 board for a quicker game.

A turn has two steps.

1. **Slide a queen.** Pick one of your queens and slide it any distance in a straight line along a row, a column or a diagonal, over empty squares. It cannot jump over or land on another queen or on an arrow.
2. **Shoot an arrow.** From the square where the queen has landed, the same queen shoots an arrow along any straight line, with the same rules, onto an empty square. That square is burnt for the rest of the game and shows a cross. The square the queen just left counts as empty, so the arrow may land there.

Queens are never captured. The board slowly fills with arrows until one side cannot move any queen, and that side loses. There are no draws.

Sky queens are plain discs and Amber queens have a ring inside the disc, and both carry a crown, so you never have to tell colours apart. Squares with a green dot are where the selected queen can slide. Squares with a rose ring and a dot are where the arrow can go. Pieces that can move have a dashed outline. The last move is tinted and its arrow square is outlined.

Controls:

- **Opponent:** the computer, or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer, and the menu is switched off in two-player games.
- **You play:** Sky, who moves first, or Amber. When you are Amber the computer opens.
- **Board:** the full 10 by 10 game or the small 6 by 6 game.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move. Once a game is over, undo is off.

Click a queen, then a square with a green dot, then a square with a rose ring. A note above the board says which step you are on. To change your mind, press Escape or click the queen again: once to take back the slide, once more to put the queen down. On the keyboard, arrow keys move around the board, Home and End jump to the ends of a row, and Enter or Space selects or moves. Every square is announced with its row, column and contents, and the status line says what each move did. The page address carries the opponent, difficulty, side and board size.

The two big numbers on the side cards are **squares reached first**: the number of empty squares that one side's queens can reach in fewer queen moves than the other side's. The **shared squares** figure counts squares both sides reach in the same number of moves. They are a guide to who is ahead, not a promise.

## How it works

The engine keeps, for every square and each of the eight directions, the list of squares met going outward. Sliding means walking along such a list until something is in the way. A full move is a slide followed by a second walk from the new square on a board where the old square is empty again. A side that has a queen with an empty square next to it always has a move, because the queen can step there and shoot back at the square it left, so the engine only has to look at the squares next to each queen to know whether a side is stuck.

The test suite pins the rules in several ways:

- **The openings:** four queens each on both sizes, turned half a circle into each other. The first move has 2176 choices on 10 by 10 and 576 on 6 by 6, found by a separately written generator that works with coordinates and loops, and the engine matches it.
- **Slides and arrows:** queens and arrows block queens, arrows block arrows, an arrow may land on the square the queen left, a queen with one empty neighbour still has a move, and a side with none loses.
- **A second implementation:** that generator lists every legal move, and the engine agrees with it in 2,500 random positions on boards from 4 by 4 to 10 by 10, including positions where a side is stuck, with the staged lists the page uses (where the queen can go, where the arrow can go) giving exactly the same moves.
- **Games end:** 200 random games on each size all finish, with the side to move having no legal move, one arrow for every move, four queens each throughout, at most 92 moves on 10 by 10 and 28 on 6 by 6, and both sides winning some.
- **Territory:** the queen-move distances match a second algorithm that keeps relaxing until nothing changes, in 600 random positions, and the side counts follow from them. On the opening board the two sides reach equal numbers of squares.

The computer comes in three levels and plays either side:

- **Easy** picks a random queen that can move, a random square for it and a random arrow.
- **Medium** ranks every legal move by a quick score, the number of squares its queens can slide to minus the number the other side's can, keeps the best 60, and plays the one that leaves the best position by the territory count.
- **Hard** looks further ahead, one move deeper at a time (iterative deepening), up to 4 moves, keeping only the 40 best moves for the first move and then 10, 6 and 4 for the replies. It stops deepening once about 0.45 of a second has passed or 6,000 positions have been looked at, whichever comes first, so a move never ties up the page for long, even on a slow device. The deepest finished search decides the move.

The territory count gives 10 points for each empty square one side reaches first, 5 for a shared square to the side whose turn it is, and 2 for each square of freedom of movement. A stuck side scores far below any of those figures. Moves that tie for best are chosen between at random.

With every move tried at every step, the search agrees with a brute-force solver on who wins 28 small test positions on a 4 by 4 board, and the move it picks from a won position leaves the other side lost. With the limited move lists the computer really uses, the alpha-beta search gives the same value as a plain minimax over the same lists at depths 1 to 3 in positions from random 6 by 6 games. In the test suite, Medium won at least 5 of 6 games against Easy on 6 by 6 from either side, and 7 of 8 on 10 by 10 over both sides together. Hard searching 2 moves ahead won at least 5 of 6 against Easy from either side. In the suite's test positions, Medium and Hard take a move that leaves the other side with no move. The suite asserts that Medium and Hard answer every position they are asked about in under 4 seconds, a bound loose enough for a slow machine; the design limit for Hard is about 0.45 of a second. The computer waits about 0.45 seconds before moving so you can follow along, and moves at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty (for both sides and both boards added together) is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes it. The session tally lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- The computer is a fixed search of at most 4 moves with a hand-made score. It has no learning and no opening book. A careful player can beat it.
- Medium and Hard look only at the best-ranked moves, so they can miss a quiet move that the quick score ranks low.
- The 6 by 6 board starts with four queens each, which is crowded; the page does not claim it is balanced.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.
