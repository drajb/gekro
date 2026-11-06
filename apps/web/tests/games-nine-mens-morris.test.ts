/**
 * games-nine-mens-morris.test.ts - the engine behind `nine-mens-morris`.
 *
 * Pinned: the 24 points, the 32 links and the 16 lines (checked against a second
 * definition written with plain coordinates instead of ring arithmetic), the three
 * phases, mills and which piece may be taken, flying at three pieces, losing at two
 * pieces or when blocked, the draw after 40 quiet moves, illegal input, a separately
 * written move generator and rules model compared with the engine on thousands of
 * random positions and random games, the alpha-beta search against a plain minimax,
 * the three computer levels (Medium and Hard beat Easy, they close and block mills),
 * and the time budget.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, baseMoves, legalMoves, applyMove, outcome, removable, removalChoices, needsRemoval, closesMill, inMill, millCount, onBoard, totalPieces, phaseOf,
  evaluate, searchValue, bestMove, deepMove, randomMove, chooseMove, mulberry32, shuffled, describeOutcome, pointName, piecesText, thinkingMessage, undoIndex,
  cleanLevel, nameOf, otherPlayer,
  COORDS, ADJ, LINES, LINES_OF, POINTS, PIECES, QUIET_LIMIT, MEDIUM_DEPTH, HARD_DEPTH, HARD_BUDGET_MS, HARD_NODE_CAP, lastSearchNodes, WIN_SCORE, AMBER, VIOLET,
  type State, type Player, type Level, type Move,
} from '../src/components/apps-private/nine-mens-morris/helpers';

/** A position from a map of point -> owner. */
const pos = (pieces: Record<number, Player>, hand1 = 0, hand2 = 0, toMove: Player = AMBER, quiet = 0): State => {
  const b = new Int8Array(POINTS);
  for (const [k, v] of Object.entries(pieces)) b[Number(k)] = v;
  return { b, hand: [0, hand1, hand2], toMove, quiet, plies: 0 };
};
const ids = (list: number[]): number[] => list.slice().sort((a, b) => a - b);
const key = (m: Move): string => `${m.from}>${m.to}x${m.remove}`;

// ── An independent model: coordinates, not rings ────────────────────────────
// A point exists at (3 + a*h, 3 + b*h) for h in 1..3 and a, b in {-1, 0, 1} (not both 0). Two points are
// linked when they share a row or a column with no other point between them and the centre not between them.
// A line is three consecutive points on one row or column, on one side of the centre.

type Pt = readonly [number, number];
const REF_POINTS: Pt[] = [];
for (const h of [3, 2, 1]) for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) if (a !== 0 || b !== 0) REF_POINTS.push([3 + a * h, 3 + b * h]);
const k2 = (p: Pt): string => `${p[0]},${p[1]}`;
const REF_SET = new Set(REF_POINTS.map(k2));
const refLinked = (a: Pt, b: Pt): boolean => {
  if (a[0] !== b[0] && a[1] !== b[1]) return false;
  if (a[0] === b[0] && a[1] === b[1]) return false;
  const horizontal = a[1] === b[1];
  const lo = Math.min(horizontal ? a[0] : a[1], horizontal ? b[0] : b[1]);
  const hi = Math.max(horizontal ? a[0] : a[1], horizontal ? b[0] : b[1]);
  for (let t = lo + 1; t < hi; t++) {
    const p: Pt = horizontal ? [t, a[1]] : [a[0], t];
    if (REF_SET.has(k2(p)) || (p[0] === 3 && p[1] === 3)) return false;
  }
  return true;
};
const REF_LINES: Pt[][] = [];
for (const horizontal of [true, false]) {
  for (let t = 0; t < 7; t++) {
    const onLine = REF_POINTS.filter((p) => p[horizontal ? 1 : 0] === t).sort((a, b) => (horizontal ? a[0] - b[0] : a[1] - b[1]));
    if (t !== 3) { if (onLine.length === 3) REF_LINES.push(onLine); continue; }
    // Row 3 and column 3 pass through the centre, which is not a point: each is two separate lines of three.
    const coord = (p: Pt): number => p[horizontal ? 0 : 1];
    const before = onLine.filter((p) => coord(p) < 3);
    const after = onLine.filter((p) => coord(p) > 3);
    if (before.length === 3) REF_LINES.push(before);
    if (after.length === 3) REF_LINES.push(after);
  }
}

interface RefPos { owner: Map<string, Player>; hand: [number, number, number]; toMove: Player; quiet: number }

const toRef = (s: State): RefPos => {
  const owner = new Map<string, Player>();
  for (let i = 0; i < POINTS; i++) if (s.b[i]) owner.set(k2(COORDS[i]), s.b[i] as Player);
  return { owner, hand: [0, s.hand[1], s.hand[2]], toMove: s.toMove, quiet: s.quiet };
};
const refCount = (r: RefPos, p: Player): number => [...r.owner.values()].filter((v) => v === p).length;
const refInLine = (owner: Map<string, Player>, p: Pt, who: Player): boolean =>
  REF_LINES.some((l) => l.some((q) => k2(q) === k2(p)) && l.every((q) => owner.get(k2(q)) === who));

