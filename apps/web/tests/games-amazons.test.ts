/**
 * games-amazons.test.ts - the engine behind `amazons`.
 *
 * Pinned: both opening positions (4 queens each, turned half a circle into each other) and their move
 * counts (found by a separately written generator), queen slides that stop at queens and arrows, arrows that
 * stop at queens and arrows and may land on the square the queen just left, the rule that a queen with one
 * empty neighbour always has a move, the end of the game (the side that cannot move loses, never a draw, at
 * most n*n-8 moves), illegal input, a coordinate-based model compared with the engine in thousands of random
 * positions and hundreds of random games, the territory numbers (queen-move distances) against a second
 * algorithm, the quick move ranking against its definition, the exact game result on small boards against a
 * brute-force solver, the alpha-beta search against a plain minimax over the same beams, the three computer
 * levels for either side on both sizes, and the time limits.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, countMoves, destinationsFrom, arrowTargets, hasMove, applyMove, stepState, findMove, outcome, queensOf, countArrows,
  queenDistances, territory, mobility, evaluate, evaluateForSky, rankedMoves, searchValue, bestMove, mediumMove, hardMove, randomMove, chooseMove,
  mulberry32, shuffled, describeOutcome, describeMove, movesText, thinkingMessage, undoIndex, cleanLevel, cleanSize, nameOf, otherSide, cellName, rowOf, colOf, isSquare, geometry, isDecided,
  SIZES, DEFAULT_SIZE, QUEENS_EACH, MEDIUM_CANDIDATES, HARD_BEAMS, HARD_DEPTH, HARD_BUDGET_MS, HARD_NODE_CAP, lastSearchNodes, WIN_SCORE, FAR,
  SKY, AMBER, ARROW,
  type State, type Side, type Level, type Move,
} from '../src/components/apps-private/amazons/helpers';

const sig = (m: Move): string => `${m.from}>${m.to}>${m.arrow}`;

/** A position on an n by n board from [row, column] lists. */
const pos = (n: number, sky: [number, number][], amber: [number, number][], arrows: [number, number][] = [], toMove: Side = SKY): State => {
  const b = new Int8Array(n * n);
  for (const [r, c] of sky) b[r * n + c] = SKY;
  for (const [r, c] of amber) b[r * n + c] = AMBER;
  for (const [r, c] of arrows) b[r * n + c] = ARROW;
  return { n, b, toMove, plies: 0 };
};
const at = (n: number, r: number, c: number): number => r * n + c;

// ── An independent model: coordinates and loops ─────────────────────────────

type Board = number[][];
const toBoard = (s: State): Board => Array.from({ length: s.n }, (_, r) => Array.from({ length: s.n }, (_, c) => s.b[r * s.n + c]));
const D8: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const refSlides = (board: Board, r: number, c: number): [number, number][] => {
  const n = board.length;
  const out: [number, number][] = [];
  for (const [dr, dc] of D8) {
    for (let k = 1; ; k++) {
      const rr = r + dr * k;
      const cc = c + dc * k;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n || board[rr][cc] !== 0) break;
      out.push([rr, cc]);
    }
  }
  return out;
};
const refMoves = (board: Board, side: Side): string[] => {
  const n = board.length;
  const out: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (board[r][c] !== side) continue;
    for (const [tr, tc] of refSlides(board, r, c)) {
      const b2 = board.map((row) => row.slice());
      b2[r][c] = 0;
      b2[tr][tc] = side;
      for (const [ar, ac] of refSlides(b2, tr, tc)) out.push(`${r * n + c}>${tr * n + tc}>${ar * n + ac}`);
    }
  }
  return out.sort();
};
const refMobility = (board: Board, side: Side): number => {
  const n = board.length;
  let k = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (board[r][c] === side) k += refSlides(board, r, c).length;
  return k;
};
/** Queen-move distances by repeated relaxation (a different algorithm from the engine's queue). */
const refDistances = (board: Board, side: Side): number[] => {
  const n = board.length;
  const dist = new Array<number>(n * n).fill(FAR);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (board[r][c] === side) dist[r * n + c] = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const here = dist[r * n + c];
      if (here === FAR) continue;
      for (const [dr, dc] of D8) {
        for (let k = 1; ; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n || board[rr][cc] !== 0) break;
          if (dist[rr * n + cc] > here + 1) { dist[rr * n + cc] = here + 1; changed = true; }
        }
      }
    }
  }
  return dist;
};

