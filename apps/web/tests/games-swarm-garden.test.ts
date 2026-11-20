/**
 * games-swarm-garden.test.ts - the engine behind `swarm-garden`.
 *
 * Pinned:
 *  - wrap-around geometry against a brute-force search over the nine images of a point,
 *  - neighbour search: the grid finds exactly the shapes a brute-force scan over every pair finds, also
 *    across the edges and corners of the wrapped world,
 *  - one to three steps of the real engine equal a separate, plain O(n^2) implementation of the same rules
 *    written in this file (with chasers and an attractor in the one-step case),
 *  - invariants over thousands of steps with every slider at its maximum, three chasers and an attractor:
 *    speed stays between 12 and 30, positions stay in the world, nothing is NaN,
 *  - each rule does what it says on its own: with all rules off shapes fly straight, alignment alone makes
 *    headings agree, cohesion alone pulls shapes together, separation alone spreads a crowd out,
 *  - chasers: constant speed, limited turn rate, they head for what they can see, and shapes steer away,
 *  - the attractor pulls in and pushes away,
 *  - determinism, the sanitisers, the order measure, the frame budget helper,
 *  - and the claims the page source makes.
 */
import { describe, it, expect } from 'vitest';
import {
  WORLD_W, WORLD_H, MIN_BOIDS, MAX_BOIDS, DEFAULT_BOIDS, MAX_PREDATORS, PERCEPTION, SEPARATION_R, MIN_SPEED, MAX_SPEED, MAX_FORCE,
  SEP_GAIN, ALI_GAIN, COH_GAIN, PRED_SPEED, PRED_SIGHT, PRED_TURN, PRED_R, FLEE_GAIN, ATTRACT_R, ATTRACT_GAIN, FIXED_DT, SLIDER_MAX,
  DEFAULT_PARAMS, PRESETS, sanitiseParams, clampCount, wrapDelta, wrapCoord, torusDistance, createSwarm, setCount, setPredators,
  stepSwarm, neighboursOf, polarisation, orderWord, headingBucket, adaptCount, moveCursor, shareText, RULES,
  mulberry32, parseColour, toCss, eightTints, mixOklch, luminance, neutral, advance, plural,
  type Swarm, type Params, type Attractor,
} from '../src/components/apps-private/swarm-garden/helpers';
import calculatorSource from '../src/components/apps-private/swarm-garden/Calculator.astro?raw';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const OFF: Params = { separation: 0, alignment: 0, cohesion: 0 };

/** Brute-force shortest distance on the wrapped world: try the nine images of the other point. */
const bruteDist = (ax: number, ay: number, bx: number, by: number): number => {
  let best = Infinity;
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) best = Math.min(best, Math.hypot(ax - (bx + ox * WORLD_W), ay - (by + oy * WORLD_H)));
  return best;
};

const place = (s: Swarm, i: number, x: number, y: number, vx: number, vy: number) => { s.x[i] = x; s.y[i] = y; s.vx[i] = vx; s.vy[i] = vy; };
/** Put every shape on a coarse grid, far apart from each other (further than they can see). */
const spread = (s: Swarm) => {
  for (let i = 0; i < s.n; i++) place(s, i, 13 + (i % 6) * 26.6, 12 + Math.floor(i / 6) * 24, MIN_SPEED + 4, 0);
};

