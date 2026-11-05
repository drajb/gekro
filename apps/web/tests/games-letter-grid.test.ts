/**
 * games-letter-grid.test.ts - the engine and word lists behind `letter-grid`.
 *
 * Pinned:
 *  - the word lists: lowercase a-z only, 3 to 7 letters, no duplicates, sorted, the two lists
 *    do not overlap, the file is well under 400 KB
 *  - every five-letter word that is not hand-picked comes from the ENABLE list in this repo, and
 *    the list holds all of ENABLE's five-letter words except blocked ones
 *  - nothing on the blocklist, and nothing on a SEPARATE list of crude words written in this test,
 *    is in the validity list or the everyday list, so it can be neither scored nor shown
 *  - the solver finds exactly the words an independent brute-force walk over every path finds
 *    (4x4 and 5x5 grids, many random grids; 6x6 on a few)
 *  - findPath agrees with brute force on whether a string can be spelled
 *  - tracing rules (touching, no reuse), typed words (never echoed), scoring by length
 *  - the generator: same seed same grid, every grid meets the stated word minimums, no Q,
 *    vowel share in range, fast
 *  - "words you missed" only ever lists everyday words that were not found, longest first
 *  - sanitisers, caps and text helpers
 */
import { describe, it, expect, vi } from 'vitest';

// Machine load makes wall-clock limits flake: give every test a generous budget.
vi.setConfig({ testTimeout: 120_000 });
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getDict, blockedSet, BLOCKED, neverShow, NEVER_SHOW_WORDS, NEVER_SHOW_STEMS, touching, neighbours, validPath, wordOf, findPath, solveGrid, pointsFor, totalPoints, cleanTyped, judgeWord, missedWords,
  makeGrid, minWords, minCommon, LETTER_WEIGHTS, VOWELS, bestKey, sanitiseBest, MAX_BEST_POINTS, formatClock, plural, reasonText, mulberry32, rowOf, colOf,
  SIZES, TIMES, MIN_LEN, MAX_LEN, DEFAULT_SIZE, DEFAULT_TIME,
} from '../src/components/apps-private/letter-grid/helpers';
import { COMMON_WORDS, EXTRA_WORDS, MORE_WORDS } from '../src/components/apps-private/letter-grid/words';
import { ENABLE5, ANSWERS } from '../src/components/apps-private/word-guess/helpers';

const common = COMMON_WORDS.split(' ');
const extra = EXTRA_WORDS.split(' ');
const more = MORE_WORDS.split(' ');
const dict = getDict();

/** A separate list of crude words and slurs, written here and not shared with the game code. */
const BAD_REF = [
  'ass', 'tit', 'tits', 'fag', 'fags', 'cum', 'cunt', 'cunts', 'dick', 'dicks', 'dyke', 'dykes', 'fuck', 'fucks', 'shit', 'shits', 'piss', 'cock', 'cocks', 'crap', 'damn',
  'hell', 'bitch', 'whore', 'whores', 'slut', 'sluts', 'sex', 'sexy', 'porn', 'porno', 'anal', 'anus', 'penis', 'vulva', 'rape', 'raped', 'rapes', 'pimp', 'pimps',
  'twat', 'twats', 'turd', 'turds', 'fart', 'farts', 'poop', 'nazi', 'nazis', 'negro', 'coon', 'coons', 'gook', 'gooks', 'kike', 'kikes', 'spic', 'spics', 'dago',
  'homo', 'homos', 'queer', 'boob', 'boobs', 'bimbo', 'bastard', 'wank', 'prick', 'sucks', 'skank', 'slag', 'tramp', 'wench', 'dildo', 'boner', 'butch', 'hussy',
  'lynch', 'fagot', 'gypsy', 'retard', 'jewed', 'honky', 'sambo', 'chink', 'darky', 'kafir', 'bitchy', 'faggot', 'nigger', 'nigga',
];

const randomLetters = (n: number, rng: () => number): string[] => {
  const pool = Object.keys(LETTER_WEIGHTS).flatMap((c) => new Array<string>(LETTER_WEIGHTS[c]).fill(c));
  return Array.from({ length: n * n }, () => pool[Math.floor(rng() * pool.length)]);
};

/** Independent adjacency by coordinates. */
const refAdj = (n: number, i: number): number[] => {
  const out: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const j = r * n + c;
    if (j !== i && Math.abs(r - Math.floor(i / n)) <= 1 && Math.abs(c - (i % n)) <= 1) out.push(j);
  }
  return out;
};

