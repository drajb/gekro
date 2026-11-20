/**
 * games-cave-flyer.test.ts - the engine behind `cave-flyer`.
 *
 * Pinned: a fixed 1/60 s step; holding pushes the plane up at 520 units/s^2 and letting go pulls it down at 640,
 * with speed capped at 300 (checked against the closed form); the cave is a smoothstep blend of control points
 * every 240 units, a seed always builds the same cave, every wall stays at least 10 units inside the window,
 * the middle never moves more than the level's step between points and the opening never changes by more than
 * its step; measured steepest slope and sharpest curve of the real cave never exceed the formula the
 * generator relies on; at the top speed of every level (and at the slower reduced-motion pace) the curve asks for
 * no more than half of the plane's weaker push; the wall test agrees with a brute-force check around the plane's
 * outline; a simple pilot that only knows where the middle of the cave is flies 120 s on 30 seeds at every level
 * without touching a wall, while never holding, always holding and hovering at one height all crash; the speed
 * ramps from the start speed to the top speed over 6000 units; the clock plays the same flight on any screen;
 * best scores reject junk; and the page keeps what it promises.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, begin, step, buildTunnel, nextPoint, openingPoints, caveAt, ceilingAt, floorAt, smoothstep, hitsWall, demand, authority, speedAt, paramsFor, clamp,
  isHoldKey, keyScope, spaceIsNative, advanceClock, bestKey, parseBests, recordBest, describeState, endMessage, shareText, plural, milestone, isLevel, mulberry32,
  W, H, DT, PX, R, FALL_ACC, LIFT_ACC, MAX_V, SPAN, MARGIN, START_Y, SLOPE_FACTOR, CURVE_FACTOR, THRUST_SHARE, METRE, RAMP_DIST, SLOW_SCROLL, PARAMS, LEVELS, MAX_SCORE,
  HIT_OFFSETS, SFX, PEAK_GAIN,
  type GameState, type Level, type Point,
} from '../src/components/apps-private/cave-flyer/helpers';
import calculatorSource from '../src/components/apps-private/cave-flyer/Calculator.astro?raw';

const rng0 = () => 0.5;

/** A pilot that knows only where the middle of the cave is a little way ahead. */
const pilot = (s: GameState): boolean => {
  const v = speedAt(s.level, s.slow, s.dist);
  const target = caveAt(s.pts, s.dist + PX + v * 0.25).c;
  return s.y - target + 0.3 * s.vy > 0;
};

