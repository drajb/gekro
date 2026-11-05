/**
 * games-picture-puzzle.test.ts - the engine behind `picture-puzzle`.
 *
 * Pinned: the five grid sizes (4, 6, 9, 16 and 25 pieces), that the cuts tile the 120 x 120 sheet
 * exactly with whole-number sizes, that every shuffle is a permutation that is never solved, never
 * has a piece in its own place, is a single cycle needing exactly n - 1 swaps (checked against a
 * breadth-first search over every arrangement of up to 6 pieces), that swaps are pure and any
 * arrangement can be finished by swapping, that no two pieces of any picture at any size look
 * alike (the pictures are rasterised and compared), keyboard and pointer position maths, the
 * colours the pictures use against the page's CSS, saved best results, and kind wording.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  SCENES, SCENE_IDS, COLOUR_KEYS, SIZE, LEVELS, DEFAULT_LEVEL, MAX_BEST_SWAPS,
  mulberry32, levelById, levelIndex, pieceCount, cellRect, cutCells, rowOf, colOf, isEdgeCell, edgeCount,
  identity, isPermutation, isSolved, piecesHome, scramble, swapPositions, cycleCount, minSwaps, solveSwaps, positionOf,
  gridMove, positionAtPoint, shapeContains, colourAt, rasterCell, rasterDifference, minPieceDifference, colourCount, validateScene,
  sceneById, indexOfScene, parseSceneParam, parseSeedParam, surpriseScene, nextScene, sanitiseBest,
  plural, progressStars, positionName, pieceLabel, pickedMessage, putDownMessage, swappedMessage, winMessage, startMessage, shareText,
  type Shape,
} from '../src/components/apps-private/picture-puzzle/helpers';

/** Every ordering of 0..len-1 (Heap's algorithm). */
const permutations = (len: number): number[][] => {
  const out: number[][] = [];
  const a = Array.from({ length: len }, (_, i) => i);
  const c = new Array(len).fill(0);
  out.push(a.slice());
  let i = 0;
  while (i < len) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      [a[j], a[i]] = [a[i], a[j]];
      out.push(a.slice());
      c[i]++;
      i = 0;
    } else { c[i] = 0; i++; }
  }
  return out;
};

describe('levels and cuts', () => {
  it('has five sizes: 2x2, 2x3, 3x3, 4x4 and 5x5 (4, 6, 9, 16 and 25 pieces)', () => {
    expect(LEVELS.map((l) => [l.id, l.rows, l.cols, pieceCount(l)])).toEqual([
      ['tiny', 2, 2, 4], ['little', 2, 3, 6], ['middle', 3, 3, 9], ['big', 4, 4, 16], ['huge', 5, 5, 25],
    ]);
    expect(LEVELS.map((l) => l.name)).toEqual(['Tiny', 'Little', 'Middle', 'Big', 'Huge']);
    expect(DEFAULT_LEVEL).toBe('little');
    expect(levelById('big')!.rows).toBe(4);
    for (const junk of ['', 'BIG', '__proto__', 'constructor', 3, null, undefined, [], {}]) expect(levelById(junk)).toBeNull();
    expect(levelIndex('huge')).toBe(4);
    expect(levelIndex('x')).toBe(-1);
  });

  it('the sheet is 120 x 120 and every cut has whole-number sizes', () => {
    expect(SIZE).toBe(120);
    for (const l of LEVELS) {
      for (const c of cutCells(l.rows, l.cols)) {
        for (const v of [c.x, c.y, c.w, c.h]) expect(Number.isInteger(v), `${l.id}: ${v}`).toBe(true);
      }
    }
  });

  it('the pieces tile the sheet exactly: areas add up, and every unit square belongs to exactly one piece', () => {
    for (const l of LEVELS) {
      const cells = cutCells(l.rows, l.cols);
      expect(cells.reduce((a, c) => a + c.w * c.h, 0)).toBe(SIZE * SIZE);
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const owners = cells.filter((c) => x + 0.5 >= c.x && x + 0.5 < c.x + c.w && y + 0.5 >= c.y && y + 0.5 < c.y + c.h);
          if (owners.length !== 1) throw new Error(`${l.id}: unit square ${x},${y} has ${owners.length} owners`);
        }
      }
    }
  });

  it('cell index maps to row-major position', () => {
    expect(cellRect(3, 3, 4)).toEqual({ x: 40, y: 40, w: 40, h: 40 });
    expect(cellRect(2, 3, 5)).toEqual({ x: 80, y: 60, w: 40, h: 60 });
    expect(rowOf(7, 3)).toBe(2);
    expect(colOf(7, 3)).toBe(1);
  });

  it('counts edge pieces: 4, 6, 8, 12 and 16', () => {
    expect(LEVELS.map((l) => edgeCount(l.rows, l.cols))).toEqual([4, 6, 8, 12, 16]);
    for (const l of LEVELS) {
      for (let i = 0; i < l.rows * l.cols; i++) {
        const r = Math.floor(i / l.cols);
        const c = i % l.cols;
        expect(isEdgeCell(l.rows, l.cols, i)).toBe(r === 0 || c === 0 || r === l.rows - 1 || c === l.cols - 1);
      }
    }
  });
});

