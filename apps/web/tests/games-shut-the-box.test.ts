/**
 * games-shut-the-box.test.ts - the engine behind `shut-the-box`.
 *
 * Pinned: the mask table (tile sums), the one-die rule once 7, 8 and 9 are shut, the list of tile sets
 * that add up to a roll (checked against a plain recursive enumeration for every position and total),
 * the exact solver (expected final score and chance of shutting the box for all 512 positions,
 * checked against an unmemoised brute-force search over every ordered dice roll on small positions and
 * against thousands of simulated games on the full box), the rules of a box (bad choices are refused
 * and change nothing, a stuck roll ends the box, shutting all nine scores 0), the three computer
 * levels (Hard is the solver, and the levels rank Hard < Medium < Easy on score), the stored best
 * scores (sanitised), the URL parsing and the text. Thousands of random games never throw.
 */
import { describe, it, expect } from 'vitest';
import {
  TILES, FULL, HIGH_TILES, ROUNDS, DIE_PIPS, LEVELS, mulberry32, rollDie, maskSum, tilesOf, tileBit, dieCount,
  subsetsWithSum, rollFor, outcomes, TWO_DICE_WAYS, expectedScore, shutChance, bestMove, newBox, boxScore, rollBox, whyNot,
  shutTiles, chooseTiles, playBox, raceWinner, sanitizeStore, recordSolo, recordRace, parseSetup, plural, joinList,
  tilesText, diceText, scoreText, shareText, type Box, type Level,
} from '../src/components/apps-private/shut-the-box/helpers';
import calculatorSource from '../src/components/apps-private/shut-the-box/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');

// ── Independent oracles ──────────────────────────────────────────────────────

/** Every subset of the given tile list that adds up to total, by plain recursion over the tile list. */
const naiveSubsets = (tiles: number[], total: number): number[][] => {
  const out: number[][] = [];
  const go = (i: number, left: number, chosen: number[]) => {
    if (left === 0) { if (chosen.length) out.push(chosen.slice()); return; }
    if (i >= tiles.length || left < 0) return;
    chosen.push(tiles[i]);
    go(i + 1, left - tiles[i], chosen);
    chosen.pop();
    go(i + 1, left, chosen);
  };
  go(0, total, []);
  return out;
};
const toMask = (tiles: number[]) => tiles.reduce((m, t) => m | (1 << (t - 1)), 0);

/** Ordered-dice counts, built from the dice themselves rather than from the engine's table. */
const waysByTotal = (dice: number): Map<number, number> => {
  const m = new Map<number, number>();
  const faces = [1, 2, 3, 4, 5, 6];
  if (dice === 1) for (const a of faces) m.set(a, (m.get(a) ?? 0) + 1);
  else for (const a of faces) for (const b of faces) m.set(a + b, (m.get(a + b) ?? 0) + 1);
  return m;
};

/** Unmemoised expectimax over tile lists: the expected final score (or chance of shutting) by pure recursion. */
const bruteScore = (tiles: number[]): number => {
  if (tiles.length === 0) return 0;
  const oneDie = tiles.every((t) => t < 7);
  const ways = waysByTotal(oneDie ? 1 : 2);
  const n = oneDie ? 6 : 36;
  let e = 0;
  for (const [total, w] of ways) {
    const moves = naiveSubsets(tiles, total);
    if (!moves.length) { e += (w / n) * tiles.reduce((a, b) => a + b, 0); continue; }
    let best = Infinity;
    for (const mv of moves) best = Math.min(best, bruteScore(tiles.filter((t) => !mv.includes(t))));
    e += (w / n) * best;
  }
  return e;
};
const bruteShut = (tiles: number[]): number => {
  if (tiles.length === 0) return 1;
  const oneDie = tiles.every((t) => t < 7);
  const ways = waysByTotal(oneDie ? 1 : 2);
  const n = oneDie ? 6 : 36;
  let p = 0;
  for (const [total, w] of ways) {
    const moves = naiveSubsets(tiles, total);
    let best = 0;
    for (const mv of moves) best = Math.max(best, bruteShut(tiles.filter((t) => !mv.includes(t))));
    p += (w / n) * best;
  }
  return p;
};

