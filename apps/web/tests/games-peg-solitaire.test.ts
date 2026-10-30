/**
 * games-peg-solitaire.test.ts - the engine behind `peg-solitaire`.
 *
 * Pinned: both boards have 33 and 37 holes, the English board has exactly four
 * opening moves, every jump removes exactly one peg (so a one-peg finish is
 * exactly start pegs minus one moves), undo is an exact inverse, game over and
 * the rating bands are right, and the hint solver finds a full solution from
 * the English start, never suggests an illegal move, never calls a solvable
 * position hopeless (checked against an independent brute force), and gives up
 * cleanly when its cap is hit. A parity argument worked out from the real jump
 * table shows a one-peg finish is impossible on the French board, so there the
 * best possible result is two pegs, and ratings, results and the hint say so.
 */
import { describe, it, expect } from 'vitest';
import {
  BOARD_IDS, BOARD_LABEL, GRID, DEFAULT_CAP, bestPossible, getGeometry, startPegs, pegsLeft, legalMoves, movesFrom, isLegal, applyMove, undoMove,
  isGameOver, isSolved, rating, resultLine, plural, cellName, stepFrom, findSolution, hintMove, mulberry32,
  type Geometry, type Pegs, type Move,
} from '../src/components/apps-private/peg-solitaire/helpers';

const EN = getGeometry('english');
const FR = getGeometry('french');

const at = (geo: Geometry, r: number, c: number): number => geo.at[r * GRID + c];

/** A position with pegs only at the given (row, column) squares. */
const pegsAt = (geo: Geometry, squares: [number, number][]): Pegs => {
  const p: Pegs = new Array(geo.cells).fill(0);
  for (const [r, c] of squares) p[at(geo, r, c)] = 1;
  return p;
};

/** Play random legal moves until none is left; returns every position along the way. */
const playRandom = (geo: Geometry, rng: () => number) => {
  let p = startPegs(geo);
  const moves: Move[] = [];
  const states: Pegs[] = [p];
  for (let guard = 0; guard < 200; guard++) {
    const ms = legalMoves(geo, p);
    if (!ms.length) break;
    const m = ms[Math.floor(rng() * ms.length)];
    p = applyMove(geo, p, m) as Pegs;
    moves.push(m);
    states.push(p);
  }
  return { final: p, moves, states };
};

/** Independent check: plain recursion, no memo, no bitmasks. Only used on small positions. */
const bruteSolvable = (geo: Geometry, p: Pegs): boolean => {
  if (pegsLeft(p) === 1) return true;
  for (const m of legalMoves(geo, p)) if (bruteSolvable(geo, applyMove(geo, p, m) as Pegs)) return true;
  return false;
};

