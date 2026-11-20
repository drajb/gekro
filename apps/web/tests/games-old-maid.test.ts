/**
 * games-old-maid.test.ts - the engine behind `old-maid`.
 *
 * Pinned: the pack for each size (24, 36 or 52 cards plus the one Star card), an unbiased seeded shuffle
 * (chi-square), the deal (every card dealt, hands differ by at most one, all pairs laid at once, never two cards
 * of one rank in a hand), drawing (a pair is laid when the drawn card matches, the Star card never pairs, both
 * hands are shuffled, an empty hand is safe and out, the turn skips players who are out), illegal draws refused,
 * the computer's pick being uniform over the hidden cards, the kind wording, the stored results, and a fuzz of
 * thousands of random games for 2, 3 and 4 players at every size: no card lost or duplicated at any step, exactly
 * two pairs of every rank laid at the end, every game ends with one player holding only the Star card.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, draw, targetOf, chooseIndex, validateState, packFor, sortCards, playerNames, describeEvent, resultSentence, totalPairs,
  sanitizeStore, recordGame, clampPlayers, clampSize, mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isStar, isRed,
  rankPlural, plural, joinList, SUIT_CHARS, SUIT_NAMES, RANK_LABELS, STAR, SIZES, SIZE_RANKS, SIZE_NAMES, MAX_COUNT, AI_DELAY_MS,
  AI_DELAY_REDUCED_MS, OPPONENT_NAMES, type MaidState, type MaidEvent, type Size,
} from '../src/components/apps-private/old-maid/helpers';
import calculatorSource from '../src/components/apps-private/old-maid/Calculator.astro?raw';

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts, '*' = the Star card. */
const c = (code: string): number => {
  if (code === '*') return STAR;
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};

/**
 * A hand-built position in the 6-rank pack. Every rank that is not fully accounted for by the hands is laid down in pairs
 * by player 0, so the position is a real one (the hands must hold an even number of each rank).
 */
const mk = (hands: string[][], turn = 0): MaidState => {
  const h = hands.map((x) => x.map(c));
  const laid: number[][] = hands.map(() => []);
  for (let r = 1; r <= 6; r++) {
    const held = h.flat().filter((x) => !isStar(x) && rankOf(x) === r).length;
    if ((4 - held) % 2 !== 0) throw new Error(`rank ${r} is held an odd number of times`);
    for (let i = 0; i < (4 - held) / 2; i++) laid[0].push(r);
  }
  const s: MaidState = {
    players: hands.length, size: 'quick', hands: h, laid, turn, out: h.map((x) => x.length === 0), over: false, loser: -1, draws: 0,
  };
  const bad = validateState(s);
  if (bad) throw new Error(`bad test position: ${bad}`);
  return s;
};
const rng0 = mulberry32(1);
const must = (s: MaidState, index: number, rng = rng0) => {
  const r = draw(s, index, rng);
  if (!r) throw new Error('draw was refused');
  expect(validateState(r.state)).toBeNull();
  return r;
};
const kinds = (ev: MaidEvent[]): string[] => ev.map((e) => e.t);
const indexOfCard = (s: MaidState, p: number, code: string): number => s.hands[p].indexOf(c(code));

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards', () => {
  it('maps ids to suit and rank and back, and the Star card has neither', () => {
    for (let id = 0; id < 52; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
    expect(isStar(STAR)).toBe(true);
    expect(rankOf(STAR)).toBe(0);
    expect(suitOf(STAR)).toBe(-1);
    expect(isStar(0)).toBe(false);
    expect(isRed(STAR)).toBe(false);
  });
  it('has plain-language names, text-presentation suit glyphs and a Star label', () => {
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(SUIT_NAMES).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
    expect(cardName(c('KS'))).toBe('King of spades');
    expect(cardName(STAR)).toBe('Star card');
    expect(cardLabel(STAR)).toBe('★︎');
    expect(cardLabel(c('10H'))).toBe('10♥︎');
    expect(rankPlural(1)).toBe('Aces');
    expect(rankPlural(5)).toBe('5s');
    expect(new Set(Array.from({ length: 52 }, (_, i) => cardName(i))).size).toBe(52);
  });
  it('plural and joinList read naturally', () => {
    expect(plural(1, 'pair')).toBe('1 pair');
    expect(plural(0, 'pair')).toBe('0 pairs');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
  it('builds the pack for each size: all four suits of the ranks in play, plus one Star card', () => {
    expect(SIZES).toEqual(['quick', 'medium', 'full']);
    expect(SIZES.map((z) => packFor(z).length)).toEqual([25, 37, 53]);
    expect(SIZES.map((z) => SIZE_RANKS[z])).toEqual([6, 9, 13]);
    for (const z of SIZES) {
      const pack = packFor(z);
      expect(new Set(pack).size).toBe(pack.length);
      expect(pack.filter(isStar).length).toBe(1);
      expect(pack.filter((x) => !isStar(x) && rankOf(x) > SIZE_RANKS[z]).length).toBe(0);
      for (let r = 1; r <= SIZE_RANKS[z]; r++) expect(pack.filter((x) => rankOf(x) === r).length).toBe(4);
    }
    expect(SIZE_NAMES.quick).toMatch(/6 ranks/);
  });
  it('sorts a hand by rank then suit with the Star card last', () => {
    expect(sortCards([STAR, c('5H'), c('2S'), c('5C'), c('AD')])).toEqual([c('AD'), c('2S'), c('5H'), c('5C'), STAR]);
  });
  it('clamps players and size', () => {
    expect([2, 3, 4].map(clampPlayers)).toEqual([2, 3, 4]);
    for (const bad of [0, 1, 5, 2.5, NaN, '3', null, undefined]) expect(clampPlayers(bad)).toBe(3);
    expect(clampSize('full')).toBe('full');
    expect(clampSize('medium')).toBe('medium');
    for (const bad of ['', 'huge', 1, null, undefined]) expect(clampSize(bad)).toBe('quick');
  });
});

// ── the shuffle ──────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('is a permutation, deterministic for a seed, and leaves its input alone', () => {
    const src = Array.from({ length: 25 }, (_, i) => i);
    const out = shuffled(src, mulberry32(7));
    expect(out.slice().sort((a, b) => a - b)).toEqual(src);
    expect(shuffled(src, mulberry32(7))).toEqual(out);
    expect(out).not.toEqual(src);
    expect(src).toEqual(Array.from({ length: 25 }, (_, i) => i));
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
});

