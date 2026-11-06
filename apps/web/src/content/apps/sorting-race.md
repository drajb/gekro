---
title: "Sorting Race"
category: "fun"
job: "Watch bubble, insertion, selection, merge, quick and heap sort race on the same row of bars with exact counters, or sort a row yourself by swapping."
description: "Race six sorting algorithms on one row of bars with exact comparison and move counters, or sort a row yourself with the fewest swaps. No ads. No signup."
aiSummary: "A free browser sorting visualiser with two modes. In Race, bubble, insertion, selection, merge, quick and heap sort sort the same shuffled row of 16, 32 or 48 bars. Each algorithm is written as a step-by-step generator and every step is one comparison or one move (a swap of two bars, or for merge sort a bar written into place), counted exactly. All six advance by the same number of steps per tick, so the one with the least total work finishes first, and equal work shares a rank. A speed slider, a step-once button, restart and new array are included. In Your turn the player sorts a shuffled row of 8, 10 or 12 bars by swapping any two, against the exact fewest-swaps figure (the number of bars minus the number of cycles of the permutation); a hint always shows a swap that lowers that figure by one, and undo is exact. The tests compare each algorithm with Array.sort on more than 2,300 arrays and with a second written version of the same algorithm. Nothing is uploaded; your fewest swaps per size are kept in local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The race counts exactly what each algorithm does, so you can see why selection sort always makes the same number of comparisons while insertion sort on a sorted row makes just one comparison per bar and no moves."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "📊"
---

## How to play

There are two modes, chosen with the buttons at the top.

### Race

Pick how many bars (16, 32 or 48), drag the speed slider, and press **Start race**. Six panels each hold the same row of bars, and each algorithm sorts its own copy, one step at a time. **Pause** and **Resume** stop and start it, **Step once** moves every algorithm forward by exactly one step, **Restart** goes back to the same row, and **New array** shuffles a fresh one.

Every panel shows two counters. **Comparisons** counts the times two bars were checked against each other. **Moves** counts the times bars changed places: a swap of two bars, or, for merge sort, a bar written into its slot, because merge sort copies bars rather than swapping them. The race adds the two together as work. Each tick every algorithm does one step, so the algorithm with the least work finishes first. When all six are done the page lists them in order, with ties sharing a rank, and shows the counters for each.

How to read the bars: a bar being compared has a bright cap above it, a bar that just moved has diagonal stripes and a cap, a finished panel turns all its bars solid and says Done with a tick, and a waiting bar is plain. Colour is never the only clue. Each panel also has a coloured dot beside its name, and each algorithm has a one-line description underneath.

Nothing starts by itself. If your device asks for reduced motion, the picture is redrawn at most ten times a second, and **Step once** lets you go through it at your own pace.

### Your turn

A row of 8, 10 or 12 bars is shuffled, and each bar shows its height as a number. Sort it from shortest to tallest by swapping two bars at a time. Pick one bar, then another, and they trade places. Pick the same bar again to let go of it. The page shows the **fewest swaps possible** from the start, and counts the swaps you use.

- **Undo last swap** takes back your latest swap, exactly. After the row is sorted, undo is blocked, but **Start over** and **New puzzle** are always available.
- **Hint** shows two bars with diamonds: swap them and the fewest swaps still needed goes down by one. A puzzle where you used a hint does not set your best score, even if you start over.
- With the keyboard, arrow keys move along the bars, Home and End jump to the ends, and Enter or Space picks a bar. Each bar has a spoken label with its position, height and whether it is already in the right place.

A picked bar has a dashed border and a triangle. A bar in its right place turns green and the page says so in its label. **Copy result** puts a short line on your clipboard, and the page address holds the sizes and puzzle numbers.

## How it works

Each algorithm is a generator that yields one step at a time and works on its own copy of the row. A step is a comparison of two positions, a swap of two positions, or a write of one value into one position. The page applies every step to the row it is drawing, and the counters are tallied from those same steps, so they cannot disagree with what you see.

| Algorithm | What its steps are |
|---|---|
| Bubble sort | compares neighbours and swaps them when out of order, stopping early when a pass makes no swap |
| Insertion sort | takes each bar and swaps it left, one place at a time, until it sits right |
| Selection sort | finds the smallest bar left and swaps it to the front: always n(n-1)/2 comparisons, at most n-1 swaps |
| Merge sort | sorts halves recursively, then merges by writing bars into place from a copy |
| Quick sort | uses the middle bar as the pivot, moves smaller bars before it, then sorts both sides |
| Heap sort | builds a heap, then repeatedly swaps the biggest bar to the end and repairs the heap |

For the puzzle, the fewest swaps of any two bars that sort a row is the number of bars minus the number of cycles in the row's permutation. Each swap can split one cycle, so nobody can do better. The hint swaps the correct bar into the first wrong place, which splits a cycle every time, so following the hints finishes in exactly the fewest swaps.

### What the tests check

| Claim | How it is checked |
|---|---|
| Every algorithm sorts correctly | more than 2,300 arrays each (random, repeated values, sorted, reversed, all equal, empty and single bars) compared with Array.sort |
| The steps tell the truth | replaying the steps on a fresh copy gives the sorted row, and the counters equal the number of steps of each kind |
| Counters are exact | each algorithm compared with a second, separately written version that counts comparisons and moves |
| Closed forms hold | selection sort makes n(n-1)/2 comparisons; bubble and insertion sort make as many swaps as the row has inversions; a sorted row costs bubble and insertion sort n-1 comparisons and no moves |
| Stepping in pieces gives the same result | racers advanced in random chunk sizes end where a full run ends |
| Ties rank fairly | equal work shares a rank, in the order 1, 2, 2, 4 |
| The fewest-swaps figure is exact | compared with a breadth-first search over every row of up to 7 bars (5,913 rows) |
| Hints are right | 600 puzzles solved by following hints take exactly the fewest swaps, and each hint lowers the figure by one |
| Undo is an exact round trip | replaying the recorded swaps on the start row always gives the current row |

## Privacy and storage

Nothing is uploaded and there is no account. The fewest swaps you used at each row size without a hint are stored in your browser as small whole numbers. Clearing site data removes them.

## Limits

- The race uses one random row at a time. A different row can change who wins by a little, and a row that is already nearly sorted favours bubble and insertion sort a lot.
- Work is comparisons plus moves, one tick each. Real programs may find a swap more or less costly than a comparison, so this is a simple measure, not a timing.
- Quick sort here always picks the middle bar as its pivot, so it is predictable, not random.
- On a very narrow screen the 10 and 12 bar rows in Your turn scroll sideways inside their box, so that every bar stays at least 28 pixels wide and easy to tap.
- The race has no sound.
