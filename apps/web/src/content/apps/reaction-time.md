---
title: "Reaction Time Test"
category: "fun"
job: "Test your reaction time in the browser: wait for the panel to change, press as fast as you can, and get the average, median, best and worst of five tries."
description: "Free reaction time test. Five tries, a random 1.5 to 5 second wait, and an honest note on what the number includes. No ads, no signup, runs in your browser."
aiSummary: "A free browser reaction time test. A panel waits a random 1.5 to 5 seconds (drawn from the browser's secure random generator), then changes to GO; you press as fast as you can. A run is five counted tries. Pressing early throws that try away and it is never counted. The result shows the average, median, best and worst, with a rough plain-words band on the average (under 200 ms Quick, 200 to 300 ms Typical range, over 300 ms Slow side). The time is measured from the screen frame after the panel changes to the browser's timestamp on your press, so it includes display and input delay and is not a laboratory measurement. Best times are kept in local storage as plain numbers; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A reaction test that says what the clock starts on, what it stops on and what it cannot account for, and throws away early presses instead of letting them score."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "⏱️"
---

## How to play

Press the big panel, or focus it and press **Space** or **Enter**. It turns to "Wait for it..." and, after a random pause of 1.5 to 5 seconds, changes to "GO! Press now". Press again as fast as you can. Your time in milliseconds appears on the panel, and you press once more to start the next try.

A run is **five counted tries**. At the end you get the average, median, best (lowest) and worst (highest) of the five.

- **Pressing too early** (while it says "Wait for it...") shows "Too soon". That try is thrown away and not counted, and the run carries on from that try, so a miss never lowers your average.
- A press so quick it lands within 50 ms of GO is treated the same way, because a genuine reaction that quick is not plausible; it is a guess that happened to land.
- A press more than 5 seconds after GO is not counted either.
- The four states differ by text, colour and the shape of the panel's outline (solid, dashed, thick and square, double), so colour is never the only signal. Nothing flashes or animates.
- **Start again** begins a fresh run. **Clear saved results** wipes your saved times.
- Holding a key down does not count as extra presses.

## What the band means

Under the results, the average gets a plain-words label: **Quick** under 200 ms, **Typical range** from 200 to 300 ms, **Slow side** over 300 ms. These are rough guides for fun, not a medical or scientific test, and the cut-offs are this tool's own choice rather than a published standard. Tiredness, the device you use, and how the screen and input are set up all move the number.

## How it works

The wait is drawn uniformly between 1.5 and 5 seconds from the browser's secure random number generator (`crypto.getRandomValues`), so the moment of GO cannot be guessed from earlier tries.

The state machine is a small pure function: ready, waiting, go, result, with "too soon" as a branch from waiting and "done" after the fifth counted time. Every action carries its own timestamp, so the engine never reads a clock and the tests can replay any run exactly.

The timing has two ends:

1. **Start:** when the wait ends, the page changes the panel inside an animation frame, then takes the start time from the next frame, so the clock starts after the change has been handed to the screen rather than when the code ran.
2. **Stop:** the time of your press is the timestamp the browser put on the input event when it arrived, not the moment the page got round to handling it. If that timestamp is missing or implausible, the page falls back to reading the clock.

Mouse and touch act on the press itself rather than waiting for the click, so they register sooner. Keyboard presses are handled on key down. Each press is only counted once.

If you switch to another tab while a try is waiting, the try is cancelled and the panel goes back to ready, because a hidden tab does not draw frames and the timing would be meaningless.

## Privacy and storage

Nothing is uploaded and there is no account. Three things are saved in your browser's local storage, as plain numbers under one key: your fastest single time, your lowest five-try average, and your last 20 counted times. Only counted times are saved; early presses and discarded tries are not. Whatever is read back from storage is checked first: anything that is not a number is dropped, values are clamped to 50 to 5000 ms, and the history is capped at 20. **Clear saved results** removes it, as does clearing site data.

## Limits

- The number includes your screen's refresh delay and your mouse, keyboard or touchscreen delay. It is not a laboratory measurement, and the same person can score differently on different devices.
- Browsers may round timestamps for privacy, which blurs very small differences.
- Five tries is a small sample. A fair comparison with yourself needs the same device and setup each time.
- Times under 50 ms or over 5000 ms are never counted.
- The bands are rough guides, not a medical or scientific test, and this tool quotes no population averages.

Everything runs locally in your browser.
