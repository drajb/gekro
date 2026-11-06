/**
 * Games registry (added 2026-11-05).
 *
 * Browser games live under /games/<slug>/ and the tools stay under /apps/<slug>/.
 * Both are entries in the same `apps` content collection (guides are markdown in
 * content/apps/, implementations in the private gekro-apps repo), so this file is
 * the one place that says which slug is a game, which genre it belongs to and
 * what its URL is. Pure TypeScript: no astro:content import, so vitest and the
 * e2e list builders can read it directly.
 *
 * Adding a game: add its slug to GAME_GENRE below (the games hygiene test fails
 * if a game guide, a registry entry or a calculator import is missing).
 */

export type GenreId = 'board' | 'cards' | 'puzzle' | 'word' | 'arcade' | 'creative' | 'learning';

export interface GenreMeta {
  /** Short chip label. */
  label: string;
  /** H1 on the genre hub. */
  heading: string;
  /** Full <title>, at most 60 characters. */
  title: string;
  /** Meta description, at most 160 characters. */
  description: string;
  /** One paragraph of intro copy on the genre hub. */
  intro: string;
}

export const GENRE_ORDER: GenreId[] = ['board', 'cards', 'puzzle', 'word', 'arcade', 'creative', 'learning'];

export const GENRES: Record<GenreId, GenreMeta> = {
  board: {
    label: 'Board games',
    heading: 'Free online board games',
    title: 'Free Online Board Games vs Computer | gekro',
    description:
      'Play free board games in your browser against the computer or a friend: Chess, Checkers, Backgammon, Reversi, Mancala and more. No ads, no signup.',
    intro:
      'Classic and traditional board games with a computer opponent at several levels, or two players on one screen. Each game has undo, keyboard play and a written explanation of how its opponent thinks. Nothing is uploaded and nothing needs an account.',
  },
  cards: {
    label: 'Card and dice games',
    heading: 'Free online card and dice games',
    title: 'Free Online Card & Dice Games | gekro',
    description:
      'Play free card and dice games in your browser: Hearts, Gin Rummy, Spider Solitaire, Go Fish, Yacht Dice, Shut the Box and more. No ads, no signup.',
    intro:
      'A standard 52-card pack and plain dice, drawn from scratch. Deals are shuffled with the browser crypto API or from a seed you can share, scoring is by points only, and every game explains its rules and its computer players.',
  },
  puzzle: {
    label: 'Puzzles',
    heading: 'Free online logic puzzles',
    title: 'Free Online Logic Puzzles & Brain Games | gekro',
    description:
      'Free logic puzzles in your browser: Sudoku, Nonogram, Skyscrapers, Calcudoku, Tangram and more. Every puzzle has one solution. Daily puzzle, no ads.',
    intro:
      'Logic puzzles whose generators prove each puzzle has exactly one solution that deduction can find, so you never have to guess. Most have a daily puzzle that is the same for everyone, hints that explain the deduction, and a way to check your work.',
  },
  word: {
    label: 'Word games',
    heading: 'Free online word games',
    title: 'Free Online Word Games & Puzzles | gekro',
    description:
      'Free word games in your browser: Word Guess, Hangman, Word Search, Word Ladder, Cryptogram and more. Hand-checked word lists, no ads, no signup.',
    intro:
      'Word games built on hand-checked word lists, filtered so nothing rude is ever shown. Play a daily word, climb a ladder one letter at a time, decode a saying or hunt for words in a grid.',
  },
  arcade: {
    label: 'Arcade games',
    heading: 'Free online arcade games',
    title: 'Free Online Arcade Games, No Download | gekro',
    description:
      'Free arcade games in your browser: Snake, Space Rocks, Brick Smasher, Cave Flyer, Highway Dodge, Gem Swap and more. Keyboard and touch, no ads.',
    intro:
      'Quick arcade games for keyboard, mouse and touch. They pause when you switch tabs, honour reduced-motion settings, keep your best score on your own device only and never show an advert.',
  },
  creative: {
    label: 'Creative toys',
    heading: 'Free online creative toys and sandboxes',
    title: 'Free Online Creative Toys & Sandboxes | gekro',
    description:
      'Free creative browser toys: Kaleidoscope, Falling Sand, Fireworks, Zen Garden, Pixel Art, Piano and more. Calm, colourful, no ads, no signup.',
    intro:
      'Toys with no score to beat. Draw mirrored patterns, rake sand, launch fireworks, play a piano, watch a swarm or zoom into a fractal. They are calm by default and every one runs in your browser.',
  },
  learning: {
    label: 'Learning games',
    heading: 'Free online learning games',
    title: 'Free Online Learning Games for Kids & Adults | gekro',
    description:
      'Free learning games in your browser: times tables, telling time, counting coins, shapes, colours, spelling and Morse code. Gentle, no ads, no signup.',
    intro:
      'Gentle practice games for number sense, telling time, money, shapes, colours, letters and spelling. Big targets, short words, praise that says what you did well, no scores to compare and nothing that asks for a name.',
  },
};

/**
 * Every game and its genre. Order inside a genre is the order on the hub (the
 * hub also shows "newest" separately), so group related games together.
 */