describe('board geometry', () => {
  it('the English board has 33 holes and the French board 37', () => {
    expect(EN.cells).toBe(33);
    expect(FR.cells).toBe(37);
    expect(EN.at.filter((v) => v >= 0)).toHaveLength(33);
    expect(FR.at.filter((v) => v >= 0)).toHaveLength(37);
  });
  it('row widths follow the cross and the rounded cross', () => {
    const widths = (geo: Geometry) => Array.from({ length: GRID }, (_, r) => geo.rows.filter((x) => x === r).length);
    expect(widths(EN)).toEqual([3, 3, 7, 7, 7, 3, 3]);
    expect(widths(FR)).toEqual([3, 5, 7, 7, 7, 5, 3]);
  });
  it('the French board is the English board plus four holes next to the corners', () => {
    const extra: [number, number][] = [[1, 1], [1, 5], [5, 1], [5, 5]];
    for (const [r, c] of extra) { expect(at(EN, r, c)).toBe(-1); expect(at(FR, r, c)).toBeGreaterThanOrEqual(0); }
    expect(at(EN, 0, 0)).toBe(-1);
    expect(at(FR, 0, 0)).toBe(-1);
  });
  it('hole indices run in reading order and match their row and column', () => {
    for (const geo of [EN, FR]) {
      geo.rows.forEach((r, i) => { expect(geo.at[r * GRID + geo.cols[i]]).toBe(i); });
      for (let i = 1; i < geo.cells; i++) expect(geo.rows[i] * GRID + geo.cols[i]).toBeGreaterThan(geo.rows[i - 1] * GRID + geo.cols[i - 1]);
    }
  });
  it('the centre is row 4, column 4 on both boards', () => {
    for (const geo of [EN, FR]) {
      expect(geo.rows[geo.centre]).toBe(3);
      expect(geo.cols[geo.centre]).toBe(3);
    }
  });
  it('every jump line is three holes in a straight orthogonal line with the middle one between', () => {
    for (const geo of [EN, FR]) {
      expect(geo.jumps.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const { move: m } of geo.jumps) {
        const dr = geo.rows[m.to] - geo.rows[m.from];
        const dc = geo.cols[m.to] - geo.cols[m.from];
        expect(Math.abs(dr) + Math.abs(dc)).toBe(2);
        expect(dr === 0 || dc === 0).toBe(true);
        expect(geo.rows[m.over]).toBe(geo.rows[m.from] + dr / 2);
        expect(geo.cols[m.over]).toBe(geo.cols[m.from] + dc / 2);
        seen.add(`${m.from}-${m.to}`);
      }
      expect(seen.size).toBe(geo.jumps.length); // no jump listed twice
    }
  });
  it('jumps come in pairs: every jump has the same line walked the other way', () => {
    for (const geo of [EN, FR]) {
      const keys = new Set(geo.jumps.map(({ move: m }) => `${m.from}>${m.over}>${m.to}`));
      for (const { move: m } of geo.jumps) expect(keys.has(`${m.to}>${m.over}>${m.from}`)).toBe(true);
    }
  });
  it('labels and ids', () => {
    expect(BOARD_IDS).toEqual(['english', 'french']);
    expect(BOARD_LABEL.english).toBe('English (33 holes)');
    expect(BOARD_LABEL.french).toBe('French (37 holes)');
  });
});

describe('starting position', () => {
  it('has a peg in every hole except the centre', () => {
    expect(pegsLeft(startPegs(EN))).toBe(32);
    expect(pegsLeft(startPegs(FR))).toBe(36);
    for (const geo of [EN, FR]) {
      const p = startPegs(geo);
      expect(p[geo.centre]).toBe(0);
      p.forEach((v, i) => { if (i !== geo.centre) expect(v).toBe(1); });
    }
  });
  it('returns a fresh array each time', () => {
    const a = startPegs(EN);
    a[0] = 0;
    expect(startPegs(EN)[0]).toBe(1);
  });
  it('is not game over and is not solved', () => {
    for (const geo of [EN, FR]) { expect(isGameOver(geo, startPegs(geo))).toBe(false); expect(isSolved(startPegs(geo))).toBe(false); }
  });
});

describe('opening moves', () => {
  it('the English board has exactly four first moves, all into the centre, from the four arms', () => {
    const ms = legalMoves(EN, startPegs(EN));
    expect(ms).toHaveLength(4);
    expect(ms.every((m) => m.to === EN.centre)).toBe(true);
    const from = ms.map((m) => `${EN.rows[m.from]},${EN.cols[m.from]}`).sort();
    expect(from).toEqual(['1,3', '3,1', '3,5', '5,3']);
    // The jumped peg is always the one right next to the centre.
    const over = ms.map((m) => `${EN.rows[m.over]},${EN.cols[m.over]}`).sort();
    expect(over).toEqual(['2,3', '3,2', '3,4', '4,3']);
  });
  it('the French board also has exactly four first moves', () => {
    const ms = legalMoves(FR, startPegs(FR));
    expect(ms).toHaveLength(4);
    expect(ms.every((m) => m.to === FR.centre)).toBe(true);
  });
  it('movesFrom lists only the jumps of that peg', () => {
    const p = startPegs(EN);
    const from = at(EN, 1, 3);
    expect(movesFrom(EN, p, from)).toHaveLength(1);
    expect(movesFrom(EN, p, at(EN, 0, 3))).toHaveLength(0);
    expect(movesFrom(EN, p, EN.centre)).toHaveLength(0); // an empty hole has no peg to move
  });
});

