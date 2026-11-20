---
title: "Swarm Garden"
category: "fun"
job: "Watch a flock of up to 400 small shapes follow three simple rules, change how strongly each rule counts, add chasers, and pull the flock around with a press."
description: "Free flocking simulation with sliders for keeping apart, matching heading and staying together, plus chasers and a pull-or-push touch. No signup."
aiSummary: "A free browser flocking simulation. Between 20 and 400 small shapes live on a wrap-around world of 160 by 100 units and follow three local rules: separation (steer away from neighbours closer than 5 units), alignment (match the average heading of neighbours within 14 units) and cohesion (steer toward the middle of those neighbours). Three sliders from 0 to 3 weight the rules, four presets set them, speed is always kept between 12 and 30 units a second, and the simulation runs at a fixed 60 steps a second. Neighbours are found with a grid of cells, and the tests check the grid against a scan of every pair, including across the wrapped edges, and check the whole step against a separate plain implementation of the rules. Up to three chasers make the flock steer away but nothing is ever caught. Pressing on the garden pulls the flock toward that spot, or pushes it away. A flock-order readout shows how well headings agree, from 0 to 1. The page pauses when hidden or scrolled away, starts paused under reduced motion, and lowers the shape count by a quarter if frames take too long. Nothing is stored or uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. Three rules that each look only at nearby neighbours are enough to make the whole flock stream, ball up or scatter, and the sliders let you find where one behaviour turns into another."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🐟"
---

## How to play

A calm flock of 150 small arrow shapes is already moving when the page opens. Each shape is coloured by the way it is heading, so a stream of shapes going one way shares a colour. There is nothing to win. Change the settings and watch what the flock does.

- **Play / Pause and Step.** Pause freezes the flock. While paused, Step moves it ahead by 0.2 seconds so you can watch the rules at work.
- **Scatter** starts a new flock at random places.
- **Trails** leaves a fading path behind each shape.
- **Sliders.** Keep apart (separation), Match heading (alignment) and Stay together (cohesion) each go from 0, which is off, to 3. A fourth slider sets how many shapes there are, from 20 to 400.
- **Kinds of flock.** Calm flock is the balanced start. Tight ball has a strong pull to the middle. Streams has a strong heading match. Loose drift has weak rules all round.
- **Chasers.** None, or 1, 2 or 3 round shapes with a ring around them. They wander about and head for any shapes they can see, and the flock steers away from them. Nothing is ever caught, eaten or removed.
- **Press on the garden.** Press and hold with a mouse, finger or pen to pull the flock toward that spot. Choose Push away to scare it off instead. A ring with a plus (pull) or no plus (push) shows where you are pressing.

Above the garden, **Flock order** is a number from 0 to 1 with a word beside it: scattered, loosely together, mostly together or moving together. It measures how well the shapes agree on a direction.

Try these. With only alignment up, the headings agree but the shapes drift through each other. With only cohesion up, they gather into tight, swirling clumps. With only separation up, a crowd spreads out evenly.

### With the keyboard

Press Tab until the garden is selected. A dashed ring marks the cursor. The arrow keys move it (Shift moves further) and Space starts pulling (or pushing) at the cursor, and Space again stops. While the garden has the keyboard, P plays or pauses, N steps ahead while paused, R scatters, 1 to 4 pick a kind of flock, C changes the number of chasers, V switches between pull and push and T turns trails on or off. The sliders and buttons work with the usual Tab and arrow keys, and each change is announced in the status line.

### Motion, touch and performance

Your device may ask for reduced motion. If it does, the garden starts paused with trails off, and moves only when you press Play or Step. The simulation also pauses when the tab is hidden or the garden is scrolled out of sight. Only the garden itself stops the page scrolling under your finger. A second finger on it is ignored. If the system cancels a touch, the pull stops. If a device cannot keep up, the page lowers the number of shapes by a quarter and says so in the status line; the slider can raise it again.

## How it works

The world is a rectangle 160 units wide and 100 high that wraps round: a shape that leaves one edge comes back on the opposite one, and every distance is measured the short way round. Each shape sees neighbours within 14 units. Once per step, for each shape:

1. **Separation.** For every neighbour closer than 5 units, push away along the line between them, with a force that grows as the distance falls.
2. **Alignment.** Steer toward the average velocity of the neighbours.
3. **Cohesion.** Steer toward the middle of the neighbours.

The three pushes are multiplied by their slider values and added, together with any chaser and pull. The total is limited to a force of 100, applied to the velocity over 1/60 of a second, and the speed is then held between 12 and 30. Every shape's new velocity comes from the old state of all the others, and then they all move at once, so the order they are stored in makes no difference.

**Finding neighbours quickly.** Checking every pair would take 160,000 comparisons for 400 shapes. The world is cut into 11 by 7 cells, each at least 14 units across, so a shape only needs to look in its own cell and the eight around it, wrapping at the edges. The tests build swarms of 400, put some right on the corners and edges, and check that for every shape the grid finds exactly the same neighbours as a scan of every pair using a brute-force distance over the nine copies of the world.

**Checking the rules.** The tests contain a second implementation of the three rules, the chasers and the pull, written as the plainest possible double loop. It is run next to the real engine for one to three steps, and every position and velocity must agree to eight decimal places. They also run 5,000 steps with every slider at 3, three chasers and a pull that switches on and off, and check each shape's speed stays between 12 and 30, stays inside the world, and is never not-a-number. Each rule is tested alone: with all three off, every shape flies in a straight line at constant speed; with alignment alone, the order measure rises from under 0.3 to over 0.85; with cohesion alone, shapes end closer to their nearest neighbour and have more than one and a half times as many neighbours in sight; with separation alone, a squeezed crowd ends up spread more than a quarter wider.

| Setting | Value |
|---|---|
| Shapes | 20 to 400, 150 at the start |
| Sight / too close | 14 units / 5 units |
| Speed | 12 to 30 units a second |
| Steps | 60 a second, fixed |
| Chasers | 0 to 3, speed 18, they scare shapes within 24 units |
| Press radius | 50 units |

## Privacy and limits

Nothing is uploaded, stored or downloaded. Copy in the toolbar copies a one-line description of your settings and the flock order.

- There are no walls; the wrap-around world is a simplification.
- Chasers steer toward the nearest shape in sight at a limited turning rate, and otherwise wander.
- On a slow device the page lowers the number of shapes by itself, so the count you chose may not be the count you see.
