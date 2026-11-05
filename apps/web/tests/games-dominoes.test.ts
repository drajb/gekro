/**
 * games-dominoes.test.ts - the engine behind `dominoes`.
 *
 * Pinned: the double-six set (exactly 28 unique tiles, 168 pips, every number on 8 half-tiles),
 * the pip layouts, an unbiased seeded shuffle (chi-square), the deal (7 each, 14 in the boneyard)
 * and the opening rule against an independent oracle, which tiles fit which end checked against a
 * brute-force oracle on thousands of positions, how a tile is turned when it is placed, the draw
 * game (draw only when stuck, until you can play) and the block game (pass), both ways a round
 * ends and what it scores, match totals, the three computer levels (always legal, Medium takes the
 * heaviest tile, Hard learns from your draws and passes, Hard beats Easy over seeded rounds), the
 * words for every event (a computer's draw is never named), the stored results, and a fuzz of
 * 3,000 random rounds in both modes: no tile lost or duplicated at any step, the chain always
 * touches with matching numbers, the player to move can always act, and every round ends.
 */
import { describe, it, expect } from 'vitest';
import {
  newRound, play, draw, legalMoves, canDraw, endsOf, endsAfter, openingMove, validateState, computerTurn, chooseMove, newMemory, observe,
  describeEvent, chainDescription, roundSentence, matchSentence, addScore, matchWinner, matchOver, roundSeed, sanitizeStore, recordMatch,
  clampMode, clampTarget, tileId, tileName, pipsOf, isDouble, handPips, hasPip, mulberry32, shuffled, plural,
  TILES, PIP_CELLS, TILE_COUNT, TOTAL_PIPS, HAND_SIZE, NUM_NAMES, AI_DELAY_MS, AI_DELAY_REDUCED_MS, MAX_COUNT, LEVEL_NAMES, MODES, TARGETS,
  type DominoState, type DominoEvent, type Level, type Mode, type Side, type Placed,
} from '../src/components/apps-private/dominoes/helpers';
import calculatorSource from '../src/components/apps-private/dominoes/Calculator.astro?raw';

// ── building positions ──────────────────────────────────────────────────────

/** '6-3' is the tile with a 6 and a 3 (either order). */
const t = (code: string): number => {
  const [a, b] = code.split('-').map(Number);
  const id = tileId(a, b);
  if (id < 0) throw new Error(`bad tile ${code}`);
  return id;
};
/** A hand-built position. The chain is written left to right as the numbers on each half, e.g. '6-6', '6-3'. */
const mk = (hand0: string[], hand1: string[], chain: string[], opts: { yard?: string[]; mode?: Mode; turn?: 0 | 1 } = {}): DominoState => {
  const placed: Placed[] = chain.map((c) => {
    const [l, r] = c.split('-').map(Number);
    return { id: tileId(l, r), left: l, right: r };
  });
  return {
    mode: opts.mode ?? 'draw', hands: [hand0.map(t).sort((a, b) => a - b), hand1.map(t).sort((a, b) => a - b)], yard: (opts.yard ?? []).map(t), chain: placed,
    turn: opts.turn ?? 0, passRun: 0, over: false, winner: -1, endedBy: null, points: 0, opener: 0, moves: placed.length,
  };
};
const everyTile = (s: DominoState): number[] => [...s.hands[0], ...s.hands[1], ...s.yard, ...s.chain.map((c) => c.id)].sort((a, b) => a - b);
const mustPlay = (s: DominoState, tile: string, side: Side) => {
  const r = play(s, t(tile), side);
  if (!r) throw new Error(`play ${tile} ${side} was refused`);
  expect(everyTile(r.state)).toEqual(everyTile(s));
  return r;
};
const kinds = (ev: DominoEvent[]): string[] => ev.map((e) => e.t);

// ── the set ──────────────────────────────────────────────────────────────────