const refBase = (r: RefPos): { from: string | null; to: string }[] => {
  const me = r.toMove;
  const out: { from: string | null; to: string }[] = [];
  const empty = REF_POINTS.filter((p) => !r.owner.has(k2(p)));
  if (r.hand[me] > 0) return empty.map((p) => ({ from: null, to: k2(p) }));
  const mine = REF_POINTS.filter((p) => r.owner.get(k2(p)) === me);
  const flying = mine.length === 3;
  for (const f of mine) for (const t of empty) if (flying || refLinked(f, t)) out.push({ from: k2(f), to: k2(t) });
  return out;
};
const parsePt = (s: string): Pt => s.split(',').map(Number) as unknown as Pt;

/** All full moves in the model, as strings in the same shape as `key()` but using coordinates. */
const refFull = (r: RefPos): string[] => {
  const me = r.toMove;
  const foe = otherPlayer(me);
  const out: string[] = [];
  for (const m of refBase(r)) {
    const owner = new Map(r.owner);
    if (m.from) owner.delete(m.from);
    owner.set(m.to, me);
    if (refInLine(owner, parsePt(m.to), me)) {
      const theirs = REF_POINTS.filter((p) => owner.get(k2(p)) === foe);
      const free = theirs.filter((p) => !refInLine(owner, p, foe));
      const choices = free.length ? free : theirs;
      if (choices.length) { for (const c of choices) out.push(`${m.from ?? '-'}>${m.to}x${k2(c)}`); continue; }
    }
    out.push(`${m.from ?? '-'}>${m.to}x-`);
  }
  return out.sort();
};
const engineFull = (s: State): string[] =>
  legalMoves(s)
    .map((m) => `${m.from < 0 ? '-' : k2(COORDS[m.from])}>${k2(COORDS[m.to])}x${m.remove < 0 ? '-' : k2(COORDS[m.remove])}`)
    .sort();

const refApply = (r: RefPos, from: string | null, to: string, remove: string | null): RefPos => {
  const owner = new Map(r.owner);
  const hand: [number, number, number] = [0, r.hand[1], r.hand[2]];
  if (from) owner.delete(from); else hand[r.toMove]--;
  owner.set(to, r.toMove);
  if (remove) owner.delete(remove);
  return { owner, hand, toMove: otherPlayer(r.toMove), quiet: !from || remove ? 0 : r.quiet + 1 };
};
const refOutcome = (r: RefPos): { over: boolean; winner: Player | null; reason: string } => {
  for (const p of [AMBER, VIOLET] as Player[]) if (refCount(r, p) + r.hand[p] < 3) return { over: true, winner: otherPlayer(p), reason: 'pieces' };
  if (refBase(r).length === 0) return { over: true, winner: otherPlayer(r.toMove), reason: 'blocked' };
  if (r.quiet >= 40) return { over: true, winner: null, reason: 'quiet' };
  return { over: false, winner: null, reason: 'none' };
};

/** Engine move to model move (strings with coordinates). */
const toModel = (m: Move): [string | null, string, string | null] =>
  [m.from < 0 ? null : k2(COORDS[m.from]), k2(COORDS[m.to]), m.remove < 0 ? null : k2(COORDS[m.remove])];

describe('geometry', () => {
  it('has 24 points on three squares, at coordinates that match the second definition', () => {
    expect(POINTS).toBe(24);
    expect(PIECES).toBe(9);
    expect(COORDS).toHaveLength(24);
    expect(new Set(COORDS.map(k2))).toEqual(REF_SET);
    expect(COORDS[0]).toEqual([0, 0]);
    expect(COORDS[2]).toEqual([6, 0]);
    expect(COORDS[4]).toEqual([6, 6]);
    expect(COORDS[6]).toEqual([0, 6]);
    expect(COORDS[16]).toEqual([2, 2]);
    expect(COORDS[21]).toEqual([3, 4]);
  });
  it('links the same pairs of points as the coordinate definition (32 links)', () => {
    let links = 0;
    for (let i = 0; i < POINTS; i++) {
      for (let j = 0; j < POINTS; j++) {
        const linked = refLinked(COORDS[i], COORDS[j]);
        expect(ADJ[i].includes(j), `${i} ${j}`).toBe(linked);
        if (linked && i < j) links++;
      }
      expect(ADJ[i].includes(i)).toBe(false);
    }
    expect(links).toBe(32);
    // Corners have 2 links, outer and inner middles 3, the middle square's middles 4.
    expect(ADJ[0]).toHaveLength(2);
    expect(ADJ[1]).toHaveLength(3);
    expect(ADJ[9]).toHaveLength(4);
    expect(ADJ[17]).toHaveLength(3);
  });
  it('has the same 16 lines as the coordinate definition, and every point is on exactly two', () => {
    expect(LINES).toHaveLength(16);
    expect(REF_LINES).toHaveLength(16);
    const norm = (l: readonly number[]): string => l.map((i) => k2(COORDS[i])).sort().join('|');
    expect(new Set(LINES.map(norm))).toEqual(new Set(REF_LINES.map((l) => l.map(k2).sort().join('|'))));
    for (let i = 0; i < POINTS; i++) expect(LINES_OF[i]).toHaveLength(2);
  });
  it('names a point for the status line', () => {
    expect(pointName(0)).toBe('top-left of the outer square');
    expect(pointName(11)).toBe('right of the middle square');
    expect(pointName(21)).toBe('bottom of the inner square');
  });
});