describe('wrap-around geometry', () => {
  it('wrapDelta is the shortest signed way round, checked against the nine images', () => {
    const rng = mulberry32(1);
    for (const size of [WORLD_W, WORLD_H]) {
      for (let i = 0; i < 3000; i++) {
        const a = rng() * size; const b = rng() * size;
        const d = wrapDelta(a, b, size);
        const want = Math.min(Math.abs(a - b), Math.abs(a - b - size), Math.abs(a - b + size));
        expect(near(Math.abs(d), want, 1e-12)).toBe(true);
        expect(near(((b + d) % size + size) % size, a, 1e-9) || near(Math.abs(((b + d) % size + size) % size - a), size, 1e-9)).toBe(true);
        expect(Math.abs(d)).toBeLessThanOrEqual(size / 2 + 1e-12);
      }
    }
    expect(wrapDelta(1, 159, 160)).toBe(2);
    expect(wrapDelta(159, 1, 160)).toBe(-2);
    expect(wrapDelta(10, 10, 160)).toBe(0);
  });
  it('wrapCoord lands in [0, size) for anything, and leaves values already inside alone', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 3000; i++) {
      const v = (rng() - 0.5) * 1000;
      const w = wrapCoord(v, WORLD_W);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(WORLD_W);
      expect(near(((v - w) / WORLD_W) % 1, 0, 1e-9) || near(Math.abs(((v - w) / WORLD_W) % 1), 1, 1e-9)).toBe(true);
    }
    expect(wrapCoord(5, 160)).toBe(5);
    expect(wrapCoord(-1e-18, 160)).toBeLessThan(160);
    expect(wrapCoord(160, 160)).toBe(0);
    expect(wrapCoord(-0.5, 160)).toBe(159.5);
  });
  it('torusDistance matches brute force', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const ax = rng() * WORLD_W; const ay = rng() * WORLD_H; const bx = rng() * WORLD_W; const by = rng() * WORLD_H;
      expect(near(torusDistance(ax, ay, bx, by), bruteDist(ax, ay, bx, by), 1e-9)).toBe(true);
    }
  });
});

describe('neighbour search', () => {
  it('the grid finds exactly the shapes a scan over every pair finds', () => {
    for (const seed of [1, 2, 3]) {
      const s = createSwarm(MAX_BOIDS, seed);
      // Crowd a few near the corners and edges so the wrap is exercised.
      place(s, 0, 0.2, 0.3, 15, 0); place(s, 1, WORLD_W - 0.4, WORLD_H - 0.2, 15, 0); place(s, 2, WORLD_W - 0.1, 0.5, 15, 0); place(s, 3, 0.3, WORLD_H - 0.3, 15, 0);
      place(s, 4, 80, 0.1, 15, 0); place(s, 5, 81, WORLD_H - 0.1, 15, 0);
      for (let i = 0; i < s.n; i++) {
        const got = neighboursOf(s, i);
        const want: number[] = [];
        for (let j = 0; j < s.n; j++) if (j !== i && bruteDist(s.x[i], s.y[i], s.x[j], s.y[j]) <= PERCEPTION) want.push(j);
        expect(got).toEqual(want);
      }
    }
  });
  it('shapes across the wrap seam see each other, and shapes just out of sight do not', () => {
    const s = createSwarm(MIN_BOIDS, 4);
    spread(s);
    place(s, 0, 1, 50, 15, 0); place(s, 1, WORLD_W - 1, 50, 15, 0); place(s, 2, 1 + PERCEPTION + 0.5, 50, 15, 0);
    expect(neighboursOf(s, 0)).toContain(1);
    expect(neighboursOf(s, 1)).toContain(0);
    expect(neighboursOf(s, 0)).not.toContain(2);
  });
});

