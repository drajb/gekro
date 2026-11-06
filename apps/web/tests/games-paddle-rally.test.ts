/**
 * games-paddle-rally.test.ts - the engine behind `paddle-rally`.
 *
 * Pinned: a fixed 1/60 s step on a 400 x 300 court; paddles move at 260 units a second and stay inside the
 * court; the ball leaves a paddle at an angle set by where it hit (middle straight, ends at 60 degrees), gets
 * 7 percent faster on every hit up to 520, and bounces off the top and bottom; the ball can never pass
 * through a paddle (checked on thousands of random shots against an independent prediction of where the ball
 * will be); the prediction itself matches a brute-force bouncing simulation; the serve leaves within 25
 * degrees of straight across, toward the side that lost the last point; first to 7 wins; the computer only
 * decides every 0.1 to 0.4 s, aims with an error that grows with the ball's speed, never moves faster than its
 * speed limit, loses to nobody who stands still and gets harder level by level (measured by how long a
 * perfect pilot needs to beat it); matches always end; 5000 random steps in every mode never break an
 * invariant; the clock plays the same match on any screen; best rallies reject junk; and the page keeps what it
 * promises.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, begin, step, predictY, movePaddle, hitOffset, pointerSteer, keyToPaddle, keyScope, spaceIsNative, advanceClock, bestKey, parseBests, recordBest,
  describeState, endMessage, shareText, sideNames, plural, isMode, mulberry32, clamp,
  W, H, DT, PADDLE_W, PADDLE_H, PAD_MARGIN, FACE_L, FACE_R, BALL_R, PADDLE_SPEED, BALL_START, BALL_MAX, SPEEDUP, MAX_ANGLE, EDGE_SLACK, WIN_SCORE,
  SERVE_DELAY, SERVE_ANGLE, SUBSTEP, SLOW_BALL, PADDLE_MIN, PADDLE_MAX, AI, MODES, MAX_SCORE, SFX, PEAK_GAIN, NO_INPUT, ballStart, ballMax,
  type GameState, type Mode, type Input,
} from '../src/components/apps-private/paddle-rally/helpers';
import calculatorSource from '../src/components/apps-private/paddle-rally/Calculator.astro?raw';

const playing = (mode: Mode = 'two', over: Partial<GameState> = {}, seed = 1): GameState => ({ ...begin(newGame(mode, false, mulberry32(seed))), serveTimer: 0, ...over });

/** A ball flying in the court with the given velocity. */
const flying = (x: number, y: number, vx: number, vy: number, over: Partial<GameState> = {}, mode: Mode = 'two'): GameState =>
  playing(mode, { ball: { x, y, vx, vy }, ...over });

const hold = (p1: -1 | 0 | 1 = 0, p2: -1 | 0 | 1 = 0): Input => ({ p1, p2, t1: null, t2: null });

