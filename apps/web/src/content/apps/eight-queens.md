---
title: "Eight Queens"
category: "fun"
job: "Play the Eight Queens puzzle on boards from 4 by 4 to 12 by 12, with live conflicts, a count of the solutions still possible, hints and every solution behind it."
description: "Free Eight Queens puzzle on 4 to 12 squares: see conflicts live, watch how many solutions are still possible, and hunt for all 12 basic solutions. No signup."
aiSummary: "A free browser Eight Queens puzzle. Place N queens on an N by N board, N from 4 to 12, so that no two share a row, a column or a diagonal. Queens that attack each other are marked with a ring and an exclamation mark, and an optional hatch shows every attacked square. The page keeps the full list of solutions for the chosen size, found by a search that fills one row at a time: 2, 10, 4, 40, 92, 352, 724, 2680 and 14200 solutions for 4 to 12 queens. A test checks those counts against a permutation brute force (up to 8), a plain row-by-row search (up to 10), and every way of choosing N squares for 5 and 6. The page shows how many solutions still contain the queens you have placed, a hint points at a square from the first such solution, and Show a solution fills in a random one. It also counts basic solutions, which are solutions that are not rotations or reflections of each other: 1, 2, 1, 6, 12, 46, 92, 341 and 1787. Hints and shown solutions are not counted. How many times you solved each size is kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The solution counts it shows are not trusted numbers: a test finds the whole list by search and checks it against two other counting methods."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "♛"
---

## How to play

Put one queen on each row of the board so that no two queens attack each other. A queen attacks every square in its row, in its column and along both diagonals, as far as the board goes. The board can be any size from 4 by 4 to 12 by 12, and you need as many queens as the board is wide. The default is the classic 8 by 8 board with 8 queens.

- Click or tap a square to put a queen on it. Click it again to take the queen off.
- A queen that is attacked by another queen gets a rose ring and a small exclamation mark in its corner. The mark is the cue, so you never have to tell two colours apart.
- Tick **Show squares the queens attack** to hatch every empty square that some queen attacks. A queen can safely go on any square that is not hatched.
- The three boxes above the board show how many queens you have placed, how many pairs of queens attack each other, and how many solutions are still possible.
- **Hint** points at a square, with a dashed green ring, where a queen can go and still leave a solution possible. **Show a solution** fills the board with a complete solution, one that keeps your queens if any solution does.
- **Undo** takes back your last change, one step at a time. **Clear board** starts again at the same size.

When all queens are placed and none attack another, the board is solved. A solved board, or a shown solution, locks until you press Clear board. A hint or a shown solution means the board is not counted toward your finds.

On the keyboard, the arrow keys move around the board, Home and End jump to the ends of a row, and Enter or Space places or removes a queen. Every square is announced with its row, its column and what is on it, and the status line says what each move did and how many pairs attack. On a narrow screen the size menu greys out sizes whose squares would be under 28 pixels wide, so 11 and 12 are greyed out on the narrowest phones; a size that arrives in a shared link stays available.

## Basic solutions

Turn a solution a quarter turn, or flip it, and you get another solution. The 92 solutions of the 8 by 8 board are really 12 different boards, each seen from up to 8 angles. The page counts those 12 as you find them, for the size you are on: **Basic solutions found** goes up when you solve the board without a hint and the pattern is new, and the message tells you if you had already found it. The count of finds lasts for the visit. How many times you solved each size is kept on your device.

## How it works

The engine searches for solutions one row at a time. It keeps three sets of taken lines, columns and the two kinds of diagonal, as bits of a number, so the free squares in the next row come from one operation. A branch that has no free square is dropped at once. It runs the first time a size is used and the list is kept, in dictionary order, one column per row.

Everything on the page comes from that list:

- **Solutions possible** counts the solutions that put a queen on every square you have occupied.
- **Hint** takes the first of those solutions and points at its first square you have not filled.
- **Show a solution** picks one of those solutions at random, or any solution if yours cannot be finished.
- **Basic solutions** are found by turning and flipping a placement the eight ways a square can be, and keeping the smallest result as its name.

The test suite checks the engine rather than trusting it:

| Queens | Solutions | Basic solutions |
|---|---|---|
| 4 | 2 | 1 |
| 5 | 10 | 2 |
| 6 | 4 | 1 |
| 7 | 40 | 6 |
| 8 | 92 | 12 |
| 9 | 352 | 46 |
| 10 | 724 | 92 |
| 11 | 2680 | 341 |
| 12 | 14200 | 1787 |

- **Three ways to count:** the solution lists for 4 to 8 queens match a brute force over every ordering of the columns, solution by solution. The counts for 4 to 10 match a plain row-by-row search that checks each new queen against the earlier ones one at a time. For 5 and 6 queens the suite also tries every way of choosing that many squares, 53,130 and 1,947,792 sets, and counts the ones that pass the conflict check.
- **No solution below 4:** the plain search finds none for 2 by 2 and 3 by 3, which is why the page starts at 4.
- **Basic solutions:** turning and flipping gives 1, 2, 1, 6, 12, 46, 92, 341 and 1787 different boards. On 8 by 8, 11 of the 12 boards have 8 turned copies and one has only 4, because it looks the same turned half a circle. That makes 11 times 8 plus 4, which is 92.
- **Conflicts:** the pairs of attacking queens, the queens marked, and the attacked squares match a second implementation that groups queens by row, column and the two diagonal sums in 3,000 random boards.
- **Solutions possible:** matches a filter over the brute-force list in 400 random boards. A single queen in a corner of the 8 by 8 board leaves exactly 4 of the 92 solutions.
- **Hints:** a hint is never on a taken square and always keeps a solution possible. Following hints one at a time finishes the board in 60 random runs, at sizes 4 to 10.

## Privacy and storage

Nothing is uploaded and there is no account. The only thing kept is how many times you solved each size without help, as small whole numbers in a small JSON object in your browser's local storage. Clearing site data removes it. The page address carries the size and the shading switch.

## Limits

- The hint and the shown solution come from a list found by search. That list is the whole answer for these sizes, so there is no learning in them and no chance of a wrong one, but also no explanation of why a square works.
- Basic solutions found are not remembered between visits.
- Sizes above 12 are not offered: the board stops fitting a phone.
- A board is a plain square grid with no wrap-around.
