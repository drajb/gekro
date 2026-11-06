---
title: "Brick Smasher"
category: "fun"
job: "Play Brick Smasher: bounce a ball off a round paddle to clear walls of soft-coloured bricks, with power-ups, three lives and endless levels."
description: "Free brick-clearing game for keyboard, mouse and touch. Round paddle, shaped levels, three power-ups and three lives. No ads. No signup."
aiSummary: "A free browser game in which a ball bounces off a round paddle to clear a wall of bricks. Levels are built from four shapes (stairs, wave, checker, heart); from level 5 some bricks take two hits. Three power-ups fall from broken bricks: a wider paddle, a slower ball and two extra balls. The ball angle depends on where it meets the paddle, up to 60 degrees from vertical. Physics runs in fixed 1/120 second steps, a frame counts for at most 50 ms, and the ball moves in sub-steps of at most 3 pixels, so at its top speed of 600 pixels per second it cannot pass through a brick or the paddle. Tests check the collision maths against an independent version, a wall of unbreakable bricks hit at top speed, and a scan of first contacts. Control is by arrow keys, mouse, touch drag or on-screen buttons. The best score at each difficulty is saved in the browser; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the physics: a ball at full speed covers more than its own width in a frame, so the engine moves it in tiny sub-steps, and the tests try hard to push it through a wall."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🧱"
---

## How to play

Launch the ball, then keep it in play with the paddle and clear every brick to move to the next level. You have three lives. A ball that falls past the paddle costs one life; the next ball waits on the paddle until you launch it.

- **Move:** the left and right arrow keys (or **A** and **D**), the mouse, or a finger dragged across the board. Two big buttons under the board also move the paddle on a touch screen: hold one down.
- **Launch:** **Space**, a click or tap on the board, or the Launch button. A drag does not launch, only a tap does, so you can line up the paddle first.
- **Pause:** **Space** (while the ball is moving), **P** or **Escape**. The game also pauses when you switch to another tab.
- **Steering:** where the ball meets the paddle decides its angle. The middle sends it straight up and the very edge sends it 60 degrees to the side. The paddle is a rounded pill, and a ball that has dropped below its middle line is missed.

The keys only act while focus is inside the game or the ball is moving, so a stopped game never takes over the page's arrow keys or Space. If you paused and moved on to something else, click the board or press Resume to carry on. If your system asks for reduced motion, the ball is 15 percent slower and there is no confetti.

## Bricks, levels and score

Levels cycle through four shapes: stairs, wave, checker and heart. Stairs, wave and checker levels start 5 rows tall and gain a row every four levels, up to 8; the heart is always 8 rows tall. Bricks are drawn in violet, sky, teal, lime and amber from top to bottom, but about a quarter of them are shifted one colour, so the rows are not simple stripes. From level 5 some bricks take two hits and show an inner outline; the chance rises 5 percent a level up to 35 percent.

| Thing | Value |
|---|---|
| Each hit on a brick | 10 points |
| Clearing a level | 100 bonus points |
| Ball speed, Easy / Medium / Hard | 230 / 290 / 350 pixels per second at level 1 |
| Speed increase | 4 percent per level, never over 600 |
| Paddle width, Easy / Medium / Hard | 88 / 72 / 60 (out of a 360 wide board) |

**Power-ups** fall from about one broken brick in seven, at most three at a time, and you catch them with the paddle. Each is a shape with a symbol, not a letter. A six-sided capsule with a double arrow makes the paddle 1.5 times wider for 12 seconds. A round capsule with clock hands slows the ball to 70 percent for 10 seconds. A square capsule with two dots adds two balls, up to five in play. You only lose a life when the last ball is gone.

Your best score at each difficulty is saved in your browser as a whole number.

## How it works

The engine is a set of plain functions on a small world object with no page attached. It takes random numbers as an argument, so every run can be replayed exactly.

- **Fixed steps.** The world moves in steps of 1/120 second however fast your screen redraws, and a long gap between frames counts as at most 50 milliseconds, so a stalled tab cannot throw the ball across the board.
- **No tunnelling.** At 600 pixels per second the ball travels 5 pixels a step, nearly half its own width. The engine moves it in sub-steps of at most 3 pixels, half its radius, and resolves walls, bricks and the paddle after every one, so the centre of the ball can never end up inside a brick.
- **Collisions.** A brick is a rectangle and the ball is a circle; the nearest point on the rectangle gives the bounce direction. The paddle is a capsule, so the ball bounces off its curved ends in the same way.
- **Levels.** Each level comes from a shape plus random choices for tints, mirroring and two-hit bricks, all taken from the seed.

The tests attack the physics several ways. The circle-and-rectangle test is compared with a second version based on edge distances over 20,000 random cases. A full wall of unbreakable bricks is hit at 600 pixels per second from random angles for 150,000 steps and never crossed, and a single unbreakable column is shot at from both sides. For the paddle, the ball's landing spot is worked out by unfolding its path off the side walls, and every ball predicted to land on the flat part, at least 4 pixels in from its curved end, is returned. First contacts on straight paths match a fine scan, one hundredth of a pixel at a time, to within one sub-step and never early. A bot that aims randomly clears each of the first eight levels, and a random-input run of 90,000 steps finds no ball outside the walls, no centre inside a brick, and no score going down.

## Limits

- There is one board size, and no two-player mode or sound.
- Changing the difficulty or pressing Restart ends the game in progress. A score that beat your best is kept.
- The page only draws the board on a canvas, so the board is described to screen readers in a short status line rather than brick by brick.