describe('the court', () => {
  it('is a 400 x 300 court with a fixed 1/60 s step', () => {
    expect([W, H, PADDLE_W, PADDLE_H, PAD_MARGIN, BALL_R]).toEqual([400, 300, 10, 60, 14, 7]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect([FACE_L, FACE_R]).toEqual([24, 376]);
    expect([PADDLE_SPEED, BALL_START, BALL_MAX, SPEEDUP, WIN_SCORE, SERVE_DELAY, SUBSTEP]).toEqual([260, 210, 520, 1.07, 7, 0.9, 3]);
    expect(MAX_ANGLE).toBeCloseTo(Math.PI / 3, 12);
    expect(MODES).toEqual(['easy', 'medium', 'hard', 'two']);
    expect(isMode('hard')).toBe(true);
    for (const bad of ['', 'HARD', null, undefined, 3, 'one']) expect(isMode(bad as unknown)).toBe(false);
  });
  it('reduced motion makes the ball 15 percent slower and changes nothing else', () => {
    expect(SLOW_BALL).toBe(0.85);
    expect(ballStart(true)).toBeCloseTo(BALL_START * 0.85, 9);
    expect(ballMax(true)).toBeCloseTo(BALL_MAX * 0.85, 9);
    expect(ballStart(false)).toBe(BALL_START);
  });
  it('starts as a ready, still court with the serve waiting', () => {
    for (const m of MODES) {
      const s = newGame(m, false, mulberry32(3));
      expect(s.status).toBe('ready');
      expect(s.ball).toEqual({ x: W / 2, y: H / 2, vx: 0, vy: 0 });
      expect([s.score1, s.score2, s.rally]).toEqual([0, 0, 0]);
      expect(s.serveTimer).toBe(SERVE_DELAY);
      expect(step(s, hold(1), () => 0.5)).toBe(s);
      expect(begin(s).status).toBe('running');
    }
  });
});

describe('paddles', () => {
  it('move at 260 units a second, in the direction held', () => {
    let y = 100;
    for (let i = 0; i < 30; i++) y = movePaddle(y, 1, null, PADDLE_SPEED, DT);
    expect(y).toBeCloseTo(100 + 130, 6);
    let z = 200;
    for (let i = 0; i < 30; i++) z = movePaddle(z, -1, null, PADDLE_SPEED, DT);
    expect(z).toBeCloseTo(200 - 130, 6);
    expect(movePaddle(150, 0, null, PADDLE_SPEED, DT)).toBe(150);
  });
  it('stay inside the court', () => {
    let y = 150;
    for (let i = 0; i < 600; i++) y = movePaddle(y, -1, null, PADDLE_SPEED, DT);
    expect(y).toBe(PADDLE_MIN);
    for (let i = 0; i < 1200; i++) y = movePaddle(y, 1, null, PADDLE_SPEED, DT);
    expect(y).toBe(PADDLE_MAX);
    expect(movePaddle(150, 0, -500, 99999, DT)).toBe(PADDLE_MIN);
    expect(movePaddle(150, 0, 9999, 99999, DT)).toBe(PADDLE_MAX);
  });
  it('steer toward a pointer target without overshooting, and ignore a bad one', () => {
    expect(movePaddle(100, 0, 103, PADDLE_SPEED, DT)).toBe(103);
    expect(movePaddle(100, 0, 200, PADDLE_SPEED, DT)).toBeCloseTo(100 + PADDLE_SPEED * DT, 9);
    expect(movePaddle(100, 0, NaN, PADDLE_SPEED, DT)).toBe(100);
    expect(movePaddle(100, 1, 90, PADDLE_SPEED, DT)).toBeLessThan(100); // a target wins over a direction
  });
  it('each player steers only their own paddle', () => {
    let s = playing('two', { ball: { x: 200, y: 150, vx: 0, vy: 0 } });
    s = step(s, hold(1, 0), () => 0.5);
    expect(s.y1).toBeGreaterThan(150);
    expect(s.y2).toBe(150);
    s = step(s, hold(0, -1), () => 0.5);
    expect(s.y2).toBeLessThan(150);
  });
});

describe('the ball and the paddles', () => {
  const rng = () => 0.5;
  it('the angle off a paddle follows where the ball hit: middle straight, ends 60 degrees', () => {
    const cases: [number, number][] = [[0, 0], [1, MAX_ANGLE], [-1, -MAX_ANGLE], [0.5, MAX_ANGLE / 2]];
    for (const [off, angle] of cases) {
      const reach = PADDLE_H / 2 + BALL_R * EDGE_SLACK;
      const py = 150;
      const s = step(flying(FACE_L + BALL_R + 1, py + off * reach, -300, 0, { y1: py, y2: 40 }), NO_INPUT, rng);
      expect(s.events).toContain('paddle');
      expect(Math.atan2(s.ball.vy, s.ball.vx)).toBeCloseTo(angle, 3);
      expect(s.ball.vx).toBeGreaterThan(0);
    }
    expect(hitOffset(150, 150)).toBe(0);
    expect(hitOffset(1e6, 150)).toBe(1);
    expect(hitOffset(-1e6, 150)).toBe(-1);
  });
  it('the right paddle sends it back left, mirrored', () => {
    const reach = PADDLE_H / 2 + BALL_R * EDGE_SLACK;
    const s = step(flying(FACE_R - BALL_R - 1, 150 + reach, 300, 0, { y2: 150, y1: 40 }), NO_INPUT, rng);
    expect(s.events).toContain('paddle');
    expect(s.ball.vx).toBeLessThan(0);
    expect(s.ball.vy).toBeGreaterThan(0);
    expect(Math.atan2(s.ball.vy, -s.ball.vx)).toBeCloseTo(MAX_ANGLE, 3);
  });
  it('every hit is 7 percent faster, up to 520 and no more', () => {
    let s = flying(FACE_L + BALL_R + 1, 150, -BALL_START, 0, { y1: 150, y2: 150 });
    let prev = BALL_START;
    const speeds: number[] = [];
    for (let hits = 0; hits < 25; hits++) {
      s = step({ ...s, ball: { x: FACE_L + BALL_R + 1, y: 150, vx: -Math.abs(s.ball.vx) || -prev, vy: 0 }, y1: 150 }, NO_INPUT, rng);
      const sp = Math.hypot(s.ball.vx, s.ball.vy);
      speeds.push(sp);
      expect(sp).toBeCloseTo(Math.min(BALL_MAX, prev * SPEEDUP), 6);
      prev = sp;
    }
    expect(speeds[24]).toBeCloseTo(BALL_MAX, 6);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(BALL_MAX + 1e-9);
  });
  it('bounces off the top and bottom without losing speed', () => {
    let s = flying(200, BALL_R + 1, 100, -200);
    const sp0 = Math.hypot(100, 200);
    s = step(s, NO_INPUT, rng);
    expect(s.events).toContain('wall');
    s = step(s, NO_INPUT, rng);
    expect(s.ball.vy).toBeGreaterThan(0);
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeCloseTo(sp0, 9);
    let t = flying(200, H - BALL_R - 1, 100, 200);
    for (let i = 0; i < 3; i++) t = step(t, NO_INPUT, rng);
    expect(t.ball.vy).toBeLessThan(0);
    expect(t.ball.y).toBeLessThanOrEqual(H - BALL_R);
  });
  it('a ball past the paddle is a point for the other side', () => {
    let s = flying(FACE_L + BALL_R + 2, 270, -300, 0, { y1: 40, y2: 150 });
    let n = 0;
    while (s.score2 === 0 && n < 100) { s = step(s, NO_INPUT, rng); n++; }
    expect(s.score2).toBe(1);
    expect(s.score1).toBe(0);
    expect(s.events).toContain('point');
    expect(s.ball).toEqual({ x: W / 2, y: H / 2, vx: 0, vy: 0 });
    expect(s.serveTimer).toBeCloseTo(SERVE_DELAY, 9);
    expect(s.serveDir).toBe(-1); // serve toward the side that lost it
    expect(s.rally).toBe(0);
    let r = flying(FACE_R - BALL_R - 2, 270, 300, 0, { y2: 40, y1: 150 });
    n = 0;
    while (r.score1 === 0 && n < 100) { r = step(r, NO_INPUT, rng); n++; }
    expect(r.score1).toBe(1);
    expect(r.serveDir).toBe(1);
  });
  it('a ball behind a paddle is not rescued by moving the paddle onto it', () => {
    // centre of the ball is already beyond the back edge of the left paddle
    const s = step(flying(PAD_MARGIN - 2, 150, -200, 0, { y1: 150 }), NO_INPUT, rng);
    expect(s.events).not.toContain('paddle');
  });
  it('rally counts hits since the serve, best rally keeps the longest', () => {
    let s = flying(FACE_L + BALL_R + 1, 150, -250, 0, { y1: 150, y2: 150 });
    s = step(s, NO_INPUT, rng);
    expect([s.rally, s.bestRally]).toEqual([1, 1]);
    s = step({ ...s, ball: { x: FACE_R - BALL_R - 1, y: 150, vx: 300, vy: 0 } }, NO_INPUT, rng);
    expect([s.rally, s.bestRally]).toEqual([2, 2]);
    const lost = step({ ...s, ball: { x: -BALL_R - 1, y: 150, vx: -100, vy: 0 } }, NO_INPUT, rng);
    expect(lost.rally).toBe(0);
    expect(lost.bestRally).toBe(2);
  });

  it('the ball cannot pass through a paddle: 4000 random shots agree with an independent prediction', () => {
    const rng2 = mulberry32(2026);
    let bounced = 0;
    let missed = 0;
    for (let n = 0; n < 4000; n++) {
      const speed = BALL_START + rng2() * (BALL_MAX - BALL_START);
      const ang = (rng2() * 2 - 1) * MAX_ANGLE;
      const y0 = BALL_R + rng2() * (H - 2 * BALL_R);
      const py = PADDLE_MIN + rng2() * (PADDLE_MAX - PADDLE_MIN);
      const vx = -Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed;
      // independent oracle: where the centre of the ball will be when it reaches the face of the paddle, and when it is level with the paddle's back edge
      const arrive = predictY(260, y0, vx, vy, FACE_L + BALL_R);
      const arriveBack = predictY(260, y0, vx, vy, PAD_MARGIN + 1);
      const dist = Math.abs(arrive - py);
      const distBack = Math.abs(arriveBack - py);
      const reach = PADDLE_H / 2 + BALL_R * EDGE_SLACK;
      // A step and a wall bounce can move the ball a few units, and a steep ball can clip the paddle's end while it passes: skip the close calls.
      const shouldBounce = dist < reach - 8;
      const shouldMiss = dist > reach + 8 && distBack > reach + 8;
      if (!shouldBounce && !shouldMiss) continue;
      let s = flying(260, y0, vx, vy, { y1: py, y2: 40 });
      let hit = false;
      let out = false;
      for (let i = 0; i < 400 && !hit && !out; i++) {
        s = step(s, NO_INPUT, rng);
        if (s.events.includes('paddle')) hit = true;
        if (s.events.includes('point')) out = true;
      }
      if (shouldBounce) { expect(hit, `shot ${n} should bounce (dist ${dist.toFixed(1)})`).toBe(true); bounced++; }
      else { expect(out, `shot ${n} should be missed (dist ${dist.toFixed(1)})`).toBe(true); missed++; }
    }
    expect(bounced).toBeGreaterThan(400);
    expect(missed).toBeGreaterThan(400);
  }, 60_000);

  it('the prediction matches a brute-force bouncing simulation on 3000 random shots', () => {
    const rng2 = mulberry32(11);
    for (let n = 0; n < 3000; n++) {
      const x0 = 40 + rng2() * 320;
      const y0 = BALL_R + rng2() * (H - 2 * BALL_R);
      const speed = 100 + rng2() * 500;
      const ang = (rng2() - 0.5) * 2 * MAX_ANGLE;
      const dir = rng2() < 0.5 ? -1 : 1;
      const vx = Math.cos(ang) * speed * dir;
      const vy = Math.sin(ang) * speed;
      const targetX = dir < 0 ? FACE_L + BALL_R : FACE_R - BALL_R;
      // brute force: tiny steps, reflect off the walls
      let x = x0;
      let y = y0;
      let vyy = vy;
      const h = 0.0005;
      let guard = 0;
      while (((dir < 0 && x > targetX) || (dir > 0 && x < targetX)) && guard++ < 2e6) {
        x += vx * h;
        y += vyy * h;
        if (y < BALL_R) { y = 2 * BALL_R - y; vyy = -vyy; }
        if (y > H - BALL_R) { y = 2 * (H - BALL_R) - y; vyy = -vyy; }
      }
      expect(Math.abs(predictY(x0, y0, vx, vy, targetX) - y), `shot ${n}`).toBeLessThan(0.5 + speed * h);
    }
  }, 120_000);
  it('prediction is safe with a still or backwards ball', () => {
    expect(predictY(200, 150, 0, 50, 24)).toBe(150);
    expect(predictY(200, 150, 100, 0, 24)).toBe(150); // moving away: stays where it is
    expect(predictY(200, 1000, 0, 0, 24)).toBe(H - BALL_R);
  });
});

describe('serving and winning', () => {
  it('waits 0.9 s, then serves toward the side that lost, within 25 degrees of straight across at the starting speed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed);
      let s = begin(newGame('two', false, rng));
      const dir = s.serveDir;
      let n = 0;
      while (s.ball.vx === 0 && n < 200) { s = step(s, NO_INPUT, rng); n++; }
      expect(Math.abs(n * DT - SERVE_DELAY)).toBeLessThan(0.05);
      expect(Math.sign(s.ball.vx)).toBe(dir);
      expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeCloseTo(BALL_START, 6);
      expect(Math.abs(Math.atan2(s.ball.vy, Math.abs(s.ball.vx)))).toBeLessThanOrEqual(SERVE_ANGLE + 1e-9);
      expect(s.events).toContain('serve');
    }
  });
  it('the first player to 7 wins, the match ends and the winner is named', () => {
    const rng = () => 0.5;
    let s = flying(-BALL_R - 1, 150, -100, 0, { score1: 3, score2: 6, y1: 40 });
    s = step(s, NO_INPUT, rng);
    expect(s.status).toBe('over');
    expect(s.winner).toBe(2);
    expect(s.score2).toBe(7);
    expect(s.events).toContain('win');
    expect(step(s, hold(1), rng)).toBe(s);
    let t = flying(W + BALL_R + 1, 150, 100, 0, { score1: 6, score2: 2 });
    t = step(t, NO_INPUT, rng);
    expect(t.status).toBe('over');
    expect(t.winner).toBe(1);
    // against the computer, losing is announced as a loss event
    const c = step(flying(-BALL_R - 1, 150, -100, 0, { score1: 0, score2: 6, y1: 40 }, 'medium'), NO_INPUT, rng);
    expect(c.events).toContain('lose');
    const w = step(flying(W + BALL_R + 1, 150, 100, 0, { score1: 6, score2: 0 }, 'medium'), NO_INPUT, rng);
    expect(w.events).toContain('win');
  });
  it('a 6-6 score keeps playing, 7-6 ends it', () => {
    const rng = () => 0.5;
    const a = step(flying(W + BALL_R + 1, 150, 100, 0, { score1: 5, score2: 6 }), NO_INPUT, rng);
    expect(a.status).toBe('running');
    expect(a.score1).toBe(6);
    const b = step(flying(W + BALL_R + 1, 150, 100, 0, { score1: 6, score2: 6 }), NO_INPUT, rng);
    expect(b.status).toBe('over');
  });
});

