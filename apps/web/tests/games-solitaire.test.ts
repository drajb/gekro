/**
 * games-solitaire.test.ts - the engine behind `solitaire`.
 *
 * Pinned: the deal layout (28 tableau cards, 24 stock, one face-up card per column),
 * every legality rule, runs moving as units, automatic flipping, stock and waste
 * cycling in draw 1 and draw 3, auto-complete, determinism for a deal number, and a
 * random-play fuzz proving card conservation and that no illegal state is reachable.
 */
import { describe, it, expect } from 'vitest';
import {
  deal, emptyState, cardId, cardName, cardLabel, rankOf, suitOf, isRed, isRun, cardsAt, canMoveToTableau, canMoveToFoundation,
  applyMove, autoToFoundation, drawFromStock, legalMoves, isWon, canAutoComplete, autoCompleteStep, autoCompleteAll, validateState,
  foundationCount, mulberry32, shuffled, deckFor, formatTime, SUIT_CHARS, RANK_LABELS, COLUMNS,
  sameCardRun, dealAnnouncement, dropPile,
  type Card, type GameState, type Move, type Source, type Draw,
} from '../src/components/apps-private/solitaire/helpers';
import calculatorSource from '../src/components/apps-private/solitaire/Calculator.astro?raw';

// ── helpers for building positions ──────────────────────────────────────────

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** 'KS' = King of spades, '10H' = ten of hearts. Face up unless `up` is false. */
const c = (code: string, up = true): Card => {
  const suit = SUIT_OF[code.slice(-1)];
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return { id: cardId(suit, rank), up };
};
const cs = (...codes: string[]): Card[] => codes.map((x) => c(x));
const ids = (pile: Card[]): number[] => pile.map((x) => x.id);
const allIds = (s: GameState): number[] =>
  [...s.tableau.flat(), ...s.foundations.flat(), ...s.stock, ...s.waste].map((x) => x.id);
const snapshot = (s: GameState): string => JSON.stringify(s);
const tab = (col: number, index: number): Source => ({ kind: 'tableau', col, index });
const toTab = (col: number): Move['to'] => ({ kind: 'tableau', col });
const toFound = (pile: number): Move['to'] => ({ kind: 'foundation', pile });
const WASTE: Source = { kind: 'waste' };

/** A won position: every suit built Ace to King. */
const wonState = (): GameState => {
  const s = emptyState();
  for (let suit = 0; suit < 4; suit++) for (let r = 1; r <= 13; r++) s.foundations[suit].push({ id: cardId(suit, r), up: true });
  return s;
};

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards', () => {
  it('maps ids to suit and rank and back', () => {
    for (let id = 0; id < 52; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
    expect(rankOf(0)).toBe(1);
    expect(rankOf(12)).toBe(13);
    expect(suitOf(13)).toBe(1);
    expect(suitOf(51)).toBe(3);
  });
  it('colours hearts and diamonds red and spades and clubs black', () => {
    expect([0, 1, 2, 3].map((s) => isRed(cardId(s, 5)))).toEqual([false, true, true, false]);
  });
  it('uses text-presentation suit characters and plain-language names', () => {
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(cardLabel(c('10H').id)).toBe('10♥︎');
    expect(cardName(c('KS').id)).toBe('King of spades');
    expect(cardName(c('AD').id)).toBe('Ace of diamonds');
  });
});

// ── the deal ─────────────────────────────────────────────────────────────────

describe('deal', () => {
  it('lays out 7 columns of 1..7 cards, a 24-card stock, an empty waste and empty foundations', () => {
    const s = deal(12345);
    expect(s.tableau).toHaveLength(7);
    expect(s.tableau.map((col) => col.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.tableau.flat()).toHaveLength(28);
    expect(s.stock).toHaveLength(24);
    expect(s.waste).toHaveLength(0);
    expect(s.foundations.map((f) => f.length)).toEqual([0, 0, 0, 0]);
    expect(s.moves).toBe(0);
  });
  it('turns up only the last card of each column and keeps the whole stock face down', () => {
    const s = deal(777);
    s.tableau.forEach((col) => {
      col.forEach((card, i) => expect(card.up).toBe(i === col.length - 1));
    });
    expect(s.stock.every((x) => !x.up)).toBe(true);
  });
  it('uses all 52 distinct cards exactly once and passes validation', () => {
    for (const seed of [1, 2, 3, 99, 4294967295]) {
      const s = deal(seed);
      expect([...allIds(s)].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i));
      expect(validateState(s)).toBeNull();
    }
  });
  it('is deterministic for a deal number and different across numbers', () => {
    expect(snapshot(deal(42))).toBe(snapshot(deal(42)));
    expect(ids(deal(42).stock)).not.toEqual(ids(deal(43).stock));
    const layouts = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) layouts.add(deckFor(seed).join(','));
    expect(layouts.size).toBe(200);
  });
  it('gives the same cards for draw 1 and draw 3, only the setting differs', () => {
    const a = deal(5, 1);
    const b = deal(5, 3);
    expect(a.draw).toBe(1);
    expect(b.draw).toBe(3);
    expect(allIds(a)).toEqual(allIds(b));
  });
  it('the shuffle is a permutation and does not change its input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const out = shuffled(src, mulberry32(3));
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('deals reasonably evenly: each position sees a spread of cards across many deals', () => {
    // A weak sanity check that the shuffle is not biased towards one card in the first slot.
    const firstSeen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) firstSeen.add(deal(seed).tableau[0][0].id);
    expect(firstSeen.size).toBeGreaterThan(30);
  });
});

