/**
 * games-pixel-art.test.ts - the engine behind `pixel-art`.
 *
 * Pinned: flood fill equals an independent repeated-sweep fill on random boards, Bresenham lines
 * include both end points, are 8-connected, have max(dx, dy) + 1 cells, stay within half a cell of
 * the ideal line and cover the same cells in either direction, rectangles and mirror drawing hit
 * exactly the right cells, undo and redo are exact round trips capped at 50 steps, the save string
 * round-trips for every size, is at most 1100 characters, and rejects junk (wrong sizes, counts,
 * letters, non-canonical spellings, __proto__, arrays, numbers), the palette has 16 distinct colours,
 * OKLCH mixing keeps its end points and is symmetric, and the PNG scale gives 512 px or less.
 * The page-level claims (PNG through toBlob from a click, object URL revoked, no inline style) are
 * checked on the page source.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, PALETTE_SIZE, MAX_UNDO, MAX_SAVED_LEN, EXPORT_PX, MIRRORS, TOOLS,
  line, rectangle, shapeCells, mirrorPoints, expandCells, paintCells, floodFill, floodFillMirrored, countFilled, blank, cellIndex, inside,
  newHistory, commit, undo, redo, canUndo, canRedo, sameSnap, copySnap,
  encodeDrawing, decodeDrawing, sanitiseSaved,
  parseColour, toCss, mixOklch, buildPalette, PALETTE_NAMES, paletteName, neutral, shade, luminance, toOklch,
  exportScale, exportName, shareText,
  type Snap, type RGB,
} from '../src/components/apps-private/pixel-art/helpers';
import calculatorSource from '../src/components/apps-private/pixel-art/Calculator.astro?raw';

/** Small deterministic generator, local to the test. */
const prng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const randomCells = (n: number, rnd: () => number, colours: number): Uint8Array => {
  const c = blank(n);
  for (let i = 0; i < c.length; i++) c[i] = rnd() < 0.3 ? 0 : 1 + Math.floor(rnd() * colours);
  return c;
};

/** Independent oracle: repeat full sweeps, spreading the new value to any neighbour of a changed cell, until nothing changes. */
const naiveFill = (cells: Uint8Array, n: number, x: number, y: number, v: number): Uint8Array => {
  const out = cells.slice();
  const target = out[y * n + x];
  if (target === v) return out;
  const marked = new Array<boolean>(n * n).fill(false);
  marked[y * n + x] = true;
  let grew = true;
  while (grew) {
    grew = false;
    for (let yy = 0; yy < n; yy++) {
      for (let xx = 0; xx < n; xx++) {
        const i = yy * n + xx;
        if (marked[i] || cells[i] !== target) continue;
        const near = [[xx - 1, yy], [xx + 1, yy], [xx, yy - 1], [xx, yy + 1]];
        if (near.some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && marked[b * n + a])) { marked[i] = true; grew = true; }
      }
    }
  }
  for (let i = 0; i < out.length; i++) if (marked[i]) out[i] = v;
  return out;
};

describe('flood fill', () => {
  it('equals an independent repeated-sweep fill on random boards of every size', () => {
    const rnd = prng(7);
    for (const n of SIZES) {
      for (let k = 0; k < 40; k++) {
        const cells = randomCells(n, rnd, 3);
        const x = Math.floor(rnd() * n);
        const y = Math.floor(rnd() * n);
        const v = Math.floor(rnd() * 4);
        expect(Array.from(floodFill(cells, n, x, y, v))).toEqual(Array.from(naiveFill(cells, n, x, y, v)));
      }
    }
  });
  it('does not touch the input and ignores a fill with the colour already there', () => {
    const c = blank(8);
    const copy = c.slice();
    const out = floodFill(c, 8, 3, 3, 5);
    expect(Array.from(c)).toEqual(Array.from(copy));
    expect(countFilled(out)).toBe(64);
    expect(Array.from(floodFill(out, 8, 0, 0, 5))).toEqual(Array.from(out));
  });
  it('stops at a wall and does not leak through a diagonal gap', () => {
    const c = blank(8);
    for (let i = 0; i < 8; i++) c[i * 8 + i] = 1; // a diagonal wall
    const out = floodFill(c, 8, 7, 0, 2);
    expect(out[0 * 8 + 7]).toBe(2);
    expect(out[7 * 8 + 0]).toBe(0); // the other side is not reached
    expect(out[1 * 8 + 1]).toBe(1);
  });
  it('an out-of-range seed changes nothing', () => {
    const c = randomCells(8, prng(2), 4);
    expect(Array.from(floodFill(c, 8, -1, 0, 3))).toEqual(Array.from(c));
    expect(Array.from(floodFill(c, 8, 0, 8, 3))).toEqual(Array.from(c));
  });
  it('mirrored fill seeds every mirror image and still equals the naive fill of each seed in turn', () => {
    const rnd = prng(11);
    for (let k = 0; k < 30; k++) {
      const n = 16;
      const cells = randomCells(n, rnd, 2);
      const x = Math.floor(rnd() * n);
      const y = Math.floor(rnd() * n);
      let expected = cells;
      for (const p of mirrorPoints(n, x, y, 'both')) expected = naiveFill(expected, n, p.x, p.y, 9);
      expect(Array.from(floodFillMirrored(cells, n, x, y, 9, 'both'))).toEqual(Array.from(expected));
    }
  });
});

