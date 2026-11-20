/**
 * games-hearts.test.ts - the engine behind `hearts`.
 *
 * Pinned: the 52-card pack, its 26 points (13 hearts at 1 and the queen of spades at 13), an unbiased
 * seeded shuffle (chi-square), the deal (13 each, the hand cycle left / right / across / hold), the pass
 * for all four directions and its refusals, trick legality for EVERY card in EVERY position of thousands
 * of random hands compared with an independent rule checker, trick winners and per-player points compared
 * with an independent scorer, 26 points in every hand, shooting the moon, the game-end rule (limit reached
 * AND a single lowest score), the three computer levels (always legal, Hard breaks a moon, Hard beats
 * Medium beats Easy over seeded hands), the words for every event, the stored results, and a fuzz of full
 * games. The source is checked for the claims the guide page makes.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, dealHand, nextHand, applyPasses, legalPlays, playCard, whyNot, trickWinner, winners, chooseCard, choosePass, moonThreat, unseenFor,
  validateState, describeEvent, passSentence, scoreList, resultSentence, sanitizeStore, recordGame, clampLimit, clampLevel,
  passTarget, passSource, dirForHand, handSeed, holderOf, sortHand,
  mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isRed, isHeart, pointsOf, strength, plural, joinList,
  SUIT_CHARS, SUIT_NAMES, RANK_LABELS, DECK, HAND, HAND_POINTS, QUEEN_OF_SPADES, TWO_OF_CLUBS, PASS_DIRS, PASS_SHIFT,
  LEVELS, LEVEL_NAMES, LIMITS, PLAYER_NAMES, MAX_COUNT, MAX_SCORE, AI_DELAY_MS, AI_DELAY_REDUCED_MS,
  type HeartsState, type HeartsEvent, type Level, type TrickCard,
} from '../src/components/apps-private/hearts/helpers';
import calculatorSource from '../src/components/apps-private/hearts/Calculator.astro?raw';

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts, 'QS' = queen of spades. */
const c = (code: string): number => {
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};

// ── an independent rule book, written from the rules and not from the engine ──

const RANK_HIGH = (id: number): number => { const r = (id % 13) + 1; return r === 1 ? 14 : r; };
const SUIT = (id: number): number => Math.floor(id / 13);
const PTS = (id: number): number => (SUIT(id) === 1 ? 1 : id === 11 ? 13 : 0);

/** Is `card` allowed from `hand`, given the trick so far, how many tricks are done and whether a heart has been played? */
const refLegal = (hand: number[], trick: number[], done: number, broken: boolean, card: number): boolean => {
  if (!hand.includes(card)) return false;
  if (trick.length === 0) {
    if (done === 0) return card === 40; // the two of clubs
    if (SUIT(card) === 1 && !broken) return hand.every((x) => SUIT(x) === 1);
    return true;
  }
  const led = SUIT(trick[0]);
  if (hand.some((x) => SUIT(x) === led)) return SUIT(card) === led;
  if (done === 0 && PTS(card) > 0) return hand.every((x) => PTS(x) > 0);
  return true;
};

/** Who wins a trick: indices into the array of cards played in turn order. */
const refWinner = (cards: number[]): number => {
  const led = SUIT(cards[0]);
  let best = 0;
  for (let i = 1; i < cards.length; i++) if (SUIT(cards[i]) === led && RANK_HIGH(cards[i]) > RANK_HIGH(cards[best])) best = i;
  return best;
};

const randOf = <T>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

/**
 * Play a whole hand with `choose` picking the cards, checking at every position that the engine's legal set
 * matches the independent checker for every card in the hand, and keeping an independent tally of points.
 * Returns the final state and how many (position, card) pairs were compared.
 */
const playHandChecked = (start: HeartsState, choose: (s: HeartsState, p: number) => number): { state: HeartsState; checked: number; tally: number[] } => {
  let s = start;
  let checked = 0;
  const tally = [0, 0, 0, 0];
  const played: { p: number; c: number }[] = [];
  let broken = false;
  while (s.phase === 'play') {
    const p = s.turn;
    const trickCards = s.trick.map((t) => t.c);
    const engine = new Set(legalPlays(s, p));
    for (const card of s.hands[p]) {
      const ref = refLegal(s.hands[p], trickCards, s.tricks, broken, card);
      if (engine.has(card) !== ref) throw new Error(`legality differs for card ${cardName(card)} (trick ${s.tricks}, ${trickCards.length} on the table)`);
      checked += 1;
    }
    // Cards that are not in the hand are never legal.
    for (let card = 0; card < DECK; card++) if (!s.hands[p].includes(card) && engine.has(card)) throw new Error('a card outside the hand is legal');
    const card = choose(s, p);
    expect(engine.has(card)).toBe(true);
    const r = playCard(s, p, card);
    if (!r) throw new Error('a legal card was refused');
    played.push({ p, c: card });
    if (SUIT(card) === 1) broken = true;
    if (played.length % 4 === 0) {
      const four = played.slice(-4);
      const w = refWinner(four.map((x) => x.c));
      tally[four[w].p] += four.reduce((a, x) => a + PTS(x.c), 0);
    }
    s = r.state;
    const bad = validateState(s);
    if (bad) throw new Error(`invalid state: ${bad}`);
  }
  return { state: s, checked, tally };
};

const randomPass = (s: HeartsState, rng: () => number): number[][] => [0, 1, 2, 3].map((p) => shuffled(s.hands[p], rng).slice(0, 3));

const startPlay = (seed: number, handNo: number, limit = 100, scores = [0, 0, 0, 0], rng = mulberry32(seed ^ 77)): HeartsState => {
  const d = dealHand(seed, handNo, limit, scores).state;
  if (d.phase === 'pass') {
    const r = applyPasses(d, randomPass(d, rng));
    if (!r) throw new Error('pass refused');
    return r.state;
  }
  return d;
};

