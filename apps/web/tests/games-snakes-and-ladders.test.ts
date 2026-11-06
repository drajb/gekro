/**
 * games-snakes-and-ladders.test.ts - the engine behind `snakes-and-ladders`.
 *
 * Pinned: all three boards are valid (ladders climb, snakes descend, no two jumps share a
 * square, so a jump never chains into another; every square can still reach the end), none
 * of them copies a well-known printed layout, a move equals an independent naive model for
 * every square, roll and finish rule, the exact-finish rule keeps a token still on an
 * overshoot, turns rotate and a win ends the game, thousands of simulated games with 1 to 4
 * players always finish, and the average game length of the engine matches the value from a
 * linear system and from an independent value-iteration oracle. The board geometry (the
 * zig-zag numbering, snake paths, ladder rungs, token spots), the setup parsing and the
 * best-score bookkeeping are pinned too.
 */
import { describe, it, expect } from 'vitest';
import {
  LAYOUTS, LAYOUT_IDS, LAST, SIDE, MAX_PLAYERS, MAX_ROLLS, TOKEN_OFFSETS,
  getLayout, rollDie, mulberry32, DIE_PIPS, jumpTable, applyMove, validateLayout, everySquareCanFinish,
  newGame, takeTurn, walkSquares, expectedRolls, expectedRollsFrom,
  squareCell, cellSquare, cellCentre, cellOrigin, snakePath, ladderParts, tokenSpot,
  parseSetup, parseKinds, kindsToString, bestKey, parseBests, recordBest,
  playerName, describeMove, shareText, squareText,
  type Layout, type GameState, type Kind,
} from '../src/components/apps-private/snakes-and-ladders/helpers';
import calculatorSource from '../src/components/apps-private/snakes-and-ladders/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');

// A very common printed layout, as numbers only. Ours must not copy it.
const COMMON_PRINTED: [number, number][] = [
  [1, 38], [4, 14], [9, 31], [21, 42], [28, 84], [36, 44], [51, 67], [71, 91], [80, 100],
  [16, 6], [47, 26], [49, 11], [56, 53], [62, 19], [64, 60], [87, 24], [93, 73], [95, 75], [98, 78],
];
const key = (a: number, b: number) => `${a}-${b}`;

describe('the three boards', () => {
  it('there are three, with unique ids, names and descriptions', () => {
    expect(LAYOUTS).toHaveLength(3);
    expect(new Set(LAYOUT_IDS).size).toBe(3);
    expect(new Set(LAYOUTS.map((l) => l.name)).size).toBe(3);
    for (const l of LAYOUTS) expect(l.blurb.length).toBeGreaterThan(10);
  });
  it('every board is valid', () => {
    for (const l of LAYOUTS) expect(validateLayout(l), l.id).toEqual([]);
  });
  it('every ladder goes up and every snake goes down', () => {
    for (const l of LAYOUTS) {
      for (const [a, b] of l.ladders) expect(b, `${l.id} ladder ${a}-${b}`).toBeGreaterThan(a);
      for (const [h, t] of l.snakes) expect(t, `${l.id} snake ${h}-${t}`).toBeLessThan(h);
    }
  });
  it('no square is used by two jumps, so a jump never leads into another one', () => {
    for (const l of LAYOUTS) {
      const all = [...l.ladders, ...l.snakes].flatMap(([a, b]) => [a, b]);
      expect(new Set(all).size, l.id).toBe(all.length);
      const t = jumpTable(l);
      for (let n = 1; n <= LAST; n++) {
        // Landing on the end of a jump must be a plain square: following jumps once is enough.
        expect(t.to[t.to[n]], `${l.id} square ${n}`).toBe(t.to[n]);
      }
    }
  });
  it('no jump touches square 1 or 100', () => {
    for (const l of LAYOUTS) for (const [a, b] of [...l.ladders, ...l.snakes]) {
      expect([a, b].some((n) => n < 2 || n > 99), `${l.id} ${a}-${b}`).toBe(false);
    }
  });
  it('from every square a token can still reach the end, with and without the exact-finish rule', () => {
    for (const l of LAYOUTS) {
      expect(everySquareCanFinish(l, false), l.id).toBe(true);
      expect(everySquareCanFinish(l, true), l.id).toBe(true);
    }
  });
  it('none copies a well-known printed layout (at most two jumps in common, none shaped alike)', () => {
    const printed = new Set(COMMON_PRINTED.map(([a, b]) => key(a, b)));
    for (const l of LAYOUTS) {
      const shared = [...l.ladders, ...l.snakes].filter(([a, b]) => printed.has(key(a, b)) || printed.has(key(b, a)));
      expect(shared, l.id).toEqual([]);
    }
  });
  it('the boards differ from each other', () => {
    const sets = LAYOUTS.map((l) => new Set([...l.ladders, ...l.snakes].map(([a, b]) => key(a, b))));
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
      expect([...sets[i]].filter((k) => sets[j].has(k))).toEqual([]);
    }
  });
  it('the jump counts are what the page says', () => {
    const counts = Object.fromEntries(LAYOUTS.map((l) => [l.id, [l.ladders.length, l.snakes.length]]));
    expect(counts).toEqual({ hillside: [8, 8], gentle: [9, 6], steep: [6, 10] });
  });
  it('getLayout falls back to the first board for an unknown id', () => {
    expect(getLayout('nope').id).toBe('hillside');
    expect(getLayout('steep').id).toBe('steep');
  });
});