describe('applying a move', () => {
  const first = legalMoves(EN, startPegs(EN))[0];
  it('moves the jumper, removes the jumped peg and empties the origin', () => {
    const next = applyMove(EN, startPegs(EN), first) as Pegs;
    expect(next[first.from]).toBe(0);
    expect(next[first.over]).toBe(0);
    expect(next[first.to]).toBe(1);
    expect(pegsLeft(next)).toBe(31);
  });
  it('does not change the input position', () => {
    const p = startPegs(EN);
    const copy = p.slice();
    applyMove(EN, p, first);
    expect(p).toEqual(copy);
  });
  it('rejects illegal jumps and returns null', () => {
    const p = startPegs(EN);
    // A real opener is accepted; the same line one step further out lands on an occupied hole.
    expect(applyMove(EN, p, { from: at(EN, 1, 3), over: at(EN, 2, 3), to: at(EN, 3, 3) })).not.toBeNull();
    expect(applyMove(EN, p, { from: at(EN, 0, 3), over: at(EN, 1, 3), to: at(EN, 2, 3) })).toBeNull();
    // Not a real jump line (diagonal / too long).
    expect(applyMove(EN, p, { from: at(EN, 1, 3), over: at(EN, 2, 3), to: at(EN, 4, 3) })).toBeNull();
    // Jumping over an empty hole.
    const after = applyMove(EN, p, first) as Pegs;
    expect(applyMove(EN, after, first)).toBeNull();
    expect(isLegal(EN, p, first)).toBe(true);
    expect(isLegal(EN, after, first)).toBe(false);
  });
  it('every legal move is accepted by applyMove and every other jump line is rejected', () => {
    const rng = mulberry32(3);
    for (const geo of [EN, FR]) {
      const { states } = playRandom(geo, rng);
      for (const p of states) {
        const legal = new Set(legalMoves(geo, p).map((m) => `${m.from}>${m.over}>${m.to}`));
        for (const { move: m } of geo.jumps) {
          const ok = applyMove(geo, p, m) !== null;
          expect(ok).toBe(legal.has(`${m.from}>${m.over}>${m.to}`));
        }
      }
    }
  });
});

describe('every jump removes exactly one peg', () => {
  for (const geo of [EN, FR]) {
    it(`${geo.id}: after any run of random legal moves, pegs = start - moves`, () => {
      const start = pegsLeft(startPegs(geo));
      for (let seed = 1; seed <= 60; seed++) {
        const { states, moves } = playRandom(geo, mulberry32(seed));
        states.forEach((p, k) => { expect(pegsLeft(p)).toBe(start - k); });
        expect(pegsLeft(states[states.length - 1])).toBe(start - moves.length);
      }
    });
    it(`${geo.id}: random games always end with no legal move left and at least one peg`, () => {
      for (let seed = 100; seed < 140; seed++) {
        const { final } = playRandom(geo, mulberry32(seed));
        expect(isGameOver(geo, final)).toBe(true);
        expect(legalMoves(geo, final)).toHaveLength(0);
        expect(pegsLeft(final)).toBeGreaterThanOrEqual(1);
      }
    });
  }
  it('so a one-peg finish takes exactly 31 moves on the English board and a two-peg finish 34 on the French board', () => {
    expect(pegsLeft(startPegs(EN)) - bestPossible(EN)).toBe(31);
    expect(pegsLeft(startPegs(FR)) - bestPossible(FR)).toBe(34);
  });
});