const ALL = Array.from({ length: DECK }, (_, i) => i);

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards', () => {
  it('maps ids to suit and rank and back for all 52', () => {
    for (let id = 0; id < DECK; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
  });
  it('has 52 unique plain-language names and text-presentation suit glyphs', () => {
    expect(new Set(ALL.map(cardName)).size).toBe(52);
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(new Set(SUIT_CHARS).size).toBe(4);
    expect(SUIT_NAMES).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
    expect(cardName(QUEEN_OF_SPADES)).toBe('Queen of spades');
    expect(cardName(TWO_OF_CLUBS)).toBe('2 of clubs');
    expect(cardLabel(c('10H'))).toBe('10♥︎');
    expect([0, 1, 2, 3].map((s) => isRed(cardId(s, 4)))).toEqual([false, true, true, false]);
  });
  it('ranks the ace high', () => {
    expect(strength(c('AS'))).toBe(14);
    expect(strength(c('KS'))).toBe(13);
    expect(strength(c('2S'))).toBe(2);
  });
  it('has 26 points in the pack: 13 hearts at 1 and the queen of spades at 13', () => {
    expect(ALL.reduce((a, id) => a + pointsOf(id), 0)).toBe(HAND_POINTS);
    expect(HAND_POINTS).toBe(26);
    expect(ALL.filter(isHeart).length).toBe(13);
    expect(pointsOf(QUEEN_OF_SPADES)).toBe(13);
    expect(pointsOf(c('KS'))).toBe(0);
    expect(pointsOf(c('JD'))).toBe(0);
    expect(pointsOf(c('AH'))).toBe(1);
  });
  it('plural and joinList read naturally', () => {
    expect(plural(1, 'point')).toBe('1 point');
    expect(plural(0, 'point')).toBe('0 points');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
  it('sorts a hand with the suits alternating black and red and high cards first', () => {
    const h = sortHand([c('2C'), c('AH'), c('3D'), c('KS'), c('5H'), c('AS')]);
    expect(h).toEqual([c('AS'), c('KS'), c('AH'), c('5H'), c('2C'), c('3D')]);
  });
});

// ── the shuffle ──────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('is a permutation, deterministic for a seed, and leaves its input alone', () => {
    const out = shuffled(ALL, mulberry32(7));
    expect(out.slice().sort((a, b) => a - b)).toEqual(ALL);
    expect(shuffled(ALL, mulberry32(7))).toEqual(out);
    expect(out).not.toEqual(ALL);
    expect(ALL).toEqual(Array.from({ length: DECK }, (_, i) => i));
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
  it('hands the queen of spades to each of the 4 players about equally often over seeded deals (chi-square, df 3)', () => {
    const N = 4000;
    const got = [0, 0, 0, 0];
    for (let seed = 1; seed <= N; seed++) got[holderOf(dealHand(seed * 31, 0, 100, [0, 0, 0, 0]).state.hands, QUEEN_OF_SPADES)] += 1;
    let chi = 0;
    for (const v of got) chi += ((v - N / 4) ** 2) / (N / 4);
    expect(chi).toBeLessThan(16.3); // p = 0.001, df 3
  });
});

// ── the deal ─────────────────────────────────────────────────────────────────

describe('deal', () => {
  it('gives 13 distinct cards to each of 4 players, using the whole pack', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = newGame(seed).state;
      expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
      expect(s.hands.flat().sort((a, b) => a - b)).toEqual(ALL);
      expect(validateState(s)).toBeNull();
    }
  });
  it('is the same for the same game number and different for another', () => {
    expect(newGame(5).state).toEqual(newGame(5).state);
    expect(newGame(5).state.hands).not.toEqual(newGame(6).state.hands);
  });
  it('changes the deal every hand of one game', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 12; h++) seen.add(dealHand(9, h, 100, [0, 0, 0, 0]).state.hands.join('|'));
    expect(seen.size).toBe(12);
    expect(handSeed(9, 0)).not.toBe(handSeed(9, 1));
  });
  it('makes the holder of the 2 of clubs the first to play', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = newGame(seed).state;
      expect(s.hands[s.turn]).toContain(TWO_OF_CLUBS);
      expect(s.leader).toBe(s.turn);
    }
  });
  it('cycles the pass: left, right, across, none, then round again', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(dirForHand)).toEqual(['left', 'right', 'across', 'hold', 'left', 'right', 'across', 'hold']);
    expect(newGame(3).state.phase).toBe('pass');
    expect(dealHand(3, 3, 100, [0, 0, 0, 0]).state.phase).toBe('play');
    expect(dealHand(3, 7, 100, [0, 0, 0, 0]).state.phase).toBe('play');
    expect(dealHand(3, 4, 100, [0, 0, 0, 0]).state.phase).toBe('pass');
  });
  it('carries the scores into the next hand and clamps the limit', () => {
    expect(dealHand(1, 2, 50, [10, 20, 30, 40]).state.scores).toEqual([10, 20, 30, 40]);
    expect(clampLimit(100)).toBe(100);
    expect(clampLimit(50)).toBe(50);
    for (const bad of [0, 75, -1, NaN, '50', null, undefined, 1e9]) expect(clampLimit(bad)).toBe(100);
    expect(LIMITS).toEqual([100, 50]);
  });
});

// ── the pass ─────────────────────────────────────────────────────────────────

