---
title: "Fox and Geese"
category: "fun"
job: "Play free Fox and Geese on the cross-shaped board, as the fox or the geese, against the computer at three levels or a friend on one screen."
description: "Free Fox and Geese on the 33-hole cross board: 13 geese try to trap one fox. Play either side against the computer at three levels or a friend. No signup."
aiSummary: "A free browser Fox and Geese game on the 33-hole cross-shaped board. Thirteen geese start at the bottom and one fox in the middle. The geese step one hole forward or sideways and never jump. The fox steps one hole in any of the four directions or jumps over an adjacent goose into the empty hole beyond, capturing it; a capture is optional, but a jump that can be carried on must be. The geese win by leaving the fox with no step and no jump. The fox wins when fewer than 4 geese are left, which the tests prove is the fewest that can ever trap it, or when the geese cannot move. A game is drawn after 30 moves in a row with no capture and no goose stepping forward. The rules are checked against a separately written model over thousands of random positions and hundreds of random games. You can play either side. The computer has three levels for both sides: Easy plays a random legal move, Medium runs a 3-move alpha-beta search, and Hard deepens one move at a time up to 6 moves with a time budget of about 0.35 seconds. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. I checked by brute force that fewer than four geese can never trap the fox, which is why the page lets the fox win at three."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🦊"
---

## How to play

The board is a cross of 33 holes, the middle three rows and columns of a 7 by 7 grid. Thirteen geese start in the bottom part of the cross (the whole fifth row and the two short rows below it). The fox starts in the middle hole. The geese move first.

- **The geese** take turns to move one goose one hole forward (up the board) or one hole sideways, into an empty hole. They never move backward and they never jump.
- **The fox** moves one hole up, down, left or right into an empty hole. Or it jumps over a goose that is next to it, landing in the empty hole just beyond, and the goose is captured. Taking a goose is optional: you can step instead. But if the fox lands from a jump and can jump again, it must carry on, so a move can capture several geese.

The geese win by trapping the fox, so that on its turn it has no step and no jump. The fox wins when fewer than 4 geese are left, because that is too few to trap it, or if the geese have no legal move. The game is drawn after 30 moves in a row, counting both sides together, with no capture and no goose stepping forward. The page shows that count.

The geese are blue discs with a small beak that points the way they walk. The fox is an orange disc with two ears and eyes. The shapes mean you never rely on colour alone. The last move is outlined, a hole where a goose was captured is ringed, and the legal holes for the selected piece are marked with a green dot.

Controls:

- **Opponent:** the computer, or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer, and the menu is switched off in two-player games.
- **You play:** the geese, who move first, or the fox. When you are the fox the computer opens, and your fox is already selected on your turn so you only need to click a hole.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move. Once a game is over, undo is off.

To move, click one of your pieces (pieces that can move have a dashed outline) and then a marked hole. A fox jump that continues stays selected: click the next marked hole until the move is finished. On the keyboard, arrow keys move to the next hole in that direction, Enter or Space selects a piece or moves it, and Escape puts the piece down. Every hole is announced with its row, column and contents, and the status line says what each move did. The page address carries the opponent, difficulty and side.

## How it works

The board is a flat array of 49 cells, 33 of them holes. For every hole the engine precomputes the hole one step away and the hole two steps away in each of the four directions, or none when that is off the cross. Fox moves are the plain steps plus every longest chain of jumps; a goose jumped in a chain is taken off while the chain is worked out, so it cannot be jumped twice, and the hole the fox started from counts as empty, which lets a loop of four jumps end where it began.

The test suite pins the rules in several ways:

- **The board:** exactly 33 holes and 52 links between them. The opening has 13 geese and gives the geese exactly six moves, and the fox three steps.
- **Goose moves:** forward and sideways steps only, never onto another piece, never a jump.
- **Fox moves:** steps, jumps, optional captures, no jump over two geese in a row, none off the edge or into a cut-away corner, chains that must be carried on, a chain with two ways to go on offering both, and a loop of four jumps.
- **Fewer than four geese cannot trap the fox:** the suite tries every way to place 0, 1, 2 or 3 geese on the other 32 holes, with the fox on each of the 33 holes in turn, more than 160,000 placements of three geese alone, and in every one the fox has a move. It also finds a trap with four geese for a fox on the tips and corners of the arms.
- **A second implementation:** a separately written model, with coordinates and sets of strings instead of index tables, lists every legal move and decides every ending. It agrees with the engine in 5,000 random positions (any number of geese, either side to move), and move by move through 600 random games (same moves, boards, quiet count and result).
- **Games end:** a goose can step forward at most six times and there are 13 of them, so forward steps and captures are limited, and no more than 30 moves can pass between two of them. The suite asserts that no random game runs past that bound.

The computer comes in three levels and plays either side:

- **Easy** picks any legal move at random.
- **Medium** runs an alpha-beta search 3 moves ahead.
- **Hard** searches up to 6 moves ahead, one move deeper at a time (iterative deepening), and stops deepening once about 0.35 of a second has passed or 40,000 positions have been looked at, whichever comes first, so one move never ties up the page for long, even on a slow device. The deepest finished search decides the move.

Both searches score a position from the geese's side and the fox plays for the opposite score. The score is 100 per goose, plus 3 for every row each goose has advanced, minus 2 for every hole the fox could reach by walking, minus 6 for every empty step beside the fox, minus a penalty for each jump the fox has available right now. A trapped fox or a fox win scores far above or below those figures. Moves that capture, and goose steps forward, are tried first, and moves that tie for best are chosen between at random.

The alpha-beta search is checked against a plain minimax with no pruning, which gives the same value at depths 1 to 3 (and 4 where the move list is short) in positions from random games. In the test suite, Medium won at least 5 of 6 games against Easy playing the fox, and at least 5 of 6 playing the geese. Hard searching 4 moves ahead did the same. In the suite's test positions, Medium and Hard take a goose that is hanging when it is the fox's turn, and when it is the geese's turn they move so that the fox has no capture. The suite asserts that Hard answers every position it is asked about in under 4 seconds, a bound loose enough for a slow machine; the design limit is about a third of a second. The computer waits about 0.45 seconds before moving so you can follow along, and moves at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty (for both sides added together) is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes it. The session tally lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Hard is a fixed search of at most 6 moves with no learning and no opening book, and the evaluation is a simple hand-made one.
- Capturing is optional for the fox; some rule sets force it, this page does not.
- Moves are along the lines only, with no diagonal steps or jumps.
- The draw rule is the page's own: 30 quiet moves in a row. A fox that keeps stepping while the geese only shuffle sideways will draw the game.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
