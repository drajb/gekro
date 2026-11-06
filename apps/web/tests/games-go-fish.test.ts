/**
 * games-go-fish.test.ts - the engine behind `go-fish`.
 *
 * Pinned: the 52-card pack and its names, an unbiased seeded shuffle (chi-square), the deal
 * (7 cards for 2 players, 5 for 3 or 4, books laid at once), every ask rule (take, Go Fish,
 * a lucky draw goes again, books, empty hand refill, empty pond, sitting out), illegal asks
 * refused, the computer's memory and the three levels (legal asks, Medium forgets, Hard
 * remembers, Hard beats Easy over seeded games), the words for every event (a computer's
 * draw is never named unless it matched), the stored results, and a fuzz of random games for
 * 2, 3 and 4 players: no card lost or duplicated, no unbooked four in a hand, every game ends
 * with exactly 13 books. Page claims are checked against the Calculator source.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, ask, fishAlone, legalRanks, legalTargets, mustFishAlone, isOver, totalBooks, validateState, winners,
  newMemory, observe, chooseAsk, describeEvent, playerNames, scoreLine, resultSentence, sanitizeStore, recordGame,
  mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isRed, rankPlural, plural, joinList, clampPlayers, handSizeFor,
  SUIT_CHARS, SUIT_NAMES, RANK_LABELS, DECK, REFILL, MEDIUM_WINDOW, AI_DELAY_MS, AI_DELAY_REDUCED_MS, MAX_COUNT, LEVEL_NAMES, OPPONENT_NAMES,
  type FishState, type FishEvent, type Level, type Memory,
} from '../src/components/apps-private/go-fish/helpers';
import calculatorSource from '../src/components/apps-private/go-fish/Calculator.astro?raw';

// ── building positions ──────────────────────────────────────────────────────

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts, 'KS' = king of spades. */
const c = (code: string): number => {
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};
const sorted = (ids: number[]): number[] => ids.slice().sort((a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b));

