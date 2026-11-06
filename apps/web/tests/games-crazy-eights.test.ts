/**
 * games-crazy-eights.test.ts - the engine behind `crazy-eights`.
 *
 * Pinned: the 52-card pack, an unbiased seeded shuffle (chi-square), the deal (7 cards for 2
 * players, 5 for 3 or 4, an eight never starts the pile), the match rule checked against an
 * independent predicate for all 52 x 52 x 4 combinations, eights wild and naming a suit,
 * drawing (until you can play, or up to 3 then pass), the stock reshuffle, automatic passes, the
 * blocked and 500-turn endings, the three computer levels (always legal, Medium keeps its
 * eights, Hard beats Easy over seeded games), the words for every event (a computer's draw is
 * never named), the stored results, and a fuzz of random games for 2, 3 and 4 players with both
 * draw rules: no card lost or duplicated at any step, every game ends, and the player to move can
 * always act. The source is checked for the traditional-rules promise: no action-card wording.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, play, draw, legalPlays, canPlayCard, canDraw, drawableCount, topCard, winners, validateState, computerTurn, choosePlay, chooseSuit,
  newMemory, observe, describeEvent, playerNames, resultSentence, cardsLine, sanitizeStore, recordGame, clampPlayers, clampRule, handSizeFor, drawLimit,
  mulberry32, shuffled, cardId, cardName, cardLabel, rankOf, suitOf, isRed, isWild, plural, joinList,
  SUIT_CHARS, SUIT_NAMES, RANK_LABELS, DECK, MAX_TURNS, AI_DELAY_MS, AI_DELAY_REDUCED_MS, MAX_COUNT, LEVEL_NAMES, DRAW_RULES, OPPONENT_NAMES,
  type EightsState, type EightsEvent, type DrawRule, type Level, type Memory,
} from '../src/components/apps-private/crazy-eights/helpers';
import helpersSource from '../src/components/apps-private/crazy-eights/helpers.ts?raw';
import calculatorSource from '../src/components/apps-private/crazy-eights/Calculator.astro?raw';

// ── building positions ──────────────────────────────────────────────────────

const SUIT_OF: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
/** '7H' = seven of hearts. */
const c = (code: string): number => {
  const rank = (RANK_LABELS as readonly string[]).indexOf(code.slice(0, -1)) + 1;
  return cardId(SUIT_OF[code.slice(-1)], rank);
};
const bySuit = (ids: number[]): number[] => ids.slice().sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b));

/** A hand-built position. `top` is the card in play; the stock is what you list (top = last); other cards are simply absent. */
const mk = (hands: string[][], top: string, opts: { stock?: string[]; turn?: number; rule?: DrawRule; suit?: number; turns?: number; discard?: string[] } = {}): EightsState => {
  const discard = (opts.discard ?? [top]).map(c);
  return {
    players: hands.length, hands: hands.map((h) => bySuit(h.map(c))), stock: (opts.stock ?? []).map(c), discard,
    suit: opts.suit ?? suitOf(c(top)), turn: opts.turn ?? 0, draws: 0, rule: opts.rule ?? 'until', over: false, winner: -1,
    blocked: false, capped: false, turns: opts.turns ?? 0, passRun: 0, reshuffles: 0,
  };
};
const allCards = (s: EightsState): number[] => [...s.hands.flat(), ...s.stock, ...s.discard];
const mustPlay = (s: EightsState, code: string, named?: number) => {
  const r = play(s, c(code), named);
  if (!r) throw new Error(`play ${code} was refused`);
  expect(allCards(r.state).sort((a, b) => a - b)).toEqual(allCards(s).sort((a, b) => a - b));
  return r;
};
const kinds = (ev: EightsEvent[]): string[] => ev.map((e) => e.t);

// ── cards ────────────────────────────────────────────────────────────────────

