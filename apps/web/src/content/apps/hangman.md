---
title: "Hangman"
category: "fun"
job: "Play free Hangman with over 800 words in six categories and three difficulties. A hint is available, and it costs a guess."
description: "Free online Hangman with over 800 words, six categories, three difficulties, a hint that costs a guess and a win streak. No ads, no signup."
aiSummary: "A free browser Hangman. Words come from a fixed list of more than 800 common words, mostly nouns in six categories (animals, food, places, science, technology, home and everyday objects), four to eleven letters long. Easy uses 4 to 5 letters, Medium 6 to 7 and Hard 8 or more. The player gets six wrong guesses, with a gallows drawn in SVG, an on-screen A to Z keyboard and full physical keyboard support. A hint reveals one hidden letter and counts as a wrong guess; it is never offered when it would end the game or finish the word. The last 20 words are not repeated within a session. Win streak and best streak are kept in the browser's local storage as two small numbers; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A word list, a few pure functions and a gallows, with the rules written down and tested."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🪢"
---

## How to play

Guess the hidden word one letter at a time. Tap a letter on the on-screen keyboard or type it on your own keyboard. Typed letters count while focus is on the game or on the page itself, not while it is on a link, menu or other control elsewhere on the page, so reading or navigating the site never uses up a guess. A correct letter fills in every place it appears. A wrong letter draws one more part of the figure on the gallows, and the sixth wrong guess ends the game. Solve the word before that and you win.

Pick a **Category** (or leave it on Any) and a **Difficulty**:

- **Easy:** 4 or 5 letters.
- **Medium:** 6 or 7 letters.
- **Hard:** 8 or more letters, up to 11.

Each letter you use is marked on its key with a symbol as well as a colour (a tick for correct, a cross for wrong), so the state is clear without relying on colour alone. The word is also written out as text under the blanks, for example "6 letters: _ a _ _ e _", which screen readers announce as it changes.

The **Hint** button shows one hidden letter and counts as one of your six wrong guesses. It is switched off when using it would end the game, and also when only one different letter is left, because a hint should help you, not finish the word for you.

Your **Streak** goes up by one with every win and goes back to zero after a loss. **Best** keeps your longest run. Starting a new word after you have already guessed or used a hint counts as giving up, which is a loss for the streak. Switching category or difficulty starts a new word, so the same rule applies. **Copy result** gives you a short line that does not include the word, so sharing it does not spoil it.

## How it works

The engine is a handful of pure functions that never touch the page, so every rule is covered by unit tests.

- **The word list** is written by hand: more than 800 common nouns, over 100 in each of the six categories, lowercase a to z only. The tests check that there are no duplicates, that every word is 4 to 11 letters long, and that every category and difficulty combination has at least 30 words, so no setting is ever empty.
- **Picking a word** filters the list by your settings, removes the words in your recent list, and chooses one with a random number. In the browser that number comes from the secure random generator. The function takes the random source as an argument, so the tests can replace it with a seeded one and check that the same seed always gives the same word.
- **No repeats:** the last 20 words are remembered and skipped. If a setting ever had only recent words left, it would fall back to the one used longest ago. With at least 30 words everywhere, that fallback does not happen in practice.
- **A guess** returns a new game state and never changes the old one. A repeated letter, a non-letter or a guess after the game is over returns the same state, so nothing is counted twice. Upper and lower case are the same letter.
- **A hint** picks a random hidden letter and records it separately from your guesses. It counts toward the six wrong guesses, and the tests confirm that no run of hints can win or lose a game by itself.
- **The streak rules** are pure functions too: a win adds one, a loss resets to zero, the best never goes down, and giving up after a guess counts as a loss while giving up before any guess changes nothing.

## Privacy and storage

Nothing is uploaded and there is no account. Your current streak and best streak are saved in your browser's local storage as two small numbers inside a small JSON object, under one key. The word you are playing, your guesses and your recent-word list are not saved. The address of the page holds only the category and difficulty, never the word. Clearing site data removes the streak.

## Limits

- The list is English only, and only common words, mostly nouns, with a few plurals. It is a fixed list, so you may meet a word you think is odd, or notice one that is missing.
- The word is chosen on your device, and it is in the page's memory while you play. Anyone who opens the browser's developer tools could look at it. This is a game, not a secret.
- The streak is stored in your own browser, so it is not shared between devices and nothing stops you from editing it.
- The no-repeat memory covers 20 words and lasts for the session. Reloading the page starts it again.
- There is no daily word, no timer and no multiplayer mode.

Everything runs locally in your browser.