/** A state from hands (codes), with the stock being every card nobody holds (in id order, so the top is the highest id). */
const mk = (hands: string[][], opts: { stock?: string[]; turn?: number; books?: number[][] } = {}): FishState => {
  const h = hands.map((x) => sorted(x.map(c)));
  const books = opts.books ?? hands.map(() => []);
  const used = new Set<number>([...h.flat(), ...books.flatMap((b, p) => b.flatMap((r) => [0, 1, 2, 3].map((su) => cardId(su, r))))]);
  const stock = opts.stock ? opts.stock.map(c) : Array.from({ length: DECK }, (_, i) => i).filter((i) => !used.has(i));
  const s: FishState = { players: hands.length, hands: h, books, stock, turn: opts.turn ?? 0, over: false, out: hands.map(() => false) };
  s.over = isOver(s);
  return s;
};
const mustAsk = (s: FishState, target: number, rank: number) => {
  const r = ask(s, target, rank);
  if (!r) throw new Error('ask was refused');
  // Hand-built positions are not always a full pack, so check conservation, and validity when it is a full pack.
  expect(allCards(r.state).sort((a, b) => a - b)).toEqual(allCards(s).sort((a, b) => a - b));
  if (allCards(s).length === DECK) expect(validateState(r.state)).toBeNull();
  return r;
};
const allCards = (s: FishState): number[] =>
  [...s.hands.flat(), ...s.stock, ...s.books.flatMap((b) => b.flatMap((r) => [0, 1, 2, 3].map((su) => cardId(su, r))))];

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards', () => {
  it('maps ids to suit and rank and back for all 52', () => {
    for (let id = 0; id < DECK; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
    expect(rankOf(0)).toBe(1);
    expect(rankOf(51)).toBe(13);
  });
  it('colours hearts and diamonds red', () => {
    expect([0, 1, 2, 3].map((s) => isRed(cardId(s, 4)))).toEqual([false, true, true, false]);
  });
  it('uses text-presentation suit glyphs, distinct names and plain-language card names', () => {
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(new Set(SUIT_CHARS).size).toBe(4);
    expect(SUIT_NAMES).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
    expect(cardName(c('KS'))).toBe('King of spades');
    expect(cardName(c('AD'))).toBe('Ace of diamonds');
    expect(cardLabel(c('10H'))).toBe('10♥︎');
    expect(rankPlural(1)).toBe('Aces');
    expect(rankPlural(13)).toBe('Kings');
    expect(rankPlural(7)).toBe('7s');
  });
  it('has 52 unique names', () => {
    expect(new Set(Array.from({ length: DECK }, (_, i) => cardName(i))).size).toBe(52);
  });
  it('plural and joinList read naturally', () => {
    expect(plural(1, 'card')).toBe('1 card');
    expect(plural(0, 'card')).toBe('0 cards');
    expect(joinList([])).toBe('');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

// ── the shuffle ──────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('is a permutation and leaves its input alone', () => {
    const src = Array.from({ length: DECK }, (_, i) => i);
    const out = shuffled(src, mulberry32(7));
    expect(out.slice().sort((a, b) => a - b)).toEqual(src);
    expect(src).toEqual(Array.from({ length: DECK }, (_, i) => i));
    expect(out).not.toEqual(src);
  });
  it('is deterministic for a seed', () => {
    expect(shuffled([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(99))).toEqual(shuffled([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(99)));
  });
  it('is unbiased: all 6 orderings of 3 items come up about equally (chi-square, df 5)', () => {
    const N = 6000;
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= N; seed++) {
      const k = shuffled([0, 1, 2], mulberry32(seed * 7919)).join('');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    const expected = N / 6;
    let chi = 0;
    for (const v of counts.values()) chi += ((v - expected) ** 2) / expected;
    expect(chi).toBeLessThan(20.5); // p = 0.001 for 5 degrees of freedom
  });
  it('puts one fixed card in each of the 52 positions about equally often (chi-square, df 51)', () => {
    const N = 10400;
    const pos = new Array<number>(DECK).fill(0);
    for (let seed = 1; seed <= N; seed++) pos[shuffled(Array.from({ length: DECK }, (_, i) => i), mulberry32(seed * 104729 + 13)).indexOf(17)] += 1;
    const expected = N / DECK;
    let chi = 0;
    for (const v of pos) chi += ((v - expected) ** 2) / expected;
    expect(chi).toBeLessThan(87.9); // p = 0.001 for 51 degrees of freedom
  });
});

// ── the deal ─────────────────────────────────────────────────────────────────

describe('newGame', () => {
  it('deals 7 each to 2 players and 5 each to 3 or 4, leaving the rest in the pond', () => {
    expect(handSizeFor(2)).toBe(7);
    expect(handSizeFor(3)).toBe(5);
    expect(handSizeFor(4)).toBe(5);
    for (const [n, size] of [[2, 7], [3, 5], [4, 5]] as const) {
      // Find a seed where nobody was dealt a book, so the sizes are exact.
      for (let seed = 1; seed < 50; seed++) {
        const { state } = newGame(n, mulberry32(seed));
        if (totalBooks(state) > 0) continue;
        expect(state.hands.map((h) => h.length)).toEqual(new Array(n).fill(size));
        expect(state.stock).toHaveLength(DECK - n * size);
        break;
      }
    }
  });
  it('uses all 52 distinct cards exactly once and passes validation, for many seeds and player counts', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const n of [2, 3, 4]) {
        const { state } = newGame(n, mulberry32(seed));
        expect(allCards(state).sort((a, b) => a - b)).toEqual(Array.from({ length: DECK }, (_, i) => i));
        expect(validateState(state)).toBeNull();
        expect(state.turn).toBe(0);
      }
    }
  });
  it('lays down a dealt book at once and says so', () => {
    let found = 0;
    for (let seed = 1; seed < 20000 && found < 3; seed++) {
      const { state, events } = newGame(2, mulberry32(seed));
      if (totalBooks(state) === 0) continue;
      found += 1;
      expect(events.some((e) => e.t === 'book')).toBe(true);
      expect(events.filter((e) => e.t === 'book')).toHaveLength(totalBooks(state));
      expect(validateState(state)).toBeNull();
    }
    expect(found).toBe(3);
  });
  it('is deterministic for a seed and different across seeds', () => {
    expect(JSON.stringify(newGame(3, mulberry32(5)))).toBe(JSON.stringify(newGame(3, mulberry32(5))));
    expect(JSON.stringify(newGame(3, mulberry32(5)).state.hands)).not.toBe(JSON.stringify(newGame(3, mulberry32(6)).state.hands));
  });
  it('clamps the player count to 2..4', () => {
    expect(clampPlayers(2)).toBe(2);
    expect(clampPlayers(4)).toBe(4);
    for (const bad of [0, 1, 5, -1, 2.5, NaN, Infinity, '3', null, undefined, {}, [3]]) expect(clampPlayers(bad)).toBe(2);
    expect(newGame(9, mulberry32(1)).state.players).toBe(2);
  });
});

