/**
 * games-nim.test.ts - the engine behind `nim`.
 *
 * Pinned: the nim-sum rule for Normal play and the Misere variant of Bouton's
 * theorem are checked against an independent brute-force win/loss search over every
 * position with up to four heaps of up to six stones, the perfect move is always
 * legal and always leaves the opponent lost, the Perfect computer never loses from a
 * winning position, a random player loses to it every time, the rules refuse bad
 * moves, undo is an exact round trip, and seeded play is reproducible.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_HEAPS, MAX_STONES, START, LEVELS, MEDIUM_PERFECT_CHANCE, WIN_KEYS, MAX_SAVED, mulberry32, other, totalStones, startHeaps,
  isOver, nimSum, legalMoves, applyMove, describeMove, winner, isWinning, perfectMove, hintText, randomMove, smallMove,
  computerMove, rewind, winKey, sanitiseWins, binaryTable, explain,
  type Move, type Player, type Rules, type Difficulty, type Entry,
} from '../src/components/apps-private/nim/helpers';

// ── helpers local to the tests ──────────────────────────────────────────────

/** Independent win/loss search: does the player about to move win? No Bouton formula, just the rules. */
const memo = new Map<string, boolean>();
const bruteWin = (heaps: number[], misere: boolean): boolean => {
  const hs = heaps.filter((n) => n > 0).sort((a, b) => a - b);
  const key = `${misere ? 'm' : 'n'}:${hs.join(',')}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let res: boolean;
  if (hs.length === 0) {
    // The previous player took the last stone: they won in Normal play and lost in Misere.
    res = misere;
  } else {
    res = false;
    outer: for (let i = 0; i < hs.length; i++) {
      for (let t = 1; t <= hs[i]; t++) {
        const next = hs.slice();
        next[i] -= t;
        if (!bruteWin(next, misere)) { res = true; break outer; }
      }
    }
  }
  memo.set(key, res);
  return res;
};

/** Every position with up to 4 heaps, each from 0 to 6 stones (a heap of 0 is a missing heap). */
const allPositions = (): number[][] => {
  const out: number[][] = [];
  for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++) for (let c = 0; c <= 6; c++) for (let d = 0; d <= 6; d++) out.push([a, b, c, d]);
  return out;
};

type Mover = (heaps: number[]) => Move;
const asMove = (m: Move | null): Move => {
  expect(m).not.toBeNull();
  return m as Move;
};

/** Play a whole game from `start`. Player 1 moves first. Returns the winner and the number of moves. */
const playGame = (start: number[], rules: Rules, movers: [Mover, Mover]): { winner: Player; moves: number } => {
  let heaps = start.slice();
  let p: Player = 1;
  for (let ply = 1; ply <= 200; ply++) {
    const before = heaps.slice();
    const move = movers[p - 1](heaps);
    const next = applyMove(heaps, move);
    expect(next, `ply ${ply} move ${JSON.stringify(move)} on ${before}`).not.toBeNull();
    expect(heaps).toEqual(before); // the old position is untouched
    heaps = next as number[];
    if (isOver(heaps)) return { winner: winner(heaps, rules, p) as Player, moves: ply };
    p = other(p);
  }
  throw new Error('game did not finish');
};

const randomStart = (rng: () => number): number[] => {
  const n = 2 + Math.floor(rng() * 4); // 2 to 5 heaps
  return Array.from({ length: n }, () => 1 + Math.floor(rng() * MAX_STONES));
};

const perfectMover = (rules: Rules, rng: () => number): Mover => (h) => asMove(computerMove(h, rules, 'perfect', rng));
const levelMover = (rules: Rules, d: Difficulty, rng: () => number): Mover => (h) => asMove(computerMove(h, rules, d, rng));
const randomMover = (rng: () => number): Mover => (h) => asMove(randomMove(h, rng));

// ── positions and the nim-sum ───────────────────────────────────────────────

describe('nim-sum', () => {
  it('is the XOR of the heap sizes', () => {
    expect(nimSum([3, 4, 5])).toBe(2);
    expect(nimSum([1, 2, 3])).toBe(0);
    expect(nimSum([1, 3, 5, 7])).toBe(0);
    expect(nimSum([1, 2, 3, 4, 5])).toBe(1);
    expect(nimSum([7])).toBe(7);
    expect(nimSum([])).toBe(0);
  });
  it('is zero for two equal heaps and ignores empty heaps', () => {
    for (let n = 0; n <= 7; n++) expect(nimSum([n, n])).toBe(0);
    expect(nimSum([0, 3, 0, 4, 5, 0])).toBe(2);
  });
  it('treats bad heap sizes as empty instead of producing NaN', () => {
    expect(nimSum([3, NaN, 4, -2, 1.5, Infinity, 5])).toBe(2);
    expect(Number.isNaN(nimSum([undefined as unknown as number]))).toBe(false);
  });
});

describe('starting positions', () => {
  it('the three fixed setups have the heaps the page promises', () => {
    expect(START.classic).toEqual([3, 4, 5]);
    expect(START.four).toEqual([1, 3, 5, 7]);
    expect(START.five).toEqual([1, 2, 3, 4, 5]);
    expect(totalStones(START.classic)).toBe(12);
    expect(START.classic.length).toBeLessThanOrEqual(MAX_HEAPS);
    expect(START.four.length).toBeLessThanOrEqual(MAX_HEAPS);
    expect(START.five.length).toBeLessThanOrEqual(MAX_HEAPS);
  });
  it('startHeaps returns a copy, never the shared array', () => {
    const a = startHeaps('classic', mulberry32(1));
    a[0] = 99;
    expect(START.classic).toEqual([3, 4, 5]);
    expect(startHeaps('classic', mulberry32(1))).toEqual([3, 4, 5]);
  });
  it('random setup is three heaps of 1 to 7 stones, repeatable per seed and varied across seeds', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      const h = startHeaps('random', mulberry32(s));
      expect(h).toHaveLength(3);
      h.forEach((n) => expect(Number.isInteger(n) && n >= 1 && n <= MAX_STONES).toBe(true));
      expect(startHeaps('random', mulberry32(s))).toEqual(h);
      seen.add(h.join(','));
    }
    expect(seen.size).toBeGreaterThan(30);
  });
  it('random setup copes with the extreme edges of the rng', () => {
    expect(startHeaps('random', () => 0)).toEqual([1, 1, 1]);
    expect(startHeaps('random', () => 0.9999999999)).toEqual([7, 7, 7]);
  });
  it('the classic 3-4-5 start in Normal play is a first-player win, and the winning first move is found', () => {
    expect(3 ^ 4 ^ 5).toBe(2);
    expect(nimSum([3, 4, 5])).toBe(2);
    expect(isWinning([3, 4, 5], false)).toBe(true);
    expect(bruteWin([3, 4, 5], false)).toBe(true);
    const m = asMove(perfectMove([3, 4, 5], false));
    expect(m).toEqual({ heap: 0, take: 2 }); // 3 -> 1, giving 1, 4, 5 with nim-sum 0
    expect(nimSum(applyMove([3, 4, 5], m) as number[])).toBe(0);
    // It is the only winning move: every other move leaves a winning position for the opponent.
    const winners = legalMoves([3, 4, 5]).filter((mv) => !bruteWin(applyMove([3, 4, 5], mv) as number[], false));
    expect(winners).toEqual([{ heap: 0, take: 2 }]);
    expect(hintText([3, 4, 5], 'normal')).toBe('Take 2 from heap 1');
  });
  it('the classic start is also a first-player win in Misere', () => {
    expect(isWinning([3, 4, 5], true)).toBe(true);
    expect(bruteWin([3, 4, 5], true)).toBe(true);
    expect(perfectMove([3, 4, 5], true)).toEqual({ heap: 0, take: 2 });
  });
  it('Four heaps 1, 3, 5, 7 is lost for the player to move in both rule sets, and Five heaps 1 to 5 is won', () => {
    for (const misere of [false, true]) {
      expect(isWinning(START.four, misere)).toBe(false);
      expect(bruteWin(START.four, misere)).toBe(false);
      expect(perfectMove(START.four, misere)).toBeNull();
      expect(isWinning(START.five, misere)).toBe(true);
      expect(bruteWin(START.five, misere)).toBe(true);
    }
  });
});

// ── moves and rules ─────────────────────────────────────────────────────────

describe('legal moves', () => {
  it('there is one move per stone: heap size many options in each heap', () => {
    expect(legalMoves([3, 4, 5])).toHaveLength(12);
    expect(legalMoves([1])).toEqual([{ heap: 0, take: 1 }]);
    expect(legalMoves([2, 0, 1])).toEqual([{ heap: 0, take: 1 }, { heap: 0, take: 2 }, { heap: 2, take: 1 }]);
  });
  it('there are none once the heaps are empty', () => {
    expect(legalMoves([])).toEqual([]);
    expect(legalMoves([0, 0, 0])).toEqual([]);
  });
  it('every listed move is accepted by applyMove', () => {
    for (const pos of [[3, 4, 5], [1, 3, 5, 7], [7, 0, 2], [6]]) {
      for (const m of legalMoves(pos)) expect(applyMove(pos, m)).not.toBeNull();
    }
  });
});

describe('applyMove edge cases', () => {
  const pos = [3, 4, 5];
  it('takes stones from one heap and changes nothing else', () => {
    const next = applyMove(pos, { heap: 1, take: 3 }) as number[];
    expect(next).toEqual([3, 1, 5]);
    expect(next.filter((v, i) => v !== pos[i])).toHaveLength(1);
  });
  it('can take a whole heap, leaving it at zero', () => {
    expect(applyMove(pos, { heap: 2, take: 5 })).toEqual([3, 4, 0]);
  });
  it('cannot take nothing, a negative number or a fraction', () => {
    for (const take of [0, -1, -5, 0.5, 1.5, NaN, Infinity]) expect(applyMove(pos, { heap: 0, take }), `take ${take}`).toBeNull();
  });
  it('cannot take more than the heap holds', () => {
    expect(applyMove(pos, { heap: 0, take: 4 })).toBeNull();
    expect(applyMove(pos, { heap: 1, take: 5 })).toBeNull();
    expect(applyMove(pos, { heap: 2, take: 6 })).toBeNull();
    expect(applyMove([0, 2], { heap: 0, take: 1 })).toBeNull(); // an empty heap has nothing to take
  });
  it('cannot use a heap that does not exist', () => {
    for (const heap of [-1, 3, 99, 0.5, NaN]) expect(applyMove(pos, { heap, take: 1 }), `heap ${heap}`).toBeNull();
  });
  it('cannot take from two heaps in one move', () => {
    expect(applyMove(pos, { heap: [0, 1], take: 1 } as unknown as Move)).toBeNull();
    expect(applyMove(pos, { heap: 0, take: [1, 1] } as unknown as Move)).toBeNull();
    expect(applyMove(pos, { heap: 0, take: 3, also: { heap: 1, take: 1 } } as unknown as Move)).toEqual([0, 4, 5]); // extra fields are ignored
    expect(applyMove(pos, null as unknown as Move)).toBeNull();
    expect(applyMove(pos, undefined as unknown as Move)).toBeNull();
    expect(applyMove(pos, { heap: '0', take: '1' } as unknown as Move)).toBeNull();
  });
  it('removes exactly the number of stones asked for, and never changes its input', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed);
      const start = randomStart(rng);
      const copy = start.slice();
      const m = randomMove(start, rng) as Move;
      const next = applyMove(start, m) as number[];
      expect(start).toEqual(copy);
      expect(totalStones(next)).toBe(totalStones(start) - m.take);
      expect(next.every((n) => n >= 0)).toBe(true);
    }
  });
});

describe('end of game', () => {
  it('knows when no stones are left', () => {
    expect(isOver([0, 0, 0])).toBe(true);
    expect(isOver([])).toBe(true);
    expect(isOver([0, 1, 0])).toBe(false);
  });
  it('the player who takes the last stone wins in Normal play and loses in Misere', () => {
    expect(winner([0, 0], 'normal', 1)).toBe(1);
    expect(winner([0, 0], 'normal', 2)).toBe(2);
    expect(winner([0, 0], 'misere', 1)).toBe(2);
    expect(winner([0, 0], 'misere', 2)).toBe(1);
  });
  it('has no winner while stones remain or for an invalid last mover', () => {
    expect(winner([0, 1], 'normal', 1)).toBeNull();
    expect(winner([0, 1], 'misere', 2)).toBeNull();
    expect(winner([0, 0], 'normal', 3 as unknown as Player)).toBeNull();
  });
  it('describes a move for the hint line with one-based heap numbers', () => {
    expect(describeMove({ heap: 2, take: 2 })).toBe('Take 2 from heap 3');
    expect(describeMove({ heap: 0, take: 1 })).toBe('Take 1 from heap 1');
  });
});

// ── Bouton's theorem against a brute-force search ───────────────────────────

describe('exhaustive check: every position with up to 4 heaps of at most 6 stones', () => {
  const positions = allPositions();

  it('covers 7 x 7 x 7 x 7 = 2401 positions', () => {
    expect(positions).toHaveLength(2401);
  });

  it('Normal play: the lost positions for the player to move are exactly those with nim-sum 0', () => {
    let lost = 0;
    for (const pos of positions) {
      const win = bruteWin(pos, false);
      if (!win) lost++;
      expect(win, `[${pos}]`).toBe(nimSum(pos) !== 0);
      expect(isWinning(pos, false), `[${pos}]`).toBe(win);
    }
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(positions.length);
  });

  it('Misere: the Bouton formula agrees with the brute-force search on every position', () => {
    for (const pos of positions) expect(isWinning(pos, true), `[${pos}]`).toBe(bruteWin(pos, true));
  });

  for (const misere of [false, true]) {
    it(`${misere ? 'Misere' : 'Normal play'}: perfectMove is legal and leaves a lost position whenever the mover can win, and is null otherwise`, () => {
      let winning = 0;
      for (const pos of positions) {
        if (isOver(pos)) { expect(perfectMove(pos, misere)).toBeNull(); continue; }
        const win = bruteWin(pos, misere);
        const m = perfectMove(pos, misere);
        if (win) {
          winning++;
          expect(m, `[${pos}] should have a winning move`).not.toBeNull();
          const next = applyMove(pos, m as Move);
          expect(next, `[${pos}] move ${JSON.stringify(m)} must be legal`).not.toBeNull();
          expect(bruteWin(next as number[], misere), `[${pos}] move ${JSON.stringify(m)} must leave a lost position`).toBe(false);
          expect(legalMoves(pos)).toContainEqual(m);
        } else {
          expect(m, `[${pos}] is lost, so there is no winning move`).toBeNull();
        }
      }
      expect(winning).toBeGreaterThan(1000);
    });
  }

  it('every winning move the engine could pick leaves nim-sum 0 in Normal play', () => {
    for (const pos of positions) {
      const m = perfectMove(pos, false);
      if (m) expect(nimSum(applyMove(pos, m) as number[])).toBe(0);
    }
  });

  it('Misere really differs from Normal play: they disagree on some positions, and agree on all with two big heaps', () => {
    let differ = 0;
    for (const pos of positions) {
      const big = pos.filter((n) => n >= 2).length;
      const a = bruteWin(pos, false);
      const b = bruteWin(pos, true);
      if (a !== b) { differ++; expect(big).toBeLessThanOrEqual(1); }
    }
    expect(differ).toBeGreaterThan(0);
  });
});

describe('Misere end game', () => {
  it('with only single stones left, the mover wins when the count is even', () => {
    expect(isWinning([1], true)).toBe(false);
    expect(isWinning([1, 1], true)).toBe(true);
    expect(isWinning([1, 1, 1], true)).toBe(false);
    expect(isWinning([1, 1, 1, 1], true)).toBe(true);
    expect(perfectMove([1, 1], true)).toEqual({ heap: 0, take: 1 });
    expect(perfectMove([1, 1, 1], true)).toBeNull();
  });
  it('with exactly one big heap the mover always wins by leaving an odd number of single stones', () => {
    expect(perfectMove([2], true)).toEqual({ heap: 0, take: 1 }); // leave one single stone
    expect(perfectMove([2, 1], true)).toEqual({ heap: 0, take: 2 }); // take the heap, leave one single stone
    expect(perfectMove([5, 1, 1], true)).toEqual({ heap: 0, take: 4 }); // leave three single stones
    expect(perfectMove([5, 1, 1, 1], true)).toEqual({ heap: 0, take: 5 }); // leave three single stones
    for (const pos of [[2], [2, 1], [5, 1, 1], [5, 1, 1, 1], [7, 0, 1]]) expect(isWinning(pos, true)).toBe(true);
  });
  it('differs from Normal play where it should: [1, 1] and [1] flip, [1, 2, 3] stays lost', () => {
    expect(isWinning([1, 1], false)).toBe(false);
    expect(isWinning([1, 1], true)).toBe(true);
    expect(isWinning([1], false)).toBe(true);
    expect(isWinning([1], true)).toBe(false);
    expect(isWinning([1, 2, 3], false)).toBe(false);
    expect(isWinning([1, 2, 3], true)).toBe(false);
  });
  it('an empty board counts as a win for the mover in Misere and a loss in Normal play', () => {
    expect(isWinning([0, 0], true)).toBe(true);
    expect(isWinning([0, 0], false)).toBe(false);
    expect(perfectMove([0, 0], true)).toBeNull();
    expect(perfectMove([], false)).toBeNull();
  });
});

describe('hint text', () => {
  it('names the winning move, one-based', () => {
    expect(hintText([1, 2, 6], 'normal')).toBe('Take 3 from heap 3'); // nim-sum 5: 6 -> 3
    expect(hintText([2, 1], 'misere')).toBe('Take 2 from heap 1');
  });
  it('says plainly when the position is lost', () => {
    expect(hintText([1, 3, 5, 7], 'normal')).toBe('No winning move: the position is lost against perfect play');
    expect(hintText([1, 1, 1], 'misere')).toBe('No winning move: the position is lost against perfect play');
  });
  it('does not invent a move when the game is over', () => {
    expect(hintText([0, 0], 'normal')).toBe('The game is over');
  });
});

// ── the computer ────────────────────────────────────────────────────────────

describe('computer: legality', () => {
  it('always plays a legal move, at every level and in both rule sets, and nothing when the game is over', () => {
    const levels: Difficulty[] = ['easy', 'medium', 'perfect'];
    for (let seed = 1; seed <= 150; seed++) {
      const rng = mulberry32(seed);
      const pos = randomStart(rng);
      for (const rules of ['normal', 'misere'] as Rules[]) {
        for (const d of levels) {
          const m = computerMove(pos, rules, d, rng);
          expect(m).not.toBeNull();
          expect(applyMove(pos, m as Move), `${rules} ${d} [${pos}] ${JSON.stringify(m)}`).not.toBeNull();
        }
      }
    }
    for (const d of levels) expect(computerMove([0, 0, 0], 'normal', d, mulberry32(1))).toBeNull();
  });
  it('plays the only move when there is only one', () => {
    for (const d of ['easy', 'medium', 'perfect'] as Difficulty[]) {
      for (const rules of ['normal', 'misere'] as Rules[]) expect(computerMove([0, 1, 0], rules, d, mulberry32(3))).toEqual({ heap: 1, take: 1 });
    }
  });
  it('rng values at the very edge of [0, 1) still give a legal move', () => {
    for (const edge of [0, 0.9999999999]) {
      for (const d of ['easy', 'medium', 'perfect'] as Difficulty[]) {
        const pos = [3, 4, 5];
        const m = computerMove(pos, 'normal', d, () => edge);
        expect(applyMove(pos, m as Move)).not.toBeNull();
        const lost = [1, 3, 5, 7];
        expect(applyMove(lost, computerMove(lost, 'normal', d, () => edge) as Move)).not.toBeNull();
      }
    }
  });
  it('randomMove and smallMove return null on an empty board', () => {
    expect(randomMove([0, 0], mulberry32(1))).toBeNull();
    expect(smallMove([0, 0], mulberry32(1))).toBeNull();
  });
  it('an unknown level falls back to Medium instead of failing', () => {
    const m = computerMove([3, 4, 5], 'normal', 'nonsense' as never, mulberry32(1));
    expect(applyMove([3, 4, 5], m as Move)).not.toBeNull();
  });
});

describe('difficulty levels', () => {
  it('Easy never plays perfectly on purpose, Medium 70% of the time and Perfect always', () => {
    expect(LEVELS.easy.perfectChance).toBe(0);
    expect(LEVELS.medium.perfectChance).toBe(0.7);
    expect(MEDIUM_PERFECT_CHANCE).toBe(0.7);
    expect(LEVELS.perfect.perfectChance).toBe(1);
  });
  it('Perfect plays the winning move whenever one exists, for both rule sets', () => {
    for (const misere of [false, true]) {
      const rules: Rules = misere ? 'misere' : 'normal';
      for (const pos of allPositions().filter((p) => !isOver(p) && isWinning(p, misere))) {
        expect(computerMove(pos, rules, 'perfect', mulberry32(1))).toEqual(perfectMove(pos, misere));
      }
    }
  });
  it('Perfect takes one or two stones from a random non-empty heap when the position is lost', () => {
    const lost = [1, 3, 5, 7];
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      const m = computerMove(lost, 'normal', 'perfect', mulberry32(s)) as Move;
      expect(m.take === 1 || m.take === 2).toBe(true);
      expect(applyMove(lost, m)).not.toBeNull();
      seen.add(`${m.heap}:${m.take}`);
    }
    expect(seen.size).toBeGreaterThan(3);
    // A heap of one stone can only give one.
    for (let s = 1; s <= 30; s++) expect(computerMove([1, 1, 1], 'misere', 'perfect', mulberry32(s))?.take).toBe(1);
  });
  it('Medium uses the winning move when the roll is under 70% and a random legal move when it is not', () => {
    const perfect = asMove(perfectMove([3, 4, 5], false));
    expect(computerMove([3, 4, 5], 'normal', 'medium', () => 0.69)).toEqual(perfect);
    expect(computerMove([3, 4, 5], 'normal', 'medium', () => 0)).toEqual(perfect);
    // A roll of 0.7 or more takes the random branch; the next draw (0) then picks the first legal move.
    const seq = [0.7, 0];
    let i = 0;
    expect(computerMove([3, 4, 5], 'normal', 'medium', () => seq[i++ % seq.length])).toEqual({ heap: 0, take: 1 });
  });
  it('Medium plays the winning move about 70% of the time (a little over, since a random move can also be the winning one)', () => {
    const rng = mulberry32(2026);
    const perfect = perfectMove([3, 4, 5], false);
    let hits = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const m = computerMove([3, 4, 5], 'normal', 'medium', rng) as Move;
      if (m.heap === perfect!.heap && m.take === perfect!.take) hits++;
    }
    // 0.7 + 0.3 / 12 legal moves = 0.725 expected.
    expect(hits / n).toBeGreaterThan(0.69);
    expect(hits / n).toBeLessThan(0.76);
  });
  it('Easy picks the winning move only by chance (about 1 in 12 at 3-4-5) and uses every legal move', () => {
    const rng = mulberry32(77);
    const perfect = perfectMove([3, 4, 5], false)!;
    const seen = new Set<string>();
    let hits = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const m = computerMove([3, 4, 5], 'normal', 'easy', rng) as Move;
      seen.add(`${m.heap}:${m.take}`);
      if (m.heap === perfect.heap && m.take === perfect.take) hits++;
    }
    expect(seen.size).toBe(12);
    expect(hits / n).toBeGreaterThan(0.05);
    expect(hits / n).toBeLessThan(0.12);
  });
});

describe('strength', () => {
  for (const rules of ['normal', 'misere'] as Rules[]) {
    const misere = rules === 'misere';
    it(`${rules}: the Perfect computer never loses from a winning position, whatever level it faces, from either seat`, () => {
      const levels: Difficulty[] = ['easy', 'medium', 'perfect'];
      let firstSeatGames = 0;
      let secondSeatGames = 0;
      for (let g = 1; g <= 300; g++) {
        const rng = mulberry32(g * 31 + (misere ? 7 : 3));
        const start = randomStart(rng);
        // The side with the winning position is player 1 if the start is a win for the mover, else player 2.
        const seat: Player = isWinning(start, misere) ? 1 : 2;
        if (seat === 1) firstSeatGames++; else secondSeatGames++;
        const opp = levelMover(rules, levels[g % 3], mulberry32(g + 5000));
        const perfect = perfectMover(rules, mulberry32(g + 9000));
        const result = playGame(start, rules, seat === 1 ? [perfect, opp] : [opp, perfect]);
        expect(result.winner, `game ${g} [${start}]`).toBe(seat);
        expect(bruteWin(start, misere)).toBe(seat === 1);
      }
      expect(firstSeatGames).toBeGreaterThan(50);
      expect(secondSeatGames).toBeGreaterThan(5);
    });
    it(`${rules}: Perfect against Perfect always ends the way the starting position says`, () => {
      for (let g = 1; g <= 150; g++) {
        const rng = mulberry32(g * 17 + 1);
        const start = randomStart(rng);
        const result = playGame(start, rules, [perfectMover(rules, mulberry32(g)), perfectMover(rules, mulberry32(g + 1))]);
        expect(result.winner).toBe(isWinning(start, misere) ? 1 : 2);
      }
    });
    it(`${rules}: a fully random player loses to Perfect in all of 200 seeded games from a winning start`, () => {
      let played = 0;
      for (let g = 1; played < 200 && g < 5000; g++) {
        const rng = mulberry32(g * 101 + 13);
        const start = randomStart(rng);
        if (!isWinning(start, misere)) continue;
        played++;
        const result = playGame(start, rules, [perfectMover(rules, mulberry32(g)), randomMover(mulberry32(g + 777))]);
        expect(result.winner, `game ${g} [${start}]`).toBe(1);
      }
      expect(played).toBe(200);
    });
    it(`${rules}: Perfect playing second beats a random first player whenever the start is lost for the first player`, () => {
      let played = 0;
      for (let g = 1; played < 100 && g < 20000; g++) {
        const rng = mulberry32(g * 7 + 5);
        const start = randomStart(rng);
        if (isWinning(start, misere)) continue;
        played++;
        const result = playGame(start, rules, [randomMover(mulberry32(g)), perfectMover(rules, mulberry32(g + 1))]);
        expect(result.winner).toBe(2);
      }
      expect(played).toBe(100);
    });
  }
  it('Medium wins most games against Easy from a winning start, and Perfect beats Medium more often than not', () => {
    let mediumWins = 0;
    let perfectWins = 0;
    const n = 100;
    for (let g = 1; g <= n; g++) {
      const start = START.classic;
      const medium = levelMover('normal', 'medium', mulberry32(g));
      const easy = levelMover('normal', 'easy', mulberry32(g + 1000));
      const perfect = perfectMover('normal', mulberry32(g + 2000));
      if (playGame(start, 'normal', [medium, easy]).winner === 1) mediumWins++;
      if (playGame(start, 'normal', [perfect, medium]).winner === 1) perfectWins++;
    }
    expect(perfectWins).toBe(n); // 3-4-5 is a first-player win, so Perfect moving first cannot lose
    expect(mediumWins).toBeGreaterThan(n / 2);
  });
});

describe('determinism', () => {
  it('the same seed gives the same computer move, in every setting', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const pos = randomStart(mulberry32(seed));
      for (const rules of ['normal', 'misere'] as Rules[]) {
        for (const d of ['easy', 'medium', 'perfect'] as Difficulty[]) {
          expect(computerMove(pos, rules, d, mulberry32(seed + 1))).toEqual(computerMove(pos, rules, d, mulberry32(seed + 1)));
        }
      }
    }
  });
  it('the same seeds replay a whole game move for move', () => {
    const run = () => {
      const log: string[] = [];
      let heaps = [3, 4, 5, 6];
      let p: Player = 1;
      const a = mulberry32(11);
      const b = mulberry32(12);
      while (!isOver(heaps)) {
        const m = asMove(computerMove(heaps, 'misere', p === 1 ? 'medium' : 'easy', p === 1 ? a : b));
        log.push(`${p}:${m.heap}:${m.take}`);
        heaps = applyMove(heaps, m) as number[];
        p = other(p);
      }
      return log.join(' ');
    };
    expect(run()).toBe(run());
    expect(run().length).toBeGreaterThan(5);
  });
  it('different seeds make different random moves', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 60; s++) {
      const m = randomMove([3, 4, 5], mulberry32(s)) as Move;
      seen.add(`${m.heap}:${m.take}`);
    }
    expect(seen.size).toBeGreaterThan(5);
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
});

// ── undo ────────────────────────────────────────────────────────────────────

describe('undo', () => {
  /** Play `plies` moves with a recorded history, as the page does. */
  const record = (start: number[], plies: number, seed: number): { heaps: number[]; history: Entry[] } => {
    const rng = mulberry32(seed);
    let heaps = start.slice();
    const history: Entry[] = [];
    let p: Player = 1;
    for (let i = 0; i < plies && !isOver(heaps); i++) {
      const move = asMove(randomMove(heaps, rng));
      history.push({ before: heaps.slice(), move, player: p });
      heaps = applyMove(heaps, move) as number[];
      p = other(p);
    }
    return { heaps, history };
  };

  it('against the computer, takes back your move and the reply, restoring the exact earlier position', () => {
    for (const seat of [1, 2] as Player[]) {
      const { history } = record([3, 4, 5, 6], 5, 9);
      expect(history).toHaveLength(5);
      const snapshot = JSON.stringify(history);
      const r = rewind(history, seat)!;
      expect(r).not.toBeNull();
      expect(JSON.stringify(history)).toBe(snapshot); // the input is not changed
      // The last entry by `seat` is the one undone, along with everything after it.
      let i = history.length - 1;
      while (history[i].player !== seat) i--;
      expect(r.history).toEqual(history.slice(0, i));
      expect(r.heaps).toEqual(history[i].before);
      // It is the human's turn again: the history length has the right parity.
      expect(r.history.length % 2 === 0 ? 1 : 2).toBe(seat);
    }
  });
  it('replaying the taken-back moves reproduces the position that was undone', () => {
    const { heaps, history } = record([3, 4, 5], 6, 4);
    const r = rewind(history, 1)!;
    let replay = r.heaps.slice();
    for (const e of history.slice(r.history.length)) replay = applyMove(replay, e.move) as number[];
    expect(replay).toEqual(heaps);
  });
  it('rewinding all the way back reaches the starting position', () => {
    const start = [3, 4, 5];
    let { history } = record(start, 7, 21);
    let heaps: number[] = [];
    let guard = 0;
    while (guard++ < 20) {
      const r = rewind(history, 1);
      if (!r) break;
      history = r.history;
      heaps = r.heaps;
    }
    expect(history).toEqual([]);
    expect(heaps).toEqual(start);
  });
  it('with two players takes back a single move', () => {
    const { history } = record([3, 4, 5], 4, 2);
    const r = rewind(history, null)!;
    expect(r.history).toEqual(history.slice(0, 3));
    expect(r.heaps).toEqual(history[3].before);
  });
  it('has nothing to undo before you have moved', () => {
    expect(rewind([], 1)).toBeNull();
    expect(rewind([], null)).toBeNull();
    // Playing second: the computer has opened, but you have not moved yet.
    const { history } = record([3, 4, 5], 1, 3);
    expect(history).toHaveLength(1);
    expect(rewind(history, 2)).toBeNull();
    expect(rewind(history, null)).not.toBeNull();
  });
  it('returns a copy of the position, so editing it cannot corrupt the history', () => {
    const { history } = record([3, 4, 5], 2, 6);
    const r = rewind(history, 1)!;
    r.heaps[0] = 99;
    expect(history[0].before).toEqual([3, 4, 5]);
  });
});

// ── saved results ───────────────────────────────────────────────────────────

describe('saved wins', () => {
  it('there is one key per rule set and level', () => {
    expect(WIN_KEYS).toHaveLength(6);
    expect(new Set(WIN_KEYS).size).toBe(6);
    expect(winKey('misere', 'perfect')).toBe('misere-perfect');
    expect(WIN_KEYS).toContain(winKey('normal', 'easy'));
  });
  it('reads back whole positive numbers for known keys only', () => {
    expect(sanitiseWins({ 'normal-easy': 3, 'misere-perfect': 12 })).toEqual({ 'normal-easy': 3, 'misere-perfect': 12 });
    expect(sanitiseWins({ 'normal-easy': '7', unknown: 5, 'normal-medium': 4 })).toEqual({ 'normal-easy': 7, 'normal-medium': 4 });
  });
  it('drops anything that is not a sane count', () => {
    const junk = { 'normal-easy': -1, 'normal-medium': 1.5, 'normal-perfect': NaN, 'misere-easy': Infinity, 'misere-medium': 'x', 'misere-perfect': MAX_SAVED + 1 };
    expect(sanitiseWins(junk)).toEqual({});
    expect(sanitiseWins({ 'normal-easy': 0 })).toEqual({});
    expect(sanitiseWins({ 'normal-easy': MAX_SAVED })).toEqual({ 'normal-easy': MAX_SAVED });
  });
  it('survives storage that is not an object', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3], []]) expect(sanitiseWins(raw)).toEqual({});
  });
  it('survives a JSON round trip', () => {
    const saved = { 'normal-medium': 2, 'misere-easy': 9 };
    expect(sanitiseWins(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });
});

// ── the explanation ─────────────────────────────────────────────────────────

describe('explanation', () => {
  it('lays out each heap in binary, padded to the same width, with the nim-sum underneath', () => {
    const t = binaryTable([3, 4, 5]);
    expect(t.bits).toBe(3);
    expect(t.rows).toEqual([
      { heap: 1, size: 3, binary: '011' },
      { heap: 2, size: 4, binary: '100' },
      { heap: 3, size: 5, binary: '101' },
    ]);
    expect(t.sum).toBe(2);
    expect(t.sumBinary).toBe('010');
  });
  it('the binary column sums really are the XOR of the rows', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const pos = randomStart(mulberry32(seed));
      const t = binaryTable(pos);
      for (let b = 0; b < t.bits; b++) {
        const ones = t.rows.filter((r) => r.binary[b] === '1').length;
        expect(t.sumBinary[b]).toBe(ones % 2 === 1 ? '1' : '0');
      }
      expect(parseInt(t.sumBinary, 2)).toBe(nimSum(pos));
    }
  });
  it('shows an empty heap as zeros and handles a board with no stones', () => {
    expect(binaryTable([0, 5]).rows[0].binary).toBe('000');
    expect(binaryTable([0, 0]).sumBinary).toBe('000');
    expect(binaryTable([]).rows).toEqual([]);
  });
  it('explains a winning position by naming the nim-sum and the move', () => {
    const text = explain([3, 4, 5], 'normal');
    expect(text).toContain('010 (2)');
    expect(text).toContain('Take 2 from heap 1');
    expect(text).toContain('player to move can win');
  });
  it('explains a lost position honestly', () => {
    const text = explain([1, 3, 5, 7], 'normal');
    expect(text).toContain('000 (0)');
    expect(text).toContain('losing against perfect play');
    expect(text).not.toContain('Take ');
  });
  it('explains the Misere end game differently from the nim-sum rule', () => {
    const text = explain([5, 1], 'misere');
    expect(text).toContain('Misere end game');
    expect(text).toContain(describeMove(asMove(perfectMove([5, 1], true))));
    expect(explain([1, 1, 1], 'misere')).toContain('losing against perfect play');
    expect(explain([3, 4, 5], 'misere')).toContain('In Misere the same rule works');
  });
  it('never prints NaN, undefined, null or Infinity', () => {
    for (const rules of ['normal', 'misere'] as Rules[]) {
      for (const pos of [[], [0], [0, 0, 0], [1], [7, 7], START.classic, START.four, START.five, [NaN, 3], [-1, 2.5, 4]]) {
        const all = `${explain(pos, rules)} ${hintText(pos, rules)} ${JSON.stringify(binaryTable(pos))}`;
        expect(all, `[${pos}] ${rules}`).not.toMatch(/NaN|undefined|null|Infinity/);
      }
    }
  });
  it('says there is nothing to work out when the heaps are empty', () => {
    expect(explain([0, 0], 'normal')).toBe('No stones are left, so there is nothing to work out.');
  });
});

describe('small helpers', () => {
  it('other flips the player and totalStones adds the heaps', () => {
    expect(other(1)).toBe(2);
    expect(other(2)).toBe(1);
    expect(totalStones([3, 4, 5])).toBe(12);
    expect(totalStones([])).toBe(0);
    expect(totalStones([3, NaN, -2])).toBe(3);
  });
});
