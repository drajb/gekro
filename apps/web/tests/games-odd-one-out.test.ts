/**
 * games-odd-one-out.test.ts - the engine behind `odd-one-out`.
 *
 * Pinned: the five picture categories match a separately typed reference table, never share
 * a thing, and every thing is one colour emoji; every generated puzzle has exactly one odd
 * card for the attribute its question asks about (checked by an independent test), and on
 * every other attribute no single card stands out, at every level and for many seeds; Little
 * and Middle change only the asked-about attribute while Big also varies the rest; the
 * number, category, colour, shape and size rules produce exactly the ranges the page states;
 * each level offers exactly its rules and the same rule does not come twice in a row; a
 * round is decided by its seed; the choice state machine counts wrong picks and finishes on
 * the right one; the sanitisers reject junk; the cheers never scold.
 */
import { describe, it, expect } from 'vitest';
import {
  COLOURS, SHAPES, CATEGORIES, LEVELS, LEVEL_NAME, CARD_COUNT, ROUND_SIZE, STEP_UP_AT, MAX_LEVEL, RULES, RULE_ATTR, RULES_BY_LEVEL, PROMPT,
  mulberry32, pickIndex, shuffle, roundRng, sanitiseSeed, sanitiseLevel, attributesOf, oddAttributes, hasNoise, makePuzzle, explain,
  newTurn, choose, firstTry, praise, retry, plural, streakAfter, offersStepUp,
  emptySaved, sanitiseSaved, bestFor, addStar, recordRound, shareLine,
  type Card, type Level, type Puzzle, type Rule,
} from '../src/components/apps-private/odd-one-out/helpers';
import calculatorSource from '../src/components/apps-private/odd-one-out/Calculator.astro?raw';

/** Typed again on purpose, apart from the lists in helpers.ts. */
const REFERENCE: Record<string, string[]> = {
  animals: ['🐶 dog', '🐱 cat', '🐭 mouse', '🐰 rabbit', '🦊 fox', '🐻 bear', '🐼 panda', '🐨 koala', '🐯 tiger', '🦁 lion', '🐮 cow', '🐷 pig', '🐸 frog', '🐵 monkey'],
  vehicles: ['🚗 car', '🚌 bus', '🚓 police car', '🚑 ambulance', '🚒 fire engine', '🚜 tractor', '🚲 bike', '✈️ plane', '🚂 train', '🚢 ship', '🚕 taxi'],
  fruit: ['🍎 apple', '🍌 banana', '🍇 grape', '🍓 strawberry', '🍒 cherry', '🍑 peach', '🍍 pineapple', '🍉 watermelon', '🍋 lemon', '🍐 pear'],
  clothes: ['👕 shirt', '🧥 coat', '👗 dress', '🧦 sock', '🧤 glove', '🧣 scarf', '👟 shoe'],
  flowers: ['🌷 tulip', '🌹 rose', '🌻 sunflower', '🌼 blossom', '🌸 cherry blossom'],
};

/** Independent: the indexes i whose value differs from the others while all the others agree. */
const singles = (values: readonly unknown[]): number[] =>
  values.map((_, i) => i).filter((i) => {
    const others = values.filter((_, j) => j !== i);
    return others.every((v) => v === others[0]) && others[0] !== values[i];
  });

const seeds = (n: number, from = 1) => Array.from({ length: n }, (_, i) => from + i * 104729);

const roundOf = (level: Level, seed: number): Puzzle[] => {
  const recent: Rule[] = [];
  return Array.from({ length: ROUND_SIZE }, (_, i) => {
    const p = makePuzzle(level, roundRng(seed, i), recent);
    recent.push(p.rule);
    return p;
  });
};

