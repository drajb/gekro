/**
 * games-brick-smasher.test.ts - the engine behind `brick-smasher`.
 *
 * Pinned: the circle-against-rectangle test against an independent edge-distance version;
 * the ball never tunnels (a wall of unbreakable bricks is hit at the top speed from random angles
 * and never crossed; the round paddle always returns a ball that lands on its flat part, checked
 * against an unfolded-path oracle; the first brick contact on a straight path matches a fine
 * brute-force scan to within one sub-step and is never early); the fixed-step clock gives the same
 * number of steps however frames are cut and clamps a stalled frame to 50 ms; the bounce angle
 * follows the hit position; lives, extra balls, the three power-ups, scoring, two-hit bricks and
 * level clears behave as the guide says; every generated level is non-empty, in bounds and
 * deterministic by seed, none uses banded rows, and a simple bot can clear the first eight levels;
 * a long fuzz of random input keeps every invariant; the sanitisers and the text are pinned too.
 */
import { describe, it, expect } from 'vitest';
import {
  W, H, COLS, ROWS_MAX, BRICK_PX, BRICK_PY, BRICK_W, BRICK_H, BRICK_Y0, BALL_R, PADDLE_H, PADDLE_CY, PADDLE_TOP, CAP_R,
  FIXED_DT, MAX_FRAME_MS, MAX_SUBSTEP, MAX_SPEED, MAX_ANGLE, MAX_BALLS, MAX_CAPS, KEY_SPEED, PADDLE_MAX_SPEED, CAP_SPEED,
  CAP_CHANCE, WIDE_SECONDS, SLOW_SECONDS, WIDE_FACTOR, SLOW_FACTOR, CALM_FACTOR, POINTS_PER_HIT, LEVEL_BONUS, START_LIVES, TINT_COUNT, SHAPES,
  BASE_SPEED, PADDLE_WIDTH, DIFFICULTIES, DIFFICULTY_LABEL, MIN_VY_RATIO, MAX_SCORE,
  mulberry32, advanceClock, circleRectHit, brickRect, levelSpeed, shapeFor, rowsFor, shapeMask, toughChance, makeLevel,
  newWorld, cloneWorld, launch, stepWorld, currentSpeed, parseBests, recordBest, parseDifficulty, bestKey,
  keyScope, keyToDir, describeWorld, lostMessage, clearMessage, capsuleMessage, shareText,
  type World, type Difficulty, type Input,
} from '../src/components/apps-private/brick-smasher/helpers';
import calculatorSource from '../src/components/apps-private/brick-smasher/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');
const IDLE: Input = { dir: 0, target: null };
const BIG = 1e9;

/** A world with the bricks replaced by the given cells (col, row, hp). `alive` is set high so a level never clears by accident. */
const arena = (d: Difficulty, cells: [number, number, number][] = [], level = 1): World => {
  const w = newWorld(d, mulberry32(1));
  w.level = level;
  w.hp.fill(0);
  for (const [c, r, hp] of cells) w.hp[r * COLS + c] = hp;
  w.alive = 1000;
  w.lives = 99;
  return w;
};
const play = (w: World, x: number, y: number, angle: number, speed = currentSpeed(w)): void => {
  w.status = 'play';
  w.balls = [{ x, y, vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) }];
};
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

// An independent distance from a point to a rectangle: the shortest of the four edge distances, or 0 inside.
const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
};
const rectDist = (px: number, py: number, rx: number, ry: number, rw: number, rh: number): number => {
  if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return 0;
  return Math.min(
    segDist(px, py, rx, ry, rx + rw, ry), segDist(px, py, rx + rw, ry, rx + rw, ry + rh),
    segDist(px, py, rx + rw, ry + rh, rx, ry + rh), segDist(px, py, rx, ry + rh, rx, ry),
  );
};

describe('constants the guide page states', () => {
  it('pins the box, the bricks, the ball and the round paddle', () => {
    expect([W, H, COLS]).toEqual([360, 480, 10]);
    expect([BRICK_PX, BRICK_PY, BRICK_W, BRICK_H]).toEqual([36, 18, 34, 16]);
    expect([BALL_R, PADDLE_H, PADDLE_CY, PADDLE_TOP]).toEqual([6, 14, 443, 436]);
    expect(START_LIVES).toBe(3);
    expect(PADDLE_WIDTH).toEqual({ easy: 88, medium: 72, hard: 60 });
    expect(BASE_SPEED).toEqual({ easy: 230, medium: 290, hard: 350 });
    expect([WIDE_SECONDS, SLOW_SECONDS, WIDE_FACTOR, SLOW_FACTOR, CALM_FACTOR]).toEqual([12, 10, 1.5, 0.7, 0.85]);
    expect([POINTS_PER_HIT, LEVEL_BONUS, MAX_BALLS, MAX_CAPS]).toEqual([10, 100, 5, 3]);
    expect(CAP_CHANCE).toBe(0.14); // about one broken brick in seven drops a power-up
    expect(MAX_ANGLE).toBeCloseTo((60 * Math.PI) / 180, 12);
  });
  it('the physics step is 1/120 s, a frame counts for at most 50 ms, a sub-step is at most half the ball radius', () => {
    expect(FIXED_DT).toBeCloseTo(1 / 120, 15);
    expect(MAX_FRAME_MS).toBe(50);
    expect(MAX_SUBSTEP).toBe(BALL_R / 2);
    // At the top speed one fixed step is under two sub-steps of 3 px.
    expect(MAX_SPEED * FIXED_DT).toBeLessThanOrEqual(2 * MAX_SUBSTEP);
  });
  it('the ball speed rises 4 percent a level from the start speed up to a cap of 600', () => {
    expect(levelSpeed('easy', 1)).toBe(230);
    expect(levelSpeed('easy', 2)).toBeCloseTo(230 * 1.04, 9);
    expect(levelSpeed('hard', 6)).toBeCloseTo(350 * 1.2, 9);
    for (const d of DIFFICULTIES) {
      for (let l = 1; l < 80; l++) {
        expect(levelSpeed(d, l + 1)).toBeGreaterThanOrEqual(levelSpeed(d, l));
        expect(levelSpeed(d, l)).toBeLessThanOrEqual(MAX_SPEED);
      }
    }
    expect(levelSpeed('hard', 40)).toBe(MAX_SPEED);
    expect(levelSpeed('easy', 0)).toBe(230);
  });
  it('the keys are as the page says', () => {
    expect([KEY_SPEED, PADDLE_MAX_SPEED, CAP_SPEED]).toEqual([480, 1500, 110]);
    expect(MIN_VY_RATIO).toBe(0.25);
  });
});

