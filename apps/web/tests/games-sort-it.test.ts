/**
 * games-sort-it.test.ts - the engine behind `sort-it`.
 *
 * Pinned: every sorting game's facts match a separately typed reference table (which thing
 * belongs in which bin), no thing is in two bins, no disputed item is on a list (tomato,
 * corn, duck as a swimmer or flyer, a dog as big or small...), every picture is a colour emoji;
 * the even-or-odd game is checked with bit arithmetic; every generated puzzle uses the stated
 * number of things per bin, only things from its own sort, each in its true bin; a round plays
 * every sorting game of a level once before repeating one and never the same twice running;
 * a round is decided by its seed; the placing state machine only accepts a thing in its true
 * bin, counts wrong bins, never loses or duplicates a thing and finishes exactly when the tray
 * is empty; the sanitisers reject junk; the cheers never scold.
 */
import { describe, it, expect } from 'vitest';
import {
  SORTS, LEVELS, LEVEL_NAME, ROUND_SIZE, STEP_UP_AT, PER_BIN, NUMBER_MAX, MAX_LEVEL,
  mulberry32, pickIndex, shuffle, roundRng, sanitiseSeed, sanitiseLevel, sortsForLevel, perBin, makePuzzle,
  newGame, remainingCount, isComplete, binCount, perfect, place, placedSentence, summaryText, praise, retry, plural,
  streakAfter, offersStepUp, binForKey, emptySaved, sanitiseSaved, bestFor, addStar, recordRound, shareLine,
  type Level, type Puzzle, type SortId,
} from '../src/components/apps-private/sort-it/helpers';
import calculatorSource from '../src/components/apps-private/sort-it/Calculator.astro?raw';

/** Typed again on purpose, apart from the lists in helpers.ts: sort | bin | emoji name; emoji name; ... */
const REFERENCE = `
size|big|🐘 elephant;🐳 whale;🦒 giraffe;🚌 bus;🏠 house;🌳 tree;🚢 ship;🚆 train;🚚 truck;🐴 horse;🐄 cow;⛰️ mountain;🦏 rhino;✈️ plane
size|small|🐜 ant;🐝 bee;🐞 ladybug;🐌 snail;🔑 key;🥚 egg;🍒 cherry;🍓 strawberry;🦋 butterfly;🐭 mouse;✏️ pencil;💍 ring;📎 paperclip;🍎 apple
weight|light|🎈 balloon;🍃 leaf;📄 paper;🦋 butterfly;🎀 ribbon;🌷 tulip;✉️ envelope;🧦 sock
weight|heavy|🐘 elephant;🚗 car;🚌 bus;🚚 truck;🚆 train;🐳 whale;🚢 ship;🏠 house;🦏 rhino;🐄 cow
float|float|⛵ boat;🛶 canoe;🦆 duck;🍃 leaf;⚽ ball;🍎 apple;🏀 basketball
float|sink|🔑 key;⚓ anchor;🔨 hammer;🔔 bell;🔩 nut and bolt;💎 gem;🧱 brick;🥄 spoon;🔧 wrench;💍 ring
plant|fruit|🍎 apple;🍌 banana;🍇 grape;🍓 strawberry;🍒 cherry;🍑 peach;🍍 pineapple;🍉 watermelon;🍋 lemon;🍐 pear;🥝 kiwi;🍊 orange
plant|veg|🥕 carrot;🥔 potato;🥦 broccoli;🥬 lettuce;🍠 sweet potato
move|walk|🐘 elephant;🦒 giraffe;🦁 lion;🐴 horse;🐄 cow;🦓 zebra;🐫 camel;🐶 dog;🐱 cat;🐷 pig;🐑 sheep;🐻 bear;🐯 tiger
move|swim|🐟 fish;🐳 whale;🐬 dolphin;🐙 octopus;🦑 squid;🦐 shrimp;🐠 tropical fish;🐡 blowfish
move|fly|🦅 eagle;🦉 owl;🐝 bee;🦋 butterfly;🦇 bat;🦜 parrot;🐦 bird;🕊️ dove
`;
const FACT = new Map<string, Map<string, string[]>>();
for (const line of REFERENCE.split('\n').map((l) => l.trim()).filter(Boolean)) {
  const [sort, bin, items] = line.split('|');
  if (!FACT.has(sort)) FACT.set(sort, new Map());
  FACT.get(sort)!.set(bin, items.split(';'));
}
/** Where a thing belongs according to the reference table, or undefined. */
const truth = (sort: string, pic: string, name: string): string | undefined => {
  for (const [bin, list] of FACT.get(sort) ?? []) if (list.includes(`${pic} ${name}`)) return bin;
  return undefined;
};