describe('the double-six set', () => {
  it('has exactly 28 unique tiles covering every pair of numbers 0 to 6 once', () => {
    expect(TILES).toHaveLength(28);
    expect(TILE_COUNT).toBe(28);
    const seen = new Set<string>();
    for (const [a, b] of TILES) { expect(a).toBeLessThanOrEqual(b); seen.add(`${a}-${b}`); }
    expect(seen.size).toBe(28);
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) expect(seen.has(`${a}-${b}`)).toBe(true);
  });
  it('has 168 pips in all and every number on exactly 8 half-tiles', () => {
    expect(TILES.reduce((n, [a, b]) => n + a + b, 0)).toBe(TOTAL_PIPS);
    for (let v = 0; v <= 6; v++) expect(TILES.reduce((n, [a, b]) => n + (a === v ? 1 : 0) + (b === v ? 1 : 0), 0)).toBe(8);
    expect(TILES.filter(([a, b]) => a === b)).toHaveLength(7);
  });
  it('tileId finds a tile in either order and rejects anything else', () => {
    TILES.forEach(([a, b], i) => { expect(tileId(a, b)).toBe(i); expect(tileId(b, a)).toBe(i); });
    for (const [a, b] of [[-1, 2], [2, 7], [1.5, 2], [NaN, 1], [0, Infinity]]) expect(tileId(a, b)).toBe(-1);
  });
  it('names tiles for a screen reader and counts pips', () => {
    expect(tileName(t('6-6'))).toBe('double six');
    expect(tileName(t('0-0'))).toBe('double blank');
    expect(tileName(t('3-5'))).toBe('five-three');
    expect(tileName(t('0-6'))).toBe('six-blank');
    expect(NUM_NAMES).toHaveLength(7);
    expect(pipsOf(t('4-5'))).toBe(9);
    expect(isDouble(t('2-2'))).toBe(true);
    expect(isDouble(t('2-3'))).toBe(false);
    expect(handPips([t('6-6'), t('0-1')])).toBe(13);
    expect(hasPip(t('2-5'), 5)).toBe(true);
    expect(hasPip(t('2-5'), 3)).toBe(false);
  });
  it('draws the right number of pips in the right cells, turned the same way up and down', () => {
    expect(PIP_CELLS).toHaveLength(7);
    PIP_CELLS.forEach((cells, n) => {
      expect(cells).toHaveLength(n);
      expect(new Set(cells).size).toBe(n);
      for (const cell of cells) { expect(cell).toBeGreaterThanOrEqual(0); expect(cell).toBeLessThanOrEqual(8); expect(cells).toContain(8 - cell); } // point-symmetric
    });
  });
});

describe('shuffle', () => {
  it('is a permutation, deterministic, and leaves its input alone', () => {
    const src = Array.from({ length: 28 }, (_, i) => i);
    const out = shuffled(src, mulberry32(7));
    expect(out.slice().sort((a, b) => a - b)).toEqual(src);
    expect(src[3]).toBe(3);
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
  it('puts one fixed tile in each of the 28 positions about equally often (chi-square, df 27)', () => {
    const N = 5600;
    const pos = new Array<number>(28).fill(0);
    for (let seed = 1; seed <= N; seed++) pos[shuffled(Array.from({ length: 28 }, (_, i) => i), mulberry32(seed * 104729 + 13)).indexOf(9)] += 1;
    let chi = 0;
    for (const v of pos) chi += ((v - N / 28) ** 2) / (N / 28);
    expect(chi).toBeLessThan(55.5); // p = 0.001 for 27 degrees of freedom
  });
});

// ── the deal and the opening ─────────────────────────────────────────────────

/** An independent opening oracle: sort every tile held by (double first, then pips, then larger end) and take the top. */
const openingOracle = (h0: number[], h1: number[]): { player: number; tile: number } => {
  const all = [...h0.map((tile) => ({ player: 0, tile })), ...h1.map((tile) => ({ player: 1, tile }))];
  const doubles = all.filter((x) => TILES[x.tile][0] === TILES[x.tile][1]).sort((a, b) => TILES[b.tile][0] - TILES[a.tile][0]);
  if (doubles.length) return doubles[0];
  all.sort((a, b) => (TILES[b.tile][0] + TILES[b.tile][1]) - (TILES[a.tile][0] + TILES[a.tile][1]) || TILES[b.tile][1] - TILES[a.tile][1]);
  return all[0];
};

describe('newRound', () => {
  it('deals 7 tiles each, keeps 14 in the boneyard and plays the opening tile', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const mode of MODES) {
        const { state, events } = newRound(mode, mulberry32(seed));
        expect(HAND_SIZE).toBe(7);
        const opener = state.opener;
        expect(state.hands[opener]).toHaveLength(6);
        expect(state.hands[1 - opener]).toHaveLength(7);
        expect(state.yard).toHaveLength(14);
        expect(state.chain).toHaveLength(1);
        expect(everyTile(state)).toEqual(Array.from({ length: 28 }, (_, i) => i));
        expect(validateState(state)).toBeNull();
        expect(events[0].t).toBe('open');
        if (events.length === 1) expect(state.turn).toBe(1 - opener); // otherwise the other player had to pass at once
        expect(state.moves).toBe(1);
        expect(state.mode).toBe(mode);
      }
    }
  });
  it('the opener and tile match an independent oracle on 3,000 deals', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const ids = shuffled(Array.from({ length: 28 }, (_, i) => i), mulberry32(seed));
      const h0 = ids.slice(0, 7);
      const h1 = ids.slice(7, 14);
      const o = openingOracle(h0, h1);
      expect(openingMove([h0, h1])).toEqual({ player: o.player, tile: o.tile });
      const { state } = newRound('draw', mulberry32(seed));
      expect(state.opener).toBe(o.player);
      expect(state.chain[0].id).toBe(o.tile);
    }
  });
  it('opens with the highest double, or the heaviest tile when there is no double', () => {
    expect(openingMove([[t('6-6'), t('5-5'), t('1-2')], [t('4-4'), t('3-6')]]).tile).toBe(t('6-6'));
    expect(openingMove([[t('2-2'), t('5-6')], [t('3-3'), t('4-5')]])).toEqual({ player: 1, tile: t('3-3') });
    expect(openingMove([[t('1-2'), t('3-6')], [t('4-5'), t('0-1')]]).tile).toBe(t('3-6')); // 9 pips, larger end 6 beats 4-5
    expect(openingMove([[t('1-2')], [t('0-3')]]).tile).toBe(t('0-3')); // equal pips, larger end wins
  });
  it('is deterministic for a seed and different across seeds', () => {
    expect(JSON.stringify(newRound('draw', mulberry32(9)))).toBe(JSON.stringify(newRound('draw', mulberry32(9))));
    expect(JSON.stringify(newRound('draw', mulberry32(9)).state.hands)).not.toBe(JSON.stringify(newRound('draw', mulberry32(10)).state.hands));
  });
  it('clamps junk options and derives round seeds', () => {
    expect(clampMode('block')).toBe('block');
    for (const bad of ['x', 3, null, undefined, 'BLOCK']) expect(clampMode(bad)).toBe('draw');
    expect(clampTarget(50)).toBe(50);
    expect(clampTarget(100)).toBe(100);
    for (const bad of [0, 25, '50', null, NaN, 1000]) expect(clampTarget(bad)).toBe(0);
    expect(TARGETS).toEqual([0, 50, 100]);
    expect(roundSeed(5, 1)).toBe(5);
    expect(roundSeed(5, 2)).not.toBe(5);
    expect(roundSeed(5, 2)).toBe(roundSeed(5, 2));
    expect(roundSeed(4294967295, 3)).toBeGreaterThanOrEqual(0);
  });
});

