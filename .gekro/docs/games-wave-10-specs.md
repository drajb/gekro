# Wave 10 game specs

One section per game. Read [games-build-guide.md](games-build-guide.md) (conventions, colour, children's rules, tests, page format) and [games-licensing-wave-10.md](games-licensing-wave-10.md) (names and what not to copy) first. "Oracle" is an independent check the engine tests must use. "Colour" is the game's personality using the `--g-*` palette. Every game: Copy result button where there is a result, New game and Restart, keyboard play, aria-live status line, best score under `gk:game:<slug>` where a score makes sense, `?seed=` style URL sharing where puzzles are generated.

## Logic and puzzle

### colour-flood "Colour Flood"
Grid 8x8, 12x12 or 16x16 of 6 colours (sky, green, amber, rose, violet, orange, each with its own shape mark). Pick a colour to flood the corner region; reach one colour within a move limit. Levels: Easy (generous limit), Medium, Hard (limit = a greedy-solver result). Engine: flood fill, move limit from a solver, solvable by construction. Oracle: brute force on 4x4 boards for the true minimum; flood result equals naive BFS fill. Colour: bright tiles with soft gloss, a pulse that rolls outward on each flood (off under reduced motion).

### binary-puzzle "Binary Puzzle"
Fill a grid with two symbols (use a circle and a square, tinted sky and amber): no three in a row, equal counts per row and column, no two identical rows or columns. Sizes 6, 8, 10. Generator yields a unique solution. Hint, check, show mistakes. Oracle: independent solver counts solutions (must be 1), constraint checker validated against brute force on 4x4 and 6x6. Colour: two-tone tiles.

### sum-grid "Sum Grid"
Clue-sum crossword of digits 1 to 9: each run of white cells has a clue total, digits in a run are distinct. Sizes 5x5, 7x7, 9x9. Unique-solution generator. Oracle: independent backtracking solver counts solutions; all clue sums verified. Pencil-mark notes. Colour: clue cells with diagonal split in two tints, digits crisp.

### inequality-grid "Inequality Grid"
N x N Latin square (N 4 to 7) with greater-than signs between some neighbouring cells and some given digits. Unique solution. Oracle: independent solver counts solutions, Latin property verified. Hint and notes. Colour: arrows in amber, givens in sky, solved rows glow green.

### colour-tubes "Colour Tubes"
Tubes holding stacked colour layers; pour the top run of one colour onto another tube if the colour matches or it is empty and there is room. Levels from 5 to 12 tubes. Each colour has a distinct pattern (stripe, dot, check, wave) as well as a hue. Generator guarantees solvability (build by reverse pours). Undo, extra empty tube once per level. Oracle: BFS solver proves solvable, solved state detection, pour legality against a naive model. Colour: glossy glass tubes.

### pipe-connect "Pipe Connect"
Grid of pipe tiles (straight, elbow, tee, cross, end caps); rotate tiles so every cap is joined to the source in one connected network with no open ends. Sizes 4 to 8. Rotate-only (no queue of pieces, no flow timer). Generator builds a random spanning tree then scrambles rotations. Oracle: connectivity via BFS, uniqueness not required, solvable by construction; rotation count solver. Colour: connected pieces glow sky to teal along the network, disconnected stay muted.

### traffic-jam "Traffic Jam"
Sliding vehicle grid, size 5 to 7. Own generator makes levels with a known minimum number of moves via BFS from a random solved layout. Hero vehicle is sky-blue and exits through the TOP or BOTTOM edge (not the right edge). Vehicles move along their axis only. Levels: Easy to Hard by minimum moves. Undo, hint (next move of the shortest solution). Oracle: BFS shortest solution equals stated par; every move legal. Colour: each vehicle a different palette colour with a roof mark so colour is not the only cue.

### crate-pusher "Crate Pusher"
Push crates onto target squares; the player cannot pull. Level generator builds solvable levels by pulling crates backwards from solved states; sizes 5 to 8, 1 to 5 crates. Undo, restart, move counter, par from BFS for small levels. Oracle: BFS solver on small generated levels proves solvable and gives par; deadlock detection verified. Colour: crates amber with a plank pattern, targets green rings, player a sky round character with eyes.

### loop-puzzle "Loop Puzzle"
Draw a single closed loop along the edges of a grid; a number in a cell says how many of its four sides the loop uses. Sizes 5x5 to 10x10. Unique solution generator. Oracle: independent solver counts solutions; loop validity (single cycle, degree 2) checked by brute force on tiny grids. Tap edges to toggle, mark X. Colour: loop line in a gradient, satisfied clues turn green.

### island-bridges "Island Bridges"
Islands with a number; connect them by horizontal or vertical bridges (1 or 2 each) so every island has exactly its number and everything is connected, no crossings. Sizes 7x7 to 11x11. Unique-solution generator. Oracle: independent solver counts solutions, connectivity and crossing checks. Colour: islands green discs, bridges sky or amber lines, satisfied islands glow.

### maze-dash "Maze Dash"
Generated maze (recursive backtracker or Wilson's) 8x8 to 24x24; walk from start to flag with arrows, swipe or on-screen pad. Optional timer and move count, "breadcrumb trail" toggle, hint arrow. Perfect mazes (unique path). Oracle: BFS confirms exactly one path, all cells reachable, determinism by seed. Colour: gradient trail behind the player, walls in soft tinted rounded lines. Keep to a flat cartoon look with no characters from any franchise.

### word-search "Word Search"
Grid with hidden themed words (animals, colours, space, food, sports, nature; hand-written kid-safe lists, 8 to 12 words each, length 3 to 8). Sizes 8x8, 10x10, 12x12. Directions by level (right and down only for Easy). Select by drag or by tap start then tap end; keyboard select. Words list with found ticks. Oracle: placement never overlaps incorrectly, every listed word is findable, no accidental offensive strings in fill letters (check fill against the blocklist). Colour: each found word gets a different palette highlight.

### letter-grid "Letter Grid"
Letters in a 4x4 to 6x6 grid; find words by tracing adjacent letters (8 directions, no letter reused). 2 or 3 minutes countdown (plain timer, no sand-timer art, no shaker or dice-cube imagery). Valid words: a trimmed ENABLE subset minus a profanity/slur blocklist; display of missed words only from a curated common-word list. Scores by word length. Oracle: solver finds every valid word, tracing rules verified, grid generator guarantees a minimum number of words, blocklist never appears in found or missed lists. Colour: letter tiles in tinted gradients, current path in amber.

## Learning and kids puzzles

### times-tables "Times Tables"
Practice multiplication and division facts for chosen tables (2 to 12). Modes: Learn (show the table with a visual array), Practice (type or tap the answer, three choices for small children), Sprint (60 seconds, no penalty, just a score). Never ends in failure; shows facts to review. Oracle: generator covers every fact exactly, answers correct, distractors never equal the answer or each other. Colour: each table gets a palette colour, arrays of coloured dots.

### clock-reader "Clock Reader"
Analog clock face drawn in SVG built in code. Modes: Read the time (choose the digital time, to the hour, half hour, quarter, five minutes, minute), Set the time (drag or tap hands/steppers), Match (pairs). Cheerful, no timers. Oracle: hand angles for every minute and hour verified against formulas, distractor times unique, minute and hour hand logic including hour hand drift. Colour: coloured hour and minute hands, numbered ring segments.

### coin-counter "Coin Counter"
US coins drawn generically (value and name only, no eagle or portrait): penny, nickel, dime, quarter, and a plain "$1" rectangle. Modes: Count the coins (type or pick the total), Make the amount (drag or tap coins to a tray), Give change. Levels by amount size. No real coin graphics. Oracle: totals computed with integer cents, generator never makes floating-point sums, change algorithm verified for all amounts to $5. Colour: copper, silver and gold tints from token mixes (orange, sky-teal, amber).

### colour-clash "Colour Clash"
A colour word is shown in a different ink colour; choose the ink colour (not the word). Colour names written in plain words with a shape mark beside each button. Rounds of 10, 3 levels by number of colours (3, 4, 6). No fail state; shows accuracy and average speed. Do not call it by the researcher's name. Oracle: word and ink are always different, answer options include the ink colour exactly once, rng determinism. Colour: palette of 3 to 6.

### morse-tutor "Morse Tutor"
International Morse code: a chart, a Learn mode with sound and a blinking light, a Quiz (hear or see dots and dashes, choose the letter), and a Send mode (tap a key for dot and dash, auto-decode). Sound off by default, sound button visible. Oracle: table complete and unambiguous (prefix-free check not required, but decode of encode round-trips for A to Z, 0 to 9), timing units 1:3:1:3:7. Colour: dots and dashes in sky and amber.

## Board, dice and card

### mancala "Mancala"
Kalah rules, 6 pits per side, 4 seeds each (option: 3 or 5), capture and extra turn rules documented in the page. Play against the computer (Easy: random, Medium: depth 4 minimax, Hard: depth 8 with alpha-beta and a 1 s budget) or two players on one screen. Undo. Oracle: independent simple reference implementation of Kalah rules for move legality; seed conservation (total seeds constant); depth-limited minimax verified against full search on reduced boards (3 pits, 2 seeds). Colour: warm wooden-look gradient from amber and orange mixes, seeds as palette dots; avoid any stylised logo.

### hex "Hex"
11x11 board (option 7 or 9). Players connect their two opposite edges; no draws. Play against the computer: Easy random-with-adjacency, Medium Monte Carlo (about 500 playouts), Hard 2000 playouts within 1 s cap; pie rule option. Oracle: winner detection via union-find compared to flood-fill BFS on random boards; the "exactly one player wins when board is full" theorem verified on random fills; playout rng seeded. Colour: sky versus rose edges and stones, hex cells in soft gradients.

### nine-mens-morris "Nine Men's Morris"
Three phases (place, move, fly at three pieces), mills, remove a piece. Computer: Easy random, Medium depth 3, Hard depth 5 alpha-beta with 1 s cap. Oracle: reference legal-move generator written differently (adjacency table versus coordinate arithmetic) must agree on random positions; mill detection from all 16 lines; game always terminates by a no-progress rule you document. Colour: board lines in a warm tone, pieces amber and violet.

### fox-and-geese "Fox and Geese"
Fox versus 13 geese on the 33-hole cross board (or a 7x7 cross). Fox jumps to capture; geese move forward or sideways, cannot capture, must trap the fox. Play either side against the computer. Oracle: independent move generator, capture rules, game terminates; solver check that trapped detection matches brute force on small boards. Colour: fox orange disc with ear marks, geese sky discs.

### go-fish "Go Fish"
Standard 52-card deck vs 1 to 3 computer players, ask for ranks, books of four. Rules written plainly; plain card art drawn in CSS and Unicode suit glyphs (own card backs). Computer remembers asks (Easy forgets). No fishing imagery. Oracle: deck invariants (52 unique cards), books counted, no card duplicated or lost across hands through random play of thousands of games; turn flow terminates. Colour: red suits rose, black suits sky-ink with shape suit marks.

### crazy-eights "Crazy Eights"
Traditional rules only: match suit or rank, eights are wild and name a suit, draw until you can play (option: draw up to 3), first to empty hand wins; 1 to 3 computer opponents. NO skip/reverse/draw-two cards and no "last card" call. Own card art. Oracle: deck invariants, legality of every play, termination through random games with stock reshuffle, no card lost. Colour: table felt from green and teal mix is NOT allowed to imitate casino; use a soft violet and sky table.

### card-war "Card War"
Two players (you versus computer), flip, higher rank wins both, ties start a war of three face-down and one up. Options: auto-play, speed; guaranteed to end by a move cap (reshuffle won cards by a stated rule). Oracle: deck invariants, tie handling including running out of cards mid-war, termination of 10,000 simulated games, rank comparison table. Colour: simple card faces. Kind to young children: big flip button, slow mode.

### dominoes "Dominoes"
Double-six set, 2 players (you versus computer), draw game and block game, matches ends, scoring the plain way (count of remaining pips). Computer: Easy random, Medium greedy by pip, Hard simple lookahead. Oracle: set has exactly 28 unique tiles, legality of plays, no tile lost or duplicated across random games, termination (block detection). Colour: ivory tiles from a pale token mix, pips in palette colours per number so each count has a colour AND the pip count.

### snakes-and-ladders "Snakes and Ladders"
10x10 board, own snakes and ladders drawn in SVG built in code, 1 to 4 players (humans or computer), one die, exact finish option. Board layouts from a small set of own designs (not any known commercial layout). No playground theme. Oracle: every snake goes down and every ladder up, no snake/ladder chain cycles or start-end collisions, simulated games all terminate, average length consistent with a Markov-chain calculation (compute expected turns independently and compare to a Monte Carlo within tolerance). Colour: snakes in green-lime and orange, ladders amber, squares tinted by row.

### pig-dice "Pig Dice"
One die per roll, keep rolling to bank points, rolling a 1 loses the turn's points, first to 100 wins; play the computer (Easy fixed hold-at-15, Medium hold-at-20 or adapt, Hard optimal-strategy table computed by value iteration at build or at start). Oracle: value iteration optimum compared to a known property (optimal hold at 20-ish at the start; your table checked against an independent DP), probabilities sum to 1, simulated play matches expectations. Colour: big friendly die in amber, bank button in green, "oops" in rose. No pig-shaped dice.

### chess "Chess"
Full rules: castling, en passant, promotion (choose piece), check, checkmate, stalemate, threefold repetition, fifty-move, insufficient material. Play the computer: Easy (depth 1 plus random), Medium (depth 3), Hard (iterative deepening alpha-beta, quiescence, a 1.2 s cap, a simple opening book written by you). Own SVG pieces built in code (or Unicode glyphs with text presentation); flip board; move list in algebraic notation; undo; resign, draw offers. Oracle: PERFT counts for the standard start position (depth 1 to 4 = 20, 400, 8902, 197281) and the well-known kiwipete, position 3 and 4 and 5 test positions to the depths those tests can reach quickly; FEN round trips; checkmate and stalemate puzzles; promotion and en passant edge cases; AI worst case under the time cap on a busy position; Hard beats Easy over several seeded games. Write all of the engine yourself. Colour: board squares from soft sky and violet mixes, pieces sky and amber, last move and check highlights.

## Arcade

All arcade games: canvas or DOM with requestAnimationFrame, `dt` clamped, pause when tab hidden and on Escape or P, start on first input, big Restart, best score, reduced-motion shows a calmer version (slower, no screen shake), touch controls on-screen, no auto-fullscreen, never faster than 3 flashes a second.

### brick-smasher "Brick Smasher"
Paddle, ball, bricks. Round paddle, soft pastel bricks in gradient bands that are NOT the famous red/orange/green/yellow rows (use violet, sky, teal, lime, amber top to bottom in uneven patterns), no lettered capsules; power-ups are shaped icons with symbols (wide paddle, slow ball, extra ball). Levels from your own pattern generator (shapes: heart, wave, checker, stairs), 3 lives, ball angle by paddle hit position. Oracle: collision resolver (circle-rect) tested against brute force on random trajectories (ball never passes through a brick or the paddle at speed limits), level generator never produces unreachable or empty levels, scoring deterministic by seed.

### pattern-echo "Pattern Echo"
Repeat a growing sequence of lights and tones. 6 pads in a row or a ring (no four-quadrant red/green/blue/yellow layout), each with a colour, a shape and a tone from a pentatonic scale you choose (not the famous four tones). Sound off by default with a button, visual-only works fully. Speeds Easy/Medium/Hard; sequence length record. Never a harsh failure sound; "Try again from this length". Oracle: sequence generator, replay verification, no repeats beyond rules, timing of a sequence step scales with level, score counts.

### critter-pop "Critter Pop"
Critters (bunny, owl, hedgehog, fox drawn with CSS/SVG, plus a "bomb-free" design: avoid scary things) pop up from 3x3 holes; tap them. No hammer, no "mole". Rounds of 30 seconds, friendly difficulty (pop-up time shrinking gently). Little ones mode with slower critters and bigger holes. Oracle: spawn scheduler never overlaps beyond rules, deterministic by seed, score bookkeeping, hit testing tested on a grid. Colour: sunny meadow from lime, green and sky mixes.

### wing-hop "Wing Hop"
A dragonfly flies automatically; tap or press Space to flap upward, gravity pulls down; pass through gaps between reed stalks and rock arches (NOT pipes, NOT a yellow bird). Gentle gravity and wide gaps on Easy. Score per gap. Oracle: physics integrator deterministic with fixed step, gap generator always passable (gap height and spacing guarantee the player can reach it with the jump physics; prove with a simulated bot that plays perfectly for N gaps), collision tests.

### road-hopper "Road Hopper"
A hedgehog crosses lanes of traffic (cars and bikes as simple shapes), optionally a stream with stepping stones, to reach a burrow at the top; no frog, no home bays row, no log-and-turtle river. Grid-based movement per tap/arrow, lanes scroll at different speeds, endless levels increasing gently. Lives and a friendly "ouch" with no gore. Oracle: lane generator always leaves a path (proved with a BFS over time-expanded state), collision on grid cells, score deterministic by seed.

### soft-landing "Soft Landing"
A small craft descends over procedural terrain; thrusters up, left, right with limited fuel; land on a flat pad below a speed and angle limit. Own craft shape and flat-colour terrain (no wireframe). Levels vary gravity, pad width and wind. Easy has strong auto-stabilise. Oracle: physics integrator energy sanity, terrain generator always contains a flat pad of the stated width reachable with the fuel (a simulated autopilot lands each seeded level), landing criteria thresholds tested at boundaries.

### cannon-shot "Cannon Shot"
Set angle and power of a cannon to hit crates and balloons on stacked towers; a few shots per level; levels from a generator with physics-based stacks (simple rigid blocks that topple using a small 2D engine you write, or simple fall-when-unsupported rules, documented). No birds, slingshots, pigs, worms or tank art. Oracle: projectile range equals the closed-form ballistic formula without drag (tested), support and collapse rules tested, level generator always solvable by a brute-force angle-power search.

### bubble-pop "Bubble Pop"
Bubbles float up in a calm field; tap to pop them, with a goal (pop 10 purple ones; pop the one that is a different colour; pop bubbles with the number 5). Not shoot-and-match. Levels for little children with giant bubbles and slow speed, no timers. Oracle: spawn logic, hit testing, goal generator always achievable, deterministic by seed.

## Sandbox and creative

### falling-sand "Falling Sand"
Particle sandbox on a canvas grid (about 160x120): sand, water, stone, wood, fire, steam, plant, oil, with a brush size and an eraser. Cell rules documented. Clear and Pause buttons, a Draw-a-picture feel. Works at 30 fps on a phone (cap the grid; update only active cells). Oracle: conservation of sand and water particle counts in closed boxes, deterministic by seed, no particle leaves the grid, rule pairs behave as listed (a table-driven test). Colour: warm and cool material colours drawn from the palette mixes.

### cell-garden "Cell Garden"
The cellular automaton John Conway devised in 1970 (birth on 3 neighbours, survival on 2 or 3) as a garden: living cells as flowers; draw cells, play, pause, step, random, clear, speed, preset patterns (glider, blinker, a few oscillators and a spaceship) written by you. Wrap-around edges option. Oracle: known patterns (blinker period 2, glider returns shifted by (1,1) after 4 generations, block still), random boards stepped against an independent naive implementation, population counts, wrap behaviour. Never the board-game name. Colour: cells age from sky to teal to green to amber.

### pixel-art "Pixel Art"
Pixel editor 8x8, 16x16 or 32x32, 16-colour palette of the token mixes plus neutrals, tools: pencil, eraser, fill, line/rectangle optionally, undo/redo (50 steps), mirror mode, grid toggle, clear. Export as a PNG download via canvas `toBlob` from a user click (an object URL revoked right after). Save the current drawing in localStorage as a compact string under the game's key (size capped). Oracle: flood fill equals naive BFS, line algorithm (Bresenham) tested for symmetry and endpoints, undo/redo round trips, serialisation round trip, size caps. Note: PNG export triggers a download from a user click only.

### drum-pad "Drum Pad"
A 4x4 pad of drum and percussion sounds synthesised with oscillators and noise buffers (kick, snare, hat, clap, toms, shaker, cowbell-like tone, simple bass notes) with a 16-step looping sequencer, tempo 60 to 180, swing, clear, pattern presets written by you, mute, volume limited (peak 0.15). Sound is a user action: nothing plays until a click. Oracle: sequencer timing computed from a scheduler lookahead (test the step times for a tempo exactly), pattern serialisation round trip, voice parameter sanity (no NaN, bounded), polyphony cap. Colour: each pad a palette colour with a different shape label.

### piano "Piano"
Two octaves on screen, computer-keyboard mapping (documented), touch glissando, sustain toggle, a few instruments from oscillator recipes (soft, bell, organ, pluck), and a Play-along mode that highlights keys for traditional tunes in the public domain (Ode to Joy, Twinkle Twinkle, Mary Had a Little Lamb, Frere Jacques) with large note names. Volume limited (peak 0.15), sound only after a click. Oracle: note frequency table (equal temperament, A4 440) against the formula, key-to-note mapping unique, tune sequences contain the right notes (test note lists and lengths), envelope parameter bounds.

### colour-mixer "Colour Mixer"
Mix colours like paint: pick two or three of red-ish rose, yellow-ish amber, blue-ish sky (the token mixes) in adjustable amounts and watch the swatch; a challenge mode matches a target swatch. Show colour names for the results (orange, green, purple, brown). Use subtractive-feeling blends by mixing in OKLCH or a documented RYB-like model implemented by you (state which). Oracle: mixing function symmetry, endpoints, monotonic, the named results table, target generator reachable. Colour: this IS the colour game, with large swatches, but all hues derive from the four tokens and mixes.

## Early learning (all ages 3 and up friendly, no time pressure)

### counting-garden "Counting Garden"
Flowers, bees, butterflies, ladybirds appear in a garden scene drawn from emoji or shapes; count them and tap the number (1 to 10, then to 20). Levels: count 1 to 5, 1 to 10, 1 to 20, "more or fewer" comparison. Big number buttons. Oracle: counts always match what is drawn, distractor numbers valid, level progression rules, rng seeded.

### shape-sorter "Shape Sorter"
Sort shapes (circle, square, triangle, star, heart, hexagon) into matching holes by tap-then-tap or drag; also sort by colour or size. Levels add shapes. Oracle: matching logic for shape, colour, size, no impossible rounds, seed determinism. Shapes drawn with CSS/SVG; no toy-brand look.

### make-ten "Make Ten"
Number bonds: given a number, tap the partner that makes 10 (or 5, 20, 100 as level options) shown with objects and a ten-frame. Learn mode shows all bonds. Oracle: every bond exactly sums to the target, distractors never also sum to it, ten-frame drawing counts equal numbers.

### spelling-builder "Spelling Builder"
A picture (emoji) and its word is spelled by tapping letters from a bank of scrambled letters plus a few decoys; three levels by word length (3, 4, 5 letters). Own hand-written word list (about 120 common words with an emoji each, kid-safe). Oracle: every word in the list is built from the bank, decoys never complete a second valid word that the bank would accept in place (or accept any arrangement spelling an acceptable word), list has no profanity and no duplicates, emoji unique per word.

### pattern-maker "Pattern Maker"
Continue the pattern: a row of shapes or colours (AB, ABB, AAB, ABC, growing numbers) with a gap; choose the next item from options. Levels grow harder gently; also "make your own pattern". Oracle: every generated pattern has a single correct continuation under the rule used, distractors wrong, rule coverage, seeded.

### odd-one-out "Odd One Out"
Four or six items, one is different in colour, shape, size, category (animal vs vehicle with a hand-picked emoji set) or number of items. Levels. Oracle: exactly one odd item for the stated rule, category lists have no overlaps, seeded.

### sort-it "Sort It"
Drag or tap items into bins: fruit vs vegetables, animals by where they live, big vs small, things that float or sink, even vs odd numbers, light vs heavy. Own hand-written category lists with facts checked in the tests (a fixed reference table). Oracle: each item belongs to exactly one correct bin, lists have no ambiguity (no tomato debates: avoid disputed items), seeded rounds.

### dot-to-dot "Dot to Dot"
Connect numbered dots in order to reveal a drawing; 10 to 50 dots; pictures drawn from your own coordinate lists (a boat, a house, a star, a fish, a rocket, a tree, a cat face, a flower). Tap dots in order or drag. Colour the finished picture automatically with token mixes. Oracle: each picture's points are distinct, the path is a simple closed or open polyline as designed, no crossings when it must not cross (test segment intersections), numbering contiguous.

### colouring-book "Colouring Book"
Original line-art scenes drawn as SVG regions built in code (no downloaded art): a house, a fish, a flower, a robot, a rocket, a butterfly; tap a region to fill with the selected colour from a 12-colour palette (token mixes). Undo, clear, save to PNG via canvas export from a click. Oracle: regions partition the picture (every point belongs to a region; test with a point-in-polygon sampling grid), undo/redo round trips, palette colours unique.

### picture-puzzle "Picture Puzzle"
Jigsaw of own SVG scenes (a sunset, a garden, a rocket, an underwater scene) drawn in code, 2x2, 3x3, 4x4, 5x5 pieces (little children get 2x2 and 2x3), tap or drag to swap and place, edge-piece helper, preview toggle. Oracle: puzzle always solvable (permutation reachable by swaps), solved detection, piece cut positions tile the picture exactly, seeded shuffles never start solved.

### balloon-maths "Balloon Maths"
Balloons float up with numbers; pop the balloon with the right answer to a sum, difference, product, "bigger than", number-pattern or "what comes next" question. Level chooses the operation and range. No timer needed; balloons move slowly and gently (reduced motion: fixed grid). Oracle: exactly one balloon is correct, answers integer, ranges respected, subtraction never negative for little ones, seeded.

### letter-tracer "Letter Tracer"
Trace letters A to Z (upper and lower) and numbers 0 to 9 with a finger or mouse along a guide path drawn in simple upright print forms from your own stroke paths with a numbered start dot and arrow direction, top-to-bottom and left-to-right. Tolerance for little hands (generous), stars for each completed letter, no scolding. Oracle: each glyph's path is continuous per stroke, strokes numbered, tolerance function tested on exact, near and far samples, completion requires covering the path within the tolerance; path coordinates are all within the box. Note: use only your own stroke definitions; never name or copy a commercial handwriting program.
