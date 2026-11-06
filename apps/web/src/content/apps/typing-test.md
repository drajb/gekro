---
title: "Typing Speed Test"
category: "fun"
job: "Measure your typing speed in 30, 60 or 120 seconds with the standard words-per-minute formulas. Plain text, live accuracy, saved personal bests, nothing uploaded."
description: "Free typing speed test with 30, 60 and 120 second rounds. Shows net and gross WPM, accuracy and mistakes. Bests stay in your browser. No ads, no signup."
aiSummary: "A free browser typing speed test. It shows a passage built from a bank of plain-English sentences written for this page, starts the clock on the first keystroke and runs for 30, 60 or 120 seconds. It compares every typed character with the text and reports net WPM, gross WPM, accuracy, characters correct, errors left and mistakes made, using the standard definition of one word as five characters. Pasting and bulk input are ignored. The best net WPM and the number of tests per duration are kept in the browser's local storage as small numbers inside a small JSON object; what you type is never stored or sent."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. This test states its formulas on the page, shows corrected mistakes separately from errors left, and keeps your bests on your own device."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "⌨️"
---

## How to play

Pick a duration, click the box under the text and start typing. The clock starts on your first keystroke, not before, and the test ends when the time is up. Type exactly what you see, capitals, spaces and punctuation included.

While you type, each character in the passage changes. A correct character turns green. A wrong one is underlined with a wavy line, so you can tell it apart without relying on colour. The next character to type has a bar beside it. Backspace works, so you can fix a mistake or leave it and keep going.

Esc restarts with the same text. **New passage** and **Try again** give you different text. If you get within about 100 characters of the end of the passage, more sentences are added, so nobody runs out of text. Pasting is turned off, and the tab being hidden cancels a running test.

At the end you get a result card: net WPM, gross WPM, accuracy, characters correct, errors left and mistakes made, plus a note on your personal best for that duration.

## The numbers

These are the usual typing-test definitions, and they are also written on the page:

- **One word is 5 characters**, including spaces and punctuation. This is a convention, so a word like "a" is not one word and "internationalisation" is more than one.
- **Gross WPM** = (characters typed / 5) / minutes.
- **Net WPM** = (correct characters / 5) / minutes. So 300 correct characters in 60 seconds is 60 WPM.
- **Accuracy** = correct characters / characters typed, rounded down to one decimal so 100% means exactly 100%. With nothing typed it is shown as 100%, not as an error.
- **Mistakes made** counts a wrong character at the moment you type it, even if you fix it a second later. **Errors left** are the wrong characters still in the box when time runs out.

Net WPM counts only correct characters, so a wrong character that is still there costs you speed through the formula but is not subtracted a second time. A corrected mistake lowers your pace because you spent keystrokes on it, but it does not appear in accuracy. That is why mistakes made and errors left are shown separately.

## How it works

The engine is a small set of pure functions and one state machine, with the clock passed in rather than read, so a whole test can be replayed from a list of typed texts and timestamps.

- **Comparison.** The typed text and the passage are split into Unicode characters and compared by position. The page only restyles the characters that changed on each keystroke, which keeps it smooth on a phone at fast speeds.
- **Passage.** Sentences come from a bank of more than 60 plain-English sentences written for this page, shuffled with the browser's secure random generator. When more text is added, every sentence already in the passage is avoided, so a sentence is not repeated until the whole bank has been used; after that a fresh shuffled pass begins.
- **Zero-time safety.** For the first second the elapsed time is counted as one second, so the first keystrokes cannot divide by zero or show a silly speed.
- **Late keystrokes.** An input stamped after the time has run out is not counted.
- **Bulk input.** More than 30 new characters in a single input event, or more than 6000 characters in the box, is ignored as paste, autofill or a script rather than typing.

The test suite checks the formulas against known values, replays scripted tests with timestamps, throws hostile strings (emoji, combining marks, newlines, very long text) at the comparison, and checks the sentence bank is plain ASCII with sensible lengths and no duplicates.

## Privacy and storage

Nothing is uploaded and there is no account. What you type is compared in memory and is never stored. Your best net WPM and the number of finished tests for each duration are saved in your browser's local storage, as small numbers inside a small JSON object, under one key. Only tests that ran the full time, held at least one word and stayed at or under 500 gross WPM are counted. Clearing site data, or the **Clear saved results** button, removes them.

## Limits

- Words per minute depends on the text. Common short words are quicker to type than long or unusual ones, and this tool does not adjust for that.
- The passages are plain English with basic punctuation. They do not test symbols, code, other languages or other keyboard layouts.
- A finished test above 500 gross WPM is not saved, which keeps scripted input out of your bests. The result card says so instead of showing a best.
- Characters are compared one Unicode character at a time, so an accented letter built from a base letter and a separate mark counts as two characters.
- Phone keyboards that insert whole words from suggestions can look like bulk input if they add more than 30 characters at once. Turn off prediction for a fair result.
- A score on one keyboard or device is not directly comparable with a score on another, and this is not an official or certified measurement.

Everything runs locally in your browser.
