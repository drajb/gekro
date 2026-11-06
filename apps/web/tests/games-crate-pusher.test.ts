/**
 * games-crate-pusher.test.ts - the engine behind `crate-pusher`.
 *
 * Pinned: the walking and pushing rules against a second implementation that
 * works on (row, column) pairs, that every generated level is valid and solvable
 * (the stored solution replays to a finished level), that the stated fewest
 * steps is the TRUE minimum (an independent breadth-first search over every
 * player-and-crate position agrees), that the search says "no way" exactly when
 * the independent search does, that deadlock detection never calls a finishable
 * position deadlocked, the walking helpers, and the sanitisers.
 */
import { describe, it, expect } from 'vitest';
import {
  DIRS, SIZES, CRATE_COUNTS, MAX_CRATES, OPPOSITE, mulberry32, neighbour, isWall, cloneState, isValidState, cratesHome, isSolved, step, playMoves,
  walkDistances, walkPath, deadSquares, hasFrozenCrate, stuckCrates, isDeadlocked, pushDistances, solveSteps, makeLevel, CRATE_TRIES, PAR_NODES, QUICK_NODES, minPar, MAX_TOO_SHORT, MAX_TOO_SHORT_SMALL,
  bestKey, MAX_BEST_MOVES, sanitiseBest, clampSize, clampCrates, plural, cellName, describeBoard, rowOf, colOf,
  type Level, type State, type Dir,
} from '../src/components/apps-private/crate-pusher/helpers';

// ── ASCII maps for hand-made levels: # wall, space floor, . target, $ crate, * crate on target, @ player, + player on target ──

