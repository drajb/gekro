/**
 * games-golf-solitaire.test.ts - the engine behind `golf-solitaire`.
 *
 * Pinned: the 52-card pack, an unbiased seeded shuffle (chi-square), the deal (7 columns of 5, a foundation
 * of 1, a stock of 16), the neighbour rule checked against an independent table for every pair of ranks with
 * and without wrap, plays and turns of the stock, the end of the game (a win with every column empty, stuck
 * with nothing fitting and an empty stock), the solver compared with an independent brute-force search on 800
 * small positions (exact), every line it returns replayed move by move on real deals, the proven-winnable rates
 * of the two rules, the winnable-deal finder, the hint (following it from a winnable deal always wins), the
 * words, the stored results, and a fuzz of random games. The source is checked for the claims the guide page makes.
 */
import { describe, it, expect } from 'vitest';
import {
  deal, legalMoves, canPlay, canDraw, playColumn, drawStock, applyMove, isWon, isOver, remaining, topOfFoundation, exposed, fitRanks,
  adjacent, needPhrase, solve, isProvenWinnable, findWinnableSeed, hint, whyNot, describePlay, describeDraw, resultSentence, validateState,
  sanitizeStore, recordGame, clampRule, mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isRed, plural,
  SUIT_CHARS, SUIT_NAMES, RANK_LABELS, DECK, COLS, COL_SIZE, TABLEAU, STOCK_START, MAX_COUNT, WIN_SEARCH_DEALS, SOLVE_NODES, RULES, RULE_NAMES,
  type GolfState, type Move,
} from '../src/components/apps-private/golf-solitaire/helpers';
import calculatorSource from '../src/components/apps-private/golf-solitaire/Calculator.astro?raw';

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts. */
const c = (code: string): number => {
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};
const ALL = Array.from({ length: DECK }, (_, i) => i);

/** A hand-built position (not a full pack): columns listed bottom-card last, foundation top last, stock with the next card last. */
const mk = (cols: string[][], found: string[], stock: string[] = [], wrap = false): GolfState => ({
  seed: 1, wrap, cols: [...cols, ...Array.from({ length: COLS - cols.length }, () => [] as string[])].map((col) => col.map(c)),
  found: found.map(c), stock: stock.map(c), moves: 0,
});

// ── an independent neighbour table and brute-force search ───────────────────

/** The ranks that may go on rank r, written out by hand and not computed from the engine. */
const NEIGHBOUR_TABLE = (wrap: boolean): Record<number, number[]> => {
  const t: Record<number, number[]> = { 1: [2], 2: [1, 3], 3: [2, 4], 4: [3, 5], 5: [4, 6], 6: [5, 7], 7: [6, 8], 8: [7, 9], 9: [8, 10], 10: [9, 11], 11: [10, 12], 12: [11, 13], 13: [12] };
  if (wrap) { t[1] = [2, 13]; t[13] = [12, 1]; }
  return t;
};

