---
title: "Bubble Pop"
category: "fun"
job: "Pop bubbles by tapping them: pop the right colour, the right number, or find the one bubble that is different."
description: "Free, calm bubble popping game for young children. Tap bubbles to match a colour or number goal. Big slow bubbles, no timer, no ads. No signup."
aiSummary: "A free browser bubble popping game for small children. Bubbles drift up a calm field and are popped only by tapping or pressing them. Each round has one goal: pop a number of bubbles of one colour, pop a number of bubbles that show one number, or find the one bubble that is a different colour. Three sizes: Little (three giant, slow bubbles, numbers 1 to 5, three colours), Middle (five bubbles, numbers 1 to 9, four colours) and Big (seven bubbles, numbers 1 to 12, six colours). A bubble is never narrower than 56 pixels. There is no timer, no lives and no fail screen; a bubble that does not count simply pops. The field always holds enough bubbles to finish the goal, which the tests prove with thousands of simulated steps. Every colour also has its own shape. A Pause button stops the drift and reduced motion keeps the bubbles still. No sound. The number of rounds finished on each size is kept in local storage on the device."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part worth writing carefully was making sure a goal can never become impossible: whatever you pop, and however long you wait, the field always has enough of the right bubbles on it."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🫧"
---

## How to play

Choose a size: **Little**, **Middle** or **Big**. Little has three giant, slow bubbles. Middle has five, and Big has seven, a little smaller but still easy to tap. The goal is at the top, in words and in a picture.

There are three kinds of goal, and they take turns:

- **Colour**: "Pop 3 purple bubbles". A row of small circles under the goal fills in as you go.
- **Number**: "Pop 2 bubbles with the number 4". The bubbles all share one colour and carry different numbers.
- **Odd one out**: "Find the bubble that is different". All the bubbles are one colour except one.

Tap a bubble to pop it. If it was one you wanted, the message under the field says so: "Yes! That is 1 of 3. 2 to go." If it was not, it still pops, and the message says what it was and what you are looking for: "Pop! That one was pink. We want purple ones." Nothing is lost and nothing counts against you. When the goal is done the rest of the bubbles pop together, and you press **Next round** for a new goal. **Another goal** swaps the current goal for a new one.

After every fifth finished round on Little or Middle, the page offers the next size up. It is only an offer; nothing changes unless you press the button.

Every colour also has its own shape in the middle of the bubble: blue is a circle, yellow a star, pink a diamond, purple a triangle, green a hexagon and orange a square. So the colour is never the only clue.

**Pause bubbles** stops the drifting. You can still pop bubbles while it is paused. If your device is set to reduce motion, the bubbles stay still on their own and a popped bubble is simply replaced in a free spot. There is no sound.

### Keyboard

Press Tab to move from bubble to bubble. Enter or Space pops the one you are on, and focus moves to the next bubble. A screen reader reads each bubble as, for example, "purple bubble with a triangle" or "Bubble with the number 4", and reads the message after each pop.

## How it works

The field is 100 units wide and 130 tall. Bubbles rise at a steady speed (3 units per second on Little, which is 43 seconds to cross the field; 4.5 on Middle; 6 on Big, which is still more than 20 seconds) and sway a little from side to side, never more than 1.4 units. A bubble that drifts off the top is removed. A frame never counts for more than 0.05 seconds, so a slow device cannot make bubbles jump.

**The goal can always be reached.** After every step and every pop, the field is checked. It must hold at least two bubbles that count toward the goal (or however many are still needed, if fewer), and in an odd-one-out round exactly one different bubble. If the right bubbles have drifted away or been popped, new ones appear straight away in the lower part of the field. Then the field is topped up to three, five or seven bubbles with a mix of the rest. The tests simulate thousands of steps on three sizes, four field widths and every kind of goal, with a player who does nothing, a player who pops at random and a player who pops only what counts. The invariants hold at every step, and the player who pops only what counts always finishes after exactly the number of pops the goal asks for.

**The goal for each round** depends only on the seed (kept in the page address), the size and the round number. The tests check that the same inputs always give the same goal, that the amount asked for stays in the size's range (2 to 3 bubbles on Little, 3 to 5 on Middle, 4 to 8 on Big), that numbers and colours stay in the size's range, and that two rounds in a row are never the same kind.

**Size.** Bubbles are 34, 25 and 20 percent of the field width on the three sizes, but never narrower than 56 pixels, however small the screen. The tests check this for every width from 130 to 1400 pixels.

**Tapping.** A tap pops the bubble whose centre is closest to the tap, among those within 12 percent of a bubble's radius, so a near miss still counts. The test compares this with a brute-force check on a grid of taps over many fields.

## Privacy and storage

Nothing is uploaded and there is no account. The only thing saved is the number of rounds you have finished on each size, as three small whole numbers in your browser's local storage. When they are read back, only the three known sizes are accepted and only whole numbers from 1 to 9999.

## Limits

- It is a game for small children, so it asks very little. There is no score to beat and nothing to compare with other people.
- Bubbles move with the browser's animation clock, so on a very slow device they may look a little jumpy; the step is capped so they never jump far.
- Counts stay in one browser. A different browser, a private window or cleared site data starts from nothing.

Everything runs locally in your browser.
