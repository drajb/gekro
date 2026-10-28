/**
 * games-snake.test.ts - the engine behind `snake`.
 *
 * Pinned: walls end the game and wrap-around re-enters from the far side, the
 * tail cell is free to enter on the step it leaves, eating grows by exactly one,
 * a reversal into the neck is impossible however fast keys arrive, food is
 * uniform over free cells and never on the snake, a seed replays exactly, a
 * perfect path fills the board and wins, and a long random-play fuzz keeps every
 * invariant. The fixed-step accumulator and best-score bookkeeping are pinned too.
 */
import { describe, it, expect } from 'vitest';
import {
  initialState, step, placeFood, queueDirection, nextDirection, keyToDir, swipeDirection, advance, stepMs,
  bestKey, parseBests, recordBest, endMessage, shareText, isReversal, mulberry32,
  COLS, ROWS, START_LENGTH, MAX_QUEUE, MAX_SCORE, SPEEDS, DIRS, OPPOSITE, SPEED_KEYS, WALLS_KEYS,
  type Dir, type GameState, type Point,
} from '../src/components/apps-private/snake/helpers';

const pts = (list: [number, number][]): Point[] => list.map(([x, y]) => ({ x, y }));
const mk = (
  cols: number, rows: number, snake: [number, number][], dir: Dir, food: [number, number] | null, wrap = false,
): GameState => ({
  cols, rows, wrap, snake: pts(snake), dir, food: food ? { x: food[0], y: food[1] } : null,
  score: 0, status: 'running', cause: null, initialLength: snake.length,
});
const noRng = () => 0;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

describe('initial state', () => {
  it('is a 20 x 20 board with a 3-segment snake heading right in the middle', () => {
    const s = initialState({}, mulberry32(1));
    expect([s.cols, s.rows, COLS, ROWS, START_LENGTH]).toEqual([20, 20, 20, 20, 3]);
    expect(s.snake).toEqual(pts([[10, 10], [9, 10], [8, 10]]));
    expect(s.dir).toBe('right');
    expect(s.status).toBe('running');
    expect(s.score).toBe(0);
    expect(s.cause).toBeNull();
  });
  it('places the first food on a free in-bounds cell', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = initialState({}, mulberry32(seed));
      const f = s.food!;
      expect(f.x >= 0 && f.x < 20 && f.y >= 0 && f.y < 20).toBe(true);
      expect(s.snake.some((p) => same(p, f))).toBe(false);
    }
  });
  it('clamps silly sizes instead of producing an overlapping snake', () => {
    const s = initialState({ cols: 3, rows: 2, length: 99 }, mulberry32(2));
    expect(s.snake.length).toBeLessThan(6);
    expect(new Set(s.snake.map((p) => `${p.x},${p.y}`)).size).toBe(s.snake.length);
    expect(s.snake.every((p) => p.x >= 0 && p.x < 3 && p.y >= 0 && p.y < 2)).toBe(true);
  });
});

