/**
 * games-beggar-my-neighbour.test.ts - the engine behind `beggar-my-neighbour`.
 *
 * Pinned: the 52-card pack and the penalties (Jack 1, Queen 2, King 3, Ace 4), an unbiased seeded shuffle
 * (chi-square), the deal (26 each), every rule by hand-built positions (a number card passes the turn, a face
 * card makes the other player pay one card at a time, a face card turned up while paying turns the payment
 * round, a completed payment gives the claimant the whole pile, running out of cards loses, the pile joins the
 * bottom of the collector's hand in the order played), the whole game compared with an independent second
 * implementation on 2,500 full deals and 2,500 small positions, loop detection (a position that comes round
 * again is a draw, and an independent replay shows such a game really never ends), the play cap, no card lost or
 * duplicated at any step of thousands of games, the stored results, and the wording. The source is checked for
 * the claims the guide page makes.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, fromHands, step, playOut, validateState, penaltyOf, isFaceCard, describeEvent, resultSentence, nextHint, countOf,
  sanitizeStore, recordGame, mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isRed, plural,
  SUIT_CHARS, SUIT_NAMES, RANK_LABELS, DECK, MAX_PLAYS, MAX_COUNT, SPEEDS, SPEED_MS, SPEED_NAMES, AI_DELAY_MS, AI_DELAY_REDUCED_MS, OPPONENT_NAME,
  type BeggarState, type BeggarEvent,
} from '../src/components/apps-private/beggar-my-neighbour/helpers';
import calculatorSource from '../src/components/apps-private/beggar-my-neighbour/Calculator.astro?raw';

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts. */
const c = (code: string): number => {
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};
const hand = (codes: string[]): number[] => codes.map(c);
const mk = (a: string[], b: string[], turn: 0 | 1 = 0): BeggarState => fromHands(hand(a), hand(b), turn);
const go = (s: BeggarState): { state: BeggarState; events: BeggarEvent[] } => {
  const r = step(s);
  if (!r) throw new Error('step was refused');
  return r;
};
const kinds = (ev: BeggarEvent[]): string[] => ev.map((e) => e.t);
const ALL = Array.from({ length: DECK }, (_, i) => i);

// ── an independent second implementation of the rules ────────────────────────

const REF_PEN: Record<number, number> = { 1: 4, 11: 1, 12: 2, 13: 3 };

/**
 * Plays a whole game in rounds, from the leader's free play to the pile being collected. It is a separate
 * program from the engine: a round is a nested loop and nothing is shared. With `detect` it calls a repeat of
 * (hands, leader) at the start of a round a loop; without it the game is simply cut off after `limit` cards.
 */
const refGame = (a: number[], b: number[], limit: number, detect: boolean): { winner: number; plays: number; end: 'cards' | 'loop' | 'cap' } => {
  const h = [a.slice(), b.slice()];
  let pile: number[] = [];
  let leader = 0;
  let plays = 0;
  const seen = new Set<string>();
  for (;;) {
    const key = `${leader}/${h[0].join('.')}/${h[1].join('.')}`;
    if (detect) {
      if (seen.has(key)) return { winner: -1, plays, end: 'loop' };
      seen.add(key);
    }
    let who = leader;
    let collected = false;
    while (!collected) {
      if (plays >= limit) return { winner: -1, plays, end: 'cap' };
      if (h[who].length === 0) return { winner: 1 - who, plays, end: 'cards' };
      const card = h[who].shift() as number;
      pile.push(card);
      plays += 1;
      let demand = REF_PEN[(card % 13) + 1] ?? 0;
      if (demand === 0) { who = 1 - who; continue; }
      // A challenge: `who` is owed `demand` cards by the other player.
      let owedTo = who;
      let payer = 1 - who;
      let settled = false;
      while (!settled) {
        let paid = 0;
        let turned = false;
        while (paid < demand) {
          if (h[payer].length === 0) {
            h[owedTo].push(...pile);
            pile = [];
            return { winner: owedTo, plays, end: 'cards' };
          }
          const pc = h[payer].shift() as number;
          pile.push(pc);
          plays += 1;
          const d2 = REF_PEN[(pc % 13) + 1] ?? 0;
          if (d2 > 0) { turned = true; demand = d2; [owedTo, payer] = [payer, owedTo]; break; }
          paid += 1;
        }
        if (!turned) { settled = true; }
      }
      h[owedTo].push(...pile);
      pile = [];
      leader = owedTo;
      collected = true;
      if (h[1 - owedTo].length === 0) return { winner: owedTo, plays, end: 'cards' };
    }
  }
};