// ── runs ─────────────────────────────────────────────────────────────────────

describe('runs', () => {
  it('accepts descending alternating colours and rejects anything else', () => {
    expect(isRun(cs('KS', 'QH', 'JC'))).toBe(true);
    expect(isRun(cs('5H'))).toBe(true);
    expect(isRun(cs('KS', 'QC'))).toBe(false); // same colour
    expect(isRun(cs('KS', 'JH'))).toBe(false); // skips a rank
    expect(isRun(cs('QH', 'KS'))).toBe(false); // ascending
    expect(isRun([c('KS'), c('QH', false)])).toBe(false); // face down inside
    expect(isRun([])).toBe(false);
  });
  it('cardsAt returns the run from the chosen index to the end of the column', () => {
    const s = emptyState();
    s.tableau[0] = [c('9C', false), c('KS'), c('QH'), c('JS')];
    expect(cardsAt(s, tab(0, 1))!.map((x) => x.id)).toEqual(ids(cs('KS', 'QH', 'JS')));
    expect(cardsAt(s, tab(0, 3))!.map((x) => x.id)).toEqual(ids(cs('JS')));
    expect(cardsAt(s, tab(0, 0))).toBeNull(); // face down
    expect(cardsAt(s, tab(0, 4))).toBeNull(); // past the end
    expect(cardsAt(s, tab(0, -1))).toBeNull();
    expect(cardsAt(s, tab(9, 0))).toBeNull(); // no such column
    expect(cardsAt(s, WASTE)).toBeNull(); // empty waste
    expect(cardsAt(s, { kind: 'foundation', pile: 0 })).toBeNull();
  });
});

// ── tableau rules ────────────────────────────────────────────────────────────

describe('canMoveToTableau', () => {
  it('allows a card one rank lower and the opposite colour', () => {
    const s = emptyState();
    s.tableau[0] = cs('7S');
    s.tableau[1] = cs('6H');
    s.tableau[2] = cs('6D');
    s.tableau[3] = cs('6C');
    expect(canMoveToTableau(s, tab(1, 0), 0)).toBe(true); // 6H on 7S
    expect(canMoveToTableau(s, tab(2, 0), 0)).toBe(true); // 6D on 7S
    expect(canMoveToTableau(s, tab(3, 0), 0)).toBe(false); // 6C on 7S: same colour
  });
  it('rejects the wrong rank in either direction', () => {
    const s = emptyState();
    s.tableau[0] = cs('7S');
    s.tableau[1] = cs('5H');
    s.tableau[2] = cs('8H');
    expect(canMoveToTableau(s, tab(1, 0), 0)).toBe(false); // too low
    expect(canMoveToTableau(s, tab(2, 0), 0)).toBe(false); // too high
  });
  it('lets only a King, or a run starting with a King, go to an empty column', () => {
    const s = emptyState();
    s.tableau[0] = cs('KH', 'QS', 'JH');
    s.tableau[1] = cs('QD');
    s.tableau[2] = cs('2C');
    expect(canMoveToTableau(s, tab(0, 0), 3)).toBe(true); // whole run from the King
    expect(canMoveToTableau(s, tab(0, 1), 3)).toBe(false); // run starts with a Queen
    expect(canMoveToTableau(s, tab(1, 0), 3)).toBe(false); // lone Queen
    expect(canMoveToTableau(s, tab(2, 0), 3)).toBe(false); // lone two
    s.waste = cs('KC');
    expect(canMoveToTableau(s, WASTE, 3)).toBe(true); // a King from the waste
  });
  it('does not allow a move onto the same column or a column that does not exist', () => {
    const s = emptyState();
    s.tableau[0] = cs('7S', '6H');
    expect(canMoveToTableau(s, tab(0, 1), 0)).toBe(false);
    expect(canMoveToTableau(s, tab(0, 1), 7)).toBe(false);
    expect(canMoveToTableau(s, tab(0, 1), -1)).toBe(false);
    expect(canMoveToTableau(s, tab(0, 1), 1.5)).toBe(false);
  });
  it('moves the whole run when its first card fits and refuses when only a lower card fits', () => {
    const s = emptyState();
    s.tableau[0] = cs('8S');
    s.tableau[1] = cs('7H', '6S', '5H');
    expect(canMoveToTableau(s, tab(1, 0), 0)).toBe(true); // 7H on 8S, bringing 6S 5H
    expect(canMoveToTableau(s, tab(1, 1), 0)).toBe(false); // 6S would need a red 7
  });
  it('accepts waste and foundation cards as sources', () => {
    const s = emptyState();
    s.tableau[0] = cs('6S');
    s.waste = cs('KD', '5H');
    s.foundations[1] = cs('AH', '2H', '3H', '4H'); // hearts up to 4
    s.tableau[1] = cs('5C');
    expect(canMoveToTableau(s, WASTE, 0)).toBe(true); // 5H on 6S
    expect(canMoveToTableau(s, { kind: 'foundation', pile: 1 }, 1)).toBe(true); // 4H on 5C
  });
  it('refuses to build on a face-down card', () => {
    const s = emptyState();
    s.tableau[0] = [c('7S', false)];
    s.tableau[1] = cs('6H');
    expect(canMoveToTableau(s, tab(1, 0), 0)).toBe(false);
  });
});

