/**
 * games-spelling-builder.test.ts - the engine behind `spelling-builder`.
 *
 * Pinned: the hand-written picture list matches a separately typed reference table (word and
 * emoji), has over 100 words with at least 20 per level, no duplicates, no anagram pairs,
 * nothing blocked, every picture is a colour emoji with a label that names it; the tiles are
 * the word's letters plus the stated number of decoys (none in the word), never read as the
 * word in order, never able to spell another list word, never contain a blocked string; a
 * round is decided by its seed; the tap state machine only accepts the next letter, counts
 * misses, glows the right tile after two tries and finishes exactly when the word is built;
 * random play never throws; the sanitisers reject junk; the praise never scolds.
 */
import { describe, it, expect } from 'vitest';
import {
  WORDS, BLOCKED, REVERSED_BLOCKED, LEVELS, LEVEL_NAME, WORD_LENGTH, DECOY_COUNT, ROUND_SIZE, STEP_UP_AT, AUTO_HINT_AFTER, LETTERS, MAX_LEVEL,
  mulberry32, pickIndex, shuffle, roundRng, sanitiseSeed, sanitiseLevel, wordsForLevel, containsBlocked, canSpell,
  makeBank, makePuzzle, newGame, isDone, expectedLetter, slotLetters, firstTry, tapTile, tileForLetter, nextTile, showMe,
  autoHint, praise, retry, spelledText, progressText, streakAfter, offersStepUp, letterKeyApplies, plural,
  emptySaved, sanitiseSaved, bestFor, addStar, recordRound, shareLine,
  type Level, type Game, type Puzzle,
} from '../src/components/apps-private/spelling-builder/helpers';
import calculatorSource from '../src/components/apps-private/spelling-builder/Calculator.astro?raw';

/** Typed again on purpose, apart from the list in helpers.ts: word, then its picture. */
const REFERENCE = `
cat 🐱|dog 🐶|pig 🐷|cow 🐄|bee 🐝|ant 🐜|bat 🦇|owl 🦉|fox 🦊|sun ☀️|bus 🚌|car 🚗|key 🔑|bed 🛏️|egg 🥚|pie 🥧|map 🗺️|web 🕸️|eye 👁️|ear 👂|hat 🎩|pen 🖊️
frog 🐸|duck 🦆|fish 🐟|bird 🐦|bear 🐻|lion 🦁|wolf 🐺|deer 🦌|crab 🦀|goat 🐐|corn 🌽|rose 🌹|tree 🌳|moon 🌙|star ⭐|fire 🔥|rain 🌧️|cake 🎂|milk 🥛|rice 🍚|pear 🍐|bell 🔔|book 📖|door 🚪|ship 🚢|bike 🚲|taxi 🚕|ball ⚽|drum 🥁|gift 🎁|ring 💍|sock 🧦|shoe 👟|nose 👃|tent ⛺|gear ⚙️|wave 🌊|lock 🔒|kiwi 🥝|bath 🛁|sled 🛷|taco 🌮
horse 🐴|sheep 🐑|tiger 🐯|zebra 🦓|whale 🐳|mouse 🐭|camel 🐫|koala 🐨|panda 🐼|snail 🐌|eagle 🦅|squid 🦑|chick 🐥|rhino 🦏|apple 🍎|grape 🍇|lemon 🍋|peach 🍑|pizza 🍕|bread 🍞|salad 🥗|candy 🍬|honey 🍯|spoon 🥄|radio 📻|phone 📱|clock ⏰|train 🚆|plane ✈️|truck 🚚|house 🏠|crown 👑|heart ❤️|cloud ☁️|tulip 🌷|ruler 📏|robot 🤖|jeans 👖|dress 👗|scarf 🧣|shirt 👕|glove 🧤
`;
const REF: Record<string, string> = Object.fromEntries(
  REFERENCE.split(/[\n|]/).map((s) => s.trim()).filter(Boolean).map((s) => s.split(' ') as [string, string]),
);

const sortedLetters = (w: string) => [...w].sort().join('');

const rev = (t: string): string => [...t].reverse().join('');

