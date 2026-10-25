---
title: "Word Guess"
category: "fun"
job: "Guess the hidden five-letter word in six tries. Play a daily word that is the same for everyone, or a random one, with optional hard mode and local statistics."
description: "Free five-letter word game: six guesses, a daily word, random words, hard mode and stats. Checked against a public-domain list. No ads, no signup."
aiSummary: "A free browser word game. The player has six guesses to find a hidden five-letter word. Every guess must be a word in ENABLE, a public-domain word list (8,636 five-letter words); a rejected guess does not use up a row. Each tile is scored as right letter in the right place, in the word but elsewhere, or not in the word, using a two-pass method so repeated letters are marked no more often than they occur in the answer. The hidden word comes from a hand-written list of more than 1,200 common words. Today's word is the same for everyone on the same local date, chosen from a fixed shuffle of that list with no server, so it never repeats until every answer has been used. Random words, an optional hard mode, an on-screen keyboard, full physical keyboard support, a copyable share result that never reveals the word, and local statistics (played, win percentage, daily streak, guess distribution) kept as plain numbers in the browser. Nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A scoring function, a fixed daily shuffle and a streak rule, each with its own tests. The fiddly part is repeated letters, so there are hand-written cases for them plus a property test over thousands of random pairs."
status: "active"
publishedAt: "2026-10-25"
lastVerified: "2026-10-25"
license: "MIT"
icon: "🔤"
---

## How to play

Find the hidden five-letter word in six guesses. Type with your keyboard or tap the on-screen keys: letters fill the row, Backspace or Delete removes one, Enter submits. A guess must be a real word from the list. If it is not, you see "Not in the word list" and the row is not used up.

After each guess every tile gets one of three marks. The mark is never colour alone:

- **Check mark, solid tile:** the right letter in the right place.
- **Diamond:** the letter is in the word, but somewhere else.
- **Cross, dimmed tile:** the letter is not in the word.

The on-screen keys show the best thing you know about each letter: a letter found in the right place beats a letter found in the wrong place, which beats a letter ruled out.

**Today's word** is the same for everyone who plays on the same date, and it follows your own local date, so it changes at your midnight rather than at one moment worldwide. Once you finish it, the page shows your result and tells you a new word comes tomorrow. **Random word** gives a fresh word whenever you like, including after you have finished today's.

**Hard mode** adds two rules. A letter you have found in the right place must stay there, and every letter you have found must be used in your next guess. A guess that breaks a rule is refused with a specific message, such as "Position 3 must be R" or "Guess must contain E", and does not use up a row. Hard mode can only be switched before your first guess of a game.

When the game ends you can copy a result that looks like this:

```
Word Guess 2026-10-25 3/6
..+..
.+##.
#####
```

Each line is one guess: `#` for a right letter in the right place, `+` for a letter in the word but elsewhere, `.` for a letter not in the word. A lost game shows `X/6`. The result contains no letters, so it never gives the word away.

## How it works

**Two word lists.** Guesses are checked against the five-letter words of ENABLE, a public-domain word list: 8,636 words. The hidden word comes from a separate, hand-written list of more than 1,200 common words that a general player knows. Every one of them is also in the guess list, so any answer can be typed as a guess. Keeping the lists apart means you can use an unusual real word as a guess, but the hidden word is never one you would need a dictionary for.

**Scoring takes two passes.** Repeated letters are where scoring goes wrong. The first pass marks every exact match and counts the answer letters left over. The second pass walks the guess from left to right and marks a letter "in the word" only while the answer still has an unmatched copy of it. So with the answer ABBEY and the guess BABES, the B in the right place is correct, the other B and the A are in the word, and the S is not. The tests cover this with hand-written cases for repeated letters, plus a property check over 20,000 random pairs: for every letter, the number of correct and in-the-word marks equals the smaller of its count in the guess and its count in the answer, so it can never exceed its count in the answer.

**The daily word has no server.** The answer list is put in a fixed shuffled order, and the date becomes a day count that moves one step through that order each day. Everyone with the same date gets the same word. Two days in a row never share a word, and a word does not come back until every answer has been used once, which takes more than three years. The tests check that the word is the same every time for a date, that consecutive dates differ across month, year and leap-day boundaries, that no word repeats inside any window of 365 days, and that a full cycle uses every answer exactly once.

**Hard mode never rules out the answer.** The tests play hundreds of games in which every guess obeys hard mode and check that the real answer is always still allowed.

**Streak rules.** A daily win on the day after your previous finished daily adds one to the streak. A daily win after a missed day starts again at one, and a daily loss resets it to zero. Random games count toward games played, wins and the guess distribution, but never change the daily streak. The streak is shown as zero once a whole day has been missed. A daily result for a given date is counted once, so reloading the page cannot hand out a second attempt: your guesses for today's word are saved and restored.

## Privacy and storage

Nothing is uploaded and there is no account. Your statistics are saved in your browser's local storage under one key, as plain numbers: games played, wins, current and best daily streak, how many wins took one to six guesses, the date of your last finished daily game, and today's guesses for the daily word (each guess stored as a number). The page never puts the word or your guesses in its address, so a link to the page never reveals anything. Clearing site data removes the statistics, and anything unreadable in storage is ignored rather than trusted.

## Limits

- The daily word follows your local date, so two players in different time zones can briefly see different words.
- The hidden word is always from the answer list, which is much shorter than the guess list. Rare words are accepted as guesses but are never the answer.
- Guesses are checked against ENABLE, which is a North American word list compiled some time ago. A newer word may be refused, and many words in the list are ones most people have never seen.
- Switching to a different word before finishing a random game abandons it, and it is not counted. An unfinished daily game is kept for the rest of the day, as long as your browser allows local storage.
- Statistics live in one browser on one device. There is no sync between devices.

Everything runs locally in your browser.
