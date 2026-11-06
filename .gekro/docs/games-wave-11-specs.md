# Games Wave 11 specs (2026-11-05)

Rohit: "Think of another 50 games and start developing on it, license-free. I want this to be a fun site and drive more traffic." Read [games-build-guide.md](games-build-guide.md) first (conventions, colour block, kid rules, test rules, guide page format) and the rules in [games-licensing-wave-10.md](games-licensing-wave-10.md). This file lists the 50 new games, each with rules, engine, look and licence rules. Every game is original code, art and synthesised sound; the rules come from traditional or public-domain games or are our own design. Slug, title and category (`fun`) are fixed here.

## Rules that apply to ALL 50 (in addition to the build guide)

1. Audience line in every guide: `personalUse` starts exactly `Anyone is welcome to play and learn with this, with no ads.` then one honest sentence about what is interesting in the engine. NEVER mention the owner's family, kids, children, life or home (hard rule, decision-log 2026-11-05). Generic words like "children can play this" are allowed in how-to text only when needed; prefer "all ages".
2. Never write any company, brand, publisher, TV show or other game name anywhere (copy, comments, aria, JSON). Describe the rules. Titles below are final.
3. Gambling is out: no money, no betting, no chips, no casino framing, no "jackpot". Dice and card games use points only.
4. No violence imagery against people or animals. Fantasy "raiders", "rocks", "swarm" are fine as abstract shapes.
5. Keep each game's first paint a ready board; sound off by default with a visible toggle; reduced-motion path; 320 px and 1280 px layouts.
6. Computer opponents obey the time budget rule (design cap 1 s, count-based limits, seed stays deterministic).
7. Word lists: hand-written common words only, kid-safe by construction, any display of a word the player did not type must come from the curated list.
8. Colour: the OKLCH token block from the build guide, per-game ink variable for light theme.

## Board and strategy (8)

| Slug | Title | Rules and engine | Look | Kids/level |
|---|---|---|---|---|
| `backgammon` | Backgammon | Standard 24-point rules, two dice, doubles play four, bar, bearing off, must use both dice if possible. NO doubling cube, no stakes. Computer: 2-ply expectimax with a hand-tuned evaluation (pip count, blots, blocks, home board), count-based node limit. Undo of the human's last turn. Test against an independent legal-move enumerator and a brute-force perft on small positions. | Wood-free: sky and amber triangles on a deep panel, round checkers in two clearly different shapes (circle with ring vs solid) so colour is not the only cue. | Medium to Hard |
| `star-halma` | Star Halma | Star-shaped board, 2 or 3 sides (10 pieces each on 2 players, plus 3-player), step or chain of jumps, reach the opposite corner. Computer: greedy plus 2-ply with distance heuristic. Public-domain 1883 game; never call it by the trade names. | Hex-lattice of dots, pieces in rose/sky/green with distinct marker shapes. | Easy to Hard |
| `hnefatafl` | Hnefatafl | 9x9 (Brandubh-style 7x7 as the small size). King and defenders vs attackers, custodial capture, king captured by 4 sides (2 next to the throne), king escapes to a corner, rook-like moves, throne and corners restricted. Computer both sides, alpha-beta with node cap. | Abstract: attackers as rose triangles, defenders as sky circles, king as an amber star. No runes, no Norse symbols, no weapons. | Hard |
| `konane` | Konane | Traditional Hawaiian jump-capture on a 6x6 or 8x8 board of alternating stones: start by removing two adjacent stones, then each move jumps one or more in a straight line over an opponent stone into an empty cell; player who cannot move loses. Computer: alpha-beta, mobility heuristic. | Round stones green-free: amber vs violet with ring/solid marks. | Medium |
| `bagh-chal` | Bagh Chal | Traditional Nepali game, 5x5 points with diagonals: 4 tigers vs 20 goats, goats placed first then moved, tigers capture by jumping, tigers win with 5 goats captured, goats win by trapping all tigers. Draw by repetition limit. Computer plays either side, alpha-beta. Abstract art: tigers = amber triangles with stripes drawn as lines, goats = sky circles. | Medium |
| `royal-game-of-ur` | Royal Game of Ur | Reconstructed ancient rules (Finkel): 7 pieces each, 4 binary dice (tetrahedral, count marked tips 0 to 4 with probabilities 1/16,4/16,6/16,4/16,1/16), 3x8 board with rosettes (extra turn, safe square), capture by landing, central rosette safe. Computer: expectimax 2-ply. Carefully original board art (no museum photo layout copying; use abstract shapes). | Easy to Medium (kids can learn) |
| `amazons` | Amazons | 10x10 (and 6x6 small) board, 4 queens each, move like a chess queen then shoot an arrow to any square along a queen line; arrow squares are permanently blocked; player who cannot move loses. Computer: mobility-based evaluation, iterative deepening within node budget. Called "Amazons" in the page title only, no figures. | Medium to Hard |
| `nested-tic-tac-toe` | Nested Tic Tac Toe | 3x3 grid of 3x3 boards; the cell you play sends the opponent to the matching small board; win small boards, three small wins in a row wins the game; if sent to a full/decided board, play anywhere. Computer: alpha-beta with node cap. Rules of thumb: tests verify "sent to" logic against an independent implementation. | Easy to Hard |

