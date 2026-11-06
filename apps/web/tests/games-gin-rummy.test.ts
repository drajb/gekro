/**
 * games-gin-rummy.test.ts - the engine behind `gin-rummy`.
 *
 * Pinned: the deal (10 + 10 + 1 + 31 distinct cards, same seed same deal), the deadwood minimiser
 * (checked against a brute force that tries every subset of the hand, tests each subset against the
 * definition of a meld, and asks whether the subset splits into melds, on thousands of hands),
 * the lay-offs (checked against a brute force over every subset of the defender's cards and every
 * assignment of those cards to melds), the rules of a turn (draw, discard, the card just taken from
 * the discard pile cannot be thrown back, knocking needs 10 or less, going gin), the scoring of a hand
 * (knock, gin, undercut, drawn hand) on hand-built positions, the three computer levels, whole
 * hands and matches played to the end, the stored counts (sanitised), URL parsing and text.
 */
import { describe, it, expect } from 'vitest';
import {
  TARGETS, KNOCK_MAX, GIN_BONUS, UNDERCUT_BONUS, STOCK_FLOOR, MAX_TURNS, LEVELS, mulberry32, shuffled, cardId, rankOf, suitOf, cardValue,
  cardName, cardLabel, isRed, isCard, sortCards, deadwoodOf, bestArrangement, minDeadwood, discardOptions, extendsMeld, canLayOffAll, bestLayoff,
  other, deal, drawCard, discardCard, knock, canKnock, knockDeadwood, topDiscard, computerDraw, computerDiscard, computerTurn, newMatch,
  scoreHand, matchWinner, sanitizeStore, recordHand, recordMatch, parseSetup, clampTarget, plural, joinList, describeEvent, describeResult,
  shareText, type GinState, type Level, type HandResult,
} from '../src/components/apps-private/gin-rummy/helpers';
import calculatorSource from '../src/components/apps-private/gin-rummy/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');
const C = (rank: number, suit: 's' | 'h' | 'd' | 'c'): number => cardId('shdc'.indexOf(suit), rank);
const H = (...spec: [number, 's' | 'h' | 'd' | 'c'][]): number[] => spec.map(([r, s]) => C(r, s));

// ── Independent oracle: every subset, tested against the definition of a meld ──

const isMeldByDefinition = (cards: number[]): boolean => {
  if (cards.length < 3) return false;
  const ranks = cards.map(rankOf);
  const suits = cards.map(suitOf);
  if (ranks.every((r) => r === ranks[0]) && new Set(suits).size === cards.length) return true;
  if (suits.every((s) => s === suits[0])) {
    const sorted = [...ranks].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
    return true;
  }
  return false;
};

/** Minimum deadwood over every subset that splits into melds. */
const bruteDeadwood = (hand: number[]): number => {
  const n = hand.length;
  const melds: number[] = [];
  for (let m = 1; m < 1 << n; m++) {
    const cards = hand.filter((_, i) => m & (1 << i));
    if (cards.length >= 3 && isMeldByDefinition(cards)) melds.push(m);
  }
  const feasible = new Uint8Array(1 << n);
  feasible[0] = 1;
  for (let mask = 1; mask < 1 << n; mask++) {
    const low = mask & -mask;
    for (const m of melds) {
      if ((m & low) && (m & mask) === m && feasible[mask ^ m]) { feasible[mask] = 1; break; }
    }
  }
  let best = Infinity;
  for (let mask = 0; mask < 1 << n; mask++) {
    if (!feasible[mask]) continue;
    let dw = 0;
    for (let i = 0; i < n; i++) if (!(mask & (1 << i))) dw += cardValue(hand[i]);
    best = Math.min(best, dw);
  }
  return best;
};

const randomHand = (rng: () => number, size: number): number[] => shuffled(Array.from({ length: 52 }, (_, i) => i), rng).slice(0, size);
/** Hands drawn from a few ranks and suits so melds are common. */
const richHand = (rng: () => number, size: number): number[] => {
  const suits = shuffled([0, 1, 2, 3], rng).slice(0, 2 + Math.floor(rng() * 2));
  const lo = 1 + Math.floor(rng() * 5);
  const pool: number[] = [];
  for (const s of suits) for (let r = lo; r <= Math.min(13, lo + 7); r++) pool.push(cardId(s, r));
  return shuffled(pool, rng).slice(0, size);
};

