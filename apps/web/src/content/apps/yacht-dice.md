---
title: "Yacht Dice"
category: "fun"
job: "Play Yacht Dice, the five-dice scorecard game, alone or against one to three computers at three levels, with a hint for what to keep."
description: "Free Yacht Dice game: roll five dice up to three times, keep what you like and fill a 12-row scorecard. Hints, three levels. No ads. No signup."
aiSummary: "A free browser version of the traditional five-dice game Yacht. Each of 12 turns you roll five dice up to three times, keeping any dice between rolls, then write the dice into one empty row of a 12-row scorecard: ones to sixes (add that face), choice (all five), four of a kind (the four matching dice), full house (all five), small straight (four in a row, 15), large straight (five in a row, 30) and yacht (five the same, 50). Reach 63 in the upper six rows for a 35 bonus. The best possible card is 317. Play alone or against 1 to 3 computers. The computers and the hint work out the average result of all 32 ways to hold five dice, exactly, for one or two rolls left. The scorer is checked against an independent brute-force table of all 7,776 rolls and the hold analysis against a naive enumeration of every ordered re-roll. Best scores are saved in the browser only."
personalUse: "Anyone is welcome to play and learn with this, with no ads. There are only 252 different patterns five dice can make, so the computers can average every possible hold exactly, and the tests check those averages against a slow version that enumerates every ordered roll."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

There are 12 turns, and each turn ends by filling one row of your scorecard. Every row is used once, so after 12 turns the card is full and the game is over.

1. Press **Roll the dice** to roll all five.
2. Tap any dice you want to **keep** (kept dice rise and say "Keep" underneath), then press **Roll again** to re-roll the rest. You get three rolls in all, and you may stop sooner.
3. Press a row in **your column** of the scorecard. The number on each row shows what the dice would score there.

| Row | Score |
|---|---|
| Ones to Sixes | Add up the dice showing that number |
| Choice | Add up all five dice |
| Four of a kind | Four dice the same: add those four |
| Full house | Three of one number and two of another: add all five |
| Small straight | Four in a row (such as 2, 3, 4, 5): 15 |
| Large straight | Five in a row (1 to 5 or 2 to 6): 30 |
| Yacht | All five the same: 50 |

Score 63 or more across the six upper rows (that is three of each number on average) and you earn a **bonus of 35**. If the dice do not fit a row you still have to write something, and a 0 uses that row up. The highest card anyone can write is 317.

You can play **Just me** or against **1 to 3 computers**, at Easy, Medium or Hard. The scorecard has one column per player. Your best total, games finished and wins are kept in your browser. A game where you used a hint still counts as played, but never as a best score or a win.

**Controls.** Tap or click dice and rows. From the keyboard, press **1 to 5** to keep or release a die, **R** to roll and **H** for a hint. In the scorecard, Tab to your column, then Up and Down move between the empty rows and Enter writes the dice into the row. The status line reads out every roll, every hold and every score, including the computers' turns, and kept dice are marked with the word Keep as well as being raised, so colour is not the only signal. Dice tumble only if your system allows motion, and sound is off until you press the sound button.

## How the computers and the hint choose

A turn has only 252 different dice patterns (the order of the dice does not matter) and 32 ways to choose which of five dice to keep. That is small enough to work out exactly. For one roll left, the average value of a hold is the sum over every possible re-roll of its chance times the best row you could then fill. For two rolls left, the same sum uses the one-roll values for the next step.

- **Easy** keeps the face it has most of and writes the dice into the row that scores most.
- **Medium** keeps the dice that give the best average score in the best empty row.
- **Hard** compares each row with what that row usually earns when it is finally used (3 for ones up to 18 for sixes, 22.5 for choice, 4 for yacht and so on), so a good row is not wasted on a poor roll. It also counts a spare point in the upper rows 1.5 times, because the 63 target earns a bonus.

The hint uses the Hard rule. It does not search whole games, so it is a strong rule of thumb rather than a perfect player.

## What the tests check

| Claim | How it is checked |
|---|---|
| Every row scores correctly | An independent scorer written with string patterns and run tests agrees on all 7,776 ordered rolls for all 12 rows. |
| The odd cases | 6 of the 7,776 rolls are yachts, 240 are large straights and 300 are full houses. Five of a kind is not a full house. |
| 317 is the best card | The best score of each row, found by brute force, plus the 35 bonus, adds to 317. |
| The bonus is 35 at exactly 63 | 62 earns nothing, 63 earns 35. |
| The hold averages are exact | For all 32 holds, with one roll left, the engine matches a naive average over every ordered re-roll, for both the Hard and Medium scoring. With two rolls left it matches a naive search on a sample of holds that keep four or more dice. |
| Hard beats Medium beats Easy | Whole games from the same seed, ranked by average total. Hard averages above 150 in the tests. |
| Every game ends | Games of 1 to 4 players always finish with every card full and every total between 0 and 317. |

## Storage and privacy

Your best total, games finished, wins against computers and games with a yacht are small whole numbers kept in your browser under one key. The page address holds the number of computers, the level and the game number. Nothing is uploaded and there is no account.

## Limits

- A second yacht in the same game earns no extra bonus.
- The computers never see your dice or your card. They play from their own dice and card only.
- Hard is a strong rule of thumb, not a solved game: it does not plan the whole scorecard ahead.