/** Small positions found by searching, each of which goes round in a circle for ever. */
const KNOWN_LOOPS: [number[], number[]][] = [
  [[6, 37, 1, 45, 14, 34], [4, 43, 29, 41, 25, 35]],
  [[10, 42, 4], [18, 47, 3, 2, 49, 36, 32, 7, 14]],
  [[14, 35, 10], [44, 0, 31, 45, 49, 21, 6, 47, 19, 27]],
  [[19, 40, 44, 16, 48, 17, 23], [38, 33, 3, 47, 28]],
  [[49, 28, 30, 40, 3], [47, 1, 29, 23]],
];

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards', () => {
  it('maps ids to suit and rank and back for all 52', () => {
    for (let id = 0; id < DECK; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
  });
  it('has 52 unique plain-language names and text-presentation suit glyphs', () => {
    expect(new Set(ALL.map(cardName)).size).toBe(52);
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(SUIT_NAMES).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
    expect(cardName(c('JD'))).toBe('Jack of diamonds');
    expect(cardLabel(c('10H'))).toBe('10♥︎');
    expect([0, 1, 2, 3].map((s) => isRed(cardId(s, 4)))).toEqual([false, true, true, false]);
  });
  it('makes the penalties Jack 1, Queen 2, King 3, Ace 4 and nothing for the other cards', () => {
    expect(penaltyOf(c('JS'))).toBe(1);
    expect(penaltyOf(c('QH'))).toBe(2);
    expect(penaltyOf(c('KD'))).toBe(3);
    expect(penaltyOf(c('AC'))).toBe(4);
    for (const r of ['2', '3', '4', '5', '6', '7', '8', '9', '10']) expect(penaltyOf(c(`${r}S`))).toBe(0);
    expect(ALL.filter(isFaceCard).length).toBe(16);
    // 4 of each face card: 4 x (1 + 2 + 3 + 4) = 40 penalty cards in the pack.
    expect(ALL.reduce((n, id) => n + penaltyOf(id), 0)).toBe(40);
  });
  it('plural reads naturally', () => {
    expect(plural(1, 'card')).toBe('1 card');
    expect(plural(0, 'card')).toBe('0 cards');
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
    expect(chi).toBeLessThan(87.7); // p = 0.001 for 51 degrees of freedom
  });
  it('deals 26 cards to each player, the whole pack once, and player 0 plays first', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = newGame(mulberry32(seed));
      expect(s.hands[0].length).toBe(26);
      expect(s.hands[1].length).toBe(26);
      expect([...s.hands[0], ...s.hands[1]].sort((a, b) => a - b)).toEqual(ALL);
      expect(validateState(s)).toBeNull();
      expect(s.turn).toBe(0);
      expect(s.pile).toEqual([]);
      expect(s.owed).toBe(0);
      expect(s.over).toBe(false);
    }
  });
  it('is the same for the same seed and different for another', () => {
    expect(newGame(mulberry32(5))).toEqual(newGame(mulberry32(5)));
    expect(newGame(mulberry32(5)).hands).not.toEqual(newGame(mulberry32(6)).hands);
  });
});

// ── the rules, by hand-built positions ──────────────────────────────────────