describe('word list integrity', () => {
  it('has the 106 words the content page states: 22 with three letters, 42 with four, 42 with five', () => {
    expect(WORDS.length).toBe(106);
    expect(wordsForLevel(1)).toHaveLength(22);
    expect(wordsForLevel(2)).toHaveLength(42);
    expect(wordsForLevel(3)).toHaveLength(42);
  });
  it('has over 100 words and at least 20 at every level', () => {
    expect(WORDS.length).toBeGreaterThan(100);
    for (const l of LEVELS) expect(wordsForLevel(l).length, `level ${l}`).toBeGreaterThanOrEqual(20);
  });
  it('matches the separately typed reference table, word for word and picture for picture', () => {
    expect(Object.keys(REF).length).toBe(WORDS.length);
    for (const e of WORDS) expect(REF[e.word], e.word).toBe(e.pic);
    expect(new Set(WORDS.map((e) => e.word))).toEqual(new Set(Object.keys(REF)));
  });
  it('has no duplicate word and no duplicate picture', () => {
    expect(new Set(WORDS.map((e) => e.word)).size).toBe(WORDS.length);
    expect(new Set(WORDS.map((e) => e.pic)).size).toBe(WORDS.length);
  });
  it('uses only lower-case a-z words of 3, 4 or 5 letters, each in exactly one level', () => {
    for (const e of WORDS) {
      expect(e.word).toMatch(/^[a-z]{3,5}$/);
      expect(LEVELS.filter((l) => e.word.length === WORD_LENGTH[l]), e.word).toHaveLength(1);
    }
    expect(WORD_LENGTH).toEqual({ 1: 3, 2: 4, 3: 5 });
  });
  it('has no two words in a level that are anagrams of each other', () => {
    for (const l of LEVELS) {
      const keys = wordsForLevel(l).map((e) => sortedLetters(e.word));
      expect(new Set(keys).size, `level ${l}`).toBe(keys.length);
    }
  });
  it('draws every picture as one colour emoji (a single symbol that is shown as a picture, not text)', () => {
    for (const e of WORDS) {
      expect([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(e.pic)], e.word).toHaveLength(1);
      expect(e.pic, e.word).toMatch(/^(\p{Emoji_Presentation}|\p{Emoji}️)$/u);
      expect(e.pic.codePointAt(0)!, `${e.word} newer than the 2018 emoji set`).toBeLessThan(0x1fa70);
    }
  });
  it('gives every picture a spoken label that names it', () => {
    for (const e of WORDS) {
      expect(e.alt, e.word).toContain(e.word);
      expect(e.alt).toMatch(/^(a|an|the) /);
      expect(e.alt).not.toMatch(/NaN|undefined|null/);
    }
  });
  it('contains no blocked word, and only these five words hide a blocked string (each is the picture word itself)', () => {
    const hidden: string[] = [];
    for (const e of WORDS) {
      expect(BLOCKED.includes(e.word), e.word).toBe(false);
      for (const bl of BLOCKED) if (e.word.includes(bl)) hidden.push(`${e.word}:${bl}`);
      // with the word exemption, the word's own letters are never blocked
      expect(containsBlocked([...e.word], e.word), e.word).toBe(false);
    }
    expect(hidden.sort()).toEqual(['drum:rum', 'grape:rape', 'shoe:hoe', 'spoon:poo', 'zebra:bra']);
    // Read right to left, only sheep (pee) hides one of the sexual or hateful strings, and pee is inside the word itself.
    const hiddenBack: string[] = [];
    for (const e of WORDS) for (const bl of REVERSED_BLOCKED) if (rev(e.word).includes(bl)) hiddenBack.push(`${e.word}:${bl}`);
    expect(hiddenBack.sort()).toEqual(['sheep:pee']);
    expect(REVERSED_BLOCKED.length).toBeGreaterThanOrEqual(9);
    expect(new Set(REVERSED_BLOCKED).size).toBe(REVERSED_BLOCKED.length);
    for (const must of ['sex', 'ass', 'hoe', 'tard', 'turd', 'arse', 'pee', 'bum', 'wee']) expect(REVERSED_BLOCKED, must).toContain(must);
    expect(BLOCKED.length).toBeGreaterThan(20);
    expect(new Set(BLOCKED).size).toBe(BLOCKED.length);
    expect(BLOCKED.every((b) => /^[a-z]+$/.test(b))).toBe(true);
    for (const must of ['rape', 'anus', 'dyke', 'hoe', 'poo', 'wop', 'nob', 'knob', 'vag', 'shag', 'dope', 'pooh', 'bra']) {
      expect(BLOCKED, must).toContain(must);
    }
    // Third round (independent audit)
    for (const must of ['hos', 'sux', 'lsd', 'hiv', 'fck', 'std', 'oxy', 'gimp', 'fuc', 'yid', 'gore', 'fuk', 'beer', 'stab', 'bong', 'barf', 'perv', 'klan', 'gory',
      'coke', 'shat', 'puke', 'lesbo', 'tard', 'turd', 'arse']) {
      expect(BLOCKED, must).toContain(must);
    }
    expect(BLOCKED.length).toBe(217); // the number quoted on the guide page
  });
  it('keeps to nothing scary, branded or unsafe, by a fixed list of banned pictures and words', () => {
    const banned = ['snake', 'spider', 'shark', 'ghost', 'gun', 'knife', 'bomb', 'skull', 'beer', 'wine', 'pill', 'devil', 'witch'];
    for (const e of WORDS) expect(banned.some((b) => e.word.includes(b) || e.alt.includes(b)), e.word).toBe(false);
    for (const bad of ['🔫', '🔪', '💣', '💀', '👻', '🐍', '🕷️', '🦈', '🍺', '🍷', '🏳️', '🏴']) {
      expect(WORDS.some((e) => e.pic === bad), bad).toBe(false);
    }
  });
});

