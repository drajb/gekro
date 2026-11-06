---
title: "Wing Hop"
category: "fun"
job: "Play a one-button flying game: tap to flap a dragonfly up through the gaps between hanging rocks and reed beds, with a calm level for the youngest players."
description: "Free Wing Hop for the browser. Tap or press Space to flap a dragonfly through reed and rock gaps. Calm, Easy, Medium and Hard levels. No signup."
aiSummary: "A free one-button browser game. A dragonfly stays at a fixed x while the world scrolls past it. Physics runs in fixed 1/60 s steps: gravity pulls, a flap sets the upward speed (it does not add up), and the fall speed is capped. The gap generator places each gap centre within 70 to 85 world units of the last one and always inside the playable range, and a test proves the worst gap-to-gap move plus the room inside a gap fits within two thirds of what the physics can climb or fall between two columns. A simulated pilot that only knows where the next gap is flies 120 gaps on 25 seeds at every level, at normal and reduced-motion pace, without a bump. Four levels: Calm (wide gaps, slow, forgiving), Easy, Medium and Hard. Best scores are kept in the browser's local storage per level; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The part I like is the promise a one-button game has to keep: every gap has to be reachable, so I wrote a pilot that plays the generated course to prove it."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🦋"
---

## How to play

A dragonfly flies across a pond by itself. You keep it in the air. Tap or click the pond, press the big **Flap** button, or press **Space**, the **Up arrow** or **W** to beat its wings and rise. When you stop, it sinks. Fly through the gap between the hanging rocks above and the reed beds below. You score one point for every column you get past.

The game waits for your first flap, so there is no rush to start.

- **Touch or mouse:** tap anywhere on the pond, or press the Flap button under it.
- **Keyboard:** Space, Up arrow or W flap. Holding a key does not flap again and again, one press is one flap.
- **Pause:** **Escape** or **P** pauses, and so does switching to another tab. The game stays paused until you press Resume, P or Space.
- **After a crash:** a short pause of half a second stops a fast tap from skipping the result, then any tap or Space gets you ready to go again.

### Levels

| Level | Scroll speed | Gravity | Gap | Distance between columns |
|---|---|---|---|---|
| Calm (little ones) | 78 | 560 | 150 | 270 |
| Easy | 95 | 760 | 124 | 250 |
| Medium | 115 | 1000 | 106 | 232 |
| Hard | 135 | 1150 | 92 | 215 |

All numbers are in the game's own units: the world is 400 wide and 300 tall, speed and gravity are per second. The harder the level, the faster the world moves, the stronger gravity pulls, and the narrower and closer the gaps.

**Calm** is for very young children. The gaps are wide, the flying is slow, and nothing ends the run. If the dragonfly bumps a rock or reed it is set back in the middle of that gap and gets one and a half seconds of safety. If it touches the water it bounces gently.

Rocks and reeds look different from each other, and you never need the colour to tell them apart: rocks hang from the top in lumpy stacks, reeds stand up from the water with cattail heads.

### Accessibility and motion

Score changes are written into the canvas label, and a message line says what happened when a run ends and at every ten gaps. When you ask your device for reduced motion, the world scrolls 20 percent slower, and the hills, ripples and wing flutter stop moving. Nothing flashes. There is no screen shake. There is no sound.

## How it works

The engine is a pure function: `step(state, flap, rng)` advances the game by exactly one 1/60 second and returns a new state. The page runs it from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor fly the same course, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

- **Flap.** A flap sets the upward speed to a fixed value. Pressing twice in a row does not make a bigger jump. On Medium one flap lifts the dragonfly about 39 units, which the tests check against the formula for a ball thrown upward.
- **Fall.** Gravity is added every step and the fall speed is capped, so a long fall stays controllable.
- **Hits.** The dragonfly is a circle. Each column is two rectangles, the rock above and the reeds below. The hit test is the standard circle-versus-rectangle test, and the suite checks it against a sampled brute-force version on thousands of random cases. The art is drawn slightly inside what you can touch, so a graze never feels unfair.
- **Gaps.** Each gap is centred no more than 70 to 85 units above or below the one before (70 on Calm and Hard, 80 on Easy, 85 on Medium) and always keeps clear of the ceiling and the water.

**Why every gap can be reached.** The tests work out, using the same integrator the game uses, the best height a flapping rhythm can climb and the distance a free fall covers in the time between two columns. The biggest allowed jump between gap centres, plus the room inside a gap, times 1.5 must still fit in both. That holds for every level, also at the slower reduced-motion pace.

That is a bound, not a play-through, so the suite also flies it. A simple simulated pilot that knows only where the middle of the next gap is, and nothing about how the generator works, flies 120 gaps on 25 different seeds on every level, at normal and slower pace, without ever bumping a rock, a reed or the water. A pilot that ignores the gaps and just hovers does not get far, so the check can fail.

A seed replays exactly: the same random numbers and the same flaps give the same flight, and a different seed gives a different course. The page takes its random numbers from the browser's secure random source.

## Privacy and storage

Nothing is uploaded and there is no account. Your best number of gaps for each level (and for the slower pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level so you can share it. Clearing site data removes the scores.

## Limits

- One course style: rocks above, reeds below. No power-ups, no coins and no sound.
- Calm never ends by itself, so its best is saved when you press Restart or change level. On the other levels a run you leave with Restart or a level change counts too, because the gaps were really flown.