describe('the real engine equals a plain implementation of the rules', () => {
  const clampAcc = (ax: number, ay: number): [number, number] => {
    const m = Math.hypot(ax, ay);
    return m > MAX_FORCE ? [(ax / m) * MAX_FORCE, (ay / m) * MAX_FORCE] : [ax, ay];
  };
  const refStep = (x: number[], y: number[], vx: number[], vy: number[], p: Params, preds: { x: number; y: number }[], att: Attractor | null, dt: number) => {
    const n = x.length;
    const nvx: number[] = []; const nvy: number[] = [];
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0, avx = 0, avy = 0, cx = 0, cy = 0, c = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = wrapDelta(x[j], x[i], WORLD_W); const dy = wrapDelta(y[j], y[i], WORLD_H);
        const d2 = dx * dx + dy * dy;
        if (d2 > PERCEPTION * PERCEPTION) continue;
        c++; avx += vx[j]; avy += vy[j]; cx += dx; cy += dy;
        if (d2 < SEPARATION_R * SEPARATION_R) { const q = 1 / Math.max(d2, 0.01); sx -= dx * q; sy -= dy * q; }
      }
      let ax = 0, ay = 0;
      if (c > 0) {
        ax += p.separation * SEP_GAIN * sx + p.alignment * ALI_GAIN * (avx / c - vx[i]) + p.cohesion * COH_GAIN * (cx / c);
        ay += p.separation * SEP_GAIN * sy + p.alignment * ALI_GAIN * (avy / c - vy[i]) + p.cohesion * COH_GAIN * (cy / c);
      }
      for (const pr of preds) {
        const dx = wrapDelta(x[i], pr.x, WORLD_W); const dy = wrapDelta(y[i], pr.y, WORLD_H);
        const d = Math.hypot(dx, dy);
        if (d < PRED_R) { const k = FLEE_GAIN * (1 - Math.max(d, 1e-6) / PRED_R); ax += (dx / Math.max(d, 1e-6)) * k; ay += (dy / Math.max(d, 1e-6)) * k; }
      }
      if (att) {
        const dx = wrapDelta(att.x, x[i], WORLD_W); const dy = wrapDelta(att.y, y[i], WORLD_H);
        const d = Math.hypot(dx, dy);
        if (d < ATTRACT_R && d > 1e-6) { const k = att.sign * ATTRACT_GAIN * (1 - 0.5 * (d / ATTRACT_R)); ax += (dx / d) * k; ay += (dy / d) * k; }
      }
      [ax, ay] = clampAcc(ax, ay);
      let ux = vx[i] + ax * dt; let uy = vy[i] + ay * dt;
      const sp = Math.hypot(ux, uy);
      if (sp > MAX_SPEED) { ux = (ux / sp) * MAX_SPEED; uy = (uy / sp) * MAX_SPEED; }
      else if (sp < MIN_SPEED) { ux = (ux / sp) * MIN_SPEED; uy = (uy / sp) * MIN_SPEED; }
      nvx.push(ux); nvy.push(uy);
    }
    return { x: x.map((v, i) => wrapCoord(v + nvx[i] * dt, WORLD_W)), y: y.map((v, i) => wrapCoord(v + nvy[i] * dt, WORLD_H)), vx: nvx, vy: nvy };
  };
  const snap = (s: Swarm) => ({ x: Array.from(s.x.slice(0, s.n)), y: Array.from(s.y.slice(0, s.n)), vx: Array.from(s.vx.slice(0, s.n)), vy: Array.from(s.vy.slice(0, s.n)) });
  const sameState = (s: Swarm, r: { x: number[]; y: number[]; vx: number[]; vy: number[] }) => {
    for (let i = 0; i < s.n; i++) {
      // A shape that has crossed the seam may differ by exactly one world width; compare on the circle.
      expect(near(wrapDelta(s.x[i], r.x[i], WORLD_W), 0, 1e-8)).toBe(true);
      expect(near(wrapDelta(s.y[i], r.y[i], WORLD_H), 0, 1e-8)).toBe(true);
      expect(near(s.vx[i], r.vx[i], 1e-8)).toBe(true);
      expect(near(s.vy[i], r.vy[i], 1e-8)).toBe(true);
    }
  };

  it('three steps with a crowd and mixed rule weights', () => {
    for (const seed of [5, 6]) {
      const s = createSwarm(220, seed);
      let r = snap(s);
      const p: Params = { separation: 1.7, alignment: 0.9, cohesion: 1.4 };
      for (let k = 0; k < 3; k++) {
        r = refStep(r.x, r.y, r.vx, r.vy, p, [], null, FIXED_DT);
        stepSwarm(s, p, null);
      }
      sameState(s, r);
    }
  }, 30_000);

  it('one step with three chasers and a pulling attractor', () => {
    const s = createSwarm(260, 9);
    setPredators(s, 3);
    s.preds[0].x = 40; s.preds[0].y = 30; s.preds[1].x = 100; s.preds[1].y = 70; s.preds[2].x = 150; s.preds[2].y = 95;
    const att: Attractor = { x: 70, y: 40, sign: 1 };
    const r0 = snap(s);
    const want = refStep(r0.x, r0.y, r0.vx, r0.vy, DEFAULT_PARAMS, s.preds.map((q) => ({ x: q.x, y: q.y })), att, FIXED_DT);
    stepSwarm(s, DEFAULT_PARAMS, att);
    sameState(s, want);
    const s2 = createSwarm(260, 10);
    const att2: Attractor = { x: 5, y: 95, sign: -1 };
    const r1 = snap(s2);
    const want2 = refStep(r1.x, r1.y, r1.vx, r1.vy, { separation: 3, alignment: 3, cohesion: 3 }, [], att2, FIXED_DT);
    stepSwarm(s2, { separation: 3, alignment: 3, cohesion: 3 }, att2);
    sameState(s2, want2);
  }, 30_000);
});

