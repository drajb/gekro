/**
 * games-fireworks.test.ts - the engine behind `fireworks`.
 *
 * Pinned:
 *  - burst shapes: a peony's sparks are a ball seen from the side (mean distance from the middle is pi/4
 *    of full speed, mean square 2/3), a ring is on a circle or an ellipse of the given tilt, a heart is
 *    symmetrical with two lobes over a cleft and a point at the bottom, a star's sparks all lie on the
 *    outline of a five-pointed star; the same seed gives the same burst,
 *  - the sparks' motion is the exact solution of drag plus gravity: it matches a fine numerical
 *    integration done here, does not depend on the size of the time step, and adding steps adds paths,
 *  - the particle system never exceeds its cap, keeps no dead sparks, stays finite over thousands of steps
 *    of random bursts, and thins a burst evenly when there is not room,
 *  - a shell peaks exactly at the aimed point (position and height) and bursts there,
 *  - the flash limiter lets through at most 3 flashes in any one second whatever the timing,
 *  - the show schedule is deterministic and never fires faster than the minimum gap,
 *  - sound plans stay under the volume cap, the still picture used for reduced motion equals the
 *    system stepped for 0.7 s, and the claims the page source makes.
 */
import { describe, it, expect } from 'vitest';
import {
  WORLD_W, WORLD_H, SHELL_GRAVITY, MAX_PARTICLES, MAX_SHELLS, LAUNCH_GAP_MS, FIXED_DT, SOUND_PEAK, SNAPSHOT_T,
  PATTERNS, PATTERN_LABEL, isPattern, CHOICES, isChoice, SPEC, heartPoint, starCorners, STAR_INNER, burstVelocities, makeBurst,
  offsetAt, velocityAt, staticBurst, createSystem, clearSystem, spawnBurst, stepSystem, fade, launchShell, stepShell, launchOrigin,
  MIN_BURST_Y, MAX_BURST_Y, makeFlashLimiter, showSchedule, SHOW_MIN_GAP_MS, soundPlan, starField, moveAim, shareText, RULES,
  mulberry32, parseColour, toCss, eightTints, plural, advance,
  type Pattern,
} from '../src/components/apps-private/fireworks/helpers';
import calculatorSource from '../src/components/apps-private/fireworks/Calculator.astro?raw';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

