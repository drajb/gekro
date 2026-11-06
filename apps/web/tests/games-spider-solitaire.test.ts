/**
 * games-spider-solitaire.test.ts - the engine behind `spider-solitaire`.
 *
 * Pinned: the deal (104 cards, 10 columns of 6,6,6,6,5,5,5,5,5,5 with only the last face up, 50 in the
 * stock) for 1, 2 and 4 suits and its seed determinism; which cards can be picked up (a face-up run of one
 * suit in descending order); the legal moves, checked against a naive enumeration written straight from the
 * rules on hundreds of positions reached by random play; flipping, completing and removing King-to-Ace runs;
 * dealing a row (blocked by an empty column); the validator (no card is ever lost or invented) over
 * thousands of random actions; the hint; the solver, whose answers are replayed move by move through the
 * ordinary move functions, and the list of winnable deals that the page offers; the stored records
 * (sanitised), URL parsing and text.
 */
import { describe, it, expect } from 'vitest';
import {
  COLUMNS, DECK, RUNS_TO_WIN, WINNABLE, SUIT_COUNTS, mulberry32, shuffled, packFor, deckFor, deal, cardId, rankOf, suitOf, cardName, cardLabel, runStart,
  canPickup, canDrop, move, dealRow, dealBlock, dealsLeft, applyAction, legalMoves, moveScore, hint, solve, isWon, hasEmptyColumn, validateState,
  sanitizeStore, recordWin, parseSetup, clampSuits, plural, describeRun, dealAnnouncement, shareText, type SpiderState, type Card, type Move, type Suits, type Action,
} from '../src/components/apps-private/spider-solitaire/helpers';
import calculatorSource from '../src/components/apps-private/spider-solitaire/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');
const K = (rank: number, suit = 0, up = true): Card => ({ id: cardId(suit, rank), up });
const empty = (): Card[][] => Array.from({ length: COLUMNS }, () => []);
const blank = (tableau: Card[][], over: Partial<SpiderState> = {}): SpiderState => ({ tableau, stock: [], done: [], suits: 1, seed: 1, moves: 0, ...over });
const run = (from: number, to: number, suit = 0): Card[] => {
  const out: Card[] = [];
  for (let r = from; r >= to; r--) out.push(K(r, suit));
  return out;
};

// ── Independent oracle: every move, straight from the rules ─────────────────

const naiveMoves = (s: SpiderState): Move[] => {
  const out: Move[] = [];
  for (let from = 0; from < COLUMNS; from++) {
    const col = s.tableau[from];
    for (let index = 0; index < col.length; index++) {
      // Every card from index to the end must be face up, of one suit, each one rank below the one before.
      let ok = true;
      for (let j = index; j < col.length; j++) {
        if (!col[j].up) ok = false;
        if (j > index && (suitOf(col[j].id) !== suitOf(col[j - 1].id) || rankOf(col[j].id) !== rankOf(col[j - 1].id) - 1)) ok = false;
      }
      if (!ok) continue;
      for (let to = 0; to < COLUMNS; to++) {
        if (to === from) continue;
        const dest = s.tableau[to];
        const fits = dest.length === 0 || (dest[dest.length - 1].up && rankOf(dest[dest.length - 1].id) === rankOf(col[index].id) + 1);
        if (fits) out.push({ from, index, to });
      }
    }
  }
  return out;
};
const sortMoves = (m: Move[]): Move[] => m.slice().sort((a, b) => a.from - b.from || a.index - b.index || a.to - b.to);

/** Play random legal actions from a deal and return the positions seen along the way. */
const randomPositions = (seed: number, suits: Suits, steps: number, rng: () => number): SpiderState[] => {
  const out: SpiderState[] = [];
  let s = deal(seed, suits);
  out.push(s);
  for (let i = 0; i < steps && !isWon(s); i++) {
    const moves = legalMoves(s);
    const canDeal = !dealBlock(s);
    if (!moves.length && !canDeal) break;
    if (canDeal && (!moves.length || rng() < 0.12)) s = (dealRow(s) as NonNullable<ReturnType<typeof dealRow>>).state;
    else {
      const m = moves[Math.floor(rng() * moves.length)];
      s = (move(s, m.from, m.index, m.to) as NonNullable<ReturnType<typeof move>>).state;
    }
    out.push(s);
  }
  return out;
};

