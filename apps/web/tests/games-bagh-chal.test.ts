/**
 * games-bagh-chal.test.ts - the engine behind `bagh-chal`.
 *
 * Pinned: the 25-point board with its diagonals (56 links, built here a second way, from lists of the
 * board's lines), the opening (4 tigers on the corners, 20 goats in hand, 21 placements), goats that place
 * before they move, tiger steps and jumps (optional captures, no jumping tigers or two goats, only along
 * the board's lines), the end of the game (5 captures, every tiger trapped, goats that cannot move, the
 * draw after 100 quiet plies), a position that traps all four tigers with 17 goats, illegal input, a
 * separately written rules model compared with the engine in thousands of random positions and hundreds
 * of random games (with the 20 goats always accounted for), the alpha-beta search against a plain minimax,
 * the three computer levels for either side, and the time budget.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, legalGoatMoves, legalTigerMoves, applyMove, stepState, findMove, outcome, countOn, trappedTigers, goatsAccounted, isPlacement, isCapture,
  evaluate, evaluateForGoats, searchValue, bestMove, deepMove, randomMove, chooseMove, mulberry32, shuffled, describeOutcome, describeMove, goatsText, thinkingMessage,
  undoIndex, cleanLevel, nameOf, otherSide, cellName, rowOf, colOf, isPoint,
  STEP, JUMP, NEIGHBOURS, CELLS, SIZE, GOATS_TOTAL, TIGER_COUNT, WIN_CAPTURES, QUIET_LIMIT, MEDIUM_DEPTH, HARD_DEPTH, HARD_BUDGET_MS, HARD_NODE_CAP, lastSearchNodes,
  WIN_SCORE, TIGER_STARTS, GOATS, TIGERS,
  type State, type Side, type Level, type Move,
} from '../src/components/apps-private/bagh-chal/helpers';

const sig = (m: Move): string => `${m.from}>${m.to}>${m.over}`;

/** A position from goat points and tiger points. */
const pos = (goats: number[], tigers: number[], toMove: Side = GOATS, inHand = 0, captured = 0, quiet = 0): State => {
  const b = new Int8Array(CELLS);
  for (const g of goats) b[g] = GOATS;
  for (const t of tigers) b[t] = TIGERS;
  return { b, inHand, captured, toMove, quiet, plies: 0 };
};

// ── An independent model: the board as a list of straight lines ─────────────

const LINES: number[][] = [
  ...Array.from({ length: 5 }, (_, r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)), // rows
  ...Array.from({ length: 5 }, (_, c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)), // columns
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20], // the big X
  [2, 6, 10], [2, 8, 14], [10, 16, 22], [14, 18, 22], // the four sides of the diamond
];
const refLinks = new Set<string>();
const refJumps: [number, number, number][] = []; // from, over, to
for (const L of LINES) {
  for (let k = 0; k + 1 < L.length; k++) { refLinks.add(`${L[k]}-${L[k + 1]}`); refLinks.add(`${L[k + 1]}-${L[k]}`); }
  for (let k = 0; k + 2 < L.length; k++) { refJumps.push([L[k], L[k + 1], L[k + 2]]); refJumps.push([L[k + 2], L[k + 1], L[k]]); }
}
const linked = (a: number, b: number): boolean => refLinks.has(`${a}-${b}`);

