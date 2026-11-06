---
title: "Konane"
category: "fun"
job: "Play Konane, the traditional jump-and-capture game, against the computer at three levels or with a friend on one screen, on a 6 x 6 or 8 x 8 board."
description: "Free Konane, the traditional Hawaiian jump-capture game: 6 x 6 or 8 x 8 board, three computer levels, two players, undo. No ads, no signup."
aiSummary: "A free browser Konane (the traditional Hawaiian jump-capture game) on a 6 x 6 or 8 x 8 board, for one player against the computer or two players on one screen. Stones fill the board in a checker pattern. Solid takes one of its own stones from a corner or the middle, Ring takes a stone next to the gap, then players alternate jumping a stone over an adjacent enemy stone into the empty square beyond, with any number of hops in one straight line and no turning. A player with no jump loses, so there are no draws. The move generator is compared with a second, separately written implementation on more than four thousand positions from random play, and the 4 x 4 board is solved completely to check the search. The computer has three levels: Easy plays a random legal move, Medium runs an alpha-beta search up to 3 moves deep, and Hard deepens one move at a time under a fixed budget of 80 thousand positions. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The jump generator is checked against a second, separately written one on thousands of positions, and the smallest board is solved completely to check the search."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🪨"
---

## How to play

Konane is a traditional Hawaiian game. The board starts full, with two kinds of stone in a checker pattern. The two sides are called Solid and Ring: Solid stones are amber discs, Ring stones are violet discs with a ring in the middle, so you can tell them apart without relying on colour.

**The opening.** Solid moves first, and the first move is not a jump. Solid takes one of its own stones off the board, from a corner or from the middle (four choices). Ring then takes one of its own stones that touches the gap (two choices if the gap is a corner, four if it is in the middle). Dashed outlines show which stones you may take.

**Jumping.** From then on, a move jumps one of your stones over an adjacent enemy stone, straight along a row or a column, into the empty square just beyond it. The jumped stone is removed. If the same stone can jump again in the same direction, you may keep going, as many hops as you like, and you can stop after any hop. You may never turn a corner in the middle of a move, jump your own stones, or jump two stones at once.

**Winning.** The player who cannot jump on their turn loses. Nothing can be drawn. In practice the game is about keeping more options open than your opponent while taking theirs away.

Controls:

- **Opponent:** the computer or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer.
- **Board:** 6 x 6 for a quick game or 8 x 8 for the full board.
- **You play:** Solid, which moves first, or Ring, in which case the computer opens.
- **Undo:** takes back your last move and the replies. Against a person it takes back one move. Once a game is over, undo is off.
- **New game:** starts again with the current settings. Changing the opponent, board, or (against the computer) the difficulty or side starts a new game.

Click a stone to select it; its landing squares show a lime dot with a ring around it. Click a dot to jump. The squares where the last move started and ended are tinted, and a dashed circle marks where a stone was taken. On the keyboard, arrow keys move around the board (Home and End jump to the ends of a row), Enter or Space selects a stone or jumps, and Escape deselects. Every square is announced with its row, column, contents and whether it is a legal landing square. The page address carries your settings, so you can bookmark a setup.

## How it works

The engine keeps the board as a flat array. A stone's jumps are found by walking away from it in each of the four directions: while the next square holds an enemy stone and the square beyond is empty, that is a legal landing square, and the list of taken stones grows by one. The same walk gives the stones to remove, so a move is simply a start square, an end square and the stones in between.

The test suite pins the rules in several ways:

- **Setup:** 18 stones each on 6 x 6 and 32 each on 8 x 8, with the opening choices described above.
- **Hand-built positions:** single and multi-hop jumps, no turning, no jumping a friend, no jumping two stones, no jumping off the edge, and a loss for the side that is stuck.
- **A second implementation:** a separate generator, written with coordinates and recursion rather than flat indexes, produces exactly the same set of moves on every position of 300 random 6 x 6 games and 100 random 8 x 8 games, more than four thousand positions in all.
- **Random games:** 250 random games on both sizes always end, stones are never created or moved onto the wrong colour of square, and the side that cannot move has no jump according to the second generator.
- **Exact solving:** the whole 4 x 4 game is solved by exhaustive search and the engine's alpha-beta search agrees on who wins, from the start and after each of Solid's four openings. On 6 x 6 positions with 12 stones or fewer, alpha-beta agrees with exhaustive search too, and a pruned search returns the very same value as an unpruned one at depths 1 to 4.

The computer comes in three levels:

- **Easy** picks any legal move at random.
- **Medium** searches up to 3 moves ahead with alpha-beta pruning, within a budget of 12 thousand positions.
- **Hard** deepens one move at a time, up to 16, until it has used 80 thousand positions in total. It keeps the answer from the last depth it finished. A proven win ends the search early, and a quicker win scores higher than a slower one.

Both searching levels judge a position by how many jumps each side has available, because the player with more options usually outlasts the other. Moves that tie for best are chosen at random, using a seeded generator in the tests so a game can be replayed. In the test suite, over 10 seeded games with colours alternating, Hard won at least 9 against Easy and Medium won at least 8, Hard played a winning move whenever the exhaustive solver said one existed in five endgame positions, and the suite fails if a Hard move on an 8 x 8 board takes 2.5 seconds, even on a busy machine. The computer waits about half a second before replying so you can follow its move, and replies at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The session tally lives only on the page and resets when you leave it. A game in which you used Undo is not counted, so the saved figures are not inflated.

## Limits

- Hard is a fixed search with no learning and no opening book, and its judgement of a position is a simple count of jumps.
- The 4 x 4 board is solved, but 6 x 6 and 8 x 8 are not, so the computer can lose.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
