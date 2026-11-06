/**
 * games-rock-paper-scissors.test.ts - the engine behind `rock-paper-scissors`.
 *
 * Pinned: who beats whom (all nine pairs), best-of-3/5/7 matches (draws replayed, the winner is the
 * first to the target, nothing after the end); the random computer is uniform and does not depend on
 * your moves; the pattern watcher really reads the history (it beats fixed-pattern players over many
 * rounds, predicts periodic patterns, and plays differently for different histories), is deterministic
 * for a seed and a history, never sees the move you are about to play (changing your move in round t never
 * changes the computer's move in rounds up to t), and against a random player wins only about a third
 * of the time; the history is capped; the saved record is sanitised. Numbers quoted on the guide page
 * are asserted here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  MOVES, MOVE_NAME, MOVE_TITLE, BEAT_TEXT, beats, counterTo, outcome, isMove, MODES, MODE_LABEL, BEST_OF, winsNeeded, parseMode, parseBestOf,
  plural, mulberry32, pickIndex, randomMove, newMatch, playRound, HISTORY_CAP, pushHistory, tally, mostPlayed, WEIGHTS, EXPLORE, predictNext,
  watcherMove, RECORD_KEYS, sanitiseRecord, type Move, type Pair, type BestOf, type Match,
} from '../src/components/apps-private/rock-paper-scissors/helpers';
import calculatorSource from '../src/components/apps-private/rock-paper-scissors/Calculator.astro?raw';

vi.setConfig({ testTimeout: 60_000 });

describe('the rules', () => {
  it('matches the nine pairs by hand: paper beats rock, scissors beat paper, rock beats scissors', () => {
    // 0 rock, 1 paper, 2 scissors. Written out, not computed.
    const table: [Move, Move, boolean][] = [
      [0, 0, false], [0, 1, false], [0, 2, true],
      [1, 0, true], [1, 1, false], [1, 2, false],
      [2, 0, false], [2, 1, true], [2, 2, false],
    ];
    for (const [a, b, want] of table) expect(beats(a, b), `${a} vs ${b}`).toBe(want);
    for (const a of MOVES) for (const b of MOVES) {
      expect(beats(a, b) && beats(b, a)).toBe(false);
      expect(a === b || beats(a, b) || beats(b, a)).toBe(true);
      expect(outcome(a, b)).toBe(a === b ? 'draw' : beats(a, b) ? 'win' : 'lose');
    }
  });
  it('counterTo always beats the move it answers', () => {
    for (const m of MOVES) { expect(beats(counterTo(m), m)).toBe(true); expect(counterTo(m)).not.toBe(m); }
    expect(MOVES.map(counterTo)).toEqual([1, 2, 0]);
  });
  it('names and sentences exist for every move', () => {
    expect(MOVES.map((m) => MOVE_NAME[m])).toEqual(['rock', 'paper', 'scissors']);
    expect(MOVES.map((m) => MOVE_TITLE[m])).toEqual(['Rock', 'Paper', 'Scissors']);
    expect(MOVES.map((m) => BEAT_TEXT[m])).toEqual(['Rock beats scissors', 'Paper beats rock', 'Scissors beat paper']);
    expect(MODES).toEqual(['random', 'watcher', 'two']);
    for (const m of MODES) expect(MODE_LABEL[m].length).toBeGreaterThan(5);
  });
  it('isMove accepts only 0, 1 and 2', () => {
    for (const ok of [0, 1, 2]) expect(isMove(ok)).toBe(true);
    for (const bad of [3, -1, 1.5, '1', null, undefined, NaN, {}, []]) expect(isMove(bad)).toBe(false);
  });
});

describe('matches', () => {
  it('first to the target wins: 2, 3 or 4 rounds for best of 3, 5 or 7', () => {
    expect(BEST_OF.map(winsNeeded)).toEqual([2, 3, 4]);
    for (const bo of BEST_OF) {
      let m = newMatch(bo);
      for (let i = 0; i < winsNeeded(bo) - 1; i++) m = playRound(m, 1, 0);
      expect(m.over).toBeNull();
      m = playRound(m, 1, 0);
      expect(m.over).toBe('a');
      expect(m.a).toBe(winsNeeded(bo));
      let n = newMatch(bo);
      for (let i = 0; i < winsNeeded(bo); i++) n = playRound(n, 0, 1);
      expect(n.over).toBe('b');
    }
  });
  it('a draw is replayed and counts for nobody', () => {
    let m = newMatch(3);
    m = playRound(m, 0, 0);
    expect(m).toMatchObject({ a: 0, b: 0, draws: 1, over: null });
    expect(m.rounds).toEqual([{ a: 0, b: 0, result: 'draw' }]);
  });
  it('nothing counts after the end, and bad moves are ignored (same object)', () => {
    let m = newMatch(3);
    m = playRound(playRound(m, 1, 0), 1, 0);
    expect(m.over).toBe('a');
    expect(playRound(m, 0, 1)).toBe(m);
    const fresh = newMatch(5);
    expect(playRound(fresh, 5 as Move, 0)).toBe(fresh);
    expect(playRound(fresh, 0, NaN as unknown as Move)).toBe(fresh);
  });
  it('10,000 random matches: scores, draws and winner agree with a plain recount', () => {
    const rng = mulberry32(31);
    for (let t = 0; t < 10000; t++) {
      const bo = BEST_OF[pickIndex(3, rng)] as BestOf;
      let m: Match = newMatch(bo);
      let a = 0, b = 0, d = 0;
      let winner: 'a' | 'b' | null = null;
      let rounds = 0;
      while (rounds < 60 && winner === null) {
        const x = randomMove(rng), y = randomMove(rng);
        m = playRound(m, x, y);
        rounds++;
        if (x === y) d++;
        else if ((x - y + 3) % 3 === 1) a++;
        else b++;
        if (a >= (bo + 1) / 2) winner = 'a';
        else if (b >= (bo + 1) / 2) winner = 'b';
        expect(m.a).toBe(a);
        expect(m.b).toBe(b);
        expect(m.draws).toBe(d);
        expect(m.over).toBe(winner);
        expect(m.rounds.length).toBe(rounds);
        expect(Math.max(m.a, m.b)).toBeLessThanOrEqual(winsNeeded(bo));
      }
      expect(winner).not.toBeNull();
    }
  });
  it('parsers fall back to safe values', () => {
    expect(parseMode('watcher')).toBe('watcher');
    for (const bad of ['', 'WATCHER', '__proto__', 5, null, undefined, [], {}]) expect(parseMode(bad)).toBe('random');
    expect(parseBestOf('3')).toBe(3);
    expect(parseBestOf(7)).toBe(7);
    for (const bad of ['', '4', '9', '33', '-3', 4, 1.5, NaN, null, undefined, {}, []]) expect(parseBestOf(bad)).toBe(5);
    expect(plural(1, 'round')).toBe('1 round');
    expect(plural(3, 'round')).toBe('3 rounds');
  });
});

/** Play `rounds` rounds of a computer against a player function; returns the computer's win share. */
const play = (computer: (h: Pair[], rng: () => number) => Move, player: (h: Pair[], t: number) => Move, rounds: number, seed: number, skip = 0) => {
  const rng = mulberry32(seed);
  let h: Pair[] = [];
  let cw = 0, pw = 0, n = 0;
  const cs: Move[] = [];
  for (let t = 0; t < rounds; t++) {
    const c = computer(h, rng); // first: the computer commits, seeing only earlier rounds
    const p = player(h, t);
    cs.push(c);
    h = pushHistory(h, p, c);
    if (t >= skip) { n++; if (beats(c, p)) cw++; else if (beats(p, c)) pw++; }
  }
  return { cw: cw / n, pw: pw / n, cs, h };
};