interface Ref { goats: Set<number>; tigers: Set<number>; inHand: number; captured: number; toMove: Side; quiet: number }
const toRef = (s: State): Ref => {
  const goats = new Set<number>();
  const tigers = new Set<number>();
  for (let i = 0; i < CELLS; i++) { if (s.b[i] === GOATS) goats.add(i); else if (s.b[i] === TIGERS) tigers.add(i); }
  return { goats, tigers, inHand: s.inHand, captured: s.captured, toMove: s.toMove, quiet: s.quiet };
};
const refGoatMoves = (p: Ref): string[] => {
  const out: string[] = [];
  const empty = (i: number) => !p.goats.has(i) && !p.tigers.has(i);
  if (p.inHand > 0) { for (let i = 0; i < 25; i++) if (empty(i)) out.push(`-1>${i}>-1`); return out.sort(); }
  for (const g of p.goats) for (let t = 0; t < 25; t++) if (linked(g, t) && empty(t)) out.push(`${g}>${t}>-1`);
  return out.sort();
};
const refTigerMoves = (p: Ref): string[] => {
  const out: string[] = [];
  const empty = (i: number) => !p.goats.has(i) && !p.tigers.has(i);
  for (const t of p.tigers) {
    for (let x = 0; x < 25; x++) if (linked(t, x) && empty(x)) out.push(`${t}>${x}>-1`);
    for (const [from, over, to] of refJumps) if (from === t && p.goats.has(over) && empty(to)) out.push(`${t}>${to}>${over}`);
  }
  return out.sort();
};
const refMoves = (p: Ref): string[] => (p.toMove === GOATS ? refGoatMoves(p) : refTigerMoves(p));
const refOutcome = (p: Ref): { over: boolean; winner: Side | null; reason: string } => {
  if (p.captured >= 5) return { over: true, winner: TIGERS, reason: 'captured' };
  if (p.toMove === TIGERS && refTigerMoves(p).length === 0) return { over: true, winner: GOATS, reason: 'trapped' };
  if (p.toMove === GOATS && refGoatMoves(p).length === 0) return { over: true, winner: TIGERS, reason: 'blocked' };
  if (p.quiet >= 100) return { over: true, winner: null, reason: 'quiet' };
  return { over: false, winner: null, reason: 'none' };
};
const refApply = (p: Ref, text: string): Ref => {
  const [from, to, over] = text.split('>').map(Number);
  const goats = new Set(p.goats);
  const tigers = new Set(p.tigers);
  if (p.toMove === GOATS) {
    if (from >= 0) goats.delete(from);
    goats.add(to);
    return { goats, tigers, inHand: from < 0 ? p.inHand - 1 : p.inHand, captured: p.captured, toMove: TIGERS, quiet: from < 0 ? 0 : p.quiet + 1 };
  }
  tigers.delete(from);
  tigers.add(to);
  if (over >= 0) goats.delete(over);
  return { goats, tigers, inHand: p.inHand, captured: p.captured + (over >= 0 ? 1 : 0), toMove: GOATS, quiet: over >= 0 ? 0 : p.quiet + 1 };
};

describe('geometry', () => {
  it('is a 5 x 5 grid of points; diagonals only from points where row + column is even; 56 links in all', () => {
    expect(SIZE).toBe(5);
    expect(CELLS).toBe(25);
    for (let i = 0; i < CELLS; i++) {
      const mine = NEIGHBOURS[i];
      const expected = Array.from({ length: CELLS }, (_, j) => j).filter((j) => linked(i, j));
      expect(Array.from(mine), `point ${i}`).toEqual(expected);
      for (const j of mine) expect(NEIGHBOURS[j]).toContain(i);
    }
    const degrees = NEIGHBOURS.map((n) => n.length);
    expect(degrees.reduce((a, b) => a + b, 0) / 2).toBe(56);
    expect(refLinks.size / 2).toBe(56);
    // Corners have 3 links, edge points beside a corner 3, the centre 8.
    expect(NEIGHBOURS[0]).toHaveLength(3);
    expect(NEIGHBOURS[1]).toHaveLength(3);
    expect(NEIGHBOURS[2]).toHaveLength(5);
    expect(NEIGHBOURS[6]).toHaveLength(8);
    expect(NEIGHBOURS[12]).toHaveLength(8);
    expect(NEIGHBOURS[7]).toHaveLength(4);
  });
  it('jump landings match the model: two points along the same line', () => {
    let count = 0;
    for (let i = 0; i < CELLS; i++) for (let d = 0; d < 8; d++) {
      const mid = STEP[i * 8 + d];
      const land = JUMP[i * 8 + d];
      if (land >= 0) {
        count++;
        expect(refJumps.some(([a, b, c]) => a === i && b === mid && c === land), `${i} d${d}`).toBe(true);
      }
    }
    expect(count).toBe(refJumps.length);
  });
  it('names a point with 1-based row and column', () => {
    expect(cellName(0)).toBe('row 1, column 1');
    expect(cellName(24)).toBe('row 5, column 5');
    expect(rowOf(7)).toBe(1);
    expect(colOf(7)).toBe(2);
    expect(isPoint(24)).toBe(true);
    expect(isPoint(25)).toBe(false);
    expect(isPoint(-1)).toBe(false);
    expect(isPoint(1.5)).toBe(false);
    expect(isPoint('3')).toBe(false);
  });
});