describe('the computer', () => {
  /** A pilot that knows exactly where the ball will land and aims for an end of its paddle, away from the computer. */
  const pilot = (s: GameState): Input => {
    const b = s.ball;
    if (b.vx >= 0) return { p1: 0, p2: 0, t1: H / 2, t2: null };
    const away = s.y2 > H / 2 ? -0.9 : 0.9;
    const reach = PADDLE_H / 2 + BALL_R * EDGE_SLACK;
    return { p1: 0, p2: 0, t1: predictY(b.x, b.y, b.vx, b.vy, FACE_L + BALL_R) - away * reach, t2: null };
  };
  const match = (mode: Mode, seed: number, input: (s: GameState) => Input, maxSeconds: number): GameState => {
    const rng = mulberry32(seed * 131 + mode.length);
    let s = begin(newGame(mode, false, rng));
    for (let i = 0; i < 60 * maxSeconds && s.status === 'running'; i++) s = step(s, input(s), rng);
    return s;
  };

  it('decides only every so often: the target stays put between decisions', () => {
    const rng = mulberry32(5);
    let s = flying(150, 100, 300, 120, { aiTimer: 0, aiTarget: 150, y2: 150 }, 'easy');
    s = step(s, NO_INPUT, rng);
    const t0 = s.aiTarget;
    expect(s.aiTimer).toBeCloseTo(AI.easy.react - DT * 0, 6);
    for (let i = 0; i < Math.floor(AI.easy.react / DT) - 3; i++) {
      s = step(s, NO_INPUT, rng);
      expect(s.aiTarget).toBe(t0);
    }
  });
  it('never moves faster than its level allows', () => {
    for (const mode of ['easy', 'medium', 'hard'] as const) {
      const rng = mulberry32(8);
      let s = begin(newGame(mode, false, rng));
      let worst = 0;
      for (let i = 0; i < 3000 && s.status === 'running'; i++) {
        const before = s.y2;
        s = step(s, pilot(s), rng);
        worst = Math.max(worst, Math.abs(s.y2 - before) / DT);
      }
      expect(worst, mode).toBeLessThanOrEqual(AI[mode].speed + 1e-6);
      expect(worst, mode).toBeGreaterThan(AI[mode].speed * 0.5);
    }
  });
  it('heads for the middle while the ball is going away from it', () => {
    const rng = mulberry32(2);
    let s = flying(200, 40, -250, 0, { y2: 40, aiTimer: 0 }, 'hard');
    for (let i = 0; i < 90; i++) s = step({ ...s, ball: { x: 200, y: 40, vx: -250, vy: 0 } }, NO_INPUT, rng);
    expect(s.aiTarget).toBe(H / 2);
    expect(Math.abs(s.y2 - H / 2)).toBeLessThan(10);
  });
  it('aims with a bigger error when the ball is faster, but the error never exceeds its level limit', () => {
    for (const mode of ['easy', 'medium', 'hard'] as const) {
      let slowMax = 0;
      let fastMax = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const rng = mulberry32(seed);
        const mk = (sp: number) => step(flying(300, 150, sp, 0, { aiTimer: 0, y2: 150 }, mode), NO_INPUT, rng);
        slowMax = Math.max(slowMax, Math.abs(mk(BALL_START).aiTarget - 150));
        fastMax = Math.max(fastMax, Math.abs(mk(BALL_MAX).aiTarget - 150));
      }
      expect(fastMax, mode).toBeGreaterThan(slowMax * 1.5);
      expect(slowMax, mode).toBeLessThanOrEqual(AI[mode].error * (PADDLE_H / 2) + 1e-6);
      expect(fastMax, mode).toBeLessThanOrEqual(AI[mode].error * (PADDLE_H / 2) * (BALL_MAX / BALL_START) ** 1.5 + 1e-6);
    }
  });
  it('beats a player who stands still, at every level, every time (a still paddle in the middle may return a serve, but never wins)', () => {
    for (const mode of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const s = match(mode, seed, () => NO_INPUT, 300);
        expect(s.status, `${mode} ${seed}`).toBe('over');
        expect(s.winner).toBe(2);
      }
    }
  }, 60_000);
  it('a perfect pilot beats Easy and Medium every time and Hard most of the time, and every match ends', () => {
    const wins: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    const secs: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    const games = 20;
    for (const mode of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 1; seed <= games; seed++) {
        const s = match(mode, seed, pilot, 900);
        expect(s.status, `${mode} ${seed} did not finish`).toBe('over');
        if (s.winner === 1) wins[mode]++;
        secs[mode] += s.steps / 60;
      }
    }
    expect(wins.easy).toBe(games);
    expect(wins.medium).toBe(games);
    expect(wins.hard).toBeGreaterThanOrEqual(Math.floor(games * 0.6));
    // harder levels take a perfect pilot longer
    expect(secs.easy).toBeLessThan(secs.medium);
    expect(secs.medium).toBeLessThan(secs.hard);
  }, 240_000);
});