describe('cards', () => {
  it('names and values the cards', () => {
    expect(rankOf(0)).toBe(1);
    expect(suitOf(13)).toBe(1);
    expect(cardName(C(1, 's'))).toBe('Ace of spades');
    expect(cardName(C(12, 'h'))).toBe('Queen of hearts');
    expect(cardLabel(C(10, 'c'))).toContain('10');
    expect(cardValue(C(1, 'd'))).toBe(1);
    expect(cardValue(C(9, 'd'))).toBe(9);
    expect(cardValue(C(10, 'd'))).toBe(10);
    expect(cardValue(C(13, 'c'))).toBe(10);
    expect(isRed(C(5, 'h'))).toBe(true);
    expect(isRed(C(5, 's'))).toBe(false);
    expect(deadwoodOf(H([1, 's'], [13, 'h'], [5, 'c']))).toBe(16);
    for (const bad of [-1, 52, 1.5, NaN, '3', null]) expect(isCard(bad as unknown), String(bad)).toBe(false);
    expect(sortCards(H([5, 'c'], [2, 's'], [9, 'h']))).toEqual(H([2, 's'], [9, 'h'], [5, 'c']));
  });
});

describe('the deal', () => {
  it('deals 10 + 10 + 1 + 31 distinct cards and the non-dealer goes first', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = deal(mulberry32(seed), (seed % 2) as 0 | 1);
      expect(s.hands[0]).toHaveLength(10);
      expect(s.hands[1]).toHaveLength(10);
      expect(s.discard).toHaveLength(1);
      expect(s.stock).toHaveLength(31);
      const all = [...s.hands[0], ...s.hands[1], ...s.discard, ...s.stock];
      expect(new Set(all).size).toBe(52);
      expect(s.turn).toBe(other(s.dealer));
      expect(s.phase).toBe('draw');
      expect(s.result).toBeNull();
    }
  });
  it('gives the same deal for the same seed', () => {
    expect(deal(mulberry32(5), 1)).toEqual(deal(mulberry32(5), 1));
    expect(deal(mulberry32(5), 1)).not.toEqual(deal(mulberry32(6), 1));
  });
});

describe('the deadwood minimiser', () => {
  it('finds the obvious answers', () => {
    expect(minDeadwood(H([1, 's'], [2, 's'], [3, 's']))).toBe(0);
    expect(minDeadwood(H([7, 's'], [7, 'h'], [7, 'd']))).toBe(0);
    expect(minDeadwood(H([7, 's'], [7, 'h'], [7, 'd'], [7, 'c']))).toBe(0);
    expect(minDeadwood(H([12, 's'], [13, 's'], [1, 's']))).toBe(21); // ace is low only: Q-K-A is not a run
    expect(minDeadwood(H([1, 's'], [2, 's'], [4, 's']))).toBe(7);
    expect(minDeadwood(H([5, 's'], [5, 'h'], [6, 's'], [6, 'h']))).toBe(22);
    expect(minDeadwood([])).toBe(0);
  });
  it('uses a shared card where it saves most', () => {
    // The 7 of spades fits a run (5-6-7) or a set of sevens; the set leaves less deadwood.
    const hand = H([5, 's'], [6, 's'], [7, 's'], [7, 'h'], [7, 'd'], [9, 'c']);
    expect(minDeadwood(hand)).toBe(20);
    expect(minDeadwood(hand)).toBe(bruteDeadwood(hand));
  });
  it('matches a brute force over every subset on 600 random deals of 10 cards and 600 of 11', () => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 600; i++) {
      for (const size of [10, 11]) {
        const hand = randomHand(rng, size);
        const got = bestArrangement(hand);
        if (got.deadwood !== bruteDeadwood(hand)) throw new Error(`hand ${hand.map(cardLabel).join(' ')}: engine ${got.deadwood}, brute ${bruteDeadwood(hand)}`);
      }
    }
  }, 180_000);
  it('matches the brute force on 500 hands built from a few ranks and suits (lots of melds)', () => {
    const rng = mulberry32(99);
    let withMelds = 0;
    for (let i = 0; i < 500; i++) {
      const hand = richHand(rng, i % 2 ? 11 : 10);
      const got = bestArrangement(hand);
      if (got.deadwood !== bruteDeadwood(hand)) throw new Error(`hand ${hand.map(cardLabel).join(' ')}: engine ${got.deadwood}, brute ${bruteDeadwood(hand)}`);
      if (got.melds.length >= 2) withMelds++;
    }
    expect(withMelds).toBeGreaterThan(150);
  }, 180_000);
  it('returns an arrangement that really is made of valid melds and loose cards that add up', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 300; i++) {
      const hand = richHand(rng, 11);
      const a = bestArrangement(hand);
      const used = [...a.melds.flat(), ...a.loose];
      expect(used.slice().sort((x, y) => x - y)).toEqual(hand.slice().sort((x, y) => x - y));
      for (const m of a.melds) expect(isMeldByDefinition(m), m.map(cardLabel).join(' ')).toBe(true);
      expect(a.deadwood).toBe(deadwoodOf(a.loose));
    }
  });
  it('lists discards best first and never offers the banned card', () => {
    const hand = H([1, 's'], [2, 's'], [3, 's'], [7, 'h'], [7, 'd'], [7, 'c'], [4, 'h'], [5, 'h'], [6, 'h'], [13, 'c'], [12, 'd']);
    const opts = discardOptions(hand);
    expect(opts).toHaveLength(11);
    expect(opts[0].deadwood).toBe(10);
    for (let i = 1; i < opts.length; i++) expect(opts[i].deadwood).toBeGreaterThanOrEqual(opts[i - 1].deadwood);
    expect(discardOptions(hand, C(13, 'c')).some((o) => o.card === C(13, 'c'))).toBe(false);
    for (const o of opts) expect(o.deadwood).toBe(bruteDeadwood(hand.filter((c) => c !== o.card)));
  });
  it('is quick enough for the computer to use on every turn', () => {
    const rng = mulberry32(3);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) discardOptions(richHand(rng, 11));
    expect(performance.now() - t0).toBeLessThan(20000);
  }, 60_000);
});

