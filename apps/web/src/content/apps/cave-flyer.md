---
title: "Cave Flyer"
category: "fun"
job: "Play a one-button flying game: hold to make a paper plane rise, let go to fall, and fly as far as you can through a winding cave."
description: "Free Cave Flyer for the browser. Hold to rise, let go to fall, and steer a paper plane through a cave that winds and narrows. Three levels. No signup."
aiSummary: "A free one-button browser game. A paper plane stays at a fixed x while a cave scrolls past. Holding pushes the plane up at 520 units a second squared and letting go pulls it down at 640, with vertical speed capped at 300, in fixed 1/60 s steps. The cave is built from a seed: a control point every 240 units gives the middle of the tunnel and half its opening, blended with a smoothstep curve. The generator limits how far the middle moves between points, so the curve at the level's top speed asks for no more than half of the plane's weaker push, which a test checks against measured slopes and curves. Walls always stay 10 units inside the window. A pilot that only knows where the middle of the cave is flies 120 seconds on 30 seeds at every level, at normal and reduced-motion pace, without touching a wall, while never holding, always holding and hovering at one height all crash. The score is metres flown (tens of units). Best distances are kept in the browser's local storage per level; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I like is that the cave is smooth enough to measure: the tests work out the steepest slope and sharpest bend of the real cave and check that the plane has the push to follow it."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "✈️"
---

## How to play

A small paper plane flies by itself through a cave. You have one control. While you hold, the plane rises. When you let go, it falls. Keep it in the opening between the roof and the floor. If the plane touches either wall, the flight is over. Your score is the number of metres you flew.

The cave winds up and down, it gets narrower and bendier the further you go, and it speeds up gently. The game waits for your first hold, so there is no rush to start: pressing Start only gets the plane ready, and it stays still until you hold the big button, press and hold the cave, or hold Space.

- **Touch or mouse:** press and hold the cave, or the big **Hold to rise** button under it, and let go to fall. The button is at least 56 pixels tall.
- **Keyboard:** hold **Space**, the **Up arrow** or **W**. Letting go lets the plane fall. Holding the key does not repeat, it just stays held.
- **Pause:** **Escape** or **P** pauses, and so does switching to another tab. The game stays paused until you press Resume or P (Space also works while the game area has focus).
- **After a crash:** a short pause of half a second stops a fast press from skipping the result, then the Play again button (or any press on the game) starts a new flight, which again waits for your first hold.
- **Sound:** off until you press the Sound button. The sounds are short, quiet tones.

### Levels

| Level | Scroll speed (start to top) | Opening of the cave | Largest bend between points |
|---|---|---|---|
| Easy | 85 to 110 | 128 to 168 | 60 |
| Medium | 105 to 140 | 104 to 140 | 75 |
| Hard | 125 to 170 | 88 to 116 | 80 |

All numbers are the game's own units. The window is 400 wide and 300 tall, the plane is 14 across, and speeds are per second. The scroll speed climbs from the first number to the second over the first 6000 units of cave.

### Seeing the game

The roof and floor have a lit edge, so you can see exactly where the plane will touch. The pebbles drawn in the rock stay inside the rock, they never stick out into the opening. A text label on the canvas gives the metres flown, and a message line says when you crash and at every hundred metres.

With reduced motion set on your device, the cave scrolls 20 percent slower, the faint shapes far behind the cave hold still, and the plane leaves no sparkles when you hold. Nothing flashes.

## How it works

The engine is a pure function: `step(state, hold, rng)` advances the game by exactly one 1/60 second and returns a new state. The page runs it from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor fly the same cave, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

- **Flight.** Holding adds an upward push of 520 units a second squared. Letting go adds a downward pull of 640. The test works out the position after ten steps with the formula for steady acceleration and checks the engine gives the same answer.
- **The cave.** A control point every 240 units says where the middle of the tunnel is and how wide it is open. Between two points both numbers are blended with a smoothstep curve. A seed always makes the same cave, and a different seed makes a different one.
- **Walls.** The plane is a circle. The game checks it against the roof and floor at five places across its width. A test compares this with a brute-force walk round the whole outline on 6000 random places, and the two agree wherever the plane is more than a unit into a wall or clear of it.

### Why the cave can always be flown

The generator limits how far the middle can move from one point to the next (60, 75 or 80 units), and keeps both walls at least 10 units inside the window. A smoothstep blend has a known steepest slope, 1.5 times the change over the span, and a known sharpest curve, 6 times the change over the span squared. The tests measure the real cave, point by point on thousands of places, and confirm it never goes past those two numbers. Then they check that at the top speed of every level the sharpest curve asks for no more than half of the plane's weaker push, which is the 520 you get from holding. That holds at the normal pace and the slower reduced-motion pace.

That is a bound, not a flight, so the suite also flies it. A simple pilot that knows only where the middle of the cave is a little way ahead flies for 120 seconds on 30 different seeds at every level, at both paces, and never touches a wall. Three pilots that ignore the cave all crash: one that never holds, one that always holds, and one that tries to hover at a single height. So the check can fail.

The suite also plays thousands of random holds and checks that the vertical speed never passes 300, the score never goes down and the cave always covers the whole window.

## Privacy and storage

Nothing is uploaded and there is no account. Your best distance for each level (and for the slower pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your level so you can share it. Clearing site data removes the scores.

## Limits

- One cave style. No coins, no obstacles in the opening and no power-ups.
- A flight you leave with Restart or a level change still counts toward your best, because the distance was really flown.
