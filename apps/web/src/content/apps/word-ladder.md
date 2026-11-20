---
title: "Word Ladder"
category: "fun"
job: "Play a free word ladder: change one letter at a time to turn a start word into a goal word, with the fewest possible steps shown."
description: "Free word ladder game. Change one letter at a time to reach the goal word. Three levels, undo, hints and the shortest route shown. No ads. No signup."
aiSummary: "A free browser word ladder. The player turns a start word into a goal word by changing exactly one letter per step, and every step must be a word from a hand-written list of 261 three-letter and 655 four-letter common words. Each puzzle states the fewest steps possible, found by a breadth-first search over the graph in which two words are neighbours when they differ by one letter. Easy uses three-letter words with a shortest ladder of 3 or 4 steps, Medium uses four-letter words with 3 to 5 steps, and Hard uses four-letter words with 5 to 7 steps. A hint shows the next word of a shortest ladder that avoids words already used, undo takes back the last word, and the same puzzle number always gives the same puzzle. The tests compare every distance with an independent all-pairs computation. The count of perfect ladders per level is kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The part worth a look is the distance table: a search over the whole word graph knows the shortest ladder for every pair, so the game can tell you how close you are to the best possible."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🪜"
---

## How to play

You start with one word and a goal word, for example cat and dog. Change one letter to make a new word (cat becomes cot), then change one letter again (cot becomes dot), and keep going until you reach the goal (dot becomes dog). Each step has to be a real word, and the page checks it against its own list.

Type the next word into the box and press **Enter** or the **Add word** button. Your ladder grows downwards as a list. The letter that changed in each step has a filled square with a small triangle in its corner, so you can see it without relying on colour. The word you are on is labelled **Now**, the start is labelled **Start**, and the goal has a dashed border and is labelled **Goal**.

- **Fewest possible** is shown from the start. It is the length of the shortest ladder that exists between the two words. You can finish in more steps than that; a ladder with exactly that many steps and no hint counts as a **perfect ladder**, and the page keeps a running count for each level.
- **Undo last word** takes back your latest step. Once a ladder is finished it can no longer be undone, but **Start over** and **New ladder** are always available.
- **Hint** shows the next word of a shortest route from where you are now. It never suggests a word you have already used. A ladder where you used a hint is not counted as perfect.
- If a word is refused, the page says why in plain words: it is the wrong length, it changes more than one letter, it is already on your ladder, or it is not on the list. A word that is not on the list is never shown back to you.

**Levels.** Easy uses three-letter words and puzzles whose shortest ladder is 3 or 4 steps. Medium uses four-letter words with 3 to 5 steps. Hard uses four-letter words with 5 to 7 steps.

**Keyboard and screen readers.** Everything works from the keyboard: Tab to the box, type, press Enter. After every step the page announces the word you added and how many steps you have taken, and each row of the ladder has a spoken label that says which letter changed.

**Sharing.** Copy result puts a short line on your clipboard with the level, the puzzle number and your step count. The page address holds the level and the puzzle number, so a friend who opens it gets the same puzzle.

## How it works

The lists were written by hand: 261 words of three letters and 655 words of four letters, all lower case, with nothing rude, scary or unkind, and no names or brands. The tests check every word against a blocklist and fail if any list word is on it; the test run did catch a drink word I had slipped into the four-letter list by mistake, and it came out.

Two words are neighbours when they differ in exactly one letter. A breadth-first search from any word reaches its neighbours first, then theirs, and so on, which gives the exact length of the shortest ladder to every other word. The whole word graph is connected at both lengths, so every word can be reached from every other word. The longest shortest ladder between any two words is 14 steps for the three-letter list and 16 for the four-letter list.

To make a puzzle the generator picks a random start word, runs the search, collects every word whose shortest distance lies in the level's range, and picks one of them as the goal. The pair is never adjacent, because the lowest range starts at 3 steps. The same puzzle number always builds the same puzzle.

The hint is the second word of a shortest path found by the same search, run from the word you are on, with the words already on your ladder removed from the graph. If you have boxed yourself in so that no route is left, the hint says so and suggests Undo.

### What the tests check

| Claim | How it is checked |
|---|---|
| Distances are exact | every distance from every word compared with Floyd-Warshall, an all-pairs algorithm that shares no code with the search |
| Paths are legal and shortest | 3,000 random pairs: each step changes one letter, every word is on the list, the length matches |
| Hints stay on a shortest route | 800 searches that avoid a set of used words compared with a second search that works on plain strings |
| Puzzles obey their level | 1,500 puzzles: the shortest ladder is inside the level's range and equals the independent distance |
| Following hints always finishes in the fewest steps | 240 puzzles solved by pressing the hint button repeatedly |
| Rules of a step | wrong length, unlisted word, two letters changed, repeated word and a ladder that is too long are all refused |
| Saved counts | only whole numbers from 1 to 99,999 for the three level names survive |

## Privacy and storage

Nothing is uploaded and there is no account. The number of perfect ladders for each level is stored in your browser as small whole numbers. Clearing site data removes it.

## Limits

- Only words on the built-in lists are accepted, so a real word that is not on a list is refused. The lists favour everyday words, and some uncommon but valid words are missing on purpose.
- A ladder can be at most 40 steps long, which is far more than any puzzle needs.
- The hint gives the word itself. If you only want a nudge, try the puzzle again before pressing it.
