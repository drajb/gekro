---
title: "Kaleidoscope"
category: "fun"
job: "Draw on a round canvas that repeats every stroke 6, 8 or 12 times around the middle, with an optional mirror, eight colours and a rainbow."
description: "Free kaleidoscope drawing toy. Every stroke repeats 6, 8 or 12 times with an optional mirror, plus undo and a rainbow pen. Runs in your browser. No signup."
aiSummary: "A free browser drawing toy on a round canvas. Each stroke is repeated by rotating it about the middle of the circle 6, 8 or 12 times; with Mirror on it is also reflected, which doubles the copies to 12, 16 or 24. Strokes are stored as lists of points in unit coordinates (the rim of the circle is distance 1), so a resize or an undo redraws them exactly. A stroke is drawn as a chain of straight and quadratic pieces through the midpoints of its points, and the first n - 1 pieces never change when a point is added, so live drawing and a redraw produce the same curve. There are eight colours mixed from the site's four accent colours in OKLCH and a rainbow that moves to the next colour every 0.3 of the radius of stroke length. Three line widths, 120 steps of undo and redo, clear, optional guide lines, keyboard drawing with a pen-down key, and a short demo that plays once and stops at the first input. A canvas holds up to 150 strokes and 24,000 points. Tests compare the copy transforms with explicit rotation and reflection matrices. Nothing is stored or uploaded and nothing is downloaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. It is a small, visible example of a symmetry group: a handful of turns and one flip generate every copy, and the tests check them against plain rotation matrices."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔮"
---

## How to play

Draw on the round canvas with a mouse, a finger or a pen. Everything you draw is repeated around the middle, so one wavy line becomes a flower or a snowflake. When the page opens, a short demo draws a pattern by itself. It stops the moment you touch the canvas or any control, and the canvas is yours and clear.

- **Folds.** 6-fold, 8-fold and 12-fold set how many times a stroke is turned around the middle. Eight is the starting choice.
- **Mirror.** When it is on, each stroke is also flipped over before it is turned, so you get twice as many copies and the whole pattern is the same left to right and top to bottom. With 8 folds and Mirror on there are 16 copies of every stroke. The number of copies is shown above the canvas.
- **Colour.** Eight colours and a rainbow. Each colour button carries a number as well as a colour, and a spoken name such as "colour 3, green". The rainbow moves on to the next colour each time the stroke has travelled 0.3 of the canvas radius, and goes round all eight.
- **Width.** Thin, Medium or Thick. They are 0.012, 0.026 and 0.05 of the radius, so the lines look the same on a phone and on a big screen.
- **Guides.** Dashed lines from the middle show where the pattern repeats. With Mirror on there are twice as many, because every mirror line is a place where the picture folds onto itself.
- **Undo, Redo, Clear.** Undo and Redo move one stroke at a time through the last 120 pictures. Clear empties the canvas, and Undo brings it back.

The fold, mirror and width are saved inside each stroke when you draw it, so changing them never changes strokes that are already on the canvas.

### With the keyboard

Press Tab until the canvas is selected. A ring appears, with a copy of the ring at every position the pattern repeats. The arrow keys move the cursor (Shift moves further) and Space or Enter puts the pen down, then lifts it again to finish the stroke. Escape drops a stroke you are in the middle of. While the canvas has the keyboard, F changes the fold, M turns the mirror on or off, G shows the guides, W changes the width, [ and ] change the colour, U undoes, Y redoes and X clears. The status line under the canvas says what each key did. Keys are only taken while the canvas is selected, so the page keeps working everywhere else.

### Touch, motion and sight

Only the canvas stops the page scrolling under your finger. A second finger on it is ignored, and if the phone cancels a touch the stroke is dropped, not left half drawn. If your device asks for reduced motion, the demo is not played: the finished pattern is simply there until you touch the canvas. Nothing flashes.

## How it works

The picture is a list of strokes, and each stroke is a list of points with a colour, a width, a fold and a mirror flag. Points are kept in unit coordinates: the middle is 0,0 and the rim of the circle is distance 1. Because the canvas is only drawn from that list, it can be sized to its box times the device pixel ratio (never more than 2), redrawn after a resize, or rebuilt after an undo without any blur.

**Copies.** Copy k of a stroke is the stroke turned by 2 pi k / n about the middle. With Mirror on, copies n to 2n - 1 are first reflected (y becomes minus y) and then turned. The page draws each copy by handing the canvas a matrix. The engine has a second way to the same answer, written with distance and angle from the middle, and it is used to place the keyboard cursor rings. The tests build explicit rotation and reflection matrices and compare both methods with them, for 6, 8 and 12 folds with Mirror on and off. They also check that the set of images of a point is the same set whichever image you start from, that every image keeps its distance from the middle, and the counts: n copies, 2n with Mirror, fewer for a point on the mirror line, and one at the middle.

**Smoothing.** Pointer events arrive as dots, so a stroke is drawn as a chain of pieces: a line from the first point to the midpoint of the first two, a quadratic curve for every point after that (from one midpoint to the next, with the point as its control), and a line to the last point. A stroke of n points gives n pieces. Control points, midpoints and the next control point sit on one straight line, so there are no corners at the joins; a test checks this with a cross product. The first n - 1 pieces never change when a point is added, so the page draws them while you move and draws the last one when you let go. That is why the curve you see being drawn is exactly the curve that comes back after an undo. A new point is only kept if it is at least 0.006 of the radius from the last one.

**Limits.** A stroke holds up to 1,500 points, the canvas up to 150 strokes and 24,000 points in all. When it is full the status line says so and Undo or Clear makes room.

| Check | Value |
|---|---|
| Folds | 6, 8, 12 |
| Copies of a stroke | 6, 8, 12, or 12, 16, 24 with Mirror |
| Undo history | 120 pictures |
| Strokes per canvas | 150 |
| Points per canvas | 24,000 |
| Rainbow step | 0.3 of the radius |

## Privacy and limits

Nothing is uploaded, nothing is stored on your device and there is nothing to download. The picture goes when you leave the page. Copy in the toolbar copies a one-line description of your canvas, not the picture.

- Strokes are clipped to the circle, so lines that leave it are cut at the rim.
- The rainbow follows the length of a stroke, so a short stroke is a single colour.
- Pointer drawing is single touch. Pinch and two-finger gestures are not used.