describe('the shuffle', () => {
  it('is always a permutation that is not solved, with no piece in its own place, in one single cycle', () => {
    for (const l of LEVELS) {
      const n = pieceCount(l);
      for (let seed = 1; seed <= 400; seed++) {
        const p = scramble(n, mulberry32(seed));
        expect(isPermutation(p, n)).toBe(true);
        expect(isSolved(p)).toBe(false);
        expect(piecesHome(p)).toBe(0);
        expect(cycleCount(p)).toBe(1);
        expect(minSwaps(p)).toBe(n - 1);
      }
    }
  });

  it('is the same for the same seed and different for different seeds', () => {
    expect(scramble(9, mulberry32(77))).toEqual(scramble(9, mulberry32(77)));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) seen.add(scramble(9, mulberry32(seed)).join(','));
    expect(seen.size).toBeGreaterThan(50);
  });

  it('on 4 pieces, gives each of the 6 single-cycle arrangements about equally often', () => {
    const counts = new Map<string, number>();
    const rng = mulberry32(31);
    for (let i = 0; i < 6000; i++) {
      const k = scramble(4, rng).join('');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const v of counts.values()) {
      expect(v).toBeGreaterThan(800);
      expect(v).toBeLessThan(1200);
    }
  });

  it('survives an rng that returns exactly 0 or nearly 1', () => {
    for (const v of [0, 0.9999999999]) {
      const p = scramble(9, () => v);
      expect(isPermutation(p, 9)).toBe(true);
      expect(piecesHome(p)).toBe(0);
    }
  });

  it('does something sensible for 0, 1 and 2 pieces', () => {
    expect(scramble(0, mulberry32(1))).toEqual([]);
    expect(scramble(1, mulberry32(1))).toEqual([0]);
    expect(scramble(2, mulberry32(1))).toEqual([1, 0]);
  });
});

describe('swapping', () => {
  it('swaps two places without touching the input, and a second swap puts them back', () => {
    const p = [3, 1, 0, 2];
    const q = swapPositions(p, 0, 2);
    expect(p).toEqual([3, 1, 0, 2]);
    expect(q).toEqual([0, 1, 3, 2]);
    expect(swapPositions(q, 0, 2)).toEqual(p);
    expect(swapPositions(q, 2, 0)).toEqual(swapPositions(q, 0, 2));
  });

  it('ignores junk places and swapping a place with itself', () => {
    const p = [2, 0, 1];
    for (const [a, b] of [[-1, 0], [0, 3], [1.5, 0], [NaN, 1], [0, Infinity], [1, 1]] as const) expect(swapPositions(p, a, b)).toEqual(p);
    expect(swapPositions(p, 0, 1)).not.toBe(p);
  });

  it('counts pieces home, finds a piece, and knows a permutation from junk', () => {
    expect(piecesHome([0, 2, 1, 3])).toBe(2);
    expect(positionOf([2, 0, 1], 1)).toBe(2);
    expect(positionOf([2, 0, 1], 7)).toBe(-1);
    expect(isSolved(identity(6))).toBe(true);
    expect(isSolved([])).toBe(true);
    for (const junk of [[0, 0, 1], [0, 1, 3], [0, 1], 'abc', null, undefined, [0.5, 1, 2], [-1, 0, 1], {}]) expect(isPermutation(junk, 3)).toBe(false);
  });
});