describe('the world and the levels', () => {
  it('is a 400 x 300 window with a fixed 1/60 s step', () => {
    expect([W, H, PX, R, SPAN, MARGIN, START_Y]).toEqual([400, 300, 100, 7, 240, 10, 150]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect([FALL_ACC, LIFT_ACC, MAX_V, METRE, RAMP_DIST, SLOW_SCROLL]).toEqual([640, 520, 300, 10, 6000, 0.8]);
    expect([SLOPE_FACTOR, CURVE_FACTOR, THRUST_SHARE]).toEqual([1.5, 6, 0.5]);
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
    expect(isLevel('hard')).toBe(true);
    for (const bad of ['', 'HARD', null, undefined, 4]) expect(isLevel(bad as unknown)).toBe(false);
    expect(paramsFor('nope' as Level)).toEqual(PARAMS.medium);
  });
  it('gets harder level by level: faster, narrower, bigger steps', () => {
    const order: Level[] = ['easy', 'medium', 'hard'];
    for (let i = 1; i < order.length; i++) {
      const a = PARAMS[order[i - 1]];
      const b = PARAMS[order[i]];
      expect(b.v0).toBeGreaterThan(a.v0);
      expect(b.vMax).toBeGreaterThan(a.vMax);
      expect(b.hMax).toBeLessThan(a.hMax);
      expect(b.hMin).toBeLessThan(a.hMin);
      expect(b.step).toBeGreaterThan(a.step);
    }
    for (const l of LEVELS) {
      expect(PARAMS[l].hMin).toBeGreaterThan(R + 20);
      expect(PARAMS[l].step).toBeGreaterThanOrEqual(PARAMS[l].hMax - PARAMS[l].hMin);
    }
  });
  it('the speed ramps from the start speed to the top speed over 6000 units, 20 percent slower with reduced motion', () => {
    for (const l of LEVELS) {
      const p = PARAMS[l];
      expect(speedAt(l, false, 0)).toBe(p.v0);
      expect(speedAt(l, false, RAMP_DIST / 2)).toBeCloseTo((p.v0 + p.vMax) / 2, 9);
      expect(speedAt(l, false, RAMP_DIST)).toBe(p.vMax);
      expect(speedAt(l, false, 1e9)).toBe(p.vMax);
      expect(speedAt(l, false, -5)).toBe(p.v0);
      expect(speedAt(l, true, RAMP_DIST)).toBeCloseTo(p.vMax * 0.8, 9);
    }
  });
});

describe('the cave', () => {
  it('a seed always builds the same cave and a different seed builds a different one', () => {
    for (const l of LEVELS) {
      expect(buildTunnel(l, 12, 60)).toEqual(buildTunnel(l, 12, 60));
      expect(buildTunnel(l, 12, 60)).not.toEqual(buildTunnel(l, 13, 60));
    }
  });
  it('points are 240 units apart, the opening is wide and level, and every wall stays 10 units inside the window', () => {
    for (const l of LEVELS) for (let seed = 1; seed <= 20; seed++) {
      const pts = buildTunnel(l, seed, 400);
      expect(pts.length).toBe(400);
      const bad = pts.filter((p, i) => p.x !== i * SPAN || p.c - p.h < MARGIN - 1e-9 || p.c + p.h > H - MARGIN + 1e-9);
      expect(bad, `${l} ${seed}`).toEqual([]);
      expect(pts[0].c).toBe(START_Y);
      expect(pts[1].c).toBe(START_Y);
      expect(pts[0].h).toBeGreaterThan(PARAMS[l].hMax);
      // between the points too: the blend is a convex combination, so it cannot leave the margins
      let topMost = Infinity;
      let bottomMost = -Infinity;
      for (let x = 0; x < 399 * SPAN; x += 7.3) {
        const k = caveAt(pts, x);
        topMost = Math.min(topMost, k.c - k.h);
        bottomMost = Math.max(bottomMost, k.c + k.h);
      }
      expect(topMost).toBeGreaterThanOrEqual(MARGIN - 1e-6);
      expect(bottomMost).toBeLessThanOrEqual(H - MARGIN + 1e-6);
    }
  });
  it('the middle moves at most the level step between points, the opening at most its step, and stays between its limits', () => {
    for (const l of LEVELS) for (let seed = 1; seed <= 20; seed++) {
      const pts = buildTunnel(l, seed * 3, 500);
      const p = PARAMS[l];
      for (let i = 2; i < pts.length; i++) {
        expect(Math.abs(pts[i].c - pts[i - 1].c), `${l} #${i}`).toBeLessThanOrEqual(p.step + 1e-9);
        if (i >= 3) expect(Math.abs(pts[i].h - pts[i - 1].h)).toBeLessThanOrEqual(p.hStep + 1e-9); // the first step leaves the wide opening
        expect(pts[i].h).toBeGreaterThanOrEqual(p.hMin - 1e-9);
        expect(pts[i].h).toBeLessThanOrEqual(p.hMax + 1e-9);
      }
    }
  });
  it('nextPoint uses two random numbers and clamps whatever the rng says', () => {
    const prev: Point = { x: 0, c: 150, h: 60 };
    let calls = 0;
    nextPoint('medium', prev, () => { calls++; return 0.5; });
    expect(calls).toBe(2);
    const hi = nextPoint('medium', { x: 0, c: 200, h: PARAMS.medium.hMax }, () => 0.999999);
    expect(hi.c + hi.h).toBeLessThanOrEqual(H - MARGIN);
    const lo = nextPoint('medium', { x: 0, c: 100, h: PARAMS.medium.hMax }, () => 0);
    expect(lo.c - lo.h).toBeGreaterThanOrEqual(MARGIN);
  });
  it('caveAt is the smoothstep blend of the two points on either side', () => {
    const pts = buildTunnel('medium', 5, 20);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(-3)).toBe(0);
    expect(smoothstep(9)).toBe(1);
    for (const x of [0, 17, 239.9, 240, 241, 500, 1234.5, 3000]) {
      const i = Math.min(pts.length - 2, Math.floor(x / SPAN));
      const t = (x - pts[i].x) / SPAN;
      const w = t * t * (3 - 2 * t);
      const k = caveAt(pts, x);
      expect(k.c).toBeCloseTo(pts[i].c + (pts[i + 1].c - pts[i].c) * w, 9);
      expect(k.h).toBeCloseTo(pts[i].h + (pts[i + 1].h - pts[i].h) * w, 9);
    }
    expect(caveAt(pts, pts[3].x)).toEqual({ c: pts[3].c, h: pts[3].h });
    expect(ceilingAt(pts, 500)).toBeCloseTo(caveAt(pts, 500).c - caveAt(pts, 500).h, 9);
    expect(floorAt(pts, 500)).toBeCloseTo(caveAt(pts, 500).c + caveAt(pts, 500).h, 9);
    // beyond the ends the nearest end is used
    expect(caveAt(pts, -50)).toEqual({ c: pts[0].c, h: pts[0].h });
    expect(caveAt(pts, 1e9)).toEqual({ c: pts[pts.length - 1].c, h: pts[pts.length - 1].h });
    expect(caveAt([], 5).h).toBeGreaterThan(0);
  });
  it('is continuous, and its measured slope and curve never beat the formula the generator relies on', () => {
    for (const l of LEVELS) {
      let maxSlope = 0;
      let maxCurve = 0;
      for (let seed = 1; seed <= 15; seed++) {
        const pts = buildTunnel(l, seed * 17, 300);
        const h = 0.5;
        for (let x = SPAN; x < 298 * SPAN; x += 1.7) {
          const a = caveAt(pts, x - h).c;
          const b = caveAt(pts, x).c;
          const c = caveAt(pts, x + h).c;
          maxSlope = Math.max(maxSlope, Math.abs(c - a) / (2 * h));
          maxCurve = Math.max(maxCurve, Math.abs(a - 2 * b + c) / (h * h));
        }
      }
      const p = PARAMS[l];
      // per unit of distance: slope <= 1.5 step / span, curve <= 6 step / span^2
      expect(maxSlope, l).toBeLessThanOrEqual((SLOPE_FACTOR * p.step) / SPAN + 1e-6);
      expect(maxCurve, l).toBeLessThanOrEqual((CURVE_FACTOR * p.step) / (SPAN * SPAN) + 1e-4);
      expect(maxSlope, l).toBeGreaterThan(0.2 * ((SLOPE_FACTOR * p.step) / SPAN)); // the formula is not wildly loose
    }
  });
  it('at the top speed the curve asks for no more than half of the weaker push, the slope no more than half of the top climb', () => {
    expect(authority()).toBe(520);
    for (const l of LEVELS) for (const slow of [false, true]) {
      const d = demand(l, slow);
      expect(d.accel, `${l} accel`).toBeLessThanOrEqual(THRUST_SHARE * authority() + 1e-9);
      expect(d.slope, `${l} slope`).toBeLessThanOrEqual(THRUST_SHARE * MAX_V + 1e-9);
    }
    // and it is a tight rule for Hard: most of the allowed share is used
    expect(demand('hard', false).accel).toBeGreaterThan(0.8 * THRUST_SHARE * authority());
  });
  it('the opening points are open and level for every level', () => {
    for (const l of LEVELS) {
      const o = openingPoints(l);
      expect(o.length).toBe(2);
      expect(o[0].c).toBe(START_Y);
      expect(o[0].h).toBeLessThanOrEqual(H / 2 - MARGIN);
    }
  });
});

