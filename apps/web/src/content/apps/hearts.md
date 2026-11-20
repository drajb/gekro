---
title: "Hearts"
category: "fun"
job: "Play Hearts against three computer players: pass cards, follow suit, dodge the hearts and the queen of spades, and try to shoot the moon, with three levels and full keyboard play."
description: "Free Hearts against three computer players: pass cards, dodge the hearts and the queen of spades, shoot the moon. Three levels, keyboard friendly. No signup."
aiSummary: "A free browser Hearts for one human and three computer players using a standard 52-card pack. Each hand starts with a pass of three cards (left, right, across, then no pass), the 2 of clubs leads, and players must follow suit. Nobody may play a heart or the queen of spades on the first trick unless they hold nothing else, and a heart cannot be led until one has been played. Every heart is 1 point and the queen of spades is 13, so every hand holds exactly 26 points; a player who takes all 26 shoots the moon, scoring 0 while the others score 26. The game runs to 100 points (50 in the short game) and ends when someone reaches the limit and there is a single lowest score, which wins. The shuffle is a Fisher-Yates driven by a seeded generator, so a game number reproduces every deal and the page address carries it. Easy plays any legal card, Medium uses the usual habits, and Hard also counts cards, tracks who is out of which suit and takes a trick to stop a moon. Computer players never see your hand. The engine is pure TypeScript and is tested by comparing the legal cards in every position of 1,500 random hands with an independent rule checker, and the points with an independent scorer over 2,000 hands. Games played, games won, your lowest score and moons shot stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the rule book: the legal-card logic is checked against a second, independently written rule checker for every card in every position of thousands of random hands."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "♥️"
---

## How to play

Hearts is a game of avoiding things. Every heart you take costs 1 point and the queen of spades costs 13, so there are 26 points in every hand and the player with the lowest total at the end wins.

1. **Pass.** Before most hands, choose three cards from your hand and press **Pass 3 cards**. The first hand passes to the left, the second to the right, the third across the table, and the fourth hand has no pass. Then it starts again. Good cards to pass are the queen of spades, high hearts and other high cards. The cards you receive are marked "new".
2. **Lead.** The player with the 2 of clubs plays it to start the hand. Whoever takes a trick leads the next one.
3. **Follow suit.** If you have a card of the suit that was led, you must play one. If you do not, you may play anything. Cards you cannot play are dimmed and crossed with diagonal lines, and tapping one says why, for example "You must follow suit: play a club."
4. **First trick.** Nobody may play a heart or the queen of spades on the first trick unless every card they hold is a point card.
5. **Hearts are broken.** You cannot lead a heart until a heart has been played, unless all you hold are hearts. The queen of spades does not break hearts.
6. **Take or duck.** The highest card of the suit that was led takes the trick, and its owner takes any points in it. Suits other than the one led never win.
7. **Shoot the moon.** If one player takes every heart and the queen of spades, that player scores 0 and each of the other three scores 26.

The game is played to 100 points, or 50 in the short game. It ends when someone reaches the limit and one player has the single lowest score. If the lowest score is shared, another hand is played. After each hand a table shows who took what and the new totals.

**Seats and colour.** You sit at the bottom. Pip sits on your left, Dot across the table and Moss on your right. The four cards of a trick sit side by side under each player's name, and the winner's card is outlined. Suits are told apart by their shapes (spade, heart, diamond, club) as well as by colour, and a point card carries a small ring in its corner.

**Levels.** Easy plays any legal card. Medium follows the usual habits: it passes the queen of spades and high hearts, ducks under the winning card when it can, throws the queen of spades when it cannot follow suit, and leads low cards. Hard does all that and also counts the cards already played, remembers which players have run out of a suit, and takes a trick that contains a point when one player is collecting all the points, to stop a moon. You can change the level at any time and it applies from the next computer move. Changing the game length deals the game again.

**Keyboard and screen reader.** Press Tab to reach your cards. The arrow keys, Home and End move between them, and Enter or Space plays the card, or chooses it to pass. Escape puts back the cards you chose to pass. Every card played, every trick taken and every score is spoken through a polite status message, and each card button reads its name, whether it can be played and how many points it carries. The sound button is off until you press it, and the sounds are short, quiet tones.

The game has a number. The page address carries it, along with the level and the length, so copying the address, or using **Copy result**, gives someone else the same deals. **Restart this game** replays it from the first hand.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. Each hand's shuffle is a Fisher-Yates driven by a small seeded generator, mixed from the game number and the hand number, so the same game number always gives the same deals. The seed itself is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. Playing a card returns a new state and a list of events, or nothing when the card is illegal, and the page only draws the result. The computer players see only what a player at the table would see: their own hand, the cards on the table, the tricks already taken, and who has failed to follow which suit.

The tests check these claims:

- The pack has exactly 26 points: 13 hearts at 1 each and the queen of spades at 13. Every one of 2,000 random hands ends with exactly 26 points taken, and the pack is intact (52 distinct cards) after every card.
- The shuffle is unbiased. A chi-square test over 6,000 shuffles of three items checks that all six orderings come up about equally, and another over 4,000 deals checks that the queen of spades lands with each of the four players about equally often.
- The deal gives 13 cards to each player, the holder of the 2 of clubs leads, and the pass sends the right three cards to the right player in all four directions. A pass that is not exactly three distinct cards from that hand is refused.
- The legal-card logic is compared with a second rule checker, written separately from the rules text, for every card in every position of 1,500 random hands in all four pass directions. That is more than 300,000 comparisons, and the two never disagree. No position leaves a player with nothing legal to play.
- The points in each of 2,000 hands match an independent scorer that finds the trick winners itself, and a moon gives 0 to the shooter and 26 to each other player.
- The end of the game needs both a score at the limit and a single lowest score: hands built by hand show a game ending, and a game continuing when the lowest score is shared.
- All three levels always choose a legal card and a legal pass. Over 1,200 seeded hands each, Hard finishes ahead of Easy and Medium, and Medium ahead of Easy, and Hard does take a heart to stop a moon where Medium ducks.
- Whole games to 100 and to 50 points all finish, with a single winner on the lowest score, and a game of random players always ends well inside a few dozen hands.

## Privacy and storage

Nothing is uploaded and there is no account. Games played, games won, your lowest final score and the number of moons you shot are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- The computer players do not try to shoot the moon themselves; they only try to stop you.
- Cards are passed only in the order described: there is no choice of direction.
- A game in progress is not saved. Reloading with the same address gives you the same deals from the first hand.

Everything runs locally in your browser.
