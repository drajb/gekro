---
title: "Word Search"
category: "fun"
job: "Play a free word search in six themes, three sizes and three levels, with drag or tap-tap selection and a hint button."
description: "Free word search in six themes with 8, 10 or 12 hidden words. Drag or tap to find them, hint included, words are child-safe. No ads. No signup."
aiSummary: "A free browser word search. A grid of 8x8, 10x10 or 12x12 letters hides 8, 10 or 12 words from six hand-written themes (animals, colours, space, food, sports, nature) or a mix of all six. Easy lays words right and down, Medium adds two slanting directions, Hard uses all eight including backwards. Words are placed longest first at a random free spot, sharing letters where they match, and the rest of the grid is filled with random letters. The finished grid is then scanned in all eight directions against a blocklist and any filler letter that completes a listed string is replaced, so a child is only ever shown words from the hand-written lists. Selection is by drag with snapping to the nearest of eight directions, by tap on the first and last letter, or by keyboard. Fastest hint-free times are kept in local storage per size and level; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part I like is the filler: random letters can spell things you do not want a child to find, so the grid is scanned in every direction and repaired before it is shown."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔎"
---

## How to play

Pick a theme, a size and a level, and a grid of letters appears, with the list of hidden words beside it (below it on a phone). Find each word and mark it. Found words get a colour of their own, a tick and a line through them in the list.

**Marking a word.** There are three ways, and you can mix them.

- **Drag.** Press on the first letter, drag to the last one and let go. The selection snaps to the nearest straight line, so a wobbly finger still works.
- **Tap, then tap.** Tap the first letter, then tap the last one. A small dot shows your first letter. Tap it again to cancel. If the two letters are not in a straight line, the start moves to the second one.
- **Keyboard.** Arrow keys move around the grid, **Enter** or **Space** picks the first letter and then the last, and **Escape** cancels.

Words are always in a straight line, and you can mark one from either end.

**Levels.** Easy hides words left to right and top to bottom, up to six letters. Medium adds two slanting directions and allows seven letters. Hard uses all eight directions, so words can run backwards or upwards, up to eight letters.

**Sizes.** Small is 8 by 8 with 8 words, Middle is 10 by 10 with 10 words, and Big is 12 by 12 with 12 words. On a narrow screen the Big size is switched off (and on the very narrowest, Middle too), because the squares would be under 28 pixels wide and too small to tap comfortably. If you make the window narrower after choosing a big size, and you have not found a word yet, the game swaps in a new puzzle at the largest size that fits and says so. If you have already found words, it keeps your puzzle (so you do not lose it), says the squares are smaller than usual, and the next new puzzle uses a size that fits.

**Hint.** The hint button puts a diamond in the corner of the first letter of a word you have not found. It works as often as you like, but a puzzle where you used a hint does not set a best time.

There is a gentle timer; it only decides your best time. A page address that includes the puzzle number lets you send a friend the same grid. Colour is never the only clue: your selection has a dashed border, found words have a solid border and a tick in the list, and the starting letter and the hint each carry their own mark. Every square has a spoken label, and the page announces what you found and how many words are left.

## How it works

The word lists are written by hand, in capital letters, three to eight letters long. The six themes hold 47 animal words, 34 colour words, 33 space words, 39 food words, 34 sport words and 37 nature words, with a few words shared between themes. The tests check that every word uses only A to Z, that no theme repeats a word, and that every theme has at least 14 short words for Easy.

To build a puzzle the generator picks the right number of words for the size, skipping any word that sits inside another chosen word, forwards or backwards (so BEAR and BEARD never meet). It then places them longest first, at a random free position and direction where the word fits, including spots that cross a placed word on a matching letter. If a word cannot fit, it starts again with different words. The same puzzle number always builds the same puzzle.

### Keeping the filler clean

Random filler letters can accidentally spell something rude. The generator keeps a blocklist of 483 strings of three letters or more: crude, sexual, hateful, violent and frightening ones, slurs and words used as insults, drink, drug and gambling words, weapons, text-speak abbreviations, and a few rude words from other languages. Very short ones are included on purpose. Two later review rounds added 180 and then 123 of them after reviewers found rude strings in real grids. After filling, it reads every row, column and diagonal in both directions. Any filler letter inside a blocked string is replaced with a new random letter, and this repeats until the grid is clean. Letters of hidden words are never changed.

Eight blocked strings also sit inside ordinary list words: in BUTTER, SHELL, ZEBRA, BRANCH and STARDUST, and in SHEEP, OLIVE and TIGER when read backwards. A blocked string wholly inside one placed word is that word and is left alone. Any other occurrence is removed, including one that mixes a listed word's letters with filler. If two listed words cross so that their own letters spell a blocked string, the layout is rebuilt. A separate brute-force reader checks 3,150 generated grids (every size, level and theme), a second reader that works on whole rows, columns and diagonals checks another 3,402, and grids are crafted to hold a blocked string in each direction. In that second check the strings a reviewer found in real grids must never appear at all. The tests also pin those eight overlaps as the only ones.

Every word a player is shown comes from the hand-written lists, and the filler never forms any of the 483 blocked strings.

### What the tests check

| Claim | How it is checked |
|---|---|
| Each size hides 8, 10 or 12 words | 40 puzzles for every size, level and theme |
| Each word sits where it was placed | letters read back along the stored path |
| Every listed word can be found again | an independent scan of all eight directions |
| No blocked string in the grid, apart from one wholly inside a listed word | brute force over every start square and direction, 3,150 grids, then whole-line reading of 3,402 more |
| Drag snapping | compared with a brute-force straight line for every pair of squares on a 6 by 6 board |
| Saved times | only whole seconds from 1 to 35,999 for known size and level keys survive |

## Privacy and storage

Nothing is uploaded and there is no account. Your fastest clean time for each size and level is stored in your browser as small whole numbers. Clearing site data removes it.

## Limits

- Words come only from the built-in lists, so the same words come back after a while. There is no way to type your own.
- Filler letters are random, so they do not look like natural text, and a harmless unlisted word can turn up by chance. Only the listed words count. The blocklist is a list I wrote, so I cannot promise it holds every rude word there is.
- Big (12 by 12) is not offered on narrow screens, and Middle (10 by 10) is not offered on the very narrowest, so that every square stays at least 28 pixels wide when you pick a size. A puzzle already in progress is kept if the window shrinks later, so its squares can be smaller than that until you start a new one.
- The timer keeps running while you think, but it pauses when the tab is hidden.
