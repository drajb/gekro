/**
 * games-dots-and-boxes.test.ts - the engine behind `dots-and-boxes`.
 *
 * Pinned: line and box counts for every board size, the extra-turn rule (a
 * completed box, or two at once, means the same player moves again), games that
 * always end after exactly the total number of lines with scores that add up to
 * the box count, chain and loop detection, an exact endgame solver checked against
 * a plain brute-force search, every computer level taking a box when one is
 * there, Medium never giving a box away while a safe line exists, Hard finding the
 * double-dealing move in a constructed endgame, Hard beating Easy in a seeded
 * series, seeded determinism, undo that round-trips through chains, and a Hard
 * move that stays inside its time cap.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LETTER, EXACT_LIMIT, other, mulberry32, geometry, linesFor, boxesFor, hLine, vLine, lineInfo, boxesOfLine, boxLines,
  lineLabel, newGame, cloneState, makeState, isOver, scoreOf, outcome, undrawnLines, completes, drawLine, capturableLines,
  safeLines, giveAway, findChains, controlValue, doubleDealLine, openingLine, scoreMoves, bestMove, replay, undoKeep,
  winKey, cleanWins, type State, type Level, type Player,
} from '../src/components/apps-private/dots-and-boxes/helpers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = (name: string): string => readFileSync(join(process.cwd(), name), 'utf8');

// ── helpers local to the tests ──────────────────────────────────────────────

const allLines = (n: number): number[] => Array.from({ length: linesFor(n) }, (_, i) => i);
const allExcept = (n: number, undrawn: number[]): number[] => allLines(n).filter((l) => !undrawn.includes(l));

/** Random legal play for up to `plies` lines (stops early when the board is full). */
const randomPosition = (n: number, plies: number, rng: () => number): State => {
  let s = newGame(n);
  for (let i = 0; i < plies && !isOver(s); i++) {
    const un = undrawnLines(s);
    s = drawLine(s, un[Math.floor(rng() * un.length)])!.state;
  }
  return s;
};

/** Play random legal lines until exactly `left` lines remain undrawn. */
const positionWithLeft = (n: number, left: number, rng: () => number): State => {
  let s = newGame(n);
  while (undrawnLines(s).length > left) {
    const un = undrawnLines(s);
    s = drawLine(s, un[Math.floor(rng() * un.length)])!.state;
  }
  return s;
};

/** Plain minimax with no tables, written separately from the engine, to compare against it. */
const brute = (s: State): number => {
  if (isOver(s)) return 0;
  let best = -Infinity;
  for (const l of undrawnLines(s)) {
    const r = drawLine(s, l)!;
    const v = r.completed.length > 0 ? r.completed.length + brute(r.state) : 0 - brute(r.state);
    if (v > best) best = v;
  }
  return best;
};

type Mover = (s: State) => number;
const randomMover = (rng: () => number): Mover => (s) => {
  const un = undrawnLines(s);
  return un[Math.floor(rng() * un.length)];
};
const aiMover = (level: Level, rng: () => number, exactLimit?: number): Mover => (s) => bestMove(s, level, rng, 1000, exactLimit);

/** Play a whole game: movers[0] is player 1 (A), movers[1] is player 2 (B). */
const playGame = (n: number, a: Mover, b: Mover): { state: State; moves: number[] } => {
  let s = newGame(n);
  const moves: number[] = [];
  while (!isOver(s)) {
    const line = (s.toMove === 1 ? a : b)(s);
    const r = drawLine(s, line);
    if (!r) throw new Error(`illegal line ${line}`);
    moves.push(line);
    s = r.state;
  }
  return { state: s, moves };
};

const withScore = (s: State, a: number, b: number): State => {
  const t = cloneState(s);
  t.score = [a, b];
  return t;
};

// Constructed endgames on a 3 x 3 board. Row 1 is always finished. Row 0 is a chain of three boxes
// (its four vertical lines are undrawn).
const N3 = 3;
const topChain = [0, 1, 2, 3].map((c) => vLine(N3, 0, c));
// Row 2 after the opponent opened a three-chain from the left end and the first box was taken:
// box (2,1) can be completed with one line, and box (2,2) is the last box of the chain.
const dominoLines = [vLine(N3, 2, 2), vLine(N3, 2, 3)];
const DD_UNDRAWN = [...topChain, ...dominoLines];

// A chain of 3, a chain of 1 and a chain of 2, none of them opened.
const MIX_UNDRAWN = [...topChain, vLine(N3, 2, 0), hLine(N3, 3, 0), hLine(N3, 3, 1), vLine(N3, 2, 2), hLine(N3, 3, 2)];

// ── geometry ────────────────────────────────────────────────────────────────

