/**
 * games-cannon-shot.test.ts - the engine behind `cannon-shot`.
 *
 * Pinned: the arc is the closed-form drag-free one (range v squared sin(2 angle) over g from level
 * ground, 45 degrees farthest, complementary angles equal, and the engine's landing point matches both the
 * formula and an independent tiny-step integrator), the ball never moves far enough in one check to slip
 * through a crate or balloon, hits match an independent fine-grained collision check on thousands of random
 * shots, a broken crate drops everything above it in its column and sideways contact holds nothing, a falling
 * crate pops the balloons it passes or lands on, every generated level is valid and deterministic by seed, and
 * in every generated level every balloon can be popped by a shot that never touches a crate (found by a
 * brute-force search over all 7371 angle and power pairs and re-checked by the independent integrator), a full
 * plan of shots clears each level within its shot budget, stars and stored counts are bounded, and a random
 * play fuzz never breaks a level. The art rule (no birds, slingshots, pigs, worms or tanks) is checked on
 * the page source.
 */
import { describe, it, expect } from 'vitest';
import {
  WORLD_W, WORLD_H, GRAVITY, V_MAX, BALL_R, BALLOON_R, CANNON, BARREL, ANGLE_MIN, ANGLE_MAX, POWER_MIN, POWER_MAX, DT, SPECS,
  DIFFICULTIES, TOWER_X_MIN, TOWER_X_MAX, MAX_CLEARED,
  muzzle, arcAt, timeToGround, landingXFrom, landingX, idealRange, speedFor, aimGuide, clampAngle, clampPower,
  levelValid, settle, makeSim, simulateShot, resolveShot, levelStatus, shotsUsed, starsFor, allShots, nextShot, findSolution, generateLevel,
  parseSeed, parseDifficulty, sanitiseCleared, toStored, emptyCleared, plural, summary, shareText, mulberry32, parseColour, toCss, mixOklch,
  type Level, type Crate, type Balloon, type Difficulty,
} from '../src/components/apps-private/cannon-shot/helpers';
import calculatorSource from '../src/components/apps-private/cannon-shot/Calculator.astro?raw';
import helpersSource from '../src/components/apps-private/cannon-shot/helpers.ts?raw';

const rad = (d: number) => (d * Math.PI) / 180;
const mkLevel = (crates: [number, number][], balloons: [number, number][], shots = 5, difficulty: Difficulty = 'easy'): Level => ({
  difficulty, seed: 1,
  crates: crates.map(([x, y], i) => ({ id: i + 1, x, y })),
  balloons: balloons.map(([x, y], i) => ({ id: i + 1, x, y })),
  shots, shotsAtStart: shots, balloonsAtStart: balloons.length,
});
const empty = mkLevel([], []);

/** Independent oracle: fine fixed-step integration of the equations of motion (semi-implicit Euler). */
const integrate = (angle: number, power: number, dt = 1e-5) => {
  const m = { x: CANNON.x + BARREL * Math.cos(rad(angle)), y: CANNON.y + BARREL * Math.sin(rad(angle)) };
  const v = (V_MAX * power) / 100;
  let vx = v * Math.cos(rad(angle));
  let vy = v * Math.sin(rad(angle));
  let x = m.x; let y = m.y;
  while (y > 0) { vy -= GRAVITY * dt; x += vx * dt; y += vy * dt; }
  return x;
};

/** Independent oracle for collisions: walk the exact arc in tiny time steps and test overlaps with plain geometry. */
const naiveShot = (lv: Pick<Level, 'crates' | 'balloons'>, angle: number, power: number) => {
  const popped = new Set<number>();
  let crateHit: number | null = null;
  const dt = 1 / 4800;
  for (let t = dt; t < 9; t += dt) {
    const p = arcAt(angle, power, t);
    if (p.y <= 0 || p.x > WORLD_W + 1) break;
    for (const b of lv.balloons) if (Math.hypot(p.x - (b.x + 0.5), p.y - (b.y + 0.5)) < BALLOON_R + BALL_R) popped.add(b.id);
    let best: number | null = null;
    for (const c of lv.crates) {
      const nx = Math.min(Math.max(p.x, c.x), c.x + 1);
      const ny = Math.min(Math.max(p.y, c.y), c.y + 1);
      if (Math.hypot(p.x - nx, p.y - ny) < BALL_R && (best === null || c.id < best)) best = c.id;
    }
    if (best !== null) { crateHit = best; break; }
  }
  return { popped, crateHit };
};