export const GAME_GENRE: Record<string, GenreId> = {
  // ---- Board and strategy
  'chess': 'board',
  'checkers': 'board',
  'reversi': 'board',
  'tic-tac-toe': 'board',
  'four-in-a-row': 'board',
  'gomoku': 'board',
  'dots-and-boxes': 'board',
  'mancala': 'board',
  'hex': 'board',
  'nine-mens-morris': 'board',
  'fox-and-geese': 'board',
  'nim': 'board',
  'dominoes': 'board',
  'snakes-and-ladders': 'board',
  'backgammon': 'board',
  'star-halma': 'board',
  'hnefatafl': 'board',
  'konane': 'board',
  'bagh-chal': 'board',
  'royal-game-of-ur': 'board',
  'amazons': 'board',
  'nested-tic-tac-toe': 'board',
  // ---- Card and dice
  'solitaire': 'cards',
  'go-fish': 'cards',
  'crazy-eights': 'cards',
  'card-war': 'cards',
  'pig-dice': 'cards',
  'hearts': 'cards',
  'gin-rummy': 'cards',
  'spider-solitaire': 'cards',
  'pyramid-solitaire': 'cards',
  'golf-solitaire': 'cards',
  'old-maid': 'cards',
  'beggar-my-neighbour': 'cards',
  'shut-the-box': 'cards',
  'yacht-dice': 'cards',
  'ten-thousand': 'cards',
  // ---- Puzzles
  'sudoku': 'puzzle',
  'nonogram': 'puzzle',
  'merge-tiles': 'puzzle',
  'match-pairs': 'puzzle',
  'mines': 'puzzle',
  'sliding-puzzle': 'puzzle',
  'light-grid': 'puzzle',
  'tower-of-hanoi': 'puzzle',
  'peg-solitaire': 'puzzle',
  'code-breaker': 'puzzle',
  'loop-puzzle': 'puzzle',
  'island-bridges': 'puzzle',
  'maze-dash': 'puzzle',
  'colour-flood': 'puzzle',
  'binary-puzzle': 'puzzle',
  'sum-grid': 'puzzle',
  'inequality-grid': 'puzzle',
  'colour-tubes': 'puzzle',
  'pipe-connect': 'puzzle',
  'traffic-jam': 'puzzle',
  'crate-pusher': 'puzzle',
  'picture-puzzle': 'puzzle',
  'skyscrapers': 'puzzle',
  'calcudoku': 'puzzle',
  'tents-and-trees': 'puzzle',
  'lamp-grid': 'puzzle',
  'pair-paths': 'puzzle',
  'sea-and-islands': 'puzzle',
  'logic-grid': 'puzzle',
  'eight-queens': 'puzzle',
  'river-crossing': 'puzzle',
  'water-jugs': 'puzzle',
  'tangram': 'puzzle',
  'knights-tour': 'puzzle',
  // ---- Word
  'word-guess': 'word',
  'hangman': 'word',
  'word-search': 'word',
  'letter-grid': 'word',
  'typing-test': 'word',
  'word-ladder': 'word',
  'cryptogram': 'word',
  'word-chain': 'word',
  // ---- Arcade
  'snake': 'arcade',
  'brick-smasher': 'arcade',
  'bubble-pop': 'arcade',
  'critter-pop': 'arcade',
  'wing-hop': 'arcade',
  'road-hopper': 'arcade',
  'soft-landing': 'arcade',
  'cannon-shot': 'arcade',
  'pattern-echo': 'arcade',
  'reaction-time': 'arcade',
  'aim-trainer': 'arcade',
  'colour-clash': 'arcade',
  'space-rocks': 'arcade',
  'paddle-rally': 'arcade',
  'cloud-climb': 'arcade',
  'cave-flyer': 'arcade',
  'highway-dodge': 'arcade',
  'tower-stack': 'arcade',
  'gem-swap': 'arcade',
  'garden-defence': 'arcade',
  // ---- Creative toys
  'falling-sand': 'creative',
  'cell-garden': 'creative',
  'pixel-art': 'creative',
  'drum-pad': 'creative',
  'piano': 'creative',
  'pattern-maker': 'creative',
  'colouring-book': 'creative',
  'kaleidoscope': 'creative',
  'bubble-wrap': 'creative',
  'zen-garden': 'creative',
  'fireworks': 'creative',
  'idle-orchard': 'creative',
  'rock-paper-scissors': 'creative',
  'sorting-race': 'creative',
  'swarm-garden': 'creative',
  'fractal-zoom': 'creative',
  // ---- Learning
  'times-tables': 'learning',
  'clock-reader': 'learning',
  'coin-counter': 'learning',
  'morse-tutor': 'learning',
  'counting-garden': 'learning',
  'shape-sorter': 'learning',
  'colour-mixer': 'learning',
  'make-ten': 'learning',
  'spelling-builder': 'learning',
  'odd-one-out': 'learning',
  'sort-it': 'learning',
  'dot-to-dot': 'learning',
  'balloon-maths': 'learning',
  'letter-tracer': 'learning',
};

export const GAME_SLUGS: string[] = Object.keys(GAME_GENRE);

export const isGame = (slug: string): boolean => Object.prototype.hasOwnProperty.call(GAME_GENRE, slug);

/** The page URL of an app or game, with the trailing slash the site uses. */
export const itemUrl = (slug: string): string => (isGame(slug) ? `/games/${slug}/` : `/apps/${slug}/`);

export const GAMES_HUB_URL = '/games/';
export const genreUrl = (g: string): string => `/games/category/${g}/`;

/** Genre hubs need at least this many games to be worth a page. */
export const MIN_GAMES_FOR_GENRE = 3;

/**
 * <title> for a game page: confirms the game is free and online (what players
 * search for), within Google's ~60-character display width, with shorter
 * fallbacks and finally the bare name.
 */
export const GAME_TITLE_MAX = 60;
export const gamePageTitle = (title: string): string => {
  const t = title.trim();
  const candidates = [`${t} - Free Online Game | gekro`, `${t} - Free Game | gekro`, `${t} | gekro`];
  return candidates.find((c) => c.length <= GAME_TITLE_MAX) ?? candidates[candidates.length - 1];
};