## Cards (7)

Standard 52-card pack drawn in CSS/SVG with own pip layouts (no known deck back; use geometric patterned backs). Suit glyphs as text (with `U+FE0E` text presentation). Cards must be distinguishable without colour (suit shapes). Shuffle with a seeded Fisher-Yates from the rng argument; daily deal option where it makes sense.

| Slug | Title | Rules and engine | Notes |
|---|---|---|---|
| `hearts` | Hearts | 4 players (you + 3 AI): pass 3 cards (left, right, across, none), 2 of clubs leads, avoid hearts and the queen of spades (13 points), hearts broken rule, shoot the moon, play to 100 (or 50 short game). AI: card-counting heuristics, void tracking, moon detection. Test: trick legality vs an independent checker; scores always total 26 per hand; thousands of random hands never break an invariant. | Hard to write correctly; take care. Call it "Hearts" only. |
| `gin-rummy` | Gin Rummy | 2 players: 10 cards, draw/discard, melds (sets and runs, ace low), knock at 10 or fewer deadwood, gin bonus, undercut, lay off, play to 100. Deadwood minimiser found by exhaustive meld search (test vs brute force). AI: draws if it improves deadwood, knocks when safe. Points only. | Medium |
| `spider-solitaire` | Spider Solitaire | 104 cards, 10 tableau columns, 1, 2 or 4 suits, build down regardless of suit, move same-suit runs, deal a row from the stock when no column is empty, complete K-to-A run removes. Undo (unlimited), hint, winnable-deal option via seeds known solvable by solver in tests (at least for 1 suit). Own card art, no cascading win animation. | Easy to Hard |
| `pyramid-solitaire` | Pyramid Solitaire | 28-card pyramid, remove pairs summing to 13 (K alone), draw from stock, waste, 3 recycles. Seeded deals; solver (DFS with limit) checks that "easy" mode deals are solvable. | Easy |
| `golf-solitaire` | Golf Solitaire | 7 columns of 5, stock, remove an exposed card one rank above or below the foundation top (no wrap, or wrap option), score by cards left. | Easy |
| `old-maid` | Old Maid | Kid game: remove pairs, draw a card from the next player, lose with the odd queen (use a plain "odd card" with a drawn star motif to avoid the cartoon). 2 to 4 players vs AI, no scold copy, "Try again!" | Little ones |
| `beggar-my-neighbour` | Beggar My Neighbour | Traditional luck war: face cards demand penalty cards (J 1, Q 2, K 3, A 4); detect infinite loops (state repeat) and call a draw after a safe cap. Play-by-step with Auto speed control. Kid friendly. | Little ones |

## Dice (3)

Dice drawn as CSS pips (not emoji). Use the rng argument; deterministic seeds for tests. Points only.

| Slug | Title | Rules | Notes |
|---|---|---|---|
| `shut-the-box` | Shut the Box | Traditional: tiles 1 to 9, roll two dice (one die when 7 8 9 shut), shut tiles summing to the roll, score = sum of open tiles when stuck; exact solver gives the "best possible" hint. | Easy |
| `yacht-dice` | Yacht Dice | Traditional five-dice game: up to 3 rolls with holds, 12 category scorecard (ones to sixes, choice, four of a kind, full house, small/large straight, yacht), upper bonus 35 at 63. Rows labelled in plain words. 1 to 3 AI opponents using expected-value choice per hold set (enumerate 32 hold sets exactly). Test the scorer against a brute-force table. | Medium |
| `ten-thousand` | Ten Thousand | Push-your-luck dice (six dice): score ones, fives and triples/runs per the rules shown in the page, bank or roll again, bust loses the turn, hot dice rule, first to 10,000 (or 5,000 short). The page shows a scoring table. AI with expected-value bank threshold. Name: never the commercial name of the genre. | Easy |

## Logic puzzles (8)

Each has seeded generators with a unique-solution guarantee proved by a solver, hint that explains the deduction, daily puzzle (local date seed), 3 sizes, notes/pencil marks where useful, error check.

