---
title: "Backgammon"
category: "fun"
job: "Play Backgammon against the computer at three levels, or with a friend on one screen. Standard rules, bar, bearing off and gammons, with no betting."
description: "Free Backgammon: standard 24-point rules, three computer levels, two players, undo within a turn. No doubling cube, no stakes. No ads, no signup."
aiSummary: "A free browser game of Backgammon with the standard rules on a 24-point board: two dice, doubles played four times, hitting a lone checker sends it to the bar, a checker on the bar must enter first, you must use as much of the throw as you can and the larger die if only one can be played, and bearing off starts once all 15 checkers are in the home board. A game is worth 1 point, 2 for a gammon and 3 for a backgammon; there is no doubling cube and no stakes, only points on the page. The move generator is compared with a second implementation, written in each player's own point numbers, on more than a thousand positions and all 21 throws, and the number of distinct opening plays for each of the 21 throws is pinned. The computer has three levels: Easy plays a random legal play, Medium takes the best-scoring play by pips, blots, made points, primes and the bar, and Hard also averages over the opponent's 21 possible replies for its 7 best candidates. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The rules are compared with a second implementation that works in a different numbering, and the computer scores positions by pips, blots, blocks and the bar."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

Backgammon is a race with some fighting in it. Each side has 15 checkers on a board of 24 points, and both sides travel around the board in opposite directions into their own home board, and then bear off. The first side with all 15 checkers off wins.

The two sides are called Solid and Ring. Solid checkers are plain rose-coloured discs and Ring checkers are violet discs with a pale ring, so you can tell them apart without relying on colour. The board is drawn standing up in two columns of twelve points, with the bar across the middle. The numbers on the points are your own: your farthest point is 24 and your home board is points 1 to 6, at the bottom of your column. Solid moves up the right column and down the left. Ring moves the other way round.

**Each turn.** Roll two dice. Each number is a separate move, and you can use both on one checker or one each on two. If you roll a double, you play that number four times.

**Where you can land.** On an empty point, on a point with your own checkers, or on a point with a single enemy checker, which is hit: it goes to the bar. A point with two or more enemy checkers is blocked.

**The bar.** A checker on the bar must come back in before you move anything else. It enters on the point that matches the number rolled, counted from the enemy's end of the board, if that point is not blocked. If it cannot enter, you lose that number.

**Using the whole throw.** You must play both numbers if there is any way to. If you can play only one of them, you must play the larger one if you can. The page enforces this: it will only mark a move if some complete play still follows it.

**Bearing off.** Once all 15 of your checkers are in your home board, you may take checkers off the board with an exact number. If you roll a number larger than your farthest checker needs, that checker may bear off with it. A hit sends a checker back to the bar, and bearing off stops until it is home again.

**Scoring.** A normal win is worth 1 point. If the loser has not borne off a single checker it is a gammon, worth 2 points, and if the loser also still has a checker on the bar or in the winner's home board it is a backgammon, worth 3. There is no doubling cube, no money and no stakes: the points are a way to score a game, nothing else.

**Starting.** Each side throws one die. The higher die starts and plays both numbers as its first turn. Ties are thrown again.

Controls:

- **Opponent:** the computer or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer.
- **You play:** Solid or Ring. The opening throw decides who goes first.
- **Roll dice:** two dice are drawn with pips. A die dims once its number has been played, and a line shows what is left.
- **Undo:** inside a turn it takes back one move at a time. Once you have taken back every move of the turn, one more press goes back to the start of your previous turn, with the same roll, and that game is not counted as a result. Once a game is over, undo is off.
- **New game:** starts again with the current settings.

Click a point with a dashed edge to pick a checker up, then click a point with a green dot to move it there, or click Bear off. When a checker is on the bar it is picked up for you. If two numbers could do the same move, the smaller one is spent. When nothing can be played, or every number has been used, the turn passes by itself and the page says so. On the keyboard, arrow keys move around the board and the bar, Enter or Space picks up or puts down a checker, and Escape puts it back. Every point is announced with its number, what is on it and whether it is a legal move, and the status line says what each move did. The page address carries your settings, so you can bookmark a setup.

## How it works

The board is 24 points plus four extra slots: the bar and the borne-off pile for each side. A single move is a checker, a die and a destination. A play is a sequence of moves. To find every legal play, the engine builds them one die at a time, merging any two sequences that end in the same position, tries both orders of the two dice, keeps only the longest plays, and applies the larger-die rule when only one die can be played. The page uses a different route: after each click it asks which single moves still leave a longest play possible, and the tests check that the two routes reach exactly the same end positions.

The test suite pins the rules in several ways:

- **The start:** 15 checkers each and 167 pips to go for each side, and the board is the same seen from either side.
- **Hand-built positions:** entering from the bar and being blocked, nothing else moving while a checker is on the bar, hits and blocks, no bearing off with a checker outside home or on the bar, exact and larger-die bearing off for both sides, both numbers forced when an order allows it, the larger die forced when only one can be played, doubles played four times, and no legal move at all.
- **A second implementation:** a separate version, written in each player's own point numbers (24 is the farthest point, 25 the bar, 0 off) with plain recursion over every order of the dice, gives exactly the same set of end positions as the engine for all 21 throws on positions from 12 random games, and for random throws on 3000 random positions, including ones with checkers on the bar and in the bear-off.
- **Opening plays:** the number of distinct end positions for each of the 21 throws from the start is pinned: for example 42 for double ones, 15 for 2-1, 7 for 6-5 and 4 for double fives, and each is also equal to the second implementation's.
- **Whole games:** 40 random games always end, each side always has 15 checkers, no point ever holds both colours, and the winner has borne off all 15. Gammon and backgammon scoring is checked on hand-built endings.

The computer comes in three levels:

- **Easy** plays a random legal play.
- **Medium** lists every legal play and takes the one that scores best.
- **Hard** takes the 7 best of those and looks at the opponent's reply to each, for every one of their 21 possible throws, weighted by how likely each is (one in 36 for a double, two in 36 for any other), assuming the opponent picks the reply that is worst for the computer.

A position is scored by the race (the difference in pips to go), and, while the two armies can still hit each other, by blots left open to a hit (weighted by the chance of being hit and how far the checker has travelled), made points (home-board points count more), runs of consecutive made points that form a block, stacks that are too tall, and checkers on the bar. In the test suite, over 10 seeded games with sides alternating, Hard and Medium each beat Easy at least 9 times, Hard wins at least half of 30 games against Medium, a Hard turn never looks at more than about 33 thousand positions, and the suite fails if one takes 6 seconds, even on a busy machine. Backgammon has a lot of luck, so even the best play loses sometimes, and the gap between Medium and Hard is small. The computer rolls and plays its moves one at a time with short pauses so you can follow them, and plays at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The session points live only on the page and reset when you leave it. A game in which you went back a turn with Undo is not counted, so the saved figures are not inflated.

## Limits

- There is no doubling cube, no match play and no Crawford rule, only single games.
- The computer's evaluation is hand-made and looks at most one reply ahead, so a strong player will see it make mistakes.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
