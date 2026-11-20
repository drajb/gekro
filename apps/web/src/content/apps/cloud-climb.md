---
title: "Cloud Climb"
category: "fun"
job: "Play an endless climbing game: steer a bouncing blob left and right from cloud to cloud and see how high you can get."
description: "Free Cloud Climb for the browser. A blob bounces up through the sky and you steer it onto clouds. Sliding, crumbling and spring clouds. No signup."
aiSummary: "A free browser climbing game. A blob bounces by itself and the player only steers left and right across a screen that wraps at the sides. Physics runs in fixed 1/60 s steps: gravity 1300, an ordinary bounce of 640 units a second (about 158 units high) and a spring bounce of 1000 (about 385 high). The blob lands only while falling, so it passes up through clouds. Clouds can be plain, sliding, crumbling after one bounce, or springs. The generator never puts a gap above 120 units (under four fifths of a bounce), never makes more than two crumbling clouds in a row, keeps the clouds that stay within 133 units of each other, and keeps every sideways step within what the blob can cover in the air. A test plays a planner that tries each possible next cloud on a copy of the engine, and it finds a way up at every landing on every level, with and without sliding clouds. The score is the height climbed in tens of units; Easy, Medium and Hard levels; best heights are kept in the browser's local storage and nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The part worth reading is how the generator promises that the next cloud is always reachable, and how a test proves it by trying every possible next cloud on a copy of the game."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "☁️"
---

## How to play

A round blob bounces by itself. You only steer it left and right. Land on a cloud from above and the blob bounces again, higher and higher. Fall past the bottom of the sky and the climb is over. Your score is the height you reached.

The sky wraps at the sides: leave the left edge and you come back in from the right. Going up through a cloud is fine. The blob only bounces when it is coming down onto the top of one.

### The clouds

- **Plain clouds:** a normal bounce.
- **Sliding clouds** have two small arrows on them. They move slowly from side to side.
- **Crumbling clouds** have cracks. They give you one bounce, then fade away after about half a second.
- **Spring clouds** have a coil on top. They fling you more than twice as high as a normal bounce.

The first clouds are plain, with the odd spring. Sliding and crumbling clouds appear more and more as you climb, and the gaps between clouds grow a little too, up to a limit for the level you chose.

### Controls

- **Keyboard:** Left and Right arrows (or A and D) steer. Space or the Start button begins the climb, and Space never pauses it. Escape or P pauses.
- **Touch or mouse:** press and hold the left or right half of the sky to steer that way. There are also two big buttons under the sky, at least 56 pixels square.
- **Pause:** Escape, P, the Pause button, or switching to another tab. The game stays paused until you press Resume or P (Space also works while the game area has focus).
- **Sound:** off until you press the Sound button. The sounds are short, quiet tones.

### Levels

| Level | Cloud width | Largest gap between clouds |
|---|---|---|
| Easy | 76 | 92 |
| Medium | 64 | 108 |
| Hard | 54 | 120 |

All numbers are the game's own units. The sky is 320 wide and 480 tall. An ordinary bounce is about 158 units high, so even the largest gap on Hard leaves about 37 units of the bounce to spare.

### Seeing the game

Clouds are told apart by shape, not only by colour: arrows on sliding clouds, cracks on crumbling ones, a coil on spring clouds. A text label on the canvas gives your height, and the score is written above it too. A message line says when you reach a spring or every hundred of height.

With reduced motion set on your device, there are no sliding clouds, the blob does not squash and stretch, the faint clouds in the background hold still, and nothing blinks. Nothing flashes.

## How it works

The engine is a pure function: `step(state, direction, rng)` advances the game by exactly one 1/60 second and returns a new state. The page runs it from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor play the same climb, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

- **Bounces.** Gravity pulls at 1300 units a second squared. An ordinary bounce sets the upward speed to 640 and a spring to 1000. A test flies both and checks the heights against the formula for a thrown ball.
- **Landing.** The blob lands when its feet cross the top of a cloud between two steps while it is falling. That check cannot be skipped by falling fast: a test drops the blob onto a cloud 3000 times from random heights and speeds, up to the top fall speed of 900, and compares each result with a separate calculation of whether the path crossed the cloud.
- **Camera.** The view scrolls up when the blob rises above two fifths of the way up the screen, and never scrolls down.
- **Score.** The height climbed, in tens of units.

### Why the next cloud is always reachable

Every new cloud is placed above the last one with a gap of at least 48 and at most the level's limit, and the limit is below four fifths of a bounce. Its sideways position is kept within a share of the distance the blob can cover in the air while it climbs that gap, which is less the bigger the gap is. Crumbling clouds need a second promise, because they disappear: the clouds that stay (plain, sliding and spring ones) are never more than 133 units apart, and there are never more than two crumbling clouds in a row. So if you fall back after using a crumbling cloud, there is always a way up.

Those are rules about the generated clouds, and the tests check each of them on thousands of generated clouds. They do not prove that a player can really steer there, so there is a second kind of test. A planner stands on the blob's landing spot, tries each cloud above in turn by running a copy of the engine ahead with plain steering toward it, and picks one that lands higher. On every level, with and without sliding clouds, the planner finds a way up at every landing in 12 runs of 40 seconds, and it never falls. A blob that is never steered does not get far, so the check can fail.

A seed replays exactly. The same random numbers and the same steering give the same climb, and a different seed gives a different sky. The page takes its random numbers from the browser's secure random source.

## Privacy and storage

Nothing is uploaded and there is no account. Your best height for each level (and for the calmer pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level so you can share it. Clearing site data removes the scores.

## Limits

- One kind of sky: no enemies, no coins and no shields.
- A climb you leave with Restart or a level change still counts toward your best, because the height was really reached.