describe('burst shapes', () => {
  it('a peony is a ball seen from the side: mean radius pi/4, mean square radius 2/3, no favourite direction', () => {
    const rng = mulberry32(1);
    let sum = 0; let sq = 0; let cx = 0; let cy = 0; let n = 0; let maxR = 0;
    for (let b = 0; b < 400; b++) {
      const v = burstVelocities('peony', 130, rng, 1);
      for (let i = 0; i < v.vx.length; i++) {
        const r = Math.hypot(v.vx[i], v.vy[i]);
        sum += r; sq += r * r; cx += v.vx[i]; cy += v.vy[i]; n++; maxR = Math.max(maxR, r);
      }
    }
    expect(n).toBe(52000);
    expect(maxR).toBeLessThanOrEqual(1);
    expect(Math.abs(sum / n - Math.PI / 4)).toBeLessThan(0.01);
    expect(Math.abs(sq / n - 2 / 3)).toBeLessThan(0.01);
    expect(Math.abs(cx / n)).toBeLessThan(0.01);
    expect(Math.abs(cy / n)).toBeLessThan(0.01);
  });

  it('a willow uses the same ball but its sparks are slower, last longer and droop more than a peony', () => {
    expect(SPEC.willow.speed).toBeLessThan(SPEC.peony.speed);
    expect(SPEC.willow.life[0]).toBeGreaterThan(SPEC.peony.life[1]);
    expect(SPEC.willow.gravity).toBeGreaterThan(SPEC.peony.gravity);
    expect(SPEC.willow.trail).toBeGreaterThan(SPEC.peony.trail);
    const a = burstVelocities('willow', 40, mulberry32(4), 1);
    expect(a.vx.length).toBe(40);
  });

  it('a ring with no tilt sits on a circle of full speed, evenly spaced', () => {
    const v = burstVelocities('ring', 60, mulberry32(2), 20, { ratio: 1, rot: 0 });
    expect(v.vx.length).toBe(60);
    const angles = v.vx.map((x, i) => Math.atan2(v.vy[i], x));
    for (let i = 0; i < 60; i++) expect(near(Math.hypot(v.vx[i], v.vy[i]), 20, 1e-9)).toBe(true);
    const step = (2 * Math.PI) / 60;
    for (let i = 1; i < 60; i++) {
      let d = angles[i] - angles[i - 1];
      while (d < -Math.PI) d += 2 * Math.PI;
      expect(near(d, step, 1e-9)).toBe(true);
    }
  });

  it('a tilted ring lies on an ellipse with the given squash and turn', () => {
    const tilt = { ratio: 0.5, rot: 0.7 };
    const v = burstVelocities('ring', 48, mulberry32(3), 10, tilt);
    for (let i = 0; i < 48; i++) {
      // Undo the turn, then the point must satisfy (x / 10)^2 + (y / (10 * ratio))^2 = 1.
      const x = v.vx[i] * Math.cos(-tilt.rot) - v.vy[i] * Math.sin(-tilt.rot);
      const y = v.vx[i] * Math.sin(-tilt.rot) + v.vy[i] * Math.cos(-tilt.rot);
      expect(near((x / 10) ** 2 + (y / (10 * tilt.ratio)) ** 2, 1, 1e-9)).toBe(true);
    }
    // With no tilt given, it is drawn from the random source, always squashed between 0.45 and 1.
    for (let s = 0; s < 40; s++) {
      const w = burstVelocities('ring', 24, mulberry32(s), 1);
      const minR = Math.min(...w.vx.map((x, i) => Math.hypot(x, w.vy[i])));
      expect(minR).toBeGreaterThanOrEqual(0.45 - 1e-9);
    }
  });

  it('a heart is symmetrical, has two lobes over a cleft and a point at the bottom, and fits a circle of radius about 1', () => {
    const n = 80;
    const v = burstVelocities('heart', n, mulberry32(1), 1);
    expect(v.vx.length).toBe(n);
    // Left-right symmetry: every point has a mirror image.
    for (let i = 0; i < n; i++) {
      const j = (n - i) % n;
      expect(near(v.vx[i], -v.vx[j], 1e-9)).toBe(true);
      expect(near(v.vy[i], v.vy[j], 1e-9)).toBe(true);
    }
    const maxX = Math.max(...v.vx);
    expect(near(maxX, 16 / 17, 1e-3)).toBe(true);
    // The bottom point (largest y, y grows downward) is on the middle line.
    const iBottom = v.vy.indexOf(Math.max(...v.vy));
    expect(Math.abs(v.vx[iBottom])).toBeLessThan(1e-9);
    // Two lobes: the highest points are off to each side, and the cleft in the middle is lower than they are.
    const topY = Math.min(...v.vy);
    const iTop = v.vy.indexOf(topY);
    expect(Math.abs(v.vx[iTop])).toBeGreaterThan(0.2);
    const cleft = heartPoint(0).y;
    expect(cleft).toBeGreaterThan(topY + 0.2);
    for (let i = 0; i < n; i++) expect(Math.hypot(v.vx[i], v.vy[i])).toBeLessThanOrEqual(1.1);
  });

  it('every spark of a star lies on the outline of a five-pointed star', () => {
    const corners = starCorners();
    expect(corners.length).toBe(10);
    for (let i = 0; i < 10; i++) expect(near(Math.hypot(corners[i].x, corners[i].y), i % 2 === 0 ? 1 : STAR_INNER, 1e-12)).toBe(true);
    expect(near(corners[0].x, 0, 1e-12) && near(corners[0].y, -1, 1e-12)).toBe(true); // one point straight up
    for (const count of [60, 100, 73]) {
      const v = burstVelocities('star', count, mulberry32(9), 1);
      expect(v.vx.length).toBe(10 * Math.round(count / 10));
      for (let i = 0; i < v.vx.length; i++) {
        let onEdge = false;
        for (let e = 0; e < 10; e++) {
          const a = corners[e]; const b = corners[(e + 1) % 10];
          const cross = (v.vx[i] - a.x) * (b.y - a.y) - (v.vy[i] - a.y) * (b.x - a.x);
          const along = ((v.vx[i] - a.x) * (b.x - a.x) + (v.vy[i] - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
          if (Math.abs(cross) < 1e-9 && along >= -1e-9 && along <= 1 + 1e-9) onEdge = true;
        }
        expect(onEdge).toBe(true);
        const r = Math.hypot(v.vx[i], v.vy[i]);
        expect(r).toBeGreaterThanOrEqual(STAR_INNER - 1e-9);
        expect(r).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('a burst is built from a seed: same seed same burst, other seeds differ, counts and colours are in range', () => {
    for (const p of PATTERNS) {
      const a = makeBurst(p, mulberry32(77));
      const b = makeBurst(p, mulberry32(77));
      expect(Array.from(a.vx)).toEqual(Array.from(b.vx));
      expect(Array.from(a.life)).toEqual(Array.from(b.life));
      expect(Array.from(a.col)).toEqual(Array.from(b.col));
      const other = makeBurst(p, mulberry32(78));
      expect(JSON.stringify([Array.from(other.vx), Array.from(other.life), Array.from(other.col)])).not.toBe(JSON.stringify([Array.from(a.vx), Array.from(a.life), Array.from(a.col)]));
      for (let seed = 0; seed < 60; seed++) {
        const x = makeBurst(p, mulberry32(seed));
        const s = SPEC[p];
        expect(x.n).toBeGreaterThanOrEqual(s.count[0] - 5);
        expect(x.n).toBeLessThanOrEqual(Math.max(s.count[1], s.count[1] + 5));
        expect(x.n).toBeLessThanOrEqual(130);
        const lo = s.life[0] * (1 - s.lifeJitter) - 1e-9;
        const hi = s.life[1] * (1 + s.lifeJitter) + 1e-9;
        for (let i = 0; i < x.n; i++) {
          expect(x.life[i]).toBeGreaterThanOrEqual(lo);
          expect(x.life[i]).toBeLessThanOrEqual(hi);
          expect(x.col[i]).toBeGreaterThanOrEqual(0);
          expect(x.col[i]).toBeLessThanOrEqual(7);
          expect(Number.isFinite(x.vx[i]) && Number.isFinite(x.vy[i])).toBe(true);
        }
        if (p === 'heart') expect(new Set(x.col).size).toBe(1);
        else expect(new Set(x.col).size).toBeLessThanOrEqual(2);
      }
    }
    expect(makeBurst('peony', mulberry32(1), { count: 25 }).n).toBe(25);
  });
});

describe('motion: drag and gravity, exactly', () => {
  /** Fourth-order Runge-Kutta for x'' = -k x' + g, written here as a reference that shares no code with the engine. */
  const rk4 = (vx: number, vy: number, k: number, g: number, t: number, steps = 4000) => {
    let x = 0; let y = 0; let ux = vx; let uy = vy;
    const h = t / steps;
    const f = (ax: number, ay: number): [number, number] => [-k * ax, -k * ay + g];
    for (let i = 0; i < steps; i++) {
      const k1x = ux, k1y = uy; const [a1x, a1y] = f(ux, uy);
      const k2x = ux + 0.5 * h * a1x, k2y = uy + 0.5 * h * a1y; const [a2x, a2y] = f(k2x, k2y);
      const k3x = ux + 0.5 * h * a2x, k3y = uy + 0.5 * h * a2y; const [a3x, a3y] = f(k3x, k3y);
      const k4x = ux + h * a3x, k4y = uy + h * a3y; const [a4x, a4y] = f(k4x, k4y);
      x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
      y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      ux += (h / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
      uy += (h / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
    }
    return { x, y, vx: ux, vy: uy };
  };

  it('offsetAt and velocityAt match a fine numerical integration for many starts', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 40; i++) {
      const vx = (rng() * 2 - 1) * 25; const vy = (rng() * 2 - 1) * 25;
      const k = 0.8 + rng() * 1.5; const g = 5 + rng() * 12; const t = 0.2 + rng() * 2.5;
      const ref = rk4(vx, vy, k, g, t);
      const o = offsetAt(vx, vy, k, g, t);
      const v = velocityAt(vx, vy, k, g, t);
      expect(near(o.dx, ref.x, 1e-6)).toBe(true);
      expect(near(o.dy, ref.y, 1e-6)).toBe(true);
      expect(near(v.vx, ref.vx, 1e-6)).toBe(true);
      expect(near(v.vy, ref.vy, 1e-6)).toBe(true);
    }
  });

  it('paths add up: going t1 then t2 equals going t1 + t2, so the step size does not matter', () => {
    const o1 = offsetAt(12, -8, 1.3, 9, 0.4);
    const v1 = velocityAt(12, -8, 1.3, 9, 0.4);
    const o2 = offsetAt(v1.vx, v1.vy, 1.3, 9, 0.9);
    const whole = offsetAt(12, -8, 1.3, 9, 1.3);
    expect(near(o1.dx + o2.dx, whole.dx, 1e-9)).toBe(true);
    expect(near(o1.dy + o2.dy, whole.dy, 1e-9)).toBe(true);
    expect(offsetAt(5, 5, 1, 9, 0)).toEqual({ dx: 0, dy: 0 });
  });

  it('with drag a spark never goes further than speed / drag sideways, and without gravity it stops', () => {
    const o = offsetAt(20, 0, 1.4, 0, 1000);
    expect(near(o.dx, 20 / 1.4, 1e-9)).toBe(true);
    expect(near(o.dy, 0, 1e-12)).toBe(true);
    const v = velocityAt(20, 0, 1.4, 9, 1000);
    expect(near(v.vx, 0, 1e-9)).toBe(true);
    expect(near(v.vy, 9 / 1.4, 1e-9)).toBe(true); // falls at terminal speed g / k
  });

  it('the system matches the closed form at any step size, including awkward ones', () => {
    for (const dts of [[1 / 60], [1 / 10], [0.013, 0.021, 0.0071], [0.05]]) {
      const sys = createSystem(300);
      const b = makeBurst('peony', mulberry32(3));
      spawnBurst(sys, b, 40, 20);
      let t = 0;
      for (let i = 0; i < 24; i++) { const dt = dts[i % dts.length]; stepSystem(sys, dt); t += dt; }
      // Compare each surviving spark with the closed form from its own starting velocity. Sparks keep their order
      // until one dies, so recompute from the burst by matching ages.
      const alive = Array.from({ length: b.n }, (_, i) => i).filter((i) => b.life[i] > t);
      expect(sys.n).toBe(alive.length);
      const seen = new Set<number>();
      for (let j = 0; j < sys.n; j++) {
        const idx = alive.find((i) => !seen.has(i) && near(40 + offsetAt(b.vx[i], b.vy[i], b.drag, b.gravity, t).dx, sys.x[j], 1e-7) && near(20 + offsetAt(b.vx[i], b.vy[i], b.drag, b.gravity, t).dy, sys.y[j], 1e-7));
        expect(idx).toBeDefined();
        seen.add(idx as number);
        expect(near(sys.age[j], t, 1e-9)).toBe(true);
      }
    }
  });

  it('a stepped path equals the still picture used for reduced motion', () => {
    const b = makeBurst('heart', mulberry32(12));
    const still = staticBurst(b);
    const sys = createSystem(300);
    spawnBurst(sys, b, 0, 0);
    for (let i = 0; i < 42; i++) stepSystem(sys, FIXED_DT);
    expect(near(SNAPSHOT_T, 42 * FIXED_DT, 1e-12)).toBe(true);
    expect(sys.n).toBe(still.dx.length);
    const pairs = (xs: number[], ys: number[]) => xs.map((x, i) => `${x.toFixed(6)},${ys[i].toFixed(6)}`).sort();
    expect(pairs(Array.from(sys.x.slice(0, sys.n)), Array.from(sys.y.slice(0, sys.n)))).toEqual(pairs(still.dx, still.dy));
    expect(still.col.length).toBe(still.dx.length);
  });
});

describe('the particle system', () => {
  it('removes sparks when their time is up, and keeps the others correct (swap removal)', () => {
    const sys = createSystem(10);
    const mk = (life: number, vx: number) => ({ pattern: 'ring' as Pattern, n: 1, vx: Float64Array.from([vx]), vy: Float64Array.from([0]), life: Float64Array.from([life]), col: Uint8Array.from([1]), size: 1, drag: 1, gravity: 0, trail: 0 });
    spawnBurst(sys, mk(0.5, 1), 0, 0);
    spawnBurst(sys, mk(2, 2), 0, 0);
    spawnBurst(sys, mk(1, 3), 0, 0);
    stepSystem(sys, 0.6);
    expect(sys.n).toBe(2);
    stepSystem(sys, 0.6);
    expect(sys.n).toBe(1);
    expect(sys.vx[0]).toBeCloseTo(2 * Math.exp(-1.2), 12);
    stepSystem(sys, 1);
    expect(sys.n).toBe(0);
  });
  it('ignores a bad time step', () => {
    const sys = createSystem(10);
    spawnBurst(sys, makeBurst('peony', mulberry32(1)), 5, 5);
    const x0 = sys.x[0];
    for (const dt of [0, -1, NaN, Infinity]) stepSystem(sys, dt);
    expect(sys.x[0]).toBe(x0);
  });
  it('never passes its cap, thins a burst evenly when there is no room, and clears', () => {
    const sys = createSystem(50);
    const b = makeBurst('peony', mulberry32(1), { count: 100 });
    expect(spawnBurst(sys, b, 0, 0)).toBe(50);
    expect(sys.n).toBe(50);
    expect(spawnBurst(sys, b, 0, 0)).toBe(0);
    // The kept sparks are every second one of the burst.
    for (let k = 0; k < 50; k++) expect(sys.vx[k]).toBe(b.vx[Math.floor((k * 100) / 50)]);
    clearSystem(sys);
    expect(sys.n).toBe(0);
    expect(createSystem().x.length).toBe(MAX_PARTICLES);
  });
  it('stays finite and inside its cap over thousands of steps of random bursts, and always empties', () => {
    const rng = mulberry32(21);
    const sys = createSystem();
    let peak = 0;
    for (let i = 0; i < 6000; i++) {
      if (i % 25 === 0) spawnBurst(sys, makeBurst(PATTERNS[Math.floor(rng() * 5)], rng), rng() * WORLD_W, rng() * WORLD_H);
      stepSystem(sys, i % 7 === 0 ? 0.05 : FIXED_DT);
      peak = Math.max(peak, sys.n);
      expect(sys.n).toBeLessThanOrEqual(MAX_PARTICLES);
    }
    for (let i = 0; i < sys.n; i++) {
      expect(Number.isFinite(sys.x[i]) && Number.isFinite(sys.y[i]) && Number.isFinite(sys.vx[i]) && Number.isFinite(sys.vy[i])).toBe(true);
      expect(sys.age[i]).toBeLessThan(sys.life[i]);
    }
    expect(peak).toBeGreaterThan(300);
    for (let i = 0; i < 400; i++) stepSystem(sys, FIXED_DT);
    expect(sys.n).toBe(0);
  }, 30_000);
  it('fade runs from 1 to 0 and is clamped', () => {
    expect(fade(0, 2)).toBe(1);
    expect(fade(1, 2)).toBe(0.5);
    expect(fade(2, 2)).toBe(0);
    expect(fade(5, 2)).toBe(0);
    expect(fade(-1, 2)).toBe(1);
    expect(fade(1, 0)).toBe(0);
  });
});

describe('shells', () => {
  it('peaks exactly at the aimed point and bursts there, at the time physics says', () => {
    const rng = mulberry32(8);
    for (let n = 0; n < 40; n++) {
      const tx = 5 + rng() * 90; const ty = MIN_BURST_Y + rng() * (MAX_BURST_Y - MIN_BURST_Y);
      const x0 = launchOrigin(tx, rng);
      const sh = launchShell(x0, tx, ty, 'peony', 1);
      expect(near(sh.flight, Math.sqrt((2 * (WORLD_H - ty)) / SHELL_GRAVITY), 1e-9)).toBe(true);
      let top = Infinity;
      let t = 0;
      let exploded = false;
      while (!exploded && t < 10) {
        exploded = stepShell(sh, FIXED_DT);
        t += FIXED_DT;
        top = Math.min(top, sh.y);
        expect(sh.y).toBeLessThanOrEqual(WORLD_H + 1e-9);
      }
      expect(exploded).toBe(true);
      expect(sh.x).toBe(sh.tx);
      expect(sh.y).toBe(sh.ty);
      expect(near(sh.tx, tx, 1e-12)).toBe(true);
      expect(near(top, ty, 1e-9)).toBe(true); // the last position is the apex
      expect(Math.abs(t - sh.flight)).toBeLessThanOrEqual(FIXED_DT + 1e-9);
    }
  });
  it('rises and moves sideways smoothly on the way up (a parabola)', () => {
    const sh = launchShell(20, 70, 15, 'ring', 2);
    const half = sh.flight / 2;
    stepShell(sh, half);
    expect(near(sh.x, 20 + (70 - 20) / 2, 1e-9)).toBe(true);
    // At half time the rise is 3/4 of the whole rise, for constant gravity.
    expect(near(WORLD_H - sh.y, 0.75 * (WORLD_H - 15), 1e-9)).toBe(true);
  });
  it('clamps targets to the sky and repairs junk', () => {
    expect(launchShell(50, 50, -100, 'star', 1).ty).toBe(MIN_BURST_Y);
    expect(launchShell(50, 50, 1000, 'star', 1).ty).toBe(MAX_BURST_Y);
    expect(launchShell(50, -50, 20, 'star', 1).tx).toBe(1);
    expect(launchShell(50, 500, 20, 'star', 1).tx).toBe(WORLD_W - 1);
    const bad = launchShell(NaN, NaN, NaN, 'star', 1);
    expect(Number.isFinite(bad.vx) && Number.isFinite(bad.vy0) && Number.isFinite(bad.flight)).toBe(true);
    expect(launchOrigin(0, () => 0)).toBe(5);
    expect(launchOrigin(100, () => 1)).toBe(WORLD_W - 5);
  });
});

describe('safe flashing', () => {
  const check = (times: number[], max = 3, windowMs = 1000) => {
    const lim = makeFlashLimiter(max, windowMs);
    const accepted: number[] = [];
    let clock = -Infinity;
    for (const raw of times) {
      clock = Math.max(clock, raw);
      if (lim.allow(raw)) accepted.push(clock);
    }
    for (const t of accepted) {
      const inWindow = accepted.filter((u) => u >= t - windowMs && u <= t).length;
      expect(inWindow).toBeLessThanOrEqual(max);
    }
    return accepted;
  };
  it('lets through 3 flashes then refuses until a second has passed', () => {
    const lim = makeFlashLimiter();
    expect([0, 10, 20, 30, 500, 999].map((t) => lim.allow(t))).toEqual([true, true, true, false, false, false]);
    expect(lim.allow(1000)).toBe(false); // the flash at 0 is exactly 1000 ms ago and still counts
    expect(lim.allow(1001)).toBe(true);
    lim.reset();
    expect(lim.allow(5)).toBe(true);
  });
  it('never allows more than 3 in any 1000 ms window, for random, bunched, equal and backwards times', () => {
    const rng = mulberry32(31);
    for (let trial = 0; trial < 200; trial++) {
      const times: number[] = [];
      let t = 0;
      for (let i = 0; i < 80; i++) {
        t += rng() < 0.5 ? rng() * 40 : rng() * 900;
        times.push(rng() < 0.05 ? t - 300 : t);
      }
      check(times);
    }
    check(Array(50).fill(100));
    check(Array.from({ length: 200 }, (_, i) => i * 10));
    const steady = check(Array.from({ length: 100 }, (_, i) => i * 100));
    expect(steady.length).toBeGreaterThan(25); // still lets 3 a second through
  });
  it('refuses junk times and the generic limiter honours other limits', () => {
    const lim = makeFlashLimiter();
    expect(lim.allow(NaN)).toBe(false);
    expect(lim.allow(Infinity)).toBe(false);
    check([0, 1, 2, 3, 4, 5, 6, 7], 4, 500);
  });
});

describe('the show and the sound plan', () => {
  it('is deterministic, in range and never faster than the minimum gap', () => {
    for (let seed = 0; seed < 60; seed++) {
      const a = showSchedule(seed, 24);
      expect(JSON.stringify(a)).toBe(JSON.stringify(showSchedule(seed, 24)));
      expect(a.length).toBe(24);
      for (let i = 0; i < a.length; i++) {
        expect(a[i].x).toBeGreaterThanOrEqual(0.12);
        expect(a[i].x).toBeLessThanOrEqual(0.88);
        expect(a[i].y).toBeGreaterThanOrEqual(0.12);
        expect(a[i].y).toBeLessThanOrEqual(0.5);
        expect(isPattern(a[i].pattern)).toBe(true);
        if (i > 0) expect(a[i].at - a[i - 1].at).toBeGreaterThanOrEqual(SHOW_MIN_GAP_MS - 1);
      }
      for (let i = 21; i < 24; i++) expect(a[i].at - a[i - 1].at).toBeGreaterThanOrEqual(449);
    }
    expect(JSON.stringify(showSchedule(1, 24))).not.toBe(JSON.stringify(showSchedule(2, 24)));
    expect(showSchedule(1, 0)).toEqual([]);
  });
  it('every burst sound stays under the volume cap and is short', () => {
    expect(SOUND_PEAK).toBeLessThanOrEqual(0.15);
    for (const p of PATTERNS) for (let seed = 0; seed < 100; seed++) {
      const plan = soundPlan(p, mulberry32(seed));
      expect(plan.length).toBeGreaterThanOrEqual(4);
      expect(plan.length).toBeLessThanOrEqual(6);
      expect(plan.reduce((s, v) => s + v.gain, 0)).toBeLessThanOrEqual(SOUND_PEAK + 1e-12);
      for (const v of plan) {
        expect(v.delay + v.dur).toBeLessThanOrEqual(0.6);
        expect(v.f0).toBeGreaterThan(0);
        expect(v.f1).toBeGreaterThan(0);
        expect(['sine', 'triangle']).toContain(v.type);
      }
    }
  });
});

describe('sky, aim, sanitisers and words', () => {
  it('stars are repeatable and inside the upper sky', () => {
    expect(starField(5, 70)).toEqual(starField(5, 70));
    for (const s of starField(5, 200)) { expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThan(WORLD_W); expect(s.y).toBeLessThan(WORLD_H * 0.75); expect(s.b).toBeGreaterThan(0.2); expect(s.b).toBeLessThan(0.9); }
  });
  it('the aim stays inside the sky', () => {
    expect(moveAim({ x: 50, y: 20 }, 3, 0)).toEqual({ x: 53, y: 20 });
    expect(moveAim({ x: 2, y: 5 }, -50, -50)).toEqual({ x: 1, y: MIN_BURST_Y });
    expect(moveAim({ x: 98, y: 50 }, 50, 50)).toEqual({ x: WORLD_W - 1, y: MAX_BURST_Y });
  });
  it('rejects junk patterns and has a choice for each key 1 to 6', () => {
    for (const v of ['comet', '', null, undefined, 3, {}, [], '__proto__']) { expect(isPattern(v)).toBe(false); expect(isChoice(v)).toBe(false); }
    expect(CHOICES).toEqual(['random', 'peony', 'willow', 'ring', 'heart', 'star']);
    expect(PATTERNS.map((p) => PATTERN_LABEL[p])).toEqual(['Peony', 'Willow', 'Ring', 'Heart', 'Star']);
    expect(MAX_SHELLS).toBe(10);
    expect(LAUNCH_GAP_MS).toBe(220);
  });
  it('words are correct in every state and carry no em-dash', () => {
    expect(shareText(0)).toMatch(/about to launch/);
    expect(shareText(1)).toBe('Fireworks: I have launched 1 shell');
    expect(shareText(12)).toBe('Fireworks: I have launched 12 shells');
    expect(plural(2, 'shell')).toBe('2 shells');
    for (const t of RULES) expect(t.includes('—')).toBe(false);
  });
  it('the colour kit parses, mixes and the fixed-step helper never bursts after a pause', () => {
    expect(parseColour('#34d399')).toEqual([52, 211, 153]);
    expect(toCss([52, 211, 153])).toBe('#34d399');
    expect(eightTints({ sky: [56, 189, 248], green: [52, 211, 153], amber: [251, 191, 36], rose: [248, 113, 113] }).length).toBe(8);
    expect(advance(0, 9999, 16.7, 4).steps).toBeLessThanOrEqual(4);
    expect(advance(0, NaN, 16.7)).toEqual({ steps: 0, acc: 0 });
  });
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('sizes the canvas from its box times a capped pixel ratio and reads colours at run time', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/getComputedStyle/);
    expect(src).toMatch(/ResizeObserver/);
  });
  it('limits flashes to 3 a second, honours reduced motion and pauses on a hidden tab', () => {
    expect(src).toMatch(/makeFlashLimiter\(3, 1000\)/);
    expect(src).toMatch(/flashLimiter\.allow/);
    expect(src).toMatch(/prefers-reduced-motion: reduce/);
    expect(src).toMatch(/visibilitychange/);
  });
  it('starts with sound off behind a visible toggle, and handles pointer cancel and several fingers', () => {
    expect(src).toMatch(/let soundOn = false/);
    expect(src).toMatch(/Sound off/);
    expect(src).toMatch(/pointercancel/);
    expect(src).toMatch(/pointers = new Map/);
    expect(src.match(/touch-action:\s*none/g)?.length).toBe(1);
  });
  it('has a keyboard path and a live status line and offers no download', () => {
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/Nothing to download/);
    expect(src).not.toMatch(/localStorage|toBlob|createObjectURL/);
  });
});
