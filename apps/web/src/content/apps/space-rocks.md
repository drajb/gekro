---
title: "Space Rocks"
category: "fun"
job: "Play a ship-and-rocks arcade game: turn, thrust and shoot drifting rocks that split into smaller ones, clear each wave and keep your lives."
description: "Free Space Rocks for the browser. Steer a drifting ship, shoot rocks that split in two, and clear bigger waves. Keyboard or touch. Three levels. No signup."
aiSummary: "A free browser arcade game on a wrap-around 480 by 360 sky. A ship turns at 4.2 radians a second, thrusts at 190 units a second squared, loses 35 percent of its speed each second when coasting and never passes 260 units a second. Bullets leave at 340 units a second plus the ship's speed, last 0.85 s, can be fired every 0.2 s and are capped at 5 (Easy) or 4 (Medium and Hard) in the air. A large rock scores 20 and splits into two medium rocks, a medium scores 50 and splits into two small, a small scores 100 and vanishes. New waves never appear within 120 units of the ship, a wave has 3, 4 or 5 large rocks on Easy, Medium and Hard plus one per wave up to 10, an extra life comes every 3000 points up to 9 lives, and a returning ship is untouchable for 2.2 s. Bullet hits are checked along the whole path of each step, so a fast bullet cannot pass through a small rock. Physics runs in fixed 1/60 s steps. Best scores are kept in the browser's local storage per level; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The part I like is the bullet test: it checks the whole path a bullet travelled in a step against the moving rock, so no shot can slip through a small one."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🚀"
---

## How to play

A small ship drifts across a dark sky full of rocks. Turn it, push it, and shoot the rocks. A big rock breaks into two medium rocks, a medium rock breaks into two small ones, and a small rock just disappears. When the sky is empty a new, bigger wave arrives. The game ends when you are out of lives.

The sky wraps around. Anything that leaves one edge comes back at the opposite edge, including you, your shots and the rocks. The ship keeps drifting after you stop pushing, so you can coast and aim at the same time.

- **Keyboard:** Left and Right arrows (or A and D) turn the ship. Up (or W) thrusts. Space fires, and holding it keeps firing at a steady pace. Escape or P pauses.
- **Touch:** four big buttons sit under the sky: turn left, turn right, thrust and fire. They are all at least 56 pixels square. Hold a button to keep doing it. You can press two at once, for example thrust and fire.
- **Starting:** press Start, press Space, or press any of the buttons. The game waits for you, so the rocks do not move until you begin.
- **Pause:** Escape, P, the Pause button, or switching to another tab. The game stays paused until you press Resume or P (Space also works while the game area has focus).
- **Sound:** off until you press the Sound button. Every sound is a short tone made in the browser and kept quiet.

### Levels

| Level | Lives | Rock speed | Large rocks in wave 1 | Shots in the air |
|---|---|---|---|---|
| Easy | 5 | 75 percent | 3 | 5 |
| Medium | 3 | 100 percent | 4 | 4 |
| Hard | 3 | 130 percent | 5 | 4 |

Each wave has one more large rock, up to 10, and rocks get faster wave by wave, up to 50 percent faster. Large rocks score 20, medium rocks 50 and small rocks 100. You earn an extra life every 3000 points, up to 9 lives.

When a rock hits your ship you lose a life and the rock breaks. After 1.4 seconds the ship comes back in the middle, and it cannot be hit for 2.2 seconds. If a rock is sitting in the middle, the ship waits up to three seconds for it to move away.

### Seeing the game

Rocks are soft blobby shapes with a glow, not outlines. The three sizes also have three colours (violet, orange and amber), but the size is clear from the shape alone, so you never need the colour. The canvas has a text label that gives your score, lives, wave and how many rocks are left, and a message line says what happened when you lose a ship, clear a wave or earn a life.

With reduced motion set on your device, the rocks are 20 percent slower, there are no sparks, the engine flame does not flicker, and a returning ship is shown steadily dimmed instead of blinking. Nothing on the page flashes.

## How it works

The engine is a pure function: `step(state, input, rng)` advances the game by exactly one 1/60 second and returns a new state. The page runs it from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor play the same game, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

- **Ship.** It turns at exactly 4.2 radians a second. Thrust adds 190 units a second squared along the nose. Each second 35 percent of the speed fades away, and the speed never passes 260.
- **Shots.** A bullet leaves the nose at 340 units a second plus the ship's own speed and lives 0.85 seconds. A shot can be fired every 0.2 seconds.
- **Hits.** A rock's hit circle is 90 percent of its drawn size, and the ship's is smaller than it looks, so a graze does not count. The game does not just test where a bullet is at the end of a step. It tests the whole path the bullet took against the whole path the rock took, measured across the wrap-around edge. A test checks this against a brute-force sampling of the path on 3000 random cases, and another sends a fast bullet at a small rock at every offset across its width to prove it never slips through.
- **Waves.** New rocks appear at least 120 units from the ship. The tests check this from every part of the screen, counting distance across the edges.
- **Seeds.** The same random numbers and the same keys replay exactly the same game. The page takes its random numbers from the browser's secure random source.

**Can every wave be cleared?** A rock can always be shot, because shots wrap around the sky and rocks cannot hide. As a check, the suite plays a simple pilot that only turns toward the nearest rock and fires, never thrusting. It clears the first wave on at least 15 of 20 seeds on Easy and Medium and at least 12 of 20 on Hard. A pilot that never shoots scores nothing, so the check can fail.

The suite also plays thousands of random key presses on every level and checks that the ship and rocks stay inside the sky, the shot count stays under the cap, the score never goes down, lives stay between 0 and 9, and no number turns into NaN.

## Privacy and storage

Nothing is uploaded and there is no account. Your best score for each level (and for the slower pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level so you can share it. Clearing site data removes the scores.

## Limits

- One kind of rock and one ship. There are no flying saucers, no power-ups and no hyperspace jump.
- A run you leave with Restart or a level change still counts toward your best, because the points were really earned.