// ── the deal ─────────────────────────────────────────────────────────────────

describe('deal', () => {
  it('deals every card, lays every pair at once and never leaves two cards of one rank in a hand (all players and sizes)', () => {
    for (const z of SIZES) {
      for (const n of [2, 3, 4]) {
        for (let seed = 1; seed <= 60; seed++) {
          const { state: s, events } = newGame(n, z, mulberry32(seed * 31 + n));
          expect(validateState(s)).toBeNull();
          const total = packFor(z).length;
          // Every player was dealt floor(total / n) or one more; the first (total mod n) players get the extra card.
          s.hands.forEach((h, p) => {
            const dealt = h.length + 2 * s.laid[p].length;
            expect(dealt).toBe(Math.floor(total / n) + (p < total % n ? 1 : 0));
          });
          // Pair events agree with the laid lists.
          expect(events.filter((e) => e.t === 'pair').length).toBe(totalPairs(s));
          for (const h of s.hands) for (const card of h) expect(h.filter((x) => !isStar(x) && !isStar(card) && rankOf(x) === rankOf(card)).length <= 1).toBe(true);
          expect(s.hands.flat().includes(STAR) || s.over).toBe(true);
        }
      }
    }
  });
  it('is the same for the same seed and different for another', () => {
    expect(newGame(3, 'quick', mulberry32(5)).state).toEqual(newGame(3, 'quick', mulberry32(5)).state);
    expect(newGame(3, 'quick', mulberry32(5)).state.hands).not.toEqual(newGame(3, 'quick', mulberry32(6)).state.hands);
  });
  it('starts with the human, who has cards in almost every deal, and always leaves a valid game', () => {
    let starts = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { state: s } = newGame(3, 'quick', mulberry32(seed));
      expect(validateState(s)).toBeNull();
      if (!s.over && s.turn === 0) starts += 1;
    }
    expect(starts).toBeGreaterThan(290);
  });
  it('gives the Star card to each seat in proportion to the cards that seat is dealt (chi-square, df 2)', () => {
    const N = 3000;
    const got = [0, 0, 0];
    for (let seed = 1; seed <= N; seed++) got[newGame(3, 'quick', mulberry32(seed * 17)).state.hands.findIndex((h) => h.includes(STAR))] += 1;
    // 25 cards to 3 players: 9, 8 and 8.
    const expected = [9, 8, 8].map((k) => (N * k) / 25);
    let chi = 0;
    got.forEach((v, i) => { chi += ((v - expected[i]) ** 2) / expected[i]; });
    expect(chi).toBeLessThan(13.8); // p = 0.001, df 2
  });
});

// ── drawing ──────────────────────────────────────────────────────────────────

