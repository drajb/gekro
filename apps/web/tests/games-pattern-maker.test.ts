/**
 * games-pattern-maker.test.ts - the engine behind `pattern-maker`.
 *
 * Pinned: the six pieces each have their own shape AND colour; every generated shape puzzle
 * is a repeating unit of the stated rule with exactly one piece that fits the gap (checked by
 * an independent brute-force period test), every wrong option fails that test, options are
 * unique and contain the answer once; every number puzzle has a steady step of 1, 2, 3, 5 or
 * 10 with exactly one number that keeps it steady and no negative numbers; levels produce
 * exactly the rules the page describes; a round is decided by its seed and does not repeat a
 * plan back to back; the choice state machine counts wrong picks and finishes on the right
 * one; "make your own" calls a row a pattern exactly when it repeats with at least two
 * different pieces; the sanitisers reject junk; the cheers never scold.
 */
import { describe, it, expect } from 'vitest';
import {
  ITEMS, LEVELS, LEVEL_NAME, ROUND_SIZE, STEP_UP_AT, OPTION_COUNT, OWN_MAX, MAX_LEVEL, MODES,
  mulberry32, pickIndex, shuffle, roundRng, sanitiseSeed, sanitiseLevel, sanitiseMode, itemName,
  hasPeriod, minimalPeriod, fillers, stepFillers, makePuzzle, rulesForLevel, planCount, unitOf, explain, describeRow, optionLabel,
  newTurn, choose, firstTry, addOwn, takeBackOwn, analyseOwn, ownMessage, ownRowText, ownShareLine,
  praise, retry, plural, streakAfter, offersStepUp,
  emptySaved, sanitiseSaved, bestFor, addStar, recordRound, shareLine,
  type Puzzle, type Level,
} from '../src/components/apps-private/pattern-maker/helpers';
import calculatorSource from '../src/components/apps-private/pattern-maker/Calculator.astro?raw';

const IDS = ITEMS.map((i) => i.id);

/** Independent oracle: does the row repeat with some period up to half its length? */
const repeatsBrute = (row: readonly number[]): boolean => {
  for (let q = 1; 2 * q <= row.length; q++) {
    const head = row.slice(0, row.length - q).join(',');
    const tail = row.slice(q).join(',');
    if (head === tail) return true;
  }
  return false;
};
const fitsBrute = (p: Puzzle, c: number): boolean => repeatsBrute(p.cells.map((v, i) => (i === p.hole ? c : v)));
const steadyBrute = (row: readonly number[]): boolean => {
  const d = row[1] - row[0];
  if (d === 0) return false;
  for (let i = 2; i < row.length; i++) if (row[i] - row[i - 1] !== d) return false;
  return true;
};

const seeds = (n: number, from = 1) => Array.from({ length: n }, (_, i) => from + i * 104729);

const roundOf = (level: Level, seed: number): Puzzle[] => {
  const recent: string[] = [];
  return Array.from({ length: ROUND_SIZE }, (_, i) => {
    const p = makePuzzle(level, roundRng(seed, i), recent);
    recent.push(p.plan);
    return p;
  });
};

describe('the pieces', () => {
  it('are six, each with its own shape and its own colour, so colour is never the only cue', () => {
    expect(ITEMS).toHaveLength(6);
    expect(new Set(ITEMS.map((i) => i.shape)).size).toBe(6);
    expect(new Set(ITEMS.map((i) => i.colour)).size).toBe(6);
    expect(new Set(ITEMS.map((i) => i.name)).size).toBe(6);
    ITEMS.forEach((it, n) => {
      expect(it.id).toBe(n);
      expect(it.name).toBe(`${it.colour} ${it.shape}`);
    });
  });
  it('names a piece, and says unknown for a bad id', () => {
    expect(itemName(0)).toBe('blue circle');
    for (const bad of [-1, 6, 1.5, NaN, Infinity]) expect(itemName(bad)).toBe('unknown');
  });
});