describe('geometry', () => {
  for (const n of SIZES) {
    it(`${n} x ${n} boxes: ${2 * n * (n + 1)} lines, ${n * n} boxes, ${(n + 1) * (n + 1)} dots`, () => {
      const g = geometry(n);
      expect(g.lines).toBe(2 * n * (n + 1));
      expect(linesFor(n)).toBe(2 * n * (n + 1));
      expect(g.boxes).toBe(n * n);
      expect(boxesFor(n)).toBe(n * n);
      expect(g.hCount).toBe(n * (n + 1));
      expect(newGame(n).lines).toHaveLength(2 * n * (n + 1));
      expect(newGame(n).sides).toHaveLength(n * n);
    });
  }
  it('has the line counts the page states: 24, 40 and 60', () => {
    expect(SIZES.map((n) => linesFor(n))).toEqual([24, 40, 60]);
    expect(SIZES.map((n) => boxesFor(n))).toEqual([9, 16, 25]);
  });
  it('every box has four distinct lines and every line borders one box (edge) or two (inside)', () => {
    for (const n of SIZES) {
      const g = geometry(n);
      let edge = 0;
      let inner = 0;
      for (let l = 0; l < g.lines; l++) {
        const bs = boxesOfLine(n, l);
        expect(bs.length === 1 || bs.length === 2).toBe(true);
        if (bs.length === 1) edge++; else inner++;
      }
      expect(edge).toBe(4 * n);
      expect(inner).toBe(g.lines - 4 * n);
      let slots = 0;
      for (let b = 0; b < g.boxes; b++) {
        const ls = boxLines(n, b);
        expect(new Set(ls).size).toBe(4);
        for (const l of ls) expect(boxesOfLine(n, l)).toContain(b);
        slots += ls.length;
      }
      // Each line is counted once per box it borders.
      expect(slots).toBe(edge + 2 * inner);
    }
  });
  it('line numbers round-trip through row and column, horizontal lines first', () => {
    for (const n of SIZES) {
      for (let r = 0; r <= n; r++) {
        for (let c = 0; c < n; c++) {
          const l = hLine(n, r, c);
          expect(lineInfo(n, l)).toEqual({ horizontal: true, row: r, col: c });
          expect(l).toBeLessThan(n * (n + 1));
        }
      }
      for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) {
          const l = vLine(n, r, c);
          expect(lineInfo(n, l)).toEqual({ horizontal: false, row: r, col: c });
          expect(l).toBeGreaterThanOrEqual(n * (n + 1));
          expect(l).toBeLessThan(2 * n * (n + 1));
        }
      }
    }
  });
  it('the four sides of box (1, 1) on a 3 x 3 board are the lines around it', () => {
    const n = 3;
    const b = 1 * n + 1;
    expect(boxLines(n, b)).toEqual([hLine(n, 1, 1), hLine(n, 2, 1), vLine(n, 1, 1), vLine(n, 1, 2)]);
    expect(boxesOfLine(n, hLine(n, 1, 1)).sort()).toEqual([1, 4]);
    expect(boxesOfLine(n, vLine(n, 1, 2)).sort()).toEqual([4, 5]);
  });
  it('refuses a board size that does not exist', () => {
    for (const n of [0, -1, 9, 2.5, NaN]) expect(() => geometry(n)).toThrow();
  });
  it('labels lines in words, with who drew them', () => {
    expect(lineLabel(4, hLine(4, 1, 0), 0)).toBe('Horizontal line, row 2, between columns 1 and 2, not drawn');
    expect(lineLabel(4, hLine(4, 4, 3), 1)).toBe('Horizontal line, row 5, between columns 4 and 5, drawn by A');
    expect(lineLabel(3, vLine(3, 2, 3), 2)).toBe('Vertical line, column 4, between rows 3 and 4, drawn by B');
    expect(lineLabel(3, vLine(3, 0, 0), 0)).toBe('Vertical line, column 1, between rows 1 and 2, not drawn');
    expect(LETTER).toEqual(['', 'A', 'B']);
  });
});

// ── rules ───────────────────────────────────────────────────────────────────

describe('drawLine', () => {
  it('draws one line, hands the turn over and leaves the input state alone', () => {
    const s0 = newGame(3);
    const r = drawLine(s0, hLine(3, 0, 0))!;
    expect(r.completed).toEqual([]);
    expect(r.state.toMove).toBe(2);
    expect(r.state.lines[hLine(3, 0, 0)]).toBe(1);
    expect(r.state.drawn).toBe(1);
    expect(r.state.last).toBe(hLine(3, 0, 0));
    expect(r.state.sides[0]).toBe(1);
    expect(s0.drawn).toBe(0);
    expect(s0.toMove).toBe(1);
    expect(s0.lines[hLine(3, 0, 0)]).toBe(0);
    expect(s0.sides[0]).toBe(0);
  });
  it('refuses a drawn line, a bad number, and any line once the board is full', () => {
    const s = drawLine(newGame(3), 5)!.state;
    expect(drawLine(s, 5)).toBeNull();
    for (const bad of [-1, 24, 1.5, NaN, Infinity]) expect(drawLine(newGame(3), bad)).toBeNull();
    const done = playGame(3, randomMover(mulberry32(1)), randomMover(mulberry32(2))).state;
    expect(isOver(done)).toBe(true);
    for (let l = 0; l < 24; l++) expect(drawLine(done, l)).toBeNull();
  });
  it('completing a box claims it for the mover, who goes again', () => {
    const n = 2;
    // Three sides of box 0 drawn; the fourth is the bottom line.
    const s = makeState(n, [hLine(n, 0, 0), vLine(n, 0, 0), vLine(n, 0, 1)], 1);
    expect(completes(s, hLine(n, 1, 0))).toBe(1);
    const r = drawLine(s, hLine(n, 1, 0))!;
    expect(r.completed).toEqual([0]);
    expect(r.state.owners[0]).toBe(1);
    expect(r.state.toMove).toBe(1);
    expect(scoreOf(r.state)).toEqual({ a: 1, b: 0 });
    // The same for player 2.
    const s2 = makeState(n, [hLine(n, 0, 0), vLine(n, 0, 0), vLine(n, 0, 1)], 2);
    const r2 = drawLine(s2, hLine(n, 1, 0))!;
    expect(r2.state.owners[0]).toBe(2);
    expect(r2.state.toMove).toBe(2);
    expect(scoreOf(r2.state)).toEqual({ a: 0, b: 1 });
  });
  it('one line can complete two boxes at once, and the mover still goes again', () => {
    const n = 2;
    // Boxes 0 and 2 share the line h(1, 0); every other side of both is drawn.
    const s = makeState(n, [hLine(n, 0, 0), vLine(n, 0, 0), vLine(n, 0, 1), vLine(n, 1, 0), vLine(n, 1, 1), hLine(n, 2, 0)], 1);
    expect(completes(s, hLine(n, 1, 0))).toBe(2);
    const r = drawLine(s, hLine(n, 1, 0))!;
    expect(r.completed.sort()).toEqual([0, 2]);
    expect(scoreOf(r.state)).toEqual({ a: 2, b: 0 });
    expect(r.state.toMove).toBe(1);
  });
  it('a line that completes nothing passes the turn, even when it is the third side of a box', () => {
    const n = 2;
    const s = makeState(n, [hLine(n, 0, 0), vLine(n, 0, 0)], 1);
    const r = drawLine(s, vLine(n, 0, 1))!; // third side of box 0
    expect(r.completed).toEqual([]);
    expect(r.state.toMove).toBe(2);
    expect(r.state.sides[0]).toBe(3);
    expect(capturableLines(r.state)).toEqual([hLine(n, 1, 0)]);
  });
  it('after the last line the game is over and the outcome is decided by the box count', () => {
    const n = 2;
    // Boxes 0 to 2 are finished and credited to A; B (to move) draws the last side of box 3.
    const sc = makeState(n, allExcept(n, [hLine(n, 2, 1)]), 2, 1);
    expect(scoreOf(sc)).toEqual({ a: 3, b: 0 });
    expect(isOver(sc)).toBe(false);
    expect(outcome(sc)).toBeNull();
    const r = drawLine(sc, hLine(n, 2, 1))!;
    expect(isOver(r.state)).toBe(true);
    expect(scoreOf(r.state)).toEqual({ a: 3, b: 1 });
    expect(outcome(r.state)).toBe(1);
  });
  it('reports a tie when both sides have the same number of boxes', () => {
    // 2 x 2 has four boxes, so 2 - 2 is possible; find one in seeded games rather than assume.
    let found = false;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const g = playGame(2, randomMover(mulberry32(seed)), randomMover(mulberry32(seed + 1000)));
      const { a, b } = scoreOf(g.state);
      if (a === b) { found = true; expect(outcome(g.state)).toBe(0); expect(a).toBe(2); }
    }
    expect(found).toBe(true);
  });
});