describe('cards', () => {
  it('maps ids to suit and rank and back for all 52', () => {
    for (let id = 0; id < DECK; id++) expect(cardId(suitOf(id), rankOf(id))).toBe(id);
  });
  it('colours hearts and diamonds red and has 52 unique plain-language names', () => {
    expect([0, 1, 2, 3].map((s) => isRed(cardId(s, 4)))).toEqual([false, true, true, false]);
    expect(new Set(Array.from({ length: DECK }, (_, i) => cardName(i))).size).toBe(52);
    expect(cardName(c('8H'))).toBe('8 of hearts');
    expect(cardName(c('KS'))).toBe('King of spades');
  });
  it('uses text-presentation suit glyphs with distinct shapes', () => {
    expect(SUIT_CHARS.every((x) => x.endsWith('︎'))).toBe(true);
    expect(new Set(SUIT_CHARS).size).toBe(4);
    expect(SUIT_NAMES).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
    expect(cardLabel(c('10C'))).toBe('10♣︎');
  });
  it('only the four eights are wild', () => {
    expect(Array.from({ length: DECK }, (_, i) => i).filter(isWild).map(rankOf)).toEqual([8, 8, 8, 8]);
  });
  it('plural and joinList read naturally', () => {
    expect(plural(1, 'card')).toBe('1 card');
    expect(plural(3, 'card')).toBe('3 cards');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('shuffle', () => {
  it('is a permutation, deterministic for a seed, and leaves its input alone', () => {
    const src = Array.from({ length: DECK }, (_, i) => i);
    const out = shuffled(src, mulberry32(7));
    expect(out.slice().sort((a, b) => a - b)).toEqual(src);
    expect(src[0]).toBe(0);
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
});

// ── the deal ─────────────────────────────────────────────────────────────────

describe('newGame', () => {
  it('deals 7 each to 2 players and 5 each to 3 or 4, turns one card up, and leaves the rest as the stock', () => {
    for (const [n, size] of [[2, 7], [3, 5], [4, 5]] as const) {
      const { state } = newGame(n, 'until', mulberry32(11));
      expect(handSizeFor(n)).toBe(size);
      expect(state.hands.map((h) => h.length)).toEqual(new Array(n).fill(size));
      expect(state.discard).toHaveLength(1);
      expect(state.stock).toHaveLength(DECK - n * size - 1);
      expect(state.turn).toBe(0);
    }
  });
  it('uses all 52 distinct cards exactly once for many seeds and passes validation', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const n of [2, 3, 4]) {
        const { state } = newGame(n, seed % 2 ? 'until' : 'three', mulberry32(seed));
        expect(allCards(state).sort((a, b) => a - b)).toEqual(Array.from({ length: DECK }, (_, i) => i));
        expect(validateState(state)).toBeNull();
      }
    }
  });
  it('never starts the pile with an eight; the eight goes to the bottom of the stock and the next card is turned', () => {
    let buried = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      const n = 2;
      const deck = shuffled(Array.from({ length: DECK }, (_, i) => i), mulberry32(seed));
      const startIdx = DECK - n * handSizeFor(n) - 1; // the card that would be turned first
      const { state } = newGame(n, 'until', mulberry32(seed));
      expect(isWild(state.discard[0])).toBe(false);
      expect(state.suit).toBe(suitOf(state.discard[0]));
      if (isWild(deck[startIdx])) {
        buried += 1;
        expect(state.stock).toContain(deck[startIdx]);
        expect(state.stock.indexOf(deck[startIdx])).toBeLessThan(4); // sent to the bottom
        if (!isWild(deck[startIdx - 1])) expect(state.discard[0]).toBe(deck[startIdx - 1]); // the next card down is turned
      }
    }
    expect(buried).toBeGreaterThan(100); // about 1 in 13 of 4000
  });
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(newGame(3, 'three', mulberry32(5)))).toBe(JSON.stringify(newGame(3, 'three', mulberry32(5))));
  });
  it('clamps junk options', () => {
    for (const bad of [0, 1, 5, 2.5, NaN, '3', null, undefined]) expect(clampPlayers(bad)).toBe(2);
    expect(clampPlayers(4)).toBe(4);
    expect(clampRule('three')).toBe('three');
    for (const bad of ['x', 3, null, undefined, 'THREE']) expect(clampRule(bad)).toBe('until');
    expect(drawLimit('until')).toBe(Infinity);
    expect(drawLimit('three')).toBe(3);
    expect(DRAW_RULES).toEqual(['until', 'three']);
  });
});

// ── the match rule ───────────────────────────────────────────────────────────

