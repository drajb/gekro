/**
 * games-critter-pop.test.ts - the engine behind `critter-pop`.
 *
 * Pinned: the board is 3 x 3 and a round is 30 s of game time in 25 ms ticks; the spawn rules hold
 * on every tick of thousands of simulated rounds (one critter per hole, the per-level cap, a hole
 * rests 700 ms after a critter leaves it, never the same kind twice in a row, nothing spawns in the
 * last 400 ms); the time a critter stays up shrinks gently and never drops below the level floor
 * (Little ones 2.6 s, Middle 1.3 s, Big 0.85 s); every critter is either popped, went down by itself
 * or is still up (nothing is lost); a seed replays exactly; hit testing maps every point of the board
 * to exactly one hole and the gaps count for the nearest hole; the fixed-step clock plays the same
 * round at any frame rate; best-score storage rejects junk; and the page source keeps the 56 px
 * hole floor, the hidden-veil rule and the reduced-motion block the guide page talks about.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, start, tick, pop, holeAt, keyToHole, moveFocus, keyScope, spaceIsNative, advanceClock,
  lifeAt, gapAt, capAt, bestKey, parseBests, recordBest, holeLabel, favourite, resultMessage, shareText, plural, isLevel, mulberry32,
  COLS, HOLES, ROUND_MS, STEP_MS, MAX_DT, REST_MS, FIRST_SPAWN_MS, LAST_SPAWN_BUFFER_MS, SLOW_FACTOR, MAX_SCORE,
  LEVELS, LEVEL_CFG, KINDS, LEVEL_LABEL,
  type GameState, type Level, type Kind,
} from '../src/components/apps-private/critter-pop/helpers';
import calculatorSource from '../src/components/apps-private/critter-pop/Calculator.astro?raw';

type Bot = (s: GameState) => number[];

/** Play a whole round in 25 ms ticks. `check` sees the state before the tick, after the tick and after the player's pops. */
const play = (level: Level, slow: boolean, seed: number, bot: Bot | null, check?: (prev: GameState, ticked: GameState, final: GameState) => void) => {
  const rng = mulberry32(seed);
  let s = start(newGame(level, slow));
  const trace: string[] = [];
  let ticks = 0;
  while (s.status === 'running') {
    const prev = s;
    const ticked = tick(s, STEP_MS, rng);
    s = ticked;
    if (bot && s.status === 'running') for (const h of bot(s)) s = pop(s, h).state;
    check?.(prev, ticked, s);
    trace.push(`${s.elapsed}|${s.critters.map((c) => `${c.hole}${c.kind[0]}`).join(',')}|${s.score}`);
    if (++ticks > 5000) throw new Error('round did not end');
  }
  return { s, trace, ticks };
};

const popAll: Bot = (s) => s.critters.map((c) => c.hole);
const randomBot = (seed: number): Bot => {
  const r = mulberry32(seed);
  return () => (r() < 0.4 ? [Math.floor(r() * HOLES)] : []);
};

