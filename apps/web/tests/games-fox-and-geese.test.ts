/**
 * games-fox-and-geese.test.ts - the engine behind `fox-and-geese`.
 *
 * Pinned: the 33-hole cross board, the opening position and its six goose moves, goose
 * steps (forward and sideways, never back, never a jump), fox steps and jumps (a jump that
 * can be carried on must be, loops back to the starting hole, captures optional), trapping,
 * the end of the game and the draw after 30 quiet moves, the claim that fewer than four geese
 * can never trap the fox (every placement checked by brute force), illegal input, a separately
 * written move generator and rules model compared with the engine in thousands of random
 * positions and random games, the alpha-beta search against a plain minimax, the three computer
 * levels for either side (legal, deterministic for a seed, they take or save a goose,
 * Medium and Hard beat Easy), and the time budget.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, legalGooseMoves, legalFoxMoves, applyMove, stepState, findMove, outcome, countGeese, isHole, isCapture, evaluate, evaluateForGeese,
  searchValue, bestMove, deepMove, randomMove, chooseMove, mulberry32, shuffled, describeOutcome, describeMove, geeseText, thinkingMessage, undoIndex, cleanLevel,
  nameOf, otherSide, cellName, rowOf, colOf,
  STEP, JUMP, HOLE_LIST, HOLES, CELLS, SIZE, START_GEESE, MIN_TRAPPERS, QUIET_LIMIT, MEDIUM_DEPTH, HARD_DEPTH, HARD_BUDGET_MS, HARD_NODE_CAP, lastSearchNodes, WIN_SCORE, FOX_START, GEESE, FOX,
  type State, type Side, type Level, type Move,
} from '../src/components/apps-private/fox-and-geese/helpers';

const at = (r: number, c: number): number => r * 7 + c;

/** A position from goose coordinates and a fox coordinate. */
const pos = (geese: [number, number][], fox: [number, number], toMove: Side = GEESE, quiet = 0): State => {
  const b = new Int8Array(CELLS);
  for (const [r, c] of geese) b[at(r, c)] = GEESE;
  b[at(fox[0], fox[1])] = FOX;
  return { b, fox: at(fox[0], fox[1]), toMove, quiet, plies: 0 };
};
const sig = (m: Move): string => `${m.from}>${m.path.join('>')}x${m.captured.slice().sort((a, b) => a - b).join(',')}`;

// ── An independent model: coordinates and sets, no index tables ─────────────

const inCross = (r: number, c: number): boolean => r >= 0 && r <= 6 && c >= 0 && c <= 6 && ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));
const k = (r: number, c: number): string => `${r},${c}`;
const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

interface RefPos { geese: Set<string>; fox: [number, number]; toMove: Side; quiet: number }
const toRef = (s: State): RefPos => {
  const geese = new Set<string>();
  for (let i = 0; i < CELLS; i++) if (s.b[i] === GEESE) geese.add(k(rowOf(i), colOf(i)));
  return { geese, fox: [rowOf(s.fox), colOf(s.fox)], toMove: s.toMove, quiet: s.quiet };
};
/** A move as text: from, then each landing hole, then the captured holes, all as "row,col". */
const refGoose = (p: RefPos): string[] => {
  const out: string[] = [];
  for (const g of p.geese) {
    const [r, c] = g.split(',').map(Number);
    for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (inCross(nr, nc) && !p.geese.has(k(nr, nc)) && !(p.fox[0] === nr && p.fox[1] === nc)) out.push(`${k(r, c)}|${k(nr, nc)}|`);
    }
  }
  return out.sort();
};
const refFox = (p: RefPos): string[] => {
  const out: string[] = [];
  const [fr, fc] = p.fox;
  for (const [dr, dc] of DIRS) {
    const nr = fr + dr;
    const nc = fc + dc;
    if (inCross(nr, nc) && !p.geese.has(k(nr, nc))) out.push(`${k(fr, fc)}|${k(nr, nc)}|`);
  }
  const chains = (geese: Set<string>, r: number, c: number, path: string[], caps: string[]): void => {
    let more = false;
    for (const [dr, dc] of DIRS) {
      const mid = k(r + dr, c + dc);
      const lr = r + 2 * dr;
      const lc = c + 2 * dc;
      if (geese.has(mid) && inCross(lr, lc) && !geese.has(k(lr, lc))) {
        more = true;
        const rest = new Set(geese);
        rest.delete(mid);
        chains(rest, lr, lc, [...path, k(lr, lc)], [...caps, mid]);
      }
    }
    if (!more && path.length) out.push(`${k(fr, fc)}|${path.join('>')}|${caps.slice().sort().join(';')}`);
  };
  chains(p.geese, fr, fc, [], []);
  return out.sort();
};
const refMoves = (p: RefPos): string[] => (p.toMove === GEESE ? refGoose(p) : refFox(p));
const engineText = (m: Move): string => {
  const rc = (i: number): string => k(rowOf(i), colOf(i));
  return `${rc(m.from)}|${m.path.map(rc).join('>')}|${m.captured.map(rc).sort().join(';')}`;
};
const refOutcome = (p: RefPos): { over: boolean; winner: Side | null; reason: string } => {
  if (p.geese.size < 4) return { over: true, winner: FOX, reason: 'captured' };
  if (p.toMove === FOX && refFox(p).length === 0) return { over: true, winner: GEESE, reason: 'trapped' };
  if (p.toMove === GEESE && refGoose(p).length === 0) return { over: true, winner: FOX, reason: 'blocked' };
  if (p.quiet >= 30) return { over: true, winner: null, reason: 'quiet' };
  return { over: false, winner: null, reason: 'none' };
};
const refApply = (p: RefPos, text: string): RefPos => {
  const [from, path, caps] = text.split('|');
  const [fr, fc] = from.split(',').map(Number);
  const steps = path.split('>').map((x) => x.split(',').map(Number));
  const [lr, lc] = steps[steps.length - 1];
  const geese = new Set(p.geese);
  if (p.toMove === GEESE) {
    geese.delete(from);
    geese.add(k(lr, lc));
    return { geese, fox: p.fox, toMove: FOX, quiet: lr < fr ? 0 : p.quiet + 1 };
  }
  const taken = caps ? caps.split(';') : [];
  for (const t of taken) geese.delete(t);
  return { geese, fox: [lr, lc], toMove: GEESE, quiet: taken.length ? 0 : p.quiet + 1 };
};