describe('purity and determinism', () => {
  it('does not change the state it was given', () => {
    const s = flying(200, 100, 250, 90, {}, 'medium');
    const before = JSON.stringify(s);
    step(s, hold(1, -1), mulberry32(9));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('the same seed and the same keys replay the same match, a different seed does not', () => {
    const play = (seed: number) => {
      const rng = mulberry32(seed);
      let s = begin(newGame('medium', false, rng));
      const trace: string[] = [];
      for (let i = 0; i < 1500 && s.status === 'running'; i++) {
        s = step(s, hold(i % 90 < 45 ? 1 : -1), rng);
        trace.push(`${s.ball.x.toFixed(4)}|${s.ball.y.toFixed(4)}|${s.y2.toFixed(3)}|${s.score1}-${s.score2}`);
      }
      return trace;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(77)).not.toEqual(play(78));
  });
  it('survives bad time steps', () => {
    for (const dt of [NaN, -1, 0, Infinity, 5]) {
      const t = step(flying(200, 100, 250, 90), hold(1, 1), () => 0.5, dt);
      for (const v of [t.ball.x, t.ball.y, t.y1, t.y2]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('5000 random steps in every mode never break an invariant', () => {
  for (const mode of MODES) {
    it(mode, () => {
      const rng = mulberry32(mode.length * 53);
      const inRng = mulberry32(99 + mode.length);
      let s = begin(newGame(mode, mode === 'hard', rng));
      let input: Input = NO_INPUT;
      let points = 0;
      for (let i = 0; i < 5000 && s.status === 'running'; i++) {
        if (i % 9 === 0) input = { p1: (Math.floor(inRng() * 3) - 1) as -1 | 0 | 1, p2: (Math.floor(inRng() * 3) - 1) as -1 | 0 | 1, t1: inRng() < 0.3 ? inRng() * 400 - 50 : null, t2: inRng() < 0.3 ? inRng() * 400 : null };
        const before = s.score1 + s.score2;
        s = step(s, input, rng);
        for (const v of [s.ball.x, s.ball.y, s.ball.vx, s.ball.vy, s.y1, s.y2]) expect(Number.isFinite(v)).toBe(true);
        expect(s.y1).toBeGreaterThanOrEqual(PADDLE_MIN);
        expect(s.y1).toBeLessThanOrEqual(PADDLE_MAX);
        expect(s.y2).toBeGreaterThanOrEqual(PADDLE_MIN);
        expect(s.y2).toBeLessThanOrEqual(PADDLE_MAX);
        expect(s.ball.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
        expect(s.ball.y).toBeLessThanOrEqual(H - BALL_R + 1e-9);
        expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeLessThanOrEqual(ballMax(s.slow) + 1e-6);
        expect(s.score1).toBeLessThanOrEqual(WIN_SCORE);
        expect(s.score2).toBeLessThanOrEqual(WIN_SCORE);
        expect(s.score1 + s.score2).toBeGreaterThanOrEqual(before);
        expect(s.score1 + s.score2).toBeLessThanOrEqual(before + 1);
        points = s.score1 + s.score2;
        if (s.ball.vx !== 0) expect(Math.abs(s.ball.vx)).toBeGreaterThan(0.3 * Math.hypot(s.ball.vx, s.ball.vy) - 1e-6); // never an endless vertical shot
      }
      expect(points).toBeGreaterThan(0);
    }, 60_000);
  }
});

describe('keys, pointers and the clock', () => {
  it('against the computer W/S and Up/Down all steer player 1', () => {
    for (const mode of ['easy', 'medium', 'hard'] as Mode[]) {
      expect(keyToPaddle('w', mode)).toEqual({ player: 1, dir: -1 });
      expect(keyToPaddle('ArrowUp', mode)).toEqual({ player: 1, dir: -1 });
      expect(keyToPaddle('S', mode)).toEqual({ player: 1, dir: 1 });
      expect(keyToPaddle('ArrowDown', mode)).toEqual({ player: 1, dir: 1 });
    }
  });
  it('with two players W/S steer player 1 and Up/Down steer player 2', () => {
    expect(keyToPaddle('w', 'two')).toEqual({ player: 1, dir: -1 });
    expect(keyToPaddle('s', 'two')).toEqual({ player: 1, dir: 1 });
    expect(keyToPaddle('ArrowUp', 'two')).toEqual({ player: 2, dir: -1 });
    expect(keyToPaddle('ArrowDown', 'two')).toEqual({ player: 2, dir: 1 });
    for (const k of ['Enter', ' ', 'ArrowLeft', 'a', 'p', 'Escape', '']) expect(keyToPaddle(k, 'two'), k).toBeNull();
  });
  it('a pointer steers the player on its side of the court, always player 1 against the computer', () => {
    expect(pointerSteer(50, 100, 'two')).toEqual({ player: 1, target: 100 });
    expect(pointerSteer(350, 100, 'two')).toEqual({ player: 2, target: 100 });
    expect(pointerSteer(350, 100, 'hard').player).toBe(1);
    expect(pointerSteer(10, -50, 'two').target).toBe(PADDLE_MIN);
    expect(pointerSteer(10, 999, 'two').target).toBe(PADDLE_MAX);
    expect(pointerSteer(10, NaN, 'two').target).toBe(H / 2);
    expect(clamp(5, 0, 3)).toBe(3);
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
  it('a long stall cannot fast-forward the match, and bad numbers are safe', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
  });
});

describe('best rallies', () => {
  it('has one key per mode and pace', () => {
    const keys = MODES.flatMap((m) => [bestKey(m, false), bestKey(m, true)]);
    expect(new Set(keys).size).toBe(8);
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ medium: 12, hard: '9', easy: 1.5, 'two-slow': -3, nope: 4, 'easy-slow': MAX_SCORE + 1 })).toEqual({ medium: 12 });
    expect(parseBests(JSON.parse('{"__proto__":{"hard":50},"hard":7}'))).toEqual({ hard: 7 });
  });
  it('only a whole, positive, possible rally can set a best, and only if longer', () => {
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

describe('messages and sound', () => {
  const done = (mode: Mode, s1: number, s2: number, rally: number): GameState => ({ ...newGame(mode, false, mulberry32(1)), status: 'over', score1: s1, score2: s2, bestRally: rally, winner: s1 > s2 ? 1 : 2 });
  it('say who won and praise the game, never scold', () => {
    expect(endMessage(done('medium', 7, 4, 12))).toBe('You win 7 to 4! Longest rally 12 hits.');
    expect(endMessage(done('hard', 3, 7, 1))).toBe('The computer wins 7 to 3, but that was a good game. Longest rally 1 hit. Try again!');
    expect(endMessage(done('two', 7, 5, 9))).toBe('Player 1 wins 7 to 5. Longest rally 9 hits.');
    expect(endMessage(done('two', 2, 7, 9))).toBe('Player 2 wins 7 to 2. Longest rally 9 hits.');
    expect(endMessage(newGame('medium', false, mulberry32(1)))).toBe('');
    expect(sideNames('two')).toEqual(['Player 1', 'Player 2']);
    expect(sideNames('easy')).toEqual(['You', 'The computer']);
  });
  it('builds a share line that is right before, during and after a match', () => {
    expect(shareText('medium', null, 0)).toBe('Paddle Rally (Medium computer): no match played yet');
    expect(shareText('easy', { s1: 7, s2: 2, rally: 1 }, 0)).toBe('Paddle Rally (Easy computer): 7 to 2, longest rally 1 hit');
    expect(shareText('two', { s1: 3, s2: 4, rally: 15 }, 20)).toBe('Paddle Rally (Two players): 3 to 4, longest rally 15 hits, best rally 20 hits');
    expect(shareText('two', { s1: 3, s2: 4, rally: 2 }, 2, true)).toBe('Paddle Rally (Two players): 3 to 4 (in progress), longest rally 2 hits, best rally 2 hits');
    for (const t of [shareText('easy', { s1: 0, s2: 0, rally: 0 }, 0), describeState(newGame('hard', false, mulberry32(1)))]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(describeState(newGame('hard', false, mulberry32(1)))).toBe('Paddle Rally. You 0, The computer 0. First to 7 wins. Rally 0 hits.');
    expect(plural(1, 'hit', 'hits')).toBe('1 hit');
  });
  it('every sound is short, quiet and within hearing range', () => {
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    for (const [name, def] of Object.entries(SFX)) {
      expect(def.ms, name).toBeLessThanOrEqual(400);
      for (const f of def.freq) { expect(f, name).toBeGreaterThanOrEqual(60); expect(f * 1.5, name).toBeLessThanOrEqual(2000); }
    }
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('the touch buttons are at least 56 px and the how-it-works heading is a 32 px target', () => {
    const hold2 = src.match(/#prl-app \.prl-hold \{([^}]*)\}/);
    expect(hold2).not.toBeNull();
    expect(hold2![1]).toContain('min-height: 3.5rem');
    expect(hold2![1]).toContain('min-width: 3.5rem');
    const rule = src.match(/\.prl-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect((src.match(/data-player="/g) ?? []).length).toBe(4);
  });
  it('has no dotted centre line and uses rounded paddles', () => {
    expect(src).not.toMatch(/setLineDash|lineDash/);
    expect(src).toContain('arcTo');
  });
  it('pauses on Escape, P and a hidden tab, and honours reduced motion', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('if (!reduced) {'); // no ball trail
  });
  it('does not trap keys when paused or finished with focus elsewhere, and ignores key repeat', () => {
    expect(src).toContain('keyScope(phase, app.contains(document.activeElement))');
    expect(src).toContain("if (scope !== 'all') return;");
    expect(src).toContain('if (e.repeat) return;');
    expect(src).toContain('spaceIsNative(t.tagName)');
  });
  it('sound is off until the button is pressed', () => {
    expect(src).toContain('let soundOn = false;');
    expect(src).toContain('aria-pressed="false"');
    expect(src).not.toMatch(/^\s*(const|let)\s+actx\s*=\s*new/m);
  });
  it('starts on the first input, never on load, and a match that is left still counts its longest rally', () => {
    expect(src).toContain('begin(st)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
    expect(src).toContain('const settle = () =>');
  });
  it('the second player controls are hidden unless two players is chosen', () => {
    expect(src).toContain('pair2.hidden = !two;');
    expect(src).toContain('id="prl-pair2" class="prl-pair" data-side="2" hidden');
  });
});