describe('canPlayCard', () => {
  it('matches an independent predicate for every card against every top card and every called suit', () => {
    // Independent: write cards as [suit, rank] pairs and compare with plain conditions.
    const pair = (id: number): [number, number] => [Math.floor(id / 13), (id % 13) + 1];
    for (let top = 0; top < DECK; top++) {
      for (let suit = 0; suit < 4; suit++) {
        const s = mk([[], []], 'AS', { discard: [], suit });
        s.discard = [top];
        for (let card = 0; card < DECK; card++) {
          const [cs, cr] = pair(card);
          const [, tr] = pair(top);
          const expected = cr === 8 || cs === suit || cr === tr;
          expect(canPlayCard(s, card), `card ${card} on top ${top} suit ${suit}`).toBe(expected);
        }
      }
    }
  });
  it('legalPlays lists exactly the playable cards of the hand', () => {
    const s = mk([['7H', '2C', '8S', 'KD', '7S']], 'JH');
    expect(legalPlays(s).map(cardName)).toEqual(['8 of spades', '7 of hearts'].map((x) => x)); // sorted by suit then rank: spades first
  });
  it('an eight called to a suit makes the next card follow that suit', () => {
    let s = mk([['8C', '2S'], ['5H', '5S', '9D']], '3C');
    s = mustPlay(s, '8C', SUIT_OF.H).state;
    expect(s.suit).toBe(1);
    expect(legalPlays(s).map(cardName)).toEqual(['5 of hearts']);
  });
});

// ── playing ──────────────────────────────────────────────────────────────────

describe('play', () => {
  it('puts the card on the pile, sets the suit and passes the turn', () => {
    const s = mk([['7H', '2C'], ['9D', '3S']], '4H');
    const { state, events } = mustPlay(s, '7H');
    expect(topCard(state)).toBe(c('7H'));
    expect(state.suit).toBe(1);
    expect(state.hands[0].map(cardName)).toEqual(['2 of clubs']);
    expect(state.turn).toBe(1);
    expect(kinds(events)).toEqual(['play']);
  });
  it('matches by rank across suits and then follows the new suit', () => {
    const s = mk([['7C', '2C'], ['9D', '3S']], '7H');
    const { state } = mustPlay(s, '7C');
    expect(state.suit).toBe(3);
  });
  it('an eight needs a called suit (0 to 3) and records it', () => {
    const s = mk([['8D', '2C'], ['9D', '3S']], '4H');
    for (const bad of [undefined, -1, 4, 1.5, NaN, Infinity, '2' as unknown as number]) expect(play(s, c('8D'), bad)).toBeNull();
    const { state, events } = mustPlay(s, '8D', 2);
    expect(state.suit).toBe(2);
    expect((events[0] as { suit: number }).suit).toBe(2);
  });
  it('a plain card ignores any called suit', () => {
    const s = mk([['7H', '2C'], ['9D', '3S']], '4H');
    expect(mustPlay(s, '7H', 3).state.suit).toBe(1);
  });
  it('refuses cards not in hand, cards that do not match, and junk', () => {
    const s = mk([['7H', '2C'], ['9D', '3S']], '4H');
    expect(play(s, c('9D'), 0)).toBeNull(); // not mine
    expect(play(s, c('2C'))).toBeNull(); // no match
    expect(play(s, -1)).toBeNull();
    expect(play(s, 52)).toBeNull();
    expect(play(s, 1.5)).toBeNull();
    expect(play(s, NaN)).toBeNull();
    expect(play(s, c('7H'))).not.toBeNull();
  });
  it('wins when the hand is empty and refuses any further play', () => {
    const s = mk([['7H'], ['9D', '3S']], '4H');
    const { state, events } = mustPlay(s, '7H');
    expect(state.over).toBe(true);
    expect(state.winner).toBe(0);
    expect(kinds(events)).toEqual(['play', 'win']);
    expect(winners(state)).toEqual([0]);
    expect(play(state, c('7H'))).toBeNull();
    expect(draw(state, mulberry32(1))).toBeNull();
    expect(legalPlays(state)).toEqual([]);
  });
  it('can win with an eight as the final card', () => {
    const s = mk([['8S'], ['9D']], '4H');
    expect(mustPlay(s, '8S', 0).state.winner).toBe(0);
  });
  it('never changes the state it was given', () => {
    const s = mk([['7H', '2C'], ['9D', '3S']], '4H', { stock: ['AS', 'KS'] });
    const before = JSON.stringify(s);
    mustPlay(s, '7H');
    expect(JSON.stringify(s)).toBe(before);
  });
});

// ── drawing ──────────────────────────────────────────────────────────────────

