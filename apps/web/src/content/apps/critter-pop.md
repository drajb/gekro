---
title: "Critter Pop"
category: "fun"
job: "Play a 30-second tapping game: bunnies, owls, hedgehogs and foxes peek out of nine holes in a meadow, and you pop each one back down before it hides."
description: "Free Critter Pop for the browser. Tap critters as they peek out of nine holes. Three levels, a calm Little ones level, keyboard and touch play. No signup."
aiSummary: "A free browser game on a 3 x 3 grid of holes. A round lasts 30 seconds of game time, run in fixed 25 ms ticks so every screen plays the same round. A spawn scheduler puts a critter (bunny, owl, hedgehog or fox) in a random empty hole: at most one per hole, never the same kind twice in a row, a hole rests 700 ms after a critter leaves it, nothing appears in the last 0.4 seconds, and each level caps how many are up at once. The time a critter stays up shrinks linearly through the round from 3.4 to 2.6 s (Little ones), 2.0 to 1.3 s (Middle) or 1.4 to 0.85 s (Big). A tap is turned into a hole by dividing the board into a 3 x 3 grid, so a tap in a gap still counts for the nearest hole. Score is critters popped; taps on empty holes cost nothing. The best round for each level is kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is how little a tap game needs: a scheduler with a handful of rules, and a grid that turns any touch point into exactly one hole, so a tap that lands a little off still counts."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🐰"
---

## How to play

Press **Start** or tap the meadow. Critters peek out of the nine holes one after another. Tap a critter to pop it back down and score a point. A round lasts 30 seconds, and then you see how many you popped and which kind you popped most.

Nothing bad happens when you tap an empty hole, and nothing bad happens when a critter hides by itself. There is no lives counter and no losing, only a number to beat.

- **Touch or mouse:** tap or click anywhere on a hole. Taps in the small gaps between holes count for the nearest hole, so a tap a little off still pops.
- **Keyboard:** the arrow keys move between holes, **Enter** or **Space** pops the hole you are on, and the number keys **1** to **9** pop a hole directly (1 is the top left hole, 9 the bottom right, in reading order).
- **After a round:** the result stays on screen for at least 0.7 seconds, so fast tapping at the end cannot start a new round by accident. Then tap, or press **Space** or **Enter**, to play again.
- **Pause:** **Escape** or **P** pauses, and so does switching to another tab. Tap the screen, press **Resume** or press **P** again to carry on. A paused game is covered by a message so you cannot lose time by accident.

### Levels

| Level | Time a critter stays up | Most up at once |
|---|---|---|
| Little ones | 3.4 s shrinking to 2.6 s | 1, then 2 after 20 s |
| Middle | 2.0 s shrinking to 1.3 s | 2, then 3 after 15 s |
| Big | 1.4 s shrinking to 0.85 s | 2, then 3 after 8 s, then 4 after 20 s |

**Little ones** is the calm level for very young children. Critters stay up longest, only one or two appear at a time, and the board is wider so the holes are larger on a big screen. On a small phone the holes still fill the width and are never smaller than 56 pixels.

Four kinds of critter appear: a bunny with long ears, an owl with ear tufts, a hedgehog with spikes and a fox with pointed ears. Each has its own shape as well as its own colours, so you never need the colour to tell them apart.

### Accessibility and motion

Each hole is a button with a label such as "Hole 6, row 2 column 3, owl is up, press to pop", and a message line announces the start, pause and end of each round. When you ask your device for reduced motion, critters simply appear and disappear instead of sliding, the +1 does not rise, and the round runs about 25 percent slower, so critters stay up and arrive less often. Nothing flashes. There is no sound.

## How it works

The engine is a set of pure functions with no page attached. `tick(state, 25 ms, rng)` moves the round forward by one tick and returns a new state. The page feeds it whole ticks from a fixed-step clock, so a 30 Hz phone and a 144 Hz monitor play the same round, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

The spawn scheduler follows these rules, and the tests check every one of them on every tick of thousands of simulated rounds, for all three levels, at normal pace and at the slower reduced-motion pace, and against three kinds of player (one who does nothing, one who pops everything at once and one who taps at random):

- at most one critter per hole;
- at most the level's number of critters up at once;
- a hole stays empty for 700 ms after a critter leaves it, popped or not;
- a new critter is never the same kind as the one before it;
- nothing appears in the last 400 ms of the round;
- the first critter appears after exactly 600 ms.

Time a critter stays up shrinks in a straight line from the start value to the end value over the 30 seconds, so the round gets quicker gently and never faster than the floor for the level. Every critter is accounted for: the number spawned always equals the number popped plus the number that went down by themselves plus the number still up.

**Hit testing.** The board is cut into a 3 x 3 grid. A press at position (x, y) on a board w wide and h tall is in column floor(3x/w) and row floor(3y/h), so every point belongs to exactly one hole and there are no dead zones. The test suite sweeps every pixel of four different board sizes and checks that each point lands inside its own cell and that each hole gets about a ninth of the area.

**One input path.** A pointer press is turned into a hole by that grid. The buttons themselves only act on keyboard or assistive-technology clicks, so a touch never pops twice.

Given the same random numbers a round replays exactly, and a different seed gives a different round. The page takes its random numbers from the browser's secure random source.

## Verified figures

| Check | Result |
|---|---|
| Round length | 1200 ticks of 25 ms, exactly 30 seconds |
| Perfect player, one pop per critter | score always equals critters spawned, and stays under 100 |
| Player who does nothing | 0 points, every critter goes back down |
| Frame rates 30, 60, 144, 240 Hz | 400 ticks in 10 seconds, within 1 |

## Privacy and storage

Nothing is uploaded and there is no account. The best number of pops for each level (and for the slower pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level so you can share it. Clearing site data removes the scores.

## Limits

- One board size, 3 x 3, and a fixed 30-second round.
- No sound, no power-ups and no multiplayer.
- Changing the level or pressing Restart ends the round in progress without saving it. Only a finished round can set a best.