describe('the opening', () => {
  const s = newGame();
  it('has 9 pieces in hand each, an empty board, Amber to move and 24 places', () => {
    expect(Array.from(s.b)).toEqual(new Array(24).fill(0));
    expect(s.hand).toEqual([0, 9, 9]);
    expect(s.toMove).toBe(AMBER);
    expect(baseMoves(s)).toHaveLength(24);
    expect(legalMoves(s)).toHaveLength(24);
    expect(phaseOf(s, AMBER)).toBe('place');
    expect(outcome(s)).toEqual({ over: false, winner: null, reason: 'none' });
    expect(newGame(VIOLET).toMove).toBe(VIOLET);
  });
  it('placing uses a piece from the hand and passes the turn', () => {
    const next = applyMove(s, { from: -1, to: 4, remove: -1 })!;
    expect(next.b[4]).toBe(AMBER);
    expect(next.hand).toEqual([0, 8, 9]);
    expect(next.toMove).toBe(VIOLET);
    expect(next.quiet).toBe(0);
    expect(s.b[4]).toBe(0); // never mutates
    expect(s.hand).toEqual([0, 9, 9]);
  });
});

describe('mills and removal', () => {
  it('closing a line by placing makes the player remove a piece', () => {
    const s = pos({ 0: AMBER, 1: AMBER, 20: VIOLET }, 7, 8);
    const closing = legalMoves(s).filter((m) => m.to === 2);
    expect(closing.length).toBeGreaterThan(0);
    expect(closing.every((m) => m.remove === 20)).toBe(true);
    expect(needsRemoval(s, -1, 2)).toBe(true);
    expect(needsRemoval(s, -1, 3)).toBe(false);
    const after = applyMove(s, { from: -1, to: 2, remove: 20 })!;
    expect(after.b[20]).toBe(0);
    expect(after.b[2]).toBe(AMBER);
    expect(after.quiet).toBe(0);
    expect(totalPieces(after, VIOLET)).toBe(8);
    expect(millCount(after.b, AMBER)).toBe(1);
  });
  it('a piece in a mill is protected while the opponent has a piece outside one', () => {
    const s = pos({ 0: AMBER, 1: AMBER, 16: VIOLET, 17: VIOLET, 18: VIOLET, 20: VIOLET }, 6, 5);
    expect(removalChoices(s, -1, 2)).toEqual([20]);
    expect(applyMove(s, { from: -1, to: 2, remove: 16 })).toBeNull();
    expect(applyMove(s, { from: -1, to: 2, remove: 20 })).not.toBeNull();
  });
  it('when every opposing piece is in a mill, any of them may be taken', () => {
    const s = pos({ 0: AMBER, 1: AMBER, 16: VIOLET, 17: VIOLET, 18: VIOLET }, 6, 6);
    expect(ids(removalChoices(s, -1, 2))).toEqual([16, 17, 18]);
    expect(applyMove(s, { from: -1, to: 2, remove: 17 })).not.toBeNull();
  });
  it('two mills closed by one move still take only one piece', () => {
    // 8-9-10 and 10-11-12 both close at 10.
    const s = pos({ 8: AMBER, 9: AMBER, 11: AMBER, 12: AMBER, 20: VIOLET, 21: VIOLET }, 5, 5);
    const closing = legalMoves(s).filter((m) => m.to === 10);
    expect(ids(closing.map((m) => m.remove))).toEqual([20, 21]);
    const after = applyMove(s, { from: -1, to: 10, remove: 21 })!;
    expect(millCount(after.b, AMBER)).toBe(2);
    expect(totalPieces(after, VIOLET)).toBe(6);
  });
  it('a mill can be closed by sliding a piece in', () => {
    const s = pos({ 0: AMBER, 1: AMBER, 3: AMBER, 8: AMBER, 20: VIOLET, 22: VIOLET, 23: VIOLET }, 0, 0);
    // The piece on 3 slides to 2 (adjacent) and closes 0-1-2.
    const slide = legalMoves(s).filter((m) => m.from === 3 && m.to === 2);
    expect(slide.length).toBeGreaterThan(0);
    expect(slide.every((m) => m.remove >= 0)).toBe(true);
    const opened = applyMove({ ...s, toMove: AMBER }, { from: 1, to: 9, remove: -1 });
    expect(opened).not.toBeNull();
    expect(closesMill(s.b, 3, 2, AMBER)).toBe(true);
    expect(inMill(s.b, 0)).toBe(false);
  });
  it('closing a mill when the opponent has nothing on the board takes nothing and is still legal', () => {
    const s = pos({ 0: AMBER, 1: AMBER }, 7, 9);
    const closing = legalMoves(s).filter((m) => m.to === 2);
    expect(closing).toEqual([{ from: -1, to: 2, remove: -1 }]);
    expect(needsRemoval(s, -1, 2)).toBe(false);
    expect(applyMove(s, { from: -1, to: 2, remove: -1 })).not.toBeNull();
  });
  it('removal resets the quiet count, a slide without a mill adds to it', () => {
    const s = pos({ 0: AMBER, 4: AMBER, 6: AMBER, 7: AMBER, 14: VIOLET, 18: VIOLET, 22: VIOLET, 20: VIOLET }, 0, 0, AMBER, 12);
    const slid = applyMove(s, { from: 0, to: 1, remove: -1 })!;
    expect(slid.quiet).toBe(13);
    expect(slid.toMove).toBe(VIOLET);
  });
});