// ── foundation rules ─────────────────────────────────────────────────────────

describe('canMoveToFoundation', () => {
  it('starts a pile with an Ace and builds the same suit upwards', () => {
    const s = emptyState();
    s.tableau[0] = cs('AS');
    s.tableau[1] = cs('2S');
    s.tableau[2] = cs('2H');
    expect(canMoveToFoundation(s, tab(0, 0))).toBe(true);
    expect(canMoveToFoundation(s, tab(1, 0))).toBe(false); // 2 before the Ace
    s.foundations[0] = cs('AS');
    expect(canMoveToFoundation(s, tab(1, 0))).toBe(true);
    expect(canMoveToFoundation(s, tab(2, 0))).toBe(false); // wrong suit for the next slot
  });
  it('refuses a rank that skips ahead and a card that is already placed', () => {
    const s = emptyState();
    s.foundations[0] = cs('AS', '2S');
    s.tableau[0] = cs('4S');
    s.tableau[1] = cs('2S');
    expect(canMoveToFoundation(s, tab(0, 0))).toBe(false);
    expect(canMoveToFoundation(s, tab(1, 0))).toBe(false); // already there (rank must be exactly 3)
  });
  it('refuses the wrong pile for a card', () => {
    const s = emptyState();
    s.tableau[0] = cs('AH');
    expect(canMoveToFoundation(s, tab(0, 0), 1)).toBe(true);
    expect(canMoveToFoundation(s, tab(0, 0), 0)).toBe(false);
    expect(canMoveToFoundation(s, tab(0, 0), 4)).toBe(false);
    expect(canMoveToFoundation(s, tab(0, 0), -1)).toBe(false);
  });
  it('takes only a single card, never a run, and never from another foundation', () => {
    const s = emptyState();
    s.tableau[0] = cs('2S', 'AH'); // AH is the last card, so only it can go
    s.foundations[0] = cs('AS');
    expect(canMoveToFoundation(s, tab(0, 0))).toBe(false); // would move a 2-card run
    expect(canMoveToFoundation(s, tab(0, 1))).toBe(true);
    expect(canMoveToFoundation(s, { kind: 'foundation', pile: 0 })).toBe(false);
  });
  it('accepts the waste top and builds all the way to the King', () => {
    let s = emptyState();
    s.waste = cs('AC');
    expect(canMoveToFoundation(s, WASTE)).toBe(true);
    s = emptyState();
    for (let r = 1; r <= 12; r++) s.foundations[3].push({ id: cardId(3, r), up: true });
    s.waste = cs('KC');
    expect(canMoveToFoundation(s, WASTE)).toBe(true);
    s.foundations[3].push({ id: cardId(3, 13), up: true });
    s.waste = [];
    expect(canMoveToFoundation(s, WASTE)).toBe(false); // nothing left to move
  });
});

// ── applying moves ───────────────────────────────────────────────────────────