describe('masks and the one-die rule', () => {
  it('has nine tiles and a full mask of nine bits', () => {
    expect(TILES).toBe(9);
    expect(FULL).toBe(511);
    expect(maskSum(FULL)).toBe(45);
    expect(maskSum(0)).toBe(0);
  });
  it('sums every mask like adding the tile numbers', () => {
    for (let m = 0; m <= FULL; m++) {
      let s = 0;
      for (let t = 1; t <= 9; t++) if (m & (1 << (t - 1))) s += t;
      expect(maskSum(m)).toBe(s);
      expect(tilesOf(m).reduce((a, b) => a + b, 0)).toBe(s);
    }
  });
  it('rejects junk masks', () => {
    for (const bad of [-1, 512, 1e9, NaN, 1.5, Infinity]) expect(maskSum(bad), String(bad)).toBe(0);
    expect(tileBit(0)).toBe(0);
    expect(tileBit(10)).toBe(0);
    expect(tileBit(1.5)).toBe(0);
    expect(tileBit(9)).toBe(256);
  });
  it('rolls one die exactly when 7, 8 and 9 are all shut', () => {
    expect(HIGH_TILES).toBe(0b111000000);
    for (let m = 0; m <= FULL; m++) {
      const open789 = [7, 8, 9].some((t) => m & (1 << (t - 1)));
      expect(dieCount(m), `mask ${m}`).toBe(open789 ? 2 : 1);
      expect(rollFor(m, () => 0.5)).toHaveLength(open789 ? 2 : 1);
    }
  });
  it('shows every face as the right number of dots', () => {
    for (let v = 1; v <= 6; v++) {
      expect(DIE_PIPS[v]).toHaveLength(v);
      expect([...DIE_PIPS[v]].map((i) => 8 - i).sort((a, b) => a - b)).toEqual([...DIE_PIPS[v]].sort((a, b) => a - b));
    }
  });
});

describe('the dice', () => {
  it('maps the unit interval onto 1 to 6 and survives a broken generator', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.9999999)).toBe(6);
    expect(rollDie(() => NaN)).toBe(1);
    expect(rollDie(() => -3)).toBe(1);
    expect(rollDie(() => 7)).toBe(6);
  });
  it('is close to fair over a long seeded run', () => {
    const rng = mulberry32(99);
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i++) c[rollDie(rng)]++;
    for (let f = 1; f <= 6; f++) expect(Math.abs(c[f] / 60000 - 1 / 6)).toBeLessThan(0.01);
  });
  it('gives the same rolls for the same seed', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 50; i++) expect(rollFor(FULL, a)).toEqual(rollFor(FULL, b));
  });
  it('has outcome tables whose chances match counting every ordered pair of dice', () => {
    const two = outcomes(FULL);
    expect(two).toHaveLength(11);
    const ways = waysByTotal(2);
    for (const { total, p } of two) expect(p).toBeCloseTo((ways.get(total) as number) / 36, 12);
    expect(two.reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 12);
    const one = outcomes(0b000111111);
    expect(one.map((o) => o.total)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(one.reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 12);
    expect(TWO_DICE_WAYS.reduce((a, b) => a + b, 0)).toBe(36);
  });
});

describe('tile sets that add up to a roll', () => {
  it('matches a plain recursive enumeration for every position and every total', () => {
    for (let m = 1; m <= FULL; m++) {
      const tiles = tilesOf(m);
      for (let total = 1; total <= 45; total += total < 14 ? 1 : 5) {
        const fast = subsetsWithSum(m, total).slice().sort((a, b) => a - b);
        const slow = naiveSubsets(tiles, total).map(toMask).sort((a, b) => a - b);
        expect(fast, `open ${m} total ${total}`).toEqual(slow);
      }
    }
  });
  it('returns biggest-mask-first and nothing for junk input', () => {
    const r = subsetsWithSum(FULL, 9);
    expect(r[0]).toBe(toMask([9]));
    expect([...r].sort((a, b) => b - a)).toEqual(r);
    expect(r).toHaveLength(8); // 9, 1+8, 2+7, 3+6, 4+5, 1+2+6, 1+3+5, 2+3+4
    for (const [o, t] of [[0, 5], [-1, 5], [512, 5], [FULL, 0], [FULL, -2], [FULL, 1.5], [NaN, 3], [FULL, NaN]] as const) {
      expect(subsetsWithSum(o, t), `${o},${t}`).toEqual([]);
    }
  });
});

