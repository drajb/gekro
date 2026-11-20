/**
 * games-word-ladder.test.ts - the engine behind `word-ladder`.
 *
 * Pinned: the two hand-written lists obey their own rules (letters, lengths, no duplicates,
 * nothing on the blocklist, one connected graph); breadth-first distances and shortest paths
 * match an independent all-pairs computation (Floyd-Warshall) and a second string-based
 * search; every generated puzzle has a shortest ladder inside its level's range, is the same
 * for the same seed, and can be solved by following hints; the rules for a step (one letter,
 * a listed word, no repeats), undo as an exact round trip, hints that never leave a shortest
 * route, and the sanitisers for URL and storage values. Numbers quoted on the guide page are
 * asserted here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  WORDS3, WORDS4, LEVELS, LEVEL_SPEC, LEVEL_LABEL, MAX_LADDER, BLOCKED_EXACT, BLOCKED_PARTS, isBlocked, graphFor,
  distancesFrom, shortestPath, letterDiff, generate, newGame, currentWord, normalise, tryStep, undo, restart, hint,
  extraSteps, isPerfect, refusalText, sanitiseBest, sanitiseSeed, sanitiseLevel, plural, mulberry32, pickIndex,
  type Level, type Game, type Graph,
} from '../src/components/apps-private/word-ladder/helpers';
import calculatorSource from '../src/components/apps-private/word-ladder/Calculator.astro?raw';

vi.setConfig({ testTimeout: 60_000 });

const lists: Record<3 | 4, readonly string[]> = { 3: WORDS3, 4: WORDS4 };

/** Independent oracle 1: all-pairs shortest distances by Floyd-Warshall on a letter-difference test (no adjacency code shared). */
const floyd = (words: readonly string[]): Int16Array[] => {
  const n = words.length;
  const INF = 30000;
  const d = Array.from({ length: n }, () => new Int16Array(n).fill(INF));
  for (let i = 0; i < n; i++) {
    d[i][i] = 0;
    for (let j = 0; j < n; j++) {
      let diff = 0;
      for (let k = 0; k < words[i].length; k++) if (words[i][k] !== words[j][k]) diff++;
      if (diff === 1) d[i][j] = 1;
    }
  }
  for (let k = 0; k < n; k++) {
    const dk = d[k];
    for (let i = 0; i < n; i++) {
      const dik = d[i][k];
      if (dik === INF) continue;
      const di = d[i];
      for (let j = 0; j < n; j++) {
        const v = dik + dk[j];
        if (v < di[j]) di[j] = v;
      }
    }
  }
  return d;
};
const FW: Record<number, Int16Array[]> = {};
const fw = (len: 3 | 4): Int16Array[] => (FW[len] ??= floyd(graphFor(len).words));

/** Independent oracle 2: shortest distance from `a` to `b` avoiding some words, by searching on strings with a Set. */
const stringBfs = (words: readonly string[], a: string, b: string, avoid: ReadonlySet<string>): number | null => {
  const set = new Set(words);
  const seen = new Set<string>([a]);
  let frontier = [a];
  for (let depth = 0; frontier.length; depth++) {
    if (frontier.includes(b)) return depth;
    const next: string[] = [];
    for (const w of frontier) {
      for (let p = 0; p < w.length; p++) {
        for (const c of 'abcdefghijklmnopqrstuvwxyz') {
          const v = w.slice(0, p) + c + w.slice(p + 1);
          if (v !== w && set.has(v) && !seen.has(v) && (v === b || !avoid.has(v))) {
            seen.add(v);
            next.push(v);
          }
        }
      }
    }
    frontier = next;
  }
  return null;
};

const LEVEL_GRAPH = (l: Level): Graph => graphFor(LEVEL_SPEC[l].len);
const pairsAtDistance = (len: 3 | 4, lo: number, hi: number): number => {
  const d = fw(len);
  let n = 0;
  for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) if (d[i][j] >= lo && d[i][j] <= hi) n++;
  return n;
};