// ── which tiles fit ──────────────────────────────────────────────────────────

describe('legalMoves', () => {
  it('lists a tile for each end whose number it has', () => {
    const s = mk(['6-3', '2-2', '5-1', '3-3'], ['0-0'], ['6-4', '4-2']);
    // Ends: left 6, right 2.
    expect(endsOf(s)).toEqual([6, 2]);
    const moves = legalMoves(s).map((m) => `${TILES[m.tile].join('-')} ${m.side}`).sort();
    expect(moves).toEqual(['2-2 right', '3-6 left']);
  });
  it('a tile that fits both ends is listed twice, and a double fits only its own number', () => {
    const s = mk(['6-2', '3-3'], ['0-0'], ['6-4', '4-2']);
    expect(legalMoves(s).map((m) => m.side).sort()).toEqual(['left', 'right']);
    expect(legalMoves(mk(['3-3', '4-4'], ['0-0'], ['3-5', '5-3'])).map((m) => `${TILES[m.tile].join('-')} ${m.side}`).sort()).toEqual(['3-3 left', '3-3 right']);
  });
  it('agrees with a brute-force oracle at every step of 400 random rounds', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed);
      let s = newRound(seed % 2 ? 'draw' : 'block', rng).state;
      let guard = 0;
      while (!s.over && guard++ < 200) {
        const [l, r] = endsOf(s);
        const oracle: string[] = [];
        for (const tile of s.hands[s.turn]) {
          const [a, b] = TILES[tile];
          if (a === l || b === l) oracle.push(`${tile} left`);
          if (a === r || b === r) oracle.push(`${tile} right`);
        }
        const moves = legalMoves(s);
        expect(moves.map((m) => `${m.tile} ${m.side}`).sort()).toEqual(oracle.sort());
        const next = moves.length ? (() => { const m = moves[Math.floor(rng() * moves.length)]; return play(s, m.tile, m.side); })() : draw(s);
        if (!next) break;
        s = next.state;
      }
    }
  });
});

// ── playing ──────────────────────────────────────────────────────────────────