describe('geometry', () => {
  it('is the 7 x 7 grid with the corner blocks cut away: 33 holes', () => {
    expect(HOLES).toBe(33);
    expect(HOLE_LIST).toHaveLength(33);
    expect(SIZE).toBe(7);
    for (let i = 0; i < CELLS; i++) expect(isHole(i)).toBe(inCross(rowOf(i), colOf(i)));
    expect(isHole(at(0, 0))).toBe(false);
    expect(isHole(at(1, 6))).toBe(false);
    expect(isHole(at(0, 3))).toBe(true);
    expect(isHole(-1)).toBe(false);
    expect(isHole(49)).toBe(false);
    expect(isHole(2.5)).toBe(false);
    expect(isHole(NaN)).toBe(false);
  });
  it('has steps and jump landings only between holes, symmetric, one and two cells away', () => {
    for (const i of HOLE_LIST) {
      for (let d = 0; d < 4; d++) {
        const t = STEP[i][d];
        const l = JUMP[i][d];
        if (t >= 0) { expect(isHole(t)).toBe(true); expect(STEP[t][d ^ 1]).toBe(i); expect(Math.abs(rowOf(t) - rowOf(i)) + Math.abs(colOf(t) - colOf(i))).toBe(1); }
        if (l >= 0) { expect(isHole(l)).toBe(true); expect(JUMP[l][d ^ 1]).toBe(i); expect(Math.abs(rowOf(l) - rowOf(i)) + Math.abs(colOf(l) - colOf(i))).toBe(2); expect(t).toBeGreaterThanOrEqual(0); }
      }
    }
    // Four links is the most any hole has. Rows of 2, 2, 6, 6, 6, 2, 2 links across and the same down: 52 links in all.
    const degrees = HOLE_LIST.map((i) => STEP[i].filter((t) => t >= 0).length);
    expect(Math.max(...degrees)).toBe(4);
    expect(degrees.reduce((a, b) => a + b, 0) / 2).toBe(52);
  });
  it('names a cell with 1-based row and column', () => {
    expect(cellName(0)).toBe('row 1, column 1');
    expect(cellName(48)).toBe('row 7, column 7');
  });
});

describe('the opening', () => {
  const s = newGame();
  it('has 13 geese filling the bottom, the fox in the middle, and the geese to move', () => {
    expect(START_GEESE).toBe(13);
    expect(countGeese(s.b)).toBe(13);
    expect(s.fox).toBe(FOX_START);
    expect(s.b[FOX_START]).toBe(FOX);
    expect(rowOf(FOX_START)).toBe(3);
    expect(colOf(FOX_START)).toBe(3);
    expect(s.toMove).toBe(GEESE);
    for (const i of HOLE_LIST) expect(s.b[i] === GEESE).toBe(rowOf(i) >= 4);
    expect(newGame(FOX).toMove).toBe(FOX);
    expect(outcome(s)).toEqual({ over: false, winner: null, reason: 'none' });
  });
  it('offers the geese exactly six moves (up from the fifth row, except in front of the fox) and the fox three steps', () => {
    const moves = legalMoves(s);
    expect(moves).toHaveLength(6);
    expect(moves.every((m) => m.path.length === 1 && rowOf(m.path[0]) === 3 && rowOf(m.from) === 4)).toBe(true);
    expect(moves.map((m) => colOf(m.from)).sort()).toEqual([0, 1, 2, 4, 5, 6]);
    const foxFirst = legalMoves(newGame(FOX));
    expect(foxFirst.map(sig).sort()).toEqual([`${at(3, 3)}>${at(2, 3)}x`, `${at(3, 3)}>${at(3, 2)}x`, `${at(3, 3)}>${at(3, 4)}x`].sort());
  });
});