describe('the board and the round', () => {
  it('is a 3 x 3 meadow, a round is 30 seconds in 25 ms ticks', () => {
    expect([COLS, HOLES, ROUND_MS, STEP_MS, MAX_DT, REST_MS]).toEqual([3, 9, 30000, 25, 50, 700]);
    expect(LEVELS).toEqual(['little', 'middle', 'big']);
    expect(LEVEL_LABEL.little).toBe('Little ones');
  });
  it('starts ready, empty and at zero, and only start() makes it run', () => {
    const s = newGame('middle', false);
    expect(s.status).toBe('ready');
    expect([s.score, s.hid, s.taps, s.spawned, s.elapsed]).toEqual([0, 0, 0, 0, 0]);
    expect(s.critters).toEqual([]);
    expect(s.rest).toHaveLength(9);
    expect(tick(s, 25, mulberry32(1))).toBe(s); // a ready game does not move
    expect(start(s).status).toBe('running');
    expect(start(start(s)).status).toBe('running');
  });
  it('falls back to Middle for an unknown level', () => {
    expect(newGame('nope' as Level, false).level).toBe('middle');
    expect(isLevel('big')).toBe(true);
    for (const bad of ['', 'BIG', null, undefined, 3, {}]) expect(isLevel(bad as unknown), String(bad)).toBe(false);
  });
  it('lasts exactly 30 seconds: 1200 ticks of 25 ms', () => {
    const { s, ticks } = play('middle', false, 1, null);
    expect(s.status).toBe('done');
    expect(s.elapsed).toBe(ROUND_MS);
    expect(ticks).toBe(1200);
    expect(s.critters).toEqual([]);
    expect(tick(s, 25, mulberry32(1))).toBe(s); // a finished game does not move
  });
  it('does not change the state it was given', () => {
    const rng = mulberry32(3);
    let s = start(newGame('big', false));
    for (let i = 0; i < 100; i++) s = tick(s, 25, rng);
    const before = JSON.stringify(s);
    tick(s, 25, mulberry32(9));
    pop(s, s.critters[0]?.hole ?? 0);
    pop(s, 4);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('cuts a long frame to 50 ms and ignores NaN and negative time', () => {
    const rng = mulberry32(2);
    const s = start(newGame('middle', false));
    expect(tick(s, 5000, rng).elapsed).toBe(MAX_DT);
    expect(tick(s, NaN, rng).elapsed).toBe(0);
    expect(tick(s, -40, rng).elapsed).toBe(0);
    expect(tick(s, Infinity, rng).elapsed).toBe(0);
  });
});

describe('pace: gentle and never below the level floor', () => {
  it('has the documented numbers', () => {
    expect(LEVEL_CFG.little).toMatchObject({ lifeStart: 3400, lifeEnd: 2600 });
    expect(LEVEL_CFG.middle).toMatchObject({ lifeStart: 2000, lifeEnd: 1300 });
    expect(LEVEL_CFG.big).toMatchObject({ lifeStart: 1400, lifeEnd: 850 });
    expect(SLOW_FACTOR).toBe(1.25);
  });
  it('the time up shrinks smoothly from start to end and stays inside [end, start]', () => {
    for (const l of LEVELS) {
      for (const slow of [false, true]) {
        const k = slow ? SLOW_FACTOR : 1;
        const c = LEVEL_CFG[l];
        expect(lifeAt(l, 0, slow)).toBe(Math.round(c.lifeStart * k));
        expect(lifeAt(l, ROUND_MS, slow)).toBe(Math.round(c.lifeEnd * k));
        let prev = Infinity;
        for (let t = 0; t <= ROUND_MS; t += 250) {
          const v = lifeAt(l, t, slow);
          expect(v).toBeLessThanOrEqual(prev);
          expect(v).toBeGreaterThanOrEqual(Math.round(c.lifeEnd * k));
          prev = v;
        }
        // Past the end or before the start it stays at the end values.
        expect(lifeAt(l, ROUND_MS * 3, slow)).toBe(lifeAt(l, ROUND_MS, slow));
        expect(lifeAt(l, -1000, slow)).toBe(lifeAt(l, 0, slow));
        expect(lifeAt(l, NaN, slow)).toBe(lifeAt(l, 0, slow));
      }
    }
  });
  it('the pause between critters also shrinks gently, and the levels are ordered', () => {
    for (const l of LEVELS) expect(gapAt(l, ROUND_MS, false)).toBeLessThan(gapAt(l, 0, false));
    for (const t of [0, 10_000, 29_000]) {
      expect(lifeAt('little', t, false)).toBeGreaterThan(lifeAt('middle', t, false));
      expect(lifeAt('middle', t, false)).toBeGreaterThan(lifeAt('big', t, false));
      expect(gapAt('little', t, false)).toBeGreaterThan(gapAt('middle', t, false));
      expect(gapAt('middle', t, false)).toBeGreaterThan(gapAt('big', t, false));
    }
  });
  it('Little ones never shows more than one critter for 20 s and never more than two', () => {
    expect(capAt('little', 0)).toBe(1);
    expect(capAt('little', 19_999)).toBe(1);
    expect(capAt('little', 20_000)).toBe(2);
    expect(capAt('little', ROUND_MS)).toBe(2);
    for (let t = 0; t <= ROUND_MS; t += 500) {
      expect(capAt('middle', t)).toBeLessThanOrEqual(3);
      expect(capAt('big', t)).toBeLessThanOrEqual(4);
      expect(capAt('middle', t)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('spawn rules hold on every tick', () => {
  const cases: [Level, boolean][] = LEVELS.flatMap((l) => [[l, false], [l, true]] as [Level, boolean][]);
  for (const [level, slow] of cases) {
    it(`${level}${slow ? ' (reduced-motion pace)' : ''}: 12 seeded rounds, three kinds of player`, () => {
      let spawnsSeen = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const bots: (Bot | null)[] = [null, popAll, randomBot(seed)];
        for (const bot of bots) {
          const leftAt = new Map<number, number>();
          play(level, slow, seed * 7, bot, (prev, ticked, final) => {
            const holes = ticked.critters.map((c) => c.hole);
            if (new Set(holes).size !== holes.length) throw new Error('two critters in one hole');
            if (ticked.critters.length > capAt(level, ticked.elapsed)) throw new Error(`cap exceeded: ${ticked.critters.length}`);
            for (const c of ticked.critters) {
              if (!KINDS.includes(c.kind) || c.hole < 0 || c.hole >= HOLES || !Number.isInteger(c.hole)) throw new Error('bad critter');
              if (c.age < 0 || c.age >= c.life) throw new Error(`bad age ${c.age}/${c.life}`);
              if (c.life < Math.round(LEVEL_CFG[level].lifeEnd * (slow ? SLOW_FACTOR : 1))) throw new Error('life under the floor');
            }
            // conservation: every critter ever spawned is popped, hid, or still up
            if (final.status === 'running' && final.score + final.hid + final.critters.length !== final.spawned) throw new Error('a critter was lost');
            if (final.score > final.taps) throw new Error('more pops than taps');
            const prevHoles = new Set(prev.critters.map((c) => c.hole));
            // holes that emptied by themselves this tick
            for (const h of prevHoles) if (!holes.includes(h)) leftAt.set(h, ticked.elapsed);
            const spawnedNow = ticked.spawned - prev.spawned;
            if (spawnedNow > 1) throw new Error('more than one spawn in a tick');
            if (spawnedNow === 1) {
              spawnsSeen++;
              const c = ticked.critters.find((x) => !prevHoles.has(x.hole));
              if (!c) throw new Error('spawn not found');
              if (c.age !== 0) throw new Error('new critter must start at age 0');
              const left = leftAt.get(c.hole);
              if (left !== undefined && ticked.elapsed - left < REST_MS - 1e-9) throw new Error(`hole ${c.hole} reused after ${ticked.elapsed - left} ms`);
              if (ticked.elapsed >= ROUND_MS - LAST_SPAWN_BUFFER_MS) throw new Error('spawn in the last 400 ms');
              if (c.kind === prev.lastKind) throw new Error('same kind twice in a row');
              if (c.life !== lifeAt(level, ticked.elapsed, slow)) throw new Error('life does not match the schedule');
            }
            // holes the player emptied after the tick
            for (const c of ticked.critters) if (!final.critters.some((x) => x.hole === c.hole)) leftAt.set(c.hole, ticked.elapsed);
          });
        }
      }
      expect(spawnsSeen).toBeGreaterThan(300);
    }, 30_000);
  }
  it('the first critter shows up after 600 ms and not before', () => {
    expect(FIRST_SPAWN_MS).toBe(600);
    const rng = mulberry32(5);
    let s = start(newGame('middle', false));
    let t = 0;
    while (s.critters.length === 0 && t < 5000) { s = tick(s, STEP_MS, rng); t += STEP_MS; }
    expect(t).toBe(FIRST_SPAWN_MS);
  });
  it('a round has a plausible number of critters for each level', () => {
    const counts = LEVELS.map((l) => {
      let n = 0;
      for (let seed = 1; seed <= 10; seed++) n += play(l, false, seed, popAll).s.spawned;
      return n / 10;
    });
    expect(counts[0]).toBeGreaterThan(15);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    expect(counts[2]).toBeLessThan(80);
  });
  it('uses every hole and every kind', () => {
    const holes = new Set<number>();
    const kinds = new Set<Kind>();
    for (let seed = 1; seed <= 6; seed++) play('big', false, seed, null, (_p, n) => n.critters.forEach((c) => { holes.add(c.hole); kinds.add(c.kind); }));
    expect(holes.size).toBe(9);
    expect(kinds.size).toBe(4);
  });
});

describe('popping and the score', () => {
  const running = (level: Level = 'middle') => {
    const rng = mulberry32(11);
    let s = start(newGame(level, false));
    while (s.critters.length === 0) s = tick(s, STEP_MS, rng);
    return s;
  };
  it('a pop on a critter scores one, removes it, rests the hole and counts its kind', () => {
    const s = running();
    const c = s.critters[0];
    const r = pop(s, c.hole);
    expect(r.hit).toBe(true);
    expect(r.kind).toBe(c.kind);
    expect(r.state.score).toBe(1);
    expect(r.state.taps).toBe(1);
    expect(r.state.critters.find((x) => x.hole === c.hole)).toBeUndefined();
    expect(r.state.rest[c.hole]).toBe(REST_MS);
    expect(r.state.byKind[c.kind]).toBe(1);
    // the same hole is empty now: a second tap hits nothing
    const again = pop(r.state, c.hole);
    expect(again.hit).toBe(false);
    expect(again.state.score).toBe(1);
    expect(again.state.taps).toBe(2);
  });
  it('an empty hole costs nothing but is counted as a tap', () => {
    const s = running();
    const empty = [...Array(HOLES).keys()].find((h) => !s.critters.some((c) => c.hole === h)) as number;
    const r = pop(s, empty);
    expect(r.hit).toBe(false);
    expect(r.state.score).toBe(0);
    expect(r.state.taps).toBe(1);
    expect(r.state.critters).toEqual(s.critters);
  });
  it('ignores bad holes and taps when the round is not running', () => {
    const s = running();
    for (const bad of [-1, 9, 1.5, NaN, Infinity]) expect(pop(s, bad).state).toBe(s);
    const ready = newGame('middle', false);
    expect(pop(ready, 4).state).toBe(ready);
    const done = play('middle', false, 3, null).s;
    expect(pop(done, 4).state).toBe(done);
  });
  it('the per-kind counts always add up to the score', () => {
    for (const level of LEVELS) {
      const { s } = play(level, false, 21, randomBot(21));
      expect(KINDS.reduce((a, k) => a + s.byKind[k], 0)).toBe(s.score);
      expect(s.score + s.hid).toBeLessThanOrEqual(s.spawned);
    }
  });
  it('a player who pops everything at once gets every critter and none go down by themselves', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 8; seed++) {
        const { s } = play(level, false, seed, popAll);
        expect(s.score).toBe(s.spawned);
        expect(s.hid).toBe(0);
        expect(s.score).toBeLessThan(MAX_SCORE);
      }
    }
  });
  it('a player who does nothing sees every critter go back down: pops 0, hid + still up = spawned', () => {
    for (const level of LEVELS) {
      const { s, trace } = play(level, false, 4, null);
      expect(s.score).toBe(0);
      expect(s.hid).toBeGreaterThan(5);
      expect(s.hid).toBeLessThanOrEqual(s.spawned);
      expect(trace.length).toBe(1200);
    }
  });
});

describe('determinism', () => {
  it('the same seed replays the same round, tick for tick', () => {
    for (const level of LEVELS) {
      expect(play(level, false, 99, randomBot(5)).trace).toEqual(play(level, false, 99, randomBot(5)).trace);
    }
  });
  it('a different seed gives a different round', () => {
    expect(play('middle', false, 99, null).trace).not.toEqual(play('middle', false, 100, null).trace);
  });
});

describe('hit testing on the grid', () => {
  it('every point of the board belongs to exactly one hole, laid out in reading order', () => {
    for (const [w, h] of [[300, 300], [297, 301], [90, 90], [1000, 640]] as [number, number][]) {
      const area = new Array(HOLES).fill(0);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = holeAt(x + 0.5, y + 0.5, w, h);
          if (!(i >= 0 && i < HOLES)) throw new Error(`no hole at ${x},${y}`);
          const px = x + 0.5;
          const py = y + 0.5;
          const c = i % 3;
          const r = Math.floor(i / 3);
          // the cell's own rectangle contains the point (a tiny float slack on the borders)
          if (px < (c * w) / 3 - 1e-9 || px >= ((c + 1) * w) / 3 + 1e-9 || py < (r * h) / 3 - 1e-9 || py >= ((r + 1) * h) / 3 + 1e-9) {
            throw new Error(`point ${x},${y} is outside hole ${i}`);
          }
          area[i]++;
        }
      }
      for (const a of area) expect(Math.abs(a - (w * h) / 9)).toBeLessThan((w + h) * 2 + 4);
    }
  });
  it('the middle of each cell maps to that cell', () => {
    for (let i = 0; i < HOLES; i++) {
      const cx = ((i % 3) + 0.5) * 100;
      const cy = (Math.floor(i / 3) + 0.5) * 100;
      expect(holeAt(cx, cy, 300, 300)).toBe(i);
    }
  });
  it('a tap in the gap between holes still counts for a neighbour, never for nothing', () => {
    // With a 300 px board, 8 px gaps put the first gap at x 94 to 102. Both sides give a real hole.
    for (let x = 90; x <= 106; x++) {
      const h = holeAt(x, 50, 300, 300);
      expect([0, 1]).toContain(h);
    }
  });
  it('edges: the top-left corner is hole 0, the bottom-right pixel is hole 8, outside is -1', () => {
    expect(holeAt(0, 0, 300, 300)).toBe(0);
    expect(holeAt(299.99, 299.99, 300, 300)).toBe(8);
    for (const [x, y] of [[-0.1, 5], [5, -0.1], [300, 5], [5, 300], [400, 400]]) expect(holeAt(x, y, 300, 300), `${x},${y}`).toBe(-1);
  });
  it('rejects NaN, Infinity and empty boards', () => {
    expect(holeAt(NaN, 5, 300, 300)).toBe(-1);
    expect(holeAt(5, Infinity, 300, 300)).toBe(-1);
    expect(holeAt(5, 5, 0, 300)).toBe(-1);
    expect(holeAt(5, 5, 300, -1)).toBe(-1);
  });
});

describe('keys', () => {
  it('digits 1 to 9 press holes in reading order, nothing else does', () => {
    for (let n = 1; n <= 9; n++) expect(keyToHole(String(n))).toBe(n - 1);
    for (const k of ['0', 'a', '10', ' ', 'Enter', '', 'ArrowUp', '١']) expect(keyToHole(k), k).toBe(-1);
  });
  it('arrow keys move one hole and stop at the edge', () => {
    expect(moveFocus(4, 'ArrowUp')).toBe(1);
    expect(moveFocus(4, 'ArrowDown')).toBe(7);
    expect(moveFocus(4, 'ArrowLeft')).toBe(3);
    expect(moveFocus(4, 'ArrowRight')).toBe(5);
    expect(moveFocus(0, 'ArrowUp')).toBe(0);
    expect(moveFocus(0, 'ArrowLeft')).toBe(0);
    expect(moveFocus(8, 'ArrowDown')).toBe(8);
    expect(moveFocus(8, 'ArrowRight')).toBe(8);
    expect(moveFocus(2, 'ArrowRight')).toBe(2); // does not wrap to the next row
    expect(moveFocus(3, 'ArrowLeft')).toBe(3);
    expect(moveFocus(4, 'x')).toBe(4);
    expect(moveFocus(99, 'ArrowUp')).toBe(4);
  });
  it('key capture scope: pause keys always work, game keys only in the game or while running', () => {
    for (const p of ['ready', 'running', 'paused', 'over'] as const) expect(keyScope(p, true), p).toBe('all');
    expect(keyScope('running', false)).toBe('all');
    expect(keyScope('paused', false)).toBe('resume');
    expect(keyScope('ready', false)).toBe('none');
    expect(keyScope('over', false)).toBe('none');
    expect(spaceIsNative('BUTTON')).toBe(true);
    expect(spaceIsNative('SUMMARY')).toBe(true);
    expect(spaceIsNative('DIV')).toBe(false);
  });
});

describe('fixed-step clock', () => {
  const ticksOver = (hz: number, seconds: number): number => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < hz * seconds; i++) {
      const r = advanceClock(acc, 1000 / hz);
      acc = r.acc;
      total += r.steps;
    }
    return total;
  };
  it('runs 40 ticks a second on 30, 60, 144 and 240 Hz screens', () => {
    for (const hz of [30, 60, 144, 240]) expect(Math.abs(ticksOver(hz, 10) - 400), `${hz} Hz`).toBeLessThanOrEqual(1);
  });
  it('a long stall cannot fast-forward the round', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(2);
    expect(r.acc).toBeLessThan(STEP_MS);
  });
  it('survives bad numbers', () => {
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-5, -50)).toEqual({ steps: 0, acc: 0 });
  });
  it('a whole round driven by 60 Hz frames takes about 30 seconds of frames', () => {
    const rng = mulberry32(8);
    let s = start(newGame('big', false));
    let acc = 0;
    let frames = 0;
    while (s.status === 'running' && frames < 10_000) {
      const r = advanceClock(acc, 1000 / 60);
      acc = r.acc;
      for (let i = 0; i < r.steps && s.status === 'running'; i++) s = tick(s, STEP_MS, rng);
      frames++;
    }
    expect(s.status).toBe('done');
    expect(Math.abs(frames - 1800)).toBeLessThanOrEqual(2);
  });
});