describe('pass', () => {
  const dealt = (handNo: number) => dealHand(11, handNo, 100, [0, 0, 0, 0]).state;
  it('sends each player their 3 cards to the right place for all four directions', () => {
    expect(PASS_SHIFT).toEqual({ left: 1, right: 3, across: 2, hold: 0 });
    for (const [handNo, dir] of [[0, 'left'], [1, 'right'], [2, 'across']] as const) {
      const s = dealt(handNo);
      expect(s.dir).toBe(dir);
      const passes = [0, 1, 2, 3].map((p) => s.hands[p].slice(0, 3));
      const r = applyPasses(s, passes);
      expect(r).not.toBeNull();
      const n = (r as { state: HeartsState }).state;
      expect(n.phase).toBe('play');
      for (let p = 0; p < 4; p++) {
        const from = dir === 'left' ? (p + 3) % 4 : dir === 'right' ? (p + 1) % 4 : (p + 2) % 4;
        expect(passSource(dir, p)).toBe(from);
        expect(passTarget(dir, from)).toBe(p);
        expect(n.received[p].slice().sort()).toEqual(passes[from].slice().sort());
        expect(n.hands[p].length).toBe(13);
        for (const card of passes[p]) expect(n.hands[p]).not.toContain(card);
        for (const card of passes[from]) expect(n.hands[p]).toContain(card);
      }
      expect(n.hands.flat().sort((a, b) => a - b)).toEqual(ALL);
      expect(n.hands[n.turn]).toContain(TWO_OF_CLUBS);
      expect(validateState(n)).toBeNull();
    }
  });
  it('refuses a pass that is not exactly 3 distinct cards from that hand, in the wrong phase, or malformed', () => {
    const s = dealt(0);
    const good = [0, 1, 2, 3].map((p) => s.hands[p].slice(0, 3));
    const bad = (mut: (x: number[][]) => void) => { const x = good.map((a) => a.slice()); mut(x); return applyPasses(s, x); };
    expect(applyPasses(s, good)).not.toBeNull();
    expect(bad((x) => { x[0] = x[0].slice(0, 2); })).toBeNull();
    expect(bad((x) => { x[1] = [...x[1], s.hands[1][5]]; })).toBeNull();
    expect(bad((x) => { x[2] = [x[2][0], x[2][0], x[2][1]]; })).toBeNull();
    expect(bad((x) => { x[3][0] = s.hands[0][4]; })).toBeNull(); // a card from another hand
    expect(bad((x) => { x[0][0] = -1; })).toBeNull();
    expect(bad((x) => { x[0][0] = 1.5; })).toBeNull();
    expect(bad((x) => { x[0][0] = NaN; })).toBeNull();
    expect(applyPasses(s, good.slice(0, 3))).toBeNull();
    expect(applyPasses(s, 'x' as unknown as number[][])).toBeNull();
    expect(applyPasses(s, [null, null, null, null] as unknown as number[][])).toBeNull();
    const playing = applyPasses(s, good)!.state;
    expect(applyPasses(playing, good)).toBeNull();
    const hold = dealt(3);
    expect(applyPasses(hold, [[], [], [], []])).toBeNull();
  });
  it('does not change the state it was given', () => {
    const s = dealt(0);
    const copy = JSON.stringify(s);
    applyPasses(s, [0, 1, 2, 3].map((p) => s.hands[p].slice(0, 3)));
    expect(JSON.stringify(s)).toBe(copy);
  });
  it('words the direction', () => {
    expect(passSentence('left')).toBe('Pass 3 cards to the left to Pip.');
    expect(passSentence('right')).toBe('Pass 3 cards to the right to Moss.');
    expect(passSentence('across')).toBe('Pass 3 cards across the table to Dot.');
    expect(passSentence('hold')).toBe('No passing this hand.');
  });
});

// ── the rules of play, against the independent checker ──────────────────────

describe('legal plays', () => {
  it('must lead the 2 of clubs, and only the holder leads', () => {
    const s = startPlay(21, 3);
    expect(legalPlays(s)).toEqual([TWO_OF_CLUBS]);
    for (let p = 0; p < 4; p++) if (p !== s.turn) expect(legalPlays(s, p)).toEqual([]);
  });
  it('matches the independent checker for every card in every position of 1500 random hands, all directions', () => {
    let checked = 0;
    let hands = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const rng = mulberry32(seed * 977);
      const s = startPlay(seed, seed % 4, 100, [0, 0, 0, 0], rng);
      const r = playHandChecked(s, (st, p) => randOf(legalPlays(st, p), rng));
      checked += r.checked;
      hands += 1;
      expect(r.state.tricks).toBe(13);
    }
    expect(hands).toBe(1500);
    expect(checked).toBeGreaterThan(300_000);
  }, 120_000);
  it('has a legal card at every position (nobody is ever stuck)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      let s = startPlay(seed, seed % 4, 100, [0, 0, 0, 0], rng);
      while (s.phase === 'play') {
        const l = legalPlays(s);
        expect(l.length).toBeGreaterThan(0);
        s = (playCard(s, s.turn, randOf(l, rng)) as { state: HeartsState }).state;
      }
    }
  }, 60_000);
  it('forbids points on the first trick unless the hand holds nothing else', () => {
    // Player 1 is void in clubs and holds a heart, the queen of spades and a diamond: only the diamond is legal.
    const base = startPlay(2, 3);
    const s: HeartsState = { ...base, turn: 1, leader: 0, trick: [{ p: 0, c: c('2C') }], tricks: 0, hands: [[c('3C')], [c('5H'), c('QS'), c('9D')], [], []] };
    expect(legalPlays(s, 1)).toEqual([c('9D')]);
    expect(whyNot(s, 1, c('5H'))).toMatch(/first trick/);
    expect(whyNot(s, 1, c('QS'))).toMatch(/first trick/);
    expect(whyNot(s, 1, c('9D'))).toBe('');
    // With only point cards left, any of them is legal.
    const t: HeartsState = { ...s, hands: [[c('3C')], [c('5H'), c('QS'), c('7H')], [], []] };
    expect(legalPlays(t, 1).sort()).toEqual([c('5H'), c('QS'), c('7H')].sort());
    // Holding a club means following suit, even on the first trick.
    const u: HeartsState = { ...s, hands: [[c('3C')], [c('5H'), c('4C'), c('9D')], [], []] };
    expect(legalPlays(u, 1)).toEqual([c('4C')]);
    expect(whyNot(u, 1, c('9D'))).toBe('You must follow suit: play a club.');
  });
  it('does not allow leading a heart until hearts are broken, unless the leader has only hearts', () => {
    const base = startPlay(2, 3);
    const lead = (hand: number[], broken: boolean): HeartsState => ({ ...base, phase: 'play', turn: 0, leader: 0, trick: [], tricks: 4, broken, hands: [hand, [], [], []] });
    expect(legalPlays(lead([c('5H'), c('9S'), c('QS')], false)).sort()).toEqual([c('9S'), c('QS')].sort());
    expect(legalPlays(lead([c('5H'), c('9S'), c('QS')], true)).sort()).toEqual([c('5H'), c('9S'), c('QS')].sort());
    expect(legalPlays(lead([c('5H'), c('AH')], false)).sort()).toEqual([c('5H'), c('AH')].sort());
    expect(whyNot(lead([c('5H'), c('9S')], false), 0, c('5H'))).toMatch(/broken/);
  });
  it('does not treat the queen of spades as breaking hearts', () => {
    const s = startPlay(4, 3);
    const rng = mulberry32(1);
    let st = s;
    // Find any position where the queen of spades is played with no heart played yet, if the random play produces one.
    let seenQueenBeforeHeart = false;
    for (let seed = 1; seed <= 300 && !seenQueenBeforeHeart; seed++) {
      st = startPlay(seed, 3, 100, [0, 0, 0, 0], rng);
      while (st.phase === 'play') {
        const l = legalPlays(st);
        const q = l.includes(QUEEN_OF_SPADES) && !st.broken && st.tricks > 0 ? QUEEN_OF_SPADES : randOf(l, rng);
        if (q === QUEEN_OF_SPADES && !st.broken) { seenQueenBeforeHeart = true; const nx = (playCard(st, st.turn, q) as { state: HeartsState }).state; expect(nx.broken).toBe(false); break; }
        st = (playCard(st, st.turn, q) as { state: HeartsState }).state;
      }
    }
    expect(seenQueenBeforeHeart).toBe(true);
  });
  it('refuses illegal, out-of-turn, missing and non-numeric cards', () => {
    const s = startPlay(2, 3);
    const lead = s.turn;
    expect(playCard(s, lead, c('AS'))).toBeNull();
    expect(playCard(s, (lead + 1) % 4, TWO_OF_CLUBS)).toBeNull();
    expect(playCard(s, lead, -1)).toBeNull();
    expect(playCard(s, lead, 52)).toBeNull();
    expect(playCard(s, lead, NaN)).toBeNull();
    expect(playCard(s, lead, 1.5)).toBeNull();
    expect(playCard(s, 7, TWO_OF_CLUBS)).toBeNull();
    expect(playCard(dealHand(2, 0, 100, [0, 0, 0, 0]).state, lead, TWO_OF_CLUBS)).toBeNull(); // still passing
    expect(whyNot(s, (lead + 1) % 4, c('AS'))).toMatch(/turn/);
    expect(whyNot(s, lead, s.hands[lead].find((x) => x !== TWO_OF_CLUBS) as number)).toMatch(/2 of clubs/);
    expect(whyNot(s, lead, c('AS') === TWO_OF_CLUBS ? 0 : (s.hands[lead].includes(c('AS')) ? 99 : c('AS')))).toMatch(/not in your hand/);
    expect(whyNot(s, lead, TWO_OF_CLUBS)).toBe('');
  });
  it('does not change the state it was given', () => {
    const s = startPlay(2, 3);
    const copy = JSON.stringify(s);
    playCard(s, s.turn, TWO_OF_CLUBS);
    expect(JSON.stringify(s)).toBe(copy);
  });
});