describe('every arrangement can be finished by swapping, in the fewest swaps (oracle: breadth-first search)', () => {
  it('minimum swaps equals the BFS distance from the solved board, for every arrangement of 1 to 6 pieces', () => {
    for (let n = 1; n <= 6; n++) {
      const start = identity(n).join(',');
      const dist = new Map<string, number>([[start, 0]]);
      const queue: number[][] = [identity(n)];
      while (queue.length) {
        const cur = queue.shift()!;
        const d = dist.get(cur.join(','))!;
        for (let a = 0; a < n; a++) {
          for (let b = a + 1; b < n; b++) {
            const nxt = swapPositions(cur, a, b);
            const k = nxt.join(',');
            if (!dist.has(k)) { dist.set(k, d + 1); queue.push(nxt); }
          }
        }
      }
      // Every one of the n! arrangements was reached, so every arrangement can be finished.
      expect(dist.size).toBe(permutations(n).length);
      for (const p of permutations(n)) expect(minSwaps(p), p.join('')).toBe(dist.get(p.join(','))!);
    }
  });

  it('solveSwaps finishes any arrangement in exactly the minimum number of swaps', () => {
    const rng = mulberry32(4);
    for (let t = 0; t < 300; t++) {
      const n = 2 + Math.floor(rng() * 24);
      const p = identity(n);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } // an ordinary shuffle, fixed points allowed
      const swaps = solveSwaps(p);
      expect(swaps.length).toBe(minSwaps(p));
      let cur = p.slice();
      for (const [a, b] of swaps) cur = swapPositions(cur, a, b);
      expect(isSolved(cur)).toBe(true);
    }
    expect(solveSwaps(identity(5))).toEqual([]);
  });

  it('a played game of random swaps never leaves the permutations, and following solveSwaps from any point ends solved', () => {
    const rng = mulberry32(8);
    for (let g = 0; g < 100; g++) {
      const n = pieceCount(LEVELS[g % LEVELS.length]);
      let p = scramble(n, rng);
      for (let k = 0; k < 40; k++) {
        p = swapPositions(p, Math.floor(rng() * n), Math.floor(rng() * n));
        expect(isPermutation(p, n)).toBe(true);
      }
      for (const [a, b] of solveSwaps(p)) p = swapPositions(p, a, b);
      expect(isSolved(p)).toBe(true);
    }
  });
});

describe('keyboard and pointer positions', () => {
  it('arrow keys move over the grid without wrapping, Home and End jump, and every place is reachable', () => {
    for (const l of LEVELS) {
      const n = l.rows * l.cols;
      expect(gridMove('ArrowRight', 0, l.rows, l.cols)).toBe(1);
      expect(gridMove('ArrowLeft', 0, l.rows, l.cols)).toBeNull();
      expect(gridMove('ArrowUp', 0, l.rows, l.cols)).toBeNull();
      expect(gridMove('ArrowDown', 0, l.rows, l.cols)).toBe(l.cols);
      expect(gridMove('ArrowRight', l.cols - 1, l.rows, l.cols)).toBeNull();
      expect(gridMove('ArrowDown', n - 1, l.rows, l.cols)).toBeNull();
      expect(gridMove('End', 0, l.rows, l.cols)).toBe(n - 1);
      expect(gridMove('Home', n - 1, l.rows, l.cols)).toBe(0);
      expect(gridMove('Home', 0, l.rows, l.cols)).toBeNull();
      const seen = new Set<number>([0]);
      const queue = [0];
      while (queue.length) {
        const p = queue.shift()!;
        for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
          const to = gridMove(k, p, l.rows, l.cols);
          if (to !== null && !seen.has(to)) { seen.add(to); queue.push(to); }
        }
      }
      expect(seen.size).toBe(n);
    }
  });

  it('ignores other keys and positions that do not exist', () => {
    for (const k of ['a', 'Enter', ' ', 'Tab', 'PageUp', '']) expect(gridMove(k, 2, 3, 3)).toBeNull();
    for (const pos of [-1, 9, 1.5, NaN]) expect(gridMove('ArrowRight', pos, 3, 3)).toBeNull();
  });

  it('a point on the board lands on the cell it is inside, and nothing outside lands anywhere', () => {
    for (const l of LEVELS) {
      const size = 300;
      for (let i = 0; i < l.rows * l.cols; i++) {
        const c = cellRect(l.rows, l.cols, i);
        const scale = size / SIZE;
        expect(positionAtPoint((c.x + c.w / 2) * scale, (c.y + c.h / 2) * scale, size, l.rows, l.cols)).toBe(i);
        expect(positionAtPoint(c.x * scale + 0.01, c.y * scale + 0.01, size, l.rows, l.cols)).toBe(i);
      }
    }
    expect(positionAtPoint(-1, 10, 300, 3, 3)).toBeNull();
    expect(positionAtPoint(10, 300, 300, 3, 3)).toBeNull();
    expect(positionAtPoint(300, 10, 300, 3, 3)).toBeNull();
    expect(positionAtPoint(NaN, 10, 300, 3, 3)).toBeNull();
    expect(positionAtPoint(10, 10, 0, 3, 3)).toBeNull();
    expect(positionAtPoint(299.99, 299.99, 300, 3, 3)).toBe(8);
  });
});