/** Every string of 1..7 letters that can be traced, by walking every simple path, no dictionary pruning. */
const allStrings = (n: number, letters: readonly string[]): Set<string> => {
  const out = new Set<string>();
  const adj = Array.from({ length: n * n }, (_, i) => refAdj(n, i));
  const used = new Uint8Array(n * n);
  const walk = (at: number, s: string): void => {
    used[at] = 1;
    out.add(s);
    if (s.length < 7) for (const nx of adj[at]) if (!used[nx]) walk(nx, s + letters[nx]);
    used[at] = 0;
  };
  for (let i = 0; i < n * n; i++) walk(i, letters[i]);
  return out;
};

describe('word lists', () => {
  it('hold only lowercase a-z words of 3 to 7 letters, sorted by length then alphabet, no duplicates', () => {
    for (const list of [common, extra, more]) {
      expect(list.every((w) => /^[a-z]{3,7}$/.test(w))).toBe(true);
      expect(new Set(list).size).toBe(list.length);
      const sorted = list.slice().sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
      expect(list).toEqual(sorted);
    }
  });
  it('the three lists do not overlap, EXTRA is only five-letter words and MORE holds no ENABLE five-letter word', () => {
    const c = new Set(common);
    const e = new Set(extra);
    expect(extra.filter((w) => c.has(w))).toEqual([]);
    expect(more.filter((w) => c.has(w) || e.has(w))).toEqual([]);
    expect(extra.every((w) => w.length === 5)).toBe(true);
    const enable = new Set(ENABLE5);
    expect(more.filter((w) => w.length === 5 && enable.has(w))).toEqual([]);
  });
  it('are small: the words file is well under 400 KB', () => {
    const bytes = statSync(resolve(__dirname, '../src/components/apps-private/letter-grid/words.ts')).size;
    expect(bytes).toBeLessThan(400_000);
  });
  it('size: the numbers quoted on the page', () => {
    const byLen = (list: string[], n: number) => list.filter((w) => w.length === n).length;
    expect(dict.words.size).toBe(common.length + extra.length + more.length);
    expect(dict.words.size).toBeGreaterThan(15000);
    expect(dict.common.size).toBe(common.length);
    expect(byLen(common, 3)).toBeGreaterThan(300);
    expect(byLen(common, 4)).toBeGreaterThan(1200);
    expect(byLen(common, 6)).toBeGreaterThan(2000);
    expect(byLen(common, 7)).toBeGreaterThan(1500);
  });
  it('every five-letter word is in the ENABLE list or in the repo answers list; ENABLE is complete except blocked words', () => {
    const enable = new Set(ENABLE5);
    const blocked = blockedSet();
    expect(extra.filter((w) => !enable.has(w))).toEqual([]);
    const five = new Set([...common, ...extra].filter((w) => w.length === 5));
    const missing = ENABLE5.filter((w) => !five.has(w) && !blocked.has(w));
    expect(missing).toEqual([]);
    // Hand-picked five-letter words that ENABLE lacks: none are expected beyond a handful.
    const outside = common.filter((w) => w.length === 5 && !enable.has(w));
    expect(outside.length).toBeLessThan(10);
    // Every answer of the guessing game that is not blocked is an everyday word here.
    // (Some answers, such as blood or knife, are no longer SHOWN as missed words; they are still accepted when typed.)
    const c = new Set([...common, ...extra]);
    expect(ANSWERS.filter((w) => !blocked.has(w) && !c.has(w))).toEqual([]);
  });
  it('the dictionary is built once and reused', () => {
    expect(getDict()).toBe(getDict());
  });
  it('prefixes cover every start of every word', () => {
    let k = 0;
    for (const w of dict.words) {
      if (++k % 7 !== 0) continue;
      for (let i = 1; i <= w.length; i++) expect(dict.prefixes.has(w.slice(0, i))).toBe(true);
    }
  });
});