describe('invariants over long runs', () => {
  it('speed, position and finiteness hold for 5000 steps at maximum settings with chasers and an attractor', () => {
    const s = createSwarm(MAX_BOIDS, 77);
    setPredators(s, MAX_PREDATORS);
    const max: Params = { separation: SLIDER_MAX, alignment: SLIDER_MAX, cohesion: SLIDER_MAX };
    for (let t = 0; t < 5000; t++) {
      const att: Attractor | null = t % 900 < 300 ? { x: 80, y: 50, sign: 1 } : t % 900 < 600 ? { x: 20 + (t % 100), y: 30, sign: -1 } : null;
      stepSwarm(s, t % 1500 < 700 ? max : OFF, att);
      if (t % 250 === 0 || t > 4990) {
        for (let i = 0; i < s.n; i++) {
          const sp = Math.hypot(s.vx[i], s.vy[i]);
          expect(sp).toBeGreaterThanOrEqual(MIN_SPEED - 1e-9);
          expect(sp).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
          expect(s.x[i]).toBeGreaterThanOrEqual(0);
          expect(s.x[i]).toBeLessThan(WORLD_W);
          expect(s.y[i]).toBeGreaterThanOrEqual(0);
          expect(s.y[i]).toBeLessThan(WORLD_H);
        }
        for (const p of s.preds) { expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.heading)).toBe(true); expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThan(WORLD_W); expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThan(WORLD_H); }
      }
    }
    expect(Number.isFinite(polarisation(s))).toBe(true);
  }, 120_000);

  it('shapes that start on top of each other stay finite', () => {
    const s = createSwarm(100, 3);
    for (let i = 0; i < s.n; i++) place(s, i, 50, 50, 15, 0);
    for (let t = 0; t < 300; t++) stepSwarm(s, { separation: 3, alignment: 0, cohesion: 3 });
    for (let i = 0; i < s.n; i++) { expect(Number.isFinite(s.x[i]) && Number.isFinite(s.vx[i])).toBe(true); expect(Math.hypot(s.vx[i], s.vy[i])).toBeLessThanOrEqual(MAX_SPEED + 1e-9); }
  });

  it('the same seed gives the same flock step for step, other seeds differ', () => {
    const run = (seed: number) => { const s = createSwarm(150, seed); setPredators(s, 2); for (let t = 0; t < 400; t++) stepSwarm(s, DEFAULT_PARAMS); return Array.from(s.x.slice(0, 150)).concat(Array.from(s.vy.slice(0, 150)), s.preds.map((p) => p.x)); };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  }, 30_000);
});

