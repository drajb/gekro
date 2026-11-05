---
title: "Traffic Jam"
category: "fun"
job: "Play a free sliding-vehicle puzzle: slide cars and trucks out of the way to free the blue car through the exit. Three sizes, three levels, undo and a hint."
description: "Free Traffic Jam puzzle on a 5x5, 6x6 or 7x7 grid. Slide cars and trucks to free the blue car. Every level shows its fewest possible moves. No signup."
aiSummary: "A free browser sliding puzzle on a 5x5, 6x6 or 7x7 grid. Cars (2 cells) and trucks (3 cells) slide only along their own row or column and cannot pass each other. The blue hero car is vertical and is freed when it reaches the exit gap in the top edge or the bottom edge. One slide of any length is one move. The generator packs a random layout, explores every position reachable from it, computes the exact fewest moves to a win for each with a search that starts from all winning positions at once, and keeps a position in the difficulty's range, preferring the hardest; it tries up to 30 layouts and keeps the hardest it saw if none reaches the range. The stated fewest-moves number and the hint come from a breadth-first search, so the hint is the first move of a shortest solution. Tests check the sliding rules and the stated number against an independent letter-grid search. Best move counts per size and level stay in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part I enjoy is that every level shows the true fewest possible moves, and I checked that number against a second search written a different way."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🚗"
---

## How to play

The board is a square grid full of cars and trucks. Cars are two cells long and trucks are three. Every vehicle lies along a row or a column and can only slide along that line, forwards or backwards, as far as the cells in front of it are empty. Vehicles cannot jump over each other. Your car is the blue one with a star on its roof, and it always lies up and down. A striped marker above or below the board shows the exit gap. Slide the blue car out through the gap by clearing its way.

Tap a vehicle to pick it up. The squares it can slide to are shown with a dotted edge, and tapping one slides the vehicle there. You can also use the two buttons under the board to slide the picked up vehicle one cell at a time. One slide counts as one move however far it goes, and sliding the same vehicle on in the same direction straight away carries on the same move. The line **Fewest possible** shows the smallest number of moves that frees the blue car from the starting position.

Pick a size (5 x 5, 6 x 6 or 7 x 7) and a level (Easy, Medium or Hard). **New level** deals a fresh one, **Restart** puts every vehicle back, **Undo** takes back your last move and **Hint** shows one move that starts a shortest solution. The page address holds the size, level and the level number, so you can send someone the same puzzle.

**Keyboard.** Enter or Space picks a vehicle up or puts it down. With a vehicle picked up, the arrow keys slide it along its line. With nothing picked up, the arrow keys choose a vehicle: left and up go to the previous one, right and down to the next one. Escape puts a vehicle down, **U** undoes and **H** gives a hint. These keys only work while the focus is on the board.

**Colour is never the only clue.** Every vehicle other than the blue car has a colour and a roof mark (a dot, a bar, a ring, a diamond or a pair of dots), and no two vehicles share both. A colour can repeat with a different mark. Screen readers hear a description such as "Red truck with a ring, slides up and down, column 5, rows 3 to 5, can slide 2 cells up", and after each move a sentence saying what moved.

**Your best** is the fewest moves you used to free the car on a board of that size and level. It only counts if you did not use the hint on that level. Undoing a move takes it off the count.

## How it works

**Levels are searched for, not drawn by hand.** The generator places random vehicles with the blue car already in the gap, filling the board until only a set fraction of the cells is left empty. Easy boards are packed less tightly than Hard ones. Every move can be undone, so every position the vehicles can reach from that start is connected to a solved one. The generator lists those positions, up to 20,000 of them, and works out for each the fewest moves to a win with one search that starts from all winning positions at once. It picks a position whose number is in the range for the size and level, the highest it can find. If a layout has none in range it tries another, up to 30 layouts and about 80,000 positions in all, and keeps the hardest it saw. The limit is a count of positions, not a clock, so the same level number gives the same level on any device. So the ranges are targets, and Hard is the one that most often misses.

**The fewest-moves number is exact.** After a position is chosen, the number is confirmed by a fresh breadth-first search from it. Breadth first means the first win found is a shortest one. The hint is the first move of that shortest solution, found from where the vehicles are now.

## What the tests check

- The sliding rules match a second implementation that moves a vehicle one cell at a time on a grid of letters. They agree on every legal move from 12 positions along each of 60 generated levels.
- Every generated level has a vertical blue car of length two, an exit in the top edge or the bottom edge (both appear), no overlaps, and a starting position that is not already won.
- The fewest-moves number equals the answer of the independent letter-grid search on 36 levels of 5 x 5 (12 of each level) and on a sample of 6 x 6 and 7 x 7 levels. The stored solution plays legally to a win.
- After taking the hint move, the independent search reports exactly one move fewer, for the first four hints on 15 levels.
- Every move can be undone exactly, and a position where the blue car is shut in by a vehicle that can never leave its column is reported as having no solution, which the independent search confirms.
- On average, Easy has a smaller number than Medium and Medium than Hard on 5 x 5 and 6 x 6, and on 7 x 7 Easy is smaller than Hard.
- A saved best is accepted only as a whole number from 1 to 9999 for a known size and level. Anything else is ignored.

## Limits

- The board has no walls and the exit is never on the left or right edge.
- Hard often lands below its target range, because the search is capped to keep the page quick. In 40 levels of each setting I measured Hard in range 21 times on 5 x 5, 19 on 6 x 6 and only 5 on 7 x 7, where the middle Hard level needed 6 moves and the easiest only 2. Medium on 7 x 7 was in range 15 times in 40. Every level is still solvable with a true fewest-moves number, it may just be easier than its label.
- Making a level takes up to about a third of a second on a laptop, longer on a slow phone or tablet. The page says "Making a level..." and ignores moves until it is ready.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your best scores stay on your device.