| Slug | Title | Rules |
|---|---|---|
| `skyscrapers` | Skyscrapers | Latin square N=4,5,6; edge clues = how many towers visible from that side; towers drawn as blocks. Unique-solution generator. |
| `calcudoku` | Calcudoku | Latin square N=4 to 6 with outlined cages and a target + operation (+ - x /); unique-solution generator via backtracking solver. |
| `tents-and-trees` | Tents and Trees | Place a tent orthogonally adjacent to each tree, no two tents touch (including diagonally), row/column counts given. Unique-solution generator. |
| `lamp-grid` | Lamp Grid | Place lamps in white cells so every white cell is lit (lamps shine in straight lines until a black cell), no lamp lights another, numbered black cells show exactly how many adjacent lamps. Unique generator. Never the publisher's name. |
| `pair-paths` | Pair Paths | Connect each pair of same-symbol dots with a path through grid cells; paths cannot cross; every cell filled (mode toggle for non-fill). Generator builds a random full path cover then keeps unique ones (solver). Symbols plus colours. |
| `sea-and-islands` | Sea and Islands | Numbered cells are islands of that size; every other cell is sea; sea is one connected region; no 2x2 sea block; islands do not touch. Unique generator. |
| `logic-grid` | Logic Grid | Kid-friendly deduction: 3 or 4 categories x 3 to 5 items (pets, snacks, hobbies...), generated clue sets (clue types: equals, not, next to, before) that solve to exactly one answer, proven by a solver. Cross grid UI with marks. Generic objects only. |
| `eight-queens` | Eight Queens | Place N queens (4 to 12) so none attack; show conflicts live, count of all solutions per N (tests pin 2, 10, 4, 40, 92, 352 for N=4..8 etc.), "Show a solution". |

## Brainteasers (4)

| Slug | Title | Rules |
|---|---|---|
| `river-crossing` | River Crossing | Classic puzzles with a boat: fox/hen/grain, four travellers with a torch (bridge and torch with times), jealous-couples-free variant (use farmer with items only). 6 levels; BFS gives the minimum moves and the check; undo; no peril imagery. |
| `water-jugs` | Water Jugs | Two or three jugs with sizes and a target amount; fill, empty, pour; BFS minimal move count shown after solving; levels generated by solvable (a,b,target). |
| `tangram` | Tangram | The seven traditional tans; fit them into a silhouette. Levels: silhouettes produced by assembling the 7 pieces in known valid arrangements (hand-authored coordinates in the engine, tests prove the pieces tile the silhouette exactly, area check). Drag/rotate/flip with snap and keyboard rotate; 12 to 20 silhouettes (abstract: arrow, house, boat, cat-ish shapes drawn generically; no characters). |
| `knights-tour` | Knight's Tour | Visit every square once with a knight on 5x5 to 8x8; show legal moves, Warnsdorff hint, undo, complete if all visited; test the hint always finishes on 8x8 from corners. Use a plain horse-head glyph drawn in SVG or just an "N" marker; piece art original. |

## Word (3)

| Slug | Title | Rules |
|---|---|---|
| `word-ladder` | Word Ladder | Change one letter at a time to turn a start word into an end word, each step a real word (hand-curated 3 and 4 letter common word sets, kid-safe). Generator picks pairs with BFS shortest path 3 to 7 steps and shows the minimum. |
| `cryptogram` | Cryptogram | Decode a substitution cipher on a short proverb or public-domain saying (hand-picked, 60+ lines, source-free sayings only; no copyrighted quotes); hint reveals a letter, check, frequency table. |
| `word-chain` | Word Chain | Take turns with the computer saying a word that starts with the last letter of the previous one, no repeats, within a curated list (800+ common words); you lose only by running out of ideas, computer never uses an obscure word. Timer optional and gentle. |

## Arcade (8)

Canvas or DOM, own art, fixed-timestep with dt clamp, pause on hidden, keyboard + touch controls (on-screen buttons >= 56 px on phones), reduced-motion halves the effects, 3 lives or endless with a clear score, best score in `gk:game:<slug>`. Sound off by default.