describe('play', () => {
  it('turns the tile so the matching number touches the end, on the left', () => {
    const s = mk(['6-3', '1-2'], ['0-0', '5-5'], ['6-4']);
    const { state } = mustPlay(s, '6-3', 'left');
    expect(state.chain.map((c) => `${c.left}-${c.right}`)).toEqual(['3-6', '6-4']);
    expect(endsOf(state)).toEqual([3, 4]);
  });
  it('turns the tile so the matching number touches the end, on the right', () => {
    const s = mk(['4-3', '1-2'], ['0-0', '5-5'], ['6-4']);
    const { state } = mustPlay(s, '4-3', 'right');
    expect(state.chain.map((c) => `${c.left}-${c.right}`)).toEqual(['6-4', '4-3']);
    expect(endsOf(state)).toEqual([6, 3]);
  });
  it('a double goes on and shows the same number twice', () => {
    const s = mk(['4-4', '1-2'], ['0-0', '5-5'], ['6-4']);
    const { state } = mustPlay(s, '4-4', 'right');
    expect(endsOf(state)).toEqual([6, 4]);
    expect(state.chain[1]).toEqual({ id: t('4-4'), left: 4, right: 4 });
  });
  it('endsAfter predicts the new ends', () => {
    const s = mk(['6-3', '4-1'], ['0-0'], ['6-4']);
    expect(endsAfter(s, { tile: t('6-3'), side: 'left' })).toEqual([3, 4]);
    expect(endsAfter(s, { tile: t('4-1'), side: 'right' })).toEqual([6, 1]);
  });
  it('passes the turn and refuses tiles that do not fit, are not yours, or use a bad side', () => {
    const s = mk(['6-3', '1-2'], ['0-0', '5-5'], ['6-4'], { yard: ['2-6'] });
    expect(play(s, t('1-2'), 'left')).toBeNull(); // does not fit
    expect(play(s, t('5-5'), 'left')).toBeNull(); // not mine
    expect(play(s, t('6-3'), 'bottom' as Side)).toBeNull();
    expect(play(s, 28, 'left')).toBeNull();
    expect(play(s, -1, 'left')).toBeNull();
    expect(play(s, 1.5, 'left')).toBeNull();
    expect(play(s, t('6-3'), 'right')).toBeNull(); // right end is 4
    const ok = mustPlay(s, '6-3', 'left');
    expect(ok.state.turn).toBe(1);
    expect(ok.state.moves).toBe(2);
    expect(kinds(ok.events)).toEqual(['play']);
  });
  it('never changes the state it was given', () => {
    const s = mk(['6-3', '1-2'], ['0-0', '5-5'], ['6-4']);
    const before = JSON.stringify(s);
    mustPlay(s, '6-3', 'left');
    expect(JSON.stringify(s)).toBe(before);
  });
});

// ── drawing and passing ──────────────────────────────────────────────────────

describe('the draw game and the block game', () => {
  it('in the draw game a stuck player draws the top of the boneyard, and keeps drawing until a tile fits', () => {
    const s = mk(['0-1', '2-3'], ['5-5', '6-6'], ['4-4'], { yard: ['0-2', '1-1', '4-6'], turn: 0 }); // top of the boneyard is 4-6
    expect(legalMoves(s)).toEqual([]);
    expect(canDraw(s)).toBe(true);
    const r = draw(s)!;
    expect(r.state.hands[0]).toContain(t('4-6'));
    expect(r.state.yard).toHaveLength(2);
    expect(kinds(r.events)).toEqual(['draw']);
    expect(r.state.turn).toBe(0); // it fits, so you play it
    expect(legalMoves(r.state).length).toBeGreaterThan(0);
    expect(canDraw(r.state)).toBe(false);
  });
  it('keeps the turn after a draw that still does not fit', () => {
    const s = mk(['0-1', '2-3'], ['5-5', '6-6'], ['4-4'], { yard: ['0-2', '4-6', '1-1'] }); // top is 1-1
    const r = draw(s)!;
    expect(r.state.turn).toBe(0);
    expect(canDraw(r.state)).toBe(true);
  });
  it('passes by itself when the boneyard is empty and nothing fits', () => {
    const s = mk(['0-1'], ['4-5', '6-6'], ['4-4'], { yard: ['1-1'] });
    const r = draw(s)!;
    expect(kinds(r.events)).toEqual(['draw', 'pass']);
    expect(r.state.turn).toBe(1);
    expect(r.state.passRun).toBe(1);
  });
  it('refuses to draw while you have a move, in the block game, or with an empty boneyard', () => {
    expect(draw(mk(['4-5'], ['0-0'], ['4-4'], { yard: ['1-1'] }))).toBeNull();
    expect(draw(mk(['0-1'], ['4-5'], ['4-4'], { yard: ['1-1'], mode: 'block' }))).toBeNull();
    expect(draw(mk(['0-1'], ['4-5'], ['4-4'], { yard: [] }))).toBeNull();
  });
  it('in the block game a stuck player simply passes, and play goes on', () => {
    const s = mk(['0-4', '0-3'], ['1-2', '5-6'], ['4-4'], { mode: 'block', turn: 0 });
    const { state, events } = mustPlay(s, '0-4', 'right');
    expect(kinds(events)).toEqual(['play', 'pass']);
    expect(events[1]).toEqual({ t: 'pass', by: 1, ends: [4, 0] });
    expect(state.turn).toBe(0);
    expect(state.over).toBe(false);
    expect(state.passRun).toBe(1);
  });
});

