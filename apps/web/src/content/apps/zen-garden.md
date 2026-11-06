---
title: "Zen Garden"
category: "fun"
job: "Rake a patch of sand with a stick or a rake, place stones that ripple the sand around them, add moss, and undo anything."
description: "Free zen garden toy. Rake sand with four rake widths, place stones that ripple the sand in rings, add moss and undo. Quiet, no sound, no signup."
aiSummary: "A free, quiet browser sand garden. The sand is a 300 by 200 grid of heights, shaded as if lit from the upper left. A stick cuts one groove and rakes with 3, 5 or 9 tines cut that many grooves, 4 cells apart, across the direction of travel. A stone flattens the sand under it and ripples the sand around it in four rings, 4 cells apart, with the first valley 3.5 cells from the stone. The rings come from an exact Euclidean distance transform of the stone cells, so they follow each stone's outline and two close stones share rings. A smoothing brush levels the sand, moss is a patch of small dots, and a starting garden of two raked lines, three stones and two moss patches is there at first. The garden is stored as a list of actions replayed from flat sand, so Undo and Redo are exact. It holds up to 12 stones, 16 moss patches, 300 actions and 20,000 path points. Tests compare the distance field and every ripple cell with brute-force searches. There is no sound, no score, no storage and no download."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The rings round the stones are a neat use of a distance field, and the tests check every cell against a brute-force search."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🪨"
---

## How to play

A raked garden is already there when the page opens: two wavy lines, three stones and two patches of moss. Nothing moves by itself and there is no sound. Pick a tool and drag across the sand with a mouse, a finger or a pen.

| Tool | What it does |
|---|---|
| Rake | Drag to cut grooves into the sand. The width buttons choose a stick (1 groove), a small rake (3), a medium rake (5) or a wide rake (9). Grooves are 4 cells apart. |
| Stone | Press where you want a stone. A dashed ring shows where it will go, and you can slide it before you let go. The sand around it ripples. A ring in rose means there is no room. |
| Moss | Press to place a patch of small green dots. Moss can sit over a stone's edge. |
| Smooth | Drag to level the sand again under a round brush. |

The size buttons set small, medium or large stones and moss. Stones are 6, 9 or 13 cells in radius, moss 8, 12 or 17. A garden holds up to 12 stones and 16 patches of moss. Two stones must have a little room between them. A stone that would hang over the edge is refused with a message instead.

**Undo, Redo, Smooth all, Starting garden.** Undo and Redo move one action at a time (a rake line, a stone, a patch of moss, a smoothing stroke). Smooth all levels the whole garden and removes stones and moss, and Undo brings them back. Starting garden puts the first garden back.

### With the keyboard

Press Tab until the garden is selected. A ring shows the cursor. The arrow keys move it (Shift moves further). For the rake and the smoothing brush, Space puts the tool down and the next Space lifts it, and moving the cursor while it is down draws. For a stone or moss, Space places it at the cursor. Escape drops a stroke in progress. While the garden has the keyboard, 1 to 4 pick rake, stone, moss and smooth, W changes the rake width, Z changes the size of stones and moss, U undoes, Y redoes and X smooths all the sand. A status line says what each action did.

### Touch and sight

Only the garden itself stops the page scrolling under your finger; the buttons and text scroll as normal. A second finger on the garden is ignored. If the system cancels a touch, the stroke or stone you were placing is dropped. Light and shade, not colour, carry the grooves, so they read the same in the light and dark themes. Nothing flashes and nothing moves on its own, so reduced motion needs no special mode.

## How it works

The sand is a grid of 300 by 200 heights, from flat (0) down to a groove's floor (-0.9). The garden is not saved as pixels. It is a list of actions, and the heights are rebuilt by replaying the list from flat sand. That is why Undo is exact: the tests check that undoing and redoing give the same heights, and that building up the heights one action at a time equals rebuilding from the whole list.

**Rakes.** The page records a point each time your pointer has moved at least 1.2 cells, spaces those points evenly 0.8 cells apart along the path, works out the direction of travel from the points either side, and cuts a groove at each tine position, offset sideways from the path. A groove is a valley about 2 cells wide with a low ridge on each side. The tests cut strokes with 1, 3, 5 and 9 tines in several directions and count the grooves in a cross-section, which must equal the tine count at the right spacing.

**Lighting.** Each cell's shade comes from how its neighbours slope, with the light from the upper left, and deeper valleys are a little darker. The right wall of a groove is lit and the left wall is in shade. A test checks that.

**Ripples.** When a stone goes down, the engine marks every cell under any stone and runs an exact Euclidean distance transform over the grid (two passes of a lower-envelope method, linear time). That gives, for every grain of sand, how far it is from the nearest stone. The ripple height is a cosine of that distance: valleys at 3.5, 7.5, 11.5 and 15.5 cells from the stone, a ridge between each, a fourth ring that fades out, and flat sand beyond. Because it is a distance to the nearest stone, the rings follow a stone's outline and merge between two close stones. The tests compare the transform with a brute-force search on random grids, and compare every cell of a garden with one stone and with two stones against the ripple pattern at its brute-force distance.

**Stones and moss.** A stone is an eleven-sided outline whose corners come from a seed, all within the stone's radius. Moss is 2.2 dots per cell of radius, spread evenly over a disc (the mean distance from the middle is two thirds of the radius, which a test checks over 300 seeds). Both are drawn from their seed, so they never change shape when you undo and redo.

| Limit | Value |
|---|---|
| Stones | 12 |
| Moss patches | 16 |
| Actions since the last clear | 300 |
| Path points since the last clear | 20,000 |
| Points in one stroke | 1,200 |

## Privacy and limits

Nothing is uploaded, stored or downloaded. The garden goes when you leave the page. Copy in the toolbar copies a one-line description, for example "2 rake lines, 3 stones, 2 patches of moss".

- A groove raked across a stone is drawn under the stone, because the stone sits on top of the sand. A stone placed over old grooves flattens them.
- The garden is a flat top-down view, so stones cast a short shadow and have no height in the sand.
- Moss is only for looks and does not change the sand.