describe('blocklist', () => {
  it('nothing on the blocklist is in the validity list or the everyday list', () => {
    const blocked = blockedSet();
    expect(blocked.size).toBeGreaterThan(250);
    for (const w of blocked) {
      expect(dict.words.has(w), w).toBe(false);
      expect(dict.common.has(w), w).toBe(false);
    }
    expect(BLOCKED).toBe([...blocked].join(' '));
  });
  it('a separate list of crude words written in this test never appears in either list', () => {
    const all = new Set([...common, ...extra, ...more]);
    expect(BAD_REF.filter((w) => all.has(w))).toEqual([]);
    expect(BAD_REF.filter((w) => dict.words.has(w))).toEqual([]);
  });
  it('the blocklist covers the separate list too (belt and braces), apart from words that are not valid anyway', () => {
    const blocked = blockedSet();
    const gaps = BAD_REF.filter((w) => !blocked.has(w) && w.length >= 3 && w.length <= 7);
    // Words absent from the blocklist must at least be absent from every list (checked above).
    for (const w of gaps) expect(dict.words.has(w)).toBe(false);
  });
  it('a blocked word is refused when typed even if it can be traced', () => {
    const letters = ['d', 'a', 'm', 'x', 'x', 'n', 'x', 'x', 'x'];
    const r = judgeWord(3, letters, new Set(), 'damn', null);
    expect(r).toEqual({ ok: false, reason: 'notWord' });
    const traced = judgeWord(3, letters, new Set(), '', [0, 1, 2, 5]);
    expect(traced).toEqual({ ok: false, reason: 'notWord' });
  });
  it('the solver never returns a blocked word, on 300 random grids', () => {
    const blocked = blockedSet();
    const rng = mulberry32(4);
    for (let t = 0; t < 300; t++) {
      const n = 4 + (t % 3);
      for (const w of solveGrid(n, randomLetters(n, rng)).keys()) expect(blocked.has(w), w).toBe(false);
    }
  });
});

describe('what a child can be shown or can score', () => {
  // Written here, not shared with the game code.
  const NOT_FOR_CHILDREN_TO_SEE = [
    'bloody', 'banged', 'hanged', 'muff', 'hump', 'humps', 'knob', 'knobs', 'jerk', 'dung', 'nuts', 'corpse', 'coffin', 'terror', 'horror', 'weapon',
    'deadly', 'assault', 'passion', 'demon', 'pussy', 'horny', 'naked', 'balls', 'thong', 'tarts', 'booze', 'vodka', 'dead', 'death', 'die', 'died', 'dies',
    'kill', 'murder', 'blood', 'bleed', 'gore', 'gory', 'stab', 'knife', 'knives', 'sword', 'swords', 'gun', 'bullet', 'pistol', 'grave', 'skull', 'tomb', 'war',
    'battle', 'attack', 'fight', 'fights', 'kidnap', 'burglar', 'funeral', 'lethal', 'wound', 'wounds', 'ghastly', 'hideous', 'hostile', 'destroy', 'execute',
    'rob', 'jail', 'thug', 'slay', 'evil', 'doom', 'hang', 'whip', 'slap', 'womb', 'wimp', 'lame', 'filth', 'abuse', 'agony', 'brawl', 'casino', 'gamble',
    'bully', 'cruel', 'crime', 'enemy', 'prison', 'thief', 'zombie', 'haunt', 'savage', 'plague', 'shoot', 'invade',
    'liquor', 'brandy', 'junkie', 'hatred', 'inferno', 'haunted', 'drowned', 'morgue', 'morbid', 'madman', 'lunacy', 'carnage', 'convict', 'grenade', 'firearm',
  ];
  it('none of the unsuitable words is in the list of words that are shown', () => {
    expect(NOT_FOR_CHILDREN_TO_SEE.length).toBeGreaterThan(100); // 'about 100' on the guide page
    expect(NOT_FOR_CHILDREN_TO_SEE.filter((w) => dict.common.has(w))).toEqual([]);
    expect(NOT_FOR_CHILDREN_TO_SEE.filter((w) => common.includes(w))).toEqual([]);
  });
  it('crude and vulgar words cannot score at all, and the ones a reviewer found are blocked', () => {
    const blocked = blockedSet();
    for (const w of ['pussy', 'horny', 'naked', 'balls', 'knobs', 'thong', 'tarts', 'humps', 'booze', 'vodka', 'bloody', 'banged', 'hanged', 'muff', 'hump', 'knob', 'jerk', 'dung', 'nuts',
      'corpse', 'coffin', 'terror', 'horror', 'weapon', 'deadly', 'assault', 'passion', 'demon']) {
      expect(blocked.has(w), w).toBe(true);
      expect(dict.words.has(w), w).toBe(false);
    }
  });
  it('words taken out of the shown list are never offered as missed words, whatever the grid', () => {
    const all = new Map(NOT_FOR_CHILDREN_TO_SEE.map((w) => [w, [0, 1, 2]] as [string, number[]]));
    expect(missedWords(all, new Set(), dict, 500)).toEqual([]);
  });
  it('ordinary words people try are accepted when traced or typed', () => {
    for (const w of ['people', 'station', 'letters', 'soldier', 'sweater', 'swimmer', 'castle', 'cookie', 'pudding', 'sausage', 'almond', 'harbour', 'granny', 'sandbox',
      'teacher', 'played', 'walking', 'danced', 'running', 'teaches', 'kissed', 'letter', 'school', 'garden']) {
      expect(dict.words.has(w), w).toBe(true);
    }
    // And they score when they can be spelled with touching tiles.
    const letters = ['c', 'a', 's', 'e', 'l', 't', 'x', 'x', 'x']; // c-a-s then down to t, back through l to e
    const r = judgeWord(3, letters, new Set(), 'castle', null);
    expect(r.ok).toBe(true);
  });
  it('the second list has a few hundred words and adds nothing blocked', () => {
    expect(more.length).toBeGreaterThan(300);
    expect(more.length).toBeLessThan(1000); // about 870 on the guide page
    expect(common.length).toBeGreaterThan(7800); // about 7,900 on the guide page
    expect(common.length).toBeLessThan(8000);
    expect(blockedSet().size).toBe(370); // the number on the guide page
    const blocked = blockedSet();
    expect(more.filter((w) => blocked.has(w))).toEqual([]);
  });
});

