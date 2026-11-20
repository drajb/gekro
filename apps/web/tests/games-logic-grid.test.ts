/**
 * games-logic-grid.test.ts - the engine behind `logic-grid`.
 *
 * Pinned: the seeded random numbers match a second implementation; every clue type
 * means what the page says (checked against a plain restatement); every generated
 * puzzle has exactly ONE answer, proven by an independent brute force over all
 * arrangements (a different algorithm from the engine's deduce-and-branch search) for
 * every size over many seeds; dropping ANY single clue leaves more than one answer,
 * so no clue is spare; the engine's answer count agrees with the brute force on random
 * clue sets that were never generated; every deduction step the hint can give is TRUE
 * of the hidden answer; following the hint from an empty grid always ends on a solved
 * grid; the same seed gives the same puzzle; marks, implied crosses, the win test and
 * the mistake finder behave as described; storage and URL sanitisers reject junk.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, POOL, mulberry32, plural, formatTime, clampSize, dailySeed, flat, itemName, itemIcon, refOf, clueHolds, clueText,
  fullDomains, nextStep, propagate, solveCount, trueClues, makePuzzle, emptyMarks, markAt, nextMark, candidates, impliedCross,
  isSolved, wrongMarks, hintFor, bestKey, MAX_BEST_SECONDS, sanitiseBest, describeCell,
  type Clue, type Puzzle, type Marks, type Ref,
} from '../src/components/apps-private/logic-grid/helpers';

// ── Independent pieces (written differently from the engine) ──────────────────

const refRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z = z ^ (z + Math.imul(z ^ (z >>> 7), z | 61));
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
};

const permutations = (n: number): number[][] => {
  const out: number[][] = [];
  const rec = (prefix: number[], rest: number[]): void => {
    if (!rest.length) { out.push(prefix); return; }
    rest.forEach((x, idx) => rec([...prefix, x], [...rest.slice(0, idx), ...rest.slice(idx + 1)]));
  };
  rec([], Array.from({ length: n }, (_, i) => i));
  return out;
};

/** The meaning of each clue, restated with plain comparisons on spot numbers. */
const holds = (cl: Clue, pos: number[][]): boolean => {
  const pa = pos[cl.a.c][cl.a.i];
  if (cl.t === 'at') return pa === cl.pos;
  const pb = pos[cl.b.c][cl.b.i];
  if (cl.t === 'same') return pa === pb;
  if (cl.t === 'apart') return pa !== pb;
  if (cl.t === 'next') return pa + 1 === pb || pb + 1 === pa;
  return pa < pb; // before
};

const lastCat = (cl: Clue): number => (cl.t === 'at' ? cl.a.c : Math.max(cl.a.c, cl.b.c));

/** Counts arrangements (a spot permutation for each category) satisfying every clue. Checks clues as soon as their categories are placed. */
const bruteCount = (n: number, cats: number, clues: readonly Clue[], cap = 1e9): number => {
  const perms = permutations(n);
  const assign: number[][] = [];
  let count = 0;
  const rec = (c: number): void => {
    if (count >= cap) return;
    if (c === cats) { count++; return; }
    for (const pm of perms) {
      assign[c] = pm;
      let ok = true;
      for (const cl of clues) if (lastCat(cl) === c && !holds(cl, assign)) { ok = false; break; }
      if (ok) rec(c + 1);
    }
  };
  rec(0);
  return count;
};

const sameClue = (a: Clue, b: Clue) => JSON.stringify(a) === JSON.stringify(b);

// ── Basics ────────────────────────────────────────────────────────────────────

describe('seeded random numbers', () => {
  it('match a second implementation', () => {
    for (const seed of [0, 1, 99, 2 ** 31, 2 ** 32 - 1]) {
      const a = mulberry32(seed);
      const b = refRng(seed);
      for (let i = 0; i < 200; i++) expect(a()).toBe(b());
    }
  });
});

