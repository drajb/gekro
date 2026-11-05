---
title: "Pipe Connect"
category: "fun"
job: "Play a free pipe-turning puzzle: rotate tiles until every pipe is joined to the source with no open ends. Five sizes, a hint, and an exact fewest-turns number."
description: "Free Pipe Connect puzzle from 4x4 to 8x8. Turn the pipe tiles until everything joins the source with no open ends. Hint included, no timer. No signup."
aiSummary: "A free browser puzzle on a grid from 4x4 to 8x8. Each cell holds a pipe tile with a fixed shape (end cap, straight, elbow, tee or cross) that can only be turned a quarter turn clockwise. The board is finished when no pipe opening faces the edge or a neighbour that does not open back, and every tile is joined to the source tile. Boards are grown from a random spanning tree and scrambled, so a finished layout always exists. An exact search, which fills the grid row by row and drops any layout that would close a loop, finds the fewest possible turns, how many finished layouts there are, and the tile to turn for the hint. Tests compare the search with a brute force over every orientation of every tile on small boards, and check that following the hint lowers the fewest remaining turns by exactly one each time. There is no timer and no queue of pieces. Best turn counts per size stay in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. What I like about it is that the exact search is cheap enough to run on every board, so the page can tell you the fewest turns that are possible and give a hint that is always on a path to a finished layout."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔧"
---

## How to play

The board is a grid of pipe tiles. You cannot move a tile, you can only turn it. Tap or click a tile to turn it a quarter turn clockwise. The goal is a board where every pipe is joined to its neighbours, no pipe end is left open, and everything is connected to the source tile, which is the one with a big ring in the middle.

There are five shapes. An end cap has one opening. A straight pipe has two openings opposite each other, so it only has two different looks. An elbow has two openings at a right angle. A tee has three openings. A cross has four and looks the same however it faces, so it never needs turning.

Pick a size from 4 x 4 to 8 x 8. **New puzzle** deals a fresh board, **Restart** puts the tiles back as they started, and **Hint** points at a tile and says how many turns it needs. The page address holds the size and the board seed, so you can send someone the exact puzzle. There is no timer and no running flow, so you can take as long as you like.

**What you see.** A pipe that is joined to the source is bright, blue near the source and shading to teal further along. A pipe that is not joined yet is grey. A pipe end that touches nothing is striped. Above the board you will see how many tiles are joined and how many open ends are left. These cues use shape and pattern as well as colour. Screen readers get a description of every tile ("Row 2, column 3: elbow open up and right, joined to the source") and a sentence after each turn.

**Keyboard.** Arrow keys, Home and End move between tiles. Enter or Space turns the tile you are on. **H** gives a hint. The keys only work while the focus is on the board.

**Your best** is the fewest turns you used on a board of that size. It only counts if you did not use the hint on that puzzle, and that stays true after a restart.

## How it works

**Boards are grown, then scrambled.** The generator grows a random spanning tree over the grid: a set of pipes that joins every cell to every other cell with no loops. It grows from a random cell, and at each step it either extends the newest pipe (long winding runs) or a random one (branches), so you get a mix of shapes. Each tile keeps the shape the tree gives it and then gets a random turn. Turning the tiles back to the tree always finishes the board, so no puzzle is impossible.

**A finished board is a tree.** A board where every opening is matched and everything is connected has the same number of pipes as the tree it came from, which is one fewer than the number of tiles. So a finished layout can never contain a loop.

**The search is exact.** To find the fewest turns, the search fills the grid row by row, trying each distinct look of each tile (four for most shapes, two for a straight pipe, one for a cross). It rejects a choice if an opening does not match its neighbour on the left or above, if an opening faces the edge, or if it would join two tiles that are already connected, which would close a loop. At the end it keeps the layout that needs the fewest clockwise turns from where the tiles are now. The same search from your current position gives the hint: it picks a tile that the cheapest layout still needs to turn, nearest the source first.

## What the tests check

- The turn arithmetic and the table of shapes match a second implementation that rotates one direction at a time.
- Grown trees are real spanning trees for every grid from 2 x 2 to 8 x 8 that the tests try, and the same seed always grows the same tree.
- For every size, 25 generated puzzles are unfinished at the start and become finished when each tile is turned to match the tree.
- On small boards the exact search agrees with a brute force that tries every look of every tile: the same fewest turns and the same number of finished layouts. That includes boards that cannot be finished, where the search reports there is no answer.
- Turning the hinted tile once always lowers the fewest remaining turns by exactly one, and following the hint to the end finishes the board.
- On 8 x 8 boards the search finishes quickly, and on 60 sample boards at least 85 percent have exactly one finished layout. That is measured, not promised: some boards have more than one.
- A saved best is accepted only as a whole number from 1 to 9999 for a known size. Anything else is ignored.

## Limits

- Boards are square, from 4 x 4 to 8 x 8.
- The fewest-turns number counts clockwise quarter turns, which is what a tap does. A straight pipe needs at most one turn.
- A board can occasionally have more than one finished layout. The page accepts any of them as finished, while the hint and the fewest-turns number follow the cheapest.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your best scores stay on your device.