// ── the two endings ──────────────────────────────────────────────────────────

describe('how a round ends and what it scores', () => {
  it('going out scores the pips left in the other hand', () => {
    const s = mk(['4-2'], ['6-6', '3-5', '0-1'], ['4-4']);
    const { state, events } = mustPlay(s, '4-2', 'right');
    expect(state.over).toBe(true);
    expect(state.endedBy).toBe('out');
    expect(state.winner).toBe(0);
    expect(state.points).toBe(12 + 8 + 1);
    expect(kinds(events)).toEqual(['play', 'out']);
    expect(play(state, t('6-6'), 'left')).toBeNull();
    expect(draw(state)).toBeNull();
    expect(legalMoves(state)).toEqual([]);
  });
  it('the computer going out scores the pips in your hand', () => {
    const s = mk(['6-6', '1-1'], ['2-4'], ['4-4'], { turn: 1 });
    const { state } = mustPlay(s, '2-4', 'left');
    expect(state.winner).toBe(1);
    expect(state.points).toBe(14);
  });
  it('two passes in a row block the round (block game): fewer pips wins and scores the difference', () => {
    // Playing 4-1 on the left leaves ends 1 and 0. Player 1 (5-5, 6-3) cannot follow, and neither can player 0 (2-2).
    const s = mk(['4-1', '2-2'], ['5-5', '6-3'], ['4-0'], { mode: 'block', turn: 0 });
    const { state, events } = mustPlay(s, '4-1', 'left');
    expect(kinds(events)).toEqual(['play', 'pass', 'pass', 'blocked']);
    expect(state.over).toBe(true);
    expect(state.endedBy).toBe('blocked');
    expect(state.winner).toBe(0);
    expect(state.points).toBe(19 - 4);
    expect(legalMoves(state)).toEqual([]);
    expect(roundSentence(state)).toBe('You won the round and scored 15 points (blocked).');
  });
  it('a blocked draw game is scored the same way once the boneyard is empty', () => {
    const lower = draw(mk(['0-1'], ['5-5', '6-3'], ['4-4'], { yard: ['1-2'] }))!;
    expect(kinds(lower.events)).toEqual(['draw', 'pass', 'pass', 'blocked']);
    expect(lower.state.endedBy).toBe('blocked');
    expect(lower.state.winner).toBe(0); // 0-1 and 1-2 are 4 pips against 19
    expect(lower.state.points).toBe(19 - 4);
    const higher = draw(mk(['0-1'], ['0-2'], ['4-4'], { yard: ['1-2'] }))!; // 4 pips against 2
    expect(higher.state.winner).toBe(1);
    expect(higher.state.points).toBe(2);
    expect(roundSentence(higher.state)).toBe('Pip won the round and scored 2 points (blocked).');
  });
  it('equal pips in a blocked round score nothing', () => {
    const r = draw(mk(['0-1'], ['1-2'], ['5-5'], { yard: ['0-2'] }))!; // 1 + 2 = 3 pips each
    expect(r.state.over).toBe(true);
    expect(r.state.winner).toBe(-1);
    expect(r.state.points).toBe(0);
    expect(roundSentence(r.state)).toBe('The round ended level, so nobody scored.');
    expect(describeEvent(r.events[r.events.length - 1], 0)).toBe('Nobody can play. Both hands have 3 pips, so nobody scores.');
  });
});

// ── matches ──────────────────────────────────────────────────────────────────

describe('matches', () => {
  const finished = (winner: -1 | 0 | 1, points: number): DominoState => ({ ...mk([], [], ['1-1']), over: true, winner, points, endedBy: 'out' });
  it('adds a round to the winner only', () => {
    expect(addScore([10, 20], finished(0, 14))).toEqual([24, 20]);
    expect(addScore([10, 20], finished(1, 14))).toEqual([10, 34]);
    expect(addScore([10, 20], finished(-1, 0))).toEqual([10, 20]);
    expect(addScore([10, 20], { ...finished(0, 14), over: false })).toEqual([10, 20]);
  });
  it('a single round is decided by the round, a longer match by reaching the target', () => {
    expect(matchOver([0, 0], 0)).toBe(true);
    expect(matchOver([49, 30], 50)).toBe(false);
    expect(matchOver([50, 30], 50)).toBe(true);
    expect(matchOver([30, 101], 100)).toBe(true);
    expect(matchWinner([0, 0], 0, 1)).toBe(1);
    expect(matchWinner([0, 0], 0, -1)).toBe(-1);
    expect(matchWinner([49, 30], 50, 0)).toBe(-1);
    expect(matchWinner([52, 30], 50, 0)).toBe(0);
    expect(matchWinner([30, 52], 50, 1)).toBe(1);
  });
  it('describes the match in every state', () => {
    expect(matchSentence([0, 12], 0, 1, 1)).toBe('Pip won the round (You 0, Pip 12).');
    expect(matchSentence([0, 0], 0, 1, -1)).toBe('A level round (You 0, Pip 0).');
    expect(matchSentence([30, 20], 50, 3, -1)).toBe('After 3 rounds: You 30, Pip 20. First to 50 wins.');
    expect(matchSentence([55, 20], 50, 4, 0)).toBe('You won the match to 50 points in 4 rounds (You 55, Pip 20).');
    expect(plural(1, 'round')).toBe('1 round');
  });
});

