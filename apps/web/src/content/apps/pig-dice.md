---
title: "Pig Dice"
category: "fun"
job: "Play Pig Dice, a one-die race to 50 or 100 points, against the computer at three levels or a friend on the same device."
description: "Free Pig Dice game: roll one die, bank your points, and a 1 loses the turn. Three computer levels, race to 50 or 100. No ads. No signup."
aiSummary: "A free browser version of the one-die dice game Pig. On a turn you roll as often as you like: a 1 loses the turn total and passes the turn, any other number adds to it, and you may bank the turn total to add it to your score. The first to reach 50 or 100 wins at once. The computer plays at three levels: Easy banks at 15, Medium banks at 20 with a catch-up rule, and Hard plays the best possible game, found by value iteration over every pair of scores and turn total (about half a million positions at 100 points). The table is checked against a separate solver on small goals and against thousands of played games, and for the 100-point game it gives the first player a 53.06 percent chance with perfect play. Wins against the computer are saved in the browser; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The Hard computer is not a trick: it solves the whole game before it moves, and the tests check that answer two other ways, so it is a good example of how a small dice game can be worked out exactly."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

Be the first to reach 100 points (or 50, if you pick the shorter race). On your turn you roll one die as many times as you like.

- Roll a **2 to 6** and it is added to your **turn total**. You may roll again or bank.
- Roll a **1** and the turn total is lost. Your banked score stays, and the turn passes.
- **Bank** to add the turn total to your score. The turn passes. You cannot bank an empty turn total, since that would only skip your turn.
- If a roll takes your score plus turn total to the goal, you win on the spot. You do not have to bank first.

Pick **The computer** or **A friend on this device**, a computer level (Easy, Medium or Hard) and the race length. Changing any of them starts a new game. After a finished game the next one starts with the other player, and your wins against the computer are counted separately for each level and race length.

**Controls.** The Roll and Bank buttons are large, normal buttons. While focus is inside the game you can also press **R** to roll and **B** to bank. The die shows its dots (a 1 is one dot in the middle, and the turn total shows an "Oops" note in words as well as a coloured ring, so colour is not the only signal). The status line says what happened after every roll and bank, including what the computer did. If your system asks for reduced motion, the die does not tumble and the banner does not move. The computer waits while the tab is hidden.

## How the computer plays

| Level | Rule |
|---|---|
| Easy | Banks as soon as the turn total reaches 15. |
| Medium | Banks at 20. If you are within 25 points of the goal and ahead of it, it rolls on until 32, or until it can win. |
| Hard | Plays the best possible game. |

Banking at 20 is not a guess. A roll adds 2 to 6 (average 4) five times out of six and loses the whole turn total once in six, so one more roll is worth (20 minus the turn total) / 6 points on average. That is positive below 20 and negative above it. The tests add up the six outcomes for every turn total from 0 to 40 to check it, work out the exact average score of a turn for every bank target from 2 to 60, and find that 20 and 21 tie for the best, at about 8.14 points a turn.

## How Hard works

Hard is solved before it moves. For every combination of your score, the opponent's score and the current turn total (about half a million positions in a 100-point game) it works out the exact chance that the player to move wins when both sides play perfectly. Banking leads to a position with a bigger score total; the only way back is a 1, which swaps the two scores. So the solver goes from the biggest score total down, and sweeps the two mirror positions together until their values settle. Then at each position Hard simply rolls or banks, whichever has the higher chance.

The tests check this in four ways:

- A second solver, written with a different data layout and a different update order, gives the same win chance for every position of 8, 15 and 24-point games (within 0.0000001), and makes the same roll-or-bank choice wherever the two choices are not tied.
- The engine plays itself 30,000 times from each of five fixed positions in a 20-point game, and the share of wins is within 1.2 points of the table.
- For the real 100-point game the table gives the player who starts a 53.06 percent chance with perfect play, so the player who moves first has a small edge, and Hard can still lose.
- Over 6,000 games each, with the starting player alternating, Hard beat Easy and Medium and Medium beat Easy.

At the start of a 100-point game, Hard banks at about 21. It keeps rolling when the opponent is about to win, because banking would not help.

## Simulated games finish

The tests play 2,160 complete games: every level against every level, both race lengths and both starting players, 60 games each. Every game ended with one winner at or above the goal and the other below it. The die is a fair six-sided die; with a seeded generator each face came up within one percentage point of a sixth over 60,000 rolls.

## Storage and privacy

Your win counts are small whole numbers kept in your browser under one key, up to six of them (three levels, two race lengths), capped at 9,999. The page address holds the opponent, level and race length. Nothing is uploaded and there is no account.

## Limits

- One die, one player at a time. There is no second die and no special rule for rolling a double.
- Wins are only counted against the computer, never in two-player mode.
- The Hard level needs a moment to prepare when you pick it, because it solves the game first. It does the work in short slices and the status line says "Thinking..." meanwhile, so the page stays responsive; Roll and Bank wait until it is ready.
