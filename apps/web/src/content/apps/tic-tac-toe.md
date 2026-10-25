---
title: "Tic Tac Toe"
category: "fun"
job: "Play free Tic Tac Toe against a computer at three levels, including one that never loses, or against a friend on the same device."
description: "Free Tic Tac Toe against the computer (easy, medium or unbeatable) or a friend on one device. Keyboard friendly, no ads, no signup, runs in your browser."
aiSummary: "A free browser Tic Tac Toe. Easy plays random legal moves, Medium takes a win or blocks a loss and otherwise plays randomly, and Unbeatable runs a memoised minimax search over the whole game tree, so it never loses as X or as O. The test suite enumerates every reachable position (5,478, including the empty board) and every possible complete game (255,168: 131,184 X wins, 77,904 O wins, 46,080 draws), and plays the Unbeatable computer against every possible sequence of opponent moves as both first and second player. Two-player mode, keyboard play (arrow keys, Enter, number keys 1 to 9) and a session tally are included. Best unbeaten streaks are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. Tic Tac Toe is small enough to solve completely, which makes it a good place to see minimax working with nothing hidden. The engine is small, and the tests check it against every game that can be played."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "⭕"
---

## How to play

Take turns placing X and O on a 3 x 3 grid. The first to get three in a row, across, down or diagonally, wins. If the board fills up with no line, it is a draw. X always goes first.

Pick **Computer** or **Two players on this device** under Opponent. Against the computer, choose a difficulty and whether you play X (you move first) or O (the computer moves first). Click or tap a square, or use the keyboard: arrow keys move between squares, **Enter** or **Space** places your mark, and the number keys **1 to 9** place one directly (1 is the top left, 9 is the bottom right). The winning line is outlined, filled and underlined, so it does not rely on colour alone.

The computer answers after a short pause of about a third of a second, and the board is locked while it thinks. If your system asks for reduced motion, the pause and the small pop-in animation are both switched off.

## How it works

The board has only nine squares, so it can be searched completely. Counting by exhaustive enumeration, which the test suite repeats on every run:

- **5,478** different positions can ever occur in a legal game, counting the empty board once and counting a position once however it was reached.
- **255,168** different complete games can be played, meaning distinct sequences of moves that end in a win or a full board. Of those, **131,184** end in an X win, **77,904** in an O win and **46,080** in a draw. These count move sequences, not probabilities, because a player choosing moves at random does not make every sequence equally likely.

The three difficulties use that structure in different amounts:

- **Easy** picks a random empty square. It only ever plays a legal move, and nothing more.
- **Medium** looks one move ahead. If it can complete a line, it does. Otherwise, if you could complete a line next turn, it blocks that square. Otherwise it plays at random. It never misses a win or a block that is right in front of it, but it does not plan, so a fork (two threats at once) beats it.
- **Unbeatable** uses minimax. In plain words: for every square it could play, it imagines every reply you could make, every reply it could make to that, and so on to the end of the game. It assumes you will always choose the reply that is worst for it, and it picks the square whose worst case is best. A win counts for more the sooner it arrives, so it takes quick wins. When several squares are equally good it picks one at random, so games differ. Because there are only 5,478 positions, each is solved once and remembered, and the whole search is effectively instant.

What the tests prove about Unbeatable: they walk every possible sequence of opponent moves, with Unbeatable playing any of its best moves at each turn, once with it as X and once with it as O. It does not lose in a single one. Two Unbeatable players always draw, which matches the long-known result that Tic Tac Toe is a draw under perfect play. The tests also check the minimax values against a plain, separate depth-first search of every position, and check that Medium takes an immediate win and an immediate block in every position where one exists.

## Privacy and storage

Nothing is uploaded and there is no account. Your session tally (wins, draws, losses, or X wins, draws and O wins in two-player mode) lives only in the open page and disappears when you leave it. The only thing saved is your best unbeaten streak per difficulty, as plain numbers in your browser's local storage under one key. Clearing site data removes it. The page address records your settings (opponent, difficulty, side) so you can bookmark them, and nothing else.

## Limits

- Only finished games against the computer count toward the streak. A win or a draw extends it and a loss ends it. Restarting a game you have already moved in also ends the streak, so walking away from a lost game does not protect it.
- The unbeaten streak counts draws, which is why it is the number worth watching on Unbeatable: you cannot win there, so a draw is the best result.
- Two-player mode shares one device and has no streak or saved score.
- Difficulty and "You play" apply only to the computer. They are remembered in the page address in two-player mode but do nothing there.
- It plays the standard 3 x 3 game only: no bigger boards, no online play, no undo.

Everything runs locally in your browser.