describe('draw', () => {
  it('is refused while you have a play', () => {
    const s = mk([['7H', '2C'], ['9D']], '4H', { stock: ['AS'] });
    expect(canDraw(s)).toBe(false);
    expect(draw(s, mulberry32(1))).toBeNull();
  });
  it('draws the top of the stock and keeps the turn while you still cannot play (draw until you can play)', () => {
    const s = mk([['2C', '3C'], ['9D']], '4H', { stock: ['KS', 'QS', 'JD'] }); // top is JD
    expect(canDraw(s)).toBe(true);
    let r = draw(s, mulberry32(1))!;
    expect(r.state.hands[0]).toContain(c('JD'));
    expect(r.state.turn).toBe(0);
    expect(r.state.draws).toBe(1);
    expect(kinds(r.events)).toEqual(['draw']);
    r = draw(r.state, mulberry32(1))!;
    expect(r.state.turn).toBe(0); // QS still no match
    expect(canDraw(r.state)).toBe(true);
    r = draw(r.state, mulberry32(1))!;
    expect(r.state.hands[0]).toHaveLength(5);
    expect(r.state.stock).toHaveLength(0);
  });
  it('stops drawing as soon as a card can be played', () => {
    const s = mk([['2C', '3C'], ['9D']], '4H', { stock: ['KS', '9H'] }); // top 9H matches hearts
    const r = draw(s, mulberry32(1))!;
    expect(legalPlays(r.state)).toEqual([c('9H')]);
    expect(canDraw(r.state)).toBe(false);
    expect(r.state.turn).toBe(0);
  });
  it('with the draw-up-to-3 rule, passes after the third miss', () => {
    let s = mk([['2C', '3C'], ['9D', '4D']], '4H', { rule: 'three', stock: ['KS', 'QS', 'JS', '10S', '9S'] });
    s = draw(s, mulberry32(1))!.state;
    s = draw(s, mulberry32(1))!.state;
    expect(s.turn).toBe(0);
    const last = draw(s, mulberry32(1))!;
    expect(kinds(last.events)).toEqual(['draw', 'pass']);
    expect(last.state.turn).toBe(1);
    expect(last.state.draws).toBe(0);
    expect(last.state.hands[0]).toHaveLength(5);
  });
  it('reshuffles the discard pile under the top card into a new stock when the stock runs out', () => {
    const s = mk([['2C', '3C'], ['9D']], '4H', { discard: ['AD', 'KD', 'QD', '4H'], stock: [] });
    expect(drawableCount(s)).toBe(3);
    const r = draw(s, mulberry32(3))!;
    expect(r.events[0]).toEqual({ t: 'reshuffle', count: 3 });
    expect(r.state.discard).toEqual([c('4H')]);
    expect(r.state.reshuffles).toBe(1);
    expect(r.state.hands[0]).toHaveLength(3);
    expect(r.state.stock).toHaveLength(2);
    expect(allCards(r.state).sort((a, b) => a - b)).toEqual(allCards(s).sort((a, b) => a - b));
  });
  it('cannot draw when nothing is left to draw', () => {
    const s = mk([['2C', '3C'], ['9D']], '4H', { stock: [] });
    expect(drawableCount(s)).toBe(0);
    expect(canDraw(s)).toBe(false);
  });
});

describe('automatic passes and the endings', () => {
  // A pass is only ever forced once nothing is left to draw: the stock is empty and the discard pile is just the top card.
  it('passes a player who can neither play nor draw, and says so', () => {
    // Player 0 cannot play, reshuffles the one card under the top, still cannot play and passes; player 1 is stuck too; player 2 can play.
    const s = mk([['2C'], ['3D'], ['9S']], '5S', { discard: ['4H', '5S'], stock: [] });
    expect(canDraw(s)).toBe(true);
    const { state, events } = draw(s, mulberry32(1))!;
    expect(kinds(events)).toEqual(['reshuffle', 'draw', 'pass', 'pass']);
    expect(events.filter((e) => e.t === 'pass').map((e) => (e as { by: number }).by)).toEqual([0, 1]);
    expect(state.turn).toBe(2);
    expect(state.passRun).toBe(2);
    expect(state.over).toBe(false);
    expect(legalPlays(state)).toEqual([c('9S')]);
  });
  it('a full round of passes blocks the game and the player with the fewest cards wins', () => {
    const s = mk([['2C'], ['3D']], '5S', { discard: ['4H', '5S'], stock: [] });
    const { state, events } = draw(s, mulberry32(1))!;
    expect(kinds(events)).toEqual(['reshuffle', 'draw', 'pass', 'pass', 'blocked']);
    expect(state.over).toBe(true);
    expect(state.blocked).toBe(true);
    expect(state.winner).toBe(-1);
    expect(winners(state)).toEqual([1]);
    expect(resultSentence(state, ['You', 'Pip'])).toBe('Pip won (the game was blocked).');
    expect(play(state, c('3D'))).toBeNull();
    expect(draw(state, mulberry32(1))).toBeNull();
  });
  it('a blocked game with equal counts is a shared result', () => {
    const s = mk([['2C'], ['3D', '6D']], '5S', { discard: ['4H', '5S'], stock: [] });
    const { state } = draw(s, mulberry32(1))!;
    expect(winners(state)).toEqual([0, 1]);
    expect(resultSentence(state, ['You', 'Pip'])).toBe('A tie between You and Pip (the game was blocked).');
  });
  it('stops at 500 turns with the fewest cards winning', () => {
    const s = mk([['7H', '2C', '3C'], ['9D', '4D', '5D', '6D']], '4H', { turns: MAX_TURNS - 1 });
    const { state, events } = mustPlay(s, '7H');
    expect(kinds(events)).toEqual(['play', 'capped']);
    expect(state.capped).toBe(true);
    expect(state.over).toBe(true);
    expect(winners(state)).toEqual([0]);
    expect(resultSentence(state, ['You', 'Pip'])).toBe('You won (the game hit the turn limit)!');
  });
});

