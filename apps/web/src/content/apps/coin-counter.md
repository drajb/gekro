---
title: "Coin Counter"
category: "fun"
job: "Practise counting US coins: count a handful, make an amount on a tray, or give change, at three levels."
description: "Free coin counting practice for kids and adults: count coins, make an amount, give change. Pennies to dollars, three levels, hints included. No ads. No signup."
aiSummary: "A free browser game for practising money with US coins. Three kinds of practice: count the coins shown and pick or type the total, make a target amount by tapping coins onto a tray, and give change from a price and a payment. Three levels: Little uses pennies, nickels and dimes up to 30 cents; Middle adds quarters and goes to 99 cents; Big adds a plain one-dollar rectangle and goes up to $5. A round is ten different questions built from a seed. All money is held as whole cents, so there is no floating-point rounding; the page formats 135 as $1.35 only when it draws it. The fewest coins for any amount is found by dynamic programming, and the tests show that taking the biggest coin first matches it for every amount up to $5 with each level's coin set. Coins are drawn in CSS with only a value and a name. Best scores are kept in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part worth a look is that the game never uses a decimal for money: everything is a whole number of cents, and the tests compare the change-making rule with a second method for every amount up to five dollars."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🪙"
---

## How to play

Choose a kind of practice and a level. A round is ten questions. There is no timer and nothing is ever taken away: you can always try again, and every question ends with a short, specific message about what you did.

**Count the coins.** A handful of coins is shown, biggest first at the Little and Middle levels. Pick the total from four choices. At the Big level you type the total instead, as cents (35) or as dollars ($1.35). If you pick or type the wrong total, you are told whether the coins add up to more or less than your guess, and you can try again. The **Help me count** button counts along the coins for you, with a running total after each one.

**Make the amount.** An amount is shown, such as 35 cents. Tap the coins in the purse to put them on the tray. The tray shows what you have and what you still need. Tap a coin on the tray to take it off, or use **Take one off** and **Clear the tray**. When the tray is exactly right the question is done, and you are told whether you used the fewest coins possible. The tray holds up to 24 coins.

**Give change.** A price is shown and what you paid with. Work out the change and put those coins on the tray. At Little you pay with a nickel or a dime, at Middle with a one-dollar rectangle for prices from 5 to 95 cents, and at Big with whole dollars (up to five of them) for prices from 31 cents to $4.99.

**Levels.**

| Level | Coins | Count the coins | Make the amount |
|---|---|---|---|
| Little | penny, nickel, dime | up to 30 cents | 2 to 30 cents |
| Middle | adds the quarter | up to 99 cents | 6 to 99 cents |
| Big | adds the dollar | up to $5.00 | 31 cents to $4.99 |

**Right first time** means you did not use help, did not guess a wrong total, and (on the tray) did not go over the amount. The score after ten questions is how many you got right first time. Your best score for each kind of practice and level is saved on your device. If you score 9 or 10 you are offered the next level, and the choice is yours.

**Coins.** Each coin is drawn with a value and a name and nothing else, in true relative sizes: the dime is the smallest and the quarter the largest. The copper one is the penny, the silver ones are the nickel, dime and quarter, and the dollar is a plain green rectangle. The coin key at the bottom lists all five. Colour is never the only clue, because every coin says what it is, and the names are never smaller than 9 pixels. The level menu and every button other than the coins themselves are at least 44 pixels tall.

**Keyboard and screen readers.** Everything works with Tab and Enter or Space. Each coin button says what it adds or takes off, the coins in a count question are described in words, and every step is announced in a message line under the question.

## How it works

All money is a whole number of cents. A quarter is 25, a dollar is 100, and $1.35 is 135. Because nothing is ever a decimal fraction, sums are exact: the classic problem where 0.1 plus 0.2 is not quite 0.3 cannot happen. The page turns a number into text such as 35 cents or $1.35 only at the moment it shows it. The tests check formatting against a second, independent formatter for every amount from 0 to 2000 cents, and check that typed amounts round-trip with the formatter for every amount from 1 to 5000 cents.

### Typed amounts

A typed amount is read with strict rules. "35", "35c", "35 cents" and "35¢" mean cents. "$1", "$1.35", "1.35" and "$.50" mean dollars. A third decimal place, a minus sign, a comma, letters in the wrong place and anything longer than twelve characters are rejected with a hint, and the typed text is never shown back: only the number it was read as.

### Fewest coins

The fewest coins for an amount is found by dynamic programming: the best answer for each amount from 1 upward is the best answer for a smaller amount plus one coin. The change rule shown by the **Show me a way** button is simpler: take the biggest coin that fits, again and again. For pennies, nickels, dimes, quarters and dollars that gives the fewest coins every time, and the tests prove it by comparing the two methods for every amount from 0 to $5.00 and every level's coin set, and against an exhaustive search for amounts up to 80 cents. The tests also show a coin set where the simple rule fails (4, 3 and 1), which is why the page only makes the claim for these five coins.

### Questions

A round is built from a seed and always has ten different questions, the same ones for the same seed. Count questions use between 2 and 5 coins at Little, 3 and 7 at Middle and 4 and 9 at Big, always a total of at least 2. The four choices at Little and Middle are the answer plus three nearby totals above zero, all different. For change, the amount is always the payment minus the price, and the tests check it is above zero for every question generated.

## Privacy and storage

Nothing is uploaded and there is no account. Your best score for each kind of practice and level is stored in your browser as small whole numbers under one key. Clearing site data removes it. The page address holds the practice, level and round number, so you can share a round.

## Limits

- US coins only, and the dollar is a plain rectangle, not a picture of a bill.
- There is no half dollar, and no price or total above $5.
- The fewest-coins note counts the dollar rectangle as one piece.
- A round is always ten questions.