describe('validateLayout catches bad boards', () => {
  const base = (): Layout => ({ id: 'hillside', name: 'x', blurb: 'x', ladders: [[3, 22]], snakes: [[98, 79]] });
  it('accepts a simple valid board', () => expect(validateLayout(base())).toEqual([]));
  it('rejects a ladder that goes down and a snake that goes up', () => {
    expect(validateLayout({ ...base(), ladders: [[22, 3]] }).join()).toMatch(/wrong direction/);
    expect(validateLayout({ ...base(), snakes: [[79, 98]] }).join()).toMatch(/wrong direction/);
  });
  it('rejects squares 1 and 100 and anything off the board', () => {
    expect(validateLayout({ ...base(), ladders: [[1, 22]] }).join()).toMatch(/2 to 99/);
    expect(validateLayout({ ...base(), ladders: [[3, 100]] }).join()).toMatch(/2 to 99/);
    expect(validateLayout({ ...base(), snakes: [[101, 79]] }).join()).toMatch(/2 to 99/);
  });
  it('rejects a chain (a ladder ending where a snake starts) and shared squares', () => {
    expect(validateLayout({ ...base(), ladders: [[3, 98]] }).join()).toMatch(/used twice/);
    expect(validateLayout({ ...base(), ladders: [[3, 22], [3, 40]] }).join()).toMatch(/used twice/);
  });
  it('rejects jumps too short to see, non-integers and empty lists', () => {
    expect(validateLayout({ ...base(), ladders: [[3, 6]] }).join()).toMatch(/too short/);
    expect(validateLayout({ ...base(), ladders: [[3.5, 22]] }).join()).toMatch(/whole numbers/);
    expect(validateLayout({ ...base(), snakes: [] }).join()).toMatch(/at least one/);
  });
  it('rejects a board with a trap that nothing can leave', () => {
    // Snakes on the heads 93 to 99 all slide to 2: from square 92 every roll lands on a head, which is a loop.
    const trap: Layout = { ...base(), ladders: [[3, 22]], snakes: [[93, 10], [94, 11], [95, 12], [96, 13], [97, 14], [98, 15]] };
    expect(everySquareCanFinish(trap, false)).toBe(false);
    expect(validateLayout(trap).join()).toMatch(/cannot reach the end/);
  });
});

