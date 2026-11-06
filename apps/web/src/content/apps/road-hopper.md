---
title: "Road Hopper"
category: "fun"
job: "Play a hopping game: guide a hedgehog across lanes of cars, vans and bikes, and later a stream of stepping stones, to its burrow at the top of the meadow."
description: "Free Road Hopper for the browser. Hop a hedgehog across busy lanes to its burrow with arrows, swipes or buttons. Calm to Busy levels. No signup."
aiSummary: "A free browser game on a 7 x 9 grid. A hedgehog hops one cell per tap, swipe or key press from the bottom row to a burrow in the top row, across road lanes of cars, vans and bikes and, from level 3 on Normal, a stream where only stone cells are safe. Traffic is periodic: each lane's speed is a whole number of laps per cycle, so the whole picture repeats exactly every 7.5 to 14 seconds. Before a level is shown, a backward search over every (time slot, row, column) state, about six slots per second of cycle, proves the burrow can be reached from the start cell at every possible moment; failing layouts are thrown away. An independent forward search with its own densely sampled traffic agrees on every tested level, and a hedgehog following the found path through the real engine reaches the burrow without losing a heart. Three hearts, none in Calm. A row scores once per level, a burrow scores 10. Best scores are kept in the browser's local storage per difficulty; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The part I wanted to get right is that waiting for a gap always works, so I made the traffic repeat on a timetable and let a search prove a way across exists before the level is shown."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🦔"
---

## How to play

The hedgehog starts at the bottom. Your job is to get it to the burrow, the dark hole in the top meadow. Between you and the burrow are roads with cars, vans and bikes, and sometimes a stream where only the stone cells are safe. The game waits for your first hop.

- **Keyboard:** the arrow keys or **W A S D** hop one cell. One key press is one hop; holding a key does not repeat. **Space** or **P** pauses and resumes, and **Escape** pauses.
- **Touch or mouse:** use the four big buttons next to or under the picture, or swipe on the picture to hop that way. A plain tap on the picture hops up.
- **Pause:** switching to another tab pauses the game too.

Hops come at most ten times a second. If you press faster, up to three hops wait their turn, so nothing teleports.

You have three hearts. If a vehicle runs over the hedgehog's cell, or a hop lands on a stream cell with no stone, the hedgehog curls into a ball and rolls back to the start, and you lose one heart. When the last heart goes, the run ends and you see your level and score. In **Calm** there is no heart limit and no run end.

Every row you reach for the first time in a level scores 1, and a burrow scores 10. Going back and forth does not score twice, and neither does climbing again after a heart is lost. After a burrow, the next level starts at the bottom.

### Levels

| Level | Roads | Stream | Traffic cycle | Vehicles per lane (at most) |
|---|---|---|---|---|
| Calm (little ones) | 3, always | never | 14 s | 2, with wide gaps |
| Normal | 3, growing to 5 by level 5 | 1 from level 3, never more (five roads leave room for one) | 12 s, getting 0.4 s shorter each level, down to 8.5 s | 2, then 3 at level 4, 4 at level 8 |
| Busy | 4, growing to 6 by level 5 | 1 on levels 2 to 4, none from level 5 (six roads fill every free row) | 10 s, down to 7.5 s | 3, then 4 at level 5 |

From level 4 on Normal (level 2 on Busy), some lanes run at double speed. Nothing changes after level 12, though the level number keeps counting. The middle row (row 5 from the top) is always safe grass, a place to stop and look.

Cars are 1.3 cells long, vans 2 and bikes 0.7, so you can tell them apart by size and shape as well as colour. Whatever the colour, every vehicle is dangerous.

### Accessibility and motion

The hop buttons have names such as "Hop up", the canvas label reads out the level, score and hearts, and a message line says what happened after each hit, splash and burrow. When you ask your device for reduced motion, the traffic runs 20 percent slower, hops are instant instead of arcing, and the curl-up and the level banner are still pictures. Nothing flashes and there is no screen shake. There is no sound.

## How it works

The engine is a set of pure functions: `step(game, hop, rng)` advances the game by one 1/60 second. The page feeds it whole steps from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor play the same game, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

**Traffic.** Each road lane is a circular track 10 to 13 cells long, longer than the 7 visible columns, so vehicles leave one side and come back on the other. Each lane runs a whole number of laps (one or two) per cycle, so the speed is laps times track length divided by cycle time, and after one cycle every vehicle is exactly where it started. A vehicle hurts the hedgehog when it overlaps the middle of the cell, which is the cell shrunk by 0.15 on each side. The overlap test looks at the whole stretch a vehicle sweeps during a step, so even a fast bike cannot skip over a cell between two steps.

**Proof that a way across exists.** Time is cut into slots, six per second of cycle, 45 to 84 in all. A state is a time slot, a row and a column. From a safe cell the hedgehog can stay or hop to a neighbour at the next slot. The generator runs the search backwards from the burrow, wrapping time round, and keeps a layout only if the start cell can reach the burrow from every one of the slots. A cell counts as busy if a vehicle touches it during the slot or within 30 ms either side. If a random layout fails, another is drawn; after many failures the layouts get emptier, so a level always comes out.

**What the tests check.** An independent check lives in the test suite. It rebuilds the traffic with its own code, without sweeping: it samples every vehicle's position 200 times a second. It confirms the engine is never less careful than that sampling, and finds that it is more careful in under 2 percent of cases. Then it runs its own forward breadth-first search from the start cell at several start moments on each of 120 generated levels, on all three difficulties, and always finds a way across. Finally, it follows a found path through the real engine, hopping at the right steps, on every difficulty at levels 1, 5, 9 and 12: the hedgehog reaches the burrow each time without losing a heart. A deliberately blocked lane, with one vehicle as long as its whole track, is correctly rejected.

Given the same random numbers a game replays exactly. The page takes its random numbers from the browser's secure random source.

## Privacy and storage

Nothing is uploaded and there is no account. Your best score for each level setting (and for the slower pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level setting so you can share it. Clearing site data removes the scores.

## Limits

- One grid size, 7 x 9, one hedgehog, and no sound or power-ups.
- Changing the level setting or pressing Restart ends the run in progress. The score so far still counts toward your best, since those rows were really crossed.
- Calm never ends by itself, so its best is saved when you press Restart or change the level setting.