describe('moving', () => {
  it('moves the head one cell and drops the tail, keeping length', () => {
    const s = mk(10, 10, [[5, 5], [4, 5], [3, 5]], 'right', [9, 9]);
    const n = step(s, 'right', noRng);
    expect(n.snake).toEqual(pts([[6, 5], [5, 5], [4, 5]]));
    expect(n.status).toBe('running');
    expect(n.score).toBe(0);
  });
  it('turns in all four directions', () => {
    const s = mk(10, 10, [[5, 5], [4, 5], [3, 5]], 'right', [9, 9]);
    expect(step(s, 'up', noRng).snake[0]).toEqual({ x: 5, y: 4 });
    expect(step(s, 'down', noRng).snake[0]).toEqual({ x: 5, y: 6 });
    expect(step(s, 'right', noRng).snake[0]).toEqual({ x: 6, y: 5 });
  });
  it('does not mutate the state it was given', () => {
    const s = mk(10, 10, [[5, 5], [4, 5], [3, 5]], 'right', [6, 5]);
    const before = JSON.stringify(s);
    step(s, 'right', mulberry32(1));
    step(s, 'up', mulberry32(1));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('does nothing once the game is over', () => {
    const s = { ...mk(10, 10, [[0, 5], [1, 5]], 'left', [9, 9]), status: 'dead' as const };
    expect(step(s, 'up', noRng)).toBe(s);
    const w = { ...mk(10, 10, [[0, 5], [1, 5]], 'left', null), status: 'won' as const };
    expect(step(w, 'up', noRng)).toBe(w);
  });
});

describe('no reversal into the neck', () => {
  it('ignores the opposite direction and keeps the heading', () => {
    const s = mk(10, 10, [[5, 5], [4, 5], [3, 5]], 'right', [9, 9]);
    const n = step(s, 'left', noRng);
    expect(n.status).toBe('running');
    expect(n.dir).toBe('right');
    expect(n.snake[0]).toEqual({ x: 6, y: 5 });
  });
  it('holds for every heading', () => {
    for (const d of DIRS) {
      const s = mk(10, 10, [[5, 5], [5 - (d === 'right' ? 1 : d === 'left' ? -1 : 0), 5 - (d === 'down' ? 1 : d === 'up' ? -1 : 0)]], d, [0, 0]);
      expect(isReversal(s, OPPOSITE[d])).toBe(true);
      const n = step(s, OPPOSITE[d], noRng);
      expect(n.status).toBe('running');
      expect(n.dir).toBe(d);
    }
  });
  it('a lone head may turn any way', () => {
    const s = mk(10, 10, [[5, 5]], 'right', [9, 9]);
    expect(isReversal(s, 'left')).toBe(false);
    expect(step(s, 'left', noRng).snake[0]).toEqual({ x: 4, y: 5 });
  });
});

describe('walls', () => {
  const heads: [Dir, [number, number]][] = [['up', [5, 0]], ['down', [5, 9]], ['left', [0, 5]], ['right', [9, 5]]];
  for (const [dir, [x, y]] of heads) {
    it(`ends the game when ${dir} runs into the edge`, () => {
      const dx = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
      const dy = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
      const s = mk(10, 10, [[x, y], [x + dx, y + dy]], dir, [4, 4]);
      const n = step(s, dir, noRng);
      expect(n.status).toBe('dead');
      expect(n.cause).toBe('wall');
      expect(n.snake).toEqual(s.snake);
      expect(n.score).toBe(0);
    });
    it(`wraps ${dir} to the opposite edge when wrap is on`, () => {
      const dx = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
      const dy = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
      const s = mk(10, 10, [[x, y], [x + dx, y + dy]], dir, [4, 4], true);
      const n = step(s, dir, noRng);
      expect(n.status).toBe('running');
      const expected = dir === 'up' ? { x: 5, y: 9 } : dir === 'down' ? { x: 5, y: 0 } : dir === 'left' ? { x: 9, y: 5 } : { x: 0, y: 5 };
      expect(n.snake[0]).toEqual(expected);
      expect(n.snake).toHaveLength(2);
    });
  }
  it('a stopped game does not move after a wall hit', () => {
    const s = mk(10, 10, [[9, 5], [8, 5]], 'right', [4, 4]);
    const dead = step(s, 'right', noRng);
    expect(step(dead, 'up', noRng)).toBe(dead);
  });
});

describe('self collision', () => {
  it('ends the game when the head enters a body segment', () => {
    // Head (1,1) heading up; (2,1) is body segment 3 of 5, not the tail.
    const s = mk(6, 6, [[1, 1], [1, 2], [2, 2], [2, 1], [2, 0]], 'up', [5, 5]);
    const n = step(s, 'right', noRng);
    expect(n.status).toBe('dead');
    expect(n.cause).toBe('self');
    expect(n.snake).toEqual(s.snake);
  });
  it('entering the cell the tail is leaving this step is legal', () => {
    // A 2 x 2 ring: the head at (0,1) steps up into (0,0), where the tail is moving out.
    const s = mk(4, 4, [[0, 1], [1, 1], [1, 0], [0, 0]], 'left', [3, 3]);
    const n = step(s, 'up', noRng);
    expect(n.status).toBe('running');
    expect(n.snake).toEqual(pts([[0, 0], [0, 1], [1, 1], [1, 0]]));
    expect(n.snake).toHaveLength(4);
  });
  it('a longer chase of the own tail stays alive step after step', () => {
    // Circle a 2 x 2 loop forever: right, down, left, up repeated.
    let s = mk(4, 4, [[1, 0], [0, 0], [0, 1], [1, 1]], 'right', [3, 3]);
    // The head is at (1,0) and the tail at (1,1); heading right is not on the loop, so start by turning down.
    const loop: Dir[] = ['down', 'left', 'up', 'right'];
    for (let i = 0; i < 40; i++) {
      s = step(s, loop[i % 4], noRng);
      expect(s.status, `step ${i}`).toBe('running');
      expect(s.snake).toHaveLength(4);
    }
  });
  it('a tick that eats keeps the tail in place, so the snake gets longer rather than shifting', () => {
    const s = mk(4, 4, [[1, 0], [1, 1], [0, 1], [0, 0]], 'up', [2, 0]);
    const n = step(s, 'right', mulberry32(3));
    expect(n.snake).toHaveLength(5);
    expect(n.snake.some((p) => same(p, { x: 0, y: 0 }))).toBe(true);
    expect(n.status).toBe('running');
  });
});

describe('eating and growth', () => {
  it('grows by exactly one, scores one, and keeps the old tail', () => {
    const s = mk(10, 10, [[5, 5], [4, 5], [3, 5]], 'right', [6, 5]);
    const n = step(s, 'right', mulberry32(9));
    expect(n.score).toBe(1);
    expect(n.snake).toHaveLength(4);
    expect(n.snake).toEqual(pts([[6, 5], [5, 5], [4, 5], [3, 5]]));
    expect(n.status).toBe('running');
  });
  it('spawns the next food on an empty cell', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = mk(10, 10, [[5, 5], [4, 5], [3, 5]], 'right', [6, 5]);
      const n = step(s, 'right', mulberry32(seed));
      expect(n.food).not.toBeNull();
      expect(n.snake.some((p) => same(p, n.food!))).toBe(false);
    }
  });
  it('does not grow or score when no food is eaten', () => {
    const s = mk(10, 10, [[5, 5], [4, 5], [3, 5]], 'right', [8, 8]);
    const n = step(s, 'right', noRng);
    expect(n.score).toBe(0);
    expect(n.food).toEqual({ x: 8, y: 8 });
  });
  it('can eat food through a wrap-around edge', () => {
    const s = mk(10, 10, [[9, 5], [8, 5]], 'right', [0, 5], true);
    const n = step(s, 'right', mulberry32(4));
    expect(n.score).toBe(1);
    expect(n.snake[0]).toEqual({ x: 0, y: 5 });
    expect(n.snake).toHaveLength(3);
  });
});

