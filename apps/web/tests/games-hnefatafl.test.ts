/**
 * games-hnefatafl.test.ts - the engine behind `hnefatafl`.
 *
 * Pinned: both opening positions (9 by 9: 16 attackers, 8 defenders and the king; 7 by 7: 8, 4 and the
 * king; both unchanged by a quarter turn), rook-like moves with the throne and corners kept for the king
 * (and the empty throne passable), sandwich captures (against a friend, a corner, the throne), safe
 * stepping between two enemies, several captures at once, the armed king, the rules for capturing the king
 * on both sizes (four sides, three beside the throne, none on the edge, two on the small board away from
 * the throne), the king's way out and the win by reaching a corner, a side that cannot move, the draw after
 * 80 quiet plies, illegal input, a separately written rules model compared with the engine in thousands of
 * random positions and hundreds of random games, the alpha-beta search against a plain minimax, the three
 * computer levels for either side (legal, repeatable, they take a win and see a threat), and the limits.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, destinationsFrom, applyMove, stepState, findMove, capturesOf, outcome, countPieces, kingExits, evaluate, evaluateForAttackers,
  searchValue, bestMove, mediumMove, hardMove, iterativeMove, randomMove, chooseMove, mulberry32, shuffled, describeOutcome, describeMove, piecesText, countOf, thinkingMessage,
  undoIndex, cleanLevel, cleanSize, nameOf, otherSide, cellName, rowOf, colOf, isSquare, geometry, isDecided,
  SIZES, DEFAULT_SIZE, QUIET_LIMIT, MEDIUM_DEPTH, HARD_DEPTH, MEDIUM_NODE_CAP, MEDIUM_BUDGET_MS, HARD_BUDGET_MS, HARD_NODE_CAP, lastSearchNodes, WIN_SCORE,
  ATTACKERS, DEFENDERS, KING,
  type State, type Side, type Level, type Move,
} from '../src/components/apps-private/hnefatafl/helpers';

const sig = (m: Move): string => `${m.from}>${m.to}`;

/** A position from [row, column] lists. The king is optional (null means captured). */
const pos = (n: number, att: [number, number][], def: [number, number][], king: [number, number] | null, toMove: Side = ATTACKERS, quiet = 0): State => {
  const b = new Int8Array(n * n);
  for (const [r, c] of att) b[r * n + c] = ATTACKERS;
  for (const [r, c] of def) b[r * n + c] = DEFENDERS;
  let k = -1;
  if (king) { k = king[0] * n + king[1]; b[k] = KING; }
  return { n, b, king: k, toMove, quiet, plies: 0 };
};
const at = (n: number, r: number, c: number): number => r * n + c;

// ── An independent model: coordinates and loops, no ray tables ──────────────

type Board = number[][];
const toBoard = (s: State): Board => Array.from({ length: s.n }, (_, r) => Array.from({ length: s.n }, (_, c) => s.b[r * s.n + c]));
const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const refThrone = (n: number): [number, number] => [(n - 1) / 2, (n - 1) / 2];
const refCorner = (n: number, r: number, c: number): boolean => (r === 0 || r === n - 1) && (c === 0 || c === n - 1);
const inside = (n: number, r: number, c: number): boolean => r >= 0 && r < n && c >= 0 && c < n;

const refMovesFor = (board: Board, side: Side): string[] => {
  const n = board.length;
  const [tr, tc] = refThrone(n);
  const out: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const p = board[r][c];
    const mine = side === ATTACKERS ? p === ATTACKERS : p === DEFENDERS || p === KING;
    if (!mine) continue;
    for (const [dr, dc] of DIRS) {
      for (let k = 1; ; k++) {
        const rr = r + dr * k;
        const cc = c + dc * k;
        if (!inside(n, rr, cc) || board[rr][cc] !== 0) break;
        const special = refCorner(n, rr, cc) || (rr === tr && cc === tc);
        if (special && p !== KING) continue;
        out.push(`${r * n + c}>${rr * n + cc}`);
      }
    }
  }
  return out.sort();
};

/** Squares captured when `side` has just moved a piece onto (r, c) on this board. */
const refCaptured = (board: Board, r: number, c: number, side: Side, kingCol = -1): string[] => {
  const n = board.length;
  const [tr, tc] = refThrone(n);
  const caps: string[] = [];
  const friend = (p: number): boolean => (side === ATTACKERS ? p === ATTACKERS : p === DEFENDERS || p === KING);
  for (const [dr, dc] of DIRS) {
    const r1 = r + dr;
    const c1 = c + dc;
    if (!inside(n, r1, c1)) continue;
    const q = board[r1][c1];
    if (q === 0) continue;
    const r2 = r1 + dr;
    const c2 = c1 + dc;
    if (side === ATTACKERS && q === DEFENDERS) {
      if (!inside(n, r2, c2)) continue;
      const hostileSquare = refCorner(n, r2, c2) || (r2 === tr && c2 === tc && board[r2][c2] === 0);
      if (board[r2][c2] === ATTACKERS || hostileSquare) caps.push(`${r1},${c1}`);
    } else if (side === DEFENDERS && q === ATTACKERS) {
      if (!inside(n, r2, c2)) continue;
      const hostileSquare = refCorner(n, r2, c2) || (r2 === tr && c2 === tc);
      if (friend(board[r2][c2]) || hostileSquare) caps.push(`${r1},${c1}`);
    } else if (side === ATTACKERS && q === KING) {
      const nearThrone = Math.abs(r1 - tr) + Math.abs(c1 - tc) <= 1;
      if (n === 7 && !nearThrone) {
        const ro = r1 + dr;
        const co = c1 + dc;
        if (inside(n, ro, co) && board[ro][co] === ATTACKERS) caps.push(`${r1},${c1}`);
      } else {
        let all = true;
        for (const [er, ec] of DIRS) {
          const rr = r1 + er;
          const cc = c1 + ec;
          if (!inside(n, rr, cc)) { all = false; break; }
          const isThrone = rr === tr && cc === tc && !(r1 === tr && c1 === tc);
          if (board[rr][cc] !== ATTACKERS && !isThrone) { all = false; break; }
        }
        if (all) caps.push(`${r1},${c1}`);
      }
    }
  }
  return caps;
};