describe('undo', () => {
  it('undoMove exactly reverses applyMove', () => {
    const rng = mulberry32(7);
    for (const geo of [EN, FR]) {
      const { states, moves } = playRandom(geo, rng);
      for (let k = 0; k < moves.length; k++) expect(undoMove(states[k + 1], moves[k])).toEqual(states[k]);
    }
  });
  it('undoing a whole game step by step returns to the start', () => {
    for (const geo of [EN, FR]) {
      const { final, moves } = playRandom(geo, mulberry32(11));
      let p = final;
      for (let k = moves.length - 1; k >= 0; k--) p = undoMove(p, moves[k]);
      expect(p).toEqual(startPegs(geo));
    }
  });
  it('undo does not change its input', () => {
    const next = applyMove(EN, startPegs(EN), legalMoves(EN, startPegs(EN))[0]) as Pegs;
    const copy = next.slice();
    undoMove(next, legalMoves(EN, startPegs(EN))[0]);
    expect(next).toEqual(copy);
  });
});

describe('game over', () => {
  it('a single peg is game over', () => {
    expect(isGameOver(EN, pegsAt(EN, [[3, 3]]))).toBe(true);
    expect(isSolved(pegsAt(EN, [[3, 3]]))).toBe(true);
  });
  it('two pegs that cannot reach each other are game over', () => {
    const p = pegsAt(EN, [[0, 2], [6, 4]]);
    expect(isGameOver(EN, p)).toBe(true);
    expect(isSolved(p)).toBe(false);
  });
  it('two neighbouring pegs with room to jump are not game over', () => {
    expect(isGameOver(EN, pegsAt(EN, [[3, 2], [3, 3]]))).toBe(false);
  });
  it('an empty board is game over (defensive)', () => {
    expect(isGameOver(EN, new Array(EN.cells).fill(0))).toBe(true);
  });
});

describe('ratings', () => {
  it('one peg in the centre is Perfect, one elsewhere is Excellent', () => {
    expect(rating(EN, pegsAt(EN, [[3, 3]]))).toEqual({ key: 'perfect', label: 'Perfect' });
    expect(rating(EN, pegsAt(EN, [[0, 2]]))).toEqual({ key: 'excellent', label: 'Excellent' });
    expect(rating(FR, pegsAt(FR, [[1, 1]])).label).toBe('Excellent');
    expect(rating(FR, pegsAt(FR, [[3, 3]])).label).toBe('Perfect');
  });
  it('two, three, and four or more pegs', () => {
    const spots: [number, number][] = [[0, 2], [0, 4], [6, 2], [6, 4], [3, 3], [2, 2]];
    expect(rating(EN, pegsAt(EN, spots.slice(0, 2))).label).toBe('Very good');
    expect(rating(EN, pegsAt(EN, spots.slice(0, 3))).label).toBe('Good');
    for (const n of [4, 5, 6]) expect(rating(EN, pegsAt(EN, spots.slice(0, n))).label).toBe('Keep trying');
    expect(rating(EN, startPegs(EN)).label).toBe('Keep trying');
  });
  it('the centre only matters when exactly one peg is left', () => {
    expect(rating(EN, pegsAt(EN, [[3, 3], [0, 2]])).key).toBe('very-good');
  });
  it('the best possible result is one peg on the English board and two on the French board', () => {
    expect(bestPossible(EN)).toBe(1);
    expect(bestPossible(FR)).toBe(2);
  });
  it('French ratings are shifted by one: two pegs is Perfect, then 3, 4, 5, 6 or more', () => {
    const spots: [number, number][] = [[0, 2], [0, 4], [6, 2], [6, 4], [3, 3], [2, 2], [4, 4]];
    const labels = [2, 3, 4, 5, 6, 7].map((n) => rating(FR, pegsAt(FR, spots.slice(0, n))).label);
    expect(labels).toEqual(['Perfect', 'Excellent', 'Very good', 'Good', 'Keep trying', 'Keep trying']);
    expect(rating(FR, startPegs(FR)).label).toBe('Keep trying');
  });
  it('the French result line says two pegs is the best possible on that board', () => {
    expect(resultLine(FR, pegsAt(FR, [[0, 2], [6, 4]]))).toBe('Perfect: 2 pegs left, the best possible on this board.');
    expect(resultLine(FR, pegsAt(FR, [[0, 2], [6, 4], [2, 2]]))).toBe('Excellent: 3 pegs left.');
    expect(resultLine(EN, pegsAt(EN, [[0, 2], [6, 4]]))).toBe('Very good: 2 pegs left.');
  });
  it('result lines use plain words and singular and plural correctly', () => {
    expect(resultLine(EN, pegsAt(EN, [[3, 3]]))).toBe('Perfect: 1 peg left, in the centre hole.');
    expect(resultLine(EN, pegsAt(EN, [[0, 2]]))).toBe('Excellent: 1 peg left, outside the centre hole.');
    expect(resultLine(EN, pegsAt(EN, [[0, 2], [6, 4]]))).toBe('Very good: 2 pegs left.');
    expect(resultLine(EN, pegsAt(EN, [[0, 2], [6, 4], [2, 2], [4, 4]]))).toBe('Keep trying: 4 pegs left.');
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
  });
});

