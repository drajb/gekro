---
title: "Island Bridges"
category: "fun"
job: "Play a free bridge-building puzzle: join numbered islands with straight bridges so every island gets exactly its number and all islands connect."
description: "Free Island Bridges puzzle from 7x7 to 11x11. Join islands with one or two bridges so each number is met and everything connects. No signup."
aiSummary: "A free browser logic puzzle. Islands carry numbers from 1 to 8. The player joins islands in straight lines with one or two bridges between a pair, so that every island has exactly as many bridge ends as its number, no bridge crosses another, and all islands form one connected group. Boards run from 7x7 to 11x11 at Easy, Normal and Hard. Each puzzle is grown from a random layout, numbered from it, and kept only if a constraint-propagation solver proves there is exactly one answer. Easy also requires that local deductions alone finish the puzzle. Tests compare the solver against brute force over every assignment of 0, 1 or 2 bridges on thousands of small island sets, and against a second solver written separately that finds exactly one solution for every generated puzzle checked. Best times are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is that every puzzle is proven to have one answer before you see it, so a stuck player can always reason their way out without guessing."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🏝️"
---

## How to play

The board is a stretch of water with round islands on it, each showing a number. Build **bridges** between islands:

- A bridge runs straight up, down, left or right, from one island to the next island in that direction.
- Between the same two islands you can build one bridge or two.
- Bridges never cross each other and never pass over an island.
- An island's number is how many bridge ends it must have. A double bridge counts as two at each end.
- When you are finished, all the islands must be joined into one group.

Tap an island to pick it up. The islands it can be joined to get a dotted ring. Tap one of them to build a bridge. Tap the same pair again for a second bridge, and once more to take them away. You can also tap the open water between two islands. If a bridge would cross another one the game says so and does nothing.

When every island is done and everything is connected, the board glows green and the puzzle is solved.

### What the colours and shapes mean

- One bridge is a single sky-blue line. Two bridges are two parallel amber lines.
- An island with exactly the right number is bright with a tick badge. An island with too many bridges has a dashed rose ring. A selected island has a thick amber ring.
- The score line shows how many islands are done and how many separate groups there are. If every island is done but there is more than one group, the game tells you to move a bridge.

Nothing relies on colour alone: counts have different numbers of lines, and every state has its own shape.

### Keyboard and screen readers

Tab to an island. **Arrow keys** move to the nearest island in that direction. **Enter** or **Space** picks an island up, then Enter on another island in line builds a bridge. **Shift with an arrow** adds or cycles the bridge in that direction at once. **U** undoes and **H** gives a hint. Each island is announced with its position, its number and how many bridges it has.

### Levels and help

Easy is checked so that simple deductions finish it, such as an island whose number equals the most its neighbours can give. On average Easy has the fewest islands and Hard the most, but the counts overlap: a Hard board can have fewer islands than an Easy one of the same size.

**Hint** looks at the numbers and the bridges you have already built correctly. If a link has too many bridges it points there. If something is forced it points at that link and says how many bridges it needs. Only when nothing is forced does it reveal a link of the answer. **Check my bridges** marks links with too many bridges, and **Show answer** draws the solution. All three count as help, so that puzzle does not set a best time.

## How it works

**Making a puzzle.** The generator starts with one island and keeps adding islands straight out from existing ones over empty water, each joined by one or two bridges. Islands are never allowed side by side. A few extra bridges are added between neighbours where there is room and nothing crosses. Each island's number is the count of bridge ends the layout gave it.

**Making sure there is one answer.** The solver gives every possible bridge a set of allowed values, 0, 1 or 2, and narrows them with two rules: the bridges at an island must be able to add up to its number, and once a bridge exists everything that crosses it is ruled out. It also rejects any state where a finished group of islands has been cut off from the rest. When those rules stall, it picks a link and tries each value. A puzzle is kept only if the search finds exactly one solution.

### What the tests check

- The list of possible bridges is compared with a separate scan of every pair of islands, and which bridges cross is compared with a cell-by-cell drawing of them.
- On two thousand small random sets of islands the solver's count equals a brute force over every way of giving each possible bridge 0, 1 or 2 bridges. Sets with no solution, one solution and several all appear.
- For sizes 7 to 11 at all three levels, 25 puzzles each are re-solved by a second solver that shares no code with the first: it tries link after link, prunes on island totals, tracks bridge cells directly and checks connection at the end. It finds exactly one solution every time, and it is the stored answer.
- The stored answer always meets every number, with no crossings and one group.
- On Easy the local rules alone reproduce the stored answer.
- Following the hints from an empty board always finishes the puzzle, and no hint ever contradicts the answer.
- The same seed always gives the same puzzle, and the page address carries the size, level and seed so you can share the exact board.

## Privacy and storage

Nothing is uploaded and there is no account. Your best time for each size and level is saved in your browser as a small whole number of seconds inside a small JSON object. Clearing site data removes it.

## Limits

- Boards are square, from 7x7 to 11x11. On a narrow phone the biggest boards are wider than the screen and scroll sideways inside their frame, because the islands are kept large enough to tap.
- Hard describes how many islands there tend to be, not a measured difficulty. Some Hard puzzles are still quick.
- There is no daily puzzle.