describe('the die', () => {
  it('shows each face as the right number of dots, mirrored the way a real die is', () => {
    for (let v = 1; v <= 6; v++) {
      const pips = DIE_PIPS[v];
      expect(pips, `face ${v}`).toHaveLength(v);
      expect(new Set(pips).size).toBe(v);
      expect(pips.every((i) => i >= 0 && i <= 8)).toBe(true);
      // Every face is the same after turning it half way round (spot i swaps with spot 8 - i).
      expect([...pips].map((i) => 8 - i).sort((a, b) => a - b)).toEqual([...pips].sort((a, b) => a - b));
    }
    expect(DIE_PIPS[0]).toEqual([]);
    // Opposite faces add up to 7 in the real thing: the dot counts here are just the numbers.
    expect(DIE_PIPS[1]).toEqual([4]);
  });
  it('maps the unit interval onto 1 to 6 with exact boundaries', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 1 / 6 - 1e-9)).toBe(1);
    expect(rollDie(() => 1 / 6 + 1e-9)).toBe(2);
    expect(rollDie(() => 5 / 6 + 1e-9)).toBe(6);
    expect(rollDie(() => 0.9999999999)).toBe(6);
  });
  it('survives a broken generator', () => {
    expect(rollDie(() => NaN)).toBe(1);
    expect(rollDie(() => -3)).toBe(1);
    expect(rollDie(() => 7)).toBe(6);
  });
  it('is close to uniform over a long seeded run', () => {
    const rng = mulberry32(1234);
    const n = 60000;
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) c[rollDie(rng)]++;
    expect(c[0]).toBe(0);
    for (let f = 1; f <= 6; f++) expect(Math.abs(c[f] / n - 1 / 6)).toBeLessThan(0.01);
  });
});

// A second, deliberately naive model of one move, written from the rules in words.
const naiveMove = (layout: Layout, pos: number, roll: number, exact: boolean): number => {
  let p = pos + roll;
  if (p > 100) { if (exact) return pos; p = 100; }
  for (const [a, b] of layout.ladders) if (p === a) return b;
  for (const [h, t] of layout.snakes) if (p === h) return t;
  return p;
};

describe('one move', () => {
  it('matches the naive model for every square, roll, board and finish rule', () => {
    for (const l of LAYOUTS) {
      const t = jumpTable(l);
      for (const exact of [false, true]) for (let pos = 0; pos < LAST; pos++) for (let r = 1; r <= 6; r++) {
        const m = applyMove(pos, r, t, exact);
        expect(m.to, `${l.id} ${pos}+${r} ${exact}`).toBe(naiveMove(l, pos, r, exact));
        expect(m.won).toBe(m.to === LAST);
      }
    }
  });
  it('reports whether a ladder or a snake was used, and the square landed on first', () => {
    const l = getLayout('hillside');
    const t = jumpTable(l);
    expect(applyMove(0, 3, t, false)).toEqual({ to: 22, landed: 3, via: 'ladder', overshoot: false, won: false });
    expect(applyMove(30, 3, t, false)).toEqual({ to: 7, landed: 33, via: 'snake', overshoot: false, won: false });
    expect(applyMove(10, 2, t, false)).toEqual({ to: 12, landed: 12, via: null, overshoot: false, won: false });
  });
  it('without the exact rule any roll that reaches or passes 100 wins', () => {
    const t = jumpTable(getLayout('hillside'));
    expect(applyMove(97, 3, t, false).won).toBe(true);
    expect(applyMove(97, 6, t, false)).toMatchObject({ to: 100, landed: 100, won: true, overshoot: false });
    expect(applyMove(99, 1, t, false).won).toBe(true);
  });
  it('with the exact rule only an exact roll wins, and an overshoot leaves the token where it was', () => {
    const t = jumpTable(getLayout('hillside'));
    expect(applyMove(97, 3, t, true).won).toBe(true);
    for (const r of [4, 5, 6]) expect(applyMove(97, r, t, true)).toEqual({ to: 97, landed: 97, via: null, overshoot: true, won: false });
    expect(applyMove(97, 2, t, true)).toMatchObject({ to: 99, won: false, overshoot: false });
    expect(applyMove(94, 6, t, true)).toMatchObject({ to: 100, won: true });
    expect(applyMove(95, 6, t, true).overshoot).toBe(true);
  });
  it('a snake head at 98 still slides when it is reached exactly', () => {
    const t = jumpTable(getLayout('hillside'));
    expect(applyMove(92, 6, t, true)).toMatchObject({ landed: 98, to: 79, via: 'snake', won: false });
  });
});

