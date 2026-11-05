---
title: "Piano"
category: "fun"
job: "Play a colourful on-screen piano with touch, mouse or keyboard, in four instrument sounds, or follow the lit-up keys to learn four traditional tunes."
description: "Free Piano with four instrument sounds and a play-along mode for four traditional tunes. Touch, mouse or keyboard. Sound is off until you turn it on. No signup."
aiSummary: "A free browser piano. Keys can be played by touch (with sliding across keys), mouse or the computer keyboard, in one octave on a phone and two octaves on a wide screen, with an octave shift from C2 to C7. Notes are generated with the Web Audio API from stacked oscillators, using equal temperament with A4 at 440 Hz and four instrument recipes: soft, bell, organ and pluck. Play along lights the next key of one of four public-domain tunes (Ode to Joy with 30 notes, Twinkle Twinkle with 42, Mary Had a Little Lamb with 26 and Frere Jacques with 32). A wrong key never costs anything and the tune only moves on when the right note is pressed. At most 10 notes sound at once, the master gain never passes 0.15 and sound is off until the visitor turns it on. Only the number of tunes finished is kept in local storage."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The part I like is how little it needs: a note is one number, a sound is a handful of sine waves, and the whole thing is checked by tests."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎹"
---

## How to play

Press the **Sound** button first. Sound starts off, so the keys only light up until you turn it on. Then tap, click or slide a finger across the keys. In free play, sliding across keys plays each one in turn, and you can press several keys at once with several fingers.

Every note letter has its own colour: C is rose, D orange, E amber, F green, G teal, A sky and B violet. The letter is always written on the key as well, so colour is never the only clue. A black key takes the colour of the white key just below it.

**On a keyboard**, two rows of letters follow the shape of a piano. The row **Z S X D C V G B H N J M** plays the lower octave, and the row **Q 2 W 3 E R 5 T 6 Y 7 U I** plays the upper one. The letters are printed on the keys, so you do not have to remember them. The arrow keys move between keys and **Enter** or **Space** plays the key you are on. Typed keys only work after you have clicked or tapped inside the game, so they never take over the rest of the page.

### Free play

- **Instrument** has four sounds: Soft, Bell, Organ and Pluck.
- **Octave** moves the keyboard from octave 2 up to octave 5. Octave 4 starts at middle C.
- **Sustain** makes notes ring on for longer after you let go.
- **Sharps and flats** shows or hides the black keys. On a very narrow phone screen they start hidden so the white keys stay wide enough to hit.

### Play along

Pick a tune and a key lights up with an arrow above it, and the big letter in the box tells you its name. Press that key and the next one lights up. There is no timer. A wrong key costs nothing: the tune waits until you find the right one, and the message just tells you what you pressed and what comes next. **Hear it** plays the tune for you with the keys lighting up, **Start again** goes back to the first note, and finishing a tune plays a small celebration. The page remembers which of the four tunes you have finished.

| Tune | Notes |
|---|---|
| Ode to Joy | 30 |
| Twinkle Twinkle | 42 |
| Mary Had a Little Lamb | 26 |
| Frere Jacques | 32 |

All four are traditional melodies in the public domain, and each uses only the white keys. The keyboard shown in this mode is trimmed to fit the tune, so it is never wider than nine white keys.

## How it works

A note is a number. Middle C is 60, and every step up is one semitone. The pitch is 440 Hz multiplied by 2 to the power of (note minus 69) divided by 12. So the A above middle C is exactly 440 Hz, and each octave doubles the frequency. The tests check this against a second table built by repeated multiplication, for all 128 notes.

An instrument is a recipe, not a recording:

- **Soft** is a sine wave plus a quiet second harmonic, rising gently and settling to a held level.
- **Bell** stacks three sine waves at 1, 2.76 and 5.4 times the pitch. Those are not whole-number multiples, and that is what makes the sound metallic. It rings out and fades by itself.
- **Organ** adds four harmonics and holds at full level for as long as the key is down.
- **Pluck** is a bright sawtooth passed through a low-pass filter. It starts sharp and dies away quickly.

Every recipe has a loudness curve (a rise time, a settling time, a held level and a fade-out time), and the tests check that each number is inside a safe range and that the loudest case cannot pass full level before the master volume.

### Keeping it safe and tidy

- The master volume node never goes above 0.15, whatever the slider says, and a compressor sits in front of it.
- At most 10 notes sound at once. A new one beyond that cuts the oldest.
- Every sound node is disconnected when it finishes. A note you forget to release lets go by itself after 20 seconds.
- The audio engine is created only when you press the Sound button, is paused when the tab is hidden, and is closed when you leave the page.

### The keyboard layout

The page draws keys from two white-key ends, for example middle C up to the C two octaves higher: 25 keys, 15 white and 10 black. A black key sits on the line between the white keys either side of it, and the tests check that there is none between E and F or between B and C. The same window decides what the computer keys play: each of the 25 letters is one semitone, counted from the lowest C at or below the window.

### The play-along judge

Progress is two numbers: which note comes next, and how many keys were pressed that were not it. A press either matches the next note exactly, so the tune moves on, or it does not, so nothing changes. The same pitch in a different octave counts as a different key. The tests walk through each tune with the right notes and check that it ends on exactly the last one, and then press random keys and compare against a simple reference model.

## Limits

- The sounds are synthesised, so they are playful rather than realistic, and every key press is the same loudness.
- Play along checks which note you pressed, not when. The **Hear it** demo plays the notes at a fixed pace with simple lengths (short, long and dotted), so it is a guide to the tune and not a performance. Sliding across keys works in free play only, so a slip of the finger cannot play the wrong note in a tune.
- One octave fits on a phone. A wide screen shows two.
- Sound needs a browser with the Web Audio API. Without it the keys and play-along still work silently.
- Some phones keep sound muted while the ringer switch is off.

Nothing is uploaded and there is no account. Only the number of finished tunes is kept on your device. Everything runs locally in your browser.
