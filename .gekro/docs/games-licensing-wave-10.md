# Games licensing screen (2026-11-05)

Rohit asked: "make sure there's not going to be any licensing trouble with the game makers". Three independent research passes screened every existing and planned title, mechanic, asset and the children's-privacy angle. This is a risk screen, not legal advice. Most trademark data came from aggregators (Justia, Markinton) and law-firm or press pieces, not the USPTO's own database, and the USPTO status of a few marks was not verifiable. Anything marked "unverified" below should be looked up in USPTO TSDR before the games launch if it matters to Rohit.

## What actually causes trouble

Rules and mechanics are not protectable in the US (Tetris Holding v. Xio keeps rules free but protected the look and feel and found trade dress infringement). Takedown letters follow **names**, **look and feel** (palette, layout, mascots, power-up icons, sounds, share formats), and copied levels or content. Every game here is original code, art and sound, so the work is choosing names and looks that do not echo the famous version.

## Rules for every game (enforced where a test can)

1. Own code, own art, own synthesised sound, own word lists. No third-party assets, fonts, images, audio, URLs (`games-hygiene.test.ts` fails the build on all of these).
2. Never name another company, game or character anywhere: page copy, titles, descriptions, keywords, headings, alt text, JSON-LD, URLs, code comments in shipped files, `llms.txt`, RSS. Describe the mechanic instead of naming the famous game. The test's deny-list is in `games-hygiene.test.ts` (`MARKS`); add to it when a new risk appears.
3. Nothing depicts a recognisable character. No colour schemes, catchphrases or sounds that belong to a known game or toy. No real coin portraits or banknote graphics.
4. Colour from the four locked tokens only (see `games-build-guide.md`).
5. The games hub says the games are not affiliated with any other game or brand.
6. If a letter ever arrives: take the game down first, ask questions after.

## Names and look decisions for the NEW games

