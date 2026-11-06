---
title: "River Crossing"
category: "fun"
job: "Play free river-crossing puzzles: ferry a farmer's animals across without leaving the wrong pair alone, or get friends over a bridge with one lantern in the least time. Six levels with the exact best score."
description: "Free River Crossing puzzles: six levels, boat and lantern puzzles, undo, hints, and the exact fewest crossings or minutes for each. No signup."
aiSummary: "A free browser puzzle collection with six levels. Boat levels: a farmer rows a boat that holds a set number of passengers, and named pairs of animals or things cannot be left alone together on the bank the boat is not on; the score is the number of crossings, and the fewest possible are 7, 9, 9 and 13 on the four boat levels. Lantern levels: four or five friends with different walking times cross a bridge in the dark, at most two at once, at the slower walker's speed, and the lantern has to be carried back; the score is total minutes, and the least possible are 17 and 23. The best score for every level comes from a shortest-path search over every arrangement of who is on which bank. Tests compare that search with a second implementation that models the rules person by person and finds distances by repeated relaxation, from every reachable position of every level, and check the two lantern levels against the classic closed-form rule. No position can trap the player, because every crossing can be undone by crossing the same group back. A hint shows the first crossing of a cheapest route from the current position. Best scores per level stay in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I enjoy is that the same small shortest-path search covers both kinds of puzzle, and that it can tell you the best possible score from wherever you are standing, not only from the start."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⛵"
---

## How to play

Everyone starts on the left bank, and everyone has to end up on the right bank. Tap the people or things you want to take along, then press **Cross**. Tap someone again to leave them behind. Anyone on the other bank from the boat cannot be picked, and the page says so.

There are two kinds of level.

**Boat levels** (1, 3, 4 and 6). A farmer rows a boat. The farmer always goes along, and the boat holds a fixed number of passengers: one on most levels, two on level 4. Some pairs cannot be left alone together on the bank the boat has just left. In level 1, for example, the fox cannot be left alone with the hen, and the hen cannot be left alone with the grain. If you try a crossing that would leave such a pair, nothing moves and the page names the pair and the bank. The score is the number of crossings.

**Lantern levels** (2 and 5). Four or five friends have to cross a narrow bridge in the dark. It holds two at a time, they need the lantern, and a pair walks at the slower friend's speed. After each crossing the lantern has to be carried back by someone, unless everyone is across. Each friend shows their time in minutes. The score is the total minutes.

The numbers above the river show your score, the best score that is possible, and your own best. **Undo** takes back the last crossing and its cost. **Restart** puts everyone back on the left bank. **Hint** picks the people for the next crossing in a cheapest route from where you are, and you press Cross yourself. A level you used the hint on does not set a best. The page address holds the level number.

**What you see.** People who are going in the boat are outlined with a dashed amber border and tagged "in boat", so colour is not the only cue. People who cannot be picked because the boat is on the other bank look dimmer, and their spoken label says where the boat is. The list under the river records each trip in words.

**Keyboard.** Tab moves between the people. Enter or Space picks or drops someone. **C** crosses, **U** undoes and **H** gives a hint, while the focus is inside the river scene. Every person has a spoken label with their bank and whether they are in the boat, and the status line announces each crossing and who is where.

## How it works

**A position is who is on which bank, and where the boat or lantern is.** With up to seven people that is at most 256 positions per level, so the whole puzzle can be searched. A crossing is a group of one or more people, no more than the boat or bridge holds, all on the boat's bank, containing someone who can carry the load. On boat levels it must also contain the farmer. After the crossing, no forbidden pair may be left together on the bank the boat just left, because nobody is there to watch them.

**The best score is a shortest path.** Each crossing costs one trip on boat levels, or the slower walker's minutes on lantern levels. A shortest-path search finds the cheapest sequence from the start to the position where everyone is on the right bank. The same search, run from the position you are in now, gives the hint, so the hint is always on a cheapest route from where you are.

**You cannot get stuck.** Crossing the same group back always restores the earlier position, and that position was already allowed. So from any position you can reach, the end can still be reached.

| Level | Kind | Best possible |
|---|---|---|
| 1 Fox, hen and grain | boat for one passenger | 7 crossings |
| 2 Four friends, one lantern | times 1, 2, 5, 10 | 17 minutes |
| 3 Dog, cat, rabbit and ball | boat for one passenger | 9 crossings |
| 4 A bigger boat | boat for two passengers, six passengers | 9 crossings |
| 5 Five friends, one lantern | times 1, 3, 4, 6, 8 | 23 minutes |
| 6 The long ferry day | boat for one passenger, six passengers | 13 crossings |

## What the tests check

- The six best scores above are what the search reports, and a second implementation agrees. The second implementation models each person on a bank with plain arrays, lists every crossing by itself, and finds distances to the goal by relaxing every edge until nothing improves. It is compared with the search from every reachable position of every level, not only the start.
- The two lantern levels also match the classic closed-form rule for the least crossing time with a lantern.
- The list of legal crossings from every reachable position matches the second implementation exactly.
- From every reachable position the goal can still be reached, and every legal crossing can be undone by crossing the same group back.
- Following the hint from the start of any level reaches the goal at exactly the best score, and from any reachable position a hinted crossing lowers the remaining best score by exactly its own cost.
- Across 3000 random games, no forbidden pair is ever left alone and every person is on exactly one bank.
- A saved best score is accepted only as a whole number from 1 to 9999 for a known level. Anything else is ignored.

## Limits

- The six levels are fixed. They are not generated, because each needs a careful set of forbidden pairs to be solvable.
- A level has at most seven people, which is what keeps the exact search instant.
- On lantern levels everyone walks at the same speed in both directions, and the lantern stays with whoever carries it.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your best scores stay on your device.