describe('moving and flying', () => {
  it('a piece slides only to a linked empty point', () => {
    const s = pos({ 0: AMBER, 2: AMBER, 4: AMBER, 6: AMBER, 8: VIOLET, 10: VIOLET, 12: VIOLET, 14: VIOLET }, 0, 0);
    expect(phaseOf(s, AMBER)).toBe('move');
    const from0 = baseMoves(s).filter((m) => m.from === 0).map((m) => m.to);
    expect(ids(from0)).toEqual([1, 7]);
    expect(applyMove(s, { from: 0, to: 3, remove: -1 })).toBeNull(); // not linked
    expect(applyMove(s, { from: 0, to: 8, remove: -1 })).toBeNull(); // occupied
    expect(applyMove(s, { from: 0, to: 1, remove: -1 })).not.toBeNull();
  });
  it('a player with exactly three pieces and none in hand may fly to any empty point', () => {
    const s = pos({ 0: AMBER, 4: AMBER, 13: AMBER, 8: VIOLET, 10: VIOLET, 12: VIOLET, 14: VIOLET }, 0, 0);
    expect(phaseOf(s, AMBER)).toBe('fly');
    expect(phaseOf(s, VIOLET)).toBe('move');
    expect(baseMoves(s)).toHaveLength(3 * (24 - 7));
    expect(applyMove(s, { from: 0, to: 20, remove: -1 })).not.toBeNull();
  });
  it('three pieces on the board with more in hand still means placing, not flying', () => {
    const s = pos({ 0: AMBER, 4: AMBER, 13: AMBER }, 2, 5);
    expect(phaseOf(s, AMBER)).toBe('place');
    expect(baseMoves(s).every((m) => m.from === -1)).toBe(true);
  });
  it('a side with four pieces cannot fly', () => {
    const s = pos({ 0: AMBER, 4: AMBER, 13: AMBER, 20: AMBER, 8: VIOLET, 10: VIOLET, 12: VIOLET }, 0, 0);
    expect(phaseOf(s, AMBER)).toBe('move');
    expect(baseMoves(s).every((m) => ADJ[m.from].includes(m.to))).toBe(true);
  });
});

