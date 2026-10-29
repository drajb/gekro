---
title: "Code Breaker"
category: "fun"
job: "Crack a secret code of symbols in a limited number of guesses, with exact hints and a solver that replays a classic strategy on your own code."
description: "Free Code Breaker puzzle. Guess a secret code from 6 or 8 symbols, 4 or 5 pegs, with exact hints and a solver replay. No ads, no signup, runs in your browser."
aiSummary: "A free browser code-guessing game. The computer picks a secret code of 4 or 5 pegs from 6 or 8 symbols, with repeats allowed or not. Each guess is scored with two numbers: pegs that are the right symbol in the right place, and pegs that are the right symbol in the wrong place, with duplicates handled so each secret peg matches at most one guess peg. A hint counts the codes that still fit all the scores so far, and names the code when only one is left. A solver replays a Knuth-style minimax strategy: in the default game it cracks all 1296 possible codes in at most 5 guesses, averaging 4.476 guesses. Best results are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A guessing game is a small search problem, which makes it a good place to show a technique. The hint is an exact count, the solver is a well-known strategy, and the test suite checks both against brute force."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "🔐"
---

## How to play

The computer picks a secret code: a row of pegs, each one a symbol. You build a guess and submit it, and the game scores it with two numbers:

- **Right place:** pegs that are the right symbol in the right position.
- **Right symbol, wrong place:** pegs that are a symbol the secret contains, but in a different position.

A score of **2 / 1** means two pegs are right in place and one more is the right symbol in the wrong place. The same score is drawn as small pegs next to your guess: a filled dot for each right place, a hollow ring for each right symbol in the wrong place. Use the scores to narrow the code down before you run out of guesses.

Before you start you can choose the code length (4 or 5 pegs), the number of symbols (6 or 8), whether a symbol may appear more than once, and how many guesses you get (8, 10 or 12). The default is 4 pegs, 6 symbols, repeats allowed and 10 guesses.

Click a slot in the current guess, then a symbol, or type the symbol's number. Arrow keys move between slots, Backspace or Delete clears a slot, **Enter** submits, and **H** asks for a hint. With repeats off, the Submit button stays disabled while a symbol is used twice.

Every symbol has a digit, a shape and a colour: 1 circle, 2 square, 3 triangle, 4 diamond, 5 star, 6 cross, 7 hexagon, 8 pentagon. You never need to tell colours apart, because the digit and the shape say the same thing.

## How it works

**Scoring with duplicates.** Counting is easy to get wrong when a symbol appears more than once. Each secret peg can match only one guess peg. The scorer takes the exact matches first, then, for each remaining guess peg, uses up one remaining secret peg of the same symbol if there is one. So against a secret with a single 1, a guess of 1 1 1 1 scores one right place and nothing else. The tests write out a dozen of these tricky cases by hand and check that the score is symmetric and that the two numbers always add up to the number of symbols the two codes share.

**The hint is an exact count.** The tool builds the full list of possible codes (1296 for the default game, 4096 for 4 pegs and 8 symbols, 7776 for 5 pegs and 6 symbols, 32768 for 5 pegs and 8 symbols). With repeats off the lists are shorter: 360, 1680, 720 and 6720. A hint removes every code that would have scored differently on your guesses and shows what is left. When one code remains it names it; otherwise it gives the count and, if every remaining code agrees on a position, says which symbol goes there. Asking for a hint means the game no longer counts toward your best.

**The solver.** After a game ends, **Solver plays** replays a Knuth-style minimax strategy on your same secret, one guess every 600 milliseconds (instantly if your system asks for reduced motion). It opens with 1 1 2 2. After that, it scores every possible guess against every code still possible, finds the guess whose worst-case outcome leaves the fewest codes, and plays it, preferring a guess that could itself be the answer. The test suite runs it against all 1296 codes of the default game: it cracks every one in at most **5 guesses**, and it averages **4.476 guesses** (5801 guesses in total; 1 code takes 1 guess, 6 take 2, 62 take 3, 533 take 4 and 694 take 5). In the 4-peg, 6-symbol game with no repeats it also cracks all 360 codes in at most 5 guesses.

Trying every guess against every remaining code is too slow for the larger games (the biggest has 32768 codes). There the solver caps its work per step at 450,000 scored pairs: it compares only an evenly spaced sample of the codes that are still possible. On the computer I timed it on, the slowest step I saw (25 random secrets in each of the eight setups) took under 100 milliseconds, and a phone will be slower. This is not Knuth's full guarantee, so the solver's guess count on the larger games is not pinned the way the default game is.

## Privacy and storage

Nothing is uploaded and there is no account. Your best guess count for each setup and your total of games won without a hint are saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The secret is chosen with your browser's secure random number generator and exists only in the page.

## Limits

- The at-most-5-guesses result is for the default game and the 4-peg, 6-symbol no-repeat game only. The solver is not proven to be optimal in the other setups.
- Only games won without a hint count toward your best and your wins. A game restarted with the same secret (the Reset button) never counts, with or without a hint, because by then you have seen the scores or the answer. Start a new game for a fresh secret that counts.
- The game is always played against the computer, one secret at a time. There is no daily code and no two-player mode.
- Best results are per browser and per setup. Changing browser or clearing site data starts them over.

Everything runs locally in your browser.