// ── the computer ─────────────────────────────────────────────────────────────

describe('computer players', () => {
  it('always choose a legal play when one exists, at every level, over thousands of positions', () => {
    for (const level of [1, 2, 3] as Level[]) {
      for (let seed = 1; seed <= 500; seed++) {
        const rng = mulberry32(seed);
        const n = 2 + (seed % 3);
        const { state } = newGame(n, 'until', rng);
        const mem = newMemory(n);
        const pick = choosePlay(state, level, mem, rng);
        const legal = legalPlays(state);
        if (!legal.length) { expect(pick).toBeNull(); continue; }
        expect(pick).not.toBeNull();
        expect(legal).toContain(pick!.card);
        if (isWild(pick!.card)) expect(pick!.suit).toBeGreaterThanOrEqual(0);
        expect(play(state, pick!.card, pick!.suit)).not.toBeNull();
      }
    }
  });
  it('Medium and Hard keep their eights when a plain card will do; Hard plays an eight when it is nearly out', () => {
    // Computer is player 1, holding an eight and plain matches.
    const s = mk([['2C', '3C'], ['8S', '9H', 'KH', '2D']], '4H', { turn: 1 });
    for (let seed = 1; seed <= 60; seed++) {
      expect(isWild(choosePlay(s, 2, newMemory(2), mulberry32(seed))!.card)).toBe(false);
      expect(isWild(choosePlay(s, 3, newMemory(2), mulberry32(seed))!.card)).toBe(false);
    }
    const easyPlays = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) easyPlays.add(choosePlay(s, 1, newMemory(2), mulberry32(seed))!.card);
    expect(easyPlays.has(c('8S'))).toBe(true); // Easy does not hold back
    const nearlyOut = mk([['2C', '3C'], ['8S', '9H']], '4H', { turn: 1 });
    for (let seed = 1; seed <= 30; seed++) expect(choosePlay(nearlyOut, 3, newMemory(2), mulberry32(seed))!.card).toBe(c('8S'));
  });
  it('Medium and Hard name the suit they hold most of when they play an eight', () => {
    const hand = ['8S', '2D', '5D', '9D', 'KC'].map(c);
    for (let seed = 1; seed <= 40; seed++) {
      expect(chooseSuit(hand, c('8S'), 2, mulberry32(seed))).toBe(2);
      expect(chooseSuit(hand, c('8S'), 3, mulberry32(seed))).toBe(2);
    }
    const easy = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) easy.add(chooseSuit(hand, c('8S'), 1, mulberry32(seed)));
    expect(easy.size).toBeGreaterThan(2);
    expect(chooseSuit([c('8S')], c('8S'), 3, mulberry32(1))).toBe(0); // only an eight left: its own suit
  });
  it('Hard likes calling a suit the next player was seen to lack', () => {
    const mem = newMemory(2);
    observe(mem, { t: 'draw', by: 0, card: c('2D'), suit: 1 }); // player 0 drew when hearts were called: likely no hearts
    expect(mem.lacks[0][1]).toBe(true);
    // With a 9 of diamonds in play, 9H, 9S and QD are all legal; hearts is the suit player 0 lacks.
    const s2 = mk([['2C'], ['9H', '9S', 'KH', 'KS', 'QD']], '9D', { turn: 1 });
    for (let seed = 1; seed <= 30; seed++) expect(choosePlay(s2, 3, mem, mulberry32(seed))!.card).toBe(c('9H'));
  });
  it('observe forgets a lack when the player plays that suit', () => {
    const m = newMemory(2);
    observe(m, { t: 'draw', by: 1, card: 0, suit: 2 });
    expect(m.lacks[1][2]).toBe(true);
    observe(m, { t: 'play', by: 1, card: c('5D'), suit: 2 });
    expect(m.lacks[1][2]).toBe(false);
  });
  it('computerTurn draws until it can play (or must pass) and always ends with the turn moved on or the game over', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed);
      const n = 2 + (seed % 3);
      const rule: DrawRule = seed % 2 ? 'until' : 'three';
      const { state } = newGame(n, rule, rng);
      const s = { ...state, turn: 1 };
      const r = computerTurn(s, ((seed % 3) + 1) as Level, newMemory(n), rng)!;
      expect(r).not.toBeNull();
      expect(r.state.over || r.state.turn !== 1).toBe(true);
      expect(validateState(r.state)).toBeNull();
      expect(allCards(r.state).sort((a, b) => a - b)).toEqual(Array.from({ length: DECK }, (_, i) => i));
    }
  });
  it('Hard beats Easy over seeded two-player games', () => {
    let hardWins = 0;
    let easyWins = 0;
    for (let g = 0; g < 300; g++) {
      const rng = mulberry32(2000 + g);
      const hardIdx = g % 2; // alternate who goes first
      let s = newGame(2, 'until', rng).state;
      const mem = newMemory(2);
      let guard = 0;
      while (!s.over && guard++ < 3000) {
        const level: Level = s.turn === hardIdx ? 3 : 1;
        const r = computerTurn(s, level, mem, rng);
        if (!r) break;
        r.events.forEach((e) => observe(mem, e));
        s = r.state;
      }
      expect(s.over).toBe(true);
      const w = winners(s);
      if (w.length === 1) { if (w[0] === hardIdx) hardWins += 1; else easyWins += 1; }
    }
    expect(hardWins).toBeGreaterThan(easyWins);
  }, 60_000);
});