describe('the opening and placing', () => {
  const s = newGame();
  it('has 4 tigers on the corners, 20 goats in hand, none captured, the goats to move', () => {
    expect(TIGER_COUNT).toBe(4);
    expect(GOATS_TOTAL).toBe(20);
    expect(Array.from(TIGER_STARTS)).toEqual([0, 4, 20, 24]);
    expect(countOn(s.b, TIGERS)).toBe(4);
    expect(countOn(s.b, GOATS)).toBe(0);
    for (const t of TIGER_STARTS) expect(s.b[t]).toBe(TIGERS);
    expect(s.inHand).toBe(20);
    expect(s.captured).toBe(0);
    expect(s.toMove).toBe(GOATS);
    expect(outcome(s)).toEqual({ over: false, winner: null, reason: 'none' });
  });
  it('offers the goats a placement on each of the 21 empty points and nothing else while any goat is in hand', () => {
    const moves = legalMoves(s);
    expect(moves).toHaveLength(21);
    expect(moves.every((m) => isPlacement(m) && s.b[m.to] === 0)).toBe(true);
    // A goat already on the board cannot move while goats are in hand.
    const t = applyMove(s, moves[0])!;
    const t2 = applyMove(t, legalMoves(t)[0])!;
    expect(legalGoatMoves(t2).every(isPlacement)).toBe(true);
    expect(t2.inHand).toBe(19);
  });
  it('a placement uses one goat from the hand and resets the quiet count; the goats then move their pieces only when the hand is empty', () => {
    const p = pos([6], [0, 4, 20, 24], GOATS, 5, 0, 17);
    const after = applyMove(p, { from: -1, to: 12, over: -1 })!;
    expect(after.inHand).toBe(4);
    expect(after.quiet).toBe(0);
    expect(after.b[12]).toBe(GOATS);
    expect(applyMove(p, { from: 6, to: 12, over: -1 })).toBeNull(); // a step is not allowed while goats are in hand
    const moving = pos([6], [0, 4, 20, 24], GOATS, 0, 0, 17);
    const step = applyMove(moving, { from: 6, to: 12, over: -1 })!;
    expect(step.quiet).toBe(18);
    expect(applyMove(moving, { from: -1, to: 12, over: -1 })).toBeNull();
  });
});

describe('goat steps', () => {
  it('step one link to an empty point, along the board\'s lines only', () => {
    const s = pos([6], [24], GOATS);
    expect(legalGoatMoves(s).map((m) => m.to).sort((a, b) => a - b)).toEqual([0, 1, 2, 5, 7, 10, 11, 12]);
    // Point 1 has no diagonals: a goat there goes to 0, 2 and 6 only.
    expect(legalGoatMoves(pos([1], [24], GOATS)).map((m) => m.to).sort((a, b) => a - b)).toEqual([0, 2, 6]);
    // They never jump and never step onto a piece.
    const crowded = pos([6, 7], [12], GOATS);
    expect(legalGoatMoves(crowded).every((m) => m.over === -1 && crowded.b[m.to] === 0)).toBe(true);
  });
});

describe('tiger moves', () => {
  it('steps to an empty linked point', () => {
    const s = pos([], [12], TIGERS);
    expect(legalTigerMoves(s).map((m) => m.to).sort((a, b) => a - b)).toEqual([6, 7, 8, 11, 13, 16, 17, 18]);
    expect(legalTigerMoves(pos([], [1], TIGERS)).map((m) => m.to).sort((a, b) => a - b)).toEqual([0, 2, 6]);
  });
  it('jumps over an adjacent goat along a line into the empty point beyond, and captures it', () => {
    const s = pos([7, 6], [12, 0], TIGERS, 3, 0, 4);
    const jumps = legalTigerMoves(s).filter(isCapture);
    expect(jumps.map(sig)).toEqual(['12>2>7']); // 12 over 6 would land on the tiger at 0, and 0 over 6 on the tiger at 12
    const jump = jumps.find((m) => m.over === 7)!;
    expect(jump).toEqual({ from: 12, to: 2, over: 7 });
    const after = applyMove(s, jump)!;
    expect(after.b[7]).toBe(0);
    expect(after.b[12]).toBe(0);
    expect(after.b[2]).toBe(TIGERS);
    expect(after.captured).toBe(1);
    expect(after.quiet).toBe(0);
    expect(after.toMove).toBe(GOATS);
    expect(after.inHand).toBe(3);
  });
  it('can jump along a diagonal from an even point, from the corner too', () => {
    const s = pos([6], [0], TIGERS);
    expect(legalTigerMoves(s).filter(isCapture)).toEqual([{ from: 0, to: 12, over: 6 }]);
  });
  it('capturing is optional: a plain step is still legal when a jump is on offer', () => {
    const s = pos([7], [12], TIGERS);
    const moves = legalTigerMoves(s);
    expect(moves.some((m) => m.over >= 0)).toBe(true);
    expect(moves.some((m) => m.over < 0)).toBe(true);
  });
  it('cannot jump a goat with a piece or the edge behind it, cannot jump a tiger, cannot jump two in a row, and one jump only', () => {
    expect(legalTigerMoves(pos([7, 2], [12], TIGERS)).some(isCapture)).toBe(false); // goat behind
    expect(legalTigerMoves(pos([7], [12, 2], TIGERS)).some((m) => m.over === 7)).toBe(false); // tiger behind
    expect(legalTigerMoves(pos([2], [7], TIGERS)).some(isCapture)).toBe(false); // edge behind
    expect(legalTigerMoves(pos([], [12, 7], TIGERS)).some(isCapture)).toBe(false); // tigers are not captured
    // 12 over 7 to 2, then 2 over 3... a second jump is not part of the same move.
    const s = pos([7, 3], [12], TIGERS);
    const m = legalTigerMoves(s).find((x) => x.over === 7)!;
    expect(m.to).toBe(2);
    expect(applyMove(s, m)!.captured).toBe(1);
    // A goat on an odd point has no diagonal line through it: 1 -> 7 -> 13 is straight but 5 -> 11 -> 17 is not a line.
    expect(legalTigerMoves(pos([11], [5], TIGERS)).some((x) => x.over === 11)).toBe(false);
    expect(legalTigerMoves(pos([6], [10], TIGERS)).some(isCapture)).toBe(true); // 10 -> 6 -> 2 is on the diamond
    expect(legalTigerMoves(pos([6], [10], TIGERS)).filter(isCapture)[0]).toEqual({ from: 10, to: 2, over: 6 });
  });
});