describe('the things on the cards', () => {
  it('has six colours, each with a different name and a different capital letter', () => {
    expect(COLOURS).toHaveLength(6);
    expect(new Set(COLOURS.map((c) => c.name)).size).toBe(6);
    expect(new Set(COLOURS.map((c) => c.letter)).size).toBe(6);
    for (const c of COLOURS) { expect(c.letter).toMatch(/^[A-Z]$/); expect(c.letter).toBe(c.name[0].toUpperCase()); }
    expect(SHAPES).toHaveLength(6);
    expect(new Set(SHAPES).size).toBe(6);
  });
  it('matches the separately typed reference table, category by category', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(Object.keys(REFERENCE));
    for (const c of CATEGORIES) expect(c.things.map((t) => `${t.emoji} ${t.name}`), c.id).toEqual(REFERENCE[c.id]);
  });
  it('has the 47 pictures in five categories that the content page states', () => {
    expect(CATEGORIES).toHaveLength(5);
    expect(CATEGORIES.reduce((n, c) => n + c.things.length, 0)).toBe(47);
    expect(CATEGORIES.map((c) => c.things.length)).toEqual([14, 11, 10, 7, 5]);
  });
  it('never puts a thing in two categories, and has at least 5 things in each (enough for five alike plus one odd)', () => {
    const emoji = CATEGORIES.flatMap((c) => c.things.map((t) => t.emoji));
    const names = CATEGORIES.flatMap((c) => c.things.map((t) => t.name));
    expect(new Set(emoji).size).toBe(emoji.length);
    expect(new Set(names).size).toBe(names.length);
    for (const c of CATEGORIES) expect(c.things.length, c.id).toBeGreaterThanOrEqual(CARD_COUNT[3] - 1);
  });
  it('draws every thing as one colour emoji from the 2018 set or older, with nothing scary', () => {
    const banned = ['snake', 'spider', 'shark', 'ghost', 'gun', 'knife', 'bomb', 'skull', 'beer', 'wine', 'devil', 'tomato', 'aubergine', 'eggplant'];
    for (const c of CATEGORIES) {
      expect(c.one).toMatch(/^(a|an) /);
      expect(c.many.length).toBeGreaterThan(3);
      for (const t of c.things) {
        expect([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t.emoji)], t.name).toHaveLength(1);
        expect(t.emoji, t.name).toMatch(/^(\p{Emoji_Presentation}|\p{Emoji}️)$/u);
        expect(t.emoji.codePointAt(0)!).toBeLessThan(0x1fa70);
        expect(t.name).toMatch(/^[a-z ]+$/);
        expect(banned.some((b) => t.name.includes(b))).toBe(false);
      }
    }
    for (const bad of ['🐍', '🕷️', '🦈', '🔫', '🔪', '💣', '💀', '👻', '🍺', '🍷', '🍅', '🍆']) expect(CATEGORIES.some((c) => c.things.some((t) => t.emoji === bad)), bad).toBe(false);
  });
});