describe('cards', () => {
  it('names the cards', () => {
    expect(rankOf(cardId(2, 13))).toBe(13);
    expect(suitOf(cardId(2, 13))).toBe(2);
    expect(cardName(cardId(0, 1))).toBe('Ace of spades');
    expect(cardName(cardId(1, 12))).toBe('Queen of hearts');
    expect(cardLabel(cardId(3, 10))).toContain('10');
  });
});

describe('the deal', () => {
  it('uses 104 cards: 8 spades suits worth of ranks, split by suit count', () => {
    for (const suits of SUIT_COUNTS) {
      const pack = packFor(suits);
      expect(pack).toHaveLength(DECK);
      const counts = new Map<number, number>();
      for (const c of pack) counts.set(c, (counts.get(c) ?? 0) + 1);
      expect(counts.size).toBe(13 * suits);
      for (const n of counts.values()) expect(n).toBe(DECK / (13 * suits));
      for (const c of pack) expect(suitOf(c)).toBeLessThan(suits);
    }
  });
  it('lays out 10 columns of 6,6,6,6,5,5,5,5,5,5 with only the last card face up and 50 in the stock', () => {
    for (const suits of SUIT_COUNTS) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = deal(seed, suits);
        expect(s.tableau.map((c) => c.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
        for (const col of s.tableau) {
          expect(col.slice(0, -1).every((c) => !c.up)).toBe(true);
          expect(col[col.length - 1].up).toBe(true);
        }
        expect(s.stock).toHaveLength(50);
        expect(dealsLeft(s)).toBe(5);
        expect(s.done).toEqual([]);
        expect(s.moves).toBe(0);
        expect(validateState(s)).toBeNull();
      }
    }
  });
  it('gives the same deal for the same seed and suits, and a different one otherwise', () => {
    expect(deal(5, 2)).toEqual(deal(5, 2));
    expect(deal(5, 2)).not.toEqual(deal(6, 2));
    expect(deal(5, 1)).not.toEqual(deal(5, 2));
    expect(deckFor(9, 4)).toEqual(deckFor(9, 4));
    expect(deal(7, 3 as unknown as Suits).suits).toBe(1);
  });
  it('shuffles fairly enough: every position of the deck sees every kind of card', () => {
    const rng = mulberry32(1);
    const first = new Set<number>();
    for (let i = 0; i < 400; i++) first.add(shuffled(packFor(4), rng)[0]);
    expect(first.size).toBeGreaterThan(40);
  });
});

describe('picking up', () => {
  it('finds the run at the end of a column', () => {
    expect(runStart([K(9, 0, false), K(8), K(7), K(6, 1)])).toBe(3);
    expect(runStart([K(9), K(8), K(7)])).toBe(0);
    expect(runStart([K(9, 0, false), K(8, 0, false), K(7)])).toBe(2);
    expect(runStart([K(9), K(7), K(6)])).toBe(1);
    expect(runStart([K(9, 1), K(8, 0), K(7, 0)])).toBe(1);
    expect(runStart([])).toBe(0);
    expect(runStart([K(5, 0, false)])).toBe(1);
  });
  it('only allows cards from the start of that run to the end', () => {
    const s = blank([[K(9, 0, false), K(8), K(7), K(5)], [K(4, 1), K(3, 1)], ...empty().slice(2)]);
    expect(canPickup(s, 0, 3)).toBe(true);
    expect(canPickup(s, 0, 2)).toBe(false);
    expect(canPickup(s, 0, 0)).toBe(false);
    expect(canPickup(s, 1, 0)).toBe(true);
    expect(canPickup(s, 1, 1)).toBe(true);
    expect(canPickup(s, 2, 0)).toBe(false);
    for (const bad of [-1, 99, 1.5, NaN]) expect(canPickup(s, 0, bad)).toBe(false);
    expect(canPickup(s, 12, 0)).toBe(false);
  });
  it('lets a run go onto a card one rank higher of any suit, or into an empty column, never onto its own column', () => {
    const s = blank([[K(6, 1)], [K(5)], [K(5, 1)], [K(7)], [], ...empty().slice(5)]);
    expect(canDrop(s, 1, 0, 0)).toBe(true); // 5 onto 6
    expect(canDrop(s, 2, 0, 0)).toBe(true); // any suit
    expect(canDrop(s, 3, 0, 0)).toBe(false); // 7 onto 6
    expect(canDrop(s, 1, 0, 3)).toBe(false); // 5 onto 7
    expect(canDrop(s, 1, 0, 4)).toBe(true); // empty column
    expect(canDrop(s, 1, 0, 1)).toBe(false);
    expect(canDrop(s, 4, 0, 0)).toBe(false); // nothing to pick up
    expect(canDrop(s, 1, 0, 99)).toBe(false);
    const faceDownTop = blank([[K(6, 0, false)], [K(5)], ...empty().slice(2)]);
    expect(canDrop(faceDownTop, 1, 0, 0)).toBe(false);
  });
});