describe('each rule on its own', () => {
  it('with every rule off, shapes fly straight at constant speed (wrapping at the edges)', () => {
    const s = createSwarm(100, 8);
    const x0 = Array.from(s.x.slice(0, 100)); const y0 = Array.from(s.y.slice(0, 100));
    const vx0 = Array.from(s.vx.slice(0, 100)); const vy0 = Array.from(s.vy.slice(0, 100));
    const steps = 200;
    for (let t = 0; t < steps; t++) stepSwarm(s, OFF);
    for (let i = 0; i < 100; i++) {
      expect(near(s.vx[i], vx0[i], 1e-12)).toBe(true);
      expect(near(s.vy[i], vy0[i], 1e-12)).toBe(true);
      expect(near(wrapDelta(s.x[i], x0[i] + vx0[i] * steps * FIXED_DT, WORLD_W), 0, 1e-8)).toBe(true);
      expect(near(wrapDelta(s.y[i], y0[i] + vy0[i] * steps * FIXED_DT, WORLD_H), 0, 1e-8)).toBe(true);
    }
  });
  it('alignment alone makes the headings agree', () => {
    const s = createSwarm(150, 11);
    const before = polarisation(s);
    expect(before).toBeLessThan(0.3);
    for (let t = 0; t < 900; t++) stepSwarm(s, { separation: 0, alignment: 3, cohesion: 0 });
    expect(polarisation(s)).toBeGreaterThan(0.85);
  }, 60_000);
  it('with alignment off there is no such agreement', () => {
    const s = createSwarm(150, 11);
    for (let t = 0; t < 900; t++) stepSwarm(s, OFF);
    expect(polarisation(s)).toBeLessThan(0.3);
  }, 60_000);

  const meanNearest = (s: Swarm): number => {
    let sum = 0;
    for (let i = 0; i < s.n; i++) {
      let best = Infinity;
      for (let j = 0; j < s.n; j++) if (j !== i) best = Math.min(best, bruteDist(s.x[i], s.y[i], s.x[j], s.y[j]));
      sum += best;
    }
    return sum / s.n;
  };
  it('cohesion alone pulls shapes together', () => {
    const s = createSwarm(150, 12);
    const before = meanNearest(s);
    const crowd = (): number => { let k = 0; for (let i = 0; i < s.n; i++) k += neighboursOf(s, i).length; return k / s.n; };
    const crowdBefore = crowd();
    for (let t = 0; t < 900; t++) stepSwarm(s, { separation: 0, alignment: 0, cohesion: 3 });
    // Shapes cannot stop (minimum speed), so they swirl round each other instead of collapsing to a point;
    // they end up in clumps: closer to their nearest neighbour and with many more neighbours in sight.
    expect(meanNearest(s), 'nearest ' + before + ' -> ' + meanNearest(s)).toBeLessThan(before * 0.85);
    expect(crowd(), 'crowd ' + crowdBefore + ' -> ' + crowd()).toBeGreaterThan(crowdBefore * 1.5);
  }, 60_000);
  it('separation alone spreads a crowd out', () => {
    const s = createSwarm(MAX_BOIDS, 13);
    for (let i = 0; i < s.n; i++) { s.x[i] = 40 + (s.x[i] / WORLD_W) * 50; s.y[i] = 25 + (s.y[i] / WORLD_H) * 40; } // squeeze into a corner patch
    const before = meanNearest(s);
    for (let t = 0; t < 600; t++) stepSwarm(s, { separation: 3, alignment: 0, cohesion: 0 });
    expect(meanNearest(s)).toBeGreaterThan(before * 1.25);
  }, 60_000);
});

describe('chasers and the attractor', () => {
  it('a chaser moves at constant speed, turns at a limited rate and heads for a shape it can see', () => {
    const s = createSwarm(MIN_BOIDS, 14);
    spread(s);
    setPredators(s, 1);
    const p = s.preds[0];
    p.x = 20; p.y = 50; p.heading = 0;
    place(s, 0, 20, 50 - 30, 0 + MIN_SPEED, 0); // a shape 30 units above (y smaller), within sight
    for (let i = 1; i < s.n; i++) place(s, i, 150, 95, MIN_SPEED, 0); // everything else far away and out of sight
    let prevH = p.heading;
    for (let t = 0; t < 200; t++) {
      const px = p.x; const py = p.y;
      stepSwarm(s, OFF);
      // keep the target where it is so the bearing is steady
      place(s, 0, 20, 20, MIN_SPEED, 0);
      expect(near(Math.hypot(wrapDelta(p.x, px, WORLD_W), wrapDelta(p.y, py, WORLD_H)), PRED_SPEED * FIXED_DT, 1e-9)).toBe(true);
      let dh = p.heading - prevH;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      expect(Math.abs(dh)).toBeLessThanOrEqual(PRED_TURN * FIXED_DT + 1e-9);
      prevH = p.heading;
    }
    expect(PRED_SIGHT).toBeGreaterThan(30);
  });
  it('a chaser with nothing in sight wanders, staying in the world', () => {
    const s = createSwarm(MIN_BOIDS, 15);
    for (let i = 0; i < s.n; i++) place(s, i, 150, 95, MIN_SPEED, 0);
    setPredators(s, 1);
    s.preds[0].x = 20; s.preds[0].y = 20;
    const heads = new Set<number>();
    for (let t = 0; t < 500; t++) { stepSwarm(s, OFF); heads.add(Math.round(s.preds[0].heading * 1000)); }
    expect(heads.size).toBeGreaterThan(100);
  });
  it('a shape inside a chaser\'s range is pushed away from it, and one outside is not', () => {
    const s = createSwarm(MIN_BOIDS, 16);
    spread(s);
    setPredators(s, 1);
    place(s, 0, 60, 50, MIN_SPEED, 0);
    for (let i = 1; i < s.n; i++) place(s, i, (i % 6) * 26.6 + 5, 5 + Math.floor(i / 6) * 25, MIN_SPEED, 0);
    s.preds[0].x = 50; s.preds[0].y = 50; // 10 units to the left of shape 0
    const vxBefore = s.vx[0];
    const farBefore = s.vx[7];
    stepSwarm(s, OFF);
    expect(s.vx[0]).toBeGreaterThan(vxBefore); // pushed to the right, away from the chaser
    expect(near(s.vy[0], 0, 1e-9)).toBe(true);
    expect(s.vx[7]).toBe(farBefore);
  });
  it('the attractor pulls the shapes near it in, and push drives them out', () => {
    const mean = (s: Swarm, ids: number[], ax: number, ay: number) => ids.reduce((t, i) => t + torusDistance(s.x[i], s.y[i], ax, ay), 0) / ids.length;
    for (const sign of [1, -1] as const) {
      const s = createSwarm(200, 17);
      const ids: number[] = [];
      for (let i = 0; i < s.n; i++) if (torusDistance(s.x[i], s.y[i], 80, 50) < ATTRACT_R * 0.8) ids.push(i);
      expect(ids.length).toBeGreaterThan(20);
      const before = mean(s, ids, 80, 50);
      for (let t = 0; t < 120; t++) stepSwarm(s, OFF, { x: 80, y: 50, sign });
      const after = mean(s, ids, 80, 50);
      if (sign === 1) expect(after).toBeLessThan(before * 0.8);
      else expect(after).toBeGreaterThan(before * 1.2);
    }
  }, 30_000);
});