const seeds = (n: number, from = 1) => Array.from({ length: n }, (_, i) => from + i * 104729);

const roundOf = (level: Level, seed: number): Puzzle[] => {
  const used: SortId[] = [];
  return Array.from({ length: ROUND_SIZE }, (_, i) => {
    const p = makePuzzle(level, roundRng(seed, i), used);
    used.push(p.sortId);
    return p;
  });
};

describe('the sorting games', () => {
  it('are the six the page describes, each with a title that is a question and 2 or 3 bins', () => {
    expect(SORTS.map((s) => s.id)).toEqual(['size', 'weight', 'float', 'plant', 'move', 'parity']);
    for (const s of SORTS) {
      expect(s.title).toMatch(/\?$/);
      expect(s.hint.length).toBeGreaterThan(10);
      expect([2, 3]).toContain(s.bins.length);
      expect(new Set(s.bins.map((b) => b.id)).size).toBe(s.bins.length);
      expect(new Set(s.bins.map((b) => b.label)).size).toBe(s.bins.length);
      for (const b of s.bins) expect(b.phrase.length).toBeGreaterThan(2);
    }
    expect(SORTS.find((s) => s.id === 'move')!.bins).toHaveLength(3);
  });
  it('are played at the levels the page states', () => {
    const by = (id: string) => SORTS.find((s) => s.id === id)!.levels;
    expect(by('size')).toEqual([1, 2]);
    expect(by('weight')).toEqual([1]);
    expect(by('float')).toEqual([2, 3]);
    expect(by('plant')).toEqual([2, 3]);
    expect(by('move')).toEqual([2, 3]);
    expect(by('parity')).toEqual([2, 3]);
    expect(sortsForLevel(1).map((s) => s.id)).toEqual(['size', 'weight']);
    expect(sortsForLevel(2)).toHaveLength(5);
    expect(sortsForLevel(3).map((s) => s.id)).toEqual(['float', 'plant', 'move', 'parity']);
  });
  it('match the separately typed reference table exactly, bin by bin', () => {
    for (const s of SORTS.filter((x) => x.kind === 'pictures')) {
      const ref = FACT.get(s.id)!;
      expect([...ref.keys()], s.id).toEqual(s.bins.map((b) => b.id));
      for (const b of s.bins) {
        expect(s.things.filter((t) => t.bin === b.id).map((t) => `${t.pic} ${t.name}`), `${s.id}/${b.id}`).toEqual(ref.get(b.id));
      }
      expect(s.things.length).toBe([...ref.values()].reduce((n, l) => n + l.length, 0));
    }
    expect(SORTS.find((s) => s.id === 'parity')!.things).toEqual([]);
  });
  it('hold the 109 pictures the content page states: 28, 18, 17, 17 and 29 in the five picture games', () => {
    const count = (id: string) => SORTS.find((s) => s.id === id)!.things.length;
    expect([count('size'), count('weight'), count('float'), count('plant'), count('move')]).toEqual([28, 18, 17, 17, 29]);
    expect(SORTS.reduce((n, s) => n + s.things.length, 0)).toBe(109);
  });
  it('never put a thing in two bins of the same game, or list a picture or name twice', () => {
    for (const s of SORTS) {
      expect(new Set(s.things.map((t) => t.pic)).size, `${s.id} pictures`).toBe(s.things.length);
      expect(new Set(s.things.map((t) => t.name)).size, `${s.id} names`).toBe(s.things.length);
      for (const t of s.things) expect(s.bins.some((b) => b.id === t.bin)).toBe(true);
    }
  });
  it('have enough things in every bin for the largest puzzle at every level they are played', () => {
    for (const s of SORTS.filter((x) => x.kind === 'pictures')) {
      for (const l of s.levels) {
        const need = perBin(s, l);
        expect(need, `${s.id} level ${l}`).toBeGreaterThan(0);
        for (const b of s.bins) expect(s.things.filter((t) => t.bin === b.id).length, `${s.id}/${b.id} level ${l}`).toBeGreaterThanOrEqual(need);
      }
    }
    expect(PER_BIN).toEqual({ 2: { 1: 2, 2: 3, 3: 4 }, 3: { 2: 2, 3: 3 } });
    expect(NUMBER_MAX).toEqual({ 2: 10, 3: 20 });
    // the number game needs per-bin things from half of 1..max
    expect(NUMBER_MAX[2]! / 2).toBeGreaterThanOrEqual(perBin(SORTS.find((s) => s.id === 'parity')!, 2));
    expect(NUMBER_MAX[3]! / 2).toBeGreaterThanOrEqual(perBin(SORTS.find((s) => s.id === 'parity')!, 3));
  });
  it('leave out every item people argue about', () => {
    const names = (id: string) => SORTS.find((s) => s.id === id)!.things.map((t) => t.name);
    for (const bad of ['tomato', 'cucumber', 'pepper', 'pumpkin', 'avocado', 'mushroom', 'corn', 'peas', 'olive', 'eggplant', 'aubergine', 'squash']) {
      expect(names('plant'), bad).not.toContain(bad);
    }
    for (const bad of ['duck', 'frog', 'turtle', 'penguin', 'crab', 'swan', 'goose', 'ostrich', 'kangaroo', 'rabbit', 'monkey', 'bird of prey']) {
      expect(names('move'), bad).not.toContain(bad);
    }
    for (const bad of ['dog', 'cat', 'book', 'bread', 'cloud', 'egg', 'orange', 'lemon', 'ship']) {
      expect(names('float'), bad).not.toContain(bad);
    }
    for (const bad of ['dog', 'cat', 'book', 'bread', 'rock', 'bag', 'box', 'hammer', 'bell']) {
      expect([...names('weight'), ...names('size')], bad).not.toContain(bad);
    }
  });
  it('use only common, safe, colour emoji from the 2018 set or older', () => {
    const scary = ['snake', 'spider', 'shark', 'ghost', 'gun', 'knife', 'bomb', 'skull', 'beer', 'wine', 'devil', 'sword', 'axe'];
    for (const s of SORTS) {
      for (const t of s.things) {
        expect([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t.pic)], `${s.id} ${t.name}`).toHaveLength(1);
        expect(t.pic, `${s.id} ${t.name}`).toMatch(/^(\p{Emoji_Presentation}|\p{Emoji}️)$/u);
        expect(t.pic.codePointAt(0)!).toBeLessThan(0x1fa70);
        expect(t.name).toMatch(/^[a-z ]+$/);
        expect(scary.some((w) => t.name.includes(w))).toBe(false);
      }
    }
    for (const bad of ['🐍', '🕷️', '🦈', '🔫', '🔪', '💣', '💀', '👻', '🍺', '🍷', '🍅', '🍆', '🌽', '🥒', '🍄', '🥑', '🗡️', '🪓']) {
      expect(SORTS.some((s) => s.things.some((t) => t.pic === bad)), bad).toBe(false);
    }
  });
  it('know what a name looks like when it has two words, and say it correctly in a sentence', () => {
    const names = SORTS.flatMap((s) => s.things.map((t) => t.name));
    expect(names).toContain('nut and bolt');
    expect(names).toContain('sweet potato');
    expect(names).toContain('tropical fish');
  });
});