const randomPosition = (n: number, rng: () => number, toMove?: Side): State => {
  const cells = shuffled(Array.from({ length: n * n }, (_, i) => i), rng);
  const b = new Int8Array(n * n);
  let i = 0;
  const q = 1 + Math.floor(rng() * 4);
  for (let k = 0; k < q; k++) b[cells[i++]] = SKY;
  for (let k = 0; k < q; k++) b[cells[i++]] = AMBER;
  const arrows = Math.floor(rng() * (n * n - 2 * q));
  for (let k = 0; k < arrows && i < cells.length; k++) b[cells[i++]] = ARROW;
  return { n, b, toMove: toMove ?? (rng() < 0.5 ? SKY : AMBER), plies: 0 };
};

describe('setup', () => {
  it('has 4 queens each on both sizes, Sky to move, turned half a circle into each other', () => {
    expect(QUEENS_EACH).toBe(4);
    expect(Array.from(SIZES)).toEqual([10, 6]);
    expect(DEFAULT_SIZE).toBe(10);
    for (const n of [10, 6]) {
      const s = newGame(n);
      expect(s.n).toBe(n);
      expect(queensOf(s.b, SKY)).toHaveLength(4);
      expect(queensOf(s.b, AMBER)).toHaveLength(4);
      expect(countArrows(s.b)).toBe(0);
      expect(s.toMove).toBe(SKY);
      expect(s.plies).toBe(0);
      for (let i = 0; i < n * n; i++) {
        const p = s.b[i];
        const turned = s.b[n * n - 1 - i];
        expect(turned, `n=${n} i=${i}`).toBe(p === SKY ? AMBER : p === AMBER ? SKY : 0);
      }
    }
    // 10 by 10: the classic start, queens on the third and fourth squares of the outer rows and columns.
    const t = newGame(10);
    expect(queensOf(t.b, SKY)).toEqual([at(10, 6, 0), at(10, 6, 9), at(10, 9, 3), at(10, 9, 6)]);
    expect(queensOf(t.b, AMBER)).toEqual([at(10, 0, 3), at(10, 0, 6), at(10, 3, 0), at(10, 3, 9)]);
  });
  it('the opening move counts match the model and are pinned', () => {
    const counts: Record<string, number> = {};
    for (const n of [10, 6]) {
      const s = newGame(n);
      expect(legalMoves(s).map(sig).sort()).toEqual(refMoves(toBoard(s), SKY));
      expect(countMoves(s)).toBe(legalMoves(s).length);
      counts[`${n}`] = countMoves(s);
      // The same for the other side, by symmetry.
      expect(countMoves({ ...s, toMove: AMBER })).toBe(countMoves(s));
    }
    expect(counts).toEqual({ '10': 2176, '6': 576 });
  });
  it('cleans sizes and names squares', () => {
    expect(cleanSize(6)).toBe(6);
    expect(cleanSize('6')).toBe(6);
    expect(cleanSize('10')).toBe(10);
    for (const junk of [8, 0, 11, '8', '010', 'x', '', null, undefined, NaN, 6.5, [], {}, '__proto__', true]) expect(cleanSize(junk), String(junk)).toBe(10);
    expect(cleanSize('x', 6)).toBe(6);
    expect(cellName(10, 0)).toBe('row 1, column 1');
    expect(cellName(6, 35)).toBe('row 6, column 6');
    expect(rowOf(10, 99)).toBe(9);
    expect(colOf(10, 99)).toBe(9);
    expect(isSquare(6, 35)).toBe(true);
    expect(isSquare(6, 36)).toBe(false);
    expect(isSquare(6, '1')).toBe(false);
    expect(geometry(10).cells).toBe(100);
    expect(geometry(99).n).toBe(10); // a size that is not supported falls back
  });
});

