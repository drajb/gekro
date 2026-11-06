---
title: "Pyramid Solitaire"
category: "fun"
job: "Play Pyramid Solitaire: remove pairs of free cards that add up to 13, clear the pyramid, with easy deals, undo, hints and a choice of recycles."
description: "Free Pyramid Solitaire. Remove pairs of cards that add up to 13 and clear the pyramid. Easy deals, undo, hints, keyboard friendly, no ads. No signup."
aiSummary: "A free browser Pyramid Solitaire. Twenty-eight cards are dealt face up into a pyramid of seven rows and the other 24 form the stock. A card is free when both cards covering it are gone, and the top card of the waste is free too. Remove two free cards whose values add up to 13 (Ace 1, Jack 11, Queen 12) or a free King on its own. The stock is turned onto the waste one card at a time and the waste can be turned back over once, twice or three times, in the same order. The game is won when the pyramid is gone. Deals are shuffled with a seeded Fisher-Yates, so a deal number reproduces the layout and the page address carries it. A solver searches the positions of pyramid cards left, stock cards in play, place in the stock and recycles used, each once, up to a budget, and drives both the hint and the Easy deals option, which moves on to the next deal number until a way to clear the deal is found. The solver is checked against an independent brute-force search on 300 small positions. Unlimited undo is included, a hint marks the game as aided so it does not count towards a best, and games played, pyramids cleared, the most cards cleared and the fewest moves in a clear stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the solver: it searches the state of the pyramid and the stock, and a test checks it against a brute-force search that shares none of its code."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔺"
---

## How to play

Clear all 28 cards from the pyramid by removing them in pairs that add up to 13.

1. **Values.** An Ace is 1, a Jack 11, a Queen 12 and a King 13. The pairs that make 13 are Ace and Queen, 2 and Jack, 3 and 10, 4 and 9, 5 and 8, and 6 and 7. Suits do not matter.
2. **Kings.** A King is 13 on its own, so a free King is removed with a single tap.
3. **Free cards.** A card is free when nothing lies over it, which means both cards just below it are gone. Every card in the bottom row is free at the start. Free cards have a bright edge, and cards that are still covered are dimmer and cannot be chosen.
4. **Make a pair.** Tap a free card. It shows a tick, and any free card that would make 13 with it shows a dashed ring marked 13. Tap that card and both are removed. Tap your card again to put it back. If you tap a card that does not make 13, the game says what the two make, and your choice moves to the new card.
5. **Stock and waste.** When nothing fits, tap the stock to turn the next card onto the waste. The top card of the waste is free: it can be paired with a free pyramid card, or removed if it is a King. When the stock runs out, tap it again to turn the waste back over. You choose how many times that may happen: once, twice or three times. The first card you turned comes up first again.
6. **Finish.** You win when the pyramid is gone. If nothing can be removed and the stock and recycles are used up, the game is over, and the score is how many of the 28 cards you cleared.

**Easy deals.** The deal menu can ask for easy deals. From the next New deal, the game tries deal numbers in turn until its solver has found a way to clear one, and tells you which deal it settled on. In the deals I tried, about half of the deals could be proven clearable, so this takes a moment at most.

**Undo and hints.** Undo takes back moves one at a time, with no limit, until the game is over. A hint comes from the solver: it points at the cards or the stock it would use next, and says whether the deal can still be cleared. A hinted game still counts as played, but it does not count towards your most cleared or your fewest moves.

**Keyboard and screen reader.** Press Tab to reach the free cards. The arrow keys, Home and End move between the free cards, the waste and the stock, and Enter or Space chooses a card or turns the stock. Escape puts a chosen card back, U undoes and H gives a hint. A polite status message says each move, how many cards are left, and, when two cards do not make 13, what they make instead. Every free card reads its row, place and name, and says whether it makes 13 with your chosen card. The sound button is off until you press it, and the sounds are short, quiet tones. Cards are told apart by rank and suit shapes as well as colour.

The deal has a number. The page address carries it, along with the number of recycles, so copying the address, or using **Copy result**, gives someone else the same layout. **Restart this deal** starts it again from the beginning.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. The shuffle is a Fisher-Yates driven by a small seeded generator, so a deal number always gives the same layout. The first 28 shuffled cards are the pyramid, read row by row, and the last 24 are the stock. The seed itself is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. Each move returns a new state, or nothing when the move is illegal, and the page only draws the result.

**The solver.** What can happen next depends only on which pyramid cards are left, which stock and waste cards are still in play, how far through the stock this pass is, and how many recycles have been used. The solver searches those positions depth first, each one once, and stops when it finds a clear or runs out of its budget of 150,000 positions. A free King is removed at once, since a King can never be in the way of anything, then pairs are tried, then turning the stock. It returns the best line found, and the hint and the easy-deal search are built on it. A deal it proves clearable really is clearable, because the line it returns is replayed move by move in the tests. A deal it fails to prove is not necessarily lost.

The tests check these claims:

- The shuffle is unbiased. A chi-square test over 6,000 shuffles of three items checks that all six orderings come up about equally, and another over 10,400 shuffles of the pack checks that one card lands in all 52 positions about equally.
- The deal is a 28-card pyramid and 24 in the stock, using the whole pack once, with an empty waste.
- The pyramid's numbering, rows and covering cards match a hand-drawn table, a card is free only when both cards over it are gone, and at the start exactly the seven bottom cards are free.
- Exactly six pairs of ranks make 13 (Ace and Queen up to 6 and 7), a King pairs with nothing, and every illegal removal is refused: a pair that does not make 13, the same card twice, a covered card, and the waste with itself.
- The waste and recycles behave: the last stock card turns first, a recycle needs an empty stock, keeps the order, and cannot be used more than the allowed number of times.
- The solver finds exactly the fewest cards that can be left, as an independent brute-force search that shares none of its code does, on 300 small positions, and every line it returns replays legally to that number. On real deals its lines replay legally too. With more recycles it never does worse.
- Of the first 80 deals with three recycles, more than a third and fewer than three quarters are proven clearable within the search budget.
- The easy-deal search returns the first deal at or after a number that the solver can clear, nothing earlier in that range was provable, and asking again from the answer returns it. Following the hint from a clearable deal, move after move, always ends with the pyramid gone.
- In 1,000 random games no card is lost or duplicated, every game ends, and recycles never go over the limit.

## Privacy and storage

Nothing is uploaded and there is no account. Games played, pyramids cleared, the most cards cleared in a game and the fewest moves in a clear are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- The solver has a budget, so on a hard deal a hint may say "the best line I found" rather than the exact best.
- Only the top card of the waste can be used; the cards under it must wait.
- A game in progress is not saved. Reloading with the same address gives you the same deal from the start.

Everything runs locally in your browser.