describe('food placement', () => {
  it('maps the rng to free cells in reading order and skips the snake', () => {
    const snake = pts([[0, 0], [1, 0]]);
    expect(placeFood(3, 2, snake, () => 0)).toEqual({ x: 2, y: 0 });
    expect(placeFood(3, 2, snake, () => 0.9999999)).toEqual({ x: 2, y: 1 });
    expect(placeFood(3, 2, snake, () => 1)).toEqual({ x: 2, y: 1 }); // even a bad rng stays in range
  });
  it('returns null on a full board', () => {
    expect(placeFood(2, 2, pts([[0, 0], [1, 0], [1, 1], [0, 1]]), () => 0.5)).toBeNull();
  });
  it('never lands on the snake across many random boards', () => {
    const rng = mulberry32(2026);
    for (let n = 0; n < 400; n++) {
      const cols = 2 + Math.floor(rng() * 8);
      const rows = 2 + Math.floor(rng() * 8);
      const taken = new Set<number>();
      const count = 1 + Math.floor(rng() * (cols * rows - 1));
      while (taken.size < count) taken.add(Math.floor(rng() * cols * rows));
      const snake = [...taken].map((i) => ({ x: i % cols, y: Math.floor(i / cols) }));
      const f = placeFood(cols, rows, snake, rng)!;
      expect(taken.has(f.y * cols + f.x)).toBe(false);
      expect(f.x >= 0 && f.x < cols && f.y >= 0 && f.y < rows).toBe(true);
    }
  });
  it('is uniform over the free cells', () => {
    const snake = pts([[1, 1], [0, 1], [2, 1]]); // 3 x 3 board, 6 free cells
    const rng = mulberry32(77);
    const hits = new Map<string, number>();
    const N = 12000;
    for (let i = 0; i < N; i++) {
      const f = placeFood(3, 3, snake, rng)!;
      const k = `${f.x},${f.y}`;
      hits.set(k, (hits.get(k) ?? 0) + 1);
    }
    expect(hits.size).toBe(6);
    for (const v of hits.values()) expect(Math.abs(v - N / 6)).toBeLessThan(N / 6 * 0.12);
  });
});

