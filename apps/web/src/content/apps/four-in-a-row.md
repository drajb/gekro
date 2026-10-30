---
title: "Four in a Row"
category: "fun"
job: "Play Four in a Row against a computer at three levels, or against a friend on the same screen. Drop discs, line up four, keep a session tally."
description: "Free Four in a Row for one or two players. Three computer levels, undo, keyboard play, and a mark on every disc beyond colour. No ads, no signup."
aiSummary: "A free browser game of Four in a Row on a 7 by 6 board. The computer opponent uses negamax search with alpha-beta pruning, looking 1, 4 or 7 moves ahead on Easy, Medium and Hard. It scores each of the 69 possible lines of four, adds a centre-column bonus, takes a win and blocks an immediate loss on Medium and Hard (Easy skips that check about one move in four), and picks at random among equal moves. Discs differ by a dot or a ring as well as by colour. It supports two players on one screen, undo, full keyboard play, and a session tally. The best win streak per level is kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A rules engine, a search and a board in one small engine, and its tests check every one of the 69 winning lines and the computer's behaviour move by move."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🔴"
---

## How to play

Take turns dropping a disc into one of seven columns. The disc falls to the lowest free space. The first player to line up four of their discs wins, in a row, a column or a diagonal. If the board fills with no four, it is a draw.

Pick an **Opponent**: the computer, or **Two players** on the same screen. Against the computer, choose a **Difficulty** and whether you **go first** (blue discs with a dot) or **go second** (amber discs with a ring). The first player is always blue. Changing any of these starts a new game.

- **Mouse or touch:** press a column button above the board, or tap the board itself. The column buttons say how many spaces are free and switch off when a column is full.
- **Keyboard:** left and right arrows move between columns, Enter or Space drops a disc, and the keys **1** to **7** drop straight into a column.
- **Undo** takes back your last move and the computer's reply, so it is your turn again. With two players it takes back one move. Once a game is over, undo is off. A game in which you used Undo against the computer is not counted: it leaves the session tally, your win streak and your saved best as they were.
- **Copy result** copies a short summary of your session tally and the page address.

Each disc carries a mark as well as a colour, a solid dot for the first player and a ring for the second, so the two sides can be told apart without relying on colour. The winning four is outlined with a solid frame, and the result is also written out in words below the board.

## How it works

The board is 42 cells, and a move is a column. Everything that decides a game lives in a small pure module: dropping a disc, checking the 69 possible lines of four (24 across, 21 up and 24 diagonal), and refusing any move once someone has won.

The computer uses **negamax**, the compact form of minimax, with **alpha-beta pruning**, which skips branches that cannot change the answer. It tries the centre columns first, since they sit in the most lines, so good moves come early and more of the tree is pruned. Instead of re-reading the whole board at every step, the search keeps a running count of each side's discs in every line of four, and updates only the lines through the cell that just changed.

When the search stops looking ahead, it scores the position. For each line that only one side can still use, two discs are worth a few points and three discs more, and discs in the centre column earn a small bonus. A win found sooner scores higher than one found later.

| Level | Looks ahead | Notes |
|---|---|---|
| Easy | 1 move | Plays a random column about one move in four |
| Medium | 4 moves | Never plays at random |
| Hard | 7 moves | Never plays at random |

On Medium and Hard the computer first checks for a move that wins on the spot, then for a move it must make to stop you winning on the spot. Easy does the same except that about one move in four it plays a random move instead. Among equally good moves it chooses at random, so the same position does not always get the same reply.

The search runs on the page itself, after a short pause that lets "The computer is thinking" appear first. No background thread is used. The automated test only requires a Hard move to finish in well under five seconds. The test suite also checks:

- all 69 lines are detected for both players, and a line cannot wrap from the end of one row to the start of the next;
- discs stack from the bottom, a full column rejects a seventh disc, and a finished game accepts no more moves;
- the computer takes a win and blocks a loss at every search depth, from either side and in mirror image;
- turning pruning off never changes a search value, so pruning only saves work;
- hundreds of full games of random and computer play keep the board consistent, with the right disc counts and no move after a win;
- the same random seed gives the same computer move.

## Privacy and storage

Nothing is uploaded and there is no account. Your best win streak for each level is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. The session tally and the current game are kept in memory only, so they reset when you leave the page. The address records only your opponent, level and seat. Clearing site data removes the saved streaks.

## Limits

- Hard looks seven moves ahead, not to the end of the game, so a long plan can still beat it. It is a good opponent, not a perfect one.
- Easy is meant to be beatable: it looks one move ahead and sometimes plays a random column.
- A win streak counts only finished games against the computer in which you did not use Undo. A draw leaves it unchanged, a loss resets it, and a game you abandon is not counted.
- With two players there is no clock, no names and no saved games.
- The tally and the current game are not saved if you reload the page.

Everything runs locally in your browser.