// ── tricks and scoring, against the independent scorer ──────────────────────

describe('tricks and scoring', () => {
  it('awards the trick to the highest card of the suit led, and nothing else counts', () => {
    const t = (cs: string[]): TrickCard[] => cs.map((x, i) => ({ p: i, c: c(x) }));
    expect(trickWinner(t(['2C', 'KC', '5C', 'QC'])).p).toBe(1);
    expect(trickWinner(t(['2C', 'AS', '5C', 'QH'])).p).toBe(2);
    expect(trickWinner(t(['QS', 'AS', 'KS', '2S'])).p).toBe(1);
    expect(trickWinner(t(['3D', 'AH', 'AS', 'AC'])).p).toBe(0);
    expect(trickWinner(t(['9H', 'AH', '2H', 'KH'])).p).toBe(1);
  });
  it('matches the independent scorer in 2000 random hands, and every hand holds exactly 26 points', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const rng = mulberry32(seed * 131 + 7);
      const s = startPlay(seed, seed % 4, 100, [0, 0, 0, 0], rng);
      const r = playHandChecked(s, (st, p) => randOf(legalPlays(st, p), rng));
      const f = r.state;
      expect(f.handPoints.reduce((a, b) => a + b, 0)).toBe(26);
      expect(f.handPoints).toEqual(r.tally);
      expect(f.taken.flat().sort((a, b) => a - b)).toEqual(ALL);
      const moon = r.tally.findIndex((x) => x === 26);
      expect(f.moon).toBe(moon);
      const expectAdded = moon >= 0 ? [0, 1, 2, 3].map((p) => (p === moon ? 0 : 26)) : r.tally;
      expect(f.added).toEqual(expectAdded);
      expect(f.scores).toEqual(expectAdded);
    }
  }, 120_000);
  it('keeps the same pack of cards through a whole hand', () => {
    const rng = mulberry32(5);
    let s = startPlay(5, 3, 100, [0, 0, 0, 0], rng);
    while (s.phase === 'play') {
      const all = [...s.hands.flat(), ...s.taken.flat(), ...s.trick.map((t) => t.c)].sort((a, b) => a - b);
      expect(all).toEqual(ALL);
      s = (playCard(s, s.turn, randOf(legalPlays(s), rng)) as { state: HeartsState }).state;
    }
  });
  it('records who is void in a suit when they cannot follow it', () => {
    const base = startPlay(2, 3);
    const s: HeartsState = { ...base, turn: 1, leader: 0, trick: [{ p: 0, c: c('2C') }], tricks: 0, hands: [[c('3C')], [c('5H'), c('9D')], [], []] };
    const n = (playCard(s, 1, c('9D')) as { state: HeartsState }).state;
    expect(n.voids[1][3]).toBe(true);
    expect(n.voids[1][2]).toBe(false);
    expect(n.voids[2][3]).toBe(false);
  });
  it('sets the hearts-broken flag when any heart is played and announces it once', () => {
    const base = startPlay(2, 3);
    const s: HeartsState = { ...base, turn: 1, leader: 0, trick: [{ p: 0, c: c('5S') }], tricks: 3, broken: false, hands: [[c('3C')], [c('5H'), c('9D')], [], []] };
    const r = playCard(s, 1, c('5H')) as { state: HeartsState; events: HeartsEvent[] };
    expect(r.state.broken).toBe(true);
    expect(r.events.filter((e) => e.t === 'broken').length).toBe(1);
  });
});

