/**
 * games-tower-stack.test.ts - the engine behind `tower-stack`.
 *
 * Pinned: every number the guide page quotes (field, block widths, the perfect window of 1.5
 * units, the 2 unit regrowth, the speeds); that the sliding block is a triangle wave that never
 * leaves the field and never jumps; that a drop keeps exactly the overlap with the block below
 * (checked against an independent whole-unit set oracle) and cuts exactly the rest; the perfect
 * window edge on both sides; that a perfect drop grows the block back but never past the start
 * width; that a miss ends the game and nothing happens after; the same seed and the same drops
 * give the same tower; thousands of random games keep every invariant; that perfect play can
 * go on for hundreds of floors; the words, tones and share line; and that what comes out of
 * localStorage is sanitised before the page sees it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FIELD_W, START_W, PERFECT, GROW, MIN_OVERLAP, BASE_SPEED, SPEED_STEP, MAX_SPEED, CALM_FACTOR, MAX_DT, HUE_COUNT, MAX_SCORE, PEAK_GAIN,
  newGame, blockX, speedOf, advance, drop, floorsOf, scoreOf, movingHue, rangeOf, plural, dropMessage, overText, shareLine, toneFor,
  cleanScore, emptyStored, sanitiseStored, toStorable, bestFor, recordScore, mulberry32,
  type Game,
} from '../src/components/apps-private/tower-stack/helpers';

const EM_DASH = String.fromCharCode(0x2014);

/** Put the sliding block at an exact left edge (it must lie inside the range). */
const placeAt = (g: Game, x: number): void => { g.phase = x; };

describe('constants quoted on the guide page', () => {
  it('match the spec', () => {
    expect(FIELD_W).toBe(100);
    expect(START_W).toBe(50);
    expect(PERFECT).toBe(1.5);
    expect(GROW).toBe(2);
    expect(MIN_OVERLAP).toBe(1);
    expect(BASE_SPEED).toBe(26);
    expect(SPEED_STEP).toBe(0.5);
    expect(MAX_SPEED).toBe(60);
    expect(CALM_FACTOR).toBe(0.5);
    expect(MAX_DT).toBe(0.05);
    expect(HUE_COUNT).toBe(6);
    expect(MAX_SCORE).toBe(9999);
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
  });
});

describe('a new game', () => {
  it('has a centred base block, no score and a block ready to slide', () => {
    const g = newGame(7);
    expect(g.layers).toHaveLength(1);
    expect(g.layers[0]).toMatchObject({ x: 25, w: 50, perfect: false });
    expect(g.width).toBe(50);
    expect(floorsOf(g)).toBe(0);
    expect(scoreOf(g)).toBe(0);
    expect(g.over).toBe(false);
    expect(g.combo).toBe(0);
    expect(blockX(g)).toBe(0);
  });
  it('the seed only picks the first colour, and floors cycle through all six', () => {
    for (let s = 0; s < 24; s++) {
      const g = newGame(s);
      expect(g.layers[0].hue).toBe(s % 6);
      expect(movingHue(g)).toBe((s + 1) % 6);
    }
    const g = newGame(0);
    const seen = new Set<number>();
    for (let i = 0; i < 12; i++) { placeAt(g, g.layers[g.layers.length - 1].x); drop(g); }
    for (const l of g.layers) seen.add(l.hue);
    expect(seen.size).toBe(6);
    g.layers.forEach((l, i) => expect(l.hue).toBe(i % 6));
  });
  it('is the same for the same seed and different seeds only change the colour', () => {
    expect(JSON.stringify(newGame(99))).toBe(JSON.stringify(newGame(99)));
    for (const bad of [NaN, Infinity, -5, 1.7, 2 ** 40]) {
      const g = newGame(bad);
      expect(g.layers[0].hue).toBeGreaterThanOrEqual(0);
      expect(g.layers[0].hue).toBeLessThan(6);
    }
  });
});