describe('sizes and word lists', () => {
  it('offer four sizes from 3 categories of 3 items to 4 categories of 5 items (spots count as a category)', () => {
    expect(SIZES.map((s) => [s.attrs + 1, s.items])).toEqual([[3, 3], [3, 4], [4, 4], [4, 5]]);
    expect(SIZES.map((s) => s.label)).toEqual(['Easy', 'Medium', 'Hard', 'Hardest']);
  });
  it('has enough everyday, single-word, singular items in every category', () => {
    expect(POOL.length).toBeGreaterThanOrEqual(SIZES[3].attrs);
    const seen = new Set<string>();
    for (const cat of POOL) {
      expect(cat.items.length).toBeGreaterThanOrEqual(5);
      for (const it of cat.items) {
        expect(it.name).toMatch(/^[a-z]{3,8}$/);
        expect(it.name.endsWith('s'), `${it.name} must be singular so every sentence reads right`).toBe(false);
        expect(it.icon.length).toBeGreaterThan(0);
        expect(seen.has(it.name), `duplicate ${it.name}`).toBe(false);
        seen.add(it.name);
      }
    }
  });
  it('clampSize accepts only size numbers', () => {
    expect(clampSize('2', 0)).toBe(2);
    expect(clampSize(3, 0)).toBe(3);
    for (const bad of ['4', '-1', '', 'x', 1.5, NaN, null, undefined, [], {}, Infinity]) expect(clampSize(bad, 1)).toBe(1);
  });
  it('formats times, plurals and daily seeds', () => {
    expect(formatTime(125)).toBe('2:05');
    expect(formatTime(-1)).toBe('0:00');
    expect(plural(1, 'clue')).toBe('1 clue');
    expect(plural(2, 'clue')).toBe('2 clues');
    const s = dailySeed(2026, 11, 5, 2);
    expect(Number.isInteger(s) && s > 0 && s < 2 ** 32).toBe(true);
    expect(dailySeed(2026, 11, 5, 3)).not.toBe(s);
    expect(dailySeed(2026, 11, 6, 2)).not.toBe(s);
    expect(dailySeed(2026, 11, 5, 2)).toBe(s);
    for (const bad of [NaN, Infinity, -5, 1e12]) {
      const v = dailySeed(bad, bad, bad, bad);
      expect(Number.isInteger(v) && v > 0 && v < 2 ** 32).toBe(true);
    }
  });
});

// ── Clue meaning and text ─────────────────────────────────────────────────────

describe('clues', () => {
  // Item (0,0) in spot 1, (1,0) in spot 2, (1,1) in spot 0, (0,1) in spot 3 etc: positions given by a lookup.
  const at = (m: Record<string, number>) => (r: Ref) => m[`${r.c}.${r.i}`];
  const a: Ref = { c: 0, i: 0 };
  const b: Ref = { c: 1, i: 0 };
  it('same, apart, next, before and at mean what the page says', () => {
    const near = at({ '0.0': 1, '1.0': 2 });
    const far = at({ '0.0': 0, '1.0': 3 });
    const same = at({ '0.0': 2, '1.0': 2 });
    const rev = at({ '0.0': 3, '1.0': 1 });
    expect([near, far, same, rev].map((f) => clueHolds({ t: 'same', a, b }, f))).toEqual([false, false, true, false]);
    expect([near, far, same, rev].map((f) => clueHolds({ t: 'apart', a, b }, f))).toEqual([true, true, false, true]);
    expect([near, far, same, rev].map((f) => clueHolds({ t: 'next', a, b }, f))).toEqual([true, false, false, false]);
    expect([near, far, same, rev].map((f) => clueHolds({ t: 'before', a, b }, f))).toEqual([true, true, false, false]);
    expect([near, far, same, rev].map((f) => clueHolds({ t: 'at', a, pos: 1 }, f))).toEqual([true, false, false, false]);
    // next works in both directions
    expect(clueHolds({ t: 'next', a, b }, at({ '0.0': 2, '1.0': 1 }))).toBe(true);
  });

  it('read as full sentences about "the ..." items', () => {
    const p = makePuzzle(SIZES[0], mulberry32(5));
    const x: Ref = { c: 0, i: 0 };
    const y: Ref = { c: 1, i: 1 };
    const nx = itemName(p, x);
    const ny = itemName(p, y);
    expect(clueText(p, { t: 'same', a: x, b: y })).toBe(`The ${nx} is in the same spot as the ${ny}.`);
    expect(clueText(p, { t: 'apart', a: x, b: y })).toBe(`The ${nx} is not in the same spot as the ${ny}.`);
    expect(clueText(p, { t: 'next', a: x, b: y })).toBe(`The ${nx} is right next to the ${ny}, on one side or the other.`);
    expect(clueText(p, { t: 'before', a: x, b: y })).toBe(`The ${nx} is somewhere to the left of the ${ny}.`);
    expect(clueText(p, { t: 'at', a: x, pos: 0 })).toBe(`The ${nx} is in spot 1, the far left.`);
    expect(clueText(p, { t: 'at', a: x, pos: 2 })).toBe(`The ${nx} is in spot 3, the far right.`);
    expect(clueText(makePuzzle(SIZES[1], mulberry32(5)), { t: 'at', a: x, pos: 1 })).toMatch(/is in spot 2\.$/);
  });

  it('trueClues lists only true clues, all five types, between different categories', () => {
    const p = makePuzzle(SIZES[3], mulberry32(12));
    const all = trueClues(p.n, p.cats.length, p.solution);
    expect(all.every((cl) => holds(cl, p.solution))).toBe(true);
    expect(new Set(all.map((c) => c.t))).toEqual(new Set(['at', 'same', 'apart', 'next', 'before']));
    expect(all.filter((c) => c.t === 'at').length).toBe(p.cats.length * p.n);
    for (const cl of all) if (cl.t !== 'at') expect(cl.a.c).not.toBe(cl.b.c);
    // the full list pins the answer
    expect(bruteCount(p.n, p.cats.length, all)).toBe(1);
  });
});

