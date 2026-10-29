---
title: "Dots and Boxes"
category: "fun"
job: "Play Dots and Boxes against a computer at three levels, or against a friend on the same screen. Three board sizes, undo, keyboard play, and a session tally."
description: "Free Dots and Boxes for one or two players. Three board sizes, three computer levels, undo, keyboard play, letters on every box. No ads, no signup."
aiSummary: "A free browser game of Dots and Boxes on 3 x 3, 4 x 4 or 5 x 5 boxes. Players take turns drawing a line between two dots; whoever completes the fourth side of a box claims it and moves again. The computer has three levels: Easy takes a box when it can and otherwise draws at random; Medium also avoids drawing the third side of a box and, when it cannot, gives away as few boxes as possible; Hard adds end-game chain control, solving the rest of the game exactly by memoised minimax once 16 or fewer lines are left (which finds the double-dealing move), with a one-second time cap. Players are told apart by the letter A or B in each claimed box as well as by colour. It supports two players on one screen, undo, full keyboard play, and a session tally. Wins per size and level are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A rules engine, a chain-aware computer and an exact endgame solver, with tests that check the solver against a plain brute-force search."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "🔲"
---

## How to play

The board is a grid of dots. Players take turns drawing one line between two neighbouring dots. When a line completes the fourth side of a box, that player claims the box, which is marked with their letter (**A** or **B**), and **must draw again**. When every line is drawn, whoever holds more boxes wins. The 3 x 3 and 5 x 5 boards have an odd number of boxes (9 and 25), so they cannot end in a tie; the 4 x 4 board has 16 and can.

Choose a **Board size**: 3 x 3 boxes (4 x 4 dots, 24 lines), 4 x 4 boxes (5 x 5 dots, 40 lines) or 5 x 5 boxes (6 x 6 dots, 60 lines). Pick an **Opponent**: the computer, or **Two players** on the same screen. Against the computer, choose a **Difficulty** and whether you play **first (A)** or **second (B)**. A is always the player who moves first, with blue lines; B has amber lines. Changing any setting starts a new game.

- **Mouse or touch:** press the gap between two dots. Each line has a tap area at least 28 px thick, and the line you or the computer drew last has a ring around it.
- **Keyboard:** arrow keys move between lines, Home and End jump to the ends of a row, Enter or Space draws the line.
- **Undo** takes back your last turn, including the computer's reply and any chain of boxes it took, so it is your turn again. With two players it takes back the last turn, which may be a chain. Once a game is over, undo is off.
- **Copy result** copies a short summary of your session tally and the page address.

A box shows the letter of whoever claimed it, not only a colour, so the two sides can be told apart without relying on colour. The result is also written out in words below the board.

## How it works

A board of n x n boxes has n x n boxes and 2 x n x (n + 1) lines: n x (n + 1) horizontal and the same number vertical. The whole rule set is one small function: draw a line, count the boxes it completes (a single line can complete two), give those boxes to the mover, and hand over the turn only if none were completed. The test suite checks the line and box counts for all three sizes, that a game of only legal lines always ends after exactly the total number of lines, and that the two scores always add up to the number of boxes.

### The computer

| Level | What it does |
|---|---|
| Easy | Takes a box when it can, otherwise draws a random line |
| Medium | Takes a box when it can; otherwise draws a line that does not give a box away; if every line does, the one that gives away the fewest |
| Hard | Medium, plus end-game chain control |

A line is **safe** when no box beside it already has two sides drawn, because drawing it would make a third side and let the other player complete the box. Medium plays a safe line whenever one exists, and the tests check that on hundreds of positions.

Near the end of a game the safe lines run out and every move opens something. The boxes with two sides drawn then form **chains** (runs of boxes you can take one after another) and **loops** (rings of boxes). The engine finds them by linking boxes that have two sides drawn and share an undrawn line.

Hard uses that in two ways:

1. **Exact solving.** When 16 or fewer lines are undrawn, Hard works out the best result of every possible continuation. Only the set of undrawn lines matters, so the search stores each position's value once (a memo table indexed by which lines are drawn) instead of recomputing it. This is the part that finds the **double-dealing move**: when you are about to take the last two boxes of a chain, you can instead draw the far end of the pair. That hands the opponent both boxes with one line, but they then have to open the next chain for you. Sometimes that is worth more than the two boxes, and the exact search sees when. The search is cut off after one second and Hard then falls back to the rules below. A test constructs an endgame where declining the last two boxes is the only winning move and checks that Hard plays it.
2. **Rules before that point.** With more lines left it plays safe lines, then opens the smallest chain first (a chain of two from the middle, so it cannot be declined), and declines the last two boxes of a chain when a quick estimate says keeping control is worth more than those two boxes.

The exact solver is checked against a plain recursive search with no memo table on random positions with up to seven lines left, and the two always agree. On a fixed set of seeded games, Hard beat Easy in 30 of 30 in the last run, from either seat and on the 3 x 3, 4 x 4 and 5 x 5 boards; the test requires at least 24 of 30 (80%). The search stops after one second, and the test allows a Hard move with 16 lines left up to two and a half seconds to leave room for slow machines.

Computer moves are spaced about 350 ms apart so a chain of boxes can be followed, and happen at once if your system asks for reduced motion. The search runs on the page itself; no background thread is used.

## Privacy and storage

Nothing is uploaded and there is no account. The number of games you have won against the computer, for each board size and level, is saved in your browser's local storage as small whole numbers inside a small JSON object under one key. Only a finished win against the computer counts, and only if you did not use undo in that game. Ties, losses and two-player games are not saved. The session tally and the current game are kept in memory only, so they reset when you leave the page. The address records only the board size, opponent, level and seat. Clearing site data removes the saved wins.

## Limits

- Hard is exact only for the last 16 lines. Before that it follows rules of thumb about chains, so a long plan can still beat it. It is a good opponent, not a perfect one.
- Easy is meant to be beatable: it never looks ahead and happily gives boxes away.
- The 5 x 5 board has small boxes on a narrow phone. Lines keep a tap area of at least 28 px, but 4 x 4 or 3 x 3 is easier to play there.
- With two players there is no clock, no names and no saved games.
- The tally and the current game are not saved if you reload the page.
- Undo is not available after the game ends.

Everything runs locally in your browser.
