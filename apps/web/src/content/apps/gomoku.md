---
title: "Gomoku"
category: "fun"
job: "Play free Gomoku (five in a row) against the computer at three levels, or against a friend on the same screen. Freestyle rules, three board sizes."
description: "Free Gomoku, five in a row, on a 9, 13 or 15 point board. Play the computer at three levels or a friend. No ads, no signup, runs in your browser."
aiSummary: "A free browser Gomoku (five in a row) with freestyle rules: players alternate placing stones, and the first to make an unbroken line of five or more across, down or diagonally wins; a full board is a draw. Boards are 9 x 9, 13 x 13 or 15 x 15. The computer has three levels: Easy plays near existing stones but always takes a win and blocks a loss; Medium scores every empty point near a stone by the shapes it builds and stops, using a 6,561-entry pattern table; Hard adds a search for wins made of consecutive fours and an alpha-beta search three moves ahead over the 12 best points, capped at about a second. It is a heuristic search, not a perfect player. Records are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. Gomoku is a good small test of game AI: the rules fit in two lines, and a pattern table plus a short search already plays a decent game. This version keeps the whole engine small, with tests behind the numbers on this page."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "⚫"
---

## How to play

Players take turns placing one stone on an empty point. Solid stones move first and ring stones move second, so the two sides are told apart by shape as well as colour. The first player to make an unbroken line of five or more of their own stones, across, down or on either diagonal, wins. If the board fills up with no such line, the game is a draw.

These are the freestyle rules: a line of six or more also wins, and the first player has no extra restrictions.
- **Board size:** 9 x 9, 13 x 13 (the default, so the points stay comfortable to tap on a phone) or 15 x 15.
- **Opponent:** the computer, or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard, used when you play the computer.
- **You play:** first (solid stones) or second (ring stones). Choosing second gives the computer the opening move.

Click or tap a point to place a stone. With the keyboard, the arrow keys move around the board, Home and End jump to the ends of a row, and Enter or Space places a stone. The newest stone carries a small dot, and a winning line is highlighted. **Undo** takes back your last move and the computer's reply, or one move in a two-player game.

## How it works

The engine is a plain module with no page code in it, so the tests can play thousands of moves against it.

**The board and the win check.** The board is one flat array of n x n cells. After each move the game looks along the four line directions from the new stone, counting same-coloured stones in both directions, and reports every line of five or more it finds. Because it walks by row and column rather than by array index, a run cannot wrap from the end of one row to the start of the next; the tests check that case at the edges and corners of all three sizes.

**A pattern table instead of pattern matching.** To judge a point, the engine looks at the nine cells along a line centred on it. Each of the other eight cells is empty, one of the player's own stones, or blocked (an enemy stone or the edge of the board). That gives 3^8 = 6,561 possible lines, and each is classified once when the page loads: nothing, two, open two, three, open three, four, open four or five. An open three is one that a single extra stone turns into an open four, which has two ways to finish and cannot be stopped with one block. Scoring a point is then four table lookups per side, one per direction.

**Medium.** Every empty point within two steps of an existing stone gets a score: the shapes a stone there would build for the computer, plus the shapes it would stop you from building (weighted slightly higher, so a threat is blocked rather than ignored), plus bonuses for combinations such as a double four or a four with an open three. It plays the best-scoring point, breaking ties at random. It has no look-ahead.

**Hard.** It uses the same scores and adds two searches. First it looks for a win made only of consecutive fours, up to four in a row: each four forces the opponent to block the single finishing point, so the sequence can be searched exactly. If there is none, it runs an alpha-beta search three moves ahead over the 12 best-scoring points at each step, deepening one move at a time so the answer is still sensible if the time cap of about one second is reached. The search ends by scoring the position: every window of five cells that holds only one colour counts, longer windows count more, and so does the best next shape each side could build.

**Every level** first takes a win if one is on the board, then blocks the opponent's win. Easy otherwise plays a random empty point next to an existing stone.

**How strong are they?** The test suite plays seeded games and these are the results it recorded on a normal machine; Hard stops on a time limit, so a very slow machine could differ. On 13 x 13, alternating who moves first, Hard beat Easy in all 16 games, and Hard beat Medium in 8 of 16 with 3 losses and 5 draws. Medium beat Easy in at least 9 of 10.

## Privacy and storage

Nothing is uploaded and there is no account. After a win against the computer, the page saves your number of wins and your fewest moves in a win for that difficulty and board size, in your browser's local storage under one key, as plain numbers. Only games against the computer where you did not use Undo count. The session tally lives in memory and resets when you leave the page, and the board size, opponent, difficulty and side are kept in the page address. Clearing site data removes the saved records.

## Limits

- **Hard is a heuristic search, not an unbeatable player.** It looks three moves ahead with scores from a fixed table, and the forced-win search only follows runs of fours, so it can miss longer combinations and be caught by plans that take more than a few moves to develop. A careful player can beat it, and in the test games it did not win every game against Medium.
- Freestyle rules only: no Renju restrictions on the first player, no exact-five rule and no opening-swap rules.
- Two players share one screen. There is no online play.
- On a narrow phone the points on a 15 x 15 board are small. 13 x 13 is the default for that reason.
- Records are per browser and per board size and difficulty, and are not shared between devices.

Everything runs locally in your browser.