interface Ref { board: Board; toMove: Side; quiet: number }
const toRef = (s: State): Ref => ({ board: toBoard(s), toMove: s.toMove, quiet: s.quiet });
const refOutcome = (p: Ref): { over: boolean; winner: Side | null; reason: string } => {
  const n = p.board.length;
  let kr = -1;
  let kc = -1;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (p.board[r][c] === KING) { kr = r; kc = c; }
  if (kr >= 0 && refCorner(n, kr, kc)) return { over: true, winner: DEFENDERS, reason: 'escaped' };
  if (kr < 0) return { over: true, winner: ATTACKERS, reason: 'captured' };
  if (refMovesFor(p.board, p.toMove).length === 0) return { over: true, winner: p.toMove === ATTACKERS ? DEFENDERS : ATTACKERS, reason: 'blocked' };
  if (p.quiet >= 80) return { over: true, winner: null, reason: 'quiet' };
  return { over: false, winner: null, reason: 'none' };
};
const refApply = (p: Ref, text: string): Ref => {
  const n = p.board.length;
  const [from, to] = text.split('>').map(Number);
  const board = p.board.map((row) => row.slice());
  const piece = board[Math.floor(from / n)][from % n];
  board[Math.floor(from / n)][from % n] = 0;
  board[Math.floor(to / n)][to % n] = piece;
  const caps = refCaptured(board, Math.floor(to / n), to % n, p.toMove);
  for (const k of caps) { const [r, c] = k.split(',').map(Number); board[r][c] = 0; }
  return { board, toMove: p.toMove === ATTACKERS ? DEFENDERS : ATTACKERS, quiet: caps.length ? 0 : p.quiet + 1 };
};
const engineCapsText = (s: State, m: Move): string[] => capturesOf(s, m).map((i) => `${rowOf(s.n, i)},${colOf(s.n, i)}`).sort();

describe('geometry and setup', () => {
  it('has the two sizes, default 9; the throne is the middle square; corners are the four corners', () => {
    expect(Array.from(SIZES)).toEqual([9, 7]);
    expect(DEFAULT_SIZE).toBe(9);
    expect(geometry(9).throne).toBe(40);
    expect(geometry(7).throne).toBe(24);
    expect(Array.from(geometry(9).corners)).toEqual([0, 8, 72, 80]);
    expect(Array.from(geometry(7).corners)).toEqual([0, 6, 42, 48]);
  });
  it('9 by 9: 16 attackers in four groups of four, 8 defenders in a cross, the king on the throne, the attackers to move', () => {
    const s = newGame(9);
    const c = countPieces(s);
    expect(c).toEqual({ attackers: 16, defenders: 8, king: true });
    expect(s.king).toBe(40);
    expect(s.b[40]).toBe(KING);
    expect(s.toMove).toBe(ATTACKERS);
    expect(outcome(s)).toEqual({ over: false, winner: null, reason: 'none' });
    for (const [r, cc] of [[0, 3], [0, 4], [0, 5], [1, 4], [4, 0], [4, 1], [4, 7], [4, 8]]) expect(s.b[at(9, r, cc)]).toBe(ATTACKERS);
    for (const [r, cc] of [[2, 4], [3, 4], [4, 2], [4, 3]]) expect(s.b[at(9, r, cc)]).toBe(DEFENDERS);
  });
  it('7 by 7: 8 attackers, 4 defenders and the king', () => {
    const s = newGame(7);
    expect(countPieces(s)).toEqual({ attackers: 8, defenders: 4, king: true });
    expect(s.king).toBe(24);
    expect(s.n).toBe(7);
  });
  it('both openings look the same after a quarter turn and a flip', () => {
    for (const n of [7, 9]) {
      const s = newGame(n);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const p = s.b[r * n + c];
        expect(s.b[c * n + (n - 1 - r)], `n=${n} turn`).toBe(p);
        expect(s.b[r * n + (n - 1 - c)], `n=${n} mirror`).toBe(p);
      }
    }
  });
  it('the opening moves match the model; the counts are pinned: 9 by 9 has 72 for the attackers and 56 for the defenders, 7 by 7 has 40 and 24', () => {
    const counts: Record<string, number> = {};
    for (const n of [9, 7]) {
      const s = newGame(n);
      const a = legalMoves(s);
      const d = legalMoves({ ...s, toMove: DEFENDERS });
      expect(a.map(sig).sort()).toEqual(refMovesFor(toBoard(s), ATTACKERS));
      expect(d.map(sig).sort()).toEqual(refMovesFor(toBoard(s), DEFENDERS));
      counts[`${n}a`] = a.length;
      counts[`${n}d`] = d.length;
    }
    expect(counts).toEqual({ '9a': 72, '9d': 56, '7a': 40, '7d': 24 });
  });
  it('names a square with 1-based row and column and cleans sizes', () => {
    expect(cellName(9, 0)).toBe('row 1, column 1');
    expect(cellName(7, 48)).toBe('row 7, column 7');
    expect(rowOf(9, 80)).toBe(8);
    expect(colOf(9, 80)).toBe(8);
    expect(isSquare(9, 80)).toBe(true);
    expect(isSquare(9, 81)).toBe(false);
    expect(isSquare(9, '3')).toBe(false);
    expect(cleanSize(7)).toBe(7);
    expect(cleanSize('7')).toBe(7);
    expect(cleanSize('9')).toBe(9);
    for (const junk of [8, 0, 11, '77', '07', 'x', '', null, undefined, NaN, 9.5, [], {}, '__proto__', true]) expect(cleanSize(junk), String(junk)).toBe(9);
    expect(cleanSize('x', 7)).toBe(7);
  });
});