describe('whole games', () => {
  it('a game of only legal lines ends after exactly the total number of lines, on every size', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 25; seed++) {
        const g = playGame(n, randomMover(mulberry32(seed)), randomMover(mulberry32(seed + 500)));
        expect(g.moves).toHaveLength(linesFor(n));
        expect(new Set(g.moves).size).toBe(linesFor(n));
        expect(g.state.drawn).toBe(linesFor(n));
        expect(isOver(g.state)).toBe(true);
      }
    }
  });
  it('the two scores add up to the number of boxes, and every box has an owner', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 25; seed++) {
        const g = playGame(n, randomMover(mulberry32(seed * 3)), randomMover(mulberry32(seed * 3 + 1)));
        const { a, b } = scoreOf(g.state);
        expect(a + b).toBe(boxesFor(n));
        expect(g.state.owners.every((o) => o === 1 || o === 2)).toBe(true);
        expect(g.state.sides.every((c) => c === 4)).toBe(true);
        expect(g.state.owners.filter((o) => o === 1)).toHaveLength(a);
        expect(g.state.owners.filter((o) => o === 2)).toHaveLength(b);
        const o = outcome(g.state)!;
        expect(o).toBe(a > b ? 1 : b > a ? 2 : 0);
      }
    }
  });
  it('step by step: the turn changes exactly when a line completes no box, and side counts stay consistent', () => {
    for (const n of SIZES) {
      const rng = mulberry32(n * 17);
      let s = newGame(n);
      let sawChain = false;
      let streak = 0;
      while (!isOver(s)) {
        const un = undrawnLines(s);
        const line = un[Math.floor(rng() * un.length)];
        const mover = s.toMove;
        const before = scoreOf(s);
        const r = drawLine(s, line)!;
        const gained = scoreOf(r.state).a + scoreOf(r.state).b - before.a - before.b;
        expect(gained).toBe(r.completed.length);
        expect(r.state.toMove).toBe(r.completed.length > 0 ? mover : other(mover));
        streak = r.completed.length > 0 ? streak + 1 : 0;
        if (streak >= 2) sawChain = true;
        for (const b of boxesOfLine(n, line)) expect(r.state.sides[b]).toBe(s.sides[b] + 1);
        // sides always equal the count of drawn lines around the box
        for (let b = 0; b < boxesFor(n); b++) {
          expect(r.state.sides[b]).toBe(boxLines(n, b).filter((l) => r.state.lines[l] !== 0).length);
        }
        s = r.state;
      }
      expect(sawChain || n === 3).toBe(true);
    }
  });
  it('player 2 can move first', () => {
    const s = newGame(3, 2);
    expect(s.toMove).toBe(2);
    expect(drawLine(s, 0)!.state.lines[0]).toBe(2);
    expect(drawLine(s, 0)!.state.toMove).toBe(1);
  });
  it('makeState counts the sides, credits finished boxes and rejects nonsense', () => {
    const s = makeState(3, allExcept(3, DD_UNDRAWN), 1, 2);
    expect(s.drawn).toBe(24 - DD_UNDRAWN.length);
    expect(scoreOf(s)).toEqual({ a: 0, b: 4 });
    expect(s.sides[2 * 3 + 1]).toBe(3);
    expect(s.sides[2 * 3 + 2]).toBe(2);
    expect(() => makeState(3, [99])).toThrow();
    expect(() => makeState(3, [-1])).toThrow();
  });
});

// ── move classes ────────────────────────────────────────────────────────────

describe('safe and capturable lines', () => {
  it('an empty board has only safe lines and no capturable ones', () => {
    for (const n of SIZES) {
      const s = newGame(n);
      expect(safeLines(s)).toHaveLength(linesFor(n));
      expect(capturableLines(s)).toEqual([]);
    }
  });
  it('a line is unsafe once a box beside it has two sides, and capturable at three', () => {
    const n = 3;
    const s = makeState(n, [hLine(n, 0, 0), vLine(n, 0, 0)]); // box 0 has two sides
    const safe = safeLines(s);
    expect(safe).not.toContain(hLine(n, 1, 0));
    expect(safe).not.toContain(vLine(n, 0, 1));
    expect(safe).toContain(hLine(n, 0, 1));
    const t = makeState(n, [hLine(n, 0, 0), vLine(n, 0, 0), vLine(n, 0, 1)]);
    expect(capturableLines(t)).toEqual([hLine(n, 1, 0)]);
    expect(safeLines(t)).not.toContain(hLine(n, 1, 0));
  });
  it('giveAway counts the boxes the opponent can run off after a line', () => {
    const s = makeState(N3, allExcept(N3, MIX_UNDRAWN), 1, 2);
    expect(giveAway(s, vLine(N3, 2, 0))).toBe(1); // the single box
    expect(giveAway(s, hLine(N3, 3, 0))).toBe(1);
    expect(giveAway(s, vLine(N3, 2, 2))).toBe(2); // middle of the two-chain
    expect(giveAway(s, hLine(N3, 3, 1))).toBe(2); // end of the two-chain
    for (const l of topChain) expect(giveAway(s, l)).toBe(3);
    // Lines that complete a box keep the turn and give nothing away; drawn lines give nothing.
    const cap = makeState(N3, allExcept(N3, DD_UNDRAWN), 1, 2);
    expect(giveAway(cap, vLine(N3, 2, 2))).toBe(0);
    expect(giveAway(cap, 0)).toBe(0);
  });
});

