---
title: "Shape Sorter"
category: "fun"
job: "Play a free sorting game for small children: tap a shape, then tap the hole where it belongs. Sort by shape, colour or size. No timer, no sound."
description: "Free shape sorting game for young children. Sort pieces by shape, colour or size into the right holes. Gentle, with no timer, no sound and no ads. No signup."
aiSummary: "A free browser sorting game for small children. Each round shows a tray of pieces and a row of holes. The child taps a piece, then taps the hole it belongs in. They can sort by shape (circle, square, triangle, star, heart, hexagon), by colour (blue, green, yellow, red, purple, orange) or by size (small, medium, big), with two, three, four or six kinds to sort at a time; size has at most three. A round has kinds plus two pieces, every hole gets at least one piece, and every piece has exactly one right hole, which the tests confirm against a second statement of the rule. A tap on the wrong hole says Try again and what to look at, and the piece stays picked up. Nothing needs dragging. Finishing a round puts a star on a shelf of five. After five pieces in a row at the first try, the game offers more kinds to sort, once. Each colour also has its own small mark so colour is never the only clue. There is no timer and no sound. Three small numbers are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The shapes are drawn from plain coordinate lists, and the tests check that every round has a right answer for every piece and a piece for every hole."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔷"
---

## How to play

Choose what to sort by at the top: **Shape**, **Colour** or **Size**. Choose **How many kinds**: 2, 3, 4 or 6. Then tap a piece to pick it up. It lifts and glows, and the holes light up. Tap the hole it belongs in. Tap the same piece again if you want to put it back.

- **Shape.** The holes are outlines of shapes, with the shape's name under each. Pieces come in a few colours, but the colour does not matter here.
- **Colour.** The holes are boxes in the six colours, with the colour's name under each. Pieces come in a few different shapes, which do not matter here.
- **Size.** The holes are small, medium and big boxes. All the pieces are the same shape and the same colour in a round, so the only thing to look at is size. Size has at most three kinds, so choosing 4 or 6 gives you three sizes.

If a piece goes in a hole it does not belong in, the game says "Try again" and what to look at (the shape, the colour or the size). The piece stays in your hand so you can tap another hole. It does not cost you a star. When a piece goes in, it appears in the hole and the game says what went where: "Yes! The red star goes in the star hole."

When the last piece is away, you earn a star on your shelf. Five stars fill the shelf, and the next round starts a new one. Press **Next round** when you are ready. Nothing moves on by itself.

After five pieces in a row go to the right hole at the first try, the game offers more kinds to sort. You can say yes or not now. It asks once, and asks again only after a new run of five.

**Colour is never the only clue.** Each of the six colours has its own small mark on top of it, shown whenever you sort by colour: a dot for blue, a plus for yellow, a bar for red, a diamond for purple, a wave for green and a cross for orange. Holes carry the same mark and also the colour's name. Everything works with the keyboard: Tab to a piece or a hole, press Enter or Space. A screen reader hears each piece named ("red star") and each hole with how many pieces are in it. Holding a key down does not tap repeatedly. Motion is short and gentle, and it is switched off if your device asks for less motion. There is no dragging anywhere, which keeps the game easy for small hands.

## How it works

The engine is plain data and a few pure functions. The page draws what the engine returns.

| Level | Kinds (holes) | Pieces |
|---|---|---|
| Two | 2 | 4 |
| Three | 3 | 5 |
| Four | 4 | 6 |
| Six | 6 | 8 |

- **A round is never impossible.** For every mode and level, the tests build 300 rounds and check that each piece has exactly one hole that fits it, using a table written separately from the engine, and that every hole is wanted by at least one piece. Holes are all different. The number of pieces is always the number of kinds plus two.
- **What varies.** In shape mode the colours vary over three (blue, yellow, red) and every piece is the big size. In colour mode the shapes vary over three (circle, square, triangle). In size mode one shape and one colour are chosen for the whole round. This keeps the thing being sorted by the easiest thing to see.
- **A tap on a hole** returns a new game state. A hole that does not fit counts one miss and changes nothing else. A piece that is already away, a piece or hole that does not exist, or a finished round is ignored, and the very same game is returned. Random play of thousands of taps never breaks these rules and always finishes.
- **The ladder.** Only a piece that went in with no earlier "Try again" adds to the row. A "Try again" resets the row to zero. The offer appears at five, once, after the round finishes. It is not offered at six kinds, or at three sizes.
- **The drawings.** Each shape is a short list of coordinates in a 100 by 100 box. The tests check that every coordinate sits between 4 and 96 so an outline is never cut off, that the triangle, hexagon and star have 3, 6 and 10 corners, and that the star's points really alternate between a long and a short radius. The six colour marks are different from each other, and the tests check that they are drawn near the middle of the 100 by 100 box.

## Your totals

Three small whole numbers are kept in your browser's local storage under one key: rounds sorted, shelves full and your best row. They are checked when they are read, so a damaged value falls back to zero. Nothing is sent anywhere, there is no account, and the page works with storage blocked. The address of the page holds only the mode and the number of kinds.

## Limits

- There is no sound and no dragging. You tap a piece and then a hole.
- The six colours are mixes of the site's four accent colours, so the names (blue, green, yellow, red, purple, orange) are the closest everyday words, not exact paint names.
- Size mode shows the sizes as sizes only in the tray and the holes. Pieces already placed are shown at one small size.
- The totals live in one browser. They are not shared between devices.