describe('the arc', () => {
  it('range on level ground is v squared times sin(2 angle) over g, to rounding', () => {
    for (let v = 1; v <= 25; v += 3) for (let a = 5; a <= 85; a += 5) {
      expect(landingXFrom(0, 0, v, a)).toBeCloseTo(idealRange(v, a), 9);
      expect(idealRange(v, a)).toBeCloseTo((v * v * Math.sin(rad(2 * a))) / GRAVITY, 9);
    }
  });
  it('45 degrees goes farthest on level ground and complementary angles land together', () => {
    for (const v of [5, 12, 22]) {
      for (let a = 5; a <= 85; a += 1) expect(landingXFrom(0, 0, v, a)).toBeLessThanOrEqual(landingXFrom(0, 0, v, 45) + 1e-9);
      for (const a of [10, 25, 40, 60]) expect(landingXFrom(0, 0, v, a)).toBeCloseTo(landingXFrom(0, 0, v, 90 - a), 9);
    }
  });
  it('launching from height lands farther than from the ground, and doubling the speed quadruples the range', () => {
    expect(landingXFrom(0, 1, 10, 30)).toBeGreaterThan(landingXFrom(0, 0, 10, 30));
    expect(landingXFrom(0, 0, 20, 40) / landingXFrom(0, 0, 10, 40)).toBeCloseTo(4, 9);
  });
  it('the highest point is half way through the flight: height v squared sin squared over 2g', () => {
    for (const [a, p] of [[30, 60], [60, 100], [45, 40]]) {
      const v = speedFor(p);
      const m = muzzle(a);
      const tTop = (v * Math.sin(rad(a))) / GRAVITY;
      expect(arcAt(a, p, tTop).y).toBeCloseTo(m.y + (v * v * Math.sin(rad(a)) ** 2) / (2 * GRAVITY), 9);
      expect(arcAt(a, p, 0)).toEqual(m);
    }
  });
  it('the engine lands where an independent tiny-step integrator lands', () => {
    for (let a = 10; a <= 80; a += 10) for (const p of [30, 45, 60]) {
      if (landingX(a, p) > WORLD_W) continue;
      const r = simulateShot(empty, a, p);
      expect(r.end.kind).toBe('ground');
      expect(r.end.x).toBeCloseTo(landingX(a, p), 9);
      expect(Math.abs(r.end.x - integrate(a, p))).toBeLessThan(0.01);
      expect(r.end.y).toBe(0);
      expect(r.end.t).toBeCloseTo(timeToGround(muzzle(a).y, speedFor(p) * Math.sin(rad(a))), 9);
    }
  });
  it('a shot that would land past the far edge reports out, and more power always goes farther', () => {
    expect(simulateShot(empty, 45, 100).end.kind).toBe('out');
    for (const a of [10, 30, 45, 70, 85]) {
      let prev = -1;
      for (let p = POWER_MIN; p <= POWER_MAX; p++) { const x = landingX(a, p); expect(x).toBeGreaterThan(prev); prev = x; }
    }
  });
  it('recorded path points sit on the closed-form arc every 1/240 second', () => {
    const r = simulateShot(empty, 50, 55, true);
    for (const k of [0, 1, 2, 10, 100, 250]) {
      const p = arcAt(50, 55, k * DT);
      if (2 * k + 1 < r.path.length - 2) {
        expect(r.path[2 * k]).toBeCloseTo(p.x, 9);
        expect(r.path[2 * k + 1]).toBeCloseTo(p.y, 9);
      }
    }
    expect(r.path[r.path.length - 1]).toBe(0);
  });
  it('the ball moves less than a fifth of a square between checks, so it cannot slip through', () => {
    expect(V_MAX * DT).toBeLessThan(0.1);
    expect(V_MAX * DT).toBeLessThan(2 * BALL_R / 3);
  });
  it('the dotted guide follows the arc and stops at the ground', () => {
    const g = aimGuide(45, 60);
    expect(g.length).toBeGreaterThan(5);
    g.forEach((p, i) => { const q = arcAt(45, 60, (i + 1) * 0.12); expect(p.x).toBeCloseTo(q.x, 9); expect(p.y).toBeCloseTo(q.y, 9); });
    for (const p of aimGuide(80, 100, 99)) expect(p.y).toBeGreaterThanOrEqual(-1e-9);
    expect(aimGuide(5, 10).length).toBeLessThan(5);
  });
  it('clamps angle and power to the controls, and survives NaN', () => {
    expect([clampAngle(-5), clampAngle(200), clampAngle(45.4), clampAngle(NaN)]).toEqual([ANGLE_MIN, ANGLE_MAX, 45, 45]);
    expect([clampPower(-5), clampPower(200), clampPower(60.6), clampPower(NaN)]).toEqual([POWER_MIN, POWER_MAX, 61, 60]);
    expect(allShots().length).toBe((ANGLE_MAX - ANGLE_MIN + 1) * (POWER_MAX - POWER_MIN + 1));
    expect(allShots().length).toBe(7371);
  });
});