describe('goose moves', () => {
  it('geese step forward or sideways onto an empty hole, never backward, never diagonally, never off the board', () => {
    const s = pos([[3, 3]], [6, 3]);
    const to = legalGooseMoves(s).map((m) => m.path[0]).sort((a, b) => a - b);
    expect(to).toEqual([at(2, 3), at(3, 2), at(3, 4)]);
    // A goose on the top row can only go sideways; at the end of an arm it can go one way only.
    const top = legalGooseMoves(pos([[0, 2]], [6, 3])).map((m) => m.path[0]);
    expect(top).toEqual([at(0, 3)]);
    // The goose in a corner of the cross: (2,0) can go up? (1,0) is cut away. Only right.
    const edge = legalGooseMoves(pos([[2, 0]], [6, 3])).map((m) => m.path[0]);
    expect(edge).toEqual([at(2, 1)]);
  });
  it('geese never move onto another goose or the fox, and never jump', () => {
    const s = pos([[3, 3], [2, 3], [3, 2], [3, 4], [4, 4]], [4, 3]);
    const moves = legalGooseMoves(s);
    for (const m of moves) { expect(s.b[m.path[0]]).toBe(0); expect(m.captured).toEqual([]); expect(m.path).toHaveLength(1); }
    expect(moves.map((m) => m.from)).not.toContain(at(4, 3));
  });
  it('a forward step resets the quiet count, a sideways step adds to it', () => {
    const s = pos([[4, 3], [5, 3], [6, 3], [4, 2]], [0, 3], GEESE, 10);
    const fwd = applyMove(s, findMove(s, at(4, 3), [at(3, 3)])!)!;
    expect(fwd.quiet).toBe(0);
    const side = applyMove(s, findMove(s, at(4, 2), [at(4, 1)])!)!;
    expect(side.quiet).toBe(11);
  });
});