describe('applyMove', () => {
  it('returns null for an illegal move and leaves the input alone', () => {
    const s = emptyState();
    s.tableau[0] = cs('7S');
    s.tableau[1] = cs('6C');
    const before = snapshot(s);
    expect(applyMove(s, { from: tab(1, 0), to: toTab(0) })).toBeNull();
    expect(applyMove(s, { from: tab(1, 0), to: toFound(3) })).toBeNull();
    expect(snapshot(s)).toBe(before);
  });
  it('moves a run as a unit, in order, and counts one move', () => {
    const s = emptyState();
    s.tableau[0] = cs('8S');
    s.tableau[1] = [c('2D', false), ...cs('7H', '6S', '5H')];
    const next = applyMove(s, { from: tab(1, 1), to: toTab(0) })!;
    expect(ids(next.tableau[0])).toEqual(ids(cs('8S', '7H', '6S', '5H')));
    expect(next.tableau[1]).toHaveLength(1);
    expect(next.moves).toBe(1);
  });
  it('turns over the exposed face-down card automatically', () => {
    const s = emptyState();
    s.tableau[0] = cs('8S');
    s.tableau[1] = [c('2D', false), c('3C', false), ...cs('7H')];
    const next = applyMove(s, { from: tab(1, 2), to: toTab(0) })!;
    expect(next.tableau[1].map((x) => x.up)).toEqual([false, true]);
    expect(next.tableau[1][1].id).toBe(c('3C').id);
  });
  it('does not flip anything when the cards left behind are already face up', () => {
    const s = emptyState();
    s.tableau[0] = cs('8S');
    s.tableau[1] = [c('2D', false), ...cs('9C', '7H')];
    // 9C 7H is not a run, so 7H alone is the top card; moving it exposes 9C, already up.
    const next = applyMove(s, { from: tab(1, 2), to: toTab(0) })!;
    expect(next.tableau[1].map((x) => x.up)).toEqual([false, true]);
  });
  it('empties a column and lets a King take it', () => {
    const s = emptyState();
    s.tableau[0] = cs('KS');
    const next = applyMove(s, { from: tab(0, 0), to: toTab(4) })!;
    expect(next.tableau[0]).toHaveLength(0);
    expect(ids(next.tableau[4])).toEqual(ids(cs('KS')));
  });
  it('moves a waste card and removes it from the waste', () => {
    const s = emptyState();
    s.tableau[0] = cs('7S');
    s.waste = cs('9D', '6H');
    const a = applyMove(s, { from: WASTE, to: toTab(0) })!;
    expect(ids(a.waste)).toEqual(ids(cs('9D')));
    expect(ids(a.tableau[0])).toEqual(ids(cs('7S', '6H')));
  });
  it('can take a card back from a foundation, refusing 5H on 6H but accepting 5H on 6S', () => {
    const s = emptyState();
    s.tableau[0] = cs('6H');
    s.tableau[1] = cs('6S');
    s.foundations[1] = cs('AH', '2H', '3H', '4H', '5H');
    expect(applyMove(s, { from: { kind: 'foundation', pile: 1 }, to: toTab(0) })).toBeNull();
    const ok = applyMove(s, { from: { kind: 'foundation', pile: 1 }, to: toTab(1) })!;
    expect(ok.foundations[1]).toHaveLength(4);
    expect(ids(ok.tableau[1])).toEqual(ids(cs('6S', '5H')));
  });
  it('sends a card to the foundation and flips what it uncovers', () => {
    const s = emptyState();
    s.tableau[2] = [c('9C', false), ...cs('AD')];
    const next = applyMove(s, { from: tab(2, 1), to: toFound(2) })!;
    expect(next.foundations[2]).toHaveLength(1);
    expect(next.tableau[2][0].up).toBe(true);
  });
  it('never mutates the state it was given (undo round trip)', () => {
    const s = deal(2026);
    const before = snapshot(s);
    const rng = mulberry32(2026);
    let cur = s;
    const history: { state: GameState; snap: string }[] = [];
    for (let i = 0; i < 40; i++) {
      const moves = legalMoves(cur);
      const next = moves.length && rng() < 0.7 ? applyMove(cur, moves[Math.floor(rng() * moves.length)]) : drawFromStock(cur);
      if (!next) continue;
      history.push({ state: cur, snap: snapshot(cur) });
      cur = next;
    }
    expect(history.length).toBeGreaterThan(10);
    // Undo is "go back to the saved state": every saved state is exactly what it was when saved.
    while (history.length) {
      const prev = history.pop()!;
      expect(snapshot(prev.state)).toBe(prev.snap);
      cur = prev.state;
    }
    expect(snapshot(cur)).toBe(before);
    expect(cur.moves).toBe(0);
  });
});

// ── auto to foundation ──────────────────────────────────────────────────────

