---
title: "Lamp Grid"
category: "fun"
job: "Play a free lamp puzzle in three sizes: place lamps so every white square is lit, no lamp shines on another, and each number is met. One solution each."
description: "Free Lamp Grid puzzle in 5x5, 7x7 and 9x9. Place lamps so every white square is lit and each number matches its neighbours. Hints, daily puzzle. No signup."
aiSummary: "A free browser logic puzzle. A grid has white and black squares, and some black squares carry a number from 0 to 4. The player places lamps on white squares so that every white square is lit, no lamp stands in the light of another, and each number equals the count of lamps touching that black square straight above, below, left or right. A lamp lights its own square and shines up, down, left and right until a black square or the edge. Boards are 5x5, 7x7 or 9x9 at Easy, Medium and Hard. Every puzzle has exactly one solution. The generator places random black squares, puts lamps on squares nothing lights yet until the grid is lit, reads every number off the layout, and keeps it only if a solver proves a single answer; Medium and Hard then take numbers away one at a time while the answer stays unique. The solver is checked against a brute force over every set of lamps on small boards and against a second counter written square by square, and against exact counts such as the n factorial solutions of an empty grid. Hints say why, using a dark square that only one square can light, a number that needs every neighbour it has, and what-if checks. There is a daily puzzle seeded from the date. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is that an empty n by n grid has exactly n factorial solutions, which gives the solver a clean fact to be tested against."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "💡"
---

## How to play

The grid has white squares and black squares. Place lamps on white squares so that:

- Every white square is lit. A lamp lights its own square and shines straight up, down, left and right until a black square or the edge of the grid stops it.
- No lamp stands in the light of another lamp.
- A number on a black square says exactly how many lamps touch it, straight above, below, left or right. A 0 means none of those squares holds a lamp. A black square with no number can have any count.

Pick a size (5x5, 7x7 or 9x9) and a level (Easy, Medium or Hard); the level changes how many numbers are shown. **Today's puzzle** gives the same puzzle to everyone on the same date, for the size and level you chose. **New random puzzle** deals a fresh one, **Restart** resets this one, and the page address carries the seed so you can send a friend the exact puzzle.

Controls:

- Tap a white square to cycle: empty, lamp, dot, empty. A dot is only a note that you know a square holds no lamp. It never changes whether the puzzle is solved.
- On the keyboard, arrow keys move, **L** places a lamp, **D** or **X** marks a dot, **0** or **Backspace** clears, **Space** or **Enter** cycles, **U** undoes and **H** asks for a hint.
- **Show mistakes** is on to start with. Two lamps that shine on each other get a dashed red border and a mark. A number with too many lamps beside it gets a dashed red ring.
- **Check** marks wrong squares with a solid red border and a cross: a lamp that is not in the answer, or a dot where the answer has a lamp.
- **Hint** places a lamp or a dot and tells you why, or says so if one of your marks is wrong. A hint means no best time for that puzzle, even after a restart.

Black squares are hatched, lit squares have a warm tint and diagonal stripes, lamps are drawn as bulbs with rays, and a number that is met turns solid green with a tick, so nothing depends on colour alone. The count under "Lit" shows how many white squares are lit so far. Screen readers hear each square's position, whether it holds a lamp or a dot, whether it is lit, and for black squares the number and the lamps beside it. Nothing flashes, and the win animation is off under reduced motion.

## How it works

### A fact you can check by hand

On a grid with no black squares, every square must be lit. A lamp lights its whole row and column, and no two lamps may share a row or a column, so the lamps form one per row and one per column. If any row and column both had no lamp, their crossing square would be dark, so every row has one. That makes every arrangement a permutation, and an empty n by n grid has exactly n factorial solutions: 24, 120, 720 and 5,040 for n = 4 to 7. The solver finds exactly those numbers, the second counter agrees on 4 and 5, and the brute force on 4. A white run of k squares on its own has k solutions, and a run cut by a black square multiplies.

### Making a puzzle with one answer

1. Black squares are chosen at random, about 24, 22 and 20 percent of the squares on 5x5, 7x7 and 9x9 (6, 11 and 16 squares).
2. Lamps are placed one at a time, each on a square that nothing lights yet and that is chosen at random among the squares that would light the next dark one. That always ends with every white square lit and no lamp in another's light.
3. Every black square that touches a white square gets the number of lamps beside it.
4. The solver checks that the layout, with every number shown, has exactly one answer. If not, a new random layout is tried, up to 800 times. The limits are counts of nodes and attempts, not clocks, so a seed gives the same puzzle on every device. The daily puzzle is a hash of the date, size and level.
5. Easy stops there. Medium and Hard take numbers away one at a time in random order, keeping a removal only if the solver still proves one answer. Medium stops when about two thirds are left, and Hard goes on as far as it can.

Over seeds 1 to 20 the numbers shown come out like this:

| Size | Black squares | Easy | Medium | Hard |
|---|---|---|---|---|
| 5x5 | 6 | 6 | 4 to 5 | 3 to 5 |
| 7x7 | 11 | 11 | 8 to 9 | 5 to 9 |
| 9x9 | 16 | 16 | 11 to 13 | 7 to 13 |

A Hard puzzle is minimal: on 5x5, 7x7 and 9x9 the tests take away each remaining number in turn, for four seeds of each size, and confirm the puzzle then has more than one answer, using the second counter.

### The solver

Every white square is a lamp, no lamp, or not yet decided. A lamp rules out lamps everywhere it shines. A white square that is not lit yet and has only one square left that could light it forces a lamp there. A number with all its lamps rules out its other neighbours, and one that needs every neighbour it has left takes them all. When nothing more follows, the solver picks a dark square with the fewest candidates and tries a lamp, then no lamp, on one of them. It stops after two solutions, or at a budget of nodes.

### Hints

A hint first looks for a dark white square that only one square can still light, then for a number that needs every neighbour it has left, and then runs "what if" checks. A what-if check assumes a lamp (or no lamp) on a square and looks for a contradiction: two lamps in each other's light, a square that could never be lit, or a number that cannot be met. A contradiction means the assumption is false in every layout that fits the board, so the hint is always consistent with the answer. If nothing applies, it reveals one lamp.

### What the tests check

- The facts above, against a brute force that tries every set of lamps on boards with up to 18 white squares, and the light a lamp casts against a plain walk in four directions.
- The solver's count of layouts against the brute force and against a second counter that decides squares in reading order and checks each one as soon as nothing can change it. They agree on more than 120 random layouts up to 5x5 with numbers shown, removed and damaged, and the second counter agrees on 40 random layouts of 6x6 to 8x8.
- Every 5x5 and 7x7 puzzle checked has exactly one answer by the second counter, and so do 9x9 puzzles for eight seeds of each level.
- Hints never contradict the answer on 240 boards with random correct marks, and following hints from a fresh puzzle places every lamp without a single wrong mark.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser's local storage as small whole numbers in a small JSON object, and anything read back is checked before use. The only other state is the page address.

## Limits

- Sizes stop at 9x9.
- The score is time, which starts on your first change and pauses when the tab is hidden.
- The daily puzzle follows the date on your own device.
- A hint may place a dot, and a hint that places a dot counts as a hint.