describe('seeded randomness helpers', () => {
  it('mulberry32 is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('pickIndex is always a valid index, even for a bad rng', () => {
    for (const r of [0, 0.5, 0.999999, 1, -3, NaN, Infinity]) expect(pickIndex(5, () => r)).toBeGreaterThanOrEqual(0);
    for (const r of [0, 0.5, 0.999999, 1, -3, NaN, Infinity]) expect(pickIndex(5, () => r)).toBeLessThanOrEqual(4);
    expect(pickIndex(1, () => 0.9)).toBe(0);
  });
  it('shuffle keeps every item once and never changes its input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7];
    const copy = input.slice();
    const out = shuffle(input, mulberry32(9));
    expect(input).toEqual(copy);
    expect([...out].sort()).toEqual(copy);
    expect(shuffle(input, mulberry32(9))).toEqual(out);
  });
  it('roundRng gives each puzzle of a round its own stream, the same every time', () => {
    expect(roundRng(5, 0)()).toBe(roundRng(5, 0)());
    expect(roundRng(5, 0)()).not.toBe(roundRng(5, 1)());
    expect(roundRng(5, 0)()).not.toBe(roundRng(6, 0)());
  });
  it('sanitiseSeed and sanitiseLevel reject junk', () => {
    expect(sanitiseSeed(1)).toBe(1);
    expect(sanitiseSeed(4294967295)).toBe(4294967295);
    for (const bad of [0, -1, 1.5, NaN, Infinity, 2 ** 32, 2 ** 53, '7', null, undefined, {}, [], true]) expect(sanitiseSeed(bad), String(bad)).toBe(0);
    expect(sanitiseLevel(1)).toBe(1);
    expect(sanitiseLevel(3)).toBe(3);
    for (const bad of [0, 4, -1, 2.5, NaN, '2', null, undefined, {}, [], true]) expect(sanitiseLevel(bad), String(bad)).toBe(1);
  });
});

