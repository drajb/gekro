---
title: "Letter Grid"
category: "fun"
job: "Play a free word-finding game: trace or type as many words as you can in a grid of letters before the clock runs out, on 4x4, 5x5 or 6x6."
description: "Free Letter Grid word game. Trace words through touching letters on a 4x4, 5x5 or 6x6 grid, with a 2 or 3 minute round or no timer. No signup."
aiSummary: "A free browser word game. A grid of letters (4x4, 5x5 or 6x6) is drawn at random, weighted towards common letters, and kept only if it holds enough words. The player traces a path through touching tiles, sideways, up, down and diagonally with no tile used twice, or types a word, and words of 3 to 7 letters score by length (3 and 4 letters score 1 point, then 2, 3 and 5). Rounds last two minutes, three minutes or have no timer. The validity list is the public-domain list of five-letter words plus hand-written everyday words of three to seven letters, nearly 16,000 words in all, with a blocklist of crude words and slurs removed from every list. At the end only hand-picked everyday words are shown as missed, and a never-show filter holds back words about violence, weapons, death, fear, crude or bodily things, drink, drugs, sex, abuse, crime and insults. Tests compare the solver with a brute-force walk over every path, and check that no blocked word can score or be shown. Best scores are kept in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part worth reading about is the word check: it only shows you words from a hand-picked list, and a blocklist keeps rude words out of every list."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔤"
---

## How to play

Find as many words as you can in the grid. A word is made by following a path of **touching tiles**: next to each other sideways or up and down, or touching at a corner. A tile can be used once in a word. Words have **3 to 7 letters** and score by length:

| Letters | Points |
|---|---|
| 3 or 4 | 1 |
| 5 | 2 |
| 6 | 3 |
| 7 | 5 |

Choose a grid size (4x4, 5x5 or 6x6) and a round: **2 minutes**, **3 minutes**, or **no timer**. The round starts when you press **Start**, or as soon as you trace or type your first word. Pressing **Finish round** ends it early. With no timer you play until you press Finish, and the clock just counts up.

### Three ways to add a word

- **Drag.** Press on a tile and drag across touching tiles. The tiles in your word turn amber with a step number on each, and your word appears in the box. Let go to add it. Drag back onto the tile before the last one to take the last tile off.
- **Tap.** Tap tiles one after another. Tap the last tile again, or press **Add word**, to submit. Tapping a tile that does not touch the last one starts a new word.
- **Type.** Type a word in the box and press Enter or **Add word**. The game finds the path itself.

A word that scores shows a green tick on its tiles and joins the list. If a word is not accepted the game says why in a short sentence without repeating what you typed: too short, too long, cannot be spelled with touching tiles, already found, or not in the word list.

### Keyboard and screen readers

Tab onto the grid, then use the **arrow keys** to move over the tiles. **Enter** or **Space** adds the tile, **Backspace** removes the last tile and **Escape** clears the word. Every tile has a label with its letter, row and column, and with its step number when it is in your word. Scores, rejected words and the time left at 30 and 10 seconds are announced. The vowel and consonant tiles differ in colour, but every letter is written on its tile, and the tiles in your word are marked with numbers as well as colour.

### At the end

The game shows your score and the number of words found. Below that it lists **everyday words you missed**, longest first, up to 30. These come only from a hand-picked list of everyday words, and a never-show filter is applied on top of that. The filter holds back a word if it is on a list of 886 words, or if it starts with one of 137 word beginnings such as "scare" or "murder". It covers violence, weapons, death, fear, crude or bodily words, drink and bars, gambling, drugs, sex, abuse, crime and insults, so you will not be shown "ghost", "monster", "toilet", "rifle", "hate" or "rotten" as a missed word. The same words are also taken out of the hand-picked list itself. You will never be shown a word you did not type unless it passes both the list and the filter. Your best score for each grid size and round length is kept on your device.

## How it works

**Making a grid.** Each tile is drawn at random with the letters weighted towards the common ones, with no Q. A grid is kept only if it has a sensible share of vowels (between 28% and 50% of the tiles) and enough words in it: at least 40 words and 20 everyday words on 4x4, 100 and 55 on 5x5, and 160 and 90 on 6x6. If a grid is short, it is thrown away and a new one is drawn.

**Finding every word.** A search starts from each tile and extends the path one touching tile at a time. It stops early whenever the letters so far are not the start of any word, which keeps it fast. It returns each word it finds with one path that spells it, so the game knows exactly which words are in the grid.

**The word lists.** The words that score are the five-letter words of a public-domain word list, plus hand-written everyday words of three, four, six and seven letters, in two lists of about 7,900 and 870 words. In all that is nearly 16,000 words. The five-letter coverage is complete, but the others are chosen by hand, so a real word that is not on the list can still be refused, and words of eight or more letters do not score. A blocklist of crude words, slurs, drink and drug words (370 in all) is taken out of every list, and it is also checked when you add a word. A word the never-show filter holds back can still score if you type or trace it, unless it is also on the blocklist, but it is never shown to you.

### What the tests check

- Every word in all three lists is lowercase letters, 3 to 7 long, with no duplicates, and the words file is well under 400 KB.
- All the five-letter words in the public-domain list are present except blocked ones, and every five-letter word in the game's list comes from it or from the hand-picked set.
- Nothing on the blocklist is in any list, and nor is anything on a second, separate list of crude words written for the test.
- A separate list of more than 150 violent, scary, crude and similar words, written for the test, is never in the list of words that are shown. A simulation of 2,100 rounds on 4x4, 5x5 and 6x6 grids, with random words found, checks that the missed-words list never contains one of them, and a second run on 150 real generated grids does the same.
- The filter's own lists have no word in the shown list, and the words a reviewer saw ("maim", "pierce", "rifle", "riot", "hate", "hurt", "smash", "bash", "monster", "ghost", "scare", "scream", "toilet", "stool", "guts", "spew", "burp", "bury", "rotten") are held back but still accepted when typed.
- Ordinary words people try, such as people, station, teacher, castle and walking, are accepted.
- On many random grids, the solver finds exactly the dictionary words that an independent walk over every possible path finds: 40 grids of 4x4, 12 of 5x5 and 2 of 6x6, with no shortcuts in the walk.
- The path finder agrees with that walk on whether any given string can be spelled.
- The grid generator meets the minimum word counts above for 60 seeds at every size, and the same seed always gives the same grid.
- The missed words are only everyday words, never one you found, always longest first.

## Privacy and storage

Nothing is uploaded and there is no account. Your best score for each grid size and round length is kept in your browser as a small whole number inside a small JSON object. Text you type is never shown back unless it is a word that scored.

## Limits

- The list is generous but not complete, as described above.
- Scoring only counts words from 3 to 7 letters. There is no bonus for the longest word.
- On a very narrow screen the 6x6 grid has smaller tiles, about 40 pixels wide.
- The grid catches touch gestures, so scroll the page from the area around it.