describe('fox moves', () => {
  it('steps to an empty hole in four directions', () => {
    const s = pos([[6, 2]], [3, 3], FOX);
    expect(legalFoxMoves(s).map((m) => m.path[0]).sort((a, b) => a - b)).toEqual([at(2, 3), at(3, 2), at(3, 4), at(4, 3)]);
    // On the edge of an arm the off-board directions give no step.
    expect(legalFoxMoves(pos([[6, 2]], [0, 2], FOX)).map((m) => m.path[0]).sort((a, b) => a - b)).toEqual([at(0, 3), at(1, 2)]);
  });
  it('jumps over an adjacent goose into the empty hole beyond, and the goose is captured', () => {
    const s = pos([[3, 4], [6, 2], [6, 3], [6, 4]], [3, 3], FOX);
    const jump = legalFoxMoves(s).find((m) => m.captured.length)!;
    expect(jump).toEqual({ from: at(3, 3), path: [at(3, 5)], captured: [at(3, 4)] });
    const after = applyMove(s, jump)!;
    expect(after.b[at(3, 4)]).toBe(0);
    expect(after.b[at(3, 3)]).toBe(0);
    expect(after.b[at(3, 5)]).toBe(FOX);
    expect(after.fox).toBe(at(3, 5));
    expect(countGeese(after.b)).toBe(3);
    expect(after.quiet).toBe(0);
    expect(after.toMove).toBe(GEESE);
  });
  it('a capture is optional: a plain step is still legal when a jump is on offer', () => {
    const s = pos([[3, 4], [5, 3]], [3, 3], FOX);
    const moves = legalFoxMoves(s);
    expect(moves.some((m) => m.captured.length === 1)).toBe(true);
    expect(moves.some((m) => m.captured.length === 0)).toBe(true);
  });
  it('cannot jump a goose with another goose or the edge behind it, nor two geese in a row', () => {
    expect(legalFoxMoves(pos([[3, 4], [3, 5]], [3, 3], FOX)).some((m) => m.captured.length)).toBe(false);
    expect(legalFoxMoves(pos([[3, 6], [6, 3]], [3, 5], FOX)).some((m) => m.captured.length)).toBe(false); // beyond (3,6) is off the board
    expect(legalFoxMoves(pos([[1, 3], [6, 3]], [2, 3], FOX)).some((m) => m.captured.length)).toBe(true); // control: (0,3) is empty
    expect(legalFoxMoves(pos([[1, 3], [0, 3]], [2, 3], FOX)).some((m) => m.captured.length)).toBe(false);
    expect(legalFoxMoves(pos([[2, 1], [6, 3]], [2, 2], FOX)).some((m) => m.captured.length)).toBe(true); // lands on (2,0)
    expect(legalFoxMoves(pos([[1, 2], [6, 3]], [2, 2], FOX)).some((m) => m.captured.length)).toBe(true); // lands on (0,2)
    // A landing in a cut-away corner does not exist: from (1,3) over (1,2) would land on (1,1).
    expect(legalFoxMoves(pos([[1, 2], [6, 3]], [1, 3], FOX)).some((m) => m.captured.length)).toBe(false);
    expect(legalFoxMoves(pos([[2, 5], [6, 3]], [3, 5], FOX)).some((m) => m.captured.length)).toBe(false); // would land on (1,5)
  });
  it('a jump that can be carried on must be: only the whole chain is offered', () => {
    // Fox at (3,1) jumps (3,2) to (3,3), then (2,3) to (1,3): two geese; the one-jump stop is not a legal move.
    const s = pos([[3, 2], [2, 3], [6, 3], [6, 2]], [3, 1], FOX);
    const jumps = legalFoxMoves(s).filter((m) => m.captured.length);
    expect(jumps).toHaveLength(1);
    expect(jumps[0]).toEqual({ from: at(3, 1), path: [at(3, 3), at(1, 3)], captured: [at(3, 2), at(2, 3)] });
    const after = applyMove(s, jumps[0])!;
    expect(countGeese(after.b)).toBe(2);
    expect(after.fox).toBe(at(1, 3));
    // The half-way stop is refused.
    expect(applyMove(s, { from: at(3, 1), path: [at(3, 3)], captured: [at(3, 2)] })).toBeNull();
  });
  it('a chain with two ways to go on offers both', () => {
    // Fox at (3,1) jumps (3,2) to (3,3); from there it can go up over (2,3) to (1,3) or down over (4,3) to (5,3).
    const s = pos([[3, 2], [2, 3], [4, 3], [6, 3]], [3, 1], FOX);
    const chains = legalFoxMoves(s).filter(isCapture);
    expect(chains.map((m) => m.path.join('>')).sort()).toEqual([[at(3, 3), at(1, 3)].join('>'), [at(3, 3), at(5, 3)].join('>')].sort());
    expect(chains.every((m) => m.captured.length === 2)).toBe(true);
  });
  it('a loop of four jumps can end on the hole it started from', () => {
    // Fox at (2,2); geese at (2,3), (3,4), (4,3), (3,2); empty landings (2,4), (4,4), (4,2) and the start.
    const s = pos([[2, 3], [3, 4], [4, 3], [3, 2], [6, 3]], [2, 2], FOX);
    const loop = legalFoxMoves(s).filter((m) => m.captured.length === 4);
    expect(loop.length).toBeGreaterThan(0);
    expect(loop.some((m) => m.path[m.path.length - 1] === at(2, 2))).toBe(true);
    for (const m of loop) expect(new Set(m.captured).size).toBe(4);
  });
  it('a plain step adds to the quiet count and a capture resets it', () => {
    const s = pos([[3, 4], [5, 3], [6, 2], [6, 4]], [3, 3], FOX, 7);
    const step = applyMove(s, findMove(s, at(3, 3), [at(2, 3)])!)!;
    expect(step.quiet).toBe(8);
    const cap = applyMove(s, findMove(s, at(3, 3), [at(3, 5)])!)!;
    expect(cap.quiet).toBe(0);
  });
});

