---
title: "Old Maid"
category: "fun"
job: "Play Old Maid against one to three computer players: match pairs, pick hidden cards and avoid the odd Star card."
description: "Free Old Maid with a Star card as the odd one out. Play 2 to 4 players with the computers, three game sizes, big cards, keyboard friendly, no ads. No signup."
aiSummary: "A free browser Old Maid for one human and one to three computer players. The pack is every card of 6, 9 or 13 ranks in four suits plus a single Star card that matches nothing, so the 25, 37 or 53 cards always leave exactly one card unpaired. A seeded Fisher-Yates shuffle deals every card out and pairs of equal rank are laid down at once. On your turn you take one hidden card from the next player who still has cards; if it matches a card you hold, the pair goes down. Both hands are shuffled after every pick so a card cannot be followed by its position. A player with no cards is safe and sits out, and the game ends when one player is left holding only the Star card. The wording is gentle: nobody loses by doing something wrong, and the closing line is Great game or Try again. The computers choose a hidden card by chance because they cannot see the cards. The engine is pure TypeScript and is tested with 1,800 random games across every player count and size, checking after every pick that no card is lost or duplicated, that exactly two pairs of every rank are laid by the end and that the one player left holds only the Star card. Games played, games ended without the Star card and the longest run of those stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the ending: with one unpaired card in the pack, the game must finish with one player holding only that card, and a test plays 1,800 random games to show it always does."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⭐"
---

## How to play

The aim is to put all your cards down in pairs. One card in the pack, the Star card, has no partner. The player who is left holding it when everyone else has run out of cards is the one who has the star this time. Then you can play again.

1. **Pairs.** Two cards with the same number or letter make a pair. The suit does not matter, so a 7 of hearts pairs with a 7 of clubs. At the start every pair in your hand is put down for you, and a number can make two pairs because there are four of each.
2. **Pick a card.** On your turn, tap one of the face-down cards in the "Pick a card" box. They belong to the next player who still has cards. The card you pick goes into your hand.
3. **Match it.** If the card you picked matches one you hold, the pair is put down at once and shows as a small badge. If it does not, you keep it.
4. **Out of cards.** When you have no cards left you are safe, and the others carry on without you. When only one player still has cards, they are holding the Star card and the game is over.

Your own cards are laid out face up under the table, sorted by number, with the Star card at the end and a gentle glow if you hold it. Each computer player's cards are shown as backs, with a count and their pairs. The computers choose their card by chance, because they cannot see the cards either.

**Sizes.** Quick uses the numbers 1 (Ace) to 6, which gives 25 cards and a short game. Medium uses 1 to 9 for 37 cards, and the Full pack uses all 13 for 53 cards. With two to four players, the cards are shared as evenly as they go.

**Kind wording.** Nothing in this game says you got it wrong. The ending line is "You are safe! Pip has the Star card. Great game!" or "You have the Star card this time. Try again!" The Star card is just luck, and both hands are shuffled after every pick, so no one can work out where it is.

**Keyboard and screen reader.** Press Tab to reach the face-down cards, use the arrow keys, Home and End to move between them, and press Enter or Space to take the one you are on. Each button reads "Card 3 of 7 from Pip. Take it." A polite status message says every pick, every pair and every player who is safe, and your own cards are a list with each card named. The sound button is off until you press it, and the sounds are short, quiet tones. Cards are told apart by their numbers and suit shapes as well as by colour.

The game has a number. The page address carries it, along with the number of players and the size, so copying the address, or using **Copy result**, gives someone else the same deal. **Restart this game** replays that deal from the beginning.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. The Star card is number 52. The shuffle is a Fisher-Yates driven by a small seeded generator, so a game number always gives the same order of cards. The seed itself is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. Taking a card returns a new state and a list of events, or nothing when the pick is not a whole number inside the hidden hand, and the page only draws the result. After a pick, both the player who drew and the player who was drawn from have their hands shuffled, like turning a fan of cards over, so the position of a card never gives it away.

Why every game ends: each number has four cards, and every hand holds at most one card of each number, because a second one would pair at once. So the cards of a number that are still in hands are always an even count (four, two or none) spread over different players. When only one player still has cards, they cannot be holding a number, because a lone card of a number would need a partner in another hand. The one card they hold must be the Star card.

The tests check these claims:

- The pack has 25, 37 and 53 cards for the three sizes, with four of every number and exactly one Star card.
- The shuffle is unbiased. A chi-square test over 6,000 shuffles of three items checks that all six orderings come up about equally, and the Star card lands with each seat in proportion to the cards that seat is dealt.
- The deal gives every player a share that differs by at most one card from the others, lays every pair at once, and never leaves two cards of the same number in a hand.
- Drawing pairs a matching card, does not pair the Star card, skips players who are out, ends the game when one player is left, and refuses any pick that is not a whole number inside the hidden hand.
- 1,800 random games, 200 for each player count and size, are played to the end. After every pick the cards are all there, no hand holds two of a number, and the counts add up. Every game ends with exactly two pairs of every number laid and one player holding only the Star card.
- The computer's pick is uniform over the hidden cards (chi-square), and it depends only on how many cards are hidden.
- In 1,500 three-player Quick games each seat ends with the Star card between 20% and 47% of the time.
- The ending wording is checked for blame words, and there are none.

## Privacy and storage

Nothing is uploaded and there is no account. Games played, games that ended without you holding the Star card, and your longest run of those are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- There is no scoring beyond the Star card, and no time limit.
- Pairs are put down for you, so there is no choice about which pair to lay.
- A game in progress is not saved. Reloading with the same address gives you the same deal from the start.

Everything runs locally in your browser.
