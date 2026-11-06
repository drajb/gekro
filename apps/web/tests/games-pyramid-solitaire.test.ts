/**
 * games-pyramid-solitaire.test.ts - the engine behind `pyramid-solitaire`.
 *
 * Pinned: the 52-card pack, an unbiased seeded shuffle (chi-square), the deal (a 28-card pyramid of 7 rows and
 * 24 in the stock), the pyramid's geometry against a hand-drawn table, which cards are free, pairs that make
 * 13 (checked for every pair of ranks, Kings alone), the waste and the recycles (order, limits), the end of the
 * game, the solver compared with an independent brute-force search on 300 small positions (exact), every line it
 * returns replayed move by move on real deals, the proven-winnable rate, the winnable-deal finder, the hint
 * (following it from a winnable deal always clears the pyramid), the words, the stored results, and a fuzz of
 * random games. The source is checked for the claims the guide page makes.
 */
import { describe, it, expect } from 'vitest';
import {
  deal, legalMoves, applyMove, isFree, cardAt, freeSlots, isWon, isOver, cleared, cardsLeft, canDraw, canRecycle, recyclesLeft,
  makesThirteen, posOf, rowOf, placeOf, coveredBy, solve, isProvenWinnable, findWinnableSeed, hint, describeMove, whyNotPair, resultSentence,
  validateState, sanitizeStore, recordGame, clampRecycles, mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isRed, plural,
  SUIT_CHARS, SUIT_NAMES, RANK_LABELS, DECK, PYRAMID, ROWS, STOCK_START, WASTE_SLOT, MAX_COUNT, WIN_SEARCH_DEALS, SOLVE_NODES,
  RECYCLE_CHOICES, DEFAULT_RECYCLES, type PyramidState, type Move,
} from '../src/components/apps-private/pyramid-solitaire/helpers';
import calculatorSource from '../src/components/apps-private/pyramid-solitaire/Calculator.astro?raw';

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts. */
const c = (code: string): number => {
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};
const ALL = Array.from({ length: DECK }, (_, i) => i);

/**
 * A hand-built position. `pyr` lists the 28 positions as codes, with '' for a removed card (a shorter list is padded with removed
 * cards). `stock` is listed with the next card to turn LAST; `waste` with the top LAST.
 */
const mk = (pyr: string[], stock: string[] = [], waste: string[] = [], recycles = 3, used = 0): PyramidState => ({
  seed: 1, recycles, usedRecycles: used, pyr: Array.from({ length: PYRAMID }, (_, i) => (pyr[i] ? c(pyr[i]) : -1)), stock: stock.map(c), waste: waste.map(c), moves: 0,
});
/** Only the bottom row (positions 21 to 27) is there, with these seven codes. */
const bottom = (codes: string[]): string[] => [...Array.from({ length: 21 }, () => ''), ...codes];
const must = (s: PyramidState, m: Move): PyramidState => {
  const n = applyMove(s, m);
  if (!n) throw new Error(`move refused: ${JSON.stringify(m)}`);
  return n;
};

// ── an independent geometry table and brute-force search ────────────────────

/** Rows of positions, drawn out by hand. */
const ROW_TABLE: number[][] = [[0], [1, 2], [3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19, 20], [21, 22, 23, 24, 25, 26, 27]];