describe('drawing', () => {
  it('draws from the next player and lays a pair when the drawn card matches', () => {
    const s = mk([['2H', '5C'], ['2D', '5S'], ['*']]);
    expect(targetOf(s)).toBe(1);
    const r = must(s, indexOfCard(s, 1, '2D'));
    const n = r.state;
    expect(kinds(r.events)).toEqual(['draw', 'pair']);
    expect(n.hands[0]).toEqual([c('5C')]);
    expect(n.hands[1]).toEqual([c('5S')]);
    expect(n.laid[0].filter((x) => x === 2).length).toBe(s.laid[0].filter((x) => x === 2).length + 1);
    expect(n.turn).toBe(1);
    expect(n.draws).toBe(1);
    expect(r.events[1]).toMatchObject({ t: 'pair', by: 0, rank: 2 });
  });
  it('does not lay a pair when the drawn card matches nothing, and keeps the card', () => {
    const s = mk([['2H', '5C'], ['2D', '5S', '3C'], ['3D', '*']]);
    const r = must(s, indexOfCard(s, 1, '3C'));
    expect(r.state.hands[0].slice().sort()).toEqual([c('2H'), c('5C'), c('3C')].sort());
    expect(kinds(r.events)).toEqual(['draw']);
    expect(r.state.turn).toBe(1);
  });
  it('never pairs the Star card, and the holder keeps it', () => {
    const s = mk([['2H', '5C'], ['2D', '5S'], ['*']], 1);
    const r = must(s, 0); // p1 draws from p2: the Star card
    expect(r.state.hands[1]).toContain(STAR);
    expect(r.state.hands[1].length).toBe(3);
    expect(kinds(r.events)).toEqual(['draw', 'out']);
    expect(r.events[1]).toEqual({ t: 'out', p: 2 });
    expect(r.state.out).toEqual([false, false, true]);
  });
  it('skips players who are out, both as the one drawn from and as the next to move', () => {
    const s = mk([['2H', '5C'], ['2D', '5S'], ['*']], 1);
    const a = must(s, 0).state; // p1 took the Star card; p2 is out
    expect(a.turn).toBe(0); // the turn passes over the empty seat
    expect(targetOf(a)).toBe(1);
    const b = must(a, indexOfCard(a, 1, '5S')); // p0 draws p1's 5 and pairs it
    expect(b.state.hands[0]).toEqual([c('2H')]);
    expect(b.state.hands[1].length).toBe(2);
  });
  it('ends the game when one player is left, and that player holds only the Star card', () => {
    let s = mk([['2H', '5C'], ['2D', '5S'], ['*']]);
    s = must(s, indexOfCard(s, 1, '2D')).state; // p0 pairs the 2s
    expect(s.over).toBe(false);
    s = must(s, 0).state; // p1 draws p2's Star card; p2 out
    expect(s.over).toBe(false);
    const last = must(s, indexOfCard(s, 1, '5S'));
    expect(last.state.over).toBe(true);
    expect(last.state.loser).toBe(1);
    expect(last.state.hands[1]).toEqual([STAR]);
    expect(last.state.hands[0]).toEqual([]);
    expect(kinds(last.events)).toEqual(['draw', 'pair', 'out', 'over']);
    expect(targetOf(last.state)).toBe(-1);
    expect(draw(last.state, 0, rng0)).toBeNull();
  });
  it('shuffles both hands after a draw so a position never gives the Star card away', () => {
    // 40 draws from a hand of 4: the Star card's index in the target's hand should vary.
    const seen = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = mk([['2H', '5C'], ['2D', '5S'], ['*']], 1);
      const r = draw(s, 0, mulberry32(seed)) as { state: MaidState };
      seen.add(r.state.hands[1].indexOf(STAR));
    }
    expect(seen.size).toBe(3);
  });
  it('refuses a draw outside the hidden hand, a non-whole number or a draw after the end', () => {
    const s = mk([['2H', '5C'], ['2D', '5S'], ['*']]);
    for (const bad of [-1, 2, 99, 0.5, NaN, Infinity, -Infinity, '0' as unknown as number, null as unknown as number, undefined as unknown as number]) {
      expect(draw(s, bad, rng0)).toBeNull();
    }
    expect(draw(s, 0, rng0)).not.toBeNull();
  });
  it('does not change the state it was given', () => {
    const s = mk([['2H', '5C'], ['2D', '5S'], ['*']]);
    const copy = JSON.stringify(s);
    draw(s, 0, rng0);
    expect(JSON.stringify(s)).toBe(copy);
  });
});

// ── the computer ─────────────────────────────────────────────────────────────

