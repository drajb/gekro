---
title: "Bubble Wrap"
category: "fun"
job: "Pop a sheet of bubbles by tapping or sliding across it, with soft optional sound, no score and no pressure."
description: "Free pop-the-bubbles toy. Tap or slide to pop a sheet, three sizes, zen mode, optional quiet sound, safe flashing. No score, no timer. No signup."
aiSummary: "A free browser toy. A sheet of bubbles in three sizes (5 by 7, 6 by 9 or 8 by 12) is popped by tapping a bubble, by pressing and sliding across the sheet, or with the arrow keys and Enter or Space. When the last bubble is gone a fresh sheet replaces it. There is no score to beat, no timer and nothing to lose. A touch is turned into a column and row by dividing by the cell size, and a quick slide pops every bubble on a straight line of cells between two pointer events. Each bubble has its own pitch from a seeded generator; the pop sound is a 70 millisecond falling sine tone, off by default and never louder than 0.1 gain. The little light ring on a pop goes through a limiter that allows at most 3 per second, checked by tests on random timings, and nothing loops. Zen mode hides the counters. Two running totals are kept in local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The part I like is the rate limiter: a short function that proves, on thousands of random timings, that no second of play ever holds a fourth flash."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🫧"
---

## How to play

Pop the bubbles. That is all there is to it.

- **Tap** a bubble to pop it. A popped bubble goes flat and shows a dashed ring, so you can tell it from a whole one without relying on colour.
- **Slide.** Press and drag across the sheet to pop a whole row at a time. If your finger moves faster than the page can follow, every bubble on the straight line between the two points still pops. With a mouse this always works. On a touch screen, **Slide to pop** starts off, because sliding stops the sheet from scrolling the page; turn it on to slide, and scroll by dragging outside the sheet. With it off, a tap pops the bubble when your finger lifts, so a swipe that scrolls the page pops nothing.
- **Sizes.** Large bubbles (35 on a sheet), Medium (54) and Small (96). Choosing a size gives you a fresh sheet.
- **Fresh sheet.** When the last bubble pops, the sheet glows for a moment and a new one appears by itself. New sheet swaps it at any time.
- **Zen mode** hides the counters, so there is nothing to count at all. The totals are still kept quietly on your device.
- **Sound** is off until you turn it on. A pop is a very short, quiet falling tone, and every bubble has its own note. A finished sheet plays three soft rising notes. Sound pauses when you switch to another tab and picks up again when you come back.

**Keyboard.** Tab to the sheet, then move between bubbles with the arrow keys (Home and End jump to the ends of a row, with Shift to the ends of the sheet). Enter or Space pops the bubble, and focus moves on to the next whole bubble, so you can keep popping with one key. On a bubble that is already popped, the status line says "Already popped" and focus still moves on. The status line says how many are left, and says "Halfway there" and "Five left" on the way. Each bubble has a label such as "Row 2, column 3, whole".

**Light and motion.** Nothing flashes more than 3 times a second. A pop squashes the bubble once and, at most three times a second, shows a faint ring. Nothing moves in a loop. If your device asks for reduced motion, there is no squash and no ring at all, and the fresh-sheet fade is left out.

## How it works

**The sheet.** A sheet is a grid with one flag per bubble. Each bubble also gets a pitch from 0 to 4, drawn from a seeded generator, and the sheet gets one of six colours from its seed. The same seed always gives the same sheet, which a test confirms.

**Finding the bubble.** Where you touch is turned into a share of the sheet's width and height, then into a column and row by dividing by the cell size. The whole cell counts, gaps included, so a near miss still pops. A test compares this with a brute-force search that walks every cell rectangle, on 4,000 random points per size and on every cell edge, and the two agree every time. A point outside the sheet, or not a number, finds nothing.

**Fast slides.** Pointer events can arrive a few cells apart. The engine draws a straight line of cells between the last bubble and the new one and pops them all. A test checks over 1,500 random pairs that the line includes both ends, has no repeats, has exactly as many cells as the larger of the two distances plus one, and that every step moves to a neighbouring cell, so no bubble on the path is skipped.

**Safe flashing.** The light ring and the sound both go through a small rate limiter. It remembers when it last allowed an event and refuses a new one if the window of the last second is already full. For the ring the limit is 3, and for the sound 14. The tests ask the limiter every 10 milliseconds for ten seconds and get exactly 30 rings, and on 400 random and bursty timings they check that no window of one second ever holds more than three. A bad or backwards clock lets nothing through.

**Sound.** One sine oscillator per pop, falling from the bubble's note to about a third of its pitch over 70 milliseconds, with a gain no higher than 0.1. The sound is created only after you press the sound button. There are no sound files.

| Fact | Value | Checked by |
|---|---|---|
| Sheet sizes | 35, 54 and 96 bubbles | constant test |
| Bubble under a touch | matches brute force | 4,000 points per size plus every edge |
| Slide path | no gaps, no repeats | 1,500 random pairs |
| Light ring | at most 3 in any second | random and saturated clocks |
| Pop sound | 70 ms, gain at most 0.1 | tone test |
| Saved | two whole numbers | sanitiser tests |

## What is stored

Two running totals: bubbles popped (up to 999,999) and sheets finished (up to 9,999), in your browser's local storage as a small object. Anything else found there is ignored: the loader reads only those two keys, accepts only whole numbers in range, and builds a new object. Nothing is sent anywhere, and the page works if storage is blocked. Clearing site data resets the totals.