describe('the letter bank', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

  it('holds the word letters plus exactly the stated number of decoys, none of them in the word', () => {
    for (const l of LEVELS) {
      for (const e of wordsForLevel(l)) {
        for (const s of seeds.slice(0, 12)) {
          const bank = makeBank(e.word, l, mulberry32(s));
          expect(bank.length, e.word).toBe(e.word.length + DECOY_COUNT[l]);
          // independent multiset check
          const rest = bank.slice();
          for (const ch of e.word) {
            const at = rest.indexOf(ch);
            expect(at, `${e.word}: ${ch}`).toBeGreaterThanOrEqual(0);
            rest.splice(at, 1);
          }
          expect(rest.length).toBe(DECOY_COUNT[l]);
          expect(new Set(rest).size, `${e.word} decoys are different`).toBe(rest.length);
          for (const d of rest) expect(e.word.includes(d), `${e.word} decoy ${d}`).toBe(false);
          for (const d of rest) expect(LETTERS).toContain(d);
        }
      }
    }
  }, 30_000);

  it('never shows the word in order, never spells another list word, never reads as a blocked string', () => {
    for (const l of LEVELS) {
      for (const e of wordsForLevel(l)) {
        for (const s of seeds) {
          const bank = makeBank(e.word, l, mulberry32(s));
          expect(bank.slice(0, e.word.length).join(''), `${e.word} in order`).not.toBe(e.word);
          for (const other of WORDS) {
            if (other.word === e.word || other.word.length !== e.word.length) continue;
            // independent subset check by sorting
            const have = sortedLetters(bank.join(''));
            let i = 0;
            let j = 0;
            const need = sortedLetters(other.word);
            while (i < have.length && j < need.length) { if (have[i] === need[j]) j++; i++; }
            expect(j === need.length, `${e.word} bank ${bank.join('')} could spell ${other.word}`).toBe(false);
          }
          const text = bank.join('');
          for (const b of BLOCKED) expect(text.includes(b) && !e.word.includes(b), `${text} contains ${b}`).toBe(false);
          const back = [...text].reverse().join('');
          for (const b of REVERSED_BLOCKED) expect(back.includes(b) && !rev(e.word).includes(b), `${text} read backwards contains ${b}`).toBe(false);
        }
      }
    }
  }, 60_000);

  it('is the same for the same seed and different for different seeds', () => {
    const a = makeBank('horse', 3, mulberry32(11));
    expect(makeBank('horse', 3, mulberry32(11))).toEqual(a);
    const many = new Set(seeds.map((s) => makeBank('horse', 3, mulberry32(s)).join('')));
    expect(many.size).toBeGreaterThan(20);
  });

  it('canSpell counts letters, not just which letters', () => {
    expect(canSpell(['b', 'a', 'l', 'l'], 'ball')).toBe(true);
    expect(canSpell(['b', 'a', 'l'], 'ball')).toBe(false);
    expect(canSpell([], 'a')).toBe(false);
    expect(canSpell(['a'], '')).toBe(true);
  });
  it('3 levels x 5000 seeds x 6 pictures: no bank holds a blocked string, forwards or (for the sexual and hateful ones) backwards, except inside its own word', () => {
    for (const l of LEVELS) {
      for (let seed = 1; seed <= 5000; seed++) {
        const used: string[] = [];
        for (let i = 0; i < ROUND_SIZE; i++) {
          const p = makePuzzle(l, roundRng(seed, i), used);
          used.push(p.word);
          const text = p.bank.join('');
          for (const b of BLOCKED) {
            if (text.includes(b) && !p.word.includes(b)) throw new Error(`level ${l} seed ${seed} picture ${i}: ${text} holds ${b} (word ${p.word})`);
          }
          const back = [...text].reverse().join('');
          for (const b of REVERSED_BLOCKED) {
            if (back.includes(b) && ![...p.word].reverse().join('').includes(b)) throw new Error(`level ${l} seed ${seed} picture ${i}: ${text} read backwards holds ${b} (word ${p.word})`);
          }
        }
      }
    }
  }, 240_000);

  it('the word exemption only covers strings inside the target word', () => {
    expect(containsBlocked([...'xxrapexx'])).toBe(true);
    expect(containsBlocked([...'grape'], 'grape')).toBe(false);
    expect(containsBlocked([...'grape'], 'apple')).toBe(true);
    expect(containsBlocked([...'spoon'], 'spoon')).toBe(false);
    expect(containsBlocked([...'spooh'], 'spoon')).toBe(true);
    expect(containsBlocked([...'zebra'], 'zebra')).toBe(false);
    expect(containsBlocked([...'poohn'], 'spoon')).toBe(true);
    expect(containsBlocked([...'shoe'], 'shoe')).toBe(false);
    expect(containsBlocked([...'hoe'], 'sheep')).toBe(true);
    for (const b of ['rape', 'anus', 'dyke', 'hoe', 'poo', 'wop', 'nob', 'knob', 'vag', 'shag', 'dope', 'pooh', 'bra']) {
      expect(containsBlocked([...`q${b}q`], 'cat'), b).toBe(true);
    }
  });
  it('containsBlocked reads left to right, and right to left for the sexual and hateful strings, and finds nothing in normal words', () => {
    expect(containsBlocked([...'xxshitxx'])).toBe(true);
    expect(containsBlocked([...'xxllehxx'])).toBe(false); // hell backwards: only the left-to-right check applies to hell
    expect(containsBlocked([...'xxxesxx'])).toBe(true); // sex read right to left
    expect(containsBlocked([...'xxssaxx'])).toBe(true); // ass
    expect(containsBlocked([...'xxdrutxx'])).toBe(true); // turd
    expect(containsBlocked([...'xxeeepxx'])).toBe(true); // pee: 'eep' is pee read backwards
    expect(containsBlocked([...'xxemixx'])).toBe(false);
    expect(containsBlocked([...'peehs'], 'sheep')).toBe(true); // reads pee left to right, and sheep has no pee that way
    expect(containsBlocked([...'eepsh'], 'sheep')).toBe(false);
    expect(containsBlocked([...'eepsh'], 'house')).toBe(true);
    expect(containsBlocked([...'sheep'], 'sheep')).toBe(false); // read backwards it holds pee, which is allowed inside its own word
    expect(containsBlocked([...'sheep'])).toBe(true);
    expect(containsBlocked([...'house'])).toBe(false);
    expect(containsBlocked([])).toBe(false);
  });
});