describe('circle against rectangle', () => {
  it('agrees with an independent edge-distance version on thousands of random cases, with a normal that clears the rectangle', () => {
    const rnd = mulberry32(5);
    let hits = 0;
    for (let n = 0; n < 20000; n++) {
      const rx = rnd() * 300;
      const ry = rnd() * 300;
      const rw = 4 + rnd() * 60;
      const rh = 4 + rnd() * 30;
      const r = 1 + rnd() * 10;
      const x = rx - 15 + rnd() * (rw + 30);
      const y = ry - 15 + rnd() * (rh + 30);
      const dist = rectDist(x, y, rx, ry, rw, rh);
      const hit = circleRectHit(x, y, r, rx, ry, rw, rh);
      if (Math.abs(dist - r) < 1e-9) continue; // exactly touching: either answer is fine
      expect(!!hit, `case ${n}`).toBe(dist < r);
      if (hit) {
        hits++;
        expect(Math.hypot(hit.nx, hit.ny)).toBeCloseTo(1, 9);
        expect(hit.depth).toBeGreaterThan(0);
        // Pushing the circle out along the normal by the depth leaves it touching or clear.
        const after = rectDist(x + hit.nx * hit.depth, y + hit.ny * hit.depth, rx, ry, rw, rh);
        expect(after).toBeGreaterThanOrEqual(r - 1e-6);
      }
    }
    expect(hits).toBeGreaterThan(2000);
  });
  it('a centre inside the rectangle takes the nearest side', () => {
    expect(circleRectHit(50, 11, 6, 40, 10, 20, 10)).toMatchObject({ nx: 0, ny: -1 });
    expect(circleRectHit(50, 19, 6, 40, 10, 20, 10)).toMatchObject({ nx: 0, ny: 1 });
    expect(circleRectHit(41, 15, 6, 40, 10, 20, 10)).toMatchObject({ nx: -1, ny: 0 });
    expect(circleRectHit(59, 15, 6, 40, 10, 20, 10)).toMatchObject({ nx: 1, ny: 0 });
  });
  it('misses a clear circle and returns null when exactly touching', () => {
    expect(circleRectHit(0, 0, 5, 20, 20, 10, 10)).toBeNull();
    expect(circleRectHit(30 + 6, 25, 6, 20, 20, 10, 10)).toBeNull();
  });
});

describe('levels', () => {
  it('cycle through four shapes and grow in height', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(shapeFor)).toEqual(['stairs', 'wave', 'checker', 'heart', 'stairs', 'wave', 'checker', 'heart']);
    expect(SHAPES).toEqual(['stairs', 'wave', 'checker', 'heart']);
    expect([1, 5, 9, 13, 17, 100].map((l) => rowsFor(l === 4 ? 1 : l))).toEqual([5, 6, 7, 8, 8, 8]);
    expect(rowsFor(4)).toBe(8);
  });
  it('every level from 1 to 100, with many seeds, is non-empty, in bounds and well formed', () => {
    for (let level = 1; level <= 100; level++) {
      for (let seed = 1; seed <= 12; seed++) {
        const lv = makeLevel(level, mulberry32(seed * 1000 + level));
        const rows = rowsFor(level);
        expect(lv.rows).toBe(rows);
        expect(lv.count, `level ${level} seed ${seed}`).toBeGreaterThanOrEqual(20);
        expect(lv.count).toBeLessThanOrEqual(COLS * rows);
        expect(lv.hp).toHaveLength(COLS * ROWS_MAX);
        expect(lv.tint).toHaveLength(COLS * ROWS_MAX);
        let counted = 0;
        for (let i = 0; i < lv.hp.length; i++) {
          const row = Math.floor(i / COLS);
          if (lv.hp[i] > 0) {
            counted++;
            expect(row).toBeLessThan(rows);
            expect([1, 2]).toContain(lv.hp[i]);
            expect(Number.isInteger(lv.tint[i]) && lv.tint[i] >= 0 && lv.tint[i] < TINT_COUNT).toBe(true);
            if (level < 5) expect(lv.hp[i]).toBe(1);
          } else expect(lv.hp[i]).toBe(0);
        }
        expect(counted).toBe(lv.count);
        // The lowest brick sits well above the paddle, leaving the ball room to travel.
        const lowest = Math.max(...lv.hp.map((h, i) => (h > 0 ? Math.floor(i / COLS) : -1)));
        const bottomY = BRICK_Y0 + (lowest + 1) * BRICK_PY;
        expect(PADDLE_TOP - bottomY).toBeGreaterThan(200);
      }
    }
  }, 60_000);
  it('is the same for the same level and seed, and different for different seeds', () => {
    const a = makeLevel(7, mulberry32(3));
    const b = makeLevel(7, mulberry32(3));
    expect(a).toEqual(b);
    const seen = new Set<string>();
    for (let s = 1; s <= 30; s++) seen.add(JSON.stringify(makeLevel(7, mulberry32(s)).tint));
    expect(seen.size).toBeGreaterThan(20);
  });
  it('the heart is the 52-brick heart', () => {
    const lv = makeLevel(4, mulberry32(1));
    expect(lv.shape).toBe('heart');
    expect(lv.count).toBe(52);
    const mask = shapeMask('heart', 8, false);
    expect(mask[0].join('')).toBe('falsefalsetruetruefalsefalsetruetruefalsefalse');
    // Symmetric left to right.
    for (const row of mask) expect(row).toEqual([...row].reverse());
  });
  it('stairs, wave and checker have the sizes the shapes imply', () => {
    for (let rows = 5; rows <= 8; rows++) {
      const stairs = shapeMask('stairs', rows, false).flat().filter(Boolean).length;
      expect(stairs).toBe(Array.from({ length: rows }, (_, r) => COLS - r).reduce((a, b) => a + b, 0));
      expect(shapeMask('checker', rows, false).flat().filter(Boolean).length).toBe(rows * 5);
      const wave = shapeMask('wave', rows, false);
      for (let c = 0; c < COLS; c++) {
        const col = wave.map((r) => r[c]).filter(Boolean).length;
        expect(col, `wave rows ${rows} col ${c}`).toBeGreaterThanOrEqual(2);
        expect(col).toBeLessThanOrEqual(3);
      }
    }
    // A mirrored stairs is the flipped one.
    const plain = shapeMask('stairs', 5, false);
    const flipped = shapeMask('stairs', 5, true);
    plain.forEach((row, r) => expect(flipped[r]).toEqual([...row].reverse()));
  });
  it('tints are not banded rows: about a third of the bricks differ from their row band, and several rows mix tints', () => {
    let off = 0;
    let total = 0;
    let mixedRows = 0;
    let rowsSeen = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const lv = makeLevel(1, mulberry32(seed));
      for (let r = 0; r < lv.rows; r++) {
        const tints = new Set<number>();
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (lv.hp[i] <= 0) continue;
          total++;
          tints.add(lv.tint[i]);
          if (lv.tint[i] !== Math.floor((r * TINT_COUNT) / lv.rows)) off++;
        }
        if (tints.size > 0) { rowsSeen++; if (tints.size > 1) mixedRows++; }
      }
    }
    expect(off / total).toBeGreaterThan(0.2);
    expect(off / total).toBeLessThan(0.45);
    expect(mixedRows / rowsSeen).toBeGreaterThan(0.5);
  });
  it('two-hit bricks start at level 5 and become more common up to 35 percent', () => {
    const want: [number, number][] = [[1, 0], [4, 0], [5, 0.05], [6, 0.1], [10, 0.3], [11, 0.35], [12, 0.35], [50, 0.35]];
    for (const [lv, p] of want) expect(toughChance(lv), `level ${lv}`).toBeCloseTo(p, 12);
    let tough = 0;
    let all = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const lv = makeLevel(40, mulberry32(seed));
      for (const h of lv.hp) if (h > 0) { all++; if (h === 2) tough++; }
    }
    expect(Math.abs(tough / all - 0.35)).toBeLessThan(0.03);
  });
});