/** The fewest cards that can remain, by trying every sequence of moves with no cleverness and no shared code. */
const refBest = (cols: number[][], top: number, stock: number[], wrap: boolean): number => {
  const nb = NEIGHBOUR_TABLE(wrap);
  const memo = new Map<string, number>();
  const go = (cs: number[][], t: number, st: number[]): number => {
    const key = `${cs.map((x) => x.join(',')).join('|')}/${t}/${st.join(',')}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let best = cs.reduce((a, x) => a + x.length, 0);
    for (let i = 0; i < cs.length; i++) {
      if (cs[i].length === 0) continue;
      const r = cs[i][cs[i].length - 1];
      if (!nb[t].includes(r)) continue;
      const next = cs.map((x, j) => (j === i ? x.slice(0, -1) : x));
      best = Math.min(best, go(next, r, st));
    }
    if (st.length) best = Math.min(best, go(cs, st[st.length - 1], st.slice(0, -1)));
    memo.set(key, best);
    return best;
  };
  return go(cols, top, stock);
};

const replay = (s: GolfState, line: Move[]): GolfState => {
  let cur = s;
  for (const m of line) {
    const n = applyMove(cur, m);
    if (!n) throw new Error(`illegal move in the line: ${JSON.stringify(m)}`);
    cur = n;
  }
  return cur;
};

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards', () => {
  it('maps ids to suit and rank and back for all 52', () => {
    for (let id = 0; id < DECK; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
  });
  it('has 52 unique plain-language names and text-presentation suit glyphs', () => {
    expect(new Set(ALL.map(cardName)).size).toBe(52);
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(SUIT_NAMES).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
    expect(cardName(c('QS'))).toBe('Queen of spades');
    expect(cardLabel(c('10H'))).toBe('10♥︎');
    expect([0, 1, 2, 3].map((s) => isRed(cardId(s, 4)))).toEqual([false, true, true, false]);
    expect(plural(1, 'card')).toBe('1 card');
  });
  it('knows the layout numbers: 7 columns of 5 make 35, leaving 17 with one turned to start', () => {
    expect(COLS * COL_SIZE).toBe(35);
    expect(TABLEAU).toBe(35);
    expect(STOCK_START).toBe(16);
  });
});

// ── the shuffle and the deal ─────────────────────────────────────────────────

describe('shuffle and deal', () => {
  it('is a permutation, deterministic for a seed, and leaves its input alone', () => {
    const out = shuffled(ALL, mulberry32(7));
    expect(out.slice().sort((a, b) => a - b)).toEqual(ALL);
    expect(shuffled(ALL, mulberry32(7))).toEqual(out);
    expect(out).not.toEqual(ALL);
  });
  it('is unbiased: all 6 orderings of 3 items come up about equally (chi-square, df 5)', () => {
    const N = 6000;
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= N; seed++) {
      const k = shuffled([0, 1, 2], mulberry32(seed * 7919)).join('');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    let chi = 0;
    for (const v of counts.values()) chi += ((v - N / 6) ** 2) / (N / 6);
    expect(chi).toBeLessThan(20.5);
  });
  it('puts one fixed card in each of the 52 positions about equally often (chi-square, df 51)', () => {
    const N = 10400;
    const pos = new Array<number>(DECK).fill(0);
    for (let seed = 1; seed <= N; seed++) pos[shuffled(ALL, mulberry32(seed * 104729 + 13)).indexOf(17)] += 1;
    let chi = 0;
    for (const v of pos) chi += ((v - N / DECK) ** 2) / (N / DECK);
    expect(chi).toBeLessThan(87.7);
  });
  it('deals 7 columns of 5, one foundation card and 16 in the stock, using the whole pack once', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = deal(seed);
      expect(s.cols.map((x) => x.length)).toEqual([5, 5, 5, 5, 5, 5, 5]);
      expect(s.found.length).toBe(1);
      expect(s.stock.length).toBe(16);
      expect([...s.cols.flat(), ...s.found, ...s.stock].sort((a, b) => a - b)).toEqual(ALL);
      expect(validateState(s)).toBeNull();
      expect(remaining(s)).toBe(35);
      expect(s.moves).toBe(0);
    }
  });
  it('is the same for the same deal number and different for another, and the rule only changes the wrap flag', () => {
    expect(deal(5)).toEqual(deal(5));
    expect(deal(5).cols).not.toEqual(deal(6).cols);
    expect(deal(5, 'wrap').cols).toEqual(deal(5, 'plain').cols);
    expect(deal(5, 'wrap').wrap).toBe(true);
    expect(deal(5, 'plain').wrap).toBe(false);
    expect(clampRule('wrap')).toBe('wrap');
    for (const bad of ['', 'x', 1, null, undefined]) expect(clampRule(bad)).toBe('plain');
    expect(RULES).toEqual(['plain', 'wrap']);
    expect(RULE_NAMES.wrap).toMatch(/neighbours/);
  });
  it('handles seeds across the whole 32-bit range', () => {
    for (const seed of [0, 1, 2 ** 31, 4294967295]) expect(validateState(deal(seed))).toBeNull();
  });
});

// ── the neighbour rule ───────────────────────────────────────────────────────

describe('the rule', () => {
  it('matches the independent table for every pair of ranks, with and without wrap', () => {
    for (const wrap of [false, true]) {
      const table = NEIGHBOUR_TABLE(wrap);
      for (let a = 1; a <= 13; a++) {
        for (let b = 1; b <= 13; b++) {
          expect(adjacent(cardId(0, a), cardId(2, b), wrap), `${a} ${b} wrap ${wrap}`).toBe(table[a].includes(b));
        }
      }
    }
  });
  it('ignores suits and never lets a card go on its own rank', () => {
    expect(adjacent(c('7S'), c('8H'), false)).toBe(true);
    expect(adjacent(c('7S'), c('7H'), false)).toBe(false);
    expect(adjacent(c('7S'), c('9S'), false)).toBe(false);
    expect(adjacent(c('KS'), c('AS'), false)).toBe(false);
    expect(adjacent(c('KS'), c('AS'), true)).toBe(true);
  });
  it('lists the ranks that fit now', () => {
    expect(fitRanks(mk([[]], ['7H']))).toEqual([6, 8]);
    expect(fitRanks(mk([[]], ['AH']))).toEqual([2]);
    expect(fitRanks(mk([[]], ['AH'], [], true))).toEqual([2, 13]);
    expect(fitRanks(mk([[]], ['KH']))).toEqual([12]);
    expect(fitRanks(mk([[]], ['KH'], [], true))).toEqual([1, 12]);
    expect(needPhrase(mk([[]], ['7H']))).toBe('a 6 or an 8');
    expect(needPhrase(mk([[]], ['AH']))).toBe('a 2');
    expect(needPhrase(mk([[]], ['AH'], [], true))).toBe('a 2 or a King');
    expect(needPhrase(mk([[]], ['2H']))).toBe('an Ace or a 3');
    expect(needPhrase(mk([[]], ['KH'], [], true))).toBe('an Ace or a Queen');
  });
});

// ── moves ────────────────────────────────────────────────────────────────────

describe('moves', () => {
  it('plays only the exposed (last) card of a column, and only when it fits', () => {
    const s = mk([['2S', '8D'], ['9C', '3H'], ['6S']], ['7H'], ['KC']);
    expect(exposed(s, 0)).toBe(c('8D'));
    expect(exposed(s, 3)).toBeNull();
    expect(canPlay(s, 0)).toBe(true);
    expect(canPlay(s, 1)).toBe(false);
    expect(canPlay(s, 2)).toBe(true);
    expect(canPlay(s, 3)).toBe(false);
    for (const bad of [-1, 7, 99, 1.5, NaN, '0' as unknown as number, undefined as unknown as number]) expect(canPlay(s, bad)).toBe(false);
    const n = playColumn(s, 0) as GolfState;
    expect(n.found).toEqual([c('7H'), c('8D')]);
    expect(n.cols[0]).toEqual([c('2S')]);
    expect(n.moves).toBe(1);
    expect(topOfFoundation(n)).toBe(c('8D'));
    expect(playColumn(s, 1)).toBeNull();
    expect(playColumn(s, 3)).toBeNull();
  });
  it('turns the next stock card onto the foundation, the last card of the stock first', () => {
    const s = mk([['2S']], ['7H'], ['KC', 'QD']);
    expect(canDraw(s)).toBe(true);
    const n = drawStock(s) as GolfState;
    expect(topOfFoundation(n)).toBe(c('QD'));
    expect(n.stock).toEqual([c('KC')]);
    expect(n.found.length).toBe(2);
    expect(n.moves).toBe(1);
    const m = drawStock(n) as GolfState;
    expect(m.stock).toEqual([]);
    expect(canDraw(m)).toBe(false);
    expect(drawStock(m)).toBeNull();
  });
  it('lists plays first and turning the stock last', () => {
    const s = mk([['8D'], ['6C'], ['3S']], ['7H'], ['KC']);
    expect(legalMoves(s)).toEqual([{ t: 'play', col: 0 }, { t: 'play', col: 1 }, { t: 'draw' }]);
    expect(applyMove(s, { t: 'draw' })).not.toBeNull();
    expect(applyMove(s, { t: 'play', col: 2 })).toBeNull();
  });
  it('lets Kings and Aces meet only with wrap', () => {
    const plain = mk([['AS']], ['KH']);
    expect(canPlay(plain, 0)).toBe(false);
    expect(canPlay({ ...plain, wrap: true }, 0)).toBe(true);
  });
  it('does not change the state it was given', () => {
    const s = deal(9);
    const copy = JSON.stringify(s);
    for (const m of legalMoves(s)) applyMove(s, m);
    expect(JSON.stringify(s)).toBe(copy);
  });
});

// ── the end of the game ──────────────────────────────────────────────────────

describe('the end of the game', () => {
  it('is won when every column is empty', () => {
    let s = mk([['8D']], ['7H']);
    expect(isWon(s)).toBe(false);
    s = playColumn(s, 0) as GolfState;
    expect(isWon(s)).toBe(true);
    expect(isOver(s)).toBe(true);
    expect(remaining(s)).toBe(0);
    expect(resultSentence(s)).toBe('You cleared every column in 1 move!');
  });
  it('is stuck when nothing fits and the stock is empty', () => {
    const stuck = mk([['2S'], ['3D']], ['9H']);
    expect(isOver(stuck)).toBe(true);
    expect(isWon(stuck)).toBe(false);
    expect(legalMoves(stuck)).toEqual([]);
    expect(resultSentence(stuck)).toBe('No more moves: 2 cards left in the columns.');
    // With a stock card left it is not over, even though nothing fits yet.
    expect(isOver(mk([['2S']], ['9H'], ['5D']))).toBe(false);
  });
  it('words the unfinished state', () => {
    expect(resultSentence({ ...deal(3), moves: 4 })).toBe('35 cards left in the columns after 4 moves.');
  });
  it('explains why a card does not fit, in plain words', () => {
    const s = mk([['2S'], []], ['7H']);
    expect(whyNot(s, 0)).toBe('The 2 of spades does not fit. The top card is the 7 of hearts, so you need a 6 or an 8.');
    expect(whyNot(s, 1)).toBe('That column is empty.');
    expect(whyNot(mk([['8D']], ['7H']), 0)).toBe('');
    expect(whyNot(mk([['5D']], ['AH']), 0)).toBe('The 5 of diamonds does not fit. The top card is the Ace of hearts, so you need a 2.');
    expect(whyNot(mk([['5D']], ['AH'], [], true), 0)).toBe('The 5 of diamonds does not fit. The top card is the Ace of hearts, so you need a 2 or a King.');
    expect(describePlay(c('8D'), c('7H'))).toBe('Played the 8 of diamonds onto the 7 of hearts.');
    expect(describeDraw(c('KC'))).toBe('Turned over the King of clubs.');
  });
});

// ── the solver ───────────────────────────────────────────────────────────────

describe('the solver', () => {
  const randomSmall = (seed: number, wrap: boolean): { s: GolfState; cols: number[][]; top: number; stock: number[] } => {
    const rng = mulberry32(seed);
    const cols = Array.from({ length: COLS }, () => Array.from({ length: Math.floor(rng() * 4) }, () => 1 + Math.floor(rng() * 13)));
    const stock = Array.from({ length: Math.floor(rng() * 7) }, () => 1 + Math.floor(rng() * 13));
    const top = 1 + Math.floor(rng() * 13);
    const s: GolfState = {
      seed: 1, wrap, cols: cols.map((x) => x.map((r) => cardId(0, r))), found: [cardId(0, top)], stock: stock.map((r) => cardId(0, r)), moves: 0,
    };
    return { s, cols, top, stock };
  };
  it('finds exactly the fewest cards left, as an independent brute-force search does, on 800 small positions', () => {
    let wins = 0;
    let stuck = 0;
    for (let seed = 1; seed <= 800; seed++) {
      const wrap = seed % 2 === 0;
      const { s, cols, top, stock } = randomSmall(seed * 17, wrap);
      const sol = solve(s, 5_000_000);
      expect(sol.exact).toBe(true);
      const ref = refBest(cols, top, stock, wrap);
      expect(sol.best).toBe(ref);
      // The line it returns is real and reaches that number.
      const end = replay(s, sol.line);
      expect(remaining(end)).toBe(sol.best);
      if (sol.best === 0) wins += 1; else stuck += 1;
    }
    expect(wins).toBeGreaterThan(10);
    expect(stuck).toBeGreaterThan(100);
  }, 120_000);
  it('returns lines that replay legally on real deals, reaching a win when it says it found one', () => {
    let proven = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const rule of RULES) {
        const s = deal(seed, rule);
        const sol = solve(s, 40_000);
        const end = replay(s, sol.line);
        expect(remaining(end)).toBe(sol.best);
        expect(validateState(end)).toBeNull();
        if (sol.best === 0) { expect(isWon(end)).toBe(true); proven += 1; }
        expect(sol.nodes).toBeLessThanOrEqual(40_001);
      }
    }
    expect(proven).toBeGreaterThan(10);
  }, 120_000);
  it('never reports more cards left than the deal has, and a bigger budget never finds less (the answer only improves)', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const s = deal(seed);
      const small = solve(s, 2000);
      const big = solve(s, 60_000);
      expect(small.best).toBeLessThanOrEqual(35);
      expect(big.best).toBeLessThanOrEqual(small.best);
    }
  }, 120_000);
  it('stays inside its node budget', () => {
    const sol = solve(deal(4), 500);
    expect(sol.nodes).toBeLessThanOrEqual(501);
    expect(SOLVE_NODES).toBeGreaterThanOrEqual(50_000);
  });
  it('proves roughly a quarter of plain deals and two thirds of wrap deals winnable (100 seeds each, within the node budget)', () => {
    const rate = (rule: 'plain' | 'wrap'): number => {
      let n = 0;
      for (let seed = 1; seed <= 100; seed++) if (isProvenWinnable(deal(seed, rule))) n += 1;
      return n / 100;
    };
    const plain = rate('plain');
    const wrap = rate('wrap');
    expect(plain).toBeGreaterThan(0.12);
    expect(plain).toBeLessThan(0.4);
    expect(wrap).toBeGreaterThan(0.5);
    expect(wrap).toBeLessThan(0.85);
    expect(wrap).toBeGreaterThan(plain);
  }, 180_000);
});

// ── winnable deals and hints ─────────────────────────────────────────────────

describe('winnable deals and hints', () => {
  it('finds the first provably winnable deal at or after a number, and gives back a number that is already winnable', () => {
    for (const rule of RULES) {
      for (const from of [1, 500, 123456]) {
        const found = findWinnableSeed(from, rule);
        expect(found.proven).toBe(true);
        expect(found.seed).toBeGreaterThanOrEqual(from);
        expect(found.seed - from).toBeLessThan(WIN_SEARCH_DEALS);
        expect(isProvenWinnable(deal(found.seed, rule))).toBe(true);
        // Nothing earlier in the range was winnable.
        for (let k = from; k < found.seed; k++) expect(isProvenWinnable(deal(k, rule))).toBe(false);
        // Asking again from the answer returns the answer.
        expect(findWinnableSeed(found.seed, rule).seed).toBe(found.seed);
      }
    }
  }, 180_000);
  it('falls back to the starting number when it cannot prove one in the tries allowed', () => {
    const r = findWinnableSeed(77, 'plain', 1, 1);
    expect(r.proven).toBe(false);
    expect(r.seed).toBe(77);
  });
  it('follows hints from a winnable deal all the way to a win', () => {
    let wonCount = 0;
    for (const rule of RULES) {
      for (const from of [10, 2000]) {
        let s = deal(findWinnableSeed(from, rule).seed, rule);
        let guard = 0;
        while (!isOver(s)) {
          expect(guard++).toBeLessThan(80);
          const h = hint(s, 600_000);
          expect(h.move).not.toBeNull();
          expect(h.winning).toBe(true);
          s = applyMove(s, h.move as Move) as GolfState;
        }
        expect(isWon(s)).toBe(true);
        wonCount += 1;
      }
    }
    expect(wonCount).toBe(4);
  }, 180_000);
  it('gives a legal move on any position that has one and none when the game is over', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = deal(seed);
      const h = hint(s, 20_000);
      expect(h.move).not.toBeNull();
      expect(applyMove(s, h.move as Move)).not.toBeNull();
    }
    expect(hint(mk([['2S']], ['9H'])).move).toBeNull();
  }, 60_000);
});

// ── fuzz ─────────────────────────────────────────────────────────────────────

describe('random games', () => {
  it('never lose a card or break a rule in 1,500 random games, and every game ends', () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const rng = mulberry32(seed);
      let s = deal(seed * 7, seed % 2 ? 'wrap' : 'plain');
      let guard = 0;
      while (!isOver(s)) {
        expect(guard++).toBeLessThan(60);
        const moves = legalMoves(s);
        const m = moves[Math.floor(rng() * moves.length)];
        const before = remaining(s);
        s = applyMove(s, m) as GolfState;
        expect(validateState(s)).toBeNull();
        expect(remaining(s)).toBe(m.t === 'play' ? before - 1 : before);
      }
      // 35 columns cards + 16 stock cards at most 51 moves; the game ends won or stuck.
      expect(isWon(s) || legalMoves(s).length === 0).toBe(true);
      expect(s.moves).toBeLessThanOrEqual(51);
    }
  }, 120_000);
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk into a fresh object with whole numbers inside the caps', () => {
    const zero = { p: 0, w: 0, b: 0, m: 0 };
    for (const bad of [null, undefined, 5, 'x', [], [1, 2], NaN, true]) expect(sanitizeStore(bad)).toEqual(zero);
    expect(sanitizeStore({ p: 'a', w: NaN, b: -1, m: 1.5 })).toEqual(zero);
    expect(sanitizeStore({ p: 1e12, w: 1e12, b: 1e12, m: 1e12 })).toEqual(zero);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":9},"p":5,"w":2,"b":4,"m":30}'))).toEqual({ p: 5, w: 2, b: 4, m: 30 });
    expect(sanitizeStore({ p: 3, w: 9, b: 4, m: 30 })).toEqual({ p: 3, w: 3, b: 4, m: 30 });
    expect(sanitizeStore({ p: 3, w: 0, b: 4, m: 30 })).toEqual({ p: 3, w: 0, b: 4, m: 0 });
    expect(Object.keys(sanitizeStore({ p: 1, extra: 1 })).sort()).toEqual(['b', 'm', 'p', 'w']);
    expect(Object.getPrototypeOf(sanitizeStore({}))).toBe(Object.prototype);
  });
  it('records games, clears, the fewest left (plus one) and the fewest moves in a clear; aided games never set records', () => {
    let s = sanitizeStore(null);
    let r = recordGame(s, 7, 40, false);
    expect(r.store).toEqual({ p: 1, w: 0, b: 8, m: 0 });
    expect(r.record).toBe(true);
    r = recordGame(r.store, 9, 45, false);
    expect(r.record).toBe(false);
    expect(r.store.b).toBe(8);
    r = recordGame(r.store, 0, 50, false);
    expect(r.store).toEqual({ p: 3, w: 1, b: 1, m: 50 });
    expect(r.record).toBe(true);
    r = recordGame(r.store, 0, 44, false);
    expect(r.store).toEqual({ p: 4, w: 2, b: 1, m: 44 });
    r = recordGame(r.store, 0, 20, true); // aided: counts as played and cleared but sets no record
    expect(r.store).toEqual({ p: 5, w: 3, b: 1, m: 44 });
    expect(r.record).toBe(false);
    expect(recordGame(s, 99, 5, false).store.b).toBe(TABLEAU + 1);
    expect(recordGame(s, NaN, NaN, false).store.b).toBe(TABLEAU + 1);
    s = { p: MAX_COUNT, w: MAX_COUNT, b: 3, m: 9 };
    expect(recordGame(s, 5, 30, false).store.p).toBe(MAX_COUNT);
  });
});

// ── the page ─────────────────────────────────────────────────────────────────

describe('the page promises what the guide says', () => {
  it('stores under its own key, wires the shell and announces', () => {
    expect(calculatorSource).toContain("'gk:game:golf-solitaire'");
    for (const ev of ['app:copy', 'app:export', 'app:reset']) expect(calculatorSource).toContain(ev);
    expect(calculatorSource).toContain('aria-live="polite"');
    expect(calculatorSource).toMatch(/prefers-reduced-motion/);
    expect(calculatorSource).toMatch(/Nothing to download for a game/);
  });
  it('keeps sound off until the sound button is pressed and quiet when on', () => {
    expect(calculatorSource).toMatch(/let soundOn = false/);
    expect(calculatorSource).toMatch(/Sound is off/);
    const peak = calculatorSource.match(/PEAK\s*=\s*([0-9.]+)/);
    expect(peak).not.toBeNull();
    expect(Number((peak as RegExpMatchArray)[1])).toBeLessThanOrEqual(0.15);
  });
  it('marks a game as aided when a hint is used', () => {
    expect(calculatorSource).toMatch(/aided/);
  });
});