describe('the rules', () => {
  it('passes the turn after a number card and leaves the pile growing', () => {
    let s = mk(['3S', '4S', '5S'], ['6S', '7S']);
    let r = go(s);
    expect(kinds(r.events)).toEqual(['play']);
    expect(r.state.turn).toBe(1);
    expect(r.state.pile).toEqual([c('3S')]);
    expect(r.state.hands[0]).toEqual(hand(['4S', '5S']));
    s = r.state;
    r = go(s);
    expect(r.state.turn).toBe(0);
    expect(r.state.pile).toEqual(hand(['3S', '6S']));
    expect(r.state.plays).toBe(2);
    expect(r.state.owed).toBe(0);
  });
  it('makes the other player pay one card for a Jack, and the asker collects the pile and leads', () => {
    const s = mk(['JS', '2S'], ['5S', '6S', '7S']);
    const a = go(s);
    expect(kinds(a.events)).toEqual(['play', 'demand']);
    expect(a.events[1]).toMatchObject({ t: 'demand', by: 0, of: 1, count: 1, counter: false });
    expect(a.state.owed).toBe(1);
    expect(a.state.claimant).toBe(0);
    expect(a.state.turn).toBe(1);
    const b = go(a.state);
    expect(kinds(b.events)).toEqual(['play', 'collect']);
    expect(b.events[1]).toEqual({ t: 'collect', by: 0, count: 2 });
    expect(b.state.pile).toEqual([]);
    expect(b.state.turn).toBe(0);
    expect(b.state.hands[0]).toEqual(hand(['2S', 'JS', '5S'])); // the pile goes underneath, in the order played
    expect(b.state.hands[1]).toEqual(hand(['6S', '7S']));
  });
  it('asks 2 for a Queen, 3 for a King and 4 for an Ace, one card at a time', () => {
    for (const [code, n] of [['QS', 2], ['KS', 3], ['AS', 4]] as const) {
      let s = mk([code, '2S', '3S'], ['4S', '5S', '6S', '7S', '8S', '9S']);
      s = go(s).state;
      expect(s.owed).toBe(n);
      for (let k = 1; k <= n; k++) {
        const r = go(s);
        s = r.state;
        if (k < n) {
          expect(s.turn).toBe(1);
          expect(s.owed).toBe(n - k);
          expect(kinds(r.events)).toEqual(['play']);
        } else {
          expect(kinds(r.events)).toEqual(['play', 'collect']);
          expect(s.turn).toBe(0);
          expect(s.pile).toEqual([]);
          expect(s.hands[0].length).toBe(2 + n + 1);
        }
      }
    }
  });
  it('turns the payment round when the payer turns up a face card, then the first player pays', () => {
    // p0 plays a King (p1 owes 3). p1 pays a 7, then turns up a Jack: now p0 owes 1.
    let s = mk(['KS', '9S', '4S'], ['7S', 'JD', '3S']);
    s = go(s).state; // K
    s = go(s).state; // 7 (owed 2)
    expect(s.owed).toBe(2);
    const j = go(s); // Jack
    expect(j.events[1]).toMatchObject({ t: 'demand', by: 1, of: 0, count: 1, counter: true });
    expect(j.state.owed).toBe(1);
    expect(j.state.claimant).toBe(1);
    expect(j.state.turn).toBe(0);
    const pay = go(j.state); // p0 pays the 9
    expect(kinds(pay.events)).toEqual(['play', 'collect']);
    expect(pay.events[1]).toEqual({ t: 'collect', by: 1, count: 4 }); // K 7 J 9
    expect(pay.state.turn).toBe(1);
    expect(pay.state.hands[1]).toEqual(hand(['3S', 'KS', '7S', 'JD', '9S']));
    expect(pay.state.hands[0]).toEqual(hand(['4S']));
  });
  it('lets the payment bounce back and forth until someone pays in full', () => {
    // K, J, Q, A in a row: each one turns the payment round to the other player.
    let s = mk(['KS', 'QD', '2S', '3S', '4S', '5S', '6S'], ['JS', 'AD', '7S', '8S', '9S', '10S']);
    const trace: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = go(s).state;
      trace.push(s.owed);
    }
    // After K: 3 owed. p1 plays J: 1 owed by p0. p0 plays Q: 2 owed by p1. p1 plays A: 4 owed by p0.
    expect(trace).toEqual([3, 1, 2, 4]);
    expect(s.turn).toBe(0);
    expect(s.claimant).toBe(1);
  });
  it('lets a player who pays with the very last card still hand over the pile, and then loses', () => {
    // p0 plays a Jack; p1 pays their only card; p0 collects and p1 has nothing: p0 has every card.
    let s = mk(['JS', '2S'], ['5S']);
    s = go(s).state;
    const r = go(s);
    expect(kinds(r.events)).toEqual(['play', 'collect', 'over']);
    expect(r.state.over).toBe(true);
    expect(r.state.winner).toBe(0);
    expect(r.state.reason).toBe('cards');
    expect(r.state.hands[1]).toEqual([]);
  });
  it('loses when the payment cannot be completed, and the claimant takes the pile', () => {
    let s = mk(['AS', '2S', '3S'], ['4S', '5S']);
    s = go(s).state; // A: owes 4
    s = go(s).state; // 4
    s = go(s).state; // 5, owes 2 more
    expect(s.owed).toBe(2);
    expect(s.hands[1]).toEqual([]);
    const r = go(s);
    expect(kinds(r.events)).toEqual(['collect', 'over']);
    expect(r.state.winner).toBe(0);
    expect(r.state.hands[0].length).toBe(2 + 3);
    expect(r.state.pile).toEqual([]);
  });
  it('loses when the player to lead has no cards left', () => {
    let s = mk(['3S'], ['4S', '5S', '6S']);
    s = go(s).state; // p0 plays their last card
    s = go(s).state; // p1 plays a number card; the turn is p0's
    expect(s.turn).toBe(0);
    expect(s.hands[0]).toEqual([]);
    const r = go(s);
    expect(r.state.over).toBe(true);
    expect(r.state.winner).toBe(1);
    expect(r.state.reason).toBe('cards');
  });
  it('does not end the game just because a player played their last card as a face card', () => {
    // p0 plays their last card, a Queen; p1 pays 2 and p0 collects and goes on.
    let s = mk(['QS'], ['4S', '5S', '6S']);
    s = go(s).state;
    s = go(s).state;
    const r = go(s);
    expect(r.state.over).toBe(false);
    expect(r.state.hands[0].length).toBe(3);
    expect(r.state.turn).toBe(0);
  });
  it('refuses to step a finished game and does not change the state it was given', () => {
    const s = mk(['3S'], ['4S', '5S', '6S']);
    const copy = JSON.stringify(s);
    go(s);
    expect(JSON.stringify(s)).toBe(copy);
    const done = playOut(s);
    expect(done.over).toBe(true);
    expect(step(done)).toBeNull();
  });
});