describe('the end of the game', () => {
  it('a side down to two pieces on the board (none in hand) loses', () => {
    const s = pos({ 0: AMBER, 1: AMBER, 2: AMBER, 5: AMBER, 20: VIOLET, 22: VIOLET }, 0, 0, AMBER);
    expect(outcome(s)).toEqual({ over: true, winner: AMBER, reason: 'pieces' });
    expect(applyMove(s, { from: 5, to: 4, remove: -1 })).toBeNull(); // finished games take no more moves
    expect(legalMoves(s).length).toBeGreaterThan(0);
  });
  it('pieces in hand count: 1 on the board and 1 in hand is two pieces and a loss, 1 and 2 is not', () => {
    expect(outcome(pos({ 0: AMBER, 3: AMBER, 5: AMBER, 20: VIOLET }, 1, 1, AMBER)).over).toBe(true);
    expect(outcome(pos({ 0: AMBER, 3: AMBER, 5: AMBER, 20: VIOLET }, 1, 2, AMBER)).over).toBe(false);
  });
  it('taking the third-to-last piece wins', () => {
    const s = pos({ 0: AMBER, 1: AMBER, 20: VIOLET, 22: VIOLET, 23: VIOLET }, 7, 0, AMBER);
    const after = applyMove(s, { from: -1, to: 2, remove: 20 })!;
    expect(outcome(after)).toEqual({ over: true, winner: AMBER, reason: 'pieces' });
  });
  it('a player who cannot move loses (a flying player never is blocked)', () => {
    // Amber has the four corners of the outer square; Violet sits on all four middles.
    const s = pos({ 0: AMBER, 2: AMBER, 4: AMBER, 6: AMBER, 1: VIOLET, 3: VIOLET, 5: VIOLET, 7: VIOLET }, 0, 0, AMBER);
    expect(baseMoves(s)).toHaveLength(0);
    expect(outcome(s)).toEqual({ over: true, winner: VIOLET, reason: 'blocked' });
    // The same side to move with Violet to move is not over: Violet can step inwards.
    expect(outcome({ ...s, toMove: VIOLET }).over).toBe(false);
  });
  it(`is drawn after ${QUIET_LIMIT} plies with nothing placed or removed, not before`, () => {
    expect(QUIET_LIMIT).toBe(40);
    const base = { 0: AMBER, 2: AMBER, 4: AMBER, 6: AMBER, 8: VIOLET, 10: VIOLET, 12: VIOLET, 14: VIOLET } as Record<number, Player>;
    expect(outcome(pos(base, 0, 0, AMBER, 39)).over).toBe(false);
    expect(outcome(pos(base, 0, 0, AMBER, 40))).toEqual({ over: true, winner: null, reason: 'quiet' });
    // The 40th quiet ply makes the draw.
    const s = applyMove(pos(base, 0, 0, AMBER, 39), { from: 0, to: 1, remove: -1 })!;
    expect(outcome(s).reason).toBe('quiet');
  });
  it('a loss outranks the draw', () => {
    const s = pos({ 0: AMBER, 1: AMBER, 2: AMBER, 5: AMBER, 20: VIOLET, 22: VIOLET }, 0, 0, AMBER, 45);
    expect(outcome(s).reason).toBe('pieces');
  });
  it('describes every ending', () => {
    expect(describeOutcome({ over: false, winner: null, reason: 'none' }, null)).toBe('The game is not finished.');
    expect(describeOutcome({ over: true, winner: null, reason: 'quiet' }, AMBER)).toBe('Draw: 40 moves in a row with no piece placed or taken.');
    expect(describeOutcome({ over: true, winner: AMBER, reason: 'pieces' }, AMBER)).toBe('You win: the other side is down to two pieces.');
    expect(describeOutcome({ over: true, winner: VIOLET, reason: 'pieces' }, AMBER)).toBe('The computer wins: the other side is down to two pieces.');
    expect(describeOutcome({ over: true, winner: VIOLET, reason: 'blocked' }, null)).toBe('Violet wins: the other side could not move.');
    expect(describeOutcome({ over: true, winner: AMBER, reason: 'blocked' }, null)).toBe('Amber wins: the other side could not move.');
  });
});

describe('illegal input', () => {
  const s = pos({ 0: AMBER, 1: AMBER, 20: VIOLET }, 7, 8);
  it('rejects everything that is not a legal move, and never mutates', () => {
    const copy = Array.from(s.b);
    const bad: unknown[] = [
      { from: -1, to: 0, remove: -1 }, // occupied
      { from: -1, to: 24, remove: -1 },
      { from: -1, to: -1, remove: -1 },
      { from: -2, to: 3, remove: -1 },
      { from: 0, to: 3, remove: -1 }, // sliding while pieces are still in hand
      { from: -1, to: 2, remove: -1 }, // closes a mill, removal missing
      { from: -1, to: 2, remove: 0 }, // removing own piece
      { from: -1, to: 2, remove: 5 }, // removing an empty point
      { from: -1, to: 3, remove: 20 }, // removal without a mill
      { from: -1, to: 3.5, remove: -1 },
      { from: NaN, to: 3, remove: -1 },
      { from: -1, to: 3, remove: Infinity },
      { from: '-1', to: 3, remove: -1 },
      null,
      undefined,
      {},
    ];
    for (const m of bad) expect(applyMove(s, m as Move), JSON.stringify(m)).toBeNull();
    expect(Array.from(s.b)).toEqual(copy);
  });
});