| Slug | Title | Mechanic and look |
|---|---|---|
| `space-rocks` | Space Rocks | Drifting ship rotates and thrusts, shoots rocks that split in two sizes, wrap-around screen, lives, waves. Look: soft filled shapes with glow on a starless dark panel, NOT vector line art; ship is a rounded triangle, rocks are blobby polygons. |
| `paddle-rally` | Paddle Rally | One paddle each, ball speeds up on hits, first to 7. 1 player vs AI (three levels, AI has reaction error), or 2 players on one keyboard. Rounded, coloured, no centre dotted line. |
| `cloud-climb` | Cloud Climb | Endless vertical hopper: auto-bounce on clouds, steer left/right (tilt not required), moving and fading clouds, springs, score is height. A cloud-hopping blob character drawn as abstract shape. |
| `cave-flyer` | Cave Flyer | Hold to rise, release to fall through a winding cave; generated tunnel with seed, gaps never impossible (test). A small paper-plane shape. |
| `highway-dodge` | Highway Dodge | Top-down 3 to 5 lane road, swipe or arrow to change lane, dodge cars and collect fuel drops to keep going; speed ramps gently. Cars are generic rounded rectangles in different colours with different markings. |
| `tower-stack` | Tower Stack | A sliding block you tap to drop onto the stack; overhang is cut off; perfect drops grow the block back; height is score; colours cycle through the token palette with a gradient. |
| `gem-swap` | Gem Swap | 8x8 match-3 with swap, cascades, special pieces on 4/5 matches, 60 s or moves modes, no solution = reshuffle. Own pieces: distinct SHAPES (circle, square, triangle, diamond, hexagon, star) with colours, not candy or gem photos. Cascade chime tones are small. Test: board never starts with matches, always has a move, cascade scoring pinned. |
| `garden-defence` | Garden Defence | Short tower defence: place 4 kinds of plant towers (single shot, splash, slow, bomb) on a grid path; waves of abstract "bugs" (round blobs) walk a path; 10 waves. Strict: no famous zombie/plant art, no sun-resource economy copy (use a simple coin-less "seeds" counter that regrows). |

## Toys and sandboxes (9)

| Slug | Title | What it does |
|---|---|---|
| `kaleidoscope` | Kaleidoscope | Draw on a canvas that mirrors your strokes 6, 8 or 12 times with rotation; colour from palette tokens; undo, clear, save as PNG via `canvas.toBlob` + a download link is NOT allowed (no downloads): offer Copy instead "no export". Smooth strokes, touch friendly, auto-demo on first load that stops on first input. |
| `bubble-wrap` | Bubble Wrap | A sheet of bubbles to pop with tap or drag; each pop makes a soft synthesised pop (sound toggle), squish animation, a counter, sheet refreshes; zen mode, no scoring pressure. Safe flashing. |
| `zen-garden` | Zen Garden | A sand canvas you rake in lines with different rake widths; place stones and moss; calm; undo; draws patterns with ripples around stones (simple distance field). No sounds by default. |
| `fireworks` | Fireworks | Tap/drag to launch shells that burst into patterns (peony, willow, ring, heart, star) with particles and fade; a show mode that auto-sequences; limit flashes to 3 per second; reduced-motion shows static bursts. |
| `idle-orchard` | Idle Orchard | Incremental game: tap to pick, buy trees, helpers and upgrades that grow production, offline-time catch-up on load (capped), saves in localStorage (a small number object under `gk:game:idle-orchard`), prestige-lite "new season" reset for a multiplier. Big-number formatting. NOT a bakery or cookie theme. |
| `rock-paper-scissors` | Rock Paper Scissors | Best-of 3/5/7 vs the computer or two players; computer has a Random mode and a "pattern watcher" mode that really reads your last moves (explained); stats of your own moves; hand symbols drawn in SVG as abstract shapes (stone, page, scissors), emoji not needed. |
| `sorting-race` | Sorting Race | Visual race of sorting algorithms (bubble, insertion, selection, merge, quick, heap) on the same random array with comparison and swap counters; speed slider; "your turn" mode where you sort a small array by swapping. Engineering-lab flavoured. |
| `swarm-garden` | Swarm Garden | Boids flocking simulation (separation, alignment, cohesion) with sliders, predators optional, tap to attract; hundreds of tiny shapes; performance cap; draws with canvas. |
| `fractal-zoom` | Fractal Zoom | Interactive fractal explorer (Mandelbrot and Julia sets, with several palettes from the tokens): drag to pan, wheel/pinch to zoom, double precision limit warning, progressive render in tiles on a Worker-free time-sliced loop; presets of interesting places; no downloads. |

## Slug list (copy/paste)

backgammon, star-halma, hnefatafl, konane, bagh-chal, royal-game-of-ur, amazons, nested-tic-tac-toe, hearts, gin-rummy, spider-solitaire, pyramid-solitaire, golf-solitaire, old-maid, beggar-my-neighbour, shut-the-box, yacht-dice, ten-thousand, skyscrapers, calcudoku, tents-and-trees, lamp-grid, pair-paths, sea-and-islands, logic-grid, eight-queens, river-crossing, water-jugs, tangram, knights-tour, word-ladder, cryptogram, word-chain, space-rocks, paddle-rally, cloud-climb, cave-flyer, highway-dodge, tower-stack, gem-swap, garden-defence, kaleidoscope, bubble-wrap, zen-garden, fireworks, idle-orchard, rock-paper-scissors, sorting-race, swarm-garden, fractal-zoom