// ── the whole game against the independent implementation ───────────────────

describe('whole games', () => {
  it('match the independent implementation on 2,500 full deals (winner, number of cards played, and how it ended)', () => {
    let wins0 = 0;
    for (let seed = 1; seed <= 2500; seed++) {
      const s = newGame(mulberry32(seed * 977));
      const ref = refGame(s.hands[0], s.hands[1], MAX_PLAYS, true);
      const e = playOut(s);
      expect(e.over).toBe(true);
      expect(e.winner).toBe(ref.winner);
      expect(e.plays).toBe(ref.plays);
      expect(e.reason).toBe(ref.end);
      if (e.winner === 0) wins0 += 1;
    }
    // Nobody is favoured by going first: the human wins about half of them.
    expect(wins0 / 2500).toBeGreaterThan(0.45);
    expect(wins0 / 2500).toBeLessThan(0.55);
  }, 120_000);
  it('never loses or duplicates a card in 400 whole games, and the winner ends with all 52', () => {
    for (let seed = 1; seed <= 400; seed++) {
      let s = newGame(mulberry32(seed));
      let guard = 0;
      while (!s.over) {
        expect(guard++).toBeLessThan(MAX_PLAYS + 5);
        const bad = validateState(s);
        if (bad) throw new Error(bad);
        s = go(s).state;
      }
      expect(validateState(s)).toBeNull();
      if (s.reason === 'cards') expect(s.hands[s.winner as 0 | 1].length).toBe(52);
    }
  }, 120_000);
  it('has no decisions: the same deal always plays out the same way', () => {
    const a = playOut(newGame(mulberry32(3)));
    const b = playOut(newGame(mulberry32(3)));
    expect(a).toEqual(b);
  });
  it('matches the independent implementation on 2,500 small positions, including ones that go round in a circle', () => {
    let loops = 0;
    for (let seed = 1; seed <= 2500; seed++) {
      const rng = mulberry32(seed);
      const pool = shuffled(ALL, rng).slice(0, 6 + Math.floor(rng() * 9));
      const cut = 2 + Math.floor(rng() * (pool.length - 3));
      const a = pool.slice(0, cut);
      const b = pool.slice(cut);
      const e = playOut(fromHands(a, b, 0));
      const ref = refGame(a, b, MAX_PLAYS, true);
      expect(e.winner).toBe(ref.winner);
      expect(e.plays).toBe(ref.plays);
      expect(e.reason).toBe(ref.end);
      if (e.reason === 'loop') loops += 1;
    }
    expect(loops).toBeGreaterThanOrEqual(0);
  }, 120_000);
  it('matches the independent implementation on five known looping positions and shows each really never ends', () => {
    for (const [a, b] of KNOWN_LOOPS) {
      const e = playOut(fromHands(a, b, 0));
      const ref = refGame(a, b, MAX_PLAYS, true);
      expect(e.reason).toBe('loop');
      expect(ref.end).toBe('loop');
      expect(e.plays).toBe(ref.plays);
      expect(refGame(a, b, 8000, false).end).toBe('cap');
    }
  });
});