describe('the computer player', () => {
  it('picks any of the hidden cards with equal chance (chi-square, df 4)', () => {
    // The target (player 1) holds five hidden cards.
    const t = mk([['AH', '2H', '3H', '4H', '5H'], ['AS', '2S', '3S', '4S', '5S'], ['*']]);
    const N = 5000;
    const got = [0, 0, 0, 0, 0];
    for (let seed = 1; seed <= N; seed++) got[chooseIndex(t, mulberry32(seed * 13))] += 1;
    let chi = 0;
    for (const v of got) chi += ((v - N / 5) ** 2) / (N / 5);
    expect(chi).toBeLessThan(18.5);
    expect(chooseIndex({ ...t, over: true }, mulberry32(1))).toBe(-1);
  });
  it('always picks a valid index, and does not look at the cards (the index depends only on the rng and the hand size)', () => {
    const t = mk([['AH', '2H', '3H', '4H', '5H'], ['AS', '2S', '3S', '4S', '5S'], ['*']]);
    const u = mk([['AH', '2H', '3H', '4H', '5H'], ['AC', '2C', '3C', '4C', '5C'], ['*']]);
    for (let seed = 1; seed <= 200; seed++) {
      const i = chooseIndex(t, mulberry32(seed));
      expect(Number.isInteger(i) && i >= 0 && i < t.hands[1].length).toBe(true);
      expect(chooseIndex(u, mulberry32(seed))).toBe(i);
    }
    expect(AI_DELAY_REDUCED_MS).toBeLessThan(AI_DELAY_MS);
  });
});

// ── whole games ──────────────────────────────────────────────────────────────

/** Play a game to the end with random draws, checking every step. Returns the final state and the number of draws. */
const playToEnd = (players: number, size: Size, seed: number): MaidState => {
  const rng = mulberry32(seed);
  let s = newGame(players, size, rng).state;
  let guard = 0;
  while (!s.over) {
    expect(guard++).toBeLessThan(2000);
    const bad = validateState(s);
    if (bad) throw new Error(bad);
    const i = chooseIndex(s, rng);
    const r = draw(s, i, rng);
    if (!r) throw new Error('a valid draw was refused');
    // The drawn card left the target and landed in the drawer's hand or a pair.
    const of = targetOf(s);
    const card = s.hands[of][i];
    expect(r.events[0]).toMatchObject({ t: 'draw', by: s.turn, of, card, index: i });
    expect(r.state.hands[of].length).toBe(s.hands[of].length - 1);
    s = r.state;
  }
  return s;
};

describe('whole games', () => {
  it('end for every number of players and every size: 1,800 random games', () => {
    let games = 0;
    for (const z of SIZES) {
      for (const n of [2, 3, 4]) {
        for (let seed = 1; seed <= 200; seed++) {
          const s = playToEnd(n, z, seed * 101 + n);
          expect(validateState(s)).toBeNull();
          expect(s.over).toBe(true);
          expect(s.hands[s.loser]).toEqual([STAR]);
          expect(s.hands.filter((h) => h.length > 0).length).toBe(1);
          // Exactly two pairs of every rank were laid down, and all 2 x ranks pairs are on the table.
          expect(totalPairs(s)).toBe(2 * SIZE_RANKS[z]);
          expect(s.out.filter(Boolean).length).toBe(n - 1);
          games += 1;
        }
      }
    }
    expect(games).toBe(1800);
  }, 120_000);
  it('the human starts as the Star holder about as often as chance says in a 3-player quick game (each seat loses 20% to 47%)', () => {
    const lost = [0, 0, 0];
    const N = 1500;
    for (let seed = 1; seed <= N; seed++) lost[playToEnd(3, 'quick', seed * 7).loser] += 1;
    for (const v of lost) {
      expect(v / N).toBeGreaterThan(0.2);
      expect(v / N).toBeLessThan(0.47);
    }
  }, 120_000);
  it('a full-pack two-player game takes a bounded number of draws', () => {
    let longest = 0;
    for (let seed = 1; seed <= 100; seed++) longest = Math.max(longest, playToEnd(2, 'full', seed).draws);
    expect(longest).toBeLessThan(200);
  });
  it('the same seed and the same picks give the same game', () => {
    const a = playToEnd(4, 'medium', 99);
    const b = playToEnd(4, 'medium', 99);
    expect(a).toEqual(b);
  });
});

// ── words ────────────────────────────────────────────────────────────────────