describe('the fixed-step clock', () => {
  const run = (frames: number[]): number => {
    let acc = 0;
    let n = 0;
    for (const f of frames) { const r = advanceClock(acc, f); acc = r.acc; n += r.steps; }
    return n;
  };
  it('gives the same number of steps however the same time is cut into frames (within one step)', () => {
    const total = 10_000; // 10 seconds
    const expected = Math.floor(total / 1000 / FIXED_DT);
    for (const f of [4, 6.944, 8.333, 11.1, 16.667, 33.333, 41]) {
      const n = run(new Array(Math.round(total / f)).fill(f));
      expect(Math.abs(n - Math.round((Math.round(total / f) * f) / 1000 / FIXED_DT)), `frame ${f}`).toBeLessThanOrEqual(1);
      expect(Math.abs(n - expected), `frame ${f} vs total`).toBeLessThanOrEqual(Math.ceil((f * 3) / 8.333) + 1);
    }
  });
  it('random frame lengths still add up to the real time', () => {
    const rnd = mulberry32(8);
    const frames: number[] = [];
    let t = 0;
    while (t < 20_000) { const f = 2 + rnd() * 45; frames.push(f); t += f; }
    expect(Math.abs(run(frames) - t / 1000 / FIXED_DT)).toBeLessThanOrEqual(2);
  });
  it('counts a stalled frame as at most 50 ms (six steps) so the ball cannot jump', () => {
    expect(advanceClock(0, 5000).steps).toBe(6);
    expect(advanceClock(0, 1e9).steps).toBe(6);
    expect(advanceClock(0, MAX_FRAME_MS).steps).toBe(6);
    expect(advanceClock(0, 49).steps).toBe(5);
  });
  it('never takes more than eight steps and drops bad numbers', () => {
    expect(advanceClock(10, 50, 8).steps).toBe(8);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(0, -20).steps).toBe(0);
    expect(advanceClock(0, Infinity).steps).toBe(0);
  });
  it('two different frame patterns give identical worlds at the same step count', () => {
    const drive = (frames: number[], rng: () => number) => {
      const w = newWorld('medium', mulberry32(9));
      launch(w, mulberry32(2));
      let acc = 0;
      let steps = 0;
      const ctl = mulberry32(55);
      for (const f of frames) {
        const r = advanceClock(acc, f);
        acc = r.acc;
        for (let i = 0; i < r.steps; i++) { stepWorld(w, { dir: ctl() < 0.5 ? -1 : 1, target: null }, rng); steps++; }
      }
      return { w, steps };
    };
    // Same seed for the physics random numbers; the input generator is stepped once per step, so the inputs match step for step.
    const a = drive(new Array(600).fill(16.667), mulberry32(4));
    const b = drive(new Array(1200).fill(8.333), mulberry32(4));
    const n = Math.min(a.steps, b.steps);
    const replay = (count: number) => {
      const w = newWorld('medium', mulberry32(9));
      launch(w, mulberry32(2));
      const rng = mulberry32(4);
      const ctl = mulberry32(55);
      for (let i = 0; i < count; i++) stepWorld(w, { dir: ctl() < 0.5 ? -1 : 1, target: null }, rng);
      return w;
    };
    expect(Math.abs(a.steps - b.steps)).toBeLessThanOrEqual(1);
    expect(JSON.stringify(n === a.steps ? a.w : replay(n))).toBe(JSON.stringify(replay(n)));
    expect(JSON.stringify(n === b.steps ? b.w : replay(n))).toBe(JSON.stringify(replay(n)));
  });
});