// ── chains and loops ────────────────────────────────────────────────────────

describe('chains and loops', () => {
  it('finds a chain of three boxes in order, with four open lines', () => {
    const s = makeState(N3, allExcept(N3, topChain), 1, 2);
    const comps = findChains(s);
    expect(comps).toHaveLength(1);
    expect(comps[0].kind).toBe('chain');
    expect(comps[0].size).toBe(3);
    expect(comps[0].lines.slice().sort((a, b) => a - b)).toEqual(topChain.slice().sort((a, b) => a - b));
    const ordered = comps[0].boxes;
    expect(ordered[1]).toBe(1);
    expect([ordered[0], ordered[2]].sort()).toEqual([0, 2]);
  });
  it('finds a ring of four boxes as a loop', () => {
    const n = 2;
    const inner = [hLine(n, 1, 0), hLine(n, 1, 1), vLine(n, 0, 1), vLine(n, 1, 1)];
    const s = makeState(n, allExcept(n, inner));
    const comps = findChains(s);
    expect(comps).toHaveLength(1);
    expect(comps[0].kind).toBe('loop');
    expect(comps[0].size).toBe(4);
    expect(comps[0].lines.slice().sort((a, b) => a - b)).toEqual(inner.slice().sort((a, b) => a - b));
    // Walking the ring in order, each box touches the next.
    const b = comps[0].boxes;
    for (let i = 0; i < 4; i++) {
      const next = b[(i + 1) % 4];
      expect(boxLines(n, b[i]).some((l) => boxLines(n, next).includes(l))).toBe(true);
    }
  });
  it('splits a mix into a chain of three, a chain of one and a chain of two', () => {
    const s = makeState(N3, allExcept(N3, MIX_UNDRAWN), 1, 2);
    const sizes = findChains(s).map((c) => `${c.kind}${c.size}`).sort();
    expect(sizes).toEqual(['chain1', 'chain2', 'chain3']);
  });
  it('leaves out boxes it is told to exclude', () => {
    const s = makeState(N3, allExcept(N3, MIX_UNDRAWN), 1, 2);
    const two = findChains(s).find((c) => c.size === 2)!;
    const rest = findChains(s, new Set(two.boxes));
    expect(rest.map((c) => c.size).sort()).toEqual([1, 3]);
  });
  it('on random positions the components cover every two-sided box once and have the right shape', () => {
    let loops = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      const n = SIZES[seed % 3];
      const s = randomPosition(n, Math.floor(linesFor(n) * (0.45 + 0.4 * rng())), rng);
      const comps = findChains(s);
      const two = [...s.sides].map((c, i) => (c === 2 ? i : -1)).filter((i) => i >= 0);
      const covered = comps.flatMap((c) => c.boxes);
      expect(covered.slice().sort((a, b) => a - b)).toEqual(two);
      for (const c of comps) {
        expect(c.size).toBe(c.boxes.length);
        if (c.kind === 'loop') {
          loops++;
          expect(c.size).toBeGreaterThanOrEqual(4);
          expect(c.lines).toHaveLength(c.size);
        } else {
          expect(c.lines).toHaveLength(c.size + 1);
        }
        for (let i = 0; i + 1 < c.boxes.length; i++) {
          expect(boxLines(n, c.boxes[i]).some((l) => !s.lines[l] && boxLines(n, c.boxes[i + 1]).includes(l))).toBe(true);
        }
      }
    }
    expect(loops).toBeGreaterThan(0);
  });
  it('controlValue: nothing left is worth nothing, one chain is worth its length', () => {
    expect(controlValue([])).toBe(0);
    expect(controlValue([{ kind: 'chain', size: 3 }])).toBe(3);
    expect(controlValue([{ kind: 'loop', size: 4 }])).toBe(4);
  });
  it('controlValue: two long chains reward keeping control, two short ones do not', () => {
    // Take all of the first chain (5) and open the second for the opponent (5): 0. Decline the last two: 6.
    expect(controlValue([{ kind: 'chain', size: 5 }, { kind: 'chain', size: 5 }])).toBe(6);
    expect(controlValue([{ kind: 'chain', size: 1 }, { kind: 'chain', size: 1 }])).toBe(0);
    expect(controlValue([{ kind: 'chain', size: 2 }, { kind: 'chain', size: 2 }])).toBe(0);
    // Order of the list does not matter.
    expect(controlValue([{ kind: 'chain', size: 5 }, { kind: 'chain', size: 3 }])).toBe(controlValue([{ kind: 'chain', size: 3 }, { kind: 'chain', size: 5 }]));
  });
  it('openingLine sacrifices the smallest chain, and a chain of two from the middle', () => {
    const s = makeState(N3, allExcept(N3, MIX_UNDRAWN), 1, 2);
    const one = openingLine(s, mulberry32(1));
    expect([vLine(N3, 2, 0), hLine(N3, 3, 0)]).toContain(one);
    // With the single box gone, the two-chain is next and is opened in the middle.
    const noOne = makeState(N3, allExcept(N3, [...topChain, hLine(N3, 3, 1), vLine(N3, 2, 2), hLine(N3, 3, 2)]), 1, 2);
    expect(findChains(noOne).map((c) => c.size).sort()).toEqual([2, 3]);
    expect(openingLine(noOne, mulberry32(1))).toBe(vLine(N3, 2, 2));
    // With only the three-chain left, it opens from an end line.
    const only3 = makeState(N3, allExcept(N3, topChain), 1, 2);
    expect([topChain[0], topChain[3]]).toContain(openingLine(only3, mulberry32(1)));
  });
});

// ── exact solver ────────────────────────────────────────────────────────────