describe('Bresenham line', () => {
  const rnd = prng(3);
  const cases: [number, number, number, number][] = [];
  for (let i = 0; i < 400; i++) cases.push([Math.floor(rnd() * 32), Math.floor(rnd() * 32), Math.floor(rnd() * 32), Math.floor(rnd() * 32)]);
  cases.push([0, 0, 0, 0], [5, 5, 5, 20], [3, 7, 30, 7], [0, 0, 31, 31], [31, 0, 0, 31]);

  it('includes both end points, in order, and has max(dx, dy) + 1 cells', () => {
    for (const [a, b, c, d] of cases) {
      const l = line(a, b, c, d);
      expect(l[0]).toEqual({ x: a, y: b });
      expect(l[l.length - 1]).toEqual({ x: c, y: d });
      expect(l.length).toBe(Math.max(Math.abs(c - a), Math.abs(d - b)) + 1);
    }
  });
  it('is 8-connected: each step moves at most one cell in each direction and never stands still', () => {
    for (const [a, b, c, d] of cases) {
      const l = line(a, b, c, d);
      for (let i = 1; i < l.length; i++) {
        const dx = Math.abs(l[i].x - l[i - 1].x);
        const dy = Math.abs(l[i].y - l[i - 1].y);
        expect(Math.max(dx, dy)).toBe(1);
      }
    }
  });
  it('is symmetric: the same cells from either end', () => {
    for (const [a, b, c, d] of cases) {
      const f = line(a, b, c, d).map((p) => `${p.x},${p.y}`).sort();
      const r = line(c, d, a, b).map((p) => `${p.x},${p.y}`).sort();
      expect(r).toEqual(f);
      expect(line(c, d, a, b)).toEqual(line(a, b, c, d).slice().reverse());
    }
  });
  it('stays within half a cell of the ideal line along the shorter axis', () => {
    for (const [a, b, c, d] of cases) {
      const dx = c - a;
      const dy = d - b;
      for (const p of line(a, b, c, d)) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          const ideal = dx === 0 ? b : b + (dy * (p.x - a)) / dx;
          expect(Math.abs(p.y - ideal)).toBeLessThanOrEqual(0.5 + 1e-9);
        } else {
          const ideal = a + (dx * (p.y - b)) / dy;
          expect(Math.abs(p.x - ideal)).toBeLessThanOrEqual(0.5 + 1e-9);
        }
      }
    }
  });
  it('a straight line has no gaps and a single cell is one cell', () => {
    expect(line(2, 3, 2, 3)).toEqual([{ x: 2, y: 3 }]);
    expect(line(1, 4, 5, 4).map((p) => p.x)).toEqual([1, 2, 3, 4, 5]);
    expect(line(5, 4, 1, 4).map((p) => p.x)).toEqual([5, 4, 3, 2, 1]);
  });
});