const PLAYERS: Record<string, (h: Pair[], t: number) => Move> = {
  'always rock': () => 0,
  'always paper': () => 1,
  'cycle rock paper scissors': (_h, t) => (t % 3) as Move,
  'cycle scissors paper rock': (_h, t) => ((6 - (t % 3)) % 3) as Move,
  'rock rock paper': (_h, t) => ([0, 0, 1][t % 3]) as Move,
  'six move pattern': (_h, t) => ([0, 0, 1, 2, 2, 1][t % 6]) as Move,
  'win stay, lose shift': (h) => {
    if (h.length === 0) return 0;
    const last = h[h.length - 1];
    const o = outcome(last.p, last.c);
    return (o === 'win' ? last.p : o === 'lose' ? (last.p + 1) % 3 : (last.p + 2) % 3) as Move;
  },
  'play what beats the computer\'s last move': (h) => (h.length ? counterTo(h[h.length - 1].c) : 0),
  'repeat after a draw, change after a loss': (h) => {
    if (h.length === 0) return 2;
    const last = h[h.length - 1];
    return (outcome(last.p, last.c) === 'draw' ? last.p : counterTo(last.p)) as Move;
  },
};

describe('the random computer', () => {
  it('plays each move about a third of the time whatever you do (60,000 draws, about 1% tolerance)', () => {
    const rng = mulberry32(1);
    const c = [0, 0, 0];
    for (let i = 0; i < 60000; i++) c[randomMove(rng)]++;
    for (const n of c) expect(Math.abs(n / 60000 - 1 / 3)).toBeLessThan(0.01);
  });
  it('wins about a third against a player who always plays rock', () => {
    const r = play((_h, rng) => randomMove(rng), PLAYERS['always rock'], 30000, 4);
    expect(r.cw).toBeGreaterThan(0.31);
    expect(r.cw).toBeLessThan(0.36);
  });
  it('survives a degenerate rng', () => {
    for (const rng of [() => 0, () => 0.999999, () => NaN]) expect(isMove(randomMove(rng))).toBe(true);
  });
});

