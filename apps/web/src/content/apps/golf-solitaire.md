---
title: "Golf Solitaire"
category: "fun"
job: "Play Golf Solitaire: clear seven columns by playing cards one rank above or below the foundation, with undo and hints."
description: "Free Golf Solitaire. Play cards one rank up or down onto the foundation and clear seven columns. Optional wrap, winnable deals, undo, hints. No ads. No signup."
aiSummary: "A free browser Golf Solitaire. Thirty-five cards are dealt face up into seven columns of five, one card starts the foundation and 16 remain in the stock. The bottom card of a column can be played on the foundation when its rank is exactly one above or one below the top card, suits ignored; Kings and Aces count as neighbours only if the wrap option is on. When nothing fits, the next stock card is turned onto the foundation. The game is won when every column is empty, and the score is the number of cards left, so lower is better. Deals are shuffled with a seeded Fisher-Yates, so a deal number reproduces the layout and the page address carries it. A solver searches the positions of column heights, stock size and top rank, each once, up to a budget, and drives both the hint and the Winnable deals option, which moves on to the next deal number until a way to clear the deal is found. The solver is checked against an independent brute-force search on 800 small positions. In the deals tried, about a quarter of plain deals and two thirds of wrap deals could be proven winnable. Unlimited undo is included, a hint marks the game as aided so it does not count towards a best, and games played, games cleared, the fewest cards left and the fewest moves in a clear stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the solver: it finds the best line a deal allows and the Winnable deals option uses it, and a test checks it against a brute-force search that shares none of its code."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⛳"
---

## How to play

Clear all 35 cards from the seven columns by playing them onto the foundation, one at a time.

1. **The foundation.** One card sits face up on the foundation. A line beside it says which ranks can be played on it now, for example "Play a 6 or an 8."
2. **Play a column card.** Only the bottom card of each column can move. If its rank is exactly one higher or one lower than the foundation card, tap the column to play it. Suits do not matter. Columns whose bottom card fits show a ring and a tick.
3. **Each card played becomes the new top card.** Then the next ranks in either direction can follow, so you can run up and down in a chain.
4. **Turn the stock.** When nothing fits, tap the stock to turn the next of its 16 cards onto the foundation.
5. **Finish.** You win when all seven columns are empty. If nothing fits and the stock is empty, the game is over. The score is the number of cards left in the columns, so lower is better and 0 is a clear.

**Wrap.** By default a King and an Ace are not neighbours, so the chain stops at each end. Choose "Kings and Aces are neighbours" and the ranks go round, which makes the game much easier.

**Winnable deals.** The deal menu can ask for winnable deals only. From the next New deal, the game tries deal numbers in turn until its solver has found a way to clear one, and tells you which deal it settled on. Plain deals are harder to find: in the deals I tried, about one in four could be proven winnable. If the solver cannot prove one quickly, the game says so.

**Undo and hints.** Undo takes back moves one at a time, with no limit, until the game is over. A hint comes from the solver: it points at the column or the stock it would use next, and says whether the deal can still be cleared. A hinted game still counts as played, but it does not count towards your fewest cards left or your fewest moves.

**Keyboard and screen reader.** Press Tab to reach the columns. The arrow keys, Home and End move between the seven columns and the stock, and Enter or Space plays the card or turns the stock. U undoes and H gives a hint. A polite status message says each move, how many cards are left, and, if a card does not fit, which ranks do. Every column reads its bottom card and whether it can be played. The sound button is off until you press it, and the sounds are short, quiet tones. Cards are told apart by rank and suit shapes as well as colour.

The deal has a number. The page address carries it, along with the wrap choice, so copying the address, or using **Copy result**, gives someone else the same layout. **Restart this deal** starts it again from the beginning.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. The shuffle is a Fisher-Yates driven by a small seeded generator, so a deal number always gives the same layout. The first 35 shuffled cards fill the columns in order, the next one starts the foundation and the last 16 are the stock. The seed itself is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. Each move returns a new state, or nothing when the move is illegal, and the page only draws the result.

**The solver.** What can happen next depends only on three things: how tall each of the seven columns is, how many cards are left in the stock, and the rank on top of the foundation. The solver searches those positions depth first, each one once, trying plays (tallest column first) before turning the stock, and stops when it finds a clear or runs out of its budget of 120,000 positions. It returns the best line found, and the hint and the winnable-deal search are built on it. A deal it proves winnable really is winnable, because the line it returns is replayed move by move in the tests. A deal it fails to prove is not necessarily lost.

The tests check these claims:

- The shuffle is unbiased. A chi-square test over 6,000 shuffles of three items checks that all six orderings come up about equally, and another over 10,400 shuffles of the pack checks that one card lands in all 52 positions about equally.
- The deal is seven columns of five, one foundation card and 16 in the stock, using the whole pack once.
- The neighbour rule matches a hand-written table for all 169 pairs of ranks, with and without wrap.
- The solver finds exactly the fewest cards that can be left, as an independent brute-force search that shares none of its code does, on 800 small positions, and every line it returns replays legally to that number. On real deals, lines replay legally too, and every one it calls a clear ends with empty columns.
- Of the first 100 deals, more than 12% and fewer than 40% of plain deals are proven winnable within the search budget, and more than 50% and fewer than 85% of wrap deals. Wrap is easier. In the deals I tried, about a quarter of plain deals and two thirds of wrap deals came out provably winnable.
- The winnable-deal search returns the first deal at or after a number that the solver can clear, nothing earlier in that range was provable, and asking again from the answer returns it. Following the hint from a winnable deal, move after move, always ends in a clear.
- In 1,500 random games no card is lost or duplicated, every game ends, and no game lasts more than 51 moves (35 plays and 16 turns of the stock).

## Privacy and storage

Nothing is uploaded and there is no account. Games played, games cleared, the fewest cards left and the fewest moves in a clear are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- The solver has a budget, so on a hard deal a hint may say "the best line I found" rather than the exact best.
- Looking for a winnable plain deal can take a moment.
- A game in progress is not saved. Reloading with the same address gives you the same deal from the start.

Everything runs locally in your browser.
