---
title: "Merge Tiles"
category: "fun"
job: "Play a free sliding tile game on a 4 x 4 grid. Slide, merge equal tiles, reach 2048 and keep going. Keyboard, swipe or buttons, with one-step undo."
description: "Free tile-merging puzzle on a 4 x 4 grid. Arrow keys, swipe or buttons, one-step undo, a local best score. No ads, no signup, runs in your browser."
aiSummary: "A free browser tile game on a 4 x 4 grid. Each move slides every tile as far as it can; two equal tiles that meet merge once into one worth double, and a tile made by a merge cannot merge again in the same move. After a move that changed the board, one new tile appears in a random empty cell, a 2 nine times in ten and a 4 otherwise. Reaching 2048 shows a note and play can continue; the game ends when the board is full and no equal tiles touch. Input is arrow keys or WASD, on-screen buttons, or a swipe. It has a single-step undo, which ends best-score tracking for that game. The engine is pure functions that take a random number generator, so tests replay games exactly. The best score is kept in local storage as plain numbers; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A small engine and a board, with rules covered by tests that play thousands of moves, and no account or sign-in."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🧩"
---

## How to play

The board is a 4 x 4 grid. Each move slides every tile as far as it can in one direction. When two tiles with the same number meet, they merge into one tile worth double, and the new tile's value is added to your score. After any move that changed the board, one new tile appears in a random empty cell: a 2 about nine times in ten, a 4 otherwise.

Click the board to focus it, then use the arrow keys or **W, A, S, D**. On a phone or tablet, swipe on the board; a drag of 24 pixels or more counts as one move. The four buttons beside the board do the same thing if you prefer to tap. **U** undoes the last move. **New game** starts over.

Reach a 2048 tile and you get a note, then you can keep playing for a higher score. The game ends when the board is full and no two equal tiles touch. Arrow keys only scroll the page when the board is not focused.

## The one rule people argue about

A tile made by a merge cannot merge again in the same move. So a row of four 2s becomes two 4s, not one 8, and a row of 2, 2, 4 becomes 4, 4 rather than a single 8. When three equal tiles line up, the pair nearest the edge you are sliding toward merges first and the third waits for the next move. These cases are pinned by name in the test suite.

## How it works

The engine is a handful of pure functions with no page code in them. Sliding is done one line at a time: the non-empty tiles are squeezed toward the leading edge, then neighbours that are equal merge in a single pass that skips over any tile it has just made. Rows and columns share that one routine, with a small index map that turns "left, right, up, down" into the same operation.

Randomness is passed in as a function. The page hands it a source backed by `crypto.getRandomValues`, and the tests hand it a seeded generator, so a whole game can be replayed move for move. The tests check, among other things:

- sliding left, right, up and down agree with each other under mirroring and transposing the board;
- a move that changes nothing adds no tile and never asks for a random number;
- over a long random-play run, every tile stays a power of two, the total value on the board only grows by the tile that was spawned, and the tile count falls by one per merge and rises by one per spawn;
- about nine in ten spawned tiles are 2s, measured over twenty thousand spawns;
- game over is detected exactly when no direction can move.

Each tile has a stable identity, which is what lets the page animate it. A tile that slides keeps its element and moves by changing its position; a merge slides both tiles into the cell and then replaces them with a new, doubled tile. If your system asks for reduced motion, none of that animates and tiles simply appear in place.

## Scoring, best score and undo

Your score is the sum of the tiles created by merges. Your best score and largest tile are saved in your browser, and only from games where you did not use undo. Undo is a single step, and using it ends best-score tracking for that game, since it lets you retry a move after seeing the next tile. You can still keep playing; it just does not count toward your best.

## Privacy and storage

Nothing is uploaded and there is no account. The best score and largest tile are stored in your browser's local storage as plain numbers, under one key. Clearing site data removes them. If storage is blocked, the game still works; scores just do not persist.

## Limits

- Undo goes back one move only.
- A game in progress is not saved if you close or reload the page.
- Only the best score and largest tile are tracked; there are no leaderboards or daily boards.
- The new-tile odds are fixed, and the board is always 4 x 4.
- Reaching a winning tile is not guaranteed to be possible from every starting position; some games run out of moves first.

Everything runs locally in your browser.
