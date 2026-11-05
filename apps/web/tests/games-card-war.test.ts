/**
 * games-card-war.test.ts - the engine behind `card-war`.
 *
 * Pinned: the rank comparison table (Ace high, suits never matter) against an independent
 * ordering, the 26/26 split, an unbiased seeded shuffle (chi-square), a flip (higher wins both),
 * a war (3 face down and 1 up), repeated wars, running out of cards in the middle of a war (a
 * short war keeps the last card as the flipped card; a player with nothing left loses it), the
 * won pile being reshuffled into an empty draw pile, the flip limit and its tie, the words for
 * every outcome, the stored results, and 10,000 simulated whole games: every one ends within the
 * 600-flip limit, with 52 distinct cards at the end and (for the first 300) after every single
 * flip. The page promises are checked against the Calculator source.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, flipRound, compareCards, rankValue, cardsOf, validateState, describeBattle, describeOutcome, describeFlip, countsLine, resultSentence,
  sanitizeStore, recordGame, clampLength, clampSpeed, clampLimit, mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isRed, plural,
  SUIT_CHARS, SUIT_NAMES, RANK_LABELS, DECK, WHOLE_LIMIT, LENGTH_FLIPS, LENGTHS, SPEEDS, SPEED_MS, AI_DELAY_MS, AI_DELAY_REDUCED_MS, MAX_COUNT, NAMES,
  type WarState, type FlipResult,
} from '../src/components/apps-private/card-war/helpers';
import calculatorSource from '../src/components/apps-private/card-war/Calculator.astro?raw';

// ── building positions ──────────────────────────────────────────────────────

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts. */
const c = (code: string): number => {
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};
/** Piles are written TOP FIRST here (the engine keeps the top last). Cards not listed are simply absent. */
const mk = (top0: string[], top1: string[], opts: { won0?: string[]; won1?: string[]; limit?: number } = {}): WarState => ({
  piles: [top0.map(c).reverse(), top1.map(c).reverse()],
  won: [(opts.won0 ?? []).map(c), (opts.won1 ?? []).map(c)],
  flips: 0, wars: 0, biggest: 0, limit: opts.limit ?? 600, over: false, winner: -1, endedBy: null,
});
const everyCard = (s: WarState): number[] => [...s.piles[0], ...s.piles[1], ...s.won[0], ...s.won[1]].sort((a, b) => a - b);
const flip = (s: WarState, seed = 1) => {
  const r = flipRound(s, mulberry32(seed));
  if (!r) throw new Error('flip refused');
  expect(everyCard(r.state)).toEqual(everyCard(s)); // no card lost or copied
  return r;
};

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards and comparison', () => {
  it('maps ids to suit and rank and back for all 52, with unique names', () => {
    for (let id = 0; id < DECK; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
    expect(new Set(Array.from({ length: DECK }, (_, i) => cardName(i))).size).toBe(52);
    expect(cardName(c('AS'))).toBe('Ace of spades');
    expect(cardLabel(c('10D'))).toBe('10♦︎');
  });
  it('uses text-presentation suit glyphs with distinct shapes and names', () => {
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(new Set(SUIT_CHARS).size).toBe(4);
    expect(SUIT_NAMES).toHaveLength(4);
    expect([0, 1, 2, 3].map((s) => isRed(cardId(s, 9)))).toEqual([false, true, true, false]);
  });
  it('compares every pair of cards the same way as an independent ordering (Ace high, suits ignored)', () => {
    const order = '23456789TJQKA';
    const letter = (id: number): string => ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'][id % 13];
    for (let a = 0; a < DECK; a++) {
      for (let b = 0; b < DECK; b++) {
        const expected = Math.sign(order.indexOf(letter(a)) - order.indexOf(letter(b)));
        expect(compareCards(a, b), `${a} v ${b}`).toBe(expected);
      }
    }
    expect(rankValue(c('AS'))).toBe(14);
    expect(rankValue(c('2C'))).toBe(2);
    expect(rankValue(c('KH'))).toBe(13);
  });
  it('plural reads naturally', () => {
    expect(plural(1, 'card')).toBe('1 card');
    expect(plural(0, 'flip')).toBe('0 flips');
  });
});