describe('seeded randomness helpers', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(8);
    const b = mulberry32(8);
    for (let i = 0; i < 500; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('pickIndex stays in range for a bad rng; shuffle keeps everything once', () => {
    for (const r of [0, 1, -2, NaN, Infinity, 0.9999]) { const i = pickIndex(5, () => r); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThanOrEqual(4); }
    const src = [1, 2, 3, 4, 5];
    expect([...shuffle(src, mulberry32(2))].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
  it('roundRng, sanitiseSeed and sanitiseLevel', () => {
    expect(roundRng(7, 0)()).toBe(roundRng(7, 0)());
    expect(roundRng(7, 0)()).not.toBe(roundRng(7, 1)());
    expect(sanitiseSeed(33)).toBe(33);
    for (const bad of [0, -9, 0.5, NaN, 2 ** 32, '1', null, undefined, [], {}]) expect(sanitiseSeed(bad)).toBe(0);
    expect(sanitiseLevel(2)).toBe(2);
    for (const bad of [0, 4, 1.1, '3', null, NaN, [], {}]) expect(sanitiseLevel(bad)).toBe(1);
  });
});

describe('puzzles', () => {
  it('use the stated number of things per bin, only things from their own sort, each in its true bin', () => {
    let n = 0;
    for (const l of LEVELS) {
      for (const seed of seeds(120)) {
        for (const p of roundOf(l, seed)) {
          n++;
          const sort = SORTS.find((s) => s.id === p.sortId)!;
          expect(sort.levels).toContain(l);
          expect(p.title).toBe(sort.title);
          expect(p.bins).toEqual(sort.bins);
          const per = sort.bins.length === 3 ? PER_BIN[3][l] : PER_BIN[2][l];
          expect(p.things).toHaveLength(per! * sort.bins.length);
          for (const b of sort.bins) expect(p.things.filter((t) => t.bin === b.id), `${p.sortId}/${b.id}`).toHaveLength(per!);
          expect(new Set(p.things.map((t) => t.pic)).size).toBe(p.things.length);
          for (const t of p.things) {
            if (p.kind === 'numbers') {
              const v = Number(t.pic);
              expect(Number.isInteger(v) && v >= 1 && v <= NUMBER_MAX[l]!).toBe(true);
              expect(t.bin).toBe((v & 1) === 0 ? 'even' : 'odd');
              expect(t.name).toBe(t.pic);
            } else {
              expect(truth(p.sortId, t.pic, t.name), `${p.sortId} ${t.name}`).toBe(t.bin);
            }
          }
        }
      }
    }
    expect(n).toBe(3 * 120 * ROUND_SIZE);
  }, 60_000);

  it('mixes the things up: on the Big level they are rarely lined up bin by bin', () => {
    let grouped = 0;
    let total = 0;
    for (const seed of seeds(200)) {
      for (const p of roundOf(3, seed)) {
        total++;
        const order = p.things.map((t) => t.bin);
        const runs = order.filter((bin, i) => i === 0 || bin !== order[i - 1]).length;
        if (runs === new Set(order).size) grouped++;
      }
    }
    expect(grouped / total).toBeLessThan(0.1);
  });

  it('play every sorting game of a level once before any repeats, and never the same twice running', () => {
    for (const l of LEVELS) {
      const n = sortsForLevel(l).length;
      for (const seed of seeds(120)) {
        const r = roundOf(l, seed);
        const first = r.slice(0, Math.min(n, ROUND_SIZE)).map((p) => p.sortId);
        expect(new Set(first).size, `level ${l} seed ${seed}`).toBe(first.length);
        r.forEach((p, i) => { if (i > 0) expect(p.sortId).not.toBe(r[i - 1].sortId); });
      }
    }
  });
  it('shows every sorting game of a level over many seeds', () => {
    for (const l of LEVELS) {
      const seen = new Set<string>();
      for (const seed of seeds(80)) for (const p of roundOf(l, seed)) seen.add(p.sortId);
      expect([...seen].sort()).toEqual(sortsForLevel(l).map((s) => s.id).sort());
    }
  });
  it('is fully decided by level and seed', () => {
    for (const l of LEVELS) {
      expect(roundOf(l, 55)).toEqual(roundOf(l, 55));
      expect(roundOf(l, 55)).not.toEqual(roundOf(l, 56));
    }
  });
  it('covers all the things of every list over many seeds (nothing is unreachable)', () => {
    const seen = new Set<string>();
    for (const l of LEVELS) for (const seed of seeds(400)) for (const p of roundOf(l, seed)) for (const t of p.things) seen.add(`${p.sortId}:${t.name}`);
    for (const s of SORTS.filter((x) => x.kind === 'pictures')) for (const t of s.things) expect(seen.has(`${s.id}:${t.name}`), `${s.id} ${t.name}`).toBe(true);
    for (let v = 1; v <= 20; v++) expect(seen.has(`parity:${v}`), `parity ${v}`).toBe(true);
  }, 60_000);
  it('states its sizes as the page does', () => {
    expect(ROUND_SIZE).toBe(4);
    expect(STEP_UP_AT).toBe(5);
    expect(MAX_LEVEL).toBe(3);
    expect(LEVEL_NAME).toEqual({ 1: 'Little', 2: 'Middle', 3: 'Big' });
  });
});

describe('placing things', () => {
  const puzzle = makePuzzle(2, mulberry32(14), []);
  const otherBin = (bin: string) => puzzle.bins.find((b) => b.id !== bin)!.id;

  it('starts with every thing in the tray and no mistakes', () => {
    const g = newGame(puzzle);
    expect(g.placed.every((p) => p === null)).toBe(true);
    expect(remainingCount(g)).toBe(puzzle.things.length);
    expect(isComplete(g)).toBe(false);
    expect(perfect(g)).toBe(false);
    expect(g.mistakes).toBe(0);
  });
  it('a thing goes into its true bin and stays there, first time if it never slipped', () => {
    const g = newGame(puzzle);
    const r = place(g, 0, puzzle.things[0].bin);
    expect(r.move).toBe('placed');
    expect(r.firstTime).toBe(true);
    expect(r.game.placed[0]).toBe(puzzle.things[0].bin);
    expect(remainingCount(r.game)).toBe(puzzle.things.length - 1);
    expect(binCount(r.game, puzzle.things[0].bin)).toBe(1);
    expect(g.placed[0]).toBeNull();
  });
  it('the wrong bin is counted, the thing stays in the tray, and the later right bin is not first time', () => {
    const g = newGame(puzzle);
    const w = place(g, 1, otherBin(puzzle.things[1].bin));
    expect(w.move).toBe('wrong');
    expect(w.firstTime).toBe(false);
    expect(w.game.mistakes).toBe(1);
    expect(w.game.placed[1]).toBeNull();
    expect(w.game.slipped[1]).toBe(true);
    expect(g.mistakes).toBe(0);
    const r = place(w.game, 1, puzzle.things[1].bin);
    expect(r.move).toBe('placed');
    expect(r.firstTime).toBe(false);
  });
  it('ignores a bad index, an unknown bin and a thing that is already placed, returning the same object', () => {
    const g = place(newGame(puzzle), 0, puzzle.things[0].bin).game;
    for (const bad of [-1, 99, 1.5, NaN, Infinity]) expect(place(g, bad, puzzle.bins[0].id).game, String(bad)).toBe(g);
    for (const bad of ['', 'nope', '__proto__', 5 as unknown as string, null as unknown as string]) expect(place(g, 1, bad).game, String(bad)).toBe(g);
    const again = place(g, 0, puzzle.things[0].bin);
    expect(again.move).toBe('ignored');
    expect(again.game).toBe(g);
    expect(place(g, 0, otherBin(puzzle.things[0].bin)).move).toBe('ignored');
  });
  it('finishes exactly when the tray is empty, perfect only with no wrong bin', () => {
    let g = newGame(puzzle);
    puzzle.things.forEach((t, i) => { g = place(g, i, t.bin).game; });
    expect(isComplete(g)).toBe(true);
    expect(perfect(g)).toBe(true);
    let h = place(newGame(puzzle), 0, otherBin(puzzle.things[0].bin)).game;
    puzzle.things.forEach((t, i) => { h = place(h, i, t.bin).game; });
    expect(isComplete(h)).toBe(true);
    expect(perfect(h)).toBe(false);
    for (const b of puzzle.bins) expect(binCount(g, b.id)).toBe(puzzle.things.filter((t) => t.bin === b.id).length);
  });
  it('random placing over thousands of puzzles never throws, loses or duplicates a thing, and always finishes', () => {
    for (let s = 1; s <= 3000; s++) {
      const rng = mulberry32(s);
      const p = makePuzzle(LEVELS[s % 3], rng);
      let g = newGame(p);
      let guard = 0;
      let wrongs = 0;
      while (!isComplete(g) && guard++ < 2000) {
        const i = pickIndex(p.things.length, rng);
        const bin = p.bins[pickIndex(p.bins.length, rng)].id;
        const before = g;
        const r = place(g, i, bin);
        g = r.game;
        if (r.move === 'wrong') { wrongs++; expect(g.placed).toEqual(before.placed); }
        if (r.move === 'placed') expect(p.things[i].bin).toBe(bin);
        expect(remainingCount(g) + g.placed.filter((x) => x !== null).length).toBe(p.things.length);
        expect(p.bins.reduce((n, b) => n + binCount(g, b.id), 0)).toBe(p.things.length - remainingCount(g));
      }
      expect(isComplete(g)).toBe(true);
      expect(g.mistakes).toBe(wrongs);
      g.placed.forEach((where, i) => expect(where).toBe(p.things[i].bin));
    }
  }, 30_000);
});

describe('words for the page', () => {
  it('says why each kind of thing goes where it does, in plain words', () => {
    const find = (id: SortId, level: Level): Puzzle => {
      for (let s = 1; s < 2000; s++) { const p = makePuzzle(level, mulberry32(s)); if (p.sortId === id) return p; }
      throw new Error(`no ${id}`);
    };
    const size = find('size', 1);
    const t0 = size.things[0];
    expect(placedSentence(size, 0)).toBe(`The ${t0.name} ${t0.bin === 'big' ? 'is big' : 'is small'}.`);
    const par = find('parity', 2);
    expect(placedSentence(par, 0)).toBe(`${par.things[0].name} is ${par.things[0].bin}.`);
    const mv = find('move', 2);
    for (let i = 0; i < mv.things.length; i++) {
      const bin = mv.things[i].bin;
      expect(placedSentence(mv, i)).toBe(`The ${mv.things[i].name} ${bin === 'walk' ? 'walks or runs' : bin === 'swim' ? 'swims' : 'flies'}.`);
    }
    const fl = find('float', 2);
    for (let i = 0; i < fl.things.length; i++) expect(placedSentence(fl, i)).toMatch(/^The [a-z ]+ (floats|sinks)\.$/);
    const pl = find('plant', 3);
    for (let i = 0; i < pl.things.length; i++) expect(placedSentence(pl, i)).toMatch(/^The [a-z ]+ is a (fruit|vegetable)\.$/);
  });
  it('sums up a finished game by bin', () => {
    const p = makePuzzle(1, mulberry32(3), []);
    let g = newGame(p);
    p.things.forEach((t, i) => { g = place(g, i, t.bin).game; });
    expect(summaryText(g)).toBe(`2 in ${p.bins[0].label} and 2 in ${p.bins[1].label}.`);
    const three = makePuzzle(3, mulberry32(1), ['float', 'plant', 'parity']);
    expect(three.sortId).toBe('move');
    let g3 = newGame(three);
    three.things.forEach((t, i) => { g3 = place(g3, i, t.bin).game; });
    expect(summaryText(g3)).toBe(`3 in ${three.bins[0].label}, 3 in ${three.bins[1].label} and 3 in ${three.bins[2].label}.`);
    expect(summaryText(newGame(p))).toBe(`0 in ${p.bins[0].label} and 0 in ${p.bins[1].label}.`);
  });
  it('never scolds', () => {
    for (let n = 0; n < 20; n++) {
      expect(praise(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).toMatch(/try|go|another|other/i);
    }
    expect(praise(-2)).toBeTruthy();
    expect(retry(NaN)).toBeTruthy();
    expect(plural(1, 'star', 'stars')).toBe('star');
    expect(plural(4, 'star', 'stars')).toBe('stars');
  });
  it('offers the next level after every fifth first-time placement, never on the top level', () => {
    let s = 0;
    const offers: number[] = [];
    for (let i = 1; i <= 11; i++) { s = streakAfter(s, true); if (offersStepUp(s, 1)) offers.push(i); }
    expect(offers).toEqual([5, 10]);
    expect(streakAfter(7, false)).toBe(0);
    expect(offersStepUp(5, 3)).toBe(false);
    expect(offersStepUp(0, 1)).toBe(false);
  });
  it('maps number keys to bins only while that bin is on screen', () => {
    expect(binForKey('1', 2)).toBe(0);
    expect(binForKey('2', 2)).toBe(1);
    expect(binForKey('3', 2)).toBeNull();
    expect(binForKey('3', 3)).toBe(2);
    for (const bad of ['0', 'a', '', '10', '12', ' ', 'Enter', 3 as unknown as string, null as unknown as string]) expect(binForKey(bad, 3), String(bad)).toBeNull();
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
    s = recordRound(s, 1, 3);
    s = recordRound(s, 1, 1);
    expect(s).toEqual({ stars: 1, rounds: 2, b1: 3, b2: 0, b3: 0 });
    expect(bestFor(s, 1)).toBe(3);
    expect(recordRound(s, 2, 99).b2).toBe(ROUND_SIZE);
  });
  it('writes a correct copy line for new, partial and finished rounds', () => {
    for (const l of LEVELS) {
      for (const [stars, ft] of [[0, 0], [2, 1], [ROUND_SIZE, ROUND_SIZE], [ROUND_SIZE, 50], [1, 4]] as const) {
        const t = shareLine(l, stars, ft);
        expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
        expect(t).toContain(LEVEL_NAME[l]);
        expect(t).toContain(`${stars} of ${ROUND_SIZE} stars`);
        expect(t).toContain('sorted with no slips');
      }
    }
    expect(shareLine(1, 1, 4)).toContain('1 sorted with no slips');
  });
});

describe('page source', () => {
  const src = calculatorSource.replace(/\r\n?/g, '\n');
  it('has a 32 px how-it-works heading with the native marker', () => {
    const rule = src.match(/\.si-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
  it('keeps every button, thing and bin at least 56 px tall', () => {
    expect(src).toMatch(/\.si-actions button, #si-app \.si-btnrow button \{ min-height: 3\.5rem; \}/);
    expect(src).toMatch(/\.si-item \{\s*position: relative; min-height: 5\.25rem/);
    expect(src).toMatch(/\.si-bin \{\s*--c: var\(--si-b0\); position: relative; min-height: 7\.5rem/);
    expect(src).toMatch(/\.si-lvl \{\s*min-height: 3\.5rem/);
  });
  it('drags only with a mouse or pen, so touch keeps scrolling, and finds the bin by position', () => {
    expect(src).toMatch(/e\.pointerType !== 'mouse' && e\.pointerType !== 'pen'/);
    expect(src).toContain('elementsFromPoint');
    expect(src).toContain("document.addEventListener('pointercancel'");
  });
  it('has no timers and no sound, and writes only text', () => {
    expect(src).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|AudioContext|speechSynthesis/);
    expect(src).not.toMatch(/innerHTML|insertAdjacentHTML/);
  });
});
