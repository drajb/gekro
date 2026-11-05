---
title: "Make Ten"
category: "fun"
job: "Play a free number bonds game for small children: find the number that fills the frame to make 5, 10, 20 or 100. A Learn tab shows every bond."
description: "Free number bonds game for young children. Fill a ten-frame to make 5, 10, 20 or 100, or learn every pair. No timer, no sound, no ads. No signup."
aiSummary: "A free browser number bonds game for small children. The game shows a number with that many counters in a frame, and the child taps the partner number that makes the target. The targets are 5, 10, 20 and 100; Make 100 uses whole tens and each frame cell is worth ten. There are always four choices (all four numbers on Make 5), and exactly one of them completes the bond. A tap that is not it fills the frame with that many counters, then says the real sum and whether to try a bigger or smaller number. A Learn tab lists every bond for the chosen target: 4 for Make 5, 9 for Make 10, 19 for Make 20 and 9 for Make 100. A row of ten stars is the progress. After five answers in a row with no second tries, the game offers the next target once. There is no timer and no sound. Three small numbers are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The frame is drawn from the same function the tests use to count the counters, so what you see always adds up to the target."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔟"
---

## How to play

A number bond is two numbers that add up to a target. The game shows you one of them as counters in a frame, and an equation with a gap, such as 7 + ? = 10. Tap the number that fills the rest of the frame.

Choose a target at the top:

- **Make 5:** the numbers 1 to 4. A frame of 5.
- **Make 10:** the numbers 1 to 9. A frame of 10, in two rows of five.
- **Make 20:** the numbers 1 to 19. Two frames of 10, stacked.
- **Make 100:** whole tens, 10 to 90. A frame of ten cells where each cell is worth ten.

You get four numbers to choose from (all four on Make 5). Exactly one of them completes the bond. When you tap it, the empty cells fill with a green ring, the gap in the equation shows the answer, and the game says it out loud as text: "Yes! 7 and 3 make 10."

If you tap a number that is not it, nothing is lost. The frame shows that many counters in a dashed red ring, and the game tells you the real sum and which way to go: "7 and 2 make 9. Not 10 yet. Try a bigger number." or "7 and 5 make 12. That is more than 10. Try a smaller number." That number is greyed out so you can try another. When the tried number is too big, the frame also gets a red border so you can see it overflowed.

Press **Next** for another question. Nothing moves on by itself. The same number is never shown twice in a row. Each right answer lights a star in a row of ten. When the row is full the stars bounce once, and the next right answer starts a new row.

After five right answers in a row, with no second tries, the game offers the next target. Say yes or say not now. It asks once, and asks again only after a new run of five.

The **Learn** tab lists every bond for the target you chose, one card each, such as "3 + 7 = 10" with a strip of dots that shows the two parts. Both orders are there, so 3 + 7 and 7 + 3 each have a card.

Everything works with the keyboard: Tab to a number, press Enter or Space. A screen reader hears the question, what the frame shows ("Frame of 10: 7 apples and 3 empty places.") and what happened after every tap. The counters are emoji from your own device, so they look a little different on each phone or computer. Holding a key down does not tap repeatedly. Motion is short and gentle, and it is switched off if your device asks for less motion.

## How it works

The engine is a handful of pure functions that never touch the page. The page draws what the engine returns.

| Target | Numbers asked | Frame cells | Frame rows | Learn cards |
|---|---|---|---|---|
| 5 | 1 to 4 | 5 | 1 | 4 |
| 10 | 1 to 9 | 10 | 2 | 9 |
| 20 | 1 to 19 | 20 | 4 | 19 |
| 100 | 10, 20, ... 90 | 10 (worth ten each) | 2 | 9 |

- **The sums are exact.** For every target and 400 different seeds, the number shown and the answer add up to the target. A brute-force search over all pairs from 0 to the target gives the same list of legal numbers, and over many seeds every legal number does get asked.
- **Exactly one choice is right.** For each question, the tests go through the choices and check that exactly one makes the target, and none of the others does. The choices are all different, sorted from small to large, and the other choices always come from the five numbers nearest the answer, so they look plausible.
- **The frame counts.** The frame function returns one state per cell: given, empty, tried or filled. The tests add up the value of the given cells independently, and it always equals the number shown. After a right answer, given plus filled cells add up to the target. After a try, the tried cells never exceed the empty ones, and anything left over is counted as overflow.
- **The wording is true.** The sentence after a try always states the real sum, and it says "bigger" exactly when the sum is below the target and "smaller" exactly when it is above. The tests check this for every possible tap on every target.
- **The ladder.** Only an answer with no earlier "Try again" adds to the row. A "Try again" resets the row to zero. The offer appears at five, once, until the row is broken and built again, and never at Make 100.
- **Learn.** The bond list equals the brute-force list, each bond once, and the reverse of every bond is also listed.

## Your totals

Three small whole numbers are kept in your browser's local storage under one key: bonds found, rows of stars filled, and your best run. They are checked when they are read, so a damaged value falls back to zero. Nothing is sent anywhere, there is no account, and the page works with storage blocked. The address of the page holds only the target you chose.

## Limits

- There is no sound and nothing is read aloud.
- Make 100 works in tens only. It does not ask for pairs such as 37 and 63.
- The bonds are addition only. There is no subtraction or missing-first-number mode.
- The totals live in one browser. They are not shared between devices.