describe('words that are never shown as missed', () => {
  // Written here, not shared with the game code: what a reviewer saw plus the categories (violence, death, weapons, fear,
  // crude or bodily, drugs, alcohol, sex, abuse, slurs, crime, insults).
  const NEVER_REF = [
    'maim', 'pierce', 'rifle', 'riot', 'hate', 'hurt', 'smash', 'bash', 'monster', 'ghost', 'scare', 'scream', 'toilet', 'stool', 'guts', 'spew', 'burp', 'bury', 'rotten',
    'scared', 'scary', 'ghosts', 'monsters', 'hated', 'hates', 'hurts', 'smashed', 'pierced', 'rifles', 'riots', 'stools', 'toilets', 'screams', 'burps', 'buried',
    'kill', 'killed', 'killer', 'murder', 'blood', 'bleed', 'stab', 'stabbed', 'knife', 'sword', 'gun', 'bomb', 'weapon', 'bullet', 'pistol', 'cannon', 'missile',
    'dead', 'death', 'die', 'dies', 'died', 'dying', 'grave', 'tomb', 'coffin', 'corpse', 'skull', 'skeleton', 'funeral', 'drown', 'poison', 'toxic', 'venom',
    'fear', 'fears', 'afraid', 'fright', 'terror', 'horror', 'panic', 'nightmare', 'creepy', 'eerie', 'spooky', 'haunt', 'witch', 'demon', 'devil', 'evil', 'curse',
    'danger', 'dread', 'ogre', 'goblin', 'beast', 'wicked', 'vicious', 'savage', 'brutal',
    'fight', 'fought', 'war', 'battle', 'army', 'soldier', 'attack', 'assault', 'punch', 'slap', 'smack', 'whip', 'bleed', 'bleeding', 'beating', 'beaten', 'bully', 'tease', 'abuse',
    'steal', 'stole', 'thief', 'theft', 'rob', 'robber', 'crime', 'jail', 'prison', 'crook', 'bandit', 'hack', 'kidnap',
    'vomit', 'pee', 'poo', 'poop', 'snot', 'spit', 'drool', 'sweat', 'sweaty', 'stink', 'smelly', 'stench', 'gross', 'nasty', 'mold', 'rot', 'rots', 'gut', 'zit', 'pimple',
    'diaper', 'underwear', 'bikini', 'kiss', 'kisses', 'flirt', 'naughty', 'moan', 'dirty', 'filth',
    'drug', 'drugs', 'drunk', 'beer', 'wine', 'vodka', 'whisky', 'liquor', 'booze', 'rum', 'gin', 'ale', 'cider', 'tipsy', 'cigar', 'tobacco', 'smoker', 'casino', 'poker', 'lottery',
    'fat', 'skinny', 'nerd', 'geek', 'dork', 'wimp', 'coward', 'loser', 'crazy', 'insane', 'psycho', 'freak', 'scum', 'trash', 'slob', 'brat', 'cur', 'hobo',
    // Second audit: gambling, bars and drink, violence, crime, weapons, drugs and dirt, nasty stems, and the like.
    'bet', 'bets', 'betting', 'gamble', 'gambling', 'wager', 'pint', 'pints', 'saloon', 'tavern', 'keg', 'kegs', 'brew', 'brewed', 'lager', 'flog', 'whack', 'whacks', 'hurl', 'hurled',
    'slam', 'slammed', 'kick', 'kicked', 'loot', 'looted', 'plunder', 'thieve', 'bribe', 'bribed', 'scythe', 'razor', 'razors', 'dagger', 'daggers', 'swords', 'smoke', 'smoked',
    'wasted', 'joint', 'joints', 'lice', 'bedbug', 'nastier', 'nastily', 'gravely', 'graved', 'choking', 'dealer', 'jugs', 'strip', 'strips', 'immoral', 'rancid',
  ];
  const refSet = new Set(NEVER_REF);

  it('the words a reviewer saw, and an independent list of more than 150, are held back, are not in the shown list and are not in COMMON_WORDS', () => {
    expect(refSet.size).toBeGreaterThan(150);
    for (const w of refSet) {
      expect(neverShow(w), w).toBe(true);
      expect(dict.common.has(w), w).toBe(false);
      expect(common.includes(w), w).toBe(false);
    }
  });
  it('typed words are still accepted for those that are real words and not blocked', () => {
    const blocked = blockedSet();
    for (const w of ['maim', 'pierce', 'rifle', 'riot', 'hate', 'hurt', 'smash', 'bash', 'monster', 'ghost', 'scare', 'scream', 'toilet', 'stool', 'guts', 'spew', 'burp', 'bury', 'rotten']) {
      expect(blocked.has(w), w).toBe(false);
      expect(dict.words.has(w), w).toBe(true);
    }
    const letters = ['g', 'h', 'x', 'x', 'o', 'x', 'x', 's', 't']; // g-h, o-s-t below: ghost needs g-h-o-s-t touching
    expect(judgeWord(3, letters, new Set(), 'ghost', null).ok).toBe(true);
  });
  it('the shown list contains no word that starts with a held-back stem, and neverShow agrees with its own lists', () => {
    const stems = NEVER_SHOW_STEMS.split(' ');
    expect(stems.every((s) => s.length >= 4)).toBe(true);
    for (const w of dict.common) {
      expect(neverShow(w), w).toBe(false);
      expect(stems.some((s) => w.startsWith(s)), w).toBe(false);
    }
    for (const w of NEVER_SHOW_WORDS.split(' ')) expect(dict.common.has(w), w).toBe(false);
    expect(neverShow('SCARED')).toBe(true); // case does not matter
    expect(neverShow('cat')).toBe(false);
    expect(neverShow('')).toBe(false);
  });
  it('missedWords never returns one of them, over 2,000 simulated rounds on 4x4, 5x5 and 6x6 (random letters, random found words)', () => {
    const rng = mulberry32(2026);
    let rounds = 0;
    let shown = 0;
    for (let t = 0; t < 2100; t++) {
      const n = 4 + (t % 3);
      const letters = randomLetters(n, rng);
      const all = solveGrid(n, letters);
      const keep = rng();
      const found = new Set([...all.keys()].filter(() => rng() < keep * 0.5));
      for (const limit of [30, 500]) {
        for (const w of missedWords(all, found, dict, limit)) {
          expect(refSet.has(w), `${w} (round ${t})`).toBe(false);
          expect(neverShow(w), w).toBe(false);
          expect(dict.common.has(w), w).toBe(true);
          shown++;
        }
      }
      rounds++;
    }
    expect(rounds).toBe(2100);
    expect(shown).toBeGreaterThan(10000);
  }, 240_000);
  it('and the same on 150 grids the real generator makes, with a feed of every word in the grid offered as missed', () => {
    const rng = mulberry32(99);
    for (let t = 0; t < 150; t++) {
      const n = 4 + (t % 3);
      const g = makeGrid(n, rng);
      const all = solveGrid(n, g.letters);
      for (const w of missedWords(all, new Set(), dict, 500)) expect(refSet.has(w) || neverShow(w), w).toBe(false);
    }
  }, 240_000);
});

