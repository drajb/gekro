---
title: "Drum Pad"
category: "fun"
job: "Play 16 drum and percussion pads, then build a looping 16-step beat with tempo, swing and ready-made rhythms."
description: "Free Drum Pad: 16 synthesised drum pads and a 16-step loop sequencer with tempo, swing and preset beats. Sound is off until you turn it on. No signup."
aiSummary: "A free browser drum machine. Sixteen pads in a 4x4 grid make drum, cymbal, tom and bass sounds that are generated on the fly with the Web Audio API from oscillators and filtered noise, with no sample files. A sixteen-step sequencer loops a beat at 60 to 180 BPM with 0 to 50 percent swing and seven preset rhythms. A page timer fires every 25 ms and schedules every step that starts within the next 100 ms on the audio clock, using step-time arithmetic that is tested exactly. At most 12 voices sound at once, the master gain never passes 0.15, and sound is off until the visitor turns it on. The beat is stored as a 64-digit hex code in the page address; nothing else is saved or sent."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is the timing: the sounds are placed on the audio clock ahead of time, so a busy page cannot make the beat wobble."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🥁"
---

## How to play

Press the **Sound** button first. Sound starts off, so the pads only light up until you turn it on. Then tap any of the 16 pads to hear it. The pads come in four colour families, and every pad also has its own shape and name, so colour is never the only clue:

| Row | Family | Pads |
|---|---|---|
| 1 | Drums (rose) | Kick, Snare, Clap, Rim |
| 2 | Cymbals and shakers (amber) | Hat, Open hat, Shaker, Cowbell |
| 3 | Toms (sky) | Floor tom, Low tom, Mid tom, High tom |
| 4 | Bass notes (violet) | Bass C, Bass E, Bass G, Bass C high |

On a keyboard the pads follow the same layout: **1 2 3 4**, **Q W E R**, **A S D F** and **Z X C V**. You can also use the arrow keys to move between pads and **Enter** or **Space** to play one. Keys only work after you have clicked or tapped inside the game, so they never take over the rest of the page.

The pad you played last is the one the sixteen step buttons belong to. Tap a step to put that sound in the loop; a filled circle means on and a small hollow square means off. The steps form four rows, and each row is one beat. Press **Play** (or the **P** key) to hear the loop, and a bright frame follows the beat. A small dot on a pad tells you it already has steps.

- **Tempo** runs from 60 to 180 beats per minute.
- **Swing** from 0 to 50 percent holds back every second step, which turns a straight beat into a bouncy one. About 33 percent gives the classic shuffle.
- **Beats to start from** loads one of seven rhythms: rock, dance, funk, slow groove, shuffle, tom fill and bass line.
- **Clear beat** empties the loop. **Start over** goes back to the rock beat and forgets which pads you have tried.
- **Copy result** copies a link to your beat, so you can send it to someone.

If you play all 16 pads, the counter under the grid lights up.

## How it works

Nothing is recorded or downloaded. Each sound is a small recipe of numbers, and the page turns the recipe into audio when a pad is hit:

- The **kick** is a sine wave whose pitch falls from 150 Hz to 45 Hz in about a tenth of a second.
- The **snare** is a short triangle tone plus noise passed through a band filter.
- The **hats** are noise with the low sounds filtered out; the open hat just lasts longer.
- The **clap** is three quick bursts of filtered noise, 14 milliseconds apart.
- The **bass pads** are triangle waves on C2, E2, G2 and C3, using the equal-temperament formula with A4 at 440 Hz.

The noise comes from a seeded random number generator, so a snare sounds the same every time. Every recipe is checked by a test: all numbers are finite, every frequency is between 20 Hz and 20 kHz, and no sound lasts longer than one second.

### Keeping the beat steady

A web page's timers are not exact; they can be late by tens of milliseconds when the page is busy. So the sequencer does not play a sound when its timer fires. Instead a timer wakes every 25 milliseconds, looks 100 milliseconds ahead on the audio clock, and gives each step that starts inside that window an exact start time. The sound itself is then placed on the audio clock, which runs on its own thread and does not wobble.

The step arithmetic is a pure function. One step is a sixteenth note, so it lasts 15 divided by the tempo in seconds: exactly 0.125 s at 120 BPM and 0.25 s at 60 BPM. Swing delays every second step by a percentage of that length, at most half a step, so steps never swap order. The tests simulate the 25 ms timer for several seconds at many tempos and swings, and check each step against a closed-form formula. If the page is frozen for more than a quarter of a second, the scheduler restarts from the present rather than firing a burst of old steps. A tempo change takes effect from the very next step.

### Safe volume and tidy audio

- The master volume node never goes above 0.15, whatever the slider says, and a compressor sits in front of it.
- At most 12 voices play at once. A new one beyond that cuts the oldest voice that has already started, and never one that is still waiting for its turn.
- Every sound node is disconnected when it finishes, so a long session does not pile up objects.
- The audio engine is created only when you press the Sound button, is paused when the tab is hidden, and is closed when you leave the page.

### The share code

Your beat is saved only in the page address. It has the tempo, the swing and a 64-digit code: four hex digits for each pad, one bit per step. A code that is not exactly 64 lower-case hex digits is ignored and the rock beat loads instead. The tests round-trip thousands of random patterns through this code.

## Limits

- The sounds are synthesised, so they are playful rather than realistic.
- The loop is always 16 steps long, with four steps to a beat. There is no recording of live playing into the loop.
- Pad sounds are fixed; only the beat, tempo, swing and volume change.
- Sound needs a browser with the Web Audio API. Without it the pads and loop still work as a silent light show.
- Some phones keep sound muted while the ringer switch is off.

Nothing is uploaded, there is no account, and nothing is kept on your device. Everything runs locally in your browser.