describe('keyboard stepping and names', () => {
  it('steps to the next hole in a direction and stays put at an edge', () => {
    const c = EN.centre;
    expect(stepFrom(EN, c, 0, 1)).toBe(at(EN, 3, 4));
    expect(stepFrom(EN, c, -1, 0)).toBe(at(EN, 2, 3));
    expect(stepFrom(EN, at(EN, 3, 6), 0, 1)).toBe(at(EN, 3, 6));
    expect(stepFrom(EN, at(EN, 0, 2), -1, 0)).toBe(at(EN, 0, 2));
  });
  it('never lands on an off-board corner', () => {
    // English: the squares above row 3, column 2 (counting from 1) are off the board, so the cursor stays.
    expect(stepFrom(EN, at(EN, 2, 1), -1, 0)).toBe(at(EN, 2, 1));
    // French: the square directly above is a hole, so the same step moves up one.
    expect(stepFrom(FR, at(FR, 2, 1), -1, 0)).toBe(at(FR, 1, 1));
  });
  it('names a hole by row and column, counting from 1', () => {
    expect(cellName(EN, EN.centre)).toBe('row 4, column 4');
    expect(cellName(EN, at(EN, 0, 2))).toBe('row 1, column 3');
  });
});

describe('solver', () => {
  it('finds a full solution from the English start that ends with one peg in the centre', () => {
    const r = findSolution(EN, startPegs(EN), { target: 'centre', cap: DEFAULT_CAP });
    expect(r.status).toBe('found');
    expect(r.moves).toHaveLength(31);
    expect(r.nodes).toBeLessThanOrEqual(DEFAULT_CAP);
    let p = startPegs(EN);
    for (const m of r.moves) {
      expect(isLegal(EN, p, m)).toBe(true);
      p = applyMove(EN, p, m) as Pegs;
    }
    expect(pegsLeft(p)).toBe(1);
    expect(p[EN.centre]).toBe(1);
    expect(rating(EN, p).label).toBe('Perfect');
    expect(isGameOver(EN, p)).toBe(true);
  });
  it('the default target accepts one peg anywhere and is also a legal 31-move line', () => {
    const r = findSolution(EN, startPegs(EN));
    expect(r.status).toBe('found');
    expect(r.moves).toHaveLength(31);
    let p = startPegs(EN);
    for (const m of r.moves) p = applyMove(EN, p, m) as Pegs;
    expect(pegsLeft(p)).toBe(1);
  });
  it('is deterministic', () => {
    const a = findSolution(EN, startPegs(EN), { target: 'centre' });
    const b = findSolution(EN, startPegs(EN), { target: 'centre' });
    expect(b).toEqual(a);
    const c = findSolution(EN, startPegs(EN), { target: 'single' });
    const d = findSolution(EN, startPegs(EN), { target: 'single' });
    expect(d).toEqual(c);
  });
  it('does not change the position it is given', () => {
    const p = startPegs(EN);
    const copy = p.slice();
    findSolution(EN, p);
    expect(p).toEqual(copy);
  });
  it('solves three in a row in one move, and an already-finished position in none', () => {
    const three = pegsAt(EN, [[3, 1], [3, 2]]);
    const r = findSolution(EN, three);
    expect(r.status).toBe('found');
    expect(r.moves).toHaveLength(1);
    expect(findSolution(EN, pegsAt(EN, [[3, 3]]))).toMatchObject({ status: 'found', moves: [] });
    // One peg that is not in the centre does not satisfy the centre target.
    expect(findSolution(EN, pegsAt(EN, [[0, 2]]), { target: 'centre' }).status).toBe('none');
  });
  it('reports none, not capped, when the search finishes without a finish', () => {
    const stuck = pegsAt(EN, [[0, 2], [6, 4]]);
    expect(findSolution(EN, stuck)).toMatchObject({ status: 'none', moves: [] });
  });
  it('gives up with capped, never a false none, when the cap is small', () => {
    const r = findSolution(FR, startPegs(FR), { cap: 3000 });
    expect(r.status).toBe('capped');
    expect(r.moves).toEqual([]);
    expect(r.nodes).toBeLessThanOrEqual(3001);
    const tiny = findSolution(EN, startPegs(EN), { cap: 5 });
    expect(tiny.status).toBe('capped');
  });
  it('a capped search records no false dead ends: rerunning with a bigger cap still finds the solution', () => {
    const dead = new Set<number>();
    expect(findSolution(EN, startPegs(EN), { cap: 40, dead }).status).toBe('capped');
    const r = findSolution(EN, startPegs(EN), { dead });
    expect(r.status).toBe('found');
    expect(r.moves).toHaveLength(31);
  });
  it('a shared dead set makes the repeat search cheaper or equal', () => {
    const rng = mulberry32(21);
    const { states } = playRandom(EN, rng);
    const p = states[Math.max(0, states.length - 9)];
    const dead = new Set<number>();
    const first = findSolution(EN, p, { cap: 100000, dead });
    const again = findSolution(EN, p, { cap: 100000, dead });
    expect(again.status).toBe(first.status);
    if (first.status !== 'capped') expect(again.nodes).toBeLessThanOrEqual(first.nodes);
  });
  it('the cap is documented as 80000', () => {
    expect(DEFAULT_CAP).toBe(80000);
  });
});