describe('tracing rules', () => {
  it('touching: neighbours including corners, never the same tile or off the board', () => {
    const n = 4;
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) expect(touching(n, a, b), `${a},${b}`).toBe(refAdj(n, a).includes(b));
    }
    expect(touching(n, 0, 0)).toBe(false);
    expect(touching(n, -1, 0)).toBe(false);
    expect(touching(n, 0, 16)).toBe(false);
    expect(touching(n, 0.5, 1)).toBe(false);
    expect(touching(n, NaN, 1)).toBe(false);
  });
  it('neighbours has 3 at a corner, 5 on an edge, 8 inside', () => {
    expect(neighbours(5, 0)).toHaveLength(3);
    expect(neighbours(5, 2)).toHaveLength(5);
    expect(neighbours(5, 12)).toHaveLength(8);
    for (let i = 0; i < 25; i++) expect([...neighbours(5, i)].sort((a, b) => a - b)).toEqual(refAdj(5, i));
  });
  it('validPath: connected, in range, no tile twice, not empty', () => {
    expect(validPath(4, [0, 1, 6, 11])).toBe(true);
    expect(validPath(4, [0, 2])).toBe(false);
    expect(validPath(4, [0, 1, 0])).toBe(false);
    expect(validPath(4, [])).toBe(false);
    expect(validPath(4, [0, 16])).toBe(false);
    expect(validPath(4, [-1])).toBe(false);
    expect(validPath(4, [1.5])).toBe(false);
    expect(validPath(4, [5])).toBe(true);
  });
  it('wordOf reads the letters along a path', () => {
    expect(wordOf(['a', 'b', 'c', 'd'], [3, 0, 2])).toBe('dac');
  });
  it('findPath returns a legal path spelling the word, exactly when brute force says the string exists', () => {
    const rng = mulberry32(21);
    for (let t = 0; t < 40; t++) {
      const n = 4;
      const letters = randomLetters(n, rng);
      const strings = allStrings(n, letters);
      const sample: string[] = [...strings].filter((_, i) => i % 97 === 0);
      // Also some strings that are not traceable.
      for (let k = 0; k < 20; k++) sample.push(Array.from({ length: 3 + (k % 5) }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(rng() * 26)]).join(''));
      for (const s of sample) {
        const p = findPath(n, letters, s);
        expect(p !== null, s).toBe(strings.has(s));
        if (p) { expect(validPath(n, p)).toBe(true); expect(wordOf(letters, p)).toBe(s); }
      }
    }
    expect(findPath(4, randomLetters(4, rng), '')).toBeNull();
  }, 60_000);
});