describe('queen slides and arrows', () => {
  it('a queen slides in the eight directions over empty squares and stops before a queen or an arrow', () => {
    const n = 6;
    const s = pos(n, [[2, 2]], [[2, 4]], [[4, 4], [0, 0]]);
    const d = destinationsFrom(s, at(n, 2, 2)).sort((a, b) => a - b);
    const ref = refSlides(toBoard(s), 2, 2).map(([r, c]) => r * n + c).sort((a, b) => a - b);
    expect(d).toEqual(ref);
    expect(d).not.toContain(at(n, 2, 4)); // the Amber queen
    expect(d).not.toContain(at(n, 2, 5)); // behind it
    expect(d).toContain(at(n, 2, 3));
    expect(d).not.toContain(at(n, 4, 4)); // the arrow
    expect(d).not.toContain(at(n, 5, 5)); // behind the arrow
    expect(d).toContain(at(n, 3, 3));
    expect(d).toContain(at(n, 1, 1));
    expect(d).not.toContain(at(n, 0, 0)); // an arrow
    expect(destinationsFrom(s, at(n, 0, 3))).toEqual([]); // an empty square
    expect(destinationsFrom(s, at(n, 4, 4))).toEqual([]); // an arrow
    expect(destinationsFrom(s, -1)).toEqual([]);
    expect(destinationsFrom(s, 99)).toEqual([]);
  });
  it('an arrow is shot from the queen\'s new square, stops at queens and arrows, and may land on the square the queen left', () => {
    const n = 6;
    const s = pos(n, [[2, 2]], [[2, 5]], [[0, 2]]);
    const from = at(n, 2, 2);
    const to = at(n, 2, 3);
    const targets = arrowTargets(s, from, to);
    expect(targets).toContain(from); // back onto the origin
    expect(targets).toContain(at(n, 2, 4));
    expect(targets).not.toContain(at(n, 2, 5)); // the Amber queen blocks
    expect(targets).not.toContain(at(n, 0, 2)); // not reachable from (2,3): (0,2) is not on a line from (2,3)
    // Along a line through an arrow: from (2,3) up to (0,3) is free, but the arrow on (0,2) is not on that line.
    expect(targets).toContain(at(n, 0, 3));
    // An arrow blocks the arrow behind it: put one on (1,3).
    const t = pos(n, [[2, 2]], [[2, 5]], [[1, 3]]);
    expect(arrowTargets(t, from, to)).not.toContain(at(n, 1, 3));
    expect(arrowTargets(t, from, to)).not.toContain(at(n, 0, 3));
    // An illegal queen move has no arrow targets.
    expect(arrowTargets(s, from, at(n, 4, 3))).toEqual([]);
    expect(arrowTargets(s, at(n, 3, 3), to)).toEqual([]);
  });
  it('a queen with one empty square next to it still has a move: step there and shoot back', () => {
    const n = 4;
    // Sky in the corner with arrows on two of its three neighbours.
    const s = pos(n, [[0, 0]], [[3, 3]], [[0, 1], [1, 1]]);
    expect(hasMove(s)).toBe(true);
    const moves = legalMoves(s);
    expect(moves.map(sig).sort()).toEqual(refMoves(toBoard(s), SKY));
    expect(moves.some((m) => m.to === at(n, 1, 0) && m.arrow === at(n, 0, 0))).toBe(true);
    // All three neighbours blocked: stuck.
    const t = pos(n, [[0, 0]], [[3, 3]], [[0, 1], [1, 1], [1, 0]]);
    expect(hasMove(t)).toBe(false);
    expect(legalMoves(t)).toEqual([]);
    expect(countMoves(t)).toBe(0);
    expect(outcome(t)).toEqual({ over: true, winner: AMBER, reason: 'blocked' });
    // A queen can be blocked by the other side's queens too.
    const u = pos(n, [[0, 0]], [[0, 1], [1, 0], [1, 1]], [], SKY);
    expect(hasMove(u)).toBe(false);
    expect(outcome(u).winner).toBe(AMBER);
  });
  it('hasMove, countMoves and the staged lists agree with the model in 2500 random positions on boards from 4 to 10', () => {
    const rng = mulberry32(5);
    let stuck = 0;
    for (let t = 0; t < 2500; t++) {
      const n = 4 + Math.floor(rng() * 7);
      const s = randomPosition(n, rng);
      const ref = refMoves(toBoard(s), s.toMove);
      const mine = legalMoves(s);
      expect(mine.map(sig).sort()).toEqual(ref);
      expect(countMoves(s)).toBe(ref.length);
      expect(hasMove(s)).toBe(ref.length > 0);
      expect(outcome(s).over).toBe(ref.length === 0);
      if (!ref.length) stuck++;
      // Staged: destinations and arrow targets give exactly the same set.
      const staged: string[] = [];
      for (const q of queensOf(s.b, s.toMove)) {
        for (const to of destinationsFrom(s, q)) for (const a of arrowTargets(s, q, to)) staged.push(`${q}>${to}>${a}`);
      }
      expect(staged.sort()).toEqual(ref);
      expect(mobility(s, SKY)).toBe(refMobility(toBoard(s), SKY));
      expect(mobility(s, AMBER)).toBe(refMobility(toBoard(s), AMBER));
    }
    expect(stuck).toBeGreaterThan(20);
  }, 240_000);
});

