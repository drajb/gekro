---
title: "Logic Grid"
category: "fun"
job: "Play a free deduction puzzle: use the clues to work out which pet, snack, toy or drink sits in which spot, and mark a cross grid as you go. Four sizes, a daily puzzle and hints that explain."
description: "Free Logic Grid deduction puzzle with a cross grid, four sizes, a daily puzzle, and hints that name the clue they use. Each has one answer. No signup."
aiSummary: "A free browser deduction puzzle. A row of 3 to 5 spots is numbered from the left, and there are two or three groups of everyday items (pets, snacks, toys, hobbies, drinks) with one item per spot in each group. Clues say that two items share a spot, do not share a spot, sit right next to each other, that one is somewhere to the left of the other, or that one is in a given spot. The player fills a grid with crosses and ticks; a tick crosses out the rest of its row and the rest of its column inside the same group. The generator hides an answer, adds true clues in a weighted random order until an exact search that applies one clue at a time and then branches finds exactly one answer, and then drops every clue that is not needed. Tests compare that search with an independent brute force over all arrangements, check that removing any one clue leaves more than one answer, and check that every deduction the hint can give is true of the hidden answer and that following the hint always finishes the grid. The same seed gives the same puzzle, and the daily puzzle comes from the local date. Best times per size stay in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I like here is that the solver reasons the way a person does, one clue at a time, so the same code that proves a puzzle has one answer can also explain the next step in words."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🧩"
---

## How to play

Picture a row of spots numbered 1, 2, 3 and so on from the left. Each group of items, for example pets or snacks, has exactly one item in every spot. The clues tell you how the items line up. Work out which item is in which spot.

The grid has a row for every item and a column for every spot. Tap a square to cycle through three states: empty, a cross that means "not here", and a tick that means "here". A tick also crosses out the rest of its row and the rest of its column inside the same group. You see those automatic crosses as faint marks, and you can still change your own marks underneath. The puzzle is finished when every item has exactly one spot left.

There are five kinds of clue. Two items share a spot. Two items do not share a spot. One item is right next to another, on one side or the other. One item is somewhere to the left of another, not necessarily touching. One item is in a named spot. Tap a clue in the list to cross it off when you have used it. That is only a reminder for you, and it does not change the grid.

Pick a size: **Easy** has two groups of three, **Medium** two groups of four, **Hard** three groups of four, and **Hardest** three groups of five. **New puzzle** deals a fresh one. **Today's puzzle** gives the puzzle for your local date at the chosen size. **Restart** clears the grid, and **Undo** takes back the last mark. The page address holds the size and the seed, so you can send someone the same puzzle.

**Hint** looks at your marks. If one of them contradicts the answer, it points at that mark. Otherwise it finds one square you can cross out right now, outlines it, outlines the clue it used, and says why in a sentence such as "The cat is in spot 2 and the two are in different spots, so the apple cannot be in spot 2". If no single clue can help any more, it shows the item that is easiest to settle and tells you that finding it takes a longer chain of reasoning. Pointing at a wrong mark is free, but any other hint means the puzzle does not set a best time. **Check** outlines every mark that contradicts the answer without telling you what to do next, and it does not count as help.

**Keyboard.** Arrow keys, Home and End move between squares. Enter or Space cycles the square, **X** toggles a cross, **T** toggles a tick, Backspace clears it, **U** undoes, **H** gives a hint and **C** checks. The keys only work while the focus is on the grid. Every square has a spoken description such as "cat, spot 2: ticked" or "apple, spot 3: crossed out by the rules". The status line announces every change and hint. A tick and a cross are different shapes as well as different colours, and every item is named in words next to its picture.

## How it works

**A hidden answer comes first.** The generator picks the groups and items at random, gives each group a random arrangement over the spots, and lists every clue that is true of that arrangement between items from different groups. It shuffles them in a weighted order, so that clues naming a spot directly are rare, and adds them one at a time. After every second clue it asks the search whether exactly one answer is left.

**The search works like a person.** It keeps, for every item, the set of spots that are still possible. It applies one clue at a time to cross spots off, then applies the rule that each spot holds one item per group, and repeats until nothing changes. Only then does it pick the item with the fewest possible spots and try each one. It counts answers and stops at two. The step budget is a count, never the clock, so one seed gives the same puzzle on every device.

**Then no clue is spare.** Once the answer is unique, the generator tries to drop each clue in a random order, and keeps the drop whenever the answer is still unique. What is left is a set where taking away any single clue gives you more than one answer.

**The hint is the same machinery.** It builds the possible spots from your marks and asks for the first single step that would cross something off, in clue order and then by the one-item-per-spot rule. The sentence is written from the sets at that moment.

## What the tests check

- The seeded random numbers match a second implementation, and each clue type means what this page says.
- For 40 seeds at each of the first three sizes and 6 at the largest, the puzzle has exactly one answer according to an independent brute force that tries every arrangement and applies the clues by their plain meaning.
- For 12 seeds at each of the first three sizes and 3 at the largest, removing any one clue gives at least two answers.
- On 120 random clue sets that the generator never made, including false clues and sets with no answer, the search and the brute force report the same number of answers.
- Every deduction step the hint can give, over 100 puzzles, removes a spot that is not the true spot of that item.
- Following the hint from an empty grid, 15 puzzles at every size, always finishes with a solved grid and never needs a correction.
- The grid is called solved only when every item has exactly its answer spot left. A random grid is solved exactly when that is true.
- A saved best time is accepted only as a whole number of seconds from 1 to 359999 for a known size. Anything else is ignored.

## Limits

- The items are everyday objects, animals, snacks and drinks from a fixed list, so every sentence reads naturally with "the ...".
- Clues never compare two items of the same group.
- Some puzzles need a step that no single clue gives. The hint tells you when that happens and shows you the spot instead of explaining it clue by clue.

Everything runs locally in your browser. There is no account, nothing is uploaded, and your best times stay on your device.