// ── the computer ─────────────────────────────────────────────────────────────

describe('computer players', () => {
  it('always choose a legal move when one exists, at every level, over thousands of positions', () => {
    for (const level of [1, 2, 3] as Level[]) {
      for (let seed = 1; seed <= 600; seed++) {
        const rng = mulberry32(seed);
        const { state } = newRound(seed % 2 ? 'draw' : 'block', rng);
        const mv = chooseMove(state, level, newMemory(), rng);
        const legal = legalMoves(state);
        if (!legal.length) { expect(mv).toBeNull(); continue; }
        expect(legal.some((m) => m.tile === mv!.tile && m.side === mv!.side)).toBe(true);
        expect(play(state, mv!.tile, mv!.side)).not.toBeNull();
      }
    }
  });
  it('Medium plays the tile with the most pips, a double first on a tie', () => {
    const s = mk(['6-5', '2-2', '5-1', '5-3', '0-5', '5-5'], ['0-0'], ['5-4'], { turn: 0 });
    for (let seed = 1; seed <= 40; seed++) {
      const mv = chooseMove(s, 2, newMemory(), mulberry32(seed))!;
      expect(mv.tile).toBe(t('5-6'));
    }
    const tie = mk(['3-3', '6-0', '1-1'], ['0-0'], ['3-4', '4-6'], { turn: 0 }); // ends 3 and 6: 3-3 (6 pips, double) and 6-0 (6 pips)
    for (let seed = 1; seed <= 40; seed++) expect(chooseMove(tie, 2, newMemory(), mulberry32(seed))!.tile).toBe(t('3-3'));
  });
  it('Easy does not always play the heaviest tile', () => {
    const s = mk(['6-5', '2-5', '5-1', '5-3', '0-5'], ['0-0'], ['5-4'], { turn: 0 });
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) seen.add(chooseMove(s, 1, newMemory(), mulberry32(seed))!.tile);
    expect(seen.size).toBeGreaterThan(2);
  });
  it('observe learns what you lack from your draws and passes, and unlearns it when you play it', () => {
    const m = newMemory();
    observe(m, { t: 'draw', by: 0, tile: 0, ends: [3, 5] });
    expect(m.lacks[3]).toBe(true);
    expect(m.lacks[5]).toBe(true);
    observe(m, { t: 'pass', by: 0, ends: [2, 2] });
    expect(m.lacks[2]).toBe(true);
    observe(m, { t: 'draw', by: 1, tile: 0, ends: [6, 6] }); // the computer's own draws teach nothing
    expect(m.lacks[6]).toBe(false);
    observe(m, { t: 'play', by: 0, tile: t('3-4'), side: 'left', ends: [4, 5] });
    expect(m.lacks[3]).toBe(false);
    expect(m.lacks[5]).toBe(true);
  });
  it('Hard likes to leave an end you were seen to lack', () => {
    // Computer holds 4-1 and 4-2 and can play either on the right (4). Leaving a 1 or a 2 behind: you lacked a 2.
    const s = mk(['0-0'], ['4-1', '4-2', '1-3', '2-6'], ['5-4'], { turn: 1 });
    const mem = newMemory();
    mem.lacks[2] = true;
    for (let seed = 1; seed <= 30; seed++) expect(chooseMove(s, 3, mem, mulberry32(seed))!.tile).toBe(t('4-2'));
    const none = newMemory();
    none.lacks[1] = true;
    for (let seed = 1; seed <= 30; seed++) expect(chooseMove(s, 3, none, mulberry32(seed))!.tile).toBe(t('4-1'));
  });
  it('computerTurn draws until it can play (draw game) and ends with the turn moved on or the round over', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      const first = newRound('draw', rng).state;
      let s = first;
      let guard = 0;
      while (!s.over && guard++ < 100) {
        const r = computerTurn(s, ((seed + guard) % 3 + 1) as Level, newMemory(), rng);
        if (!r) break;
        s = r.state;
        expect(validateState(s)).toBeNull();
      }
      expect(s.over).toBe(true);
    }
  });
  it('Hard beats Easy over seeded rounds', () => {
    let hardPoints = 0;
    let easyPoints = 0;
    let hardWins = 0;
    let easyWins = 0;
    for (let g = 0; g < 600; g++) {
      const rng = mulberry32(3000 + g);
      let s = newRound(g % 4 < 2 ? 'draw' : 'block', rng).state;
      const mem = newMemory(); // Hard (seat 1) watches Easy (seat 0)
      let guard = 0;
      while (!s.over && guard++ < 200) {
        const r = computerTurn(s, s.turn === 1 ? 3 : 1, mem, rng);
        if (!r) break;
        r.events.forEach((e) => observe(mem, e));
        s = r.state;
      }
      expect(s.over).toBe(true);
      if (s.winner === 1) { hardWins += 1; hardPoints += s.points; } else if (s.winner === 0) { easyWins += 1; easyPoints += s.points; }
    }
    expect(hardWins).toBeGreaterThan(easyWins);
    expect(hardPoints).toBeGreaterThan(easyPoints);
  }, 60_000);
});

