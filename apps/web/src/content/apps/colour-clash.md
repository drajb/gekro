---
title: "Colour Clash"
category: "fun"
job: "Play a quick colour game: a colour name is painted in a different colour, and you tap the colour of the letters."
description: "Free colour game for kids and adults. A colour word is painted in another colour; tap the paint, not the word. Three levels, shape clue, no ads. No signup."
aiSummary: "A free browser game about reading versus seeing. A colour word such as GREEN is shown in a different ink colour, for example blue, and the player taps the button for the ink. A round is ten words. Easy uses three colours, Medium four, Hard six. The word and the ink are never the same colour, the ink is always one of the answer buttons exactly once, and inks are dealt from a shuffled bag so each colour is used about equally and never twice in a row. A wrong tap never ends anything: the player tries another button. The result is how many words were right first time and the average time per word, measured from showing the word to the right answer. Every colour also has its own shape, which appears on its button and can be shown next to the word. Best rounds are kept in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. It is a tiny experiment you can feel: your eyes see the paint, but you read the word first, and the half-second pause that causes is the thing the average speed measures."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎨"
---

## How to play

Press **Start**. A colour name appears in big letters, but it is painted in a different colour. The word BLUE might be painted yellow. Tap the button for the **paint**, which here is yellow, not the word.

You get ten words in a round. There is nothing to fail. If you tap the wrong button, it gets a dashed border and a line through its name, a short message tells you to look at how the word is painted, and you try another button. The word stays until you find the right one. When the round is over you see how many words you got right first time, and your average speed per word.

**Levels.** Easy has three colours (blue, yellow, red), Medium adds green, and Hard has six with purple and orange. The buttons keep the same places for the whole round, so you can learn where each colour lives.

**Shapes.** Colour is never the only clue. Every colour has its own shape on its button: blue is a circle, yellow a triangle, red a square, green a diamond, purple a star and orange a hexagon. If some colours look alike to you, tick **Show a shape next to the word**. A plain shape then appears beside each word, telling you the shape of the paint. That makes the game much easier, so it is off to begin with.

**Keyboard.** While a round is running, press the number on a button (1 to 3, 1 to 4 or 1 to 6) to answer. Keys are only used during a round, so nothing on the page is held up the rest of the time. You can also Tab to the buttons and press Enter or Space. The level menu, Start, Restart, New round and Copy result buttons are at least 44 pixels tall, and the colour buttons are taller still. The Copy result line names the level and the number of colours once, for example "Colour Clash (Easy, 3 colours) #5".

**Speed and your best.** The time for a word runs from the moment it appears until you tap the right colour, so wrong taps cost you time. If the tab is hidden, the clock stops. A round counts as your best for the level if more words were right first time, or the same number in a lower average time. If you get 9 or 10, you are offered the next level, and it is only an offer.

The page tells a screen reader which word is on screen, but the paint is, by design, only visible. So this game is not playable by screen reader alone. The dark panel around the word stays dark in both light and dark page themes so that every colour shows clearly.

## How it works

Reading is automatic. Your brain turns the letters into a word before you have decided what to look at, so when the word says one colour and the paint is another, the two answers clash and you need a moment to hold the reading back. That moment is what the average speed picks up.

A round is built from a seed, and the same seed always gives the same round. The engine does this:

1. It takes the level's colours and shuffles them to decide the button order for the round.
2. It deals the paint colours from a shuffled bag of those colours. When the bag is empty it is refilled and reshuffled. This keeps the colours even: the counts for any two colours never differ by more than one, and a Hard round of ten words uses all six. If a new bag would start with the colour that just ended the old one, the first two are swapped, so the same paint never comes twice in a row.
3. For each paint colour, it picks the written word at random from the other colours of the level. The word is therefore never the same colour as its paint.

The tests check all of this on 500 seeds for each level, and check on 20,000 Hard words that each paint colour gets each of the other five words about a fifth of the time.

### Scoring

Accuracy is the number of words right first time, as a whole percent of ten. Average speed is the mean of the ten times in whole milliseconds, shown to a tenth of a second. A single time is capped at one minute, so one forgotten word cannot ruin an average. The tests cover rounding, caps and the empty case.

| Claim | How it is checked |
|---|---|
| Word and paint always differ | 500 rounds for each level, every word |
| The paint is on exactly one button | the same rounds |
| Paints are even and never repeat | the same rounds, counts compared |
| Words are spread evenly | 20,000 Hard words, shares between 17% and 23% |
| Same seed, same round | repeated generation |
| Every colour and shape has a style rule | the page source is read in the test |
| Saved bests | only complete pairs of whole numbers in range survive |

## Privacy and storage

Nothing is uploaded and there is no account. Your best round for each level, as two small whole numbers, is stored in your browser under one key. Clearing site data removes it. The page address holds the level, the round number and whether the shape clue is on.

## Limits

- It is a game, not a test. Speed depends on your device, your screen and whether you have just sat down.
- Colours are shown by your screen, so they can look different on different devices. Names and shapes are always the same.
- Only the paint changes. There is no mode where the word is hidden.
- Ten words is a short sample. Compare your averages over several rounds, not one.
