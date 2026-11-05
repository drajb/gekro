---
title: "Sort It"
category: "fun"
job: "Play a free sorting game: put each thing in the right bin, such as big or small, float or sink, fruit or vegetable, even or odd."
description: "Free sorting game for young children: big or small, float or sink, fruit or vegetable, even or odd and more, in three levels. Tap or drag. No ads. No signup."
aiSummary: "A free browser sorting game for young children. Each round is four sorting games with a star for each. A sorting game shows a tray of things and two or three bins; the player picks up a thing and puts it in the bin where it belongs, by tapping the thing and then the bin, by dragging with a mouse, or with the keyboard. The six sorting games are big or small, light or heavy, float or sink, fruit or vegetable, how an animal gets around (walks or runs, swims, flies) and even or odd. Little has four things, Middle six and Big eight or nine. The pictures are 109 hand-picked emoji, each placed in exactly one bin by hand, and items people often argue about (such as tomato, corn or an animal that clearly does two of the three, like a frog) are left out. A thing in the wrong bin stays in the tray and the player tries again. After five things in a row go in the right bin first time, the page offers the next level, and the player can decline. There are no timers and no sound. Stars and a best count per level are kept in the browser as small numbers; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part I care about is the facts: every item was chosen to keep the usual arguments about which bin it goes in out of the game."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🧺"
---

## How to play

Each sorting game shows a few things in a tray and two or three bins underneath. Put every thing in the bin where it belongs.

- **Tap:** tap a thing to pick it up (it lifts up and gets a tick), then tap a bin. The bins show "Put here" while you are holding something. Tap the same thing again to put it down.
- **Drag:** with a mouse, drag a thing and drop it on a bin. On a touch screen, use tap and tap, so that the page still scrolls normally.
- **Keyboard:** press Tab to reach the things, use the arrow keys to move between them and Enter to pick one up. Then press the bin's number (1, 2 or 3, shown on each bin), or Tab to a bin and press Enter. Escape puts the thing down again.

If the thing is in the right bin, it stays there and the game says why: "The elephant is big." If it is in the wrong bin, it simply stays where it was and you try again. Nothing is lost. Each finished sorting game earns a star, and a round is four of them. At the end you can copy a short result or play again.

Pick a level:

- **Little:** four things, two bins. Big or small, and light or heavy.
- **Middle:** six things. Big or small, float or sink, fruit or vegetable, how an animal gets around (three bins: walks or runs, swims, flies) and even or odd with numbers up to 10.
- **Big:** eight things, or nine when there are three bins. Float or sink, fruit or vegetable, how an animal gets around and even or odd with numbers up to 20.

If you put five things in a row in the right bin first time, the page offers the next level. You can say "Not now", and it asks again only after another five.

Big means bigger than you, small means it fits in your hand, and light means easy to lift with one hand. Each game prints its own hint under the question.

The pictures are emoji drawn by your own phone or computer, so they may look a little different from one device to another. Each picture also has its name written under it and read out to a screen reader.

There is no timer and no sound. A wrong bin never loses a star.

## How it works

The engine is a set of pure functions that never touch the page, so each rule is covered by tests.

- **The facts are written by hand.** There are 109 pictures in five games, each in exactly one bin: 28 for big or small, 18 for light or heavy, 17 for float or sink, 17 for fruit or vegetable and 29 for how an animal gets around. A second copy of the whole table is typed again in the test file and compared bin by bin, which catches a slip in either. Even or odd is not a list at all: the game takes the numbers 1 to 10 or 1 to 20 and the tests check each one against a bit test.
- **The usual debates are left out.** Some answers can still be argued, because many animals do more than one thing (a dog can swim, for example), so the animal game asks how the animal is most often pictured getting around. A tomato, a cucumber, a pepper, a pumpkin and corn are not in the fruit or vegetable game. A duck, a frog, a turtle and a crab are not in the animal game, because they clearly do two of the three. A dog or a cat is not in the big or small game, because it depends which one you picture. The tests check that none of these appear.
- **Fair puzzles.** Each sorting game takes the same number of things for every bin, chosen at random and shuffled. In a round, every sorting game of the level is played once before one repeats, and the same one never comes twice in a row.
- **A round is fixed by its seed.** The address of the page holds the level and a number, so the same address gives the same four sorting games with the same things.
- **Placing** returns a new state and never changes the old one. A thing in its true bin is placed for good; in a wrong bin it is counted as a slip and stays in the tray. The tests play thousands of random games and check that no thing is lost or duplicated and that every game finishes.
- **Saved data** is your all-time star count, rounds finished and the best number of slip-free sorts for each level, as small numbers in your browser's local storage. A damaged value reads as zero.

## Limits

- Everything is sorted into the bins written for that game. The sorting is simple on purpose, so some things are left out that you may think belong.
- Dragging works with a mouse or a pen. On a touch screen, tap the thing and then the bin.
- Stars live in your own browser, so they are not shared between devices, and clearing site data removes them.

Everything runs in your browser. Nothing is sent anywhere.