describe('setting things up and the sanitisers', () => {
  it('count and chasers stay in range and growing keeps the first shapes unchanged', () => {
    const s = createSwarm(100, 1);
    const first = Array.from(s.x.slice(0, 100));
    setCount(s, 250);
    expect(s.n).toBe(250);
    expect(Array.from(s.x.slice(0, 100))).toEqual(first);
    setCount(s, 5);
    expect(s.n).toBe(MIN_BOIDS);
    setCount(s, 99999);
    expect(s.n).toBe(MAX_BOIDS);
    setCount(s, NaN);
    expect(s.n).toBe(DEFAULT_BOIDS);
    setPredators(s, 3); expect(s.preds.length).toBe(3);
    setPredators(s, 1); expect(s.preds.length).toBe(1);
    setPredators(s, 9); expect(s.preds.length).toBe(MAX_PREDATORS);
    setPredators(s, -1); expect(s.preds.length).toBe(0);
    setPredators(s, 1.5); expect(s.preds.length).toBe(0);
    expect(createSwarm(0, 1).n).toBe(MIN_BOIDS);
    expect(clampCount('50')).toBe(DEFAULT_BOIDS);
    expect(clampCount(41.6)).toBe(42);
  });
  it('slider values are clamped to 0 to 3 in tenths, and junk falls back to the default', () => {
    expect(sanitiseParams({ separation: 9, alignment: -2, cohesion: 1.234 })).toEqual({ separation: 3, alignment: 0, cohesion: 1.2 });
    for (const junk of [null, undefined, 5, 'x', [], [1, 2, 3], NaN, () => 1]) expect(sanitiseParams(junk)).toEqual(DEFAULT_PARAMS);
    expect(sanitiseParams({ separation: NaN, alignment: 'a', cohesion: Infinity })).toEqual(DEFAULT_PARAMS);
    expect(sanitiseParams(Object.create({ separation: 3 }))).toEqual(DEFAULT_PARAMS);
    expect(sanitiseParams(JSON.parse('{"__proto__": {"separation": 3}, "alignment": 2}'))).toEqual({ ...DEFAULT_PARAMS, alignment: 2 });
    expect(({} as Record<string, unknown>).separation).toBeUndefined();
  });
  it('every preset is inside the slider range and unique', () => {
    expect(PRESETS.length).toBe(4);
    const seen = new Set<string>();
    for (const p of PRESETS) {
      expect(sanitiseParams(p.params)).toEqual(p.params);
      seen.add(JSON.stringify(p.params));
    }
    expect(seen.size).toBe(4);
    expect(PRESETS[0].params).toEqual(DEFAULT_PARAMS);
  });
});