describe('determinism', () => {
  const script: Dir[] = [];
  const r = mulberry32(5);
  for (let i = 0; i < 300; i++) script.push(DIRS[Math.floor(r() * 4)]);
  const play = (seed: number, wrap: boolean) => {
    const rng = mulberry32(seed);
    let s = initialState({ wrap }, rng);
    const trace: string[] = [];
    for (const d of script) {
      s = step(s, d, rng);
      trace.push(JSON.stringify(s));
      if (s.status !== 'running') break;
    }
    return trace;
  };
  it('replays exactly for the same seed', () => {
    expect(play(123, false)).toEqual(play(123, false));
    expect(play(123, true)).toEqual(play(123, true));
  });
  it('differs for a different seed', () => {
    expect(play(123, true)).not.toEqual(play(124, true));
  });
});

describe('winning', () => {
  it('a snake that fills the last free cell wins', () => {
    const s = mk(2, 1, [[0, 0]], 'right', [1, 0]);
    const n = step(s, 'right', noRng);
    expect(n.status).toBe('won');
    expect(n.score).toBe(1);
    expect(n.snake).toHaveLength(2);
    expect(n.food).toBeNull();
  });
  // A Hamiltonian cycle on an even-sided board: column 0 is the way back up, the rest snakes row by row.
  const cycleDir = (p: Point, c: number, r: number): Dir => {
    if (p.x === 0) return p.y === 0 ? 'right' : 'up';
    if (p.y % 2 === 0) return p.x === c - 1 ? 'down' : 'right';
    if (p.x === 1) return p.y === r - 1 ? 'left' : 'down';
    return 'left';
  };
  for (const size of [4, 6, 8]) {
    for (const wrap of [false, true]) {
      it(`${size} x ${size}${wrap ? ' wrapped' : ''}: following the cycle fills the board and wins`, () => {
        const rng = mulberry32(size * 31 + (wrap ? 1 : 0));
        let s: GameState = mk(size, size, [[2, 0], [1, 0], [0, 0]], 'right', null, wrap);
        s = { ...s, food: placeFood(size, size, s.snake, rng) };
        let ticks = 0;
        while (s.status === 'running' && ticks++ < size ** 4 + 10) s = step(s, cycleDir(s.snake[0], size, size), rng);
        expect(s.status).toBe('won');
        expect(s.score).toBe(size * size - 3);
        expect(s.snake).toHaveLength(size * size);
        expect(new Set(s.snake.map((p) => `${p.x},${p.y}`)).size).toBe(size * size);
        expect(s.food).toBeNull();
        expect(step(s, 'up', rng)).toBe(s);
      });
    }
  }
  it('the largest possible score on the real board is 397', () => {
    expect(MAX_SCORE).toBe(COLS * ROWS - START_LENGTH);
    expect(MAX_SCORE).toBe(397);
  });
});

