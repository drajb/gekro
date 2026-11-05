---
title: "Pattern Maker"
category: "fun"
job: "Play a free pattern game: finish the row of shapes or numbers, in three levels, or build a pattern of your own."
description: "Free pattern game for young children: finish rows of shapes and number patterns in three levels, or make your own. Stars, no timer. No ads. No signup."
aiSummary: "A free browser pattern game for young children. In Finish the pattern, a row of coloured shapes has one gap and the player picks the piece that fits. Six pieces each have their own shape and colour (blue circle, red triangle, yellow square, green star, purple diamond, orange hexagon), so colour is never the only clue. Little uses two-shape patterns (AB, AAB) with the gap at the end; Middle adds three-shape patterns (ABB, ABC) and gaps in the middle; Big adds four-shape patterns (ABCD, AABB, AABC, ABBC) and number patterns that count up or down by 1, 2, 3, 5 or 10. A round is eight puzzles and each earns a star. A puzzle is only kept when exactly one piece makes the finished row repeat, so there is one correct answer. After five right first time in a row the page offers the next level. A second tab, Make my own, is a free row of up to 12 shapes that says whether it repeats. No timers, no sound. Stars and a best count per level are kept in the browser as small numbers; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The interesting part is that every puzzle is checked by the code to have exactly one right answer before it is shown."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔷"
---

## How to play

There are two tabs at the top.

**Finish the pattern.** A row of shapes (or numbers) has one empty box with a dashed blue edge. Work out what goes there and tap your answer from the choices underneath. If it is the right one, the box fills in, you get a star, and the game says in words why it fits, for example "The pattern is blue circle, red triangle, over and over." If it is not right, that choice fades and you try another. Nothing is lost, and there is always a right one left to find.

Pick a level:

- **Little:** two shapes taking turns (circle, triangle, circle, triangle) or two of one and one of the other (circle, circle, triangle). The empty box is at the end: what comes next? Three choices.
- **Middle:** patterns of three, such as one, two, two or one, two, three. Sometimes the empty box is in the middle of the row. Three choices.
- **Big:** patterns of four, such as circle, star, hexagon, diamond, and number patterns that count up or down by 1, 2, 3, 5 or 10. Four choices.

A round is eight puzzles. When you finish all eight the game cheers, says how many you got right first time, and offers **Play again** or **Copy result**. If you get five right first time in a row, it offers the next level. You can say "Not now", and it asks again only after another five.

**Make my own.** Tap shapes to build a row of up to twelve. The game tells you what it sees: "They are all the same so far", "Keep adding" or "Lovely! Your pattern repeats every 3". **Take one back** removes the last shape, **Clear** starts again, and **Copy my pattern** copies the row as words. This tab has no stars, it is just for making.

Every shape has its own colour, so you can tell the pieces apart by shape alone. Colours are also named for screen readers, as in "blue circle".

**Keyboard:** press Tab to reach the choices, use the arrow keys to move between them, and press Enter or Space to pick one. Everything in both tabs is a button, so it works without a mouse.

There is no timer and no sound. Wrong picks never lose a star.

## How it works

The engine is a set of pure functions that never touch the page, so each rule is covered by tests.

- **One right answer.** A shape puzzle is a repeating unit written out two or three times with one cell hidden. A piece fits the gap when the finished row repeats with some period of at most half its length. The generator tries all six pieces, keeps the puzzle only if exactly one fits, and builds the wrong options from pieces that fail the same test. The tests check this with a second, separately written version of the repeat test, across more than a thousand generated puzzles, and also check that the smallest repeat of every finished row is the length of its rule.
- **The rules per level** are the ones listed above and no others. The tests count which rules each level produces over many seeds and compare them with the list on this page.
- **Number puzzles** count by a steady step of 1, 2, 3, 5 or 10 (counting down only for steps up to 5), never go below zero, and hide one number that is not one of the first two. Exactly one number keeps the step steady, and the tests try every whole number from -5 to 214 to prove it.
- **A round is fixed by its seed.** The address holds the tab, the level and a number, so the same address gives the same eight puzzles. The same kind of puzzle never comes twice within two turns.
- **Choosing** returns a new state and never changes the old one. A wrong pick is remembered and cannot be picked again; a right pick finishes the puzzle. Random choosing in the tests always finishes.
- **Make my own** calls a row a pattern only when it repeats and has at least two different shapes. The tests check this against a separate version on every row of up to eight shapes over three kinds.
- **Saved data** is your all-time star count, rounds finished and the best first-time count for each level, as small numbers in your browser's local storage. A damaged value reads as zero.

## Limits

- Patterns are shapes and whole numbers only. There are no sounds, no letters and no pictures.
- The number patterns only count by steady steps. Doubling, odd and even, and growing steps are not included.
- Stars live in your own browser, so they are not shared between devices, and clearing site data removes them.

Everything runs in your browser. Nothing is sent anywhere.
