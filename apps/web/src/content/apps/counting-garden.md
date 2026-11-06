---
title: "Counting Garden"
category: "fun"
job: "Play a free counting game for small children: count the bees, flowers and butterflies in a garden and tap the number. Four levels, no timer, no sound."
description: "Free counting game for young children. Count creatures in a garden up to 5, 10 or 20, or pick the group with more or fewer. No timer, no sound. No signup."
aiSummary: "A free browser counting game for small children. Each question shows a garden scene with a number of one kind of creature (flowers, bees, butterflies, ladybirds or snails), and the child taps the number they counted. There are four levels: 1 to 5, 1 to 10, 1 to 20, and a More or fewer level that shows two groups and asks which has more or fewer. Every creature sits in its own cell of a five-column grid, and the tests recount each drawn scene to confirm it holds exactly as many creatures as its answer says. The middle and big levels add a few other creatures that must not be counted. A tap that is not the answer says Try again and whether there are more or fewer than that number, and the right answer is never shown as a failure. Each right answer plants a flower in a garden of ten plots. After five answers in a row with no second tries and no help, the game offers the next level once. There is no timer, no sound and no score to lose. Three small numbers are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The scenes are laid out on a grid so no two creatures overlap, and the tests recount every picture to make sure the answer matches what is on the screen."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🌼"
---

## How to play

Pick a level, look at the garden, and count. Then tap the number you counted.

- **Little, 1 to 5:** one kind of creature, up to five of them, and all five numbers to choose from.
- **Middle, 1 to 10:** up to ten of one kind. A couple of other creatures may wander in, so count only the kind in the question. Four numbers to choose from.
- **Big, 1 to 20:** up to twenty of one kind, with up to three other creatures mixed in. Four numbers to choose from.
- **More or fewer:** two groups side by side. The question asks which group has MORE or which has FEWER, and you tap the group.

Each right answer plants a flower in your garden. Ten flowers fill it, the plots bounce once, and the next right answer starts a new garden. There is no clock and nothing to lose. When you are ready for another question, press **Next**. Nothing moves on by itself.

If a tap is not the answer, the game says "Try again" and tells you which way to go, for example "There are more than 4" or "There are fewer than 7". That number is greyed out so you can pick another. The right answer is never shown as a failure, and a question can take as many tries as it needs.

**Help me count** puts a small number on each creature being counted, in reading order: 1, 2, 3, and so on. It is there to teach counting one by one, and using it is fine.

After five right answers in a row, with no second tries and no help, the game asks if you want to try bigger numbers. Say yes or say not now. It asks once, and asks again only after a new run of five.

Everything works with the keyboard: Tab to a number, press Enter or Space. A screen reader hears each creature as its own item ("bee", "bee", "ladybird") so it can be counted, and the game announces what happened after every tap. The pictures are emoji from your own device, so they look a little different on each phone or computer, and each one has a word for a screen reader. Holding a key down does not tap repeatedly. Motion is short and gentle, and it is switched off if your device asks for less motion.

## How it works

The engine is a handful of pure functions that never touch the page. The page draws what the engine returns, so every rule can be tested.

- **Scenes.** A scene is a grid five cells wide: 2 rows on Little, 3 on Middle, 5 on Big, and 2 for each group in More or fewer. The engine picks distinct cells at random, puts one creature in each, and nudges each one a little so the garden looks natural. Because no two creatures share a cell, none overlap.
- **The answer.** The number of creatures of the asked kind is the answer. The tests recount every scene from the drawn items, for 400 different seeds at each of the three counting levels, and the count always matches. On the counting levels the answer is also never the same as the previous question's answer.
- **Number choices.** The answer plus its nearest neighbours, sorted from small to large, with no repeats. On Little it is simply 1 to 5. On Middle and Big, the other choices always come from the five numbers closest to the answer, so the choices are plausible and never random.
- **More or fewer.** Two counts from 1 to 10 that are never equal, in two different kinds of creature. The tests check that the answer matches a second calculation, and that both "more" and "fewer" questions occur, with the answer on the left and on the right.
- **The ladder.** Only an answer with no earlier "Try again" and no help adds to the row. A "Try again" resets the row to zero. A helped answer neither adds nor resets. The offer appears at five, once, until the row is broken and built again.
- **The wording.** Every sentence the game can say is generated by tested functions, and a test scans them all for scolding words. Counts use the right singular and plural: "1 bee", "2 bees", "7 butterflies".

## Your totals

Three small whole numbers are kept in your browser's local storage under one key: flowers planted, gardens full, and your best row. They are checked when they are read, so a damaged value falls back to zero. Nothing is sent anywhere, there is no account, and the page works with storage blocked. The address of the page holds only the level you chose.

## Limits

- The game has no sound and does not read anything aloud.
- Emoji differ between devices, and a very old device may draw a creature as an empty box. The word for it is still there for a screen reader.
- There are only five kinds of creature, and the choices are numbers, not words, so a child does not need to read to play.
- The totals live in one browser. They are not shared between devices.