describe('moving', () => {
  it('slides like a rook over empty squares only, never jumping', () => {
    // Attacker at (0,1), defender at (0,5), king at (4,4): right stops before the defender, left is a corner (closed to attackers), down is the whole column.
    const s = pos(9, [[0, 1]], [[0, 5]], [4, 4]);
    const a = destinationsFrom(s, at(9, 0, 1)).sort((x, y) => x - y);
    expect(a).toEqual([2, 3, 4, ...Array.from({ length: 8 }, (_, k) => at(9, k + 1, 1))].sort((x, y) => x - y));
  });
  it('only the king may stop on the throne or on a corner; any piece may pass over the empty throne', () => {
    const throne = at(9, 4, 4);
    const s = pos(9, [[4, 1]], [], [0, 5]);
    const d = destinationsFrom(s, at(9, 4, 1));
    expect(d).not.toContain(throne);
    expect(d).toContain(at(9, 4, 3));
    expect(d).toContain(at(9, 4, 5));
    expect(d).toContain(at(9, 4, 8));
    // A corner is never a stop for an attacker or a defender.
    const col0 = pos(9, [[3, 0]], [], [5, 5]);
    expect(destinationsFrom(col0, at(9, 3, 0))).not.toContain(0);
    const def = pos(9, [], [[3, 0]], [5, 5], DEFENDERS);
    expect(destinationsFrom(def, at(9, 3, 0))).not.toContain(0);
    // The king may stop on the throne and on a corner.
    const k1 = pos(9, [], [], [4, 1], DEFENDERS);
    expect(destinationsFrom(k1, at(9, 4, 1))).toContain(throne);
    const k2 = pos(9, [], [], [0, 3], DEFENDERS);
    expect(destinationsFrom(k2, at(9, 0, 3))).toContain(0);
    expect(destinationsFrom(k2, at(9, 0, 3))).toContain(8);
    // Nothing passes through a king that stands on the throne.
    const blocked = pos(9, [[4, 1]], [], [4, 4]);
    const expected = [at(9, 4, 0), at(9, 4, 2), at(9, 4, 3), ...[0, 1, 2, 3, 5, 6, 7, 8].map((r) => at(9, r, 1))].sort((x, y) => x - y);
    expect(destinationsFrom(blocked, at(9, 4, 1)).sort((x, y) => x - y)).toEqual(expected);
  });
  it('the sides move their own pieces only, and a king belongs to the defenders', () => {
    const s = newGame(9);
    expect(findMove(s, at(9, 0, 3), at(9, 1, 3))).not.toBeNull();
    expect(findMove(s, at(9, 2, 4), at(9, 2, 5))).toBeNull(); // a defender on the attackers' turn
    expect(findMove(s, 40, at(9, 3, 4))).toBeNull();
    const d = { ...s, toMove: DEFENDERS };
    expect(findMove(d, at(9, 2, 4), at(9, 2, 5))).not.toBeNull();
    expect(legalMoves(d).every((m) => d.b[m.from] === DEFENDERS || d.b[m.from] === KING)).toBe(true);
  });
});

describe('capturing', () => {
  it('a defender is captured when an attacker closes a sandwich on it, in a row or a column', () => {
    // Row: attacker (2,2), defender (2,3); an attacker slides up column 4 to (2,4).
    const s = pos(9, [[2, 2], [5, 4]], [[2, 3]], [7, 7], ATTACKERS);
    const m = { from: at(9, 5, 4), to: at(9, 2, 4) };
    expect(capturesOf(s, m)).toEqual([at(9, 2, 3)]);
    const after = applyMove(s, m)!;
    expect(after.b[at(9, 2, 3)]).toBe(0);
    expect(after.quiet).toBe(0);
    expect(countPieces(after).defenders).toBe(0);
    // Column: attacker (1,7), defender (2,7); an attacker slides along row 3 to (3,7).
    const t = pos(9, [[1, 7], [3, 2]], [[2, 7]], [7, 1], ATTACKERS);
    expect(capturesOf(t, { from: at(9, 3, 2), to: at(9, 3, 7) })).toEqual([at(9, 2, 7)]);
    // Landing next to a defender with no attacker behind it takes nothing.
    const u = pos(9, [[3, 2]], [[2, 7]], [7, 1], ATTACKERS);
    expect(capturesOf(u, { from: at(9, 3, 2), to: at(9, 3, 7) })).toEqual([]);
  });
  it('a plain sandwich closes from either end', () => {
    const s = pos(9, [[3, 1], [6, 3]], [[3, 2]], [7, 7], ATTACKERS);
    expect(capturesOf(s, { from: at(9, 6, 3), to: at(9, 3, 3) })).toEqual([at(9, 3, 2)]);
    const t = pos(9, [[3, 3], [6, 1]], [[3, 2]], [7, 7], ATTACKERS);
    expect(capturesOf(t, { from: at(9, 6, 1), to: at(9, 3, 1) })).toEqual([at(9, 3, 2)]);
  });
  it('moving between two enemy pieces is safe: only the side that moves captures', () => {
    const s = pos(9, [[3, 1], [3, 3]], [[5, 2]], [7, 7], DEFENDERS);
    const after = applyMove(s, { from: at(9, 5, 2), to: at(9, 3, 2) })!;
    expect(after.b[at(9, 3, 2)]).toBe(DEFENDERS);
    expect(countPieces(after)).toEqual({ attackers: 2, defenders: 1, king: true });
  });
  it('a piece next to a corner is captured by one enemy on the other side; the corner takes the place of the second', () => {
    const s = pos(9, [[5, 2]], [[0, 1]], [7, 7], ATTACKERS);
    expect(capturesOf(s, { from: at(9, 5, 2), to: at(9, 0, 2) })).toEqual([at(9, 0, 1)]);
    const t = pos(9, [[0, 1]], [[5, 2]], [7, 7], DEFENDERS);
    expect(capturesOf(t, { from: at(9, 5, 2), to: at(9, 0, 2) })).toEqual([at(9, 0, 1)]);
  });
  it('the throne: hostile to attackers always, to defenders only when empty', () => {
    // An attacker at (4,3) beside the empty throne; a defender lands on (4,2): captured against the throne.
    const a = pos(9, [[4, 3]], [[7, 2]], [0, 4], DEFENDERS);
    expect(capturesOf(a, { from: at(9, 7, 2), to: at(9, 4, 2) })).toEqual([at(9, 4, 3)]);
    // With the king standing on the throne the capture still happens (the king is a friend).
    const b2 = pos(9, [[4, 3]], [[7, 2]], [4, 4], DEFENDERS);
    expect(capturesOf(b2, { from: at(9, 7, 2), to: at(9, 4, 2) })).toEqual([at(9, 4, 3)]);
    // A defender at (4,3) beside the EMPTY throne is captured by one attacker on (4,2).
    const c = pos(9, [[7, 2]], [[4, 3]], [0, 4], ATTACKERS);
    expect(capturesOf(c, { from: at(9, 7, 2), to: at(9, 4, 2) })).toEqual([at(9, 4, 3)]);
    // With the king on the throne it is not hostile to defenders: nothing is taken.
    const d = pos(9, [[7, 2]], [[4, 3]], [4, 4], ATTACKERS);
    expect(capturesOf(d, { from: at(9, 7, 2), to: at(9, 4, 2) })).toEqual([]);
  });
  it('the king helps capture (armed), and one move can capture several pieces at once', () => {
    // King at (2,2) and a defender sliding over the empty throne to (2,4) sandwich the attacker on (2,3).
    const s = pos(9, [[2, 3]], [[6, 4]], [2, 2], DEFENDERS);
    expect(capturesOf(s, { from: at(9, 6, 4), to: at(9, 2, 4) })).toEqual([at(9, 2, 3)]);
    // A defender landing on (2,4) takes three attackers at once: (2,3) with (2,2), (2,5) with (2,6), (1,4) with (0,4).
    const w = pos(9, [[1, 4], [2, 3], [2, 5]], [[0, 4], [2, 2], [2, 6], [6, 4]], [7, 7], DEFENDERS);
    const mv = { from: at(9, 6, 4), to: at(9, 2, 4) };
    expect(capturesOf(w, mv).sort((x, y) => x - y)).toEqual([at(9, 1, 4), at(9, 2, 3), at(9, 2, 5)].sort((x, y) => x - y));
    const after = applyMove(w, mv)!;
    expect(countPieces(after).attackers).toBe(0);
    expect(after.quiet).toBe(0);
  });
});