// ── words ────────────────────────────────────────────────────────────────────

describe('describeEvent', () => {
  it('describes opening, playing, passing and going out', () => {
    expect(describeEvent({ t: 'open', by: 0, tile: t('6-6') }, 0)).toBe('You open with the double six.');
    expect(describeEvent({ t: 'open', by: 1, tile: t('3-5') }, 0)).toBe('Pip opens with the five-three.');
    expect(describeEvent({ t: 'play', by: 0, tile: t('2-5'), side: 'left', ends: [2, 6] }, 0)).toBe('You played the five-two on the left end. The ends are now 2 on the left and 6 on the right.');
    expect(describeEvent({ t: 'play', by: 1, tile: t('0-4'), side: 'right', ends: [3, 0] }, 0)).toContain('Pip played the four-blank on the right end.');
    expect(describeEvent({ t: 'pass', by: 0, ends: [1, 2] }, 0)).toBe('You cannot play, so you pass.');
    expect(describeEvent({ t: 'pass', by: 1, ends: [1, 2] }, 0)).toBe('Pip cannot play, so Pip passes.');
    expect(describeEvent({ t: 'out', by: 0, points: 14 }, 0)).toBe('You played your final tile and win the round, scoring 14 points.');
    expect(describeEvent({ t: 'out', by: 1, points: 1 }, 0)).toBe('Pip played the final tile and wins the round, scoring 1 point.');
    expect(describeEvent({ t: 'blocked', winner: 0, points: 8, pips: [12, 20] }, 0)).toBe('Nobody can play. Pips left: You 12, Pip 20. You win the round with fewer pips, scoring 8 points.');
    expect(describeEvent({ t: 'blocked', winner: 1, points: 3, pips: [12, 9] }, 0)).toContain('Pip wins the round with fewer pips, scoring 3 points.');
  });
  it('shows you the tile you drew but never names a computer draw', () => {
    expect(describeEvent({ t: 'draw', by: 0, tile: t('4-2'), ends: [1, 1] }, 0)).toBe('You drew the four-two.');
    const hidden = describeEvent({ t: 'draw', by: 1, tile: t('4-2'), ends: [1, 1] }, 0);
    expect(hidden).toBe('Pip drew a tile from the boneyard.');
    expect(hidden).not.toContain('four');
  });
  it('describes the chain for a screen reader', () => {
    const s = mk(['0-0'], ['1-1'], ['6-6', '6-3', '3-1']);
    expect(chainDescription(s)).toBe('Chain from left to right: six-six, six-three, three-one. Left end 6, right end 1.');
  });
});

// ── the fuzz ─────────────────────────────────────────────────────────────────

