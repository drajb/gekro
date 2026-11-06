---
title: "Falling Sand"
category: "fun"
job: "Play with a sandbox of falling sand, water, oil, fire, steam and plants, draw with your finger or the keyboard, and find six small discoveries."
description: "Free falling sand sandbox with sand, water, oil, stone, wood, fire, steam and plants. Draw, pour and watch simple rules at work. No signup."
aiSummary: "A free browser particle sandbox on a grid of 160 x 120 cells (120 x 90 on narrow screens). Eight materials can be painted: sand, water, stone, wood, fire, steam, plant and oil, plus an eraser. Each tick walks the grid from the bottom row up and moves each particle by a few rules, with a per-tick stamp so no particle moves twice. Sand sinks through water and oil, water sinks under oil, fire lights wood, plants and oil and turns to steam beside water, steam rises and condenses back to water, and plants drink touching water and grow. The simulation runs at 30 steps a second (15 for reduced motion), rewrites only the cells that changed, and pauses when the tab is hidden. Tests check every rule pair, that sand, water, oil and stone are never created or lost in a closed box over 3000 ticks, and that nothing leaves the grid. Six discoveries are saved as one small number in local storage."
personalUse: "Anyone is welcome to play and learn with this, with no ads. It is a good example of how a handful of plain local rules, each particle only looking at the squares next to it, add up to behaviour that looks like physics."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "⏳"
---

## How to play

Pick a material, then draw on the sandbox with a mouse, a finger or a pen. Hold still to keep pouring while the sandbox is playing. Nothing moves until you draw or press **Play**, so the starting scene (a stone bowl of water with plants, a pile of sand, a wooden tower and some oil on a shelf) waits for you.

| Material | What it does |
|---|---|
| Sand | Falls, slides down slopes, and sinks through water and oil. |
| Water | Falls, slides and spreads sideways. It sinks under oil. |
| Oil | Moves like water, so it floats on top of water. Fire lights it quickly. |
| Stone | Never moves. Good for walls, bowls and shelves. |
| Wood | Never moves, but fire can burn it. |
| Fire | Burns for a short while and may flicker upward. It lights wood, plants and oil beside it. Next to water it turns into steam. |
| Steam | Rises and drifts, then after a few seconds cools and falls as water again. |
| Plant | Stays put. Now and then it drinks one touching drop of water and grows into that spot. |
| Eraser | Clears whatever you draw over. |

Sand, water, oil and steam come out in a sprinkle, about six squares in ten, so pouring looks like pouring. Stone, wood and plants fill every empty square under the brush. Fire fills empty squares and sets light to wood, plants or oil under the brush. Nothing you draw replaces a particle that is already there, except the eraser, and fire lighting what can burn.

**Buttons.** Play and Pause start and stop the sandbox. Clear empties it. Restart brings back the starting scene. Small, Medium and Large brush set the size of the circle you draw with.

**Six things to discover.** A list beside the sandbox ticks off what you have found: sand sinks in water and oil, oil floats on water, plants drink water and grow, fire burns wood, plants and oil, fire boils water into steam, and steam turns back into water. Each one is announced when it first happens, and the page remembers which you have found.

**Keyboard.** Press Tab until the sandbox is selected. A round cursor appears, sized like your brush. Arrow keys move it (Shift moves five squares at a time) and Space or Enter pours, and holding the key keeps pouring. Keys 1 to 8 pick sand, water, stone, wood, fire, steam, plant and oil. 9 or X is the eraser, [ and ] change the brush size and P plays or pauses. A status line says what each action did.

## How it works

The sandbox is two lists of numbers, one entry per square: which material it holds, and a life counter for fire and steam. A tick walks the squares from the bottom row up, alternating left-to-right and right-to-left each tick so nothing drifts to one side. Each square gets a stamp with the tick number whenever it changes, and a square stamped this tick is skipped, so a grain of sand falls exactly one square per tick and never twice. The tests drop a grain down a tall empty column and check it moves one square at a time.

The rules, with the chances the tests use:

- **Fire** lights a touching wood square 8 times in 100 each tick, a plant 20 in 100, oil 35 in 100. A fire lit from wood lasts 40 to 89 ticks, from a plant 8 to 19, from oil 6 to 15, and fire you paint lasts 10 to 33. Beside water, fire becomes steam at once. It rises into an empty square above about 3 ticks in 10.
- **Steam** rises 85 times in 100 when the square above is empty, drifts when it cannot, and lasts 90 to 159 ticks before it becomes water again.
- **A plant** checks for touching water on 5 ticks in 100, and when it finds some it turns that water square into plant.

Every rule pair is checked in a table of tiny boards, each with a fixed random source so the outcome is exact: sand over water swaps, water over oil swaps, oil over water stays, sand in a one-wide well stays, water in a one-wide well stays, fire beside water makes steam, fire lights wood on a low roll and leaves it on a high roll, a plant drinks on a low roll and not on a high one, and stone and wood never move.

Sand, water, oil and stone are never created or lost by moving. The tests fill a 24 x 24 box at random and run 3,000 ticks, then check that each of those counts is exactly what it was. In a second run with fire, steam, plants and wood all in play, they compare the running count of every material with a fresh recount every 20 ticks for 800 ticks. The same seed always gives the same sand.

**Speed.** The sandbox runs 30 steps a second, or 15 if you have asked your device for reduced motion. When the sandbox is narrower than 520 pixels, as on a phone, the grid is 120 x 90 instead of 160 x 120, so there are fewer squares to work through. Only squares that changed are rewritten before each frame is drawn, the canvas is sized to its box times the device pixel ratio (never more than 2), and the loop stops when the tab is hidden.

**Colours.** Each material has eight shades, picked by square position so a pile looks grainy. They are mixed from the site's four accent colours. Fire is picked by how much life it has left, so a flame deepens from amber through orange to rose as it dies, instead of blinking.

## Privacy and limits

Nothing is uploaded. The only thing stored is which discoveries you have made, as one whole number from 0 to 63 in local storage. The picture itself is not saved.

- The sandbox is a simplified model. Water does not push, pressure does not exist, and fire never uses up oxygen.
- Steam that reaches the top stays there until it cools.
- Plants can only grow by drinking, so they do not spread across dry ground.
- A long-running sandbox may reach a still state. Press Restart for the starting scene or Clear for an empty box.
