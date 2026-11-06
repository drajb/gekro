/**
 * games-wing-hop.test.ts - the engine behind `wing-hop`.
 *
 * Pinned: the integrator is a fixed 1/60 s step (flap sets the upward speed, gravity pulls, fall speed is
 * capped) and a seed replays a run exactly; the ceiling stops the dragonfly without harm and the pond
 * ends a run (not in Calm); the generator keeps every gap centre inside the playable range and within
 * maxShift of the last one, and maxShift plus the room inside a gap is within 1/1.5 of what the
 * physics can climb or fall in the time between columns, at every level and at the slower reduced-motion
 * pace; a simulated bot that only knows where the next gap is plays 120 gaps on 25 seeds at every level
 * without touching a thing; circle-versus-rectangle collisions match a brute-force sampled check; a
 * score counts exactly once per column; the fixed-step clock plays the same run on any screen; and the
 * best-score storage rejects junk.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, begin, step, paramsFor, climbReach, fallReach, freeTime, slackOf, centreRange, nextCentre, circleHitsRect, hitEdges, gapEdges,
  isFlapKey, keyScope, spaceIsNative, advanceClock, bestKey, parseBests, recordBest, endMessage, shareText, milestone, plural, isLevel, mulberry32,
  W, H, FLOOR_Y, PX, R, HW, MARGIN, START_Y, DT, GRACE_STEPS, SLOW_SCROLL, REACH_MARGIN, MAX_SCORE, LEVELS, PARAMS, LEVEL_LABEL, FIRST_X,
  ROCK_SLACK, REED_SLACK,
  type GameState, type Level,
} from '../src/components/apps-private/wing-hop/helpers';
import calculatorSource from '../src/components/apps-private/wing-hop/Calculator.astro?raw';

const run = (s: GameState, rng: () => number, flaps: (s: GameState) => boolean, maxSteps: number, until?: (s: GameState) => boolean): GameState => {
  let cur = begin(s);
  for (let i = 0; i < maxSteps && cur.status === 'running'; i++) {
    if (until?.(cur)) break;
    cur = step(cur, flaps(cur), rng);
  }
  return cur;
};

/**
 * A simple pilot that knows only where the middle of the next gap is: flap when below it and not already
 * rising fast. It does not know the generator's rules.
 */
const pilot = (s: GameState): boolean => {
  const c = s.columns.find((col) => col.wx - s.dist + HW + R > PX);
  const target = c ? c.gapY : START_Y;
  return s.y > target + 8 && s.vy > -60;
};

