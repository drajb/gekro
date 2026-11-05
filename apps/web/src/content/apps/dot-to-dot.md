---
title: "Dot to Dot"
category: "fun"
job: "Play a numbered dot-to-dot game: join the dots in order to reveal one of eleven pictures, then watch it colour itself in."
description: "Free dot to dot game for young children: 11 pictures from 10 to 34 dots, tap or drag, no timer. No ads. No signup."
aiSummary: "A free browser dot-to-dot game for young children. Eleven original pictures (star, house, heart, kite, boat, butterfly, fish, tree, rocket, cat face, flower) are stored as numbered coordinates on a 100 by 100 grid, from 10 to 34 dots, grouped as Little, Middle and Big. Tapping within 9 units of the next dot joins it, and dragging works too. A wrong tap only names the dot that was touched and where to look. Every picture is checked by tests: all dots distinct, at least 9 units apart, none touching a line that is not its own, and no lines crossing. The finished picture colours itself from the four site accent colours. There is no timer, no sound and no fail state. Which pictures are finished is kept as one small number in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. Each picture is a list of numbers, and the test suite checks every one of them for crossing lines and dots that sit too close together to tell apart."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔢"
---

## How to play

Find dot 1 and tap it. Then tap dot 2, then dot 3, and keep going in number order. Each tap draws a line to the new dot, in a new colour. When the last dot is joined, the picture colours itself in and a few stars pop up.

You can also press down on a dot and drag to the next one. A tap does not have to be exact: anywhere within about a thumb's width of the next dot joins it. If you tap a different dot, nothing is lost. The page says which dot it was and where to look, and the next dot gets a pulsing ring.

There is no timer and no score to lose, and nothing ever fails. The pictures come in three sizes, **Little** (10 to 14 dots), **Middle** (18 to 22 dots) and **Big** (27 to 34 dots). Pick any picture, or press **New picture** for a surprise: it chooses one you have not finished yet. **Start again** clears the current picture. **Show next dot** turns the pulsing ring on or off, for children who want a harder game.

A star appears on a picture button once you have finished it, and the page counts how many of the eleven are done.

### Keyboard and screen readers

Tab into the picture, then use the arrow keys (or Page Up and Page Down) to move between dots by number. Home and End jump to the first and last dot, and **N** jumps to the dot that is next to join. Press Enter or Space to join the dot you are on. Every dot is labelled with its number and whether it is joined, the next one to join, or still to come, and a status line says what each press did, such as "Good job! Dot 5 joined. 13 dots to go, find dot 6." Colour never carries meaning here: every dot has its number written on it.

Buttons and picture choices are at least 56 pixels tall. With reduced motion switched on, the pulsing ring stays steady, the stars appear without popping, and the picture appears without a fade.

## How it works

### The pictures are numbers

Each picture is a list of strokes. A stroke is a run of dots that is either a closed loop or an open line. The dots are numbered 1 up to N across all the strokes, and joining dot k draws a line from dot k - 1 unless dot k starts a new stroke, when the pen lifts. When you reach the last dot of a closed loop, the line back to its first dot is drawn too. All coordinates sit on a 100 by 100 grid, and I laid every outline out by hand on that grid.

There are eleven: a star (10 dots), house (11), kite (11), heart (14), boat (18), fish (18), tree (21), butterfly (22), rocket (27), cat face (27) and flower (34). A few use more than one stroke: the boat has a hull and a sail, the rocket has a body, a flame and a round window, and the cat face has a head, a nose and two sets of whiskers.

### Checked, not just drawn

A picture only makes it into the game if a checker finds nothing wrong with it, and the tests run that checker on all eleven:

- The dot count is between 10 and 50, and every dot is inside the grid with a 3 unit margin.
- All dots are different, and no two are closer than 9 units, so two numbers never overlap.
- No line crosses, touches or lies on top of another line, except neighbouring lines meeting at their shared dot.
- No dot is closer than 4 units to a line it does not belong to, so a dot never looks like part of someone else's line.

The line-crossing test is written from scratch, and it is checked against a second, independent method (solving the two lines' equations directly) on 5000 random pairs of segments, including touching, parallel and overlapping ones. The tests also feed the checker deliberately broken pictures, and confirm it flags crossings, repeated dots, dots too close together and dots off the edge.

### What a tap means

The page converts a tap into grid units and finds the dot nearest to it. If that dot is within 9 units, it is the dot the child meant. When it is the next dot, it is joined. When it is another dot, the page names its number. Because every dot is at least 9 units from every other, a tap within 4 units of the next dot can never be closer to some other dot, and a test checks that on thousands of random taps. Dragging needs the pointer to get within 7 units of the next dot with no other dot closer.

Dots are drawn with a radius that grows when the dots are far apart, between 3.4 and 5.2 units, so numbers stay readable on big pictures and neighbouring dots never touch.

### The colours

A finished picture fills its closed loops and adds a few extra shapes, all in colours mixed from the four accent colours the whole site uses. The lines you draw cycle through six colours, and so do the joined dots.

## Saved progress

The page keeps one small whole number in your browser's local storage, a mask that records which of the eleven pictures you have finished. The page sanitises it when it reads it back, so a damaged value is just treated as nothing finished. Clearing site data removes it. The page address holds the picture name, so a link opens the same picture. Nothing is uploaded and there is no account.

## Limits

- Pictures are fixed. There is no way to draw your own, and no way to print one.
- Dragging works best with a mouse or pen. On a phone the page scrolls when you drag, so taps are the main way to play there.
- The keyboard moves between dots by number, not by where they are on the screen.
- There is no sound and no speech.