describe('the pattern watcher', () => {
  it('beats every fixed-pattern player over 600 rounds (average of 5 seeds, first 30 rounds not counted)', () => {
    for (const [name, player] of Object.entries(PLAYERS)) {
      let sum = 0;
      for (let s = 1; s <= 5; s++) sum += play(watcherMove, player, 600, s * 1237, 30).cw;
      const avg = sum / 5;
      expect(avg, name).toBeGreaterThan(0.7);
      // The guide page says about 93 percent for these three.
      if (['always rock', 'cycle rock paper scissors', 'six move pattern'].includes(name)) expect(avg, name).toBeGreaterThan(0.88);
    }
  });
  it('beats a fixed-pattern player far more often than the random computer does', () => {
    for (const name of ['always rock', 'cycle rock paper scissors', 'six move pattern', 'win stay, lose shift']) {
      const w = play(watcherMove, PLAYERS[name], 600, 9, 30).cw;
      const r = play((_h, rng) => randomMove(rng), PLAYERS[name], 600, 9, 30).cw;
      expect(w - r, name).toBeGreaterThan(0.3);
    }
  });
  it('against a player who plays at random it wins only about a third of the time (6,000 rounds)', () => {
    const rnd = mulberry32(777);
    const r = play(watcherMove, () => randomMove(rnd), 6000, 5);
    expect(r.cw).toBeGreaterThan(0.3);
    expect(r.cw).toBeLessThan(0.37);
    expect(r.pw).toBeGreaterThan(0.3);
    expect(r.pw).toBeLessThan(0.37);
  });
  it('predicts periodic patterns: after 40 rounds it names the next move at least 95% of the time', () => {
    for (const name of ['always rock', 'cycle rock paper scissors', 'cycle scissors paper rock', 'rock rock paper', 'six move pattern']) {
      const rng = mulberry32(3);
      let h: Pair[] = [];
      let right = 0, tested = 0;
      for (let t = 0; t < 160; t++) {
        const p = PLAYERS[name](h, t);
        if (t >= 40) { tested++; if (predictNext(h).move === p) right++; }
        h = pushHistory(h, p, randomMove(rng)); // the computer's own moves are noise here
      }
      expect(right / tested, name).toBeGreaterThanOrEqual(0.95);
    }
  });
  it('no history, a tie, or a single round give a null or a sensible guess', () => {
    expect(predictNext([])).toEqual({ move: null, votes: [0, 0, 0] });
    const one = predictNext([{ p: 2, c: 0 }]);
    expect(one.move).toBe(2);
    const tie = predictNext([{ p: 0, c: 1 }, { p: 1, c: 2 }, { p: 2, c: 0 }]);
    expect(tie.votes.length).toBe(3);
  });
  it('really reads the history: different histories give different moves for the same random stream', () => {
    const rocks: Pair[] = Array.from({ length: 30 }, () => ({ p: 0 as Move, c: 2 as Move }));
    const papers: Pair[] = Array.from({ length: 30 }, () => ({ p: 1 as Move, c: 0 as Move }));
    const scissors: Pair[] = Array.from({ length: 30 }, () => ({ p: 2 as Move, c: 1 as Move }));
    const share = (h: Pair[], want: Move): number => {
      let n = 0;
      for (let s = 1; s <= 4000; s++) if (watcherMove(h, mulberry32(s)) === want) n++;
      return n / 4000;
    };
    // After a run of one move it plays the counter about 93% of the time (90% on purpose plus a third of the random tenth).
    for (const [h, want] of [[rocks, 1], [papers, 2], [scissors, 0]] as [Pair[], Move][]) {
      const s = share(h, want);
      expect(s).toBeGreaterThan(0.9);
      expect(s).toBeLessThan(0.96);
    }
    expect(EXPLORE).toBe(0.1);
    expect(WEIGHTS.order3).toBeGreaterThan(WEIGHTS.order2);
    expect(WEIGHTS.order2).toBeGreaterThan(WEIGHTS.order1);
  });
  it('is deterministic: the same history and stream give the same move, and the same game replays exactly', () => {
    for (const name of Object.keys(PLAYERS)) {
      const a = play(watcherMove, PLAYERS[name], 200, 42);
      const b = play(watcherMove, PLAYERS[name], 200, 42);
      expect(a.cs).toEqual(b.cs);
      expect(a.h).toEqual(b.h);
    }
    const h: Pair[] = Array.from({ length: 25 }, (_, i) => ({ p: (i % 3) as Move, c: ((i * 2) % 3) as Move }));
    for (let s = 1; s <= 50; s++) expect(watcherMove(h, mulberry32(s))).toBe(watcherMove(h, mulberry32(s)));
  });
  it('never sees the move you are about to play: changing your move in round t changes nothing up to round t', () => {
    const rng = mulberry32(2025);
    for (let trial = 0; trial < 200; trial++) {
      const n = 12 + Math.floor(rng() * 40);
      const moves: Move[] = Array.from({ length: n }, () => randomMove(rng));
      const seed = 1 + Math.floor(rng() * 1e6);
      const run = (ms: readonly Move[]): Move[] => {
        const r = mulberry32(seed);
        let h: Pair[] = [];
        const cs: Move[] = [];
        for (const p of ms) { const c = watcherMove(h, r); cs.push(c); h = pushHistory(h, p, c); }
        return cs;
      };
      const base = run(moves);
      const t = Math.floor(rng() * n);
      const changed = moves.slice();
      changed[t] = ((changed[t] + 1 + Math.floor(rng() * 2)) % 3) as Move;
      const other = run(changed);
      expect(other.slice(0, t + 1)).toEqual(base.slice(0, t + 1)); // rounds 0..t unchanged, including the computer's move in round t
    }
  });
  it('the history is capped at the last 300 rounds, newest kept', () => {
    let h: Pair[] = [];
    for (let i = 0; i < 1000; i++) h = pushHistory(h, (i % 3) as Move, ((i + 1) % 3) as Move);
    expect(HISTORY_CAP).toBe(300);
    expect(h.length).toBe(300);
    expect(h[299]).toEqual({ p: 999 % 3, c: 1000 % 3 });
    expect(h[0]).toEqual({ p: 700 % 3, c: 701 % 3 });
    const before: Pair[] = [{ p: 0, c: 1 }];
    const after = pushHistory(before, 2, 2);
    expect(before.length).toBe(1);
    expect(after.length).toBe(2);
  });
  it('a full 300-round prediction is fast (200 predictions in well under 10 seconds)', () => {
    const rng = mulberry32(1);
    let h: Pair[] = [];
    for (let i = 0; i < 300; i++) h = pushHistory(h, randomMove(rng), randomMove(rng));
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) predictNext(h);
    expect(performance.now() - t0).toBeLessThan(10_000);
  }, 30_000);
  it('survives a degenerate rng', () => {
    const h: Pair[] = [{ p: 0, c: 1 }, { p: 0, c: 2 }];
    for (const rng of [() => 0, () => 0.999999, () => NaN]) expect(isMove(watcherMove(h, rng))).toBe(true);
    expect(isMove(watcherMove([], () => 0.5))).toBe(true);
  });
});