describe('collisions', () => {
  it('a ball stops at the first crate it touches and breaks that one', () => {
    const lv = mkLevel([[12, 0], [12, 1], [12, 2]], []);
    const r = simulateShot(lv, 20, 70);
    expect(r.end.kind).toBe('crate');
    expect(r.hits.length).toBe(1);
    expect(r.hits[0].kind).toBe('crate');
    expect(r.end.x).toBeLessThan(12);
    expect(r.end.x).toBeCloseTo(12 - BALL_R, 3); // stops on the crate's face, found by bisection between two checks
  });
  it('a balloon behind a crate on the same line is not popped, and a balloon in front is', () => {
    const lv = mkLevel([[14, 0], [14, 1], [14, 2], [14, 3]], [[10, 2]]);
    // find the straight-ish shot into the wall and check ordering with the oracle
    let seenFront = false;
    for (const [a, p] of allShots(3)) {
      const r = simulateShot(lv, a, p);
      const n = naiveShot(lv, a, p);
      if (r.hits.some((h) => h.kind === 'balloon')) { seenFront = true; expect(n.popped.has(1)).toBe(true); }
    }
    expect(seenFront).toBe(true);
    const behind = mkLevel([[14, 0], [14, 1], [14, 2], [14, 3]], [[16, 0]]);
    for (const [a, p] of allShots(3)) {
      const r = simulateShot(behind, a, p);
      if (r.end.kind === 'crate') expect(r.hits.some((h) => h.kind === 'balloon')).toBe(false);
    }
  }, 30_000);
  it('one ball can pop several balloons on its way', () => {
    const arc = [1.0, 1.5, 2.0].map((t) => arcAt(45, 60, t));
    const lv = mkLevel([], arc.map((p) => [Math.floor(p.x), Math.floor(p.y)]));
    const r = simulateShot(lv, 45, 60);
    expect(r.hits.filter((h) => h.kind === 'balloon').length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < r.hits.length; i++) expect(r.hits[i].t).toBeGreaterThanOrEqual(r.hits[i - 1].t);
  });
  it('agrees with an independent fine-grained check on thousands of random shots (crate hit and balloons popped)', () => {
    const rnd = mulberry32(2026);
    let checked = 0; let bad = 0; let worstCrate = 0;
    for (const d of DIFFICULTIES) for (const seed of [11, 12, 13]) {
      const lv = generateLevel(d, seed);
      const sim = makeSim(lv);
      for (let k = 0; k < 60; k++) {
        const a = ANGLE_MIN + Math.floor(rnd() * 81);
        const p = POWER_MIN + Math.floor(rnd() * 91);
        const mine = sim.run(a, p);
        const theirs = naiveShot(lv, a, p);
        const myPopped = new Set(mine.hits.filter((h) => h.kind === 'balloon').map((h) => h.id));
        const myCrate = mine.hits.find((h) => h.kind === 'crate')?.id ?? null;
        checked++;
        const same = myCrate === theirs.crateHit && myPopped.size === theirs.popped.size && [...myPopped].every((id) => theirs.popped.has(id));
        if (!same) bad++;
        if (myCrate === null && theirs.crateHit !== null) worstCrate++;
      }
    }
    expect(checked).toBe(540);
    expect(bad / checked).toBeLessThan(0.01); // what remains is a near-tie between two touching crates
    expect(worstCrate).toBeLessThan(5);
  }, 60_000);
  it('a ball that flies over everything records no hit and ends on the ground or out', () => {
    const lv = mkLevel([[20, 0]], [[25, 12]]);
    const r = simulateShot(lv, 85, 40);
    expect(r.hits).toEqual([]);
    expect(['ground', 'out']).toContain(r.end.kind);
  });
});

