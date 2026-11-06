---
title: "Loop Puzzle"
category: "fun"
job: "Play a free pencil-and-paper puzzle: draw one closed loop through a grid of dots so every number counts its sides correctly. Six sizes, three levels."
description: "Free Loop Puzzle from 5x5 to 10x10. Draw a single closed loop that matches every number. Every puzzle has exactly one answer, with hints. No signup."
aiSummary: "A free browser logic puzzle. The grid is a set of dots; the player draws one closed loop along the grid lines that never branches or crosses. A number inside a cell says how many of that cell's four sides the loop uses. Boards run from 5x5 to 10x10 at Easy, Normal and Hard. Each puzzle starts from a random loop whose outline gives a full set of numbers, which are then removed one at a time only while a constraint-propagation solver can still prove the loop is the unique answer. Easy additionally requires that local deductions alone finish the puzzle. The solver, a plain edge-by-edge search written separately for the tests, and a brute force over every edge subset of tiny grids all agree. Hints are computed from the numbers plus the marks you have made. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the generator: it only keeps a puzzle once a solver has proved there is exactly one loop that fits the numbers, so you never need to guess."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔁"
---

## How to play

The board is a grid of dots with numbers in some of the cells. Draw **one closed loop** along the lines between neighbouring dots. The loop may not branch, cross itself or touch itself, and it must come back to where it started. A number in a cell says how many of that cell's four sides the loop uses. A cell with no number can have any count, including zero.

Tap close to an edge to draw it, and tap again to remove it. The tap goes to whichever side of the cell under your finger is nearest, so you do not have to hit a thin line. Choose **Mark X** to put a small cross on an edge you know is not part of the loop. A right click, or a Shift click, uses the other mode for that one tap. **Undo** steps back one mark at a time.

When the loop is closed and every number is met, the loop pulses and the puzzle is solved.

### What the colours and shapes mean

- A line is a thick stroke that shifts from sky blue through violet to rose along the loop.
- A cross is a small x.
- A number that has exactly the right count sits in a filled green disc. A number with too many lines gets a dashed rose ring. A number that still needs lines is plain.
- A hint is an amber stroke with a diamond in its middle. A mistake, after pressing Check, is a dashed rose stroke with a ! on it.

Every state has a shape as well as a colour.

### Keyboard and screen readers

Click or tab onto the board. The **arrow keys** move a ring between dots. Hold **Shift** with an arrow to draw or erase the line to the next dot and move there. Press **Space** to put the pen down, so plain arrows draw, and press it again to lift it. **L** and **X** choose line or cross, **U** undoes and **H** gives a hint. Every move is read out: the dot you are on, its row and column, the numbers around it with how many lines they have so far, and whether a number just became complete.

### Levels

- **Easy** keeps at least 55% of the cells numbered, and the numbers are chosen so that simple deductions alone finish the puzzle.
- **Normal** keeps at least 40% of the numbers and may need a little trial and error.
- **Hard** removes as many numbers as it can while the answer stays unique.

Press **Hint** and the game looks at the numbers and the marks you have already made. If one of your marks is wrong it points at that. If something follows from the numbers it points at that edge and says whether it must be a line or empty. Only when nothing is forced does it simply reveal a line of the answer. **Check my lines** marks every wrong mark and **Show answer** draws the loop. All three count as help, and a puzzle where you used help does not set a best time.

## How it works

**Making a puzzle.** The generator grows a random blob of cells one cell at a time. A cell is only added if the blob stays in one piece, has no hole, and has no spot where two corners touch, because any of those would make the outline more than one simple loop. The outline of the blob is the answer. Reading off how many sides of each cell are on the outline gives a full set of numbers.

**Keeping the answer unique.** The numbers are then removed in random order. After each removal the solver counts solutions, stopping at two. If there is still exactly one, the number stays removed; otherwise it goes back. A check that takes too long also counts as "not unique", so the puzzle is never less certain than it claims.

**The solver.** It repeats a few local rules until nothing changes: a cell whose lines are all placed takes no more, a cell that needs every remaining side takes them all, a dot has either no lines or two, and a dot with one line and one place left must use it. It also notices when a finished loop appears alongside other lines, which is a dead end. When the rules stall it guesses one edge and tries both ways. Easy puzzles are the ones where the rules never stall.

### What the tests check

- On the 2x2, 2x3 and 3x3 cell grids the code tries every possible set of edges, finds 13, 40 and 213 single loops, and the solver's solution count matches that brute force on hundreds of random sets of numbers, including sets with zero, one and several solutions.
- Every generated puzzle from 5x5 to 10x10, at all three levels, is run through a second solver written separately for the tests, with no propagation at all, and it finds exactly one solution. The stored answer is a single loop that meets every number.
- On Easy, the local rules alone reproduce the stored answer.
- Following the hints from an empty board, one after another, always finishes the puzzle, and no hint ever contradicts the answer.
- The same seed always gives the same puzzle. The page address carries the size, level and seed, so you can send someone the exact puzzle.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser as a small whole number of seconds inside a small JSON object. Clearing site data removes it.

## Limits

- Boards are square, from 5x5 to 10x10. Big hard boards take a moment to build, because the generator has to prove uniqueness many times.
- The best time only counts puzzles solved with no help, and it is not paused when you use Undo.
- On the smallest tap size, the 10x10 board is wider than a narrow phone screen and scrolls sideways inside its frame.
- There is no daily puzzle.