describe('the world and the levels', () => {
  it('is a 400 x 300 world with the pond at 270 and a fixed 1/60 s step', () => {
    expect([W, H, FLOOR_Y, PX, R, HW]).toEqual([400, 300, 270, 100, 9, 22]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect(LEVELS).toEqual(['calm', 'easy', 'medium', 'hard']);
    expect(LEVEL_LABEL.calm).toContain('little ones');
  });
  it('gets harder level by level: faster, stronger gravity, narrower gaps, closer columns', () => {
    const order: Level[] = ['calm', 'easy', 'medium', 'hard'];
    for (let i = 1; i < order.length; i++) {
      const a = PARAMS[order[i - 1]];
      const b = PARAMS[order[i]];
      expect(b.v).toBeGreaterThan(a.v);
      expect(b.g).toBeGreaterThan(a.g);
      expect(b.gapH).toBeLessThan(a.gapH);
      expect(b.spacing).toBeLessThan(a.spacing);
    }
    expect(PARAMS.calm.forgiving).toBe(true);
    for (const l of ['easy', 'medium', 'hard'] as Level[]) expect(PARAMS[l].forgiving).toBe(false);
  });
  it('Easy has wide gaps and gentle gravity', () => {
    expect(PARAMS.easy.gapH).toBeGreaterThanOrEqual(120);
    expect(PARAMS.easy.g).toBeLessThan(PARAMS.medium.g);
  });
  it('reduced motion scrolls 20 percent slower and changes nothing else', () => {
    expect(SLOW_SCROLL).toBe(0.8);
    for (const l of LEVELS) {
      const a = paramsFor(l, false);
      const b = paramsFor(l, true);
      expect(b.v).toBeCloseTo(a.v * 0.8, 9);
      expect({ ...b, v: 0 }).toEqual({ ...a, v: 0 });
    }
    expect(paramsFor('nope' as Level, false)).toEqual(PARAMS.medium);
    expect(isLevel('hard')).toBe(true);
    for (const bad of ['', 'HARD', null, undefined, 7]) expect(isLevel(bad as unknown)).toBe(false);
  });
});

describe('the integrator', () => {
  const rng = () => 0.5;
  const fresh = (level: Level = 'medium') => begin(newGame(level, false, mulberry32(1)));
  it('does nothing until the run begins', () => {
    const s = newGame('medium', false, mulberry32(1));
    expect(s.status).toBe('ready');
    expect(step(s, true, rng)).toBe(s);
    expect(begin(s).status).toBe('running');
  });
  it('a flap sets the upward speed (it does not add up), then gravity pulls', () => {
    const p = PARAMS.medium;
    let s = fresh();
    s = step(s, true, rng);
    expect(s.vy).toBeCloseTo(-p.flap + p.g * DT, 9);
    let again = step(s, true, rng);
    expect(again.vy).toBeCloseTo(-p.flap + p.g * DT, 9); // same speed, not twice as fast
    again = step(s, false, rng);
    expect(again.vy).toBeCloseTo(s.vy + p.g * DT, 9);
  });
  it('free fall matches the closed form for semi-implicit Euler, and the fall speed is capped', () => {
    const p = PARAMS.hard;
    let s = fresh('hard');
    const n = 10;
    for (let i = 0; i < n; i++) s = step(s, false, rng);
    // v_n = n g dt ; y_n = y0 + g dt^2 * n(n+1)/2
    expect(s.vy).toBeCloseTo(n * p.g * DT, 9);
    expect(s.y).toBeCloseTo(START_Y + p.g * DT * DT * ((n * (n + 1)) / 2), 9);
    let fall = fresh('hard');
    fall = { ...fall, y: 50, vy: 0 };
    for (let i = 0; i < 60 && fall.status === 'running'; i++) {
      fall = step(fall, false, rng);
      expect(fall.vy).toBeLessThanOrEqual(p.vmax + 1e-9);
    }
  });
  it('one flap lifts the dragonfly by about flap^2 / (2 g) before it turns around', () => {
    const p = PARAMS.medium;
    let s = fresh();
    const y0 = s.y;
    let top = y0;
    s = step(s, true, rng);
    top = Math.min(top, s.y);
    for (let i = 0; i < 60; i++) { s = step(s, false, rng); top = Math.min(top, s.y); }
    expect(y0 - top).toBeGreaterThan((p.flap * p.flap) / (2 * p.g) - 3);
    expect(y0 - top).toBeLessThan((p.flap * p.flap) / (2 * p.g) + 3);
  });
  it('the world scrolls at exactly v units a second and the dragonfly keeps its x', () => {
    let s = fresh('easy');
    for (let i = 0; i < 60; i++) s = step({ ...s, y: 100, vy: 0 }, false, rng);
    expect(s.dist).toBeCloseTo(PARAMS.easy.v, 6);
    expect(s.steps).toBe(60);
  });
  it('the ceiling stops the dragonfly without harm', () => {
    let s = fresh();
    for (let i = 0; i < 200 && s.status === 'running'; i++) {
      s = step({ ...s, columns: s.columns.map((c) => ({ ...c, gapY: 100 })) }, true, rng);
      expect(s.y).toBeGreaterThanOrEqual(R - 1e-9);
    }
    expect(s.cause).not.toBe('pond');
  });
  it('the pond ends a run at every level except Calm, where it bounces gently', () => {
    for (const l of ['easy', 'medium', 'hard'] as Level[]) {
      const s = run(newGame(l, false, mulberry32(3)), mulberry32(3), () => false, 600);
      expect(s.status, l).toBe('over');
      expect(s.cause).toBe('pond');
      expect(s.score).toBe(0);
    }
    const calm = run(newGame('calm', false, mulberry32(3)), mulberry32(3), () => false, 600);
    expect(calm.status).toBe('running');
    expect(calm.y).toBeLessThanOrEqual(FLOOR_Y - R + 1e-9);
  });
  it('a finished run does not move', () => {
    const over = run(newGame('medium', false, mulberry32(3)), mulberry32(3), () => false, 600);
    expect(over.status).toBe('over');
    expect(step(over, true, rng)).toBe(over);
  });
  it('does not change the state it was given', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    step(s, true, mulberry32(9));
    step(s, false, mulberry32(9));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('is deterministic: the same seed and the same flaps replay the same run, a different seed does not', () => {
    const play = (seed: number) => {
      const rng2 = mulberry32(seed);
      let s = begin(newGame('medium', false, rng2));
      const trace: string[] = [];
      for (let i = 0; i < 1500 && s.status === 'running'; i++) {
        s = step(s, pilot(s), rng2);
        trace.push(`${s.y.toFixed(6)}|${s.score}|${s.columns[0]?.gapY.toFixed(3)}`);
      }
      return trace;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(77)).not.toEqual(play(78));
  });
});

describe('the gap generator', () => {
  it('keeps every centre in range and within maxShift of the one before, at every level and pace', () => {
    for (const l of LEVELS) {
      for (const slow of [false, true]) {
        const p = paramsFor(l, slow);
        const { lo, hi } = centreRange(p.gapH);
        const rng = mulberry32(l.length * 17 + (slow ? 1 : 0));
        let s = newGame(l, slow, rng);
        let prev = START_Y;
        const seen: number[] = [];
        s = run(s, rng, pilot, 60 * 1200, (c) => {
          for (const col of c.columns) if (!seen.includes(col.wx)) {
            seen.push(col.wx);
            if (col.gapY < lo - 1e-9 || col.gapY > hi + 1e-9) throw new Error(`${l}: centre ${col.gapY} out of [${lo}, ${hi}]`);
            if (Math.abs(col.gapY - prev) > p.maxShift + 1e-9) throw new Error(`${l}: shift ${Math.abs(col.gapY - prev)} over ${p.maxShift}`);
            prev = col.gapY;
          }
          return seen.length >= 150;
        });
        expect(seen.length, l).toBeGreaterThanOrEqual(150);
        expect(s.status).toBe('running');
      }
    }
  });
  it('columns are spaced exactly `spacing` apart, the first at 300, and fill the window ahead', () => {
    for (const l of LEVELS) {
      const s = newGame(l, false, mulberry32(4));
      expect(s.columns[0].wx).toBe(FIRST_X);
      for (let i = 1; i < s.columns.length; i++) expect(s.columns[i].wx - s.columns[i - 1].wx).toBe(PARAMS[l].spacing);
      expect(s.columns[s.columns.length - 1].wx).toBeGreaterThan(W + 100);
    }
  });
  it('the gap keeps clear of the ceiling and the pond by the margin', () => {
    for (const l of LEVELS) {
      const { lo, hi } = centreRange(PARAMS[l].gapH);
      const e1 = gapEdges(lo, PARAMS[l].gapH);
      const e2 = gapEdges(hi, PARAMS[l].gapH);
      expect(e1.top).toBe(MARGIN);
      expect(e2.bottom).toBe(FLOOR_Y - MARGIN);
    }
  });
  it('nextCentre clamps, even with a bad rng', () => {
    const p = PARAMS.medium;
    const { lo, hi } = centreRange(p.gapH);
    expect(nextCentre(lo, p, () => 0)).toBe(lo);
    expect(nextCentre(hi, p, () => 0.999999)).toBe(hi);
    expect(nextCentre(150, p, () => 1)).toBeLessThanOrEqual(150 + p.maxShift);
    expect(nextCentre(150, p, () => 0.5)).toBe(150);
  });
});

describe('every gap can be reached with the jump physics', () => {
  it('maxShift plus the room inside a gap fits in the climb and the fall between columns, with a 1.5 margin', () => {
    expect(REACH_MARGIN).toBe(1.5);
    for (const l of LEVELS) {
      for (const slow of [false, true]) {
        const p = paramsFor(l, slow);
        const t = freeTime(p);
        expect(t).toBeGreaterThan(0.9);
        const worst = p.maxShift + slackOf(p.gapH);
        expect(worst * REACH_MARGIN, `${l} climb`).toBeLessThanOrEqual(climbReach(p, t));
        expect(worst * REACH_MARGIN, `${l} fall`).toBeLessThanOrEqual(fallReach(p, t));
      }
    }
  });
  it('a gap is always big enough for the dragonfly with room to spare', () => {
    for (const l of LEVELS) expect(slackOf(PARAMS[l].gapH)).toBeGreaterThanOrEqual(2 * R + 40);
  });
  it('the reach functions agree with the integrator', () => {
    const p = PARAMS.medium;
    expect(fallReach(p, 0.5)).toBeGreaterThan(0.5 * p.g * 0.25 * 0.9);
    expect(climbReach(p, 1)).toBeGreaterThan(p.flap * 0.5);
  });
  for (const level of LEVELS) {
    for (const slow of [false, true]) {
      it(`the pilot flies 120 gaps on 25 seeds without a single bump: ${level}${slow ? ' (reduced-motion pace)' : ''}`, () => {
        for (let seed = 1; seed <= 25; seed++) {
          const rng = mulberry32(seed * 1013 + level.length);
          const s = run(newGame(level, slow, rng), rng, pilot, 60 * 600, (c) => c.score >= 120);
          expect(s.status, `${level} seed ${seed}: ${s.cause} after ${s.score}`).toBe('running');
          expect(s.score).toBeGreaterThanOrEqual(120);
          expect(s.bumps).toBe(0);
        }
      }, 60_000);
    }
  }
  it('a pilot that ignores the gaps does not get far', () => {
    for (const l of ['easy', 'medium', 'hard'] as Level[]) {
      const rng = mulberry32(5);
      const s = run(newGame(l, false, rng), rng, (c) => c.y > 135 && c.vy > -60, 60 * 120);
      expect(s.score, l).toBeLessThan(25);
    }
  });
});

describe('collisions', () => {
  it('circleHitsRect matches a brute-force sampled check on 4000 random cases', () => {
    const rng = mulberry32(2026);
    let hits = 0;
    for (let n = 0; n < 4000; n++) {
      const x0 = rng() * 100;
      const y0 = rng() * 100;
      const x1 = x0 + 5 + rng() * 60;
      const y1 = y0 + 5 + rng() * 60;
      const cx = rng() * 200 - 20;
      const cy = rng() * 200 - 20;
      const r = 3 + rng() * 15;
      // brute force: the circle and the rectangle share a point, found by sampling the rectangle finely
      let brute = false;
      const steps = 40;
      for (let i = 0; i <= steps && !brute; i++) {
        for (let j = 0; j <= steps; j++) {
          const px = x0 + ((x1 - x0) * i) / steps;
          const py = y0 + ((y1 - y0) * j) / steps;
          if ((px - cx) ** 2 + (py - cy) ** 2 < r * r) { brute = true; break; }
        }
      }
      const fast = circleHitsRect(cx, cy, r, x0, y0, x1, y1);
      if (fast) hits++;
      // The sampled check can only miss a hit that grazes between samples (never invent one).
      if (brute) expect(fast).toBe(true);
      if (fast && !brute) {
        const gap = Math.min(Math.hypot(x1 - x0, y1 - y0) / steps, 3);
        const nx = Math.min(Math.max(cx, x0), x1);
        const ny = Math.min(Math.max(cy, y0), y1);
        expect(Math.hypot(cx - nx, cy - ny)).toBeGreaterThan(r - gap * 1.5);
      }
    }
    expect(hits).toBeGreaterThan(200);
    expect(hits).toBeLessThan(3500);
  });
  it('touching exactly is not a hit, a centre inside the rectangle is', () => {
    expect(circleHitsRect(0, 0, 5, 5, -10, 20, 10)).toBe(false);
    expect(circleHitsRect(0, 0, 5.01, 5, -10, 20, 10)).toBe(true);
    expect(circleHitsRect(10, 10, 1, 0, 0, 20, 20)).toBe(true);
  });
  it('the dragonfly in the middle of a gap is safe, one that overlaps the rock or the reeds is not', () => {
    const p = PARAMS.medium;
    const gapY = 150;
    const e = hitEdges(gapY, p.gapH);
    const mk = (y: number): GameState => {
      const s0 = begin(newGame('medium', false, mulberry32(1)));
      return { ...s0, y, vy: 0, dist: FIRST_X - PX, columns: [{ wx: FIRST_X, gapY, variant: 0, scored: false }, ...s0.columns.slice(1)] };
    };
    expect(step(mk(gapY), false, mulberry32(1)).status).toBe('running');
    expect(step(mk(e.rockBottom + R + 2), false, mulberry32(1)).status).toBe('running');
    expect(step(mk(e.rockBottom + R - 3), false, mulberry32(1)).status).toBe('over');
    expect(step(mk(e.reedTop - R - 3), false, mulberry32(1)).status).toBe('running');
    const hitReeds = step(mk(e.reedTop - R + 3), false, mulberry32(1));
    expect(hitReeds.status).toBe('over');
    expect(hitReeds.cause).toBe('column');
  });
  it('the art is never closer to the gap than what the dragonfly can touch', () => {
    const e = gapEdges(150, 106);
    const h = hitEdges(150, 106);
    expect(h.rockBottom).toBe(e.top - ROCK_SLACK);
    expect(h.reedTop).toBe(e.bottom + REED_SLACK);
  });
  it('in Calm a bump sets you back in the gap and gives 1.5 seconds of safety', () => {
    const rng = mulberry32(1);
    const s0 = begin(newGame('calm', false, rng));
    const p = PARAMS.calm;
    const gapY = 120;
    const s1: GameState = { ...s0, y: 200, vy: 0, dist: FIRST_X - PX, columns: [{ wx: FIRST_X, gapY, variant: 0, scored: false }, ...s0.columns.slice(1)] };
    const s2 = step(s1, false, rng);
    expect(s2.status).toBe('running');
    expect(s2.bumps).toBe(1);
    expect(s2.grace).toBe(GRACE_STEPS);
    expect(s2.y).toBe(gapY);
    expect(s2.vy).toBe(0);
    // during the safety time nothing else counts as a bump
    let s = s2;
    for (let i = 0; i < GRACE_STEPS - 1; i++) s = step({ ...s, y: 220 }, false, rng);
    expect(s.bumps).toBe(1);
    expect(p.forgiving).toBe(true);
  });
});

describe('scoring', () => {
  it('counts each column exactly once, as its right edge clears the dragonfly', () => {
    const rng = mulberry32(12);
    let s = begin(newGame('easy', false, rng));
    let last = 0;
    let passes = 0;
    for (let i = 0; i < 60 * 80 && s.status === 'running'; i++) {
      s = step(s, pilot(s), rng);
      if (s.score !== last) {
        expect(s.score).toBe(last + 1);
        last = s.score;
        passes++;
        // the column just scored is the one whose right edge has just gone behind the dragonfly
        const col = s.columns.filter((c) => c.scored).pop();
        void col;
      }
    }
    expect(passes).toBe(s.score);
    expect(s.score).toBeGreaterThan(15);
    // every column still on the list that has fully passed is marked scored, none ahead is
    for (const c of s.columns) expect(c.scored).toBe(c.wx - s.dist + HW < PX - R);
  });
  it('the first gap is passed after (300 - 100 + 22 + 9) / v seconds', () => {
    const rng = mulberry32(12);
    let s = begin(newGame('easy', false, rng));
    let n = 0;
    while (s.score === 0 && n < 5000) { s = step({ ...s, y: s.columns[0].gapY, vy: 0 }, false, rng); n++; }
    const expected = (FIRST_X - PX + HW + R) / PARAMS.easy.v;
    expect(Math.abs(n * DT - expected)).toBeLessThan(0.05);
  });
});

describe('input, keys and the clock', () => {
  it('Space, Up and W flap; nothing else does', () => {
    for (const k of [' ', 'ArrowUp', 'w', 'W']) expect(isFlapKey(k), k).toBe(true);
    for (const k of ['Enter', 'ArrowDown', 's', 'p', 'Escape', 'x', '']) expect(isFlapKey(k), k).toBe(false);
  });
  it('key capture scope: game keys only in the game or while running, pause keys always', () => {
    for (const p of ['ready', 'running', 'paused', 'over'] as const) expect(keyScope(p, true)).toBe('all');
    expect(keyScope('running', false)).toBe('all');
    expect(keyScope('paused', false)).toBe('resume');
    expect(keyScope('ready', false)).toBe('none');
    expect(keyScope('over', false)).toBe('none');
    expect(spaceIsNative('BUTTON')).toBe(true);
    expect(spaceIsNative('CANVAS')).toBe(false);
  });
  const stepsOver = (hz: number, seconds: number): number => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < hz * seconds; i++) {
      const r = advanceClock(acc, 1000 / hz);
      acc = r.acc;
      total += r.steps;
    }
    return total;
  };
  it('takes 60 physics steps a second on 30, 60, 75, 144 and 240 Hz screens', () => {
    for (const hz of [30, 60, 75, 144, 240]) expect(Math.abs(stepsOver(hz, 10) - 600), `${hz} Hz`).toBeLessThanOrEqual(2);
  });
  it('a long stall cannot fast-forward the run', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(r.acc).toBeLessThan(1000 / 60);
  });
  it('survives bad numbers', () => {
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
  });
  it('the same flaps give the same flight on a 60 Hz and a 144 Hz clock', () => {
    const fly = (hz: number) => {
      const rng = mulberry32(31);
      let s = begin(newGame('medium', false, rng));
      let acc = 0;
      const frames = hz * 5;
      for (let f = 0; f < frames && s.status === 'running'; f++) {
        const r = advanceClock(acc, 1000 / hz);
        acc = r.acc;
        for (let i = 0; i < r.steps && s.status === 'running'; i++) s = step(s, pilot(s), rng);
      }
      return s;
    };
    const a = fly(60);
    const b = fly(144);
    expect(Math.abs(a.steps - b.steps)).toBeLessThanOrEqual(2);
    expect(a.score).toBe(b.score);
  });
});