// ── words ────────────────────────────────────────────────────────────────────

describe('describeEvent', () => {
  const names = playerNames(3);
  it('names plays, and the chosen suit for an eight', () => {
    expect(describeEvent({ t: 'play', by: 0, card: c('7H'), suit: 1 }, 0, names)).toBe('You played the 7 of hearts.');
    expect(describeEvent({ t: 'play', by: 1, card: c('KS'), suit: 0 }, 0, names)).toBe('Pip played the King of spades.');
    expect(describeEvent({ t: 'play', by: 2, card: c('8C'), suit: 2 }, 0, names)).toBe('Dot played the 8 of clubs and chose diamonds.');
    expect(describeEvent({ t: 'play', by: 0, card: c('8D'), suit: 3 }, 0, names)).toBe('You played the 8 of diamonds and chose clubs.');
  });
  it('shows you the card you drew but never names a computer draw', () => {
    expect(describeEvent({ t: 'draw', by: 0, card: c('QD'), suit: 1 }, 0, names)).toBe('You drew the Queen of diamonds.');
    const hidden = describeEvent({ t: 'draw', by: 1, card: c('QD'), suit: 1 }, 0, names);
    expect(hidden).toBe('Pip drew a card.');
    expect(hidden).not.toContain('Queen');
  });
  it('covers reshuffles, passes, wins and the two safety endings', () => {
    expect(describeEvent({ t: 'reshuffle', count: 1 }, 0, names)).toContain('new stock of 1 card');
    expect(describeEvent({ t: 'pass', by: 0 }, 0, names)).toBe('You cannot play or draw, so you pass.');
    expect(describeEvent({ t: 'pass', by: 2 }, 0, names)).toBe('Dot cannot play or draw, so Dot passes.');
    expect(describeEvent({ t: 'win', by: 0 }, 0, names)).toBe('You played your final card and win!');
    expect(describeEvent({ t: 'win', by: 1 }, 0, names)).toBe('Pip played the final card and wins.');
    expect(describeEvent({ t: 'blocked' }, 0, names)).toContain('fewest cards');
    expect(describeEvent({ t: 'capped' }, 0, names)).toContain('500 turns');
  });
  it('player names and result lines are right in every state', () => {
    expect(OPPONENT_NAMES).toEqual(['Pip', 'Dot', 'Moss']);
    expect(playerNames(2)).toEqual(['You', 'Pip']);
    const open = mk([['7H'], ['9D', '3S']], '4H');
    expect(cardsLine(open, ['You', 'Pip'])).toBe('You 1 card, Pip 2 cards');
    expect(resultSentence(open, ['You', 'Pip'])).toBe('Unfinished: You 1 card, Pip 2 cards left.');
    const lost = { ...open, over: true, winner: 1, hands: [open.hands[0], []] };
    expect(resultSentence(lost, ['You', 'Pip'])).toBe('Pip won.');
    const won = { ...open, over: true, winner: 0, hands: [[], open.hands[1]] };
    expect(resultSentence(won, ['You', 'Pip'])).toBe('You won!');
  });
});