describe('capturing the king', () => {
  it('9 by 9: needs attackers on all four sides; three, or a defender in the way, are not enough', () => {
    const n = 9;
    const ring = pos(n, [[2, 5], [3, 4], [3, 6], [6, 5]], [], [3, 5], ATTACKERS);
    expect(capturesOf(ring, { from: at(n, 6, 5), to: at(n, 4, 5) })).toEqual([at(n, 3, 5)]);
    const after = applyMove(ring, { from: at(n, 6, 5), to: at(n, 4, 5) })!;
    expect(after.king).toBe(-1);
    expect(outcome(after)).toEqual({ over: true, winner: ATTACKERS, reason: 'captured' });
    const two = pos(n, [[2, 5], [6, 5]], [], [3, 5], ATTACKERS);
    expect(capturesOf(two, { from: at(n, 6, 5), to: at(n, 4, 5) })).toEqual([]);
    const withDef = pos(n, [[2, 5], [3, 6], [6, 5]], [[3, 4]], [3, 5], ATTACKERS);
    expect(capturesOf(withDef, { from: at(n, 6, 5), to: at(n, 4, 5) })).toEqual([]);
    // Two attackers on opposite sides are not enough away from the throne.
    const s2 = pos(n, [[2, 3], [7, 5]], [], [2, 4], ATTACKERS);
    expect(capturesOf(s2, { from: at(n, 7, 5), to: at(n, 2, 5) })).toEqual([]);
  });
  it('9 by 9: beside the throne three attackers and the throne are enough; on the throne it takes four', () => {
    const n = 9;
    const s = pos(n, [[3, 3], [5, 3], [8, 2]], [], [4, 3], ATTACKERS);
    expect(capturesOf(s, { from: at(n, 8, 2), to: at(n, 4, 2) })).toEqual([at(n, 4, 3)]);
    const t = pos(n, [[3, 4], [5, 4], [4, 3], [8, 5]], [], [4, 4], ATTACKERS);
    expect(capturesOf(t, { from: at(n, 8, 5), to: at(n, 4, 5) })).toEqual([at(n, 4, 4)]);
    const t3 = pos(n, [[3, 4], [5, 4], [8, 5]], [], [4, 4], ATTACKERS);
    expect(capturesOf(t3, { from: at(n, 8, 5), to: at(n, 4, 5) })).toEqual([]);
  });
  it('9 by 9: a king on the edge cannot be captured', () => {
    const n = 9;
    const edge = pos(n, [[0, 3], [0, 5], [2, 4]], [], [0, 4], ATTACKERS);
    expect(capturesOf(edge, { from: at(n, 2, 4), to: at(n, 1, 4) })).toEqual([]);
  });
  it('7 by 7: away from the throne the king is captured by two attackers on opposite sides; beside or on the throne it needs more', () => {
    const n = 7;
    const s = pos(n, [[1, 2], [5, 4]], [], [1, 3], ATTACKERS);
    expect(capturesOf(s, { from: at(n, 5, 4), to: at(n, 1, 4) })).toEqual([at(n, 1, 3)]);
    // On the edge too, and sliding over the empty throne on the way.
    const t = pos(n, [[0, 1], [6, 3]], [], [0, 2], ATTACKERS);
    expect(capturesOf(t, { from: at(n, 6, 3), to: at(n, 0, 3) })).toEqual([at(n, 0, 2)]);
    // A corner on the far side is not an attacker.
    const corner = pos(n, [[6, 2]], [], [0, 1], ATTACKERS);
    expect(capturesOf(corner, { from: at(n, 6, 2), to: at(n, 0, 2) })).toEqual([]);
    // Beside the throne: three attackers and the throne.
    const near = pos(n, [[2, 2], [4, 2], [6, 1]], [], [3, 2], ATTACKERS);
    expect(capturesOf(near, { from: at(n, 6, 1), to: at(n, 3, 1) })).toEqual([at(n, 3, 2)]);
    const nearTwo = pos(n, [[2, 2], [6, 1]], [], [3, 2], ATTACKERS);
    expect(capturesOf(nearTwo, { from: at(n, 6, 1), to: at(n, 3, 1) })).toEqual([]);
    // On the throne it needs four.
    const on = pos(n, [[2, 3], [4, 3], [3, 2], [6, 4]], [], [3, 3], ATTACKERS);
    expect(capturesOf(on, { from: at(n, 6, 4), to: at(n, 3, 4) })).toEqual([at(n, 3, 3)]);
    const onTwo = pos(n, [[2, 3], [4, 3], [6, 4]], [], [3, 3], ATTACKERS);
    expect(capturesOf(onTwo, { from: at(n, 6, 4), to: at(n, 3, 4) })).toEqual([]);
  });
  it('only the side that moves captures the king: a king that steps in beside three attackers is safe until a fourth arrives', () => {
    const n = 9;
    const s = pos(n, [[2, 5], [3, 4], [3, 6], [8, 0]], [], [7, 5], DEFENDERS);
    const entered = applyMove(s, { from: at(n, 7, 5), to: at(n, 3, 5) })!;
    expect(entered.king).toBe(at(n, 3, 5));
    // An attacker move that is not next to the king takes nothing.
    expect(capturesOf(entered, { from: at(n, 8, 0), to: at(n, 8, 1) })).toEqual([]);
    expect(outcome(entered).over).toBe(false);
    // Closing the fourth side does.
    const closed = pos(n, [[2, 5], [3, 4], [3, 6], [8, 5]], [], [3, 5], ATTACKERS);
    expect(applyMove(closed, { from: at(n, 8, 5), to: at(n, 4, 5) })!.king).toBe(-1);
  });
});