| Planned | Final slug / title | Verdict | What not to do (design rules) |
|---|---|---|---|
| Colour Flood | `colour-flood` "Colour Flood" | OK | Never write the older flood-fill app name. |
| Binary Puzzle | `binary-puzzle` "Binary Puzzle" | OK | Never write the two foreign names of this puzzle (listed in the test deny-list). |
| Water Sort | `colour-tubes` "Colour Tubes" | RENAMED | "Water Sort Puzzle" has pending US applications. Own tube shapes and palette. |
| Pipe Connect | `pipe-connect` "Pipe Connect" | OK WITH RULES | Rotate-only, no queue of upcoming pieces, no oozing flow timer, no famous names. |
| Maze Runner | `maze-dash` "Maze Dash" | RENAMED | The old name is a film and novel franchise. |
| Traffic Jam | `traffic-jam` "Traffic Jam" | OK WITH RULES | Own generated levels, never published challenge cards. Not a red 2x1 hero car on a 6x6 grid with the exit gap on the right edge: use a sky-blue hero, sizes 5 to 7, exit at the top or bottom edge. |
| Crate Pusher | `crate-pusher` "Crate Pusher" | OK WITH RULES | Generated levels only, no warehouse-keeper sprite, never the genre's trademarked name. |
| Loop Puzzle | `loop-puzzle` "Loop Puzzle" | OK WITH RULES | Own clue generator; never the publisher's puzzle name. |
| Bridge Builder | `island-bridges` "Island Bridges" | RENAMED | "Bridge Builder" is an existing game title; the Japanese name belongs to a puzzle publisher. |
| Cross Sums | `sum-grid` "Sum Grid" | RENAMED | Zero-doubt name for the clue-sum grid puzzle. |
| Inequality Grid | `inequality-grid` "Inequality Grid" | OK | |
| Word Search | `word-search` "Word Search" | OK | Hand-written kid-safe themed lists. |
| Letter Grid | `letter-grid` "Letter Grid" | OK WITH RULES | Not 4x4 with a shaker cube or sand timer: sizes 4 to 6, a plain countdown, no dice-cube imagery. Never display a word that is not on the curated list. |
| Block Stacker | HELD, do not build | DROP recommended | decision-log 2026-10-22 excluded it outright; research found the rights holder is among the most aggressive in games and won on look and feel. Needs Rohit's literal "Override". |
| Brick Smasher | `brick-smasher` | OK WITH RULES | No banded red/orange/green/yellow rows, no ship-shaped paddle, no lettered power-up capsules, no enemy sprites. Own layouts and theme (e.g. coloured candy-free tiles in a soft gradient, round paddle). |
| Pattern Echo | `pattern-echo` | OK WITH RULES | NOT four round pads in a red/green/blue/yellow quadrant layout and not the famous bugle tones. Use 5 or 6 pads in a row or ring, own palette, own pentatonic tones. |
| Mole Pop | `critter-pop` "Critter Pop" | RENAMED | The classic name is a live mark. Pop-up critters of several kinds, no mallet, tap to pop. |
| Wing Hop | `wing-hop` | OK WITH RULES | No green pipes, no yellow pixel bird. A dragonfly rising and sinking between reed and rock gaps. |
| Road Hopper | `road-hopper` | OK WITH RULES | No frog, no row of home bays at the top, no log-and-turtle river. A hedgehog crossing roads in a flat 2D style, optional gentle stream with stepping stones that is not logs and turtles. |
| Soft Landing | `soft-landing` | OK WITH RULES | No vector wireframe look, own craft and terrain, never the original name. |
| Cannon Shot | `cannon-shot` | OK WITH RULES | No birds, slingshots, pigs, worms or tank-with-turret art. A cannon firing at stacks of crates and balloons. |
| Falling Sand | `falling-sand` | OK | Never name the best-known open source sand toy. |
| Cell Garden | `cell-garden` | OK WITH RULES | Describe the rule as "the cellular automaton John Conway devised in 1970 (birth on 3, survival on 2 or 3)". Never the board-game name, no board-game art. |
| Pixel Art | `pixel-art` | OK | |
| Drum Pad / Piano | `drum-pad`, `piano` | OK | Synthesised tones. Melodies only if traditional and long out of copyright (Ode to Joy, Twinkle Twinkle, Mary Had a Little Lamb, Frere Jacques). No game themes, no modern songs. Skip Happy Birthday. |
| Chess | `chess` | OK WITH RULES | Own engine, never FIDE's name, logo or "approved". Own SVG pieces (do not use the Wikimedia sets or GPL engine code). |
| Dominoes | `dominoes` | OK | Plain double-six, no branded variants. |
| Nine Men's Morris | `nine-mens-morris` | OK | |
| Fox and Geese | `fox-and-geese` | OK | |
| Snakes and Ladders | `snakes-and-ladders` | OK WITH RULES | Draw own snakes and ladders. No playground theme (that is the rival toy brand's), no children on slides. |
| Go Fish | `go-fish` | OK WITH RULES | Standard 52-card pack, own card art (never a famous deck back). No fishing-pole imagery from toy brands. |
| Crazy Eights | `crazy-eights` | OK WITH RULES | Plain traditional rules: standard 52-card deck, eights are wild and name a suit. NO action-card wording or rules (no skip, reverse, draw two, wild draw four), no four-colour action cards, no "call it when you have one card" mechanic. |
| Card War | `card-war` | OK | |
| Mancala | `mancala` "Mancala" | OK WITH RULES | Plain text name only, never any stylised "M" logo. The page says it uses Kalah rules. |
| Hex | `hex` "Hex" | OK WITH RULES | Own board art, not a vintage box design. USPTO class 28 check optional. |
| Pig | `pig-dice` "Pig Dice" | OK WITH RULES | One standard die. No pig-shaped dice and never the names from the commercial pig-dice game. |
| Times Tables, Clock Reader | `times-tables`, `clock-reader` | OK | Own clock face, no watch-brand styling. |
| Coin Counter | `coin-counter` | OK WITH RULES | Generic drawn coins showing only the value and name (penny, nickel, dime, quarter). No eagle, no portrait, no banknotes (a plain rectangle labelled "$1" if a bill is needed). |
| Colour Clash | `colour-clash` | OK WITH RULES | Do not use the scientist's name as the title. |
| Morse Tutor | `morse-tutor` | OK | International Morse is a public standard; own table, do not copy the standards document's text. |
| Counting Garden, Shape Sorter, Colour Mixer, Spelling Builder, Make Ten, Pattern Maker, Odd One Out, Sort It, Balloon Maths, Picture Puzzle | same slugs | OK | Own art. Shapes avoid the look of well-known toy brands. Items are generic objects, never branded. |
| Dot to Dot, Colouring Book | `dot-to-dot`, `colouring-book` | OK WITH RULES | Original line art only. Nothing "inspired by" a character. |
| Bubble Pop | `bubble-pop` | OK WITH RULES | Tap-to-pop only, not shoot-and-match. Never use the genre's trademarked names. |
| Letter Tracer | `letter-tracer` | OK WITH RULES | Plain upright print letters from own stroke paths, top-to-bottom and left-to-right order. No slanted tailed forms, no program names, mascots or cue words from commercial handwriting programs. |

## Existing games that must change or be checked (look and feel)

The research flagged these specific risks in the games already built. They are fixed in the colour pass.

| Game | Risk | Action |
|---|---|---|
| Word Guess | Green/yellow/grey tiles, 5-letter grid with six rows and a flip animation echo the best-known word game, whose owner sends takedowns and opposes "-dle" names. | New feedback palette from the token mixes (not green/yellow/grey), each state also has a shape mark; replace the flip animation with a different reveal; share text without coloured-square emoji. Keep the name Word Guess. |
| Four in a Row | A blue frame with red and yellow discs is the toy's identity. | Keep the name (generic phrase, no live word mark found). Palette: not blue board with red/yellow discs; flat board, own discs. Optional rename to "Four in a Line" if Rohit wants zero doubt (needs a 301 and storage-key migration). |
| Code Breaker | Black/white peg feedback, 4 holes with 6 colours is the board game's look. | Symbols plus numeric exact/misplaced counts; no black/white pegs. Check current design. |
| Merge Tiles | The beige/orange palette of the best-known version; the number in the title is a mark. | New palette; the number only ever appears as a tile value, never in title, keywords or taglines. |
| Mines | Grey bevel, smiley face, seven-segment counters. | Check and remove any. |
| Solitaire | The cascading card win animation and the famous card art. | Check; own win effect and card art. |
| Reversi | A green board. | Not green. |
| Snake | The green LCD pixel look. | Not green LCD. |
| Match Pairs | The word "Memory". | Never in any language edition. |
| Sudoku | Japanese publisher holds the name in Japan. | Fine in English. If a Japanese edition is ever made, call it "Number Place". |
| Reaction Time, Snake | Animation with no reduced-motion path. | Add `prefers-reduced-motion` handling (caught by `games-hygiene.test.ts`). |

## Assets and compliance (all answered)

- Emoji as pictures: fine. The characters rely on the visitor's own font; nothing is shipped. They look different per platform, so never depend on one look.
- Unicode chess and card-suit glyphs: free. Test the pawn glyph (use text presentation `U+FE0E`).
- ENABLE word list: public domain (the README says so). It contains profanity and slurs. Use it only to validate guesses, keep a blocklist, never display a word the player did not type unless it is on a hand-curated common-word list.
- Fonts: the site loads Google Fonts; a 2022 Munich court case fined a site for sending visitor IPs to Google without consent. Low risk for a US operator; self-hosting the font on the games section would remove it. Not part of this change.
- Sound: oscillator-synthesised tones are fine. No famous jingles, no coin-ding sound effects styled after a known game.
- Code: write everything ourselves. Do not copy GPL or AGPL code (a chess engine is the usual trap) or CC-BY-SA artwork.
- Naming the rights holder descriptively ("like X"): avoid. Describe the rules instead.

## Flagged separately: children's privacy (not a game-maker licensing matter)

The new games say they are built for children. Under the FTC's COPPA Rule a page can count as directed to children from its content, visuals and stated audience, and a mixed-audience site is treated similarly. Persistent identifiers (cookies, IP addresses) count as personal information, and the site loads Google Tag Manager, a Google Analytics measurement ID and Cloudflare Web Analytics on every page. The researcher judged enforcement against a hobby site unlikely but the per-violation penalties high, and the fixes cheap:

1. Do not load GTM or GA on the games section (game pages and the Fun hub); keep them elsewhere.
2. Cloudflare Web Analytics only on those pages (it says it collects no personal data; one reviewer disputes parts of that).
3. Collect nothing in games (already true: scores stay on the device).
4. No comments, newsletter embed or contact form on game pages.
5. Optionally self-host the fonts there.
6. A short plain statement: no accounts, no ads, nothing collected from the games, scores stay on the device.

`BaseLayout.astro` hardcodes GTM and Cloudflare (decision-log 2026-03-30, "do not fix back without Override"). Making GTM skip game pages is a change to that decision area, so it is NOT done here: it is Rohit's call.

## Not verified

USPTO status of several marks (searched through aggregators); any Taito patent for shoot-and-match bubble games; the Rush Hour design patent number; the Munich Google Fonts follow-up cases; whether gekro.com counts as commercial for COPPA; current COPPA penalty amounts; the Crossy Road dispute history.