describe('lay-offs', () => {
  it('extends sets and runs the right way, never past the ends, ace low only', () => {
    const set3 = H([7, 's'], [7, 'h'], [7, 'd']);
    expect(extendsMeld(set3, C(7, 'c'))).toBe(true);
    expect(extendsMeld(set3, C(8, 'c'))).toBe(false);
    expect(extendsMeld([...set3, C(7, 'c')], C(7, 'c'))).toBe(false);
    const run = H([4, 'h'], [5, 'h'], [6, 'h']);
    expect(extendsMeld(run, C(3, 'h'))).toBe(true);
    expect(extendsMeld(run, C(7, 'h'))).toBe(true);
    expect(extendsMeld(run, C(7, 's'))).toBe(false);
    expect(extendsMeld(run, C(8, 'h'))).toBe(false);
    expect(extendsMeld(run, C(5, 'h'))).toBe(false);
    const low = H([1, 's'], [2, 's'], [3, 's']);
    expect(extendsMeld(low, C(13, 's'))).toBe(false);
    expect(extendsMeld(low, C(4, 's'))).toBe(true);
    const high = H([11, 'c'], [12, 'c'], [13, 'c']);
    expect(extendsMeld(high, C(1, 'c'))).toBe(false);
    expect(extendsMeld(high, C(10, 'c'))).toBe(true);
  });
  it('lays off a chain of cards one after another', () => {
    const run = H([4, 'h'], [5, 'h'], [6, 'h']);
    expect(canLayOffAll([run], H([7, 'h'], [8, 'h']))).toBe(true);
    expect(canLayOffAll([run], H([8, 'h']))).toBe(false);
    expect(canLayOffAll([run], H([3, 'h'], [2, 'h'], [1, 'h']))).toBe(true);
    expect(canLayOffAll([run], H([2, 'h']))).toBe(false);
  });

  /** Independent check: assign every laid-off card to a meld and test the result against the meld definition. */
  const layoffPossible = (melds: number[][], cards: number[]): boolean => {
    const m = melds.length;
    const total = (m + 1) ** cards.length;
    for (let code = 0; code < total; code++) {
      const groups = melds.map((x) => x.slice());
      let x = code;
      let skip = false;
      for (const c of cards) {
        const k = x % (m + 1);
        x = Math.floor(x / (m + 1));
        if (k === m) { skip = true; break; }
        groups[k].push(c);
      }
      if (skip) continue;
      if (groups.every((g) => g.length <= 4 || !g.every((c) => rankOf(c) === rankOf(g[0]))) && groups.every((g) => isMeldByDefinition(g))) return true;
    }
    return false;
  };
  const bruteLayoff = (melds: number[][], defender: number[]): number => {
    let best = bruteDeadwood(defender);
    const n = defender.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const cards = defender.filter((_, i) => mask & (1 << i));
      if (cards.length > 6 || !layoffPossible(melds, cards)) continue;
      best = Math.min(best, bruteDeadwood(defender.filter((_, i) => !(mask & (1 << i)))));
    }
    return best;
  };

  it('finds the lay-off that leaves the least deadwood, matching a brute force over all subsets and assignments', () => {
    const rng = mulberry32(12);
    let interesting = 0;
    for (let i = 0; i < 90; i++) {
      const pool = richHand(rng, 12);
      const knocker = pool.slice(0, 7);
      const defender = pool.slice(7).concat(richHand(rng, 8).filter((c) => !pool.includes(c))).slice(0, 8);
      const mine = bestArrangement(knocker);
      if (!mine.melds.length) continue;
      const got = bestLayoff(mine.melds, defender);
      const want = bruteLayoff(mine.melds, defender);
      if (got.arrangement.deadwood !== want) throw new Error(`knocker ${mine.melds.map((m) => m.map(cardLabel).join(' ')).join(' | ')} defender ${defender.map(cardLabel).join(' ')}: engine ${got.arrangement.deadwood}, brute ${want}`);
      if (got.layoff.length > 0) interesting++;
      expect(canLayOffAll(mine.melds, got.layoff)).toBe(true);
    }
    expect(interesting).toBeGreaterThan(15);
  }, 240_000);
});

// ── Turns and scoring on built positions ─────────────────────────────────────