describe('autoToFoundation', () => {
  it('sends a legal top card to its own suit pile', () => {
    const s = emptyState();
    s.tableau[0] = cs('AC');
    const next = autoToFoundation(s, tab(0, 0))!;
    expect(ids(next.foundations[3])).toEqual(ids(cs('AC')));
  });
  it('works from the waste', () => {
    const s = emptyState();
    s.waste = cs('AH');
    expect(autoToFoundation(s, WASTE)!.foundations[1]).toHaveLength(1);
  });
  it('returns null when the card cannot go yet', () => {
    const s = emptyState();
    s.tableau[0] = cs('2C');
    expect(autoToFoundation(s, tab(0, 0))).toBeNull();
    expect(autoToFoundation(s, WASTE)).toBeNull();
  });
});

// ── stock and waste ──────────────────────────────────────────────────────────

const stockOf = (n: number): Card[] => Array.from({ length: n }, (_, i) => ({ id: i, up: false }));

describe('drawFromStock, draw 1', () => {
  it('turns one card at a time onto the waste, face up, last card of the stock first', () => {
    let s = emptyState(1);
    s.stock = stockOf(3); // ids 0,1,2; id 2 is on top
    s = drawFromStock(s)!;
    expect(ids(s.waste)).toEqual([2]);
    expect(s.waste[0].up).toBe(true);
    expect(s.stock).toHaveLength(2);
    s = drawFromStock(s)!;
    expect(ids(s.waste)).toEqual([2, 1]);
    expect(s.moves).toBe(2);
  });
  it('recycles the waste when the stock is empty, in the original order, with unlimited passes', () => {
    let s = emptyState(1);
    s.stock = stockOf(3);
    const original = ids(s.stock);
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < 3; i++) s = drawFromStock(s)!;
      expect(s.stock).toHaveLength(0);
      expect(s.waste).toHaveLength(3);
      s = drawFromStock(s)!; // the recycle
      expect(s.waste).toHaveLength(0);
      expect(ids(s.stock)).toEqual(original);
      expect(s.stock.every((x) => !x.up)).toBe(true);
    }
  });
  it('returns null when both stock and waste are empty', () => {
    expect(drawFromStock(emptyState())).toBeNull();
  });
  it('does not mutate its input', () => {
    const s = emptyState(1);
    s.stock = stockOf(5);
    const before = snapshot(s);
    drawFromStock(s);
    expect(snapshot(s)).toBe(before);
  });
});

describe('drawFromStock, draw 3', () => {
  it('turns three cards at once, the third being the playable top', () => {
    let s = emptyState(3);
    s.stock = stockOf(24);
    s = drawFromStock(s)!;
    expect(ids(s.waste)).toEqual([23, 22, 21]);
    expect(s.waste.every((x) => x.up)).toBe(true);
    expect(s.stock).toHaveLength(21);
    expect(s.moves).toBe(1);
  });
  it('turns only what is left at the end of the stock (2 cards, then 1)', () => {
    let s = emptyState(3);
    s.stock = stockOf(2);
    s = drawFromStock(s)!;
    expect(ids(s.waste)).toEqual([1, 0]);
    expect(s.stock).toHaveLength(0);
    let t = emptyState(3);
    t.stock = stockOf(4);
    t = drawFromStock(t)!; // 3
    expect(t.stock).toHaveLength(1);
    t = drawFromStock(t)!; // the last single card
    expect(t.stock).toHaveLength(0);
    expect(t.waste).toHaveLength(4);
    expect(ids(t.waste)).toEqual([3, 2, 1, 0]);
  });
  it('takes eight turns to run through a full 24-card stock, then recycles', () => {
    let s = deal(8, 3);
    for (let i = 0; i < 8; i++) {
      expect(s.stock.length).toBe(24 - 3 * i);
      s = drawFromStock(s)!;
    }
    expect(s.stock).toHaveLength(0);
    expect(s.waste).toHaveLength(24);
    s = drawFromStock(s)!;
    expect(s.stock).toHaveLength(24);
    expect(s.waste).toHaveLength(0);
    expect(validateState(s)).toBeNull();
  });
  it('recycling in draw 3 restores the stock to its original order', () => {
    const start = deal(31, 3);
    let s = start;
    while (s.stock.length) s = drawFromStock(s)!;
    s = drawFromStock(s)!;
    expect(ids(s.stock)).toEqual(ids(start.stock));
  });
  it('after playing the waste top, the card beneath becomes the top', () => {
    const s = emptyState(3);
    s.stock = stockOf(3);
    s.tableau[0] = cs('3S');
    const drawn = drawFromStock(s)!;
    // waste is [2,1,0]: the top is id 0 (Ace of spades)
    const next = applyMove(drawn, { from: WASTE, to: toFound(0) })!;
    expect(next.foundations[0]).toHaveLength(1);
    expect(ids(next.waste)).toEqual([2, 1]);
  });
});

