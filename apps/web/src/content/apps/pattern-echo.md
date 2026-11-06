---
title: "Pattern Echo"
category: "fun"
job: "Play a memory game: watch six pads light up in a growing order, then repeat the order. Sound is optional and off until you turn it on."
description: "Free memory game with six pads in a ring. Watch the lights, repeat the pattern, and grow it to 20. Optional quiet sound, off by default. No ads. No signup."
aiSummary: "A free browser memory game. Six pads sit in a ring, each with its own colour, shape, number and note. A pattern starts at one light and gains one light each time it is repeated in full, up to 20. A mistake never ends the run: the same pattern is shown again. The same pad never comes up three times in a row, and earlier pads in a pattern never change. Three speeds start at 800, 600 and 440 ms between lights, get 7 percent quicker every four lights and never go below 340 ms, so no light flashes more than three times a second. Sound is optional: it is off by default, is made with Web Audio sine oscillators only after the sound button is pressed, uses the notes C, D, E, G, A, C of a pentatonic scale, and stays at or under a gain of 0.07 per tone with a 0.15 ceiling. The longest pattern repeated at each speed is saved in the browser; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. I wanted a memory game that is gentle about mistakes and fully playable in silence, so every pad has a shape and a number as well as a colour, and sound is something you switch on rather than something that surprises you."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎵"
---

## How to play

Press **Start**. The pads light up one at a time in a pattern, beginning with a single light. When the centre says **Your turn**, tap the same pads in the same order. If you get it all right, the pattern grows by one light and is shown again. Repeat all 20 to win.

- **Mistakes are fine.** Tap a wrong pad and the same pattern is shown again, so you can try that length once more. There is no game over and no limit on tries. Your best length is kept.
- **Show me again** replays the current pattern during your turn.
- **Pads.** Six pads form a ring. Each has a shape (circle, square, triangle, diamond, star, cross), a colour and a number from 1 to 6, so you never have to rely on colour. A lit pad turns bright and gets a thick outline.
- **Keys.** Press **1** to **6** to play a pad, or use the arrow keys to move round the ring and **Enter** or **Space** to press the one you are on. Tab goes to the ring once, then the arrows take over.
- **Speed.** Easy, Medium and Hard set how fast the lights come. Changing the speed starts over.
- **Free play.** Before you press Start, and after a win, tapping a pad lights it and sounds it, so little ones can try the pads first.

The dots under the ring show how long the current pattern is and how much of it you have repeated. When your tab is hidden the pattern stops, and it is shown again from the start when you come back. If your system asks for reduced motion, the pads stop growing and glowing; the lights themselves still light up, because they are the game.

## Sound

Sound is off. Press **Sound is off** to turn it on; the sound system is only created at that moment, and the button says **Sound is on** when it is. Every pad has its own note from a pentatonic scale: C, D, E, G, A, then the C above (C4 D4 E4 G4 A4 C5), so any pad sounds fine after any other. The frequencies come from the standard equal-temperament formula with A at 440 Hz. Mistakes get a soft low tone, not a buzzer.

The sounds are made with Web Audio sine oscillators in the page: no sound files are downloaded. Each tone fades in over 10 milliseconds and fades out, peaks at a gain of 0.07, and only one tone plays at a time (the previous one is faded out as the next begins), so the combined level stays under the 0.15 ceiling. The tests check the envelope maths, that the peak never exceeds 0.07, and that the page creates its audio system in one place, reached only from the sound button. The game plays the same with sound off.

## Speed and the lights

| Speed | Time between lights at the start |
|---|---|
| Easy | 800 ms |
| Medium | 600 ms |
| Hard | 440 ms |

Every four lights the pace gets 7 percent quicker, but never faster than 340 ms between lights. That is under three lights a second, so nothing flashes quickly. A pad stays lit for 60 percent of its time slot and is dark for the rest, which is always at least 130 ms, so two lights on the same pad in a row are still two separate lights.

## How it works

The engine is a set of plain functions with no page attached, and it takes its random numbers as an argument so every test is exact.

- **The pattern.** Each new pad is picked uniformly from the allowed pads. All six are allowed, except that the same pad may not come up three times in a row, so after two equal pads the next is chosen from the other five. A pattern only ever gains a pad at the end; the earlier pads never change. The tests scan 600 seeded 20-pad patterns for three in a row (none), check that each pad turns up about a sixth of the time over 60,000 pads, and check that after two equal pads the other five are chosen about a fifth of the time each.
- **Checking your taps.** A tap is compared with the pad at your position in the pattern. The tests run 40,000 mixed good and slipped presses and compare every result with a second, plain model written from the rules in words: right pad moves on, finishing adds one pad, wrong pad counts a mistake and resets your position to the start of the same pattern.
- **Reaching 20.** For 40 seeds a perfect player is run through all 20 lengths. The pattern is one pad long, then two, up to 20, with 210 taps in total, and the 20th length ends the run as a win.

## Best score and storage

The longest pattern you have repeated in full at each speed is saved in your browser as a whole number from 1 to 20, so there are at most three small numbers in one key. The page address holds the speed. Sound is never saved, so it is off each time. Nothing is uploaded and there is no account.

## Limits

- One pattern length at a time; there is no two-player mode.
- Speed settings change the pace only. They do not change the number of pads.
- The page cannot tell whether your device's sound is muted outside the page, so if sound is on and you hear nothing, check the device volume.
