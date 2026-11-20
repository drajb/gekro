---
title: "Tents and Trees"
category: "fun"
job: "Play a free logic puzzle in three sizes: give every tree its own tent, with no two tents touching, so every row and column count is met. One solution each."
description: "Free Tents and Trees puzzle in 5x5, 7x7 and 9x9. Pair every tree with a tent that touches no other tent, using the row and column counts. No signup."
aiSummary: "A free browser logic puzzle. A grid has trees on some squares. The player puts a tent straight up, down, left or right of every tree, so that every tree has its own tent and every tent its own tree, no two tents touch even at a corner, and each row and column holds the number of tents printed beside it. Boards are 5x5, 7x7 or 9x9 at Easy, Medium and Hard; Medium hides some of the row and column numbers and Hard hides as many as it can. Every puzzle has exactly one solution of tent positions. The generator places random non-touching tents, puts a tree beside each, counts the rows and columns, and keeps the layout only if a solver proves a single answer; then it hides numbers one at a time while the answer stays unique. The solver is checked against a brute force that tries every set of squares on boards up to 5x5 and against a second counter written row by row. Hints say why, using a tree with one square left, a row or column that needs every square it has, a full line, and what-if checks. There is a daily puzzle seeded from the date. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is that two different ways of pairing tents with trees can give the same picture, so the solver counts pictures, not pairings, and the tests check that against a brute force."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⛺"
---

## How to play

Some squares hold a tree. Put one tent straight up, down, left or right of every tree. The rules:

- Every tree has its own tent right beside it, and every tent belongs to exactly one tree. There are as many tents as trees.
- No two tents touch, not even at a corner.
- The number at the end of each row and the foot of each column says how many tents it holds. A question mark means the puzzle does not give that number.

Pick a size (5x5, 7x7 or 9x9) and a level (Easy, Medium or Hard); the level changes how many numbers are shown. **Today's puzzle** gives the same puzzle to everyone on the same date, for the size and level you chose. **New random puzzle** deals a fresh one, **Restart** resets this one, and the page address carries the seed so you can send a friend the exact puzzle.

Controls:

- Tap a square to cycle: empty, tent, grass, empty. Grass is only a note that you know a square holds no tent. It never changes whether the puzzle is solved.
- On the keyboard, arrow keys move, **T** places a tent, **G** or **X** marks grass, **0** or **Backspace** clears, **Space** or **Enter** cycles, **U** undoes and **H** asks for a hint.
- **Show mistakes** is on to start with. A tent that touches another tent, or has no tree beside it, gets a dashed red border and a mark. A row or column number that has too many tents gets a dashed red border too.
- **Check** marks wrong squares with a solid red border and a cross: a tent that is not in the answer, or grass where the answer has a tent.
- **Hint** places a tent or a grass mark and tells you why, or says so if one of your marks is wrong. A hint means no best time for that puzzle, even after a restart.

Trees are round with a trunk, tents are triangles with a door, and grass is three short blades, so nothing depends on colour. A row or column number that is met turns solid green with a tick. Screen readers hear each square's position and what it holds, and any rule it breaks. Nothing flashes, and the win animation is off under reduced motion.

## How it works

### Counting pictures, not pairings

If a square sits between two trees, the tent there could belong to either. Two different pairings can then give the same picture of tents. The solver gives each tree a tent on one of its free neighbours, tree with the fewest choices first, and records every finished picture once. A puzzle is accepted only when it has exactly one picture. The search skips squares that touch a tent already placed, skips rows and columns that are full, and drops a branch as soon as a row or column cannot reach its number.

### Making a puzzle with one answer

1. Random squares are chosen for tents, each one only if it touches no tent chosen before. A tree is put on a free neighbour of each tent. The generator aims at about 30, 26 and 24 percent of the squares being trees on 5x5, 7x7 and 9x9, and the layouts it finds hold 4 to 8, 10 to 13 and 16 to 19 trees over seeds 1 to 20.
2. The rows and columns are counted. The solver checks the layout, with every number shown, has exactly one answer. If not, a new random layout is tried, up to 600 times. The limits are counts of nodes and attempts, not clocks, so a seed gives the same puzzle on every device. The daily puzzle is a hash of the date, size and level.
3. Easy stops there. Medium and Hard hide numbers one at a time in random order, keeping a number hidden only if the solver still proves one answer. Medium hides 3, 4 and 5 numbers on 5x5, 7x7 and 9x9, and in every seed tried it reached that. Hard goes on as far as it can.

| Size | Trees | Numbers hidden (Hard) |
|---|---|---|
| 5x5 | 4 to 8 | 7 to 10 of 10 |
| 7x7 | 10 to 13 | 9 to 14 of 14 |
| 9x9 | 16 to 19 | 11 to 17 of 18 |

A Hard puzzle is minimal: on 5x5, 7x7 and 9x9 the tests hide each number that is still printed in turn, for four seeds of each size, and confirm the puzzle then has more than one answer, using the second counter.

### Hints

A hint first looks for a tree that has only one square left for its tent, then for a row or column with exactly as many open squares as tents it still needs, then for a row or column that already has all its tents, and then runs "what if" checks. A what-if check assumes a tent (or no tent) on a square and looks for a contradiction: a tree with no square left for its own tent, a tent with no tree beside it, or a row or column that can no longer reach its number. A contradiction means the assumption is false in every layout that fits the board, so the hint is always consistent with the answer. If nothing applies, it reveals one tent.

### What the tests check

- The rules against a brute force that tries every set of squares with as many squares as there are trees, on boards up to 5x5, and the tent-to-tree pairing against trying every assignment.
- The solver's count of different layouts against the brute force and against a second counter written row by row with bit masks. They agree on more than 120 random layouts up to 5x5 with the numbers shown, hidden and damaged, and the second counter agrees on more than 30 random layouts of 6x6 to 9x9.
- Every 5x5 and 7x7 puzzle checked has exactly one answer by the second counter, and so do 9x9 puzzles for eight seeds of each level.
- Hints never contradict the answer on 240 boards with random correct marks, and following hints from a fresh puzzle places every tent without a single wrong mark.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser's local storage as small whole numbers in a small JSON object, and anything read back is checked before use. The only other state is the page address.

## Limits

- Sizes stop at 9x9.
- The score is time, which starts on your first change and pauses when the tab is hidden.
- The daily puzzle follows the date on your own device.
- A hint may mark grass, and a hint that marks grass counts as a hint.