describe('the ball never tunnels', () => {
  it('a full wall of unbreakable bricks is never crossed, at the top speed, from random positions and angles', () => {
    const rnd = mulberry32(12);
    const wallBottom = brickRect(0, 1).y + BRICK_H; // 79
    let hitsOnWall = 0;
    const bad: string[] = [];
    for (let trial = 0; trial < 30; trial++) {
      const cells: [number, number, number][] = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < COLS; c++) cells.push([c, r, BIG]);
      const w = arena('hard', cells, 40);
      expect(currentSpeed(w)).toBe(MAX_SPEED);
      const rng = mulberry32(trial + 100);
      play(w, 20 + rnd() * 320, 150 + rnd() * 150, (rnd() - 0.5) * 2.0);
      for (let step = 0; step < 5000; step++) {
        const b = w.balls[0];
        // The paddle chases the ball with a random offset, so bounces leave at different angles.
        const target = b ? b.x + (rnd() - 0.5) * w.paddleW : w.paddleX;
        const before = w.score;
        stepWorld(w, { dir: 0, target }, rng);
        if (w.score > before) hitsOnWall++;
        if (w.status === 'serve') launch(w, rng);
        for (const ball of w.balls) {
          // The centre never reaches the wall; a hair of overlap (under half a pixel) can remain at the seam between two bricks, more would mean tunnelling.
          if (!(Number.isFinite(ball.x) && Number.isFinite(ball.y) && ball.y > wallBottom && ball.y - BALL_R >= wallBottom - 0.5)) bad.push(`trial ${trial} step ${step}: y=${ball.y}`);
          if (Math.hypot(ball.vx, ball.vy) > MAX_SPEED + 1e-6) bad.push(`trial ${trial} step ${step}: too fast`);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(hitsOnWall).toBeGreaterThan(500);
  }, 120_000);

  it('a column of unbreakable bricks shot at from the side, from either side, is never entered', () => {
    const cells: [number, number, number][] = [];
    for (let r = 0; r < ROWS_MAX; r++) cells.push([5, r, BIG]);
    const rects = Array.from({ length: ROWS_MAX }, (_, r) => brickRect(5, r));
    let contacts = 0;
    const bad: string[] = [];
    for (let trial = 0; trial < 60; trial++) {
      const w = arena('hard', cells, 40);
      const rng = mulberry32(trial);
      const fromLeft = trial % 2 === 0;
      const y = 60 + (trial % 40) * 3.7;
      const startX = fromLeft ? 40 + (trial % 7) * 4 : 330 - (trial % 7) * 4;
      play(w, startX, y, (fromLeft ? 1 : -1) * (Math.PI / 2 - 0.1 - (trial % 5) * 0.03));
      for (let step = 0; step < 2500; step++) {
        const before = w.score;
        stepWorld(w, { dir: 0, target: w.balls[0] ? w.balls[0].x : W / 2 }, rng);
        if (w.score > before) contacts++;
        if (w.status === 'serve') launch(w, rng);
        for (const b of w.balls) {
          for (const q of rects) if (rectDist(b.x, b.y, q.x, q.y, q.w, q.h) <= 0) bad.push(`trial ${trial} step ${step}: inside a brick`);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(contacts).toBeGreaterThan(150);
  }, 120_000);

  it('the round paddle returns a ball that lands on its flat part, every time (unfolded-path oracle)', () => {
    const rnd = mulberry32(21);
    let checked = 0;
    for (let trial = 0; trial < 600; trial++) {
      const d = DIFFICULTIES[trial % 3];
      const w = arena(d, [[9, 0, BIG]], 1 + (trial % 30));
      const speed = currentSpeed(w);
      const px = w.paddleW / 2 + rnd() * (W - w.paddleW);
      w.paddleX = px;
      const x0 = BALL_R + rnd() * (W - 2 * BALL_R);
      const y0 = 250 + rnd() * 100;
      const angle = (rnd() - 0.5) * 1.5; // measured from straight down
      const vx = speed * Math.sin(angle);
      const vy = speed * Math.cos(angle);
      w.status = 'play';
      w.balls = [{ x: x0, y: y0, vx, vy }];
      // Where the ball is when its lowest point first reaches the top of the flat part, unfolding the side-wall bounces.
      const contactY = PADDLE_CY - PADDLE_H / 2 - BALL_R;
      const t = (contactY - y0) / vy;
      const L = W - 2 * BALL_R;
      const u = (((x0 - BALL_R + vx * t) % (2 * L)) + 2 * L) % (2 * L);
      const xc = BALL_R + (u <= L ? u : 2 * L - u);
      const flatMargin = w.paddleW / 2 - PADDLE_H / 2 - 4;
      if (Math.abs(xc - px) > flatMargin) continue;
      checked++;
      const rng = mulberry32(trial);
      let bounced = false;
      for (let step = 0; step < 600 && !bounced; step++) {
        stepWorld(w, IDLE, rng);
        const b = w.balls[0];
        if (!b) break;
        if (b.vy < 0) bounced = true;
        expect(b.y - BALL_R, `trial ${trial}`).toBeLessThanOrEqual(PADDLE_CY + 0.5);
      }
      expect(bounced, `trial ${trial}: landed at x=${xc.toFixed(1)}, paddle at ${px.toFixed(1)}`).toBe(true);
      expect(w.lives).toBe(99);
    }
    expect(checked).toBeGreaterThan(60);
  }, 60_000);

  it('the first contact on a straight path matches a fine brute-force scan to within one sub-step, and is never early', () => {
    const rnd = mulberry32(33);
    let hitTrials = 0;
    let missTrials = 0;
    for (let trial = 0; trial < 500; trial++) {
      const col = 2 + Math.floor(rnd() * 6);
      const row = 1 + Math.floor(rnd() * 5);
      const w = arena(DIFFICULTIES[trial % 3], [[col, row, 1]], 1 + (trial % 40));
      const speed = currentSpeed(w);
      const x0 = 130 + rnd() * 100;
      const y0 = 330 + rnd() * 70;
      const angle = (rnd() - 0.5) * 0.5; // from straight up, within about 14 degrees
      const ux = Math.sin(angle);
      const uy = -Math.cos(angle);
      const q = brickRect(col, row);
      // Brute force along the straight line, every 0.01 px.
      let dTrue = -1;
      let minDist = Infinity;
      for (let d = 0; d <= 360; d += 0.01) {
        const px = x0 + ux * d;
        const py = y0 + uy * d;
        if (py < BALL_R) break;
        const dist = rectDist(px, py, q.x, q.y, q.w, q.h);
        if (dist < minDist) minDist = dist;
        if (dist < BALL_R && dTrue < 0) dTrue = d;
      }
      play(w, x0, y0, angle, speed);
      const rng = mulberry32(trial);
      const stepDist = speed * FIXED_DT;
      let travelled = 0;
      let eventAt = -1;
      let startOfStepWithEvent = -1;
      for (let step = 0; step < 2000; step++) {
        const startDist = travelled;
        const ev = stepWorld(w, IDLE, rng);
        travelled += stepDist;
        if (ev.includes('brick')) { eventAt = travelled; startOfStepWithEvent = startDist; break; }
        const b = w.balls[0];
        if (!b || b.y <= BALL_R + 0.01 || travelled > 400) break;
      }
      if (eventAt < 0) {
        // No hit reported: the path may only have grazed the brick by a sub-step's worth of depth.
        missTrials++;
        expect(minDist, `trial ${trial}: missed a brick the path reaches`).toBeGreaterThanOrEqual(BALL_R - 0.21);
      } else {
        hitTrials++;
        expect(dTrue, `trial ${trial}: hit reported but the path never touches`).toBeGreaterThanOrEqual(0);
        expect(eventAt, `trial ${trial}: hit reported early`).toBeGreaterThanOrEqual(dTrue - 0.02);
        expect(startOfStepWithEvent, `trial ${trial}: hit reported late`).toBeLessThanOrEqual(dTrue + MAX_SUBSTEP + 0.02);
      }
    }
    expect(hitTrials).toBeGreaterThan(60);
    expect(missTrials).toBeGreaterThan(20);
  }, 120_000);
});

describe('bouncing off the paddle', () => {
  const bounceAt = (pos: number, d: Difficulty = 'medium') => {
    const w = arena(d, [[9, 0, BIG]]);
    const half = w.paddleW / 2;
    const speed = currentSpeed(w);
    w.paddleX = W / 2;
    w.status = 'play';
    w.balls = [{ x: w.paddleX + pos * half, y: PADDLE_CY - 40, vx: 0, vy: speed }];
    for (let i = 0; i < 200; i++) {
      stepWorld(w, IDLE, mulberry32(1));
      if (w.balls[0].vy < 0) break;
    }
    return { b: w.balls[0], speed };
  };
  it('the middle sends the ball straight up, the edges at 60 degrees, in between in proportion', () => {
    for (const pos of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
      const { b, speed } = bounceAt(pos);
      const angle = Math.atan2(b.vx, -b.vy);
      expect(angle, `pos ${pos}`).toBeCloseTo(pos * MAX_ANGLE, 6);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(speed, 6);
    }
  });
  it('left and right are mirror images', () => {
    for (const pos of [0.1, 0.4, 0.8, 1]) {
      const l = bounceAt(-pos).b;
      const r = bounceAt(pos).b;
      expect(l.vx).toBeCloseTo(-r.vx, 6);
      expect(l.vy).toBeCloseTo(r.vy, 6);
    }
  });
  it('a ball below the middle line of the paddle is missed and falls away', () => {
    const w = arena('medium', [[9, 0, BIG]]);
    w.status = 'play';
    w.balls = [{ x: w.paddleX, y: PADDLE_CY + 3, vx: 0, vy: currentSpeed(w) }];
    stepWorld(w, IDLE, mulberry32(1));
    expect(w.balls[0].vy).toBeGreaterThan(0);
  });
  it('a ball beside the paddle misses it', () => {
    const w = arena('easy', [[9, 0, BIG]]);
    w.paddleX = 100;
    w.status = 'play';
    w.balls = [{ x: 250, y: PADDLE_CY - 40, vx: 0, vy: currentSpeed(w) }];
    for (let i = 0; i < 400 && w.status === 'play'; i++) stepWorld(w, IDLE, mulberry32(1));
    expect(w.lives).toBe(98);
    expect(w.status).toBe('serve');
  });
});

describe('the paddle', () => {
  it('moves at 480 px a second with a key held', () => {
    const w = arena('medium');
    w.status = 'serve';
    const x0 = w.paddleX;
    for (let i = 0; i < 12; i++) stepWorld(w, { dir: 1, target: null }, mulberry32(1));
    expect(w.paddleX - x0).toBeCloseTo(KEY_SPEED * 12 * FIXED_DT, 9);
    for (let i = 0; i < 24; i++) stepWorld(w, { dir: -1, target: null }, mulberry32(1));
    expect(w.paddleX - x0).toBeCloseTo(-KEY_SPEED * 12 * FIXED_DT, 9);
  });
  it('is clamped to the box for every width', () => {
    for (const d of DIFFICULTIES) {
      const w = arena(d);
      for (let i = 0; i < 600; i++) stepWorld(w, { dir: -1, target: null }, mulberry32(1));
      expect(w.paddleX).toBe(w.paddleW / 2);
      for (let i = 0; i < 600; i++) stepWorld(w, { dir: 1, target: null }, mulberry32(1));
      expect(w.paddleX).toBe(W - w.paddleW / 2);
    }
  });
  it('follows a mouse or finger target, limited to 1500 px per second', () => {
    const w = arena('easy');
    const start = w.paddleX;
    stepWorld(w, { dir: 0, target: 10 }, mulberry32(1));
    expect(start - w.paddleX).toBeCloseTo(PADDLE_MAX_SPEED * FIXED_DT, 9);
    for (let i = 0; i < 200; i++) stepWorld(w, { dir: 0, target: 200 }, mulberry32(1));
    expect(w.paddleX).toBeCloseTo(200, 9);
    stepWorld(w, { dir: 0, target: NaN }, mulberry32(1));
    expect(w.paddleX).toBeCloseTo(200, 9);
    for (let i = 0; i < 200; i++) stepWorld(w, { dir: 0, target: -500 }, mulberry32(1));
    expect(w.paddleX).toBeCloseTo(w.paddleW / 2, 9);
  });
  it('the ball waiting to launch follows the paddle', () => {
    const w = arena('easy');
    for (let i = 0; i < 50; i++) stepWorld(w, { dir: 1, target: null }, mulberry32(1));
    expect(w.status).toBe('serve');
    expect(w.balls).toHaveLength(1);
    expect(w.balls[0].x).toBeCloseTo(w.paddleX, 9);
    expect(w.balls[0].y).toBe(PADDLE_TOP - BALL_R);
  });
});

describe('lives and balls', () => {
  it('starts with three lives, a score of 0 and the ball on the paddle', () => {
    const w = newWorld('easy', mulberry32(1));
    expect(w).toMatchObject({ lives: 3, score: 0, level: 1, status: 'serve', cleared: 0, wideT: 0, slowT: 0 });
    expect(w.balls).toHaveLength(1);
    expect(w.alive).toBeGreaterThan(20);
    expect(w.paddleW).toBe(88);
  });
  it('launch only works from the waiting state and sends the ball up at a small angle, at the right speed', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const w = newWorld('medium', mulberry32(1));
      expect(launch(w, mulberry32(seed))).toBe(true);
      expect(w.status).toBe('play');
      const b = w.balls[0];
      expect(b.vy).toBeLessThan(0);
      expect(Math.abs(Math.atan2(b.vx, -b.vy))).toBeLessThanOrEqual(0.25 + 1e-9);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(290, 6);
      expect(launch(w, mulberry32(seed))).toBe(false);
    }
  });
  it('losing the only ball costs a life and puts a new ball on the paddle', () => {
    const w = newWorld('easy', mulberry32(1));
    launch(w, mulberry32(1));
    w.paddleX = 40;
    w.balls = [{ x: 300, y: H + BALL_R + 1, vx: 0, vy: 100 }];
    const ev = stepWorld(w, IDLE, mulberry32(1));
    expect(ev).toContain('lost');
    expect(w.lives).toBe(2);
    expect(w.status).toBe('serve');
    expect(w.balls).toHaveLength(1);
    expect(w.balls[0].vy).toBe(0);
  });
  it('with two balls, losing one keeps the game going', () => {
    const w = arena('easy', [[0, 0, BIG]]);
    w.status = 'play';
    w.balls = [{ x: 300, y: H + BALL_R + 1, vx: 0, vy: 100 }, { x: 200, y: 300, vx: 0, vy: -200 }];
    const ev = stepWorld(w, IDLE, mulberry32(1));
    expect(ev).not.toContain('lost');
    expect(w.balls).toHaveLength(1);
    expect(w.lives).toBe(99);
    expect(w.status).toBe('play');
  });
  it('the third lost ball ends the game, and nothing moves afterwards', () => {
    const w = newWorld('easy', mulberry32(1));
    for (let life = 3; life >= 1; life--) {
      expect(w.lives).toBe(life);
      launch(w, mulberry32(life));
      w.balls = [{ x: 300, y: H + BALL_R + 2, vx: 0, vy: 100 }];
      w.paddleX = 40;
      const ev = stepWorld(w, IDLE, mulberry32(1));
      expect(ev).toContain('lost');
      if (life === 1) expect(ev).toContain('over');
    }
    expect(w.status).toBe('over');
    expect(w.lives).toBe(0);
    expect(w.balls).toHaveLength(0);
    const frozen = JSON.stringify(w);
    expect(stepWorld(w, { dir: 1, target: 50 }, mulberry32(1))).toEqual([]);
    expect(JSON.stringify(w)).toBe(frozen);
    expect(launch(w, mulberry32(1))).toBe(false);
  });
});

describe('bricks, scoring and level clears', () => {
  const shoot = (w: World, x: number, y: number, steps = 600, rng = mulberry32(7)): string[] => {
    play(w, x, y, 0);
    const all: string[] = [];
    for (let i = 0; i < steps; i++) { all.push(...stepWorld(w, { dir: 0, target: x }, rng)); if (w.status !== 'play') break; }
    return all;
  };
  it('a one-hit brick is destroyed by one hit for 10 points and the ball bounces back', () => {
    const w = arena('easy', [[4, 3, 1], [8, 0, BIG]]);
    const before = w.alive;
    const q = brickRect(4, 3);
    const ev = shoot(w, q.x + 10, 300, 200);
    expect(ev.filter((e) => e === 'brick')).toHaveLength(1);
    expect(w.hp[3 * COLS + 4]).toBe(0);
    expect(w.score).toBe(10);
    expect(w.alive).toBe(before - 1);
  });
  it('a two-hit brick takes two hits and scores 10 each time', () => {
    const w = arena('easy', [[4, 3, 2], [8, 0, BIG]]);
    const q = brickRect(4, 3);
    play(w, q.x + 10, 300, 0);
    let hits = 0;
    for (let i = 0; i < 2000 && hits < 2; i++) {
      const ev = stepWorld(w, { dir: 0, target: w.balls[0].x }, mulberry32(7));
      hits += ev.filter((e) => e === 'brick').length;
      if (hits === 1) { expect(w.hp[3 * COLS + 4]).toBe(1); expect(w.score).toBe(10); }
    }
    expect(hits).toBe(2);
    expect(w.hp[3 * COLS + 4]).toBe(0);
    expect(w.score).toBe(20);
  });
  it('clearing the last brick adds 100, starts the next level with a fresh wall and puts the ball back on the paddle', () => {
    const w = newWorld('easy', mulberry32(1));
    w.hp.fill(0);
    w.hp[3 * COLS + 4] = 1;
    w.alive = 1;
    const q = brickRect(4, 3);
    play(w, q.x + 10, 300, 0);
    const events: string[] = [];
    const rng = mulberry32(5);
    for (let i = 0; i < 600 && !events.includes('clear'); i++) events.push(...stepWorld(w, { dir: 0, target: w.balls[0]?.x ?? W / 2 }, rng));
    expect(events).toContain('clear');
    expect(w.score).toBe(10 + 100);
    expect(w.level).toBe(2);
    expect(w.cleared).toBe(1);
    expect(w.status).toBe('serve');
    expect(w.balls).toHaveLength(1);
    expect(w.alive).toBe(w.hp.filter((h) => h > 0).length);
    expect(w.alive).toBeGreaterThanOrEqual(20);
    expect(w.shape).toBe('wave');
    expect(w.lives).toBe(3);
  });
  it('alive always equals the number of bricks standing', () => {
    const w = newWorld('hard', mulberry32(3));
    expect(w.alive).toBe(w.hp.filter((h) => h > 0).length);
  });
});

describe('power-ups', () => {
  /** A world where the next destroyed brick drops the given kind (rng: first value is the drop chance, second picks the kind). */
  const dropRng = (kind: 'wide' | 'slow' | 'extra') => sequence(0, kind === 'wide' ? 0.1 : kind === 'slow' ? 0.5 : 0.9);
  const dropOne = (kind: 'wide' | 'slow' | 'extra'): World => {
    const w = arena('medium', [[4, 3, 1], [8, 0, BIG]]);
    const q = brickRect(4, 3);
    play(w, q.x + 10, 300, 0);
    const rng = dropRng(kind);
    for (let i = 0; i < 600 && w.caps.length === 0; i++) stepWorld(w, IDLE, rng);
    return w;
  };
  it('a destroyed brick can drop a capsule of each kind, falling at 110 px a second', () => {
    for (const kind of ['wide', 'slow', 'extra'] as const) {
      const w = dropOne(kind);
      expect(w.caps).toHaveLength(1);
      expect(w.caps[0].kind).toBe(kind);
      const y0 = w.caps[0].y;
      stepWorld(w, IDLE, mulberry32(1));
      expect(w.caps[0].y - y0).toBeCloseTo(CAP_SPEED * FIXED_DT, 9);
    }
  });
  it('at most three capsules fall at once', () => {
    const w = arena('easy', [[0, 0, 1], [8, 0, BIG]]);
    w.caps = [{ x: 10, y: 10, kind: 'wide' }, { x: 20, y: 10, kind: 'wide' }, { x: 30, y: 10, kind: 'wide' }];
    const q = brickRect(0, 0);
    play(w, q.x + 10, 100, 0);
    for (let i = 0; i < 300; i++) stepWorld(w, { dir: 0, target: 340 }, () => 0);
    expect(w.caps.length).toBeLessThanOrEqual(3);
  });
  const chase = (w: World): Input => ({ dir: 0, target: w.balls[0] ? w.balls[0].x : w.paddleX });
  it('a capsule that reaches the paddle is collected', () => {
    const w = arena('easy', [[8, 0, BIG]]);
    w.status = 'play';
    w.balls = [{ x: 30, y: 300, vx: 0, vy: -1 }];
    w.paddleX = 200;
    w.caps = [{ x: 200, y: PADDLE_TOP - 30, kind: 'wide' }, { x: 40, y: PADDLE_TOP - 30, kind: 'slow' }];
    const ev: string[] = [];
    for (let i = 0; i < 70; i++) ev.push(...stepWorld(w, IDLE, mulberry32(1)));
    expect(ev).toContain('capsule:wide');
    expect(ev).not.toContain('capsule:slow');
    expect(w.caps.map((c) => c.kind)).toEqual(['slow']);
    expect(w.wideT).toBeGreaterThan(0);
    expect(w.slowT).toBe(0);
  });
  it('a capsule that misses the paddle falls out of the box', () => {
    const w = arena('easy', [[8, 0, BIG]]);
    w.status = 'play';
    w.balls = [{ x: 330, y: 300, vx: 0, vy: -1 }];
    w.caps = [{ x: 40, y: PADDLE_TOP - 30, kind: 'slow' }];
    const ev: string[] = [];
    for (let i = 0; i < 260; i++) ev.push(...stepWorld(w, chase(w), mulberry32(1)));
    expect(ev).not.toContain('capsule:slow');
    expect(w.caps).toHaveLength(0);
    expect(w.slowT).toBe(0);
  });
  it('wide makes the paddle 1.5 times wider for 12 seconds, then it shrinks back', () => {
    const w = arena('medium', [[8, 0, BIG]]);
    w.status = 'play';
    w.balls = [{ x: 30, y: 100, vx: 0, vy: -1 }];
    w.caps = [{ x: w.paddleX, y: PADDLE_TOP - 4, kind: 'wide' }];
    stepWorld(w, IDLE, mulberry32(1));
    stepWorld(w, IDLE, mulberry32(1));
    expect(w.paddleW).toBeCloseTo(72 * 1.5, 9);
    for (let i = 0; i < 12 * 120 - 5; i++) stepWorld(w, chase(w), mulberry32(1));
    expect(w.paddleW).toBeCloseTo(108, 9);
    for (let i = 0; i < 20; i++) stepWorld(w, chase(w), mulberry32(1));
    expect(w.paddleW).toBe(72);
    expect(w.lives).toBe(99);
  });
  it('slow makes the ball 70 percent as fast for 10 seconds, then back to full speed', () => {
    const w = arena('medium', [[8, 0, BIG]]);
    w.status = 'play';
    w.balls = [{ x: 200, y: 300, vx: 0, vy: -290 }];
    w.caps = [{ x: w.paddleX, y: PADDLE_TOP - 4, kind: 'slow' }];
    stepWorld(w, { dir: 0, target: 340 }, mulberry32(1));
    stepWorld(w, { dir: 0, target: 340 }, mulberry32(1));
    const b = () => w.balls[0];
    expect(Math.hypot(b().vx, b().vy)).toBeCloseTo(290 * 0.7, 6);
    expect(currentSpeed(w)).toBeCloseTo(203, 6);
    for (let i = 0; i < 10 * 120 + 10; i++) stepWorld(w, { dir: 0, target: b().x }, mulberry32(1));
    expect(w.slowT).toBe(0);
    expect(Math.hypot(b().vx, b().vy)).toBeCloseTo(290, 6);
  });
  it('extra adds two balls fanned out from the first, to a limit of five', () => {
    const w = arena('easy', [[8, 0, BIG]]);
    w.status = 'play';
    w.balls = [{ x: 200, y: 300, vx: 0, vy: -230 }];
    w.caps = [{ x: w.paddleX, y: PADDLE_TOP - 4, kind: 'extra' }];
    stepWorld(w, IDLE, mulberry32(1));
    expect(w.balls).toHaveLength(3);
    const angles = w.balls.map((b) => Math.atan2(b.vx, -b.vy));
    expect(angles.filter((a) => Math.abs(a) < 1e-6)).toHaveLength(1);
    expect(angles.some((a) => Math.abs(a - 0.4) < 0.01)).toBe(true);
    expect(angles.some((a) => Math.abs(a + 0.4) < 0.01)).toBe(true);
    for (let k = 0; k < 4; k++) {
      w.caps = [{ x: w.paddleX, y: PADDLE_TOP - 4, kind: 'extra' }];
      stepWorld(w, IDLE, mulberry32(1));
    }
    expect(w.balls.length).toBeLessThanOrEqual(MAX_BALLS);
    expect(w.balls.length).toBe(5);
  });
  it('losing the last ball clears the power-ups', () => {
    const w = arena('easy', [[8, 0, BIG]]);
    w.status = 'play';
    w.wideT = 5;
    w.slowT = 5;
    w.caps = [{ x: 20, y: 20, kind: 'extra' }];
    w.balls = [{ x: 300, y: H + BALL_R + 2, vx: 0, vy: 100 }];
    stepWorld(w, IDLE, mulberry32(1));
    expect(w.wideT).toBe(0);
    expect(w.slowT).toBe(0);
    expect(w.caps).toHaveLength(0);
  });
  it('calm mode (reduced motion) is 15 percent slower', () => {
    const w = newWorld('medium', mulberry32(1), true);
    expect(w.calm).toBe(true);
    expect(currentSpeed(w)).toBeCloseTo(290 * 0.85, 9);
    expect(currentSpeed(newWorld('medium', mulberry32(1), false))).toBe(290);
  });
});

describe('a bot can clear the levels', () => {
  const clearWith = (level: number, seed: number): { cleared: boolean; steps: number } => {
    const rng = mulberry32(seed);
    const noise = mulberry32(seed + 1);
    const w = newWorld('easy', rng);
    w.level = level;
    const lv = makeLevel(level, rng);
    w.hp = lv.hp;
    w.tint = lv.tint;
    w.alive = lv.count;
    w.lives = 999;
    let offset = 0;
    let aimed = false;
    for (let step = 1; step <= 400_000; step++) {
      if (w.status === 'serve') { launch(w, rng); aimed = false; }
      const b = w.balls[0];
      // Choose a new spot on the paddle once per descent, so the ball leaves at all sorts of angles.
      if (b && b.vy > 0 && b.y > 360 && !aimed) { offset = (noise() - 0.5) * w.paddleW * 0.9; aimed = true; }
      if (b && b.vy < 0) aimed = false;
      const target = b ? b.x + offset : w.paddleX;
      const ev = stepWorld(w, { dir: 0, target }, rng);
      if (ev.includes('clear')) return { cleared: true, steps: step };
    }
    return { cleared: false, steps: 400_000 };
  };
  it('clears each of the first eight levels, every shape twice, within a generous time', () => {
    for (let level = 1; level <= 8; level++) {
      const r = clearWith(level, level * 31);
      expect(r.cleared, `level ${level} not cleared`).toBe(true);
    }
  }, 120_000);
});

describe('same seed, same game', () => {
  const session = (seed: number) => {
    const rng = mulberry32(seed);
    const w = newWorld('medium', rng);
    const ctl = mulberry32(seed + 500);
    for (let i = 0; i < 40000; i++) {
      if (w.status === 'serve') launch(w, rng);
      if (w.status === 'over') break;
      const b = w.balls[0];
      stepWorld(w, { dir: 0, target: b ? b.x + (ctl() - 0.5) * 40 : w.paddleX }, rng);
    }
    return w;
  };
  it('the score, bricks and ball positions are identical for the same seed and different for another', () => {
    const a = session(11);
    const b = session(11);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.score).toBeGreaterThan(0);
    expect(JSON.stringify(session(12))).not.toBe(JSON.stringify(a));
  }, 60_000);
  it('cloneWorld copies deeply', () => {
    const a = session(3);
    const c = cloneWorld(a);
    c.hp[0] = 77;
    c.balls.push({ x: 1, y: 1, vx: 0, vy: 0 });
    expect(a.hp[0]).not.toBe(77);
    expect(a.balls.length).not.toBe(c.balls.length);
  });
});

describe('random play never breaks an invariant', () => {
  it('90,000 steps of random keys, mouse targets and launches, on every difficulty', () => {
    const bad: string[] = [];
    const check = (ok: boolean, msg: string) => { if (!ok && bad.length < 20) bad.push(msg); };
    let steps = 0;
    for (const d of DIFFICULTIES) {
      const ctl = mulberry32(d.length * 77);
      const rng = mulberry32(d.length * 13);
      let w = newWorld(d, rng);
      w.level = 20; // fast and tough
      const lv = makeLevel(20, rng);
      w.hp = lv.hp; w.tint = lv.tint; w.alive = lv.count;
      let lastScore = 0;
      for (let i = 0; i < 30_000; i++) {
        if (w.status === 'serve' && ctl() < 0.05) launch(w, rng);
        if (w.status === 'over') { w = newWorld(d, rng); lastScore = 0; }
        const r = ctl();
        const input: Input = r < 0.3 ? { dir: -1, target: null } : r < 0.6 ? { dir: 1, target: null } : r < 0.8 ? { dir: 0, target: ctl() * W } : IDLE;
        stepWorld(w, input, rng);
        steps++;
        check(w.score >= lastScore, `${d} ${i}: score went down`);
        lastScore = w.score;
        check(w.lives >= 0 && w.lives <= START_LIVES, `${d} ${i}: lives ${w.lives}`);
        check(w.balls.length <= MAX_BALLS, `${d} ${i}: too many balls`);
        check(w.caps.length <= MAX_CAPS, `${d} ${i}: too many capsules`);
        check(w.paddleX >= w.paddleW / 2 - 1e-9 && w.paddleX <= W - w.paddleW / 2 + 1e-9, `${d} ${i}: paddle left the box`);
        check(w.alive === w.hp.filter((h) => h > 0).length, `${d} ${i}: brick count drifted`);
        for (const b of w.balls) {
          check(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy), `${d} ${i}: not a number`);
          check(b.x >= BALL_R - 1e-6 && b.x <= W - BALL_R + 1e-6 && b.y >= BALL_R - 1e-6, `${d} ${i}: ball outside the walls (${b.x}, ${b.y})`);
          check(Math.hypot(b.vx, b.vy) <= MAX_SPEED + 1e-6, `${d} ${i}: too fast`);
          if (w.status === 'play') {
            const c0 = Math.max(0, Math.floor((b.x - BALL_R) / BRICK_PX));
            const c1 = Math.min(COLS - 1, Math.floor((b.x + BALL_R) / BRICK_PX));
            const r0 = Math.max(0, Math.floor((b.y - BALL_R - BRICK_Y0) / BRICK_PY));
            const r1 = Math.min(ROWS_MAX - 1, Math.floor((b.y + BALL_R - BRICK_Y0) / BRICK_PY));
            for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
              if (w.hp[rr * COLS + cc] <= 0) continue;
              const q = brickRect(cc, rr);
              check(rectDist(b.x, b.y, q.x, q.y, q.w, q.h) > 0, `${d} ${i}: ball centre inside a brick`);
            }
          }
        }
      }
    }
    expect(steps).toBe(90_000);
    expect(bad).toEqual([]);
  }, 180_000);
});