describe('direction queue', () => {
  it('accepts a turn and holds at most two', () => {
    let q = queueDirection([], 'right', 'up');
    q = queueDirection(q, 'right', 'left');
    expect(q).toEqual(['up', 'left']);
    expect(MAX_QUEUE).toBe(2);
    expect(queueDirection(q, 'right', 'down')).toEqual(['up', 'left']);
  });
  it('drops a repeat of the current heading and an immediate reversal', () => {
    expect(queueDirection([], 'right', 'right')).toEqual([]);
    expect(queueDirection([], 'right', 'left')).toEqual([]);
    expect(queueDirection(['up'], 'right', 'down')).toEqual(['up']); // reverses the queued up
    expect(queueDirection(['up'], 'right', 'up')).toEqual(['up']);
  });
  it('lets two quick turns register as an up-then-left U-turn', () => {
    let q: Dir[] = queueDirection([], 'right', 'up');
    q = queueDirection(q, 'right', 'left');
    const a = nextDirection(q, 'right');
    expect(a.dir).toBe('up');
    const b = nextDirection(a.queue, a.dir);
    expect(b.dir).toBe('left');
    expect(b.queue).toEqual([]);
  });
  it('does not mutate its input', () => {
    const q: Dir[] = ['up'];
    queueDirection(q, 'right', 'left');
    nextDirection(q, 'right');
    expect(q).toEqual(['up']);
  });
  it('nextDirection keeps the heading on an empty queue and skips a stale reversal', () => {
    expect(nextDirection([], 'down')).toEqual({ dir: 'down', queue: [] });
    expect(nextDirection(['up', 'left'], 'down')).toEqual({ dir: 'left', queue: [] });
  });
  it('whatever the key mash, the snake is never steered into its neck', () => {
    const rng = mulberry32(8);
    for (let game = 0; game < 40; game++) {
      let s = initialState({ wrap: true }, rng);
      let q: Dir[] = [];
      for (let t = 0; t < 400 && s.status === 'running'; t++) {
        const presses = Math.floor(rng() * 4);
        for (let k = 0; k < presses; k++) q = queueDirection(q, s.dir, DIRS[Math.floor(rng() * 4)]);
        const nd = nextDirection(q, s.dir);
        q = nd.queue;
        expect(s.snake.length > 1 && nd.dir === OPPOSITE[s.dir]).toBe(false);
        s = step(s, nd.dir, rng);
        if (s.status === 'dead') expect(s.cause).toBe('self'); // wrap on: only the body can kill
      }
    }
  });
});

describe('input mapping', () => {
  it('maps arrows and WASD, case-insensitive for letters, and nothing else', () => {
    expect([keyToDir('ArrowUp'), keyToDir('w'), keyToDir('W')]).toEqual(['up', 'up', 'up']);
    expect([keyToDir('ArrowDown'), keyToDir('s'), keyToDir('S')]).toEqual(['down', 'down', 'down']);
    expect([keyToDir('ArrowLeft'), keyToDir('a'), keyToDir('A')]).toEqual(['left', 'left', 'left']);
    expect([keyToDir('ArrowRight'), keyToDir('d'), keyToDir('D')]).toEqual(['right', 'right', 'right']);
    expect(keyToDir(' ')).toBeNull();
    expect(keyToDir('p')).toBeNull();
    expect(keyToDir('Enter')).toBeNull();
  });
  it('turns a drag into a direction along its dominant axis', () => {
    expect(swipeDirection(40, 5, 22)).toBe('right');
    expect(swipeDirection(-40, 5, 22)).toBe('left');
    expect(swipeDirection(3, 40, 22)).toBe('down');
    expect(swipeDirection(3, -40, 22)).toBe('up');
    expect(swipeDirection(10, 10, 22)).toBeNull();
    expect(swipeDirection(NaN, 50, 22)).toBeNull();
  });
});

