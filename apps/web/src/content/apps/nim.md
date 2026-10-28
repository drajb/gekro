---
title: "Nim"
category: "fun"
job: "Play Nim against the computer or a friend in Normal play or Misere, at three levels, with a winning-move hint and a nim-sum table that shows why the move works."
description: "Free Nim game: take stones from one heap, last stone wins or loses. Play the computer or a friend, with a winning-move hint and nim-sum explainer. No signup."
aiSummary: "A free browser Nim. Heaps of stones, players alternate, and each turn removes any number of stones from exactly one heap. In Normal play the player who takes the last stone wins; in Misere that player loses. The computer uses Bouton's theorem: in Normal play it leaves a nim-sum (the XOR of the heap sizes) of zero, and in Misere it plays the same way until only heaps of one or zero stones would remain, then leaves an odd number of single stones. Easy plays a random legal move, Medium plays the winning move about 70 percent of the time, and Perfect always plays it when one exists. The test suite checks the strategy against an independent brute-force search of all 2,401 positions with up to four heaps of up to six stones. A hint button shows the winning move, and an explainer shows the binary nim-sum table. Wins are saved in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. Nim is fully solved, so the computer's play can be checked by hand. This version shows the one-line formula behind it, and a table so you can check it yourself."
status: "active"
publishedAt: "2026-10-23"
lastVerified: "2026-10-23"
license: "MIT"
icon: "🪨"
---

## How to play

There are several heaps of stones, drawn as rows. Players take turns. On your turn you remove at least one stone, and as many as you like, but all from **one heap**.

- **Normal play:** the player who takes the last stone wins.
- **Misere:** the player who takes the last stone loses.

Tap a stone to pick it. You pick that stone and every stone to its right in the same heap, which is exactly what you would take; the page highlights them and says, for example, "Take 3 from heap 2". Press **Take** to commit. Tapping the same stone a second time also takes. **Escape** clears your pick.

On a keyboard, the arrow keys move between stones, Home and End jump to the ends of a heap, and Enter or Space picks and then takes. Every stone is a labelled button, such as "Heap 2, stone 3 of 4".

The setups are Classic 3, 4, 5, Four heaps 1, 3, 5, 7, Five heaps 1 to 5, and a random setup with three heaps of 1 to 7 stones, new every game. You can play the computer, going first or second, or hand the screen back and forth with a friend.

**Show the winning move** tells you the best move for the current position, or says plainly that there is none. **Undo** takes back your move and the computer's reply. Both are fine for learning, but a game where you used either against the computer is not counted in your results.

## How it works

Nim is solved, and the solution is short. Write each heap size in binary and add the columns without carrying, which is the XOR of the sizes. The result is the **nim-sum**.

- In Normal play, a position with nim-sum 0 is lost for the player to move against perfect play. Any position with a non-zero nim-sum is won, because some heap can always be reduced to make the nim-sum 0, and from a nim-sum of 0 every move gives it back to non-zero. This is Bouton's theorem.
- In Misere the same rule works until a move would leave only heaps of 0 or 1 stones. From there, the winner leaves an odd number of single-stone heaps, so the opponent is the one forced to take the last stone.

Some positions you can check by hand with the Explain table on the page:

- Classic 3, 4, 5 is 011, 100 and 101 in binary, so the nim-sum is 010, which is 2. It is not zero, so the player who goes first wins by taking 2 from heap 1: that leaves 1, 4, 5, whose nim-sum is 0. It is the only winning first move in Normal play, and the same move wins in Misere.
- Four heaps 1, 3, 5, 7 has nim-sum 0, so the player who goes first is lost against perfect play in both rule sets. Against the Perfect computer, play second there.
- Five heaps 1 to 5 has nim-sum 1, so the first player wins.

**The levels.** Easy plays a random legal move. Medium plays the winning move about 70% of the time and a random legal move the rest of the time, which makes it beatable but not silly. Perfect always plays the winning move when one exists. When the position is already lost for it, Perfect takes one or two stones from a random heap to keep the game going in case you slip.

**How it is tested.** The strategy is checked against a separate brute-force search that knows nothing about nim-sums: it tries every move from every position and records who wins. That search covers all 2,401 positions with up to four heaps of up to six stones, for both Normal play and Misere. In every one, the formula and the search agree, and the move the engine picks is legal and leaves the opponent in a lost position. The tests also play well over a thousand seeded games: the Perfect computer never loses from a winning position, whatever level it faces and from either seat, and a player who moves at random lost to it in all of 200 seeded games from a winning start, in each rule set.

## Privacy and storage

Nothing is uploaded and there is no account. Your saved wins, counted separately for each rule set and level, are stored in your browser's local storage as plain numbers under one key. The current setup (rules, heaps, opponent, level and which seat you play) is kept in the page address so you can link to it. Clearing site data removes the saved wins.

Only games against the computer add to the saved wins, and only when you used neither the winning-move hint nor Undo. The session line above the board counts the same games.

## Limits

- Heaps hold at most 7 stones and there are at most 5 heaps. There are no other variants, such as limits on how many stones you may take.
- The random setup can be a lost position for whoever moves first, because it is not adjusted for fairness. The hint says so when that happens.
- Against the computer, the Perfect level cannot be beaten from a position where it is winning. If the setup is lost for the computer, you can win only by playing the exact moves.
- The computer replies in one step after a short pause, and with no pause if your system asks for reduced motion.
- Two-player mode shares one screen. There is no online play.

Everything runs locally in your browser.
