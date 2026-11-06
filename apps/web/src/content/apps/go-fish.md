---
title: "Go Fish"
category: "fun"
job: "Play Go Fish against one to three computer players: ask for ranks, fish from the pond and lay down books of four, with three levels and full keyboard play."
description: "Free Go Fish against 1 to 3 computer players. Ask for a rank, fish from the pond, make books of four. Three levels, keyboard friendly, no ads. No signup."
aiSummary: "A free browser Go Fish with traditional rules and a standard 52-card pack. You play against one, two or three computer players, which are Easy, Medium or Hard. Two players get 7 cards each and three or four players get 5 each. On your turn you ask one player for a rank you hold; they hand over every card of that rank and you ask again, or they say Go Fish and you draw the top card of the pond, and you go again only if it is the rank you asked for. Four of a rank are laid down as a book, a player with no cards draws 5 from the pond or sits out if it is empty, and the game ends when all 13 books are made. The shuffle is a Fisher-Yates driven by a seeded generator, so a game number reproduces the deal and the page address carries it. Computer players use only what was said out loud, never your hand. The engine is pure TypeScript and is tested with random games for two, three and four players that check 52 distinct cards, no unbooked set of four and exactly 13 books at the end. Games played, games won and your best book count stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the computer players: they only use what was said out loud at the table, so Hard wins by remembering the asks and not by peeking at your cards."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🃏"
---

## How to play

Collect books. A book is all four cards of one rank, such as the four 7s. When all 13 books have been made, the game ends and the player with the most books wins.

1. **Choose a card.** On your turn, tap one of your cards. Your hand shows one button for each rank you hold, with the cards of that rank fanned inside it. The rank you choose is the rank you will ask for, and you can only ask for a rank you already hold.
2. **Choose who to ask.** Tap the player you want to ask. The button says, for example, "Ask Pip for 7s".
3. **If they have any,** they give you every card of that rank, and you ask again.
4. **If they have none,** they say Go Fish and you draw the top card of the pond. If the card is the rank you asked for, you ask again. Otherwise your turn is over.
5. **Books** are laid down the moment you hold all four cards of a rank, whether they came from a player or from the pond. They appear as small badges beside the "Your cards" heading, and each opponent's books show at that opponent's seat.

Two players are dealt 7 cards each. With three or four players everyone gets 5. A player who runs out of cards draws 5 from the pond when their turn comes, or fewer if the pond is nearly empty. If the pond is empty too, that player sits out for the rest of the game. If nobody else has any cards left to ask, you draw from the pond instead.

The computer players take a short, fixed moment before each move so you can follow what happens, and a shorter one if your system asks for reduced motion. A line above your cards and a status line below say what just happened: who asked whom for which rank, which cards were handed over, and which card you drew. A computer player's draw is only named when it was the rank it asked for, because that is when it would show you at a real table.

**Levels.** Easy asks for any rank it holds. Medium also uses the last eight asks it saw. Hard remembers every ask, asks for the rank it holds the most of, and avoids a player who just said Go Fish for that rank. You can change the level at any time and it applies from the next computer move. Changing the number of opponents deals the game again.

**Keyboard and screen reader.** Press Tab to reach your cards. The arrow keys, Home and End move between ranks, and Enter or Space chooses one. Tab to the Ask buttons and press Enter, or press 1, 2 or 3 to ask that opponent. Escape lets go of a choice. Every ask, hand-over, draw and book is spoken through a polite status message, and each rank button reads its cards out by name.

The game has a number. The page address carries it, along with the number of opponents and the level, so copying the address, or using **Copy result**, gives someone else the same deal. **Restart this game** replays that deal from the beginning.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13, rounded down, and the rank comes from the remainder. The shuffle is a Fisher-Yates driven by a small seeded generator, so a game number always gives the same order of cards. The seed itself is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295. The computer's choices come from the same generator, so a restart with the same moves from you plays out the same way.

The rules live in a plain TypeScript module with no page code in it. Playing a move returns a new state and a list of events, or nothing when the move is illegal, and the page only draws the result. The computer players do not look at your hand. Each one keeps a small memory made only of public events: who asked for which rank, who handed cards over, who said Go Fish. A Go Fish answer counts as "did not have it then", and any draw clears that, because the card drawn could be anything.

The tests check these claims:

- The shuffle is unbiased. A chi-square test over 6,000 shuffles of three items checks that all six orderings come up about equally, and another over 10,400 shuffles of the pack checks that one card lands in all 52 positions about equally.
- The deal is 7 cards each for two players, 5 each for three or four, with the rest in the pond, and a dealt set of four is laid down at once.
- Every ask rule has its own test: taking cards and asking again, Go Fish with a miss, a lucky draw going again, books from a hand-over and from a draw, refilling an empty hand, a short pond, an empty pond and sitting out, and the game ending on the 13th book. Illegal asks (yourself, a rank you do not hold, a player with no cards, a rank outside 1 to 13) are refused.
- A fuzz of 250 random games for each of two, three and four players checks, after every single action, that exactly 52 distinct cards exist, that no hand holds an unbooked set of four, that no rank is booked twice and that whoever is to move can act. Each game ends with all 13 books made and every hand empty, and 150 more games with all three computer levels at one table also finish.
- Hard beats Easy: over 400 seeded two-player games, alternating who goes first, Hard made more books in total and won more games.

## Privacy and storage

Nothing is uploaded and there is no account. Games played, games won (or tied for the most books) and your most books in one game are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- There are no points beyond books, and no time limit.
- You cannot ask a player who has no cards. If nobody has cards, the game asks you to draw from the pond.
- A game in progress is not saved. Reloading with the same address gives you the same deal from the start.

Everything runs locally in your browser.