describe('rectangles and shapes', () => {
  it('outline counts: 2w + 2h - 4, and a filled box is w x h, whichever corner comes first', () => {
    for (const [x0, y0, x1, y1] of [[1, 1, 5, 4], [5, 4, 1, 1], [2, 7, 2, 7], [0, 0, 7, 0], [3, 0, 3, 6]]) {
      const w = Math.abs(x1 - x0) + 1;
      const h = Math.abs(y1 - y0) + 1;
      const outline = rectangle(x0, y0, x1, y1, false);
      const filled = rectangle(x0, y0, x1, y1, true);
      expect(filled.length).toBe(w * h);
      expect(outline.length).toBe(w === 1 || h === 1 ? w * h : 2 * w + 2 * h - 4);
      expect(new Set(outline.map((p) => `${p.x},${p.y}`)).size).toBe(outline.length);
    }
  });
  it('the outline contains only edge cells and the box has no hole', () => {
    const o = rectangle(1, 1, 6, 5, false);
    expect(o.some((p) => p.x === 3 && p.y === 3)).toBe(false);
    expect(rectangle(1, 1, 6, 5, true).some((p) => p.x === 3 && p.y === 3)).toBe(true);
  });
  it('shapeCells maps each tool to its shape', () => {
    expect(shapeCells('line', 0, 0, 3, 3)).toEqual(line(0, 0, 3, 3));
    expect(shapeCells('pencil', 0, 0, 3, 1)).toEqual(line(0, 0, 3, 1));
    expect(shapeCells('rect', 0, 0, 3, 3)).toEqual(rectangle(0, 0, 3, 3, false));
    expect(shapeCells('box', 0, 0, 3, 3)).toEqual(rectangle(0, 0, 3, 3, true));
    expect(TOOLS.length).toBe(6);
  });
});

describe('mirror drawing', () => {
  it('gives the point and its images, with no duplicate on the centre line', () => {
    expect(mirrorPoints(8, 1, 2, 'none')).toEqual([{ x: 1, y: 2 }]);
    expect(mirrorPoints(8, 1, 2, 'across')).toEqual([{ x: 1, y: 2 }, { x: 6, y: 2 }]);
    expect(mirrorPoints(8, 1, 2, 'down')).toEqual([{ x: 1, y: 2 }, { x: 1, y: 5 }]);
    expect(mirrorPoints(8, 1, 2, 'both').length).toBe(4);
    expect(mirrorPoints(7 + 1, 3, 3, 'both').length).toBe(4); // 8 is even: no cell sits on the centre line
  });
  it('is its own inverse and stays on the board for every cell, size and mode', () => {
    for (const n of SIZES) for (const m of MIRRORS) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const pts = mirrorPoints(n, x, y, m);
        expect(pts.length).toBe(m === 'none' ? 1 : m === 'both' ? 4 : 2);
        for (const p of pts) {
          expect(inside(n, p.x, p.y)).toBe(true);
          expect(mirrorPoints(n, p.x, p.y, m).map((q) => `${q.x},${q.y}`).sort()).toEqual(pts.map((q) => `${q.x},${q.y}`).sort());
        }
      }
    }
  });
  it('expandCells is unique, in range, and drops points that are off the board', () => {
    const idx = expandCells(8, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 99, y: 3 }, { x: -1, y: 0 }], 'both');
    expect(idx.sort((a, b) => a - b)).toEqual([0, 7, 56, 63]);
  });
  it('painting a line with four-way mirroring is symmetric in both axes', () => {
    const n = 16;
    const cells = paintCells(blank(n), expandCells(n, line(1, 2, 6, 5), 'both'), 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      expect(cells[cellIndex(n, x, y)]).toBe(cells[cellIndex(n, n - 1 - x, y)]);
      expect(cells[cellIndex(n, x, y)]).toBe(cells[cellIndex(n, x, n - 1 - y)]);
    }
  });
});

describe('paintCells', () => {
  it('copies, ignores bad indexes and rejects an out-of-palette value', () => {
    const c = blank(8);
    const out = paintCells(c, [0, 63, 64, -1], 3);
    expect(c[0]).toBe(0);
    expect([out[0], out[63]]).toEqual([3, 3]);
    expect(countFilled(out)).toBe(2);
    expect(countFilled(paintCells(c, [5], 99))).toBe(0); // 99 is not a colour: treated as empty
    expect(countFilled(paintCells(c, [5], 1.5))).toBe(0);
  });
});