// ── Generator ─────────────────────────────────────────────────────────────────

describe('generated puzzles', () => {
  it('pick distinct categories and distinct items, with a valid hidden answer', () => {
    SIZES.forEach((spec) => {
      for (let seed = 1; seed <= 30; seed++) {
        const p = makePuzzle(spec, mulberry32(seed));
        expect(p.n).toBe(spec.items);
        expect(p.cats.length).toBe(spec.attrs);
        expect(new Set(p.cats.map((c) => c.id)).size).toBe(spec.attrs);
        p.cats.forEach((c, ci) => {
          expect(c.items.length).toBe(spec.items);
          expect(new Set(c.items.map((i) => i.name)).size).toBe(spec.items);
          expect([...p.solution[ci]].sort()).toEqual(Array.from({ length: spec.items }, (_, i) => i));
        });
        expect(p.clues.length).toBeGreaterThanOrEqual(2);
        for (const cl of p.clues) {
          expect(holds(cl, p.solution)).toBe(true);
          if (cl.t !== 'at') expect(cl.a.c).not.toBe(cl.b.c);
        }
        // no clue appears twice
        p.clues.forEach((c, i) => p.clues.forEach((d, j) => { if (i < j) expect(sameClue(c, d)).toBe(false); }));
      }
    });
  });

  it('have exactly ONE answer by independent brute force (sizes 1-3: 40 seeds; size 4: 6 seeds)', () => {
    SIZES.slice(0, 3).forEach((spec) => {
      for (let seed = 1; seed <= 40; seed++) {
        const p = makePuzzle(spec, mulberry32(seed));
        expect(bruteCount(p.n, p.cats.length, p.clues), `${spec.label} seed ${seed}`).toBe(1);
      }
    });
    for (let seed = 1; seed <= 6; seed++) {
      const p = makePuzzle(SIZES[3], mulberry32(seed));
      expect(bruteCount(p.n, p.cats.length, p.clues), `Hardest seed ${seed}`).toBe(1);
    }
  }, 300_000);

  it('have no spare clue: dropping any one leaves more than one answer (all sizes, 12 seeds each)', () => {
    SIZES.forEach((spec, z) => {
      const seeds = z === 3 ? 3 : 12;
      for (let seed = 100; seed < 100 + seeds; seed++) {
        const p = makePuzzle(spec, mulberry32(seed));
        p.clues.forEach((_, i) => {
          const rest = p.clues.filter((__, j) => j !== i);
          expect(bruteCount(p.n, p.cats.length, rest, 2), `${spec.label} seed ${seed} without clue ${i + 1}`).toBeGreaterThanOrEqual(2);
        });
      }
    });
  }, 600_000);

  it('give the same puzzle for the same seed and different puzzles for different seeds', () => {
    SIZES.forEach((spec) => {
      expect(makePuzzle(spec, mulberry32(7))).toEqual(makePuzzle(spec, mulberry32(7)));
      const keys = Array.from({ length: 10 }, (_, i) => JSON.stringify(makePuzzle(spec, mulberry32(300 + i)).solution));
      expect(new Set(keys).size).toBeGreaterThanOrEqual(8);
    });
  });

  it('do not depend on the clock: the search budget counts steps and is generous', () => {
    const a = makePuzzle(SIZES[3], mulberry32(31));
    const b = makePuzzle(SIZES[3], mulberry32(31), { nodesPerCheck: 20000 });
    expect(b).toEqual(a);
  });

  it('use a mix of clue types on the bigger sizes', () => {
    const types = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) for (const c of makePuzzle(SIZES[2], mulberry32(seed)).clues) types.add(c.t);
    expect(types.size).toBeGreaterThanOrEqual(4);
  });

  it('stay quick to make: 20 puzzles of the largest size within a generous bound', () => {
    for (let seed = 1; seed <= 20; seed++) makePuzzle(SIZES[3], mulberry32(seed + 900));
  }, 120_000);
});