const base = (over: Partial<GinState> & { hands: [number[], number[]] }): GinState => ({
  hands: over.hands,
  stock: over.stock ?? Array.from({ length: 52 }, (_, i) => i).filter((c) => !over.hands[0].includes(c) && !over.hands[1].includes(c) && c !== (over.discard ?? [0])[0]).slice(0, 20),
  discard: over.discard ?? [C(9, 'd')],
  turn: over.turn ?? 0,
  dealer: over.dealer ?? 1,
  phase: over.phase ?? 'discard',
  taken: over.taken ?? -1,
  known: over.known ?? [[], []],
  turns: over.turns ?? 0,
  result: null,
});

describe('a turn', () => {
  it('draws from the stock or the discard pile and then must discard', () => {
    const s = deal(mulberry32(1), 1);
    const top = topDiscard(s);
    const fromDiscard = drawCard(s, 'discard') as NonNullable<ReturnType<typeof drawCard>>;
    expect(fromDiscard.state.hands[0]).toHaveLength(11);
    expect(fromDiscard.state.hands[0]).toContain(top);
    expect(fromDiscard.state.discard).toHaveLength(0);
    expect(fromDiscard.state.taken).toBe(top);
    expect(fromDiscard.state.known[0]).toEqual([top]);
    expect(fromDiscard.state.phase).toBe('discard');
    const fromStock = drawCard(s, 'stock') as NonNullable<ReturnType<typeof drawCard>>;
    expect(fromStock.state.hands[0]).toHaveLength(11);
    expect(fromStock.state.stock).toHaveLength(30);
    expect(fromStock.state.taken).toBe(-1);
    expect(drawCard(fromStock.state, 'stock')).toBeNull();
    expect(discardCard(s, s.hands[0][0])).toBeNull();
  });
  it('never lets the card just taken from the discard pile be thrown straight back, but allows any other', () => {
    const s = deal(mulberry32(2), 1);
    const d = drawCard(s, 'discard') as NonNullable<ReturnType<typeof drawCard>>;
    const taken = topDiscard(s);
    expect(discardCard(d.state, taken)).toBeNull();
    expect(canKnock(d.state, taken)).toBe(false);
    const other0 = d.state.hands[0].find((c) => c !== taken) as number;
    const r = discardCard(d.state, other0) as NonNullable<ReturnType<typeof discardCard>>;
    expect(r.state.hands[0]).toHaveLength(10);
    expect(r.state.turn).toBe(1);
    expect(r.state.phase).toBe('draw');
    expect(topDiscard(r.state)).toBe(other0);
    expect(r.state.known[0]).toEqual([taken]);
    expect(discardCard(d.state, 99)).toBeNull();
    // A card taken from the stock can be thrown back at once.
    const st = drawCard(s, 'stock') as NonNullable<ReturnType<typeof drawCard>>;
    const drawn = st.events[0].t === 'draw' ? st.events[0].card : -1;
    expect(discardCard(st.state, drawn)).not.toBeNull();
  });
  const HAND_A = H([1, 's'], [3, 'h'], [5, 'd'], [7, 'c'], [9, 's'], [11, 'h'], [2, 'd'], [4, 'c'], [6, 's'], [8, 'h'], [13, 'd']);
  const HAND_B = H([2, 's'], [4, 'h'], [6, 'd'], [8, 'c'], [10, 's'], [12, 'h'], [1, 'd'], [3, 'c'], [5, 's'], [7, 'h']);
  it('ends the hand as a draw when the stock is down to two cards after a discard', () => {
    const s = base({ hands: [HAND_A, HAND_B], stock: [C(10, 'd'), C(10, 'c'), C(9, 'h')], phase: 'discard', turn: 0 });
    // Stock holds 3: after a discard it still has 3 so the hand continues.
    expect(discardCard(s, C(13, 'd'))?.state.phase).toBe('draw');
    const low = base({ hands: [HAND_A, HAND_B], stock: [C(10, 'd'), C(10, 'c')], phase: 'discard', turn: 0 });
    const r = discardCard(low, C(13, 'd')) as NonNullable<ReturnType<typeof discardCard>>;
    expect(r.state.phase).toBe('over');
    expect(r.state.result?.kind).toBe('draw');
    expect(r.state.result?.drawReason).toBe('stock');
    expect(r.events.some((e) => e.t === 'draw-hand')).toBe(true);
    // And nobody can draw from a two-card stock.
    expect(drawCard({ ...low, phase: 'draw' }, 'stock')).toBeNull();
  });
  it('ends the hand as a draw after the turn limit', () => {
    const s = base({ hands: [HAND_A, HAND_B], phase: 'discard', turn: 0, turns: MAX_TURNS - 1 });
    const r = discardCard(s, C(13, 'd')) as NonNullable<ReturnType<typeof discardCard>>;
    expect(r.state.result?.drawReason).toBe('turns');
  });
});