describe('shuffle and the split', () => {
  it('is a permutation, deterministic, and leaves its input alone', () => {
    const src = Array.from({ length: DECK }, (_, i) => i);
    const out = shuffled(src, mulberry32(7));
    expect(out.slice().sort((a, b) => a - b)).toEqual(src);
    expect(src[5]).toBe(5);
    expect(shuffled(src, mulberry32(7))).toEqual(out);
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
    for (let seed = 1; seed <= N; seed++) pos[shuffled(Array.from({ length: DECK }, (_, i) => i), mulberry32(seed * 104729 + 13)).indexOf(17)] += 1;
    let chi = 0;
    for (const v of pos) chi += ((v - N / DECK) ** 2) / (N / DECK);
    expect(chi).toBeLessThan(87.9);
  });
  it('splits the pack 26 and 26 with all 52 cards exactly once, for many seeds', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = newGame(600, mulberry32(seed));
      expect(s.piles[0]).toHaveLength(26);
      expect(s.piles[1]).toHaveLength(26);
      expect(everyCard(s)).toEqual(Array.from({ length: DECK }, (_, i) => i));
      expect(validateState(s)).toBeNull();
      expect(s.flips).toBe(0);
      expect(s.over).toBe(false);
    }
  });
  it('is deterministic for a seed and different across seeds', () => {
    expect(JSON.stringify(newGame(40, mulberry32(5)))).toBe(JSON.stringify(newGame(40, mulberry32(5))));
    expect(JSON.stringify(newGame(40, mulberry32(5)).piles)).not.toBe(JSON.stringify(newGame(40, mulberry32(6)).piles));
  });
  it('clamps junk options', () => {
    expect(clampLength('quick')).toBe('quick');
    expect(clampLength('whole')).toBe('whole');
    expect(clampLength('medium')).toBe('medium');
    // The fallback is the default length shown on a fresh load (Quick).
    for (const bad of ['x', 3, null, undefined, '', 'QUICK']) expect(clampLength(bad)).toBe('quick');
    expect(clampSpeed('slow')).toBe('slow');
    expect(clampSpeed('fast')).toBe('fast');
    for (const bad of ['x', 3, null, undefined]) expect(clampSpeed(bad)).toBe('normal');
    expect(clampLimit(15)).toBe(15);
    for (const bad of [0, -1, 601, 2.5, NaN, Infinity, '40', null, undefined]) expect(clampLimit(bad)).toBe(40);
    expect(newGame(0, mulberry32(1)).limit).toBe(40);
  });
});

// ── a flip ───────────────────────────────────────────────────────────────────