describe('the end of the game', () => {
  it('the king on a corner is a win for the defenders, and kingExits sees a clear line', () => {
    const n = 9;
    const s = pos(n, [[5, 5]], [], [0, 4], DEFENDERS);
    expect(kingExits(s).sort((a, b) => a - b)).toEqual([0, 8]);
    const win = applyMove(s, { from: at(n, 0, 4), to: 0 })!;
    expect(outcome(win)).toEqual({ over: true, winner: DEFENDERS, reason: 'escaped' });
    const blocked = pos(n, [[0, 2], [0, 6]], [], [0, 4], DEFENDERS);
    expect(kingExits(blocked)).toEqual([]);
    expect(kingExits(pos(n, [], [], null))).toEqual([]);
    expect(kingExits(pos(n, [], [], [4, 4]))).toEqual([]);
    expect(kingExits(pos(n, [], [], [8, 3], DEFENDERS)).sort((a, b) => a - b)).toEqual([72, 80]);
  });
  it('a side with no move loses', () => {
    const n = 7;
    // The defenders cannot move: the king is boxed in by four attackers and has no defender with it.
    const s = pos(n, [[0, 1], [1, 0], [1, 2], [2, 1]], [], [1, 1], DEFENDERS);
    expect(legalMoves(s)).toHaveLength(0);
    expect(outcome(s)).toEqual({ over: true, winner: ATTACKERS, reason: 'blocked' });
    // The attackers cannot move: one attacker boxed in by a corner and two defenders.
    const t = pos(n, [[0, 1]], [[0, 2], [1, 1]], [6, 3], ATTACKERS);
    expect(destinationsFrom(t, at(n, 0, 1))).toEqual([]);
    expect(outcome(t)).toEqual({ over: true, winner: DEFENDERS, reason: 'blocked' });
    expect(applyMove(t, { from: at(n, 0, 1), to: at(n, 0, 0) })).toBeNull();
  });
  it(`is drawn after ${QUIET_LIMIT} plies with no capture, not before; a capture resets the count`, () => {
    expect(QUIET_LIMIT).toBe(80);
    const base = (q: number) => pos(9, [[0, 3]], [[8, 3]], [4, 4], ATTACKERS, q);
    expect(outcome(base(79)).over).toBe(false);
    expect(outcome(base(80))).toEqual({ over: true, winner: null, reason: 'quiet' });
    expect(outcome(applyMove(base(79), { from: at(9, 0, 3), to: at(9, 0, 2) })!).reason).toBe('quiet');
    const cap = pos(9, [[2, 2], [5, 4]], [[2, 3]], [7, 7], ATTACKERS, 77);
    expect(applyMove(cap, { from: at(9, 5, 4), to: at(9, 2, 4) })!.quiet).toBe(0);
    expect(outcome(pos(9, [[5, 5]], [], [0, 0], DEFENDERS, 500)).reason).toBe('escaped'); // a win outranks the draw
  });
  it('describes every ending and every move', () => {
    expect(describeOutcome({ over: false, winner: null, reason: 'none' }, null)).toBe('The game is not finished.');
    expect(describeOutcome({ over: true, winner: null, reason: 'quiet' }, ATTACKERS)).toBe('Draw: 80 moves in a row with no capture.');
    expect(describeOutcome({ over: true, winner: DEFENDERS, reason: 'escaped' }, DEFENDERS)).toBe('You win: the king reached a corner.');
    expect(describeOutcome({ over: true, winner: DEFENDERS, reason: 'escaped' }, ATTACKERS)).toBe('The computer wins: the king reached a corner.');
    expect(describeOutcome({ over: true, winner: ATTACKERS, reason: 'captured' }, null)).toBe('Attackers win: the king was captured.');
    expect(describeOutcome({ over: true, winner: ATTACKERS, reason: 'blocked' }, null)).toBe('Attackers win: the defenders cannot move.');
    expect(describeOutcome({ over: true, winner: DEFENDERS, reason: 'blocked' }, null)).toBe('Defenders win: the attackers cannot move.');
    expect(describeMove(9, { from: 3, to: 12 }, ATTACKERS, 'You', ATTACKERS, 0, false)).toBe('You moved an attacker from row 1, column 4 to row 2, column 4.');
    expect(describeMove(9, { from: 3, to: 12 }, DEFENDERS, 'Computer', DEFENDERS, 2, false)).toBe('Computer moved a defender from row 1, column 4 to row 2, column 4 and captured 2 pieces.');
    expect(describeMove(9, { from: 3, to: 12 }, ATTACKERS, 'You', ATTACKERS, 1, true)).toBe('You moved an attacker from row 1, column 4 to row 2, column 4 and captured the king.');
    expect(describeMove(9, { from: 4, to: 0 }, DEFENDERS, 'You', KING, 0, false)).toBe('You moved the king from row 1, column 5 to row 1, column 1 and escaped.');
    expect(piecesText(1)).toBe('1 piece');
    expect(piecesText(3)).toBe('3 pieces');
  });
});