describe('word lists', () => {
  it('has the counts quoted on the guide page', () => {
    expect(WORDS3.length).toBe(261);
    expect(WORDS4.length).toBe(655);
    expect(WORDS3.length + WORDS4.length).toBe(916);
  });
  it('uses only lower-case a-z, the right length, no duplicates, sorted', () => {
    for (const len of [3, 4] as const) {
      const l = lists[len];
      expect(new Set(l).size).toBe(l.length);
      expect(l.slice().sort()).toEqual(l);
      for (const w of l) {
        expect(/^[a-z]+$/.test(w), w).toBe(true);
        expect(w.length, w).toBe(len);
      }
    }
    expect(WORDS3.filter((w) => WORDS4.includes(w))).toEqual([]);
  });
  it('has no word on the blocklist, whole or in part, and the graph drops nothing', () => {
    for (const w of [...WORDS3, ...WORDS4]) {
      expect(BLOCKED_EXACT.includes(w), w).toBe(false);
      for (const p of BLOCKED_PARTS) expect(w.includes(p), `${p} in ${w}`).toBe(false);
      expect(isBlocked(w), w).toBe(false);
    }
    expect(graphFor(3).words).toEqual(WORDS3);
    expect(graphFor(4).words).toEqual(WORDS4);
  });
  it('the blocklist really blocks the usual rude, hateful and frightening words', () => {
    for (const bad of ['ass', 'sex', 'fag', 'gay', 'tit', 'pee', 'poo', 'hell', 'damn', 'kill', 'dead', 'fuck', 'shit', 'cunt', 'dick',
      'cock', 'piss', 'porn', 'slut', 'rape', 'turd', 'crap', 'butt', 'weed', 'nude', 'anal', 'anus', 'homo', 'dyke', 'bomb', 'gore', 'puke']) {
      expect(isBlocked(bad), bad).toBe(true);
    }
    expect(isBlocked('cat')).toBe(false);
    expect(isBlocked('lamp')).toBe(false);
    expect(BLOCKED_EXACT.length).toBeGreaterThan(100);
  });
  it('is one connected graph at each length', () => {
    for (const len of [3, 4] as const) {
      const g = graphFor(len);
      const d = distancesFrom(g, 0);
      expect(Array.from(d).every((x) => x >= 0), `length ${len}`).toBe(true);
    }
  });
  it('the longest shortest ladder between any two words (quoted on the page)', () => {
    const diam = (len: 3 | 4): number => Math.max(...fw(len).map((row) => Math.max(...row)));
    expect({ three: diam(3), four: diam(4) }).toEqual({ three: 14, four: 16 });
  });
});

describe('graph and shortest paths against independent oracles', () => {
  it('neighbours are exactly the words one letter away (brute force over all pairs)', () => {
    for (const len of [3, 4] as const) {
      const g = graphFor(len);
      for (let i = 0; i < g.words.length; i++) {
        const want: number[] = [];
        for (let j = 0; j < g.words.length; j++) if (letterDiff(g.words[i], g.words[j]) === 1) want.push(j);
        expect(g.adj[i].slice().sort((a, b) => a - b)).toEqual(want);
      }
    }
  }, 120_000);
  it('BFS distances from every word equal Floyd-Warshall (both lengths, every pair)', () => {
    for (const len of [3, 4] as const) {
      const g = graphFor(len);
      const ref = fw(len);
      for (let i = 0; i < g.words.length; i++) {
        const d = distancesFrom(g, i);
        for (let j = 0; j < g.words.length; j++) if (d[j] !== ref[i][j]) throw new Error(`${g.words[i]} -> ${g.words[j]}: ${d[j]} vs ${ref[i][j]}`);
      }
    }
  }, 180_000);
  it('shortestPath returns a legal ladder of exactly the oracle length for 3,000 random pairs', () => {
    const rng = mulberry32(2026);
    for (let t = 0; t < 3000; t++) {
      const len = rng() < 0.5 ? 3 : 4;
      const g = graphFor(len);
      const a = pickIndex(g.words.length, rng);
      const b = pickIndex(g.words.length, rng);
      const path = shortestPath(g, g.words[a], g.words[b])!;
      expect(path).not.toBeNull();
      expect(path.length - 1).toBe(fw(len)[a][b]);
      expect(path[0]).toBe(g.words[a]);
      expect(path[path.length - 1]).toBe(g.words[b]);
      for (let k = 0; k + 1 < path.length; k++) expect(letterDiff(path[k], path[k + 1])).toBe(1);
      expect(new Set(path).size).toBe(path.length);
      for (const w of path) expect(g.index.has(w)).toBe(true);
    }
  });
  it('shortestPath with words to avoid matches a second string-based search', () => {
    const rng = mulberry32(77);
    for (let t = 0; t < 800; t++) {
      const g = graphFor(rng() < 0.5 ? 3 : 4);
      const a = g.words[pickIndex(g.words.length, rng)];
      const b = g.words[pickIndex(g.words.length, rng)];
      const avoid = new Set<string>();
      const k = Math.floor(rng() * 80);
      for (let i = 0; i < k; i++) avoid.add(g.words[pickIndex(g.words.length, rng)]);
      avoid.delete(a);
      avoid.delete(b);
      const got = shortestPath(g, a, b, avoid);
      const want = stringBfs(g.words, a, b, avoid);
      expect(got ? got.length - 1 : null, `${a} -> ${b} avoiding ${avoid.size}`).toBe(want);
      if (got) for (const w of got.slice(1, -1)) expect(avoid.has(w)).toBe(false);
    }
  });
  it('unknown words and the same word are handled', () => {
    const g = graphFor(3);
    expect(shortestPath(g, 'cat', 'zzz')).toBeNull();
    expect(shortestPath(g, 'qqq', 'cat')).toBeNull();
    expect(shortestPath(g, 'cat', 'cat')).toEqual(['cat']);
    expect(shortestPath(g, 'cat', 'cot')).toEqual(['cat', 'cot']);
    expect(distancesFrom(g, -1).every((x) => x === -1)).toBe(true);
    expect(distancesFrom(g, 99999).every((x) => x === -1)).toBe(true);
  });
  it('letterDiff counts differing letters and refuses different lengths', () => {
    expect(letterDiff('cat', 'cat')).toBe(0);
    expect(letterDiff('cat', 'cot')).toBe(1);
    expect(letterDiff('cat', 'dog')).toBe(3);
    expect(letterDiff('cat', 'cart')).toBe(Infinity);
  });
});