describe('knocking and scoring', () => {
  // Knocker: run A-2-3 spades, set of sevens, run 4-5-6 hearts, K clubs and Q diamonds (discarded when knocking).
  const knocker = H([1, 's'], [2, 's'], [3, 's'], [7, 'h'], [7, 'd'], [7, 'c'], [4, 'h'], [5, 'h'], [6, 'h'], [13, 'c'], [12, 'd']);
  // Defender: no melds at all, one card (3 of hearts) that extends the knocker's hearts run.
  const defender = H([13, 'd'], [12, 'c'], [11, 'h'], [9, 's'], [8, 'h'], [6, 'c'], [5, 's'], [4, 'c'], [3, 'h'], [2, 'd']);

  it('has a defender hand with no melds (the position is what the tests say it is)', () => {
    expect(bruteDeadwood(defender)).toBe(10 + 10 + 10 + 9 + 8 + 6 + 5 + 4 + 3 + 2);
  });
  it('lets a hand with 10 or less deadwood knock, and refuses one with more', () => {
    const s = base({ hands: [knocker, defender], phase: 'discard', turn: 0 });
    expect(knockDeadwood(s, C(12, 'd'))).toBe(10);
    expect(canKnock(s, C(12, 'd'))).toBe(true);
    expect(canKnock(s, C(13, 'c'))).toBe(true); // leaves the queen instead: 10 as well
    expect(knockDeadwood(s, C(13, 'c'))).toBe(10);
    expect(canKnock({ ...s, phase: 'draw' }, C(12, 'd'))).toBe(false);
    expect(knock({ ...s, phase: 'draw' }, C(12, 'd'))).toBeNull();
    expect(canKnock(s, C(7, 'h'))).toBe(false);
    expect(knock(s, C(7, 'h'))).toBeNull();
    expect(KNOCK_MAX).toBe(10);
  });
  it('scores a knock as the difference, after the defender lays off', () => {
    const s = base({ hands: [knocker, defender], phase: 'discard', turn: 0 });
    const r = (knock(s, C(12, 'd')) as NonNullable<ReturnType<typeof knock>>).state.result as HandResult;
    expect(r.kind).toBe('knock');
    expect(r.knocker).toBe(0);
    expect(r.winner).toBe(0);
    expect(r.knocked.deadwood).toBe(10);
    expect(r.layoff).toEqual([C(3, 'h')]);
    expect(r.defended.deadwood).toBe(67 - 3);
    expect(r.points).toBe(64 - 10);
  });
  it('scores gin as 25 plus the other deadwood, with no lay-offs', () => {
    const gin = H([5, 's'], [6, 's'], [7, 's'], [8, 's'], [9, 'h'], [9, 'd'], [9, 'c'], [11, 'd'], [12, 'd'], [13, 'd'], [2, 'c']);
    const s = base({ hands: [gin, defender], phase: 'discard', turn: 0 });
    const out = knock(s, C(2, 'c')) as NonNullable<ReturnType<typeof knock>>;
    const r = out.state.result as HandResult;
    expect(r.kind).toBe('gin');
    expect(r.knocked.deadwood).toBe(0);
    expect(r.layoff).toEqual([]);
    expect(r.points).toBe(GIN_BONUS + 67);
    expect(out.events.some((e) => e.t === 'knock' && e.gin)).toBe(true);
    expect(out.state.phase).toBe('over');
    expect(topDiscard(out.state)).toBe(C(2, 'c'));
  });
  it('scores an undercut: the defender has the same or less deadwood, and scores the difference plus 25', () => {
    // Defender holds almost a full set of melds: deadwood 4 after nothing to lay off.
    const strong = H([2, 'h'], [2, 'd'], [2, 'c'], [8, 's'], [8, 'h'], [8, 'd'], [10, 'c'], [11, 'c'], [12, 'c'], [4, 'd']);
    const s = base({ hands: [knocker, strong], phase: 'discard', turn: 0 });
    const r = (knock(s, C(12, 'd')) as NonNullable<ReturnType<typeof knock>>).state.result as HandResult;
    expect(r.defended.deadwood).toBe(4);
    expect(r.kind).toBe('undercut');
    expect(r.winner).toBe(1);
    expect(r.points).toBe(10 - 4 + UNDERCUT_BONUS);
    // Equal deadwood is also an undercut.
    const equalHand = H([2, 'h'], [2, 'd'], [2, 'c'], [8, 's'], [8, 'h'], [8, 'd'], [10, 'c'], [11, 'c'], [12, 'c'], [10, 'd']);
    const s2 = base({ hands: [knocker, equalHand], phase: 'discard', turn: 0 });
    const r2 = (knock(s2, C(12, 'd')) as NonNullable<ReturnType<typeof knock>>).state.result as HandResult;
    expect(r2.kind).toBe('undercut');
    expect(r2.points).toBe(0 + UNDERCUT_BONUS);
  });
  it('lets the second player knock too, and scores for them', () => {
    const s = base({ hands: [defender, knocker], phase: 'discard', turn: 1 });
    const r = (knock(s, C(12, 'd')) as NonNullable<ReturnType<typeof knock>>).state.result as HandResult;
    expect(r.knocker).toBe(1);
    expect(r.winner).toBe(1);
    expect(r.points).toBe(54);
  });
  it('describes results in words', () => {
    const s = base({ hands: [knocker, defender], phase: 'discard', turn: 0 });
    const r = (knock(s, C(12, 'd')) as NonNullable<ReturnType<typeof knock>>).state.result as HandResult;
    expect(describeResult(r)).toBe('You knocked with 10 against 64. The computer laid off 1 card. You score 54 points.');
    expect(describeResult({ ...r, kind: 'draw', knocker: -1, winner: -1, points: 0 })).toBe('The hand is a draw. Nobody scores.');
    expect(describeResult({ ...r, kind: 'undercut', knocker: 0, winner: 1, points: 1 })).toContain('Undercut!');
    expect(describeResult({ ...r, kind: 'gin', layoff: [], points: 30 })).toContain('went gin');
    expect(describeEvent({ t: 'draw', by: 0, from: 'stock', card: 0 })).toBe('You took the Ace of spades from the stock.');
    expect(describeEvent({ t: 'draw', by: 1, from: 'stock', card: 0 })).toBe('The computer drew from the stock.');
    expect(describeEvent({ t: 'draw', by: 1, from: 'discard', card: 0 })).toBe('The computer took the Ace of spades from the discard pile.');
    expect(describeEvent({ t: 'discard', by: 1, card: 12 })).toBe('The computer discarded the King of spades.');
    expect(describeEvent({ t: 'knock', by: 0, card: 0, gin: true })).toBe('You went gin!');
  });
});