describe('your move counts', () => {
  it('tally counts your moves, mostPlayed returns a clear leader or null', () => {
    const h: Pair[] = [{ p: 0, c: 1 }, { p: 0, c: 2 }, { p: 2, c: 2 }];
    expect(tally(h)).toEqual([2, 0, 1]);
    expect(mostPlayed(h)).toBe(0);
    expect(mostPlayed([])).toBeNull();
    expect(mostPlayed([{ p: 0, c: 0 }, { p: 1, c: 0 }])).toBeNull();
    expect(tally([])).toEqual([0, 0, 0]);
  });
});

describe('saved record', () => {
  it('keeps whole numbers 1 to 99,999 for the four known keys only, and returns a fresh object', () => {
    expect([...RECORD_KEYS]).toEqual(['rw', 'rl', 'ww', 'wl']);
    expect(sanitiseRecord({ rw: 3, rl: 99999, ww: 1, wl: 12 })).toEqual({ rw: 3, rl: 99999, ww: 1, wl: 12 });
    expect(sanitiseRecord({ rw: 0, rl: -3, ww: 1.5, wl: 100000 })).toEqual({});
    expect(sanitiseRecord({ rw: NaN, rl: Infinity, ww: '5', wl: true })).toEqual({});
    expect(sanitiseRecord({ x: 5, rw: [5], ww: 2 })).toEqual({ ww: 2 });
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseRecord(raw)).toEqual({});
    const out = sanitiseRecord(JSON.parse('{"__proto__": {"rw": 5}, "constructor": 3}'));
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    const raw = { rw: 4 };
    const fresh = sanitiseRecord(raw);
    expect(fresh).not.toBe(raw);
    fresh.rw = 9;
    expect(raw.rw).toBe(4);
  });
});

describe('the page', () => {
  it('announces results, keeps scores under the right key and uses the shell events', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/gk:game:rock-paper-scissors/);
    expect(calculatorSource).toMatch(/_rpsgInit/);
    expect(calculatorSource).toMatch(/id="rpsg-app"/);
  });
});
