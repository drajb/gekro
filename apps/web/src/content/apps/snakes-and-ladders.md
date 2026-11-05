---
title: "Snakes and Ladders"
category: "fun"
job: "Play Snakes and Ladders with one to four players, each a person or the computer, on one of three boards, with an optional exact finish."
description: "Free Snakes and Ladders for one to four players, people or computer. Three boards, an exact-finish option and a fewest-rolls record. No ads. No signup."
aiSummary: "A free browser Snakes and Ladders on a 10 x 10 board. One to four players, each a person or the computer, take turns rolling one six-sided die. Three original boards are drawn as SVG built in code: Hillside (8 ladders, 8 snakes), Gentle slopes (9 ladders, 6 snakes) and Steep valley (6 ladders, 10 snakes). No two jumps share a square, so a jump never leads into another, and every square can still reach 100. An optional exact-finish rule makes an overshooting roll leave the token in place. The average game length for one player is worked out by solving a linear system and checked against value iteration and against thousands of played games: 37.7, 27.3 and 53.0 rolls on the three boards, or 43.7, 31.7 and 77.3 with exact finish. The fewest rolls in a win by a person are saved in the browser per board and finish rule; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. What I like most is the average game length: instead of guessing how long a board takes, the page solves it as a set of equations, and the tests check that answer against thousands of games the engine actually plays."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

Pick a board, the number of players (1 to 4) and whether each player is a person or the computer. Everyone starts off the board. On your turn press **Roll the die**; your token moves that many squares along the numbered path. The path zig-zags: square 1 is bottom left, 10 is bottom right, 11 sits above 10, and 100 is top left.

- **Ladder:** land on the bottom of a ladder and you climb to the top.
- **Snake:** land on a snake's head and you slide down to its tail.
- **Win:** the first token to reach square 100 wins. By default any roll that reaches or passes 100 counts. Tick **Exact finish** and the last roll must land exactly on 100; a roll that is too big leaves your token where it is.

Computer players roll for themselves after a short pause. You can switch a player between a person and the computer in the middle of a game. Changing the board, the number of players or the exact-finish box starts a new game.

Each player has a token with its own shape and number (a circle 1, a square 2, a triangle 3, a diamond 4) as well as its own colour, so the tokens can be told apart without colour. The player list under the die gives each player's square in words. The status line says what just happened, for example "Player 1 rolled a 3 and moved from the start to square 3. A ladder! Climbed up to square 22." Tokens hop square by square; if your system asks for reduced motion they jump straight to the end square, and the die does not tumble. The game also waits while the tab is hidden.

**Controls.** The roll button is a normal button, so Tab to it and press Enter or Space. There are no game-wide keys, so the page keeps its usual keyboard behaviour. Each board is also listed in words in the "How it works" section for anyone who cannot see the picture.

## The boards

| Board | Ladders | Snakes | Average rolls for one player | With exact finish |
|---|---|---|---|---|
| Hillside | 8 | 8 | 37.7 | 43.7 |
| Gentle slopes | 9 | 6 | 27.3 | 31.7 |
| Steep valley | 6 | 10 | 53.0 | 77.3 |

All three layouts are my own. The tests check that none of them shares a jump with a very common printed layout, that the boards share no jump with each other, and that on every board the ladders go up and the snakes go down, no jump touches square 1 or 100, and every jump is at least six squares long.

## How it works

The engine is a set of plain functions with no page attached. A move is `square + roll`, then at most one snake or ladder. Because no two jumps share a square, a jump can never lead into another jump, so one lookup is always enough. The tests compare the engine's move with a second, deliberately naive version written straight from the rules, for every square from 0 to 99, every roll, every board and both finish rules.

The die maps a random number from 0 up to (but not including) 1 onto 1 to 6. The page takes its random numbers from the browser's secure generator. Tests with a seeded generator check the boundaries and that each face turns up about a sixth of the time over 60,000 rolls.

**Average length.** A snake sends a token backwards, so the game is not a simple left-to-right sweep. The page treats each square's expected number of remaining rolls as an unknown, writes one equation per square (the expected rolls from a square is 1 plus the average over the six outcomes), and solves the 100 equations together with Gaussian elimination. The tests check the answers three ways: against a separate value-iteration calculation, to six decimal places; against the engine itself, played 20,000 times per board and rule, within 3 percent; and for sense (exact finish is always slower, Gentle slopes is quickest and Steep valley slowest). The figures in the table are those results to one decimal place.

**Finishing.** The tests also check that from every square, with and without exact finish, a token can still reach 100, and they play 1,440 complete games with one to four players across all boards and both rules. Every one ended with exactly one token on square 100, and the players' roll counts never differed by more than one.

## Best score and storage

When a person wins, the number of rolls the winner took is compared with the saved record for that board and finish rule, and the smaller number is kept. Wins by the computer never count. There are six records at most, stored in your browser as small whole numbers under one key. The page address holds the board, player count, player types and finish rule so a setup can be shared. Nothing is uploaded and there is no account.

## Limits

- One die only, no extra turn for a six, and no choices in the game: your only decision is when to press Roll.
- Switching the board, player count or exact-finish box ends the game in progress.
- The record is for fewest rolls by a person and is not shown for the computer.
