---
title: "Match Pairs"
category: "fun"
job: "Play a free card-matching game in four grid sizes, from 12 to 36 cards. Your fewest moves and best time are saved per size, in your browser only."
description: "Free Match Pairs card game in four sizes, 12 to 36 cards. Saves fewest moves and best time per size. Keyboard playable. No ads, no signup, runs in your browser."
aiSummary: "A free browser pairs game. Cards lie face down in a grid of 12, 16, 20 or 36 cards; you flip two per turn, a match stays face up and a mismatch turns back after 900 ms. The deck is shuffled with an unbiased Fisher-Yates shuffle driven by the browser's crypto random generator, and the engine is a small immutable state machine (idle, one open, resolving) that ignores illegal flips. One move is two flips, the fewest possible is one move per pair, and fewest moves and best time are stored separately per size in local storage as small numbers inside a small JSON object. Cards use 18 text symbols with a colour as a second cue, and the whole grid works from the keyboard."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A shuffle, a three-state machine and a grid, with no account, and your game data stays on your device."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🃏"
---

## How to play

Cards lie face down in a grid. On each turn you flip two. If they show the same symbol, the pair stays face up. If not, both turn back down after about 900 milliseconds, and you cannot flip anything else until they have. Find every pair in as few moves as you can.

One move is two flips. The fewest moves possible is one per pair, which you only get by luck. The timer starts on your first flip and pauses while the tab is hidden.

Pick a size from the **Size** menu:

| Size | Grid | Cards | Pairs |
|---|---|---|---|
| Small | 4 x 3 | 12 | 6 |
| Medium | 4 x 4 | 16 | 8 |
| Large | 5 x 4 | 20 | 10 |
| Huge | 6 x 6 | 36 | 18 |

**Keyboard:** Tab into the grid, then use the arrow keys to move between cards, **Enter** or **Space** to flip the focused card, and **Home** and **End** to jump to the first and last card. Only one card is in the Tab order at a time, so you do not have to tab through all 36.

Every symbol has its own colour, but colour is only a second cue. Each card also has a different shape, and its accessible name says "face down", "face up" or "matched" along with the symbol, so the game never depends on colour alone.

## How it works

The game is two small pieces: a deck builder and a state machine. Both are pure functions with no page code in them, which is what lets the test suite check the rules directly.

**The deck.** Each game picks the symbols it needs at random from a set of 18, puts two of each in a deck and shuffles it with a Fisher-Yates shuffle. That shuffle makes every ordering equally likely, provided the random numbers are uniform. In the browser they come from the crypto random generator rather than `Math.random`. The test suite feeds the shuffle thousands of seeded games and checks that each card position gets each symbol about equally often, and that the partner of a card is equally likely to be anywhere else in the grid. It is a sanity check, not a proof, but it would catch the usual shuffle mistakes.

**The state machine.** The game is always in one of three phases:

1. **idle:** nothing is waiting, so any face-down card can be flipped.
2. **one-open:** one card is face up, and the next flip completes a move.
3. **resolving:** a mismatch is on show, and flips are ignored until the delay ends.

Each state is immutable. A flip returns a new state, or the very same object if the flip is not allowed: flipping a card that is already face up, flipping a matched card, flipping during resolving, or an index outside the grid. After the delay the page asks the machine to resolve, which turns the mismatched pair back down. Winning is simply "pairs found equals total pairs".

The tests also play whole games: a player who knows the deck finishes in exactly one move per pair on every size, random play always finishes, and a player who remembers cards seen so far needs fewer moves on average than one who does not.

## Privacy and storage

Nothing is uploaded and there is no account. Your fewest moves and your best time for each size are saved in your browser's local storage under one key, as small numbers inside a small JSON object. The time is kept in whole seconds, rounded down the same way the clock on the page counts, so the saved time matches what the clock showed. They are updated only when you win a game, and only if the result beats the old one. Clearing site data removes them.

## Limits

- Fewest moves and best time are separate records, so they can come from different games.
- The timer measures time with the tab visible, so a game you leave open in another tab does not run up the clock.
- The shuffle is checked by statistical tests, which can show a bias but cannot prove there is none.
- The result you copy contains the game name, the board size, your moves and time and the page address, or a note that the game was unfinished.
- There are no scores shared between players and no multiplayer mode.

Everything runs locally in your browser.