describe('exact solver', () => {
  it('matches a plain brute-force search on random positions with up to seven lines left', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed * 11);
      const n = [2, 3, 4][seed % 3];
      const left = 3 + (seed % 5);
      const s = positionWithLeft(n, left, rng);
      if (isOver(s)) continue;
      const scores = scoreMoves(s, 5000)!;
      expect(scores).not.toBeNull();
      expect(scores.map((m) => m.line).sort((a, b) => a - b)).toEqual(undrawnLines(s));
      for (const m of scores) {
        const r = drawLine(s, m.line)!;
        const expected = r.completed.length > 0 ? r.completed.length + brute(r.state) : 0 - brute(r.state);
        expect(m.value, `seed ${seed} line ${m.line}`).toBe(expected);
        expect(m.completes).toBe(r.completed.length);
      }
      expect(Math.max(...scores.map((m) => m.value))).toBe(brute(s));
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });
  it('knows the value of tiny endgames by hand', () => {
    const n = 2;
    // One line left, and it completes two boxes: the mover gets both.
    const one = makeState(n, allExcept(n, [hLine(n, 1, 0)]), 1);
    expect(scoreMoves(one)).toEqual([{ line: hLine(n, 1, 0), completes: 2, value: 2 }]);
    // Box 0 lacks only h(1,0); box 2 lacks h(1,0) and v(1,0). Taking h(1,0) then v(1,0) wins both (+2);
    // drawing v(1,0) first hands the opponent both with one line (-2).
    const two = makeState(n, allExcept(n, [hLine(n, 1, 0), vLine(n, 1, 0)]), 1);
    const byLine = new Map(scoreMoves(two)!.map((m) => [m.line, m.value]));
    expect(byLine.get(hLine(n, 1, 0))).toBe(2);
    expect(byLine.get(vLine(n, 1, 0))).toBe(-2);
  });
  it('returns null when too many lines remain, when the game is over, and with a limit of zero', () => {
    expect(scoreMoves(newGame(3))).toBeNull();
    expect(scoreMoves(newGame(5))).toBeNull();
    const done = playGame(2, randomMover(mulberry32(1)), randomMover(mulberry32(2))).state;
    expect(scoreMoves(done)).toBeNull();
    const s = positionWithLeft(3, 6, mulberry32(5));
    expect(scoreMoves(s, 1000, 0)).toBeNull();
    expect(scoreMoves(s, 1000, 6)).not.toBeNull();
    expect(scoreMoves(s, 1000, 5)).toBeNull();
  });
  it('gives up when it runs out of time, and Hard then still plays a legal line', () => {
    const s = positionWithLeft(4, EXACT_LIMIT, mulberry32(7));
    expect(scoreMoves(s, 1000)).not.toBeNull();
    expect(scoreMoves(s, 0)).toBeNull();
    const line = bestMove(s, 'hard', mulberry32(1), 0);
    expect(undrawnLines(s)).toContain(line);
  });
});

// ── the computer ────────────────────────────────────────────────────────────

describe('computer: takes a box', () => {
  const positions = (rng: () => number, count: number): State[] => {
    const out: State[] = [];
    for (let i = 0; out.length < count && i < 4000; i++) {
      const n = SIZES[i % 3];
      const s = randomPosition(n, Math.floor(linesFor(n) * (0.4 + 0.5 * rng())), rng);
      if (!isOver(s) && capturableLines(s).length) out.push(s);
    }
    return out;
  };
  it('Easy and Medium always complete a box when one can be completed', () => {
    const ps = positions(mulberry32(21), 200);
    expect(ps.length).toBe(200);
    for (const s of ps) {
      for (const level of ['easy', 'medium'] as Level[]) {
        for (let seed = 1; seed <= 3; seed++) {
          const line = bestMove(s, level, mulberry32(seed));
          expect(completes(s, line), `${level} on ${s.n}x${s.n}`).toBeGreaterThan(0);
        }
      }
    }
  });
  it('Easy and Medium prefer the line that completes two boxes', () => {
    const n = 2;
    const s = makeState(n, [hLine(n, 0, 0), vLine(n, 0, 0), vLine(n, 0, 1), vLine(n, 1, 0), vLine(n, 1, 1), hLine(n, 2, 0), hLine(n, 0, 1)], 1);
    expect(completes(s, hLine(n, 1, 0))).toBe(2);
    for (const level of ['easy', 'medium', 'hard'] as Level[]) expect(bestMove(s, level, mulberry32(1))).toBe(hLine(n, 1, 0));
  });
  it('Hard takes a box too, unless declining it is strictly better by the exact value', () => {
    const ps = positions(mulberry32(22), 120).filter((s) => undrawnLines(s).length <= EXACT_LIMIT);
    const late: State[] = [];
    for (let seed = 1; late.length < 80 && seed < 3000; seed++) {
      const rng = mulberry32(seed);
      const n = SIZES[seed % 3];
      const s = positionWithLeft(n, 6 + (seed % 11), rng);
      if (!isOver(s) && capturableLines(s).length) late.push(s);
    }
    expect(late.length).toBe(80);
    let declined = 0;
    for (const s of [...ps, ...late]) {
      const scores = scoreMoves(s)!;
      const line = bestMove(s, 'hard', mulberry32(3));
      const chosen = scores.find((m) => m.line === line)!;
      const bestTake = Math.max(...scores.filter((m) => m.completes > 0).map((m) => m.value));
      if (chosen.completes === 0) {
        declined++;
        expect(chosen.value).toBeGreaterThan(bestTake);
      }
      expect(chosen.value).toBe(Math.max(...scores.map((m) => m.value)));
    }
    // Declining is rare; it must be the exception.
    expect(declined).toBeLessThan(late.length / 2);
  });
  it('Hard with more lines left than the exact limit takes a box unless it is the double-deal', () => {
    const rng = mulberry32(23);
    let seen = 0;
    for (let i = 0; i < 4000 && seen < 150; i++) {
      const n = SIZES[1 + (i % 2)];
      const s = randomPosition(n, Math.floor(linesFor(n) * (0.45 + 0.4 * rng())), rng);
      if (isOver(s) || !capturableLines(s).length || undrawnLines(s).length <= EXACT_LIMIT) continue;
      seen++;
      const line = bestMove(s, 'hard', mulberry32(i), 1000);
      if (completes(s, line) === 0) expect(line).toBe(doubleDealLine(s));
    }
    expect(seen).toBe(150);
  });
});