describe('the end of the game', () => {
  it('the fox wins when fewer than four geese are left', () => {
    expect(MIN_TRAPPERS).toBe(4);
    const s = pos([[3, 4], [5, 3], [6, 3], [6, 2]], [3, 3], FOX);
    const after = applyMove(s, findMove(s, at(3, 3), [at(3, 5)])!)!;
    expect(countGeese(after.b)).toBe(3);
    expect(outcome(after)).toEqual({ over: true, winner: FOX, reason: 'captured' });
  });
  it('the geese win when the fox has no step and no jump', () => {
    // Fox at the tip (0,3): geese on both sides and below, with the hole behind the lower goose filled.
    const s = pos([[0, 2], [0, 4], [1, 3], [2, 3]], [0, 3], FOX);
    expect(legalFoxMoves(s)).toHaveLength(0);
    expect(outcome(s)).toEqual({ over: true, winner: GEESE, reason: 'trapped' });
    // Take the backing goose away and the fox can jump out, so it is not trapped.
    const open = pos([[0, 2], [0, 4], [1, 3], [5, 3]], [0, 3], FOX);
    expect(legalFoxMoves(open).length).toBeGreaterThan(0);
    expect(outcome(open).over).toBe(false);
    expect(applyMove(s, { from: at(0, 3), path: [at(0, 4)], captured: [] })).toBeNull(); // finished: no more moves
  });
  it('the fox wins when the geese cannot move', () => {
    const s = pos([[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4]], [3, 3], GEESE);
    expect(legalGooseMoves(s)).toHaveLength(0);
    expect(outcome(s)).toEqual({ over: true, winner: FOX, reason: 'blocked' });
  });
  it(`is drawn after ${QUIET_LIMIT} plies with no capture and no goose stepping forward, not before`, () => {
    expect(QUIET_LIMIT).toBe(30);
    const base = (q: number) => pos([[0, 2], [0, 4], [1, 2], [1, 4], [3, 0]], [3, 3], GEESE, q);
    expect(outcome(base(29)).over).toBe(false);
    expect(outcome(base(30))).toEqual({ over: true, winner: null, reason: 'quiet' });
    const s = applyMove(base(29), findMove(base(29), at(3, 0), [at(3, 1)])!)!; // a sideways step makes the 30th
    expect(outcome(s).reason).toBe('quiet');
    // A forward step resets it.
    const t = applyMove(base(29), findMove(base(29), at(3, 0), [at(2, 0)])!)!;
    expect(t.quiet).toBe(0);
  });
  it('a loss outranks the draw', () => {
    expect(outcome(pos([[0, 2], [0, 4], [1, 3], [2, 3]], [0, 3], FOX, 50)).reason).toBe('trapped');
    expect(outcome(pos([[3, 4]], [3, 3], GEESE, 50)).reason).toBe('captured');
  });
  it('describes every ending', () => {
    expect(describeOutcome({ over: false, winner: null, reason: 'none' }, null)).toBe('The game is not finished.');
    expect(describeOutcome({ over: true, winner: null, reason: 'quiet' }, GEESE)).toBe('Draw: 30 moves in a row with no capture and no goose stepping forward.');
    expect(describeOutcome({ over: true, winner: GEESE, reason: 'trapped' }, GEESE)).toBe('You win: the fox is trapped.');
    expect(describeOutcome({ over: true, winner: GEESE, reason: 'trapped' }, FOX)).toBe('The computer wins: the fox is trapped.');
    expect(describeOutcome({ over: true, winner: FOX, reason: 'captured' }, FOX)).toBe('You win: fewer than 4 geese are left to trap it.');
    expect(describeOutcome({ over: true, winner: FOX, reason: 'blocked' }, null)).toBe('Fox wins: the geese cannot move.');
    expect(describeOutcome({ over: true, winner: GEESE, reason: 'trapped' }, null)).toBe('Geese win: the fox is trapped.');
  });
});

describe('fewer than four geese can never trap the fox (brute force)', () => {
  it('no placement of 0 to 3 geese leaves the fox with no move, wherever it stands', () => {
    let checked = 0;
    for (const f of HOLE_LIST) {
      const others = HOLE_LIST.filter((i) => i !== f);
      const trapped = (set: number[]): boolean => {
        const b = new Int8Array(CELLS);
        for (const g of set) b[g] = GEESE;
        b[f] = FOX;
        return legalFoxMoves({ b, fox: f, toMove: FOX, quiet: 0, plies: 0 }).length === 0;
      };
      expect(trapped([])).toBe(false);
      for (let a = 0; a < others.length; a++) {
        expect(trapped([others[a]])).toBe(false);
        for (let b2 = a + 1; b2 < others.length; b2++) {
          expect(trapped([others[a], others[b2]])).toBe(false);
          for (let c = b2 + 1; c < others.length; c++) { expect(trapped([others[a], others[b2], others[c]])).toBe(false); checked++; }
        }
      }
    }
    expect(checked).toBe(33 * 4960);
  }, 120_000);
  it('four geese are enough to trap a fox on an arm tip or at the edge of the middle band', () => {
    const tryFox = (f: number): number[] | null => {
      const others = HOLE_LIST.filter((i) => i !== f);
      for (let a = 0; a < others.length; a++) for (let b2 = a + 1; b2 < others.length; b2++) for (let c = b2 + 1; c < others.length; c++) for (let d = c + 1; d < others.length; d++) {
        const b = new Int8Array(CELLS);
        for (const g of [others[a], others[b2], others[c], others[d]]) b[g] = GEESE;
        b[f] = FOX;
        if (legalFoxMoves({ b, fox: f, toMove: FOX, quiet: 0, plies: 0 }).length === 0) return [others[a], others[b2], others[c], others[d]];
      }
      return null;
    };
    for (const f of [at(0, 3), at(3, 0), at(0, 2), at(2, 0)]) {
      const found = tryFox(f);
      expect(found, `fox at ${f}`).not.toBeNull();
      expect(found).toHaveLength(4);
    }
  }, 120_000);
});