describe('illegal input', () => {
  const s = newGame(9);
  it('rejects anything that is not a legal move, and never mutates', () => {
    const copy = Array.from(s.b);
    const bad: unknown[] = [
      { from: at(9, 0, 3), to: at(9, 0, 4) }, // onto a piece
      { from: at(9, 0, 3), to: at(9, 1, 4) }, // diagonal
      { from: at(9, 0, 3), to: at(9, 0, 3) }, // nowhere
      { from: at(9, 0, 4), to: at(9, 3, 4) }, // through the piece at (1,4)
      { from: 40, to: at(9, 3, 4) }, // the king on the attackers' turn
      { from: at(9, 2, 4), to: at(9, 2, 5) }, // a defender on the attackers' turn
      { from: at(9, 4, 0), to: 0 }, // onto a corner
      { from: 99, to: 3 },
      { from: NaN, to: 3 },
      { from: 3, to: '4' },
      { from: [3], to: 4 },
      null,
      undefined,
      'x',
      {},
    ];
    for (const m of bad) expect(applyMove(s, m as Move), JSON.stringify(m)).toBeNull();
    expect(applyMove(s, { from: at(9, 0, 3), to: at(9, 2, 3) })).not.toBeNull(); // a legal slide
    expect(Array.from(s.b)).toEqual(copy);
  });
  it('a throne move by a non-king is refused, a king move onto it is fine', () => {
    const t = pos(9, [[4, 1]], [], [0, 5], ATTACKERS);
    expect(applyMove(t, { from: at(9, 4, 1), to: at(9, 4, 4) })).toBeNull();
    const k = pos(9, [], [], [4, 1], DEFENDERS);
    expect(applyMove(k, { from: at(9, 4, 1), to: at(9, 4, 4) })).not.toBeNull();
  });
  it('a finished game accepts no more moves', () => {
    const done = pos(9, [[5, 5]], [], [0, 0], ATTACKERS);
    expect(outcome(done).over).toBe(true);
    for (const m of legalMoves(done)) expect(applyMove(done, m)).toBeNull();
  });
});

describe('a separately written model agrees with the engine', () => {
  const randomPosition = (n: number, rng: () => number): State => {
    const cells = shuffled(Array.from({ length: n * n }, (_, i) => i), rng);
    const b = new Int8Array(n * n);
    let k = -1;
    let i = 0;
    if (rng() < 0.97) { k = cells[i++]; b[k] = KING; }
    const na = Math.floor(rng() * (n === 9 ? 18 : 10));
    const nd = Math.floor(rng() * (n === 9 ? 10 : 6));
    for (let x = 0; x < na; x++) b[cells[i++]] = ATTACKERS;
    for (let x = 0; x < nd; x++) b[cells[i++]] = DEFENDERS;
    return { n, b, king: k, toMove: rng() < 0.5 ? ATTACKERS : DEFENDERS, quiet: Math.floor(rng() * 90), plies: 0 };
  };

  it('lists the same legal moves, the same captures for each move, and the same outcomes in 1600 random positions on both sizes', () => {
    const rng = mulberry32(2026);
    let capturing = 0;
    let kingCaps = 0;
    let blocked = 0;
    let escaped = 0;
    for (let g = 0; g < 1600; g++) {
      const n = g % 2 === 0 ? 9 : 7;
      const s = randomPosition(n, rng);
      // Positions with a king standing on a corner are legal (the game is over); keep them to test the outcome.
      const ref = toRef(s);
      const mine = legalMoves(s).map(sig).sort();
      expect(mine).toEqual(refMovesFor(ref.board, s.toMove));
      const eo = outcome(s);
      const ro = refOutcome(ref);
      expect(eo.over).toBe(ro.over);
      expect(eo.winner).toBe(ro.winner);
      expect(eo.reason).toBe(ro.reason);
      if (eo.reason === 'blocked') blocked++;
      if (eo.reason === 'escaped') escaped++;
      if (eo.over) continue;
      for (const m of legalMoves(s)) {
        const caps = engineCapsText(s, m);
        const after = refApply(ref, sig(m));
        // Ask the model the same question on a plain board where the move has been made and nothing removed.
        const plain = ref.board.map((row) => row.slice());
        plain[Math.floor(m.to / n)][m.to % n] = plain[Math.floor(m.from / n)][m.from % n];
        plain[Math.floor(m.from / n)][m.from % n] = 0;
        expect(caps, `${n} ${sig(m)}`).toEqual(refCaptured(plain, Math.floor(m.to / n), m.to % n, s.toMove).sort());
        if (caps.length) capturing++;
        const next = stepState(s, m);
        expect(toBoard(next)).toEqual(after.board);
        expect(next.quiet).toBe(after.quiet);
        expect(next.toMove).toBe(after.toMove);
        if (caps.some((c) => c === `${rowOf(n, s.king)},${colOf(n, s.king)}`)) { kingCaps++; expect(next.king).toBe(-1); } else if (s.b[m.from] === KING) expect(next.king).toBe(m.to);
      }
    }
    expect(capturing).toBeGreaterThan(800);
    expect(kingCaps).toBeGreaterThan(2);
    expect(blocked).toBeGreaterThan(5);
    expect(escaped).toBeGreaterThan(5);
  }, 240_000);

  it('plays 100 random games on each size in step with the model, with the king, corners and throne rules holding all along', () => {
    const rng = mulberry32(77);
    const reasons: Record<string, number> = { escaped: 0, captured: 0, blocked: 0, quiet: 0 };
    let captures = 0;
    for (let g = 0; g < 200; g++) {
      const n = g % 2 === 0 ? 9 : 7;
      let s = newGame(n);
      let r = toRef(s);
      let prevCount = countPieces(s);
      for (let ply = 0; ply < 4000; ply++) {
        const ro = refOutcome(r);
        const eo = outcome(s);
        expect(eo.over).toBe(ro.over);
        expect(eo.winner).toBe(ro.winner);
        expect(eo.reason).toBe(ro.reason);
        if (eo.over) { reasons[eo.reason]++; break; }
        const list = refMovesFor(r.board, r.toMove);
        expect(legalMoves(s).map(sig).sort()).toEqual(list);
        const text = list[Math.floor(rng() * list.length)];
        const m = legalMoves(s).find((x) => sig(x) === text)!;
        const next = applyMove(s, m)!;
        const nr = refApply(r, text);
        expect(toBoard(next)).toEqual(nr.board);
        expect(next.quiet).toBe(nr.quiet);
        const c = countPieces(next);
        if (c.attackers < prevCount.attackers || c.defenders < prevCount.defenders || (prevCount.king && !c.king)) captures++;
        expect(c.attackers).toBeLessThanOrEqual(prevCount.attackers);
        expect(c.defenders).toBeLessThanOrEqual(prevCount.defenders);
        prevCount = c;
        // Corners and the throne hold only the king; the king index is kept right.
        const g2 = geometry(n);
        for (const corner of g2.corners) expect(next.b[corner] === 0 || next.b[corner] === KING).toBe(true);
        expect(next.b[g2.throne] === 0 || next.b[g2.throne] === KING).toBe(true);
        if (next.king >= 0) expect(next.b[next.king]).toBe(KING);
        else expect(Array.from(next.b).includes(KING)).toBe(false);
        s = next;
        r = nr;
      }
      expect(outcome(s).over).toBe(true);
    }
    expect(captures).toBeGreaterThan(500);
    expect(reasons.escaped + reasons.captured + reasons.blocked + reasons.quiet).toBe(200);
    expect(reasons.escaped).toBeGreaterThan(10);
  }, 240_000);
});