describe('flying: holding rises, letting go falls', () => {
  const fresh = (l: Level = 'medium') => begin(newGame(l, false, mulberry32(1)));
  it('does nothing until the flight begins', () => {
    const s = newGame('medium', false, mulberry32(1));
    expect(s.status).toBe('ready');
    expect(step(s, true, rng0)).toBe(s);
    expect(begin(s).status).toBe('running');
    expect(s.y).toBe(START_Y);
  });
  it('letting go pulls down at 640 and holding pushes up at 520, from the closed form', () => {
    let s = fresh();
    for (let i = 0; i < 10; i++) s = step(s, false, rng0);
    expect(s.vy).toBeCloseTo(10 * FALL_ACC * DT, 9);
    expect(s.y).toBeCloseTo(START_Y + FALL_ACC * DT * DT * ((10 * 11) / 2), 9);
    let u = fresh();
    for (let i = 0; i < 10; i++) u = step(u, true, rng0);
    expect(u.vy).toBeCloseTo(-10 * LIFT_ACC * DT, 9);
    expect(u.y).toBeCloseTo(START_Y - LIFT_ACC * DT * DT * ((10 * 11) / 2), 9);
  });
  it('the vertical speed never goes beyond 300 either way', () => {
    // a cave so wide that nothing is hit while the plane holds up for 3 s and then lets go for 4 s
    const open: Point[] = Array.from({ length: 60 }, (_, i) => ({ x: i * SPAN, c: START_Y, h: 5000 }));
    let s: GameState = { ...fresh(), pts: open };
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < 420; i++) {
      s = step(s, i < 180, rng0);
      lo = Math.min(lo, s.vy);
      hi = Math.max(hi, s.vy);
      expect(Math.abs(s.vy)).toBeLessThanOrEqual(MAX_V);
    }
    expect(s.status).toBe('running');
    expect(lo).toBe(-MAX_V);
    expect(hi).toBe(MAX_V);
  });
  it('the cave scrolls at the speed of the level and the plane keeps its x', () => {
    let s = fresh('easy');
    for (let i = 0; i < 30; i++) s = step({ ...s, y: START_Y, vy: 0 }, false, rng0);
    expect(s.dist).toBeCloseTo(PARAMS.easy.v0 * 0.5, 0);
    expect(s.steps).toBe(30);
  });
  it('the score is metres flown (tens of units), announced at every hundred', () => {
    // 9999 units flown is 999 metres; the next step crosses 10000 units
    let t = { ...fresh('easy'), dist: 9999, score: 999, pts: buildTunnel('easy', 2, 80) };
    t = step({ ...t, y: caveAt(t.pts, 9999 + PX).c, vy: 0 }, false, rng0);
    expect(t.score).toBe(1000);
    expect(t.events).toContain('milestone');
    expect([0, 1, 99, 100, 101, 200].map(milestone)).toEqual([false, false, false, true, false, true]);
    expect(milestone(NaN)).toBe(false);
    expect(METRE).toBe(10);
  });
  it('does not change the state it was given', () => {
    const s = fresh('hard');
    const before = JSON.stringify(s);
    step(s, true, mulberry32(9));
    step(s, false, mulberry32(9));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('is deterministic: the same seed and the same holds replay the same flight, a different seed does not', () => {
    const play = (seed: number) => {
      const rng = mulberry32(seed);
      let s = begin(newGame('medium', false, rng));
      const trace: string[] = [];
      for (let i = 0; i < 1500 && s.status === 'running'; i++) {
        s = step(s, pilot(s), rng);
        trace.push(`${s.y.toFixed(6)}|${s.dist.toFixed(5)}|${s.pts[s.pts.length - 1].c.toFixed(4)}`);
      }
      return trace;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(77)).not.toEqual(play(78));
  });
  it('survives bad time steps', () => {
    for (const dt of [NaN, -1, 0, Infinity, 5]) {
      const t = step(fresh(), true, rng0, dt);
      for (const v of [t.y, t.vy, t.dist]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('the walls', () => {
  it('the wall test agrees with a brute-force walk round the plane outline on 6000 random places', () => {
    const rng = mulberry32(2026);
    let hits = 0;
    let misses = 0;
    const pts = buildTunnel('hard', 8, 200);
    for (let n = 0; n < 6000; n++) {
      const wx = 300 + rng() * 30000;
      const k = caveAt(pts, wx);
      const y = k.c + (rng() * 2 - 1) * (k.h + 14);
      // depth: how far the outline goes past either wall (positive means inside the rock)
      let depth = -Infinity;
      for (let a = 0; a < 720; a++) {
        const ang = (a / 720) * Math.PI * 2;
        const px = wx + Math.cos(ang) * R;
        const py = y + Math.sin(ang) * R;
        const m = caveAt(pts, px);
        depth = Math.max(depth, m.c - m.h - py, py - (m.c + m.h));
      }
      const fast = hitsWall(pts, wx, y);
      if (depth > 0.8) { expect(fast, `n=${n} depth ${depth}`).toBe(true); hits++; }
      if (depth < -0.8) { expect(fast, `n=${n} depth ${depth}`).toBe(false); misses++; }
    }
    expect(hits).toBeGreaterThan(500);
    expect(misses).toBeGreaterThan(500);
    expect(HIT_OFFSETS.length).toBe(5);
  });
  it('the middle of the opening is safe and a plane overlapping either wall is not', () => {
    const pts = buildTunnel('medium', 4, 50);
    const wx = 1000;
    const k = caveAt(pts, wx);
    expect(hitsWall(pts, wx, k.c)).toBe(false);
    expect(hitsWall(pts, wx, k.c - k.h + R + 6)).toBe(false);
    expect(hitsWall(pts, wx, k.c + k.h - R - 6)).toBe(false);
    expect(hitsWall(pts, wx, k.c - k.h + R - 3)).toBe(true);
    expect(hitsWall(pts, wx, k.c + k.h - R + 3)).toBe(true);
  });
  it('touching the roof or the floor ends the flight and says which', () => {
    const base = begin(newGame('medium', false, mulberry32(1)));
    const k = caveAt(base.pts, PX);
    const roof = step({ ...base, y: k.c - k.h + 2, vy: -50 }, true, rng0);
    expect(roof.status).toBe('over');
    expect(roof.cause).toBe('ceiling');
    expect(roof.events).toContain('crash');
    const floor = step({ ...base, y: k.c + k.h - 2, vy: 50 }, false, rng0);
    expect(floor.status).toBe('over');
    expect(floor.cause).toBe('floor');
    expect(step(floor, true, rng0)).toBe(floor);
  });
});

describe('every cave can be flown: pilots', () => {
  for (const level of LEVELS) {
    for (const slow of [false, true]) {
      it(`a pilot that only knows where the middle is flies 120 s on 30 seeds without touching a wall: ${level}${slow ? ' (reduced-motion pace)' : ''}`, () => {
        let farthest = 0;
        for (let seed = 1; seed <= 30; seed++) {
          const rng = mulberry32(seed * 977 + level.length);
          let s = begin(newGame(level, slow, rng));
          for (let i = 0; i < 60 * 120 && s.status === 'running'; i++) s = step(s, pilot(s), rng);
          expect(s.status, `${level} seed ${seed}: ${s.cause} at ${s.score} m`).toBe('running');
          farthest = Math.max(farthest, s.score);
        }
        expect(farthest).toBeGreaterThan(speedAt(level, slow, 0) * 100 / METRE);
      }, 60_000);
    }
  }
  it('never holding, always holding and hovering at one height all crash, on every level and seed', () => {
    for (const level of LEVELS) for (let seed = 1; seed <= 15; seed++) {
      for (const [name, f] of [['never', () => false], ['always', () => true], ['hover', (s: GameState) => s.y > START_Y && s.vy > -40]] as [string, (s: GameState) => boolean][]) {
        const rng = mulberry32(seed + level.length * 100);
        let s = begin(newGame(level, false, rng));
        for (let i = 0; i < 60 * 120 && s.status === 'running'; i++) s = step(s, f(s), rng);
        expect(s.status, `${name} ${level} ${seed}`).toBe('over');
      }
    }
  });
  it('the same flight happens on a 60 Hz and a 144 Hz clock', () => {
    const fly = (hz: number) => {
      const rng = mulberry32(31);
      let s = begin(newGame('medium', false, rng));
      let acc = 0;
      for (let f = 0; f < hz * 10 && s.status === 'running'; f++) {
        const r = advanceClock(acc, 1000 / hz);
        acc = r.acc;
        for (let i = 0; i < r.steps && s.status === 'running'; i++) s = step(s, pilot(s), rng);
      }
      return s;
    };
    const a = fly(60);
    const b = fly(144);
    expect(a.status).toBe('running');
    expect(Math.abs(a.steps - b.steps)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.score - b.score)).toBeLessThanOrEqual(1);
  });
});

describe('random play never breaks an invariant', () => {
  for (const level of LEVELS) {
    it(level, () => {
      const inRng = mulberry32(5 + level.length);
      let steps = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const rng = mulberry32(seed * 31 + level.length);
        let s = begin(newGame(level, seed % 2 === 0, rng));
        let hold = false;
        for (let i = 0; i < 5000 && s.status === 'running'; i++) {
          if (i % 7 === 0) hold = inRng() < 0.55;
          const before = s.score;
          s = step(s, hold || (i < 25 && inRng() < 0.5), rng);
          steps++;
          for (const v of [s.y, s.vy, s.dist]) expect(Number.isFinite(v)).toBe(true);
          expect(Math.abs(s.vy)).toBeLessThanOrEqual(MAX_V);
          expect(s.score).toBeGreaterThanOrEqual(before);
          expect(s.pts.length).toBeLessThan(14);
          expect(s.pts[0].x).toBeLessThanOrEqual(s.dist + PX - R);
          expect(s.pts[s.pts.length - 1].x).toBeGreaterThanOrEqual(s.dist + W);
        }
      }
      expect(steps).toBeGreaterThan(2000);
    }, 60_000);
  }
});

describe('keys and the clock', () => {
  it('Space, Up and W hold the plane up; nothing else does', () => {
    for (const k of [' ', 'ArrowUp', 'w', 'W']) expect(isHoldKey(k), k).toBe(true);
    for (const k of ['Enter', 'ArrowDown', 's', 'p', 'Escape', 'x', '']) expect(isHoldKey(k), k).toBe(false);
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
  it('a long stall cannot fast-forward the flight, and bad numbers are safe', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

describe('best scores', () => {
  it('has one key per level and pace', () => {
    const keys = LEVELS.flatMap((l) => [bestKey(l, false), bestKey(l, true)]);
    expect(new Set(keys).size).toBe(6);
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ medium: 120, hard: '9', easy: 1.5, 'easy-slow': -3, nope: 4, 'hard-slow': MAX_SCORE + 1 })).toEqual({ medium: 120 });
    expect(parseBests(JSON.parse('{"__proto__":{"hard":50},"hard":7}'))).toEqual({ hard: 7 });
  });
  it('only a whole, positive, possible distance can set a best, and only if higher', () => {
    const k = bestKey('medium', false);
    let r = recordBest({}, k, 70);
    expect(r).toEqual({ bests: { [k]: 70 }, improved: true });
    expect(recordBest(r.bests, k, 70).improved).toBe(false);
    expect(recordBest(r.bests, k, 30).improved).toBe(false);
    r = recordBest(r.bests, k, 80);
    expect(r.bests[k]).toBe(80);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
  });
});

describe('messages and sound', () => {
  const over = (score: number, cause: 'ceiling' | 'floor'): GameState => ({ ...newGame('medium', false, mulberry32(1)), status: 'over', score, cause });
  it('say what happened and praise what the player did', () => {
    expect(endMessage(over(120, 'ceiling'))).toBe('The plane touched the roof of the cave. You flew 120 metres.');
    expect(endMessage(over(1, 'floor'))).toBe('The plane touched the floor of the cave. You flew 1 metre.');
    expect(endMessage(over(0, 'floor'))).toBe('The plane touched the floor of the cave right away. Try again!');
    expect(endMessage(newGame('medium', false, mulberry32(1)))).toBe('');
  });
  it('builds a share line that is right before, during and after a flight', () => {
    expect(shareText('medium', null, 0)).toBe('Cave Flyer (Medium): no flight finished yet');
    expect(shareText('easy', { score: 0 }, 0)).toBe('Cave Flyer (Easy): flew 0 metres');
    expect(shareText('hard', { score: 1 }, 1)).toBe('Cave Flyer (Hard): flew 1 metre, best 1');
    expect(shareText('hard', { score: 140 }, 300)).toBe('Cave Flyer (Hard): flew 140 metres, best 300');
    for (const t of [shareText('easy', { score: 3 }, 3), describeState(newGame('hard', false, mulberry32(1)))]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(describeState(newGame('hard', false, mulberry32(1)))).toBe('Cave Flyer. 0 metres flown.');
    expect(plural(1, 'metre', 'metres')).toBe('1 metre');
  });
  it('every sound is short, quiet and within hearing range', () => {
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    for (const [name, def] of Object.entries(SFX)) {
      expect(def.ms, name).toBeLessThanOrEqual(400);
      for (const f of def.freq) { expect(f, name).toBeGreaterThanOrEqual(60); expect(f, name).toBeLessThanOrEqual(2000); }
    }
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('the hold button is at least 56 px tall and the how-it-works heading is a 32 px target', () => {
    const hold = src.match(/#cvf-app \.cvf-hold \{([^}]*)\}/);
    expect(hold).not.toBeNull();
    expect(hold![1]).toContain('min-height: 3.5rem');
    const rule = src.match(/\.cvf-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('box-sizing: border-box');
  });
  it('holds while pressed (pointer, button, keys) and ignores key repeat', () => {
    expect(src).toContain("addEventListener('pointerdown'");
    expect(src).toContain('if (e.repeat) return;');
    expect(src).toContain('if (e.detail !== 0) return;');
    expect(src).toContain('keyHold = false;');
  });
  it('Start arms the flight but the plane does not move until the first hold', () => {
    // the frame loop must not call step() while armed and not holding
    const frame = src.slice(src.indexOf('const frame ='), src.indexOf('const run ='));
    expect(frame).toContain('if (waiting)');
    expect(frame.indexOf('if (waiting)')).toBeLessThan(frame.indexOf('step(st'));
    expect(src).toContain('Hold the button or press Space to take off');
    expect(src).toContain('const arm = ()');
  });
  it('pauses on Escape, P and a hidden tab, and honours reduced motion', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('const farOff = reduced ? 0 : st.dist * 0.25;');
    expect(src).toContain('newGame(level, mq.matches, rng)');
  });
  it('does not trap keys when paused or finished with focus elsewhere', () => {
    expect(src).toContain('keyScope(phase, app.contains(document.activeElement))');
    expect(src).toContain("if (scope !== 'all') return;");
    expect(src).toContain('spaceIsNative(t.tagName)');
  });
  it('sound is off until the button is pressed', () => {
    expect(src).toContain('let soundOn = false;');
    expect(src).toContain('aria-pressed="false"');
    expect(src).not.toMatch(/^\s*(const|let)\s+actx\s*=\s*new/m);
  });
  it('starts on the first input, never on load, and a flight that is left still counts toward the best', () => {
    expect(src).toContain('begin(st)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
    expect(src).toContain('const settle = () =>');
  });
  it('the numbers the how-it-works text states are the engine numbers', () => {
    expect(SPAN).toBe(240);
    expect(src).toContain('every 240 units');
    expect(src).toContain('520 units a second squared');
    expect(src).toContain('pull of 640');
  });
});