describe('moves', () => {
  it('matches a naive enumeration of the rules on positions reached by random play', () => {
    const rng = mulberry32(2026);
    let checked = 0;
    for (const suits of SUIT_COUNTS) {
      for (let g = 0; g < 60; g++) {
        for (const s of randomPositions(100 + g, suits, 70, rng)) {
          const a = JSON.stringify(sortMoves(legalMoves(s)));
          const b = JSON.stringify(sortMoves(naiveMoves(s)));
          if (a !== b) throw new Error(`suits ${suits} seed ${100 + g}: engine ${a} vs naive ${b}`);
          const keys = new Set(naiveMoves(s).map((m) => `${m.from}:${m.index}:${m.to}`));
          for (let from = 0; from < COLUMNS; from++) {
            for (let to = 0; to < COLUMNS; to++) {
              for (let i = 0; i < s.tableau[from].length; i++) {
                if (canDrop(s, from, i, to) !== keys.has(`${from}:${i}:${to}`)) throw new Error(`canDrop disagrees at ${from}:${i}:${to}`);
              }
            }
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  }, 240_000);

  it('moves a run, turns over the card it uncovers, counts a move and leaves the old position alone', () => {
    const s = blank([[K(9, 1, false), K(4, 0)], [K(6, 1), K(5, 1)], ...empty().slice(2)]);
    const frozen = JSON.stringify(s);
    const o = move(s, 0, 1, 1) as NonNullable<ReturnType<typeof move>>;
    expect(JSON.stringify(s)).toBe(frozen);
    expect(o.state.tableau[1].map((c) => c.id)).toEqual([K(6, 1).id, K(5, 1).id, K(4, 0).id]);
    expect(o.state.tableau[0]).toEqual([K(9, 1, true)]);
    expect(o.flipped).toBe(true);
    expect(o.completed).toEqual([]);
    expect(o.state.moves).toBe(1);
    expect(move(s, 0, 0, 1)).toBeNull();
    expect(move(s, 1, 0, 1)).toBeNull();
  });
  it('removes a King-to-Ace run of one suit as soon as it is complete, and turns over what it uncovers', () => {
    const cols = empty();
    cols[0] = [K(7, 1, false), ...run(13, 2, 0)];
    cols[1] = [K(1, 0)];
    cols[2] = [K(5, 1)];
    const s = blank(cols);
    const o = move(s, 1, 0, 0) as NonNullable<ReturnType<typeof move>>;
    expect(o.completed).toEqual([{ col: 0, suit: 0 }]);
    expect(o.state.done).toEqual([0]);
    expect(o.state.tableau[0]).toEqual([K(7, 1, true)]);
    expect(o.state.tableau[1]).toEqual([]);
    expect(o.flipped).toBe(true);
  });
  it('does not remove a full run of mixed suits, nor one that is not King to Ace', () => {
    const cols = empty();
    cols[0] = [...run(13, 3, 0), K(2, 1)];
    cols[1] = [K(1, 0)];
    const s = blank(cols);
    const o = move(s, 1, 0, 0) as NonNullable<ReturnType<typeof move>>;
    expect(o.completed).toEqual([]);
    expect(o.state.done).toEqual([]);
    const partial = empty();
    partial[0] = run(12, 2, 0);
    partial[1] = [K(1, 0)];
    expect((move(blank(partial), 1, 0, 0) as NonNullable<ReturnType<typeof move>>).completed).toEqual([]);
  });
  it('wins when the eighth run is removed', () => {
    const cols = empty();
    cols[0] = run(13, 2, 0);
    cols[1] = [K(1, 0)];
    const s = blank(cols, { done: [0, 0, 0, 0, 0, 0, 0] });
    expect(isWon(s)).toBe(false);
    const o = move(s, 1, 0, 0) as NonNullable<ReturnType<typeof move>>;
    expect(o.state.done).toHaveLength(RUNS_TO_WIN);
    expect(isWon(o.state)).toBe(true);
  });
});

describe('dealing a row', () => {
  it('puts one face-up card on every column from the end of the stock, 10 at a time', () => {
    const s = deal(3, 1);
    const top = s.stock.slice(-10).reverse();
    const o = dealRow(s) as NonNullable<ReturnType<typeof dealRow>>;
    expect(o.state.stock).toHaveLength(40);
    expect(dealsLeft(o.state)).toBe(4);
    o.state.tableau.forEach((col, i) => {
      expect(col.length).toBe(s.tableau[i].length + 1);
      expect(col[col.length - 1]).toEqual({ id: top[i], up: true });
    });
    expect(o.state.moves).toBe(1);
    expect(s.stock).toHaveLength(50);
    expect(validateState(o.state)).toBeNull();
  });
  it('is blocked by an empty column or an empty stock', () => {
    const cols = empty().map(() => [K(5)]);
    cols[3] = [];
    const s = blank(cols, { stock: Array.from({ length: 10 }, () => cardId(0, 2)) });
    expect(hasEmptyColumn(s)).toBe(true);
    expect(dealBlock(s)).toBe('column');
    expect(dealRow(s)).toBeNull();
    expect(dealBlock(blank(empty().map(() => [K(5)])))).toBe('stock');
    expect(dealRow(blank(empty().map(() => [K(5)])))).toBeNull();
    expect(dealBlock(blank(empty().map(() => [K(5)]), { stock: Array.from({ length: 10 }, () => cardId(0, 2)) }))).toBeNull();
  });
  it('removes a run the deal completes', () => {
    const cols = empty().map(() => [K(9, 1)]);
    cols[0] = run(13, 2, 0);
    const stock = Array.from({ length: 10 }, () => cardId(1, 4));
    stock[stock.length - 1] = cardId(0, 1);
    const o = dealRow(blank(cols, { stock })) as NonNullable<ReturnType<typeof dealRow>>;
    expect(o.completed).toEqual([{ col: 0, suit: 0 }]);
    expect(o.state.tableau[0]).toEqual([]);
    expect(o.state.done).toEqual([0]);
  });
  it('gives the same result through the action wrapper', () => {
    const s = deal(4, 2);
    expect(applyAction(s, { k: 'deal' })?.state).toEqual(dealRow(s)?.state);
    const m = legalMoves(s)[0];
    if (m) expect(applyAction(s, { k: 'move', ...m })?.state).toEqual(move(s, m.from, m.index, m.to)?.state);
  });
});

describe('fuzz: random play never loses or invents a card', () => {
  it('plays 240 games of up to 400 random actions, validating every position', () => {
    const rng = mulberry32(31337);
    let positions = 0;
    for (let g = 0; g < 240; g++) {
      const suits = SUIT_COUNTS[g % 3];
      let s = deal(1 + g, suits);
      for (let i = 0; i < 400 && !isWon(s); i++) {
        const moves = legalMoves(s);
        const canDeal = !dealBlock(s);
        if (!moves.length && !canDeal) break;
        const before = JSON.stringify(s);
        let o;
        if (canDeal && (!moves.length || rng() < 0.1)) o = dealRow(s);
        else { const m = moves[Math.floor(rng() * moves.length)]; o = move(s, m.from, m.index, m.to); }
        expect(o).not.toBeNull();
        expect(JSON.stringify(s)).toBe(before);
        s = (o as NonNullable<typeof o>).state;
        const bad = validateState(s);
        if (bad) throw new Error(`suits ${suits} deal ${1 + g} step ${i}: ${bad}`);
        expect(s.moves).toBe(i + 1);
        positions++;
      }
    }
    expect(positions).toBeGreaterThan(20000);
  }, 240_000);
  it('refuses junk moves without changing anything', () => {
    const s = deal(8, 1);
    const frozen = JSON.stringify(s);
    for (const [a, b, c] of [[-1, 0, 1], [0, 99, 1], [0, 0, 0], [0, 0, 10], [NaN, 0, 1], [0, 1.5, 2], [11, 0, 1]]) expect(move(s, a, b, c), `${a},${b},${c}`).toBeNull();
    expect(JSON.stringify(s)).toBe(frozen);
  });
  it('catches a position with a missing or extra card', () => {
    const s = deal(2, 1);
    expect(validateState(s)).toBeNull();
    const missing = { ...s, tableau: s.tableau.map((c, i) => (i === 0 ? c.slice(1) : c)) };
    expect(validateState(missing)).not.toBeNull();
    const hidden = { ...s, tableau: s.tableau.map((c, i) => (i === 0 ? c.map((x, k) => (k === c.length - 1 ? { ...x, up: false } : x)) : c)) };
    expect(validateState(hidden)).toMatch(/top card is face down/);
    expect(validateState({ ...s, stock: s.stock.slice(1) })).not.toBeNull();
  });
});

describe('the hint', () => {
  it('prefers finishing a run, then turning a card over, and only suggests legal moves', () => {
    const cols = empty();
    cols[0] = [K(7, 1, false), ...run(13, 2, 0)];
    cols[1] = [K(1, 0)];
    cols[2] = [K(8, 1, false), K(5, 1)];
    cols[3] = [K(6, 1)];
    const h = hint(blank(cols));
    expect(h).toEqual({ kind: 'move', move: { from: 1, index: 0, to: 0 } });
    const cols2 = empty();
    cols2[0] = [K(9, 1, false), K(4, 0)];
    cols2[1] = [K(5, 1)];
    cols2[2] = [K(7, 3), K(6, 3)];
    expect(hint(blank(cols2))).toEqual({ kind: 'move', move: { from: 0, index: 1, to: 1 } });
  });
  it('suggests dealing when no move helps and a row can be dealt, and nothing when stuck', () => {
    const cols = empty().map((_, i) => [K(i < 5 ? 13 : 12, i % 2)]);
    const withStock = blank(cols, { stock: Array.from({ length: 10 }, () => cardId(0, 3)) });
    const h = hint(withStock);
    expect(['deal', 'move']).toContain(h.kind);
    const stuck = blank(empty().map(() => [K(13, 0)]));
    // Ten Kings: nothing can go anywhere except to an empty column (none) and nothing is left to deal.
    expect(hint(stuck)).toEqual({ kind: 'none' });
  });
  it('always returns a legal suggestion on real positions', () => {
    const rng = mulberry32(5);
    for (let g = 0; g < 40; g++) {
      for (const s of randomPositions(300 + g, SUIT_COUNTS[g % 3], 40, rng)) {
        const h = hint(s);
        if (h.kind === 'move') expect(canDrop(s, h.move.from, h.move.index, h.move.to)).toBe(true);
        if (h.kind === 'deal') expect(dealBlock(s)).toBeNull();
        if (h.kind === 'none') { expect(dealBlock(s)).not.toBeNull(); }
      }
    }
  }, 60_000);
  it('scores a run-finishing move above everything else', () => {
    const cols = empty();
    cols[0] = run(13, 2, 0);
    cols[1] = [K(1, 0)];
    cols[2] = [K(3, 1)];
    cols[3] = [K(2, 1)];
    const s = blank(cols);
    expect(moveScore(s, { from: 1, index: 0, to: 0 })).toBeGreaterThan(moveScore(s, { from: 3, index: 0, to: 2 }));
  });
});

describe('the solver', () => {
  /** Replay a returned line through the ordinary move functions and check that it really wins. */
  const replay = (start: SpiderState, line: Action[], validate = true): SpiderState => {
    let s = start;
    for (const a of line) {
      const o = applyAction(s, a);
      if (!o) throw new Error(`illegal action in the solver's line: ${JSON.stringify(a)}`);
      s = o.state;
      const bad = validate ? validateState(s) : null;
      if (bad) throw new Error(bad);
    }
    return s;
  };

  it('solves a position that is one move from a win', () => {
    const cols = empty();
    cols[0] = run(13, 2, 0);
    cols[1] = [K(1, 0)];
    const s = blank(cols, { done: [0, 0, 0, 0, 0, 0, 0] });
    const r = solve(s);
    expect(r.solved).toBe(true);
    expect(r.moves).toEqual([{ k: 'move', from: 1, index: 0, to: 0 }]);
    expect(isWon(replay(s, r.moves, false))).toBe(true);
  });
  it('reports a deal it cannot win, and stops at the node limit', () => {
    const cols = empty();
    cols[0] = [K(13, 0)];
    cols[1] = [K(13, 1)];
    const stuck = blank(cols, { suits: 2 });
    const r = solve(stuck, 5000);
    expect(r.solved).toBe(false);
    expect(r.exhausted).toBe(true);
    const big = solve(deal(7, 4), 50);
    expect(big.nodes).toBeLessThanOrEqual(50);
    expect(big.solved).toBe(false);
    expect(big.exhausted).toBe(false);
  });
  it('has winnable lists for 1 and 2 suits, each deal proved by replaying a full line through the move functions', () => {
    expect(WINNABLE[1]).toHaveLength(24);
    expect(WINNABLE[2]).toHaveLength(12);
    for (const suits of [1, 2] as const) {
      expect(new Set(WINNABLE[suits]).size).toBe(WINNABLE[suits].length);
      for (const seed of WINNABLE[suits]) {
        const start = deal(seed, suits);
        const r = solve(start, 30000);
        if (!r.solved) throw new Error(`${suits}-suit deal #${seed} was not solved in 30000 nodes (${r.nodes} used)`);
        const end = replay(start, r.moves);
        if (!isWon(end)) throw new Error(`${suits}-suit deal #${seed}: the line does not end in a win`);
        expect(end.done).toHaveLength(RUNS_TO_WIN);
      }
    }
  }, 280_000);
});

describe('stored results, setup and text', () => {
  it('reads junk safely', () => {
    const empty0 = { w1: 0, w2: 0, w4: 0, b1: 0, b2: 0, b4: 0 };
    expect(sanitizeStore(null)).toEqual(empty0);
    expect(sanitizeStore('x')).toEqual(empty0);
    expect(sanitizeStore([1])).toEqual(empty0);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"w1":5},"w1":-1,"w2":1.5,"w4":"3","b1":1e9,"b2":0}'))).toEqual(empty0);
    expect(sanitizeStore({ w1: 3, b1: 120, w4: 1, extra: 9 })).toEqual({ ...empty0, w1: 3, b1: 120, w4: 1 });
  });
  it('records wins, and a fewest-moves record only for an unaided win', () => {
    const s = sanitizeStore(null);
    let r = recordWin(s, 1, 150, false);
    expect(r.record).toBe(true);
    expect(r.store).toMatchObject({ w1: 1, b1: 150 });
    r = recordWin(r.store, 1, 200, false);
    expect(r.record).toBe(false);
    expect(r.store).toMatchObject({ w1: 2, b1: 150 });
    r = recordWin(r.store, 1, 100, true);
    expect(r.record).toBe(false);
    expect(r.store).toMatchObject({ w1: 3, b1: 150 });
    r = recordWin(r.store, 2, 300, false);
    expect(r.store).toMatchObject({ w2: 1, b2: 300, w1: 3 });
    expect(recordWin(s, 1, NaN, false).record).toBe(false);
    expect(recordWin(s, 4, 0, false).record).toBe(false);
  });
  it('clamps junk URL parameters', () => {
    expect(parseSetup({}, 9)).toEqual({ suits: 1, seed: 9 });
    expect(parseSetup({ u: '4', s: '123' }, 1)).toEqual({ suits: 4, seed: 123 });
    for (const u of ['0', '3', '5', 'x', '', '2.5']) expect(parseSetup({ u }, 1).suits, u).toBe(1);
    expect(parseSetup({ u: '2' }, 1).suits).toBe(2);
    for (const s of ['0', 'abc', '4294967296', '1.5', '', '-9']) expect(parseSetup({ s }, 7).seed, s).toBe(7);
    expect(clampSuits(2)).toBe(2);
    expect(clampSuits('2')).toBe(1);
  });
  it('words things correctly', () => {
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(2, 'suit')).toBe('2 suits');
    expect(describeRun([K(9)])).toBe('9 of spades');
    expect(describeRun([K(9), K(8)])).toBe('9 of spades and 1 card below it');
    expect(describeRun([K(9), K(8), K(7)])).toBe('9 of spades and 2 cards below it');
    expect(dealAnnouncement(12, 2)).toBe('Deal #12, 2 suits. Ten columns dealt, 5 rows in the stock.');
    expect(dealAnnouncement(12, 1)).toBe('Deal #12, 1 suit. Ten columns dealt, 5 rows in the stock.');
    expect(shareText(deal(5, 2))).toBe('Spider Solitaire deal #5 (2 suits) - unfinished, 0 of 8 runs, 0 moves');
    expect(shareText({ ...deal(5, 1), done: [0, 0, 0, 0, 0, 0, 0, 0], moves: 211 })).toBe('Spider Solitaire deal #5 (1 suit) - won in 211 moves');
  });
});

describe('the page', () => {
  it('has the shell events, a live region, sound off by default and reduced motion', () => {
    expect(src).toMatch(/id="spdr-app"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/app:copy/);
    expect(src).toMatch(/app:export/);
    expect(src).toMatch(/app:reset/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/aria-pressed="false"/);
  });
});
