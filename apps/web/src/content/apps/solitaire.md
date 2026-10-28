---
title: "Solitaire"
category: "fun"
job: "Play free Klondike Solitaire with Draw 1 or Draw 3, drag and drop or keyboard play, unlimited undo, auto-complete and deal numbers you can share."
description: "Free Klondike Solitaire with Draw 1 or Draw 3, drag and drop, keyboard play, unlimited undo and shareable deal numbers. No ads, no signup, runs in your browser."
aiSummary: "A free browser Klondike Solitaire. A 52-card deck is shuffled with a seeded generator, so a deal number always gives the same layout and the page address (?deal=) can share it. It supports Draw 1 and Draw 3 with unlimited passes through the stock, drag and drop, click-to-select, a full keyboard path, unlimited undo, and auto-complete once every card on the table is face up and the stock is empty. The engine is pure TypeScript with immutable states and is tested by random play that checks that the position stays consistent after each move (52 distinct cards, face-down order, valid runs, foundation order). Random deals are shuffled, not filtered, so some cannot be won. Best times and win counts stay in the browser's local storage."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A seeded shuffle and a small rules engine, and every deal has a number so you can replay a hand or send it to someone."
status: "active"
publishedAt: "2026-10-22"
lastVerified: "2026-10-22"
license: "MIT"
icon: "🃏"
---

## How to play

Move every card onto the four foundations at the top right, one per suit, from Ace up to King. The seven columns start with one to seven cards, and only the last card of each column is face up. The other 24 cards are the stock.

- **Columns:** build downwards in alternating colours, so a red 6 goes on a black 7. A run of face-up cards moves as one unit. Only a King, or a run that starts with a King, can go into an empty column.
- **Foundations:** each one belongs to a suit and takes that suit in order, starting with the Ace. A single card goes to a foundation; a run cannot.
- **Face-down cards:** when you move the last face-up card away from a column, the card beneath it turns over by itself.
- **Stock and waste:** click the stock to turn cards onto the waste, where only the top card can be played. **Draw 1** turns one card, **Draw 3** turns three (fewer at the end of the stock). When the stock is empty, clicking it turns the waste back over to make a new stock, with no limit on passes.

There are three ways to move, and you can mix them:

1. **Drag and drop** a card or a run onto a column or a foundation. Piles where the move is legal are outlined while you drag.
2. **Click, then click.** Click a card (the selected card or run gets an outline), then click where it should go. Selecting the same card again sends it to its foundation if it fits, otherwise it deselects.
3. **Keyboard.** Arrow keys move a cursor between piles; Up and Down also step through the face-up cards of a column to choose how long a run to pick up. **Enter** picks up the card or run under the cursor, and on the next pile you move to, Enter drops it. **F** sends the top card to its foundation, **U** undoes, **Escape** cancels. Enter on the stock turns cards over.

**Undo** has no limit. **Restart this deal** replays the same cards from the beginning. **Auto-complete** switches on when every card on the table is face up and the stock is empty, and then plays the rest to the foundations one step at a time (all at once if your system asks for reduced motion). The timer starts on your first move and pauses while the tab is hidden.

Each deal has a number. The page address carries it as `?deal=` along with the draw setting, so copying the address, or using **Copy result**, gives someone the same deal.

## How it works

A card is a number from 0 to 51: the suit is the number divided by 13 (rounded down) and the rank comes from the remainder. A deal is a Fisher-Yates shuffle driven by a small seeded generator (mulberry32), so a deal number always produces the same order of cards. Column k takes k + 1 cards from the top of the shuffled deck, and the remaining 24 become the stock. Random deals use a number from 1 to 999,999 drawn with the browser's secure random source; an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. A game state is never changed in place: playing a move returns a new state, or nothing at all if the move is illegal. That makes undo simple (keep the earlier states) and makes the rules easy to test. The foundation check, the column check and the run check are three short functions, and the interface calls the same ones to decide which piles to outline while you drag.

Auto-complete is safe to offer because of a simple argument. Once every column is face up and the stock is empty, each column runs from high rank to low, so the lowest card still in play is either the top of a column or somewhere in the waste. Its suit has already been built up to just below it, so it can go to its foundation. When the card you need is in the waste, auto-complete turns it over one card at a time, even in Draw 3, so every waste card gets its turn. The tests check this on 40 positions built by working backwards from a finished game, in both draw modes, with and without cards left in the waste.

The test suite also covers the deal layout (28 cards in the columns, 24 in the stock, one face-up card per column), each legality rule including King-to-empty and wrong-colour and wrong-rank rejections, runs moving as units, automatic flipping, stock and waste cycling in both draw modes including the short turn at the end of the stock, and determinism for a deal number. A random-play fuzz then plays more than 5,000 random legal moves across 60 deals and, after every single move, checks that exactly 52 distinct cards exist, that face-down cards only sit under face-up ones, that every column run is valid and that every foundation is in order.

## Privacy and storage

Nothing is uploaded and there is no account. Your best winning time and your win count, for each draw mode, are saved in your browser's local storage as plain numbers under one key. Only wins are counted. Clearing site data removes them. The only other state is the page address.

## Limits

- Random deals are shuffled, not filtered, so some of them cannot be won. The tool does not check, and it does not tell you when you have run out of useful moves.
- There is no hint button and no scoring mode; the measures are moves, time and best time.
- Passes through the stock are unlimited in both draw modes.
- Each foundation is fixed to one suit rather than taking whichever Ace arrives first.
- In Draw 3 the waste shows its top three cards, and only the top one can be played.
- On a touch screen, dragging stops the page from scrolling when you start on a face-up card. Tapping a card and then its destination works everywhere.
- It does not save a game in progress. Reloading the page with the same address gives you the same deal from the start.

Everything runs locally in your browser.
