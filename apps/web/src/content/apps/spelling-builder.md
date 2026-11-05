---
title: "Spelling Builder"
category: "fun"
job: "Play a free picture spelling game: tap the letters in order to spell the word for each picture, with three levels and a star for every word."
description: "Free picture spelling game for young children: tap letters to spell 106 common words in three levels, with stars and no timer. No ads. No signup."
aiSummary: "A free browser spelling game for young children. Each round shows six pictures (emoji from the visitor's own device) and the player spells the word by tapping letter tiles in order. There are three levels by word length: Little has 3-letter words, Middle 4 and Big 5. The word list is hand-written: 106 common words, 22 with three letters, 42 with four and 42 with five, each with one clear picture. The tiles are the word's letters plus two, three or four decoy letters (by level) that are not in the word, shuffled so the word is never shown in order and no other word from the list can be spelled from the tiles. Only the next correct letter is accepted; a wrong tap gives a kind message and, after two, the right tile glows. A star is earned for every word, with a count of those spelled first time. After five first-time words in a row the page offers the next level, and the player can say no. There are no timers and no sound. All-time stars and a best first-time count per level are kept in the browser as small numbers; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part I like is that a wrong letter can never leave a muddled word on the screen, so there is nothing to undo."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔤"
---

## How to play

Look at the picture, then tap the letters under it to spell its word. The first empty box has a solid blue edge, which means it is the next one to fill. Tap the right letter and it jumps into the box. Tap the wrong letter and nothing is lost: the game answers with a kind line such as "Try again, you can do it!" and you pick another. After two tries in a row the right letter glows with a dashed outline, so a child is never stuck. The **Show me the next letter** button does the same on request.

Pick a level at the top:

- **Little:** words with 3 letters, plus 2 extra letters on the tiles.
- **Middle:** words with 4 letters, plus 3 extra letters.
- **Big:** words with 5 letters, plus 4 extra letters.

A round is six pictures. Each finished word earns one star. When you finish all six the game cheers, shows how many you spelled first time, and offers **Play again** or **Copy result**. If you spell five words first time in a row, the page offers the next level. You can say "Not now", and it asks again only after another five.

The pictures are emoji drawn by your own phone or computer, so a cat may look a little different from one device to the next. The number of boxes tells you how long the word is, which settles the few pictures that have two names, such as dog and puppy.

**Keyboard:** type a letter and it chooses a tile showing that letter. Or press Tab to reach the tiles, use the arrow keys to move between them and Enter or Space to choose one. The **Aa** button switches between small and capital letters.

**Screen readers:** each picture has a spoken label that names it, because a player who cannot see it needs to know what to spell. The box row is read out as, for example, "Your word: c, blank, blank", and a status line says what just happened after every tap.

There is no timer, no sound and nothing to buy. Wrong taps never lose a star.

## How it works

The engine is a small set of pure functions that never touch the page, so each rule is covered by tests.

- **The list** is typed by hand: 106 common words (22 with three letters, 42 with four, 42 with five), each with one emoji. A separate copy of the list is typed again in the test file and compared word for word and picture for picture, which catches a slip in either. The tests also check that there are no duplicate words or pictures, no two words in a level are anagrams of each other, every picture is a single colour emoji, every spoken label contains its word, and nothing scary or unsafe is on the list.
- **The tiles** are the word's letters plus the decoys, shuffled. The decoys are different letters and none is in the word. A shuffle is thrown away and redrawn if the first tiles spell the word in order, if the tiles contain a string from the blocklist of rude and hurtful strings, or if the tiles could spell any other word from the list. The blocklist holds 217 strings, from text-speak and drink or drug words to slurs and crude words, and the sexual, bodily and hateful ones are also checked with the tiles read right to left, because some scripts run that way. The only thing allowed is a blocked string that is part of the picture's own word: five of the list words contain one, and a child can only see it by spelling that word. The tests run this for every word with 40 different seeds and check all three rules independently, and also check 5,000 seeds at each of the three levels across six pictures for the blocklist rule, in both reading directions.
- **Stars and the step-up offer** are counted by plain functions: one star per word, a first-time count, and an offer at five, ten, fifteen in a row while a harder level exists.
- **Saved data** is two totals and three best counts in one small JSON object in the browser's local storage. The page reads it into a fresh object, so a damaged or edited value falls back to zero rather than breaking the game.

## Limits

- English only, and only the 106 words on the list. A word you expect may be missing.
- Emoji depend on the device. A very old phone may show an empty box for a newer picture.
- Nothing is spoken aloud. There is no read-aloud and no sound.
- Stars live in your own browser, so they are not shared between devices, and clearing site data removes them.

Everything runs in your browser. Nothing is sent anywhere.