// ── the fuzz ─────────────────────────────────────────────────────────────────

describe('random games', () => {
  const playRandom = (n: number, rule: DrawRule, seed: number) => {
    const rng = mulberry32(seed);
    let s = newGame(n, rule, rng).state;
    let actions = 0;
    let reshuffled = false;
    while (!s.over) {
      if (actions++ > 20000) throw new Error(`game ${seed} did not end`);
      const legal = legalPlays(s);
      let r: { state: EightsState; events: EightsEvent[] } | null;
      if (legal.length) {
        const card = legal[Math.floor(rng() * legal.length)];
        r = play(s, card, Math.floor(rng() * 4));
      } else {
        r = draw(s, rng);
      }
      if (!r) throw new Error(`game ${seed}: no legal action at action ${actions}`);
      for (const e of r.events) {
        describeEvent(e, 0, playerNames(n)); // never throws
        if (e.t === 'reshuffle') reshuffled = true;
        if (e.t === 'draw' && e.by !== 0) expect(describeEvent(e, 0, playerNames(n))).not.toContain(cardName(e.card));
      }
      s = r.state;
      const bad = validateState(s);
      if (bad) throw new Error(`game ${seed} action ${actions}: ${bad}`);
    }
    return { s, actions, reshuffled };
  };

  it('every random game ends, keeps all 52 cards at every step and always lets the player to move act (2, 3, 4 players, both draw rules)', () => {
    let capped = 0;
    let blocked = 0;
    let won = 0;
    let reshuffles = 0;
    for (const n of [2, 3, 4]) {
      for (const rule of ['until', 'three'] as DrawRule[]) {
        for (let seed = 1; seed <= 120; seed++) {
          const { s, reshuffled } = playRandom(n, rule, seed * 17 + n);
          expect(winners(s).length).toBeGreaterThan(0);
          if (s.capped) capped += 1; else if (s.blocked) blocked += 1; else won += 1;
          if (reshuffled) reshuffles += 1;
          expect(allCards(s)).toHaveLength(DECK);
        }
      }
    }
    expect(won).toBeGreaterThan(0.9 * 720);
    expect(reshuffles).toBeGreaterThan(0); // the stock reshuffle path is exercised
    expect(capped + blocked + won).toBe(720);
  }, 60_000);

  it('the same seed and the same choices give exactly the same game', () => {
    const a = playRandom(3, 'until', 777);
    const b = playRandom(3, 'until', 777);
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
  });

  it('the three computer levels mixed at one table always finish', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const n = 2 + (seed % 3);
      const rng = mulberry32(5000 + seed);
      let s = newGame(n, seed % 2 ? 'until' : 'three', rng).state;
      const mem: Memory = newMemory(n);
      let guard = 0;
      while (!s.over) {
        if (guard++ > 5000) throw new Error('did not finish');
        const r = computerTurn(s, (1 + ((s.turn + seed) % 3)) as Level, mem, rng)!;
        r.events.forEach((e) => observe(mem, e));
        s = r.state;
        expect(validateState(s)).toBeNull();
      }
    }
  }, 60_000);

  it('a game lasts a believable number of turns', () => {
    let total = 0;
    const G = 60;
    for (let seed = 1; seed <= G; seed++) total += playRandom(2, 'until', 900 + seed).s.turns;
    const avg = total / G;
    expect(avg).toBeGreaterThan(8);
    expect(avg).toBeLessThan(MAX_TURNS);
  });
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk to a fresh zeroed object', () => {
    for (const bad of [null, undefined, NaN, 'x', 5, [], [1, 2], () => 0, true]) expect(sanitizeStore(bad)).toEqual({ p: 0, w: 0, q: 0 });
    expect(sanitizeStore({ p: NaN, w: -1, q: 0 })).toEqual({ p: 0, w: 0, q: 0 });
    expect(sanitizeStore({ p: '5', w: 1.5, q: Infinity })).toEqual({ p: 0, w: 0, q: 0 });
    expect(sanitizeStore({ p: 4, w: 2, q: MAX_TURNS + 1 })).toEqual({ p: 4, w: 2, q: 0 });
    expect(sanitizeStore({ p: MAX_COUNT + 1, w: 1, q: 9 })).toEqual({ p: 0, w: 0, q: 9 });
  });
  it('keeps good values, never more wins than games, and ignores prototype and extra keys', () => {
    expect(sanitizeStore({ p: 10, w: 4, q: 31 })).toEqual({ p: 10, w: 4, q: 31 });
    expect(sanitizeStore({ p: 3, w: 8, q: 2 })).toEqual({ p: 3, w: 3, q: 2 });
    const out = sanitizeStore(JSON.parse('{"__proto__":{"p":5},"p":2,"w":1,"q":9,"extra":1}'));
    expect(out).toEqual({ p: 2, w: 1, q: 9 });
    expect(Object.keys(out).sort()).toEqual(['p', 'q', 'w']);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":5}}'))).toEqual({ p: 0, w: 0, q: 0 });
  });
  it('recordGame counts games and wins and keeps the quickest valid win', () => {
    const a = recordGame({ p: 0, w: 0, q: 0 }, true, 40);
    expect(a).toEqual({ store: { p: 1, w: 1, q: 40 }, record: true });
    expect(recordGame(a.store, true, 55).store).toEqual({ p: 2, w: 2, q: 40 });
    expect(recordGame(a.store, true, 30)).toEqual({ store: { p: 2, w: 2, q: 30 }, record: true });
    expect(recordGame(a.store, false, 10)).toEqual({ store: { p: 2, w: 1, q: 40 }, record: false });
    for (const bad of [0, -1, NaN, 1.5, MAX_TURNS + 1]) expect(recordGame(a.store, true, bad).store.q).toBe(40);
    expect(recordGame({ p: MAX_COUNT, w: MAX_COUNT, q: 0 }, true, 5).store.p).toBe(MAX_COUNT);
  });
});

