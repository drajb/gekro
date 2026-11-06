/**
 * games-soft-landing.test.ts - the engine behind `soft-landing`.
 *
 * Pinned: the integrator is a fixed 1/60 s step (in slow motion 0.8 of that in game time); with the thrusters off and
 * no wind the energy of a fall is conserved to within a small drift; thrust points along the craft's up axis and
 * burns fuel, and nothing works without fuel; the terrain generator always produces a flat pad of exactly the stated
 * width (Calm 120 units down to Hard 40), inside the world, with no step steeper than 16 between points, at every
 * level number and difficulty; a simulated autopilot that knows only where the pad is lands every seeded level
 * softly at every difficulty, at normal and slow-motion pace, using at most 65 percent of the fuel; the landing
 * limits are inclusive and are tested one tiny step either side of every boundary; a seed replays exactly; the
 * fixed-step clock plays the same flight on any screen; and the best-score storage rejects junk.
 */
import { describe, it, expect } from 'vitest';
import {
  makeLevel, cfgFor, groundY, judge, startCraft, launch, step, bodyPoints, windAt, readout, tiltLimitDeg, landingScore, keyToControl, keyScope, spaceIsNative,
  advanceClock, bestKey, parseBests, recordBest, crashMessage, shareText, plural, isDiff, mulberry32,
  W, H, DX, NPTS, DT, SLOW_TIME, FOOT_X, FOOT_Y, START_Y, ANG_CLAMP, SIDE_BURN, MAX_LEVEL, GROUND_MIN, GROUND_MAX, MAX_STEP, MAX_SCORE,
  DIFFS, CFG, NO_CONTROLS,
  type Craft, type Controls, type Diff, type Level,
} from '../src/components/apps-private/soft-landing/helpers';
import calculatorSource from '../src/components/apps-private/soft-landing/Calculator.astro?raw';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * An autopilot that sees only the craft's state and the pad's position (not the generator's rules): hover above the
 * pad's height, line up over the pad and kill the drift, then come down on a braking curve, steering the tilt to cancel
 * sideways drift and wind.
 */
const autopilot = (c: Craft): Controls => {
  const L = c.level;
  const cfg = L.cfg;
  const cx = (L.padX0 + L.padX1) / 2;
  const dx = cx - c.x;
  const h = L.padY - (c.y + FOOT_Y);
  const aB = Math.max(4, 0.6 * (cfg.thrust - cfg.g));
  const lean = cfg.control === 'rotate' ? Math.min(0.4, cfg.stab > 0 ? 0.85 * (cfg.rotAcc / cfg.stab) : 0.4) : 0.28;
  const aStop = Math.max(0.8, 0.6 * (cfg.g * Math.tan(lean) - cfg.windAmp));
  const descending = h < 68 ? Math.abs(dx) < 30 && Math.abs(c.vx) < 14 : Math.abs(dx) < 10 && Math.abs(c.vx) < 5;
  let vyDes: number;
  let vxDes: number;
  if (!descending) {
    const yHold = L.padY - FOOT_Y - 70;
    vyDes = clamp(0.8 * (yHold - c.y), -30, 40);
    vxDes = Math.sign(dx) * Math.min(30, Math.sqrt(2 * aStop * Math.max(Math.abs(dx) - 3, 0)));
  } else {
    vyDes = Math.min(40, Math.min(Math.sqrt(2 * aB * Math.max(h - 6, 0)), 0.28 * Math.max(h - 6, 0)) + 0.35 * cfg.vyMax);
    vxDes = clamp(dx * 0.8, -0.3 * cfg.vxMax, 0.3 * cfg.vxMax);
  }
  const wind = windAt(L, c.t);
  const axDes = 1.2 * (vxDes - c.vx) - wind;
  const upright = cfg.control === 'slide' || Math.cos(c.ang) > 0.85;
  if (cfg.control === 'slide') {
    return { up: c.vy > vyDes, left: axDes < -4, right: axDes > 4 };
  }
  let aDes = clamp(axDes / cfg.g, -lean, lean);
  if (descending && h < 30) aDes *= clamp(h / 30, 0, 1);
  const u = 6 * (aDes - c.ang) - 1.2 * c.w;
  return { up: upright && c.vy > vyDes, left: u < -0.4, right: u > 0.4 };
};

const fly = (level: Level, slow: boolean, pilot: (c: Craft) => Controls = autopilot, maxSteps = 60 * 90): Craft => {
  let c = launch(startCraft(level, slow));
  for (let i = 0; i < maxSteps && c.status === 'flying'; i++) c = step(c, pilot(c));
  return c;
};

describe('the world and the difficulties', () => {
  it('is a 400 x 300 world with ground points every 10 units and a fixed 1/60 s step', () => {
    expect([W, H, DX, NPTS]).toEqual([400, 300, 10, 41]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect(DIFFS).toEqual(['calm', 'easy', 'medium', 'hard']);
    expect(SLOW_TIME).toBe(0.8);
  });
  it('gets harder: stronger gravity and wind, a narrower pad, tighter landing limits', () => {
    for (let i = 1; i < DIFFS.length; i++) {
      const a = CFG[DIFFS[i - 1]];
      const b = CFG[DIFFS[i]];
      expect(b.g).toBeGreaterThan(a.g);
      expect(b.windAmp).toBeGreaterThanOrEqual(a.windAmp);
      expect(b.padK).toBeLessThan(a.padK);
      expect(b.vyMax).toBeLessThan(a.vyMax);
      expect(b.vxMax).toBeLessThan(a.vxMax);
    }
  });
  it('Calm slides sideways with no tilt; Easy turns with a strong auto-level, Hard has none', () => {
    expect(CFG.calm.control).toBe('slide');
    for (const d of ['easy', 'medium', 'hard'] as Diff[]) expect(CFG[d].control).toBe('rotate');
    expect(CFG.easy.stab).toBeGreaterThan(CFG.medium.stab);
    expect(CFG.medium.stab).toBeGreaterThan(CFG.hard.stab);
    expect(CFG.hard.stab).toBe(0);
    expect(CFG.calm.windAmp).toBe(0);
  });
  it('levels vary gravity, pad width and wind, gently, and stop changing at level 10', () => {
    for (const d of DIFFS) {
      const first = cfgFor(d, 1);
      const last = cfgFor(d, MAX_LEVEL);
      expect(first.g).toBe(CFG[d].g);
      expect(last.g).toBeGreaterThan(first.g);
      expect(last.g).toBeLessThan(first.g * 1.25);
      expect(last.padK).toBeLessThanOrEqual(first.padK);
      expect(last.padK).toBeGreaterThanOrEqual(CFG[d].padKMin);
      expect(last.windAmp).toBeGreaterThanOrEqual(first.windAmp);
      expect(cfgFor(d, 99)).toEqual(last);
      expect(cfgFor(d, -4)).toEqual(first);
      expect(cfgFor(d, 2.5)).toEqual(first);
      for (let n = 2; n <= MAX_LEVEL; n++) {
        expect(cfgFor(d, n).g).toBeGreaterThanOrEqual(cfgFor(d, n - 1).g);
        expect(cfgFor(d, n).padK).toBeLessThanOrEqual(cfgFor(d, n - 1).padK);
      }
    }
    expect(cfgFor('nope' as Diff, 1)).toEqual(CFG.medium);
    expect(isDiff('hard')).toBe(true);
    for (const bad of ['', 'HARD', null, undefined, 4]) expect(isDiff(bad as unknown)).toBe(false);
  });
});

describe('the terrain generator', () => {
  it('always has a flat pad of exactly the stated width, inside the world, at every difficulty and level', () => {
    for (const d of DIFFS) {
      for (let n = 1; n <= MAX_LEVEL; n++) {
        for (let seed = 1; seed <= 40; seed++) {
          const L = makeLevel(d, n, mulberry32(seed * 31 + n));
          const k = L.cfg.padK;
          expect(L.ys).toHaveLength(NPTS);
          expect(L.padI1 - L.padI0).toBe(k);
          expect(L.padX1 - L.padX0).toBe(k * DX);
          expect(L.padX0).toBeGreaterThanOrEqual(20);
          expect(L.padX1).toBeLessThanOrEqual(W - 20);
          for (let i = L.padI0; i <= L.padI1; i++) expect(L.ys[i]).toBe(L.padY);
          // flat means flat all the way along, not just at the points
          for (let x = L.padX0; x <= L.padX1; x += 1) expect(groundY(L.ys, x)).toBe(L.padY);
          expect(L.padY).toBeGreaterThanOrEqual(200);
          expect(L.padY).toBeLessThanOrEqual(258);
          // the pad is wide enough for the craft's feet with room to spare
          expect(L.padX1 - L.padX0).toBeGreaterThanOrEqual(2 * FOOT_X + 14);
        }
      }
    }
  });
  it('the ground stays inside its band and no step between points is steeper than 16', () => {
    for (const d of DIFFS) {
      for (let seed = 1; seed <= 150; seed++) {
        const L = makeLevel(d, 1 + (seed % MAX_LEVEL), mulberry32(seed));
        for (let i = 0; i < NPTS; i++) {
          expect(L.ys[i]).toBeGreaterThanOrEqual(GROUND_MIN);
          expect(L.ys[i]).toBeLessThanOrEqual(GROUND_MAX);
          if (i > 0) expect(Math.abs(L.ys[i] - L.ys[i - 1])).toBeLessThanOrEqual(MAX_STEP + 1e-9);
          expect(Number.isFinite(L.ys[i])).toBe(true);
        }
        expect(Math.abs(L.startVx)).toBeLessThanOrEqual(CFG[d].startVx);
      }
    }
  });
  it('the craft starts 50 to 160 units to one side of the pad, inside the world', () => {
    let near = 0;
    for (const d of DIFFS) {
      for (let seed = 1; seed <= 120; seed++) {
        const L = makeLevel(d, 1 + (seed % MAX_LEVEL), mulberry32(seed + 7));
        const off = Math.abs(L.startX - (L.padX0 + L.padX1) / 2);
        expect(L.startX).toBeGreaterThanOrEqual(40);
        expect(L.startX).toBeLessThanOrEqual(W - 40);
        expect(off).toBeLessThanOrEqual(160.5);
        if (off < 50) near++;
      }
    }
    expect(near).toBeLessThan(40); // the offset is only squeezed near the edges of the world
  });
  it('the pad lands in many places, not always the same one', () => {
    const spots = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) spots.add(makeLevel('medium', 1, mulberry32(seed)).padI0);
    expect(spots.size).toBeGreaterThan(10);
  });
  it('groundY interpolates between points and clamps outside the world', () => {
    const ys = Array.from({ length: NPTS }, (_, i) => 200 + (i % 2) * 10);
    expect(groundY(ys, 0)).toBe(200);
    expect(groundY(ys, 5)).toBe(205);
    expect(groundY(ys, 10)).toBe(210);
    expect(groundY(ys, W)).toBe(ys[NPTS - 1]);
    expect(groundY(ys, -50)).toBe(200);
    expect(groundY(ys, 9999)).toBe(ys[NPTS - 1]);
    expect(groundY(ys, NaN)).toBe(200);
  });
  it('the same seed gives the same level and a different seed a different one', () => {
    expect(makeLevel('hard', 3, mulberry32(8))).toEqual(makeLevel('hard', 3, mulberry32(8)));
    expect(makeLevel('hard', 3, mulberry32(8))).not.toEqual(makeLevel('hard', 3, mulberry32(9)));
  });
});

describe('the integrator', () => {
  const lvl = (d: Diff = 'medium', seed = 1) => makeLevel(d, 1, mulberry32(seed));
  const calmAir = (d: Diff = 'medium'): Level => {
    const L = lvl(d);
    return { ...L, cfg: { ...L.cfg, windAmp: 0 } };
  };
  it('does nothing until launched, and nothing once landed or crashed', () => {
    const c = startCraft(lvl(), false);
    expect(c.status).toBe('ready');
    expect(step(c, { up: true, left: false, right: false })).toBe(c);
    expect(launch(c).status).toBe('flying');
    const down = fly(lvl(), false, () => NO_CONTROLS);
    expect(down.status).toBe('crashed');
    expect(step(down, { up: true, left: false, right: false })).toBe(down);
  });
  it('starts high above the ground with the level\'s own sideways drift and a full tank', () => {
    const L = lvl('hard');
    const c = startCraft(L, false);
    expect([c.x, c.y, c.vx, c.vy, c.ang, c.fuel]).toEqual([L.startX, START_Y, L.startVx, 0, 0, L.cfg.fuel]);
  });
  it('free fall without wind or thrust follows the closed form for semi-implicit Euler', () => {
    const L = calmAir();
    const g = L.cfg.g;
    let c = launch(startCraft({ ...L, startX: 200, startVx: 0 }, false));
    c = { ...c, vx: 0 };
    const n = 30;
    for (let i = 0; i < n; i++) c = step(c, NO_CONTROLS);
    expect(c.vy).toBeCloseTo(n * g * DT, 9);
    expect(c.y).toBeCloseTo(START_Y + g * DT * DT * ((n * (n + 1)) / 2), 9);
    expect(c.vx).toBe(0);
  });
  it('energy sanity: with no thrust and no wind, 0.5 v^2 - g y stays within 1 percent of its start over a fall', () => {
    for (const d of DIFFS) {
      const L = calmAir(d);
      let c = launch(startCraft({ ...L, startX: 200, startVx: 0 }, false));
      const e = (k: Craft) => 0.5 * (k.vx * k.vx + k.vy * k.vy) - L.cfg.g * k.y;
      const e0 = e(c);
      const scale = Math.abs(e0) + L.cfg.g * 100;
      for (let i = 0; i < 90; i++) {
        c = step(c, NO_CONTROLS);
        if (c.status !== 'flying') break;
        expect(Math.abs(e(c) - e0) / scale).toBeLessThan(0.01);
      }
    }
  });
  it('slow motion takes 0.8 of the game time per step and follows the same path', () => {
    const L = calmAir();
    let a = launch(startCraft(L, false));
    let b = launch(startCraft(L, true));
    for (let i = 0; i < 100; i++) { a = step(a, NO_CONTROLS); b = step(b, NO_CONTROLS); }
    expect(b.t).toBeCloseTo(100 * DT * 0.8, 9);
    expect(a.t).toBeCloseTo(100 * DT, 9);
    // after the same game time both are at the same place (a at step 80 equals b at step 100)
    let a80 = launch(startCraft(L, false));
    for (let i = 0; i < 80; i++) a80 = step(a80, NO_CONTROLS);
    expect(b.t).toBeCloseTo(a80.t, 9);
    expect(b.vy).toBeCloseTo(a80.vy, 6);
    expect(Math.abs(b.y - a80.y)).toBeLessThan(0.5); // same path, sampled with a different step
  });
  it('main thrust pushes along the craft\'s up axis: straight up when level, sideways when tilted', () => {
    const L = calmAir('hard');
    const T = L.cfg.thrust;
    const g = L.cfg.g;
    const up = step({ ...launch(startCraft({ ...L, startVx: 0 }, false)), vx: 0 }, { up: true, left: false, right: false });
    expect(up.vy).toBeCloseTo((g - T) * DT, 9);
    expect(up.vx).toBeCloseTo(0, 9);
    const tilted = step({ ...launch(startCraft({ ...L, startVx: 0 }, false)), vx: 0, ang: 0.3 }, { up: true, left: false, right: false });
    expect(tilted.vx).toBeGreaterThan(0.1); // clockwise tilt pushes right
    const w1 = step({ ...launch(startCraft({ ...L, startVx: 0 }, false)), vx: 0, ang: 0.3, w: 0 }, NO_CONTROLS);
    expect(w1.vx).toBeCloseTo(0, 9);
  });
  it('fuel burns by one per step of thrust and a quarter for steering; with none left the controls do nothing', () => {
    const L = calmAir('hard');
    let c = launch(startCraft(L, false));
    const f0 = c.fuel;
    c = step(c, { up: true, left: false, right: false });
    expect(c.fuel).toBe(f0 - 1);
    c = step(c, { up: false, left: true, right: false });
    expect(c.fuel).toBe(f0 - 1 - SIDE_BURN);
    c = step(c, { up: true, left: true, right: true });
    expect(c.fuel).toBe(f0 - 2 - SIDE_BURN); // left and right cancel: no steering cost
    const dry = { ...launch(startCraft(L, false)), fuel: 0 };
    const after = step(dry, { up: true, left: true, right: false });
    expect(after.fuel).toBe(0);
    expect(after.vy).toBeCloseTo(L.cfg.g * DT, 9);
    expect(after.w).toBe(0);
  });
  it('steering turns the craft, the auto-level pulls it back, and the tilt is capped', () => {
    const E = calmAir('easy');
    let c = launch(startCraft(E, false));
    for (let i = 0; i < 20; i++) c = step({ ...c, y: 100, vy: 0 }, { up: false, left: false, right: true });
    expect(c.ang).toBeGreaterThan(0.02);
    const peak = c.ang;
    for (let i = 0; i < 120; i++) c = step({ ...c, y: 100, vy: 0 }, NO_CONTROLS);
    expect(Math.abs(c.ang)).toBeLessThan(peak * 0.1); // easy levels itself again
    const Hd = calmAir('hard');
    let d = launch(startCraft(Hd, false));
    for (let i = 0; i < 400; i++) d = step({ ...d, y: 100, vy: 0 }, { up: false, left: true, right: false });
    expect(d.ang).toBeGreaterThanOrEqual(-ANG_CLAMP - 1e-9);
    expect(d.ang).toBeLessThan(-0.5);
    // hard has no auto-level: after letting go, the tilt is still there after a while
    const held = d.ang;
    for (let i = 0; i < 60; i++) d = step({ ...d, y: 100, vy: 0 }, NO_CONTROLS);
    expect(Math.abs(d.ang)).toBeGreaterThan(Math.abs(held) * 0.8);
  });
  it('Calm pushes sideways and stays upright', () => {
    const C = calmAir('calm');
    let c = launch({ ...startCraft({ ...C, startVx: 0 }, false), vx: 0 });
    for (let i = 0; i < 30; i++) c = step({ ...c, y: 100, vy: 0 }, { up: false, left: false, right: true });
    expect(c.vx).toBeGreaterThan(5);
    expect(c.ang).toBe(0);
    for (let i = 0; i < 30; i++) c = step({ ...c, y: 100, vy: 0 }, { up: false, left: true, right: false });
    expect(c.vx).toBeLessThan(5);
  });
  it('the walls and the ceiling stop the craft', () => {
    const L = calmAir('calm');
    let c = launch({ ...startCraft(L, false), x: 12, vx: -200, y: 100 });
    c = step(c, NO_CONTROLS);
    expect(c.x).toBeGreaterThanOrEqual(10);
    expect(c.vx).toBeGreaterThanOrEqual(0);
    c = launch({ ...startCraft(L, false), x: 388, vx: 200, y: 100 });
    c = step(c, NO_CONTROLS);
    expect(c.x).toBeLessThanOrEqual(390);
    expect(c.vx).toBeLessThanOrEqual(0);
    c = launch({ ...startCraft(L, false), y: 12, vy: -300 });
    c = step(c, NO_CONTROLS);
    expect(c.y).toBeGreaterThanOrEqual(10);
    expect(c.vy).toBeGreaterThanOrEqual(0);
  });
  it('wind pushes sideways with a smooth, bounded gust', () => {
    const L = makeLevel('hard', 5, mulberry32(3));
    let maxW = 0;
    for (let t = 0; t < 60; t += 0.05) maxW = Math.max(maxW, Math.abs(windAt(L, t)));
    expect(maxW).toBeLessThanOrEqual(L.cfg.windAmp + 1e-9);
    expect(maxW).toBeGreaterThan(L.cfg.windAmp * 0.9);
    expect(Math.abs(windAt(makeLevel('calm', 1, mulberry32(3)), 4))).toBe(0);
  });
  it('does not change the state it was given', () => {
    const c = launch(startCraft(lvl(), false));
    const before = JSON.stringify(c);
    step(c, { up: true, left: true, right: false });
    expect(JSON.stringify(c)).toBe(before);
  });
  it('is deterministic: the same level and the same controls replay the same flight', () => {
    const trace = (seed: number) => {
      let c = launch(startCraft(makeLevel('medium', 2, mulberry32(seed)), false));
      const out: string[] = [];
      for (let i = 0; i < 400 && c.status === 'flying'; i++) {
        c = step(c, autopilot(c));
        out.push(`${c.x.toFixed(6)},${c.y.toFixed(6)},${c.ang.toFixed(6)}`);
      }
      return out;
    };
    expect(trace(21)).toEqual(trace(21));
    expect(trace(21)).not.toEqual(trace(22));
  });
});

describe('landing judgement: limits are inclusive, tested either side of every boundary', () => {
  const eps = 1e-6;
  for (const d of DIFFS) {
    const cfg = CFG[d];
    const ok = { vx: 0, vy: 0, ang: 0, onPad: true };
    it(`${d}: the vertical limit ${cfg.vyMax}`, () => {
      expect(judge({ ...ok, vy: cfg.vyMax }, cfg)).toEqual({ ok: true, reason: null });
      expect(judge({ ...ok, vy: cfg.vyMax - eps }, cfg).ok).toBe(true);
      expect(judge({ ...ok, vy: cfg.vyMax + eps }, cfg)).toEqual({ ok: false, reason: 'fast' });
    });
    it(`${d}: the sideways limit ${cfg.vxMax}, left and right`, () => {
      for (const sign of [1, -1]) {
        expect(judge({ ...ok, vx: sign * cfg.vxMax }, cfg).ok).toBe(true);
        expect(judge({ ...ok, vx: sign * (cfg.vxMax + eps) }, cfg)).toEqual({ ok: false, reason: 'sideways' });
      }
    });
    it(`${d}: the tilt limit ${cfg.control === 'rotate' ? cfg.angMax : 'does not apply'}`, () => {
      if (cfg.control === 'rotate') {
        for (const sign of [1, -1]) {
          expect(judge({ ...ok, ang: sign * cfg.angMax }, cfg).ok).toBe(true);
          expect(judge({ ...ok, ang: sign * (cfg.angMax + eps) }, cfg)).toEqual({ ok: false, reason: 'tilt' });
        }
      } else {
        expect(judge({ ...ok, ang: 1 }, cfg).ok).toBe(true);
      }
    });
    it(`${d}: off the pad is never a soft landing, and not-a-number never is either`, () => {
      expect(judge({ ...ok, onPad: false }, cfg)).toEqual({ ok: false, reason: 'pad' });
      expect(judge({ ...ok, vy: NaN }, cfg).ok).toBe(false);
      expect(judge({ ...ok, vx: NaN }, cfg).ok).toBe(false);
    });
  }
  it('says the first thing wrong: pad, then fast, then sideways, then tilt', () => {
    const cfg = CFG.hard;
    const all = { vx: 99, vy: 99, ang: 1, onPad: false };
    expect(judge(all, cfg).reason).toBe('pad');
    expect(judge({ ...all, onPad: true }, cfg).reason).toBe('fast');
    expect(judge({ ...all, onPad: true, vy: 0 }, cfg).reason).toBe('sideways');
    expect(judge({ ...all, onPad: true, vy: 0, vx: 0 }, cfg).reason).toBe('tilt');
  });
  it('the engine lands on the pad at exactly the limit and crashes just over it', () => {
    const L = makeLevel('medium', 1, mulberry32(4));
    const cfg = L.cfg;
    const cx = (L.padX0 + L.padX1) / 2;
    // Put the craft just above the pad, falling at a chosen speed.
    const drop = (vy: number, vx = 0, ang = 0): Craft => {
      const hOver = 0.1;
      const c = launch(startCraft({ ...L, cfg: { ...cfg, windAmp: 0 } }, false));
      return { ...c, x: cx, y: L.padY - FOOT_Y - hOver, vx, vy: vy - cfg.g * DT, ang, w: 0 };
    };
    const land = (c0: Craft) => { let c = c0; for (let i = 0; i < 20 && c.status === 'flying'; i++) c = step(c, NO_CONTROLS); return c; };
    expect(land(drop(cfg.vyMax - 0.5)).status).toBe('landed');
    expect(land(drop(cfg.vyMax + 0.5)).status).toBe('crashed');
    expect(land(drop(cfg.vyMax + 0.5)).reason).toBe('fast');
    expect(land(drop(10, cfg.vxMax - 0.5)).status).toBe('landed');
    expect(land(drop(10, cfg.vxMax + 0.5)).reason).toBe('sideways');
    expect(land(drop(10, 0, cfg.angMax - 0.01)).status).toBe('landed');
    expect(land(drop(10, 0, cfg.angMax + 0.03)).reason).toBe('tilt');
    const ended = land(drop(10));
    expect(ended.status).toBe('landed');
    expect(ended.vy).toBe(0);
    expect(ended.touch).not.toBeNull();
  });
  it('touching down with a foot off the pad is a crash even when slow and level', () => {
    const L = makeLevel('medium', 1, mulberry32(4));
    const c = launch(startCraft({ ...L, cfg: { ...L.cfg, windAmp: 0 } }, false));
    const edge = { ...c, x: L.padX1 + 2, y: groundY(L.ys, L.padX1 + 2) - FOOT_Y - 1, vx: 0, vy: 5, ang: 0 };
    let k = edge;
    for (let i = 0; i < 30 && k.status === 'flying'; i++) k = step(k, NO_CONTROLS);
    expect(k.status).toBe('crashed');
    expect(k.reason).toBe('pad');
  });
});

describe('an autopilot lands every seeded level', () => {
  for (const diff of DIFFS) {
    for (const slow of [false, true]) {
      it(`${diff}${slow ? ' (slow motion)' : ''}: 30 seeds at each of levels 1 to 10 land softly using at most 65 percent of the fuel`, () => {
        let worstFuel = 0;
        let failures = 0;
        const notes: string[] = [];
        for (let n = 1; n <= MAX_LEVEL; n++) {
          for (let seed = 1; seed <= 30; seed++) {
            const L = makeLevel(diff, n, mulberry32(seed * 977 + n));
            const end = fly(L, slow);
            const used = (L.cfg.fuel - end.fuel) / L.cfg.fuel;
            worstFuel = Math.max(worstFuel, used);
            if (end.status !== 'landed') { failures++; if (notes.length < 5) notes.push(`n${n} seed${seed}: ${end.status} ${end.reason} vy=${end.touch?.vy.toFixed(1)} vx=${end.touch?.vx.toFixed(1)} ang=${end.touch?.ang.toFixed(2)}`); }
          }
        }
        expect(failures, notes.join(' | ')).toBe(0);
        expect(worstFuel).toBeLessThanOrEqual(0.65);
      }, 60_000);
    }
  }
  it('a craft that never fires its engine crashes on every difficulty', () => {
    for (const d of DIFFS) {
      for (let seed = 1; seed <= 10; seed++) {
        const end = fly(makeLevel(d, 1, mulberry32(seed)), false, () => NO_CONTROLS);
        expect(end.status, d).toBe('crashed');
      }
    }
  });
  it('a random button masher almost never lands on Hard', () => {
    let landed = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = mulberry32(seed + 500);
      const end = fly(makeLevel('hard', 1, mulberry32(seed)), false, () => ({ up: r() < 0.5, left: r() < 0.3, right: r() < 0.3 }));
      if (end.status === 'landed') landed++;
    }
    expect(landed).toBeLessThan(6);
  });
});