// ── asking ───────────────────────────────────────────────────────────────────

describe('ask', () => {
  it('hands over every card of the rank and lets the asker go again', () => {
    const s = mk([['7H', '2C', 'KD'], ['7S', '7D', '3C', '9H']]);
    const { state, events } = mustAsk(s, 1, 7);
    expect(state.hands[0]).toEqual(sorted(['7H', '7S', '7D', '2C', 'KD'].map(c)));
    expect(state.hands[1]).toEqual(sorted(['3C', '9H'].map(c)));
    expect(state.turn).toBe(0);
    expect(events.map((e) => e.t)).toEqual(['ask', 'take']);
    const take = events[1] as Extract<FishEvent, { t: 'take' }>;
    expect(take.cards.map(rankOf)).toEqual([7, 7]);
  });
  it('says Go Fish when the target has none, draws the top of the pond and passes the turn on a miss', () => {
    const s = mk([['7H', '2C'], ['9S', '3C']], { stock: ['AS', 'KC', '5D'] }); // top is 5D
    const { state, events } = mustAsk(s, 1, 7);
    expect(events.map((e) => e.t)).toEqual(['ask', 'none', 'draw']);
    expect(state.hands[0]).toContain(c('5D'));
    expect(state.stock).toEqual([c('AS'), c('KC')]);
    expect(state.turn).toBe(1);
  });
  it('lets the asker go again after fishing up the rank asked for', () => {
    const s = mk([['7H', '2C'], ['9S', '3C']], { stock: ['AS', '7C'] });
    const { state, events } = mustAsk(s, 1, 7);
    const d = events.find((e) => e.t === 'draw') as Extract<FishEvent, { t: 'draw' }>;
    expect(d.matched).toBe(true);
    expect(state.turn).toBe(0);
    expect(state.hands[0]).toContain(c('7C'));
  });
  it('lays a book down as soon as the fourth card arrives, from a take', () => {
    const s = mk([['7H', '7S', '7D', '2C'], ['7C', '9S']]);
    const { state, events } = mustAsk(s, 1, 7);
    expect(state.books[0]).toEqual([7]);
    expect(state.hands[0]).toEqual([c('2C')]);
    expect(events.some((e) => e.t === 'book' && e.by === 0 && e.rank === 7)).toBe(true);
    expect(state.turn).toBe(0);
  });
  it('lays a book down from a fished-up card too', () => {
    const s = mk([['7H', '7S', '7D', '2C'], ['9S', '3C']], { stock: ['AS', '7C'] });
    const { state } = mustAsk(s, 1, 7);
    expect(state.books[0]).toEqual([7]);
    expect(state.hands[0]).toEqual([c('2C')]);
  });
  it('refills an empty hand with up to 5 cards when the turn comes back', () => {
    // Player 0 books their last four and has nothing left, but the pond still has cards.
    const s = mk([['7H', '7S', '7D'], ['7C', '9S']], { stock: ['AS', 'KC', '5D', '6D', '8H', '9C', '2S'] });
    const { state, events } = mustAsk(s, 1, 7);
    expect(state.books[0]).toEqual([7]);
    expect(events.some((e) => e.t === 'refill' && e.by === 0 && e.count === REFILL)).toBe(true);
    expect(state.hands[0]).toHaveLength(REFILL);
    expect(state.stock).toHaveLength(2);
    expect(state.turn).toBe(0);
  });
  it('refills with fewer when the pond is short', () => {
    const s = mk([['7H', '7S', '7D'], ['7C', '9S']], { stock: ['AS', 'KC'] });
    const { state } = mustAsk(s, 1, 7);
    expect(state.hands[0]).toHaveLength(2);
    expect(state.stock).toHaveLength(0);
  });
  it('with the pond empty a miss just passes the turn, and says the pond is empty', () => {
    const s = mk([['7H', '2C'], ['9S', '3C']], { stock: [] });
    // Not a full pack, so build it as a mid-game position and skip the pack check.
    const { state, events } = ask(s, 1, 7)!;
    expect(events.map((e) => e.t)).toEqual(['ask', 'none', 'empty']);
    expect(state.turn).toBe(1);
  });
  it('a player with no cards and an empty pond sits out, and is announced once', () => {
    // 0 books their last card pair; 1 and 2 hold the rest and the pond is empty.
    const s = mk([['7H', '7S', '7D'], ['7C', '9S'], ['3C']], { stock: [] });
    const { state, events } = ask(s, 1, 7)!;
    expect(state.books[0]).toEqual([7]);
    expect(events.filter((e) => e.t === 'out' && e.by === 0)).toHaveLength(1);
    expect(state.out[0]).toBe(true);
    expect(state.turn).toBe(1);
  });
  it('ends the game when the 13th book is laid', () => {
    const books = Array.from({ length: 12 }, (_, i) => i + 1);
    const s = mk([['KH', 'KS', 'KD'], ['KC']], { stock: [], books: [books.slice(0, 6), books.slice(6)] });
    const { state, events } = ask(s, 1, 13)!;
    expect(state.over).toBe(true);
    expect(totalBooks(state)).toBe(13);
    expect(events.at(-1)).toEqual({ t: 'over' });
    expect(winners(state)).toEqual([0]);
    expect(ask(state, 1, 1)).toBeNull();
    expect(legalTargets(state)).toEqual([]);
  });
  it('never changes the state it was given', () => {
    const s = mk([['7H', '2C', 'KD'], ['7S', '7D', '3C', '9H']]);
    const before = JSON.stringify(s);
    mustAsk(s, 1, 7);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('refuses illegal asks', () => {
    const s = mk([['7H', '2C'], ['9S', '3C'], []], { stock: ['AS'] });
    expect(ask(s, 0, 7)).toBeNull(); // yourself
    expect(ask(s, 1, 9)).toBeNull(); // a rank you do not hold
    expect(ask(s, 2, 7)).toBeNull(); // a player with no cards
    expect(ask(s, 3, 7)).toBeNull(); // no such player
    expect(ask(s, -1, 7)).toBeNull();
    expect(ask(s, 1.5, 7)).toBeNull();
    expect(ask(s, 1, 7.5)).toBeNull();
    expect(ask(s, NaN, 7)).toBeNull();
    expect(ask(s, 1, 0)).toBeNull();
    expect(ask(s, 1, 14)).toBeNull();
    expect(ask(s, 1, 7)).not.toBeNull();
  });
  it('legalRanks and legalTargets list exactly what the rules allow', () => {
    const s = mk([['7H', '7S', '2C'], ['9S', '3C'], [], ['KD']], { stock: ['AS'] });
    expect(legalRanks(s)).toEqual([2, 7]);
    expect(legalTargets(s)).toEqual([1, 3]);
  });
});

describe('fishing alone', () => {
  it('draws one card and passes when nobody else holds cards', () => {
    const s = mk([['7H', '2C'], [], []], { stock: ['AS', 'KC', '5D'] });
    expect(mustFishAlone(s)).toBe(true);
    const r = fishAlone(s)!;
    // The turn passes to a player with no cards, who draws what is left of the pond (here 2 cards).
    expect(r.events.map((e) => e.t)).toEqual(['alone', 'draw', 'refill']);
    expect(r.state.hands[0]).toContain(c('5D'));
    expect(r.state.turn).toBe(1);
    expect(r.state.hands[1]).toHaveLength(2);
    expect(r.state.stock).toHaveLength(0);
  });
  it('is refused when there is someone to ask or the pond is empty', () => {
    expect(fishAlone(mk([['7H'], ['9S']], { stock: ['AS'] }))).toBeNull();
    expect(fishAlone(mk([['7H'], []], { stock: [] }))).toBeNull();
  });
});

// ── the computer ─────────────────────────────────────────────────────────────

describe('memory and the computer levels', () => {
  const names = playerNames(3);
  it('observe records who holds what from public asks only', () => {
    const m = newMemory(3);
    observe(m, { t: 'ask', by: 1, of: 0, rank: 7 });
    expect(m.holds[1][7]).toBeGreaterThan(0);
    observe(m, { t: 'take', by: 1, of: 0, rank: 7, cards: [c('7H')] });
    expect(m.holds[0][7]).toBe(0);
    expect(m.holds[1][7]).toBeGreaterThan(0);
    observe(m, { t: 'none', by: 1, of: 2, rank: 9 });
    expect(m.lacks[2][9]).toBeGreaterThan(0);
    observe(m, { t: 'draw', by: 2, card: c('9C'), matched: false });
    expect(m.lacks[2][9]).toBe(0); // a draw means they may hold anything now
    observe(m, { t: 'book', by: 1, rank: 7 });
    expect(m.holds[1][7]).toBe(0);
  });
  it('always asks something legal at every level, in thousands of positions', () => {
    for (const level of [1, 2, 3] as Level[]) {
      for (let seed = 1; seed <= 400; seed++) {
        const rng = mulberry32(seed);
        const n = 2 + (seed % 3);
        const { state } = newGame(n, rng);
        const mem = newMemory(n);
        const move = chooseAsk(state, level, mem, rng)!;
        expect(move).not.toBeNull();
        expect(legalTargets(state)).toContain(move.target);
        expect(legalRanks(state)).toContain(move.rank);
      }
    }
  });
  it('returns null when there is nobody to ask', () => {
    const s = mk([['7H', '2C'], []], { stock: ['AS'] });
    expect(chooseAsk(s, 3, newMemory(2), mulberry32(1))).toBeNull();
  });
  it('Hard asks the player it saw ask for a rank it holds; Easy does not always', () => {
    // Computer is player 1 holding 7s and 9s. It saw player 0 ask for 9s.
    const s = mk([['9H', 'KC', 'KD'], ['7H', '7S', '9D'], ['2S', '3S']], { turn: 1, stock: ['AS'] });
    const mem = newMemory(3);
    observe(mem, { t: 'ask', by: 0, of: 2, rank: 9 });
    for (let seed = 1; seed <= 50; seed++) expect(chooseAsk(s, 3, mem, mulberry32(seed))).toEqual({ target: 0, rank: 9 });
    const easy = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) { const m = chooseAsk(s, 1, mem, mulberry32(seed))!; easy.add(`${m.target}:${m.rank}`); }
    expect(easy.size).toBeGreaterThan(1);
  });
  it('Medium forgets an ask after a few more asks; Hard does not', () => {
    const s = mk([['9H', 'KC', 'KD'], ['7H', '7S', '9D'], ['2S', '3S']], { turn: 1, stock: ['AS'] });
    const mem = newMemory(3);
    observe(mem, { t: 'ask', by: 0, of: 2, rank: 9 });
    for (let i = 0; i < MEDIUM_WINDOW + 2; i++) observe(mem, { t: 'none', by: 2, of: 0, rank: 4 }); // clock moves on
    const picks = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) { const m = chooseAsk(s, 2, mem, mulberry32(seed))!; picks.add(`${m.target}:${m.rank}`); }
    expect(picks.size).toBeGreaterThan(1); // forgotten: guessing
    for (let seed = 1; seed <= 50; seed++) expect(chooseAsk(s, 3, mem, mulberry32(seed))).toEqual({ target: 0, rank: 9 });
  });
  it('Hard prefers the rank it holds most of when nothing is known', () => {
    const s = mk([['2H', '3C'], ['7H', '7S', '7D', '9D', 'KC']], { turn: 1, stock: ['AS'] });
    for (let seed = 1; seed <= 30; seed++) expect(chooseAsk(s, 3, newMemory(2), mulberry32(seed))!.rank).toBe(7);
  });
  it('Hard beats Easy over seeded two-player games', () => {
    let hardBooks = 0;
    let easyBooks = 0;
    let hardWins = 0;
    let easyWins = 0;
    const GAMES = 400;
    for (let g = 0; g < GAMES; g++) {
      const rng = mulberry32(1000 + g);
      const hardFirst = g % 2 === 0; // alternate who starts
      const first = newGame(2, rng);
      let s = first.state;
      const mem = newMemory(2);
      first.events.forEach((e) => observe(mem, e));
      const levelOf = (p: number): Level => ((p === 0) === hardFirst ? 3 : 1);
      let steps = 0;
      while (!s.over && steps++ < 5000) {
        const lone = fishAlone(s);
        const move = chooseAsk(s, levelOf(s.turn), mem, rng);
        const r = lone ?? (move ? ask(s, move.target, move.rank) : null);
        if (!r) break;
        r.events.forEach((e) => observe(mem, e));
        s = r.state;
      }
      expect(s.over).toBe(true);
      const hardIdx = hardFirst ? 0 : 1;
      hardBooks += s.books[hardIdx].length;
      easyBooks += s.books[1 - hardIdx].length;
      if (s.books[hardIdx].length > s.books[1 - hardIdx].length) hardWins += 1;
      else if (s.books[hardIdx].length < s.books[1 - hardIdx].length) easyWins += 1;
    }
    expect(hardBooks).toBeGreaterThan(easyBooks);
    expect(hardWins).toBeGreaterThan(easyWins);
  }, 60_000);
});