describe('puzzle generator', () => {
  it('level ranges are as the page says', () => {
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
    expect(LEVEL_SPEC).toEqual({
      easy: { len: 3, min: 3, max: 4 },
      medium: { len: 4, min: 3, max: 5 },
      hard: { len: 4, min: 5, max: 7 },
    });
    expect(LEVELS.map((l) => LEVEL_LABEL[l])).toEqual(['Easy', 'Medium', 'Hard']);
  });
  it('every level has thousands of distinct pairs to draw from (quoted on the page)', () => {
    const counts = {
      easy: pairsAtDistance(3, 3, 4),
      medium: pairsAtDistance(4, 3, 5),
      hard: pairsAtDistance(4, 5, 7),
    };
    expect(counts.easy).toBeGreaterThan(5000);
    expect(counts.medium).toBeGreaterThan(20000);
    expect(counts.hard).toBeGreaterThan(20000);
  });
  it('1,500 puzzles: shortest ladder inside the level range, equal to the oracle, words listed, start differs from end', () => {
    for (const level of LEVELS) {
      const spec = LEVEL_SPEC[level];
      const g = LEVEL_GRAPH(level);
      const ref = fw(spec.len);
      for (let seed = 1; seed <= 500; seed++) {
        const p = generate(level, mulberry32(seed * 7919));
        expect(p.level).toBe(level);
        expect(p.par).toBeGreaterThanOrEqual(spec.min);
        expect(p.par).toBeLessThanOrEqual(spec.max);
        expect(p.par).toBe(ref[g.index.get(p.start)!][g.index.get(p.end)!]);
        expect(p.start).not.toBe(p.end);
        expect(p.start.length).toBe(spec.len);
        expect(g.index.has(p.start) && g.index.has(p.end)).toBe(true);
      }
    }
  }, 120_000);
  it('is deterministic for a seed and different across seeds', () => {
    for (const level of LEVELS) {
      expect(generate(level, mulberry32(5))).toEqual(generate(level, mulberry32(5)));
      const seen = new Set<string>();
      for (let s = 1; s <= 60; s++) {
        const p = generate(level, mulberry32(s));
        seen.add(`${p.start}-${p.end}`);
      }
      expect(seen.size).toBeGreaterThan(40);
    }
  });
  it('survives a degenerate rng (always 0, always 0.999999, NaN)', () => {
    for (const level of LEVELS) {
      for (const rng of [() => 0, () => 0.999999, () => NaN]) {
        const p = generate(level, rng);
        expect(p.par).toBeGreaterThanOrEqual(LEVEL_SPEC[level].min);
        expect(p.par).toBeLessThanOrEqual(LEVEL_SPEC[level].max);
      }
    }
  });
  it('rejects an unknown level', () => {
    expect(() => generate('wild' as Level, mulberry32(1))).toThrow(RangeError);
  });
  it('a puzzle takes well under 100 ms on average (hard level, 200 puzzles)', () => {
    const t0 = performance.now();
    for (let s = 1; s <= 200; s++) generate('hard', mulberry32(s));
    expect((performance.now() - t0) / 200).toBeLessThan(100);
  }, 30_000);
});