describe('readouts, scoring and keys', () => {
  it('shows speeds, tilt and fuel as whole numbers with an ok flag against the limits', () => {
    const L = makeLevel('medium', 1, mulberry32(2));
    const cfg = L.cfg;
    const c = { ...launch(startCraft(L, false)), vx: -cfg.vxMax - 3, vy: cfg.vyMax - 1, ang: -(cfg.angMax + 0.05), fuel: cfg.fuel / 2 };
    const r = readout(c);
    expect(r.side).toBe(Math.round(cfg.vxMax + 3));
    expect(r.down).toBe(Math.round(cfg.vyMax - 1));
    expect(r.fuelPct).toBe(50);
    expect([r.sideOk, r.downOk, r.tiltOk]).toEqual([false, true, false]);
    expect(r.tilt).toBe(Math.round(((cfg.angMax + 0.05) * 180) / Math.PI));
    expect(readout({ ...c, fuel: -5 }).fuelPct).toBe(0);
    expect(readout(startCraft(makeLevel('calm', 1, mulberry32(2)), false)).tiltOk).toBe(true);
    for (const v of Object.values(r)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
  });
  it('a number shown equal to or under its limit is never labelled too much, and one labelled too much is never shown at the limit', () => {
    for (const d of DIFFS) {
      const L = makeLevel(d, 1, mulberry32(3));
      const cfg = L.cfg;
      const base = launch(startCraft(L, false));
      const degLimit = tiltLimitDeg(cfg);
      for (let i = -20; i <= 20; i++) {
        const dv = i * 0.1;
        const r = readout({ ...base, vy: cfg.vyMax + dv, vx: cfg.vxMax + dv, ang: cfg.angMax + dv * 0.01 });
        expect(r.downOk ? r.down <= Math.round(cfg.vyMax) : r.down > Math.round(cfg.vyMax)).toBe(true);
        expect(r.sideOk ? r.side <= Math.round(cfg.vxMax) : r.side > Math.round(cfg.vxMax)).toBe(true);
        if (cfg.control === 'rotate') expect(r.tiltOk ? r.tilt <= degLimit : r.tilt > degLimit).toBe(true);
      }
    }
  });
  it('a soft landing scores 50 plus up to 50 for fuel left', () => {
    expect(landingScore(0, 1000)).toBe(50);
    expect(landingScore(1000, 1000)).toBe(100);
    expect(landingScore(500, 1000)).toBe(75);
    expect(landingScore(2000, 1000)).toBe(100);
    expect(landingScore(-5, 1000)).toBe(50);
    expect(landingScore(NaN, 1000)).toBe(50);
    expect(landingScore(5, 0)).toBe(50);
  });
  it('Space, Up and W thrust; A/D and the Left/Right arrows steer; nothing else does', () => {
    for (const k of [' ', 'ArrowUp', 'w', 'W']) expect(keyToControl(k), k).toBe('up');
    for (const k of ['ArrowLeft', 'a', 'A']) expect(keyToControl(k), k).toBe('left');
    for (const k of ['ArrowRight', 'd', 'D']) expect(keyToControl(k), k).toBe('right');
    for (const k of ['Enter', 'ArrowDown', 's', 'p', 'Escape', 'x', '']) expect(keyToControl(k), k).toBeNull();
  });
  it('key capture scope: game keys only in the game or while flying, pause keys always', () => {
    for (const p of ['ready', 'flying', 'paused', 'over'] as const) expect(keyScope(p, true)).toBe('all');
    expect(keyScope('flying', false)).toBe('all');
    expect(keyScope('paused', false)).toBe('resume');
    expect(keyScope('ready', false)).toBe('none');
    expect(keyScope('over', false)).toBe('none');
    expect(spaceIsNative('BUTTON')).toBe(true);
    expect(spaceIsNative('CANVAS')).toBe(false);
  });
  it('bodyPoints turns the feet and shoulders with the tilt', () => {
    const level = bodyPoints(100, 100, 0);
    expect(level.feet).toEqual([[100 - FOOT_X, 100 + FOOT_Y], [100 + FOOT_X, 100 + FOOT_Y]]);
    const quarter = bodyPoints(100, 100, Math.PI / 2);
    expect(quarter.feet[0][0]).toBeCloseTo(100 - FOOT_Y, 9);
    expect(quarter.feet[0][1]).toBeCloseTo(100 - FOOT_X, 9);
  });
});

describe('the fixed-step clock', () => {
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
  it('a long stall cannot fast-forward the flight; bad numbers are harmless', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(r.acc).toBeLessThan(1000 / 60);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
  });
  it('a 60 Hz and a 144 Hz screen fly the same landing', () => {
    const flyAt = (hz: number) => {
      let c = launch(startCraft(makeLevel('medium', 1, mulberry32(33)), false));
      let acc = 0;
      for (let f = 0; f < hz * 12 && c.status === 'flying'; f++) {
        const r = advanceClock(acc, 1000 / hz);
        acc = r.acc;
        for (let i = 0; i < r.steps && c.status === 'flying'; i++) c = step(c, autopilot(c));
      }
      return c;
    };
    const a = flyAt(60);
    const b = flyAt(144);
    expect(a.status).toBe(b.status);
    expect(Math.abs(a.steps - b.steps)).toBeLessThanOrEqual(2);
  });
});