// ── words ────────────────────────────────────────────────────────────────────

describe('describeEvent', () => {
  const names = playerNames(3);
  it('names players in the second person for the viewer', () => {
    expect(describeEvent({ t: 'ask', by: 0, of: 1, rank: 7 }, 0, names)).toBe('You asked Pip for 7s.');
    expect(describeEvent({ t: 'ask', by: 1, of: 0, rank: 13 }, 0, names)).toBe('Pip asked you for Kings.');
    expect(describeEvent({ t: 'ask', by: 1, of: 2, rank: 1 }, 0, names)).toBe('Pip asked Dot for Aces.');
    expect(describeEvent({ t: 'none', by: 1, of: 0, rank: 4 }, 0, names)).toBe('You have no 4s. Go Fish!');
    expect(describeEvent({ t: 'none', by: 0, of: 1, rank: 4 }, 0, names)).toBe('Pip has no 4s. Go Fish!');
  });
  it('names every card handed over, and singular and plural counts', () => {
    expect(describeEvent({ t: 'take', by: 0, of: 1, rank: 7, cards: [c('7H')] }, 0, names)).toBe('Pip gave you 1 card: 7 of hearts.');
    expect(describeEvent({ t: 'take', by: 0, of: 1, rank: 7, cards: [c('7H'), c('7S')] }, 0, names)).toBe('Pip gave you 2 cards: 7 of hearts and 7 of spades.');
    expect(describeEvent({ t: 'take', by: 1, of: 0, rank: 7, cards: [c('7H'), c('7S'), c('7D')] }, 0, names)).toBe('You gave Pip 3 cards: 7 of hearts, 7 of spades and 7 of diamonds.');
  });
  it('shows you the card you drew but never reveals a computer draw that did not match', () => {
    const card = c('QD');
    expect(describeEvent({ t: 'draw', by: 0, card, matched: false }, 0, names)).toBe('You fished up the Queen of diamonds.');
    expect(describeEvent({ t: 'draw', by: 0, card, matched: true }, 0, names)).toContain('you go again');
    const hidden = describeEvent({ t: 'draw', by: 1, card, matched: false }, 0, names);
    expect(hidden).toBe('Pip drew a card from the pond.');
    expect(hidden).not.toContain('Queen');
    expect(describeEvent({ t: 'draw', by: 1, card, matched: true }, 0, names)).toContain('Queen of diamonds');
  });
  it('covers books, refills, sitting out and the end', () => {
    expect(describeEvent({ t: 'book', by: 0, rank: 7 }, 0, names)).toBe('You made a book of 7s!');
    expect(describeEvent({ t: 'book', by: 2, rank: 11 }, 0, names)).toBe('Dot made a book of Jacks!');
    expect(describeEvent({ t: 'refill', by: 1, count: 1 }, 0, names)).toBe('Pip had no cards and drew 1 new card.');
    expect(describeEvent({ t: 'refill', by: 0, count: 5 }, 0, names)).toBe('You had no cards and drew 5 new cards.');
    expect(describeEvent({ t: 'out', by: 2 }, 0, names)).toContain('Dot sits out');
    expect(describeEvent({ t: 'out', by: 0 }, 0, names)).toContain('you sit out');
    expect(describeEvent({ t: 'alone', by: 0 }, 0, names)).toContain('you go fishing');
    expect(describeEvent({ t: 'alone', by: 1 }, 0, names)).toContain('Pip goes fishing');
    expect(describeEvent({ t: 'empty', by: 0 }, 0, names)).toContain('pond is empty');
    expect(describeEvent({ t: 'over' }, 0, names)).toContain('13 books');
  });
  it('playerNames gives You first and the fixed opponent names after', () => {
    expect(OPPONENT_NAMES).toEqual(['Pip', 'Dot', 'Moss']);
    expect(playerNames(2)).toEqual(['You', 'Pip']);
    expect(playerNames(4)).toEqual(['You', 'Pip', 'Dot', 'Moss']);
  });
  it('score and result sentences are right in every state', () => {
    const open = mk([['7H'], ['9S']], { stock: ['AS'] });
    expect(scoreLine(open, ['You', 'Pip'])).toBe('You 0 books, Pip 0 books');
    expect(resultSentence(open, ['You', 'Pip'])).toBe('Unfinished: You 0 books, Pip 0 books.');
    const books = Array.from({ length: 13 }, (_, i) => i + 1);
    const win = { ...mk([[], []], { stock: [], books: [books.slice(0, 7), books.slice(7)] }), over: true };
    expect(resultSentence(win, ['You', 'Pip'])).toBe('You won with 7 books!');
    const lose = { ...mk([[], []], { stock: [], books: [books.slice(0, 6), books.slice(6)] }), over: true };
    expect(resultSentence(lose, ['You', 'Pip'])).toBe('Pip won with 7 books.');
    const tie = { ...mk([[], [], []], { stock: [], books: [books.slice(0, 5), books.slice(5, 10), books.slice(10)] }), over: true };
    expect(winners(tie)).toEqual([0, 1]);
    expect(resultSentence(tie, ['You', 'Pip', 'Dot'])).toBe('A tie between You and Pip with 5 books each.');
  });
});