// ── winning and auto-complete ───────────────────────────────────────────────

describe('isWon', () => {
  it('is true only when all four foundations hold 13 cards', () => {
    expect(isWon(wonState())).toBe(true);
    const almost = wonState();
    const king = almost.foundations[2].pop() as Card;
    expect(isWon(almost)).toBe(false);
    almost.tableau[0] = [king];
    expect(isWon(almost)).toBe(false);
    expect(isWon(deal(1))).toBe(false);
    expect(foundationCount(wonState())).toBe(52);
  });
  it('is reached by playing the last card', () => {
    const s = wonState();
    const king = s.foundations[1].pop() as Card;
    s.waste = [king];
    const next = applyMove(s, { from: WASTE, to: toFound(1) })!;
    expect(isWon(next)).toBe(true);
    expect(validateState(next)).toBeNull();
  });
});

/** Four full columns, each a King-to-Ace alternating run, one per suit. */
const sortedColumns = (): GameState => {
  const s = emptyState();
  const colA: Card[] = []; // K spades, Q hearts, J spades, ...
  const colB: Card[] = []; // K hearts, Q spades, ...
  const colC: Card[] = []; // K diamonds, Q clubs, ...
  const colD: Card[] = []; // K clubs, Q diamonds, ...
  for (let r = 13; r >= 1; r--) {
    const even = (13 - r) % 2 === 0;
    colA.push({ id: cardId(even ? 0 : 1, r), up: true });
    colB.push({ id: cardId(even ? 1 : 0, r), up: true });
    colC.push({ id: cardId(even ? 2 : 3, r), up: true });
    colD.push({ id: cardId(even ? 3 : 2, r), up: true });
  }
  s.tableau[0] = colA; s.tableau[1] = colB; s.tableau[2] = colC; s.tableau[3] = colD;
  return s;
};

describe('auto-complete', () => {
  it('is not offered while any card is face down or the stock still has cards', () => {
    expect(canAutoComplete(deal(1))).toBe(false);
    const s = sortedColumns();
    expect(canAutoComplete(s)).toBe(true);
    const down = sortedColumns();
    down.tableau[0][0] = { ...down.tableau[0][0], up: false };
    expect(canAutoComplete(down)).toBe(false);
    const withStock = sortedColumns();
    withStock.stock = [{ id: 0, up: false }]; // only the stock check matters here, not card conservation
    expect(canAutoComplete(withStock)).toBe(false);
  });
  it('is not offered once the game is already won', () => {
    expect(canAutoComplete(wonState())).toBe(false);
  });
  it('plays every card of four sorted columns to the foundations', () => {
    const s = sortedColumns();
    expect(validateState(s)).toBeNull();
    const end = autoCompleteAll(s);
    expect(isWon(end)).toBe(true);
    expect(validateState(end)).toBeNull();
    expect(end.moves).toBe(52);
  });
  it('takes the foundation move first and one stock turn only when it must', () => {
    const s = sortedColumns();
    expect(autoCompleteStep(s)!.kind).toBe('foundation');
    // With nothing playable and only the waste left, the step turns the waste back over.
    const t = emptyState();
    t.waste = cs('AS', 'KH');
    const first = autoCompleteStep(t)!;
    expect(first.kind).toBe('draw');
    expect(first.state.stock).toHaveLength(2);
    expect(first.state.waste).toHaveLength(0);
    expect(autoCompleteStep(emptyState())).toBeNull();
  });
  it('finishes when the aces are buried in the waste, cycling through it', () => {
    const s = emptyState(3);
    // spades: A at the bottom of the waste, then the rest on top in reverse order, so it must recycle
    const waste: Card[] = [];
    for (let r = 1; r <= 13; r++) waste.push({ id: cardId(0, r), up: true });
    s.waste = waste; // waste[0] = Ace at the bottom, the King on top
    for (let suit = 1; suit < 4; suit++) for (let r = 1; r <= 13; r++) s.foundations[suit].push({ id: cardId(suit, r), up: true });
    expect(validateState(s)).toBeNull();
    expect(canAutoComplete(s)).toBe(true);
    const end = autoCompleteAll(s);
    expect(isWon(end)).toBe(true);
  });
  it('is true on any all-face-up layout reached by working backwards from a win, and always finishes', { timeout: 60000 }, () => {
    const rng = mulberry32(20261022);
    let finished = 0;
    for (let game = 0; game < 40; game++) {
      const draw: Draw = game % 2 ? 3 : 1;
      let s = wonState();
      s.draw = draw;
      // Walk away from the finished position with random legal moves, preferring to pull cards off the foundations.
      for (let step = 0; step < 220; step++) {
        const moves = legalMoves(s);
        if (!moves.length) break;
        const fromFound = moves.filter((m) => m.from.kind === 'foundation');
        const pool = fromFound.length && rng() < 0.55 ? fromFound : moves;
        s = applyMove(s, pool[Math.floor(rng() * pool.length)])!;
        expect(validateState(s)).toBeNull();
      }
      // Optionally push a few column tops into the waste so the waste is exercised too.
      if (game % 3 === 0) {
        for (let k = 0; k < 4; k++) {
          const col = s.tableau.findIndex((x) => x.length > 0);
          if (col < 0) break;
          const card = s.tableau[col][s.tableau[col].length - 1];
          s = { ...s, tableau: s.tableau.map((x, i) => (i === col ? x.slice(0, -1) : x)), waste: [...s.waste, card] };
        }
        expect(validateState(s)).toBeNull();
      }
      expect(canAutoComplete(s) || isWon(s)).toBe(true);
      const end = autoCompleteAll(s);
      expect(isWon(end), `game ${game}`).toBe(true);
      expect(validateState(end)).toBeNull();
      finished++;
    }
    expect(finished).toBe(40);
  });
});

