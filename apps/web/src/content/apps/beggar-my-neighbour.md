---
title: "Beggar My Neighbour"
category: "fun"
job: "Play Beggar My Neighbour against the computer: turn cards, pay for Jacks, Queens, Kings and Aces, and collect the pile."
description: "Free Beggar My Neighbour against the computer. Pure luck: face cards make the other player pay, one card at a time. Step or auto-play, no ads. No signup."
aiSummary: "A free browser Beggar My Neighbour for one human against one computer player, using a standard 52-card pack dealt 26 each. Players turn their top card onto a middle pile in turn. A number card passes the turn; a Jack makes the other player pay 1 card, a Queen 2, a King 3 and an Ace 4, played one at a time. If the payer turns up a face card the payment stops and the other player must pay for that card instead. When a payment is made in full, the player who asked collects the whole pile underneath their cards in the order it was played and leads next. A player who must play and has no card loses. There are no choices in the game, so the deal decides it; the player only chooses how fast to watch, with a single Play button, an auto-play switch and four speeds. The shuffle is a Fisher-Yates driven by a seeded generator, so a game number reproduces the deal and the page address carries it. Some deals would go round in a circle for ever, so every time a pile is collected the page checks whether the same hands and the same leader have come up before and calls a repeat a draw. The engine is pure TypeScript and is checked against an independent second implementation on thousands of deals. Games played, games won, draws and your longest win stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the endless deals: the cards can go round in a circle for ever, and the engine proves it by spotting the same hands and the same leader a second time."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎴"
---

## How to play

This is a game of luck, so there is nothing to work out. The cards are dealt and the game plays itself out as you press Play. The aim is to win every card.

1. **Play a card.** Press **Play my card** to turn your top card face up onto the middle pile. Then Pip plays a card, and so on.
2. **Number cards.** Cards from 2 to 10 just pass the turn to the other player.
3. **Face cards.** A Jack makes the other player pay 1 card, a Queen 2, a King 3 and an Ace 4. They pay one card at a time, face up on the pile. A banner shows how many have been paid.
4. **Paying.** If the payer turns up a number card each time, they pay in full and the player who asked collects the whole pile, adds it underneath their cards, and plays next.
5. **Turning it round.** If the payer turns up a Jack, Queen, King or Ace while paying, the payment stops. Now the other player must pay for that card instead.
6. **Winning.** A player who has to play a card but has none loses. Often the last card is paid out and the other player ends up holding the whole pack.

**Auto-play.** Switch on **Auto-play** and the game plays both sides at the speed you choose: Slow, Normal, Fast or Very fast. With Auto-play off, you press Play for your own cards and Pip plays after a short pause. A typical game takes a few hundred cards, so Very fast is a good way to see one finish. At the faster speeds only the main events are read out by a screen reader, so that it is not flooded.

**A draw.** Some deals never end. The cards go round in a circle, the same hands and the same leader coming up again and again. When the game spots this it calls a draw and says so kindly.

**Keyboard and screen reader.** Press Tab to reach Play my card and press Enter or Space. Press A anywhere in the game to turn auto-play on or off. A polite status message says each card, each demand, who collects the pile and how the game ended. The sound button is off until you press it, and the sounds are short, quiet tones. Cards are told apart by number and suit shapes as well as colour.

The game has a number. The page address carries it, along with the speed, so copying the address, or using **Copy result**, gives someone else the same deal. **Restart this game** replays that deal from the beginning.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. The shuffle is a Fisher-Yates driven by a small seeded generator, so a game number always gives the same order of cards. The seed itself is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. Each step plays one card and returns a new state with the events it caused. There are no decisions anywhere, so two games from the same deal are always identical.

**Loops.** Whenever a pile is collected the middle is empty, and what happens next depends only on both hands (in order) and on who plays next. So if the same two hands and the same leader are ever seen a second time, the game would repeat for ever. The engine keeps every such position it has seen and ends the game as a draw on a repeat. A cap of 20,000 cards played is a second safety net that no real game comes near.

The tests check these claims:

- The pack has 16 face cards, and the penalties of 1, 2, 3 and 4 add up to 40 for the pack.
- The shuffle is unbiased. A chi-square test over 6,000 shuffles of three items checks that all six orderings come up about equally, and another over 10,400 shuffles of the pack checks that one card lands in all 52 positions about equally.
- Each rule has its own hand-built position: number cards passing the turn, a Jack, Queen, King and Ace asking for 1, 2, 3 and 4 cards, a payment turned round by a face card and bouncing back and forth, the pile going underneath the collector's hand in the order played, a payer who runs out of cards, a payer who pays with the very last card, and a player who has to lead with nothing.
- The whole game is compared with a second, separately written implementation of the rules on 2,500 full deals and 2,500 small positions. Winner, number of cards played and the way the game ended agree every time.
- Five small positions that go round in a circle are called a draw by the engine, and an independent replay without loop detection shows each is still going after thousands of cards.
- No card is lost or duplicated at any step of 400 whole games, and over 2,500 deals a game takes about 260 cards on average, with none anywhere near the cap. The player who moves first wins about half of them.

## Privacy and storage

Nothing is uploaded and there is no account. Games played, games won, draws and your longest win are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- There are no choices to make, and no points beyond winning the cards.
- Very fast auto-play is quick but not instant: a long game still takes a little while.
- A game in progress is not saved. Reloading with the same address gives you the same deal from the start.

Everything runs locally in your browser.
