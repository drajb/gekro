---
title: "Cryptogram"
category: "fun"
job: "Play a free cryptogram: decode a traditional proverb in which every letter has been swapped for another, with hints, a check button and letter counts."
description: "Free cryptogram puzzle with 90 old proverbs in three levels. Fill in letters, ask for a hint, check your work or see letter counts. No ads. No signup."
aiSummary: "A free browser cryptogram. Each puzzle takes one of 90 hand-picked traditional proverbs and replaces every letter with another letter using a random alphabet in which no letter stands for itself (a single-cycle shuffle). A guess for one code letter fills it in everywhere at once, and each real letter can be the answer for only one code letter. Easy uses the 29 shortest sayings (21 letters or fewer) and shows 3 letters already solved, Medium uses 29 sayings of 22 to 27 letters with 1 letter given, and Hard uses the 32 longest with none given. A hint solves one code letter at random and fixes it, Check marks wrong letters, a letter-count table shows how often each code letter appears, and Show the answer ends the puzzle. The same puzzle number always gives the same puzzle. Puzzles solved without help are counted per level in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The alphabet is shuffled with a method that guarantees no letter maps to itself, which is a rule many printed cryptograms follow and a useful clue when you are stuck."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔐"
---

## How to play

A saying appears with every letter replaced by a different letter. Under each square you see its **code letter**, and the big space above it is for your guess. Work out what each code letter stands for.

- **Select a square** by clicking, tapping or moving with the arrow keys. Left and right move one square, up and down jump to the previous or next word, Home and End go to the first and last square.
- **Type a letter** on the keyboard, or tap one of the keys under the puzzle, to guess what the selected code letter stands for. Every square with that code letter fills in at once. Backspace, Delete or the Clear key removes the guess.
- **A real letter belongs to one code letter.** If you give E to a second code letter, it moves there and the first one is emptied, and the page tells you so. A key shows a dot when its letter is already in use.
- **No code letter stands for itself.** If Q is a code letter, then Q is never the answer for it.
- **Hint: reveal a letter** picks a code letter you have not got right yet, solves it and fixes it in place. It is chosen at random.
- **Check my letters** marks every wrong guess with a cross and a dashed border. Empty squares are not counted as wrong.
- **Letter counts** (in the panel beside the board on a wide screen, below it on a phone) shows how many times each code letter appears. In English text E, T, A, O, I, N and S are usually the most common letters, so the code letter that appears most is a good first guess.
- **Show the answer** ends the puzzle and shows the saying.

**Levels.** Easy has short sayings and starts with 3 letters already filled in. Medium has middle-length sayings with 1 letter given. Hard has the longest sayings and gives nothing. Given letters have a filled square with a small square in the corner, so you can tell them apart without relying on colour, and they cannot be changed. The code letter you are on gets a bold border, and the other squares that share it have a dotted underline on their code letter.

A puzzle where you used a hint or the answer is not counted as solved without help, and starting it over does not change that. The page keeps the number you have solved without help for each level. **Copy result** puts a short line on your clipboard with the level, the puzzle number and how it went. The page address holds the level and puzzle number, so a friend gets the same puzzle.

**Screen readers and keyboard.** Every square has a spoken label with its word, its position, its code letter and your guess. The page announces each change, for example that a code letter is now a certain letter in a number of places. Letters can be typed anywhere inside the game apart from the level menu, and Tab moves out of the puzzle as usual. The letter keys under the puzzle are a single tab stop: Tab reaches them once, and the arrow keys move between letters.

## How it works

The sayings are old proverbs that no one owns, picked by hand and written out in full. There are 90 of them. There is no author line on any of them because none is a quotation from a particular writer. The tests check that each one uses only letters, spaces and a few marks, has between 12 and 60 letters, appears once, and contains no word on a blocklist of rude, violent, frightening or unkind words.

The secret alphabet is made with Sattolo's shuffle, which always produces one single cycle through the 26 letters. That means every letter stands for a different letter, and the result is the same for a given puzzle number. The saying is then encoded letter by letter and the punctuation stays where it was.

The game keeps one guess per code letter. Setting a guess is refused for a letter that is not in the puzzle, for anything that is not A to Z, and for a given or hinted letter. A puzzle counts as solved when every code letter in it holds its true letter. A hint chooses one of the code letters that is empty or wrong, so it never wastes a hint on a letter you have right.

### What the tests check

| Claim | How it is checked |
|---|---|
| 90 sayings, 29 for Easy, 29 for Medium and 32 for Hard | counted, and each saying belongs to exactly one level |
| The alphabet never maps a letter to itself | 504 keys built with different seeds and with extreme random numbers |
| The alphabet is one cycle through all 26 letters | followed round for 100 seeds |
| Decoding returns the saying | every saying encoded, then decoded with an independently built inverse |
| Easy shows 3 letters, Medium 1, Hard none, and they are correct | 1,500 generated puzzles |
| Entering the true letters always solves it | 180 puzzles at every level, entered in shuffled order |
| One real letter never sits on two code letters | 6,000 random edits |
| Check reports exactly the wrong letters | 300 random states compared with a plain loop |
| Hints are right and eventually solve the puzzle | 200 random states, then repeated hints to the end |
| The letter counts add up | counted again by hand for 120 puzzles |

## Privacy and storage

Nothing is uploaded and there is no account. The number of puzzles solved without help, per level, is stored in your browser as small whole numbers. Clearing site data removes it.

## Limits

- The game checks your answer against the saying it chose, so a different way of reading the code that also happens to make sense would not be accepted. With sayings this long that is very unlikely, but it is possible on the shortest ones.
- There are 90 sayings, so after a while you will meet one again, with a different secret alphabet.
- Only the 26 letters A to Z are used. The sayings have no accents, digits or quotation marks.
- You cannot type your own text to encode.
