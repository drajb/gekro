---
title: "Gin Rummy"
category: "fun"
job: "Play Gin Rummy against the computer at three levels, to 50 or 100 points, with your hand grouped into the best melds as you go."
description: "Free Gin Rummy game: draw, discard, knock or go gin against the computer at three levels. Your cards group into the best melds. No ads. No signup."
aiSummary: "A free browser version of two-player Gin Rummy, played for points only. Each player gets 10 cards; on your turn you draw from the stock or take the top discard, then discard one card. Sets (three or four of a rank) and runs (three or more in a row of one suit, ace low) are melds; the rest is deadwood (ace 1, 2 to 10 face value, face cards 10). Knock with 10 or less deadwood, or go gin with none. The other player lays off cards onto the knocker's melds, then a knock scores the difference, gin scores 25 plus the other deadwood, and an undercut scores the difference plus 25. The engine finds each hand's lowest possible deadwood by trying every choice of disjoint melds, checked against a brute force over every subset of the hand on 1,700 hands, and checks lay-offs against a brute force over every subset and every assignment. Three computer levels play whole matches to 50 or 100. Counts are saved in the browser only."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The hardest part of Gin Rummy to get right is finding the least deadwood in a hand, and here that search tries every combination of melds and is checked against a slower brute force that tests every subset against the definition of a meld."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🃏"
---

## How to play

Two players, a standard 52-card pack, 10 cards each. One card is turned face up to start the discard pile. The player who did not deal goes first, and you take turns. Points only: there is no money or betting.

1. **Draw** the top card of the stock, or take the top card of the discard pile.
2. **Discard** one card. You cannot throw back the card you just took from the discard pile.

Your cards are shown grouped into **melds** and **loose cards**. A **set** is three or four cards of the same rank. A **run** is three or more cards in a row of the same suit, with the ace low only (so Q-K-A is not a run). The loose cards are your **deadwood**: an ace counts 1, a 2 to 10 counts its number, and a jack, queen or king counts 10. The page picks the grouping with the least deadwood for you, and the deadwood total is shown above your hand.

After you draw, if the 10 cards you would keep have **10 or less deadwood**, you may **knock** by discarding one card and ending the hand. With no deadwood at all you **go gin**. The other player then lays off any of their loose cards that extend your melds (not after gin), and the hands are compared:

| Result | Score |
|---|---|
| Knock, and you have less deadwood | You score the difference |
| Gin | You score 25 plus the other player's deadwood |
| Undercut: the other player has the same or less deadwood | They score the difference plus 25 |
| Only two cards left in the stock after a discard | The hand is a draw and nobody scores |

The first to reach 50 or 100 points wins the match. The dealer swaps each hand. There is no big-gin bonus and no game bonus.

**Controls.** Tap or click the stock or the discard pile to draw (or press **S** or **D**). Tap a card to pick it, then press **Discard** (or tap the picked card again, or press **X**). Press **K** or the Knock button to knock; the button says Go gin when you have no deadwood. Arrow keys move between your cards, **H** gives a hint, and **Escape** cancels a pick. When a card is picked, the line under your hand says how much deadwood you would have after throwing it away. Melds are labelled with the words Run and Set as well as a green frame, picked cards are raised and framed in amber, and each suit has its own symbol as well as its own colour, so colour is never the only signal. A hint marks the match as helped, so it does not count as a win. Sound is off until you press the sound button.

## How the computer plays

| Level | Rule |
|---|---|
| Easy | Takes the discard only if it completes a meld and lowers its deadwood. Throws away its highest loose card. Knocks as soon as it can. |
| Medium | Also takes a discard that brings it into knocking range. Throws away the card that leaves the least deadwood. Waits for 7 or less to knock until the stock is low. |
| Hard | Waits longer early on (3 or less, then 6, then 10 as the stock shrinks). Remembers which discards you picked up and avoids throwing cards near them. Prefers to throw away cards that are least useful to its own hand. |

All three go gin whenever they can. The computers never look at your hand.

## How the deadwood search works

For a hand of 10 or 11 cards the engine lists every possible meld: every set of three or four cards of one rank and every run of three or more in one suit. It then tries every choice of melds that share no card and keeps the one with the least deadwood, preferring more cards in melds on a tie. That is exhaustive, so there is no case where a better grouping is missed. The same search drives the grouping on screen, the knock check, the computer's discards and the scoring.

Lay-offs use the same idea. For the defender's cards the engine tries every subset that can be laid onto the knocker's melds, one after another (a card laid off can extend a meld that another laid-off card then extends), and keeps the one that leaves the least deadwood.

## What the tests check

| Claim | How it is checked |
|---|---|
| The deadwood search is exact | An independent brute force tries every subset of the hand, tests each subset against the definition of a meld, and asks whether the subset splits into melds. It agrees with the engine on 600 random deals each of 10 and 11 cards, and on 500 hands built from a few ranks and suits so melds are common. |
| Lay-offs are optimal | The brute force tries every subset of the defender's cards and every assignment of those cards to melds, and agrees with the engine on 90 built positions. |
| Scoring is right | Knock, gin, undercut and equal-deadwood undercut are each checked on hand-built positions with the numbers worked out by hand. |
| The turn rules hold | The just-taken discard cannot be thrown back, knocking needs 10 or less, and a stock of two cards ends the hand as a draw. |
| Hands always end | 600 hands of random legal moves, 60 hands across the level pairings, and whole matches to 50 and 100 at every level. The 52 cards stay accounted for at every step. |
| Hard is the strongest level | Over 150 hands against Easy, with the dealer alternating, Hard scores more points than it loses, and no single computer move takes a second. |

## Storage and privacy

Your matches finished, matches won, hands won and gins are small whole numbers kept in your browser under one key. The page address holds the level, the target and the game number, so a shared link replays the same deals. Nothing is uploaded and there is no account.

## Limits

- The defender's lay-offs are worked out for you, using the arrangement that leaves the least deadwood. You do not choose them by hand.
- The first player may draw or take the turned-up card on the first turn; there is no separate offer round.
- Only the two-player game is included.