describe('illegal input', () => {
  const s = newGame();
  it('rejects anything that is not a legal move, and never mutates', () => {
    const copy = Array.from(s.b);
    const bad: unknown[] = [
      { from: at(4, 3), path: [at(3, 3)], captured: [] }, // onto the fox
      { from: at(4, 0), path: [at(5, 0)], captured: [] }, // not a hole, and backward
      { from: at(4, 0), path: [at(3, 1)], captured: [] }, // diagonal
      { from: at(4, 0), path: [at(2, 0)], captured: [] }, // two steps
      { from: at(3, 3), path: [at(2, 3)], captured: [] }, // the fox's move on the geese's turn
      { from: at(5, 2), path: [at(4, 2)], captured: [] }, // occupied
      { from: at(4, 0), path: [], captured: [] },
      { from: 99, path: [at(3, 0)], captured: [] },
      { from: NaN, path: [at(3, 0)], captured: [] },
      { from: at(4, 0), path: [NaN], captured: [] },
      { from: at(4, 0), path: 'x' },
      null,
      undefined,
      {},
    ];
    for (const m of bad) expect(applyMove(s, m as Move), JSON.stringify(m)).toBeNull();
    expect(Array.from(s.b)).toEqual(copy);
    expect(findMove(s, at(4, 0), [at(3, 0)])).not.toBeNull();
  });
  it('uses the generator\'s own list of captured geese, not the caller\'s', () => {
    const t = pos([[3, 4], [6, 3], [6, 2], [6, 4]], [3, 3], FOX);
    const forged = applyMove(t, { from: at(3, 3), path: [at(3, 5)], captured: [at(6, 3)] })!;
    expect(forged.b[at(6, 3)]).toBe(GEESE);
    expect(forged.b[at(3, 4)]).toBe(0);
  });
});

describe('a separately written model agrees with the engine', () => {
  it('lists the same legal moves and outcomes in 5000 random positions (any number of geese, either side to move)', () => {
    const rng = mulberry32(2026);
    let withJump = 0;
    let longChain = 0;
    let trapped = 0;
    for (let g = 0; g < 5000; g++) {
      const holes = shuffled(HOLE_LIST, rng);
      const count = Math.floor(rng() * 15);
      const b = new Int8Array(CELLS);
      const f = holes[0];
      b[f] = FOX;
      for (let i = 0; i < count; i++) b[holes[1 + i]] = GEESE;
      const s: State = { b, fox: f, toMove: rng() < 0.5 ? GEESE : FOX, quiet: Math.floor(rng() * 40), plies: 0 };
      const ref = toRef(s);
      expect(legalMoves(s).map(engineText).sort()).toEqual(refMoves(ref));
      const eo = outcome(s);
      const ro = refOutcome(ref);
      expect(eo.over).toBe(ro.over);
      expect(eo.winner).toBe(ro.winner);
      expect(eo.reason).toBe(ro.reason);
      if (s.toMove === FOX) {
        const jumps = legalMoves(s).filter(isCapture);
        if (jumps.length) withJump++;
        if (jumps.some((m) => m.captured.length >= 2)) longChain++;
      }
      if (eo.reason === 'trapped') trapped++;
    }
    expect(withJump).toBeGreaterThan(300);
    expect(longChain).toBeGreaterThan(30);
    expect(trapped).toBeGreaterThan(5);
  });

  it('plays 600 random games in step with the model: same moves, same boards, same quiet count, same result', () => {
    const rng = mulberry32(77);
    let maxPlies = 0;
    const reasons: Record<string, number> = { captured: 0, trapped: 0, blocked: 0, quiet: 0 };
    let captures = 0;
    for (let g = 0; g < 600; g++) {
      let s = newGame(g % 2 === 0 ? GEESE : FOX);
      let r = toRef(s);
      for (let ply = 0; ply < 2000; ply++) {
        const ro = refOutcome(r);
        const eo = outcome(s);
        expect(eo.over).toBe(ro.over);
        expect(eo.winner).toBe(ro.winner);
        expect(eo.reason).toBe(ro.reason);
        if (eo.over) { reasons[eo.reason]++; break; }
        const list = refMoves(r);
        expect(legalMoves(s).map(engineText).sort()).toEqual(list);
        const text = list[Math.floor(rng() * list.length)];
        const m = legalMoves(s).find((x) => engineText(x) === text)!;
        if (m.captured.length) captures++;
        const next = applyMove(s, m)!;
        r = refApply(r, text);
        s = next;
        const rr = toRef(s);
        expect([...rr.geese].sort()).toEqual([...r.geese].sort());
        expect(rr.fox).toEqual(r.fox);
        expect(s.toMove).toBe(r.toMove);
        expect(s.quiet).toBe(r.quiet);
        expect(s.b[s.fox]).toBe(FOX);
        expect(countGeese(s.b)).toBe(r.geese.size);
        maxPlies = Math.max(maxPlies, ply + 1);
      }
      expect(outcome(s).over).toBe(true);
    }
    expect(captures).toBeGreaterThan(300);
    expect(reasons.captured + reasons.trapped + reasons.blocked + reasons.quiet).toBe(600);
    // Every game ends: at most 13 geese can step forward at most 6 rows, so forward steps and captures are bounded,
    // and no more than 30 plies can pass between two of them.
    expect(maxPlies).toBeLessThanOrEqual((13 * 6 + 13 + 1) * QUIET_LIMIT);
  }, 120_000);
});