describe('solver against brute force', () => {
  for (const [n, count] of [[4, 40], [5, 12], [6, 2]] as const) {
    it(`${n}x${n}: the words found equal every dictionary word among all traced strings (${count} random grids)`, () => {
      const rng = mulberry32(900 + n);
      for (let t = 0; t < count; t++) {
        const letters = randomLetters(n, rng);
        const strings = allStrings(n, letters);
        const want = [...strings].filter((s) => s.length >= MIN_LEN && dict.words.has(s)).sort();
        const got = solveGrid(n, letters);
        expect([...got.keys()].sort()).toEqual(want);
        for (const [w, p] of got) { expect(validPath(n, p)).toBe(true); expect(wordOf(letters, p)).toBe(w); expect(w.length).toBeLessThanOrEqual(MAX_LEN); }
      }
    }, 300_000);
  }
  it('finds nothing in a grid of one repeated letter and handles an all-vowel grid', () => {
    expect(solveGrid(4, new Array(16).fill('x')).size).toBe(0);
    expect(solveGrid(4, new Array(16).fill('a')).size).toBe(0);
  });
});

describe('judging words', () => {
  const letters = ['c', 'a', 't', 's', 'o', 'r', 'e', 'd', 'n', 'i', 'g', 'h', 'l', 'u', 'b', 'k'];
  const n = 4;
  it('accepts a traced everyday word with its points', () => {
    const p = findPath(n, letters, 'cat')!;
    const r = judgeWord(n, letters, new Set(), '', p);
    expect(r).toEqual({ ok: true, word: 'cat', path: p, points: 1 });
  });
  it('accepts a typed word, finding its path itself', () => {
    const r = judgeWord(n, letters, new Set(), '  Cats ', null);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.word).toBe('cats'); expect(validPath(n, r.path)).toBe(true); expect(wordOf(letters, r.path)).toBe('cats'); }
  });
  it('rejects with a reason and never returns the text', () => {
    const cases: [string, string][] = [['ca', 'short'], ['cats', 'ok'], ['abcdefgh', 'long'], ['c4t', 'letters'], ['', 'letters'], ['zzzz', 'notInGrid']];
    for (const [text, want] of cases) {
      const r = judgeWord(n, letters, new Set(), text, null);
      if (want === 'ok') { expect(r.ok, text).toBe(true); continue; }
      expect(r).toEqual({ ok: false, reason: want });
      expect(JSON.stringify(r)).not.toContain(text || '\u0000');
    }
  });
  it('a traceable string that is not a word is notWord; a repeat is already', () => {
    const r = judgeWord(n, letters, new Set(), 'tsd', null);
    expect(r).toEqual({ ok: false, reason: 'notWord' });
    expect(judgeWord(n, letters, new Set(['cat']), 'cat', null)).toEqual({ ok: false, reason: 'already' });
  });
  it('a traced path that breaks the rules is notInGrid', () => {
    expect(judgeWord(n, letters, new Set(), '', [0, 2, 5])).toEqual({ ok: false, reason: 'notInGrid' });
    expect(judgeWord(n, letters, new Set(), '', [0, 1, 0])).toEqual({ ok: false, reason: 'notInGrid' });
  });
  it('cleanTyped keeps plain letters only', () => {
    expect(cleanTyped(' Hello ')).toBe('hello');
    for (const bad of ['he llo', 'h3llo', '<b>', 'héllo', '', null, undefined, 5, {}, 'a'.repeat(41)]) expect(cleanTyped(bad as unknown)).toBe('');
  });
  it('never throws on junk input', () => {
    for (const junk of ['', 'a', 'zz', '\u0000', '😀', 'x'.repeat(500), '__proto__', 'constructor']) {
      expect(() => judgeWord(n, letters, new Set(), junk, null)).not.toThrow();
    }
  });
  it('the reason texts are plain sentences that do not contain the word', () => {
    for (const r of ['short', 'long', 'letters', 'notInGrid', 'already', 'notWord'] as const) {
      expect(reasonText(r).endsWith('.')).toBe(true);
    }
  });
});