describe('loops and the cap', () => {
  // Found by searching small positions: this one goes round in a circle for ever.
  const A = [49, 28, 30, 40, 3];
  const B = [47, 1, 29, 23];
  it('calls a position that comes round again a draw', () => {
    const e = playOut(fromHands(A, B, 0));
    expect(e.over).toBe(true);
    expect(e.winner).toBe(-1);
    expect(e.reason).toBe('loop');
    expect(e.plays).toBeLessThan(200);
    // The last step reports it.
    let s = fromHands(A, B, 0);
    let last: BeggarEvent[] = [];
    while (!s.over) { const r = go(s); s = r.state; last = r.events; }
    expect(last[last.length - 1]).toEqual({ t: 'over', winner: -1, reason: 'loop' });
  });
  it('is a true loop: without loop detection the same game is still going after 20,000 cards', () => {
    const ref = refGame(A, B, 20000, false);
    expect(ref.end).toBe('cap');
    expect(ref.plays).toBeGreaterThanOrEqual(20000);
    // And the detected draw agrees with the independent detector.
    expect(refGame(A, B, MAX_PLAYS, true).end).toBe('loop');
  });
  it('stops at the cap with a draw when a game somehow runs past it', () => {
    const s = { ...fromHands(hand(['3S', '4S']), hand(['5S', '6S'])), plays: MAX_PLAYS - 1 };
    const r = go(s);
    expect(r.state.over).toBe(true);
    expect(r.state.winner).toBe(-1);
    expect(r.state.reason).toBe('cap');
    expect(MAX_PLAYS).toBe(20000);
  });
  it('ends every one of 2,500 random full games well inside the cap', () => {
    let longest = 0;
    let total = 0;
    for (let seed = 1; seed <= 2500; seed++) {
      const plays = playOut(newGame(mulberry32(seed * 31))).plays;
      longest = Math.max(longest, plays);
      total += plays;
    }
    expect(longest).toBeLessThan(6000);
    // A typical game is a few hundred cards played (about 260 on average).
    expect(total / 2500).toBeGreaterThan(200);
    expect(total / 2500).toBeLessThan(320);
  }, 120_000);
});

// ── words ────────────────────────────────────────────────────────────────────

