---
title: "Snake"
category: "fun"
job: "Play Snake on a 20 x 20 grid with keyboard, swipe or on-screen buttons. Pick a speed and choose between deadly walls or wrap-around edges."
description: "Free Snake game for the browser. Three speeds, walls or wrap-around, keyboard, swipe and touch controls, and a best score per setting. No ads, no signup."
aiSummary: "A free browser Snake on a 20 x 20 grid. A pure engine moves the snake one cell per tick, grows it by one segment per food eaten, and places food uniformly on empty cells. Walls either end the game or wrap to the opposite edge. A two-slot turn queue makes quick turns register and makes reversing into the neck impossible, and the tail cell counts as free on the step it leaves. A fixed-step accumulator keeps speed identical on 60 Hz and 144 Hz screens, at 6, 9 or 13 steps per second. Best scores are kept in the browser's local storage per speed and wall setting; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. Snake is small enough to read in one sitting: a grid, a list of cells and a handful of rules. This version keeps the engine free of the page, so the rules can be tested and replayed exactly."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🐍"
---

## How to play

Steer the snake to the food. Each piece you eat adds one segment and one point. Do not run into your own body, and do not run into the edge if walls are on.

- **Keyboard:** arrow keys or **W A S D** steer. **Space** or **P** pauses and resumes.
- **Touch:** swipe on the board in the direction you want to go, or use the four buttons under it. One long swipe can chain several turns.
- **Start:** the game waits until your first move, or until you press **Start**. It cannot start by turning straight back, because the snake starts facing right.

The game pauses itself when you switch to another tab and waits for you to resume.

## Speed and walls

Two settings change the game, and changing either starts a new game:

| Setting | Options |
|---|---|
| Speed | Slow 6, Normal 9, Fast 13 steps per second |
| Walls | Walls end the game, or Wrap around |

With wrap-around on, the board has no edge: leave the right side and you come in on the left. The board border turns dashed to show it. Your best score is stored separately for each of the six combinations, so a fast wrap-around score never replaces a slow walled one.

A result only counts as a best if it is a whole number of food eaten, at least one, and no more than the largest score the board allows (397, since the snake starts with three of the 400 cells). Filling every cell is a win.

## How it works

The engine is a pure function with no page attached: `step(state, direction, rng)` returns the next state and never changes the old one. That makes the rules easy to pin down with tests, and a game replays exactly when given the same random numbers.

- **Tail rule.** On a normal step the tail moves out of its cell at the same moment the head moves in, so you may step into the cell the tail is leaving. On a step that eats, the tail stays and the snake grows, so that cell is still occupied.
- **Food.** New food is picked uniformly over the empty cells only, by counting the free cells and choosing the nth one. It can never land on the snake, and the test suite checks that every free cell comes up about equally often.
- **Turn queue.** Pressing two keys within one step (up then left, say) is a normal way to make a U-turn. The game keeps up to two pending turns. Each new turn is checked against the one before it rather than against the current heading, so a turn that would reverse into the neck is dropped, however quickly keys arrive.
- **Steady speed.** The loop adds up the time since the last frame and takes a step each time a full interval has passed, so a 144 Hz screen plays at the same speed as a 60 Hz one. A frame delta is capped at a quarter of a second, so a stalled tab cannot fast-forward the snake.
- **Drawing.** The board is a canvas sized for your screen's pixel density (capped at 2x) and its colours are read from the site's own theme, so it follows light and dark mode. It is plain rectangles plus short text overlays such as Paused and Game over.

The tests run a few hundred random and food-seeking games on several board sizes, with and without wrap-around, and check after every single step that no two segments overlap, every segment is on the board and next to the previous one, the length equals the starting length plus the food eaten, and the food is never on the snake. A scripted path that visits every cell wins on 4 x 4, 6 x 6 and 8 x 8 boards.

## Privacy and storage

Nothing is uploaded and there is no account. Your best scores are saved in your browser's local storage under one key, as plain numbers, one per speed and wall combination. The page address holds your speed and wall setting so you can share it. Clearing site data removes the scores.

## Limits

- There is one board size, 20 x 20, and one starting length.
- There is no obstacle mode, power-ups or multiplayer.
- Changing speed or walls, or pressing Restart, ends the game in progress. If its score beat your best for those settings, the best is kept.
- Keyboard arrows are only captured while the game is running or the board has focus, so the page scrolls normally otherwise.

Everything runs locally in your browser.