// ── building the end of a hand by hand ──────────────────────────────────────

/**
 * A position with one trick left. `last` is the final trick's four cards for players 0 to 3 (player 0 leads). The other 48
 * cards were taken in 12 tricks by `winners` (12 player numbers), dealt out in order.
 */
const lateHand = (last: string[], earlier: number[], scores: number[], limit = 100): HeartsState => {
  const lastIds = last.map(c);
  const rest = ALL.filter((x) => !lastIds.includes(x));
  const taken: number[][] = [[], [], [], []];
  earlier.forEach((w, i) => taken[w].push(...rest.slice(i * 4, i * 4 + 4)));
  const handPoints = taken.map((t) => t.reduce((a, x) => a + pointsOf(x), 0));
  const base = startPlay(2, 3);
  return {
    ...base, limit, phase: 'play', tricks: 12, turn: 0, leader: 0, trick: [], broken: true,
    hands: lastIds.map((x) => [x]), taken, handPoints, scores, moon: -1, added: [0, 0, 0, 0], received: [[], [], [], []],
  };
};
const finishLast = (s: HeartsState): HeartsState => {
  let n = s;
  for (let p = 0; p < 4; p++) n = (playCard(n, p, n.hands[p][0]) as { state: HeartsState }).state;
  return n;
};

describe('shooting the moon', () => {
  // Every point card goes to player 0 in the earlier tricks: give 0 all the tricks that hold hearts or the queen.
  const moonEarlier = (): number[] => {
    // Cards other than the last four, dealt out in order: find which of the 12 chunks hold points and give all of those to player 0.
    const lastIds = ['AC', '2C', '3C', '4C'].map(c);
    const rest = ALL.filter((x) => !lastIds.includes(x));
    return Array.from({ length: 12 }, (_, i) => (rest.slice(i * 4, i * 4 + 4).some((x) => pointsOf(x) > 0) ? 0 : 1));
  };
  it('scores 0 for the player who takes all 26 and 26 for each of the others', () => {
    const s = lateHand(['AC', '2C', '3C', '4C'], moonEarlier(), [10, 20, 30, 40]);
    expect(validateState(s)).toBeNull();
    expect(s.handPoints[0]).toBe(26);
    const f = finishLast(s);
    expect(f.moon).toBe(0);
    expect(f.added).toEqual([0, 26, 26, 26]);
    expect(f.scores).toEqual([10, 46, 56, 66]);
    expect(f.moons).toEqual([1, 0, 0, 0]);
  });
  it('gives the moon to another player and counts it', () => {
    const lastIds = ['2C', 'AC', '3C', '4C'].map(c);
    const rest = ALL.filter((x) => !lastIds.includes(x));
    const earlier = Array.from({ length: 12 }, (_, i) => (rest.slice(i * 4, i * 4 + 4).some((x) => pointsOf(x) > 0) ? 1 : 2));
    const s = lateHand(['2C', 'AC', '3C', '4C'], earlier, [0, 0, 0, 0]);
    const f = finishLast(s);
    expect(f.moon).toBe(1);
    expect(f.added).toEqual([26, 0, 26, 26]);
  });
  it('is not a moon when the points are split, even by one', () => {
    const lastIds = ['AC', '2C', '3C', '4C'].map(c);
    const rest = ALL.filter((x) => !lastIds.includes(x));
    const earlier = Array.from({ length: 12 }, (_, i) => (rest.slice(i * 4, i * 4 + 4).some((x) => pointsOf(x) > 0) ? 0 : 1));
    // Move one point-holding trick to player 2.
    const idx = earlier.findIndex((w, i) => w === 0 && rest.slice(i * 4, i * 4 + 4).reduce((a, x) => a + pointsOf(x), 0) <= 2);
    earlier[idx] = 2;
    const s = lateHand(['AC', '2C', '3C', '4C'], earlier, [0, 0, 0, 0]);
    const f = finishLast(s);
    expect(f.moon).toBe(-1);
    expect(f.added.reduce((a, b) => a + b, 0)).toBe(26);
    expect(f.added[2]).toBeGreaterThan(0);
  });
});