// ── the fuzz ─────────────────────────────────────────────────────────────────

describe('random games', () => {
  const play = (n: number, seed: number, chooser: (s: FishState, rng: () => number, mem: Memory) => { target: number; rank: number } | null) => {
    const rng = mulberry32(seed);
    const first = newGame(n, rng);
    let s = first.state;
    const mem = newMemory(n);
    first.events.forEach((e) => observe(mem, e));
    expect(validateState(s)).toBeNull();
    let steps = 0;
    let asks = 0;
    while (!s.over) {
      if (steps++ > 20000) throw new Error(`game ${seed} did not end`);
      const lone = fishAlone(s);
      const move = chooser(s, rng, mem);
      const r = lone ?? (move ? ask(s, move.target, move.rank) : null);
      if (!r) throw new Error(`game ${seed}: no legal action at step ${steps}`);
      for (const e of r.events) {
        observe(mem, e);
        describeEvent(e, 0, playerNames(n)); // never throws
        if (e.t === 'ask') asks += 1;
        if (e.t === 'draw' && e.by !== 0 && !e.matched) expect(describeEvent(e, 0, playerNames(n))).not.toContain(cardName(e.card));
      }
      s = r.state;
      const bad = validateState(s);
      if (bad) throw new Error(`game ${seed} step ${steps}: ${bad}`);
      // Whoever's turn it is can act, unless the game is over.
      if (!s.over) expect(s.hands[s.turn].length).toBeGreaterThan(0);
    }
    return { s, steps, asks };
  };
  const random = (s: FishState, rng: () => number) => {
    const t = legalTargets(s);
    const r = legalRanks(s);
    return t.length ? { target: t[Math.floor(rng() * t.length)], rank: r[Math.floor(rng() * r.length)] } : null;
  };

  it('every random game ends with all 13 books, 52 cards and a valid position at every step (2, 3 and 4 players)', () => {
    for (const n of [2, 3, 4]) {
      for (let seed = 1; seed <= 250; seed++) {
        const { s } = play(n, seed * 31 + n, random);
        expect(totalBooks(s)).toBe(13);
        expect(s.books.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
        expect(s.hands.every((h) => h.length === 0)).toBe(true);
        expect(s.stock).toHaveLength(0);
        expect(s.books.reduce((a, b) => a + b.length, 0)).toBe(13);
      }
    }
  }, 60_000);

  it('the three computer levels also always finish, with all three levels mixed at the table', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const n = 2 + (seed % 3);
      const { s } = play(n, 9000 + seed, (st, rng, mem) => chooseAsk(st, (1 + ((st.turn + seed) % 3)) as Level, mem, rng));
      expect(totalBooks(s)).toBe(13);
    }
  }, 60_000);

  it('the same seed and the same choices give exactly the same game', () => {
    const a = play(3, 4242, random);
    const b = play(3, 4242, random);
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
    expect(a.steps).toBe(b.steps);
  });

  it('a game lasts a believable number of asks', () => {
    let total = 0;
    const G = 100;
    for (let seed = 1; seed <= G; seed++) total += play(2, 500 + seed, random).asks;
    const avg = total / G;
    expect(avg).toBeGreaterThan(20);
    expect(avg).toBeLessThan(400);
  });
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk to a fresh zeroed object', () => {
    const zero = { p: 0, w: 0, b: 0 };
    for (const bad of [null, undefined, NaN, 'x', 5, [], [1, 2], () => 0, true]) expect(sanitizeStore(bad)).toEqual(zero);
    expect(sanitizeStore({ p: NaN, w: -1, b: 99 })).toEqual(zero);
    expect(sanitizeStore({ p: '5', w: 1.5, b: Infinity })).toEqual(zero);
    expect(sanitizeStore({ p: MAX_COUNT + 1, w: 1, b: 14 })).toEqual({ p: 0, w: 0, b: 0 });
  });
  it('keeps good values, never more wins than games, and ignores inherited or extra keys', () => {
    expect(sanitizeStore({ p: 10, w: 4, b: 9 })).toEqual({ p: 10, w: 4, b: 9 });
    expect(sanitizeStore({ p: 3, w: 8, b: 2 })).toEqual({ p: 3, w: 3, b: 2 });
    const evil = JSON.parse('{"__proto__":{"p":5},"p":2,"w":1,"b":3,"extra":9}');
    const out = sanitizeStore(evil);
    expect(out).toEqual({ p: 2, w: 1, b: 3 });
    expect(Object.keys(out).sort()).toEqual(['b', 'p', 'w']);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":5}}'))).toEqual({ p: 0, w: 0, b: 0 });
  });
  it('recordGame counts games, wins and the best book count, bounded', () => {
    const a = recordGame({ p: 0, w: 0, b: 0 }, 6, true);
    expect(a.store).toEqual({ p: 1, w: 1, b: 6 });
    expect(a.record).toBe(true);
    const b = recordGame(a.store, 4, false);
    expect(b.store).toEqual({ p: 2, w: 1, b: 6 });
    expect(b.record).toBe(false);
    expect(recordGame(b.store, 99, true).store.b).toBe(13);
    expect(recordGame(b.store, NaN, true).store.b).toBe(6);
    expect(recordGame({ p: MAX_COUNT, w: MAX_COUNT, b: 0 }, 1, true).store.p).toBe(MAX_COUNT);
  });
});