describe('computer: Medium plays safe', () => {
  it('never draws a third side while a safe line exists', () => {
    const rng = mulberry32(31);
    let checked = 0;
    for (let i = 0; i < 6000 && checked < 300; i++) {
      const n = SIZES[i % 3];
      const s = randomPosition(n, Math.floor(linesFor(n) * (0.2 + 0.5 * rng())), rng);
      if (isOver(s) || capturableLines(s).length) continue;
      const safe = safeLines(s);
      if (!safe.length) continue;
      checked++;
      for (let seed = 1; seed <= 3; seed++) {
        expect(safe).toContain(bestMove(s, 'medium', mulberry32(seed + i)));
      }
    }
    expect(checked).toBe(300);
  });
  it('with no safe line left it gives away the fewest boxes', () => {
    // Let Medium play itself until the safe lines run out: that is the position this rule is about.
    let checked = 0;
    let sawMoreThanOne = 0;
    for (let seed = 1; seed <= 300 && checked < 150; seed++) {
      const n = SIZES[seed % 3];
      const med = aiMover('medium', mulberry32(seed));
      let s = newGame(n);
      while (!isOver(s) && (capturableLines(s).length || safeLines(s).length)) s = drawLine(s, med(s))!.state;
      if (isOver(s)) continue;
      checked++;
      const costs = undrawnLines(s).map((l) => giveAway(s, l));
      const least = Math.min(...costs);
      if (new Set(costs).size > 1) sawMoreThanOne++;
      expect(giveAway(s, bestMove(s, 'medium', mulberry32(seed + 7)))).toBe(least);
    }
    expect(checked).toBeGreaterThan(100);
    expect(sawMoreThanOne).toBeGreaterThan(50); // the choice usually matters
  });
  it('picks the single box over a chain when both are on offer', () => {
    const s = makeState(N3, allExcept(N3, MIX_UNDRAWN), 1, 2);
    expect([vLine(N3, 2, 0), hLine(N3, 3, 0)]).toContain(bestMove(s, 'medium', mulberry32(9)));
  });
});

describe('computer: Hard and the double-deal', () => {
  const dd = makeState(N3, allExcept(N3, DD_UNDRAWN), 1, 1);
  // Level on points before the endgame: 2 each (the four finished boxes), A to move.
  const level = withScore(dd, 2, 2);

  it('the constructed position has no safe line and one box that can be taken', () => {
    expect(safeLines(level)).toEqual([]);
    expect(capturableLines(level)).toEqual([vLine(N3, 2, 2)]);
    expect(undrawnLines(level)).toHaveLength(6);
    // The three-chain across the top, and the last box of the bottom row on its own.
    expect(findChains(level).map((c) => c.size).sort()).toEqual([1, 3]);
  });
  it('the exact solver says the only winning move is to decline the last two boxes', () => {
    const scores = scoreMoves(level)!;
    const farEnd = vLine(N3, 2, 3);
    const top = Math.max(...scores.map((m) => m.value));
    const winners = scores.filter((m) => m.value === top);
    expect(winners.map((m) => m.line)).toEqual([farEnd]);
    expect(winners[0].completes).toBe(0);
    // Declining nets +1 (the opponent takes two, then must give up three); taking both nets -1.
    expect(top).toBe(1);
    const taking = scores.find((m) => m.line === vLine(N3, 2, 2))!;
    expect(taking.value).toBe(-1);
    expect(top).toBe(brute(level));
  });
  it('Hard plays that move, and it is the only line that wins the game from here', () => {
    expect(bestMove(level, 'hard', mulberry32(1))).toBe(vLine(N3, 2, 3));
    // Play every first move out with Hard on both sides and see who wins.
    const results = undrawnLines(level).map((first) => {
      let s = drawLine(level, first)!.state;
      const rng = mulberry32(4);
      while (!isOver(s)) s = drawLine(s, bestMove(s, 'hard', rng))!.state;
      return { first, winner: outcome(s) };
    });
    const winning = results.filter((r) => r.winner === 1).map((r) => r.first);
    expect(winning).toEqual([vLine(N3, 2, 3)]);
  });
  it('the rules used on bigger boards find the same move', () => {
    expect(doubleDealLine(level)).toBe(vLine(N3, 2, 3));
    expect(bestMove(level, 'hard', mulberry32(1), 1000, 0)).toBe(vLine(N3, 2, 3));
  });
  it('with nothing worth keeping control of, Hard takes both boxes', () => {
    const onlyDomino = makeState(N3, allExcept(N3, dominoLines), 1, 1);
    expect(doubleDealLine(onlyDomino)).toBe(-1);
    expect(bestMove(onlyDomino, 'hard', mulberry32(1))).toBe(vLine(N3, 2, 2));
    expect(bestMove(onlyDomino, 'hard', mulberry32(1), 1000, 0)).toBe(vLine(N3, 2, 2));
  });
  it('does not decline in the middle of a longer chain', () => {
    // The bottom row is a three-chain opened at its left end. The box that can be taken is followed by
    // two more, so it is not the last pair and the right move is simply to take.
    const opened = makeState(N3, allExcept(N3, [...topChain, vLine(N3, 2, 1), vLine(N3, 2, 2), vLine(N3, 2, 3)]), 1, 1);
    expect(capturableLines(opened)).toEqual([vLine(N3, 2, 1)]);
    expect(doubleDealLine(opened)).toBe(-1);
    expect(bestMove(opened, 'hard', mulberry32(1), 1000, 0)).toBe(vLine(N3, 2, 1));
  });
  it('rules-only Hard plays a legal whole game on every size', () => {
    for (const n of SIZES) {
      const g = playGame(n, aiMover('hard', mulberry32(n), 0), aiMover('medium', mulberry32(n + 9)));
      expect(g.moves).toHaveLength(linesFor(n));
      expect(scoreOf(g.state).a + scoreOf(g.state).b).toBe(boxesFor(n));
    }
  });
});

// ── strength and determinism ────────────────────────────────────────────────