describe('the end of the game', () => {
  const none = (): number[] => Array.from({ length: 12 }, () => 1);
  it('keeps the game going while nobody has reached the limit', () => {
    const f = finishLast(lateHand(['AC', '2C', '3C', '4C'], none(), [10, 20, 30, 40]));
    expect(f.phase).toBe('hand-over');
    expect(nextHand(f)).not.toBeNull();
  });
  it('ends the game when someone reaches the limit and one player has the lowest score', () => {
    // Player 1 took every point in the earlier tricks, so the hand is a moon: 0 for player 1, 26 each for the others.
    const s = lateHand(['AC', '2C', '3C', '4C'], none(), [10, 90, 95, 99]);
    const f = finishLast(s);
    expect(f.moon).toBe(1);
    expect(f.scores).toEqual([36, 90, 121, 125]);
    expect(f.phase).toBe('game-over');
    expect(winners(f)).toEqual([0]);
    expect(nextHand(f)).toBeNull();
  });
  it('plays on when the limit is passed but several players share the lowest score', () => {
    const s = lateHand(['AC', '2C', '3C', '4C'], none(), [74, 100, 74, 80]);
    const f = finishLast(s);
    expect(f.moon).toBe(1);
    expect(f.scores).toEqual([100, 100, 100, 106]);
    expect(Math.max(...f.scores)).toBeGreaterThanOrEqual(100);
    expect(f.phase).toBe('hand-over');
    expect(winners(f)).toEqual([0, 1, 2]);
  });
  it('keeps going when the lowest score is shared and someone is over the limit', () => {
    // Hand where nobody shoots the moon: split the points. Player 0 and 1 end tied at the low.
    const lastIds = ['AC', '2C', '3C', '4C'].map(c);
    const rest = ALL.filter((x) => !lastIds.includes(x));
    // Give the chunk that holds the queen of spades to player 2 and the other point chunks to player 3.
    const earlier = Array.from({ length: 12 }, (_, i) => {
      const ch = rest.slice(i * 4, i * 4 + 4);
      return ch.includes(QUEEN_OF_SPADES) ? 2 : ch.some((x) => pointsOf(x) > 0) ? 3 : 0;
    });
    const s = lateHand(['AC', '2C', '3C', '4C'], earlier, [50, 50, 90, 90], 100);
    const f = finishLast(s);
    expect(f.moon).toBe(-1);
    expect(f.handPoints.reduce((a, b) => a + b, 0)).toBe(26);
    expect(f.scores[0]).toBe(50);
    expect(f.scores[1]).toBe(50);
    expect(Math.max(...f.scores)).toBeGreaterThanOrEqual(100);
    expect(f.phase).toBe('hand-over'); // two players share the lowest score, so play another hand
    expect(winners(f)).toEqual([0, 1]);
    expect(nextHand(f)).not.toBeNull();
  });
  it('names the winner or the tie in words', () => {
    expect(resultSentence([0])).toBe('You won with the lowest score!');
    expect(resultSentence([2])).toBe('Dot won with the lowest score.');
    expect(resultSentence([0, 3])).toBe('A tie for the lowest score between You and Moss.');
    expect(scoreList([1, 2, 3, 4])).toBe('You 1, Pip 2, Dot 3, Moss 4');
  });
});

// ── the computer players ─────────────────────────────────────────────────────