describe('the search', () => {
  /** Plain minimax with no pruning and no move ordering, over the same rules and evaluation. */
  const plain = (s: State, depth: number): number => {
    const g = geometry(s.n);
    if (s.king >= 0 && g.isCorner[s.king] === 1) return s.toMove === DEFENDERS ? WIN_SCORE + depth : -(WIN_SCORE + depth);
    if (s.king < 0) return s.toMove === ATTACKERS ? WIN_SCORE + depth : -(WIN_SCORE + depth);
    const moves = legalMoves(s);
    if (!moves.length) return -(WIN_SCORE + depth);
    if (s.quiet >= QUIET_LIMIT) return 0;
    if (s.toMove === DEFENDERS && kingExits(s).length > 0) return WIN_SCORE - 1000 + depth;
    if (depth <= 0) return evaluate(s);
    let best = -Infinity;
    for (const m of moves) best = Math.max(best, -plain(stepState(s, m), depth - 1));
    return best;
  };
  const midgames = (n: number, count: number, seed: number): State[] => {
    const rng = mulberry32(seed);
    const out: State[] = [];
    for (let g = 0; g < count; g++) {
      let s = newGame(n);
      const stop = 4 + Math.floor(rng() * 40);
      for (let ply = 0; ply < stop && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (!outcome(s).over) out.push(s);
    }
    return out;
  };

  it('gives the same value as a plain minimax at depths 0 to 2 on 9 by 9 and 0 to 3 on 7 by 7, in positions from random games', () => {
    let checked = 0;
    for (const s of midgames(9, 14, 11)) {
      for (let d = 0; d <= 2; d++) expect(searchValue(s, d) + 0, `9x9 d=${d}`).toBe(plain(s, d) + 0);
      checked++;
    }
    for (const s of midgames(7, 14, 12)) {
      for (let d = 0; d <= 3; d++) expect(searchValue(s, d) + 0, `7x7 d=${d}`).toBe(plain(s, d) + 0);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  }, 280_000);
  it('evaluation is zero-sum between the sides, and a position that is won outranks it', () => {
    const s = newGame(9);
    expect(evaluate(s)).toBe(evaluateForAttackers(s));
    expect(evaluate({ ...s, toMove: DEFENDERS })).toBe(-evaluateForAttackers(s));
    expect(Math.abs(evaluate(s))).toBeLessThan(WIN_SCORE / 2);
    const exit = pos(9, [[5, 5]], [], [0, 4], DEFENDERS);
    expect(isDecided(searchValue(exit, 0))).toBe(true);
    expect(searchValue(exit, 0)).toBeGreaterThan(0);
    // More defenders is better for the defenders.
    const few = pos(9, [[1, 1], [7, 7]], [[3, 3]], [4, 4], ATTACKERS);
    const many = pos(9, [[1, 1], [7, 7]], [[3, 3], [5, 5], [6, 6]], [4, 4], ATTACKERS);
    expect(evaluateForAttackers(many)).toBeLessThan(evaluateForAttackers(few));
  });
  it('a search returns a legal move, repeatable for a seed', () => {
    for (const n of [9, 7]) for (const s of midgames(n, 4, 5)) {
      const m = bestMove(s, 2, mulberry32(3))!;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
      expect(sig(bestMove(s, 2, mulberry32(3))!)).toBe(sig(m));
    }
  }, 120_000);
});

describe('computer players', () => {
  it('Easy returns a legal move for either side, repeatable for a seed, and null when there is none', () => {
    for (const side of [ATTACKERS, DEFENDERS]) {
      const s = { ...newGame(9), toMove: side };
      const m = randomMove(s, mulberry32(1))!;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
      expect(sig(randomMove(s, mulberry32(1))!)).toBe(sig(m));
    }
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(sig(randomMove(newGame(9), mulberry32(i))!));
    expect(seen.size).toBeGreaterThan(10);
    const blocked = pos(7, [[0, 1], [1, 0], [1, 2], [2, 1]], [], [1, 1], DEFENDERS);
    expect(randomMove(blocked, mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'hard', mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'medium', mulberry32(1))).toBeNull();
  });
  it('every level plays a legal move for either side on both sizes; Medium and Hard are repeatable with a fixed clock', () => {
    const rng = mulberry32(21);
    const fast = { now: () => 0, maxDepth: 2 };
    for (const n of [9, 7]) {
      for (let g = 0; g < 8; g++) {
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
  it('the defenders run the king to a corner when the line is open, and the attackers capture the king when they can', () => {
    const open = pos(9, [[5, 5], [6, 1]], [[2, 2]], [0, 4], DEFENDERS);
    for (const level of ['medium', 'hard'] as Level[]) {
      const m = chooseMove(open, level, mulberry32(1), { now: () => 0, maxDepth: 2 })!;
      expect(applyMove(open, m)!.king === 0 || applyMove(open, m)!.king === 8).toBe(true);
    }
    const ring = pos(9, [[2, 5], [3, 4], [3, 6], [6, 5]], [[7, 7]], [3, 5], ATTACKERS);
    for (const level of ['medium', 'hard'] as Level[]) {
      const m = chooseMove(ring, level, mulberry32(1), { now: () => 0, maxDepth: 2 })!;
      expect(applyMove(ring, m)!.king).toBe(-1);
    }
  });
  it('the attackers block a king that threatens to reach a corner next move, when one move can do it', () => {
    // The king on (0,4) with the row open to the left corner and a wall on the right: one attacker can close the row.
    const s = pos(9, [[0, 6], [3, 2], [5, 7]], [[7, 7]], [0, 4], ATTACKERS);
    expect(kingExits(s)).toEqual([0]);
    for (const level of ['medium', 'hard'] as Level[]) {
      for (const seed of [1, 2, 3]) {
        const m = chooseMove(s, level, mulberry32(seed), { now: () => 0, maxDepth: 3 })!;
        const after = applyMove(s, m)!;
        expect(kingExits({ ...after }).length, `${level} ${sig(m)}`).toBe(0);
      }
    }
  });
  it('Hard defenders beat Easy attackers, and Medium attackers do not lose to Easy defenders (seeded games)', () => {
    const hardDef = playGames('hard', DEFENDERS, 6, 7, { now: () => 0, maxDepth: 3, budgetMs: 1e9 });
    expect(hardDef.wins).toBeGreaterThanOrEqual(5);
    const medAtt = playGames('medium', ATTACKERS, 6, 7, { now: () => 0 });
    expect(medAtt.losses).toBeLessThanOrEqual(1);
  }, 280_000);
});

/** Games on the n by n board with the strong level on `strongSide` against Easy on the other. */
const playGames = (strong: Level, strongSide: Side, games: number, n: number, opts: { now?: () => number; maxDepth?: number; budgetMs?: number }): { wins: number; draws: number; losses: number } => {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(4000 + g);
    let s = newGame(n);
    let guard = 0;
    while (!outcome(s).over && guard++ < 3000) {
      const level: Level = s.toMove === strongSide ? strong : 'easy';
      s = applyMove(s, chooseMove(s, level, rng, opts)!)!;
    }
    const o = outcome(s);
    if (o.winner === strongSide) wins++;
    else if (o.winner === null) draws++;
    else losses++;
  }
  return { wins, draws, losses };
};

describe('time budget', () => {
  it('states the numbers the page quotes', () => {
    expect(MEDIUM_DEPTH).toBe(3);
    expect(HARD_DEPTH).toBe(5);
    expect(MEDIUM_NODE_CAP).toBe(30000);
    expect(HARD_NODE_CAP).toBe(60000);
    expect(MEDIUM_BUDGET_MS).toBe(900);
    expect(HARD_BUDGET_MS).toBe(450);
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(1000);
  });
  it('Hard answers every position it is asked about, on both sizes and for both sides, within a generous bound with the real settings', () => {
    const rng = mulberry32(8);
    let worst = 0;
    let count = 0;
    for (const n of [9, 7]) {
      for (let g = 0; g < 12; g++) {
        let s = newGame(n);
        for (let ply = 0; ply < g * 3 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
        if (outcome(s).over) continue;
        const t0 = performance.now();
        const m = hardMove(s, rng)!;
        worst = Math.max(worst, performance.now() - t0);
        count++;
        expect(legalMoves(s).map(sig)).toContain(sig(m));
      }
    }
    expect(count).toBeGreaterThan(14);
    expect(worst).toBeLessThan(5000);
  }, 120_000);
  it('Medium (3 plies, 30,000 positions, a 0.9 second brake) answers within a generous bound and never looks at many more positions than its cap', () => {
    const rng = mulberry32(9);
    let worst = 0;
    for (const n of [9, 7]) {
      for (let g = 0; g < 12; g++) {
        let s = newGame(n);
        for (let ply = 0; ply < g * 3 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
        if (outcome(s).over) continue;
        const t0 = performance.now();
        const m = mediumMove(s, rng)!;
        worst = Math.max(worst, performance.now() - t0);
        expect(legalMoves(s).map(sig)).toContain(sig(m));
        expect(lastSearchNodes).toBeLessThanOrEqual(MEDIUM_NODE_CAP + 64);
      }
    }
    expect(worst).toBeLessThan(5000);
  }, 120_000);
  it('the clock and a node cap are live from the first depth: a tiny budget or cap stops the search almost at once and still gives a legal move', () => {
    const s = newGame(9);
    let t = 0;
    const m = hardMove(s, mulberry32(5), { now: () => (t += 10), budgetMs: 5 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(m));
    expect(lastSearchNodes).toBeLessThanOrEqual(64);
    for (const cap of [1, 40, 500, 5000]) {
      const m2 = iterativeMove(s, mulberry32(5), { depth: 5, nodes: 1e9, ms: 1e9 }, { now: () => 0, maxNodes: cap })!;
      expect(legalMoves(s).map(sig)).toContain(sig(m2));
      expect(lastSearchNodes).toBeLessThanOrEqual(cap + 64);
    }
    const z = hardMove(s, mulberry32(3), { budgetMs: 0 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(z));
  });
});

describe('words and bookkeeping', () => {
  it('names the sides, finds the undo target and cleans the level', () => {
    expect(nameOf(ATTACKERS)).toBe('Attackers');
    expect(nameOf(DEFENDERS)).toBe('Defenders');
    expect(otherSide(ATTACKERS)).toBe(DEFENDERS);
    expect(countOf(1, 'attacker', 'attackers')).toBe('1 attacker');
    expect(countOf(0, 'defender', 'defenders')).toBe('0 defenders');
    expect(countOf(16, 'attacker', 'attackers')).toBe('16 attackers');
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Careful.')).toBe('Careful. Computer is thinking...');
    expect(undoIndex([], ATTACKERS)).toBe(-1);
    expect(undoIndex([ATTACKERS, DEFENDERS, ATTACKERS, DEFENDERS], ATTACKERS)).toBe(2);
    expect(undoIndex([ATTACKERS, DEFENDERS, ATTACKERS, DEFENDERS], DEFENDERS)).toBe(3);
    expect(undoIndex([DEFENDERS, DEFENDERS], ATTACKERS)).toBe(-1);
    expect(undoIndex([ATTACKERS, DEFENDERS, ATTACKERS], null)).toBe(2);
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