describe('the rules for a step', () => {
  const g0 = (): Game => newGame({ level: 'easy', start: 'cat', end: 'dog', par: 3 });
  it('accepts a listed word one letter away and refuses everything else with a kind reason', () => {
    const g = g0();
    expect(currentWord(g)).toBe('cat');
    const ok = tryStep(g, 'cot');
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.game.steps).toEqual(['cot']);
    expect(currentWord(ok.game)).toBe('cot');
    expect(g.steps).toEqual([]); // immutable
    const reasons = (raw: unknown) => { const r = tryStep(g, raw); return r.ok ? 'ok' : r.reason; };
    expect(reasons('')).toBe('empty');
    expect(reasons('   ')).toBe('empty');
    expect(reasons(123)).toBe('empty');
    expect(reasons(null)).toBe('empty');
    expect(reasons('cats')).toBe('length');
    expect(reasons('ca')).toBe('length');
    expect(reasons('cax')).toBe('not-a-word');
    expect(reasons('zzz')).toBe('not-a-word');
    expect(reasons('cat')).toBe('same');
    expect(reasons('cot ')).toBe('ok'); // whitespace is dropped
    expect(reasons('COT')).toBe('ok'); // case is ignored
    expect(reasons('dog')).toBe('many');
    expect(reasons('cow')).toBe('many'); // cat -> cow changes two letters
  });
  it('never repeats a word and finishes exactly on the end word', () => {
    let g = g0();
    const walk = (w: string) => { const r = tryStep(g, w); if (!r.ok) throw new Error(`${w}: ${r.reason}`); g = r.game; };
    walk('cot');
    const toStart = tryStep(g, 'cat');
    expect(toStart.ok).toBe(false);
    if (!toStart.ok) expect(toStart.reason).toBe('used');
    walk('dot');
    const back = tryStep(g, 'cot');
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.reason).toBe('used');
    walk('dog');
    expect(g.done).toBe(true);
    expect(g.steps).toEqual(['cot', 'dot', 'dog']);
    expect(isPerfect(g)).toBe(true);
    expect(extraSteps(g)).toBe(0);
    const after = tryStep(g, 'dig');
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.reason).toBe('finished');
  });
  it('a longer winding ladder is finished but not perfect, and counts the extra steps', () => {
    let g = g0();
    for (const w of ['cot', 'hot', 'dot', 'dog']) { const r = tryStep(g, w); expect(r.ok, w).toBe(true); if (r.ok) g = r.game; }
    expect(g.done).toBe(true);
    expect(g.steps.length).toBe(4);
    expect(isPerfect(g)).toBe(false);
    expect(extraSteps(g)).toBe(1);
  });
  it('refuses a ladder longer than the cap', () => {
    const g = graphFor(3);
    let game = newGame({ level: 'easy', start: 'cat', end: 'zoo', par: 99 });
    // Walk a long self-avoiding path through the graph by always taking an unused neighbour.
    let guard = 0;
    while (game.steps.length < MAX_LADDER && guard++ < 10000) {
      const cur = g.index.get(currentWord(game))!;
      const used = new Set([game.start, ...game.steps]);
      const nxt = g.adj[cur].map((i) => g.words[i]).find((w) => !used.has(w) && w !== game.end);
      if (!nxt) break;
      const r = tryStep(game, nxt);
      if (!r.ok) throw new Error(r.reason);
      game = r.game;
    }
    if (game.steps.length === MAX_LADDER) {
      const cur = g.index.get(currentWord(game))!;
      const used = new Set([game.start, ...game.steps]);
      const nxt = g.adj[cur].map((i) => g.words[i]).find((w) => !used.has(w));
      if (nxt) {
        const r = tryStep(game, nxt);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe('too-long');
      }
    }
    expect(game.steps.length).toBeLessThanOrEqual(MAX_LADDER);
  });
  it('undo is an exact round trip, is blocked once finished, and does nothing at the start', () => {
    const g = g0();
    expect(undo(g)).toBe(g);
    const a = tryStep(g, 'cot');
    if (!a.ok) throw new Error('step');
    const b = tryStep(a.game, 'dot');
    if (!b.ok) throw new Error('step');
    expect(undo(b.game)).toEqual(a.game);
    expect(undo(undo(b.game))).toEqual(g);
    const c = tryStep(b.game, 'dog');
    if (!c.ok) throw new Error('step');
    expect(c.game.done).toBe(true);
    expect(undo(c.game)).toBe(c.game);
    expect(restart(c.game)).toEqual(g);
    expect(restart(c.game).done).toBe(false);
  });
  it('refusal texts are plain, never echo a typed word, and fit the word length', () => {
    for (const r of ['finished', 'empty', 'length', 'not-a-word', 'same', 'many', 'used', 'too-long'] as const) {
      const t = refusalText(r, 4);
      expect(t.length).toBeGreaterThan(8);
      expect(t.includes('—')).toBe(false);
    }
    expect(refusalText('length', 3)).toContain('3 letters');
    expect(refusalText('length', 4)).toContain('4 letters');
  });
  it('normalise keeps letters only, lower case, and caps the length', () => {
    expect(normalise(' Cat! ')).toBe('cat');
    expect(normalise('c-a-t')).toBe('cat');
    expect(normalise('ÄÖcat')).toBe('cat');
    expect(normalise('a'.repeat(100)).length).toBe(12);
    for (const bad of [null, undefined, 5, {}, [], true]) expect(normalise(bad)).toBe('');
  });
});