describe('fixed-step timing', () => {
  const stepsOver = (hz: number, seconds: number, sps: number): number => {
    const interval = 1000 / sps;
    const dt = 1000 / hz;
    let acc = 0;
    let total = 0;
    for (let i = 0; i < hz * seconds; i++) {
      const r = advance(acc, dt, interval);
      acc = r.acc;
      total += r.steps;
    }
    return total;
  };
  it('plays at the same speed on 30, 60, 144 and 240 Hz screens', () => {
    for (const sp of [6, 9, 13]) {
      for (const hz of [30, 60, 144, 240]) {
        expect(Math.abs(stepsOver(hz, 10, sp) - sp * 10), `${sp} sps @ ${hz} Hz`).toBeLessThanOrEqual(1);
      }
    }
  });
  it('speeds are 6, 9 and 13 steps per second', () => {
    expect(SPEEDS).toEqual({ slow: 6, normal: 9, fast: 13 });
    expect(stepMs('slow')).toBeCloseTo(1000 / 6, 6);
    expect(stepMs('fast')).toBeCloseTo(1000 / 13, 6);
  });
  it('a long stall cannot fast-forward the snake', () => {
    const r = advance(0, 60000, 1000 / 13);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(r.acc).toBeLessThan(1000 / 13);
  });
  it('survives bad numbers', () => {
    expect(advance(NaN, NaN, 100)).toEqual({ steps: 0, acc: 0 });
    expect(advance(0, -50, 100)).toEqual({ steps: 0, acc: 0 });
  });
});

describe('best scores', () => {
  it('has one key per speed and wall combination', () => {
    const keys = SPEED_KEYS.flatMap((s) => WALLS_KEYS.map((w) => bestKey(s, w)));
    expect(new Set(keys).size).toBe(6);
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ 'normal-wall': 12, 'fast-wrap': '9', 'slow-wall': 1.5, 'slow-wrap': -3, 'nope-wall': 4, 'normal-wrap': 99999 }))
      .toEqual({ 'normal-wall': 12 });
  });
  it('only a whole, positive, possible score can set a best, and only if higher', () => {
    const k = bestKey('normal', 'wall');
    let r = recordBest({}, k, 7);
    expect(r).toEqual({ bests: { [k]: 7 }, improved: true });
    r = recordBest(r.bests, k, 7);
    expect(r.improved).toBe(false);
    r = recordBest(r.bests, k, 3);
    expect(r.improved).toBe(false);
    r = recordBest(r.bests, k, 8);
    expect(r.bests[k]).toBe(8);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
  });
  it('keeps separate bests per combination', () => {
    let b = recordBest({}, bestKey('slow', 'wall'), 5).bests;
    b = recordBest(b, bestKey('fast', 'wrap'), 9).bests;
    expect(b).toEqual({ 'slow-wall': 5, 'fast-wrap': 9 });
  });
});

describe('messages', () => {
  it('describes how a game ended without odd values', () => {
    const wall = { ...mk(5, 5, [[0, 0]], 'left', null), status: 'dead' as const, cause: 'wall' as const, score: 4 };
    const self = { ...wall, cause: 'self' as const };
    const won = { ...wall, status: 'won' as const, cause: null };
    expect(endMessage(wall)).toBe('Game over: the snake hit a wall. Score 4.');
    expect(endMessage(self)).toBe('Game over: the snake ran into itself. Score 4.');
    expect(endMessage(won)).toBe('You filled the board. Score 4.');
    expect(endMessage(mk(5, 5, [[0, 0]], 'left', null))).toBe('');
  });
  it('builds a short share line', () => {
    expect(shareText(12, 'fast', 'wrap', 20)).toBe('Snake (Fast, wrap around): score 12, best 20');
    expect(shareText(0, 'slow', 'wall', 0)).toBe('Snake (Slow, walls end the game): score 0');
    for (const t of [shareText(3, 'normal', 'wall', 3), endMessage({ ...mk(5, 5, [[0, 0]], 'left', null), status: 'dead', cause: 'wall' })]) {
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    }
  });
});