describe('the end of the game', () => {
  it('the tigers win with five goats captured', () => {
    expect(WIN_CAPTURES).toBe(5);
    const s = pos([7], [12], TIGERS, 0, 4);
    const after = applyMove(s, { from: 12, to: 2, over: 7 })!;
    expect(after.captured).toBe(5);
    expect(outcome(after)).toEqual({ over: true, winner: TIGERS, reason: 'captured' });
    expect(outcome(pos([7], [12], GOATS, 3, 4)).over).toBe(false);
  });
  it('the goats win when no tiger can step or jump', () => {
    const s = trapAll();
    expect(trappedTigers(s)).toBe(4);
    expect(legalTigerMoves(s)).toHaveLength(0);
    expect(outcome(s)).toEqual({ over: true, winner: GOATS, reason: 'trapped' });
    expect(applyMove(s, { from: 0, to: 1, over: -1 })).toBeNull();
    // Take one backing goat away and a tiger can jump out.
    const open = trapAll([2]);
    expect(legalTigerMoves(open).length).toBeGreaterThan(0);
    expect(outcome(open).over).toBe(false);
  });
  it('17 goats trap all four tigers in the corners (12 beside them, 5 behind them), and none of the 17 can be spared', () => {
    const s = trapAll();
    expect(countOn(s.b, GOATS)).toBe(17);
    // Removing any one goat frees at least one tiger.
    for (let i = 0; i < CELLS; i++) {
      if (s.b[i] !== GOATS) continue;
      const b = s.b.slice();
      b[i] = 0;
      expect(trappedTigers({ ...s, b }) < 4, `without ${i}`).toBe(true);
    }
  });
  it('the goats lose when they cannot move', () => {
    // All goats on the board, none can step: a goat in the corner boxed in by tigers.
    const s = pos([0], [1, 5, 6], GOATS);
    expect(legalGoatMoves(s)).toHaveLength(0);
    expect(outcome(s)).toEqual({ over: true, winner: TIGERS, reason: 'blocked' });
    // With a goat in hand the goats can always place, so this is not a loss.
    expect(outcome(pos([0], [1, 5, 6], GOATS, 2)).over).toBe(false);
  });
  it(`is drawn after ${QUIET_LIMIT} plies with no goat placed and none captured, not before`, () => {
    expect(QUIET_LIMIT).toBe(100);
    const base = (q: number) => pos([12], [0, 4, 20, 24], GOATS, 0, 0, q);
    expect(outcome(base(99)).over).toBe(false);
    expect(outcome(base(100))).toEqual({ over: true, winner: null, reason: 'quiet' });
    const step = applyMove(base(99), findMove(base(99), 12, 13)!)!;
    expect(outcome(step).reason).toBe('quiet');
    // A capture resets the count; a loss outranks the draw.
    const cap = pos([7], [12], TIGERS, 2, 0, 99);
    expect(applyMove(cap, { from: 12, to: 2, over: 7 })!.quiet).toBe(0);
    expect(outcome(pos([7], [12], TIGERS, 0, 5, 200)).reason).toBe('captured');
  });
  it('describes every ending', () => {
    expect(describeOutcome({ over: false, winner: null, reason: 'none' }, null)).toBe('The game is not finished.');
    expect(describeOutcome({ over: true, winner: null, reason: 'quiet' }, GOATS)).toBe('Draw: 100 moves in a row with no goat placed and none captured.');
    expect(describeOutcome({ over: true, winner: GOATS, reason: 'trapped' }, GOATS)).toBe('You win: every tiger is trapped.');
    expect(describeOutcome({ over: true, winner: GOATS, reason: 'trapped' }, TIGERS)).toBe('The computer wins: every tiger is trapped.');
    expect(describeOutcome({ over: true, winner: TIGERS, reason: 'captured' }, TIGERS)).toBe('You win: 5 goats have been captured.');
    expect(describeOutcome({ over: true, winner: TIGERS, reason: 'blocked' }, null)).toBe('Tigers win: the goats cannot move.');
    expect(describeOutcome({ over: true, winner: GOATS, reason: 'trapped' }, null)).toBe('Goats win: every tiger is trapped.');
  });
});