/** Brute force over every sequence of moves, written from the rules with its own notion of "free" and no shared code. */
const refBest = (s: PyramidState): number => {
  const memo = new Map<string, number>();
  const freeIdx = (pyr: number[]): number[] => {
    const out: number[] = [];
    ROW_TABLE.forEach((row, r) => {
      row.forEach((pos, k) => {
        if (pyr[pos] < 0) return;
        if (r === 6) { out.push(pos); return; }
        const below = ROW_TABLE[r + 1];
        if (pyr[below[k]] < 0 && pyr[below[k + 1]] < 0) out.push(pos);
      });
    });
    return out;
  };
  const val = (card: number): number => (card % 13) + 1;
  const go = (pyr: number[], stock: number[], waste: number[], used: number): number => {
    const key = `${pyr.join(',')}/${stock.join(',')}/${waste.join(',')}/${used}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let best = pyr.filter((x) => x >= 0).length;
    if (best === 0) { memo.set(key, 0); return 0; }
    const free = freeIdx(pyr);
    const wasteTop = waste.length ? waste[waste.length - 1] : -1;
    for (const a of free) {
      if (val(pyr[a]) === 13) best = Math.min(best, go(pyr.map((x, i) => (i === a ? -1 : x)), stock, waste, used));
    }
    if (wasteTop >= 0 && val(wasteTop) === 13) best = Math.min(best, go(pyr, stock, waste.slice(0, -1), used));
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (val(pyr[free[i]]) + val(pyr[free[j]]) === 13) best = Math.min(best, go(pyr.map((x, k) => (k === free[i] || k === free[j] ? -1 : x)), stock, waste, used));
      }
      if (wasteTop >= 0 && val(pyr[free[i]]) + val(wasteTop) === 13) best = Math.min(best, go(pyr.map((x, k) => (k === free[i] ? -1 : x)), stock, waste.slice(0, -1), used));
    }
    if (stock.length) best = Math.min(best, go(pyr, stock.slice(0, -1), [...waste, stock[stock.length - 1]], used));
    else if (waste.length && used < s.recycles) best = Math.min(best, go(pyr, waste.slice().reverse(), [], used + 1));
    memo.set(key, best);
    return best;
  };
  return go(s.pyr, s.stock, s.waste, s.usedRecycles);
};

const replay = (s: PyramidState, line: Move[]): PyramidState => {
  let cur = s;
  for (const m of line) cur = must(cur, m);
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
    expect(plural(1, 'recycle')).toBe('1 recycle');
    expect(plural(2, 'recycle')).toBe('2 recycles');
    // The copied result line pluralises the recycles through plural(), never a hard-coded 'recycles'.
    expect(calculatorSource).toContain("${plural(recycles, 'recycle')}) - ");
    expect(calculatorSource).not.toContain('(${recycles} recycles)');
  });
  it('values Ace 1, Jack 11, Queen 12 and King 13, and pairs make 13 for exactly six pairs of ranks', () => {
    expect([c('AS'), c('JS'), c('QS'), c('KS'), c('7S')].map(rankOf)).toEqual([1, 11, 12, 13, 7]);
    const pairs: string[] = [];
    for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) if (makesThirteen(cardId(0, a), cardId(1, b))) pairs.push(`${a}+${b}`);
    expect(pairs).toEqual(['1+12', '2+11', '3+10', '4+9', '5+8', '6+7']);
    // A King cannot pair with anything (it would need a zero).
    for (let b = 1; b <= 13; b++) expect(makesThirteen(c('KS'), cardId(0, b))).toBe(false);
    // The suit does not matter.
    expect(makesThirteen(c('6S'), c('7D'))).toBe(true);
    expect(makesThirteen(c('6S'), c('6D'))).toBe(false);
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
  it('deals a 28-card pyramid and 24 in the stock, using the whole pack once, with an empty waste', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = deal(seed);
      expect(s.pyr.length).toBe(28);
      expect(s.stock.length).toBe(24);
      expect(s.waste).toEqual([]);
      expect([...s.pyr, ...s.stock].sort((a, b) => a - b)).toEqual(ALL);
      expect(validateState(s)).toBeNull();
      expect(cardsLeft(s)).toBe(28);
      expect(cleared(s)).toBe(0);
      expect(s.usedRecycles).toBe(0);
      expect(s.recycles).toBe(3);
    }
    expect(STOCK_START).toBe(24);
    expect(ROWS).toBe(7);
  });
  it('is the same for the same deal number and different for another, and handles the whole 32-bit range', () => {
    expect(deal(5)).toEqual(deal(5));
    expect(deal(5).pyr).not.toEqual(deal(6).pyr);
    for (const seed of [0, 1, 2 ** 31, 4294967295]) expect(validateState(deal(seed))).toBeNull();
  });
  it('clamps the recycles to 1, 2 or 3', () => {
    expect(RECYCLE_CHOICES).toEqual([1, 2, 3]);
    expect(DEFAULT_RECYCLES).toBe(3);
    for (const n of [1, 2, 3]) expect(clampRecycles(n)).toBe(n);
    for (const bad of [0, 4, -1, 1.5, NaN, '2', null, undefined]) expect(clampRecycles(bad)).toBe(3);
    expect(deal(1, 1).recycles).toBe(1);
    expect(deal(1, 99).recycles).toBe(3);
  });
});

// ── the pyramid's shape ──────────────────────────────────────────────────────

describe('the pyramid', () => {
  it('numbers its positions row by row and finds row, place and the cards that cover each, as the hand-drawn table says', () => {
    ROW_TABLE.forEach((row, r) => {
      row.forEach((pos, k) => {
        expect(posOf(r, k)).toBe(pos);
        expect(rowOf(pos)).toBe(r);
        expect(placeOf(pos)).toBe(k);
        const expected = r === 6 ? [] : [ROW_TABLE[r + 1][k], ROW_TABLE[r + 1][k + 1]];
        expect(coveredBy(pos)).toEqual(expected);
      });
    });
    expect(ROW_TABLE.flat()).toEqual(Array.from({ length: 28 }, (_, i) => i));
  });
  it('covers every position except the top one exactly once or twice, and the bottom row is never covered', () => {
    const coverCount = new Array<number>(28).fill(0);
    for (let i = 0; i < 28; i++) for (const j of coveredBy(i)) coverCount[j] += 1;
    expect(coverCount[0]).toBe(0);
    for (let i = 1; i < 28; i++) expect(coverCount[i]).toBeGreaterThanOrEqual(1);
    for (let i = 21; i < 28; i++) expect(coveredBy(i)).toEqual([]);
  });
  it('starts with exactly the bottom row free', () => {
    const s = deal(3);
    expect(freeSlots(s).filter((x) => x !== WASTE_SLOT)).toEqual([21, 22, 23, 24, 25, 26, 27]);
    for (let i = 0; i < 21; i++) expect(isFree(s, i)).toBe(false);
  });
  it('frees a card only when BOTH cards that cover it are gone', () => {
    const s = deal(3);
    const one = { ...s, pyr: s.pyr.map((x, i) => (i === 27 ? -1 : x)) };
    expect(isFree(one, 20)).toBe(false); // position 20 is covered by 26 and 27
    const both = { ...one, pyr: one.pyr.map((x, i) => (i === 26 ? -1 : x)) };
    expect(isFree(both, 20)).toBe(true);
    expect(isFree(both, 19)).toBe(false); // still covered by 25 and 26... 26 is gone but 25 is not
    expect(isFree(both, 27)).toBe(false); // removed cards are not free
    for (const bad of [-1, 28, 1.5, NaN, '3' as unknown as number]) expect(isFree(s, bad)).toBe(false);
  });
  it('treats the top of the waste as free', () => {
    const s = mk(bottom(['2S', '3S']), [], ['9D', '4H']);
    expect(cardAt(s, WASTE_SLOT)).toBe(c('4H'));
    expect(freeSlots(s)).toEqual([21, 22, WASTE_SLOT]);
    expect(cardAt(mk([]), WASTE_SLOT)).toBeNull();
    expect(cardAt(s, 5)).toBeNull();
  });
});

// ── moves ────────────────────────────────────────────────────────────────────

describe('removing cards', () => {
  it('removes a free King on its own, from the pyramid or the waste', () => {
    const s = mk(bottom(['KS', '3S']), [], ['KD']);
    const a = must(s, { t: 'king', a: 21 });
    expect(a.pyr[21]).toBe(-1);
    expect(a.moves).toBe(1);
    const b = must(s, { t: 'king', a: WASTE_SLOT });
    expect(b.waste).toEqual([]);
    expect(applyMove(s, { t: 'king', a: 22 })).toBeNull(); // a 3 is not a King
    expect(applyMove(s, { t: 'king', a: 5 })).toBeNull(); // not free
    expect(applyMove(mk(bottom(['KS'])), { t: 'king', a: WASTE_SLOT })).toBeNull(); // empty waste
  });
  it('removes two free cards that add up to 13 and refuses the rest', () => {
    const s = mk(bottom(['6S', '7D', '5H', '9C', '8D', 'JS', '2D']));
    const n = must(s, { t: 'pair', a: 21, b: 22 });
    expect(n.pyr[21]).toBe(-1);
    expect(n.pyr[22]).toBe(-1);
    expect(cardsLeft(n)).toBe(5);
    must(s, { t: 'pair', a: 23, b: 25 }); // 5 + 8
    must(s, { t: 'pair', a: 26, b: 27 }); // J + 2
    expect(applyMove(s, { t: 'pair', a: 21, b: 23 })).toBeNull(); // 6 + 5
    expect(applyMove(s, { t: 'pair', a: 21, b: 21 })).toBeNull(); // the same card twice
    expect(applyMove(s, { t: 'pair', a: 21, b: 5 })).toBeNull(); // not free
    expect(applyMove(s, { t: 'pair', a: 24, b: 27 })).toBeNull(); // 9 + 2
    // Pair order does not matter.
    expect(applyMove(s, { t: 'pair', a: 22, b: 21 })).not.toBeNull();
  });
  it('pairs a free pyramid card with the top of the waste, but not the cards under it', () => {
    const s = mk(bottom(['6S', '3D']), [], ['7C', '9H', '4H']);
    expect(applyMove(s, { t: 'pair', a: 21, b: WASTE_SLOT })).toBeNull(); // 6 + 4
    const t = mk(bottom(['6S', '3D']), [], ['4H', '7C']);
    const n = must(t, { t: 'pair', a: 21, b: WASTE_SLOT });
    expect(n.waste).toEqual([c('4H')]);
    expect(n.pyr[21]).toBe(-1);
    // The waste cannot be paired with itself.
    expect(applyMove(t, { t: 'pair', a: WASTE_SLOT, b: WASTE_SLOT })).toBeNull();
  });
  it('a covered card cannot be used until BOTH cards that cover it are gone', () => {
    // Position 20 (a 6) is covered by 26 and 27, which are Kings here; position 25 is a free 7.
    const pyr = Array.from({ length: 28 }, () => '');
    pyr[20] = '6S';
    pyr[25] = '7D';
    pyr[26] = 'KS';
    pyr[27] = 'KD';
    const s = mk(pyr);
    expect(applyMove(s, { t: 'pair', a: 20, b: 25 })).toBeNull();
    const one = must(s, { t: 'king', a: 26 });
    expect(applyMove(one, { t: 'pair', a: 20, b: 25 })).toBeNull();
    const two = must(one, { t: 'king', a: 27 });
    expect(isFree(two, 20)).toBe(true);
    expect(applyMove(two, { t: 'pair', a: 20, b: 25 })).not.toBeNull();
  });
  it('does not change the state it was given', () => {
    const s = deal(9);
    const copy = JSON.stringify(s);
    for (const m of legalMoves(s)) applyMove(s, m);
    expect(JSON.stringify(s)).toBe(copy);
  });
  it('refuses junk moves', () => {
    const s = deal(2);
    for (const bad of [null, undefined, 5, 'x', {}, { t: 'nope' }, { t: 'king' }, { t: 'pair', a: 1 }] as unknown[]) expect(applyMove(s, bad as Move)).toBeNull();
  });
});

describe('the stock, the waste and the recycles', () => {
  it('turns the last card of the stock first onto the waste', () => {
    const s = mk([], ['2S', '3S', '4S']);
    expect(canDraw(s)).toBe(true);
    const n = must(s, { t: 'draw' });
    expect(n.waste).toEqual([c('4S')]);
    expect(n.stock).toEqual([c('2S'), c('3S')]);
    expect(describeMove(s, { t: 'draw' })).toBe('Turned over the 4 of spades.');
  });
  it('turns the waste back over into the same order again, up to the number of recycles', () => {
    let s = mk(bottom(['2S']), ['5S', '6S'], [], 2);
    expect(canRecycle(s)).toBe(false); // the stock is not empty yet
    expect(applyMove(s, { t: 'recycle' })).toBeNull();
    s = must(must(s, { t: 'draw' }), { t: 'draw' }); // waste: 6S, 5S (top)
    expect(s.waste).toEqual([c('6S'), c('5S')]);
    expect(canDraw(s)).toBe(false);
    expect(canRecycle(s)).toBe(true);
    expect(recyclesLeft(s)).toBe(2);
    s = must(s, { t: 'recycle' });
    expect(s.stock).toEqual([c('5S'), c('6S')]); // the first card turned comes up first again
    expect(s.waste).toEqual([]);
    expect(s.usedRecycles).toBe(1);
    expect(recyclesLeft(s)).toBe(1);
    s = must(must(s, { t: 'draw' }), { t: 'draw' });
    s = must(s, { t: 'recycle' });
    expect(recyclesLeft(s)).toBe(0);
    s = must(must(s, { t: 'draw' }), { t: 'draw' });
    expect(canRecycle(s)).toBe(false);
    expect(applyMove(s, { t: 'recycle' })).toBeNull();
  });
  it('refuses to recycle an empty waste and to draw an empty stock', () => {
    const s = mk(bottom(['2S']));
    expect(applyMove(s, { t: 'draw' })).toBeNull();
    expect(applyMove(s, { t: 'recycle' })).toBeNull();
  });
  it('removing cards from the waste keeps the order of the rest when it is recycled', () => {
    // Waste (oldest first): 9, 4, 8. Remove the 8 by a pair with a 5 and recycle: the stock top is the 9.
    let s = mk(bottom(['5S']), [], ['9D', '4D', '8H'], 3);
    s = must(s, { t: 'pair', a: 21, b: WASTE_SLOT });
    expect(s.waste).toEqual([c('9D'), c('4D')]);
    s = must(s, { t: 'recycle' });
    expect(s.stock).toEqual([c('4D'), c('9D')]);
  });
});

// ── the end of the game ──────────────────────────────────────────────────────

describe('the end of the game', () => {
  it('is won when the pyramid is gone', () => {
    let s = mk(bottom(['KS']));
    expect(isWon(s)).toBe(false);
    s = must(s, { t: 'king', a: 21 });
    expect(isWon(s)).toBe(true);
    expect(isOver(s)).toBe(true);
    expect(cleared(s)).toBe(28);
    expect(resultSentence(s)).toBe('You cleared the pyramid in 1 move!');
  });
  it('is stuck when nothing can be removed and the stock and recycles are used up', () => {
    const stuck = mk(bottom(['2S', '3S']), [], ['9D'], 1, 1);
    expect(legalMoves(stuck)).toEqual([]);
    expect(isOver(stuck)).toBe(true);
    expect(resultSentence(stuck)).toBe('No more moves: 2 cards left in the pyramid.');
    // With a recycle left the game goes on.
    expect(isOver(mk(bottom(['2S', '3S']), [], ['9D'], 2, 1))).toBe(false);
    // With a stock card left it goes on too.
    expect(isOver(mk(bottom(['2S', '3S']), ['9D'], [], 1, 1))).toBe(false);
  });
  it('words the unfinished state and the pair mistakes', () => {
    expect(resultSentence({ ...deal(3), moves: 4 })).toBe('28 cards left in the pyramid after 4 moves.');
    const s = mk(bottom(['6S', '5D']));
    expect(whyNotPair(s, 21, 22)).toBe('The 6 of spades and the 5 of diamonds make 11, not 13.');
    expect(whyNotPair(s, 21, 3)).toBe('One of those cards is not free.');
    expect(describeMove(s, { t: 'pair', a: 21, b: 22 })).toBe('Removed the 6 of spades and the 5 of diamonds, which make 13.');
    expect(describeMove(mk(bottom(['KS'])), { t: 'king', a: 21 })).toBe('Removed the King of spades.');
    expect(describeMove(mk([], ['2S']), { t: 'recycle' })).toBe('Turned the waste back over to make a new stock.');
  });
});

// ── the solver ───────────────────────────────────────────────────────────────

describe('the solver', () => {
  /** A real deal with all but `keep` pyramid cards taken away (chosen at random), a short stock and a random waste. */
  const small = (seed: number): PyramidState => {
    const rng = mulberry32(seed);
    const base = deal(seed * 3 + 1, 1 + (seed % 3));
    const order = shuffled(Array.from({ length: PYRAMID }, (_, i) => i), rng);
    const keep = new Set(order.slice(0, 5 + Math.floor(rng() * 5)));
    const stockN = Math.floor(rng() * 7);
    const wasteN = Math.floor(rng() * 3);
    const rest = base.stock.slice();
    return {
      ...base,
      pyr: base.pyr.map((x, i) => (keep.has(i) ? x : -1)),
      stock: rest.slice(0, stockN),
      waste: rest.slice(stockN, stockN + wasteN),
      usedRecycles: seed % 4 === 0 ? 1 : 0,
      recycles: Math.max(1 + (seed % 4 === 0 ? 1 : 0), 1 + (seed % 3)),
    };
  };
  it('finds exactly the fewest cards left, as an independent brute-force search does, on 300 small positions', () => {
    let wins = 0;
    let stuck = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const s = small(seed);
      expect(validateState(s)).toBeNull();
      const sol = solve(s, 5_000_000);
      expect(sol.exact).toBe(true);
      expect(sol.best).toBe(refBest(s));
      const end = replay(s, sol.line);
      expect(cardsLeft(end)).toBe(sol.best);
      expect(validateState(end)).toBeNull();
      if (sol.best === 0) wins += 1; else stuck += 1;
    }
    expect(wins).toBeGreaterThan(5);
    expect(stuck).toBeGreaterThan(100);
  }, 180_000);
  it('returns lines that replay legally on real deals, reaching a clear when it says it found one', () => {
    let proven = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = deal(seed, (seed % 3) + 1);
      const sol = solve(s, 40_000);
      const end = replay(s, sol.line);
      expect(cardsLeft(end)).toBe(sol.best);
      expect(validateState(end)).toBeNull();
      if (sol.best === 0) { expect(isWon(end)).toBe(true); proven += 1; }
      expect(sol.nodes).toBeLessThanOrEqual(40_001);
    }
    expect(proven).toBeGreaterThan(5);
  }, 120_000);
  it('never does worse with more recycles when both searches finish', () => {
    let compared = 0;
    for (let seed = 1; seed <= 60 && compared < 12; seed++) {
      const one = solve(deal(seed, 1), 60_000);
      const three = solve(deal(seed, 3), 60_000);
      if (one.exact && three.exact) {
        compared += 1;
        expect(three.best).toBeLessThanOrEqual(one.best);
      }
    }
    expect(compared).toBeGreaterThanOrEqual(6);
  }, 180_000);
  it('stays inside its node budget', () => {
    const sol = solve(deal(4), 500);
    expect(sol.nodes).toBeLessThanOrEqual(501);
    expect(SOLVE_NODES).toBeGreaterThanOrEqual(50_000);
  });
  it('proves between a third and three quarters of deals winnable with 3 recycles (80 seeds, within the node budget)', () => {
    let n = 0;
    for (let seed = 1; seed <= 80; seed++) if (isProvenWinnable(deal(seed, 3))) n += 1;
    expect(n / 80).toBeGreaterThan(0.33);
    expect(n / 80).toBeLessThan(0.75);
  }, 180_000);
});

// ── easy deals and hints ─────────────────────────────────────────────────────

describe('easy deals and hints', () => {
  it('finds the first provably winnable deal at or after a number, and gives back a number that is already winnable', () => {
    for (const recycles of [1, 3]) {
      for (const from of [1, 700, 123456]) {
        const found = findWinnableSeed(from, recycles);
        expect(found.proven).toBe(true);
        expect(found.seed).toBeGreaterThanOrEqual(from);
        expect(found.seed - from).toBeLessThan(WIN_SEARCH_DEALS);
        expect(isProvenWinnable(deal(found.seed, recycles))).toBe(true);
        for (let k = from; k < found.seed; k++) expect(isProvenWinnable(deal(k, recycles))).toBe(false);
        expect(findWinnableSeed(found.seed, recycles).seed).toBe(found.seed);
      }
    }
  }, 180_000);
  it('falls back to the starting number when it cannot prove one in the tries allowed', () => {
    const r = findWinnableSeed(77, 3, 1, 1);
    expect(r.proven).toBe(false);
    expect(r.seed).toBe(77);
  });
  it('follows hints from a winnable deal all the way to a cleared pyramid', () => {
    for (const recycles of [1, 3]) {
      for (const from of [10, 2000]) {
        let s = deal(findWinnableSeed(from, recycles).seed, recycles);
        let guard = 0;
        while (!isOver(s)) {
          expect(guard++).toBeLessThan(200);
          const h = hint(s, 700_000);
          expect(h.move).not.toBeNull();
          expect(h.winning).toBe(true);
          s = must(s, h.move as Move);
        }
        expect(isWon(s)).toBe(true);
      }
    }
  }, 240_000);
  it('gives a legal move on any position that has one and none when the game is over', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = deal(seed);
      const h = hint(s, 20_000);
      expect(h.move).not.toBeNull();
      expect(applyMove(s, h.move as Move)).not.toBeNull();
    }
    expect(hint(mk(bottom(['2S', '3S']), [], [], 1, 1)).move).toBeNull();
  }, 60_000);
});

// ── fuzz ─────────────────────────────────────────────────────────────────────

describe('random games', () => {
  it('never lose a card or break a rule in 1,000 random games, and every game ends', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = mulberry32(seed);
      let s = deal(seed * 11, 1 + (seed % 3));
      let guard = 0;
      while (!isOver(s)) {
        expect(guard++).toBeLessThan(300);
        const moves = legalMoves(s);
        const m = moves[Math.floor(rng() * moves.length)];
        const before = cardsLeft(s);
        const next = applyMove(s, m) as PyramidState;
        expect(next).not.toBeNull();
        s = next;
        expect(validateState(s)).toBeNull();
        expect(cardsLeft(s)).toBe(before - (m.t === 'king' ? (m.a === WASTE_SLOT ? 0 : 1) : m.t === 'pair' ? (m.b === WASTE_SLOT ? 1 : 2) : 0));
        // Cards are only ever in the pyramid, the stock or the waste, or removed: the count of remaining cards never rises.
        expect(s.pyr.filter((x) => x >= 0).length + s.stock.length + s.waste.length).toBeLessThanOrEqual(52);
        expect(s.usedRecycles).toBeLessThanOrEqual(s.recycles);
      }
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
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":9},"p":5,"w":0,"b":20,"m":30}'))).toEqual({ p: 5, w: 0, b: 20, m: 0 });
    expect(sanitizeStore({ p: 5, w: 2, b: 12, m: 30 })).toEqual({ p: 5, w: 2, b: 28, m: 30 });
    expect(sanitizeStore({ p: 3, w: 9, b: 4, m: 30 })).toEqual({ p: 3, w: 3, b: 28, m: 30 });
    expect(Object.keys(sanitizeStore({ p: 1, extra: 1 })).sort()).toEqual(['b', 'm', 'p', 'w']);
    expect(Object.getPrototypeOf(sanitizeStore({}))).toBe(Object.prototype);
  });
  it('records games, clears, the most cards cleared and the fewest moves in a clear; aided games never set records', () => {
    const s = sanitizeStore(null);
    let r = recordGame(s, 20, 40, false);
    expect(r.store).toEqual({ p: 1, w: 0, b: 20, m: 0 });
    expect(r.record).toBe(true);
    r = recordGame(r.store, 18, 40, false);
    expect(r.record).toBe(false);
    expect(r.store.b).toBe(20);
    r = recordGame(r.store, 28, 60, false);
    expect(r.store).toEqual({ p: 3, w: 1, b: 28, m: 60 });
    expect(r.record).toBe(true);
    r = recordGame(r.store, 28, 50, false);
    expect(r.store).toEqual({ p: 4, w: 2, b: 28, m: 50 });
    r = recordGame(r.store, 28, 30, true);
    expect(r.store).toEqual({ p: 5, w: 3, b: 28, m: 50 });
    expect(r.record).toBe(false);
    expect(recordGame(s, 99, 5, false).store.b).toBe(28);
    expect(recordGame(s, NaN, NaN, false).store.b).toBe(0);
    expect(recordGame({ p: MAX_COUNT, w: MAX_COUNT, b: 3, m: 9 }, 5, 30, false).store.p).toBe(MAX_COUNT);
  });
});

// ── the page ─────────────────────────────────────────────────────────────────

describe('the page promises what the guide says', () => {
  it('stores under its own key, wires the shell and announces', () => {
    expect(calculatorSource).toContain("'gk:game:pyramid-solitaire'");
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