describe('making a round', () => {
  it('is fully decided by level and seed, whatever order it is asked in', () => {
    for (const l of LEVELS) {
      const play = (seed: number): Puzzle[] => {
        const used: string[] = [];
        return Array.from({ length: ROUND_SIZE }, (_, i) => {
          const p = makePuzzle(l, roundRng(seed, i), used);
          used.push(p.word);
          return p;
        });
      };
      expect(play(77)).toEqual(play(77));
      expect(play(77)).not.toEqual(play(78));
    }
  });
  it('never repeats a picture inside one round, and every puzzle matches its level', () => {
    for (const l of LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        const used: string[] = [];
        for (let i = 0; i < ROUND_SIZE; i++) {
          const p = makePuzzle(l, roundRng(seed, i), used);
          expect(p.word.length).toBe(WORD_LENGTH[l]);
          expect(p.level).toBe(l);
          expect(used).not.toContain(p.word);
          expect(REF[p.word]).toBe(p.pic);
          used.push(p.word);
        }
      }
    }
  });
  it('falls back to a repeat only when every word was used', () => {
    const all = wordsForLevel(1).map((e) => e.word);
    const p = makePuzzle(1, mulberry32(3), all);
    expect(all).toContain(p.word);
  });
  it('spreads over the whole list for the level', () => {
    for (const l of LEVELS) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 400; seed++) seen.add(makePuzzle(l, mulberry32(seed)).word);
      expect(seen.size, `level ${l}`).toBe(wordsForLevel(l).length);
    }
  }, 30_000);
  it('states its round length and step-up rule as the page says', () => {
    expect(ROUND_SIZE).toBe(6);
    expect(STEP_UP_AT).toBe(5);
    expect(AUTO_HINT_AFTER).toBe(2);
    expect(MAX_LEVEL).toBe(3);
    expect(LEVEL_NAME).toEqual({ 1: 'Little', 2: 'Middle', 3: 'Big' });
    expect(DECOY_COUNT).toEqual({ 1: 2, 2: 3, 3: 4 });
  });
});

