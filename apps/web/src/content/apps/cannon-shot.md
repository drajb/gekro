---
title: "Cannon Shot"
category: "fun"
job: "Aim a wheeled cannon by angle and power and pop every balloon with the shots you are given, in endless levels that are always possible."
description: "Free cannon aiming game. Set angle and power, pop the balloons, break crates and watch towers drop. Every level is solvable. No signup."
aiSummary: "A free browser aiming game. A cannon on the left fires a ball at an angle from 5 to 85 degrees and a power from 10 to 100 percent. The ball follows an exact drag-free arc, pops every balloon it touches and stops at the first crate, which breaks. Crates stand in columns: breaking one drops everything above it, and a falling crate pops balloons it passes or lands on. Levels come from a seed in three difficulties, with 3, 4 or 5 balloons and 8, 7 or 7 shots. Each balloon is placed only where a shot that never touches a crate reaches it, so a one-shot-per-balloon clear always exists, and tests confirm this by brute force over all 7371 angle and power pairs on sample levels. The flight is checked 240 times a second so the ball cannot slip through anything. A dotted guide, a hint and aiming by tapping the field are included. Progress is three small counts in local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. What I like is that the level generator proves every balloon can be reached before it places it, so a level is never impossible."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🎈"
---

## How to play

Pop every balloon before you run out of shots. Use the **Angle** and **Power** sliders, then press **Fire!**

- **Angle** goes from 5 to 85 degrees. Low angles shoot flat and fast; high angles lob the ball over things.
- **Power** goes from 10 to 100 percent. More power throws the ball farther.
- The **dotted guide** shows where the ball will go for the first moments of its flight. Turn it off with the Dotted guide button if you want a harder game. It starts on for Easy and Medium and off for Hard.
- You can also tap or drag anywhere on the field to aim. The angle points from the cannon to your finger, and power grows with the distance. Nothing fires until you press Fire!
- The ball **pops every balloon it touches** and keeps flying. It **stops at the first crate** it touches, and that crate breaks.
- Crates stand in columns. Break one low in a tower and **every crate above it drops** until it rests again. A crate that falls pops any balloon in its path or where it lands.
- After a miss, the status line tells you whether the ball fell short or went past, and suggests more or less power.
- **Show me a shot** picks an angle and power that pops a balloon. A level you used it on still finishes, but it does not count toward your cleared total and earns one star.
- **Try again** replays the same level. **New level** makes a fresh one. The level number is in the page address, so a link opens the same level.

You earn three stars for popping everything with one shot per balloon, two stars for up to two spare shots, and one star after that. There is no timer and no fail screen: if the shots run out, you simply try again.

| Difficulty | Towers | Tallest tower | Balloons | Shots |
|---|---|---|---|---|
| Easy | 2 | 3 crates | 3 | 8 |
| Medium | 3 | 5 crates | 4 | 7 |
| Hard | 4 | 7 crates | 5 | 7 |

Some towers are two crates wide. The page counts levels cleared for each difficulty, and replaying a level you already cleared in the same visit does not add to the count again.

**Keyboard and touch.** The sliders work with the arrow keys when selected, and the buttons beside them nudge by one degree or one percent. Press Space or Enter on Fire!. A status line announces each result. Buttons and sliders are at least 44 pixels high. When a level is won or lost, the aiming controls are switched off until you start a new level or try again, and focus moves to the button you are most likely to want.

If your device asks for reduced motion, a shot is worked out at once and shown as a dotted path, with no flight, no sparks and no confetti.

## How it works

**The arc.** The ball leaves the muzzle at up to 22 squares a second (the power setting is the percentage of that), with gravity 9.8, and no air drag. Its position is exactly x = x0 + v cos(a) t and y = y0 + v sin(a) t - g t squared over 2. On level ground that gives the familiar range v squared times sin(2a) over g, so 45 degrees goes farthest and complementary angles such as 30 and 60 land together. The tests check the range formula, the 45 degree maximum, the complementary pairs, and that the engine's landing point agrees with an independent step-by-step integrator to within 0.01 of a square. More power always lands farther.

**Not slipping through.** The engine looks at the ball 240 times a second. At full power it moves under a tenth of a square between looks, and the ball is 0.6 across, so it cannot pass through a crate or a balloon. The tests also compare the engine with a second collision check that looks 20 times as often, on 540 random shots across levels of every difficulty. Fewer than 1 in 100 differ. The engine also finds the exact moment of contact between two checks, so the crate touched first is the one that breaks and the ball stops on its surface.

**Crates.** A crate rests on the ground or on the crate directly below it. Touching a neighbour sideways holds nothing. After a crate breaks, the engine goes through the crates from the bottom up and lowers each until it rests, popping balloons in the squares it passes through. The tests cover breaking the bottom, the middle and the top of a column, big gaps, a crate beside a tower, balloons in and out of the path, and random piles, where no crate is lost, duplicated or moved sideways, and a settled pile settles to itself.

**Levels.** A level is built from a number. First the towers are placed in the columns to the right of the cannon. Then the engine fires about 1,900 test shots, every second angle and every second power, at the towers without any balloons. For each shot that never touches a crate, it records the squares near the arc where a balloon would be popped. Balloons are put only in squares that at least 5 (Easy), 3 (Medium) or 2 (Hard) of those shots pass through, and no two balloons are closer than two squares. So whatever the crates do, there is a shot for each balloon that does not touch a crate, and the shots-given count is more than enough to use them one at a time. The same difficulty and number always give the same level.

The tests check that claim by brute force. For sample levels at every difficulty they try all 7,371 angle and power pairs, and check that every balloon is popped by a shot that touches no crate, with several such shots each, and that at least one of them is confirmed by the independent fine-grained check. A search that fires its own shots one at a time on the real level also clears each sample level inside its shot budget. For 36 generated levels, the tests check that crates are supported and in bounds, balloons are not on crates, balloons are two squares apart, and heights and counts match the table.

**Hints.** Show me a shot searches all 7,371 pairs and takes the first one that pops a balloon without touching a crate, or the first one that pops a balloon at all if there is no such shot.

## Privacy and limits

Nothing is uploaded. The only stored values are three whole numbers from 0 to 9,999: levels cleared on Easy, Medium and Hard. Clearing site data resets them. The page works if storage is blocked.

- The model has no air drag, wind or spin, and the ball does not bounce.
- A ball goes through balloons but stops at crates, and stacks fall straight down only. There are no leaning towers or rolling crates.
- Aiming by tap uses one finger. Pinch and scroll gestures on the field are turned off so that aiming works, so scroll the page from the controls beside it.
- A new level takes a moment to build on a slow phone.