describe('the sliding block', () => {
  it('is a triangle wave: stays inside the field, reaches both ends and never jumps', () => {
    const g = newGame(1);
    const range = rangeOf(g);
    let lo = Infinity;
    let hi = -Infinity;
    let prev = blockX(g);
    for (let i = 0; i < 4000; i++) {
      advance(g, 0.02);
      const x = blockX(g);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + g.width).toBeLessThanOrEqual(FIELD_W + 1e-9);
      expect(Math.abs(x - prev)).toBeLessThanOrEqual(speedOf(g) * 0.02 + 1e-9);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
      prev = x;
    }
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(range - 0.5);
  });
  it('moves at exactly the speed for the floor, with no time passing for a bad number', () => {
    const g = newGame(1);
    const before = g.phase;
    advance(g, 0.04);
    expect(g.phase - before).toBeCloseTo(BASE_SPEED * 0.04, 9);
    const p = g.phase;
    for (const bad of [NaN, -1, Infinity, undefined as unknown as number, 'x' as unknown as number]) advance(g, bad);
    expect(g.phase).toBeGreaterThanOrEqual(p);
    expect(g.phase - p).toBeLessThanOrEqual(MAX_DT * BASE_SPEED + 1e-9);
    const h = newGame(1);
    advance(h, 100);
    expect(h.phase).toBeCloseTo(BASE_SPEED * MAX_DT, 9);
  });
  it('speeds up by half a unit a second per floor to a top speed of 60, and calm is half of that', () => {
    const g = newGame(1);
    expect(speedOf(g)).toBe(26);
    const f = (n: number): Game => { const q = newGame(1); q.layers.length = 1; for (let i = 0; i < n; i++) q.layers.push({ x: 25, w: 50, hue: 0, perfect: false }); return q; };
    expect(speedOf(f(10))).toBe(31);
    expect(speedOf(f(68))).toBe(60);
    expect(speedOf(f(500))).toBe(60);
    const c = newGame(1, true);
    expect(speedOf(c)).toBe(13);
    expect(speedOf(Object.assign(f(500), { calm: true }))).toBe(30);
  });
  it('enters from alternating sides', () => {
    const g = newGame(1);
    placeAt(g, 25);
    drop(g);
    expect(blockX(g)).toBeCloseTo(rangeOf(g), 9);
    placeAt(g, g.layers[g.layers.length - 1].x);
    drop(g);
    expect(blockX(g)).toBe(0);
  });
});

