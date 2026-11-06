---
title: "Morse Tutor"
category: "fun"
job: "Learn Morse code with a chart, a blinking light, a quiz and a send-a-word game. Sound is optional and off to start with."
description: "Free Morse code tutor for kids and adults: chart, blinking light, optional sound, a 10-question quiz and a send-a-word game. No ads. No signup."
aiSummary: "A free browser tutor for International Morse code, covering A to Z and 0 to 9 (36 patterns, all different). Learn mode shows a chart; tapping a symbol draws its dots as circles and dashes as bars, blinks a light with the standard timing (dash three dots, gap one inside a letter, three between letters, seven between words) and, if the player has turned sound on, plays one quiet sine tone. Quiz asks ten questions with four choices at three levels (8 short letters, all 26 letters, letters and numbers), optionally with the pattern hidden so the player only watches and listens. Send lets the player tap Dot and Dash to spell a three, four or five letter word, decoding each letter as it is finished. Sound is off by default, the audio context is created only after the sound button is pressed, the tone never exceeds a gain of 0.12 and the light never flashes more than three times a second. Quiz bests are kept in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I like is that the timing rule is the whole system: once a dash is three dots and the gaps are one, three and seven, every message is just a list of on and off lengths, and the tests check that list unit by unit."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "📡"
---

## How to play

There are three things to do, chosen with the tabs at the top.

**Learn.** A chart shows every letter and number. Tap one and the signal panel shows it large, draws its pattern and blinks the light. Dots are small blue circles and dashes are long amber bars, so you never have to tell them apart by colour. The words underneath spell the pattern out, for example "dot dash" for A, which is also what a screen reader hears. Press **Play** to replay it. The arrow keys move around the chart.

**Quiz.** Ten questions. You see a pattern and four letters or numbers, and you pick the right one. If you pick a wrong one, it gets a dashed border and a line through it, and you try another. Untick **Show the dots and dashes** to make it harder: then you only watch the light (and listen, if sound is on) after pressing Play. The score is how many you got right first time, and your best for each level is kept on your device. Press 1 to 4 on the keyboard to choose.

- Easy uses eight letters whose patterns are three marks or fewer: E, T, I, A, N, M, S and O.
- Medium uses all 26 letters.
- Hard uses all 26 letters and the ten numbers.

**Send.** A word appears, such as CAT. Tap **Dot** and **Dash** to build the first letter and press **Next letter**. The page shows what your taps spell as you go, with a question mark if the pattern is not a letter yet. If the letter is right, it is ticked and you move on. If it is not, you are told which letter your taps made and which one is needed, and the taps are cleared so you can try again. A round is five words: three letters at Easy, four at Medium and five at Hard. **Show me this letter** draws and plays the pattern you need. Send has no score. On a keyboard, press the full stop for a dot, the minus key for a dash, N for the next letter, Backspace to take one back and Escape to clear.

**Speed** sets how long one dot lasts: 300 milliseconds at Slow, 220 at Normal, 175 at Fast.

**Sound** is off until you press the sound button, and the page makes no sound before that. It is a single quiet tone. Everything works without it, because the light and the drawn pattern carry the same information.

## How it works

Morse code gives each letter and number a pattern of dots and dashes. The table has 36 patterns and every one is different, so a pattern can only mean one symbol. The tests check the table two independent ways. The 26 letters are rebuilt from the binary tree of Morse (a dot goes left and a dash goes right, and each level adds the next letters), and the ten numbers from their rule: 1 to 5 are that many dots followed by dashes up to five marks, 6 to 9 are dashes followed by dots, and 0 is five dashes. Both agree with the table, and encoding then decoding returns the original text for every symbol and for 500 random messages.

### The timing

Everything is measured in dot-lengths. A dot is 1 on, a dash is 3 on, the gap between the marks of one letter is 1 off, between letters 3 off, and between words 7 off. As a check, the test word PARIS comes to 50 units including the gap after it, the standard way to define Morse speed. The tests also expand every symbol and 2,000 random messages one unit at a time, as ones and zeros, by a separate method, and compare.

### Sound and the light

- **Loudness.** The tone is a pure 600 hertz sine wave. Its volume goes up and down over 8 milliseconds at each end of a mark so there is no click. Its loudest point is 0.12 on a scale where 1 is full volume, and the tests check that no point in the plan is ever above 0.15.
- **Created only after a click.** The audio system is built inside the sound button's click handler and closed when you leave the page. A hidden tab stops sound and light.
- **Flashing.** The fastest the light can go is a run of dots, one flash every two dot-lengths. At the Fast speed that is under 2.9 flashes a second, so the light never flashes more than three times a second at any speed. The tests check each speed and count real flashes in one-second windows.

### Questions

Quiz answers are dealt from a shuffled bag of the level's symbols, so none repeats until the bag is used up (ten different questions at Medium and Hard) and none comes twice in a row. The three wrong choices come from the same pool, and the four are listed in table order. The send lists are hand-written everyday words: 18 three-letter, 22 four-letter and 18 five-letter words, none repeated.

| Claim | How it is checked |
|---|---|
| 36 different patterns | the table is compared with a tree and a digit rule |
| 1 : 3 : 1 : 3 : 7 timing | a unit-by-unit expansion of 2,000 random messages |
| PARIS is 50 units | direct total |
| Tone never above 0.15 | every point of the gain plan, at several speeds |
| At most 3 flashes a second | each speed, plus counted flashes |
| Four different quiz choices with the answer once | 400 seeds at each level |
| Sending the right pattern completes every word | all 58 words are tapped out and committed |

## Privacy and storage

Nothing is uploaded and there is no account. Your best quiz score for each level is stored in your browser as a small whole number. Clearing site data removes it. The page address holds the tab, level, speed and round number.

## Limits

- Only letters and numbers. Punctuation and special signals are not taught.
- The light starts from a timer in your browser, so on a busy device it can be a few milliseconds off the sound.
- Send checks which pattern you made, not how evenly you timed your taps.
- Without sound you learn the look and rhythm of the code. Turn sound on to learn the ear half.