describe('matches', () => {
  const result = (winner: 0 | 1 | -1, points: number, kind: HandResult['kind'] = 'knock'): HandResult => ({
    kind, knocker: winner, winner, points, knocked: { melds: [], loose: [], deadwood: 0 }, defended: { melds: [], loose: [], deadwood: 0 }, layoff: [],
  });
  it('adds hand scores, alternates the dealer and ends at the target', () => {
    expect(TARGETS).toEqual([50, 100]);
    let m = newMatch(100);
    expect(m).toMatchObject({ scores: [0, 0], target: 100, hands: 0, dealer: 1, over: false });
    m = scoreHand(m, result(0, 40));
    expect(m).toMatchObject({ scores: [40, 0], hands: 1, dealer: 0, over: false, wins: [1, 0] });
    m = scoreHand(m, result(1, 30));
    expect(m.scores).toEqual([40, 30]);
    m = scoreHand(m, result(-1, 0, 'draw'));
    expect(m.scores).toEqual([40, 30]);
    expect(m.hands).toBe(3);
    m = scoreHand(m, result(0, 60));
    expect(m.over).toBe(true);
    expect(matchWinner(m)).toBe(0);
    expect(matchWinner(newMatch(50))).toBe(-1);
    expect(newMatch(77).target).toBe(100);
    expect(clampTarget(50)).toBe(50);
  });
});