describe('flipRound', () => {
  it('the higher card wins both cards and they go to the winner\'s won pile', () => {
    const s = mk(['KS', '2C'], ['9D', '3C']);
    const { state, round } = flip(s);
    expect(round.winner).toBe(0);
    expect(round.pot).toBe(2);
    expect(round.battles).toEqual([{ a: c('KS'), b: c('9D'), down: [0, 0] }]);
    expect([...state.won[0]].sort()).toEqual([c('KS'), c('9D')].sort());
    expect(state.piles[0]).toEqual([c('2C')]);
    expect(state.piles[1]).toEqual([c('3C')]);
    expect(state.flips).toBe(1);
    expect(state.wars).toBe(0);
    expect(state.biggest).toBe(2);
    expect(cardsOf(state, 0)).toBe(3);
    expect(cardsOf(state, 1)).toBe(1);
  });
  it('the other player can win too, and your biggest only counts your own wins', () => {
    const { state, round } = flip(mk(['4S', '2C'], ['JD', '3C']));
    expect(round.winner).toBe(1);
    expect(state.won[1]).toHaveLength(2);
    expect(state.biggest).toBe(0);
  });
  it('an Ace beats a King and a 2 loses to anything higher, whatever the suits', () => {
    expect(flip(mk(['AS', '2C'], ['KH', '3C'])).round.winner).toBe(0);
    expect(flip(mk(['2S', '2C'], ['3H', '3C'])).round.winner).toBe(1);
    expect(flip(mk(['5S', '2C'], ['4H', '3C'])).round.winner).toBe(0);
  });
  it('a tie starts a war: 3 cards face down each, then one up, and the winner takes the whole pile', () => {
    const s = mk(['7H', '2C', '3C', '4C', 'KS', '9H'], ['7D', '5S', '6S', '8S', '3D', '4H']);
    const { state, round } = flip(s);
    expect(round.battles).toHaveLength(2);
    expect(round.battles[1]).toEqual({ a: c('KS'), b: c('3D'), down: [3, 3] });
    expect(round.winner).toBe(0);
    expect(round.pot).toBe(10);
    expect(round.short).toBe(-1);
    expect(state.wars).toBe(1);
    expect(state.flips).toBe(1);
    expect(state.won[0]).toHaveLength(10);
    expect(state.piles[0]).toEqual([c('9H')]);
    expect(state.piles[1]).toEqual([c('4H')]);
    expect(state.biggest).toBe(10);
  });
  it('another tie in the war starts another war', () => {
    // 7 v 7, then 10 v 10 after 3 down each, then the last war is won by the Queen.
    const s = mk(
      ['7H', '2C', '3C', '4C', '10S', '2H', '3H', '4H', 'QS', '9H'],
      ['7D', '5S', '6S', '8S', '10D', '5H', '6H', '8H', 'JD', '4D'],
    );
    const { state, round } = flip(s);
    expect(round.battles).toHaveLength(3);
    expect(state.wars).toBe(2);
    expect(round.winner).toBe(0);
    // 2 flipped, then 6 down and 2 up in each of two wars.
    expect(round.pot).toBe(18);
    expect(state.flips).toBe(1);
  });
  it('a player with fewer than 4 cards puts all but one face down and flips the last as the war card', () => {
    const s = mk(['7H', '9C'], ['7D', '2S', '3S', '4S', '5S']);
    const { state, round } = flip(s);
    expect(round.battles[1]).toEqual({ a: c('9C'), b: c('5S'), down: [0, 3] });
    expect(round.winner).toBe(0);
    expect(round.pot).toBe(2 + 3 + 2);
    expect(cardsOf(state, 0)).toBe(7);
    expect(cardsOf(state, 1)).toBe(0); // its 5 cards: 1 flipped, 3 face down, 1 flipped for the war
    expect(state.over).toBe(true);
    expect(state.winner).toBe(0);
    expect(state.endedBy).toBe('cards');
  });
  it('a player with two cards puts one face down', () => {
    const s = mk(['7H', '9C', '2C'], ['7D', '2S', '3S', '4S', '5S']);
    const { round } = flip(s);
    expect(round.battles[1].down).toEqual([1, 3]);
    expect(round.battles[1].a).toBe(c('2C'));
  });
  it('a player with no card left for a war loses it, and the game ends', () => {
    const s = mk(['7H'], ['7D', '2S', '3S']);
    const { state, round } = flip(s);
    expect(round.short).toBe(0);
    expect(round.winner).toBe(1);
    expect(round.pot).toBe(2);
    expect(state.over).toBe(true);
    expect(state.winner).toBe(1);
    expect(state.endedBy).toBe('cards');
    expect(state.wars).toBe(1);
  });
  it('the other side can run out too', () => {
    const { state, round } = flip(mk(['7H', '2S', '3S'], ['7D']));
    expect(round.short).toBe(1);
    expect(round.winner).toBe(0);
    expect(state.winner).toBe(0);
  });
  it('when the draw pile is empty the won pile is shuffled to become the new draw pile', () => {
    const s = mk(['KS'], ['2D', '3D'], { won0: ['4C', '5C', '6C'] });
    // Flip 1: KS beats 2D. Player 0 now has no draw pile, only 5 won cards.
    const first = flip(s);
    expect(first.state.piles[0]).toEqual([]);
    expect(first.state.won[0]).toHaveLength(5);
    expect(cardsOf(first.state, 0)).toBe(5);
    // Flip 2 must take its card from the reshuffled won pile.
    const second = flip(first.state, 9);
    const mine = new Set([c('4C'), c('5C'), c('6C'), c('KS'), c('2D')]);
    expect(mine.has(second.round.battles[0].a)).toBe(true);
    expect(second.round.battles[0].b).toBe(c('3D'));
    expect(everyCard(second.state)).toEqual(everyCard(s));
  });
  it('the reshuffle is deterministic for a seed and uses an unbiased shuffle of the won pile', () => {
    const s = mk(['KS'], ['2D'], { won0: [], limit: 600 });
    const a = flip({ ...s, piles: [[], s.piles[1]], won: [[c('3C'), c('4C'), c('5C'), c('6C'), c('7C'), c('8C')], [c('9C')]] }, 3);
    const b = flip({ ...s, piles: [[], s.piles[1]], won: [[c('3C'), c('4C'), c('5C'), c('6C'), c('7C'), c('8C')], [c('9C')]] }, 3);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    // Over many seeds each of the six cards shows up first about equally often.
    const firsts = new Map<number, number>();
    for (let seed = 1; seed <= 1200; seed++) {
      const r = flipRound({ ...s, piles: [[], [c('2D')]], won: [[c('3C'), c('4C'), c('5C'), c('6C'), c('7C'), c('8C')], [c('9C')]] }, mulberry32(seed))!;
      firsts.set(r.round.battles[0].a, (firsts.get(r.round.battles[0].a) ?? 0) + 1);
    }
    expect(firsts.size).toBe(6);
    for (const v of firsts.values()) expect(Math.abs(v - 200)).toBeLessThan(60);
  });
  it('the winner of a flip holds the pile in a shuffled order, not in the order flipped', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = flipRound(mk(['7H', '2C', '3C', '4C', 'KS', '9H'], ['7D', '5S', '6S', '8S', '3D', '4H']), mulberry32(seed))!;
      orders.add(r.state.won[0].join(','));
    }
    expect(orders.size).toBeGreaterThan(50);
  });
  it('ends at the flip limit and the player with more cards wins', () => {
    const r = flip(mk(['KS', '2C', '3C'], ['9D', '4C'], { limit: 1 }));
    expect(r.state.over).toBe(true);
    expect(r.state.endedBy).toBe('limit');
    expect(r.state.winner).toBe(0);
    expect(r.state.flips).toBe(1);
  });
  it('a tie in cards at the limit is a tie', () => {
    const s = mk(['KH'], ['QH'], { won0: ['2C'], won1: ['3C', '4C', '5C'], limit: 1 });
    const { state } = flip(s);
    expect(cardsOf(state, 0)).toBe(3);
    expect(cardsOf(state, 1)).toBe(3);
    expect(state.over).toBe(true);
    expect(state.endedBy).toBe('limit');
    expect(state.winner).toBe(-1);
    expect(resultSentence(state)).toBe('A tie after 1 flip: You 3 cards, Pip 3 cards.');
  });
  it('refuses to flip a finished game, or a player with no cards, and never changes its input', () => {
    const done = flip(mk(['KS'], ['9D'])).state;
    expect(done.over).toBe(true);
    expect(flipRound(done, mulberry32(1))).toBeNull();
    expect(flipRound(mk([], ['9D']), mulberry32(1))).toBeNull();
    const s = mk(['7H', '2C', '3C', '4C', 'KS'], ['7D', '5S', '6S', '8S', '3D']);
    const before = JSON.stringify(s);
    flip(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

// ── words ────────────────────────────────────────────────────────────────────

describe('words', () => {
  const r = (s: WarState): FlipResult => flipRound(s, mulberry32(1))!.round;
  it('describes a plain flip', () => {
    const rr = r(mk(['KS', '2C'], ['9D', '3C']));
    expect(describeBattle(rr.battles[0], 0)).toBe('You flipped the King of spades. Pip flipped the 9 of diamonds.');
    expect(describeOutcome(rr)).toBe('You win the flip and take 2 cards.');
    expect(describeFlip(rr)).toBe('You flipped the King of spades. Pip flipped the 9 of diamonds. You win the flip and take 2 cards.');
    expect(describeOutcome(r(mk(['4S', '2C'], ['JD', '3C'])))).toBe('Pip wins the flip and takes 2 cards.');
  });
  it('describes a war and a repeated war', () => {
    const rr = r(mk(['7H', '2C', '3C', '4C', 'KS', '9H'], ['7D', '5S', '6S', '8S', '3D', '4H']));
    expect(describeBattle(rr.battles[1], 1)).toBe('Each player puts 3 cards face down. You flipped the King of spades. Pip flipped the 3 of diamonds.');
    expect(describeOutcome(rr)).toBe('A tie, so it is war! You win the war and take 10 cards.');
    const twice = r(mk(
      ['7H', '2C', '3C', '4C', '10S', '2H', '3H', '4H', 'QS', '9H'],
      ['7D', '5S', '6S', '8S', '10D', '5H', '6H', '8H', 'JD', '4D'],
    ));
    expect(describeOutcome(twice)).toContain('2 ties in a row');
  });
  it('describes a short war and a war that cannot be played', () => {
    const short = r(mk(['7H', '9C'], ['7D', '2S', '3S', '4S', '5S']));
    expect(describeBattle(short.battles[1], 1)).toBe('You put 0 cards face down. Pip put 3 cards face down. You flipped the 9 of clubs. Pip flipped the 5 of spades.');
    const none = r(mk(['7H'], ['7D', '2S', '3S']));
    expect(describeOutcome(none)).toBe('It is a tie, so it is war! You have no cards left for it, so Pip wins all 2 cards.');
    const none2 = r(mk(['7H', '2S', '3S'], ['7D']));
    expect(describeOutcome(none2)).toBe('It is a tie, so it is war! Pip has no cards left for it, so You win all 2 cards.');
  });
  it('count and result lines are right in every state', () => {
    const open = mk(['KS', '2C'], ['9D']);
    expect(countsLine(open)).toBe('You 2 cards, Pip 1 card');
    expect(resultSentence(open)).toBe('Unfinished after 0 flips: You 2 cards, Pip 1 card.');
    const limit = { ...open, over: true, endedBy: 'limit' as const, winner: 0 as const, flips: 40 };
    expect(resultSentence(limit)).toBe('You won after 40 flips: You 2 cards, Pip 1 card.');
    expect(resultSentence({ ...limit, winner: 1 })).toBe('Pip won after 40 flips: You 2 cards, Pip 1 card.');
    expect(resultSentence({ ...open, over: true, endedBy: 'cards', winner: 0 })).toBe('You won all 52 cards!');
    expect(NAMES).toEqual(['You', 'Pip']);
  });
});

// ── simulated games ──────────────────────────────────────────────────────────

describe('simulated games', () => {
  const playOut = (seed: number, limit: number, checkEveryFlip: boolean) => {
    const rng = mulberry32(seed);
    let s = newGame(limit, rng);
    let guard = 0;
    let wars = 0;
    while (!s.over) {
      if (guard++ > limit + 5) throw new Error(`game ${seed} ran past its limit`);
      const r = flipRound(s, rng);
      if (!r) throw new Error(`game ${seed}: no flip available`);
      wars += r.round.battles.length - 1;
      s = r.state;
      if (checkEveryFlip) {
        const bad = validateState(s);
        if (bad) throw new Error(`game ${seed} flip ${guard}: ${bad}`);
      }
    }
    return { s, wars };
  };

  it('10,000 whole games all end within the 600-flip limit, with 52 distinct cards', () => {
    expect(WHOLE_LIMIT).toBe(600);
    expect(LENGTH_FLIPS.whole).toBe(WHOLE_LIMIT);
    let byCards = 0;
    let byLimit = 0;
    let wars = 0;
    let totalFlips = 0;
    for (let seed = 1; seed <= 10000; seed++) {
      const { s, wars: w } = playOut(seed, WHOLE_LIMIT, seed <= 300);
      expect(s.over).toBe(true);
      expect(s.flips).toBeLessThanOrEqual(WHOLE_LIMIT);
      expect(s.endedBy === 'cards' || s.endedBy === 'limit').toBe(true);
      if (s.endedBy === 'cards') { byCards += 1; expect(s.flips).toBeLessThanOrEqual(WHOLE_LIMIT); } else { byLimit += 1; expect(s.flips).toBe(WHOLE_LIMIT); }
      expect(everyCard(s)).toHaveLength(DECK);
      wars += w;
      totalFlips += s.flips;
    }
    expect(byCards + byLimit).toBe(10000);
    expect(byCards).toBeGreaterThan(8000); // most whole games finish by themselves
    expect(byLimit).toBeGreaterThan(0); // and the limit is what ends the long ones
    expect(wars).toBeGreaterThan(0);
    expect(totalFlips / 10000).toBeGreaterThan(100);
    expect(totalFlips / 10000).toBeLessThan(400);
  }, 180_000);

  it('quick and medium games stop exactly at their flip limit unless someone runs out first', () => {
    for (const len of LENGTHS) {
      const limit = LENGTH_FLIPS[len];
      for (let seed = 1; seed <= 300; seed++) {
        const { s } = playOut(seed, limit, false);
        expect(s.over).toBe(true);
        if (s.endedBy === 'limit') expect(s.flips).toBe(limit);
        else expect(s.flips).toBeLessThanOrEqual(limit);
        if (s.endedBy === 'limit') {
          const c0 = cardsOf(s, 0);
          const c1 = cardsOf(s, 1);
          expect(s.winner).toBe(c0 > c1 ? 0 : c1 > c0 ? 1 : -1);
        }
      }
    }
  });

  it('the same seed gives exactly the same game', () => {
    const a = playOut(777, 600, false);
    const b = playOut(777, 600, false);
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
  });

  it('the smallest limit is one flip', () => {
    const { s } = playOut(5, 1, true);
    expect(s.flips).toBe(1);
    expect(s.over).toBe(true);
  });
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk to a fresh zeroed object', () => {
    for (const bad of [null, undefined, NaN, 'x', 5, [], [1, 2], () => 0, true]) expect(sanitizeStore(bad)).toEqual({ p: 0, w: 0, b: 0 });
    expect(sanitizeStore({ p: NaN, w: -1, b: 99 })).toEqual({ p: 0, w: 0, b: 0 });
    expect(sanitizeStore({ p: '5', w: 1.5, b: Infinity })).toEqual({ p: 0, w: 0, b: 0 });
    expect(sanitizeStore({ p: MAX_COUNT + 1, w: 1, b: 53 })).toEqual({ p: 0, w: 0, b: 0 });
  });
  it('keeps good values, never more wins than games, ignores prototype and extra keys', () => {
    expect(sanitizeStore({ p: 10, w: 4, b: 14 })).toEqual({ p: 10, w: 4, b: 14 });
    expect(sanitizeStore({ p: 3, w: 8, b: 52 })).toEqual({ p: 3, w: 3, b: 52 });
    const out = sanitizeStore(JSON.parse('{"__proto__":{"p":5},"p":2,"w":1,"b":9,"extra":1}'));
    expect(out).toEqual({ p: 2, w: 1, b: 9 });
    expect(Object.keys(out).sort()).toEqual(['b', 'p', 'w']);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":5}}'))).toEqual({ p: 0, w: 0, b: 0 });
  });
  it('recordGame counts games and wins and keeps the biggest pile, bounded', () => {
    const a = recordGame({ p: 0, w: 0, b: 0 }, true, 10);
    expect(a).toEqual({ store: { p: 1, w: 1, b: 10 }, record: true });
    expect(recordGame(a.store, false, 6)).toEqual({ store: { p: 2, w: 1, b: 10 }, record: false });
    expect(recordGame(a.store, true, 99).store.b).toBe(52);
    expect(recordGame(a.store, true, NaN).store.b).toBe(10);
    expect(recordGame({ p: MAX_COUNT, w: MAX_COUNT, b: 0 }, true, 2).store.p).toBe(MAX_COUNT);
  });
});

// ── what the page promises ───────────────────────────────────────────────────

describe('page', () => {
  it('the computer pause is a fixed 400 to 800 ms and shorter for reduced motion', () => {
    expect(AI_DELAY_MS).toBeGreaterThanOrEqual(400);
    expect(AI_DELAY_MS).toBeLessThanOrEqual(800);
    expect(AI_DELAY_REDUCED_MS).toBeLessThan(AI_DELAY_MS);
    expect(calculatorSource).toMatch(/AI_DELAY_MS/);
    expect(calculatorSource).toMatch(/AI_DELAY_REDUCED_MS/);
  });
  it('auto-play speeds are ordered slow to fast and the lengths are 15, 40 and the 600 limit', () => {
    expect(SPEEDS).toEqual(['slow', 'normal', 'fast']);
    expect(SPEED_MS.slow).toBeGreaterThan(SPEED_MS.normal);
    expect(SPEED_MS.normal).toBeGreaterThan(SPEED_MS.fast);
    expect(LENGTH_FLIPS).toEqual({ quick: 15, medium: 40, whole: 600 });
    expect(calculatorSource).toMatch(/600 flips/);
  });
  it('has a big Flip button, an auto-play switch, and stops everything when the tab is hidden or the page leaves', () => {
    expect(calculatorSource).toMatch(/id="crw-flip"/);
    expect(calculatorSource).toMatch(/id="crw-auto"[^>]*aria-pressed/);
    expect(calculatorSource).toMatch(/visibilitychange/);
    expect(calculatorSource).toMatch(/astro:before-swap/);
    expect(calculatorSource).toMatch(/clearTimeout/);
  });
  it('uses crypto for the seed, the seeded generator for play and the right storage key', () => {
    expect(calculatorSource).toMatch(/crypto\.getRandomValues/);
    expect(calculatorSource).toMatch(/mulberry32/);
    expect(calculatorSource).toContain("'gk:game:card-war'");
  });
  it('has a live status line and a how-it-works section', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/<details/);
  });
  it('swallows key repeats on every button and uses darker text colours for the names and WAR caption on the light theme', () => {
    expect(calculatorSource).toMatch(/app\.addEventListener\('keydown'[\s\S]{0,300}e\.preventDefault\(\)/);
    expect(calculatorSource).toMatch(/\.theme-light #crw-app \{[\s\S]*?--crw-you-text: color-mix\(in oklch, var\(--crw-you\) 50%, var\(--color-text-primary\)\)/);
    expect(calculatorSource).toMatch(/\.crw-name \{ color: var\(--crw-you-text\)/);
    expect(calculatorSource).toMatch(/data-kind="war"\] \.crw-cap \{ color: var\(--crw-war-text\)/);
  });
});
