---
title: "Garden Defence"
category: "fun"
job: "Play a short plant-and-defend game: plant four kinds of plant beside a winding path and stop round blobs reaching the far end over ten waves."
description: "Free short tower defence game. Plant four kinds of plant, stop ten waves of round blobs, three difficulties, slow speed and pause. No signup."
aiSummary: "A free browser tower defence game. Round blobs walk a fixed 23-square winding path through an 8 by 6 garden and you plant four kinds of plant on the grass beside it: a Sprout that hits one blob, a Bloom whose burst also hurts nearby blobs, a Frost bud that slows up to three blobs to half speed, and a Pepper pod that hits hard in a small circle. There are ten waves, the same every game, with 138 blobs in four kinds. Seeds to plant with grow back by one a second, come from popped blobs, and a cleared wave adds 10. Easy, Medium and Hard differ in lives (15, 10, 7), starting seeds (100, 80, 60) and blob health. The engine has no random numbers and moves in fixed steps of 0.05 seconds with every timer counted in whole steps, so the same plants at the same moments give the same game. Tests pin the path against an independent line search, the crossing time of every blob, exactly what each plant does, that a sensible layout wins every difficulty and an empty garden loses, and 300 random games. The most waves cleared on each difficulty is three small whole numbers in local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I find interesting is that a whole tower defence game can be a deterministic function of its steps: no random numbers, so a scene in a test can say exactly how many points of damage a plant does."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🌱"
---

## How to play

Round blobs walk along a sandy path from the left edge of the garden to the right edge. Every blob that gets through costs you a life, and a giant one costs three. Plant things beside the path to pop them first. Clear all ten waves to win.

- **Planting.** Pick a plant from the row under the garden, then tap a grass square. The path squares cannot be planted. Tap a plant to see its reach as a dashed circle, and use **Dig up** to get 60 percent of its seeds back, rounded down.
- **Seeds.** You start with 100, 80 or 60 seeds depending on the difficulty. Seeds grow back by themselves at one a second, popped blobs give more, and clearing a wave gives 10. There is no limit on how often you can plant, only on your seeds, which never go past 999.
- **Waves.** Press **Start wave** when you are ready. The ten waves are the same every game, and the status line tells you what each one holds before you start it. Plants and digging up work while a wave is running or paused.
- **Pause and speed.** Pause stops everything. Speed switches between normal, fast and slow. The game starts at slow speed if your device asks for reduced motion, and it pauses by itself when you switch to another tab.
- **Difficulty.** Easy has 15 lives and 100 seeds, Medium 10 lives and 80 seeds, Hard 7 lives and 60 seeds. Blobs also have more health on the higher levels: the same as the table on Easy, 1.4 times on Medium, 1.9 times on Hard, and about 15 percent more with every wave.

| Plant | Seeds | Reach | Hits for | Every | Also |
|---|---|---|---|---|---|
| Sprout (green circle) | 25 | 2.5 squares | 6 | 0.7 s | Nothing. Cheap and steady |
| Bloom (pink hexagon) | 50 | 2.2 | 4 | 1.1 s | 3 to blobs within 1 square of its target |
| Frost bud (blue diamond) | 35 | 2.4 | 1 | 1 s | Slows up to three blobs to half speed for 2 s |
| Pepper pod (orange triangle) | 75 | 3 | 24 | 3 s | 10 to blobs within 1.2 squares of its target |

Every plant shoots the blob that has walked farthest along the path, among those in reach. The four blobs differ in size and in the pattern inside them as well as colour: a small blob (14 health, 1 square a second), a quick blob (8 health, 1.8), a slow blob (40 health, 0.7) and a giant blob (180 health, 0.5).

**Keyboard and screen readers.** Tab to the garden and move with the arrow keys. Enter or Space plants the chosen plant or selects the plant under the cursor, 1 to 4 choose a plant, Delete digs up the plant under the cursor and P pauses. Every square is labelled with its row, column and what is on it. The status line announces each wave, each blob that gets through and how many lives are left. Buttons are at least 56 pixels tall and the garden squares are at least 28 pixels even on a narrow phone.

**Motion.** The blobs walking is the game, so it moves. The small shot and pop effects are left out under reduced motion, and nothing flashes.

## How it works

**The path.** The path is a list of corners, and a blob's place on it is a single number: how many squares it has walked. The path is 23 squares of walking long, over 22 squares of the garden, and turns four times. The tests check every square of the garden against an independent search that measures the distance from the square to the line, and they walk a blob along the whole path to check it never leaves the grid.

**Steps.** The world moves in steps of 0.05 seconds and every timer counts whole steps, so there is no rounding to drift. A plant's cooldown, the 2 second slow (40 steps) and the times blobs appear are all whole numbers of steps. A blob crossing at 1 square a second takes 460 steps. The tests measure the crossing time of all four blobs, and check a slowed blob takes twice as long.

**One step.** Seeds grow, new blobs appear, every ready plant looks for blobs in reach and hits the one farthest along, blobs walk, popped blobs pay out, and blobs at the end take lives. The tests build scenes with a plant and a few blobs and check the health afterwards: exactly 6 from a Sprout, the range edge to one millionth of a square, a Bloom's 4 and 3, a Frost bud's three targets, a Pepper pod's 24 and 10, and a Sprout firing on steps 1, 15, 29 and 43.

**No random numbers.** There are none. Because every wave is a fixed table, a test can play a whole game twice and check the final world and every event are identical.

| Fact | Value | Checked by |
|---|---|---|
| Garden | 8 by 6, 22 path squares, 26 for plants | line search |
| Waves | 10, with 6, 8, 10, 10, 10, 16, 24, 7, 22 and 25 blobs | table test |
| A sensible layout, bought as seeds allow | wins Easy, Medium and Hard | full-game test |
| An empty garden | lost within 3 waves on every difficulty | full-game test |
| Sprouts alone, same places | win Easy, lose Hard | full-game test |
| Random play | 300 games, every rule held | fuzz test |

## What is stored

Three small whole numbers, from 1 to 10: the most waves you have cleared on Easy, Medium and Hard. They live in your browser's local storage in a small object. Anything else found there is ignored: the loader reads only those three keys, rejects anything that is not a whole number in range, and builds a new object. Nothing is sent anywhere, and the page works if storage is blocked.