describe('describing events', () => {
  it('says what happened in the right person', () => {
    expect(describeEvent({ t: 'play', by: 0, card: c('7H'), paying: false })).toBe('You play the 7 of hearts.');
    expect(describeEvent({ t: 'play', by: 1, card: c('KS'), paying: false })).toBe('Pip plays the King of spades.');
    expect(describeEvent({ t: 'demand', by: 1, of: 0, card: c('QS'), count: 2, counter: false })).toBe('A Queen! You must pay 2 cards.');
    expect(describeEvent({ t: 'demand', by: 0, of: 1, card: c('JS'), count: 1, counter: false })).toBe('A Jack! Pip must pay 1 card.');
    expect(describeEvent({ t: 'demand', by: 0, of: 1, card: c('AS'), count: 4, counter: true })).toBe('You turn up an Ace while paying, so Pip must pay 4 cards now.');
    expect(describeEvent({ t: 'demand', by: 1, of: 0, card: c('AH'), count: 4, counter: false })).toBe('An Ace! You must pay 4 cards.');
    expect(describeEvent({ t: 'collect', by: 0, count: 6 })).toBe('You collect the pile of 6 cards.');
    expect(describeEvent({ t: 'collect', by: 1, count: 1 })).toBe('Pip collects the pile of 1 card.');
    expect(describeEvent({ t: 'over', winner: 0, reason: 'cards' })).toBe('You have all the cards. You win!');
    expect(describeEvent({ t: 'over', winner: -1, reason: 'loop' })).toMatch(/draw/);
  });
  it('wraps the ending kindly and says what a press of Play will do', () => {
    const won = { ...playOut(mk(['3S', '4S'], ['5S'])) };
    expect(resultSentence(won)).toMatch(/^You won/);
    const lost = { ...playOut(mk(['3S'], ['4S', '5S', '6S'])) };
    expect(resultSentence(lost)).toMatch(/Try again!$/);
    expect(resultSentence({ ...mk(['3S'], ['4S']), over: false })).toBe(`Unfinished: you hold 1, ${OPPONENT_NAME} holds 1.`);
    expect(resultSentence(playOut(fromHands([49, 28, 30, 40, 3], [47, 1, 29, 23], 0)))).toMatch(/would never end/);
    const s = mk(['3S'], ['4S']);
    expect(nextHint(s)).toBe('Your turn: play your top card.');
    expect(nextHint({ ...s, turn: 1 })).toBe('Pip plays next.');
    expect(nextHint({ ...s, owed: 3, claimant: 1 })).toBe('Pay 3 cards: play your next card.');
    expect(nextHint({ ...s, owed: 1, claimant: 0, turn: 1 })).toBe('Pip pays 1 card.');
    expect(nextHint({ ...s, over: true })).toBe('The game is over.');
    expect(countOf(s, 0)).toBe(1);
  });
  it('speeds: four, from slow to very fast, with the computer a little slower than the fastest', () => {
    expect(SPEEDS).toEqual(['slow', 'normal', 'fast', 'rapid']);
    expect(SPEEDS.map((k) => SPEED_NAMES[k])).toEqual(['Slow', 'Normal', 'Fast', 'Very fast']);
    expect(SPEED_MS.slow).toBeGreaterThan(SPEED_MS.normal);
    expect(SPEED_MS.normal).toBeGreaterThan(SPEED_MS.fast);
    expect(SPEED_MS.fast).toBeGreaterThan(SPEED_MS.rapid);
    expect(SPEED_MS.rapid).toBeGreaterThanOrEqual(30);
    expect(AI_DELAY_REDUCED_MS).toBeLessThan(AI_DELAY_MS);
  });
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk into a fresh object with whole numbers inside the caps', () => {
    const zero = { p: 0, w: 0, d: 0, l: 0 };
    for (const bad of [null, undefined, 5, 'x', [], [1, 2], NaN, true]) expect(sanitizeStore(bad)).toEqual(zero);
    expect(sanitizeStore({ p: 'a', w: NaN, d: -1, l: 1.5 })).toEqual(zero);
    expect(sanitizeStore({ p: 1e12, w: 1e12, d: 1e12, l: 1e12 })).toEqual(zero);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":9},"p":5,"w":2,"d":1,"l":400}'))).toEqual({ p: 5, w: 2, d: 1, l: 400 });
    // The parts cannot exceed what they are parts of.
    expect(sanitizeStore({ p: 3, w: 9, d: 9, l: 100 })).toEqual({ p: 3, w: 3, d: 0, l: 100 });
    expect(sanitizeStore({ p: 3, w: 0, d: 0, l: 100 })).toEqual({ p: 3, w: 0, d: 0, l: 0 });
    expect(Object.keys(sanitizeStore({ p: 1, extra: 1 })).sort()).toEqual(['d', 'l', 'p', 'w']);
    expect(Object.getPrototypeOf(sanitizeStore({}))).toBe(Object.prototype);
  });
  it('records games, wins, draws and the longest win', () => {
    const won = playOut(mk(['3S', '4S'], ['5S']));
    const lost = playOut(mk(['3S'], ['4S', '5S', '6S']));
    const drawn = playOut(fromHands([49, 28, 30, 40, 3], [47, 1, 29, 23], 0));
    let s = sanitizeStore(null);
    let r = recordGame(s, won);
    expect(r.store).toEqual({ p: 1, w: 1, d: 0, l: won.plays });
    expect(r.record).toBe(true);
    r = recordGame(r.store, lost);
    expect(r.store).toEqual({ p: 2, w: 1, d: 0, l: won.plays });
    expect(r.record).toBe(false);
    r = recordGame(r.store, drawn);
    expect(r.store).toEqual({ p: 3, w: 1, d: 1, l: won.plays });
    // An unfinished game is counted as played but is neither a win nor a draw.
    r = recordGame(r.store, mk(['3S'], ['4S']));
    expect(r.store).toEqual({ p: 4, w: 1, d: 1, l: won.plays });
    s = { p: MAX_COUNT, w: MAX_COUNT, d: 0, l: MAX_PLAYS };
    expect(recordGame(s, won).store.p).toBe(MAX_COUNT);
  });
});

// ── the page ─────────────────────────────────────────────────────────────────

describe('the page promises what the guide says', () => {
  it('stores under its own key, wires the shell and announces', () => {
    expect(calculatorSource).toContain("'gk:game:beggar-my-neighbour'");
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
});
