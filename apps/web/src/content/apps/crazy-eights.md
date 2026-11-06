---
title: "Crazy Eights"
category: "fun"
job: "Play Crazy Eights against one to three computer players: match the suit or rank, use wild eights, and be first to empty your hand."
description: "Free Crazy Eights against 1 to 3 computer players. Match suit or rank, eights are wild, three levels, keyboard and screen reader friendly, no ads. No signup."
aiSummary: "A free browser Crazy Eights with traditional rules and a standard 52-card pack. You play against one, two or three computer players at Easy, Medium or Hard. Two players get 7 cards each and three or four players get 5 each. On your turn you play a card that matches the top card's suit or rank, or any eight, which is wild and names the suit the next player must follow. If you cannot play you draw, either until you can play or up to 3 cards and then pass, as you choose. When the stock runs out the discard pile under its top card is shuffled into a new stock. The first player to play every card wins. There are no other special cards. To guarantee that every game ends, a round of passes with nothing left to draw blocks the game, and play stops after 500 turns, with the fewest cards winning. The shuffle is a Fisher-Yates driven by a seeded generator, so a game number reproduces the deal. The computer players never see your hand. The engine is pure TypeScript and is checked by random games that keep 52 distinct cards at every step. Games played, games won and the quickest win stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The part I like is the ending rule: every game is guaranteed to finish, and a test plays hundreds of random games to prove no card is ever lost or copied along the way."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🃏"
---

## How to play

Be the first to get rid of all your cards.

1. **Match the top card.** On your turn you may play a card that has the same suit or the same rank as the card on top of the discard pile. A 7 of hearts goes on any heart, or on any 7.
2. **Eights are wild.** An eight can be played at any time. It has an amber frame so it is easy to spot. After you play one you name a suit, and the next player must follow that suit (or play an eight of their own). The big circle in the middle of the table always shows the suit to match.
3. **Cannot play?** Draw from the stock. With the setting "Draw until you can play" you keep drawing until you get a card that works. With "Draw up to 3, then pass" you draw at most three cards, and if none can be played your turn is passed.
4. **Winning.** The first player to play every card wins. There are no other special cards in this game, only the wild eights.

Two players are dealt 7 cards each, and with three or four players everyone gets 5. One card is turned up to start the pile. If it happens to be an eight, it goes back to the bottom of the stock and the next card is turned instead.

Cards you can play are raised and outlined in amber, so you do not have to work out the rule yourself. The raised position is the cue, not just the colour. Tap a card to play it. If it is an eight, four large suit buttons appear: choose one, or press Escape to put the eight back. Tapping a card that cannot be played tells you why.

**Keyboard and screen reader.** Press Tab to reach your cards. The arrow keys, Home and End move along your hand, and Enter or Space plays the card. Press D to draw, or Tab to the stock and press Enter. After an eight, press S, H, D or C to name spades, hearts, diamonds or clubs, or Tab to a suit button and press Enter. Every card played and drawn is spoken through a polite status message. A card a computer player draws is not named, because you would not see it at a real table.

**Levels.** Easy plays any card that is legal. Medium keeps its eights back unless it has to use one, and names the suit it holds most. Hard also remembers who had to draw (which tells it a suit that player probably lacks), likes to name a suit the next player lacks, and plays an eight when it is nearly out of cards. You can change the level at any time. Changing the number of opponents or the draw rule deals the game again.

The computer players pause for a short, fixed moment before each turn, and for less time if your system asks for reduced motion. A computer turn that needs several draws is shown as one step.

The game has a number, and the page address carries it with the options, so copying the address or using **Copy result** gives someone else the same deal.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. The shuffle is a Fisher-Yates driven by a small seeded generator, so a game number always gives the same order of cards. The seed is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. Playing or drawing returns a new state and a list of events, or nothing when the action is illegal. The state keeps the stock, the discard pile, each hand and the suit to match, and the validity check looks at all of them.

When the stock is empty and someone needs a card, the discard pile under its top card is shuffled into a new stock. If there is nothing at all to draw, a player who cannot play passes automatically. A full round of such passes blocks the game, and it also stops after 500 turns. In both cases the player with the fewest cards wins, and a tie is shared. These two rules are what make the finish certain, and the page says so when one of them ends a game.

The tests check these claims:

- The match rule is compared with a second, independent version for every card against every top card and every called suit (52 x 52 x 4 combinations).
- The shuffle is unbiased: a chi-square test over 6,000 shuffles of three items and another over 10,400 shuffles of the pack.
- The deal has 7 or 5 cards each, and in 4,000 deals the starting card is never an eight.
- An eight must name a suit from 0 to 3 and changes the suit to follow. Cards that are not in your hand, or do not match, are refused.
- Drawing is refused while you have a play. Drawing until you can play, the three-card limit, the stock reshuffle, automatic passes, the blocked ending and the 500-turn ending each have a test.
- 720 random games (2, 3 and 4 players, both draw rules) check, after every action, that all 52 cards exist exactly once and that the player to move can act, and every one of them ends. Another 120 games with all three levels at one table also finish.
- The computer players always choose a legal card, Medium and Hard keep their eights, and Hard beats Easy over 300 seeded two-player games.

## Privacy and storage

Nothing is uploaded and there is no account. Games played, games won and your quickest win (in turns) are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- A turn counts as one play or one forced pass, so "quickest win" depends partly on how often the computers have to pass.
- A game in progress is not saved. Reloading with the same address gives you the same deal from the start.

Everything runs locally in your browser.