describe('tapping tiles', () => {
  const puzzle = (word: string, bank: string[]): Puzzle => {
    const e = WORDS.find((w) => w.word === word)!;
    return { level: sanitiseLevel(WORD_LENGTH[1] === word.length ? 1 : word.length === 4 ? 2 : 3), word, pic: e.pic, alt: e.alt, bank };
  };

  it('starts empty, wanting the first letter', () => {
    const g = newGame(puzzle('cat', ['x', 't', 'a', 'c', 'y']));
    expect(g.placed).toBe(0);
    expect(expectedLetter(g)).toBe('c');
    expect(slotLetters(g)).toEqual(['', '', '']);
    expect(isDone(g)).toBe(false);
    expect(firstTry(g)).toBe(true);
  });
  it('takes only the next letter, in order, and finishes on the last', () => {
    let g = newGame(puzzle('cat', ['x', 't', 'a', 'c', 'y']));
    let r = tapTile(g, 3);
    expect(r.move).toBe('placed');
    g = r.game;
    expect(slotLetters(g)).toEqual(['c', '', '']);
    r = tapTile(g, 2);
    expect(r.move).toBe('placed');
    g = r.game;
    r = tapTile(g, 1);
    expect(r.move).toBe('done');
    g = r.game;
    expect(isDone(g)).toBe(true);
    expect(slotLetters(g)).toEqual(['c', 'a', 't']);
    expect(firstTry(g)).toBe(true);
    expect(expectedLetter(g)).toBeNull();
  });
  it('counts a wrong tap as a miss without moving anything, and loses the first-time mark', () => {
    const g = newGame(puzzle('cat', ['x', 't', 'a', 'c', 'y']));
    const r = tapTile(g, 0);
    expect(r.move).toBe('miss');
    expect(r.game.placed).toBe(0);
    expect(r.game.misses).toBe(1);
    expect(r.game.used).toEqual(g.used);
    expect(firstTry(r.game)).toBe(false);
    expect(g.misses).toBe(0);
  });
  it('glows the right tile only after two wrong taps in a row, and a right tap clears the run', () => {
    let g = newGame(puzzle('cat', ['x', 't', 'a', 'c', 'y']));
    g = tapTile(g, 0).game;
    expect(autoHint(g)).toBe(false);
    g = tapTile(g, 4).game;
    expect(autoHint(g)).toBe(true);
    expect(nextTile(g)).toBe(3);
    g = tapTile(g, 3).game;
    expect(autoHint(g)).toBe(false);
    expect(g.misses).toBe(2);
  });
  it('ignores a used tile, a bad index and taps after the end, returning the same object', () => {
    let g = newGame(puzzle('cat', ['x', 't', 'a', 'c', 'y']));
    g = tapTile(g, 3).game;
    for (const bad of [3, -1, 5, 99, 1.5, NaN, Infinity]) {
      const r = tapTile(g, bad);
      expect(r.move, String(bad)).not.toBe('placed');
      if (r.move === 'ignored') expect(r.game).toBe(g);
    }
    g = tapTile(tapTile(g, 2).game, 1).game;
    expect(isDone(g)).toBe(true);
    const r = tapTile(g, 0);
    expect(r.move).toBe('ignored');
    expect(r.game).toBe(g);
  });
  it('treats two tiles with the same letter alike', () => {
    let g = newGame(puzzle('ball', ['l', 'b', 'a', 'l', 'x', 'y', 'z']));
    g = tapTile(g, 1).game;
    g = tapTile(g, 2).game;
    expect(tapTile(g, 3).move).toBe('placed');
    g = tapTile(g, 3).game;
    expect(tapTile(g, 0).move).toBe('done');
    expect(tileForLetter(g, 'l')).toBe(0);
  });
  it('finds the tile for a typed letter, ignoring case and used tiles', () => {
    let g = newGame(puzzle('cat', ['x', 't', 'a', 'c', 'y']));
    expect(tileForLetter(g, 'C')).toBe(3);
    expect(tileForLetter(g, 'q')).toBe(-1);
    expect(tileForLetter(g, '')).toBe(-1);
    expect(tileForLetter(g, 'ab')).toBe(-1);
    expect(tileForLetter(g, 3 as unknown as string)).toBe(-1);
    g = tapTile(g, 3).game;
    expect(tileForLetter(g, 'c')).toBe(-1);
  });
  it('Show me marks the puzzle as helped and points at the right tile; it does nothing once finished', () => {
    const g = newGame(puzzle('cat', ['x', 't', 'a', 'c', 'y']));
    const r = showMe(g);
    expect(r.tile).toBe(3);
    expect(r.game.helped).toBe(true);
    expect(firstTry(r.game)).toBe(false);
    expect(showMe(r.game).game).toBe(r.game);
    const done = tapTile(tapTile(tapTile(g, 3).game, 2).game, 1).game;
    expect(showMe(done)).toEqual({ game: done, tile: -1 });
    expect(nextTile(done)).toBe(-1);
  });
  it('random play, a few thousand games, never throws and finishes exactly when the word is built', () => {
    let finished = 0;
    for (let s = 1; s <= 3000; s++) {
      const rng = mulberry32(s);
      const l = LEVELS[s % 3];
      let g = newGame(makePuzzle(l, rng));
      let taps = 0;
      while (!isDone(g) && taps < 400) {
        const i = pickIndex(g.puzzle.bank.length, rng);
        const before = g;
        const r = tapTile(g, i);
        g = r.game;
        taps++;
        expect(g.placed).toBeGreaterThanOrEqual(before.placed);
        expect(g.placed).toBeLessThanOrEqual(g.puzzle.word.length);
        expect(g.used.filter(Boolean).length).toBe(g.placed);
        if (r.move === 'miss') expect(g.placed).toBe(before.placed);
        // the word spelled so far is always a prefix of the target
        expect(g.puzzle.word.startsWith(slotLetters(g).join(''))).toBe(true);
      }
      if (isDone(g)) finished++;
      expect(isDone(g)).toBe(slotLetters(g).join('') === g.puzzle.word);
    }
    expect(finished).toBe(3000);
  }, 30_000);
  it('perfect play always finishes with the first-time mark', () => {
    for (const l of LEVELS) {
      for (const e of wordsForLevel(l)) {
        let g = newGame(makePuzzle(l, mulberry32(e.word.length * 31), wordsForLevel(l).map((x) => x.word).filter((w) => w !== e.word)));
        expect(g.puzzle.word).toBe(e.word);
        while (!isDone(g)) g = tapTile(g, nextTile(g)).game;
        expect(firstTry(g)).toBe(true);
        expect(slotLetters(g).join('')).toBe(e.word);
      }
    }
  });
});