describe('crates: the fall rule', () => {
  const col = (ys: number[], x = 10): Crate[] => ys.map((y, i) => ({ id: i + 1, x, y }));
  const ys = (cs: Crate[]) => cs.map((c) => `${c.id}:${c.x},${c.y}`).sort();
  it('breaking the bottom drops the rest by one', () => {
    const r = settle(col([1, 2, 3]), []);
    expect(ys(r.crates)).toEqual(['1:10,0', '2:10,1', '3:10,2']);
    expect(r.falls.length).toBe(3);
  });
  it('breaking the middle drops only what is above it', () => {
    const r = settle(col([0, 2]), []);
    expect(ys(r.crates)).toEqual(['1:10,0', '2:10,1']);
    expect(r.falls).toEqual([{ id: 2, fromY: 2, toY: 1 }]);
  });
  it('breaking the top changes nothing', () => {
    const r = settle(col([0, 1]), []);
    expect(r.falls).toEqual([]);
    expect(ys(r.crates)).toEqual(['1:10,0', '2:10,1']);
  });
  it('a gap of several squares drops the whole distance in one go', () => {
    const r = settle([{ id: 1, x: 5, y: 6 }], []);
    expect(r.crates[0].y).toBe(0);
    expect(r.falls).toEqual([{ id: 1, fromY: 6, toY: 0 }]);
  });
  it('sideways contact holds nothing: a crate beside a tower still falls', () => {
    const r = settle([{ id: 1, x: 10, y: 0 }, { id: 2, x: 10, y: 1 }, { id: 3, x: 11, y: 1 }], []);
    expect(ys(r.crates)).toEqual(['1:10,0', '2:10,1', '3:11,0']);
  });
  it('a falling crate pops balloons in the squares it passes and the one it lands in, not the ones beside or above', () => {
    const balloons: Balloon[] = [{ id: 1, x: 10, y: 3 }, { id: 2, x: 10, y: 1 }, { id: 3, x: 11, y: 2 }, { id: 4, x: 10, y: 6 }];
    const r = settle([{ id: 1, x: 10, y: 4 }], balloons);
    expect(r.popped.sort()).toEqual([1, 2]);
    expect(r.balloons.map((b) => b.id).sort()).toEqual([3, 4]);
    expect(r.crates[0].y).toBe(0);
  });
  it('lower crates settle first so higher ones rest on them, not on the ground', () => {
    const r = settle([{ id: 1, x: 3, y: 4 }, { id: 2, x: 3, y: 7 }], []);
    expect(ys(r.crates)).toEqual(['1:3,0', '2:3,1']);
  });
  it('never loses, duplicates or moves a crate sideways (random stacks)', () => {
    const rnd = mulberry32(5);
    for (let k = 0; k < 300; k++) {
      const crates: Crate[] = [];
      const taken = new Set<number>();
      for (let i = 0; i < 25; i++) {
        const x = Math.floor(rnd() * 8); const y = Math.floor(rnd() * 10);
        if (!taken.has(y * 100 + x)) { taken.add(y * 100 + x); crates.push({ id: crates.length + 1, x, y }); }
      }
      const r = settle(crates, []);
      expect(r.crates.length).toBe(crates.length);
      expect(new Set(r.crates.map((c) => c.y * 100 + c.x)).size).toBe(crates.length);
      for (const c of r.crates) {
        const before = crates.find((q) => q.id === c.id)!;
        expect(c.x).toBe(before.x);
        expect(c.y).toBeLessThanOrEqual(before.y);
      }
      expect(levelValid({ ...empty, crates: r.crates })).toBe(true);
      expect(settle(r.crates, []).falls).toEqual([]); // settled means settled
    }
  });
});

