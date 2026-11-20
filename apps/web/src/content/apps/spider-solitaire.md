---
title: "Spider Solitaire"
category: "fun"
job: "Play Spider Solitaire with one, two or four suits, with unlimited undo, a hint, and a choice of deals that a solver has proved can be won."
description: "Free Spider Solitaire: build King-to-Ace runs, deal rows, undo without limit, ask for hints. Pick deals proved winnable. No ads. No signup."
aiSummary: "A free browser version of Spider Solitaire with 104 cards in 1, 2 or 4 suits. Ten columns are dealt (6, 6, 6, 6 and then six of 5 cards, only the last face up) with 50 cards in the stock. A card or a run of one suit in descending order can move onto a card one rank higher of any suit, or into an empty column. A row can be dealt from the stock only when no column is empty. A King-to-Ace run of one suit is removed, and removing all eight wins. A deal number is the seed of the shuffle, so a link shares a deal. Undo is unlimited and a hint is available. For 1 and 2 suits the page can offer deals from a list of 24 and 12 deal numbers that a depth-first solver has won; every one is solved again by the tests and its line replayed through the ordinary move functions. Legal moves are checked against a naive enumeration of the rules on thousands of positions reached by random play. Records are saved in the browser only."
personalUse: "Anyone is welcome to play and learn with this, with no ads. Most shuffled Spider deals can be won but some cannot, so the page keeps a list of deals that a solver has proved winnable, and the tests replay the solver's answer move by move through the same functions you play with."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🕷️"
---

## How to play

Clear all eight King-to-Ace runs. Two packs make 104 cards. Ten columns are dealt, the first four with 6 cards and the rest with 5, with only the last card of each column face up. The other 50 cards are the stock: five rows of ten.

- **Move cards.** Tap a face-up card to pick it up together with the cards below it, then tap the column it should go to. You can pick up a card and everything below it only if those cards are all one suit and in order, each one rank lower than the one before. It can go onto a card **one rank higher, of any suit**, or into an **empty column**.
- **Turn over.** When you move cards off a face-down card, it turns face up.
- **Deal a row.** Tap the stock (or press D) to put one card on every column. You can only do this when **no column is empty**, so fill empty columns first.
- **Clear a run.** When a column ends with King down to Ace in a single suit, those 13 cards are removed. Remove all eight to win.

You choose **1 suit** (all spades, the easiest), **2 suits** (spades and hearts) or **4 suits** (the hardest). Moving a run of mixed suits is not allowed, which is why more suits make the game harder. The number of moves is counted, and your fewest moves for each suit count is kept.

**Undo and hints.** **Undo** has no limit, goes back one move or deal at a time, and is blocked once the deal is won. **Hint** points to a move or to dealing a row. A win with a hint still counts as a win but never sets a fewest-moves record.

**Deals that can be won.** Most shuffled deals can be won but some cannot. Set **New deals are** to **Deals that can be won** and the next deal comes from a list the solver has won: 24 deals for 1 suit and 12 for 2 suits. There is no list for 4 suits.

**Controls.** Tap or click. From the keyboard, Tab to the table, then Left and Right move between columns, Up and Down move through the cards in a column that you can pick up, Enter or Space picks up and puts down, Escape cancels, **D** deals, **U** undoes and **H** gives a hint. The status line says what you picked up and where it went, and each column's label says how many cards it has, how many are face down and what the top card is. Every suit has its own symbol as well as its own colour, so colour is never the only signal. On a narrow phone the table scrolls sideways inside its own frame rather than shrinking the cards. Sound is off until you press the sound button, and a win has a short glow that is skipped if your system asks for reduced motion.

## How it works

A deal number is the seed of a shuffle of the 104 cards, so the same number and suit count always gives the same layout, and the address of this page carries the number. Every function takes a position and returns a new one, so undo is simply stepping back through earlier positions.

The **hint** scores every legal move: finishing a run is worth most, turning over a face-down card is next, joining a card to a card of its own suit is good, and taking a run off the card of its own suit that it was built on is bad. If nothing scores well it suggests dealing a row, and if nothing is possible it says so. It is a rule of thumb, not a perfect player.

The **solver** is a depth-first search that tries the best-scoring moves first, then a deal, then the rest, remembers every position it has seen, and gives up after a fixed number of positions. The deals on the winnable lists are those it found a complete line for. For 1 suit it usually finds a line in a few hundred positions, for 2 suits it needs more and often fails, and for 4 suits it is not worth trying.

## What the tests check

| Claim | How it is checked |
|---|---|
| The deal is right | For 1, 2 and 4 suits and 20 deal numbers each: 104 cards in the right counts, columns of 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, only the last card face up, 50 in the stock. |
| Legal moves are exactly the rules | A naive enumeration written straight from the rules agrees with the engine on every position along 180 random games (more than 5,000 positions), for every pickup and every destination. |
| No card is lost or invented | 240 games of up to 400 random moves and deals each, with the full card count, the face-up order and the stock size checked after every action. |
| Runs are removed correctly | A full King-to-Ace run of one suit is removed and the card under it turns over; a run of mixed suits or one that does not start at a King is left alone. The eighth run wins. |
| A row needs every column filled | Dealing is refused with an empty column or an empty stock, and a deal that completes a run removes it. |
| The winnable lists are real | All 24 one-suit and 12 two-suit deals are solved again, and the solver's whole line is replayed through the ordinary move and deal functions, with the card count checked at every step, until all eight runs are gone. |
| Records are safe | Stored counts are read defensively, and only an unaided win sets a fewest-moves record. |

## Storage and privacy

Your wins and your fewest moves for 1, 2 and 4 suits are small whole numbers kept in your browser under one key. The page address holds the suit count and the deal number. Nothing is uploaded and there is no account.

## Limits

- Cards are picked up and put down by tapping or with the keyboard. There is no dragging.
- Shuffled deals are not checked for winnability, so some cannot be won. Only the listed deals are known to be winnable.
- The hint does not look ahead.