describe('the computer players', () => {
  const playHand = (levels: [Level, Level], seed: number, dealer: 0 | 1) => {
    const rng = mulberry32(seed);
    let s = deal(rng, dealer);
    let guard = 0;
    while (s.phase !== 'over') {
      expect(guard++).toBeLessThan(400);
      const r = computerTurn(s, levels[s.turn]);
      expect(r).not.toBeNull();
      s = (r as NonNullable<typeof r>).state;
    }
    return s;
  };

  it('always play legal turns to the end of a hand, with consistent results', () => {
    for (let i = 0; i < 60; i++) {
      const levels: [Level, Level] = [LEVELS[i % 3], LEVELS[(i + 1) % 3]];
      const s = playHand(levels, 100 + i, (i % 2) as 0 | 1);
      const r = s.result as HandResult;
      expect(r).not.toBeNull();
      const all = [...s.hands[0], ...s.hands[1], ...s.stock, ...s.discard];
      expect(new Set(all).size).toBe(52);
      expect(all).toHaveLength(52);
      if (r.kind === 'draw') { expect(r.points).toBe(0); continue; }
      expect(r.points).toBeGreaterThan(0);
      const k = r.knocker as 0 | 1;
      expect(r.knocked.deadwood).toBe(bruteDeadwood(s.hands[k]));
      expect(r.knocked.deadwood).toBeLessThanOrEqual(KNOCK_MAX);
      if (r.kind === 'gin') { expect(r.knocked.deadwood).toBe(0); expect(r.points).toBe(25 + r.defended.deadwood); expect(r.winner).toBe(k); }
      if (r.kind === 'knock') { expect(r.points).toBe(r.defended.deadwood - r.knocked.deadwood); expect(r.winner).toBe(k); }
      if (r.kind === 'undercut') { expect(r.points).toBe(r.knocked.deadwood - r.defended.deadwood + 25); expect(r.winner).toBe(other(k)); }
      if (r.kind !== 'gin') expect(r.defended.deadwood).toBe(bruteLayoffDeadwood(r, s.hands[other(k)]));
    }
  }, 180_000);

  /** The defender's deadwood after the lay-off the engine chose must itself be consistent with that lay-off. */
  const bruteLayoffDeadwood = (r: HandResult, defender: number[]): number =>
    bruteDeadwood(defender.filter((c) => !r.layoff.includes(c)));

  it('draws from the discard pile only when it helps, and never from an empty or too-small stock', () => {
    const hand = H([4, 'h'], [5, 'h'], [9, 's'], [9, 'h'], [2, 'c'], [13, 'd'], [12, 'c'], [11, 'd'], [1, 's'], [7, 'c']);
    const s = base({ hands: [hand, defender2()], discard: [C(6, 'h')], phase: 'draw', turn: 0 });
    for (const l of LEVELS) expect(computerDraw(s, l)).toBe('discard');
    const useless = base({ hands: [hand, defender2()], discard: [C(8, 'c')], phase: 'draw', turn: 0 });
    for (const l of LEVELS) expect(computerDraw(useless, l)).toBe('stock');
    const lowStock = base({ hands: [hand, defender2()], discard: [C(8, 'c')], stock: [C(3, 'c'), C(3, 'd')], phase: 'draw', turn: 0 });
    for (const l of LEVELS) expect(computerDraw(lowStock, l)).toBe('discard');
  });
  function defender2(): number[] { return H([13, 's'], [2, 'd'], [3, 'c'], [4, 'c'], [8, 's'], [8, 'h'], [10, 'h'], [6, 'd'], [7, 'd'], [1, 'h']); }

  it('goes gin whenever it can, at every level', () => {
    const gin = H([5, 's'], [6, 's'], [7, 's'], [8, 's'], [9, 'h'], [9, 'd'], [9, 'c'], [11, 'd'], [12, 'd'], [13, 'd'], [2, 'c']);
    const s = base({ hands: [gin, defender2()], phase: 'discard', turn: 0 });
    for (const l of LEVELS) expect(computerDiscard(s, l)).toEqual({ card: C(2, 'c'), knock: true });
  });
  it('never discards the card it just took from the discard pile', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 120; i++) {
      let s = deal(rng, 1);
      for (let t = 0; t < 40 && s.phase !== 'over'; t++) {
        const lv = LEVELS[(i + t) % 3];
        if (s.phase === 'draw') {
          const d = drawCard(s, computerDraw(s, lv)) as NonNullable<ReturnType<typeof drawCard>>;
          s = d.state;
        }
        const mv = computerDiscard(s, lv);
        expect(mv.card).not.toBe(s.taken);
        const r = (mv.knock ? knock(s, mv.card) : null) ?? discardCard(s, mv.card);
        expect(r).not.toBeNull();
        s = (r as NonNullable<typeof r>).state;
      }
    }
  });
  it('only knocks when it is allowed to', () => {
    const rng = mulberry32(31);
    for (let i = 0; i < 100; i++) {
      let s = deal(rng, 0);
      for (let t = 0; t < 60 && s.phase !== 'over'; t++) {
        const lv = LEVELS[i % 3];
        if (s.phase === 'draw') s = (drawCard(s, computerDraw(s, lv)) as NonNullable<ReturnType<typeof drawCard>>).state;
        const mv = computerDiscard(s, lv);
        if (mv.knock) expect(canKnock(s, mv.card)).toBe(true);
        s = ((mv.knock ? knock(s, mv.card) : null) ?? discardCard(s, mv.card) as NonNullable<ReturnType<typeof discardCard>>).state;
      }
    }
  });
  it('Hard scores more over many hands than Easy, and both finish quickly', () => {
    let net = 0;
    const N = 150;
    let worst = 0;
    for (let i = 0; i < N; i++) {
      const dealer = (i % 2) as 0 | 1;
      const rng = mulberry32(5000 + i);
      let s = deal(rng, dealer);
      while (s.phase !== 'over') {
        const t0 = performance.now();
        const r = computerTurn(s, s.turn === 0 ? 'hard' : 'easy') as NonNullable<ReturnType<typeof computerTurn>>;
        worst = Math.max(worst, performance.now() - t0);
        s = r.state;
      }
      const res = s.result as HandResult;
      if (res.winner === 0) net += res.points;
      else if (res.winner === 1) net -= res.points;
    }
    expect(net).toBeGreaterThan(0);
    expect(worst).toBeLessThan(1000);
  }, 240_000);
  it('plays whole matches to 50 and 100 at every pairing', () => {
    for (const target of TARGETS) {
      for (const lv of LEVELS) {
        let m = newMatch(target);
        const rng = mulberry32(target + lv.length);
        for (let h = 0; h < 80 && !m.over; h++) {
          let s = deal(rng, m.dealer);
          while (s.phase !== 'over') s = (computerTurn(s, s.turn === 0 ? lv : 'medium') as NonNullable<ReturnType<typeof computerTurn>>).state;
          m = scoreHand(m, s.result as HandResult);
        }
        expect(m.over).toBe(true);
        expect(Math.max(...m.scores)).toBeGreaterThanOrEqual(target);
        expect([0, 1]).toContain(matchWinner(m));
      }
    }
  }, 240_000);
});