describe('best scores and messages', () => {
  it('has one key per difficulty and pace', () => {
    expect(new Set(DIFFS.flatMap((d) => [bestKey(d, false), bestKey(d, true)])).size).toBe(8);
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ medium: 240, hard: '9', easy: 1.5, 'calm-slow': -3, nope: 4, 'easy-slow': 99999999 })).toEqual({ medium: 240 });
    expect(parseBests(JSON.parse('{"__proto__":{"hard":50},"hard":7}'))).toEqual({ hard: 7 });
  });
  it('only a whole, positive, possible score can set a best, and only if higher', () => {
    const k = bestKey('medium', false);
    let r = recordBest({}, k, 130);
    expect(r).toEqual({ bests: { [k]: 130 }, improved: true });
    expect(recordBest(r.bests, k, 130).improved).toBe(false);
    expect(recordBest(r.bests, k, 90).improved).toBe(false);
    r = recordBest(r.bests, k, 200);
    expect(r.bests[k]).toBe(200);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
  });
  it('says why a landing failed, and builds a share line that is right in every state', () => {
    for (const r of ['pad', 'fast', 'sideways', 'tilt', 'ground', null] as const) expect(crashMessage(r)).toMatch(/^The craft /);
    expect(crashMessage('fast')).toBe('The craft came down too fast.');
    expect(shareText('medium', null, 0)).toBe('Soft Landing (Medium): no landing yet');
    expect(shareText('hard', { landings: 1, score: 88 }, 88)).toBe('Soft Landing (Hard): 1 soft landing, score 88, best 88');
    expect(shareText('calm', { landings: 4, score: 380 }, 0)).toBe('Soft Landing (Calm): 4 soft landings, score 380');
    for (const t of [shareText('easy', { landings: 0, score: 0 }, 0), crashMessage('tilt')]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(plural(1, 'x', 'xs')).toBe('1 x');
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('the three thruster buttons are at least 56 px tall and the how-it-works heading is a 32 px target', () => {
    const btn = src.match(/#sfl-app \.sfl-ctl \{([^}]*)\}/);
    expect(btn).not.toBeNull();
    expect(btn![1]).toContain('min-height: 3.5rem');
    const rule = src.match(/\.sfl-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
  it('releases every held control when the tab hides, focus leaves or the game pauses', () => {
    expect(src).toContain('const releaseAll = () =>');
    expect(src).toContain("addEventListener('blur'");
    expect(src).toContain('document.hidden');
  });
  it('pauses on Escape and P and honours reduced motion; starts on the first input', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('const reduced = mq.matches;');
    expect(src).toContain('launch(craft)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
  });
  it('a held key does not repeat its action and a keyboard click on a thruster button gives a short burst', () => {
    expect(src).toContain('if (e.detail !== 0) return;');
    expect(src).toContain('if (e.repeat) return;');
  });
});

describe('review fixes in the page', () => {
  const src = calculatorSource;
  it('a held thruster lets go when the pointer slides off its button', () => {
    expect(src).toContain("btn.addEventListener('pointermove'");
    expect(src).toContain('getBoundingClientRect()');
  });
  it('keeps each degree sign attached to its number', () => {
    expect(src).toContain('id="sfl-tilt" class="sfl-v">0&deg;</span>');
    expect(src).toContain('id="sfl-tilt-lim">0&deg;</span>');
  });
});
