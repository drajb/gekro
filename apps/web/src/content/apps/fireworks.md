---
title: "Fireworks"
category: "fun"
job: "Launch shells into a night sky that burst into peony, willow, ring, heart and star patterns, or start the show and watch it fire by itself."
description: "Free fireworks toy. Tap to launch shells that burst into peonies, willows, rings, hearts and stars. Quiet by default, no signup."
aiSummary: "A free browser fireworks toy. A shell is thrown from the ground so that it peaks exactly where you tap, then bursts into sparks in one of five patterns: peony (sparks from a ball seen side-on), willow (slower, longer-lived, drooping sparks), ring (a tilted circle), heart and star (sparks placed along the outline of the shape). Each spark slows with drag and falls under gravity, and the page uses the exact closed-form path, so it is the same at any frame rate; the tests compare it with a fine numerical integration. A show mode fires a seeded schedule of 24 launches at least 300 ms apart and repeats. Glows are limited to 3 in any second by a sliding-window limiter, the sky holds up to 1,800 sparks and 10 shells, and the loop stops when the sky is empty and pauses when the tab is hidden. Sound is off until switched on and every burst sound stays under a volume of 0.15. With reduced motion, a burst is drawn as a still picture of where its sparks are 0.7 seconds after bursting. Nothing is stored, uploaded or downloaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The sparks follow the exact solution of motion with drag and gravity, which is a neat way to see why a burst keeps its shape at any speed of the animation."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎆"
---

## How to play

The page opens on a quiet night sky. Tap or click anywhere in it: a shell climbs from the ground and bursts at the spot you pressed. Hold and drag to keep firing (about four a second at most). On a touch screen several fingers can fire at once.

- **Pattern.** Surprise me picks a different pattern for each shell. Peony, Willow, Ring, Heart and Star fix one.
- **Start show / Stop show.** The show launches a run of 24 shells by itself, quick pairs and a faster finale at the end, and then starts another run until you stop it.
- **Sound off / Sound on.** Sound is off until you turn it on. When it is on, each burst is a soft thump and a few small crackles.
- **Clear sky** removes everything in the air.

| Pattern | What you see |
|---|---|
| Peony | A round burst, thickest near the edge. |
| Willow | Slower sparks that last longer and sink in long, drooping trails. |
| Ring | A circle of sparks, tilted by a random amount so it can look like an ellipse. |
| Heart | Sparks along the outline of a heart, one colour. |
| Star | Sparks along the outline of a five-pointed star. |

Each spark is drawn as a short streak along the way it is moving and fades as it ages. Every burst has one or two colours from the eight in the site palette. Colour is only decoration: the pattern names and the status line say what you fired.

### With the keyboard

Press Tab until the sky is selected. A small cross shows your aim. The arrow keys move it (Shift moves further) and Space or Enter fires a shell at it. While the sky has the keyboard, keys 1 to 6 pick Surprise me, Peony, Willow, Ring, Heart and Star, S starts or stops the show and M turns the sound on or off. The status line under the sky says what happened. Keys are only taken while the sky is selected.

### Safe flashing, motion and sound

A burst can light up the sky around it with a soft glow. No more than three glows are allowed in any one second, however fast you fire or however fast the show goes, and each glow is a faint, local fade, never the whole screen switching on and off. The sparks themselves fade smoothly and do not blink. If your device asks for reduced motion, nothing animates: a tap shows the burst as a still picture of the sparks 0.7 seconds after it bursts (the six newest are kept), and the show changes the picture every few seconds. The animation stops by itself once the sky is empty and pauses while the tab is hidden. Sound, if you turn it on, is quiet: the volumes of everything in one burst add up to no more than 0.15, a burst sound lasts well under a second, and at most four bursts a second make a sound.

## How it works

**The shell.** The sky is 100 units wide and 62.5 high. A shell leaves the ground and rises under constant gravity of 24 units a second squared. Its launch speed is worked out from how high you aimed, so that the top of its climb is exactly your target, and it bursts at that moment. The tests launch shells at many targets and check the burst position is the target, the highest point reached equals the target height, and the flight time matches the physics.

**The shapes.** For a peony the engine picks a random point on a ball and keeps only its side-on view, so sparks pile up toward the rim; the tests check the mean distance from the middle is pi/4 of full speed and the mean square is 2/3, over 52,000 sparks. A ring is evenly spaced round a circle squashed by a tilt, and the test undoes the tilt and checks the circle equation. The heart is the curve x = 16 sin cubed t, y = 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t, turned upright; the tests check it is left-right symmetrical, has two lobes over a cleft and a point at the bottom. The star's sparks are spaced along the ten edges of a five-pointed star, and each is tested to lie on an edge. The same seed always builds the same burst.

**The motion.** A spark's velocity falls off like e to the minus k t because of drag k, while gravity pulls it toward a steady fall speed of g / k. That has an exact answer for position at any time, and the page uses it, so one step of 1/60 s or six steps of 1/360 s end in the same place. The tests compare it with a fourth-order Runge-Kutta integration written separately, and check that two short steps equal one long one.

| Limit | Value |
|---|---|
| Sparks in the sky | 1,800 |
| Shells in the air | 10 |
| Sparks in one burst | 55 to 130 |
| Glows | 3 in any second |
| Show | 24 launches, at least 300 ms apart |

## Privacy and limits

Nothing is uploaded, stored or downloaded. Copy in the toolbar copies a one-line count of the shells you launched.

- The sky is always a night sky, in the light theme too, so the sparks can be seen.
- When the sky holds the most sparks it can, a new burst keeps an evenly spaced share of its sparks instead of all of them.
- Bursts are flat patterns facing you. They do not turn in space.