// ── Search against brute force on clue sets the generator never made ──────────

describe('solver agrees with brute force', () => {
  it('on random subsets of true clues (3x3, 4x4 and 3 categories of 5): same number of answers', () => {
    const rng = mulberry32(2026);
    const cases: [number, number][] = [[3, 2], [4, 2], [4, 3], [5, 2]];
    for (let t = 0; t < 120; t++) {
      const [n, attrs] = cases[t % cases.length];
      const base = makePuzzle({ attrs, items: n, label: 'x' }, mulberry32(t + 1));
      const all = trueClues(n, attrs, base.solution);
      const k = 1 + Math.floor(rng() * 7);
      const clues: Clue[] = [];
      for (let i = 0; i < k; i++) clues.push(all[Math.floor(rng() * all.length)]);
      // Sometimes add a clue that is false for the hidden answer, so some sets have fewer answers or none.
      if (t % 3 === 0) clues.push({ t: 'before', a: { c: 0, i: 0 }, b: { c: attrs - 1, i: 0 } });
      const p: Puzzle = { ...base, clues };
      const expected = bruteCount(n, attrs, clues, 50);
      const got = solveCount(p, { limit: 50, maxNodes: 2_000_000 });
      expect(got.limited).toBe(false);
      expect(got.count, `case ${t}`).toBe(expected);
    }
  }, 300_000);

  it('gives up cleanly when the step budget is tiny, and stops at the limit', () => {
    const p = makePuzzle(SIZES[3], mulberry32(4));
    const loose: Puzzle = { ...p, clues: p.clues.slice(0, 1) };
    expect(solveCount(loose, { limit: 2, maxNodes: 1 }).limited).toBe(true);
    expect(solveCount(loose, { limit: 5, maxNodes: 100000 }).count).toBe(5);
  });
});

// ── Deduction steps are sound ─────────────────────────────────────────────────

describe('deduction steps', () => {
  it('never remove the true spot of an item, on any size, from an empty start', () => {
    SIZES.forEach((spec) => {
      for (let seed = 1; seed <= 25; seed++) {
        const p = makePuzzle(spec, mulberry32(seed + 40));
        const D = fullDomains(p);
        for (let guard = 0; guard < 1000; guard++) {
          const s = nextStep(p, D);
          if (s === null) break;
          expect(s).not.toBe('conflict');
          if (s === 'conflict') break;
          const r = refOf(p, s.v);
          expect(p.solution[r.c][r.i], `${spec.label} seed ${seed}: ${s.text}`).not.toBe(s.pos);
          expect(D[s.v] & (1 << s.pos)).not.toBe(0);
          expect(s.text.length).toBeGreaterThan(10);
          if (s.kind === 'clue') {
            expect(s.text.startsWith(`Clue ${s.clue + 1}: `)).toBe(true);
            expect(s.clue).toBeGreaterThanOrEqual(0);
            expect(s.clue).toBeLessThan(p.clues.length);
          }
          D[s.v] &= ~(1 << s.pos);
        }
      }
    });
  });

  it('propagate keeps the true answer inside every candidate set', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const p = makePuzzle(SIZES[2], mulberry32(seed + 70));
      const D = fullDomains(p);
      expect(propagate(p, D)).toBe(true);
      D.forEach((m, v) => { const r = refOf(p, v); expect(m & (1 << p.solution[r.c][r.i])).not.toBe(0); });
    }
  });

  it('reports a conflict when a candidate set is empty', () => {
    const p = makePuzzle(SIZES[0], mulberry32(3));
    const D = fullDomains(p);
    D[0] = 0;
    expect(nextStep(p, D)).toBe('conflict');
    expect(propagate(p, D)).toBe(false);
  });
});

