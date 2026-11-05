---
title: "Letter Tracer"
category: "fun"
job: "Trace the letters A to Z, a to z and the numbers 0 to 9 with a finger, a mouse or the arrow keys, and collect stars."
description: "Free letter and number tracing game for young children. Trace A to Z, a to z and 0 to 9, collect stars. No ads. No signup."
aiSummary: "A free browser game for tracing letters and numbers. There are 62 shapes (26 capitals, 26 small letters, 10 numbers), each made of one to four strokes written as plain upright print. Every stroke has a numbered start dot and an arrow, and the strokes go top before bottom and left before right, with the dot of an i or j last. A stroke counts as traced when the finger has followed it from the start to within 5 units of the end, staying within 13 units of the guide line in a 100 by 100 box. Progress only moves forward and only up to 30 units at a time, so touching the start and the end of a curve does not finish it. Finishing a letter earns one to three stars (three when at most 12 percent of the tracing samples were off the line, two up to 35 percent, otherwise one) and a shape keeps its best. It works with touch, mouse and pen, and with the keyboard: arrow keys move a pen and Space puts it down. Stars are kept in local storage on the device. Nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The interesting part is deciding when a wobbly line counts as following the shape: forgiving enough for small hands, but not so forgiving that a swipe across the middle finishes it."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "✏️"
---

## How to play

Pick **Capitals**, **Small** or **Numbers**, then a shape from the grid (or press **Next**). The big drawing box shows the shape as a dotted line on a soft road. Each stroke has a numbered dot where it starts, and an arrow that shows which way to go. The dot for the stroke you are on is bright and gently pulsing; the other numbers wait in grey.

Press on the bright dot and drag along the dotted line. A coloured line fills in behind your finger. When you reach the end of the stroke it is done, and the dot for the next stroke lights up. You can lift your finger in the middle and press again where the coloured line stops to carry on. For a letter with a dot, such as i or j, tap the dot last.

When the whole shape is traced you get one, two or three stars. You never lose anything: a shape keeps the most stars you have earned on it. If you press somewhere that is not the next dot, nothing bad happens; a short message tells you where the next dot is.

**Show me** glides a dot along the strokes in order and says each stroke in words, for example "Stroke 1 of 3: start at the top middle, go down and left, and finish at the bottom left." If your device asks for reduced motion, it gives the words and leaves the numbers on screen instead of moving anything. **Start again** clears the shape and lets you try it once more.

### Keyboard

Tab to the drawing box. A ring shows where the pen is. Press **Space** to put the pen down on the next start dot, move with the **arrow keys** (hold **Shift** for bigger steps) and press **Space** again to lift it. If the pen is far from the next dot, Space moves it there first and a second press puts it down. **Escape** lifts the pen. A line of text under the box says what just happened, so a screen reader can follow along.

Colour never carries meaning alone. The order of the strokes is in the numbers, the direction is in the arrows, and the finished state is a green border and filled-in stars.

## How it works

Every shape is written for this game as a few strokes of plain upright print: straight lines, circles and ellipse arcs, joined into one connected path per stroke. They sit in a 100 by 100 box with four guide lines: the top line at 16, the x-height at 44, the baseline at 72 and the descender line at 90. The tests check all 62 shapes against a separate hand-written table of stroke counts, that no two neighbouring points of a stroke are more than 5 units apart, that every point is inside the box, and that each kind has the right height: capitals and numbers from 16 to 72, small letters with a body from 44 to 72, tall ones up to 16, and g, j, p, q and y down to 90. They also check the writing order: each stroke starts no higher than the one before it, and no further left when level with it.

The tolerance function measures the distance from your finger to the nearest point of the stroke. Within 13 units counts as on the line. The drawn road is narrower than that, so a child who stays on the road is well inside. The tests compare this distance to a slow brute-force measurement on thousands of random points, and check exact, near and far points.

Following a stroke uses a progress number, the distance traced along the stroke so far. Each pointer sample can only move progress forward, only to a spot within the tolerance, and only up to 30 units ahead of where it is. A fast swipe is filled in with a sample every 2 units, so it is followed rather than skipped. The stroke is done when progress comes within 5 units of its end. Because of the 30-unit window, touching just the start and the end of a curved stroke does not finish it, and going round a closed shape the wrong way does not either. To pick a stroke up, a press has to land within 16 units of the start, or of where you lifted; a dot needs a press within 14 units.

The tests trace all 62 shapes exactly and every one finishes with three stars. They trace them again with a random wobble of up to 55 percent of the tolerance, from 12 different seeds, and every shape still finishes. They also walk every shape using only arrow-key steps.

Stars come from the share of samples that were off the line: at most 12 percent earns three, up to 35 percent earns two, and anything else earns one. A finished letter always earns at least one.

## Privacy and storage

Nothing is uploaded and there is no account. Your best stars for each shape (a whole number from 1 to 3) are saved in your browser's local storage in a small JSON object. When they are read back, only the 62 known shapes are accepted and only whole numbers from 1 to 3. **Clear saved stars** asks you to press twice before it clears anything.

## Limits

- It checks that you followed the line, not how neat your writing is. It is a first step toward writing letters, not a handwriting course.
- The shapes are plain print. Letters like a and g have the simple two-part form, and the capital I and the small l are the same straight line.
- Stars stay in one browser. A different browser, a private window or cleared site data starts from nothing.
- Pressing or lifting a finger outside the drawing box does nothing; the box is the only part of the page that stops scrolling when touched.

Everything runs locally in your browser.