describe('random rounds', () => {
  const playRandom = (mode: Mode, seed: number) => {
    const rng = mulberry32(seed);
    let s = newRound(mode, rng).state;
    let actions = 0;
    let draws = 0;
    let passes = 0;
    while (!s.over) {
      if (actions++ > 200) throw new Error(`round ${seed} did not end`);
      const moves = legalMoves(s);
      let r: { state: DominoState; events: DominoEvent[] } | null;
      if (moves.length) { const m = moves[Math.floor(rng() * moves.length)]; r = play(s, m.tile, m.side); } else r = draw(s);
      if (!r) throw new Error(`round ${seed}: no legal action at action ${actions}`);
      for (const e of r.events) {
        describeEvent(e, 0);
        if (e.t === 'draw') draws += 1;
        if (e.t === 'pass') passes += 1;
        if (e.t === 'draw' && e.by !== 0) expect(describeEvent(e, 0)).not.toContain(tileName(e.tile));
      }
      s = r.state;
      const bad = validateState(s);
      if (bad) throw new Error(`round ${seed} action ${actions}: ${bad}`);
      expect(s.chain.length).toBeLessThanOrEqual(28);
    }
    return { s, actions, draws, passes };
  };

  it('3,000 random rounds in both modes all end, never lose or copy a tile, and always let the player to move act', () => {
    let out = 0;
    let blocked = 0;
    let sawDraw = 0;
    let sawPass = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const mode: Mode = seed % 2 ? 'draw' : 'block';
      const { s, draws, passes } = playRandom(mode, seed);
      expect(s.over).toBe(true);
      if (s.endedBy === 'out') {
        out += 1;
        expect(s.hands[s.winner as 0 | 1]).toHaveLength(0);
        expect(s.points).toBe(handPips(s.hands[1 - (s.winner as 0 | 1)]));
      } else {
        blocked += 1;
        const p0 = handPips(s.hands[0]);
        const p1 = handPips(s.hands[1]);
        expect(s.winner).toBe(p0 < p1 ? 0 : p1 < p0 ? 1 : -1);
        expect(s.points).toBe(Math.abs(p0 - p1));
      }
      if (mode === 'block') expect(draws).toBe(0);
      if (draws > 0) sawDraw += 1;
      if (passes > 0) sawPass += 1;
    }
    expect(out).toBeGreaterThan(0);
    expect(blocked).toBeGreaterThan(0); // blocked endings really do happen
    expect(sawDraw).toBeGreaterThan(0);
    expect(sawPass).toBeGreaterThan(0);
    expect(out + blocked).toBe(3000);
  }, 60_000);

  it('the same seed gives exactly the same round', () => {
    expect(JSON.stringify(playRandom('draw', 4242).s)).toBe(JSON.stringify(playRandom('draw', 4242).s));
  });
});

// ── stored results ───────────────────────────────────────────────────────────

describe('stored results', () => {
  it('sanitises junk to a fresh zeroed object', () => {
    for (const bad of [null, undefined, NaN, 'x', 5, [], [1, 2], () => 0, true]) expect(sanitizeStore(bad)).toEqual({ p: 0, w: 0, b: 0 });
    expect(sanitizeStore({ p: NaN, w: -1, b: 999 })).toEqual({ p: 0, w: 0, b: 0 });
    expect(sanitizeStore({ p: '5', w: 1.5, b: Infinity })).toEqual({ p: 0, w: 0, b: 0 });
    expect(sanitizeStore({ p: MAX_COUNT + 1, w: 1, b: 169 })).toEqual({ p: 0, w: 0, b: 0 });
  });
  it('keeps good values, never more wins than matches, ignores prototype and extra keys', () => {
    expect(sanitizeStore({ p: 10, w: 4, b: 40 })).toEqual({ p: 10, w: 4, b: 40 });
    expect(sanitizeStore({ p: 3, w: 8, b: 168 })).toEqual({ p: 3, w: 3, b: 168 });
    const out = sanitizeStore(JSON.parse('{"__proto__":{"p":5},"p":2,"w":1,"b":9,"extra":1}'));
    expect(out).toEqual({ p: 2, w: 1, b: 9 });
    expect(Object.keys(out).sort()).toEqual(['b', 'p', 'w']);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"p":5}}'))).toEqual({ p: 0, w: 0, b: 0 });
  });
  it('recordMatch counts matches and wins and keeps the best round, bounded', () => {
    const a = recordMatch({ p: 0, w: 0, b: 0 }, true, 24);
    expect(a).toEqual({ store: { p: 1, w: 1, b: 24 }, record: true });
    expect(recordMatch(a.store, false, 10)).toEqual({ store: { p: 2, w: 1, b: 24 }, record: false });
    expect(recordMatch(a.store, true, 9999).store.b).toBe(168);
    expect(recordMatch(a.store, true, NaN).store.b).toBe(24);
    expect(recordMatch({ p: MAX_COUNT, w: MAX_COUNT, b: 0 }, true, 5).store.p).toBe(MAX_COUNT);
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
  it('names the three levels in plain words and has no variant names on the page', () => {
    expect(Object.values(LEVEL_NAMES)).toEqual(['Easy', 'Medium', 'Hard']);
    expect(MODES).toEqual(['draw', 'block']);
  });
  it('pauses the computer when the tab is hidden and clears its timer on navigation', () => {
    expect(calculatorSource).toMatch(/visibilitychange/);
    expect(calculatorSource).toMatch(/astro:before-swap/);
    expect(calculatorSource).toMatch(/clearTimeout/);
  });
  it('uses crypto for the seed, the seeded generator for play and the right storage key', () => {
    expect(calculatorSource).toMatch(/crypto\.getRandomValues/);
    expect(calculatorSource).toMatch(/mulberry32/);
    expect(calculatorSource).toContain("'gk:game:dominoes'");
  });
  it('has a live status line and a how-it-works section', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/<details/);
  });
  it('swallows key repeats on every button, not only on the table', () => {
    expect(calculatorSource).toMatch(/app\.addEventListener\('keydown'[\s\S]{0,300}e\.preventDefault\(\)/);
  });
});
