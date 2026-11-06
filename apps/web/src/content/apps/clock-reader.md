---
title: "Clock Reader"
category: "fun"
job: "Learn to tell the time on an analogue clock: read it, set it, or match clocks to times, from the hour to every minute."
description: "Free analogue clock game for children. Read the time, set the hands, or match clocks to times. From on the hour to every minute. No ads. No signup."
aiSummary: "A free browser game for learning to tell the time on an analogue clock. The clock is drawn as an SVG from formulas: the long hand turns 6 degrees a minute, the short hand 30 degrees an hour plus half a degree for every minute, so it drifts toward the next number the way a real one does. Three modes: Read (pick the time from three choices), Set (turn the hands to a time that is asked for, by dragging the face or with buttons) and Match (pair four clocks with four times). Five levels of exactness: on the hour, half hours, quarter hours, every five minutes and every minute. The wrong choices in Read are the usual slips: the hands swapped over, the hour one out, the minutes of another time. There are no timers and no fail screen. The longest run of clocks done first time, for each level, is kept in local storage on the device. Nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The detail I enjoyed getting right was the short hand: it creeps toward the next number as the minutes pass, so half past three has it half way between the 3 and the 4."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🕒"
---

## How to play

Pick a mode, then how exact you want the times to be: **On the hour**, **Half hours**, **Quarter hours**, **Five minutes** or **Every minute**. The clock has a ring in four colours, one for each quarter of the face, with the numbers 1 to 12 inside. The short hand is amber and the long hand is sky blue.

**Read.** Look at the clock and pick the time from three big buttons. You can also press 1, 2 or 3. The page tells you what the right answer was, in numbers and in words ("Yes! 3:45 is quarter to four."). A wrong pick shows the right time and waits; press **Next clock** when you are ready. Nothing is taken away. The two wrong choices are the slips a child often makes: the two hands swapped over (so a clock at 3:20 might be offered as 4:15), the hour one out, or the minutes of a different time.

**Set.** The page asks for a time, for example "Set the clock to 4:15 (quarter past four)". Choose the **Long hand** or the **Short hand**, then drag or tap on the clock face to turn it, or use the four buttons to move a hand back or on. The hand snaps to a time the level allows. Press **Check**. If it is not right yet you get a kind hint about which hand to look at ("The short hand is right. Now move the long hand: it should point at the 3."), and you can try as often as you like. **Show me** puts a faint dashed copy of the right hands on the clock; if you use it, the count of clocks in a row starts again.

**Match.** Four clocks on the left, four times on the right. Tap a clock and then the time it shows. A right pair turns green with a tick and its own coloured border; a wrong one is just undone. **New clocks** plays again, and **Another clock** in Read and Set swaps the current clock for a new one.

In Read and Set the page keeps a count of **In a row**: clocks done first time, with no help. A wrong answer starts the count again, quietly. Your **Best run** for each level is kept on your device.

### Keyboard

The controls are real buttons and a menu, so they all work with Tab. In Set, Tab to the clock face and use the arrow keys to turn the chosen hand, then press Enter or Space to check. A screen reader hears a description of the hands ("The short hour hand is nearly at the 4. The long minute hand is on the 9.") and the same messages as everyone else.

## How it works

The long hand points at the minute times 6 degrees. The short hand points at the hour times 30 degrees plus half a degree for every minute. The tests check both hands for all 720 times of a 12 hour clock against a separate model (minutes since 12 o'clock) and against the textbook formula for the angle between the hands, |30h - 5.5m|. They also check that the hands only meet at 12:00 among whole minutes, and that at half past the short hand sits exactly half way between two numbers.

The same formulas run backwards when you drag a hand. The angle of your finger, seen from the centre of the clock, becomes a minute (snapped to the nearest time the level allows, measured round the dial, so a hand dropped just before 12 reads 0 and not 60) or an hour (allowing for the drift, so a short hand placed where it belongs for 3:45 reads as 3). The tests turn every hand position back into the time it came from at every level.

The face is drawn from numbers too: 60 tick marks with a longer one every fifth minute, 12 numbers on a circle, and four curved bands for the coloured ring. The tests check where each one sits.

Every time has words, for example "five past three", "quarter to four", "twenty-five to four" and "seven minutes past three". The tests check a full table of them and that all 720 times give different, complete words.

**The choices.** The three buttons in Read are always three different times that all suit the level (a quarter-hour level never offers 3:07). The swapped-hands slip is always one of the wrong choices when it is a valid time at that level, and the right answer lands in each button about equally often.

**Match.** Each game has four different times and the time cards are never in the same order as the clocks. The tests play thousands of games with random pairing and check that they always finish, that a right pair is never undone, and that the count of misses only goes up.

## Privacy and storage

Nothing is uploaded and there is no account. The longest run for each level (a whole number from 1 to 999, five numbers at most) is saved in your browser's local storage. When it is read back, only the five known levels are accepted and only whole numbers in range.

## Limits

- It teaches reading and setting the clock, not the 24 hour clock or time sums.
- The words for times follow the way people say them in English ("quarter to four"). They are shown, not spoken aloud.
- Runs stay in one browser. A different browser, a private window or cleared site data starts from nothing.

Everything runs locally in your browser.