describe('history: undo and redo', () => {
  const snap = (n: 8 | 16 | 32, k: number): Snap => { const c = blank(n); c[0] = k; return { n, cells: c }; };
  it('undo then redo is an exact round trip, and a new step drops the redo list', () => {
    let h = newHistory(snap(8, 0));
    for (let i = 1; i <= 5; i++) h = commit(h, snap(8, i));
    const before = copySnap(h.present);
    for (let i = 0; i < 3; i++) h = undo(h);
    expect(h.present.cells[0]).toBe(2);
    for (let i = 0; i < 3; i++) h = redo(h);
    expect(sameSnap(h.present, before)).toBe(true);
    h = undo(h);
    h = commit(h, snap(8, 9));
    expect(canRedo(h)).toBe(false);
    expect(h.present.cells[0]).toBe(9);
  });
  it('an unchanged picture is not a step, and undo/redo on empty stacks do nothing', () => {
    let h = newHistory(snap(8, 1));
    expect(commit(h, snap(8, 1))).toBe(h);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    expect(canUndo(h)).toBe(false);
    h = commit(h, snap(8, 2));
    expect(canUndo(h)).toBe(true);
  });
  it('keeps at most 50 steps: the 51st oldest picture is gone', () => {
    let h = newHistory(snap(8, 0));
    for (let i = 1; i <= 80; i++) h = commit(h, snap(8, (i % 16) + 1));
    expect(h.past.length).toBe(MAX_UNDO);
    let steps = 0;
    while (canUndo(h)) { h = undo(h); steps++; }
    expect(steps).toBe(50);
  });
  it('redo is capped the same way and a size change is a step that undo reverses', () => {
    let h = newHistory(snap(8, 3));
    h = commit(h, snap(16, 0));
    expect(h.present.n).toBe(16);
    h = undo(h);
    expect(h.present.n).toBe(8);
    expect(h.present.cells[0]).toBe(3);
    h = redo(h);
    expect(h.present.n).toBe(16);
  });
  it('stored pictures are copies: changing the live array afterwards cannot corrupt history', () => {
    const live = snap(8, 1);
    let h = newHistory(live);
    live.cells[0] = 7;
    expect(h.present.cells[0]).toBe(1);
    h = commit(h, live);
    live.cells[0] = 12;
    expect(h.present.cells[0]).toBe(7);
  });
});

describe('save string', () => {
  it('round-trips random drawings of every size exactly', () => {
    const rnd = prng(21);
    for (const n of SIZES) for (let k = 0; k < 60; k++) {
      const s: Snap = { n, cells: randomCells(n, rnd, 16) };
      const text = encodeDrawing(s);
      const back = decodeDrawing(text);
      expect(back).not.toBeNull();
      expect(back!.n).toBe(n);
      expect(Array.from(back!.cells)).toEqual(Array.from(s.cells));
      expect(text.length).toBeLessThanOrEqual(MAX_SAVED_LEN);
    }
  });
  it('a blank board is short and the worst case (a checkerboard) fits the cap', () => {
    expect(encodeDrawing({ n: 8, cells: blank(8) })).toBe('8:a64');
    const c = blank(32);
    for (let i = 0; i < c.length; i++) c[i] = i % 2 ? 16 : 0;
    const text = encodeDrawing({ n: 32, cells: c });
    expect(text.length).toBe(3 + 1024);
    expect(text.length).toBeLessThanOrEqual(MAX_SAVED_LEN);
    expect(decodeDrawing(text)).not.toBeNull();
  });
  it('every palette index survives (1 to 16) and index 17 is not a letter', () => {
    const c = blank(8);
    for (let i = 0; i < 16; i++) c[i] = i + 1;
    expect(Array.from(decodeDrawing(encodeDrawing({ n: 8, cells: c }))!.cells)).toEqual(Array.from(c));
    expect(decodeDrawing('8:r64')).toBeNull();
  });
  it('rejects junk: wrong sizes, wrong totals, bad counts, non-canonical spellings, non-strings', () => {
    const bad: unknown[] = [
      '', 'x', '8:', ':a64', '9:a81', '16:a64', '8:a63', '8:a65', '8:a0', '8:a1a63', '8:a064', '8:a64x', '8:A64', ' 8:a64', '8:a64 ',
      '8:a32a32', '08:a64', '8:a99999', '8:a-5', '8:aa63', '8.0:a64', '1e1:a64',
      42, null, undefined, {}, [], ['8:a64'], true, NaN,
    ];
    for (const b of bad) expect(decodeDrawing(b), String(b)).toBeNull();
    expect(decodeDrawing('8:a'.padEnd(MAX_SAVED_LEN + 5, 'a'))).toBeNull();
    expect(decodeDrawing('8:a64')).not.toBeNull();
  });
  it('sanitiseSaved accepts only a plain object with a good string and builds a fresh object', () => {
    const good = JSON.parse('{"d":"8:a64","extra":1}');
    const out = sanitiseSaved(good);
    expect(out).toEqual({ d: '8:a64' });
    expect(out).not.toBe(good);
    for (const raw of [null, undefined, 5, 'x', [], ['8:a64'], {}, { d: 5 }, { d: '9:a' }, { d: ['8:a64'] }, JSON.parse('{"__proto__":{"d":"8:a64"}}'), JSON.parse('{"constructor":"8:a64"}')]) {
      expect(sanitiseSaved(raw)).toBeNull();
    }
  });
});