describe('dropping', () => {
  it('keeps exactly the overlap and cuts exactly the rest (whole-unit set oracle)', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 600; i++) {
      const g = newGame(i);
      const top = g.layers[0];
      const x = Math.floor(rng() * (FIELD_W - g.width + 1));
      placeAt(g, x);
      const cells = (a: number, w: number): Set<number> => new Set(Array.from({ length: w }, (_, k) => a + k));
      const inter = [...cells(x, g.width)].filter((c) => cells(top.x, top.w).has(c));
      const res = drop(g);
      if (Math.abs(x - top.x) <= PERFECT) {
        expect(res.kind).toBe('perfect');
        continue;
      }
      if (inter.length < MIN_OVERLAP) {
        expect(res.kind).toBe('miss');
        continue;
      }
      expect(res.kind).toBe('trim');
      expect(res.layer!.w).toBe(inter.length);
      expect(res.layer!.x).toBe(Math.min(...inter));
      expect(res.cut!.w + res.layer!.w).toBe(50);
      const cutCells = cells(res.cut!.x, res.cut!.w);
      for (const c of cutCells) expect(inter.includes(c)).toBe(false);
      expect(res.cut!.side).toBe(x < top.x ? 'left' : 'right');
    }
  });
  it('treats 1.5 units as perfect and a hair more as a trim, on both sides', () => {
    for (const dir of [-1, 1]) {
      const a = newGame(1);
      placeAt(a, 25 + dir * PERFECT);
      expect(drop(a).kind).toBe('perfect');
      const b = newGame(1);
      placeAt(b, 25 + dir * (PERFECT + 0.01));
      expect(drop(b).kind).toBe('trim');
    }
    const z = newGame(1);
    placeAt(z, 25);
    expect(drop(z).kind).toBe('perfect');
  });
  it('a perfect drop on the full width block keeps it 50 wide and lined up with the block below', () => {
    const g = newGame(1);
    placeAt(g, 25.9);
    const res = drop(g);
    expect(res.kind).toBe('perfect');
    expect(res.cut).toBeNull();
    expect(res.layer).toMatchObject({ x: 25, w: 50, perfect: true });
    expect(g.combo).toBe(1);
    expect(g.perfects).toBe(1);
    expect(floorsOf(g)).toBe(1);
  });
  it('a trimmed block is narrower, and a perfect drop gives 2 units back up to 50', () => {
    const g = newGame(1);
    placeAt(g, 35);
    expect(drop(g)).toMatchObject({ kind: 'trim' });
    expect(g.width).toBe(40);
    expect(g.layers[1]).toMatchObject({ x: 35, w: 40 });
    placeAt(g, 35);
    const res = drop(g);
    expect(res.kind).toBe('perfect');
    expect(g.width).toBe(42);
    expect(res.layer!.x).toBe(34);
    expect(res.layer!.w).toBe(42);
    for (let i = 0; i < 20; i++) { placeAt(g, g.layers[g.layers.length - 1].x); drop(g); }
    expect(g.width).toBe(START_W);
    for (const l of g.layers) expect(l.w).toBeLessThanOrEqual(START_W);
  });
  it('a perfect drop never grows a block off the edge of the field', () => {
    const g = newGame(1);
    placeAt(g, 0);
    expect(drop(g).kind).toBe('trim'); // 25 off: overlap 25 at x 25
    // narrow block at the left edge of the field
    const h = newGame(1);
    h.layers[0] = { x: 0, w: 20, hue: 0, perfect: false };
    h.width = 20;
    placeAt(h, 0);
    const r = drop(h);
    expect(r.kind).toBe('perfect');
    expect(r.layer!.x).toBeGreaterThanOrEqual(0);
    expect(r.layer!.x + r.layer!.w).toBeLessThanOrEqual(FIELD_W);
    const k = newGame(1);
    k.layers[0] = { x: 80, w: 20, hue: 0, perfect: false };
    k.width = 20;
    placeAt(k, 80);
    const r2 = drop(k);
    expect(r2.layer!.x + r2.layer!.w).toBeLessThanOrEqual(FIELD_W);
  });
  it('a miss (overlap under 1 unit) ends the game and the cut is the whole block', () => {
    const g = newGame(1);
    placeAt(g, 0);
    expect(drop(g).kind).toBe('trim'); // overlap 25, fine
    const h = newGame(1);
    h.layers[0] = { x: 70, w: 30, hue: 0, perfect: false };
    h.width = 30;
    placeAt(h, 0);
    const res = drop(h);
    expect(res.kind).toBe('miss');
    expect(res.layer).toBeNull();
    expect(res.cut).toMatchObject({ x: 0, w: 30, side: 'left' });
    expect(h.over).toBe(true);
    expect(h.combo).toBe(0);
    expect(floorsOf(h)).toBe(0);
    // just under and just over the minimum overlap: overlap = (x + 30) - 70
    for (const [x, kind] of [[40.5, 'miss'], [41, 'trim']] as const) {
      const q = newGame(1);
      q.layers[0] = { x: 70, w: 30, hue: 0, perfect: false };
      q.width = 30;
      placeAt(q, x);
      expect(drop(q).kind).toBe(kind);
    }
  });
  it('does nothing after the game is over', () => {
    const g = newGame(1);
    g.over = true;
    const before = JSON.stringify(g);
    expect(drop(g)).toEqual({ kind: 'none', layer: null, cut: null });
    advance(g, 0.04);
    expect(JSON.stringify(g)).toBe(before);
  });
  it('a perfect run is counted, and a trim ends it', () => {
    const g = newGame(1);
    for (let i = 0; i < 5; i++) { placeAt(g, g.layers[g.layers.length - 1].x); drop(g); }
    expect(g.combo).toBe(5);
    expect(g.bestCombo).toBe(5);
    placeAt(g, g.layers[g.layers.length - 1].x + 10);
    drop(g);
    expect(g.combo).toBe(0);
    expect(g.bestCombo).toBe(5);
    expect(g.perfects).toBe(5);
  });
});

