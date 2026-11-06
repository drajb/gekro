---
title: "Colour Tubes"
category: "fun"
job: "Play a free colour-sorting puzzle: pour layers between glass tubes until each tube holds one colour. Three to eight colours, undo, an extra tube and a hint."
description: "Free Colour Tubes puzzle for 3 to 8 colours. Pour the top colour onto a matching tube until each tube is one colour. Every level is solvable. No signup."
aiSummary: "A free browser sorting puzzle. Each tube holds four layers and each colour has exactly four layers. Pouring moves the top run of one colour onto a tube whose top layer matches or which is empty, as many layers as fit. A level is solved when every tube is empty or full of one colour. Levels have 3 to 8 colours in the same number of tubes plus two empty ones, and the player may add one extra empty tube. Every level is built by running random legal pours backwards from the solved tubes, so it is solvable by construction, and the generator keeps the most tangled of 12 candidates. Each colour has its own shape and pattern as well as a hue. The hint is a best-first search with a limit of 60,000 positions that either finds a solution, proves none exists from the current position, or reports that it ran out of budget. Tests check the pour rule against a one-layer-at-a-time model, solvability against an independent breadth-first search, and hint answers against exhaustive search on small positions. Best move counts per colour count stay in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part for me was making the generator run the rules backwards so a level can never be impossible, then checking that claim with a separate search."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🧪"
---

## How to play

Each glass tube holds up to four layers of colour. Tap a tube to pick it up, then tap another tube to pour the top colour into it. A pour works when the second tube is empty, or shows the same colour on top, and has room. If the top of the first tube is a run of several layers of one colour, the whole run moves as far as the room allows. Keep going until every tube is either empty or full of a single colour.

Pick how many colours you want, from 3 to 8. A game has that many colours in the same number of tubes plus two empty ones, so the smallest game has 5 tubes and the biggest has 10. If you get stuck you can add one extra empty tube, once per game. **Undo** takes back the last pour, **Restart** returns to the starting tubes, and **New game** deals a fresh level. The page address holds the colour count and the level seed, so you can send someone the exact level.

Tubes you can pour into get a dashed edge once you have picked one up. If you tap a tube that cannot receive the pour, that tube is picked up instead, so you can change your mind with one tap.

**Keyboard.** The arrow keys, Home and End move between tubes. Enter or Space picks up a tube and then pours. The keys 1 to 9 choose a tube directly. Escape puts a tube down, **U** undoes and **H** gives a hint. These keys only work while the focus is on the tubes.

**Colour is never the only clue.** Every colour has its own shape and its own background pattern. Blue is a circle on diagonal stripes, yellow a square on dots, red a triangle on checks, green a diamond on bars, purple a star on upright stripes, orange a plus on cross-hatching, teal a hexagon on rings and lime a pentagon on backward stripes. A key under the tubes shows all of them. Screen readers get a description of every tube, such as "from the bottom 2 blue, then 1 yellow, room for 1", and a short sentence after every pour.

A finished tube shows a tick and a green edge. The game never ends in failure. If no pour is left, the status line says so and suggests undo, the extra tube or a restart.

## How it works

**The generator runs the rules backwards.** A level begins as the solved tubes. The generator then undoes one random legal pour at a time. Undoing a pour is only allowed when playing it forwards again would move exactly the layers that were taken, which gives three small conditions that the code checks. Played in reverse order, the undone pours solve the level, so a level is solvable by construction. The generator keeps scrambling until at least k - 1 tubes are mixed (k is the colour count), no tube is already finished and few neighbouring layers share a colour. It then makes 12 candidates and keeps the one that the search below needs the most pours for, as a cheap measure of how tangled it is.

**The hint is a search with a budget.** From the current position the page runs a best-first search. A position is the sorted list of tubes, so two positions that differ only by tube order count as one. The search stops after 60,000 positions. It then does one of three things: it finds a list of pours and points at the first one, it has searched everything reachable and tells you there is no way out from here, or it runs out of budget and says it could not find a hint. The hint does not promise the shortest solution. Using the hint on a level means that level does not count toward your best.

**Your best** is the fewest pours you used to solve a level with that many colours. Undo takes a pour away from the count. Using the extra tube is allowed and still counts.

## What the tests check

- The pour rule matches a second model that moves one layer at a time, on every pair of tubes in 400 generated levels.
- For every colour count from 3 to 8, 150 generated levels each have exactly four layers of every colour, are not solved at the start, have no finished tube and replay their stored solution to a solved position.
- For 25 three-colour levels, an independent breadth-first search over tube positions agrees that the level is solvable, and finds a shortest solution no longer than the stored one.
- On 60 random positions of three colours in four or five tubes, the hint search agrees with exhaustive search about whether a solution exists, and any solution it returns plays legally to a solved position. Some of those positions have no solution, and the search reports that correctly.
- At every colour count the search finds a solution within its limit for at least 10 of 12 generated levels, and the average solution is longer at 6 colours than at 3, and longer again at 8.
- A saved best is accepted only as a whole number from 1 to 9999 for a known colour count. Anything else is ignored.

## Limits

- Eight colours is the most, because that is how many hues, shapes and patterns the page can tell apart.
- The hint can run out of budget on a hard position. Then it says so instead of guessing.
- The two-empty-tube start and the single extra tube are fixed rules, not options.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your best scores stay on your device.
