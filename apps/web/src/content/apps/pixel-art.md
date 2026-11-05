---
title: "Pixel Art"
category: "fun"
job: "Draw pixel pictures on an 8, 16 or 32 square board with a 16-colour palette, mirror drawing and undo, then save the picture or download it as a PNG."
description: "Free pixel art editor with pencil, fill, line, rectangle, mirror drawing, 50-step undo and PNG download. Runs in your browser. No signup."
aiSummary: "A free browser pixel art editor. The board is 8x8, 16x16 or 32x32 and each square holds 0 (empty) or one of 16 palette colours. The palette is built in code from the site's four accent colours: eight hues (the four colours and their even mixes, made in OKLCH), four deeper versions and four greys. Tools are pencil, eraser, flood fill (four-way, checked against an independent fill), line (Bresenham's integer algorithm, the same squares from either end), rectangle and filled box. Mirror drawing repeats every pixel left and right, top and bottom, or both. Undo and redo keep the last 50 pictures. One drawing can be saved on the device as a run-length string of at most 1100 characters that is strictly validated when loaded, and the picture downloads as a 512 by 512 PNG made from a click with canvas toBlob. Nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. Small pixel boards are a good place to see how a few plain algorithms, a flood fill and a straight line, behave on a grid you can count by eye."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎨"
---

## How to play

Pick a board size (8 x 8, 16 x 16 or 32 x 32), pick a colour, and draw. Every square on the board is one pixel.

- **Pencil** colours the squares you drag across. A quick drag never leaves gaps, because the page joins each position to the last one with a straight line.
- **Eraser** empties squares. Empty squares show a faint chequer on the board and are see-through in the downloaded PNG.
- **Fill** colours a whole area. It spreads up, down, left and right to every touching square that has the same colour as the one you pressed, and stops at any other colour. It does not leak through a diagonal gap.
- **Line** draws a straight line from where you press to where you let go. **Rectangle** draws just the outline, and **Filled box** fills it in. While you drag you see a preview, and nothing is final until you let go.
- **Mirror drawing** repeats what you draw: left and right, top and bottom, or all four ways. A dashed line shows where the mirror is.
- **Undo** and **Redo** go back and forward through the last 50 pictures. Changing the board size counts as a step, so Undo brings the old picture back.
- **Grid lines** turns the faint lines between squares on or off.
- **Save** keeps the current picture on this device. **Load saved** brings it back as a step you can undo. **Download PNG** gives you the picture as an image file.

The 16 colours are numbered, and every colour button shows its number and has a spoken name such as "colour 3, green". The numbers matter: the colour is never the only way to tell two buttons apart.

### With the keyboard

Press Tab until the board is selected. A square cursor appears. The arrow keys move it (hold Shift to move four squares at a time) and Space or Enter does the current tool's job at the cursor. For Line, Rectangle and Filled box, press Space once to set the start, move the cursor, and press Space again to finish; Escape cancels. While the board is selected, P, E, F, L, R and B pick the tools, [ and ] step through the colours, U and Y undo and redo, G toggles the grid and M cycles the mirror. A status line below the board says what each action did, for screen readers and for everyone else.

On a touch screen, the board does not scroll the page while you draw on it, and every button is at least 44 pixels high.

## How it works

The picture is a flat list of numbers, one per square, from 0 to 16. Every tool turns into a list of square positions, applied to a copy of the picture, so Undo only has to keep the earlier copies.

- **Flood fill** is an iterative stack fill. The tests compare it with an independent version that sweeps the whole board again and again until nothing changes, on random boards of all three sizes.
- **Lines** use Bresenham's integer algorithm. The tests check that both end points are included, that a line has exactly as many squares as its longer side plus one, that each step moves to a touching square, that it never strays more than half a square from the true line, and that a line from A to B covers the same squares as one from B to A. To get that last property the algorithm always runs from the smaller end point to the larger and is reversed afterwards if needed.
- **Mirror drawing** works out the point and its reflections, and drops duplicates so the squares on the middle line are only painted once.
- **Undo history** is a list of earlier pictures capped at 50. The tests run 4,000 random strokes, with undo and redo mixed in, and check that the history never grows past its cap and that every stored picture is a copy that later drawing cannot change.
- **The palette** is made by mixing the site's four accent colours in OKLCH, the same colour space the page's styles use, going the short way round the hue wheel. Colours 1 to 8 are sky, teal, green, lime, amber, orange, rose and violet. Colours 9 to 12 are deeper versions (sky, green, brown, violet) and colours 13 to 16 are four greys from white to black. The tests check that all 16 colours are different.
- **Saving** writes the picture row by row as runs, a letter for the colour and a count for runs longer than one. A blank 8 x 8 board is `8:a64`. The worst case, a 32 x 32 checkerboard, is 1,027 characters, and the page refuses to read anything over 1,100. When the page loads a saved picture it accepts only exactly what it would have written itself: a valid size, valid letters, counts that add up to the board and no unusual spellings. Anything else, including odd JSON, is ignored.
- **Download PNG** draws the picture on a hidden canvas at a whole-pixel scale (64 for 8 x 8, 32 for 16 x 16, 16 for 32 x 32, so the file is 512 by 512), turns it into a file with the browser's own canvas export, and hands the browser a temporary link that is removed about a second later. It only runs when you press the button. Nothing is uploaded.

## Sizes and files

| Board | Squares | PNG size | Scale |
|---|---|---|---|
| 8 x 8 | 64 | 512 x 512 | 64 |
| 16 x 16 | 256 | 512 x 512 | 32 |
| 32 x 32 | 1,024 | 512 x 512 | 16 |

The file is called `pixel-art-` followed by the board size, for example `pixel-art-16x16.png`. A blank picture will not download, because it would be an empty image.

## Privacy and limits

There is no account and nothing is sent anywhere. The only thing stored is the one saved picture, as the short text described above, in your browser's local storage. Clearing site data removes it, and the page works if storage is blocked, only without Save.

- Only one picture can be saved at a time. Saving again replaces it.
- The board is square, with three sizes. There are no layers, no selection tool and no animation.
- Empty squares are see-through in the PNG, so a picture with empty squares shows whatever is behind it where you place it.
- The colour names and numbers are fixed. You cannot mix your own colours.