describe('the French board cannot end on one peg (parity, from the real jump table)', () => {
  /**
   * Every marking w of the holes with 0 or 1 such that w(from) + w(over) + w(to) is even on every
   * jump line keeps the parity of the marked pegs fixed through a game (a jump takes away two pegs
   * and adds one on the same line). Gaussian elimination over GF(2) gives all such markings. A single
   * last peg at hole p needs w(p) to equal the starting parity for every marking.
   */
  const finalHoles = (geo: Geometry): number[] => {
    const n = geo.cells;
    const rows = geo.jumps.map(({ move: m }) => {
      const r: number[] = new Array(n).fill(0);
      r[m.from] ^= 1; r[m.over] ^= 1; r[m.to] ^= 1;
      return r;
    });
    const pivots: number[] = [];
    let rank = 0;
    for (let c = 0; c < n && rank < rows.length; c++) {
      const p = rows.findIndex((r, i) => i >= rank && r[c] === 1);
      if (p < 0) continue;
      [rows[rank], rows[p]] = [rows[p], rows[rank]];
      for (let i = 0; i < rows.length; i++) if (i !== rank && rows[i][c] === 1) for (let k = 0; k < n; k++) rows[i][k] ^= rows[rank][k];
      pivots.push(c);
      rank++;
    }
    const basis: number[][] = [];
    for (let f = 0; f < n; f++) {
      if (pivots.includes(f)) continue;
      const w: number[] = new Array(n).fill(0);
      w[f] = 1;
      pivots.forEach((pc, i) => { if (rows[i][f] === 1) w[pc] = 1; });
      basis.push(w);
    }
    // Sanity: each marking really has an even total on every jump line.
    for (const w of basis) for (const { move: m } of geo.jumps) expect((w[m.from] + w[m.over] + w[m.to]) % 2).toBe(0);
    const holes: number[] = [];
    for (let p = 0; p < n; p++) {
      const ok = basis.every((w) => {
        let start = 0;
        for (let i = 0; i < n; i++) if (i !== geo.centre) start ^= w[i];
        return w[p] === start;
      });
      if (ok) holes.push(p);
    }
    return holes;
  };
  const coords = (geo: Geometry, holes: number[]) => holes.map((h) => `${geo.rows[h]},${geo.cols[h]}`).sort();

  it('on the English board a last peg can only be in the centre or at the tip of an arm', () => {
    expect(coords(EN, finalHoles(EN))).toEqual(['0,3', '3,0', '3,3', '3,6', '6,3']);
  });
  it('on the French board no hole at all is possible for a single last peg', () => {
    expect(finalHoles(FR)).toEqual([]);
  });
  it('a one-peg search on the French board never reports a find', () => {
    const r = findSolution(FR, startPegs(FR), { cap: 20000 });
    expect(r.status).not.toBe('found');
  });
  it('a two-peg finish does exist on the French board: 34 legal moves', () => {
    const r = findSolution(FR, startPegs(FR), { goal: 2 });
    expect(r.status).toBe('found');
    expect(r.moves).toHaveLength(34);
    let p = startPegs(FR);
    for (const m of r.moves) {
      expect(isLegal(FR, p, m)).toBe(true);
      p = applyMove(FR, p, m) as Pegs;
    }
    expect(pegsLeft(p)).toBe(2);
    expect(isGameOver(FR, p)).toBe(true);
  });
  it('a goal of two pegs makes any position with fewer pegs a dead end', () => {
    expect(findSolution(FR, pegsAt(FR, [[3, 3]]), { goal: 2 }).status).toBe('none');
  });
});