describe('firing a shot', () => {
  it('spends a shot, removes what was popped and broken, and lets the crates above drop', () => {
    const lv = mkLevel([[12, 0], [12, 1], [12, 2]], [[12, 3]], 4);
    let hit: [number, number] | null = null;
    for (const [a, p] of allShots(2)) {
      const r = simulateShot(lv, a, p);
      if (r.hits.some((h) => h.kind === 'crate' && h.id === 1)) { hit = [a, p]; break; }
    }
    expect(hit).not.toBeNull();
    const res = resolveShot(lv, hit![0], hit![1]);
    expect(res.brokenCrate).toBe(1);
    expect(res.level.shots).toBe(3);
    expect(res.level.crates.map((c) => c.y).sort()).toEqual([0, 1]);
    expect(res.falls.length).toBe(2);
    expect(res.poppedByFall).toEqual([]); // the balloon sits above the stack, not in its fall path
    expect(lv.crates.length).toBe(3); // the input level is untouched
    expect(lv.shots).toBe(4);
  });
  it('a crate that falls onto a balloon pops it', () => {
    const settled = settle([{ id: 1, x: 12, y: 0 }, { id: 3, x: 12, y: 3 }], [{ id: 1, x: 12, y: 2 }]);
    expect(settled.popped).toEqual([1]);
    expect(settled.balloons).toEqual([]);
    expect(settled.crates.find((c) => c.id === 3)!.y).toBe(1);
  });
  it('status, shots used and stars', () => {
    const lv = mkLevel([], [[10, 5], [12, 5], [14, 5]], 8);
    expect(levelStatus(lv)).toBe('playing');
    expect(levelStatus({ ...lv, balloons: [] })).toBe('won');
    expect(levelStatus({ ...lv, shots: 0 })).toBe('lost');
    expect(levelStatus({ ...lv, balloons: [], shots: 0 })).toBe('won');
    expect(shotsUsed({ ...lv, shots: 5 })).toBe(3);
    expect([3, 4, 5, 6, 7, 8].map((u) => starsFor({ ...lv, balloons: [], shots: 8 - u }))).toEqual([3, 2, 2, 1, 1, 1]);
  });
  it('a lost level stays lost and a shot cannot take the count below zero', () => {
    const lv = mkLevel([], [[20, 5]], 1);
    const a = resolveShot(lv, 5, 10);
    expect(a.level.shots).toBe(0);
    expect(levelStatus(a.level)).toBe('lost');
    expect(resolveShot(a.level, 5, 10).level.shots).toBe(0);
  });
});

describe('level generation', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (const d of DIFFICULTIES) {
    it(`${d}: valid, the right size, towers where they should be, and the same for the same seed`, () => {
      const spec = SPECS[d];
      for (const s of seeds) {
        const lv = generateLevel(d, s);
        expect(levelValid(lv), `${d} ${s}`).toBe(true);
        expect(lv.balloons.length).toBe(spec.balloons);
        expect(lv.shots).toBe(spec.balloons + spec.slack);
        expect(lv.shotsAtStart).toBe(lv.shots);
        expect(lv.balloonsAtStart).toBe(spec.balloons);
        expect(lv.crates.length).toBeGreaterThan(0);
        for (const c of lv.crates) { expect(c.x).toBeGreaterThanOrEqual(TOWER_X_MIN); expect(c.x).toBeLessThanOrEqual(TOWER_X_MAX); expect(c.y).toBeLessThan(spec.maxHeight); }
        for (const b of lv.balloons) { expect(b.y).toBeGreaterThanOrEqual(1); expect(b.y).toBeLessThanOrEqual(14); expect(b.x).toBeGreaterThanOrEqual(TOWER_X_MIN - 1); }
        for (let i = 0; i < lv.balloons.length; i++) for (let j = i + 1; j < lv.balloons.length; j++) {
          expect(Math.max(Math.abs(lv.balloons[i].x - lv.balloons[j].x), Math.abs(lv.balloons[i].y - lv.balloons[j].y))).toBeGreaterThanOrEqual(2);
        }
        expect(generateLevel(d, s)).toEqual(lv);
      }
      expect(new Set(seeds.map((s) => JSON.stringify(generateLevel(d, s)))).size).toBeGreaterThan(9);
    }, 60_000);
  }
  it('levels get harder: more towers, taller crates, more balloons, fewer spare shots', () => {
    expect(SPECS.easy.balloons).toBeLessThan(SPECS.medium.balloons);
    expect(SPECS.medium.balloons).toBeLessThan(SPECS.hard.balloons);
    expect(SPECS.easy.maxHeight).toBeLessThan(SPECS.hard.maxHeight);
    expect(SPECS.easy.slack).toBeGreaterThan(SPECS.hard.slack);
  });
});