describe('hints', () => {
  it('a hint from the start is the next word of a shortest ladder, and marks the game as aided', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        const p = generate(level, mulberry32(seed * 13));
        const g = newGame(p);
        const h = hint(g)!;
        expect(h).not.toBeNull();
        expect(h.game.aided).toBe(true);
        expect(g.aided).toBe(false);
        const gr = LEVEL_GRAPH(level);
        expect(letterDiff(h.word, p.start)).toBe(1);
        expect(fw(gr.len)[gr.index.get(h.word)!][gr.index.get(p.end)!]).toBe(p.par - 1);
      }
    }
  });
  it('following hints only reaches the end in exactly par steps, from any start', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 80; seed++) {
        const p = generate(level, mulberry32(seed * 101));
        let g = newGame(p);
        let guard = 0;
        while (!g.done && guard++ < 20) {
          const h = hint(g)!;
          const r = tryStep(h.game, h.word);
          if (!r.ok) throw new Error(`${h.word}: ${r.reason}`);
          g = r.game;
        }
        expect(g.done).toBe(true);
        expect(g.steps.length).toBe(p.par);
        expect(g.aided).toBe(true);
        expect(isPerfect(g)).toBe(true);
      }
    }
  });
  it('from a random wandering state a hint never uses a word already on the ladder and matches the second search', () => {
    const rng = mulberry32(55);
    let checked = 0;
    for (let t = 0; t < 400; t++) {
      const level = LEVELS[Math.floor(rng() * 3)];
      const gr = LEVEL_GRAPH(level);
      let g = newGame(generate(level, rng));
      const wander = Math.floor(rng() * 8);
      for (let k = 0; k < wander; k++) {
        const cur = gr.index.get(currentWord(g))!;
        const used = new Set([g.start, ...g.steps]);
        const opts = gr.adj[cur].map((i) => gr.words[i]).filter((w) => !used.has(w));
        if (!opts.length) break;
        const r = tryStep(g, opts[pickIndex(opts.length, rng)]);
        if (!r.ok) throw new Error(r.reason);
        g = r.game;
        if (g.done) break;
      }
      if (g.done) continue;
      const used = new Set([g.start, ...g.steps]);
      const want = stringBfs(gr.words, currentWord(g), g.end, used);
      const h = hint(g);
      if (want === null) {
        expect(h).toBeNull();
      } else {
        expect(h).not.toBeNull();
        expect(used.has(h!.word)).toBe(false);
        expect(stringBfs(gr.words, h!.word, g.end, used)).toBe(want - 1);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
  it('no hint once finished, and a game that was already aided stays the same object', () => {
    const p = generate('easy', mulberry32(3));
    let g = newGame(p);
    const h1 = hint(g)!;
    const h2 = hint(h1.game)!;
    expect(h2.game).toBe(h1.game);
    while (!g.done) { const h = hint(g)!; const r = tryStep(h.game, h.word); if (!r.ok) throw new Error('x'); g = r.game; }
    expect(hint(g)).toBeNull();
  });
});

describe('sanitisers and helpers', () => {
  it('sanitiseSeed accepts only whole numbers from 1 to 2^32 - 1 (number or digit string)', () => {
    expect(sanitiseSeed(1)).toBe(1);
    expect(sanitiseSeed('4294967295')).toBe(4294967295);
    expect(sanitiseSeed('12345')).toBe(12345);
    for (const bad of [0, -1, 4294967296, 1.5, NaN, Infinity, '0', '-1', '1.5', '1e3', ' 5', '', 'abc', '99999999999', null, undefined, {}, [], true]) {
      expect(sanitiseSeed(bad), String(bad)).toBe(0);
    }
  });
  it('sanitiseLevel falls back to easy for anything unknown', () => {
    expect(sanitiseLevel('hard')).toBe('hard');
    for (const bad of ['', 'EASY', '__proto__', 'constructor', 5, null, undefined, [], {}]) expect(sanitiseLevel(bad)).toBe('easy');
  });
  it('sanitiseBest keeps whole numbers 1 to 99,999 for the three levels only and returns a fresh object', () => {
    expect(sanitiseBest({ easy: 3, medium: 99999, hard: 1 })).toEqual({ easy: 3, medium: 99999, hard: 1 });
    expect(sanitiseBest({ easy: 0, medium: -3, hard: 1.5 })).toEqual({});
    expect(sanitiseBest({ easy: NaN, medium: Infinity, hard: 100000 })).toEqual({});
    expect(sanitiseBest({ easy: '5', medium: true, hard: [5] })).toEqual({});
    expect(sanitiseBest({ x: 5, wild: 5, easy: 2 })).toEqual({ easy: 2 });
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"easy": 5}, "constructor": 3}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    const raw = { easy: 4 };
    const fresh = sanitiseBest(raw);
    expect(fresh).not.toBe(raw);
    fresh.easy = 9;
    expect(raw.easy).toBe(4);
  });
  it('plural and pickIndex behave', () => {
    expect(plural(1, 'step')).toBe('1 step');
    expect(plural(0, 'step')).toBe('0 steps');
    expect(plural(5, 'step')).toBe('5 steps');
    expect(pickIndex(5, () => 0.999999)).toBe(4);
    expect(pickIndex(5, () => -1)).toBe(0);
    expect(pickIndex(5, () => NaN)).toBe(0);
  });
});