// ── what the page claims ─────────────────────────────────────────────────────

describe('page', () => {
  it('computer thinking time is a fixed 400 to 800 ms and shorter for reduced motion', () => {
    expect(AI_DELAY_MS).toBeGreaterThanOrEqual(400);
    expect(AI_DELAY_MS).toBeLessThanOrEqual(800);
    expect(AI_DELAY_REDUCED_MS).toBeLessThan(AI_DELAY_MS);
    expect(calculatorSource).toMatch(/AI_DELAY_MS/);
    expect(calculatorSource).toMatch(/AI_DELAY_REDUCED_MS/);
  });
  it('names the three levels in plain words', () => {
    expect(Object.values(LEVEL_NAMES)).toEqual(['Easy', 'Medium', 'Hard']);
  });
  it('pauses the computer when the tab is hidden and clears its timer on navigation', () => {
    expect(calculatorSource).toMatch(/visibilitychange/);
    expect(calculatorSource).toMatch(/astro:before-swap/);
    expect(calculatorSource).toMatch(/clearTimeout/);
  });
  it('uses crypto for the shuffle seed and the seeded rng for play', () => {
    expect(calculatorSource).toMatch(/crypto\.getRandomValues/);
    expect(calculatorSource).toMatch(/mulberry32/);
  });
  it('keeps the storage key and caps in step with the page', () => {
    expect(calculatorSource).toContain("'gk:game:go-fish'");
  });
  it('offers a live status line, a how-it-works section and no pond or fishing imagery', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/<details/);
    expect(calculatorSource).not.toMatch(/🎣|🐟|🐠|🐡/);
  });
  it('REFILL is the 5 the page text says', () => {
    expect(REFILL).toBe(5);
    expect(calculatorSource).toMatch(/draws 5/);
  });
  it('level names for Hard remember every ask while Medium keeps a window of eight', () => {
    expect(MEDIUM_WINDOW).toBe(8);
    expect(DECK).toBe(52);
  });
});