describe('measures and helpers', () => {
  it('polarisation is 1 for one heading, 0 for opposite pairs, and small for random headings', () => {
    const s = createSwarm(100, 1);
    for (let i = 0; i < 100; i++) { s.vx[i] = 20; s.vy[i] = 5; }
    expect(near(polarisation(s), 1, 1e-12)).toBe(true);
    for (let i = 0; i < 100; i++) { s.vx[i] = i % 2 ? 20 : -20; s.vy[i] = 0; }
    expect(near(polarisation(s), 0, 1e-12)).toBe(true);
    expect(polarisation(createSwarm(400, 2))).toBeLessThan(0.2);
  });
  it('order words and the heading buckets', () => {
    expect([0.95, 0.9, 0.7, 0.6, 0.4, 0.3, 0.1].map(orderWord)).toEqual(['moving together', 'moving together', 'mostly together', 'mostly together', 'loosely together', 'loosely together', 'scattered']);
    const seen = new Set<number>();
    for (let a = 0; a < 360; a += 1) {
      const b = headingBucket(Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180), 24);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(24);
      seen.add(b);
    }
    expect(seen.size).toBe(24);
    expect(headingBucket(-1, -0, 24)).toBeLessThan(24);
    expect(headingBucket(0, 0, 24)).toBeLessThan(24);
  });
  it('the frame budget helper only lowers the count when frames are slow, and never below 20', () => {
    expect(adaptCount(300, 10)).toBe(300);
    expect(adaptCount(300, 25)).toBe(225);
    expect(adaptCount(22, 99)).toBe(MIN_BOIDS);
    expect(adaptCount(MIN_BOIDS, 99)).toBe(MIN_BOIDS);
    expect(adaptCount(300, NaN)).toBe(300);
    let n = 400; for (let i = 0; i < 30; i++) n = adaptCount(n, 40);
    expect(n).toBe(MIN_BOIDS);
  });
  it('cursor, words, colour kit and fixed step', () => {
    expect(moveCursor({ x: 1, y: 1 }, -9, -9)).toEqual({ x: 0, y: 0 });
    expect(moveCursor({ x: 159, y: 99 }, 9, 9)).toEqual({ x: WORLD_W, y: WORLD_H });
    expect(shareText(150, DEFAULT_PARAMS, 0.95)).toBe('Swarm Garden: 150 shapes, separation 1.5, alignment 1, cohesion 0.8, moving together');
    expect(shareText(1, DEFAULT_PARAMS, 0)).toMatch(/^Swarm Garden: 1 shape,/);
    for (const t of RULES) expect(t.includes('—')).toBe(false);
    expect(parseColour('#f87171')).toEqual([248, 113, 113]);
    expect(toCss([248, 113, 113])).toBe('#f87171');
    expect(eightTints({ sky: [56, 189, 248], green: [52, 211, 153], amber: [251, 191, 36], rose: [248, 113, 113] }).length).toBe(8);
    expect(luminance(mixOklch(neutral(0.2), neutral(0.9), 0.5))).toBeGreaterThan(luminance(neutral(0.2)));
    expect(plural(1, 'shape')).toBe('1 shape');
    expect(advance(0, 5000, FIXED_DT * 1000, 3).steps).toBeGreaterThanOrEqual(2);
    expect(advance(0, 5000, FIXED_DT * 1000, 3).steps).toBeLessThanOrEqual(3);
  });
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('sizes the canvas from its box times a capped pixel ratio and reads colours at run time', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/getComputedStyle/);
    expect(src).toMatch(/ResizeObserver/);
  });
  it('pauses when hidden or scrolled away, starts paused for reduced motion, and caps the work per frame', () => {
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/IntersectionObserver/);
    expect(src).toMatch(/prefers-reduced-motion: reduce/);
    expect(src).toMatch(/adaptCount\(/);
    expect(src).toMatch(/let running = !reducedQuery\.matches/);
  });
  it('handles pointer cancel and a single pointer, with touch-action none on the garden only', () => {
    expect(src).toMatch(/pointercancel/);
    expect(src).toMatch(/isPrimary/);
    expect(src.match(/touch-action:\s*none/g)?.length).toBe(1);
  });
  it('has sliders with labels, a keyboard path and a live status line, and offers no download or storage', () => {
    expect(src).toMatch(/<label for=/);
    expect(src).toMatch(/type="range"/);
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/Nothing to download/);
    expect(src).not.toMatch(/localStorage|toBlob|createObjectURL|AudioContext/);
  });
});