describe('computer players', () => {
  it('always choose a legal card and a legal pass, at every level, over 600 hands', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        const rng = mulberry32(seed * 3 + level);
        const d = dealHand(seed, seed % 4, 100, [0, 0, 0, 0]).state;
        let s = d;
        if (d.phase === 'pass') {
          const passes = [0, 1, 2, 3].map((p) => choosePass(d, p, level, rng));
          for (let p = 0; p < 4; p++) {
            expect(passes[p].length).toBe(3);
            expect(new Set(passes[p]).size).toBe(3);
            for (const x of passes[p]) expect(d.hands[p]).toContain(x);
          }
          s = (applyPasses(d, passes) as { state: HeartsState }).state;
        }
        while (s.phase === 'play') {
          const card = chooseCard(s, s.turn, level, rng);
          expect(legalPlays(s)).toContain(card);
          s = (playCard(s, s.turn, card) as { state: HeartsState }).state;
        }
        expect(validateState(s)).toBeNull();
      }
    }
  }, 120_000);
  it('Medium and Hard pass the queen of spades and the dangerous high cards, and Easy does not know to', () => {
    // A hand with a short, unguarded queen of spades and the ace of hearts.
    const base = dealHand(1, 0, 100, [0, 0, 0, 0]).state;
    const hand = [c('QS'), c('2S'), c('AH'), c('KH'), c('3H'), c('9H'), c('4D'), c('5D'), c('6D'), c('7C'), c('8C'), c('9C'), c('3C')];
    const s: HeartsState = { ...base, hands: [hand.slice(), base.hands[1], base.hands[2], base.hands[3]] };
    for (const level of [2, 3] as Level[]) {
      const pass = choosePass(s, 0, level, mulberry32(1));
      expect(pass).toContain(c('QS'));
      expect(pass).toContain(c('AH'));
    }
    // A well-guarded queen (4 lower spades) is kept.
    const guarded = [c('QS'), c('2S'), c('3S'), c('4S'), c('5S'), c('AH'), c('KH'), c('3H'), c('9H'), c('4D'), c('5D'), c('6D'), c('7C')];
    const g: HeartsState = { ...base, hands: [guarded, base.hands[1], base.hands[2], base.hands[3]] };
    expect(choosePass(g, 0, 3, mulberry32(1))).not.toContain(c('QS'));
  });
  it('dump the queen of spades when void in the suit led, but only Medium and Hard', () => {
    const base = startPlay(2, 3);
    const s: HeartsState = { ...base, turn: 1, leader: 0, tricks: 5, broken: true, trick: [{ p: 0, c: c('KC') }], hands: [[], [c('QS'), c('2D'), c('5H')], [], []] };
    for (const level of [2, 3] as Level[]) expect(chooseCard(s, 1, level, mulberry32(3))).toBe(QUEEN_OF_SPADES);
  });
  it('duck under the winning card when it can, and shed a high safe card when last on a clean trick', () => {
    const base = startPlay(2, 3);
    const ducking: HeartsState = { ...base, turn: 1, leader: 0, tricks: 5, broken: true, trick: [{ p: 0, c: c('9C') }], hands: [[], [c('KC'), c('7C'), c('2C')], [], []] };
    expect(chooseCard(ducking, 1, 3, mulberry32(3))).toBe(c('7C')); // the highest card that still loses
    // Last to play, nothing at stake: get rid of the king.
    const last: HeartsState = { ...base, turn: 3, leader: 0, tricks: 5, broken: true, trick: [{ p: 0, c: c('9C') }, { p: 1, c: c('4C') }, { p: 2, c: c('5C') }], hands: [[], [], [], [c('KC'), c('7C'), c('2C')]] };
    expect(chooseCard(last, 3, 3, mulberry32(3))).toBe(c('KC'));
    expect(chooseCard(last, 3, 2, mulberry32(3))).toBe(c('KC'));
  });
  it('Hard notices a moon in the making and takes a heart to stop it; Medium does not', () => {
    const base = startPlay(2, 3);
    const s: HeartsState = {
      ...base, turn: 1, leader: 3, tricks: 6, broken: true,
      trick: [{ p: 3, c: c('9H') }, { p: 0, c: c('4H') }],
      handPoints: [0, 0, 0, 17],
      hands: [[], [c('6H'), c('KH'), c('2C')], [], []],
    };
    expect(moonThreat(s, 1)).toBe(3);
    expect(moonThreat(s, 3)).toBe(-1); // the shooter is not a threat to itself
    expect(chooseCard(s, 1, 3, mulberry32(3))).toBe(c('KH'));
    expect(chooseCard(s, 1, 2, mulberry32(3))).toBe(c('6H'));
    // No threat when the points are split or small.
    expect(moonThreat({ ...s, handPoints: [0, 1, 0, 17] }, 1)).toBe(-1);
    expect(moonThreat({ ...s, handPoints: [0, 0, 0, 14] }, 1)).toBe(-1);
    expect(moonThreat({ ...s, handPoints: [0, 0, 0, 0] }, 1)).toBe(-1);
  });
  it('Hard does not feed a moon-shooter another point when void with a clean card to throw', () => {
    const base = startPlay(2, 3);
    const s: HeartsState = {
      ...base, turn: 1, leader: 3, tricks: 6, broken: true,
      trick: [{ p: 3, c: c('KS') }, { p: 0, c: c('4S') }],
      handPoints: [0, 0, 0, 17],
      hands: [[], [c('8H'), c('9C'), c('3D')], [], []],
    };
    expect(chooseCard(s, 1, 3, mulberry32(3))).toBe(c('9C'));
    expect(chooseCard(s, 1, 2, mulberry32(3))).toBe(c('8H'));
  });
  it('counts the cards: unseen cards exclude your hand, the table and every trick taken', () => {
    const rng = mulberry32(9);
    let s = startPlay(9, 3, 100, [0, 0, 0, 0], rng);
    for (let i = 0; i < 20; i++) s = (playCard(s, s.turn, randOf(legalPlays(s), rng)) as { state: HeartsState }).state;
    const u = unseenFor(s, 0);
    const known = new Set([...s.hands[0], ...s.taken.flat(), ...s.trick.map((t) => t.c)]);
    expect(u.length).toBe(DECK - known.size);
    for (const x of u) expect(known.has(x)).toBe(false);
  });
  it('Hard beats Medium and Medium beats Easy over the same seeded hands', () => {
    const run = (levels: Level[], hands: number): number[] => {
      const total = [0, 0, 0, 0];
      for (let h = 0; h < hands; h++) {
        const rng = mulberry32(h * 7919 + 13);
        const d = dealHand(h + 1, h % 4, 100, [0, 0, 0, 0]).state;
        let s = d;
        if (d.phase === 'pass') s = (applyPasses(d, [0, 1, 2, 3].map((p) => choosePass(d, p, levels[p], rng))) as { state: HeartsState }).state;
        while (s.phase === 'play') s = (playCard(s, s.turn, chooseCard(s, s.turn, levels[s.turn], rng)) as { state: HeartsState }).state;
        for (let p = 0; p < 4; p++) total[p] += s.added[p];
      }
      return total.map((x) => x / hands);
    };
    const hardVsEasy = run([3, 1, 1, 1], 1200);
    const easyAvg = (hardVsEasy[1] + hardVsEasy[2] + hardVsEasy[3]) / 3;
    expect(hardVsEasy[0]).toBeLessThan(easyAvg - 1);
    const medVsEasy = run([2, 1, 1, 1], 1200);
    expect(medVsEasy[0]).toBeLessThan((medVsEasy[1] + medVsEasy[2] + medVsEasy[3]) / 3 - 0.5);
    const hardVsMed = run([3, 2, 2, 2], 1200);
    expect(hardVsMed[0]).toBeLessThan((hardVsMed[1] + hardVsMed[2] + hardVsMed[3]) / 3);
  }, 120_000);
  it('picks a card fast: a Hard move in the worst case is far under the 1 second cap', () => {
    const rng = mulberry32(3);
    const s = startPlay(3, 3, 100, [0, 0, 0, 0], rng);
    const t0 = Date.now();
    for (let i = 0; i < 2000; i++) chooseCard(s, s.turn, 3, rng);
    expect(Date.now() - t0).toBeLessThan(5000); // 2000 moves; each one is a handful of microseconds
  });
  it('exposes the levels and the delays the page uses', () => {
    expect(LEVEL_NAMES).toEqual({ 1: 'Easy', 2: 'Medium', 3: 'Hard' });
    expect(clampLevel(3)).toBe(3);
    for (const bad of [0, 4, '2', null, NaN, undefined]) expect(clampLevel(bad)).toBe(2);
    expect(AI_DELAY_REDUCED_MS).toBeLessThan(AI_DELAY_MS);
    expect(PLAYER_NAMES).toEqual(['You', 'Pip', 'Dot', 'Moss']);
    expect(PASS_DIRS).toEqual(['left', 'right', 'across', 'hold']);
  });
});

// ── whole games ──────────────────────────────────────────────────────────────

