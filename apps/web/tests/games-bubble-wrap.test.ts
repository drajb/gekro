/**
 * games-bubble-wrap.test.ts - the engine behind `bubble-wrap`.
 *
 * Pinned: the three sheet sizes and every number the guide page quotes; that a sheet is rebuilt
 * exactly from its seed; that popping a bubble twice counts once; that the bubble under a touch
 * agrees with a brute-force search of the cell rectangles, including every edge; that a fast
 * drag pops every bubble it passes (the line of cells has no gaps and no repeats); keyboard
 * moves; the rate limiter that keeps the light ring to three flashes in any second (checked on
 * a saturated clock and on random timings, so no window of a second ever holds a fourth);
 * that every sound is short and quiet; the words; and that what comes out of localStorage is
 * sanitised before the page sees it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SHEET_KEYS, SHEETS, DEFAULT_SHEET, parseSheet, PITCHES, SHEET_HUES, FLASH_MAX_PER_SECOND, SOUND_MAX_PER_SECOND, PEAK_GAIN, MAX_POPPED, MAX_SHEETS,
  mulberry32, plural, makeSheet, sheetSize, inRange, colOf, rowOf, indexOf, remaining, isClear, popAt, cellAt, cellsBetween, nextWhole, neighbour,
  bubbleLabel, popMessage, sheetDoneMessage, milestone, shareLine, makeLimiter, makeFlashLimiter, makeSoundLimiter, popTone, doneTones,
  emptyStored, sanitiseStored, toStorable, addTotals,
  type Sheet, type SheetKey, type Dir,
} from '../src/components/apps-private/bubble-wrap/helpers';

const EM_DASH = String.fromCharCode(0x2014);

describe('constants quoted on the guide page', () => {
  it('match the spec', () => {
    expect([...SHEET_KEYS]).toEqual(['large', 'medium', 'small']);
    expect(SHEETS.large).toMatchObject({ cols: 5, rows: 7 });
    expect(SHEETS.medium).toMatchObject({ cols: 6, rows: 9 });
    expect(SHEETS.small).toMatchObject({ cols: 8, rows: 12 });
    expect(DEFAULT_SHEET).toBe('medium');
    expect(PITCHES).toBe(5);
    expect(SHEET_HUES).toBe(6);
    expect(FLASH_MAX_PER_SECOND).toBe(3);
    expect(SOUND_MAX_PER_SECOND).toBe(14);
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    expect(MAX_POPPED).toBe(999999);
    expect(MAX_SHEETS).toBe(9999);
  });
  it('sheets hold 35, 54 and 96 bubbles', () => {
    expect(SHEET_KEYS.map((k) => SHEETS[k].cols * SHEETS[k].rows)).toEqual([35, 54, 96]);
  });
  it('parseSheet falls back to medium', () => {
    for (const k of SHEET_KEYS) expect(parseSheet(k)).toBe(k);
    for (const bad of ['', 'huge', null, undefined, 3, {}, '__proto__', 'constructor']) expect(parseSheet(bad)).toBe('medium');
  });
});

describe('making a sheet', () => {
  it('starts whole, with a pitch for every bubble', () => {
    for (const k of SHEET_KEYS) {
      const s = makeSheet(k, 11);
      expect(s.popped).toHaveLength(sheetSize(s));
      expect(s.pitch).toHaveLength(sheetSize(s));
      expect(s.popped.every((p) => p === false)).toBe(true);
      expect(s.count).toBe(0);
      expect(remaining(s)).toBe(sheetSize(s));
      expect(isClear(s)).toBe(false);
      for (const p of s.pitch) {
        expect(Number.isInteger(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(PITCHES);
      }
    }
  });
  it('is the same for the same seed, and a sheet uses more than one pitch', () => {
    for (const k of SHEET_KEYS) {
      expect(JSON.stringify(makeSheet(k, 4))).toBe(JSON.stringify(makeSheet(k, 4)));
      expect(new Set(makeSheet(k, 4).pitch).size).toBeGreaterThan(2);
    }
    expect(JSON.stringify(makeSheet('small', 1))).not.toBe(JSON.stringify(makeSheet('small', 2)));
  });
  it('the colour is the seed mod six and every colour comes up', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 30; seed++) { const s = makeSheet('large', seed); expect(s.hue).toBe(seed % 6); seen.add(s.hue); }
    expect(seen.size).toBe(6);
  });
  it('survives a bad seed or size', () => {
    for (const bad of [NaN, Infinity, -3, 1.5, 2 ** 40, 'x' as unknown as number]) {
      const s = makeSheet('medium', bad);
      expect(s.hue).toBeGreaterThanOrEqual(0);
      expect(s.hue).toBeLessThan(6);
      expect(s.popped).toHaveLength(54);
    }
    expect(makeSheet('nope' as SheetKey, 1).key).toBe('medium');
  });
});

describe('popping', () => {
  it('pops a whole bubble once and only once', () => {
    const s = makeSheet('large', 3);
    expect(popAt(s, 4)).toBe(true);
    expect(popAt(s, 4)).toBe(false);
    expect(s.count).toBe(1);
    expect(s.popped[4]).toBe(true);
    expect(remaining(s)).toBe(34);
  });
  it('ignores a bubble that does not exist', () => {
    const s = makeSheet('large', 3);
    for (const bad of [-1, 35, 1.5, NaN, Infinity, 1e9]) expect(popAt(s, bad)).toBe(false);
    expect(s.count).toBe(0);
  });
  it('popping every bubble in any order clears the sheet and the count always equals the popped flags', () => {
    const rng = mulberry32(8);
    for (const k of SHEET_KEYS) {
      for (let round = 0; round < 20; round++) {
        const s = makeSheet(k, round);
        const order = Array.from({ length: sheetSize(s) }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        order.forEach((i, n) => {
          expect(isClear(s)).toBe(false);
          expect(popAt(s, i)).toBe(true);
          expect(s.count).toBe(n + 1);
          expect(s.count).toBe(s.popped.filter(Boolean).length);
        });
        expect(isClear(s)).toBe(true);
        expect(remaining(s)).toBe(0);
        expect(popAt(s, 0)).toBe(false);
      }
    }
  });
});

describe('which bubble is under a touch', () => {
  // The independent oracle: walk every cell rectangle and ask whether the point lies inside it.
  const oracle = (s: Sheet, fx: number, fy: number): number => {
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      if (fx >= c / s.cols && fx < (c + 1) / s.cols && fy >= r / s.rows && fy < (r + 1) / s.rows) return r * s.cols + c;
    }
    return -1;
  };
  it('agrees with a brute-force search over thousands of points, edges and outside points included', () => {
    const rng = mulberry32(1);
    for (const k of SHEET_KEYS) {
      const s = makeSheet(k, 1);
      for (let n = 0; n < 4000; n++) {
        const fx = rng() * 1.4 - 0.2;
        const fy = rng() * 1.4 - 0.2;
        expect(cellAt(s, fx, fy), `${k} ${fx} ${fy}`).toBe(oracle(s, fx, fy));
      }
      for (let c = 0; c <= s.cols; c++) for (let r = 0; r <= s.rows; r++) {
        const fx = c / s.cols;
        const fy = r / s.rows;
        expect(cellAt(s, fx, fy)).toBe(oracle(s, fx, fy));
      }
    }
  });
  it('is -1 outside the sheet and for bad numbers, and the middle of each cell finds that cell', () => {
    const s = makeSheet('medium', 1);
    for (const [x, y] of [[-0.001, 0.5], [0.5, -0.001], [1, 0.5], [0.5, 1], [2, 2], [NaN, 0.5], [0.5, NaN], [Infinity, 0], [0, -Infinity]]) expect(cellAt(s, x, y)).toBe(-1);
    for (let i = 0; i < sheetSize(s); i++) expect(cellAt(s, (colOf(s, i) + 0.5) / s.cols, (rowOf(s, i) + 0.5) / s.rows)).toBe(i);
    expect(cellAt(s, 0, 0)).toBe(0);
    expect(cellAt(s, 0.9999, 0.9999)).toBe(sheetSize(s) - 1);
  });
  it('row, column and index agree', () => {
    for (const k of SHEET_KEYS) {
      const s = makeSheet(k, 1);
      for (let i = 0; i < sheetSize(s); i++) {
        expect(indexOf(s, colOf(s, i), rowOf(s, i))).toBe(i);
        expect(inRange(s, i)).toBe(true);
      }
      expect(indexOf(s, -1, 0)).toBe(-1);
      expect(indexOf(s, s.cols, 0)).toBe(-1);
      expect(indexOf(s, 0, s.rows)).toBe(-1);
      expect(inRange(s, sheetSize(s))).toBe(false);
    }
  });
});

describe('a drag', () => {
  it('passes through every cell on the way: both ends included, no gaps, no repeats', () => {
    const rng = mulberry32(4);
    for (const k of SHEET_KEYS) {
      const s = makeSheet(k, 1);
      for (let n = 0; n < 500; n++) {
        const a = Math.floor(rng() * sheetSize(s));
        const b = Math.floor(rng() * sheetSize(s));
        const line = cellsBetween(s, a, b);
        expect(line[0]).toBe(a);
        expect(line[line.length - 1]).toBe(b);
        expect(new Set(line).size).toBe(line.length);
        expect(line.length).toBe(Math.max(Math.abs(colOf(s, a) - colOf(s, b)), Math.abs(rowOf(s, a) - rowOf(s, b))) + 1);
        for (let i = 1; i < line.length; i++) {
          const dc = Math.abs(colOf(s, line[i]) - colOf(s, line[i - 1]));
          const dr = Math.abs(rowOf(s, line[i]) - rowOf(s, line[i - 1]));
          expect(Math.max(dc, dr)).toBe(1);
        }
      }
    }
  });
  it('is just the one cell when you stay put, a straight run along a row, and empty for a bad cell', () => {
    const s = makeSheet('medium', 1);
    expect(cellsBetween(s, 7, 7)).toEqual([7]);
    expect(cellsBetween(s, 6, 11)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(cellsBetween(s, 11, 6)).toEqual([11, 10, 9, 8, 7, 6]);
    expect(cellsBetween(s, 0, 48)).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48]);
    expect(cellsBetween(s, -1, 4)).toEqual([]);
    expect(cellsBetween(s, 4, 999)).toEqual([]);
    expect(cellsBetween(s, 1.5, 4)).toEqual([]);
  });
});

describe('moving about by keyboard', () => {
  it('neighbour moves one cell and stops at an edge', () => {
    const s = makeSheet('medium', 1);
    const dirs: Dir[] = ['left', 'right', 'up', 'down'];
    expect(neighbour(s, 0, 'left')).toBe(0);
    expect(neighbour(s, 0, 'up')).toBe(0);
    expect(neighbour(s, 0, 'right')).toBe(1);
    expect(neighbour(s, 0, 'down')).toBe(6);
    expect(neighbour(s, 5, 'right')).toBe(5);
    expect(neighbour(s, 53, 'down')).toBe(53);
    expect(neighbour(s, 53, 'left')).toBe(52);
    for (let i = 0; i < sheetSize(s); i++) for (const d of dirs) {
      const j = neighbour(s, i, d);
      expect(inRange(s, j)).toBe(true);
      expect(Math.abs(colOf(s, j) - colOf(s, i)) + Math.abs(rowOf(s, j) - rowOf(s, i))).toBeLessThanOrEqual(1);
    }
    expect(neighbour(s, -5, 'down')).toBe(0);
  });
  it('nextWhole finds the next unpopped bubble in reading order, wraps, and is -1 on a clear sheet', () => {
    const rng = mulberry32(12);
    for (let round = 0; round < 300; round++) {
      const s = makeSheet('large', round);
      for (let i = 0; i < sheetSize(s); i++) if (rng() < 0.7) popAt(s, i);
      const from = Math.floor(rng() * sheetSize(s));
      let expected = -1;
      for (let k = 1; k <= sheetSize(s); k++) {
        const i = (from + k) % sheetSize(s);
        if (!s.popped[i]) { expected = i; break; }
      }
      expect(nextWhole(s, from)).toBe(expected);
    }
    const s = makeSheet('large', 1);
    for (let i = 0; i < sheetSize(s); i++) popAt(s, i);
    expect(nextWhole(s, 3)).toBe(-1);
    const t = makeSheet('large', 1);
    expect(nextWhole(t, -1)).toBe(0);
    expect(nextWhole(t, 34)).toBe(0);
  });
});

describe('safe flashing: at most three flashes in any second', () => {
  it('lets through exactly three a second when asked every 10 ms', () => {
    const lim = makeFlashLimiter();
    const allowed: number[] = [];
    for (let t = 0; t < 10000; t += 10) if (lim.allow(t)) allowed.push(t);
    expect(allowed).toHaveLength(30);
    expect(allowed.slice(0, 4)).toEqual([0, 10, 20, 1000]);
  });
  it('no window of a second holds a fourth flash, whatever the timing (random and bursty clocks)', () => {
    const rng = mulberry32(99);
    for (let round = 0; round < 400; round++) {
      const lim = makeFlashLimiter();
      const allowed: number[] = [];
      let t = Math.floor(rng() * 5000);
      for (let n = 0; n < 400; n++) {
        t += rng() < 0.3 ? Math.floor(rng() * 5) : Math.floor(rng() * 400);
        if (lim.allow(t)) allowed.push(t);
      }
      for (let i = 0; i + 3 < allowed.length; i++) expect(allowed[i + 3] - allowed[i], `round ${round}`).toBeGreaterThanOrEqual(1000);
      // And no sliding window of 1000 ms holds more than three.
      for (const a of allowed) expect(allowed.filter((b) => b >= a && b < a + 1000).length).toBeLessThanOrEqual(3);
    }
  });
  it('an idle clock lets the next flash through, and bad or backwards times never do', () => {
    const lim = makeFlashLimiter();
    expect(lim.allow(0)).toBe(true);
    expect(lim.allow(1)).toBe(true);
    expect(lim.allow(2)).toBe(true);
    expect(lim.allow(3)).toBe(false);
    expect(lim.allow(999)).toBe(false);
    expect(lim.allow(1000)).toBe(true);
    for (const bad of [NaN, undefined as unknown as number, 'x' as unknown as number]) expect(lim.allow(bad)).toBe(false);
    expect(lim.allow(500)).toBe(false);
    expect(lim.allow(5000)).toBe(true);
  });
  it('the sound limiter is looser but still bounded, and makeLimiter respects its own settings', () => {
    const lim = makeSoundLimiter();
    let n = 0;
    for (let t = 0; t < 1000; t++) if (lim.allow(t)) n++;
    expect(n).toBe(14);
    const two = makeLimiter(2, 500);
    expect([0, 100, 200, 500, 600, 700].map((t) => two.allow(t))).toEqual([true, true, false, true, true, false]);
    const odd = makeLimiter(NaN, NaN);
    expect(odd.allow(0)).toBe(true);
    expect(odd.allow(1)).toBe(false);
  });
});

describe('sounds', () => {
  it('a pop is a short, quiet, falling tone with its own note per pitch', () => {
    const freqs = new Set<number>();
    for (let p = 0; p < PITCHES; p++) {
      const t = popTone(p);
      expect(t.ms).toBeLessThanOrEqual(100);
      expect(t.gain).toBeGreaterThan(0);
      expect(t.gain).toBeLessThanOrEqual(0.15);
      expect(t.to).toBeLessThan(t.from);
      expect(t.to).toBeGreaterThan(20);
      freqs.add(t.from);
    }
    expect(freqs.size).toBe(PITCHES);
    for (const bad of [NaN, -3, 99, Infinity, undefined as unknown as number]) {
      const t = popTone(bad);
      expect(Number.isFinite(t.from) && t.from > 0).toBe(true);
    }
  });
  it('the sheet-done chime is three short soft notes, rising', () => {
    const t = doneTones();
    expect(t).toHaveLength(3);
    expect(t[1].from).toBeGreaterThan(t[0].from);
    expect(t[2].from).toBeGreaterThan(t[1].from);
    for (const x of t) { expect(x.gain).toBeLessThanOrEqual(0.15); expect(x.ms).toBeLessThanOrEqual(300); }
  });
});

describe('words', () => {
  it('say the right thing with right plurals', () => {
    expect(plural(1, 'bubble')).toBe('1 bubble');
    expect(plural(2, 'bubble')).toBe('2 bubbles');
    const s = makeSheet('large', 1);
    expect(bubbleLabel(s, 0)).toBe('Row 1, column 1, whole');
    popAt(s, 7);
    expect(bubbleLabel(s, 7)).toBe('Row 2, column 3, popped');
    expect(bubbleLabel(s, 999)).toBe('Bubble');
    expect(popMessage(s)).toBe('Pop! 34 bubbles left.');
    for (let i = 0; i < 33; i++) popAt(s, nextWhole(s, 0));
    expect(remaining(s)).toBe(1);
    expect(popMessage(s)).toBe('Pop! 1 bubble left.');
    popAt(s, nextWhole(s, 0));
    expect(popMessage(s)).toBe('Pop! That was the last one.');
    expect(sheetDoneMessage(1)).toBe('You popped every bubble on the sheet. 1 sheet finished. A fresh sheet is on its way.');
    expect(sheetDoneMessage(3)).toMatch(/3 sheets finished/);
    expect(sheetDoneMessage(NaN)).toMatch(/1 sheet finished/);
  });
  it('milestones come at the halfway mark and at five left, and nowhere else', () => {
    const s = makeSheet('medium', 1);
    const said: string[] = [];
    for (let i = 0; i < sheetSize(s); i++) { popAt(s, i); const m = milestone(s); if (m) said.push(`${s.count}:${m}`); }
    expect(said).toEqual(['27:Halfway there.', '49:Five left.']);
    const odd = makeSheet('large', 1); // 35 bubbles: no exact half
    let any = '';
    for (let i = 0; i < sheetSize(odd); i++) { popAt(odd, i); const m = milestone(odd); if (m && m !== 'Five left.') any = m; }
    expect(any).toBe('');
  });
  it('the copy line reads right with nothing, bubbles only, and sheets', () => {
    expect(shareLine(0, 0)).toBe('Bubble Wrap: no bubbles popped yet');
    expect(shareLine(1, 0)).toBe('Bubble Wrap: 1 bubble popped');
    expect(shareLine(124, 1)).toBe('Bubble Wrap: 124 bubbles popped, 1 sheet finished');
    expect(shareLine(300, 2)).toBe('Bubble Wrap: 300 bubbles popped, 2 sheets finished');
    for (const t of [shareLine(NaN, NaN), shareLine(-5, Infinity)]) {
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(t.includes(EM_DASH)).toBe(false);
    }
  });
});

describe('what is saved: two running totals', () => {
  it('reads good data and ignores junk', () => {
    expect(sanitiseStored(JSON.stringify({ popped: 120, sheets: 3 }))).toEqual({ popped: 120, sheets: 3 });
    expect(sanitiseStored({ popped: 7 })).toEqual({ popped: 7, sheets: 0 });
    for (const bad of ['', 'not json', '[]', '"x"', 'null', null, undefined, 5, true, [], [1, 2], '{"popped":-1}', '{"popped":1.5}', '{"popped":"9"}', '{"popped":1e9}', '{"popped":null,"sheets":NaN}']) {
      expect(sanitiseStored(bad as unknown)).toEqual(emptyStored());
    }
    expect(sanitiseStored({ popped: 1000000, sheets: 9999 })).toEqual({ popped: 0, sheets: 9999 });
  });
  it('is not fooled by __proto__ and extra keys, and returns a fresh object', () => {
    const evil = JSON.parse('{"__proto__":{"popped":99},"constructor":{"x":1},"popped":4,"extra":123}');
    const out = sanitiseStored(evil);
    expect(out).toEqual({ popped: 4, sheets: 0 });
    expect(Object.keys(out).sort()).toEqual(['popped', 'sheets']);
    expect(({} as Record<string, unknown>).popped).toBeUndefined();
    const input = { popped: 5, sheets: 6 };
    expect(sanitiseStored(input)).not.toBe(input);
  });
  it('adds to the totals, stops at the caps and round-trips', () => {
    expect(addTotals(emptyStored(), 10, 1)).toEqual({ popped: 10, sheets: 1 });
    expect(addTotals({ popped: 999990, sheets: 9999 }, 50, 5)).toEqual({ popped: 999999, sheets: 9999 });
    expect(addTotals({ popped: 5, sheets: 1 }, NaN, -4)).toEqual({ popped: 5, sheets: 1 });
    expect(addTotals({ popped: -5, sheets: 'x' } as unknown as { popped: number; sheets: number }, 3, 0)).toEqual({ popped: 3, sheets: 0 });
    expect(sanitiseStored(JSON.stringify(toStorable({ popped: 3, sheets: 2 })))).toEqual({ popped: 3, sheets: 2 });
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/bubble-wrap', f), 'utf8');
  it('no Math.random anywhere in the game', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
  });
  it('the buttons are at least 56 px (3.5rem) tall and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.bwr-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/#bwr-app \.bwr-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('sound starts off, nothing animates in a loop, and the light ring goes through the flash limiter', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/let soundOn = false;/);
    expect(text).not.toMatch(/infinite/);
    expect(text).toMatch(/makeFlashLimiter\(\)/);
    expect(text).toMatch(/flash\.allow\(/);
  });
});