describe('best scores', () => {
  it('has one key per level and pace', () => {
    const keys = LEVELS.flatMap((l) => [bestKey(l, false), bestKey(l, true)]);
    expect(new Set(keys).size).toBe(8);
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ medium: 12, hard: '9', easy: 1.5, 'calm-slow': -3, nope: 4, 'easy-slow': 99999 })).toEqual({ medium: 12 });
    expect(parseBests(JSON.parse('{"__proto__":{"hard":50},"hard":7}'))).toEqual({ hard: 7 });
  });
  it('only a whole, positive, possible score can set a best, and only if higher', () => {
    const k = bestKey('medium', false);
    let r = recordBest({}, k, 7);
    expect(r).toEqual({ bests: { [k]: 7 }, improved: true });
    expect(recordBest(r.bests, k, 7).improved).toBe(false);
    expect(recordBest(r.bests, k, 3).improved).toBe(false);
    r = recordBest(r.bests, k, 8);
    expect(r.bests[k]).toBe(8);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
  });
});

describe('messages', () => {
  const over = (score: number, cause: 'pond' | 'column') => ({ ...newGame('medium', false, mulberry32(1)), status: 'over' as const, score, cause });
  it('say what happened and praise what the player did', () => {
    expect(endMessage(over(7, 'column'))).toBe('The dragonfly bumped into a reed or a rock. You flew through 7 gaps.');
    expect(endMessage(over(1, 'pond'))).toBe('The dragonfly dipped into the pond. You flew through 1 gap.');
    expect(endMessage(over(0, 'pond'))).toBe('The dragonfly dipped into the pond. No gaps this time, so try again!');
    expect(endMessage(newGame('medium', false, mulberry32(1)))).toBe('');
  });
  it('builds a share line that is right before, during and after a run', () => {
    expect(shareText('medium', null, 0)).toBe('Wing Hop (Medium): no run finished yet');
    expect(shareText('calm', { score: 0 }, 0)).toBe('Wing Hop (Calm): flew through 0 gaps');
    expect(shareText('hard', { score: 1 }, 1)).toBe('Wing Hop (Hard): flew through 1 gap, best 1');
    expect(shareText('easy', { score: 12 }, 20)).toBe('Wing Hop (Easy): flew through 12 gaps, best 20');
    for (const t of [shareText('easy', { score: 3 }, 3), endMessage(over(3, 'pond'))]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
  });
  it('marks a milestone every ten gaps', () => {
    expect([0, 1, 9, 10, 11, 20, 100].map(milestone)).toEqual([false, false, false, true, false, true, true]);
    expect(milestone(NaN)).toBe(false);
    expect(plural(1, 'gap', 'gaps')).toBe('1 gap');
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('the flap button is at least 56 px tall and the how-it-works heading is a 32 px target', () => {
    const flap = src.match(/#wh-app \.wh-flap \{([^}]*)\}/);
    expect(flap).not.toBeNull();
    expect(flap![1]).toContain('min-height: 3.5rem');
    const rule = src.match(/\.wh-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
  it('flaps once per press: pointer path, keyboard path, no key repeat', () => {
    expect(src).toContain("if (e.repeat) return;");
    expect(src).toContain('if (e.detail !== 0) return;');
    expect(src).toContain("addEventListener('pointerdown'");
  });
  it('pauses on Escape, P and a hidden tab, and honours reduced motion', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('const reduced = mq.matches;'); // the drawing stops hills, ripples and wing flutter
  });
  it('a run that is left (Restart, a level change, leaving the page) still counts toward the best', () => {
    expect(src).toContain('const settle = () =>');
    expect(src).toContain('settle();');
  });
  it('starts on the first input, never on load', () => {
    expect(src).toContain('begin(st)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
  });
});

describe('review fixes in the page', () => {
  const src = calculatorSource;
  it('Copy Result shares the score so far while a run is on', () => {
    expect(src).toContain("(phase === 'running' || phase === 'paused') && st.score > 0 ? { level: st.level, score: st.score } : lastRun");
  });
});