describe('seeded randomness helpers', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 500; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('pickIndex stays in range for a bad rng; shuffle keeps everything once', () => {
    for (const r of [0, 1, -2, NaN, Infinity, 0.9999]) { const i = pickIndex(6, () => r); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThanOrEqual(5); }
    const src = [1, 2, 3, 4, 5, 6];
    expect([...shuffle(src, mulberry32(1))].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('roundRng, sanitiseSeed and sanitiseLevel', () => {
    expect(roundRng(4, 1)()).toBe(roundRng(4, 1)());
    expect(roundRng(4, 1)()).not.toBe(roundRng(4, 2)());
    expect(sanitiseSeed(9)).toBe(9);
    for (const bad of [0, -1, 1.5, NaN, 2 ** 32, '3', null, undefined, [], {}]) expect(sanitiseSeed(bad)).toBe(0);
    expect(sanitiseLevel(3)).toBe(3);
    for (const bad of [0, 4, 2.2, '2', null, NaN, [], {}]) expect(sanitiseLevel(bad)).toBe(1);
  });
});

describe('oddAttributes', () => {
  const card = (o: Partial<Card>): Card => ({ kind: 'shape', shape: 0, colour: 0, size: 0, count: 0, emoji: '', cat: -1, label: 'x', ...o });

  it('agrees with the independent test on random sets of cards', () => {
    const rng = mulberry32(12);
    for (let t = 0; t < 3000; t++) {
      const n = 3 + pickIndex(4, rng);
      const cards = Array.from({ length: n }, () => card({ shape: pickIndex(2, rng), colour: pickIndex(2, rng), size: pickIndex(2, rng) }));
      const got = oddAttributes(cards);
      const want: { attr: string; index: number }[] = [];
      for (const a of attributesOf('shape')) for (const i of singles(cards.map((c) => c[a]))) want.push({ attr: a, index: i });
      expect(got).toEqual(want);
    }
  });
  it('knows plain cases', () => {
    const same = [card({}), card({}), card({}), card({})];
    expect(oddAttributes(same)).toEqual([]);
    expect(oddAttributes([card({}), card({}), card({ colour: 3 }), card({})])).toEqual([{ attr: 'colour', index: 2 }]);
    expect(oddAttributes([card({}), card({}), card({ colour: 1 }), card({ colour: 1 })])).toEqual([]);
    expect(oddAttributes([card({ colour: 1 }), card({ colour: 2 }), card({ colour: 3 })])).toEqual([]);
    expect(oddAttributes([card({}), card({ colour: 1 })])).toEqual([]);
    expect(oddAttributes([])).toEqual([]);
  });
  it('lists the attributes each kind of card is compared on', () => {
    expect(attributesOf('shape')).toEqual(['shape', 'colour', 'size']);
    expect(attributesOf('count')).toEqual(['count', 'colour']);
    expect(attributesOf('emoji')).toEqual(['cat']);
  });
});

describe('puzzles', () => {
  it('have exactly one odd card for the asked attribute and none for any other attribute, at every level', () => {
    let n = 0;
    for (const l of LEVELS) {
      for (const seed of seeds(150)) {
        for (const p of roundOf(l, seed)) {
          n++;
          expect(p.cards).toHaveLength(CARD_COUNT[l]);
          const attr = RULE_ATTR[p.rule];
          expect(singles(p.cards.map((c) => c[attr])), `${p.rule} level ${l}`).toEqual([p.odd]);
          for (const other of attributesOf(p.cards[0].kind)) {
            if (other !== attr) expect(singles(p.cards.map((c) => c[other])), `${p.rule}: ${other} stands out`).toEqual([]);
          }
          expect(oddAttributes(p.cards)).toEqual([{ attr, index: p.odd }]);
          expect(p.prompt).toBe(PROMPT[p.rule]);
          expect(p.odd).toBeGreaterThanOrEqual(0);
          expect(p.odd).toBeLessThan(p.cards.length);
          // the others agree on the asked value, the odd one differs
          const vals = p.cards.map((c) => c[attr]);
          const major = vals.filter((_, i) => i !== p.odd);
          expect(new Set(major).size).toBe(1);
          expect(vals[p.odd]).not.toBe(major[0]);
        }
      }
    }
    expect(n).toBe(3 * 150 * ROUND_SIZE);
  }, 60_000);

  it('offers exactly the rules each level states, and never the same rule twice running', () => {
    expect(RULES).toEqual(['colour', 'shape', 'size', 'number', 'category']);
    expect(RULES_BY_LEVEL[1]).toEqual(['colour', 'shape', 'size']);
    expect(RULES_BY_LEVEL[2]).toEqual(RULES);
    expect(RULES_BY_LEVEL[3]).toEqual(RULES);
    for (const l of LEVELS) {
      const seen = new Set<string>();
      for (const seed of seeds(120)) {
        const r = roundOf(l, seed);
        r.forEach((p, i) => { seen.add(p.rule); if (i > 0) expect(p.rule, `level ${l} seed ${seed}`).not.toBe(r[i - 1].rule); });
      }
      expect([...seen].sort()).toEqual([...RULES_BY_LEVEL[l]].sort());
    }
  });

  it('changes only the asked-about attribute on Little and Middle, and also varies the rest on Big', () => {
    expect(hasNoise(1)).toBe(false);
    expect(hasNoise(2)).toBe(false);
    expect(hasNoise(3)).toBe(true);
    for (const l of [1, 2] as Level[]) {
      for (const seed of seeds(100)) {
        for (const p of roundOf(l, seed)) {
          for (const a of attributesOf(p.cards[0].kind)) {
            if (a === RULE_ATTR[p.rule]) continue;
            expect(new Set(p.cards.map((c) => c[a])).size, `${p.rule} level ${l} ${a}`).toBe(1);
          }
        }
      }
    }
    let varied = 0;
    for (const seed of seeds(150)) {
      for (const p of roundOf(3, seed)) {
        if (p.cards[0].kind === 'emoji') continue;
        if (attributesOf(p.cards[0].kind).some((a) => a !== RULE_ATTR[p.rule] && new Set(p.cards.map((c) => c[a])).size > 1)) varied++;
      }
    }
    expect(varied).toBeGreaterThan(300);
  }, 30_000);

  it('uses only the stated ranges: Middle counts 1 to 6 at least 2 apart, Big counts 1 to 9, six shapes, six colours', () => {
    const middle = new Set<number>();
    const big = new Set<number>();
    const gaps = new Set<number>();
    for (const seed of seeds(300)) {
      for (const p of roundOf(2, seed)) {
        if (p.rule !== 'number') continue;
        const odd = p.cards[p.odd].count;
        const rest = p.cards[(p.odd + 1) % p.cards.length].count;
        expect(Math.abs(odd - rest)).toBeGreaterThanOrEqual(2);
        for (const c of p.cards) { expect(c.count).toBeGreaterThanOrEqual(1); expect(c.count).toBeLessThanOrEqual(6); middle.add(c.count); }
      }
      for (const p of roundOf(3, seed)) {
        if (p.rule !== 'number') continue;
        gaps.add(Math.abs(p.cards[p.odd].count - p.cards[(p.odd + 1) % p.cards.length].count));
        for (const c of p.cards) { expect(c.count).toBeGreaterThanOrEqual(1); expect(c.count).toBeLessThanOrEqual(9); big.add(c.count); }
      }
    }
    expect([...middle].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...big].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(gaps.has(1)).toBe(true);
    for (const seed of seeds(200)) {
      for (const l of LEVELS) for (const p of roundOf(l, seed)) for (const c of p.cards) {
        if (c.kind === 'emoji') continue;
        expect(c.colour).toBeGreaterThanOrEqual(0);
        expect(c.colour).toBeLessThan(6);
        if (c.kind === 'shape') { expect(c.shape).toBeGreaterThanOrEqual(0); expect(c.shape).toBeLessThan(6); expect([0, 1]).toContain(c.size); }
      }
    }
  }, 30_000);

  it('category puzzles take five or three from one category and one from another, never repeating a picture', () => {
    let seen = 0;
    for (const l of [2, 3] as Level[]) {
      for (const seed of seeds(200)) {
        for (const p of roundOf(l, seed)) {
          if (p.rule !== 'category') continue;
          seen++;
          const lookup = (emoji: string) => Object.entries(REFERENCE).find(([, list]) => list.some((s) => s.startsWith(`${emoji} `)))?.[0];
          const cats = p.cards.map((c) => lookup(c.emoji));
          expect(cats.every(Boolean)).toBe(true);
          const odd = cats[p.odd];
          const rest = cats.filter((_, i) => i !== p.odd);
          expect(new Set(rest).size).toBe(1);
          expect(rest[0]).not.toBe(odd);
          expect(new Set(p.cards.map((c) => c.emoji)).size).toBe(p.cards.length);
          for (const c of p.cards) expect(REFERENCE[lookup(c.emoji)!]).toContain(`${c.emoji} ${c.label}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(200);
  });

  it('labels every card with what it shows', () => {
    const colourWords = COLOURS.map((c) => c.name).join('|');
    for (const l of LEVELS) {
      for (const seed of seeds(60)) {
        for (const p of roundOf(l, seed)) {
          for (const c of p.cards) {
            if (c.kind === 'shape') expect(c.label).toMatch(new RegExp(`^(big|small) (${colourWords}) (${SHAPES.join('|')})$`));
            else if (c.kind === 'count') expect(c.label).toBe(`${c.count} ${COLOURS[c.colour].name} ${c.count === 1 ? 'dot' : 'dots'}`);
            else expect(REFERENCE[CATEGORIES[c.cat].id].some((s) => s.endsWith(` ${c.label}`))).toBe(true);
          }
        }
      }
    }
  });

  it('is fully decided by level and seed', () => {
    for (const l of LEVELS) {
      expect(roundOf(l, 31)).toEqual(roundOf(l, 31));
      expect(roundOf(l, 31)).not.toEqual(roundOf(l, 32));
    }
  });
  it('states its sizes as the page does', () => {
    expect(CARD_COUNT).toEqual({ 1: 4, 2: 6, 3: 6 });
    expect(ROUND_SIZE).toBe(8);
    expect(STEP_UP_AT).toBe(5);
    expect(MAX_LEVEL).toBe(3);
    expect(LEVEL_NAME).toEqual({ 1: 'Little', 2: 'Middle', 3: 'Big' });
  });
});

describe('explaining the answer', () => {
  const find = (level: Level, rule: Rule): Puzzle => {
    for (let s = 1; s < 4000; s++) {
      const p = makePuzzle(level, mulberry32(s));
      if (p.rule === rule) return p;
    }
    throw new Error(`no ${rule} puzzle`);
  };
  it('says why in plain words for every rule', () => {
    const col = find(1, 'colour');
    const oc = col.cards[col.odd];
    const rc = col.cards[(col.odd + 1) % 4];
    expect(explain(col)).toBe(`The ${COLOURS[oc.colour].name} one is a different colour. The others are ${COLOURS[rc.colour].name}.`);
    const sh = find(1, 'shape');
    expect(explain(sh)).toBe(`The ${SHAPES[sh.cards[sh.odd].shape]} is a different shape. The others are ${SHAPES[sh.cards[(sh.odd + 1) % 4].shape]}s.`);
    const sz = find(1, 'size');
    expect(explain(sz)).toMatch(/^The (big|small) one is a different size\. The others are (big|small)\.$/);
    expect(explain(sz).includes('The small one') ? explain(sz).endsWith('are big.') : explain(sz).endsWith('are small.')).toBe(true);
    const num = find(2, 'number');
    expect(explain(num)).toBe(`The group of ${num.cards[num.odd].count} is different. The others have ${num.cards[(num.odd + 1) % 6].count}.`);
    const cat = find(2, 'category');
    expect(explain(cat)).toMatch(/^The [a-z ]+ is (an animal|a vehicle|a fruit|a piece of clothing|a flower), but the others are (animals|vehicles|fruit|clothes|flowers)\.$/);
  });
  it('has a plain question for each rule', () => {
    expect(PROMPT.colour).toBe('Which one is a different colour?');
    expect(PROMPT.number).toBe('Which group has a different number?');
    expect(PROMPT.category).toBe('Which one does not belong?');
    for (const r of RULES) expect(PROMPT[r]).toMatch(/\?$/);
  });
});

describe('choosing', () => {
  const puzzle = makePuzzle(2, mulberry32(21));
  const wrong = puzzle.cards.map((_, i) => i).filter((i) => i !== puzzle.odd);

  it('the odd card solves it, first time if nothing was tried', () => {
    const r = choose(newTurn(puzzle), puzzle.odd);
    expect(r.result).toBe('right');
    expect(r.turn.solved).toBe(true);
    expect(firstTry(r.turn)).toBe(true);
  });
  it('another card is remembered, loses first time, and cannot be picked again', () => {
    const r = choose(newTurn(puzzle), wrong[0]);
    expect(r.result).toBe('wrong');
    expect(r.turn.tried).toEqual([wrong[0]]);
    expect(choose(r.turn, wrong[0]).turn).toBe(r.turn);
    expect(choose(r.turn, wrong[0]).result).toBe('ignored');
    const done = choose(r.turn, puzzle.odd).turn;
    expect(done.solved).toBe(true);
    expect(firstTry(done)).toBe(false);
  });
  it('ignores bad indexes and everything after it is solved', () => {
    const t = newTurn(puzzle);
    for (const bad of [-1, 6, 99, NaN, 1.5, Infinity]) expect(choose(t, bad).turn).toBe(t);
    const solved = choose(t, puzzle.odd).turn;
    expect(choose(solved, wrong[0]).turn).toBe(solved);
  });
  it('always leaves the odd card to find after every other card has been tried', () => {
    let t = newTurn(puzzle);
    for (const w of wrong) t = choose(t, w).turn;
    expect(t.tried).toHaveLength(puzzle.cards.length - 1);
    expect(choose(t, puzzle.odd).result).toBe('right');
  });
  it('random choosing over thousands of puzzles never throws and always solves', () => {
    for (let s = 1; s <= 3000; s++) {
      const rng = mulberry32(s);
      const p = makePuzzle(LEVELS[s % 3], rng);
      let t = newTurn(p);
      let guard = 0;
      while (!t.solved && guard++ < 500) t = choose(t, pickIndex(p.cards.length, rng)).turn;
      expect(t.solved).toBe(true);
      expect(t.tried).not.toContain(p.odd);
    }
  }, 30_000);
});

describe('words for the page', () => {
  it('never scolds, and every retry encourages', () => {
    for (let n = 0; n < 20; n++) {
      expect(praise(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).toMatch(/try|look|another/i);
    }
    expect(praise(-2)).toBeTruthy();
    expect(retry(NaN)).toBeTruthy();
    expect(plural(1, 'star', 'stars')).toBe('star');
    expect(plural(2, 'star', 'stars')).toBe('stars');
  });
  it('offers the next level after every fifth first-time find, never on the top level', () => {
    let s = 0;
    const offers: number[] = [];
    for (let i = 1; i <= 11; i++) { s = streakAfter(s, true); if (offersStepUp(s, 2)) offers.push(i); }
    expect(offers).toEqual([5, 10]);
    expect(streakAfter(8, false)).toBe(0);
    expect(offersStepUp(10, 3)).toBe(false);
    expect(offersStepUp(0, 1)).toBe(false);
  });
});

describe('saved record and share text', () => {
  it('reads junk as zero and builds a fresh object with only known keys', () => {
    expect(sanitiseSaved(null)).toEqual(emptySaved());
    for (const bad of [undefined, 1, 'x', [], [2], true]) expect(sanitiseSaved(bad)).toEqual(emptySaved());
    expect(sanitiseSaved({ stars: -3, rounds: 1.2, b1: NaN, b2: '2', b3: Infinity })).toEqual(emptySaved());
    const s = sanitiseSaved(JSON.parse('{"stars": 12, "rounds": 3, "b1": 100, "b2": 4, "b3": 0, "__proto__": {"z": 1}, "q": 2}'));
    expect(s).toEqual({ stars: 12, rounds: 3, b1: ROUND_SIZE, b2: 4, b3: 0 });
    expect(Object.keys(s).sort()).toEqual(['b1', 'b2', 'b3', 'rounds', 'stars']);
  });
  it('counts stars and rounds and keeps the best per level', () => {
    let s = addStar(emptySaved());
    s = recordRound(s, 2, 6);
    s = recordRound(s, 2, 3);
    expect(s).toEqual({ stars: 1, rounds: 2, b1: 0, b2: 6, b3: 0 });
    expect(bestFor(s, 2)).toBe(6);
    expect(recordRound(s, 3, 500).b3).toBe(ROUND_SIZE);
  });
  it('writes a correct copy line for new, partial and finished rounds', () => {
    for (const l of LEVELS) {
      for (const [stars, ft] of [[0, 0], [4, 3], [ROUND_SIZE, ROUND_SIZE], [ROUND_SIZE, 99], [1, 6]] as const) {
        const t = shareLine(l, stars, ft);
        expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
        expect(t).toContain(LEVEL_NAME[l]);
        expect(t).toContain(`${stars} of ${ROUND_SIZE} stars`);
      }
    }
    expect(shareLine(1, 1, 6)).toContain('1 found first time');
  });
});

describe('page source', () => {
  const src = calculatorSource.replace(/\r\n?/g, '\n');
  it('has a 32 px how-it-works heading with the native marker', () => {
    const rule = src.match(/\.oo-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
  it('keeps every button and card at least 56 px tall', () => {
    expect(src).toMatch(/\.oo-actions button, #oo-app \.oo-btnrow button \{ min-height: 3\.5rem; \}/);
    expect(src).toMatch(/\.oo-card \{\s*position: relative; min-height: 5\.75rem/);
    expect(src).toMatch(/\.oo-lvl \{\s*min-height: 3\.5rem/);
  });
  it('has no timers and no sound, and writes only text', () => {
    expect(src).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|AudioContext|speechSynthesis/);
    expect(src).not.toMatch(/innerHTML|insertAdjacentHTML/);
  });
  it('prints the colour letter on every coloured shape', () => {
    expect(src).toContain('COLOURS[c.colour].letter');
  });
});