describe('fuzz: random play never breaks an invariant', () => {
  it('plays 600 hands of random legal moves', () => {
    const rng = mulberry32(2718);
    for (let n = 0; n < 600; n++) {
      let s = deal(rng, (n % 2) as 0 | 1);
      for (let step = 0; step < 300 && s.phase !== 'over'; step++) {
        const mine = s.hands[s.turn];
        if (s.phase === 'draw') {
          const from = rng() < 0.5 && s.stock.length > STOCK_FLOOR ? 'stock' : 'discard';
          const r = drawCard(s, from) ?? drawCard(s, 'discard');
          expect(r).not.toBeNull();
          s = (r as NonNullable<typeof r>).state;
          expect(s.hands[s.turn]).toHaveLength(11);
        } else {
          expect(mine).toHaveLength(11);
          const choices = mine.filter((c) => c !== s.taken);
          const card = choices[Math.floor(rng() * choices.length)];
          const r = canKnock(s, card) && rng() < 0.4 ? knock(s, card) : discardCard(s, card);
          expect(r).not.toBeNull();
          s = (r as NonNullable<typeof r>).state;
        }
        const all = [...s.hands[0], ...s.hands[1], ...s.stock, ...s.discard];
        expect(new Set(all).size).toBe(52);
        expect(all).toHaveLength(52);
      }
      expect(s.phase).toBe('over');
    }
  }, 240_000);
});

describe('stored results, setup and text', () => {
  it('reads junk safely', () => {
    const empty = { p: 0, w: 0, g: 0, h: 0 };
    expect(sanitizeStore(null)).toEqual(empty);
    expect(sanitizeStore('x')).toEqual(empty);
    expect(sanitizeStore([1])).toEqual(empty);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":5},"p":1.5,"w":"2","g":-1,"h":1e12}'))).toEqual(empty);
    expect(sanitizeStore({ p: 5, w: 2, g: 1, h: 7, extra: 1 })).toEqual({ p: 5, w: 2, g: 1, h: 7 });
    expect(sanitizeStore({ p: 1, w: 9 }).w).toBe(1);
  });
  it('records hands and matches', () => {
    const r = (kind: HandResult['kind'], winner: 0 | 1 | -1): HandResult => ({ kind, knocker: winner, winner, points: 5, knocked: { melds: [], loose: [], deadwood: 0 }, defended: { melds: [], loose: [], deadwood: 0 }, layoff: [] });
    let s = sanitizeStore(null);
    s = recordHand(s, r('gin', 0));
    expect(s).toEqual({ p: 0, w: 0, g: 1, h: 1 });
    s = recordHand(s, r('knock', 1));
    expect(s).toEqual({ p: 0, w: 0, g: 1, h: 1 });
    s = recordMatch(s, true);
    expect(s).toMatchObject({ p: 1, w: 1 });
  });
  it('clamps junk URL parameters', () => {
    expect(parseSetup({}, 9)).toEqual({ level: 'medium', target: 100, seed: 9 });
    expect(parseSetup({ l: 'hard', t: '50', s: '123' }, 1)).toEqual({ level: 'hard', target: 50, seed: 123 });
    for (const t of ['0', '75', 'x', '', '-50']) expect(parseSetup({ t }, 1).target, t).toBe(100);
    for (const s of ['0', 'abc', '4294967296', '1.5', '', '-4']) expect(parseSetup({ s }, 7).seed, s).toBe(7);
    expect(parseSetup({ l: 'nope' }, 1).level).toBe('medium');
  });
  it('words things correctly', () => {
    expect(plural(1, 'card')).toBe('1 card');
    expect(plural(2, 'point')).toBe('2 points');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
    const setup = parseSetup({}, 3);
    expect(shareText(setup, newMatch(100))).toBe('Gin Rummy (Medium computer, first to 100), game #3: in progress, 0 to 0');
    expect(shareText(setup, { ...newMatch(100), scores: [105, 80], over: true })).toBe('Gin Rummy (Medium computer, first to 100), game #3: I won, 105 to 80');
  });
});

describe('the page', () => {
  it('has the shell events, a live region, sound off by default and reduced motion', () => {
    expect(src).toMatch(/id="gnr-app"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/app:copy/);
    expect(src).toMatch(/app:export/);
    expect(src).toMatch(/app:reset/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/aria-pressed="false"/);
  });
});