const beside = [1, 5, 6, 3, 9, 8, 15, 21, 16, 23, 19, 18];
const behind = [2, 10, 12, 14, 22];
/** The four tigers in the corners with 12 goats beside them and 5 behind them. */
function trapAll(without: number[] = []): State {
  return pos([...beside, ...behind].filter((x) => !without.includes(x)), [0, 4, 20, 24], TIGERS);
}

describe('illegal input', () => {
  const s = pos([6, 12], [0, 4, 20, 24], GOATS, 0);
  it('rejects anything that is not a legal move, and never mutates', () => {
    const copy = Array.from(s.b);
    const bad: unknown[] = [
      { from: 6, to: 12, over: -1 }, // onto a goat
      { from: 6, to: 0, over: -1 }, // onto a tiger
      { from: 6, to: 8, over: -1 }, // two points away
      { from: 6, to: 25, over: -1 },
      { from: 0, to: 1, over: -1 }, // the tiger's move on the goats' turn
      { from: -1, to: 3, over: -1 }, // a placement with none in hand
      { from: 99, to: 3, over: -1 },
      { from: NaN, to: 3, over: -1 },
      { from: 6, to: NaN, over: -1 },
      { from: 6, to: '7', over: -1 },
      { from: [6], to: 7 },
      null,
      undefined,
      'x',
      7,
      {},
    ];
    for (const m of bad) expect(applyMove(s, m as Move), JSON.stringify(m)).toBeNull();
    expect(Array.from(s.b)).toEqual(copy);
    expect(findMove(s, 6, 7)).not.toBeNull();
  });
  it('uses the generator\'s own captured point, not the caller\'s', () => {
    const t = pos([7, 16], [12], TIGERS);
    const forged = applyMove(t, { from: 12, to: 2, over: 16 })!;
    expect(forged.b[16]).toBe(GOATS);
    expect(forged.b[7]).toBe(0);
  });
  it('a finished game accepts no more moves', () => {
    const done = trapAll();
    for (const m of legalGoatMoves({ ...done, toMove: GOATS })) expect(applyMove(done, m)).toBeNull();
  });
});