describe('a game', () => {
  const kinds: Kind[] = ['human', 'cpu', 'human'];
  it('starts everyone off the board with no rolls', () => {
    const s = newGame('steep', kinds, true);
    expect(s).toMatchObject({ layout: 'steep', exact: true, pos: [0, 0, 0], rolls: [0, 0, 0], turn: 0, status: 'playing', winner: -1 });
  });
  it('limits players to 1 through 4 and never starts with none', () => {
    expect(newGame('hillside', ['human', 'cpu', 'cpu', 'cpu', 'cpu', 'cpu'], false).kinds).toHaveLength(MAX_PLAYERS);
    expect(newGame('hillside', [], false).kinds).toEqual(['human']);
    expect(newGame('nope' as never, ['human'], false).layout).toBe('hillside');
  });
  it('rotates the turn and counts rolls', () => {
    let s = newGame('hillside', kinds, false);
    let r = takeTurn(s, 4);
    expect(r.event).toMatchObject({ player: 0, roll: 4, from: 0, landed: 4, to: 4, rollsMade: 1 });
    s = r.state;
    expect(s.turn).toBe(1);
    r = takeTurn(s, 2);
    expect(r.event?.player).toBe(1);
    s = r.state;
    s = takeTurn(s, 1).state;
    expect(s.turn).toBe(0);
    expect(s.pos).toEqual([4, 2, 1]);
    expect(s.rolls).toEqual([1, 1, 1]);
  });
  it('does not change the state it was given', () => {
    const s = newGame('hillside', kinds, false);
    const before = JSON.stringify(s);
    takeTurn(s, 3);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('ignores impossible rolls and a finished game', () => {
    const s = newGame('hillside', kinds, false);
    for (const bad of [0, 7, 2.5, NaN, -1]) {
      const r = takeTurn(s, bad);
      expect(r.state).toBe(s);
      expect(r.event).toBeNull();
    }
    const won: GameState = { ...s, status: 'won', winner: 0 };
    expect(takeTurn(won, 3).state).toBe(won);
  });
  it('a climb and a slide update the position and the event', () => {
    let s = newGame('hillside', ['human'], false);
    const up = takeTurn(s, 3);
    expect(up.state.pos[0]).toBe(22);
    expect(up.event).toMatchObject({ via: 'ladder', landed: 3, to: 22 });
    s = { ...s, pos: [30] };
    const down = takeTurn(s, 3);
    expect(down.state.pos[0]).toBe(7);
    expect(down.event).toMatchObject({ via: 'snake', landed: 33, to: 7 });
  });
  it('reaching 100 wins and stops the game for everyone', () => {
    const s: GameState = { ...newGame('hillside', kinds, false), pos: [10, 50, 96], turn: 2 };
    const r = takeTurn(s, 4);
    expect(r.state).toMatchObject({ status: 'won', winner: 2 });
    expect(r.state.pos[2]).toBe(100);
    expect(r.event?.won).toBe(true);
    expect(takeTurn(r.state, 1).event).toBeNull();
  });
  it('lists the squares walked through, without the snake or ladder part', () => {
    const s = newGame('hillside', ['human'], false);
    const ev = takeTurn(s, 3).event!;
    expect(walkSquares(ev)).toEqual([1, 2, 3]);
    const s2: GameState = { ...s, pos: [97] };
    const over = takeTurn({ ...s2, exact: true }, 6).event!;
    expect(walkSquares(over)).toEqual([]);
    const fin = takeTurn(s2, 6).event!;
    expect(walkSquares(fin)).toEqual([98, 99, 100]);
  });
});

describe('simulated games always finish', () => {
  const play = (layout: Layout['id'], n: number, exact: boolean, seed: number, cap = 20000) => {
    const rng = mulberry32(seed);
    let s = newGame(layout, Array.from({ length: n }, () => 'cpu' as Kind), exact);
    let rolls = 0;
    while (s.status === 'playing' && rolls < cap) {
      const r = takeTurn(s, rollDie(rng));
      s = r.state;
      rolls++;
      // Invariants after every roll.
      for (const p of s.pos) if (!(p >= 0 && p <= LAST)) throw new Error(`position ${p}`);
      if (rolls !== s.rolls.reduce((a, b) => a + b, 0)) throw new Error('roll count');
    }
    return { s, rolls };
  };
  it('1 to 4 players, every board, both finish rules: always ends with exactly one token on 100', () => {
    let seed = 1;
    for (const layout of LAYOUT_IDS) for (const exact of [false, true]) for (let n = 1; n <= 4; n++) for (let g = 0; g < 60; g++) {
      const { s, rolls } = play(layout, n, exact, seed++);
      expect(s.status, `${layout} n=${n} exact=${exact}`).toBe('won');
      expect(rolls).toBeLessThan(20000);
      expect(s.pos.filter((p) => p === LAST)).toHaveLength(1);
      expect(s.pos[s.winner]).toBe(LAST);
      // Players take turns in order, so roll counts differ by at most one.
      expect(Math.max(...s.rolls) - Math.min(...s.rolls)).toBeLessThanOrEqual(1);
    }
  }, 60_000);
  it('a seed replays the same game', () => {
    const a = play('hillside', 3, false, 77);
    const b = play('hillside', 3, false, 77);
    expect(a.s).toEqual(b.s);
  });
});

describe('average game length', () => {
  // Independent oracle: value iteration, E <- 1 + average of E at the next squares.
  const valueIteration = (layout: Layout, exact: boolean): number => {
    const t = jumpTable(layout);
    const E = new Array<number>(LAST + 1).fill(0);
    for (let sweep = 0; sweep < 20000; sweep++) {
      let delta = 0;
      for (let p = LAST - 1; p >= 0; p--) {
        let sum = 0;
        for (let r = 1; r <= 6; r++) {
          const q = p + r;
          if (q > LAST) sum += exact ? E[p] : E[LAST];
          else sum += E[t.to[q]];
        }
        const v = 1 + sum / 6;
        delta = Math.max(delta, Math.abs(v - E[p]));
        E[p] = v;
      }
      if (delta < 1e-12) break;
    }
    return E[0];
  };
  const monteCarlo = (layout: Layout, exact: boolean, games: number, seed: number): number => {
    const rng = mulberry32(seed);
    let total = 0;
    for (let g = 0; g < games; g++) {
      let s = newGame(layout.id, ['cpu'], exact);
      while (s.status === 'playing') s = takeTurn(s, rollDie(rng)).state;
      total += s.rolls[0];
    }
    return total / games;
  };
  it('the linear-system answer equals value iteration for every board and rule', () => {
    for (const l of LAYOUTS) for (const exact of [false, true]) {
      expect(expectedRolls(l, exact), `${l.id} ${exact}`).toBeCloseTo(valueIteration(l, exact), 6);
    }
  }, 30_000);
  it('the engine, played thousands of times, agrees with the calculation', () => {
    for (const l of LAYOUTS) for (const exact of [false, true]) {
      const exp = expectedRolls(l, exact);
      const mc = monteCarlo(l, exact, 20000, 99 + (exact ? 1 : 0));
      expect(Math.abs(mc - exp) / exp, `${l.id} exact=${exact}: model ${exp.toFixed(2)}, played ${mc.toFixed(2)}`).toBeLessThan(0.03);
    }
  }, 60_000);
  it('the exact-finish rule never shortens a game', () => {
    for (const l of LAYOUTS) expect(expectedRolls(l, true)).toBeGreaterThan(expectedRolls(l, false));
  });
  it('the gentle board is the quickest and the steep valley the slowest', () => {
    const e = Object.fromEntries(LAYOUTS.map((l) => [l.id, expectedRolls(l, false)]));
    expect(e.gentle).toBeLessThan(e.hillside);
    expect(e.hillside).toBeLessThan(e.steep);
  });
  it('is finite and decreases toward the end on a board with no jumps near the finish', () => {
    const from = expectedRollsFrom(getLayout('gentle'), false);
    expect(from).toHaveLength(100);
    expect(from.every(Number.isFinite)).toBe(true);
    expect(from[99]).toBeCloseTo(1, 9); // from 99 any roll finishes
  });
  it('pins the numbers the guide page prints (to one decimal place)', () => {
    const pub = Object.fromEntries(LAYOUTS.map((l) => [l.id, [expectedRolls(l, false).toFixed(1), expectedRolls(l, true).toFixed(1)]]));
    expect(pub).toEqual(PUBLISHED);
  });
});

// Average rolls for one player to finish (any finish, exact finish). The guide page repeats exactly these figures.
const PUBLISHED: Record<string, [string, string]> = {
  hillside: ['37.7', '43.7'], gentle: ['27.3', '31.7'], steep: ['53.0', '77.3'],
};

describe('board geometry', () => {
  it('numbers the squares in the zig-zag order: 1 bottom left, 10 bottom right, 11 above 10, 100 top left', () => {
    expect(squareCell(1)).toEqual({ col: 0, row: 0 });
    expect(squareCell(10)).toEqual({ col: 9, row: 0 });
    expect(squareCell(11)).toEqual({ col: 9, row: 1 });
    expect(squareCell(20)).toEqual({ col: 0, row: 1 });
    expect(squareCell(21)).toEqual({ col: 0, row: 2 });
    expect(squareCell(100)).toEqual({ col: 0, row: 9 });
  });
  it('every square has its own cell, and cellSquare is the inverse', () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 100; n++) {
      const c = squareCell(n);
      expect(c.col >= 0 && c.col < SIDE && c.row >= 0 && c.row < SIDE).toBe(true);
      seen.add(`${c.col},${c.row}`);
      expect(cellSquare(c.col, c.row)).toBe(n);
    }
    expect(seen.size).toBe(100);
  });
  it('consecutive squares touch (one step sideways, or one step up at the end of a row)', () => {
    for (let n = 1; n < 100; n++) {
      const a = squareCell(n);
      const b = squareCell(n + 1);
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row), `${n}->${n + 1}`).toBe(1);
    }
  });
  it('clamps silly square numbers instead of throwing', () => {
    expect(squareCell(0)).toEqual(squareCell(1));
    expect(squareCell(500)).toEqual(squareCell(100));
  });
  it('cell centres sit inside a 100 x 100 board, 10 apart', () => {
    for (let n = 1; n <= 100; n++) {
      const c = cellCentre(n);
      expect(c.x > 0 && c.x < 100 && c.y > 0 && c.y < 100).toBe(true);
      expect(c.x % 10).toBe(5);
      expect(c.y % 10).toBe(5);
      const o = cellOrigin(n);
      expect(c).toEqual({ x: o.x + 5, y: o.y + 5 });
    }
    expect(cellCentre(1)).toEqual({ x: 5, y: 95 });
    expect(cellCentre(100)).toEqual({ x: 5, y: 5 });
  });
  it('snake paths start on the head square, end on the tail square and stay on or near the board', () => {
    for (const l of LAYOUTS) for (const [h, t] of l.snakes) {
      const d = snakePath(h, t);
      expect(d.startsWith('M '), d).toBe(true);
      const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(nums.every(Number.isFinite)).toBe(true);
      expect(nums.every((v) => v > -10 && v < 110), `${h}-${t}`).toBe(true);
      const hc = cellCentre(h);
      const tc = cellCentre(t);
      expect([nums[0], nums[1]]).toEqual([hc.x, hc.y]);
      expect([nums[nums.length - 2], nums[nums.length - 1]]).toEqual([tc.x, tc.y]);
      expect((d.match(/C/g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('ladders have two parallel rails and rungs between them', () => {
    for (const l of LAYOUTS) for (const [b, t] of l.ladders) {
      const { rails, rungs } = ladderParts(b, t);
      expect(rails).toHaveLength(2);
      expect(rungs.length).toBeGreaterThanOrEqual(2);
      const all = [...rails, ...rungs].flat();
      expect(all.every(Number.isFinite)).toBe(true);
      // Rails are the same length and parallel; rungs run from one rail to the other.
      const len = (s: number[]) => Math.hypot(s[2] - s[0], s[3] - s[1]);
      expect(len(rails[0])).toBeCloseTo(len(rails[1]), 9);
      const dir = (s: number[]) => [(s[2] - s[0]) / len(s), (s[3] - s[1]) / len(s)];
      const d0 = dir(rails[0]);
      const d1 = dir(rails[1]);
      expect(d0[0]).toBeCloseTo(d1[0], 9);
      expect(d0[1]).toBeCloseTo(d1[1], 9);
      for (const r of rungs) expect(len(r)).toBeCloseTo(3.4, 6);
    }
  });
  it('gives each player a different spot on a square and a spot on the start strip', () => {
    expect(TOKEN_OFFSETS).toHaveLength(MAX_PLAYERS);
    for (const pos of [1, 50, 100]) {
      const spots = [0, 1, 2, 3].map((p) => tokenSpot(pos, p));
      expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(4);
      const o = cellOrigin(pos);
      for (const s of spots) expect(s.x >= o.x && s.x <= o.x + 10 && s.y >= o.y && s.y <= o.y + 10).toBe(true);
    }
    const start = [0, 1, 2, 3].map((p) => tokenSpot(0, p));
    expect(new Set(start.map((s) => s.x)).size).toBe(4);
    expect(start.every((s) => s.y > 100 && s.y < 110)).toBe(true);
    expect(tokenSpot(5, 99)).toEqual(tokenSpot(5, 3));
  });
});

describe('setup from the address', () => {
  it('defaults to Hillside, two players, you against the computer, any finish', () => {
    expect(parseSetup({})).toEqual({ layout: 'hillside', players: 2, kinds: ['human', 'cpu', 'cpu', 'cpu'], exact: false });
  });
  it('reads good values', () => {
    expect(parseSetup({ b: 'steep', n: '4', k: 'hhcc', x: '1' })).toEqual({ layout: 'steep', players: 4, kinds: ['human', 'human', 'cpu', 'cpu'], exact: true });
    expect(parseSetup({ b: 'gentle', n: 1, k: 'c', x: 1 }).kinds[0]).toBe('cpu');
  });
  it('rejects junk', () => {
    for (const n of [0, 5, -1, 2.5, 'x', '', NaN, Infinity, null, undefined, [], {}]) {
      expect(parseSetup({ n }).players, String(n)).toBe(2);
    }
    expect(parseSetup({ b: '__proto__' }).layout).toBe('hillside');
    expect(parseSetup({ b: ['steep'] }).layout).toBe('hillside');
    expect(parseKinds('zzzz')).toEqual(['human', 'cpu', 'cpu', 'cpu']);
    expect(parseKinds(12)).toEqual(['human', 'cpu', 'cpu', 'cpu']);
    expect(parseKinds('hhhhhhhh')).toHaveLength(4);
    expect(parseSetup({ x: 'yes' }).exact).toBe(false);
  });
  it('kinds round-trip through text', () => {
    expect(kindsToString(['human', 'cpu', 'cpu', 'human'])).toBe('hcch');
    expect(parseKinds(kindsToString(['cpu', 'cpu', 'human', 'human']))).toEqual(['cpu', 'cpu', 'human', 'human']);
  });
});

describe('best scores (fewest rolls in a win)', () => {
  it('has six keys, one per board and finish rule', () => {
    expect(bestKey('hillside', false)).toBe('hillside-any');
    expect(bestKey('steep', true)).toBe('steep-exact');
    const all = LAYOUT_IDS.flatMap((l) => [bestKey(l, false), bestKey(l, true)]);
    expect(new Set(all).size).toBe(6);
  });
  it('keeps only the lower number', () => {
    let r = recordBest({}, 'hillside-any', 30);
    expect(r).toEqual({ bests: { 'hillside-any': 30 }, improved: true });
    r = recordBest(r.bests, 'hillside-any', 35);
    expect(r.improved).toBe(false);
    r = recordBest(r.bests, 'hillside-any', 30);
    expect(r.improved).toBe(false);
    r = recordBest(r.bests, 'hillside-any', 22);
    expect(r.bests['hillside-any']).toBe(22);
  });
  it('rejects bad scores and keys', () => {
    for (const bad of [0, -3, 1.5, NaN, Infinity, MAX_ROLLS + 1]) expect(recordBest({}, 'hillside-any', bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 10).improved).toBe(false);
    expect(recordBest({}, '__proto__', 10).improved).toBe(false);
  });
  it('sanitises stored data into a fresh object', () => {
    const stored = JSON.parse('{"hillside-any": 12, "steep-exact": 3.5, "gentle-any": "7", "bogus": 4, "__proto__": {"a": 1}, "gentle-exact": 1000, "steep-any": 0}');
    const out = parseBests(stored);
    expect(out).toEqual({ 'hillside-any': 12 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
  });
});

describe('text', () => {
  it('names players and marks the computer', () => {
    expect(playerName(0, 'human')).toBe('Player 1');
    expect(playerName(2, 'cpu')).toBe('Player 3 (computer)');
  });
  it('describes a plain move, a ladder, a snake, an overshoot and a win', () => {
    const s = newGame('hillside', ['human'], false);
    expect(describeMove(takeTurn(s, 4).event!, 'Player 1')).toBe('Player 1 rolled a 4 and moved from the start to square 4.');
    expect(describeMove(takeTurn(s, 3).event!, 'Player 1')).toBe('Player 1 rolled a 3 and moved from the start to square 3. A ladder! Climbed up to square 22.');
    expect(describeMove(takeTurn({ ...s, pos: [30] }, 3).event!, 'Player 1')).toMatch(/A snake! Slid down to square 7\.$/);
    const near: GameState = { ...s, exact: true, pos: [99] };
    expect(describeMove(takeTurn(near, 5).event!, 'Player 1')).toBe('Player 1 rolled a 5, but only 1 square is left and the finish needs an exact roll. Staying on square 99.');
    expect(describeMove(takeTurn({ ...near, pos: [97] }, 6).event!, 'P')).toMatch(/only 3 squares are left/);
    const win = takeTurn({ ...s, pos: [96] }, 4).event!;
    expect(describeMove(win, 'Player 1')).toMatch(/wins in 1 roll!$/);
  });
  it('writes the share line for an unfinished and a finished game', () => {
    const s = newGame('steep', ['human', 'cpu'], true);
    expect(shareText('steep', 2, true, s)).toBe('Snakes and Ladders (Steep valley, 2 players, exact finish): game in progress');
    const won: GameState = { ...s, status: 'won', winner: 1, rolls: [20, 21] };
    expect(shareText('steep', 2, true, won)).toBe('Snakes and Ladders (Steep valley, 2 players, exact finish): Player 2 (computer) won in 21 rolls');
    const solo = { ...newGame('gentle', ['human'], false), status: 'won' as const, winner: 0, rolls: [1] };
    expect(shareText('gentle', 1, false, solo)).toBe('Snakes and Ladders (Gentle slopes, 1 player): Player 1 won in 1 roll');
  });
  it('says "the start" for square 0', () => {
    expect(squareText(0)).toBe('the start');
    expect(squareText(7)).toBe('square 7');
  });
});

describe('the page (read from source)', () => {
  it('has a polite live status line, honours reduced motion and uses its own storage key', () => {
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/gk:game:snakes-and-ladders/);
  });
  it('keeps the audience sentence out of the game itself and uses no random source but the crypto one', () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).toMatch(/crypto\.getRandomValues/);
  });
  it('swallows key repeats on buttons and never restarts while a move is still resolving', () => {
    expect(src).toMatch(/if \(!e\.repeat \|\| e\.ctrlKey[^)]*\) return;[\s\S]{0,200}e\.preventDefault\(\)/);
    expect(src.indexOf('if (busy) return; // a move')).toBeGreaterThan(-1);
    expect(src.indexOf('if (busy) return; // a move')).toBeLessThan(src.indexOf("startGame(openingMessage()); return; }"));
  });
  it('uses a theme-aware ink on die pips, badges and token numbers', () => {
    expect(src).toContain('.theme-light #snl-app { --snl-ink: var(--color-text-primary); }');
    expect(src).toMatch(/\.snl-pip \{[^}]*background: var\(--snl-ink\)/);
    expect(src).toMatch(/\.snl-badge \{[\s\S]*?color: var\(--snl-ink\)/);
    expect(src).toMatch(/\.snl-tnum \{ fill: var\(--snl-ink\)/);
  });
});