describe('playing and ending', () => {
  it('a move slides the queen, shoots the arrow, passes the turn and never captures anything', () => {
    const s = newGame(10);
    const m = legalMoves(s)[500];
    const after = applyMove(s, m)!;
    expect(after.toMove).toBe(AMBER);
    expect(after.plies).toBe(1);
    expect(after.b[m.from]).toBe(m.arrow === m.from ? ARROW : 0);
    expect(after.b[m.to]).toBe(SKY);
    expect(after.b[m.arrow]).toBe(ARROW);
    expect(countArrows(after.b)).toBe(1);
    expect(queensOf(after.b, SKY)).toHaveLength(4);
    expect(queensOf(after.b, AMBER)).toHaveLength(4);
    // Nothing was changed in the old position.
    expect(countArrows(s.b)).toBe(0);
  });
  it('plays 200 random games on each size: the side to move at the end has no move, every move added one arrow, at most n*n-8 moves, never a draw', () => {
    const rng = mulberry32(77);
    for (const n of [6, 10]) {
      let longest = 0;
      let skyWins = 0;
      for (let g = 0; g < 200; g++) {
        let s = newGame(n);
        let plies = 0;
        while (!outcome(s).over) {
          const m = randomMove(s, rng)!;
          expect(legalMoves(s).map(sig)).toContain(sig(m)); // Easy always plays a legal move
          s = applyMove(s, m)!;
          plies++;
          expect(countArrows(s.b)).toBe(plies);
          expect(queensOf(s.b, SKY)).toHaveLength(4);
          expect(queensOf(s.b, AMBER)).toHaveLength(4);
        }
        const o = outcome(s);
        expect(o.winner).toBe(otherSide(s.toMove));
        expect(hasMove(s)).toBe(false);
        expect(legalMoves(s)).toEqual([]);
        expect(plies).toBeLessThanOrEqual(n * n - 8);
        longest = Math.max(longest, plies);
        if (o.winner === SKY) skyWins++;
      }
      expect(longest).toBeGreaterThan(10);
      expect(skyWins).toBeGreaterThan(40); // both sides win sometimes
      expect(skyWins).toBeLessThan(160);
    }
  }, 240_000);
  it('describes the end and the moves', () => {
    expect(describeOutcome({ over: false, winner: null, reason: 'none' }, null)).toBe('The game is not finished.');
    expect(describeOutcome({ over: true, winner: SKY, reason: 'blocked' }, SKY)).toBe('You win: Amber has no queen that can move.');
    expect(describeOutcome({ over: true, winner: SKY, reason: 'blocked' }, AMBER)).toBe('The computer wins: Amber has no queen that can move.');
    expect(describeOutcome({ over: true, winner: AMBER, reason: 'blocked' }, null)).toBe('Amber wins: Sky has no queen that can move.');
    expect(describeMove(10, { from: 60, to: 33, arrow: 34 }, 'You')).toBe('You moved a queen from row 7, column 1 to row 4, column 4 and shot an arrow onto row 4, column 5.');
    expect(movesText(1)).toBe('1 move');
    expect(movesText(12)).toBe('12 moves');
    expect(nameOf(SKY)).toBe('Sky');
    expect(nameOf(AMBER)).toBe('Amber');
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Done.')).toBe('Done. Computer is thinking...');
  });
});