describe('fuzz', () => {
  it('3,000 random typed strings and random legal walks never throw or break an invariant', () => {
    const rng = mulberry32(31337);
    const junk = ['', ' ', 'cat', 'CAT', 'c a t', 'cot', 'dot', 'dog', 'doge', '\u0000', '😀', '__proto__', 'constructor', 'a'.repeat(500), '<b>', 'ÿ', '12'];
    for (let t = 0; t < 3000; t++) {
      const level = LEVELS[Math.floor(rng() * 3)];
      let g = newGame(generate(level, rng));
      for (let k = 0; k < 12; k++) {
        const pick = rng();
        let raw: unknown;
        if (pick < 0.3) raw = junk[pickIndex(junk.length, rng)];
        else if (pick < 0.4) raw = rng() < 0.5 ? null : { toString: () => 'cat' };
        else {
          const gr = LEVEL_GRAPH(level);
          const opts = gr.adj[gr.index.get(currentWord(g))!];
          raw = gr.words[opts[pickIndex(opts.length, rng)]];
        }
        const r = tryStep(g, raw);
        if (r.ok) {
          expect(letterDiff(currentWord(g), currentWord(r.game))).toBe(1);
          expect(new Set([r.game.start, ...r.game.steps]).size).toBe(r.game.steps.length + 1);
          expect(r.game.steps.length).toBe(g.steps.length + 1);
          g = r.game;
        } else {
          expect(r.game).toBeUndefined();
        }
        if (rng() < 0.15) g = undo(g);
        if (g.done) break;
      }
    }
  });
});

describe('the page', () => {
  it('announces results, keeps scores under the right key and uses the shell events', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/gk:game:word-ladder/);
    expect(calculatorSource).toMatch(/_wladInit/);
    expect(calculatorSource).toMatch(/id="wlad-app"/);
  });
});
