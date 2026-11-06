---
title: "Sea and Islands"
category: "fun"
job: "Play a free island-and-sea logic puzzle in three sizes: build islands of the numbered sizes in one connected sea with no block of four sea squares. One solution each."
description: "Free Sea and Islands puzzle in 5x5, 7x7 and 9x9. Each number is an island size, the sea is one piece, no 2x2 sea block. Hints, daily puzzle. No signup."
aiSummary: "A free browser logic puzzle. Some squares of a grid hold a number. Each number is the size of an island, a group of land squares joined straight up, down, left or right, and every island holds exactly one number. All other squares are sea. Islands never touch, the sea is one connected piece, and nowhere is there a 2 by 2 block of sea. Boards are 5x5, 7x7 or 9x9 at three levels, and every puzzle has exactly one solution. The generator builds a random answer by adding land only where a 2 by 2 block of sea needs breaking up while the sea stays connected, numbers each island, and then adjusts the numbers and answer until a solver proves a single solution. The level is the amount of search the proof needed: Easy is settled by reasoning alone, Medium needs 2 to 12 search nodes and Hard more. The solver is checked against a brute force over every choice of land squares on boards up to 5x5 and against a second counter written square by square, and against exact counts such as the 15 solutions of a 15-square island on a 4x4 grid. Hints say which rule settled a square. There is a daily puzzle seeded from the date. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is that the difficulty is measured, not guessed: the solver counts how much search each puzzle needs, and Easy puzzles need none."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🏝️"
---

## How to play

Some squares hold a number. Each number is the size of an island, a group of land squares joined straight up, down, left or right. Mark the land so that:

- Every island holds exactly one number and has exactly that many squares.
- Two islands never touch, not even by sharing an edge.
- All the other squares are sea, and the sea is one connected piece.
- Nowhere is there a 2 by 2 block of sea.

Squares you leave unmarked count as sea when the puzzle is checked, so you only need to mark the land.

Pick a size (5x5, 7x7 or 9x9) and a level (Easy, Medium or Hard). **Today's puzzle** gives the same puzzle to everyone on the same date, for the size and level you chose. **New random puzzle** deals a fresh one, **Restart** resets this one, and the page address carries the seed so you can send a friend the exact puzzle.

Controls:

- Tap a square to cycle: unmarked, sea, land, unmarked. Sea is a blue tile with waves and land is a solid sand tile with a thick edge. Sea marks are only notes; they never change whether the puzzle is solved.
- On the keyboard, arrow keys move, **L** marks land, **S** or **X** marks sea, **0** or **Backspace** clears, **Space** or **Enter** cycles, **U** undoes and **H** asks for a hint.
- **Show mistakes** is on to start with. An island that is too big, joins two numbers or is walled in with no number gets a dashed red border and a mark, and so does a block of four squares you have marked as sea. A number whose island is the right size turns solid green with a tick.
- **Check** marks wrong squares with a solid red border and a cross: land where the answer has sea, or sea where it has land.
- **Hint** marks one square and tells you why, or says so if one of your marks is wrong. A hint means no best time for that puzzle, even after a restart.

Numbers are land already, drawn in a bold circle with a thick border. Nothing depends on colour alone: sea has waves, land has a thick edge, and every flag has a mark. Screen readers hear each square's position and what it holds, and whether its island is complete or breaks a rule. Nothing flashes, and the win animation is off under reduced motion.

## How it works

### Facts you can check by hand

On a 4x4 grid:

- One island of 16 squares fills the whole grid, so there is exactly 1 solution wherever the number sits.
- An island of 15 squares leaves one square of sea. It can be any square except the numbered one, so there are 15 solutions.
- An island of 14 leaves two squares of sea, which must touch each other. A 4x4 grid has 24 neighbouring pairs, and the pair cannot use the numbered square. A number in a corner is in 2 pairs, on an edge in 3 and inside in 4, so there are 22, 21 or 20 solutions.

The solver, the brute force and the second counter agree on all of these.

### Making a puzzle with one answer