describe('seeded randomness helpers', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 500; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('pickIndex stays in range for a bad rng, and shuffle keeps everything once', () => {
    for (const r of [0, 1, -2, NaN, Infinity, 0.9999]) { const i = pickIndex(4, () => r); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThanOrEqual(3); }
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src, mulberry32(3));
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('roundRng, sanitiseSeed, sanitiseLevel and sanitiseMode', () => {
    expect(roundRng(9, 2)()).toBe(roundRng(9, 2)());
    expect(roundRng(9, 2)()).not.toBe(roundRng(9, 3)());
    expect(sanitiseSeed(12)).toBe(12);
    for (const bad of [0, -4, 2.5, NaN, 2 ** 32, '5', null, undefined, [], {}]) expect(sanitiseSeed(bad)).toBe(0);
    expect(sanitiseLevel(2)).toBe(2);
    for (const bad of [0, 4, 1.5, '1', null, NaN, [], {}]) expect(sanitiseLevel(bad)).toBe(1);
    expect(MODES).toEqual(['continue', 'own']);
    expect(sanitiseMode('own')).toBe('own');
    for (const bad of ['', 'x', 'OWN', 1, null, undefined, {}, '__proto__']) expect(sanitiseMode(bad)).toBe('continue');
  });
});

describe('periods: the rule that decides a shape pattern', () => {
  it('hasPeriod and minimalPeriod agree with a brute-force check on every row of up to 9 cells over 3 symbols', () => {
    let checked = 0;
    for (let len = 0; len <= 9; len++) {
      const total = 3 ** len;
      for (let n = 0; n < total; n++) {
        const row: number[] = [];
        let x = n;
        for (let i = 0; i < len; i++) { row.push(x % 3); x = Math.floor(x / 3); }
        expect(hasPeriod(row), row.join('')).toBe(repeatsBrute(row));
        const q = minimalPeriod(row);
        expect(q > 0, row.join('')).toBe(repeatsBrute(row));
        if (q > 0) {
          expect(2 * q).toBeLessThanOrEqual(row.length);
          for (let k = 1; k < q; k++) expect(row.slice(k).join(',') === row.slice(0, row.length - k).join(','), `${row.join('')} smaller period ${k}`).toBe(false);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(29000);
  });
  it('knows plain examples', () => {
    expect(hasPeriod([0, 1, 0, 1])).toBe(true);
    expect(hasPeriod([0, 1, 0, 2])).toBe(false);
    expect(hasPeriod([0])).toBe(false);
    expect(hasPeriod([])).toBe(false);
    expect(minimalPeriod([0, 0, 1, 0, 0, 1, 0])).toBe(3);
  });
  it('fillers lists exactly the pieces that make the row repeat', () => {
    expect(fillers([0, 1, 0, 1, 0, 1, -1], 6, IDS)).toEqual([0]);
    expect(fillers([0, 0, 1, 0, 0, 1, 0, -1], 7, IDS)).toEqual([0]);
    expect(stepFillers([2, 4, 6, 8, -1], 4, [9, 10, 11])).toEqual([10]);
    expect(stepFillers([5, 5, 5, -1], 3, [5])).toEqual([]);
  });
});

describe('shape puzzles', () => {
  const RULE_LETTERS: Record<string, string> = {};
  for (const l of LEVELS) for (const r of rulesForLevel(l)) if (r !== 'numbers') RULE_LETTERS[r] = r;

  it('every puzzle is the stated repeating unit, with one piece that fits and every other option failing', () => {
    let n = 0;
    for (const l of LEVELS) {
      for (const seed of seeds(120)) {
        for (const p of roundOf(l, seed)) {
          if (p.kind !== 'shapes') continue;
          n++;
          // the unit follows the rule: equal letters = equal pieces, different letters = different pieces
          const unit = p.rule;
          const letters = [...new Set(unit)];
          const pieces = letters.map((ch) => p.cells[unit.indexOf(ch)]);
          expect(new Set(pieces).size, p.rule).toBe(letters.length);
          p.cells.forEach((c, i) => expect(c).toBe(pieces[letters.indexOf(unit[i % unit.length])]));
          // exactly one piece fits, it is the answer, and the row's smallest period is the rule length
          const fit = IDS.filter((c) => fitsBrute(p, c));
          expect(fit, `${p.rule} hole ${p.hole}`).toEqual([p.answer]);
          expect(p.answer).toBe(p.cells[p.hole]);
          expect(minimalPeriod(p.cells)).toBe(unit.length);
          // at least two full units are visible, so the unit can be read
          expect(p.cells.length - 1).toBeGreaterThanOrEqual(2 * unit.length);
          // options
          expect(p.options).toHaveLength(OPTION_COUNT[l]);
          expect(new Set(p.options).size).toBe(p.options.length);
          expect(p.options.filter((o) => o === p.answer)).toHaveLength(1);
          for (const o of p.options) {
            expect(IDS).toContain(o);
            if (o !== p.answer) expect(fitsBrute(p, o), `wrong option ${o} fits`).toBe(false);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(1500);
  }, 60_000);
  it('has a hole that is the last cell for "what comes next" and an inner cell for a gap, never the first unit', () => {
    let ends = 0;
    let middles = 0;
    for (const l of LEVELS) {
      for (const seed of seeds(100)) {
        for (const p of roundOf(l, seed)) {
          if (p.kind !== 'shapes') continue;
          if (p.hole === p.cells.length - 1) ends++;
          else { middles++; expect(p.hole).toBeGreaterThanOrEqual(p.rule.length); expect(p.hole).toBeLessThanOrEqual(p.cells.length - 2); }
        }
      }
    }
    expect(ends).toBeGreaterThan(100);
    expect(middles).toBeGreaterThan(100);
  });
  it('explains the pattern in plain words with the unit', () => {
    const p = makePuzzle(1, mulberry32(4));
    const unit = unitOf(p);
    expect(unit).toHaveLength(p.rule.length);
    expect(explain(p)).toBe(`The pattern is ${unit.map(itemName).join(', ')}, over and over.`);
  });
});

describe('number puzzles', () => {
  const all: Puzzle[] = [];
  for (const seed of seeds(400)) for (const p of roundOf(3, seed)) if (p.kind === 'numbers') all.push(p);

  it('appear on the Big level only, in good numbers', () => {
    expect(all.length).toBeGreaterThan(400);
    for (const l of [1, 2] as Level[]) for (const seed of seeds(60)) for (const p of roundOf(l, seed)) expect(p.kind).toBe('shapes');
  });
  it('count up or down by a steady step of 1, 2, 3, 5 or 10, never below zero, with one number hidden', () => {
    const steps = new Set<number>();
    let ups = 0;
    let downs = 0;
    for (const p of all) {
      const d = p.cells[1] - p.cells[0];
      expect([1, 2, 3, 5, 10]).toContain(Math.abs(d));
      steps.add(Math.abs(d));
      expect(Math.abs(d)).toBe(p.step);
      expect(steadyBrute(p.cells), p.cells.join()).toBe(true);
      expect(p.rule).toBe(`${d > 0 ? 'up' : 'down'} ${p.step}`);
      if (d > 0) ups++; else downs++;
      for (const c of p.cells) { expect(Number.isInteger(c)).toBe(true); expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(200); }
      expect(p.cells.length).toBeGreaterThanOrEqual(5);
      expect(p.cells.length).toBeLessThanOrEqual(6);
      expect(p.hole).toBeGreaterThanOrEqual(2);
      expect(p.answer).toBe(p.cells[p.hole]);
      if (d < 0) expect(p.step).toBeLessThanOrEqual(5);
    }
    expect([...steps].sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 10]);
    expect(ups).toBeGreaterThan(100);
    expect(downs).toBeGreaterThan(30);
  });
  it('has exactly one number that keeps the step steady, and every wrong option breaks it', () => {
    for (const p of all) {
      const candidates = Array.from({ length: 220 }, (_, i) => i - 5);
      const fit = candidates.filter((c) => steadyBrute(p.cells.map((v, i) => (i === p.hole ? c : v))));
      expect(fit, p.cells.join()).toEqual([p.answer]);
      expect(p.options).toHaveLength(OPTION_COUNT[3]);
      expect(new Set(p.options).size).toBe(p.options.length);
      expect(p.options.filter((o) => o === p.answer)).toHaveLength(1);
      for (const o of p.options) { expect(Number.isInteger(o) && o >= 0).toBe(true); if (o !== p.answer) expect(stepFillers(p.cells, p.hole, [o])).toEqual([]); }
      expect(stepFillers(p.cells, p.hole, p.options)).toEqual([p.answer]);
    }
  });
  it('explains the count in plain words', () => {
    const up = all.find((p) => p.rule.startsWith('up'))!;
    const down = all.find((p) => p.rule.startsWith('down'))!;
    expect(explain(up)).toBe(`It counts up by ${up.step}: ${up.cells.join(', ')}.`);
    expect(explain(down)).toBe(`It counts back by ${down.step}: ${down.cells.join(', ')}.`);
    expect(unitOf(up)).toEqual([]);
  });
});

describe('levels and rounds', () => {
  it('produce exactly the rules the page describes', () => {
    expect(rulesForLevel(1).sort()).toEqual(['AAB', 'AB']);
    expect(rulesForLevel(2).sort()).toEqual(['AAB', 'AB', 'ABB', 'ABC']);
    expect(rulesForLevel(3).sort()).toEqual(['AABB', 'AABC', 'ABBC', 'ABCD', 'numbers']);
    for (const l of LEVELS) {
      const seen = new Set<string>();
      for (const seed of seeds(200)) for (const p of roundOf(l, seed)) seen.add(p.kind === 'shapes' ? p.rule : 'numbers');
      expect([...seen].sort(), `level ${l}`).toEqual(rulesForLevel(l).sort());
    }
  }, 30_000);
  it('gives 3 choices on Little and Middle and 4 on Big', () => {
    expect(OPTION_COUNT).toEqual({ 1: 3, 2: 3, 3: 4 });
    for (const l of LEVELS) for (const seed of seeds(30)) for (const p of roundOf(l, seed)) expect(p.options).toHaveLength(OPTION_COUNT[l]);
  });
  it('is fully decided by level and seed', () => {
    for (const l of LEVELS) {
      expect(roundOf(l, 99)).toEqual(roundOf(l, 99));
      expect(roundOf(l, 99)).not.toEqual(roundOf(l, 100));
    }
  });
  it('never uses the same plan twice in a row, or twice within two turns', () => {
    for (const l of LEVELS) {
      expect(planCount(l)).toBeGreaterThanOrEqual(3);
      for (const seed of seeds(150)) {
        const r = roundOf(l, seed);
        for (let i = 1; i < r.length; i++) expect(r[i].plan, `${l} seed ${seed} turn ${i}`).not.toBe(r[i - 1].plan);
        for (let i = 2; i < r.length; i++) expect(r[i].plan).not.toBe(r[i - 2].plan);
      }
    }
  });
  it('states its sizes as the page does', () => {
    expect(ROUND_SIZE).toBe(8);
    expect(STEP_UP_AT).toBe(5);
    expect(OWN_MAX).toBe(12);
    expect(MAX_LEVEL).toBe(3);
    expect(LEVEL_NAME).toEqual({ 1: 'Little', 2: 'Middle', 3: 'Big' });
  });
});

describe('describing a puzzle', () => {
  it('reads the row aloud with the gap as "blank" until it is filled', () => {
    const p = makePuzzle(1, mulberry32(2));
    const blank = describeRow(p, false);
    expect(blank.startsWith('Pattern: ')).toBe(true);
    expect(blank.endsWith('blank')).toBe(true);
    expect(blank.split(', ')).toHaveLength(p.cells.length);
    expect(describeRow(p, true)).not.toContain('blank');
    expect(describeRow(p, true).endsWith(itemName(p.answer))).toBe(true);
    expect(optionLabel(p, p.answer)).toBe(itemName(p.answer));
    let n = makePuzzle(3, mulberry32(5));
    for (let s = 1; n.kind !== 'numbers' && s < 200; s++) n = makePuzzle(3, mulberry32(s));
    expect(n.kind).toBe('numbers');
    expect(optionLabel(n, 7)).toBe('7');
    expect(describeRow(n, false)).toContain('blank');
  });
});

describe('choosing', () => {
  const puzzle = makePuzzle(2, mulberry32(8));
  const wrong = puzzle.options.filter((o) => o !== puzzle.answer);

  it('a right pick solves it, first time if nothing was tried', () => {
    const r = choose(newTurn(puzzle), puzzle.answer);
    expect(r.result).toBe('right');
    expect(r.turn.solved).toBe(true);
    expect(firstTry(r.turn)).toBe(true);
  });
  it('a wrong pick is remembered, loses first time, and cannot be picked again', () => {
    let t = newTurn(puzzle);
    const r = choose(t, wrong[0]);
    expect(r.result).toBe('wrong');
    expect(r.turn.tried).toEqual([wrong[0]]);
    expect(r.turn.solved).toBe(false);
    t = r.turn;
    expect(choose(t, wrong[0])).toEqual({ turn: t, result: 'ignored' });
    expect(choose(t, wrong[0]).turn).toBe(t);
    const done = choose(t, puzzle.answer).turn;
    expect(done.solved).toBe(true);
    expect(firstTry(done)).toBe(false);
  });
  it('ignores anything that is not an option, and everything after it is solved', () => {
    const t = newTurn(puzzle);
    for (const bad of [-1, 99, NaN, 1.5, Infinity]) expect(choose(t, bad).turn).toBe(t);
    const solved = choose(t, puzzle.answer).turn;
    expect(choose(solved, wrong[0]).turn).toBe(solved);
    expect(choose(solved, puzzle.answer).result).toBe('ignored');
  });
  it('always lets a player finish: after every wrong option is tried the answer is left', () => {
    let t = newTurn(puzzle);
    for (const w of wrong) t = choose(t, w).turn;
    expect(t.tried).toHaveLength(puzzle.options.length - 1);
    expect(choose(t, puzzle.answer).result).toBe('right');
  });
  it('random choosing over thousands of puzzles never throws and always solves', () => {
    for (let s = 1; s <= 3000; s++) {
      const rng = mulberry32(s);
      const p = makePuzzle(LEVELS[s % 3], rng);
      let t = newTurn(p);
      let guard = 0;
      while (!t.solved && guard++ < 400) t = choose(t, p.options[pickIndex(p.options.length, rng)]).turn;
      expect(t.solved).toBe(true);
      expect(t.tried.length).toBeLessThan(p.options.length);
      expect(t.tried).not.toContain(p.answer);
    }
  }, 30_000);
});

describe('make your own', () => {
  /** Independent: a row is a pattern when some period up to half its length holds and the row is not all one piece. */
  const patternBrute = (row: readonly number[]): number => {
    if (row.length < 2 || row.every((v) => v === row[0])) return 0;
    for (let q = 2; 2 * q <= row.length; q++) if (row.slice(q).join(',') === row.slice(0, row.length - q).join(',')) return q;
    return 0;
  };

  it('calls a row a pattern exactly when it repeats with at least two different pieces (every row up to 8 cells over 3 pieces)', () => {
    for (let len = 0; len <= 8; len++) {
      for (let n = 0; n < 3 ** len; n++) {
        const row: number[] = [];
        let x = n;
        for (let i = 0; i < len; i++) { row.push(x % 3); x = Math.floor(x / 3); }
        const r = analyseOwn(row);
        expect(r.kind === 'pattern', row.join('')).toBe(patternBrute(row) > 0);
        if (r.kind === 'pattern') { expect(r.period).toBe(patternBrute(row)); expect(r.unit).toEqual(row.slice(0, r.period)); }
        else expect(r.period).toBe(0);
        if (len === 0) expect(r.kind).toBe('empty');
        else if (len === 1) expect(r.kind).toBe('one');
        else if (row.every((v) => v === row[0])) expect(r.kind).toBe('same');
      }
    }
  });
  it('adds, caps at the row limit, takes back, and never changes its input', () => {
    let row: number[] = [];
    const frozen = Object.freeze(row.slice());
    expect(addOwn(frozen, 2)).toEqual([2]);
    for (let i = 0; i < 20; i++) row = addOwn(row, i % 6);
    expect(row).toHaveLength(OWN_MAX);
    expect(addOwn(row, 1)).toEqual(row);
    expect(addOwn(row, 1)).not.toBe(row);
    for (const bad of [-1, 6, 1.5, NaN]) expect(addOwn([0], bad)).toEqual([0]);
    expect(takeBackOwn([1, 2, 3])).toEqual([1, 2]);
    expect(takeBackOwn([])).toEqual([]);
  });
  it('says something kind and correct in every state', () => {
    expect(ownMessage([])).toMatch(/start/);
    expect(ownMessage([0])).toMatch(/Add more/);
    expect(ownMessage([1, 1, 1])).toMatch(/same/);
    expect(ownMessage([0, 1, 2])).toMatch(/Keep adding/);
    expect(ownMessage([0, 1, 0, 1])).toBe('Lovely! Your pattern repeats every 2: blue circle, red triangle.');
    expect(ownMessage([0, 0, 1, 0, 0, 1])).toContain('every 3');
    expect(ownRowText([])).toBe('empty');
    expect(ownRowText([3, 4])).toBe('green star, purple diamond');
    for (const msg of [ownMessage([]), ownMessage([0]), ownMessage([1, 1]), ownMessage([0, 1, 2])]) expect(msg).not.toMatch(/wrong|bad|fail|incorrect|oops/i);
  });
  it('writes a copy line that names the pieces and the period', () => {
    expect(ownShareLine([0, 1, 0, 1])).toBe('Pattern Maker - my pattern: blue circle, red triangle, blue circle, red triangle (it repeats every 2)');
    expect(ownShareLine([0, 1, 2])).toBe('Pattern Maker - my pattern: blue circle, red triangle, yellow square');
    expect(ownShareLine([])).toBe('Pattern Maker - my pattern: empty');
  });
});

describe('words for the page', () => {
  it('never scolds', () => {
    for (let n = 0; n < 20; n++) {
      expect(praise(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).not.toMatch(/wrong|bad|fail|incorrect|oops|stupid|no!/i);
      expect(retry(n)).toMatch(/try|go|another|again/i);
    }
    expect(praise(-3)).toBeTruthy();
    expect(retry(NaN)).toBeTruthy();
    expect(plural(1, 'star', 'stars')).toBe('star');
    expect(plural(3, 'star', 'stars')).toBe('stars');
  });
  it('offers the next level after every fifth right-first-time puzzle, never on the top level', () => {
    let s = 0;
    const offers: number[] = [];
    for (let i = 1; i <= 11; i++) { s = streakAfter(s, true); if (offersStepUp(s, 1)) offers.push(i); }
    expect(offers).toEqual([5, 10]);
    expect(streakAfter(9, false)).toBe(0);
    expect(offersStepUp(5, 3)).toBe(false);
    expect(offersStepUp(0, 2)).toBe(false);
  });
});

describe('saved record and share text', () => {
  it('reads junk as zero and builds a fresh object with only known keys', () => {
    expect(sanitiseSaved(null)).toEqual(emptySaved());
    for (const bad of [undefined, 3, 'x', [], [1], true]) expect(sanitiseSaved(bad)).toEqual(emptySaved());
    expect(sanitiseSaved({ stars: -1, rounds: 2.5, b1: NaN, b2: '4', b3: Infinity })).toEqual(emptySaved());
    const s = sanitiseSaved(JSON.parse('{"stars": 5, "rounds": 2, "b1": 99, "b2": 3, "b3": 1, "__proto__": {"y": 1}, "z": 1}'));
    expect(s).toEqual({ stars: 5, rounds: 2, b1: ROUND_SIZE, b2: 3, b3: 1 });
    expect(Object.keys(s).sort()).toEqual(['b1', 'b2', 'b3', 'rounds', 'stars']);
  });
  it('counts stars and rounds and keeps the best per level', () => {
    let s = addStar(addStar(emptySaved()));
    s = recordRound(s, 3, 5);
    s = recordRound(s, 3, 2);
    expect(s).toEqual({ stars: 2, rounds: 2, b1: 0, b2: 0, b3: 5 });
    expect(bestFor(s, 3)).toBe(5);
    expect(recordRound(s, 1, 100).b1).toBe(ROUND_SIZE);
  });
  it('writes a correct copy line for new, partial and finished rounds', () => {
    for (const l of LEVELS) {
      for (const [stars, ft] of [[0, 0], [3, 2], [ROUND_SIZE, ROUND_SIZE], [ROUND_SIZE, 50], [2, 7]] as const) {
        const t = shareLine(l, stars, ft);
        expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
        expect(t).toContain(LEVEL_NAME[l]);
        expect(t).toContain(`${stars} of ${ROUND_SIZE} stars`);
      }
    }
    expect(shareLine(2, 2, 7)).toContain('2 solved first time');
  });
});

describe('page source', () => {
  const src = calculatorSource.replace(/\r\n?/g, '\n');
  it('has a 32 px how-it-works heading with the native marker', () => {
    const rule = src.match(/\.pm-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
  it('keeps every button and choice at least 56 px tall', () => {
    expect(src).toMatch(/\.pm-actions button, #pm-app \.pm-btnrow button \{ min-height: 3\.5rem; \}/);
    expect(src).toMatch(/\.pm-opt \{[^}]*min-height: 4rem/);
    expect(src).toMatch(/\.pm-mode, #pm-app \.pm-lvl \{\s*min-height: 3\.5rem/);
  });
  it('has no timers and no sound, and writes only text', () => {
    expect(src).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|AudioContext|speechSynthesis/);
    expect(src).not.toMatch(/innerHTML|insertAdjacentHTML/);
  });
});