describe('describing events', () => {
  const names = playerNames(3);
  it('names the players and keeps hidden cards hidden', () => {
    expect(names).toEqual(['You', 'Pip', 'Dot']);
    expect(playerNames(4)).toEqual(['You', ...OPPONENT_NAMES]);
    expect(describeEvent({ t: 'draw', by: 0, of: 1, card: c('7H'), index: 0 }, names)).toBe('You took the 7 of hearts from Pip.');
    expect(describeEvent({ t: 'draw', by: 1, of: 0, card: c('7H'), index: 0 }, names)).toBe('Pip took your 7 of hearts.');
    const hidden = describeEvent({ t: 'draw', by: 1, of: 2, card: c('7H'), index: 0 }, names);
    expect(hidden).toBe('Pip took a card from Dot.');
    expect(hidden).not.toMatch(/7/);
    expect(describeEvent({ t: 'pair', by: 0, rank: 7, cards: [] }, names)).toBe('You lay down a pair of 7s.');
    expect(describeEvent({ t: 'pair', by: 2, rank: 1, cards: [] }, names)).toBe('Dot lays down a pair of Aces.');
    expect(describeEvent({ t: 'out', p: 0 }, names)).toBe('You have no cards left and are safe!');
    expect(describeEvent({ t: 'out', p: 1 }, names)).toBe('Pip has no cards left and is safe!');
  });
  it('never blames anyone: the ending is kind and invites another game', () => {
    expect(describeEvent({ t: 'over', loser: 0 }, names)).toBe('You are left with the Star card this time.');
    expect(describeEvent({ t: 'over', loser: 2 }, names)).toBe('Dot is left with the Star card.');
    const done = (loser: number): MaidState => ({ ...mk([[], ['*'], []], 1), over: true, loser });
    expect(resultSentence(done(0), names)).toBe('You have the Star card this time. Try again!');
    expect(resultSentence(done(1), names)).toBe('You are safe! Pip has the Star card. Great game!');
    expect(resultSentence({ ...done(1), over: false }, names)).toBe('The game is not finished yet.');
    const all = [0, 1, 2].map((l) => resultSentence(done(l), names)).join(' ') + describeEvent({ t: 'over', loser: 0 }, names);
    expect(all).not.toMatch(/\b(lose|lost|loser|wrong|bad|fail|stupid|old maid)\b/i);
  });
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk into a fresh object with whole numbers inside the caps', () => {
    const zero = { p: 0, s: 0, k: 0, r: 0 };
    for (const bad of [null, undefined, 5, 'x', [], [1, 2], NaN, true]) expect(sanitizeStore(bad)).toEqual(zero);
    expect(sanitizeStore({ p: 'a', s: NaN, k: -1, r: 1.5 })).toEqual(zero);
    expect(sanitizeStore({ p: 1e12, s: 1e12, k: 1e12, r: 1e12 })).toEqual(zero);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":9},"p":5,"s":4,"k":2,"r":3}'))).toEqual({ p: 5, s: 4, k: 2, r: 3 });
    // The parts cannot exceed what they are parts of.
    expect(sanitizeStore({ p: 3, s: 9, k: 9, r: 9 })).toEqual({ p: 3, s: 3, k: 3, r: 3 });
    expect(Object.keys(sanitizeStore({ p: 1, extra: 1 })).sort()).toEqual(['k', 'p', 'r', 's']);
    expect(Object.getPrototypeOf(sanitizeStore({}))).toBe(Object.prototype);
  });
  it('records games, safe games and the longest run of safe games', () => {
    let s = sanitizeStore(null);
    let r = recordGame(s, true);
    expect(r.store).toEqual({ p: 1, s: 1, k: 1, r: 1 });
    expect(r.record).toBe(false); // a first safe game is not "a new best run"
    r = recordGame(r.store, true);
    expect(r.store).toEqual({ p: 2, s: 2, k: 2, r: 2 });
    expect(r.record).toBe(true);
    r = recordGame(r.store, false);
    expect(r.store).toEqual({ p: 3, s: 2, k: 0, r: 2 });
    expect(r.record).toBe(false);
    r = recordGame(r.store, true);
    expect(r.store).toEqual({ p: 4, s: 3, k: 1, r: 2 });
    s = { p: MAX_COUNT, s: MAX_COUNT, k: MAX_COUNT, r: MAX_COUNT };
    expect(recordGame(s, true).store).toEqual(s);
  });
});

// ── the page ─────────────────────────────────────────────────────────────────

describe('the page promises what the guide says', () => {
  it('stores under its own key, wires the shell and announces', () => {
    expect(calculatorSource).toContain("'gk:game:old-maid'");
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
  it('uses no scolding words in the page text', () => {
    const body = calculatorSource.slice(calculatorSource.indexOf('---', 3) + 3);
    const text = body.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    expect(text).not.toMatch(/\b(wrong|you lose|you lost|loser|stupid|fail(ed)?)\b/i);
  });
});