const parse = (rows: string[]): { level: Level; state: State } => {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const walls: number[] = [];
  const targets: number[] = [];
  const crates: number[] = [];
  let player = -1;
  rows.forEach((row, r) => {
    for (let c = 0; c < w; c++) {
      const ch = row[c] ?? '#';
      const i = r * w + c;
      walls.push(ch === '#' ? 1 : 0);
      if (ch === '.' || ch === '*' || ch === '+') targets.push(i);
      if (ch === '$' || ch === '*') crates.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  return { level: { w, h, walls, targets: targets.sort((a, b) => a - b) }, state: { player, crates } };
};

const render = (level: Level, s: State): string[] => {
  const rows: string[] = [];
  for (let r = 0; r < level.h; r++) {
    let row = '';
    for (let c = 0; c < level.w; c++) {
      const i = r * level.w + c;
      const t = level.targets.includes(i);
      row += level.walls[i] ? '#' : i === s.player ? (t ? '+' : '@') : s.crates.includes(i) ? (t ? '*' : '$') : t ? '.' : ' ';
    }
    rows.push(row);
  }
  return rows;
};

// ── Independent oracle: (row, column) pairs and a plain breadth-first search over every position ──

const V: Record<string, [number, number]> = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };

const oracleStep = (level: Level, s: State, ch: string): { state: State; pushed: boolean } | null => {
  const [dr, dc] = V[ch];
  const w = level.w;
  const wall = (r: number, c: number) => r < 0 || c < 0 || r >= level.h || c >= w || level.walls[r * w + c] === 1;
  const pr = Math.floor(s.player / w);
  const pc = s.player % w;
  const nr = pr + dr;
  const nc = pc + dc;
  if (wall(nr, nc)) return null;
  const at = (r: number, c: number) => s.crates.findIndex((x) => Math.floor(x / w) === r && x % w === c);
  const ci = at(nr, nc);
  if (ci < 0) return { state: { player: nr * w + nc, crates: s.crates.slice() }, pushed: false };
  const br = nr + dr;
  const bc = nc + dc;
  if (wall(br, bc) || at(br, bc) >= 0) return null;
  const crates = s.crates.slice();
  crates[ci] = br * w + bc;
  return { state: { player: nr * w + nc, crates }, pushed: true };
};

/** Fewest steps to finish, or null if impossible. Plain BFS over (player, set of crates). */
const oracleSteps = (level: Level, start: State, cap = 600000): number | null => {
  const key = (s: State) => `${s.player}:${s.crates.slice().sort((a, b) => a - b).join(',')}`;
  const done = (s: State) => s.crates.every((c) => level.targets.includes(c));
  if (done(start)) return 0;
  let frontier = [start];
  const seen = new Set([key(start)]);
  let d = 0;
  while (frontier.length) {
    d++;
    const next: State[] = [];
    for (const s of frontier) {
      for (const ch of ['U', 'D', 'L', 'R']) {
        const r = oracleStep(level, s, ch);
        if (!r) continue;
        const k = key(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        if (done(r.state)) return d;
        next.push(r.state);
      }
    }
    if (seen.size > cap) throw new Error('oracle space too large');
    frontier = next;
  }
  return null;
};

const floorConnected = (level: Level): boolean => {
  const floor: number[] = [];
  level.walls.forEach((x, i) => { if (!x) floor.push(i); });
  const seen = new Set<number>([floor[0]]);
  const stack = [floor[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / level.w);
    const c = i % level.w;
    for (const [dr, dc] of Object.values(V)) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= level.h || nc >= level.w) continue;
      const j = nr * level.w + nc;
      if (level.walls[j] || seen.has(j)) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return seen.size === floor.length;
};

/** Random play: a state reached by n random legal steps. */
const wander = (level: Level, s: State, n: number, rng: () => number): State => {
  let cur = s;
  for (let i = 0; i < n; i++) {
    const options = DIRS.map((d) => step(level, cur, d)).filter((x) => x !== null);
    if (!options.length) break;
    cur = options[Math.floor(rng() * options.length)]!.state;
  }
  return cur;
};

describe('the rules', () => {
  const { level, state } = parse([
    '#######',
    '#     #',
    '# $.  #',
    '# @   #',
    '#  $. #',
    '#######',
  ]);
  it('parses and renders hand-made maps', () => {
    expect(level.w).toBe(7);
    expect(level.h).toBe(6);
    expect(level.targets).toHaveLength(2);
    expect(state.crates).toHaveLength(2);
    expect(render(level, state)).toEqual(['#######', '#     #', '# $.  #', '# @   #', '#  $. #', '#######']);
    expect(isValidState(level, state)).toBe(true);
  });
  it('walks onto free floor and stops at walls', () => {
    expect(step(level, state, 'L')!.state.player).toBe(3 * 7 + 1);
    expect(step(level, state, 'L')!.pushed).toBe(false);
    const atWall = { player: 3 * 7 + 1, crates: state.crates };
    expect(step(level, atWall, 'L')).toBeNull();
  });
  it('pushes one crate one cell, only when the cell behind it is free floor', () => {
    const up = step(level, state, 'U')!; // the crate above the player moves up
    expect(up.pushed).toBe(true);
    expect(render(level, up.state)[1]).toBe('# $   #');
    expect(render(level, up.state)[2]).toBe('# @.  #'); // the player moved into the crate's old cell
    expect(render(level, up.state)[3]).toBe('#     #');
    // push the same crate into the top wall
    expect(step(level, up.state, 'U')).toBeNull();
    // two crates in a row can not be pushed
    const row = parse(['#####', '#@$$#', '#####']);
    expect(step(row.level, row.state, 'R')).toBeNull();
    // a crate against a wall can not be pushed through it
    const edge = parse(['####', '#@$#', '####']);
    expect(step(edge.level, edge.state, 'R')).toBeNull();
  });
  it('can not pull: stepping away leaves the crate where it is', () => {
    const p = parse(['######', '#@$  #', '######']);
    const pushed = step(p.level, p.state, 'R')!;
    const back = step(p.level, pushed.state, 'L')!;
    expect(back.pushed).toBe(false);
    expect(back.state.crates).toEqual(pushed.state.crates);
  });
  it('never modifies its input', () => {
    const copy = cloneState(state);
    for (const d of DIRS) step(level, state, d);
    expect(state).toEqual(copy);
  });
  it('finished means every crate on a target', () => {
    const done = parse(['#####', '#*@ #', '#####']);
    expect(isSolved(done.level, done.state)).toBe(true);
    expect(cratesHome(done.level, done.state)).toBe(1);
    expect(isSolved(level, state)).toBe(false);
    expect(cratesHome(level, state)).toBe(0);
    const half = parse(['#####', '#*$ #', '#@ .#', '#####']);
    expect(cratesHome(half.level, half.state)).toBe(1);
    expect(isSolved(half.level, half.state)).toBe(false);
  });
  it('agrees with the (row, column) oracle on random play over generated levels', () => {
    let compared = 0;
    for (const n of SIZES) {
      for (const k of [1, 3, 5]) {
        const g = makeLevel(n, k, mulberry32(n * 100 + k));
        let s = g.start;
        const rng = mulberry32(n + k);
        for (let t = 0; t < 120; t++) {
          const ch = ['U', 'D', 'L', 'R'][Math.floor(rng() * 4)];
          const mine = step(g.level, s, ch as Dir);
          const theirs = oracleStep(g.level, s, ch);
          expect(mine === null).toBe(theirs === null);
          if (mine && theirs) {
            expect(mine.state).toEqual(theirs.state);
            expect(mine.pushed).toBe(theirs.pushed);
            s = mine.state;
            compared++;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(400);
  });
  it('playMoves plays a string, counts pushes, and refuses junk or blocked steps', () => {
    const p = parse(['#######', '#@$ . #', '#######']);
    const r = playMoves(p.level, p.state, 'RR')!;
    expect(r.pushes).toBe(2);
    expect(isSolved(p.level, r.state)).toBe(true);
    expect(playMoves(p.level, p.state, '')).toEqual({ state: p.state, pushes: 0 });
    expect(playMoves(p.level, p.state, 'RRRR')).toBeNull(); // the fourth push runs into the wall
    expect(playMoves(p.level, p.state, 'X')).toBeNull();
    expect(playMoves(p.level, p.state, 'rr')).toBeNull();
    expect(playMoves(p.level, p.state, 'U')).toBeNull();
  });
  it('neighbour and isWall treat the outside as wall', () => {
    expect(neighbour({ w: 3, h: 3 }, 0, 'U')).toBe(-1);
    expect(neighbour({ w: 3, h: 3 }, 0, 'L')).toBe(-1);
    expect(neighbour({ w: 3, h: 3 }, 8, 'D')).toBe(-1);
    expect(neighbour({ w: 3, h: 3 }, 8, 'R')).toBe(-1);
    expect(neighbour({ w: 3, h: 3 }, 4, 'U')).toBe(1);
    expect(isWall(level, -1)).toBe(true);
    expect(isWall(level, 9999)).toBe(true);
    expect(isWall(level, 0)).toBe(true);
    expect(isWall(level, 8)).toBe(false);
    expect(DIRS.map((d) => OPPOSITE[OPPOSITE[d]])).toEqual([...DIRS]);
  });
});

describe('walking helpers', () => {
  const { level, state } = parse([
    '#######',
    '#@  # #',
    '# $ #.#',
    '#   # #',
    '#######',
  ]);
  it('walkDistances counts steps and treats crates and walls as blocked', () => {
    const d = walkDistances(level, state.player, state.crates);
    expect(d[state.player]).toBe(0);
    expect(d[1 * 7 + 3]).toBe(2);
    expect(d[2 * 7 + 2]).toBe(-1); // the crate cell itself
    expect(d[1 * 7 + 5]).toBe(-1); // behind the wall
    expect(d[3 * 7 + 3]).toBe(4); // around the crate
  });
  it('walkPath returns a shortest walk that really arrives, or null when blocked off', () => {
    const p = walkPath(level, state.crates, state.player, 3 * 7 + 3)!;
    expect(p).toHaveLength(4);
    const end = playMoves(level, { player: state.player, crates: [] }, p)!;
    expect(end.state.player).toBe(3 * 7 + 3);
    expect(walkPath(level, state.crates, state.player, 1 * 7 + 5)).toBeNull();
    expect(walkPath(level, state.crates, state.player, state.player)).toBe('');
  });
  it('walk distances agree with walkPath lengths everywhere', () => {
    const d = walkDistances(level, state.player, state.crates);
    for (let i = 0; i < d.length; i++) {
      const p = walkPath(level, state.crates, state.player, i);
      if (d[i] < 0) expect(p === null || level.walls[i] === 1 || state.crates.includes(i)).toBe(true);
      else expect(p).toHaveLength(d[i]);
    }
  });
});

describe('dead cells and deadlocks', () => {
  it('a corner that is not a target is dead; a target never is', () => {
    const { level } = parse(['#######', '#     #', '#  .  #', '#     #', '#######']);
    const dead = deadSquares(level);
    expect(dead[1 * 7 + 1]).toBe(true); // corner
    expect(dead[3 * 7 + 5]).toBe(true); // corner
    expect(dead[2 * 7 + 3]).toBe(false); // the target
    expect(dead[2 * 7 + 2]).toBe(false); // beside the target: can be pushed onto it
    expect(dead[2 * 7 + 4]).toBe(false);
    expect(dead[1 * 7 + 3]).toBe(true); // against the top wall: nobody can stand above it to push it down
    expect(dead[1 * 7 + 2]).toBe(true);
    expect(dead[3 * 7 + 3]).toBe(true); // against the bottom wall
    expect(dead[0]).toBe(false); // wall cells are not floor
  });
  it('recognises frozen crates', () => {
    const corner = parse(['#####', '#$  #', '# @.#', '#####']);
    expect(isDeadlocked(corner.level, corner.state)).toBe(true); // crate in a corner
    const ok = parse(['#######', '#     #', '#  $  #', '#  @. #', '#     #', '#######']);
    expect(isDeadlocked(ok.level, ok.state)).toBe(false);
    const wallHug = parse(['#####', '# $ #', '# @.#', '#####']);
    expect(isDeadlocked(wallHug.level, wallHug.state)).toBe(true); // against the top wall of a room only two rows high: it can never reach the target row
    const block = parse(['#######', '#     #', '# $$  #', '# $$@.#', '#   . #', '#######']);
    expect(hasFrozenCrate(block.level, block.state)).toBe(true); // a 2 x 2 block of crates in the open
    const wallPair = parse(['########', '#  $$  #', '#   @ .#', '#     .#', '########']);
    expect(hasFrozenCrate(wallPair.level, wallPair.state)).toBe(true); // two crates side by side against a wall hold each other still
    const lone = parse(['########', '#      #', '#  $   #', '#   @ .#', '#      #', '########']);
    expect(hasFrozenCrate(lone.level, lone.state)).toBe(false); // one crate in the open is free to move
    const onTarget = parse(['#####', '#*  #', '# @ #', '#####']);
    expect(isDeadlocked(onTarget.level, onTarget.state)).toBe(false); // a crate in a corner is fine on its target
  });
  it('names the stuck crates one by one', () => {
    const p = parse(['#######', '#     #', '#$ $  #', '#  @ .#', '#     #', '#######']);
    // the left crate sits against the wall at column 1 with no target on that wall: stuck; the other is free
    expect(stuckCrates(p.level, p.state)).toEqual([0]);
    expect(isDeadlocked(p.level, p.state)).toBe(true);
    const free = parse(['#######', '#     #', '#  $  #', '#  @ .#', '#     #', '#######']);
    expect(stuckCrates(free.level, free.state)).toEqual([]);
    const home = parse(['#####', '#*  #', '# @ #', '#####']);
    expect(stuckCrates(home.level, home.state)).toEqual([]); // a crate in a corner is fine on its target
  });
  it('is sound: whenever it says deadlocked, the independent search says no finishing is possible (and it does find some)', () => {
    let found = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const n = seed % 2 ? 5 : 6;
      const k = 1 + (seed % 3);
      const g = makeLevel(n, k, mulberry32(seed * 19));
      const rng = mulberry32(seed);
      let s = g.start;
      for (let round = 0; round < 6; round++) {
        s = wander(g.level, s, 40, rng);
        if (isDeadlocked(g.level, s)) {
          found++;
          expect(oracleSteps(g.level, s), `seed ${seed} round ${round}`).toBeNull();
        }
      }
    }
    expect(found).toBeGreaterThan(10);
  }, 120_000);
  it('dead cells are sound: a lone crate on one can never be finished', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const g = makeLevel(5, 1, mulberry32(seed * 3));
      const dead = deadSquares(g.level);
      const floor = g.level.walls.map((w, i) => (w ? -1 : i)).filter((i) => i >= 0);
      for (const cell of floor) {
        if (!dead[cell] || g.level.targets.includes(cell)) continue;
        const player = floor.find((i) => i !== cell)!;
        expect(oracleSteps(g.level, { player, crates: [cell] })).toBeNull();
      }
    }
  }, 60_000);
  it('pushDistances is a lower bound on the pushes a lone crate needs', () => {
    const g = makeLevel(5, 1, mulberry32(11));
    const pd = pushDistances(g.level);
    expect(pd[g.level.targets[0]]).toBe(0);
    expect(pd.every((v, i) => (g.level.walls[i] ? v === -1 : v >= -1))).toBe(true);
    const sol = solveSteps(g.level, g.start);
    expect(sol.status).toBe('solved');
    if (sol.status === 'solved') expect(sol.pushes).toBeGreaterThanOrEqual(pd[g.start.crates[0]]);
  });
});

describe('generator', () => {
  it('makes valid, connected, unfinished levels that its own solution finishes, for every size and crate count', () => {
    for (const n of SIZES) {
      for (const k of CRATE_COUNTS) {
        for (let seed = 1; seed <= 3; seed++) {
          const g = makeLevel(n, k, mulberry32(seed * 1013 + n * 7 + k));
          const tag = `${n}x${n} k=${k} seed ${seed}`;
          expect(g.level.w, tag).toBe(n);
          expect(g.level.h).toBe(n);
          expect(g.level.targets, tag).toHaveLength(k);
          expect(new Set(g.level.targets).size).toBe(k);
          expect(g.start.crates, tag).toHaveLength(k);
          expect(isValidState(g.level, g.start), tag).toBe(true);
          expect(g.level.targets.every((t) => !g.level.walls[t])).toBe(true);
          expect(floorConnected(g.level), tag).toBe(true);
          expect(isSolved(g.level, g.start), tag).toBe(false);
          expect(g.level.walls.filter((x) => x).length).toBeLessThanOrEqual(Math.floor(n * n * 0.17));
          const r = playMoves(g.level, g.start, g.solution);
          expect(r, `${tag}: solution replays`).not.toBeNull();
          expect(isSolved(g.level, r!.state), tag).toBe(true);
          expect(r!.pushes).toBe(g.pushes);
          expect(g.pushes).toBeGreaterThanOrEqual(Math.ceil(k / 2));
          if (g.par) expect(g.par).toBeLessThanOrEqual(g.solution.length);
          expect(isDeadlocked(g.level, g.start), `${tag}: not already stuck`).toBe(false);
        }
      }
    }
  }, 120_000);
  it('is deterministic for a seed and differs between seeds', () => {
    expect(makeLevel(6, 3, mulberry32(5))).toEqual(makeLevel(6, 3, mulberry32(5)));
    const keys = new Set<string>();
    for (let s = 1; s <= 10; s++) {
      const g = makeLevel(6, 2, mulberry32(s));
      keys.add(render(g.level, g.start).join('/'));
    }
    expect(keys.size).toBeGreaterThanOrEqual(9);
  });
  it('rejects an unknown size or crate count', () => {
    expect(() => makeLevel(4, 1, mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(9, 1, mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(6, 0, mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(6, MAX_CRATES + 1, mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(6, 2.5, mulberry32(1))).toThrow(RangeError);
    expect(CRATE_TRIES).toBeGreaterThan(1);
    expect(PAR_NODES).toBeGreaterThan(QUICK_NODES - 1);
  });
  it('no generated level is trivial: the fewest steps is at least 4 + 2 per crate (6, 8, 10, 12, 14)', () => {
    expect([1, 2, 3, 4, 5].map(minPar)).toEqual([6, 8, 10, 12, 14]);
    expect(MAX_TOO_SHORT).toBeGreaterThan(0);
    expect(MAX_TOO_SHORT_SMALL).toBeGreaterThanOrEqual(MAX_TOO_SHORT);
    let checked = 0;
    let unknownPar = 0;
    for (const n of SIZES) {
      for (const k of CRATE_COUNTS) {
        for (let seed = 1; seed <= 8; seed++) {
          const g = makeLevel(n, k, mulberry32(seed * 2711 + n * 17 + k));
          const tag = `${n}x${n} k=${k} seed ${seed}`;
          if (g.par > 0) {
            expect(g.par, tag).toBeGreaterThanOrEqual(minPar(k));
          } else {
            // The search was too big to finish; the stored solution is the best known and is itself long enough.
            unknownPar++;
            expect(g.solution.length, tag).toBeGreaterThanOrEqual(minPar(k));
          }
          checked++;
        }
      }
    }
    expect(checked).toBe(4 * 5 * 8);
    expect(unknownPar).toBeLessThan(checked / 2);
  }, 180_000);
  it('the one-crate rooms that used to come out in one or two moves are gone (5x5, two crates, seed 4242)', () => {
    const g = makeLevel(5, 2, mulberry32(4242));
    expect(g.par === 0 ? g.solution.length : g.par).toBeGreaterThanOrEqual(minPar(2));
  });
  it('building a level takes well under a second on average, even for the biggest rooms (generous bound)', () => {
    for (const [n, k] of [[6, 5], [7, 5], [8, 4], [8, 5]] as [number, number][]) {
      const t0 = performance.now();
      for (let seed = 1; seed <= 6; seed++) makeLevel(n, k, mulberry32(seed * 313 + n));
      expect((performance.now() - t0) / 6, `${n}x${n} k=${k}`).toBeLessThan(2500);
    }
  }, 120_000);
  it('more crates mean longer levels on average', () => {
    const mean = (k: number) => {
      let sum = 0;
      for (let s = 1; s <= 10; s++) sum += makeLevel(6, k, mulberry32(s * 41 + k)).solution.length;
      return sum / 10;
    };
    expect(mean(1)).toBeLessThan(mean(3));
    expect(mean(3)).toBeLessThan(mean(5));
  }, 60_000);
});

describe('the fewest steps is the true minimum', () => {
  it('the stated par equals the independent search on small generated levels', () => {
    let compared = 0;
    for (const [n, k] of [[5, 1], [5, 2], [6, 1], [6, 2], [5, 3], [7, 1], [8, 1], [7, 2]] as [number, number][]) {
      for (let seed = 1; seed <= 4; seed++) {
        const g = makeLevel(n, k, mulberry32(seed * 71 + n * 3 + k));
        expect(g.par, `${n} ${k} ${seed}`).toBeGreaterThan(0);
        expect(oracleSteps(g.level, g.start), `${n} ${k} ${seed}`).toBe(g.par);
        compared++;
      }
    }
    expect(compared).toBe(32);
  }, 120_000);
  it('the search result is a legal walk that finishes the level, with the right push count', () => {
    for (const [n, k] of [[5, 2], [6, 3], [7, 2]] as [number, number][]) {
      for (let seed = 1; seed <= 3; seed++) {
        const g = makeLevel(n, k, mulberry32(seed * 5 + n));
        const r = solveSteps(g.level, g.start);
        expect(r.status).toBe('solved');
        if (r.status !== 'solved') continue;
        const play = playMoves(g.level, g.start, r.steps);
        expect(play).not.toBeNull();
        expect(isSolved(g.level, play!.state)).toBe(true);
        expect(play!.pushes).toBe(r.pushes);
      }
    }
  }, 60_000);
  it('agrees with the independent search from the middle of a game, including positions that can not be finished', () => {
    let solvable = 0;
    let stuck = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const k = 1 + (seed % 3);
      const n = k === 3 ? 5 : seed % 2 ? 5 : 6;
      const g = makeLevel(n, k, mulberry32(seed * 23 + 1));
      const rng = mulberry32(seed + 1000);
      const s = wander(g.level, g.start, 10 + Math.floor(rng() * 80), rng);
      const truth = oracleSteps(g.level, s);
      const mine = solveSteps(g.level, s, 400000);
      if (truth === null) {
        stuck++;
        expect(mine.status, `seed ${seed}`).toBe('none');
      } else {
        solvable++;
        expect(mine.status, `seed ${seed}`).toBe('solved');
        if (mine.status === 'solved') expect(mine.steps.length, `seed ${seed}`).toBe(truth);
      }
    }
    expect(solvable).toBeGreaterThan(10);
    expect(stuck).toBeGreaterThan(3);
  }, 120_000);
  it('a loose search still returns a legal solution, never shorter than the exact one', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = makeLevel(6, 3, mulberry32(seed * 9));
      const exact = solveSteps(g.level, g.start);
      const loose = solveSteps(g.level, g.start, 150000, 4);
      expect(exact.status).toBe('solved');
      expect(loose.status).toBe('solved');
      if (exact.status === 'solved' && loose.status === 'solved') {
        expect(loose.steps.length).toBeGreaterThanOrEqual(exact.steps.length);
        const play = playMoves(g.level, g.start, loose.steps);
        expect(play && isSolved(g.level, play.state)).toBe(true);
      }
    }
  }, 60_000);
  it('returns nothing to do for a finished level, honours the node limit, and finds a hand-made optimum', () => {
    const done = parse(['#####', '#*@ #', '#####']);
    expect(solveSteps(done.level, done.state)).toEqual({ status: 'solved', steps: '', pushes: 0 });
    const g = makeLevel(7, 4, mulberry32(6));
    expect(solveSteps(g.level, g.start, 3).status).toBe('limit');
    const p = parse(['#########', '#@ $   .#', '#########']);
    expect(solveSteps(p.level, p.state)).toEqual({ status: 'solved', steps: 'RRRRR', pushes: 4 });
    // the corner crate can never move
    const dead = parse(['#####', '#$  #', '# @.#', '#####']);
    expect(solveSteps(dead.level, dead.state)).toEqual({ status: 'none' });
  });
  it('following the first step of the search over and over finishes small levels', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = makeLevel(5 + (seed % 2), 2, mulberry32(seed * 2));
      let s = g.start;
      let used = 0;
      for (; used < 200 && !isSolved(g.level, s); used++) {
        const r = solveSteps(g.level, s);
        if (r.status !== 'solved') throw new Error('no hint');
        s = step(g.level, s, r.steps[0] as Dir)!.state;
      }
      expect(isSolved(g.level, s)).toBe(true);
      expect(used).toBe(g.par);
    }
  }, 60_000);
  it('the slowest cases stay inside a generous time budget', () => {
    const t0 = Date.now();
    for (const k of [4, 5]) for (const n of [7, 8]) makeLevel(n, k, mulberry32(n * 10 + k));
    expect(Date.now() - t0).toBeLessThan(40_000);
  }, 60_000);
});

describe('fuzz', () => {
  it('random steps never throw, keep players and crates on distinct floor, and keep the crate count', () => {
    const rng = mulberry32(1618);
    for (let run = 0; run < 40; run++) {
      const n = SIZES[run % 4];
      const k = CRATE_COUNTS[run % 5];
      const g = makeLevel(n, k, mulberry32(run + 1));
      let s = g.start;
      for (let t = 0; t < 300; t++) {
        const r = step(g.level, s, DIRS[Math.floor(rng() * 4)]);
        if (!r) continue;
        expect(isValidState(g.level, r.state)).toBe(true);
        expect(r.state.crates).toHaveLength(k);
        // exactly one of: the player moved by one cell, with at most one crate moved by one cell
        const moved = r.state.crates.filter((c, i) => c !== s.crates[i]);
        expect(moved.length).toBe(r.pushed ? 1 : 0);
        s = r.state;
      }
    }
  });
});

describe('sanitisers and text', () => {
  it('sanitiseBest keeps only known keys with whole numbers in range, in a fresh object', () => {
    expect(sanitiseBest({ '5-1': 12, '8-5': MAX_BEST_MOVES })).toEqual({ '5-1': 12, '8-5': MAX_BEST_MOVES });
    expect(sanitiseBest({ '5-1': 0, '6-2': -1, '6-3': 1.5, '7-4': NaN, '7-5': MAX_BEST_MOVES + 1 })).toEqual({});
    expect(sanitiseBest({ '5-1': '12' as unknown as number, '4-1': 5, '5-6': 5, '5-0': 5 })).toEqual({});
    expect(sanitiseBest(null)).toEqual({});
    expect(sanitiseBest([1])).toEqual({});
    expect(sanitiseBest('5-1')).toEqual({});
    expect(sanitiseBest(JSON.parse('{"__proto__":{"5-1":3},"6-2":7}'))).toEqual({ '6-2': 7 });
    const raw = { '5-1': 4 };
    expect(sanitiseBest(raw)).not.toBe(raw);
    expect(bestKey(6, 3)).toBe('6-3');
  });
  it('clampSize and clampCrates accept only the offered values', () => {
    expect(clampSize('6', 5)).toBe(6);
    expect(clampSize(8, 5)).toBe(8);
    expect(clampSize('4', 5)).toBe(5);
    expect(clampSize('9', 5)).toBe(5);
    expect(clampSize('6.5', 5)).toBe(5);
    expect(clampSize('', 5)).toBe(5);
    expect(clampSize(NaN, 5)).toBe(5);
    expect(clampCrates('3', 2)).toBe(3);
    expect(clampCrates(5, 2)).toBe(5);
    expect(clampCrates('0', 2)).toBe(2);
    expect(clampCrates('6', 2)).toBe(2);
    expect(clampCrates('2.5', 2)).toBe(2);
    expect(clampCrates([3], 2)).toBe(2);
  });
  it('describes the board for a screen reader and pluralises', () => {
    const { level, state } = parse(['#####', '#@$.#', '#####']);
    expect(describeBoard(level, state)).toBe('You are at row 2, column 2. Crate 1 is at row 2, column 3. Empty targets: row 2, column 4.');
    const done = parse(['#####', '#@ *#', '#####']);
    expect(describeBoard(done.level, done.state)).toBe('You are at row 2, column 2. Crate 1 is at row 2, column 4 on a target. Every target has a crate.');
    expect(cellName(level, 8)).toBe('row 2, column 4');
    expect(rowOf(level, 8)).toBe(1);
    expect(colOf(level, 8)).toBe(3);
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
    expect(plural(2, 'crate')).toBe('2 crates');
  });
});