describe('whole games', () => {
  it('perfect play goes on for hundreds of floors and the block stays 50 wide', () => {
    const g = newGame(3);
    for (let i = 0; i < 400; i++) {
      // wait until the sliding block is within the perfect window, as a player with great timing would
      const top = g.layers[g.layers.length - 1];
      let guard = 0;
      while (Math.abs(blockX(g) - top.x) > PERFECT && guard++ < 100000) advance(g, 1 / 240);
      expect(guard).toBeLessThan(100000);
      expect(drop(g).kind).toBe('perfect');
    }
    expect(floorsOf(g)).toBe(400);
    expect(g.width).toBe(50);
    expect(g.over).toBe(false);
  });
  it('random players never break an invariant over thousands of games', () => {
    const rng = mulberry32(2024);
    for (let n = 0; n < 3000; n++) {
      const g = newGame(Math.floor(rng() * 1e9), rng() < 0.3);
      let prevW = g.width;
      for (let step = 0; step < 80 && !g.over; step++) {
        const t = Math.floor(rng() * 90);
        for (let k = 0; k < t; k++) advance(g, rng() * 0.06);
        const x = blockX(g);
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(x + g.width).toBeLessThanOrEqual(FIELD_W + 1e-9);
        const res = drop(g);
        if (res.kind === 'trim') expect(g.width).toBeLessThan(prevW);
        if (res.kind === 'perfect') expect(g.width).toBeLessThanOrEqual(Math.min(START_W, prevW + GROW) + 1e-9);
        prevW = g.width;
        for (const l of g.layers) {
          expect(l.w).toBeGreaterThanOrEqual(MIN_OVERLAP - 1e-9);
          expect(l.w).toBeLessThanOrEqual(START_W + 1e-9);
          expect(l.x).toBeGreaterThanOrEqual(-1e-9);
          expect(l.x + l.w).toBeLessThanOrEqual(FIELD_W + 1e-9);
        }
        expect(g.width).toBe(g.layers[g.layers.length - 1].w);
        expect(floorsOf(g)).toBe(g.layers.length - 1);
        if (res.kind === 'miss') expect(g.over).toBe(true);
      }
    }
  }, 60_000);
  it('the same seed and the same drops give the same tower', () => {
    const play = (): string => {
      const rng = mulberry32(77);
      const g = newGame(5);
      for (let i = 0; i < 40 && !g.over; i++) {
        for (let k = 0; k < Math.floor(rng() * 60); k++) advance(g, 0.016);
        drop(g);
      }
      return JSON.stringify(g);
    };
    expect(play()).toBe(play());
  });
  it('a player who never waits runs out of tower within a few drops', () => {
    const g = newGame(2);
    let drops = 0;
    while (!g.over && drops < 50) {
      drop(g);
      drops += 1;
    }
    expect(g.over).toBe(true);
    expect(drops).toBeLessThanOrEqual(4);
  });
});

describe('words, tones and the copy line', () => {
  it('say the right thing in every state with right plurals', () => {
    expect(plural(1, 'floor')).toBe('1 floor');
    expect(plural(2, 'floor')).toBe('2 floors');
    const g = newGame(1);
    placeAt(g, 25);
    expect(dropMessage(g, drop(g))).toBe('Perfect! 1 floor high, block back to 50 wide.');
    placeAt(g, 25);
    expect(dropMessage(g, drop(g))).toBe('Perfect! 2 perfect drops in a row. 2 floors high, block back to 50 wide.');
    placeAt(g, 35);
    expect(dropMessage(g, drop(g))).toBe('Trimmed to 40 wide. 3 floors high.');
    const h = newGame(1);
    h.layers[0] = { x: 70, w: 30, hue: 0, perfect: false };
    h.width = 30;
    placeAt(h, 0);
    expect(dropMessage(h, drop(h))).toMatch(/missed the tower\. You built 0 floors\./);
    expect(dropMessage(g, { kind: 'none', layer: null, cut: null })).toBe('');
    expect(overText(g, false)).toBe('Your tower is 3 floors high with 2 perfect drops.');
    expect(overText(newGame(1), true)).toBe('Your tower is 0 floors high with no perfect drops. That is a new best!');
  });
  it('the copy line is right with nothing, one and many, and never shows NaN', () => {
    expect(shareLine(0, 0, false)).toBe('Tower Stack: no floors built yet');
    expect(shareLine(1, 1, false)).toBe('Tower Stack: 1 floor high, 1 perfect drop');
    expect(shareLine(23, 4, true)).toBe('Tower Stack (calm speed): 23 floors high, 4 perfect drops');
    for (const t of [shareLine(NaN, NaN, false), shareLine(-4, Infinity, true)]) {
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(t.includes(EM_DASH)).toBe(false);
    }
  });
  it('tones are short and quiet, and every kind has a sound except none', () => {
    for (const kind of ['perfect', 'trim', 'miss'] as const) {
      for (let c = 0; c <= 45; c++) {
        const tones = toneFor(kind, c);
        expect(tones.length).toBeGreaterThan(0);
        for (const t of tones) {
          expect(t.gain).toBeLessThanOrEqual(0.15);
          expect(t.gain).toBeGreaterThan(0);
          expect(t.ms).toBeLessThanOrEqual(300);
          expect(t.freq).toBeGreaterThan(100);
          expect(t.freq).toBeLessThan(3000);
        }
      }
    }
    expect(toneFor('none', 3)).toEqual([]);
    expect(toneFor('perfect', NaN)).toHaveLength(1);
    // a run climbs: the fifth perfect drop is higher than the first
    expect(toneFor('perfect', 5)[0].freq).toBeGreaterThan(toneFor('perfect', 1)[0].freq);
  });
});