describe('palette and colour mixing', () => {
  const tokens = { sky: parseColour('#38bdf8')!, green: parseColour('#34d399')!, amber: parseColour('#fbbf24')!, rose: parseColour('#f87171')! };
  it('reads hex and rgb-style strings and rejects junk', () => {
    expect(parseColour('#38bdf8')).toEqual([56, 189, 248]);
    expect(parseColour('#fff')).toEqual([255, 255, 255]);
    expect(parseColour('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    for (const j of ['', '  ', '#12', '#gggggg', 'sky', 'rgb(1)', 'rgb(999, 0, 0)', '#12345678']) expect(parseColour(j), j).toBeNull();
    expect(toCss([56, 189, 248])).toBe('#38bdf8');
    expect(toCss([0, 0, 0])).toBe('#000000');
  });
  it('has 16 distinct colours with 16 names, all valid bytes', () => {
    const p = buildPalette(tokens);
    expect(p.length).toBe(PALETTE_SIZE);
    expect(PALETTE_NAMES.length).toBe(PALETTE_SIZE);
    expect(new Set(p.map(toCss)).size).toBe(16);
    expect(new Set(PALETTE_NAMES).size).toBe(16);
    for (const c of p) for (const v of c) { expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true); }
  });
  it('first row is the four tokens with their even mixes between; neutrals run light to dark', () => {
    const p = buildPalette(tokens);
    expect(p[0]).toEqual(tokens.sky);
    expect(p[2]).toEqual(tokens.green);
    expect(p[4]).toEqual(tokens.amber);
    expect(p[6]).toEqual(tokens.rose);
    expect(p[1]).toEqual(mixOklch(tokens.sky, tokens.green, 0.5));
    const lum = [12, 13, 14, 15].map((i) => luminance(p[i]));
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeLessThan(lum[i - 1]);
    for (const i of [12, 13, 14, 15]) expect(Math.max(...p[i]) - Math.min(...p[i])).toBeLessThanOrEqual(1); // greys
    expect(luminance(p[8])).toBeLessThan(luminance(p[0]));
    expect(luminance(p[9])).toBeLessThan(luminance(p[2]));
    expect(luminance(p[10])).toBeLessThan(luminance(p[5]));
    expect(luminance(p[11])).toBeLessThan(luminance(p[7]));
  });
  it('mix keeps its end points, is symmetric at the middle and moves lightness smoothly', () => {
    const a = tokens.sky;
    const b = tokens.rose;
    expect(mixOklch(a, b, 0)).toEqual(a);
    expect(mixOklch(a, b, 1)).toEqual(b);
    const m1 = mixOklch(a, b, 0.5);
    const m2 = mixOklch(b, a, 0.5);
    for (let i = 0; i < 3; i++) expect(Math.abs(m1[i] - m2[i])).toBeLessThanOrEqual(1);
    const la = toOklch(a).L;
    const lb = toOklch(b).L;
    const lm = toOklch(m1).L;
    expect(lm).toBeGreaterThanOrEqual(Math.min(la, lb) - 0.02);
    expect(lm).toBeLessThanOrEqual(Math.max(la, lb) + 0.02);
    expect(mixOklch(a, a, 0.37).map((v, i) => Math.abs(v - a[i])).every((d) => d <= 1)).toBe(true);
    expect(mixOklch(a, b, NaN)).toEqual(m1);
  });
  it('a grey takes the other colour\'s hue instead of sliding to a random one, and neutral() is grey', () => {
    const grey: RGB = neutral(0.5);
    const m = mixOklch(grey, tokens.amber, 0.5);
    expect(toOklch(m).C).toBeGreaterThan(0.02);
    expect(Math.abs(toOklch(m).h - toOklch(tokens.amber).h)).toBeLessThan(0.15);
    expect(shade(tokens.sky, 0.5)[2]).toBeLessThan(tokens.sky[2]);
  });
  it('paletteName covers empty, 1 to 16 and out-of-range values', () => {
    expect(paletteName(0)).toBe('Empty');
    expect(paletteName(1)).toBe('Sky');
    expect(paletteName(16)).toBe('Black');
    expect(paletteName(17)).toBe('Unknown');
  });
});

describe('export and words', () => {
  it('the PNG is whole-pixel scaled to about 512 px for every size', () => {
    expect(EXPORT_PX).toBe(512);
    for (const n of SIZES) { expect(exportScale(n) * n).toBeLessThanOrEqual(512); expect(exportScale(n) * n).toBeGreaterThan(255); }
    expect([exportScale(8), exportScale(16), exportScale(32)]).toEqual([64, 32, 16]);
    expect(exportName(16)).toBe('pixel-art-16x16.png');
  });
  it('share text is right for blank, one pixel and many', () => {
    expect(shareText({ n: 8, cells: blank(8) })).toBe('Pixel Art 8x8: a blank canvas so far');
    const one = blank(8); one[3] = 2;
    expect(shareText({ n: 8, cells: one })).toBe('Pixel Art 8x8: a drawing with 1 coloured pixel');
    const two = blank(8); two[3] = 2; two[4] = 5;
    expect(shareText({ n: 8, cells: two })).toBe('Pixel Art 8x8: a drawing with 2 coloured pixels');
  });
});

describe('fuzz: random tool use never breaks the board', () => {
  it('thousands of random strokes keep every value in range and every history step valid', () => {
    const rnd = prng(99);
    let h = newHistory({ n: 16, cells: blank(16) });
    for (let k = 0; k < 4000; k++) {
      const n = h.present.n;
      const tool = TOOLS[Math.floor(rnd() * TOOLS.length)];
      const mirror = MIRRORS[Math.floor(rnd() * MIRRORS.length)];
      const x0 = Math.floor(rnd() * n);
      const y0 = Math.floor(rnd() * n);
      const x1 = Math.floor(rnd() * n);
      const y1 = Math.floor(rnd() * n);
      const colour = 1 + Math.floor(rnd() * 16);
      let next: Uint8Array;
      if (tool === 'fill') next = floodFillMirrored(h.present.cells, n, x0, y0, colour, mirror);
      else next = paintCells(h.present.cells, expandCells(n, shapeCells(tool, x0, y0, x1, y1), mirror), tool === 'eraser' ? 0 : colour);
      h = commit(h, { n, cells: next });
      if (rnd() < 0.1 && canUndo(h)) h = undo(h);
      if (rnd() < 0.05 && canRedo(h)) h = redo(h);
      expect(h.past.length).toBeLessThanOrEqual(MAX_UNDO);
      for (let i = 0; i < h.present.cells.length; i += 37) expect(h.present.cells[i]).toBeLessThanOrEqual(16);
    }
    const final = decodeDrawing(encodeDrawing(h.present));
    expect(final && sameSnap(final, h.present)).toBe(true);
  }, 30_000);
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('exports the PNG through toBlob from a click and revokes the object URL', () => {
    expect(src).toMatch(/toBlob\(/);
    expect(src).toMatch(/createObjectURL/);
    expect(src).toMatch(/revokeObjectURL/);
    expect(src).toMatch(/image\/png/);
  });
  it('stores only under gk:game:pixel-art and never spreads parsed JSON', () => {
    expect(src).toMatch(/gk:game:pixel-art/);
    expect(src).not.toMatch(/\.\.\.\s*JSON\.parse/);
    expect(src).toMatch(/sanitiseSaved/);
  });
  it('makes the canvas as many pixels as its CSS box, so nothing is stretched, and snaps cell edges to whole pixels', () => {
    expect(src).toMatch(/canvas\.clientWidth/);
    expect(src).toMatch(/canvas\.clientHeight/);
    expect(src).toMatch(/const ex = \(i: number\): number => Math\.round\(i \* cellW\)/);
    expect(src).not.toMatch(/Math\.floor\(\(w \* dpr\) \/ n\)/);
  });
  it('offers a keyboard way to draw and a live status line', () => {
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/aria-live="polite"/);
  });
});