describe('the pictures', () => {
  it('has 4 scenes with unique ids, names and emoji, each with plenty of shapes', () => {
    expect(SCENES).toHaveLength(4);
    expect(SCENE_IDS).toEqual(['sunset', 'garden', 'space', 'sea']);
    expect(new Set(SCENES.map((s) => s.name)).size).toBe(4);
    expect(new Set(SCENES.map((s) => s.emoji)).size).toBe(4);
    expect(SCENES.map((s) => s.shapes.length)).toEqual([127, 165, 80, 114]);
  });

  it.each(SCENES.map((s) => [s.id, s] as const))('%s passes the scene check and uses only known colours', (_id, s) => {
    expect(validateScene(s)).toEqual([]);
    for (const sh of s.shapes) expect(COLOUR_KEYS).toContain(sh.c);
    expect(new Set(s.shapes.map((x) => x.c)).size).toBeGreaterThanOrEqual(10);
  });

  it('the scene checker catches bad scenes', () => {
    const good = SCENES[0];
    expect(validateScene({ ...good, shapes: good.shapes.slice(0, 10) }).join()).toMatch(/too few/);
    expect(validateScene({ ...good, shapes: [{ k: 'rect', x: 0, y: 0, w: 100, h: 100, c: 'sky' }, ...good.shapes.slice(1)] }).join()).toMatch(/whole sheet/);
    const bad: Shape[] = [...good.shapes, { k: 'circle', cx: 5, cy: 5, r: -1, c: 'sky' }, { k: 'poly', pts: [[0, 0], [1, 1]], c: 'sky' }, { k: 'rect', x: NaN, y: 0, w: 1, h: 1, c: 'sky' }];
    expect(validateScene({ ...good, shapes: bad }).join()).toMatch(/proper circle/);
    expect(validateScene({ ...good, shapes: bad }).join()).toMatch(/proper polygon/);
    expect(validateScene({ ...good, shapes: bad }).join()).toMatch(/proper rectangle/);
  });

  it('shape hit testing is right for each kind of shape', () => {
    expect(shapeContains({ k: 'rect', x: 10, y: 10, w: 5, h: 5, c: 'sky' }, 12, 12)).toBe(true);
    expect(shapeContains({ k: 'rect', x: 10, y: 10, w: 5, h: 5, c: 'sky' }, 16, 12)).toBe(false);
    expect(shapeContains({ k: 'circle', cx: 50, cy: 50, r: 10, c: 'sky' }, 57, 57)).toBe(true);
    expect(shapeContains({ k: 'circle', cx: 50, cy: 50, r: 10, c: 'sky' }, 58, 58)).toBe(false);
    expect(shapeContains({ k: 'ellipse', cx: 50, cy: 50, rx: 20, ry: 5, c: 'sky' }, 68, 50)).toBe(true);
    expect(shapeContains({ k: 'ellipse', cx: 50, cy: 50, rx: 20, ry: 5, c: 'sky' }, 50, 58)).toBe(false);
    const tri: Shape = { k: 'poly', pts: [[0, 0], [10, 0], [0, 10]], c: 'sky' };
    expect(shapeContains(tri, 2, 2)).toBe(true);
    expect(shapeContains(tri, 8, 8)).toBe(false);
  });

  it('a later shape covers an earlier one, and the sheet is fully covered', () => {
    const s = SCENES[0];
    expect(colourAt(s, 60, 3)).toBe('night');
    expect(colourAt(s, 60, 30)).toBe('violet');
    for (const sc of SCENES) for (let y = 0.5; y < SIZE; y += 7) for (let x = 0.5; x < SIZE; x += 7) expect(colourAt(sc, x, y)).not.toBeNull();
  });

  it('raster difference measures how many places differ', () => {
    expect(rasterDifference(['sky', 'sky', 'amber', null], ['sky', 'sky', 'amber', null])).toBe(0);
    expect(rasterDifference(['sky', 'sky'], ['amber', 'rose'])).toBe(1);
    expect(rasterDifference(['sky', 'sky', 'sky', 'sky'], ['sky', 'rose', 'sky', 'sky'])).toBe(0.25);
    expect(rasterDifference(['sky'], ['sky', 'sky'])).toBe(1);
    expect(rasterDifference([], [])).toBe(1);
    expect(colourCount(['sky', 'sky', 'amber'])).toBe(2);
  });

  it('no two pieces look alike at any size: pieces differ in at least 9 percent of their area and each shows 2 or more colours', () => {
    for (const s of SCENES) {
      for (const l of LEVELS) {
        expect(minPieceDifference(s, l.rows, l.cols), `${s.id} ${l.id}`).toBeGreaterThanOrEqual(0.09);
        for (const c of cutCells(l.rows, l.cols)) expect(colourCount(rasterCell(s, c)), `${s.id} ${l.id}`).toBeGreaterThanOrEqual(2);
      }
    }
  }, 120_000);

  it('the colours the pictures use are all defined, each different, in the page CSS', () => {
    const calc = readFileSync(join(resolve(__dirname, '..'), 'src/components/apps-private/picture-puzzle/Calculator.astro'), 'utf8');
    expect(COLOUR_KEYS).toHaveLength(18);
    expect(new Set(COLOUR_KEYS).size).toBe(18);
    const defs = new Map([...calc.matchAll(/--q(\d+):\s*([^;]+);/g)].map((m) => [Number(m[1]), m[2].trim().replace(/\s+/g, ' ')] as const));
    expect(defs.size).toBe(18);
    expect(new Set(defs.values()).size).toBe(18);
    for (const v of defs.values()) {
      expect(v).toMatch(/^(var\(--g-[a-z]+\)|color-mix\(in oklch, [^;]+\))$/);
      expect(v).not.toMatch(/#|rgb|hsl|\bwhite\b|\bblack\b/i);
    }
    const used = new Set<number>();
    for (const key of COLOUR_KEYS) {
      const m = calc.match(new RegExp(`\\.pcp-c-${key}\\s*\\{\\s*fill:\\s*var\\(--q(\\d+)\\)`));
      expect(m, `class for ${key}`).not.toBeNull();
      used.add(Number(m![1]));
    }
    expect(used.size).toBe(18);
  });

  it('finds scenes by id and rejects junk', () => {
    expect(sceneById('sea')!.name).toBe('Under the sea');
    expect(sceneById('x')).toBeNull();
    expect(indexOfScene('garden')).toBe(1);
    expect(parseSceneParam('space')).toBe('space');
    for (const junk of ['', 'SEA', '__proto__', 'constructor', 5, null, undefined, [], {}]) expect(parseSceneParam(junk)).toBeNull();
  });
});

describe('page address and saved results', () => {
  it('reads a seed only as a whole number from 1 to 2^32 - 1', () => {
    expect(parseSeedParam('1')).toBe(1);
    expect(parseSeedParam('4294967295')).toBe(4294967295);
    for (const junk of ['', '0', '-3', '1.5', '4294967296', '99999999999', 'abc', '1e3', ' 5', '5 ', '0x10', 5, null, undefined, [], {}]) expect(parseSeedParam(junk)).toBeNull();
  });

  it('keeps best swap counts as small whole numbers per level and nothing else', () => {
    expect(MAX_BEST_SWAPS).toBe(9999);
    expect(sanitiseBest({ tiny: 3, little: 5, middle: 8, big: 15, huge: 24 })).toEqual({ tiny: 3, little: 5, middle: 8, big: 15, huge: 24 });
    expect(sanitiseBest({ tiny: 0, little: -1, middle: 1.5, big: 10000, huge: NaN, other: 4 })).toEqual({});
    for (const junk of [null, undefined, 3, 'x', [], [1], JSON.parse('{"__proto__":{"tiny":3}}')]) expect(sanitiseBest(junk)).toEqual({});
    expect(Object.keys(sanitiseBest({ tiny: 3, extra: 9 }))).toEqual(['tiny']);
  });

  it('picks a different picture for surprise and wraps round for next', () => {
    const rng = mulberry32(6);
    for (let i = 0; i < 200; i++) {
      const not = Math.floor(rng() * 4);
      const pick = surpriseScene(not, rng);
      expect(pick).not.toBe(not);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThan(4);
    }
    expect([0, 1, 2, 3].map((i) => nextScene(i))).toEqual([1, 2, 3, 0]);
  });
});

describe('words for the child', () => {
  it('lights stars for progress and all five only when finished', () => {
    expect(progressStars(0, 9)).toBe(0);
    expect(progressStars(9, 9)).toBe(5);
    expect(progressStars(8, 9)).toBe(4);
    expect(progressStars(1, 4)).toBe(1);
    expect(progressStars(3, 4)).toBe(3);
    expect(progressStars(0, 0)).toBe(0);
    let last = 0;
    for (let h = 0; h <= 25; h++) { const s = progressStars(h, 25); expect(s).toBeGreaterThanOrEqual(last); last = s; }
    for (let h = 0; h < 25; h++) expect(progressStars(h, 25)).toBeLessThan(5);
  });

  it('describes a piece and its place for a screen reader', () => {
    expect(positionName(4, 3)).toBe('row 2, column 2');
    expect(pieceLabel(4, 9, 4, 3, false)).toBe('Piece 5 of 9, at row 2, column 2, in the right place');
    expect(pieceLabel(0, 9, 8, 3, false)).toBe('Piece 1 of 9, at row 3, column 3, not in its place yet');
    expect(pieceLabel(0, 9, 8, 3, true)).toBe('Piece 1 of 9, at row 3, column 3, not in its place yet, picked up');
  });

  it('praises a swap that puts a piece home and stays calm when it does not', () => {
    expect(swappedMessage(1, 2, 9, 1)).toBe('Good move! A piece is now in the right place. 2 of 9 in the right place.');
    expect(swappedMessage(2, 4, 9, 2)).toBe('Well done! 2 pieces are now in the right place. 4 of 9 in the right place.');
    expect(swappedMessage(3, 4, 9, 0)).toBe('Swapped. 4 of 9 in the right place.');
    expect(pickedMessage(0, 3)).toBe('Picked up the piece at row 1, column 1. Now tap another piece to swap them.');
    expect(putDownMessage()).toBe('Put the piece back. Tap a piece to pick it up.');
    expect(winMessage('Little', 5)).toBe('You finished the little puzzle in 5 swaps!');
    expect(winMessage('Tiny', 1)).toBe('You finished the tiny puzzle in 1 swap!');
    expect(startMessage('Sunset', 6)).toBe('New sunset puzzle with 6 pieces. Tap a piece, then tap another to swap them.');
    expect(plural(1, 'swap')).toBe('1 swap');
    expect(plural(0, 'swap')).toBe('0 swaps');
  });

  it('never scolds', () => {
    const all = [swappedMessage(3, 4, 9, 0), swappedMessage(1, 2, 9, 1), pickedMessage(0, 3), putDownMessage(), winMessage('Big', 15), startMessage('Sea', 4)];
    for (const m of all) expect(m).not.toMatch(/wrong|fail|bad|oops|incorrect|mistake/i);
  });

  it('share text is right unfinished and finished', () => {
    expect(shareText('Sunset', 'Little', 2, 3, false, 4, 2, 6, 'U')).toBe('Picture Puzzle - Sunset, little (2 x 3): 2 of 6 pieces in place\nU');
    expect(shareText('Sunset', 'Little', 2, 3, true, 7, 6, 6, 'U')).toBe('Picture Puzzle - Sunset, little (2 x 3): finished in 7 swaps\nU');
    expect(shareText('Sea', 'Tiny', 2, 2, true, 1, 4, 4, 'U')).toBe('Picture Puzzle - Sea, tiny (2 x 2): finished in 1 swap\nU');
  });
});

describe('seeded randomness', () => {
  it('gives the same numbers for the same seed and stays in [0, 1)', () => {
    const a = mulberry32(9), b = mulberry32(9);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