describe('illegal input', () => {
  const s = newGame(10);
  it('rejects anything that is not a legal move, and never mutates', () => {
    const copy = Array.from(s.b);
    const q = at(10, 6, 0);
    const bad: unknown[] = [
      { from: q, to: q, arrow: at(10, 5, 0) }, // no move
      { from: q, to: at(10, 5, 2), arrow: at(10, 5, 3) }, // a knight's step
      { from: q, to: at(10, 3, 0), arrow: at(10, 4, 0) }, // onto the Amber queen
      { from: q, to: at(10, 2, 0), arrow: at(10, 1, 0) }, // through the Amber queen
      { from: q, to: at(10, 5, 0), arrow: at(10, 5, 0) }, // the arrow onto the queen itself
      { from: q, to: at(10, 5, 0), arrow: at(10, 9, 0) }, // an arrow that is not on a line from the new square... (9,0) is on column 0 and free: legal; replaced below
      { from: at(10, 3, 0), to: at(10, 4, 0), arrow: at(10, 5, 0) }, // the other side's queen
      { from: at(10, 5, 5), to: at(10, 5, 6), arrow: at(10, 5, 7) }, // an empty square
      { from: 999, to: 1, arrow: 2 },
      { from: NaN, to: 1, arrow: 2 },
      { from: q, to: '1', arrow: 2 },
      { from: q, to: 1 },
      null,
      undefined,
      'x',
      {},
    ];
    for (const m of bad.filter((_, i) => i !== 5)) expect(applyMove(s, m as Move), JSON.stringify(m)).toBeNull();
    expect(applyMove(s, bad[5] as Move)).not.toBeNull();
    expect(Array.from(s.b)).toEqual(copy);
    expect(findMove(s, q, at(10, 5, 0), at(10, 4, 0))).not.toBeNull();
  });
  it('a finished game accepts no more moves', () => {
    const done = pos(4, [[0, 0]], [[3, 3]], [[0, 1], [1, 1], [1, 0]], SKY);
    expect(outcome(done).over).toBe(true);
    expect(applyMove(done, { from: 0, to: 1, arrow: 2 })).toBeNull();
  });
});

describe('territory, distances and ranking', () => {
  it('queen-move distances match a second algorithm in 600 random positions; territory counts follow from them', () => {
    const rng = mulberry32(31);
    for (let t = 0; t < 600; t++) {
      const n = 4 + Math.floor(rng() * 7);
      const s = randomPosition(n, rng);
      for (const side of [SKY, AMBER] as Side[]) {
        expect(Array.from(queenDistances(s, side)), `n=${n} side=${side}`).toEqual(refDistances(toBoard(s), side));
      }
      const a = refDistances(toBoard(s), SKY);
      const b = refDistances(toBoard(s), AMBER);
      const want = { sky: 0, amber: 0, shared: 0, unreachable: 0 };
      for (let i = 0; i < n * n; i++) {
        if (s.b[i] !== 0) continue;
        if (a[i] === FAR && b[i] === FAR) want.unreachable++;
        else if (a[i] < b[i]) want.sky++;
        else if (b[i] < a[i]) want.amber++;
        else want.shared++;
      }
      expect(territory(s)).toEqual(want);
    }
  }, 120_000);
  it('on the opening board every empty square is reached and Sky and Amber split them evenly by symmetry', () => {
    for (const n of [10, 6]) {
      const t = territory(newGame(n));
      expect(t.unreachable).toBe(0);
      expect(t.sky).toBe(t.amber);
      expect(t.sky + t.amber + t.shared).toBe(n * n - 8);
    }
  });
  it('evaluation is zero-sum between the sides and a stuck side outranks it', () => {
    const s = newGame(10);
    expect(evaluate(s)).toBe(evaluateForSky(s));
    const other = { ...s, toMove: AMBER as Side };
    expect(evaluate(other)).toBe(-evaluateForSky(other));
    expect(Math.abs(evaluate(s))).toBeLessThan(WIN_SCORE / 2);
    // A position with Sky far ahead in territory.
    const lop = pos(6, [[0, 0], [5, 5]], [[0, 5]], [[1, 5], [0, 4], [1, 4]]);
    expect(evaluateForSky(lop)).toBeGreaterThan(0);
    const stuck = pos(4, [[0, 0]], [[3, 3]], [[0, 1], [1, 1], [1, 0]], SKY);
    expect(searchValue(stuck, 3)).toBeLessThan(-WIN_SCORE / 2);
    expect(isDecided(searchValue(stuck, 3))).toBe(true);
  });
  it('rankedMoves gives the best moves by the quick score (squares my queens reach minus squares theirs do), in order, and all moves when asked', () => {
    const rng = mulberry32(12);
    for (let t = 0; t < 40; t++) {
      const n = 4 + Math.floor(rng() * 7);
      const s = randomPosition(n, rng);
      const all = legalMoves(s);
      if (!all.length) { expect(rankedMoves(s, 5)).toEqual([]); continue; }
      const score = (m: Move): number => {
        const b2 = toBoard(stepState(s, m));
        return refMobility(b2, s.toMove) - refMobility(b2, otherSide(s.toMove));
      };
      const everything = rankedMoves(s, Infinity);
      expect(everything.map(sig).sort()).toEqual(all.map(sig).sort());
      const scores = everything.map(score);
      for (let i = 1; i < scores.length; i++) expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      const k = Math.min(7, all.length);
      const top = rankedMoves(s, k);
      expect(top).toHaveLength(k);
      expect(top.map(score)).toEqual(scores.slice(0, k));
      expect(sig(rankedMoves(s, 1)[0])).toBe(sig(everything[0]));
      // Repeatable; and with an rng it is the same set of scores in a possibly different order.
      expect(rankedMoves(s, k).map(sig)).toEqual(top.map(sig));
      expect(rankedMoves(s, k, mulberry32(3)).map(score)).toEqual(scores.slice(0, k));
    }
  });
});