describe('what is saved: the best height in each speed', () => {
  it('reads good data and ignores junk', () => {
    expect(sanitiseStored(JSON.stringify({ best: 12, bestCalm: 7 }))).toEqual({ best: 12, bestCalm: 7 });
    expect(sanitiseStored({ best: 3 })).toEqual({ best: 3, bestCalm: 0 });
    for (const bad of ['', 'not json', '[]', '"x"', 'null', null, undefined, 5, true, [], [1, 2], '{"best":-1}', '{"best":1.5}', '{"best":"9"}', '{"best":1e9}', '{"best":null,"bestCalm":NaN}']) {
      expect(sanitiseStored(bad as unknown)).toEqual(emptyStored());
    }
    expect(sanitiseStored({ best: 10001, bestCalm: 9999 })).toEqual({ best: 0, bestCalm: 9999 });
  });
  it('is not fooled by __proto__ and extra keys, and returns a fresh object', () => {
    const evil = JSON.parse('{"__proto__":{"best":99},"constructor":{"x":1},"best":4,"extra":123}');
    const out = sanitiseStored(evil);
    expect(out).toEqual({ best: 4, bestCalm: 0 });
    expect(Object.keys(out).sort()).toEqual(['best', 'bestCalm']);
    expect(({} as Record<string, unknown>).best).toBeUndefined();
    const input = { best: 5, bestCalm: 6 };
    expect(sanitiseStored(input)).not.toBe(input);
  });
  it('cleanScore accepts whole numbers from 1 to 9999 only', () => {
    expect(cleanScore(1)).toBe(1);
    expect(cleanScore(9999)).toBe(9999);
    for (const bad of [0, -1, 0.5, 10000, NaN, Infinity, '5', null, undefined, {}, []]) expect(cleanScore(bad)).toBeNull();
  });
  it('records a better score and keeps the two speeds apart', () => {
    let s = emptyStored();
    let r = recordScore(s, 10, false);
    expect(r.newBest).toBe(true);
    s = r.stored;
    expect(s).toEqual({ best: 10, bestCalm: 0 });
    r = recordScore(s, 8, false);
    expect(r.newBest).toBe(false);
    expect(r.stored.best).toBe(10);
    r = recordScore(s, 4, true);
    expect(r.stored).toEqual({ best: 10, bestCalm: 4 });
    expect(bestFor(r.stored, true)).toBe(4);
    expect(bestFor(r.stored, false)).toBe(10);
    r = recordScore(s, 0, false);
    expect(r.newBest).toBe(false);
    expect(recordScore(s, 1e9, false).stored.best).toBe(9999);
    expect(recordScore(s, NaN, false).stored.best).toBe(10);
    expect(sanitiseStored(JSON.stringify(toStorable({ best: 3, bestCalm: 2 })))).toEqual({ best: 3, bestCalm: 2 });
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/tower-stack', f), 'utf8');
  it('no Math.random anywhere in the game', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
  });
  it('the main buttons are at least 56 px (3.5rem) tall and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.tsk-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/#tsk-app \.tsk-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('sound starts off and the audio is only made after the sound button', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/let soundOn = false;/);
    expect(text).toMatch(/aria-pressed="false"/);
  });
});