describe('scoring', () => {
  it('3 and 4 letters score 1, then 2, 3, 5; anything else scores 0', () => {
    expect([2, 3, 4, 5, 6, 7, 8].map(pointsFor)).toEqual([0, 1, 1, 2, 3, 5, 0]);
    expect(totalPoints(['cat', 'cats', 'crate', 'create', 'creates'])).toBe(1 + 1 + 2 + 3 + 5);
    expect(totalPoints([])).toBe(0);
  });
});

describe('missed words', () => {
  it('lists only everyday words the player did not find, longest first, never a blocked or obscure word', () => {
    const rng = mulberry32(2);
    for (let t = 0; t < 40; t++) {
      const n = 4 + (t % 3);
      const g = makeGrid(n, rng);
      const all = solveGrid(n, g.letters);
      const some = new Set([...all.keys()].filter((_, i) => i % 3 === 0));
      const miss = missedWords(all, some, dict, 40);
      expect(miss.length).toBeLessThanOrEqual(40);
      for (const w of miss) {
        expect(dict.common.has(w)).toBe(true);
        expect(some.has(w)).toBe(false);
        expect(all.has(w)).toBe(true);
        expect(BAD_REF).not.toContain(w);
      }
      for (let i = 1; i < miss.length; i++) {
        expect(miss[i - 1].length > miss[i].length || (miss[i - 1].length === miss[i].length && miss[i - 1] < miss[i])).toBe(true);
      }
    }
    expect(missedWords(new Map(), new Set())).toEqual([]);
    expect(missedWords(new Map([['cat', [0, 1, 2]]]), new Set(), dict, 0)).toEqual([]);
  });
  it('an obscure ENABLE-only word is never listed even when it is in the grid', () => {
    const obscure = extra.find((w) => !dict.common.has(w))!;
    const all = new Map([[obscure, [0, 1, 2, 3, 4]]]);
    expect(missedWords(all, new Set())).toEqual([]);
  });
});

