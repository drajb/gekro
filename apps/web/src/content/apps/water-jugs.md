---
title: "Water Jugs"
category: "fun"
job: "Play a free measuring puzzle: use two or three unmarked jugs, a tap and a drain to get an exact amount in one jug, then see the fewest moves that were possible."
description: "Free Water Jugs measuring puzzle with two or three jugs, three difficulties, undo and hints. See the exact fewest moves after you solve it. No signup."
aiSummary: "A free browser puzzle with two or three jugs that have no markings. A move fills a jug from the tap, empties a jug down the drain, or pours one jug into another until the first is empty or the second is full. The goal is to get an exact amount in any one jug. Puzzles are generated from a seed in three difficulties: Easy has two jugs of 3 to 9 and needs 4 to 8 moves, Medium has two jugs of 5 to 13 and needs 8 to 14 moves, and Hard has three jugs of 3 to 13 where leaving out any one jug makes the goal impossible or slower, and needs 7 to 16 moves. A breadth-first search over every possible set of amounts gives the fewest moves, which the page shows after the player solves the puzzle, and it gives the hint from wherever the player is. Tests compare that search with a second implementation that relaxes every edge over all positions, for every target of every pair of jugs up to size 9, for many sets of three jugs, and from every position of several puzzles. For two jugs, the measurable amounts match the number-theory rule about the greatest common divisor. Counts of solved and perfect puzzles per difficulty stay in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I find neat is that a plain breadth-first search is enough to prove how few moves a puzzle needs, and a pair of jug sizes passes or fails by a simple rule about common divisors."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🫗"
---

## How to play

You have two or three jugs. Each holds a different amount and has no markings, so the only amounts you can know for sure are "full" and "empty". The goal at the top says how much you must get in any one jug. There is a tap that fills a jug to the brim and a drain that empties a jug completely.

Each jug has buttons for its moves. **Fill** fills that jug from the tap. **Empty** pours it down the drain. **Pour into B** (or A or C) pours that jug into another until the first jug is empty or the second is full, whichever comes first. A move that would change nothing, such as filling a full jug, does nothing and says why. When any jug holds exactly the goal amount, you have solved the puzzle.

Pick a difficulty. **Easy** has two small jugs, **Medium** has two bigger jugs and a harder goal, and **Hard** has three jugs, all of which you need. **New puzzle** deals another, **Restart** empties the jugs and keeps the puzzle, and **Undo** takes back the last move. The page address holds the difficulty and the seed, so you can send someone the same puzzle.

The line "Fewest possible" stays hidden until you solve the puzzle, so it does not give anything away. Afterwards you see how your count compares. **Hint** outlines the button for the first move of a shortest route from where the jugs are now, and the status line says how many moves are left on that route. A puzzle where you used the hint is solved but not perfect. A perfect puzzle is one solved in the fewest moves without a hint. The page remembers how many you have solved and how many were perfect for the difficulty you are on.

**What you see.** The jugs are drawn to scale: a bigger jug is taller. The water level and the number under each jug show the amount. A dashed line marks the goal level on each jug that can hold it. The goal jug gets a green ring when you win, and the text always says in words which jug holds the goal.

**Keyboard.** Tab moves between the buttons, Enter or Space presses one, **U** undoes and **H** gives a hint while focus is on the jugs. A button for a move that is not possible right now is dimmed but stays reachable, so the keyboard focus never jumps away, and pressing it explains why nothing happened. The status line announces every move together with all the amounts.

## How it works

**A position is the set of amounts in the jugs.** With jugs of 3 and 5 there are 4 x 6 = 24 positions. A move takes one position to another. A breadth-first search starts at the position you are in and looks at everything one move away, then everything two moves away, and so on. The first time it reaches a position with the goal amount in some jug, no shorter route can exist, so that route length is the fewest moves. The search is the same from empty jugs, which gives the number shown after you solve, and from the current position, which gives the hint.

**Puzzles are drawn by trial.** The generator picks jug sizes and a goal at random, runs the search, and keeps the puzzle when the fewest-moves number is in the difficulty's range and the goal is not simply the size of a jug. On Hard it also runs the search with each jug left out in turn and requires that the goal becomes impossible or slower, so no jug is a decoy. The number of tries is capped, and a built-in puzzle is used if every try failed. The count of tries, not the clock, decides, so one seed gives the same puzzle everywhere.

**For two jugs there is a rule.** With jugs of size a and b, an amount can be measured exactly when it is a multiple of the greatest common divisor of a and b and no more than the larger jug. Jugs of 4 and 6 can measure 2 but never 3. Jugs of 3 and 5 can measure everything from 1 to 5.

## What the tests check

- Fill, empty and pour behave as described, and a move that changes nothing is refused.
- The fewest moves match a second implementation that restates the moves as plain transfers and relaxes every edge over all positions. This is checked for every target of every pair of jugs from 1 to 9, for 60 random sets of three jugs and every target, and from every position of four puzzles, not only from empty jugs.
- For two jugs from 1 to 12, whether a goal is reachable agrees with the divisor rule above for every goal up to 13.
- The well-known case of jugs of 3 and 5 measuring 4 takes exactly 6 moves.
- For 60 seeds in each difficulty, the generated puzzle claims the true fewest moves, is inside its difficulty range, and does not use a jug size as the goal. On Hard, leaving out any one jug makes it impossible or longer, over 40 seeds.
- Following the hint from empty jugs always takes exactly the claimed fewest moves, and from every position of a three-jug puzzle a hinted move lowers the remaining distance by exactly one.
- A saved count is accepted only as a whole number from 1 to 99999, and never shows more perfect puzzles than solved ones.

## Limits

- Jugs hold whole numbers, from 1 to 20, and there are at most three.
- The goal must be in one jug, not split across jugs.
- Hard has a limited pool of puzzles that pass the "every jug matters" test, so you will see repeats of the same sizes sooner than on the other levels.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your counts stay on your device.