describe('solver agrees with an independent brute force', () => {
  it('found and none match plain recursion on late-game positions of both boards', () => {
    let checked = 0;
    let solvable = 0;
    let hopeless = 0;
    // Positions from random games (mostly hopeless) plus the tail of a known full solution (all solvable).
    const lines: { geo: Geometry; states: Pegs[] }[] = [];
    for (const geo of [EN, FR]) {
      for (let seed = 1; seed <= 25; seed++) lines.push({ geo, states: playRandom(geo, mulberry32(seed * 7919)).states });
    }
    const sol = findSolution(EN, startPegs(EN));
    const solStates: Pegs[] = [startPegs(EN)];
    for (const m of sol.moves) solStates.push(applyMove(EN, solStates[solStates.length - 1], m) as Pegs);
    lines.push({ geo: EN, states: solStates });
    for (const { geo, states } of lines) {
      for (const p of states) {
        if (pegsLeft(p) > 10) continue;
        const expected = bruteSolvable(geo, p);
        const r = findSolution(geo, p);
        expect(r.status, `${geo.id} pegs ${pegsLeft(p)}`).toBe(expected ? 'found' : 'none');
        if (r.status === 'found') {
          let q = p;
          for (const m of r.moves) q = applyMove(geo, q, m) as Pegs;
          expect(pegsLeft(q)).toBe(1);
          solvable++;
        } else hopeless++;
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    // The sample must contain both kinds, or the comparison proves little.
    expect(solvable).toBeGreaterThan(0);
    expect(hopeless).toBeGreaterThan(0);
  });
});

describe('hint', () => {
  it('from the English start the hint is one of the four legal openers and the line really finishes', () => {
    const t = performance.now();
    const h = hintMove(EN, startPegs(EN));
    const ms = performance.now() - t;
    expect(h.status).toBe('found');
    expect(h.move).not.toBeNull();
    expect(isLegal(EN, startPegs(EN), h.move as Move)).toBe(true);
    expect(legalMoves(EN, startPegs(EN)).some((m) => m.from === h.move!.from && m.to === h.move!.to)).toBe(true);
    expect(ms).toBeLessThan(10000);
  });
  it('following hint after hint from the English start reaches one peg in 31 moves', () => {
    const dead = new Set<number>();
    let p = startPegs(EN);
    let moves = 0;
    while (!isGameOver(EN, p) && moves < 40) {
      const h = hintMove(EN, p, dead);
      expect(h.status).toBe('found');
      expect(isLegal(EN, p, h.move as Move)).toBe(true);
      p = applyMove(EN, p, h.move as Move) as Pegs;
      moves++;
    }
    expect(moves).toBe(31);
    expect(pegsLeft(p)).toBe(1);
  });
  it('a hint is always legal, and the position after it is still solvable, on random mid-game positions', () => {
    const rng = mulberry32(99);
    let found = 0;
    for (let g = 0; g < 30; g++) {
      const geo = g % 2 ? FR : EN;
      const { states } = playRandom(geo, rng);
      const k = Math.min(states.length - 1, 4 + Math.floor(rng() * 14));
      const p = states[k];
      if (isGameOver(geo, p)) continue;
      const t = performance.now();
      const h = hintMove(geo, p);
      expect(performance.now() - t).toBeLessThan(15000);
      if (h.status === 'found') {
        expect(isLegal(geo, p, h.move as Move)).toBe(true);
        const next = applyMove(geo, p, h.move as Move) as Pegs;
        // Fully solvable from the suggested position (the cap is generous for this).
        const after = findSolution(geo, next, { cap: 400000 });
        expect(after.status).not.toBe('none');
        found++;
      } else {
        expect(h.move).toBeNull();
        expect(['none', 'capped']).toContain(h.status);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('reports capped with no move when the cap is hit, and none when the position is hopeless', () => {
    expect(hintMove(EN, startPegs(EN), undefined, 5)).toEqual({ status: 'capped', move: null });
    expect(hintMove(EN, pegsAt(EN, [[0, 2], [6, 4]]))).toEqual({ status: 'none', move: null });
  });
  it('on the French board the hint aims for two pegs: it finds a move from the start, and hint after hint ends on two pegs in 34 moves', () => {
    const dead = new Set<number>();
    let p = startPegs(FR);
    let moves = 0;
    while (!isGameOver(FR, p) && moves < 40) {
      const h = hintMove(FR, p, dead);
      expect(h.status).toBe('found');
      expect(isLegal(FR, p, h.move as Move)).toBe(true);
      p = applyMove(FR, p, h.move as Move) as Pegs;
      moves++;
    }
    expect(moves).toBe(34);
    expect(pegsLeft(p)).toBe(2);
  });
});

describe('seeded randomness', () => {
  it('mulberry32 repeats for a seed, differs across seeds and stays in [0, 1)', () => {
    const a = mulberry32(5); const b = mulberry32(5); const c = mulberry32(6);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c())).not.toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('a random game is reproducible for a seed', () => {
    const a = playRandom(EN, mulberry32(42));
    const b = playRandom(EN, mulberry32(42));
    expect(b.moves).toEqual(a.moves);
    expect(b.final).toEqual(a.final);
  });
});
