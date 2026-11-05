---
title: "Picture Puzzle"
category: "fun"
job: "Play a picture puzzle: swap mixed-up pieces until one of four original pictures is whole again, with 4 to 25 pieces."
description: "Free picture puzzle for young children: four original pictures cut into 4 to 25 pieces, tap two to swap. No ads. No signup."
aiSummary: "A free browser picture puzzle for young children. Four original pictures (a sunset, a garden, a rocket in space, and under the sea) are drawn in code on a 120 by 120 sheet and cut into 2x2, 2x3, 3x3, 4x4 or 5x5 pieces. Tapping one piece and then another swaps them, and a mouse can drag a piece onto another. Every shuffle is a random single-cycle permutation made with Sattolo's algorithm, so the puzzle never starts finished, no piece starts in its own place, and exactly n minus 1 swaps is the minimum. The tests check every arrangement of up to 6 pieces against a breadth-first search, that the cuts tile the sheet with whole-number sizes, and that no two pieces of any picture at any size look alike. There is no timer and no fail state. The fewest swaps per size are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A puzzle made of copies of the same sky would be impossible to solve by eye, so the tests draw every picture into a grid of dots and check that no two pieces match."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🖼️"
---

## How to play

The picture is cut into pieces and mixed up. Tap one piece to pick it up, then tap another piece to swap the two. Tap the same piece a second time to put it down again. With a mouse or a pen you can also drag a piece onto another one. A tick in the corner of a piece means it is in the right place, and the page counts how many are home and lights up to five stars as you get closer. When every piece is in its place, the picture joins up, a few stars pop, and the page tells you how many swaps it took.

Pick the number of pieces:

| Name | Pieces | Layout |
|---|---|---|
| Tiny | 4 | 2 across, 2 down |
| Little | 6 | 3 across, 2 down |
| Middle | 9 | 3 by 3 |
| Big | 16 | 4 by 4 |
| Huge | 25 | 5 by 5 |

There are four pictures to choose from: **Sunset**, **Garden**, **Space** and **Under the sea**. **New game** mixes the same picture again, **Start again** puts the pieces back the way they were when you began, and **Next picture** moves on after a win. There is no timer, and a swap can never be wrong, because you can always swap again.

### Helpers

- **Show picture** opens a small copy of the finished picture to look at.
- **Edge pieces** draws a dashed border on the pieces that belong on the edge of the picture. A good place to start.
- **Ticks** turns the tick marks on and off, for children who want a harder game.

### Keyboard and screen readers

Tab to the board, then use the arrow keys to move between places on the grid, and Home and End to jump to the first and last place. Press Enter or Space to pick up the piece you are on, move to another place, and press Enter or Space again to swap. Escape puts a piece down. Every piece has a label such as "Piece 5 of 9, at row 2, column 2, in the right place", and the status line says what each swap did, for example "Good move! A piece is now in the right place. 2 of 9 in the right place." Buttons and picture choices are at least 56 pixels tall. The pieces fill the board, so the 25 pieces of the Huge size are the smallest targets, a little under 60 pixels wide on a very narrow phone. With reduced motion switched on, pieces jump to their new place without sliding and the finish has no glow or popping stars.

## How it works

### Pictures drawn from shapes

Each picture is a list of flat shapes (rectangles, circles, ovals and polygons) drawn back to front on a 120 by 120 sheet. They have between 80 and 165 shapes each. The number 120 divides evenly by 2, 3, 4 and 5, so every grid cuts the sheet into pieces with whole-number sizes. A test checks that for every size the pieces add up to the whole sheet and that each unit square of the sheet belongs to exactly one piece.

Each piece is a window onto the same picture. The page draws the picture once and every piece shows a different part of it, so the 25 pieces of the biggest puzzle do not each carry their own copy of the drawing.

### No two pieces alike

A puzzle where two pieces look the same cannot be solved by looking. To prevent that, every picture has small details scattered over it with a fixed seed: stars, ripples, flowers, bubbles, wisps of cloud. The tests then draw each picture onto a grid of sample points, cut it the way each size cuts it, and compare every pair of pieces. For all four pictures at all five sizes, any two pieces differ in at least 9 percent of their area, and every piece shows at least two colours.

### The shuffle

The shuffle is Sattolo's algorithm, a variation on the usual shuffle that always produces one single loop in which every piece has moved. That gives three guarantees, all checked on 400 seeds at each size:

- The puzzle never starts finished.
- No piece starts in its own place.
- The fewest swaps that finish the puzzle is exactly one fewer than the number of pieces, so the 9 piece puzzle can always be finished in 8.

The shuffle takes a random number function as an input. The page makes a seed from the browser's secure random source and keeps it in the page address along with the picture and the size, so sending the link sends the same mix. The tests check that the same seed always gives the same shuffle, and that the 6 possible single-loop mixes of 4 pieces each turn up about equally often over 6000 shuffles.

### Why every puzzle can be finished

Swapping two pieces at a time can turn any order into any other. The tests prove it the blunt way for small boards: a breadth-first search from the finished picture, using swaps only, reaches every one of the n! arrangements for 1 to 6 pieces. The minimum swaps for an arrangement is the number of pieces minus the number of loops it is made of, and the test confirms that formula against the search for every arrangement of up to 6 pieces. For larger boards the page relies on the same formula, and the tests check that following the recipe for finishing (put the right piece in place 0, then place 1, and so on) always ends finished, in the minimum number of swaps, on 300 random arrangements of 2 to 25 pieces.

## Best results

The page keeps your fewest swaps for each size, and updates it when you finish with fewer. It is a record against yourself only, and there is no ranking.

## Privacy and storage

Nothing is uploaded and there is no account. The fewest swaps are saved in your browser's local storage as small whole numbers inside a small JSON object, one number per size. The page checks the values when it reads them, so a damaged value is ignored. Clearing site data removes them.

## Limits

- On a touch screen, play is tap then tap. Dragging works with a mouse or a pen. On a phone, a drag starting on the board is left to the page so that scrolling still works.
- The pictures are fixed, and there is no way to use your own photo.
- Swaps are counted, not minimised for you: the page does not suggest a move.
- There is no sound and no speech.