describe('words for the page', () => {
  it('never scolds: no cheer or retry line contains a negative word, and every retry encourages', () => {
    for (let n = 0; n < 20; n++) {
      expect(praise(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).toMatch(/try|go|another|different|nearly/i);
    }
    expect(praise(-1)).toBeTruthy();
    expect(retry(NaN)).toBeTruthy();
  });
  it('names the letters of the word in the cheer', () => {
    expect(spelledText('cat', 0)).toBe('Yes! c-a-t spells cat.');
    expect(spelledText('horse', 1)).toContain('h-o-r-s-e spells horse.');
  });
  it('reports progress and plurals correctly', () => {
    const g = newGame({ level: 1, word: 'cat', pic: '🐱', alt: 'a cat', bank: ['c', 'a', 't', 'x', 'y'] });
    expect(progressText(g)).toBe('0 of 3 letters');
    expect(progressText(tapTile(g, 0).game)).toBe('1 of 3 letters');
    expect(plural(1, 'star', 'stars')).toBe('star');
    expect(plural(0, 'star', 'stars')).toBe('stars');
    expect(plural(2, 'star', 'stars')).toBe('stars');
  });
  it('offers the next level after every fifth right-first-time word, never on the top level', () => {
    let s = 0;
    const offers: number[] = [];
    for (let i = 1; i <= 12; i++) { s = streakAfter(s, true); if (offersStepUp(s, 1)) offers.push(i); }
    expect(offers).toEqual([5, 10]);
    expect(streakAfter(7, false)).toBe(0);
    expect(offersStepUp(0, 1)).toBe(false);
    expect(offersStepUp(5, 3)).toBe(false);
    expect(offersStepUp(5, 2)).toBe(true);
    expect(offersStepUp(4, 1)).toBe(false);
  });
});

describe('keyboard scope', () => {
  it('counts a letter on the body, inside the game and on any button; never in a field', () => {
    expect(letterKeyApplies('BODY', false)).toBe(true);
    expect(letterKeyApplies('button', false)).toBe(true);
    expect(letterKeyApplies('SPAN', true)).toBe(true);
    expect(letterKeyApplies('A', false)).toBe(false);
    expect(letterKeyApplies('DIV', false)).toBe(false);
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(letterKeyApplies(tag, true)).toBe(false);
      expect(letterKeyApplies(tag, false)).toBe(false);
    }
    expect(letterKeyApplies('DIV', true, true)).toBe(false);
  });
});