describe('the search', () => {
  /** Exact result of a position by brute force: +1 if the side to move wins, -1 if it loses. Memoised. */
  const solve = (s: State, memo: Map<string, number>): number => {
    const key = `${Array.from(s.b).join('')}${s.toMove}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let result = -1;
    for (const m of legalMoves(s)) {
      if (solve(stepState(s, m), memo) === -1) { result = 1; break; }
    }
    memo.set(key, result);
    return result;
  };

  it('with every move tried (an exact search) it agrees with a brute-force solver on the result of 28 small positions', () => {
    const rng = mulberry32(2026);
    let wins = 0;
    let losses = 0;
    for (let t = 0; t < 28; t++) {
      const n = 4;
      const cells = shuffled(Array.from({ length: n * n }, (_, i) => i), rng);
      const b = new Int8Array(n * n);
      b[cells[0]] = SKY;
      b[cells[1]] = AMBER;
      const arrows = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < arrows; k++) b[cells[2 + k]] = ARROW;
      const s: State = { n, b, toMove: rng() < 0.5 ? SKY : AMBER, plies: 0 };
      const truth = solve(s, new Map());
      const v = searchValue(s, 20, [Infinity]);
      expect(isDecided(v), `position ${t}`).toBe(true);
      expect(v > 0 ? 1 : -1, `position ${t}`).toBe(truth);
      if (truth === 1) {
        wins++;
        // The move it plays from a won position leaves the opponent lost.
        const m = bestMove(s, 20, mulberry32(t), [Infinity])!;
        expect(solve(stepState(s, m), new Map())).toBe(-1);
      } else losses++;
    }
    expect(wins).toBeGreaterThan(3);
    expect(losses).toBeGreaterThan(3);
  }, 240_000);

  it('the alpha-beta search gives the same value as a plain minimax over the same ranked moves, depths 1 to 3, on 6 by 6 positions from random games', () => {
    const plain = (s: State, depth: number, ply: number, beams: readonly number[]): number => {
      if (!hasMove(s)) return -(WIN_SCORE + depth);
      if (depth <= 0) return evaluate(s);
      let best = -Infinity;
      for (const m of rankedMoves(s, beams[Math.min(ply, beams.length - 1)])) best = Math.max(best, -plain(stepState(s, m), depth - 1, ply + 1, beams));
      return best;
    };
    const rng = mulberry32(9);
    let checked = 0;
    for (let g = 0; g < 10; g++) {
      let s = newGame(6);
      const stop = 3 + Math.floor(rng() * 14);
      for (let ply = 0; ply < stop && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      for (const beams of [[Infinity], [12, 6, 4], [30, 8]]) {
        for (let d = 1; d <= (beams[0] === Infinity ? 2 : 3); d++) expect(searchValue(s, d, beams) + 0, `g=${g} d=${d}`).toBe(plain(s, d, 0, beams) + 0);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  }, 280_000);
  it('a search returns a legal move, repeatable for a seed', () => {
    const rng = mulberry32(5);
    for (const n of [6, 10]) {
      let s = newGame(n);
      for (let ply = 0; ply < 8; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      const m = bestMove(s, 1, mulberry32(3), [20])!;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
      expect(sig(bestMove(s, 1, mulberry32(3), [20])!)).toBe(sig(m));
    }
  });
});

describe('computer players', () => {
  it('Easy returns a legal move for either side on both sizes, repeatable for a seed, and null when there is none', () => {
    for (const n of [6, 10]) for (const side of [SKY, AMBER] as Side[]) {
      const s = { ...newGame(n), toMove: side };
      const m = randomMove(s, mulberry32(1))!;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
      expect(sig(randomMove(s, mulberry32(1))!)).toBe(sig(m));
    }
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(sig(randomMove(newGame(10), mulberry32(i))!));
    expect(seen.size).toBeGreaterThan(30);
    const stuck = pos(4, [[0, 0]], [[3, 3]], [[0, 1], [1, 1], [1, 0]], SKY);
    expect(randomMove(stuck, mulberry32(1))).toBeNull();
    expect(chooseMove(stuck, 'hard', mulberry32(1))).toBeNull();
    expect(chooseMove(stuck, 'medium', mulberry32(1))).toBeNull();
  });
  it('every level plays a legal move for either side on both sizes in positions from random games; Medium is repeatable, Hard with a fixed clock', () => {
    const rng = mulberry32(21);
    const fast = { now: () => 0, maxDepth: 2 };
    for (const n of [6, 10]) {
      for (let g = 0; g < 6; g++) {
        let s = newGame(n);
        for (let ply = 0; ply < g * 3 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
        if (outcome(s).over) continue;
        for (const level of ['easy', 'medium', 'hard'] as Level[]) {
          const m = chooseMove(s, level, mulberry32(g), fast)!;
          expect(legalMoves(s).map(sig)).toContain(sig(m));
          if (level !== 'easy') expect(sig(chooseMove(s, level, mulberry32(g), fast)!)).toBe(sig(m));
        }
      }
    }
  }, 240_000);
  it('the computer takes a win in one move when there is one (Medium and Hard)', () => {
    // 5 by 5: Amber's queen at the corner has exactly one free square; Sky can fill it with an arrow and win at once.
    const s = pos(5, [[4, 4], [4, 0]], [[0, 0]], [[0, 1], [1, 1]], SKY);
    expect(hasMove({ ...s, toMove: AMBER })).toBe(true);
    for (const level of ['medium', 'hard'] as Level[]) {
      const m = chooseMove(s, level, mulberry32(1), { now: () => 0, maxDepth: 2 })!;
      const after = applyMove(s, m)!;
      expect(outcome(after), `${level} ${sig(m)}`).toEqual({ over: true, winner: SKY, reason: 'blocked' });
    }
  });
  it('Medium beats Easy on 6 by 6 from either side in at least 5 of 6 seeded games each, and on 10 by 10 in at least 3 of 4', () => {
    expect(playGames('medium', SKY, 6, 6, {}).wins).toBeGreaterThanOrEqual(5);
    expect(playGames('medium', AMBER, 6, 6, {}).wins).toBeGreaterThanOrEqual(5);
    expect(playGames('medium', SKY, 4, 10, {}).wins + playGames('medium', AMBER, 4, 10, {}).wins).toBeGreaterThanOrEqual(7);
  }, 280_000);
  it('Hard (searching 2 moves here, fixed clock) beats Easy on 6 by 6 in at least 5 of 6 seeded games each way', () => {
    const o = { now: () => 0, maxDepth: 2, budgetMs: 1e9 };
    expect(playGames('hard', SKY, 6, 6, o).wins).toBeGreaterThanOrEqual(5);
    expect(playGames('hard', AMBER, 6, 6, o).wins).toBeGreaterThanOrEqual(5);
  }, 280_000);
});

/** Wins by the strong level, playing `strongSide`, over Easy on the other side. */
function playGames(strong: Level, strongSide: Side, games: number, n: number, opts: { now?: () => number; maxDepth?: number; budgetMs?: number }): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(4000 + g);
    let s = newGame(n);
    let guard = 0;
    while (!outcome(s).over && guard++ < 400) {
      const level: Level = s.toMove === strongSide ? strong : 'easy';
      s = applyMove(s, chooseMove(s, level, rng, opts)!)!;
    }
    if (outcome(s).winner === strongSide) wins++; else losses++;
  }
  return { wins, losses };
}

describe('time budget', () => {
  it('states the numbers the page quotes', () => {
    expect(MEDIUM_CANDIDATES).toBe(60);
    expect(Array.from(HARD_BEAMS)).toEqual([40, 10, 6, 4]);
    expect(HARD_DEPTH).toBe(4);
    expect(HARD_BUDGET_MS).toBe(450);
    expect(HARD_NODE_CAP).toBe(6000);
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(1000);
  });
  it('Medium and Hard answer every position they are asked about, on both sizes, within a generous bound with the real settings', () => {
    const rng = mulberry32(8);
    let worstHard = 0;
    let worstMedium = 0;
    let count = 0;
    for (const n of [10, 6]) {
      for (let g = 0; g < 10; g++) {
        let s = newGame(n);
        for (let ply = 0; ply < g * 4 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
        if (outcome(s).over) continue;
        let t0 = performance.now();
        const m = hardMove(s, rng)!;
        worstHard = Math.max(worstHard, performance.now() - t0);
        expect(legalMoves(s).map(sig)).toContain(sig(m));
        t0 = performance.now();
        const m2 = mediumMove(s, rng)!;
        worstMedium = Math.max(worstMedium, performance.now() - t0);
        expect(legalMoves(s).map(sig)).toContain(sig(m2));
        count++;
      }
    }
    expect(count).toBeGreaterThan(12);
    expect(worstHard).toBeLessThan(4000);
    expect(worstMedium).toBeLessThan(4000);
  }, 180_000);
  it('the clock and the position cap are live from the first depth: a tiny budget or cap stops the search almost at once and still gives a legal move', () => {
    const s = newGame(10);
    let t = 0;
    const m = hardMove(s, mulberry32(5), { now: () => (t += 10), budgetMs: 5 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(m));
    expect(lastSearchNodes).toBeLessThanOrEqual(16);
    for (const cap of [1, 40, 500]) {
      const m2 = hardMove(s, mulberry32(5), { now: () => 0, budgetMs: 1e9, maxNodes: cap })!;
      expect(legalMoves(s).map(sig)).toContain(sig(m2));
      expect(lastSearchNodes).toBeLessThanOrEqual(cap + 16);
    }
    const z = hardMove(s, mulberry32(3), { budgetMs: 0 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(z));
  }, 120_000);
});

describe('words and bookkeeping', () => {
  it('finds the undo target and cleans the level', () => {
    expect(undoIndex([], SKY)).toBe(-1);
    expect(undoIndex([SKY, AMBER, SKY, AMBER], SKY)).toBe(2);
    expect(undoIndex([SKY, AMBER, SKY, AMBER], AMBER)).toBe(3);
    expect(undoIndex([AMBER, AMBER], SKY)).toBe(-1);
    expect(undoIndex([SKY, AMBER, SKY], null)).toBe(2);
    expect(cleanLevel('hard')).toBe('hard');
    for (const junk of ['nope', '', '__proto__', 'constructor', null, undefined, 3, [], {}]) expect(cleanLevel(junk)).toBe('medium');
    expect(cleanLevel(undefined, 'easy')).toBe('easy');
  });
  it('shuffles without losing or inventing items', () => {
    const a = [1, 2, 3, 4, 5, 6, 7];
    expect(shuffled(a, mulberry32(8)).slice().sort()).toEqual(a);
    expect(a).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
