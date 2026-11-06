---
title: "Tangram"
category: "fun"
job: "Play a free tangram puzzle: fit the seven traditional pieces into a dark shape with no gaps and no overlaps. 16 shapes, drag or keyboard, a hint and a dividing-lines helper."
description: "Free Tangram puzzle with the seven classic pieces and 16 shapes. Drag, turn and flip with mouse, touch or keyboard. Judged with exact geometry. No signup."
aiSummary: "A free browser tangram. The seven traditional pieces are two large triangles, one medium triangle, two small triangles, one square and one parallelogram, with the classic proportions: the two large triangles have an area of 4, the medium triangle, the square and the parallelogram 2, and the two small triangles 1, in units of a small triangle. The player fills one of 16 silhouettes with all seven pieces so that nothing overlaps and nothing sticks out. Pieces are dragged with a pointer or moved with the arrow keys, turned in quarter turns and the parallelogram can be flipped, and they snap to a whole-number grid. All corners are whole numbers, so overlap is decided exactly by testing every edge direction with integer arithmetic, and containment by sample points placed so that none can lie on an edge. Each silhouette is the union of the seven pieces in one valid arrangement, and tests prove for all 16 that the pieces are the seven tans, that no two overlap by two different methods, that their areas add up to the shape's area, and that gluing shared edges leaves one closed outline enclosing exactly that area, so there is no gap and no hole. Any arrangement that fills the shape counts, not only the one it was cut from. Which shapes are finished stays in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I enjoy is that putting every corner on a whole-number grid turns the questions \"do these overlap\" and \"does this fit inside\" into plain integer arithmetic, so the page can judge a finished shape exactly."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔺"
---

## How to play

Tangram is a very old puzzle of seven flat pieces. Two large triangles, one medium triangle, two small triangles, one square and one parallelogram together make a big square, and the same seven pieces can also be arranged into many other shapes. In this version you are given a dark silhouette and have to cover it completely with all seven pieces. Pieces must not overlap and must not stick out of the shape.

The seven pieces start in the tray under the shape. Press on a piece and drag it onto the shape. When you let go it snaps to the nearest square of the grid. **Tap a piece** to select it, and tap it again to turn it a quarter turn. The **Turn piece** button does the same for the selected piece. **Flip piece** mirrors the selected piece, but only the parallelogram looks different when flipped, so the page tells you if you try it on another one. A square looks the same however you turn it. The coloured key beside the board names every piece.

A piece that lies completely inside the shape gets a bold outline. A piece that overlaps another piece gets a dashed outline. The counter at the top says how many pieces fit. When all seven fit and none overlaps, the shape is finished. Any arrangement that fills the shape counts, so if you find a different way from the one it was cut from, that is a win too.

If a shape is hard, tick **Show the dividing lines inside the shape** to see where the pieces were cut. **Hint** outlines, with a dashed amber line, where one piece that is not in place yet would go. It may need turning first. **Undo** takes back the last move or turn. **Restart** puts all pieces back in the tray. There are 16 shapes, from a plain rectangle to spiky ones, and the page remembers which you have finished. The page address holds the shape number.

**Keyboard.** Tab moves between the seven pieces. The arrow keys move the piece you are on by one square, or by two while Shift is held. **Enter**, **Space** or **R** turns it a quarter turn and Shift with R turns it back. **F** flips the parallelogram. **T** sends the piece back to the tray. **U** undoes and **H** gives a hint. Every piece has a spoken description with its turn, its position and whether it fits or overlaps, and the status line says what happened after every move. Dragging is never the only way to play, and the buttons and key moves work without a pointer.

## How it works

**Everything sits on a whole-number grid.** Take the small triangle with legs of 2. Then the large triangle has legs of 4, the medium triangle has a hypotenuse of 4, the square has sides of 2, and the parallelogram has sides of 2 and about 2.83 with a 45 degree sharp angle. Written as corner points, all seven pieces have whole-number coordinates, and so does every quarter turn and the mirrored parallelogram. Every edge runs along a row, a column or a 45 degree diagonal. That is why this version uses quarter turns only: an eighth of a turn would put corners on fractions of the square root of 2.

**Overlap is a separating-axis test.** All seven pieces are convex. Two convex shapes share area exactly when no edge direction separates them, and touching along an edge or at a corner does not count. The test projects both pieces on the normal of every edge and compares whole numbers.

**Inside is a sample test.** To check that a piece lies inside the silhouette, the page looks at sample points on a grid of a quarter square, shifted a little so that no point can sit on an edge. Every little triangular cell cut out by the grid lines and diagonals is big enough to contain one sample, so if any part of the piece were outside the shape, a sample in that part would show it. The shape is the union of its seven parts, so a sample inside the piece must also be inside one of those parts.

**Why seven fitting pieces fill the shape.** The seven pieces have a total area equal to the shape's area. If all seven are inside the shape and none overlaps another, they must cover all of it.

## What the tests check

- The seven pieces are the traditional ones. Their areas are 4, 4, 2, 1, 1, 2 and 2 in small-triangle units, which Pick's formula on the corner points confirms. The squared edge lengths and the right angles are as in a real tangram, and the leg of the medium triangle equals the hypotenuse of a small one.
- Every quarter turn and mirror keeps whole-number corners, the same edge lengths and the same area. Mirroring changes the look of the parallelogram and of no other piece.
- For all 16 shapes, the target pieces are one of each tan, no two overlap (checked by the separating-axis test and again by a much finer sampling), the areas add up to 32, and the outline left after cancelling shared edges is one closed loop enclosing exactly 32. That rules out gaps, holes and overlaps.
- All 16 shapes are different from each other even after turning and mirroring, and each fits on the table with room for the tray.
- On 3000 random pairs of placed pieces, the exact overlap test agrees with the fine sampling, and so does the exact inside test.
- Placing every piece where the shape was cut from it solves the level. Swapping the two large triangles or the two small ones still solves it. Moving one piece by a square, turning it, leaving it in the tray, or stacking two pieces does not.
- A saved progress value is accepted only as a whole number below 2 to the power 16, one bit for each of the 16 shapes. Anything else is ignored.

## Limits

- Pieces turn in quarter turns only, which keeps all the geometry exact. Shapes that would need an eighth of a turn are not included.
- The shapes are abstract. They are not pictures of anything.
- Every shape is guaranteed to have a solution, but a shape may also have others that the page has not looked for. The page accepts any exact fill.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your progress stays on your device.