describe('saved record', () => {
  it('starts at zero and reads junk as zero', () => {
    expect(sanitiseSaved(null)).toEqual(emptySaved());
    for (const bad of [undefined, 5, 'x', [], [1, 2], true, NaN]) expect(sanitiseSaved(bad), String(bad)).toEqual(emptySaved());
    expect(sanitiseSaved({ stars: -1, rounds: 1.5, b1: NaN, b2: '3', b3: Infinity })).toEqual(emptySaved());
  });
  it('caps each number and builds a fresh object with only the known keys', () => {
    const raw = JSON.parse('{"stars": 99999999, "rounds": 7, "b1": 99, "b2": 4, "b3": 2, "__proto__": {"x": 1}, "extra": 5}');
    const s = sanitiseSaved(raw);
    expect(s).toEqual({ stars: 1_000_000, rounds: 7, b1: ROUND_SIZE, b2: 4, b3: 2 });
    expect(Object.keys(s).sort()).toEqual(['b1', 'b2', 'b3', 'rounds', 'stars']);
    expect(s).not.toBe(raw);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
  it('adds stars, counts rounds and keeps only the best first-time count per level', () => {
    let s = emptySaved();
    s = addStar(addStar(s));
    expect(s.stars).toBe(2);
    s = recordRound(s, 2, 4);
    s = recordRound(s, 2, 3);
    s = recordRound(s, 1, 6);
    expect(s).toEqual({ stars: 2, rounds: 3, b1: 6, b2: 4, b3: 0 });
    expect(bestFor(s, 2)).toBe(4);
    expect(bestFor(s, 3)).toBe(0);
    expect(recordRound(s, 3, 99).b3).toBe(ROUND_SIZE);
    expect(recordRound(s, 3, -5).b3).toBe(0);
  });
});

describe('share text', () => {
  it('is correct for a new, partial and finished round and never contains a bad value', () => {
    for (const l of LEVELS) {
      for (const [stars, ft] of [[0, 0], [3, 2], [ROUND_SIZE, ROUND_SIZE], [ROUND_SIZE, 99], [2, 5]] as const) {
        const t = shareLine(l as Level, stars, ft);
        expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
        expect(t).toContain(LEVEL_NAME[l]);
        expect(t).toContain(`${WORD_LENGTH[l]}-letter`);
        expect(t).toContain(`${stars} of ${ROUND_SIZE} stars`);
        expect(t).toContain('spelled first time');
      }
    }
    expect(shareLine(1, 2, 5)).toContain('2 spelled first time');
  });
});

describe('page source', () => {
  const src = calculatorSource.replace(/\r\n?/g, '\n');
  it('is a 32 px how-it-works heading with the native marker', () => {
    const rule = src.match(/\.sb-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
  it('keeps every tile and button at least 56 px tall and tiles round and 64 px', () => {
    expect(src).toMatch(/\.sb-actions button, #sb-app \.sb-row button, #sb-app \.sb-play > button \{ min-height: 3\.5rem; \}/);
    expect(src).toMatch(/\.sb-tile \{[^}]*width: 4rem; height: 4rem;/);
    expect(src).toMatch(/\.sb-lvl \{[^}]*min-height: 3\.5rem/);
  });
  it('has no timers and no sound', () => {
    expect(src).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|AudioContext|speechSynthesis/);
  });
  it('writes only text content, never markup', () => {
    expect(src).not.toMatch(/innerHTML|insertAdjacentHTML/);
  });
});
