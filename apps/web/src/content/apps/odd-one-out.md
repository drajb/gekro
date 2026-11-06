---
title: "Odd One Out"
category: "fun"
job: "Play a free odd one out game: find the picture that is different in colour, shape, size, number or kind, in three levels."
description: "Free odd one out game for young children: spot the different colour, shape, size, number or kind of thing in three levels, with stars. No ads. No signup."
aiSummary: "A free browser odd one out game for young children. Each puzzle shows four or six pictures and asks one question: which is a different colour, shape or size, which group of dots has a different number, or which picture does not belong (animals, vehicles, fruit, clothes or flowers, 47 emoji in all). Little shows four shapes and asks about colour, shape or size. Middle shows six pictures and adds number and kind. Big also changes the things the question is not about, at random, so the difference is harder to spot. Every colour carries a letter, so colour is never the only clue. The game only keeps a puzzle when exactly one picture is different in the way the question asks. A round is eight puzzles with a star each. After five found first time in a row the page offers the next level, and the player can decline. There are no timers and no sound. Stars and a best count per level are kept in the browser as small numbers; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the rule that a puzzle is thrown away unless exactly one picture is different, even when everything else on the screen is changing."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔍"
---

## How to play

Read the question at the top, look at the pictures, and tap the one that is different. If it is the odd one, it turns green with a tick, you get a star, and the game says in words why: "The red one is a different colour. The others are blue." If it is not, that picture fades and you try another. Nothing is lost, and the odd one is always still there to find.

Pick a level:

- **Little:** four shapes. The question is about colour, shape or size, and nothing else changes, so there is one difference to find.
- **Middle:** six pictures. The questions add how many dots are in each group (a number from 1 to 6, at least 2 apart) and what kind of thing each picture is.
- **Big:** six pictures, and the things the question is not about change at random as well. If the question is about colour, the shapes and sizes are mixed up too. Groups of dots go up to 9, and the two numbers can be just one apart.

The kinds of thing are animals, vehicles, fruit, clothes and flowers: 47 pictures in all, drawn by your own phone or computer, so they may look a little different from device to device. A question about kind always has five pictures of one kind and one of another.

A round is eight puzzles. When you finish all eight the game cheers, says how many you found first time, and offers **Play again** or **Copy result**. If you find five first time in a row, it offers the next level. You can say "Not now", and it asks again only after another five.

Each coloured shape has a letter on it (B for blue, R for red, Y for yellow, G for green, P for purple, O for orange), so the colours can be told apart without relying on how they look. Each card has a spoken label too: a screen reader says, for example, "4 green dots" or "big red triangle".

**Keyboard:** press Tab to reach the pictures, use the arrow keys to move between them, and press Enter or Space to pick one.

There is no timer and no sound. Wrong picks never lose a star.

## How it works

The engine is a set of pure functions that never touch the page, so each rule is covered by tests.

- **What counts as odd.** A picture stands out for an attribute when all the other pictures share one value and it has a different one. The generator draws a puzzle, checks every attribute, and keeps it only if the attribute the question asks about singles out exactly one picture, and no other attribute singles out any. If a Big puzzle fails, it is drawn again. The tests re-check this with a second, separately written version across more than three thousand puzzles at all three levels.
- **Little and Middle** change only the asked-about attribute, and the tests confirm that every other attribute is identical on all the cards. On Big, the tests confirm the other attributes do vary in hundreds of puzzles.
- **The pictures** are a hand-written list of 47 emoji in five categories. A second copy of the list is typed again in the test file and compared category by category, and no picture appears in two categories. There is nothing scary on the list.
- **A round is fixed by its seed.** The address of the page holds the level and a number, so the same address gives the same eight puzzles. The same question is not asked twice in a row.
- **Choosing** returns a new state and never changes the old one. A wrong pick is remembered and cannot be picked again, so a puzzle can always be finished. Random picking in the tests always finishes.
- **Saved data** is your all-time star count, rounds finished and the best first-time count for each level, as small numbers in your browser's local storage. A damaged value reads as zero.

## Limits

- There are 47 pictures, so you will see some of them often.
- Only five kinds of difference are asked about. There is no "odd one out" by letters, sounds or meaning beyond the five categories.
- Stars live in your own browser, so they are not shared between devices, and clearing site data removes them.

Everything runs in your browser. Nothing is sent anywhere.