describe('best scores', () => {
  it('has one key per level and pace', () => {
    const keys = LEVELS.flatMap((l) => [bestKey(l, false), bestKey(l, true)]);
    expect(new Set(keys).size).toBe(6);
    expect(bestKey('little', true)).toBe('little-slow');
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ middle: 12, big: '9', little: 1.5, 'big-slow': -3, nope: 4, 'middle-slow': 99999, __proto__: { x: 1 } })).toEqual({ middle: 12 });
    expect(parseBests(JSON.parse('{"__proto__":{"big":50},"big":7}'))).toEqual({ big: 7 });
    expect(Object.keys(parseBests({ constructor: 5 }))).toEqual([]);
  });
  it('only a whole, positive, possible score can set a best, and only if higher', () => {
    const k = bestKey('middle', false);
    let r = recordBest({}, k, 7);
    expect(r).toEqual({ bests: { [k]: 7 }, improved: true });
    expect(recordBest(r.bests, k, 7).improved).toBe(false);
    expect(recordBest(r.bests, k, 3).improved).toBe(false);
    r = recordBest(r.bests, k, 8);
    expect(r.bests[k]).toBe(8);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
    expect(MAX_SCORE).toBe(100);
  });
});

describe('messages', () => {
  it('names the right plural and the labels', () => {
    expect(plural(1, 'critter', 'critters')).toBe('1 critter');
    expect(plural(0, 'critter', 'critters')).toBe('0 critters');
    expect(holeLabel(0, null)).toBe('Hole 1, row 1 column 1, empty');
    expect(holeLabel(5, 'owl')).toBe('Hole 6, row 2 column 3, owl is up, press to pop');
    expect(holeLabel(8, 'hedgehog')).toBe('Hole 9, row 3 column 3, hedgehog is up, press to pop');
  });
  it('praises specifically: how many, and which kind most', () => {
    const base = { ...newGame('middle', false), status: 'done' as const };
    expect(resultMessage({ ...base, score: 0 })).toBe('Round over. No pops this time, so try again!');
    expect(resultMessage({ ...base, score: 1, byKind: { bunny: 0, owl: 1, hedgehog: 0, fox: 0 } })).toBe('Round over! You popped 1 critter. Most popped: owls (1).');
    expect(resultMessage({ ...base, score: 9, byKind: { bunny: 4, owl: 3, hedgehog: 0, fox: 2 } })).toBe('Round over! You popped 9 critters. Most popped: bunnies (4).');
    expect(resultMessage({ ...base, score: 2, byKind: { bunny: 0, owl: 0, hedgehog: 0, fox: 2 } })).toContain('foxes');
    expect(resultMessage(newGame('middle', false))).toBe('');
    expect(favourite({ bunny: 0, owl: 0, hedgehog: 0, fox: 0 })).toBeNull();
    expect(favourite({ bunny: 2, owl: 2, hedgehog: 1, fox: 0 })).toEqual({ kind: 'bunny', n: 2 });
  });
  it('builds a share line that is correct before, during and after a round and never says NaN', () => {
    expect(shareText('middle', null, 0)).toBe('Critter Pop (Middle): no round finished yet');
    expect(shareText('little', { score: 0 }, 0)).toBe('Critter Pop (Little ones): popped 0 critters in 30 seconds');
    expect(shareText('big', { score: 1 }, 1)).toBe('Critter Pop (Big): popped 1 critter in 30 seconds, best 1');
    expect(shareText('big', { score: 14 }, 20)).toBe('Critter Pop (Big): popped 14 critters in 30 seconds, best 20');
    for (const t of [shareText('middle', null, 0), shareText('big', { score: 3 }, 3), resultMessage({ ...newGame('big', true), status: 'done', score: 3 })]) {
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    }
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('holes are real buttons with a 56 px floor, and the Little ones board is bigger', () => {
    const hole = src.match(/#cp-app \.cp-hole \{([^}]*)\}/);
    expect(hole).not.toBeNull();
    expect(hole![1]).toContain('min-width: 3.5rem');
    expect(hole![1]).toContain('min-height: 3.5rem');
    expect(src).toContain('<button type="button" class="cp-hole"');
    expect(src).toMatch(/\.cp-stage\[data-level="little"\] \{ max-width: 36rem/);
    expect(src).toMatch(/\.cp-stage \{[^}]*max-width: 26rem/);
  });
  it('the veil is hidden by the hidden attribute even though it is a grid', () => {
    expect(src).toContain('.cp-veil[hidden]');
  });
  it('the board is inert unless a round is running, and pointer and keyboard use one path each', () => {
    expect(src).toContain("board.toggleAttribute('inert', show)");
    expect(src).toContain("if (e.detail !== 0) return;");
    expect(src).toContain("addEventListener('pointerdown'");
    expect(src).toContain('if (!e.repeat) doPop(h);');
    expect(src).toContain('if (e.repeat) return;');
  });
  it('the result stays up for 0.7 s so fast tapping cannot skip it', () => {
    expect(src).toContain('performance.now() - overAt >= 700');
  });
  it('honours reduced motion and pauses on a hidden tab, Escape and P', () => {
    expect(src).toContain('@media (prefers-reduced-motion: reduce)');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
  });
  it('the how-it-works heading is a 32 px tap target with the native marker', () => {
    const rule = src.match(/\.cp-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
});

describe('review fixes in the page', () => {
  const src = calculatorSource;
  it('counts every touch pointer, not only the primary one, and the buttons act only on keyboard clicks', () => {
    expect(src).not.toContain('isPrimary');
    expect(src).toContain("if (e.detail !== 0) return;");
  });
  it('puts focus on the resume veil when a hidden tab comes back while paused', () => {
    expect(src).toContain("else if (!document.hidden && phase === 'paused') veil.focus");
  });
});