// ── legalMoves agrees with the rules ────────────────────────────────────────

describe('legalMoves', () => {
  it('every listed move applies and every applied move is listed', { timeout: 60000 }, () => {
    for (const seed of [3, 4, 5]) {
      let s = deal(seed);
      const rng = mulberry32(seed);
      for (let step = 0; step < 80; step++) {
        const moves = legalMoves(s);
        const listed = new Set(moves.map((m) => JSON.stringify(m)));
        for (const m of moves) expect(applyMove(s, m)).not.toBeNull();
        // Probe random candidate moves: they apply exactly when they are listed.
        for (let probe = 0; probe < 25; probe++) {
          const srcs: Source[] = [WASTE, { kind: 'foundation', pile: Math.floor(rng() * 4) }, tab(Math.floor(rng() * 7), Math.floor(rng() * 8))];
          const from = srcs[Math.floor(rng() * srcs.length)];
          const to: Move['to'] = rng() < 0.5 ? toTab(Math.floor(rng() * 7)) : toFound(Math.floor(rng() * 4));
          const m: Move = { from, to };
          expect(applyMove(s, m) !== null, JSON.stringify(m)).toBe(listed.has(JSON.stringify(m)));
        }
        const next = moves.length && rng() < 0.7 ? applyMove(s, moves[Math.floor(rng() * moves.length)]) : drawFromStock(s);
        if (next) s = next;
      }
    }
  });
});

// ── fuzz: random legal play never breaks the rules ──────────────────────────

describe('fuzz', () => {
  it('keeps exactly 52 unique cards and a legal position through thousands of random moves', { timeout: 60000 }, () => {
    let totalMoves = 0;
    let totalFoundationCards = 0;
    let flips = 0;
    for (let game = 1; game <= 60; game++) {
      const draw: Draw = game % 2 ? 1 : 3;
      let s = deal(game * 7919, draw);
      const rng = mulberry32(game);
      expect(validateState(s)).toBeNull();
      for (let step = 0; step < 350; step++) {
        const moves = legalMoves(s);
        const toFoundation = moves.filter((m) => m.to.kind === 'foundation');
        let next: GameState | null;
        const roll = rng();
        if (toFoundation.length && roll < 0.4) next = applyMove(s, toFoundation[Math.floor(rng() * toFoundation.length)]);
        else if (moves.length && roll < 0.8) next = applyMove(s, moves[Math.floor(rng() * moves.length)]);
        else next = drawFromStock(s);
        if (!next) next = drawFromStock(s);
        if (!next) break;
        const downBefore = s.tableau.flat().filter((x) => !x.up).length;
        const downAfter = next.tableau.flat().filter((x) => !x.up).length;
        if (downAfter < downBefore) flips++;
        s = next;
        totalMoves++;
        const problem = validateState(s);
        expect(problem, `game ${game} step ${step}`).toBeNull();
        expect(allIds(s)).toHaveLength(52);
        expect(new Set(allIds(s)).size).toBe(52);
      }
      totalFoundationCards += foundationCount(s);
    }
    // The fuzz must actually have explored: moves were made, cards were turned over, cards reached the foundations.
    expect(totalMoves).toBeGreaterThan(5000);
    expect(flips).toBeGreaterThan(50);
    expect(totalFoundationCards).toBeGreaterThan(20);
  });
  it('rejects illegal moves chosen at random without changing anything', { timeout: 60000 }, () => {
    const rng = mulberry32(5150);
    const s = deal(555);
    const before = snapshot(s);
    let rejected = 0;
    for (let i = 0; i < 400; i++) {
      const from: Source = rng() < 0.3 ? WASTE : tab(Math.floor(rng() * 9) - 1, Math.floor(rng() * 9) - 1);
      const to: Move['to'] = rng() < 0.5 ? toTab(Math.floor(rng() * 9) - 1) : toFound(Math.floor(rng() * 6) - 1);
      const m: Move = { from, to };
      const legal = legalMoves(s).some((x) => JSON.stringify(x) === JSON.stringify(m));
      const out = applyMove(s, m);
      expect(out !== null).toBe(legal);
      if (!out) rejected++;
    }
    expect(rejected).toBeGreaterThan(300);
    expect(snapshot(s)).toBe(before);
  });
});