describe('fuzz: long random play keeps every invariant', () => {
  const adjacent = (a: Point, b: Point, s: GameState): boolean => {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    if (s.wrap) { dx = Math.min(dx, s.cols - dx); dy = Math.min(dy, s.rows - dy); }
    return dx + dy === 1;
  };
  // Plain throws instead of expect(): this runs hundreds of thousands of times.
  const check = (s: GameState, label: string) => {
    const fail = (why: string): never => { throw new Error(`${label}: ${why}`); };
    const keys = new Set(s.snake.map((p) => `${p.x},${p.y}`));
    if (keys.size !== s.snake.length) fail('duplicate segment');
    for (const p of s.snake) {
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.x >= s.cols || p.y < 0 || p.y >= s.rows) fail('segment out of bounds');
    }
    for (let i = 1; i < s.snake.length; i++) if (!adjacent(s.snake[i - 1], s.snake[i], s)) fail(`segments ${i - 1} and ${i} are not adjacent`);
    if (s.snake.length !== s.initialLength + s.score) fail(`length ${s.snake.length} != ${s.initialLength} + ${s.score}`);
    if (s.food) {
      if (keys.has(`${s.food.x},${s.food.y}`)) fail('food on the snake');
      if (s.food.x < 0 || s.food.x >= s.cols || s.food.y < 0 || s.food.y >= s.rows) fail('food out of bounds');
    } else if (s.status !== 'won') fail('no food but not won');
  };

  it('over hundreds of mixed random and food-seeking games', () => {
    const rng = mulberry32(31337);
    let eaten = 0;
    let wallDeaths = 0;
    let selfDeaths = 0;
    let maxLen = 0;
    for (let game = 0; game < 300; game++) {
      const wrap = game % 2 === 0;
      const cols = [8, 12, 20][game % 3];
      const rows = [8, 10, 20][(game + 1) % 3];
      const seeker = game % 4 < 2; // half the games steer toward food, half wander
      let s = initialState({ cols, rows, wrap }, rng);
      let q: Dir[] = [];
      check(s, `g${game} start`);
      for (let t = 0; t < 3000 && s.status === 'running'; t++) {
        let want: Dir | null = null;
        if (seeker || rng() < 0.3) {
          const safe = DIRS.filter((d) => d !== OPPOSITE[s.dir] && step(s, d, noRng).status === 'running');
          if (safe.length) {
            const f = s.food!;
            const head = s.snake[0];
            const dist = (d: Dir) => {
              const dd = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
              return Math.abs(head.x + dd[0] - f.x) + Math.abs(head.y + dd[1] - f.y);
            };
            want = seeker && rng() < 0.85 ? safe.slice().sort((a, b) => dist(a) - dist(b))[0] : safe[Math.floor(rng() * safe.length)];
          }
        }
        if (!want && rng() < 0.4) want = DIRS[Math.floor(rng() * 4)];
        if (want) q = queueDirection(q, s.dir, want);
        const nd = nextDirection(q, s.dir);
        q = nd.queue;
        const prev = s;
        s = step(s, nd.dir, rng);
        if (s.score > prev.score) eaten += 1;
        maxLen = Math.max(maxLen, s.snake.length);
        check(s, `g${game} t${t}`);
      }
      if (s.status === 'dead') { if (s.cause === 'wall') wallDeaths++; else selfDeaths++; }
      if (wrap && s.cause === 'wall') throw new Error(`g${game}: a wrapped game died on a wall`);
    }
    // The fuzz must really have exercised eating, growth and both ways to die.
    expect(eaten).toBeGreaterThan(300);
    expect(wallDeaths).toBeGreaterThan(5);
    expect(selfDeaths).toBeGreaterThan(5);
    expect(maxLen).toBeGreaterThan(12);
  });
});