describe('whole games', () => {
  const playGame = (seed: number, limit: number, levels: Level[], cap = 60): { state: HeartsState; hands: number } => {
    const rng = mulberry32(seed ^ 0xabcdef);
    let s = newGame(seed, limit).state;
    let hands = 0;
    for (;;) {
      if (s.phase === 'pass') s = (applyPasses(s, [0, 1, 2, 3].map((p) => choosePass(s, p, levels[p], rng))) as { state: HeartsState }).state;
      while (s.phase === 'play') {
        s = (playCard(s, s.turn, chooseCard(s, s.turn, levels[s.turn], rng)) as { state: HeartsState }).state;
      }
      hands += 1;
      expect(validateState(s)).toBeNull();
      expect(s.added.reduce((a, b) => a + b, 0) === 26 || s.added.reduce((a, b) => a + b, 0) === 78).toBe(true);
      if (s.phase === 'game-over' || hands >= cap) return { state: s, hands };
      s = (nextHand(s) as { state: HeartsState }).state;
    }
  };
  it('every game to 100 and to 50 ends, with the lowest score winning and a unique winner', () => {
    for (const limit of [100, 50]) {
      for (let seed = 1; seed <= 60; seed++) {
        const levels: Level[] = [LEVELS[seed % 3], LEVELS[(seed + 1) % 3], LEVELS[(seed + 2) % 3], 3];
        const { state, hands } = playGame(seed, limit, levels);
        expect(state.phase).toBe('game-over');
        expect(hands).toBeGreaterThanOrEqual(2);
        expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(limit);
        const w = winners(state);
        expect(w.length).toBe(1);
        expect(state.scores[w[0]]).toBe(Math.min(...state.scores));
        // Every non-moon hand adds 26 in total, a moon adds 78, so the grand total is 26 per hand plus 52 per moon.
        const moons = state.moons.reduce((a, b) => a + b, 0);
        expect(state.scores.reduce((a, b) => a + b, 0)).toBe(26 * hands + 52 * moons);
      }
    }
  }, 120_000);
  it('a game of random players always finishes within a sensible number of hands', () => {
    let longest = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const { state, hands } = playGame(seed * 13, 100, [1, 1, 1, 1], 200);
      expect(state.phase).toBe('game-over');
      longest = Math.max(longest, hands);
    }
    expect(longest).toBeLessThan(80);
  }, 120_000);
  it('the same game number and the same moves give the same game', () => {
    const a = playGame(77, 100, [3, 2, 1, 2]);
    const b = playGame(77, 100, [3, 2, 1, 2]);
    expect(a.state.scores).toEqual(b.state.scores);
    expect(a.hands).toBe(b.hands);
  });
});

// ── words ────────────────────────────────────────────────────────────────────

describe('describing events', () => {
  it('says what happened to the human, in the right person', () => {
    expect(describeEvent({ t: 'play', p: 0, c: c('7H') })).toBe('You play the 7 of hearts.');
    expect(describeEvent({ t: 'play', p: 2, c: c('QS') })).toBe('Dot plays the Queen of spades.');
    expect(describeEvent({ t: 'trick', winner: 0, points: 0, cards: [] })).toBe('You take the trick.');
    expect(describeEvent({ t: 'trick', winner: 3, points: 14, cards: [] })).toBe('Moss takes the trick and gets 14 points.');
    expect(describeEvent({ t: 'trick', winner: 1, points: 1, cards: [] })).toBe('Pip takes the trick and gets 1 point.');
    expect(describeEvent({ t: 'broken', p: 1 })).toBe('Hearts are broken.');
    expect(describeEvent({ t: 'hand', points: [26, 0, 0, 0], moon: 0, added: [0, 26, 26, 26], scores: [0, 26, 26, 26] })).toMatch(/^You shoot the moon!/);
    expect(describeEvent({ t: 'hand', points: [26, 0, 0, 0], moon: 2, added: [26, 26, 0, 26], scores: [0, 0, 0, 0] })).toMatch(/^Dot shoots the moon!/);
    expect(describeEvent({ t: 'hand', points: [5, 8, 0, 13], moon: -1, added: [5, 8, 0, 13], scores: [5, 8, 0, 13] })).toBe('Hand over. Points this hand: You 5, Pip 8, Dot 0, Moss 13.');
    expect(describeEvent({ t: 'deal', hand: 0, dir: 'left' })).toBe('Hand 1. Pass 3 cards to the left to Pip.');
  });
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk into a fresh object with whole numbers inside the caps', () => {
    const zero = { p: 0, w: 0, b: 0, m: 0 };
    for (const bad of [null, undefined, 5, 'x', [], [1, 2], NaN, true]) expect(sanitizeStore(bad)).toEqual(zero);
    expect(sanitizeStore({ p: 'a', w: NaN, b: -1, m: 1.5 })).toEqual(zero);
    expect(sanitizeStore({ p: 1e12, w: 1e12, b: 1e12, m: 1e12 })).toEqual(zero);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":9},"p":3,"w":9,"b":41,"m":2}'))).toEqual({ p: 3, w: 3, b: 41, m: 2 });
    const clean = sanitizeStore({ p: 4, w: 2, b: 30, m: 1, extra: 1 });
    expect(clean).toEqual({ p: 4, w: 2, b: 30, m: 1 });
    expect(Object.keys(clean).sort()).toEqual(['b', 'm', 'p', 'w']);
    expect(Object.getPrototypeOf(sanitizeStore({}))).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).p).toBeUndefined();
  });
  it('records games, wins, moons and the lowest score (stored plus one so 0 is "none")', () => {
    let s = sanitizeStore(null);
    let r = recordGame(s, 62, false, 0);
    expect(r.record).toBe(false); // the first game has no earlier best to beat
    expect(r.store).toEqual({ p: 1, w: 0, b: 63, m: 0 });
    r = recordGame(r.store, 80, false, 0);
    expect(r.record).toBe(false);
    expect(r.store.b).toBe(63);
    r = recordGame(r.store, 41, true, 2);
    expect(r.record).toBe(true);
    expect(r.store).toEqual({ p: 3, w: 1, b: 42, m: 2 });
    r = recordGame(r.store, 0, true, 0);
    expect(r.store.b).toBe(1);
    expect(recordGame(s, 1e9, true, 1e9).store).toEqual({ p: 1, w: 1, b: MAX_SCORE + 1, m: MAX_COUNT });
    expect(recordGame(s, NaN, false, NaN).store.b).toBe(MAX_SCORE + 1);
    s = { p: MAX_COUNT, w: MAX_COUNT, b: 5, m: MAX_COUNT };
    expect(recordGame(s, 100, true, 5).store).toEqual({ p: MAX_COUNT, w: MAX_COUNT, b: 5, m: MAX_COUNT });
  });
});

// ── the page ─────────────────────────────────────────────────────────────────

describe('the page promises what the guide says', () => {
  it('stores under its own key, wires the shell, and names no other game', () => {
    expect(calculatorSource).toContain("'gk:game:hearts'");
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
  it('names the pass choices and the hold hand to the player', () => {
    expect(PASS_DIRS.map((d) => passSentence(d)).join(' ')).toMatch(/No passing/);
    expect(LEVEL_NAMES[3]).toBe('Hard');
  });
});
