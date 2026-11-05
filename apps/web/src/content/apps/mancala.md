---
title: "Mancala"
category: "fun"
job: "Play free Mancala (the classic six-pit rules) against the computer at three levels, or with a friend on the same screen. Extra turns, captures and undo."
description: "Free Mancala on two rows of six pits: play the computer at three levels or a friend on one screen. Extra turns, captures, undo. No ads. No signup."
aiSummary: "A free browser Mancala game that uses the classic six-pit rules: two rows of six pits, a store at each end, 3, 4 or 5 seeds in every pit to start. A move picks up one pit and drops a seed in each following pit, skipping the opponent's store. A last seed in your own store gives another turn, and a last seed in an empty pit on your side captures the seeds across from it. The game ends when one side has no seeds left and the other side keeps its own seeds. The rules are checked against a second, separately written implementation over 3,000 random games, and the whole 3-pit, 2-seed game is searched for loops and solved exactly to check the alpha-beta search against plain minimax. The computer has three levels: Easy plays a random pit, Medium runs a 4-move alpha-beta search, and Hard deepens one move at a time up to 8 moves with a time budget of about 0.35 seconds. Win counts and the biggest winning margin per level are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The rules engine is checked against a second implementation written a different way, and the whole small board is solved exactly to test the computer's search."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🌰"
---

## How to play

The board has two rows of six pits and a long pit, called a store, at each end. Every pit starts with 4 seeds (you can choose 3 or 5). The bottom row and one store are yours; the top row and the other store belong to your opponent. On a wide board the stores are the long pits at the two ends (yours on the right, your opponent's on the left); on a narrow screen they become bars, yours below your row and your opponent's above the top row.

On your turn you pick one of your pits that has seeds in it. All its seeds are picked up and dropped one at a time into the pits that follow, going to the right along your row, into your store, and on along your opponent's row from right to left. Your opponent's store is skipped. Two rules decide most games:

- **Extra turn.** If your last seed lands in your own store, you move again.
- **Capture.** If your last seed lands in an empty pit on your own side, and the pit straight across from it has seeds, you take those seeds and your landing seed and put them in your store.

The game ends as soon as one side has no seeds left in its pits, even when it is the other side's turn. The seeds still on the board stay with the side they are on and go to that side's store. The bigger store wins, and equal stores are a draw. A pit holding 13 seeds drops one seed in every pit except your opponent's store and ends in the pit it started from, which then counts as an empty landing pit.

Controls:

- **Opponent:** the computer, or two players on the same screen. With two players the bottom player sows first.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer, and the menu is switched off in two-player games.
- **You play:** First or Second. When you play second the computer opens, and the board is turned so that your pits are still along the bottom.
- **Seeds per pit:** 3, 4 or 5. Changing it starts a new game.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move. Once a game is over, undo is off.

The pits you can play are outlined. The seeds are shown as small coloured dots, and every pit also shows its count as a number, so colour is never the only clue. The pits that just received seeds are tinted, the pit you last played has a dashed outline, and a captured pit is tinted too. Seeds drop one by one so you can follow a move; with reduced motion switched on in your system, the move happens at once. On the keyboard, arrow keys move between pits, Home and End jump to the ends of a row, and Enter or Space plays the pit. Every pit is announced with its row, number and seed count, and the status line says what each move did, including extra turns and captures.

The page address carries the opponent, difficulty, side and seed count, so you can bookmark a setup.

## How it works

The engine keeps the board as a ring of 14 cells: six pits, a store, six pits, a store. Seeds go to the next cell in the ring, and the opponent's store is skipped, so a full lap is 13 seeds. The opposite pit of cell i is cell 12 minus i. Everything is whole numbers, and the engine never touches the page.

The test suite pins the rules in several ways:

- **Opening:** 6 pits of 4 seeds per side, 48 seeds in all, and exactly one opening move that gives an extra turn (the third pit).
- **Sowing:** the skipped store, a lap of 13 seeds, and which cells receive a seed are checked on hand-worked positions.
- **Captures:** a capture happens only when the landing pit was empty and the pit across has seeds. It does not happen on the opponent's side, in a pit that already had seeds, or on an extra turn.
- **Ending:** the sweep to the stores, a draw, and a safety limit of 1,000 moves after which each side keeps its own seeds. In 3,000 random games the longest game was well under half of that limit.
- **A second implementation:** a separately written model of the rules, with each side as its own array and a track of 13 cells that makes the skip automatic, was compared with the engine after every move of 3,000 random games on boards of 3, 4 and 6 pits. They agree on legal moves, boards, extra turns and captures, and the seed total never changes.
- **No loops on the small board:** with 3 pits per side and 2 seeds each, every reachable position was visited, no position repeats on any path, and the game is solved exactly.
- **The search:** the alpha-beta search gives the same value as a plain minimax with no pruning on every position of that small board, and at depths 1 to 4 on the real board for positions taken from random games. On that small board its chosen move is always one of the best moves, whatever the random seed.

The computer has three levels:

- **Easy** picks any pit with seeds in it at random.
- **Medium** runs an alpha-beta search 4 moves ahead.
- **Hard** searches up to 8 moves ahead, one move deeper at a time (iterative deepening), and stops deepening once about 0.35 of a second has passed or 100,000 positions have been looked at, whichever comes first, so one move never ties up the page for long, even on a slow device. The deepest finished search decides the move; a search cut off by the clock is thrown away.

Both searches score a position by the lead in the stores (10 points per seed), then by the seeds still sitting on each side (2 points per seed), with a small bonus for having the move. A finished game scores as a win or a loss that outranks any of those figures. An extra turn keeps the same player to move, so the search does not flip the sign there. Moves are tried in a useful order, extra turns and captures first, so pruning cuts branches sooner. Moves that tie for best are chosen between at random.

In the test suite, over seeded games with the first move alternating, Medium won at least 10 of 12 against Easy, and Hard searching 5 moves ahead won at least 5 of 6. The suite asserts that Hard answers every position it is asked about in under 4 seconds, a bound loose enough for a slow machine; the design limit is about a third of a second. The computer waits about 0.45 seconds before it moves so you can follow along, and moves at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count and your biggest winning margin for each difficulty are saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The session tally lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Hard is a fixed search of at most 8 moves with no learning and no opening book.
- The evaluation is a simple hand-made one that knows nothing about long-range plans, so a careful player can beat it.
- These are the classic six-pit rules. Other regional rule sets (different capture rules, or sowing that continues from a non-empty last pit) are not included.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