// ── what the page promises ───────────────────────────────────────────────────

describe('page', () => {
  it('computer thinking time is a fixed 400 to 800 ms and shorter for reduced motion', () => {
    expect(AI_DELAY_MS).toBeGreaterThanOrEqual(400);
    expect(AI_DELAY_MS).toBeLessThanOrEqual(800);
    expect(AI_DELAY_REDUCED_MS).toBeLessThan(AI_DELAY_MS);
    expect(calculatorSource).toMatch(/AI_DELAY_MS/);
    expect(calculatorSource).toMatch(/AI_DELAY_REDUCED_MS/);
  });
  it('uses plain traditional rules: no action-card or last-card wording anywhere in the code', () => {
    const text = `${helpersSource}\n${calculatorSource}`;
    expect(text).not.toMatch(/\b(skip|skips|reverse|draw two|draw four|draw 2|draw 4|wild draw|last card|one card left|uno)\b/i);
  });
  it('the three levels and the two draw rules have plain names', () => {
    expect(Object.values(LEVEL_NAMES)).toEqual(['Easy', 'Medium', 'Hard']);
    expect(DRAW_RULES).toHaveLength(2);
  });
  it('pauses the computer when the tab is hidden and clears its timer on navigation', () => {
    expect(calculatorSource).toMatch(/visibilitychange/);
    expect(calculatorSource).toMatch(/astro:before-swap/);
    expect(calculatorSource).toMatch(/clearTimeout/);
  });
  it('uses crypto for the seed, the seeded generator for play and the right storage key', () => {
    expect(calculatorSource).toMatch(/crypto\.getRandomValues/);
    expect(calculatorSource).toMatch(/mulberry32/);
    expect(calculatorSource).toContain("'gk:game:crazy-eights'");
  });
  it('has a live status line and a how-it-works section', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/<details/);
  });
  it('MAX_TURNS is the 500 the page text says', () => {
    expect(MAX_TURNS).toBe(500);
    expect(calculatorSource).toMatch(/500 turns/);
  });
});