1. Start with all sea. While a 2 by 2 block of sea exists, one of its squares becomes land, either a new one-square island or a square added to the single island it touches (never joining two), as long as the sea stays in one piece. A few more squares are then added to islands at random. Islands are capped at 5, 6 and 7 squares on 5x5, 7x7 and 9x9.
2. Each island gets its number on a random one of its squares.
3. The solver looks for a second solution. Where it finds one, or, for Easy, where reasoning leaves a square open, the puzzle is changed to remove that doubt: the number of the island that holds the square moves onto it, which pins it as land, or a sea square that touches no land becomes a new one-square island. The answer changes with it and stays valid. This repeats for up to 40 changes.
4. The finished puzzle is solved once more to count the nodes the proof needed, and the generator keeps it only if that matches the level. It tries up to 60 layouts. The limits are counts of nodes and attempts, not clocks, so a seed gives the same puzzle on every device. The daily puzzle is a hash of the date, size and level.

The level is the amount of search the proof of a single solution needed:

| Level | Search nodes | What it means |
|---|---|---|
| Easy | 1 | Reasoning alone settles every square |
| Medium | 2 to 12 | A little guessing and checking |
| Hard | 13 or more | More search |

Over seeds 1 to 20 every puzzle got the level asked for, and the numbers came out like this:

| Size and level | Islands | Land squares | Nodes |
|---|---|---|---|
| 5x5 Easy | 3 to 7 | 7 to 12 | 1 |
| 5x5 Medium | 3 to 5 | 7 to 12 | 3 to 9 |
| 5x5 Hard | 2 to 5 | 7 to 12 | 13 to 103 |
| 7x7 Easy | 7 to 12 | 14 to 20 | 1 |
| 7x7 Medium | 7 to 12 | 15 to 21 | 3 to 11 |
| 7x7 Hard | 5 to 9 | 16 to 23 | 13 to 131 |
| 9x9 Easy | 15 to 19 | 27 to 34 | 1 |
| 9x9 Medium | 13 to 17 | 28 to 34 | 3 to 11 |
| 9x9 Hard | 11 to 17 | 28 to 36 | 13 to 645 |

### The solver

Every square keeps a list of what it could still be: sea, or one of the islands. These rules narrow the lists until nothing changes:

1. A square next to a square that is certainly in an island can only be sea or part of that island.
2. An island that has all its squares leaves nothing for others to claim.
3. An island only reaches squares within its size, through squares it may still use.
4. An island that still needs squares and has a single way to grow takes it.
5. If three squares of a 2 by 2 block are sea, the fourth is land.
6. The sea covers exactly the squares that are not land.
7. If losing a square would cut the sea apart, that square is sea.

When nothing more follows, the solver tries each possibility of one undecided square, preferring squares next to a growing island. At the end it checks that every island is one piece of the right size and the sea is one piece. It stops after two solutions, or at a budget of nodes.

### Hints

A hint runs the same rules on what is on your board, treating a land mark as land of any island and a sea mark as sea. It looks for a square the rules settle that you have not marked yet, preferring the simplest rule first, and says which rule it used. Every rule only draws conclusions that hold in every solution that agrees with the board, so the answer is always the unique solution's. If the rules settle nothing new, which happens on Hard puzzles that need search, it reveals one square from the answer.

### What the tests check

- The facts above, on the brute force, the second counter and the solver.
- The rules against a plain brute force that tries every choice of land squares on boards up to 5x5.
- The solver's count of solutions against the brute force and against a second counter written square by square. They agree on more than 120 random sets of numbers on 4x4 and 5x5 boards, including ones with no solution and ones with many, and the second counter agrees on more than 20 layouts of 6x6 and 7x7.
- Every 5x5 and 7x7 puzzle checked has exactly one answer by the second counter, for ten seeds of each level, and so do 9x9 puzzles for six seeds of each level.
- Easy puzzles are settled by reasoning alone, and Medium and Hard puzzles are not.
- Hints never contradict the answer on 240 boards with random correct marks, and following hints from a fresh puzzle fills in the whole answer without a wrong mark.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser's local storage as small whole numbers in a small JSON object, and anything read back is checked before use. The only other state is the page address.

## Limits

- Sizes stop at 9x9.
- The score is time, which starts on your first change and pauses when the tab is hidden.
- The daily puzzle follows the date on your own device.
- If the generator ever fails to find a puzzle of the level you chose within its attempts, it deals the closest level it found. In every seed tested this did not happen.
