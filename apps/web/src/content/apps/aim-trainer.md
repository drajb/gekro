---
title: "Aim Trainer"
category: "fun"
job: "Practise your aim: hit round targets for 30 or 60 seconds, one or three at a time, and see your hits, misses, accuracy and time per hit."
description: "Free aim trainer. Hit round targets for 30 or 60 seconds, one or three at a time. Tracks hits, misses, accuracy and time per hit. Nothing is uploaded."
aiSummary: "A free browser aim trainer. Round targets appear at random spots in a play area; click or tap each one before time runs out (30 or 60 seconds, targets one or three at a time, three sizes). It counts hits, misses (presses on the play area that miss every target), accuracy (hits divided by hits plus misses) and the time from each target appearing to being hit, measured with performance.now(). Targets are always fully inside the area and, when there is room, at least two radii from the other targets and from where the last one was. The run starts only when you press the Start target or button, and only a run that lasts its full duration can set a personal best (most hits, kept per setup in local storage). Fully keyboard operable. Nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. A small piece of geometry and a stopwatch: where may the next target go, and how long did you take to hit the last one."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "🎯"
---

## How to play

Pick a **Duration** (30 or 60 seconds), a **Target size** (Large, Medium or Small) and a **Mode**. In *One at a time* a single target shows and a new one appears the moment you hit it. In *Three at a time* three targets show, and each hit replaces just that target.

Press the big **Start** target in the middle of the play area, or the Start button. The clock begins at that moment, so you never lose time to a slow first click. Then click or tap targets as fast as you can.

While you play you see:

- **Hits** and **Misses**. A miss is a press on the play area that lands on no target.
- **Accuracy**, which is hits divided by hits plus misses. Before you press anything it reads 100%.
- **Time left**, and the **average time per hit** in milliseconds so far.

When time is up a result card shows hits, misses, accuracy, hits per second, the average and the median time per hit, and your personal best for that exact setup. **Try again** takes you back to the Start target; **Copy result** puts a line of text on your clipboard. **Escape** cancels a run.

### Keyboard

Every target is a real button. Press Tab to reach it and Enter or Space to hit it, and after each hit focus moves to the new target. In One at a time mode you can also focus the play area itself and press Space to hit the current target, so you never have to find the target first.

## How it works

The interesting part is deciding where the next target goes. The engine keeps a few rules, and the test suite checks each one with thousands of seeded draws:

1. **Always fully inside.** The target plus a 6 px margin must fit inside the play area. If the area is too small to hold the target at all, the target shrinks to fit rather than spilling out.
2. **Never on top of another.** A new target's centre must be at least two radii from every target on screen and from where the one you just hit was, so consecutive targets are never at the same spot. The Start target is avoided too, using its own larger radius.
3. **Uniform otherwise.** Inside those limits every spot is equally likely. The draw comes from the browser's secure random number generator (if a browser has none, a small generator seeded from the clock is used instead); in the tests a seeded generator makes every sequence repeatable.

If random tries all fail in a crowded area, a coarse scan picks the roomiest spot instead of looping. It is still inside the area.

**Target size** scales with the width of the play area, with a floor so it stays tappable on a phone. Large is 13% of the width, Medium 9% and Small 6%, but never below 44 px, 32 px or 22 px, and never above 88 px, 64 px or 44 px. The tests check the floors across every phone width from 200 to 420 px.

**Timing.** Each target is timestamped with `performance.now()` when it appears and again when you hit it. Presses register on pointer down, which is earlier than a click. The first target of a run counts from the moment it appeared. In Three at a time mode each target has its own clock, so a target that sat waiting while you hit another one carries that waiting time. That is the honest definition of "time from appearing to hit", and it means the averages in the two modes are not directly comparable.

**Statistics.** Accuracy is 100% with no presses, hits per second is 0 rather than infinity when no time has passed, and the median of an even number of hits is the mean of the two middle values. None of these can produce NaN.

## Privacy and storage

Nothing is uploaded and there is no account. Your personal best for each setup is saved in your browser's local storage as a small whole number inside a small JSON object: the most hits in one finished run, for each of the 12 combinations of duration, size and mode. Whatever is read back is checked first: only those 12 known keys are accepted, and only whole numbers from 1 to 1000. **Clear saved bests** removes it all.

A run that you cancel, that you restart by changing a setting, or that is interrupted by switching to another tab is thrown away and never saved. Only a run that lasts its full duration can set a personal best.

## Limits

- It measures you on this device. Your screen, mouse or touchscreen and the browser add small delays of their own, so compare yourself with yourself on one setup, not across devices.
- It is practice for pointing, not a test of skill or reaction speed, and it makes no claim about how you compare with other people.
- The keyboard route is for access, not for training aim.
- Personal bests stay in one browser. A different browser, a private window or cleared site data starts from nothing.
- If the tab is hidden during a run, the run is cancelled.

Everything runs locally in your browser.
