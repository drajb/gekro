---
title: "Royal Game of Ur"
category: "fun"
job: "Play the Royal Game of Ur, an ancient dice race, against the computer at three levels or with a friend on one screen."
description: "Free Royal Game of Ur: throw four dice, race seven pieces, capture on the shared lane, land on rosettes to throw again. Three levels. No ads, no signup."
aiSummary: "A free browser version of the Royal Game of Ur, using the commonly published reconstruction of the ancient rules, for one player against the computer or two players on one screen. Each side has 7 pieces and a path of 14 squares: 4 private, 8 shared with the other side, 2 private. Four two-sided dice are thrown and the marked ones are counted, so a throw is 0 to 4 with chances of 1, 4, 6, 4 and 1 out of 16. A piece cannot land on another of its own; landing on a lone enemy piece on the shared lane sends it back to start, except on the centre rosette, which is safe; the 4th, 8th and 14th squares of a path are rosettes that give another throw; and a piece leaves the board only on an exact throw. The first side with all 7 pieces home wins. The rules engine is compared with a second implementation that works on physical board squares, on 600 random games. The computer has three levels: Easy plays a random legal piece, Medium and Hard run an expectimax search that averages over every possible throw, looking one and two moves ahead. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The computer averages over all five possible dice outcomes with their real odds, and the rules are checked against a second implementation on physical squares."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

Royal Game of Ur is a race game from the ancient Near East. The rules below are the reconstruction that is most often published; nobody knows exactly how it was played, so treat them as one good version. The board is three rows of eight squares, with four squares missing, so it is a block at the left, a narrow bridge, and a block at the right.

Each side has 7 pieces. The two sides are called Solid and Ring. Solid pieces are sky blue discs and Ring pieces are orange discs with a ring in the middle, so you can tell them apart without relying on colour. Solid uses the bottom lane and Ring the top lane. The middle lane is shared.

**The path.** Every piece travels 14 squares: four in your own lane, eight along the shared middle lane, then two more in your own lane before it leaves the board. Your own lane squares are tinted with your colour, and the shared lane is violet. Pieces start off the board in the "Waiting" box.

**The dice.** Press Throw dice. Four two-sided dice are thrown, and each one that comes up marked counts 1. So a throw is 0, 1, 2, 3 or 4, and the chances are 1, 4, 6, 4 and 1 out of 16: a 2 comes up three times in eight, a 0 or a 4 only once in sixteen. On a 0 you lose your turn.

**Moving.** Move one piece forward by the number thrown. You cannot land on one of your own pieces. If no piece can move, the turn passes by itself and the page says so. To leave the board a piece needs the exact number to land one step past its last square.

**Capturing.** If you land on a lone enemy piece on the shared lane, it goes back to the Waiting box. The centre rosette is the exception: a piece sitting there is safe, and nobody can land on it.

**Rosettes.** The star-shaped squares are rosettes. The fourth and the fourteenth square of your path are rosettes, and so is the centre of the shared lane. Landing on one gives you another throw.

**Winning.** The first side to bring all 7 pieces home wins.

Controls:

- **Opponent:** the computer or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer.
- **You play:** Solid, which throws first, or Ring, in which case the computer opens.
- **Throw dice:** the four triangles show the throw, with a gold fill for each marked die and the number beside them.
- **Undo:** takes back your last move and everything after it, and puts the same throw back so you can choose again. Once a game is over, undo is off.
- **New game:** starts again with the current settings.

After a throw, pieces that can move have a dashed outline and the square each would land on has a lime dot. Click the piece or the dotted square. A waiting piece is entered by clicking the Waiting box, and a piece that can leave the board by clicking the Home box. On the keyboard, arrow keys move around the board (Home and End jump to the ends of a row), and Enter or Space moves the piece. Every square is announced with its row, column, lane, contents and whether it is a rosette or a legal move. The page address carries your settings, so you can bookmark a setup.

## How it works

Each side's pieces are stored as positions: 0 for waiting, 1 to 14 for the path, 15 for home. Squares 5 to 12 are the shared lane, and squares 4, 8 and 14 are the rosettes. A move is legal when the landing square is not one of your own pieces, is not the centre rosette with an enemy on it, and does not overshoot home. A capture happens when you land on an enemy piece on squares 5 to 12.

The test suite pins the rules in several ways:

- **The dice:** listing all 16 outcomes of four two-sided dice gives 1, 4, 6, 4 and 1 for 0 to 4, and 32 thousand seeded throws match those odds within one percentage point.
- **The board:** each path has 14 distinct squares, the eight shared squares are the same squares for both sides, the private squares never overlap, and there are exactly five rosette squares on the board.
- **Hand-built positions:** pieces block their own side, a throw that overshoots home is refused, a lone enemy piece is captured on the shared lane and nowhere else, the centre rosette is safe, rosettes give another throw, and seven pieces home ends the game.
- **A second implementation:** a separate version, written with the 20 physical board squares as coordinates and a row-based idea of the shared lane, is run alongside the engine on 600 random games. At every move, for every throw from 1 to 4, the two give exactly the same set of legal moves, and after each move they agree on the board, who throws next and who has won.
- **Random games:** 300 more random games always finish, every side always has exactly 7 pieces, no two of your pieces share a square, and no two pieces of any colour share a shared square.

The computer comes in three levels:

- **Easy** picks any legal piece at random.
- **Medium** looks one move ahead: for each choice it averages, over the five possible throws weighted by their real odds, the value of the opponent's best reply.
- **Hard** looks two moves ahead, so it also counts its own next move.

This is an expectimax search: it takes the best move at its own turns, the worst for it at the opponent's turns, and the probability-weighted average at every throw. A position is scored by how far each side's pieces have travelled, a bonus for holding the centre rosette, and the chance that each piece standing on the shared lane is hit by the opponent's next throw. In the test suite, over 60 seeded games with sides alternating, Hard and Medium each beat Easy in at least 54, Hard beat Medium in at least 52 of 100, and a Hard move never searched more than 40 thousand positions and the suite fails if one takes 3 seconds, even on a busy machine. The computer waits about two thirds of a second before each throw and move so you can follow, and moves at once if you have asked for reduced motion. There is a lot of luck in this game, so even the strongest play loses sometimes.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes them. The session tally lives only on the page and resets when you leave it. A game in which you used Undo is not counted, so the saved figures are not inflated.

## Limits

- The rules are a reconstruction: other published versions differ, for example in whether a piece needs an exact throw to leave the board.
- Hard looks only two moves ahead and its judgement of a position is hand-made, so a clever player can beat it, and so can plain luck.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.

Everything runs locally in your browser.