// ── page hooks: deal announcement, drop recheck, column height ──────────────

describe('deal announcement', () => {
  it('always counts the 24 stock cards of the new deal, whatever game it replaces', () => {
    for (const draw of [1, 3] as const) {
      for (const seed of [1, 777, 999999]) {
        const text = dealAnnouncement(seed, draw);
        expect(text).toBe(`Deal #${seed}, Draw ${draw}. Seven columns dealt, 24 cards in the stock.`);
      }
    }
  });
  it('reads the stock from the deal itself, not from a played-down game', () => {
    const played = drawFromStock(deal(5))!; // stock is now 23
    expect(played.stock).toHaveLength(23);
    expect(dealAnnouncement(played.seed, played.draw)).toContain('24 cards');
  });
});

describe('sameCardRun (drop recheck)', () => {
  it('matches the same cards in the same order only', () => {
    const run = cs('KS', 'QH', 'JS');
    expect(sameCardRun(run, cs('KS', 'QH', 'JS'))).toBe(true);
    expect(sameCardRun(run, cs('KS', 'QH'))).toBe(false);
    expect(sameCardRun(run, cs('KS', 'QD', 'JS'))).toBe(false);
    expect(sameCardRun(run, cs('JS', 'QH', 'KS'))).toBe(false);
  });
  it('never matches when a side is missing', () => {
    expect(sameCardRun(null, null)).toBe(false);
    expect(sameCardRun(cs('KS'), null)).toBe(false);
    expect(sameCardRun(null, cs('KS'))).toBe(false);
  });
  it('catches a table that changed after pickup', () => {
    const s = emptyState();
    s.tableau[0] = [c('9C', false), ...cs('7H', '6S')];
    s.tableau[1] = cs('8S');
    const lifted = cardsAt(s, tab(0, 1))!.slice();
    expect(sameCardRun(cardsAt(s, tab(0, 1)), lifted)).toBe(true);
    const after = applyMove(s, { from: tab(0, 1), to: toTab(1) })!; // the run moved away meanwhile
    expect(sameCardRun(cardsAt(after, tab(0, 1)), lifted)).toBe(false);
  });
});

describe('dropPile (where a drop counts)', () => {
  it('treats a drop on the pile the cards came from as no drop at all', () => {
    expect(dropPile('t3', 't3')).toBeNull();
    expect(dropPile('waste', 'waste')).toBeNull();
    expect(dropPile('f2', 'f2')).toBeNull();
  });
  it('passes any other pile through, and nothing when released over no pile', () => {
    expect(dropPile('t3', 't4')).toBe('t4');
    expect(dropPile('waste', 'f1')).toBe('f1');
    expect(dropPile('t3', null)).toBeNull();
  });
});

describe('column height does not depend on inline styles', () => {
  it('sets no inline min-height and keys the height on counts that cover every possible column', () => {
    expect(calculatorSource).not.toMatch(/style\.minHeight/);
    expect(calculatorSource).toMatch(/\.sl-pile \{[^}]*min-height: var\(--ch\)/); // one-card fallback
    expect(calculatorSource).toMatch(/\.sl-pile\[data-pile\^="t"\] \{ min-height: calc\(var\(--ch\)/);
    // A column has at most 6 face-down cards and a face-up run of at most 13.
    for (let d = 1; d <= 6; d++) expect(calculatorSource, `down ${d}`).toContain(`[data-down="${d}"] { --sl-d: ${d}; }`);
    for (let u = 2; u <= 13; u++) expect(calculatorSource, `up ${u}`).toContain(`[data-up="${u}"] { --sl-u: ${u - 1}; }`);
  });
});

// ── formatting ───────────────────────────────────────────────────────────────

describe('time formatting', () => {
  it('formats minutes and seconds and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
  it('the table has seven columns', () => {
    expect(COLUMNS).toBe(7);
  });
});
