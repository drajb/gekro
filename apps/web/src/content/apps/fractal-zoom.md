---
title: "Fractal Zoom"
category: "fun"
job: "Explore the Mandelbrot set and Julia sets: drag to move, scroll or pinch to zoom, visit nine presets and change the colours."
description: "Free fractal explorer for the Mandelbrot set and Julia sets with smooth colours, nine presets and zoom to the limit of 64-bit numbers. No signup."
aiSummary: "A free browser fractal explorer. It draws the Mandelbrot set and Julia sets from the rule z becomes z squared plus c, colouring each point by how many repeats it takes to pass distance 2 (smoothly, using the size of z at escape, so there are no steps between colour bands). Drag to move, scroll (after a click, or with Ctrl) or pinch to zoom, use the keyboard, pick one of nine places or five palettes built from the site's colours, or make a Julia set from the middle of a Mandelbrot picture. The picture is drawn in 48-pixel tiles over many frames with a rough pass first and then full detail from the middle outwards, with an on-screen progress note. At high repeat counts a tile is cut into thin slices of rows and the clock is checked between slices, so each frame spends about 10 ms drawing and the page stays responsive. The number of repeats rises with the zoom depth (100 at the start, 55 more per doubling, halved for Draft and doubled for Fine). A warning appears when two neighbouring pixels are fewer than 4,000 steps of a 64-bit number apart, and the zoom stops at 16 steps. Tests compare the escape counts with exact big-integer fractions, the Mandelbrot area with 1.5066, and the tiled render with a direct count at every pixel. Nothing is stored, uploaded or downloaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The zoom stops where 64-bit numbers run out of digits, which makes the limits of ordinary computer arithmetic something you can see and reach."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🌀"
---

## How to play

The page opens on the whole Mandelbrot set, drawn first roughly and then in detail from the middle outwards. A note over the picture says how far along it is. Nothing moves by itself.

- **Move.** Drag the picture with a mouse, finger or pen.
- **Zoom.** Click the picture once, then scroll the mouse wheel. Holding Ctrl while you scroll also works without a click, and it is how a pinch on a trackpad arrives. On a touch screen, pinch with two fingers. The Zoom in and Zoom out buttons zoom about the middle. The wheel waits for a click so that scrolling past the picture still scrolls the page.
- **Go to a place.** The list has nine places, five on the Mandelbrot set (the whole set, seahorse valley, elephant valley, spiral arms and a small copy of the whole set) and four Julia sets. Each has a one-line note in the status line.
- **Kind of fractal.** Switch between the Mandelbrot set and a Julia set. A Julia set depends on one chosen number c. **Julia set from the middle** takes the point at the middle of the Mandelbrot picture as c, so you can find an interesting place and see the Julia set that belongs to it.
- **Colours.** Sky, Fire, Garden, Violet or Rainbow. They are mixed from the site's four accent colours. Changing them does not redraw the picture, it only recolours it. The inside of the set is always very dark.
- **Detail.** Draft, Normal or Fine sets how many repeats the picture is allowed. More detail shows more thin structure deep inside the zoom and takes longer to draw.
- **Start again** goes back to the whole set of the current kind.

Colour is only decoration here: the status line gives the centre and zoom in numbers.

### With the keyboard

Press Tab until the picture is selected. Arrow keys move it (Shift moves further), + and - zoom, 0 starts again, M switches between the two kinds, J makes a Julia set from the middle, [ and ] change the colours, D changes the detail, and comma and full stop go to the previous and next place. The status line says what happened. Keys are only taken while the picture is selected.

### Touch, motion and sight

Only the picture itself stops the page scrolling under your finger. Extra fingers beyond two are ignored. The picture changes only when you ask it to: while a new one is worked out, the old one is stretched into place so you never look at a blank. With reduced motion requested, the picture is worked out in larger slices so it finishes sooner.

## How it works

Take a complex number z and a fixed number c, and repeat z becomes z times z plus c. If z ever gets further than 2 from the middle, it runs away for ever. For the Mandelbrot set, z starts at 0 and c is the point you are looking at. For a Julia set, c is fixed and z starts at the point you are looking at. The page counts how many repeats it takes to pass 2, and draws points that never do (within the limit) as the dark inside.

**Exact counts.** The tests check the 64-bit code against exact arithmetic. They count the repeats for a grid of more than 450 points using fractions made from big integers, with no rounding at all, and the counts must match for every point, for both kinds of set. They also check known points: c = 1 escapes after 3 repeats, c = 2 after 2, and c = -2, -1, 0, i and 1/4 never escape. Just past 1/4 escape is slow, about pi over the square root of the distance past it. A pixel count over 160,000 points gives an area between 1.49 and 1.58, around the true value of 1.5066. The Julia set for c = 0 is the disc of radius 1. A shortcut that skips the loop for the main body and round bulb is checked on 30,000 random points: it never claims a point that escapes.

**Smooth colour.** Colouring by whole counts gives hard bands. The page keeps going until z passes radius 256, then subtracts a fraction worked out from the size of z, which makes the number change smoothly. The tests walk along a line 230,000 steps long across many band edges: the whole count jumps by 1 at each edge, but the smooth value never moves by 0.01.

**Tiles.** The picture is cut into 48-pixel tiles. The first pass samples the middle of each 4 by 4 block, a sixteenth of the work, and covers the whole picture. The second pass does every pixel, from the middle tile spiralling out. Each frame works for about 10 milliseconds, then draws what is finished. When the repeat limit is high (above 300, and again above 1,000) a tile is cut into slices of 12 or 4 rows and the clock is checked between slices, because a single tile at thousands of repeats could otherwise hold the page for well over 100 milliseconds. A test with a fake clock checks that every call does at least one piece of work and stops at its budget, and that the finished result equals an independent count at every pixel, for both kinds, with whole tiles and with slices.

**The limit.** A 64-bit number holds about 15 or 16 digits. When two neighbouring pixels are only a few of its smallest steps apart, they start to get the same number and the picture turns into blocks. The page counts those steps, shows a warning below 4,000 and refuses to zoom below 16. The tests check that at 16 every one of 960 neighbouring pixels still gets its own number, and that at a hundredth of that many share one.

| Setting | Value |
|---|---|
| Repeats allowed | 100 at the start, 55 more per doubling of zoom, 60 to 4,000 |
| Draft / Fine | half / double |
| Tile | 48 pixels |
| Picture width | up to 960 pixels |
| Warning / stop | 4,000 / 16 steps between neighbouring pixels |

## Privacy and limits

Nothing is uploaded, stored or downloaded. Copy in the toolbar copies a one-line description, for example the kind of set and the zoom.

- Past the limit this method cannot improve the picture. Deeper zooms need numbers with more digits.
- Near the edge of a set a tiny change in a point can change its count a lot, so the finest detail looks noisy.
- The picture is at most 960 pixels wide and is scaled to your screen, so on a very large screen it can look slightly soft.