describe('a separately written model agrees with the engine', () => {
  const randomPosition = (rng: () => number): State => {
    const spots = shuffled(Array.from({ length: CELLS }, (_, i) => i), rng);
    const tigers = 1 + Math.floor(rng() * 4);
    const goats = Math.floor(rng() * 16);
    const b = new Int8Array(CELLS);
    for (let i = 0; i < tigers; i++) b[spots[i]] = TIGERS;
    for (let i = 0; i < goats; i++) b[spots[tigers + i]] = GOATS;
    return { b, inHand: rng() < 0.4 ? Math.floor(rng() * 6) : 0, captured: Math.floor(rng() * 7), toMove: rng() < 0.5 ? GOATS : TIGERS, quiet: Math.floor(rng() * 120), plies: 0 };
  };
  it('lists the same legal moves and outcomes in 5000 random positions', () => {
    const rng = mulberry32(2026);
    let jumps = 0;
    let trapped = 0;
    let blocked = 0;
    for (let g = 0; g < 5000; g++) {
      const s = randomPosition(rng);
      const ref = toRef(s);
      expect(legalMoves(s).map(sig).sort()).toEqual(refMoves(ref));
      const eo = outcome(s);
      const ro = refOutcome(ref);
      expect(eo.over).toBe(ro.over);
      expect(eo.winner).toBe(ro.winner);
      expect(eo.reason).toBe(ro.reason);
      if (s.toMove === TIGERS && legalTigerMoves(s).some(isCapture)) jumps++;
      if (eo.reason === 'trapped') trapped++;
      if (eo.reason === 'blocked') blocked++;
    }
    expect(jumps).toBeGreaterThan(300);
    expect(blocked).toBeGreaterThan(0);
    // Random boards rarely trap a tiger, so also try the full trap with a few goats taken away or moved, and the tigers' jumps out of it.
    const near = beside.concat(behind);
    let trappedNear = 0;
    for (let g = 0; g < 1500; g++) {
      const b = new Int8Array(CELLS);
      for (const t of TIGER_STARTS) b[t] = TIGERS;
      const drop = new Set<number>();
      const k = Math.floor(rng() * 3);
      for (let i = 0; i < k; i++) drop.add(near[Math.floor(rng() * near.length)]);
      for (const x of near) if (!drop.has(x)) b[x] = GOATS;
      if (rng() < 0.3) { const extra = Math.floor(rng() * CELLS); if (b[extra] === 0) b[extra] = GOATS; }
      const s: State = { b, inHand: 0, captured: Math.floor(rng() * 5), toMove: rng() < 0.7 ? TIGERS : GOATS, quiet: Math.floor(rng() * 110), plies: 0 };
      const ref = toRef(s);
      expect(legalMoves(s).map(sig).sort()).toEqual(refMoves(ref));
      const eo = outcome(s);
      const ro = refOutcome(ref);
      expect(eo.over).toBe(ro.over);
      expect(eo.winner).toBe(ro.winner);
      expect(eo.reason).toBe(ro.reason);
      if (eo.reason === 'trapped') trappedNear++;
    }
    expect(trappedNear).toBeGreaterThan(100);
    expect(trapped + trappedNear).toBeGreaterThan(100);
  });

  it('plays 500 random games in step with the model: same moves, same boards, same counts, same result, 20 goats always accounted for', () => {
    const rng = mulberry32(77);
    const reasons: Record<string, number> = { captured: 0, trapped: 0, blocked: 0, quiet: 0 };
    let captures = 0;
    let longest = 0;
    for (let g = 0; g < 500; g++) {
      let s = newGame();
      let r = toRef(s);
      for (let ply = 0; ply < 3000; ply++) {
        const ro = refOutcome(r);
        const eo = outcome(s);
        expect(eo.over).toBe(ro.over);
        expect(eo.winner).toBe(ro.winner);
        expect(eo.reason).toBe(ro.reason);
        if (eo.over) { reasons[eo.reason]++; break; }
        const list = refMoves(r);
        expect(legalMoves(s).map(sig).sort()).toEqual(list);
        const text = list[Math.floor(rng() * list.length)];
        const m = legalMoves(s).find((x) => sig(x) === text)!;
        if (m.over >= 0) captures++;
        s = applyMove(s, m)!;
        r = refApply(r, text);
        const rr = toRef(s);
        expect([...rr.goats].sort((a, b) => a - b)).toEqual([...r.goats].sort((a, b) => a - b));
        expect([...rr.tigers].sort((a, b) => a - b)).toEqual([...r.tigers].sort((a, b) => a - b));
        expect(s.toMove).toBe(r.toMove);
        expect(s.quiet).toBe(r.quiet);
        expect(s.inHand).toBe(r.inHand);
        expect(s.captured).toBe(r.captured);
        expect(countOn(s.b, TIGERS)).toBe(4);
        expect(goatsAccounted(s)).toBe(20);
        longest = Math.max(longest, ply + 1);
      }
      expect(outcome(s).over).toBe(true);
    }
    expect(captures).toBeGreaterThan(500);
    expect(reasons.captured).toBeGreaterThan(20);
    expect(reasons.captured + reasons.trapped + reasons.blocked + reasons.quiet).toBe(500);
    // Every game ends: 20 placements and 5 captures are all the progress there is, and no more than 100 plies pass between two of them.
    expect(longest).toBeLessThanOrEqual((20 + 5 + 1) * QUIET_LIMIT);
  }, 240_000);
});