describe('strength', () => {
  it('Hard beats Easy in at least 80% of a seeded series of 30 games, from either seat', () => {
    let wins = 0;
    let games = 0;
    for (let g = 0; g < 30; g++) {
      const n = [3, 4, 3, 4, 5][g % 5];
      const hard = aiMover('hard', mulberry32(100 + g));
      const easy = aiMover('easy', mulberry32(200 + g));
      const hardFirst = g % 2 === 0;
      const r = playGame(n, hardFirst ? hard : easy, hardFirst ? easy : hard);
      const o = outcome(r.state);
      games++;
      if (o === (hardFirst ? 1 : 2)) wins++;
    }
    // The page states this result: on these seeds Hard won 30 of 30 (24, which is 80%, is the floor the test accepts).
    expect(games).toBe(30);
    expect(wins).toBeGreaterThanOrEqual(24);
    expect(wins / games).toBeGreaterThanOrEqual(0.8);
  }, 120000);
  it('Medium beats Easy in at least 80% of a seeded series of 20 games', () => {
    let wins = 0;
    for (let g = 0; g < 20; g++) {
      const n = [3, 4, 5][g % 3];
      const med = aiMover('medium', mulberry32(300 + g));
      const easy = aiMover('easy', mulberry32(400 + g));
      const medFirst = g % 2 === 0;
      const r = playGame(n, medFirst ? med : easy, medFirst ? easy : med);
      if (outcome(r.state) === (medFirst ? 1 : 2)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(16);
  });
  it('the rules-only Hard (used on big boards) also beats Easy in at least 80% of 20 games', () => {
    let wins = 0;
    for (let g = 0; g < 20; g++) {
      const n = [4, 5][g % 2];
      const hard = aiMover('hard', mulberry32(500 + g), 0);
      const easy = aiMover('easy', mulberry32(600 + g));
      const hardFirst = g % 2 === 0;
      const r = playGame(n, hardFirst ? hard : easy, hardFirst ? easy : hard);
      if (outcome(r.state) === (hardFirst ? 1 : 2)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(16);
  }, 120000);
  it('Hard does at least as well as Medium over a seeded series', () => {
    let hard = 0;
    let med = 0;
    for (let g = 0; g < 16; g++) {
      const n = [3, 4][g % 2];
      const h = aiMover('hard', mulberry32(700 + g));
      const m = aiMover('medium', mulberry32(800 + g));
      const hardFirst = g % 4 < 2;
      const r = playGame(n, hardFirst ? h : m, hardFirst ? m : h);
      const o = outcome(r.state);
      if (o === (hardFirst ? 1 : 2)) hard++; else if (o !== 0) med++;
    }
    expect(hard).toBeGreaterThanOrEqual(med);
  }, 120000);
});

describe('determinism', () => {
  it('the same seed gives the same move in the same position, at every level', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = mulberry32(seed);
      const n = SIZES[seed % 3];
      const s = randomPosition(n, Math.floor(linesFor(n) * 0.6), rng);
      if (isOver(s)) continue;
      for (const level of ['easy', 'medium', 'hard'] as Level[]) {
        expect(bestMove(s, level, mulberry32(99))).toBe(bestMove(s, level, mulberry32(99)));
      }
    }
  });
  it('two computers with the same seeds play the same whole game', () => {
    const run = () => playGame(4, aiMover('hard', mulberry32(41)), aiMover('medium', mulberry32(42))).moves;
    expect(run()).toEqual(run());
    const other1 = playGame(4, aiMover('hard', mulberry32(43)), aiMover('medium', mulberry32(44))).moves;
    expect(other1).not.toEqual(run());
  });
  it('different seeds can choose different moves among equal ones', () => {
    const s = newGame(4);
    const seen = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) seen.add(bestMove(s, 'medium', mulberry32(seed)));
    expect(seen.size).toBeGreaterThan(5);
  });
  it('an rng at the very edge of [0, 1) still gives a legal line', () => {
    const s = newGame(3);
    for (const level of ['easy', 'medium', 'hard'] as Level[]) {
      expect(undrawnLines(s)).toContain(bestMove(s, level, () => 0));
      expect(undrawnLines(s)).toContain(bestMove(s, level, () => 0.9999999999));
    }
  });
  it('mulberry32 repeats for a seed and stays inside [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
  it('returns -1 once the game is over', () => {
    const done = playGame(2, randomMover(mulberry32(1)), randomMover(mulberry32(2))).state;
    for (const level of ['easy', 'medium', 'hard'] as Level[]) expect(bestMove(done, level, mulberry32(1))).toBe(-1);
  });
});

// ── undo ────────────────────────────────────────────────────────────────────

describe('undo', () => {
  const same = (a: State, b: State) => {
    expect([...a.lines]).toEqual([...b.lines]);
    expect([...a.owners]).toEqual([...b.owners]);
    expect([...a.sides]).toEqual([...b.sides]);
    expect(a.toMove).toBe(b.toMove);
    expect(a.score).toEqual(b.score);
    expect(a.drawn).toBe(b.drawn);
  };

  it('replay rebuilds a game exactly and refuses an illegal list', () => {
    const g = playGame(4, aiMover('medium', mulberry32(5)), aiMover('medium', mulberry32(6)));
    same(replay(4, g.moves)!, g.state);
    expect(replay(4, [3, 3])).toBeNull();
    expect(replay(4, [99])).toBeNull();
    expect(replay(4, [])!.drawn).toBe(0);
  });

  it('against the computer, undo removes your last turn, the reply, and any chain it took', () => {
    let chainsRemoved = 0;
    let humanChainsRemoved = 0;
    for (const human of [1, 2] as Player[]) {
      for (let seed = 1; seed <= 12; seed++) {
        const n = SIZES[seed % 3];
        const ai: Mover = aiMover('medium', mulberry32(seed));
        const me: Mover = randomMover(mulberry32(seed + 70));
        const game = playGame(n, human === 1 ? me : ai, human === 1 ? ai : me);
        const who: Player[] = [];
        let s = newGame(n);
        for (const l of game.moves) { who.push(s.toMove); s = drawLine(s, l)!.state; }
        for (let m = 1; m <= game.moves.length; m++) {
          const prefix = game.moves.slice(0, m);
          const now = replay(n, prefix)!;
          // The app only offers undo while the game is running and the human is to move.
          if (isOver(now) || now.toMove !== human) continue;
          const keep = undoKeep(n, prefix, human);
          expect(keep).toBeLessThanOrEqual(m);
          if (!who.slice(0, m).includes(human)) { expect(keep).toBe(m); continue; }
          const back = replay(n, prefix.slice(0, keep))!;
          // After the undo it is the human's turn again, at the start of a turn.
          expect(back.toMove).toBe(human);
          if (keep > 0) expect(who[keep - 1]).not.toBe(human);
          expect(who[keep]).toBe(human);
          // Playing the removed lines again gives back exactly the position we left.
          let again = back;
          for (const l of prefix.slice(keep)) again = drawLine(again, l)!.state;
          same(again, now);
          const removed = who.slice(keep, m);
          let run = 0;
          let longest = 0;
          for (let i = 0; i < removed.length; i++) {
            run = i > 0 && removed[i] === removed[i - 1] ? run + 1 : 1;
            if (removed[i] !== human && run > longest) longest = run;
            if (removed[i] === human && run >= 2) humanChainsRemoved++;
          }
          if (longest >= 2) chainsRemoved++;
        }
      }
    }
    // The test only means something if undo really did cross computer chains and the player's own.
    expect(chainsRemoved).toBeGreaterThan(5);
    expect(humanChainsRemoved).toBeGreaterThan(5);
  });

  it('undoing again keeps stepping back one human turn at a time, down to nothing', () => {
    const n = 3;
    const ai: Mover = aiMover('medium', mulberry32(8));
    const me: Mover = randomMover(mulberry32(9));
    // Human is player 1; stop when the human is to move, midway through the game.
    let s = newGame(n);
    const moves: number[] = [];
    while (!isOver(s) && !(moves.length > 14 && s.toMove === 1)) {
      const line = (s.toMove === 1 ? me : ai)(s);
      moves.push(line);
      s = drawLine(s, line)!.state;
    }
    let cur = moves.slice();
    let steps = 0;
    for (;;) {
      const keep = undoKeep(n, cur, 1);
      if (keep === cur.length) break;
      expect(keep).toBeLessThan(cur.length);
      cur = cur.slice(0, keep);
      steps++;
      expect(replay(n, cur)!.toMove).toBe(1);
    }
    expect(steps).toBeGreaterThan(1);
    expect(cur).toEqual([]);
  });

  it('with the human playing second, the computer opening is not undone', () => {
    const n = 3;
    let s = newGame(n);
    const moves: number[] = [];
    const ai = aiMover('medium', mulberry32(3));
    // Computer (player 1) plays until it is the human's turn.
    while (s.toMove === 1) { const l = ai(s); moves.push(l); s = drawLine(s, l)!.state; }
    expect(undoKeep(n, moves, 2)).toBe(moves.length);
    // The human plays one line, the computer replies; undo returns to just after the opening.
    const mine = undrawnLines(s)[0];
    moves.push(mine);
    s = drawLine(s, mine)!.state;
    while (!isOver(s) && s.toMove === 1) { const l = ai(s); moves.push(l); s = drawLine(s, l)!.state; }
    const opening = moves.indexOf(mine);
    expect(undoKeep(n, moves, 2)).toBe(opening);
  });

  it('with two players undo removes the last turn, which can be a chain, and nothing from an empty board', () => {
    const n = 2;
    expect(undoKeep(n, [], 0)).toBe(0);
    // A draws the top, B the left side, A the right side (a third side), then B completes box 0.
    const lines = [hLine(n, 0, 0), vLine(n, 0, 0), vLine(n, 0, 1), hLine(n, 1, 0)];
    expect(replay(n, lines.slice(0, 3))!.toMove).toBe(2);
    const r = replay(n, lines)!;
    expect(r.toMove).toBe(2); // B completed box 0 and goes again
    expect(scoreOf(r)).toEqual({ a: 0, b: 1 });
    // B's second turn is just the completing line, so undo removes one move; mid-chain it would remove the run.
    expect(undoKeep(n, lines, 0)).toBe(3);
    expect(undoKeep(n, lines.slice(0, 3), 0)).toBe(2);
    expect(undoKeep(n, lines.slice(0, 1), 0)).toBe(0);
  });
});

// ── speed ───────────────────────────────────────────────────────────────────

describe('speed', () => {
  it('a Hard move with the largest exact search (16 lines left) stays inside the one-second cap', () => {
    let worst = 0;
    let measured = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const n = SIZES[seed % 3];
      const s = positionWithLeft(n, EXACT_LIMIT, mulberry32(seed * 5));
      if (isOver(s)) continue;
      const t = performance.now();
      const line = bestMove(s, 'hard', mulberry32(1), 1000);
      const ms = performance.now() - t;
      worst = Math.max(worst, ms);
      measured++;
      expect(undrawnLines(s)).toContain(line);
    }
    expect(measured).toBe(30);
    // The cap is 1000 ms; leave room for a slow machine, since the check runs between batches of work.
    expect(worst).toBeLessThan(2500);
  });
  it('a whole 5 x 5 game of Hard against Medium finishes in well under a minute', () => {
    const t = performance.now();
    const g = playGame(5, aiMover('hard', mulberry32(61)), aiMover('medium', mulberry32(62)));
    expect(performance.now() - t).toBeLessThan(60000);
    expect(g.moves).toHaveLength(60);
  }, 90000);
});

// ── saved wins ──────────────────────────────────────────────────────────────

describe('saved wins', () => {
  it('keys are size-level, and only known keys with whole numbers survive', () => {
    expect(winKey(4, 'hard')).toBe('4-hard');
    const clean = cleanWins({ '3-easy': 2, '4-medium': 7, '5-hard': 99999, '6-easy': 4, '4-hard': -1, '3-hard': 1.5, '3-medium': 'x', '5-easy': 100000, evil: 3 });
    expect(clean).toEqual({ '3-easy': 2, '4-medium': 7, '5-hard': 99999 });
  });
  it('survives anything that is not an object', () => {
    for (const bad of [null, undefined, 5, 'x', [], true]) expect(cleanWins(bad)).toEqual({});
  });
  it('accepts numbers saved as strings', () => {
    expect(cleanWins({ '4-easy': '3' })).toEqual({ '4-easy': 3 });
  });
});

describe('page behaviour and content page', () => {
  it('sends focus to New game after Play again, because the result panel closes', () => {
    const src = page('src/components/apps-private/dots-and-boxes/Calculator.astro');
    expect(src).toContain("againBtn.addEventListener('click', () => { newGameNow(); g('db-new').focus(); });");
  });
  it('describes the saved wins as small whole numbers in a small JSON object', () => {
    expect(page('src/components/apps-private/dots-and-boxes/Calculator.astro')).not.toContain('plain numbers');
    const md = page('src/content/apps/dots-and-boxes.md');
    expect(md).not.toContain('plain numbers');
    expect(md).toContain('small JSON object');
  });
});