describe('the search', () => {
  /** Plain minimax with no pruning and no move ordering, over the same rules and evaluation. */
  const plain = (s: State, depth: number): number => {
    if (countGeese(s.b) < MIN_TRAPPERS) return s.toMove === FOX ? WIN_SCORE + depth : -(WIN_SCORE + depth);
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
      let s = newGame(g % 2 === 0 ? GEESE : FOX);
      const stop = 2 + Math.floor(rng() * 40);
      for (let ply = 0; ply < stop && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (!outcome(s).over) out.push(s);
    }
    return out;
  };

  it('gives the same value as a plain minimax at depths 1 to 3 (and 4 where the move list is short) in positions from random games', () => {
    let checked = 0;
    let deep = 0;
    for (const s of midgames(40, 11)) {
      for (let d = 1; d <= 3; d++) expect(searchValue(s, d) + 0).toBe(plain(s, d) + 0);
      if (legalMoves(s).length <= 10) { expect(searchValue(s, 4) + 0).toBe(plain(s, 4) + 0); deep++; }
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
    expect(deep).toBeGreaterThan(8);
  }, 240_000);
  it('evaluation is zero-sum between the sides and a won position outranks it', () => {
    const s = newGame();
    expect(evaluate(s)).toBe(evaluateForGeese(s));
    expect(evaluate({ ...s, toMove: FOX })).toBe(-evaluateForGeese(s));
    const trapped = pos([[0, 2], [0, 4], [1, 3], [2, 3]], [0, 3], FOX);
    expect(searchValue(trapped, 2)).toBeLessThan(-WIN_SCORE + 10);
    const winning = pos([[0, 2], [0, 4], [1, 3], [2, 3]], [0, 3], GEESE);
    expect(searchValue(winning, 2)).toBeGreaterThan(-WIN_SCORE);
    expect(Math.abs(evaluate(s))).toBeLessThan(WIN_SCORE);
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
    for (const side of [GEESE, FOX]) {
      const s = newGame(side);
      const m = randomMove(s, mulberry32(1))!;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
      expect(sig(randomMove(s, mulberry32(1))!)).toBe(sig(m));
    }
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(sig(randomMove(newGame(), mulberry32(i))!));
    expect(seen.size).toBeGreaterThan(3);
    const blocked = pos([[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4]], [3, 3], GEESE);
    expect(randomMove(blocked, mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'hard', mulberry32(1))).toBeNull();
    expect(chooseMove(blocked, 'medium', mulberry32(1))).toBeNull();
  });
  it('every level plays a legal move for either side in positions from random games; Medium and Hard are deterministic with a fixed clock', () => {
    const rng = mulberry32(21);
    const fast = { now: () => 0, maxDepth: 3 };
    for (let g = 0; g < 16; g++) {
      let s = newGame(g % 2 === 0 ? GEESE : FOX);
      for (let ply = 0; ply < g * 3 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      for (const level of ['easy', 'medium', 'hard'] as Level[]) {
        const m = chooseMove(s, level, mulberry32(g), fast)!;
        expect(legalMoves(s).map(sig)).toContain(sig(m));
        if (level !== 'easy') expect(sig(chooseMove(s, level, mulberry32(g), fast)!)).toBe(sig(m));
      }
    }
  }, 120_000);
  it('the fox takes a goose it can take for nothing, and the geese do not leave one hanging', () => {
    // Fox beside a goose with the hole behind it open; other geese far away. Four geese in all, so taking one wins at once.
    const hang = pos([[3, 4], [6, 2], [6, 3], [6, 4]], [3, 3], FOX);
    for (const level of ['medium', 'hard'] as Level[]) {
      const m = chooseMove(hang, level, mulberry32(1), { now: () => 0, maxDepth: 3 })!;
      expect(m.captured.length).toBeGreaterThan(0);
    }
    // The same position with the geese to move: every sensible reply removes the danger.
    const save = pos([[3, 4], [4, 5], [4, 0], [4, 1]], [3, 3], GEESE);
    expect(legalFoxMoves({ ...save, toMove: FOX }).some(isCapture)).toBe(true); // the danger is real
    for (const level of ['medium', 'hard'] as Level[]) {
      for (const seed of [1, 2, 3]) {
        const m = chooseMove(save, level, mulberry32(seed), { now: () => 0, maxDepth: 3 })!;
        const after = applyMove(save, m)!;
        expect(legalFoxMoves(after).some(isCapture), `${level} ${sig(m)}`).toBe(false);
      }
    }
  });
  it('Medium fox beats Easy geese, and Medium geese beat or hold Easy fox, in seeded games', () => {
    const asFox = playGames('medium', FOX, 6, { now: () => 0 });
    expect(asFox.wins).toBeGreaterThanOrEqual(5);
    const asGeese = playGames('medium', GEESE, 6, { now: () => 0 });
    expect(asGeese.wins).toBeGreaterThanOrEqual(5);
  }, 240_000);
  it('Hard (searching 4 moves here) beats Easy on either side in at least 5 of 6 seeded games each', () => {
    const o = { now: () => 0, maxDepth: 4, budgetMs: 1e9 };
    expect(playGames('hard', FOX, 6, o).wins).toBeGreaterThanOrEqual(5);
    expect(playGames('hard', GEESE, 6, o).wins).toBeGreaterThanOrEqual(5);
  }, 240_000);
});

/** Wins by the strong level, playing `strongSide`, over Easy playing the other side. Draws and losses count against it. */
const playGames = (strong: Level, strongSide: Side, games: number, opts: { now?: () => number; maxDepth?: number; budgetMs?: number }): { wins: number; draws: number } => {
  let wins = 0;
  let draws = 0;
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(4000 + g);
    let s = newGame(GEESE);
    let guard = 0;
    while (!outcome(s).over && guard++ < 3000) {
      const level: Level = s.toMove === strongSide ? strong : 'easy';
      s = applyMove(s, chooseMove(s, level, rng, opts)!)!;
    }
    const o = outcome(s);
    if (o.winner === strongSide) wins++;
    else if (o.winner === null) draws++;
  }
  return { wins, draws };
};

describe('time budget', () => {
  it('states the numbers the page quotes', () => {
    expect(MEDIUM_DEPTH).toBe(3);
    expect(HARD_DEPTH).toBe(6);
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(1000);
  });
  it('Hard answers every position it is asked about, for either side, within a generous bound with the real settings', () => {
    const rng = mulberry32(8);
    let worst = 0;
    let count = 0;
    for (let g = 0; g < 20; g++) {
      let s = newGame(g % 2 === 0 ? GEESE : FOX);
      for (let ply = 0; ply < g * 2 && !outcome(s).over; ply++) s = applyMove(s, randomMove(s, rng)!)!;
      if (outcome(s).over) continue;
      const t0 = performance.now();
      const m = deepMove(s, rng)!;
      worst = Math.max(worst, performance.now() - t0);
      count++;
      expect(legalMoves(s).map(sig)).toContain(sig(m));
    }
    expect(count).toBeGreaterThan(14);
    expect(worst).toBeLessThan(4000);
  }, 120_000);
  it('the clock and a node cap are live from the first depth: a tiny budget or cap stops the search almost at once and still gives a legal move', () => {
    expect(HARD_BUDGET_MS).toBe(350); // the number on the guide page
    expect(HARD_NODE_CAP).toBe(40000);
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
  it('stops deepening when the clock runs out: a zero budget still gives a legal move from the first depth', () => {
    const s = newGame();
    const m = deepMove(s, mulberry32(3), { budgetMs: 0 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(m));
    let ticks = 0;
    const m2 = deepMove(s, mulberry32(3), { now: () => ticks++ * 50, budgetMs: 100 })!;
    expect(legalMoves(s).map(sig)).toContain(sig(m2));
  });
});

describe('words and bookkeeping', () => {
  it('names the sides, pluralises and describes moves', () => {
    expect(nameOf(GEESE)).toBe('Geese');
    expect(nameOf(FOX)).toBe('Fox');
    expect(otherSide(GEESE)).toBe(FOX);
    expect(geeseText(1)).toBe('1 goose');
    expect(geeseText(0)).toBe('0 geese');
    expect(geeseText(13)).toBe('13 geese');
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Careful.')).toBe('Careful. Computer is thinking...');
    expect(describeMove({ from: at(4, 0), path: [at(3, 0)], captured: [] }, GEESE, 'You')).toBe('You moved a goose from row 5, column 1 to row 4, column 1.');
    expect(describeMove({ from: at(3, 3), path: [at(2, 3)], captured: [] }, FOX, 'Computer')).toBe('Computer stepped from row 4, column 4 to row 3, column 4.');
    expect(describeMove({ from: at(3, 3), path: [at(3, 5)], captured: [at(3, 4)] }, FOX, 'Computer')).toBe('Computer jumped from row 4, column 4 to row 4, column 6 and captured 1 goose.');
  });
  it('finds the move Undo goes back to', () => {
    expect(undoIndex([], GEESE)).toBe(-1);
    expect(undoIndex([GEESE, FOX, GEESE, FOX], GEESE)).toBe(2);
    expect(undoIndex([GEESE, FOX, GEESE, FOX], FOX)).toBe(3);
    expect(undoIndex([FOX, FOX], GEESE)).toBe(-1);
    expect(undoIndex([GEESE, FOX, GEESE], null)).toBe(2);
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
