---
title: "Colouring Book"
category: "fun"
job: "Colour in six original pictures by picking one of 12 colours and tapping a shape, with undo, redo and a save-as-PNG button."
description: "Free colouring book for young children: six original pictures, 12 colours, undo and redo, save as PNG. No ads. No signup."
aiSummary: "A free browser colouring book for young children. Six original pictures (house, fish, flower, robot, rocket, butterfly) are stacks of 16 to 25 flat polygons drawn back to front on a 100 by 100 sheet. Tapping asks which polygon is on top at that spot, using point-in-polygon tests, and fills it with the chosen colour from a palette of 12 mixed from the site's four accent colours. Tests prove that the shapes of every picture cover the whole sheet with nothing left over, and that every visible part is at least 80 square units so it can be tapped. Undo and redo keep up to 200 steps, rub out and clear all are undoable, and the picture can be saved as a 1000 pixel PNG made on a canvas when the button is pressed. Which pictures have been fully coloured is stored as one small number in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. Every picture is a stack of polygons that I laid out by hand, and the tests check that the shapes cover the whole sheet with no gaps, so a tap always lands on something."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🖍️"
---

## How to play

Pick a colour from the twelve swatches, then tap a shape in the picture. The shape fills with that colour, and the page says what it did, for example "Super! The roof is now red. 4 of 18 parts coloured." Tap the same shape with another colour to change it. A tap that moves more than 10 pixels is treated as a scroll, so dragging a finger across the picture to scroll the page never colours anything by accident.

There are six pictures: a house, a fish, a flower, a robot, a rocket and a butterfly. Choose one from the **Pictures** list, or press **New picture** for a surprise (it prefers pictures you have not finished). Your work on each picture is kept while you swap between pictures on the same visit, so a wrong button never throws a picture away.

- **Undo** and **Redo** step back and forward through the last 200 changes.
- **Rub out** turns a shape blank again. Pick any colour to go back to colouring.
- **Clear all** blanks the whole picture, and it can be undone too.
- **Save picture** makes a PNG of your picture on white paper with dark outlines, in either theme, and gives it to your browser as a download.

When every shape in a picture has a colour, a few stars pop up, the picture gets a star on its button, and the page counts how many of the six you have finished. Nothing ends: you can keep changing colours afterwards.

### Keyboard and screen readers

Tab to the picture, then use the arrow keys to move from shape to shape. The order is top to bottom in bands, left to right within a band. Press Enter or Space to colour the shape you are on, Delete or Backspace to rub it out, and Page Up or Page Down to step through the colours. The status line says which shape you are on and what colour it has, and every shape has a text label such as "Roof, Red" or "Door, not coloured yet". Each swatch shows its number and carries its colour name as a label, so choosing a colour never depends on seeing the colour. The swatches, buttons and picture choices are at least 56 pixels tall.

## How it works

### Pictures made of stacked shapes

Each picture is a list of polygons drawn back to front on a 100 by 100 sheet. The first polygon is the whole sheet (the sky, the water, the wall), and later ones cover it. Circles and ovals are polygons with 28 sides, so one rule handles every shape. All the outlines were laid out by hand, and the shapes are named in plain words ("Left window", "Tail", "Antenna ball") for the screen reader.

When you tap, the page converts the position to the 100 by 100 sheet and asks which polygon is on top there: it checks the polygons from the front to the back, using the even-odd ray-casting test for point in polygon, and takes the first one that contains the point. The shapes are not drawn with any hit-testing of their own, so the tap and the picture always agree.

### Checked, not just drawn

The tests run a checker on every picture. It must find nothing wrong:

- The first shape covers the whole sheet, and every point of a 200 by 200 grid of sample points lands on some shape. The visible areas of the shapes add up to exactly 10,000 square units.
- Every shape shows at least 80 square units, about a 26 pixel square on a phone, so there is always something big enough to tap.
- Every outline is a simple polygon that does not cross itself and stays inside the sheet, and the shape names in a picture are all different.

Point in polygon is checked against an independent method, the winding number, on random polygons and on 60 random points for every shape of every picture. The checker is also run on deliberately broken pictures to prove that it notices missing coverage, tiny shapes, crossing outlines, repeated names and points off the sheet.

The six pictures have 18, 19, 19, 25, 17 and 16 shapes in the order house, fish, flower, robot, rocket, butterfly.

### The 12 colours

The palette is mixed from the four accent colours the whole site uses: light blue, teal, green, lime, yellow, orange, red, pink, purple, blue, brown and grey. The mixes are made in the OKLCH colour space, which blends hues without turning them muddy. Brown and grey also use the page's dark and light text tones, so they stay right in both the dark and light themes. A test reads the page's styles and checks that all twelve mixes are written out and that no two are the same.

### Undo and redo

Painting keeps a list of snapshots. Colouring a shape, rubbing it out and clearing all each add one snapshot, colouring a shape with the colour it already has adds nothing, and a new colouring after an undo drops the redo list. The tests run 4000 random operations against a simple separate model that stores every state in full, and the two always agree, including after the history reaches its 200 step cap.

### Saving the picture

Pressing **Save picture** draws every shape on a 1000 by 1000 canvas in the colours you chose, on white paper with dark outlines whichever theme the page is in (blank shapes stay white), turns the canvas into a PNG, and asks your browser to download it. The temporary address of the file is released a moment later. This happens only when you press the button, and the file never leaves your device.

## Saved progress

The page keeps one small whole number in your browser's local storage: a mask recording which of the six pictures you have fully coloured. It is checked when read back, so a damaged value just means no stars. Clearing site data removes it. The pictures you are colouring are not saved, so leaving the page loses them unless you saved a PNG. The page address holds the picture name, so a link opens the same picture. Nothing is uploaded and there is no account.

## Limits

- The picture you are working on is not saved between visits. Save a PNG to keep it.
- Ovals are 28-sided polygons, so a very close look at a round shape shows straight edges.
- The keyboard moves between shapes in reading order, not by direction on the screen.
- There is no sound and no speech.
