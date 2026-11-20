---
title: "Idle Orchard"
category: "fun"
job: "Play a relaxed idle game: pick fruit, buy trees and helpers that grow it for you, and start new seasons for permanent bonuses."
description: "Free idle orchard game. Pick fruit, buy trees, helpers and upgrades, earn blossoms with new seasons. Works while you are away, up to 4 hours. No signup."
aiSummary: "A free browser incremental game. You pick fruit by hand, then buy six kinds of tree and helper (sapling, apple tree, pear grove, picker crew, fruit cart, hill orchard) that make fruit every second, and twelve one-time upgrades that multiply them or your hand. Each one you own makes the next cost 15 percent more, rounded up. While the page is closed the orchard keeps working for at most 4 hours. A new season resets the orchard and turns the fruit grown that season into blossoms, the square root of fruit divided by 100,000 rounded down, and every blossom makes everything 5 percent faster permanently. Large numbers are shortened (1.23K, 45.6M, up to Qi, then exponents). The engine is pure and has no random numbers; tests check prices, rates, offline catch-up, seasons, number formatting and thousands of random action sequences, and the saved data is a few whole numbers that are checked field by field when loaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I like is that the whole economy is a few lines of arithmetic, and the offline catch-up and the save loader are tested against clocks that go backwards and storage that has been tampered with."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🍎"
---

## How to play

Press the big button to pick fruit. Spend the fruit on things that pick for you.

- **Trees and helpers.** Six kinds, from a Sapling that makes 0.1 fruit a second to a Hill orchard that makes 1,400. The price of the next one of a kind is its starting price times 1.15 for every one you already own, rounded up. Choose 1, 10 or Max to buy that many at a time.
- **Upgrades.** Twelve one-time purchases that appear when you qualify. Three make your hand stronger, one after the other: twice, twice again, then three times as much. Each kind of tree and helper has an upgrade that appears once you own 5 of them (saplings and apple trees get a second one at 25). A sunny year, once you own 40 apple trees, makes everything one and a half times as fast.
- **Away from the game.** The orchard keeps working while the page is closed or hidden, for up to 4 hours. When you come back it tells you how long you were away and how much it grew. Leave it for a day and you still get 4 hours.
- **New season.** When you have grown enough fruit in one season, you can start a new one. Everything resets except your blossoms. You earn one blossom for every step of the square root of your season's fruit divided by 100,000 (rounded down): 100,000 fruit gives 1, 1 million gives 3, 100 million gives 31. Every blossom makes everything, including your hand, 5 percent faster for good. Starting a season takes two presses within five seconds, so one stray tap cannot cost you your orchard.
- **Erase my orchard** starts completely over, also with two presses. The Reset button above the game does the same.
- **Numbers.** K is a thousand, M a million, B a billion, T a trillion, Qa a quadrillion and Qi a quintillion. Fruit stops growing at 1 quintillion.
- **Sound** is off until you turn it on. A pick is one very short quiet tone, and a purchase two.

**Keyboard and screen readers.** Every control is a button, so Tab and Enter or Space work as normal. The status line says what each purchase did and how much you own. A trees-and-helpers button that you cannot afford yet says so in its label and in the status line when pressed, and shows a dashed border as well as a different colour. Buttons are tall enough to tap comfortably, and nothing moves or flashes. If your device asks for reduced motion, even the small press effect on the pick button is dropped.

## How it works

**Production.** Each kind has a base rate. Its upgrades multiply it, the sunny-year upgrade multiplies everything, and your blossoms multiply it once more (1 plus 0.05 for each blossom). The total rate is the sum over the kinds of how many you own times that. The tests work an orchard out by hand: 5 saplings and 10 apple trees, with three upgrades and 4 blossoms, make exactly 37.8 fruit a second.

**Prices.** The price of the next one is the starting price times 1.15 to the power of how many you own, rounded up. The tests check hand-worked values (a sapling costs 15, 18, 20, 23 and, after ten, 61), that bulk prices equal the sum of single prices, and that Max buys exactly as many as a brute-force search says you can afford and never spends more than you have. You can own at most 999 of a kind.

**Time away.** The page remembers when it last saved, to the minute. When it loads, it works out how long you were away and lets the orchard run for that long, but never more than 14,400 seconds. A clock that went backwards counts as no time. The same rule covers a browser tab that slept: the orchard catches up for the gap, with the same cap.

**Seasons.** Blossoms are the square root of (fruit grown this season divided by 100,000), rounded down. A new season resets fruit, trees and upgrades, adds the blossoms and counts the season; with nothing grown yet it does nothing. Blossoms stop at 99,999 and seasons at 9,999.

**Saving.** The orchard is saved as thirteen whole numbers: fruit, season total, picks, the six counts, the upgrade bits, blossoms, season and the minute. When it loads, every field is checked on its own, so a damaged field falls back to the start value without spoiling the rest. Extra keys, strings, decimals, negatives, numbers past the caps and fields called `__proto__` are all ignored, and the tests throw 6,000 random junk saves at the loader. Nothing is sent anywhere.

| Fact | Value | Checked by |
|---|---|---|
| Price growth | 1.15 for each one owned | hand-worked prices |
| Most of one kind | 999 | cap tests |
| Offline limit | 4 hours | catch-up tests |
| Blossoms | square root of (season fruit / 100,000) | table of thresholds |
| Blossom bonus | 5 percent each | rate test |
| Fruit cap | 1 quintillion | cap test |
| Big numbers | 999,999 reads 1.00M, never 1000K | 20,000 random numbers |
| Random play | 60 orchards of 250 actions, no NaN, no negatives | fuzz test |
| Greedy player | first blossoms inside two hours | bot test |

## What is stored

One small object under one key in your browser's local storage, made only of whole numbers (the fruit is rounded down). Clearing site data, or pressing Erase my orchard, removes it. If storage is blocked the game still works, but starts again on each visit.
