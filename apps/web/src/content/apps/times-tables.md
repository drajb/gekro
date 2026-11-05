---
title: "Times Tables"
category: "fun"
job: "Learn, practise and race through the 2 to 12 times tables with coloured dot arrays, three-choice questions and a 60 second sprint."
description: "Free times tables game for children. See each fact as rows of dots, practise with big answers, or try a 60 second sprint. No fail screen. No signup."
aiSummary: "A free browser game for learning the 2 to 12 times tables, with optional division facts. Learn mode shows any fact as an array of coloured dots (for example 3 groups of 4 make 12) with the skip count for the table. Practice asks ten different facts with three big answers to tap, or a box to type in, and asks a missed fact once more at the end of the round. Sprint counts right answers in 60 seconds and takes nothing away for a wrong one. Nothing ever ends in failure: every round finishes with praise for what went right and a short list of facts worth another look. The tables take turns in six colours, so neighbouring tables always differ. The two wrong choices are always whole numbers above zero that differ from the answer and from each other, which the tests check for every fact. The best sprint and the number of practice rounds finished are kept in local storage on the device. Nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The useful design choice was what to do with a wrong answer: show the right one, list the fact, ask it once more later, and never take anything away."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "✖️"
---

## How to play

There are three things to do: **Learn**, **Practice** and **Sprint**.

**Learn.** Pick a table from 2 to 12, then a fact such as "× 4". The page shows the fact in words and numbers ("3 × 4 = 12", "3 groups of 4 make 12") and as an array: 3 rows of 4 dots. The tables take turns in six colours (2 and 8 share one, 3 and 9 another, and so on), neighbouring tables always differ, and the rows alternate shades so each group is easy to see. Under the dots is the skip count for the whole table, for example "Counting in 3s: 3, 6, 9" and on up to 36.

**Practice.** Choose which tables to practise (tap to add or take away; at least one stays on), with a shortcut for 2, 5 and 10 and one for all of them. You can switch on division, so a fact comes up as 7 × 8 or as 56 ÷ 8. You can answer by picking one of three big buttons, or by typing the number. A round is ten different facts. After each answer the page tells you what it was: "Yes! 7 × 8 = 56." If you miss one it says "Not quite. 7 × 8 = 56. We will try it again soon." and the fact comes back once at the end of the round. **Show dots** draws the array for the question; if you use it, your answer is still accepted, but the fact is asked once more and listed to review, because you needed help. At the end you see how many you got right the first time and the facts worth another look, and **Show me in Learn** takes you straight to the first of them.

**Sprint.** Sixty seconds, as many right answers as you can. A wrong answer takes nothing away; the page shows the answer and moves on. A tap in the first 0.3 seconds of a new question is ignored, so a double tap cannot skip a question you have not seen. The best sprint is kept on your device.

### Keyboard

The controls are real buttons, a tick box, a menu and a number box, so they all work with Tab. While a question is open you can press **1**, **2** or **3** to pick an answer, or Tab to a button and press Enter or Space. With the typing option, type the number and press Enter. Only digits can be typed, up to three of them.

## How it works

Each table has 12 facts, from 1 times to 12 times. With all eleven tables and division on, there are 264 facts, and the tests check that the deck holds every one exactly once. A practice round is the first ten of a shuffled deck, so no fact comes twice in a round. Over thousands of rounds each fact turns up equally often.

Every answer is computed from two numbers, and the tests check them against a separate method: multiplication by repeated addition, and division by searching for the number that gives the product. A division fact always divides by the table number, so 56 ÷ 8 belongs to the 8 times table.

**The three choices.** The two wrong answers are whole numbers above zero, never the right answer and never the same as each other. Usually one is a neighbouring fact in the same table (6 × 8 for 7 × 8) and the other a near miss (55 or 57). The tests check this for every fact with many random seeds, even with a broken random generator. The right answer lands in the first, second and third button about equally often.

**A round never ends in failure.** A fact that is not right the first time goes on the review list and is asked once more after the first ten. Asked the second time, it is not asked again whatever the answer. So a round is at most twenty questions and always finishes, which the tests check with thousands of random players, including one who gets everything wrong.

**Learn arrays.** The array for "a groups of b" has a rows of b dots. The tests check that the number of dots is exactly a × b for every pair from 1 to 12, and that every skip count ends on the product.

## Privacy and storage

Nothing is uploaded and there is no account. Two small whole numbers are saved in your browser's local storage: your best sprint (1 to 999) and the number of practice rounds finished (1 to 9999). When they are read back, only those two names are accepted and only whole numbers in range.

## Limits

- It teaches the facts, not the idea behind them; the dot arrays are there to help with the idea.
- The sprint compares you with yourself on one device. Different tables make different sprints, so the best is kept for any choice of tables.
- Scores stay in one browser. A different browser, a private window or cleared site data starts from nothing.
- The page does not read questions aloud.

Everything runs locally in your browser.
