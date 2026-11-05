---
title: "Soft Landing"
category: "fun"
job: "Play a gentle landing game: fly a small craft down over hills and touch down softly on the flat pad, using Thrust, Left and Right and the fuel you have."
description: "Free Soft Landing for the browser. Land a small craft on a flat pad with Thrust, Left and Right. Calm to Hard levels, touch and keyboard. No signup."
aiSummary: "A free browser landing game. A craft with a fixed 1/60 s physics step (gravity, wind, a main thruster along its up axis, and either tilt steering or a sideways slide) descends over generated ground that always contains a flat pad of exactly the stated width, from 120 units on Calm down to 40 on Hard. A landing is soft when both feet are on the pad and falling speed, sideways speed and tilt are at or under the limits shown (inclusive; tested one step either side of every limit). A simulated autopilot that only knows where the pad is lands 30 seeded levels at each of the ten landing numbers on every difficulty, at normal and slow-motion pace, using at most 65 percent of the fuel. Each soft landing scores 50 plus up to 50 for fuel left, and the next landing is a little harder. Best scores are kept in the browser's local storage per difficulty; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. What I like is that the promise can be tested: I wrote an autopilot that has to land every generated level, so a landing is never impossible."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🚀"
---

## How to play

A small craft drifts down towards a flat landing pad. Hold **Thrust** to slow the fall, use **Left** and **Right** to steer, and touch down with both feet on the pad. Falling is free; Thrust and steering use fuel. The game waits for your first press, so there is no rush to start.

- **Touch or mouse:** hold the three big buttons under the picture. You can hold Thrust and a side button at the same time. If your finger slides off a button the thruster stops.
- **Keyboard:** hold **Space**, the **Up arrow** or **W** for Thrust, the **Left** and **Right arrows** or **A** and **D** to steer. A key held down is one press, it does not repeat.
- **Pause:** **Escape** or **P** pauses, and so does switching to another tab. All thrusters switch off when the game pauses, and if the window loses focus any held thruster is let go, so nothing is left firing.
- **Next landing:** after a result, press Thrust, Space or the Next landing button. A half-second pause stops a held button from skipping the result.

### What counts as a soft landing

Both feet on the pad, and all three numbers under the limits shown above the buttons: falling speed, sideways speed and tilt. Exactly at a limit still counts. Each number has the word OK or "too much" next to it, so you never have to judge a colour.

| Level | Steering | Gravity | Pad | Wind | Falling | Sideways | Tilt |
|---|---|---|---|---|---|---|---|
| Calm (little ones) | slides sideways, no tilt | 16 | 120 wide, to 100 | none | 60 | 40 | none |
| Easy | tilts, levels itself strongly | 22 | 100, to 80 | 0.8 | 46 | 30 | 20 degrees |
| Medium | tilts, levels itself a little | 28 | 70, to 50 | 3 | 36 | 22 | 11 degrees |
| Hard | tilts, no levelling | 34 | 50, to 40 | 4 | 28 | 16 | 7 degrees |

The pad width is in the game's own units (the world is 400 wide and 300 tall); wind and gravity are pushes per second.

**Calm** is for very young children. Steering slides the craft sideways and keeps it upright, the pad is wide and there is no wind. If the craft crashes you just try the same landing again and your score is not touched.

On the other levels a crash ends the run and shows your total. Each soft landing scores 50 points plus up to 50 for the fuel you have left. After every landing the next one is a little harder: gravity is 2 percent stronger, wind 5 percent stronger and, every third landing, the pad is one step narrower. This stops at landing 10.

Fuel is enough for about 15 seconds of continuous Thrust on Calm, 25 on Easy, 21 on Medium and 19 on Hard. Steering costs a quarter as much as Thrust.

### Accessibility and motion

The readouts under the picture show falling speed, sideways speed, tilt, height above the pad, wind and fuel as plain numbers. A message line says what happened after each landing or crash and when fuel is low. When you ask your device for reduced motion, the physics runs at 80 percent speed (and burns fuel 80 percent as fast per step, so a flight costs the same fuel), the flame stops flickering, the stars stop twinkling and the landing celebration is a still picture. Nothing flashes and there is no screen shake. There is no sound.

## How it works

The engine is a pure function: `step(craft, controls)` advances the flight by one 1/60 second. The page runs it from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor fly the same landing, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

- **Forces.** Gravity pulls down. Wind pushes sideways with a smooth swing (a sine wave). Thrust pushes along the way the craft is pointing, so a tilted craft moves sideways. Left and Right turn the craft; on Easy and Medium a spring pulls it back upright, on Hard nothing does, and in Calm there is no turning at all.
- **Energy.** With the thrusters off and no wind, the energy of a fall (half the speed squared minus gravity times height) stays almost constant. The tests allow a drift of under one percent of the energy scale of the fall, on every level.
- **The ground.** Forty-one height points, 10 units apart, built from two sine waves plus noise, then flattened into a pad of exactly the level's width and limited so that no step between points is steeper than 16 units. The craft starts 50 to 160 units to one side of the pad (closer only when the pad is near the edge of the world).
- **Touching down.** The craft has two feet and two shoulders. Touching the ground with a shoulder is always a crash. Otherwise the game checks both feet are on the pad and the three speeds against the limits. The tests check each limit one tiny step either side, in both directions.

**Why a landing is never impossible.** The suite includes an autopilot that sees only the craft's speed and tilt and where the pad is. It hovers above the pad's height, lines up and kills the sideways drift, then comes down along a braking curve. It lands 30 generated levels at each of the ten landing numbers on every difficulty, at normal and at slow-motion pace, and never uses more than 65 percent of the fuel. A craft that never fires its engine crashes on every level, and a random button-masher almost never lands on Hard, so the check can fail.

Given the same level and the same controls a flight replays exactly. The page takes its random numbers from the browser's secure random source.

## Privacy and storage

Nothing is uploaded and there is no account. Your best total score for each level (and for the slow-motion pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level so you can share it. Clearing site data removes the scores.

## Limits

- One picture style, no sound and no power-ups.
- Changing the level or pressing Restart ends the run in progress. The total so far still counts toward your best, since those landings were real.
- Calm never ends by itself, so its best is saved after every landing.