describe('grid generator', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    for (const n of SIZES) {
      expect(makeGrid(n, mulberry32(7))).toEqual(makeGrid(n, mulberry32(7)));
    }
    const seen = new Set<string>();
    for (let s = 1; s <= 12; s++) seen.add(makeGrid(4, mulberry32(s)).letters.join(''));
    expect(seen.size).toBe(12);
  });
  for (const n of SIZES) {
    it(`${n}x${n}: 60 seeds all hold at least ${minWords(n)} words, ${minCommon(n)} everyday words, no Q, a sensible vowel share`, () => {
      for (let s = 1; s <= 60; s++) {
        const g = makeGrid(n, mulberry32(31 * s + n));
        expect(g.n).toBe(n);
        expect(g.letters).toHaveLength(n * n);
        expect(g.letters.every((c) => /^[a-z]$/.test(c) && c !== 'q')).toBe(true);
        const v = g.letters.filter((c) => VOWELS.includes(c)).length;
        expect(v).toBeGreaterThanOrEqual(Math.ceil(n * n * 0.28));
        expect(v).toBeLessThanOrEqual(Math.floor(n * n * 0.5));
        const all = solveGrid(n, g.letters);
        expect(all.size).toBeGreaterThanOrEqual(minWords(n));
        expect([...all.keys()].filter((w) => dict.common.has(w)).length).toBeGreaterThanOrEqual(minCommon(n));
      }
    }, 120_000);
  }
  it('builds fast: well under a second per grid', () => {
    const t0 = Date.now();
    for (let s = 1; s <= 20; s++) makeGrid(6, mulberry32(s));
    expect((Date.now() - t0) / 20).toBeLessThan(1000);
  });
  it('rejects absurd sizes and survives a degenerate rng', () => {
    expect(() => makeGrid(1, mulberry32(1))).toThrow(RangeError);
    expect(() => makeGrid(9, mulberry32(1))).toThrow(RangeError);
    expect(() => makeGrid(4.5, mulberry32(1))).toThrow(RangeError);
    for (const f of [() => 0, () => 0.999999]) {
      const g = makeGrid(4, f);
      expect(g.letters).toHaveLength(16);
      expect(g.letters.every((c) => /^[a-z]$/.test(c))).toBe(true);
    }
  });
  it('the page constants', () => {
    expect([...SIZES]).toEqual([4, 5, 6]);
    expect([...TIMES]).toEqual([120, 180, 0]);
    expect(DEFAULT_SIZE).toBe(4);
    expect(DEFAULT_TIME).toBe(180);
    expect(MIN_LEN).toBe(3);
    expect(MAX_LEN).toBe(7);
    expect(rowOf(4, 6)).toBe(1);
    expect(colOf(4, 6)).toBe(2);
  });
});

describe('saved bests and text', () => {
  it('keeps whole positive point totals for the known sizes and round lengths only', () => {
    expect(bestKey(4, 180)).toBe('4-180');
    expect(sanitiseBest({ '4-180': 30, '6-0': 200, '5-120': 12 })).toEqual({ '4-180': 30, '6-0': 200, '5-120': 12 });
    expect(sanitiseBest({ '4-180': 30, '3-180': 5, '4-60': 5, x: 1, '7-0': 4 })).toEqual({ '4-180': 30 });
    expect(sanitiseBest({ '4-180': 0, '5-180': -3, '6-180': 1.5, '4-120': NaN, '5-120': Infinity })).toEqual({});
    expect(sanitiseBest({ '4-180': '12', '5-180': true, '6-180': [3], '4-120': null })).toEqual({});
    expect(sanitiseBest({ '4-180': MAX_BEST_POINTS })).toEqual({ '4-180': MAX_BEST_POINTS });
    expect(sanitiseBest({ '4-180': MAX_BEST_POINTS + 1 })).toEqual({});
    for (const raw of [null, undefined, 5, 'text', true, [1, 2]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"polluted": 1}, "4-180": 9}'));
    expect(out).toEqual({ '4-180': 9 });
    expect(({} as any).polluted).toBeUndefined();
  });
  it('formats the clock (rounding up so 0:00 means time is up) and plurals', () => {
    expect(formatClock(180)).toBe('3:00');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(0.4)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-4)).toBe('0:00');
    expect(formatClock(NaN)).toBe('0:00');
    expect(plural(1, 'word')).toBe('1 word');
    expect(plural(0, 'word')).toBe('0 words');
  });
});
