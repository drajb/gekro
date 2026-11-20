---
title: "Rock Paper Scissors"
category: "fun"
job: "Play rock paper scissors, best of 3, 5 or 7, against a random computer, a pattern-watching computer or a friend on the same device."
description: "Free rock paper scissors with a computer that plays at random or reads your pattern, or two players on one device. Best of 3, 5 or 7. No ads. No signup."
aiSummary: "A free browser rock paper scissors game. Matches are best of 3, 5 or 7 against the computer or between two players sharing one device, and a draw is simply replayed. The computer has two modes. Random plays each move with equal chance. The pattern watcher builds counts from every earlier round against the computer (up to the last 300): what the player did after their last one, two and three moves, after a move that won, lost or drew, and their overall mix. These vote for the move expected next, with more weight for longer patterns and more trust the more often a pattern has been seen, and the computer plays the move that beats the expected one, except one round in ten when it plays at random. It decides before the player chooses and sees only earlier rounds. In tests it beats fixed-pattern players in over 70 percent of rounds and wins about a third of rounds against a random player. Hands are drawn as abstract shapes. Match records are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The watcher is a small prediction model you can test yourself: play the same pattern for a while and watch your own move counts, and it starts to win."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "✂️"
---

## How to play

Pick an opponent and a match length, then choose **rock**, **paper** or **scissors**. Rock beats scissors, scissors beat paper, and paper beats rock. If both sides choose the same, it is a draw and the round is played again. The first side to win the number of rounds shown (2 in a best of 3, 3 in a best of 5, 4 in a best of 7) wins the match.

The three symbols are drawn as shapes: a rough stone with two cracks for rock (amber), a page with lines for paper (blue), and two crossing blades with ring handles for scissors (red). Every button also carries its name and a key, so colour is never the only clue.

**Controls.**

- Against the computer, tap a button, or press **R**, **P** or **S**, or **1**, **2** or **3**. The keys work while a match is running, wherever you are on the page, except when you are typing in a text box or using a menu or dialog. Once a match is over they do nothing until you start another.
- For two players on one device, Player 1 uses the first row of buttons or **Q**, **W** and **E**. Player 2 uses the second row or **I**, **O** and **P**. Neither choice is shown until both players have chosen; the page only says that a player is ready.
- After a round, both choices appear side by side, the winner's box gets a thick green border and the words "Won this round", and the page announces the result and the score. A box with a dotted border is a draw.

**Opponents.**

- *Computer: plays at random* picks each move with equal chance, whatever you do.
- *Computer: pattern watcher* reads your earlier rounds and tries to guess your next move. If you keep playing rock, it soon plays paper. If you cycle rock, paper, scissors, it works that out too.
- *Two players, one device* needs no computer at all.

In the two-player mode the move counts and record are hidden, since they are about the computer. Against the computer, the panel beside the board counts how many times you have played each move this visit, with a bar and a number for each, and tells you your most played move. **Forget my moves** clears those counts and gives the watcher a blank start. Your moves are only kept in memory while the page is open. What the page does save, in your browser, is the number of matches you have won and lost against each computer opponent.

Changing the opponent or the match length starts a new match. Copy result puts a short line on your clipboard with the match length, the score and the opponent.

## How it works

The pattern watcher is a small voting model, and it is written to be inspected. Before each round it builds counts from the history of earlier rounds against the computer, capped at the last 300. Five kinds of pattern vote on what you will play next.

| Pattern | Weight |
|---|---|
| your overall mix of moves | 1 |
| what you played after your last move | 2 |
| what you played after your last move and the one before | 4 |
| what you played after your last three moves | 6 |
| what you played after your last move together with whether it won, lost or drew | 3 |

Each pattern gives its weight, times how often each move followed it, times a trust factor that grows the more often the pattern has been seen. The move with the most votes is the expected one, and the computer plays the move that beats it. One round in ten it plays at random instead, and it also plays at random when two moves tie. The pattern that mixes your move with the result catches people who change their move after losing, or repeat it after winning.

It cannot cheat. The computer draws its move at the start of the round from earlier rounds only, keeps it out of the page, and reveals it after you choose. The watcher is deterministic for a given history and random stream, so the same history always leads to the same decision. Someone who knows exactly how it works could still second-guess it, which is why a tenth of its moves are random.

### What the tests check

| Claim | How it is checked |
|---|---|
| The rules | all nine pairs written out by hand, and the counter-move always beats its target |
| Matches | 10,000 random matches recounted: scores, draws, winner and the stop at the target |
| The random computer is fair | 60,000 draws within 1 percent of a third each, and about a third of wins against an always-rock player |
| The watcher beats fixed patterns | nine kinds of player, five seeds each, 600 rounds: it wins over 70 percent of rounds after the first 30 (about 93 percent against always rock, a three-move cycle and a six-move pattern) |
| The watcher predicts patterns | after 40 rounds it names the next move at least 95 percent of the time for five periodic players |
| It is no better than chance against random play | 6,000 rounds against a random player: it wins and loses between 30 and 37 percent each |
| It really uses the history | after 30 identical moves it plays the counter between 90 and 96 percent of the time, for each of the three moves |
| It cannot see your move | 200 trials where your move in round t is changed: the computer's moves up to and including round t do not change |
| It is deterministic | the same seed and the same history replay exactly |
| Move counts and the saved record | counts recounted by hand, and only whole numbers from 1 to 99,999 for the four record names survive |

## Privacy and storage

Nothing is uploaded and there is no account. Your match record against each computer opponent is stored in your browser as small whole numbers. Clearing site data removes it. Your individual moves are never stored.

## Limits

- The watcher is a simple model. It works well against habits and badly against someone who chooses truly at random, where nobody can do better than a third.
- It learns from the rounds you have played in this visit only, and it forgets everything when you close or reload the page.
- Two-player mode shares one device, so the second player has to look away while the first chooses, or use the keys.
- The match record counts only finished matches against the computer.
