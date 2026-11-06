---
title: "Card War"
category: "fun"
job: "Play Card War against the computer: press Flip, the higher card wins, a tie is a war. Big button, auto-play and short games for young children."
description: "Free Card War for young children and families: one big Flip button, auto-play, short or full games, and every game is guaranteed to end. No ads. No signup."
aiSummary: "A free browser Card War. A 52-card pack is shuffled with a seeded generator and split 26 and 26 between you and the computer. Both flip the top card and the higher rank wins both cards (Ace high, suits never matter). A tie is a war: each player puts 3 cards face down and flips one more, the higher card wins the whole pile, and a tie starts another war. A player with fewer than 4 cards puts all but one face down and flips the last, and a player with no card left for a war loses it. Won cards are shuffled and kept in a won pile, and when a draw pile runs out the won pile is shuffled to become the new one. Every game is bounded: a game ends when one player holds all 52 cards, or after the chosen number of flips (15 for Quick, 40 for Medium, 600 for a whole game), when the player with more cards wins. It has one large Flip button, an auto-play switch with three speeds, and keyboard and screen reader support. Tests simulate 10,000 whole games and check that each one ends within the limit. Games played, games won and the biggest pile won stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. Card War has no choices to make, so the interesting part is the ending: shuffling the won cards is what stops a game from looping forever, and a flip limit guarantees it finishes."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⚔️"
---

## How to play

Press the big **Flip!** button. You and Pip each turn over the top card of your pile. The higher card wins both cards. Aces are highest and 2s are lowest, and the suits do not matter.

If both cards have the same rank, it is a **war**. Each player puts three cards face down and flips one more, and the higher of those two cards wins the whole pile. If they tie again, there is another war. A pile can grow big, and the stat line keeps the biggest pile you have won.

If a player does not have enough cards for a full war, the rules still work: a player with fewer than four cards puts all but one card face down and flips the last one. A player with no card left to flip for a war loses it.

Won cards go to a won pile, shuffled. When your draw pile runs out, your won pile is shuffled and becomes your new draw pile. You never have to do anything about it.

**Game length.** The default is **Quick**, which stops after 15 flips, so a game takes a minute or two. **Medium** is 40 flips. **Whole game** plays until one player has all 52 cards, or stops after 600 flips. When a game stops at its limit, the player with more cards wins, and equal cards is a tie. A war counts as one flip.

**For little ones.** The Flip button is large. Turn on **Auto-play** and the game flips by itself, so a small child can just watch the cards, and you can choose a slow, normal or fast pause between flips. Nothing can go wrong and nothing is timed. Each flip is shown one step at a time: your card, then Pip's card after a short pause, then who takes the pile, with the winning card raised and outlined in amber. A bar shows who has more cards.

**Keyboard and screen reader.** Press Tab to the Flip button and press Enter or Space. Press A to turn auto-play on or off. Every step is spoken: "You flipped the 9 of hearts. Pip flipped the 4 of clubs. You win the flip and take 2 cards." In a war the status line says how many cards are put face down and names the war cards.

Pip pauses for a short, fixed moment before turning its card, and for less if your system asks for reduced motion. With reduced motion there is also no card animation.

The game has a number, and the page address carries it with the length and speed. Copying the address, or using **Copy result**, gives someone else the same deal. **Restart this game** replays that deal from the beginning.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. The shuffle is a Fisher-Yates driven by a small seeded generator, so a game number always gives the same split. The seed is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295. The same generator shuffles each pile of won cards, so a whole game can be replayed from its number.

The rules live in a plain TypeScript module with no page code in it. A flip returns the new state and a record of every face-up comparison, so the page can show a war step by step. The page then reveals those steps one at a time.

Card War has no decisions, which makes the ending rule the interesting part. If won cards always went to the bottom of a pile in a fixed order, a game could repeat forever. Shuffling each won pile breaks that, and the flip limit makes the finish certain: no whole game goes past 600 flips.

The tests check these claims:

- Every pair of cards is compared the same way as an independent ordering of "23456789TJQKA" (52 x 52 pairs), so Ace is high and suits never matter.
- The pack splits 26 and 26 with 52 distinct cards, for 300 different seeds, and the shuffle passes two chi-square tests of fairness.
- A flip, a war with three cards down, a second war in a row, a short war (a player with one or two cards left) and a war a player cannot play each have their own test. After every one of them no card has been lost or copied.
- An empty draw pile is refilled from a shuffled won pile, deterministically for a seed, and the shuffle is fair over 1,200 trials.
- The flip limit ends the game, the player with more cards wins, and equal cards is a tie.
- 10,000 simulated whole games all end within 600 flips with 52 distinct cards. More than 80 per cent finish by one player winning every card, and the average game is between 100 and 400 flips. For the first 300 of them the full set of 52 cards is also checked after every single flip.
- For Quick and Medium games, 300 games each stop exactly at 15 or 40 flips unless a player runs out first.

## Privacy and storage

Nothing is uploaded and there is no account. Games played, games won and the most cards you have won in one flip are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- There is nothing to decide in Card War. The only choices are the game length and how quickly auto-play goes.
- A whole game can take a few hundred flips. Quick and Medium games are there for that reason.
- If the game stops at its flip limit, the winner is simply whoever has more cards at that moment.
- A game in progress is not saved. Reloading with the same address gives you the same deal from the start.

Everything runs locally in your browser.
