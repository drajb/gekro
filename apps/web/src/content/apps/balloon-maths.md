---
title: "Balloon Maths"
category: "fun"
job: "Play a calm number game: pop the balloon with the right answer to a sum, take away, times, biggest number or pattern question."
description: "Free maths game for young children: pop the balloon with the right answer. Add, take away, times, patterns. No ads. No signup."
aiSummary: "A free browser maths game for young children. A question is shown above three or four floating balloons, and the child pops the one with the right answer. Topics are add, take away, times, biggest or smallest number, number patterns, and a mix, at three sizes: Little (adding and taking away up to 10, times up to 4 times 5, number patterns up to 30), Middle (adding and taking away up to 20, the 2, 3, 4, 5 and 10 times tables, patterns up to 100) and Big (adding and taking away up to 100, tables to 12 times 12, biggest or smallest up to 999). Each round has ten questions generated from a seed, none repeating. Exactly one balloon is correct, and the others are whole numbers near the answer, all different and never below zero. A wrong balloon is set aside and the child tries another, and a star is won for each question found on the first try. There is no timer and no sound, balloons only pop when tapped, and with reduced motion the balloons stay still. Best star counts per topic and size are kept in local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The test suite rebuilds the right answer for every question from the numbers on screen and checks that exactly one balloon matches, across thousands of generated questions."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎈"
---

## How to play

Read the question at the top, then pop the balloon that has the right answer by tapping it. The balloons float up and down a little, but they only pop when you tap them: nothing ever pops by itself, and there is no timer. When you pop the right balloon, the question fills in its answer, the page says it in words ("Yes! 4 plus 3 is 7. You earned a star!"), and a **Next question** button appears.

If you tap a balloon that is not right, the page tells you what number that balloon was, sets it aside with a dashed outline, and you tap another one. You can always find the right one, because it never gets set aside. A star is won for each question you find on the first try. A round has ten questions, and at the end the page shows your stars. If you got 9 or 10, it offers bigger numbers, and only offers: nothing changes unless you press the button.

Choose what to practise:

- **Add**, **Take away** and **Times** ask a sum such as "4 + 3 = ?", "9 − 4 = ?" or "3 × 4 = ?".
- **Biggest** shows a few numbers and asks for the biggest, or the smallest.
- **Patterns** shows a row of numbers such as "2, 4, 6, 8, ?" or "10, ?, 20, 25, 30" and asks for the next number or the missing one.
- **Mixed** spreads the topics across the round.

Choose how big the numbers are:

| Size | Balloons | Add and take away | Times | Biggest | Patterns |
|---|---|---|---|---|---|
| Little | 3 | up to 10 | 2, 3 or 4 times 1 to 5 | 0 to 10 | count on by 1, 2, 3 or 5, up to 30 |
| Middle | 4 | up to 20 | the 2, 3, 4, 5 and 10 tables, up to 10 times | 0 to 50 | count up or down by 2 to 10, between 0 and 100 |
| Big | 4 | up to 100 | 2 to 12 times 2 to 12 | 0 to 999 | count up or down by 3 to 25, double each time, or add two numbers in turn |

Little leaves out times in a mixed round. In Little add and take away, a row of dots under the question shows the two numbers, and in take away the dots to be taken away are drawn as dashed circles.

**New game** makes ten new questions, and **Start again** replays the same ten from the beginning. The page address holds the topic, size and a round number, so a link gives someone the same ten questions.

### Keyboard and screen readers

Tab or the arrow keys move between balloons, Enter or Space pops the one you are on, and the number keys 1 to 4 pop the balloon in that place. Each balloon is labelled "Balloon with 7", and "already tried" once it has been set aside. One status line says what happened after each tap: the question when it appears, what the tried balloon was, and the full fact when you get it right. Balloons, buttons and choices are at least 56 pixels tall.

With reduced motion switched on, the balloons do not float and the popped balloon simply disappears. There are no timers anywhere on the page, and no sound.

## How it works

### Exactly one right balloon

Every question is built from numbers chosen for its size, and the right answer is worked out from them. The other balloons are whole numbers close to the answer: one or two off, three, five or ten off, and numbers such as the ones in the sum. They are all different, never below zero, and never above the largest number allowed for that kind of question and size. A **take away** question never gives a negative or zero answer.

The tests re-check this without trusting the stored answer. For every topic and size, they build 300 seeded rounds, which is 3000 questions for each combination, and for each balloon they ask an independent function whether that number is right: the sum is added again from the two operands, the product multiplied again, the biggest compared against all the balloons, and the pattern terms rebuilt by adding or doubling step by step. In every question exactly one balloon matches, and it is the one the page treats as correct.

### Patterns

A pattern is stored as a rule (start and step, doubling, or two alternating steps) plus the terms shown, with one term hidden: either the next one, or one missing from inside the row. The tests rebuild every row from the rule by repeated adding, and check that the numbers shown match, that every term is between 0 and the size's limit, and that the question mark appears once.

### Rounds

A round is ten questions made from a seed, with no question repeated inside a round, which the tests confirm for 300 seeds at each topic and size. The same seed always builds the same round. A mixed round deals the available topics evenly, so each topic appears at least once and at most three times in ten questions. The right balloon is in each position about equally often, which the tests check over 4000 questions.

### Following a round

The play state is small and pure. Popping a wrong balloon marks it as tried, popping the right one solves the question and wins a star only if nothing had been tried first, and popping a balloon that was already tried, or after the question is solved, does nothing. The tests play 400 random rounds, including junk balloon numbers, and check that every round finishes, that stars equal the questions found on the first try, and that no question ever has all its balloons set aside.

## Best results

After a round, the page keeps your most first-try stars for that topic and size, out of 10, and says so when you beat it. It is a record against yourself only.

## Privacy and storage

Nothing is uploaded and there is no account. The best star counts are saved in your browser's local storage as small whole numbers inside a small JSON object. The page checks them when it reads them back, so a damaged value is ignored. Clearing site data removes them.

## Limits

- The questions are all about whole numbers: there are no fractions, decimals or word problems.
- Times at Little and Middle use only the tables listed above.
- The patterns are the kinds listed above. The "next number" in a pattern is the one that follows the rule that built it, which is what the question means.
- There is no sound and no speech: the page does not read the question aloud.