describe('every generated level is solvable (brute force over all 7371 shots)', () => {
  for (const d of DIFFICULTIES) {
    it(`${d}: each balloon can be popped by a shot that never touches a crate, checked by the independent integrator`, () => {
      for (const seed of [21, 22]) {
        const lv = generateLevel(d, seed);
        const sim = makeSim(lv);
        const found = new Map<number, [number, number][]>();
        for (const [a, p] of allShots()) {
          const r = sim.run(a, p);
          if (r.end.kind === 'crate') continue;
          for (const h of r.hits) {
            if (h.kind !== 'balloon') continue;
            const list = found.get(h.id) ?? [];
            if (list.length < 60) list.push([a, p]);
            found.set(h.id, list);
          }
        }
        expect([...found.keys()].sort(), `${d} ${seed}`).toEqual(lv.balloons.map((b) => b.id).sort());
        for (const [id, shots] of found) {
          expect(shots.length, `balloon ${id} has several clean shots`).toBeGreaterThanOrEqual(2);
          const b = lv.balloons.find((q) => q.id === id)!;
          // at least one of them is confirmed by the independent fine-grained check: no crate touched, and the arc
          // passes within the pop distance of the balloon (a small allowance for the check spacing)
          const confirmed = shots.some(([a, p]) => {
            if (naiveShot(lv, a, p).crateHit !== null) return false;
            let closest = Infinity;
            for (let t = 0; t < 9; t += 1 / 2400) {
              const q = arcAt(a, p, t);
              if (q.y <= 0) break;
              closest = Math.min(closest, Math.hypot(q.x - (b.x + 0.5), q.y - (b.y + 0.5)));
            }
            return closest < BALLOON_R + BALL_R + 0.05;
          });
          expect(confirmed, `balloon ${id}`).toBe(true);
        }
        expect(lv.shots).toBeGreaterThanOrEqual(lv.balloons.length);
      }
    }, 60_000);
    it(`${d}: a plan of shots found by search, fired one by one on the real level, clears it within the shot budget`, () => {
      for (const seed of [31, 32]) {
        let lv = generateLevel(d, seed);
        const plan = findSolution(lv);
        expect(plan, `${d} ${seed}`).not.toBeNull();
        expect(plan!.length).toBeLessThanOrEqual(lv.shots);
        for (const [a, p] of plan!) lv = resolveShot(lv, a, p).level;
        expect(lv.balloons.length).toBe(0);
        expect(levelStatus(lv)).toBe('won');
        expect(starsFor(lv)).toBeGreaterThanOrEqual(1);
      }
    }, 60_000);
  }
  it('nextShot returns null when no balloon can be popped and a usable shot otherwise', () => {
    expect(nextShot(mkLevel([], []))).toBeNull();
    const lv = mkLevel([], [[16, 4]]);
    const s = nextShot(lv)!;
    expect(s).not.toBeNull();
    expect(simulateShot(lv, s[0], s[1]).hits.some((h) => h.kind === 'balloon')).toBe(true);
  });
});

describe('fuzz: random play never breaks a level', () => {
  it('hundreds of random shots on generated levels keep every level valid and never add crates or balloons', () => {
    const rnd = mulberry32(77);
    for (const d of DIFFICULTIES) {
      for (const seed of [41, 42]) {
        let lv = generateLevel(d, seed);
        for (let k = 0; k < 60; k++) {
          const before = { c: lv.crates.length, b: lv.balloons.length, s: lv.shots };
          const res = resolveShot(lv, 5 + Math.floor(rnd() * 81), 10 + Math.floor(rnd() * 91));
          expect(levelValid(res.level)).toBe(true);
          expect(res.level.crates.length).toBeLessThanOrEqual(before.c);
          expect(res.level.balloons.length).toBeLessThanOrEqual(before.b);
          expect(res.level.shots).toBe(Math.max(0, before.s - 1));
          expect(res.level.crates.length).toBe(before.c - (res.brokenCrate === null ? 0 : 1));
          expect(res.level.balloons.length).toBe(before.b - res.poppedByBall.length - res.poppedByFall.length);
          lv = res.level.balloons.length && res.level.shots ? res.level : generateLevel(d, seed + k + 100);
        }
      }
    }
  }, 60_000);
});

