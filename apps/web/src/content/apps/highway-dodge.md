---
title: "Highway Dodge"
category: "fun"
job: "Play a lane-changing driving game: dodge the traffic on a 3, 4 or 5 lane road and pick up fuel drops to keep going."
description: "Free Highway Dodge for the browser. Change lane to dodge cars, collect fuel drops and drive as far as you can. Swipe, tap or use the keys. No signup."
aiSummary: "A free top-down driving game. The player's car stays near the bottom of a 3, 4 or 5 lane road (Easy, Medium, Hard) and changes lane by swipe, tap, arrow key or button, taking 56 / 420 s per lane. Traffic comes in rows at least 210 units apart. The generator keeps a list of the lanes the car could be in at each row and only makes a row if every one of those lanes has a free lane to move into (the same lane or one beside it), checked in the tests against an independent enumeration of all paths. At top speed the free time between two rows is at least twice a lane change. Fuel falls at 2.2, 2.8 or 3.4 percent a second, a drop adds 30 and scores 10, and a drop appears in every 4th or 5th row in a free, reachable lane. A driver who looks only at the next row never crashes on 30 seeds at every level, and a planner that looks five rows ahead and goes for fuel drives 300 s on 20 seeds without a bump or running dry. The road speeds up from 140-200 to 220-330 units a second over 90 s. Best scores are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I find interesting is how little the generator has to promise to make traffic fair: a free lane beside every lane you could be in, which the tests check against a separate count of every possible path."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🚗"
---

## How to play

You drive the blue car with the ring on its roof up a road with several lanes. Other cars come down the road toward you in rows. Change lane to slip past them. Amber fuel drops sit in the lanes too. Drive into one to refill. The fuel gauge falls all the time, and the drive ends when it is empty or when you have bumped into too many cars. Your score is how far you have driven plus 10 for every fuel drop.

### Controls

- **Keyboard:** Left and Right arrows (or A and D) change one lane. One press is one lane, and holding a key does not keep going. Space or the Start button begins. Escape or P pauses.
- **Touch:** swipe sideways on the road for one lane, or tap on the side of your car you want to move to. The two big buttons under the road, at least 56 pixels square, move one lane each press.
- **Mouse:** click on the left or right side of your car, or use the two buttons.
- **Pause:** Escape, P, the Pause button, or switching to another tab. The game stays paused until you press Resume, P or Space.
- **Sound:** off until you press the Sound button. The sounds are short, quiet tones.

When you bump a car you lose a life, that car is gone, and your car is dimmed and cannot be hit for 1.6 seconds.

### Levels

| Level | Lanes | Lives | Road speed (start to top) | Fuel used a second | Fuel drop in every |
|---|---|---|---|---|---|
| Easy | 3 | 3 | 140 to 220 | 2.2 percent | 4th row |
| Medium | 4 | 3 | 170 to 270 | 2.8 percent | 5th row |
| Hard | 5 | 2 | 200 to 330 | 3.4 percent | 4th row |

All numbers are the game's own units: the world is 320 wide and 480 tall, each lane is 56 wide, and speeds are per second. The road speeds up from the first speed to the second over the first 90 seconds. A drop adds 30 percent of a tank, up to a full tank.

### Seeing the game

Cars are told apart by more than colour: each has its own roof marking (a stripe, two dots, a chevron, two side stripes or a small box) and the three shapes are a car, a long van with a pale box on its roof and a short one. Your car is the one with a ring on its roof. The fuel gauge says "FUEL LOW" in words as well as turning a different colour. The canvas has a text label with your score, fuel, lives and lane, and a message line says when you pick up fuel, bump a car or pass every hundred points.

With reduced motion set on your device, the road is 20 percent slower and your car is shown steadily dimmed after a bump instead of blinking. Nothing flashes.

## How it works

The engine is a pure function: `step(state, move, rng)` advances the game by exactly one 1/60 second and returns a new state. The page runs it from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor play the same drive, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

- **Lanes.** A move changes the lane you are heading for at once, and the car slides there at 420 units a second, which is 56 / 420 of a second per lane. The crash test uses the car's real position, so you can clip a car while sliding past it. The test for this is compared with a brute-force check of overlapping boxes on 4000 random pairs.
- **Rows.** Traffic is made one row at a time, 210 or more units apart, and never fills every lane.
- **Fuel.** It falls at a steady rate for the level. A drop is in a free lane that you could reach.
- **Speed.** It rises in a straight line from the start speed to the top speed over 90 seconds.

### Why there is always a way through

For each new row, the game works out the lanes you could be in: the lanes that were reachable at the row before and that are one step away, or the same, and free. A new row is only kept if from every one of those lanes there is a free lane to move into, either the same lane or the one on either side. If twelve tries fail, the row is left empty. This means a driver who looks only at the next row, and moves into a free lane beside theirs when needed, can never be trapped.

The tests check this with a separate count. For each level they make 800 rows from 25 seeds and, with a different piece of code, follow every possible path through them from the starting lane. A path always exists. They also work out the time between two rows at the top speed: after counting how long the biggest van overlaps your car and the small forward and back wobble of each car in a row, the free time is at least twice what a lane change needs.

Then they drive it. A driver who looks one row ahead drives 120 seconds on 30 seeds at every level, at the normal and the slower reduced-motion pace, and never takes a bump. A planner that looks five rows ahead and goes for fuel whenever the tank is below 85 percent drives 300 seconds on 20 seeds at every level and pace with no bump and no empty tank. A driver who ignores fuel runs dry in at least 15 of 20 Medium and Hard drives, so the fuel drops really matter. A driver who never changes lane crashes or runs dry on every seed, so the check can fail.

## Privacy and storage

Nothing is uploaded and there is no account. Your best score for each level (and for the slower pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level so you can share it. Clearing site data removes the scores.

## Limits

- Cars all travel in the same direction and come in rows. There are no overtaking cars, no police and no power-ups.
- A drive you leave with Restart or a level change still counts toward your best, because the distance was really driven.