// ── The grid of marks ─────────────────────────────────────────────────────────

const setMark = (p: Puzzle, m: Marks, v: number, pos: number, value: number): void => { m[v * p.n + pos] = value; };

describe('marks', () => {
  const p = makePuzzle(SIZES[1], mulberry32(8));
  const rows = p.cats.length * p.n;
  const sol = (v: number) => { const r = refOf(p, v); return p.solution[r.c][r.i]; };

  it('start empty with every spot possible, and cycle empty, cross, tick', () => {
    const m = emptyMarks(p);
    expect(m.length).toBe(rows * p.n);
    expect(m.every((x) => x === 0)).toBe(true);
    expect(candidates(p, m).every((d) => d === (1 << p.n) - 1)).toBe(true);
    expect([0, 1, 2].map(nextMark)).toEqual([1, 2, 0]);
    expect(isSolved(p, m)).toBe(false);
  });

  it('a cross removes one spot; a tick fixes its row and clears that spot for the rest of the category', () => {
    const m = emptyMarks(p);
    setMark(p, m, 0, 1, 1);
    expect(candidates(p, m)[0] & (1 << 1)).toBe(0);
    expect(candidates(p, m)[1] & (1 << 1)).not.toBe(0);
    expect(impliedCross(p, m, 0, 1)).toBe(false); // the player's own cross is not "implied"
    setMark(p, m, 1, 2, 2);
    const D = candidates(p, m);
    expect(D[1]).toBe(1 << 2);
    expect(D[0] & (1 << 2)).toBe(0); // same category
    expect(D[p.n] & (1 << 2)).not.toBe(0); // other category untouched
    expect(impliedCross(p, m, 0, 2)).toBe(true);
    expect(impliedCross(p, m, 1, 0)).toBe(true); // rest of the ticked row
    expect(impliedCross(p, m, p.n, 2)).toBe(false);
    expect(markAt(p, m, 1, 2)).toBe(2);
  });

  it('is solved by ticking the whole answer, or by crossing every wrong spot', () => {
    const ticks = emptyMarks(p);
    for (let v = 0; v < rows; v++) setMark(p, ticks, v, sol(v), 2);
    expect(isSolved(p, ticks)).toBe(true);
    expect(wrongMarks(p, ticks)).toEqual([]);
    const crosses = emptyMarks(p);
    for (let v = 0; v < rows; v++) for (let q = 0; q < p.n; q++) if (q !== sol(v)) setMark(p, crosses, v, q, 1);
    expect(isSolved(p, crosses)).toBe(true);
    const gap = emptyMarks(p);
    for (let v = 1; v < rows; v++) setMark(p, gap, v, sol(v), 2);
    expect(isSolved(p, gap)).toBe(true); // the last item has only one spot left by elimination
    const two = gap.slice();
    setMark(p, two, 0, (sol(0) + 1) % p.n, 2);
    expect(isSolved(p, two)).toBe(false);
  });

  it('a wrong tick or a cross on the right spot is reported, and keeps the grid from being solved', () => {
    const m = emptyMarks(p);
    const wrong = (sol(0) + 1) % p.n;
    setMark(p, m, 0, wrong, 2);
    expect(wrongMarks(p, m)).toEqual([{ v: 0, pos: wrong }]);
    const m2 = emptyMarks(p);
    setMark(p, m2, 3, sol(3), 1);
    expect(wrongMarks(p, m2)).toEqual([{ v: 3, pos: sol(3) }]);
    for (let v = 0; v < rows; v++) setMark(p, m2, v, sol(v), v === 3 ? 1 : 2);
    expect(isSolved(p, m2)).toBe(false);
  });

  it('never calls a random grid solved unless its candidates are exactly the answer', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 2000; t++) {
      const m = emptyMarks(p);
      for (let i = 0; i < m.length; i++) m[i] = rng() < 0.3 ? Math.floor(rng() * 3) : 0;
      const D = candidates(p, m);
      const exact = D.every((d, v) => d === 1 << sol(v));
      expect(isSolved(p, m)).toBe(exact);
    }
  });

  it('describes a cell for a screen reader', () => {
    const m = emptyMarks(p);
    const r = refOf(p, 0);
    const nm = itemName(p, r);
    expect(describeCell(p, m, 0, 0, false)).toBe(`${nm}, spot 1: no mark`);
    setMark(p, m, 0, 1, 1);
    expect(describeCell(p, m, 0, 1, false)).toBe(`${nm}, spot 2: crossed out`);
    setMark(p, m, 0, 2, 2);
    expect(describeCell(p, m, 0, 2, false)).toBe(`${nm}, spot 3: ticked`);
    expect(describeCell(p, m, 0, 0, true)).toBe(`${nm}, spot 1: crossed out by the rules`);
    expect(itemIcon(p, r).length).toBeGreaterThan(0);
    expect(flat(p, { c: 1, i: 2 })).toBe(p.n + 2);
  });
});