describe('a separately written model agrees with the engine', () => {
  it('lists the same legal moves, removals included, in 4000 random positions (any piece counts, hands and side to move)', () => {
    const rng = mulberry32(2026);
    let flying = 0;
    let withMill = 0;
    let blocked = 0;
    for (let g = 0; g < 4000; g++) {
      const b = new Int8Array(POINTS);
      const order = shuffled(Array.from({ length: POINTS }, (_, i) => i), rng);
      const a = Math.floor(rng() * 10);
      const v = Math.floor(rng() * 10);
      for (let k = 0; k < a; k++) b[order[k]] = AMBER;
      for (let k = 0; k < v; k++) b[order[a + k]] = VIOLET;
      const hand1 = rng() < 0.4 ? Math.floor(rng() * 6) : 0;
      const hand2 = rng() < 0.4 ? Math.floor(rng() * 6) : 0;
      const s: State = { b, hand: [0, hand1, hand2], toMove: rng() < 0.5 ? AMBER : VIOLET, quiet: 0, plies: 0 };
      const mine = onBoard(b, s.toMove);
      const model = refFull(toRef(s));
      expect(engineFull(s)).toEqual(model);
      if (s.hand[s.toMove] === 0 && mine === 3) flying++;
      if (legalMoves(s).some((m) => m.remove >= 0)) withMill++;
      if (baseMoves(s).length === 0) blocked++;
    }
    expect(flying).toBeGreaterThan(100);
    expect(withMill).toBeGreaterThan(300);
    expect(blocked).toBeGreaterThan(50);
  });

  it('plays 300 random games in step with the model: same moves, same boards, same hands, same result', () => {
    const rng = mulberry32(99);
    let maxPlies = 0;
    const reasons = { pieces: 0, blocked: 0, quiet: 0 };
    let flightsSeen = 0;
    let millsSeen = 0;
    for (let g = 0; g < 300; g++) {
      let s = newGame(g % 2 === 0 ? AMBER : VIOLET);
      let r = toRef(s);
      for (let ply = 0; ply < 900; ply++) {
        const ro = refOutcome(r);
        const eo = outcome(s);
        expect(eo.over).toBe(ro.over);
        expect(eo.winner).toBe(ro.winner);
        expect(eo.reason).toBe(ro.reason);
        if (eo.over) { reasons[eo.reason as 'pieces']++; break; }
        const full = engineFull(s);
        expect(full).toEqual(refFull(r));
        // Pick the move in the model's list, so the model leads.
        const pickStr = full[Math.floor(rng() * full.length)];
        const m = legalMoves(s).find((x) => `${x.from < 0 ? '-' : k2(COORDS[x.from])}>${k2(COORDS[x.to])}x${x.remove < 0 ? '-' : k2(COORDS[x.remove])}` === pickStr)!;
        const [f, t, rem] = toModel(m);
        if (phaseOf(s, s.toMove) === 'fly') flightsSeen++;
        if (m.remove >= 0) millsSeen++;
        const next = applyMove(s, m)!;
        expect(next).not.toBeNull();
        r = refApply(r, f, t, rem);
        s = next;
        // Board, hands, side to move and quiet count agree.
        for (let i = 0; i < POINTS; i++) expect(s.b[i]).toBe(r.owner.get(k2(COORDS[i])) ?? 0);
        expect(s.hand[1]).toBe(r.hand[1]);
        expect(s.hand[2]).toBe(r.hand[2]);
        expect(s.toMove).toBe(r.toMove);
        expect(s.quiet).toBe(r.quiet);
        // Pieces are only ever lost.
        expect(totalPieces(s, AMBER)).toBeLessThanOrEqual(PIECES);
        expect(totalPieces(s, VIOLET)).toBeLessThanOrEqual(PIECES);
        maxPlies = Math.max(maxPlies, ply + 1);
      }
      expect(outcome(s).over).toBe(true);
    }
    expect(flightsSeen).toBeGreaterThan(200);
    expect(millsSeen).toBeGreaterThan(1500);
    expect(reasons.pieces).toBeGreaterThan(150);
    expect(reasons.quiet).toBeGreaterThan(10); // random shuffling does reach the 40-ply draw
    // Every game ends: 18 placing plies, at most 14 pieces to take, and 40 quiet plies at most between them.
    expect(maxPlies).toBeLessThanOrEqual(18 + 15 * QUIET_LIMIT);
  }, 120_000);
});