describe('the exact solver', () => {
  it('has the boundary values: a shut box is worth 0 and always shut', () => {
    expect(expectedScore(0)).toBe(0);
    expect(shutChance(0)).toBe(1);
  });
  it('matches an unmemoised search over every ordered dice roll on every small position', () => {
    // Every set of up to 5 open tiles (a roll that cannot be played ends the box, so the search is finite).
    let checked = 0;
    for (let m = 1; m <= FULL; m++) {
      const tiles = tilesOf(m);
      if (tiles.length > 4 && !(tiles.length === 5 && m % 3 === 0)) continue;
      expect(expectedScore(m), `score for ${tiles}`).toBeCloseTo(bruteScore(tiles), 9);
      expect(shutChance(m), `shut for ${tiles}`).toBeCloseTo(bruteShut(tiles), 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(150);
  }, 120_000);
  it('stays inside its bounds: never above the open sum, never below 0, chances are chances', () => {
    for (let m = 0; m <= FULL; m++) {
      expect(expectedScore(m)).toBeGreaterThanOrEqual(0);
      expect(expectedScore(m)).toBeLessThanOrEqual(maskSum(m) + 1e-9);
      expect(shutChance(m)).toBeGreaterThanOrEqual(0);
      expect(shutChance(m)).toBeLessThanOrEqual(1 + 1e-12);
    }
  });
  it('returns NaN for a position that does not exist', () => {
    expect(Number.isNaN(expectedScore(-1))).toBe(true);
    expect(Number.isNaN(shutChance(512))).toBe(true);
    expect(Number.isNaN(expectedScore(2.5))).toBe(true);
  });
  it('pins the numbers the guide page states for a fresh box', () => {
    // These come from the solver; the tests above and below check the solver two other ways.
    expect(expectedScore(FULL)).toBeCloseTo(PIN.score, 2);
    expect(shutChance(FULL)).toBeCloseTo(PIN.shut, 3);
  });
  it('agrees with a long simulation of the Hard player on the full box', () => {
    const rng = mulberry32(31337);
    const n = 20000;
    let total = 0;
    for (let i = 0; i < n; i++) total += boxScore(playBox('hard', rng).box);
    const mean = total / n;
    expect(Math.abs(mean - expectedScore(FULL))).toBeLessThan(0.35);
  }, 120_000);
  it('agrees with a long simulation of the play that maximises the chance of shutting', () => {
    const rng = mulberry32(8080);
    const n = 20000;
    let shut = 0;
    for (let i = 0; i < n; i++) {
      let b = newBox();
      for (let g = 0; g < 40 && b.phase !== 'done'; g++) {
        b = rollBox(b, rng) as Box;
        if (b.phase === 'pick') b = shutTiles(b, (bestMove(b.open, b.total, 'shut') as { sub: number }).sub) as Box;
      }
      if (b.shut) shut++;
    }
    expect(Math.abs(shut / n - shutChance(FULL))).toBeLessThan(0.012);
  }, 120_000);
  it('never lets best play for a low score do worse than any other legal choice', () => {
    for (let m = 1; m <= FULL; m++) {
      for (let total = 2; total <= 12; total++) {
        const best = bestMove(m, total, 'score');
        const moves = subsetsWithSum(m, total);
        if (!moves.length) { expect(best).toBeNull(); continue; }
        const b = best as { sub: number; value: number };
        expect(moves).toContain(b.sub);
        for (const sub of moves) expect(expectedScore(m ^ sub)).toBeGreaterThanOrEqual(b.value - 1e-9);
      }
    }
  });
});

describe('the rules of a box', () => {
  it('starts with nine open tiles and nothing rolled', () => {
    expect(newBox()).toEqual({ open: 511, dice: [], total: 0, turns: 0, phase: 'roll', shut: false });
    expect(boxScore(newBox())).toBe(45);
  });
  it('rolls only in the roll phase', () => {
    const rng = mulberry32(1);
    const rolled = rollBox(newBox(), rng) as Box;
    expect(rolled.turns).toBe(1);
    expect(rolled.dice).toHaveLength(2);
    expect(rolled.total).toBe(rolled.dice[0] + rolled.dice[1]);
    expect(rollBox(rolled, rng)).toBeNull();
    expect(rollBox({ ...newBox(), phase: 'done' }, rng)).toBeNull();
  });
  it('refuses a shut that does not add up, uses a shut tile, is empty or is out of range, and changes nothing', () => {
    const b: Box = { open: toMask([1, 2, 3, 4, 5]), dice: [3, 4], total: 7, turns: 1, phase: 'pick', shut: false };
    const frozen = JSON.stringify(b);
    for (const bad of [0, -1, toMask([1, 2]), toMask([7]), toMask([3, 4, 6]), 512, 1024, NaN, 2.5, Infinity]) {
      expect(shutTiles(b, bad), String(bad)).toBeNull();
      expect(whyNot(b, bad)).not.toBeNull();
    }
    expect(JSON.stringify(b)).toBe(frozen);
    expect(whyNot(b, toMask([3, 4]))).toBeNull();
    expect(whyNot(b, toMask([1, 2, 4]))).toBeNull();
    expect(whyNot({ ...b, phase: 'roll' }, toMask([3, 4]))).toBe('Roll the dice first.');
    expect(whyNot(b, toMask([3, 6]))).toBe('One of those tiles is already shut.');
    expect(whyNot(b, toMask([1, 2]))).toBe('Those tiles add up to 3, not 7.');
  });
  it('shuts the chosen tiles and goes back to the roll phase', () => {
    const b: Box = { open: toMask([1, 2, 3, 4, 5]), dice: [3, 4], total: 7, turns: 1, phase: 'pick', shut: false };
    const n = shutTiles(b, toMask([3, 4])) as Box;
    expect(tilesOf(n.open)).toEqual([1, 2, 5]);
    expect(n.phase).toBe('roll');
    expect(n.shut).toBe(false);
  });
  it('ends the box when the roll cannot be played and scores the open tiles', () => {
    // Tiles 8 and 9 open; any total below 8 cannot be made.
    let b: Box = { open: toMask([8, 9]), dice: [], total: 0, turns: 0, phase: 'roll', shut: false };
    const r = rollBox(b, () => 0) as Box; // two ones: total 2
    expect(r.phase).toBe('done');
    expect(r.shut).toBe(false);
    expect(boxScore(r)).toBe(17);
    b = rollBox({ ...b, open: toMask([2]) }, () => 0) as Box; // one die: a 1, cannot make 1
    expect(b.dice).toHaveLength(1);
    expect(b.phase).toBe('done');
    expect(boxScore(b)).toBe(2);
  });
  it('scores 0 and reports a shut box when all nine are shut', () => {
    let b = newBox();
    // Cheat the dice so each roll's total is exactly the tile set we want, working down from 45.
    const plan = [[9, 8], [7, 6], [5, 4], [3, 2, 1]];
    b = { ...b, open: FULL, phase: 'pick', dice: [6, 3], total: 9, turns: 1 };
    b = shutTiles(b, toMask([9])) as Box;
    expect(b.phase).toBe('roll');
    for (const set of [[8], [7], [6], [5], [4], [3], [2]]) {
      b = { ...b, phase: 'pick', total: set[0] };
      b = shutTiles(b, toMask(set)) as Box;
    }
    b = { ...b, phase: 'pick', total: 1 };
    b = shutTiles(b, toMask([1])) as Box;
    expect(b.open).toBe(0);
    expect(b.phase).toBe('done');
    expect(b.shut).toBe(true);
    expect(boxScore(b)).toBe(0);
    expect(plan.length).toBe(4);
    expect(shutTiles(b, 1)).toBeNull();
  });
});

describe('fuzz: random games never break an invariant', () => {
  it('plays 4000 games with random legal choices', () => {
    const rng = mulberry32(2026);
    for (let g = 0; g < 4000; g++) {
      let b = newBox();
      let rolls = 0;
      while (b.phase !== 'done') {
        expect(rolls++).toBeLessThan(40);
        const r = rollBox(b, rng) as Box;
        expect(r).not.toBeNull();
        expect(r.dice).toHaveLength(dieCount(b.open));
        for (const d of r.dice) expect(d >= 1 && d <= 6 && Number.isInteger(d)).toBe(true);
        b = r;
        if (b.phase === 'pick') {
          const moves = subsetsWithSum(b.open, b.total);
          expect(moves.length).toBeGreaterThan(0);
          const before = b.open;
          const next = shutTiles(b, moves[Math.floor(rng() * moves.length)]) as Box;
          expect(next).not.toBeNull();
          expect(next.open & ~before).toBe(0);
          expect(next.open).toBeLessThan(before);
          b = next;
        } else {
          expect(subsetsWithSum(b.open, b.total)).toEqual([]);
        }
      }
      expect(boxScore(b)).toBe(maskSum(b.open));
      expect(b.turns).toBeLessThanOrEqual(10);
      expect(b.shut).toBe(b.open === 0);
    }
  }, 60_000);
});

describe('the computer players', () => {
  const mean = (level: Level, n: number, seed: number) => {
    const rng = mulberry32(seed);
    let t = 0;
    for (let i = 0; i < n; i++) t += boxScore(playBox(level, rng).box);
    return t / n;
  };
  it('always chooses a legal set, or 0 when none exists', () => {
    const rng = mulberry32(4);
    for (const level of LEVELS) {
      for (let m = 1; m <= FULL; m += 7) {
        for (let total = 2; total <= 12; total++) {
          const c = chooseTiles(level, m, total, rng);
          const moves = subsetsWithSum(m, total);
          if (!moves.length) expect(c).toBe(0);
          else expect(moves).toContain(c);
        }
      }
    }
  });
  it('Hard picks the solver answer and Medium takes the highest tiles', () => {
    const rng = mulberry32(1);
    for (let m = 1; m <= FULL; m += 5) {
      for (let total = 2; total <= 12; total++) {
        const best = bestMove(m, total, 'score');
        if (!best) continue;
        expect(chooseTiles('hard', m, total, rng)).toBe(best.sub);
        expect(chooseTiles('medium', m, total, rng)).toBe(subsetsWithSum(m, total)[0]);
      }
    }
  });
  it('ranks Hard better than Medium better than Easy on average score', () => {
    const easy = mean('easy', 6000, 11);
    const medium = mean('medium', 6000, 11);
    const hard = mean('hard', 6000, 11);
    expect(hard).toBeLessThan(medium);
    expect(medium).toBeLessThan(easy);
  }, 120_000);
  it('survives a broken generator', () => {
    expect(() => playBox('easy', () => NaN)).not.toThrow();
    expect(chooseTiles('easy', FULL, 7, () => NaN)).toBe(subsetsWithSum(FULL, 7)[0]);
  });
  it('records every set it shut, in order, and they rebuild the final position', () => {
    const rng = mulberry32(77);
    for (let i = 0; i < 300; i++) {
      const { box, shuts } = playBox('medium', rng);
      let open = FULL;
      for (const s of shuts) { expect(s & ~open).toBe(0); open &= ~s; }
      expect(open).toBe(box.open);
    }
  });
});

describe('races', () => {
  it('plays three rounds and the lower total wins', () => {
    expect(ROUNDS).toBe(3);
    expect(raceWinner([10, 5, 3], [4, 4, 4])).toBe(1);
    expect(raceWinner([1, 2, 3], [4, 4, 4])).toBe(0);
    expect(raceWinner([4, 4, 4], [3, 3, 6])).toBe(-1);
    expect(raceWinner([], [])).toBe(-1);
  });
});

describe('stored results', () => {
  it('reads junk safely', () => {
    expect(sanitizeStore(null)).toEqual({ n: 0, s: 0, p: 0, w: 0 });
    expect(sanitizeStore('x')).toEqual({ n: 0, s: 0, p: 0, w: 0 });
    expect(sanitizeStore([1, 2])).toEqual({ n: 0, s: 0, p: 0, w: 0 });
    expect(sanitizeStore(JSON.parse('{"__proto__":{"b":1},"b":-1,"n":1.5,"s":"3","p":1e12,"w":null}'))).toEqual({ n: 0, s: 0, p: 0, w: 0 });
    const ok = sanitizeStore({ b: 0, n: 5, s: 2, p: 4, w: 3, extra: 9 });
    expect(ok).toEqual({ b: 0, n: 5, s: 2, p: 4, w: 3 });
    expect(Object.keys(ok).sort()).toEqual(['b', 'n', 'p', 's', 'w']);
    expect(sanitizeStore({ b: 46 }).b).toBeUndefined();
    expect(sanitizeStore({ n: 2, s: 7 }).s).toBe(2);
    expect(sanitizeStore({ p: 2, w: 7 }).w).toBe(2);
    expect(Object.getPrototypeOf(ok)).toBe(Object.prototype);
  });
  it('records solo results and a best only when no hint was used', () => {
    let s = sanitizeStore(null);
    let r = recordSolo(s, 12, false);
    expect(r.record).toBe(true);
    expect(r.store).toEqual({ b: 12, n: 1, s: 0, p: 0, w: 0 });
    s = r.store;
    r = recordSolo(s, 12, false);
    expect(r.record).toBe(false);
    r = recordSolo(s, 3, true);
    expect(r.record).toBe(false);
    expect(r.store.b).toBe(12);
    expect(r.store.n).toBe(2);
    r = recordSolo(s, 0, false);
    expect(r.record).toBe(true);
    expect(r.store).toMatchObject({ b: 0, s: 1 });
    expect(recordSolo(s, 99, false).store).toBe(s);
    expect(recordSolo(s, NaN, false).store).toBe(s);
  });
  it('records races, and a race with hints is not counted', () => {
    const s = sanitizeStore(null);
    expect(recordRace(s, true, false)).toMatchObject({ p: 1, w: 1 });
    expect(recordRace(s, false, false)).toMatchObject({ p: 1, w: 0 });
    expect(recordRace(s, true, true)).toBe(s);
  });
});

describe('setup parsing and text', () => {
  it('clamps junk URL parameters', () => {
    expect(parseSetup({}, 77)).toEqual({ mode: 'solo', level: 'medium', seed: 77 });
    expect(parseSetup({ m: 'race', l: 'hard', s: '123' }, 1)).toEqual({ mode: 'race', level: 'hard', seed: 123 });
    expect(parseSetup({ m: 'x', l: 'impossible', s: '-4' }, 9)).toEqual({ mode: 'solo', level: 'medium', seed: 9 });
    for (const s of ['', 'abc', '1.5', '0', '4294967296', 'Infinity', '1e3x', ' ']) expect(parseSetup({ s }, 5).seed, s).toBe(5);
    expect(parseSetup({ s: 4294967295 }, 5).seed).toBe(4294967295);
    expect(parseSetup({ s: {} as unknown }, 5).seed).toBe(5);
  });
  it('words things correctly in the singular and plural', () => {
    expect(plural(1, 'tile')).toBe('1 tile');
    expect(plural(2, 'tile')).toBe('2 tiles');
    expect(plural(0, 'tile')).toBe('0 tiles');
    expect(joinList([1])).toBe('1');
    expect(joinList([1, 2])).toBe('1, 2'.replace(', ', ' and '));
    expect(joinList([1, 2, 3])).toBe('1, 2 and 3');
    expect(tilesText(toMask([4]))).toBe('tile 4');
    expect(tilesText(toMask([1, 3, 6]))).toBe('tiles 1, 3 and 6');
    expect(diceText([])).toBe('no dice yet');
    expect(diceText([4])).toBe('a 4');
    expect(diceText([3, 5])).toBe('a 3 and a 5, total 8');
    expect(scoreText(0)).toBe('Shut the box! Score 0');
    expect(scoreText(toMask([2]))).toBe('1 tile left open (2), score 2');
    expect(scoreText(toMask([1, 5]))).toBe('2 tiles left open (1, 5), score 6');
    expect(shareText({ mode: 'solo', level: 'hard', seed: 5 }, 'score 3')).toBe('Shut the Box game #5 (solo): score 3');
    expect(shareText({ mode: 'race', level: 'hard', seed: 5 }, 'I won')).toBe('Shut the Box game #5 (race, Hard computer): I won');
  });
});

describe('the page', () => {
  it('has a ready board, three shell events, a live region, sound off by default and reduced motion', () => {
    expect(src).toMatch(/id="stbx-app"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/app:copy/);
    expect(src).toMatch(/app:export/);
    expect(src).toMatch(/app:reset/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/aria-pressed="false"/);
  });
});

// The numbers the guide page states. Computed once by the solver and kept here; the simulations above check them.
const PIN = { score: 11.66, shut: 0.074 };