// ── Hints ─────────────────────────────────────────────────────────────────────

describe('hints', () => {
  it('following the hint from an empty grid always ends on a solved grid, and every step is true', () => {
    SIZES.forEach((spec) => {
      for (let seed = 1; seed <= 15; seed++) {
        const p = makePuzzle(spec, mulberry32(seed + 500));
        const m = emptyMarks(p);
        let guard = 0;
        for (; guard < 400; guard++) {
          const h = hintFor(p, m);
          if (!h) break;
          expect(h.kind, `${spec.label} seed ${seed}`).not.toBe('mistake');
          const r = refOf(p, h.v);
          if (h.kind === 'step') {
            expect(p.solution[r.c][r.i]).not.toBe(h.pos);
            expect(m[h.v * p.n + h.pos]).toBe(0);
            expect(h.clue === -1 || h.text.startsWith(`Clue ${h.clue + 1}:`)).toBe(true);
            m[h.v * p.n + h.pos] = 1;
          } else {
            expect(h.kind).toBe('reveal');
            expect(p.solution[r.c][r.i]).toBe(h.pos);
            expect(h.text).toMatch(/longer chain of reasoning/);
            m[h.v * p.n + h.pos] = 2;
          }
        }
        expect(isSolved(p, m), `${spec.label} seed ${seed} after ${guard} hints`).toBe(true);
        expect(hintFor(p, m)).toBeNull();
      }
    });
  }, 120_000);

  it('points out a wrong mark before anything else', () => {
    const p = makePuzzle(SIZES[1], mulberry32(9));
    const m = emptyMarks(p);
    const wrong = (p.solution[0][0] + 1) % p.n;
    m[0 * p.n + wrong] = 2;
    const h = hintFor(p, m)!;
    expect(h.kind).toBe('mistake');
    expect(h.v).toBe(0);
    expect(h.pos).toBe(wrong);
    expect(h.text).toMatch(/A mark is wrong/);
    const m2 = emptyMarks(p);
    m2[0 * p.n + p.solution[0][0]] = 1;
    const h2 = hintFor(p, m2)!;
    expect(h2.kind).toBe('mistake');
    expect(h2.text).toMatch(/can be in spot/);
  });

  it('explains by naming the clue it used, in plain words', () => {
    let named = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const p = makePuzzle(SIZES[2], mulberry32(seed + 800));
      const h = hintFor(p, emptyMarks(p))!;
      if (h.kind === 'step' && h.clue >= 0) {
        named++;
        expect(h.text).toMatch(/^Clue \d+: /);
        expect(h.text).toMatch(/cannot/);
      }
    }
    expect(named).toBeGreaterThan(10);
  });
});

// ── Storage ───────────────────────────────────────────────────────────────────

describe('saved best times', () => {
  it('keeps only whole seconds from 1 up for the four sizes', () => {
    expect(sanitiseBest({ t0: 10, t1: 20, t2: 30, t3: 359999 })).toEqual({ t0: 10, t1: 20, t2: 30, t3: 359999 });
    expect(sanitiseBest({ t0: 0, t1: -1, t2: 360000, t3: 2.5 })).toEqual({});
    expect(sanitiseBest({ t4: 10, t: 10, s0: 5 })).toEqual({});
    expect(sanitiseBest({ t0: '10', t1: null, t2: NaN })).toEqual({});
    expect(MAX_BEST_SECONDS).toBe(359999);
    expect(bestKey(2)).toBe('t2');
  });
  it('rejects junk and never copies prototype keys', () => {
    for (const bad of [null, undefined, 3, 'x', [], [1], true]) expect(sanitiseBest(bad)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"t0": 5}, "t1": 20}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({ t1: 20 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).t0).toBeUndefined();
  });
});