describe('the search', () => {
  /** Plain minimax with no pruning and no move ordering, over the same rules and evaluation. */
  const plain = (s: State, depth: number): number => {
    if (s.captured >= WIN_CAPTURES) return s.toMove === TIGERS ? WIN_SCORE + depth : -(WIN_SCORE + depth);
    const moves = legalMoves(s);
    if (!moves.length) return -(WIN_SCORE + depth);
    if (s.quiet >= QUIET_LIMIT) return 0;
    if (depth <= 0) return evaluate(s);
    let best = -Infinity;
    for (const m of moves) best = Math.max(best, -plain(stepState(s, m), depth - 1));
    return best;
  };
  const midgames = (count: number, seed: number): State[] => {
    const rng = mulberry32(seed);
    const out: State[] = [];
    for (let g = 0; g < count; g++) {
      let s = newGame();
      const stop = 2 + Math.floor(rng() * 60);
      for (let ply = 0; ply < stop && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (!outcome(s).over) out.push(s);
    }
    return out;
  };

  it('gives the same value as a plain minimax at depths 1 to 3 (and 4 where the move list is short) in positions from random games', () => {
    let checked = 0;
    let deep = 0;
    let placing = 0;
    for (const s of midgames(40, 11)) {
      for (let d = 1; d <= 3; d++) expect(searchValue(s, d) + 0).toBe(plain(s, d) + 0);
      if (legalMoves(s).length <= 12) { expect(searchValue(s, 4) + 0).toBe(plain(s, 4) + 0); deep++; }
      if (s.inHand > 0) placing++;
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
    expect(deep).toBeGreaterThan(8);
    expect(placing).toBeGreaterThan(5);
  }, 240_000);
  it('evaluation is zero-sum between the sides and a won position outranks it', () => {
    const s = newGame();
    expect(evaluate(s)).toBe(evaluateForGoats(s));
    expect(evaluate({ ...s, toMove: TIGERS })).toBe(-evaluateForGoats(s));
    const trapped = trapAll();
    expect(searchValue(trapped, 2)).toBeLessThan(-WIN_SCORE + 10);
    expect(Math.abs(evaluate(s))).toBeLessThan(WIN_SCORE);
    // More captures is worse for the goats.
    const a = pos([7, 8], [0, 4, 20, 24], GOATS, 5, 0);
    const b2 = pos([7, 8], [0, 4, 20, 24], GOATS, 5, 2);
    expect(evaluateForGoats(b2)).toBeLessThan(evaluateForGoats(a));
  });
  it('a search returns a legal move, deterministic for a seed', () => {
    for (const s of midgames(8, 5)) {
      const m = bestMove(s, 2, mulberry32(3))!;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
      expect(sig(bestMove(s, 2, mulberry32(3))!)).toBe(sig(m));
    }
  });
});

describe('computer players', () => {
  it('Easy returns a legal move for either side, deterministic for a seed, and null when there is none', () => {
    for (const side of [GOATS, TIGERS]) {
      let s = newGame();
      s = applyMove(s, legalMoves(s)[3])!;
      s = side === TIGERS ? s : { ...s, toMove: GOATS };
      const m = randomMove(s, mulberry32(1))!;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
      expect(sig(randomMove(s, mulberry32(1))!)).toBe(sig(m));
    }
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(sig(randomMove(newGame(), mulberry32(i))!));
    expect(seen.size).toBeGreaterThan(5);
    const blocked = pos([0], [1, 5, 6], GOATS);
    expect(randomMove(blocked, mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'hard', mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'medium', mulberry32(1))).toBeNull();
  });
  it('every level plays a legal move for either side in positions from random games; Medium and Hard are deterministic with a fixed clock', () => {
    const rng = mulberry32(21);
    const fast = { now: () => 0, maxDepth: 4 };
    for (let g = 0; g < 16; g++) {
      let s = newGame();
      for (let ply = 0; ply < g * 4 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      for (const level of ['easy', 'medium', 'hard'] as Level[]) {
        const m = chooseMove(s, level, mulberry32(g), fast)!;
        expect(legalMoves(s).map(sig)).toContain(sig(m));
        if (level !== 'easy') expect(sig(chooseMove(s, level, mulberry32(g), fast)!)).toBe(sig(m));
      }
    }
  }, 240_000);
  it('the tigers take a goat they can take to win at once, and the goats do not leave a goat hanging', () => {
    // Four goats already gone: taking the fifth wins.
    const win = pos([7, 20, 19, 3], [12, 0, 4, 24], TIGERS, 0, 4);
    for (const level of ['medium', 'hard'] as Level[]) {
      const m = chooseMove(win, level, mulberry32(1), { now: () => 0, maxDepth: 3 })!;
      expect(m.over).toBeGreaterThanOrEqual(0);
    }
    // The goats to move, three goats in danger (the goat on 7 from the tiger on 12, the goats on 1 and 3 from the tigers on the corners), all with the empty point 2 behind them. Filling that point, or moving a goat there, removes every danger.
    const save = pos([7, 1, 3], [12, 0, 4, 24], GOATS, 0);
    expect(legalTigerMoves({ ...save, toMove: TIGERS }).some(isCapture)).toBe(true); // the danger is real
    for (const level of ['medium', 'hard'] as Level[]) {
      for (const seed of [1, 2, 3]) {
        const m = chooseMove(save, level, mulberry32(seed), { now: () => 0, maxDepth: 3 })!;
        const after = applyMove(save, m)!;
        const grabs = legalTigerMoves(after).filter(isCapture);
        expect(grabs.length, `${level} ${sig(m)}`).toBe(0);
      }
    }
  });
  it('Medium tigers beat Easy goats, and Medium goats lose far fewer goats to Easy tigers than Easy goats do', () => {
    const asTigers = playGames('medium', TIGERS, 6, { now: () => 0 });
    expect(asTigers.wins).toBeGreaterThanOrEqual(5);
    const mediumGoats = playGames('medium', GOATS, 6, { now: () => 0 });
    const easyGoats = playGames('easy', GOATS, 6, { now: () => 0 });
    expect(mediumGoats.lost).toBeLessThan(easyGoats.lost);
    expect(mediumGoats.losses).toBeLessThanOrEqual(1);
  }, 240_000);
  it('Hard (searching 4 moves here) beats Easy tigers\' opponent: Hard tigers win at least 5 of 6 against Easy goats', () => {
    const o = { now: () => 0, maxDepth: 4, budgetMs: 1e9 };
    expect(playGames('hard', TIGERS, 6, o).wins).toBeGreaterThanOrEqual(5);
  }, 240_000);
});

/** Games with the strong level on `strongSide` against Easy on the other. `lost` counts goats captured in all games. */
const playGames = (strong: Level, strongSide: Side, games: number, opts: { now?: () => number; maxDepth?: number; budgetMs?: number }): { wins: number; draws: number; losses: number; lost: number } => {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let lost = 0;
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(4000 + g);
    let s = newGame();
    let guard = 0;
    while (!outcome(s).over && guard++ < 3000) {
      const level: Level = s.toMove === strongSide ? strong : 'easy';
      s = applyMove(s, chooseMove(s, level, rng, opts)!)!;
    }
    const o = outcome(s);
    lost += s.captured;
    if (o.winner === strongSide) wins++;
    else if (o.winner === null) draws++;
    else losses++;
  }
  return { wins, draws, losses, lost };
};

describe('time budget', () => {
  it('states the numbers the page quotes', () => {
    expect(MEDIUM_DEPTH).toBe(4);
    expect(HARD_DEPTH).toBe(8);
    expect(HARD_BUDGET_MS).toBe(400);
    expect(HARD_NODE_CAP).toBe(60000);
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(1000);
  });
  it('Hard answers every position it is asked about, for either side, within a generous bound with the real settings', () => {
    const rng = mulberry32(8);
    let worst = 0;
    let count = 0;
    for (let g = 0; g < 24; g++) {
      let s = newGame();
      for (let ply = 0; ply < g * 2 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      const t0 = performance.now();
      const m = deepMove(s, rng)!;
      worst = Math.max(worst, performance.now() - t0);
      count++;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
    }
    expect(count).toBeGreaterThan(12);
    expect(worst).toBeLessThan(4000);
  }, 120_000);
  it('Medium (4 plies, no time limit) also answers within a generous bound', () => {
    const rng = mulberry32(9);
    let worst = 0;
    for (let g = 0; g < 24; g++) {
      let s = newGame();
      for (let ply = 0; ply < g * 3 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      const t0 = performance.now();
      const m = bestMove(s, MEDIUM_DEPTH, rng)!;
      worst = Math.max(worst, performance.now() - t0);
      expect(legalMoves(s).map(sig)).toContain(sig(m));
    }
    expect(worst).toBeLessThan(6000);
  }, 120_000);
  it('the clock and a node cap are live from the first depth: a tiny budget or cap stops the search almost at once and still gives a legal move', () => {
    const s = newGame();
    let t = 0;
    const m = deepMove(s, mulberry32(5), { now: () => (t += 10), budgetMs: 5 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(m));
    expect(lastSearchNodes).toBeLessThanOrEqual(64);
    for (const cap of [1, 40, 500, 5000]) {
      const m2 = deepMove(s, mulberry32(5), { now: () => 0, budgetMs: 1e9, maxNodes: cap })!;
      expect(legalMoves(s).map(sig)).toContain(sig(m2));
      expect(lastSearchNodes).toBeLessThanOrEqual(cap + 64);
    }
  });
  it('a zero budget still gives a legal move', () => {
    const s = newGame();
    const m = deepMove(s, mulberry32(3), { budgetMs: 0 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(m));
  });
});

describe('words and bookkeeping', () => {
  it('names the sides, pluralises and describes moves', () => {
    expect(nameOf(GOATS)).toBe('Goats');
    expect(nameOf(TIGERS)).toBe('Tigers');
    expect(otherSide(GOATS)).toBe(TIGERS);
    expect(goatsText(1)).toBe('1 goat');
    expect(goatsText(0)).toBe('0 goats');
    expect(goatsText(20)).toBe('20 goats');
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Careful.')).toBe('Careful. Computer is thinking...');
    expect(describeMove({ from: -1, to: 12, over: -1 }, GOATS, 'You')).toBe('You placed a goat on row 3, column 3.');
    expect(describeMove({ from: 6, to: 7, over: -1 }, GOATS, 'Computer')).toBe('Computer moved a goat from row 2, column 2 to row 2, column 3.');
    expect(describeMove({ from: 0, to: 1, over: -1 }, TIGERS, 'You')).toBe('You moved a tiger from row 1, column 1 to row 1, column 2.');
    expect(describeMove({ from: 12, to: 2, over: 7 }, TIGERS, 'Computer')).toBe('Computer jumped a tiger from row 3, column 3 to row 1, column 3 and captured a goat.');
  });
  it('finds the move Undo goes back to', () => {
    expect(undoIndex([], GOATS)).toBe(-1);
    expect(undoIndex([GOATS, TIGERS, GOATS, TIGERS], GOATS)).toBe(2);
    expect(undoIndex([GOATS, TIGERS, GOATS, TIGERS], TIGERS)).toBe(3);
    expect(undoIndex([TIGERS, TIGERS], GOATS)).toBe(-1);
    expect(undoIndex([GOATS, TIGERS, GOATS], null)).toBe(2);
  });
  it('cleans the level from the address bar', () => {
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