describe('stored counts, seeds and words', () => {
  it('stored counts are whole numbers from 0 to 9999 per difficulty, rebuilt fresh', () => {
    expect(sanitiseCleared({ e: 3, m: 12, h: 9999 })).toEqual({ easy: 3, medium: 12, hard: 9999 });
    expect(toStored({ easy: 1, medium: 2, hard: 3 })).toEqual({ e: 1, m: 2, h: 3 });
    expect(MAX_CLEARED).toBe(9999);
    for (const bad of [null, undefined, 7, 'x', [], [1, 2, 3], { e: -1, m: 10000, h: 1.5 }, { e: '3' }, { e: NaN, m: Infinity }, JSON.parse('{"__proto__":{"e":4}}')]) {
      expect(sanitiseCleared(bad)).toEqual(emptyCleared());
    }
    expect(Object.keys(sanitiseCleared({ e: 1, evil: 5 })).sort()).toEqual(['easy', 'hard', 'medium']);
  });
  it('seeds and difficulties from a URL are bounded', () => {
    expect([parseSeed('12345'), parseSeed(7), parseSeed('4294967295')]).toEqual([12345, 7, 4294967295]);
    for (const bad of ['0', '-5', '1.5', 'abc', '4294967296', '99999999999', '', NaN, Infinity, null, undefined, {}, '1e3']) expect(parseSeed(bad)).toBe(0);
    expect([parseDifficulty('hard'), parseDifficulty('HARD'), parseDifficulty('__proto__'), parseDifficulty(null)]).toEqual(['hard', 'easy', 'easy', 'easy']);
  });
  it('words: plurals, summary and share lines are right in every state', () => {
    expect(plural(1, 'shot')).toBe('1 shot');
    expect(plural(0, 'shot')).toBe('0 shots');
    const lv = mkLevel([], [[10, 3], [12, 3]], 5, 'medium');
    expect(summary(lv)).toBe('2 balloons left, 5 shots left');
    expect(summary({ ...lv, balloons: [lv.balloons[0]], shots: 1 })).toBe('1 balloon left, 1 shot left');
    expect(shareText(lv)).toBe('Cannon Shot Medium #1: 2 balloons left after 0 shots');
    expect(shareText({ ...lv, balloons: [], shots: 3 })).toBe('Cannon Shot Medium #1: cleared in 2 shots, 3 stars');
    expect(shareText({ ...lv, shots: 0 })).toBe('Cannon Shot Medium #1: not cleared yet, 2 balloons left');
    // A cleared level that used "Show me a shot" says so and never claims more than the one star the page shows.
    const won = { ...lv, balloons: [], shots: 3 };
    expect(shareText(won, true)).toBe('Cannon Shot Medium #1: cleared in 2 shots with a hint, 1 star');
    expect(shareText(won, false)).toBe(shareText(won));
    expect(shareText(won, true)).not.toMatch(/3 stars/);
  });
  it('colour mixing keeps its end points', () => {
    const a = parseColour('#38bdf8')!; const b = parseColour('#f87171')!;
    expect(mixOklch(a, b, 0)).toEqual(a);
    expect(mixOklch(a, b, 1)).toEqual(b);
    expect(toCss(a)).toBe('#38bdf8');
  });
  it('geometry: the cannon sits left of the first tower column and the world is 32 by 18', () => {
    expect(WORLD_W).toBe(32);
    expect(WORLD_H).toBe(18);
    expect(CANNON.x + BARREL + 1).toBeLessThan(TOWER_X_MIN);
  });
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('has sliders and buttons as the keyboard way to aim, and a live status line', () => {
    expect(src).toMatch(/type="range"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/id="cs-fire"/);
  });
  it('sizes the canvas from its box times a capped device pixel ratio and reads colours at draw time', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/getComputedStyle/);
  });
  it('pauses on a hidden tab, skips the animation under reduced motion, and removes inert only for a new level', () => {
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/prefers-reduced-motion: reduce/);
    expect((src.match(/inert = false/g) ?? []).length).toBe(1);
  });
  it('copies an aided result as aided, counts a seed once, and keeps focus when the win panel hides', () => {
    expect((src.match(/shareText\(level, aided\)/g) ?? []).length).toBe(2);
    expect(src).toMatch(/countedLevels\.has\(levelKey\)/);
    expect(src).toMatch(/!aided && !alreadyCounted/);
    expect(src).toMatch(/winBox\.contains\(document\.activeElement\)/);
    expect(src).toMatch(/if \(focusWasInWin\) fireBtn\.focus/);
  });
  it('draws no birds, slingshots, pigs, worms or tanks', () => {
    for (const text of [src, helpersSource]) expect(/\b(bird|birds|sling|slingshot|pig|pigs|worm|worms|tank|tanks|turret)\b/i.test(text)).toBe(false);
  });
});
