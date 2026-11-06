---
title: "Paddle Rally"
category: "fun"
job: "Play a bat-and-ball rally game: keep the ball in play with your paddle, win the first to 7 points against a computer or a friend on one keyboard."
description: "Free Paddle Rally for the browser. Rally a ball that speeds up with every hit, first to 7. Play the computer or a friend on one screen. No signup."
aiSummary: "A free two-paddle rally game on a 400 by 300 court. The ball starts at 210 units a second, gets 7 percent faster on every paddle hit up to 520, and leaves a paddle at an angle set by where it hit: straight from the middle, 60 degrees from the ends. It moves in sub-steps of at most 3 units so it cannot pass through a paddle, which a test checks on 4000 random shots against an independent bounce prediction. First to 7 points wins. Play alone against an easy, medium or hard computer, or two players on one keyboard or touch screen. The computer decides where to go only every 0.4, 0.25 or 0.14 seconds, moves at 140, 190 or 230 units a second at most, and aims with an error that grows faster than the ball's speed, so long rallies end. A perfect pilot beats Easy and Medium every time and Hard most of the time, and takes longer against each harder level; a player who stands still loses at every level. The longest rally per mode is kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the computer player: it has to be beatable, so it decides late and aims badly when the ball is fast, and a test measures that a perfect pilot needs longer against each harder level."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🏓"
---

## How to play

Two rounded paddles face each other across the court. A ball bounces between them and off the top and bottom walls. Keep it in play by meeting it with your paddle. If it gets past you, the other side scores a point. The first to 7 points wins.

Where the ball meets your paddle sets where it goes next. The middle sends it straight across. The ends send it away at a steep angle, up to 60 degrees. Every hit makes the ball 7 percent faster, up to a top speed, so a long rally gets exciting. After each point the ball waits in the middle for a moment and is then served toward the side that just lost the point.

### Choosing a game

- **You against an easy, medium or hard computer.** You play the left paddle.
- **Two players, one keyboard.** Player 1 is on the left and uses **W** and **S**. Player 2 is on the right and uses the **Up** and **Down arrows**.

### Controls

- **Keyboard:** against the computer, W and S or the Up and Down arrows move your paddle. Space or the Start button serves the first ball. Escape or P pauses.
- **Mouse:** move the mouse over the court and your paddle follows (when playing alone).
- **Touch:** drag a finger up and down on the court. In a two-player game each player drags on their own half. There are also big up and down buttons under the court, at least 56 pixels square. In a two-player game there is a pair for each player.
- **Pause:** Escape, P, the Pause button, or switching to another tab. Nothing happens to the ball while it is paused.
- **Sound:** off until you press the Sound button. The tones are short and quiet, and rise a little as the rally gets longer.

The two paddles do not depend on colour alone to tell them apart. The left one has a pale stripe on its face and the right one has three small dots. The scores are written as numbers in the court and above it, and a text label on the canvas gives the score and the length of the rally. A message line says who scored.

With reduced motion set on your device, the ball is 15 percent slower, and it leaves no trail and the paddles do not glow when they are hit. Nothing flashes.

### Your best rally

The page keeps your longest rally (the most paddle hits in a row before a point) for each game mode, in your browser only.

## How it works

The engine is a pure function: `step(state, input, rng)` advances the game by exactly one 1/60 second and returns a new state. The page runs it from a fixed-step clock, so a 60 Hz phone and a 144 Hz monitor play the same match, and a stalled tab cannot fast-forward it (one frame is cut off at 50 ms).

- **Ball.** It starts at 210 units a second, gets 7 percent faster on each paddle hit and stops at 520. The angle off a paddle is the hit position times 60 degrees, so the ball never leaves a paddle steeper than 60 degrees and can never get stuck bouncing straight up and down.
- **No tunnelling.** The ball moves in sub-steps of at most 3 units, and the paddle test runs after each one. A test fires 4000 random shots at a paddle and compares the result with an independent prediction of where the ball will be when it reaches the paddle, worked out by unfolding the wall bounces. That prediction is itself checked against a brute-force simulation with tiny time steps on 3000 shots.
- **Serve.** The serve leaves within 25 degrees of straight across, toward the side that lost the last point.
- **The computer.** It looks at where the ball will end up, but only decides every 0.4 seconds (Easy), 0.25 seconds (Medium) or 0.14 seconds (Hard), and it can move at most 140, 190 or 230 units a second. It aims with a random error that is up to 1.2, 0.7 or 0.45 of half a paddle at the starting speed, and the error grows a little faster than the ball does. That is why a rally against it does not go on forever.

### What the tests show about the computer

- A player who stands still loses to every level, every time, and the match always ends.
- A pilot that knows exactly where the ball will land, and aims for the end of its paddle away from the computer, beats Easy and Medium in all 20 of 20 test matches and beats Hard in at least 12 of 20.
- That perfect pilot needs longer to win against each harder level, in total over the same 20 seeds. So Hard really is harder than Medium, and Medium harder than Easy.
- The computer never moves faster than its level's speed, and it heads for the middle while the ball is going away from it.

The suite also plays 5000 random steps in every mode and checks that both paddles stay inside the court, the ball stays between the walls, nobody scores more than 7, one step never gives two points, and the ball is never faster than the top speed.

## Privacy and storage

Nothing is uploaded and there is no account. Your longest rally for each mode (and for the slower pace used with reduced motion) is saved in your browser's local storage under one key, as small whole numbers inside a small JSON object. The page address holds your mode so you can share it. Clearing site data removes the numbers.

## Limits

- One court and one ball. No power-ups and no curved shots.
- The computer plays only the right paddle.
- A match you leave with Restart or a mode change still counts its longest rally.
