---
title: "Ten Thousand"
category: "fun"
job: "Play Ten Thousand, the six-dice push-your-luck game: set aside scoring dice, bank or roll again, and race one to three computers to 10,000 or 5,000 points."
description: "Free Ten Thousand dice game: roll six dice, bank your points or risk a bust, and race the computer to 10,000. Three levels. No ads. No signup."
aiSummary: "A free browser version of the six-dice push-your-luck game Ten Thousand, played for points only. On your turn you roll six dice, set aside at least one scoring die or combination (a single 1 is 100, a single 5 is 50, three of a kind is 100 times the number with three 1s worth 1,000 and each extra die doubling it, a 1-to-6 straight is 1,500, three pairs is 1,000), then bank the turn total or roll the dice that are left. If all six score you roll all six again. A roll with nothing that scores loses the turn total. When a player banks the goal, everyone else finishes that round and the highest score wins. The Hard computer reads an exact table of the average result of rolling or banking for every number of dice and turn total, checked against a naive enumeration of every ordered roll and against a 20,000-turn simulation. A turn played for the most points averages about 561.7 points. Best scores are saved in the browser only."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The Hard computer is a worked example of an optimal-stopping problem: for every number of dice and every turn total it knows the exact average result of rolling on, and the tests check that table against a slow enumeration of every ordered roll."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

Be the first to bank 10,000 points (or 5,000 for a shorter game), playing against one, two or three computers. Points only: there is no money or betting.

1. Press **Roll** to roll six dice.
2. Pick the dice that score (tap them, or press the number keys), then press **Set aside**. Every die you set aside must be part of the score. The button **Pick all that score** chooses the best set for you.
3. Now **Bank** the turn total to add it to your score and pass the dice, or **Roll** the dice that are left to try for more.
4. If a roll has **nothing that scores**, that is a bust: you lose the turn total and the dice pass on. Your banked score is always safe.
5. If all six dice have scored, you have **hot dice** and roll all six again, keeping your turn total.

| Dice | Points |
|---|---|
| A single 1 | 100 |
| A single 5 | 50 |
| Three of a kind | 100 times the number (three 1s: 1,000) |
| Four, five or six of a kind | Double for each extra die (four 4s: 800, five: 1,600, six: 3,200) |
| Straight, 1 to 6 | 1,500 |
| Three pairs | 1,000 |

You can choose that the **first bank needs 500 points** (the default) or any amount. When someone banks the goal, everyone else finishes that round, so all players take the same number of turns, and the highest score wins. A tie is shared. A game that somehow lasts 200 rounds stops there.

**Controls.** Tap or click dice and buttons. From the keyboard, press **1 to 6** to pick a die, **S** to set aside, **A** to pick all the dice that score, **R** to roll and **B** to bank. The status line reads out every roll, pick, bank and bust, including what the computers do. A picked die has a tick, a set-aside die says "set", and a bust is marked with a dashed outline and the words "Nothing scored", so colour is never the only signal. Dice tumble only if your system allows motion, and sound is off until you press the sound button.

## How the computers play

| Level | Rule |
|---|---|
| Easy | Sets aside every die that scores. Banks at 300 or more. |
| Medium | Prefers picks that keep dice to roll. Banks at 500, or at 300 with two dice or fewer left. |
| Hard | Reads the exact table below: picks the dice with the best average result, and banks when banking is worth at least as much as rolling. |

All three bank at once if that wins the game, and Medium and Hard keep rolling in a final round until they pass the best other score.

## The numbers behind Hard

A roll of six dice scores nothing about 2.3 percent of the time, but a roll of one die busts two times in three. The tests count every ordered roll to get these exactly.

| Dice rolled | Rolls that score nothing | Chance of a bust |
|---|---|---|
| 1 | 4 of 6 | 66.7% |
| 2 | 16 of 36 | 44.4% |
| 3 | 60 of 216 | 27.8% |
| 4 | 204 of 1,296 | 15.7% |
| 5 | 600 of 7,776 | 7.7% |
| 6 | 1,080 of 46,656 | 2.3% |

The Hard table is built from the top down. A pick always adds at least 50 points, so the value of rolling n dice with turn total t depends only on larger totals. For each of the 462 ways six dice can land (and the smaller sets) it takes the pick with the best result, adds up the chances, and compares rolling with banking. The table stops at a turn total of 6,000, where it always banks. Played this way a fresh turn averages about 561.7 points.

## What the tests check

| Claim | How it is checked |
|---|---|
| The scoring table is right | An independent scorer that tries every way to split a set of dice into singles, sets, a straight and three pairs agrees with the engine on every set of 1 to 6 dice and every pick inside it. |
| Which rolls score | The bust counts above are checked on every roll of 1 to 6 dice against the same independent scorer. |
| The roll-or-bank table is exact | For totals just under the cap it matches a naive enumeration of every ordered roll, for one to six dice. |
| A turn averages about 561.7 | The table says 561.7. A simulation of 20,000 Hard turns stays within 18 points. |
| Hard is the strongest level | Over 160 games each from alternating starts, Hard wins more than 60 percent against Easy and more than half against Medium. |
| The turn rules hold | Hot dice, busts, the opening score and the final round are tested one by one. |
| Games always end | 400 games of random legal actions, and 150 computer-only games, always finish with every score a multiple of 50. |

## Storage and privacy

Your best score, games finished, wins and hot-dice count are small whole numbers kept in your browser under one key. The page address holds the number of computers, the level, the goal and the opening score. Nothing is uploaded and there is no account.

## Limits

- The table assumes you want the most points from the turn. It does not look at the other players' scores, which is why Hard adds the goal and final-round rules on top.
- Four of a kind plus a pair is not treated as a combination: the pair scores only if it is 1s or 5s.
- You always go first.