describe('keys, scores and text', () => {
  it('maps the arrow keys and A and D', () => {
    expect(['ArrowLeft', 'a', 'A'].map(keyToDir)).toEqual([-1, -1, -1]);
    expect(['ArrowRight', 'd', 'D'].map(keyToDir)).toEqual([1, 1, 1]);
    expect(['ArrowUp', ' ', 'w', 'Enter', '', 'Tab'].map(keyToDir)).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('claims keys only when focus is inside the game or the ball is flying', () => {
    expect(keyScope('running', false)).toBe('all');
    expect(keyScope('ready', true)).toBe('all');
    expect(keyScope('over', true)).toBe('all');
    expect(keyScope('ready', false)).toBe('none');
    expect(keyScope('over', false)).toBe('none');
    expect(keyScope('paused', false)).toBe('none');
    expect(keyScope('paused', true)).toBe('all');
  });
  it('keeps one best per difficulty and only improvements', () => {
    expect(DIFFICULTIES.map(bestKey)).toEqual(['easy', 'medium', 'hard']);
    let r = recordBest({}, 'easy', 120);
    expect(r).toEqual({ bests: { easy: 120 }, improved: true });
    expect(recordBest(r.bests, 'easy', 120).improved).toBe(false);
    expect(recordBest(r.bests, 'easy', 90).improved).toBe(false);
    r = recordBest(r.bests, 'easy', 130);
    expect(r.bests.easy).toBe(130);
    expect(recordBest(r.bests, 'hard', 40).bests).toEqual({ easy: 130, hard: 40 });
    for (const bad of [0, -5, 1.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, 'easy', bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'turbo', 10).improved).toBe(false);
    expect(recordBest({}, '__proto__', 10).improved).toBe(false);
  });
  it('sanitises stored data into a fresh object', () => {
    const stored = JSON.parse('{"easy": 400, "medium": 12.5, "hard": "9", "turbo": 4, "__proto__": {"a": 1}, "constructor": 3}');
    const out = parseBests(stored);
    expect(out).toEqual({ easy: 400 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(parseBests(JSON.parse(`{"easy": ${MAX_SCORE + 1}, "hard": 0}`))).toEqual({});
    expect(parseBests([1])).toEqual({});
    expect(parseBests(null)).toEqual({});
  });
  it('reads a difficulty and falls back to Easy', () => {
    expect(parseDifficulty('hard')).toBe('hard');
    for (const bad of ['', 'HARD', 'x', null, undefined, 4, [], {}, '__proto__']) expect(parseDifficulty(bad)).toBe('easy');
    expect(DIFFICULTY_LABEL).toEqual({ easy: 'Easy', medium: 'Medium', hard: 'Hard' });
  });
  it('writes the messages with the right plurals', () => {
    const w = newWorld('easy', mulberry32(1));
    w.alive = 1;
    w.lives = 1;
    expect(describeWorld(w)).toBe('Level 1. Score 0. 1 life left. 1 brick to go.');
    w.alive = 12;
    w.lives = 3;
    w.score = 340;
    w.level = 2;
    expect(describeWorld(w)).toBe('Level 2. Score 340. 3 lives left. 12 bricks to go.');
    expect(lostMessage({ ...w, lives: 2, status: 'serve' })).toBe('Ball lost. 2 lives left. Press Space or Launch for the next ball.');
    expect(lostMessage({ ...w, lives: 1, status: 'serve' })).toBe('Ball lost. 1 life left. Press Space or Launch for the next ball.');
    expect(lostMessage({ ...w, lives: 0, status: 'over' })).toBe('That was the last ball. You reached level 2 with 340 points.');
    expect(clearMessage({ ...w, level: 3 })).toBe('Level cleared! Level 3 is next. Score 340. Press Space or Launch.');
    expect(capsuleMessage('wide')).toBe('Wide paddle for 12 seconds.');
    expect(capsuleMessage('slow')).toBe('Slow ball for 10 seconds.');
    expect(capsuleMessage('extra')).toBe('Extra balls!');
    expect(shareText('hard', 250, 3, 400)).toBe('Brick Smasher (Hard): score 250, level 3, best 400');
    expect(shareText('easy', 0, 1, 0)).toBe('Brick Smasher (Easy): score 0, level 1');
  });
});

describe('the page (read from source)', () => {
  it('has a polite live status line, honours reduced motion and uses its own storage key', () => {
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/gk:game:brick-smasher/);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).toMatch(/crypto\.getRandomValues/);
  });
  it('drives the world only through the fixed-step clock and pauses on a hidden tab', () => {
    expect(src).toContain('advanceClock(acc, dtMs)');
    expect(src).toContain('stepWorld(world');
    expect(src).toContain('visibilitychange');
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
  });
  it('takes keyboard, mouse and touch input', () => {
    expect(src).toContain("'keydown'");
    expect(src).toContain("'pointermove'");
    expect(src).toContain("'pointerdown'");
    expect(src).toMatch(/touch-action: none/);
    expect(src).toContain('keyScope(');
  });
  it('draws power-ups as shapes with symbols, with no letters on them', () => {
    expect(src).toContain("kind === 'wide'");
    expect(src).not.toMatch(/fillText\([^)]*(['"])[A-Z]\1/);
  });
  it('turns its ink dark on the light theme, follows the theme toggle on body, and ignores held Enter on its buttons', () => {
    expect(src).toContain('.theme-light #bs-app { --bs-ink: var(--color-text-primary); }');
    expect(src).toMatch(/color: var\(--bs-ink\)/);
    expect(src).toMatch(/mo\?\.observe\(document\.body,/);
    expect(src).toMatch(/e\.repeat && t && t\.tagName === 'BUTTON'/);
  });
});