describe('the search', () => {
  /** Plain minimax with no pruning and no move ordering, over the same rules and evaluation. */
  const plain = (s: State, depth: number): number => {
    const me = s.toMove;
    if (totalPieces(s, me) < 3) return -(WIN_SCORE + depth);
    if (totalPieces(s, otherPlayer(me)) < 3) return WIN_SCORE + depth;
    if (s.quiet >= QUIET_LIMIT) return 0;
    if (depth <= 0) return baseMoves(s).length === 0 ? -(WIN_SCORE + depth) : evaluate(s);
    const moves = legalMoves(s);
    if (!moves.length) return -(WIN_SCORE + depth);
    let best = -Infinity;
    for (const m of moves) best = Math.max(best, -plain(applyMove(s, m)!, depth - 1));
    return best;
  };
  const midgames = (count: number, seed: number): State[] => {
    const rng = mulberry32(seed);
    const out: State[] = [];
    for (let g = 0; g < count; g++) {
      let s = newGame();
      const stop = 2 + Math.floor(rng() * 40);
      for (let ply = 0; ply < stop && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (!outcome(s).over) out.push(s);
    }
    return out;
  };

  it('gives the same value as a plain minimax at depths 1 to 3 in positions from random games (depth 3 where the move list is short)', () => {
    let checked = 0;
    let deep = 0;
    for (const s of midgames(60, 11)) {
      for (let d = 1; d <= 2; d++) expect(searchValue(s, d) + 0).toBe(plain(s, d) + 0);
      if (legalMoves(s).length <= 14) { expect(searchValue(s, 3) + 0).toBe(plain(s, 3) + 0); deep++; }
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
    expect(deep).toBeGreaterThan(10);
  }, 240_000);

  it('values a won position above any heuristic score and a lost one below', () => {
    const won = pos({ 0: AMBER, 1: AMBER, 20: VIOLET, 22: VIOLET, 23: VIOLET }, 7, 0, AMBER);
    expect(searchValue(won, 1)).toBeGreaterThan(WIN_SCORE - 10);
    const lost = pos({ 20: AMBER, 22: AMBER, 0: VIOLET, 1: VIOLET, 2: VIOLET, 5: VIOLET }, 0, 0, AMBER); // Amber is down to two pieces
    expect(searchValue(lost, 3)).toBeLessThan(-WIN_SCORE + 10);
    expect(Math.abs(evaluate(newGame()))).toBeLessThan(WIN_SCORE);
    expect(evaluate(newGame())).toBe(0);
  });

  it('a search of depth d returns a legal move, deterministic for a seed', () => {
    for (const s of midgames(8, 5)) {
      const m = bestMove(s, 2, mulberry32(3))!;
      expect(legalMoves(s).map(key)).toContain(key(m));
      expect(key(bestMove(s, 2, mulberry32(3))!)).toBe(key(m));
    }
  });
});

describe('computer players', () => {
  it('Easy returns a legal move, deterministic for a seed, and null when there is none', () => {
    const s = newGame();
    const m = randomMove(s, mulberry32(1))!;
    expect(legalMoves(s).map(key)).toContain(key(m));
    expect(key(randomMove(s, mulberry32(1))!)).toBe(key(m));
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(key(randomMove(s, mulberry32(i))!));
    expect(seen.size).toBeGreaterThan(8);
    const blocked = pos({ 0: AMBER, 2: AMBER, 4: AMBER, 6: AMBER, 1: VIOLET, 3: VIOLET, 5: VIOLET, 7: VIOLET }, 0, 0, AMBER);
    expect(randomMove(blocked, mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'hard', mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'medium', mulberry32(1))).toBeNull();
  });
  it('every level plays a legal move in positions from random games, and Medium and Hard are deterministic with a fixed clock', () => {
    const rng = mulberry32(21);
    const fast = { now: () => 0, maxDepth: 3 };
    for (let g = 0; g < 14; g++) {
      let s = newGame();
      for (let ply = 0; ply < g * 4 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      for (const level of ['easy', 'medium', 'hard'] as Level[]) {
        const m = chooseMove(s, level, mulberry32(g), fast)!;
        expect(legalMoves(s).map(key)).toContain(key(m));
        if (level !== 'easy') expect(key(chooseMove(s, level, mulberry32(g), fast)!)).toBe(key(m));
      }
    }
  }, 120_000);
  it('closes a mill when it can, and blocks one when it must (Medium and Hard)', () => {
    // Violet has three pieces in all, so closing the mill and taking one wins the game on the spot.
    const win = pos({ 0: AMBER, 1: AMBER, 13: AMBER, 20: VIOLET, 22: VIOLET }, 6, 1, AMBER);
    for (const level of ['medium', 'hard'] as Level[]) {
      const m = chooseMove(win, level, mulberry32(1), { now: () => 0, maxDepth: 3 })!;
      expect(m.to).toBe(2);
      expect(m.remove).toBeGreaterThanOrEqual(0);
    }
    // Violet threatens 2-3-4 (it holds 3 and 4). Amber has three pieces in all, so losing one would lose the game: it must play on 2.
    const block = pos({ 3: VIOLET, 4: VIOLET, 13: AMBER, 18: AMBER }, 1, 7, AMBER);
    for (const level of ['medium', 'hard'] as Level[]) {
      for (const seed of [1, 2, 3]) {
        const m = chooseMove(block, level, mulberry32(seed), { now: () => 0, maxDepth: 3 })!;
        expect(m.to).toBe(2);
      }
    }
  });
  it('Medium beats Easy in at least 5 of 6 seeded games, alternating who moves first', () => {
    expect(playGames('medium', 6, { now: () => 0 })).toBeGreaterThanOrEqual(5);
  }, 120_000);
  it('Hard (searching 4 moves here) beats Easy in at least 5 of 6 seeded games', () => {
    expect(playGames('hard', 6, { now: () => 0, maxDepth: 4, budgetMs: 1e9 })).toBeGreaterThanOrEqual(5);
  }, 120_000);
});

/** Wins by the strong level over Easy; the first move alternates. Draws and losses count against the strong level. */
const playGames = (strong: Level, games: number, opts: { now?: () => number; maxDepth?: number; budgetMs?: number }): number => {
  let wins = 0;
  for (let g = 0; g < games; g++) {
    const strongSide: Player = g % 2 === 0 ? AMBER : VIOLET;
    const rng = mulberry32(3000 + g);
    let s = newGame(AMBER);
    let guard = 0;
    while (!outcome(s).over && guard++ < 900) {
      const level: Level = s.toMove === strongSide ? strong : 'easy';
      s = applyMove(s, chooseMove(s, level, rng, opts)!)!;
    }
    if (outcome(s).winner === strongSide) wins++;
  }
  return wins;
};

describe('time budget', () => {
  it('states the numbers the page quotes', () => {
    expect(MEDIUM_DEPTH).toBe(3);
    expect(HARD_DEPTH).toBe(5);
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(1000);
  });
  it('Hard answers every position it is asked about within a generous bound, with the real settings', () => {
    const rng = mulberry32(8);
    let worst = 0;
    let count = 0;
    for (let g = 0; g < 14; g++) {
      let s = newGame();
      for (let ply = 0; ply < g * 3 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      const t0 = performance.now();
      const m = deepMove(s, rng)!;
      worst = Math.max(worst, performance.now() - t0);
      count++;
      expect(legalMoves(s).map(key)).toContain(key(m));
    }
    expect(count).toBeGreaterThan(10);
    expect(worst).toBeLessThan(4000);
  }, 120_000);
  it('Medium (3 moves ahead) also stays within the bound on the opening and the first replies', () => {
    const rng = mulberry32(2);
    let s = newGame();
    for (let ply = 0; ply < 6; ply++) {
      const t0 = performance.now();
      const m = bestMove(s, MEDIUM_DEPTH, rng)!;
      expect(performance.now() - t0).toBeLessThan(4000);
      s = applyMove(s, m)!;
    }
  }, 60_000);
  it('the clock and a node cap are live from the first depth: a tiny budget or cap stops the search almost at once and still gives a legal move', () => {
    expect(HARD_BUDGET_MS).toBe(400); // the number on the guide page
    expect(HARD_NODE_CAP).toBe(110000);
    const s = applyMove(newGame(), { from: -1, to: 4, remove: -1 })!;
    let t = 0;
    const m = deepMove(s, mulberry32(5), { now: () => (t += 10), budgetMs: 5 })!;
    expect(legalMoves(s).map(key)).toContain(key(m));
    expect(lastSearchNodes).toBeLessThanOrEqual(64);
    for (const cap of [1, 40, 500, 5000]) {
      const m2 = deepMove(s, mulberry32(5), { now: () => 0, budgetMs: 1e9, maxNodes: cap })!;
      expect(legalMoves(s).map(key)).toContain(key(m2));
      expect(lastSearchNodes).toBeLessThanOrEqual(cap + 64);
    }
  });
  it('stops deepening when the clock runs out: a zero budget still gives a legal move from the first depth', () => {
    const s = applyMove(newGame(), { from: -1, to: 4, remove: -1 })!;
    const m = deepMove(s, mulberry32(3), { budgetMs: 0 })!;
    expect(legalMoves(s).map(key)).toContain(key(m));
    let ticks = 0;
    const m2 = deepMove(s, mulberry32(3), { now: () => ticks++ * 50, budgetMs: 100 })!;
    expect(legalMoves(s).map(key)).toContain(key(m2));
  });
});

describe('words and bookkeeping', () => {
  it('names the sides and pluralises', () => {
    expect(nameOf(AMBER)).toBe('Amber');
    expect(nameOf(VIOLET)).toBe('Violet');
    expect(piecesText(1)).toBe('1 piece');
    expect(piecesText(0)).toBe('0 pieces');
    expect(piecesText(9)).toBe('9 pieces');
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Mill!')).toBe('Mill! Computer is thinking...');
  });
  it('finds the move Undo goes back to', () => {
    expect(undoIndex([], AMBER)).toBe(-1);
    expect(undoIndex([AMBER, VIOLET, AMBER, VIOLET], AMBER)).toBe(2);
    expect(undoIndex([AMBER, VIOLET, AMBER, VIOLET], VIOLET)).toBe(3);
    expect(undoIndex([VIOLET, VIOLET], AMBER)).toBe(-1);
    expect(undoIndex([AMBER, VIOLET, AMBER], null)).toBe(2);
  });
  it('cleans the level from the address bar', () => {
    expect(cleanLevel('hard')).toBe('hard');
    expect(cleanLevel('easy')).toBe('easy');
    for (const junk of ['nope', '', '__proto__', 'constructor', null, undefined, 3, [], {}]) expect(cleanLevel(junk)).toBe('medium');
    expect(cleanLevel(undefined, 'easy')).toBe('easy');
  });
  it('removable() only lists the other side, and none are listed from an empty board', () => {
    const b = new Int8Array(POINTS);
    expect(removable(b, VIOLET)).toEqual([]);
    b[0] = VIOLET; b[1] = VIOLET; b[2] = VIOLET; b[10] = AMBER;
    expect(ids(removable(b, VIOLET))).toEqual([0, 1, 2]);
    expect(removable(b, AMBER)).toEqual([10]);
  });
});
