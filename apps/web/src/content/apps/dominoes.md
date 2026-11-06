---
title: "Dominoes"
category: "fun"
job: "Play the plain double-six game of Dominoes against the computer: match the ends of the chain, draw or block, and score the pips left."
description: "Free double-six Dominoes against the computer. Draw game or block game, one round or a match, three levels, keyboard friendly, no ads. No signup."
aiSummary: "A free browser game of double-six dominoes for you against the computer. The set has 28 tiles and 168 pips; each player gets 7 and the other 14 form the boneyard. The player with the highest double opens, or the heaviest tile if there is no double, and the opening tile is played for them. Players then add a tile to either end of the chain, matching the number at that end. In the draw game a player who cannot play draws until a tile fits; in the block game they pass. A round ends when a player plays their last tile, scoring the pips left in the other hand, or when both players pass in a row, when the lower pip count scores the difference. A match is one round or play to 50 or 100 points. The computer plays at Easy (any legal tile), Medium (heaviest tile) or Hard (one move of lookahead plus what it saw you draw and pass on), and never sees your tiles. The shuffle is a seeded Fisher-Yates, so a match number reproduces the deals. The engine is pure TypeScript, tested against brute-force oracles and 3,000 random rounds that never lose or copy a tile. Matches played, matches won and your best round stay in the browser's local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. Every tile has pips in a colour for its number as well as the pip count, and the computer works only from what is on the table, so Hard learns from the numbers you draw on instead of peeking at your tiles."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎲"
---

## How to play

Get rid of all your tiles, or have fewer pips left than the computer when nobody can move.

1. **The opening.** Each player gets 7 tiles. The player with the highest double starts with it (double six if anyone has it). If neither player has a double, the tile with the most pips starts. The opening tile is placed for you, and then the other player moves.
2. **Matching.** Add a tile to either end of the chain, with the same number as the end. The two big numbers above the chain are the ends. Tiles you can play are raised and outlined in amber, and a label under each says which end it fits: left, right or either. If a tile fits both ends, and the ends are different, you choose one with two large buttons.
3. **Cannot play?** In the **draw game** you draw from the boneyard until you get a tile that fits, or you pass if the boneyard runs out. In the **block game** nobody draws, and you simply pass. Passing happens by itself and the status line says so.
4. **Ending a round.** When a player plays their last tile, that player wins the round and scores the pips left in the other player's hand. If both players pass in a row, the table is blocked: the player with fewer pips left wins the round and scores the difference. If the pip counts are equal, nobody scores.
5. **Matches.** Choose one round, or a match that goes to 50 or 100 points. After each round of a longer match you press Next round, and the next round is dealt and opened the same way.

Each number from 0 (blank) to 6 has its own pip colour, and the pips are always counted by shape too, so the colour is never the only clue.

**Levels.** Easy plays any tile that fits. Medium plays the heaviest tile that fits, so it gets rid of points early. Hard looks one move ahead: it likes to leave an end it saw you draw or pass on (you probably have none of that number), keeps tiles that fit the new ends, and avoids ends it cannot follow itself. You can change the level at any time. Changing the game type or the match length deals a new match.

**Keyboard and screen reader.** Press Tab to reach your tiles. The arrow keys, Home and End move along your hand, and Enter or Space plays the tile. If it fits both ends, press L or R, or Tab to a button and press Enter. Press D to draw. Escape puts the tile back. Every tile played and drawn is spoken through a polite status message, and the chain has a text description with all the tiles from left to right. A tile the computer draws is not named, because you would not see it at a real table.

The computer pauses for a short, fixed moment before each turn, and for less if your system asks for reduced motion.

The match has a number, and the page address carries it with the game type, match length and level, so copying the address or using **Copy result** gives someone else the same deals. **Restart this match** replays it from round 1.

## How it works

A tile is a number from 0 to 27 in a fixed list of every pair of numbers 0 to 6. The shuffle is a Fisher-Yates driven by a small seeded generator, so a match number always gives the same deals, and each round uses a seed worked out from the match number and the round number. The seed itself is drawn from the browser's secure random source, from 1 to 999,999, and an address can carry any whole number up to 4,294,967,295.

The rules live in a plain TypeScript module with no page code in it. Playing or drawing returns a new state and a list of events, or nothing when the action is illegal. The chain stores each placed tile with the number on its left half and its right half, so a tile is turned to match the end it touches, and a check confirms that neighbouring tiles always show the same number where they meet.

The tests check these claims:

- The set has exactly 28 distinct tiles, 168 pips, and each number appears on 8 half-tiles. The pip layouts for 0 to 6 have the right number of pips and are the same turned upside down.
- The shuffle is unbiased: chi-square tests over 6,000 shuffles of three items and 5,600 shuffles of the set.
- Each deal is 7 tiles each with 14 in the boneyard, and the opener and opening tile agree with a second, independently written opening rule on 3,000 deals.
- Which tiles fit which end is compared with a brute-force check at every step of 400 random rounds.
- A tile placed on the left or right is turned the right way up, a double shows the same number twice, and illegal plays are refused.
- Drawing is refused when you have a move, and in the block game, and when the boneyard is empty. Passing, going out, and blocked rounds each have worked examples with the points they score.
- The computer always plays a legal tile, Medium takes the heaviest tile, Hard prefers an end it saw you lack, and over 600 seeded rounds Hard wins more rounds and scores more points than Easy.
- 3,000 random rounds, half draw and half block, all end. After every action all 28 tiles exist exactly once, the chain touches with matching numbers, and the player to move can always play, draw or has been passed.

## Privacy and storage

Nothing is uploaded and there is no account. Matches played, matches won and the most points you have scored in one round are saved in your browser's local storage as small numbers inside a small JSON object, under one key. Stored values that are not whole numbers within a sensible range are ignored when read. Clearing site data removes them. The only other state is the page address.

## Limits

- Two players only, with plain double-six rules and no bonus points for the opening tile.
- Each round is opened by whoever holds the highest double or heaviest tile, not by the winner of the last round.
- A match in progress is not saved. Reloading with the same address starts the match again from round 1.

Everything runs locally in your browser.
