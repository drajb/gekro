/**
 * games-colour-mixer.test.ts - the engine behind `colour-mixer`.
 *
 * Pinned: the colour maths (OKLCH conversions against published reference values and a round
 * trip); that the built-in fallback paints match the site's locked tokens; the mixing model
 * (a single paint comes out unchanged, order and scale do not matter, two paints blend along
 * the short arc of hues and get steadily closer to the paint that is added, three paints give a
 * dull dark brown); the table of 18 colour names (the named results orange, green, purple and
 * brown, every recipe from 0 to 8 drops gets a name, and each name agrees with the hue the
 * model actually produces); the challenge (pools of 4, 10 and 88 targets, every target reachable
 * exactly, the targets of the easier levels far enough apart that no two overlap, determinism by
 * seed, star and closeness boundaries) and a hint that provably arrives from every start; the
 * colour-string parser; and the saved progress. The numbers quoted on the guide page are
 * asserted here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_DROPS, ROUND_COUNT, DARKEN, MUD_TRIPLE, PRIMARY_NAMES, FALLBACK_PRIMARIES, mulberry32,
  srgbToOklch, oklchToSrgb, deltaE, cssOklch, parseCssColour, totalDrops, cleanDrops, mixDrops,
  NAMES, NAME_RECIPES, nameMix, nameIndex,
  LEVELS, LEVEL_LABEL, TOLERANCE, TARGET_POOLS, makeTarget, roundTargets, sameShares, starsFor, closeness, hintFor, hintText,
  FOUND_MAX, STARS_MAX, emptyStore, sanitiseStore, markFound, foundCount, plural, recipeText, shareLine,
  type Drops, type Oklch, type Level,
} from '../src/components/apps-private/colour-mixer/helpers';

/** The three locked accent tokens, read straight from the site stylesheet. */
const css = readFileSync(join(__dirname, '..', 'src/styles/global.css'), 'utf8');
const tokenHex = (name: string): string => {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token ${name} not found`);
  return m[1];
};
const hexToOklch = (hex: string): Oklch =>
  srgbToOklch(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
/** Rose, amber and sky blue: danger, warm and accent. */
const P: Oklch[] = [hexToOklch(tokenHex('--color-accent-danger')), hexToOklch(tokenHex('--color-accent-warm')), hexToOklch(tokenHex('--color-accent'))];

const circ = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
const allRecipes = (): Drops[] => {
  const out: Drops[] = [];
  for (let r = 0; r <= MAX_DROPS; r++) for (let a = 0; a <= MAX_DROPS; a++) for (let s = 0; s <= MAX_DROPS; s++) if (r + a + s > 0) out.push([r, a, s]);
  return out;
};
const mix = (d: readonly number[], primaries: readonly Oklch[] = P): Oklch => mixDrops(d, primaries) as Oklch;

describe('constants', () => {
  it('has the documented limits', () => {
    expect(MAX_DROPS).toBe(8);
    expect(ROUND_COUNT).toBe(5);
    expect(DARKEN).toBe(0.5);
    expect(MUD_TRIPLE).toBe(0.55);
    expect([...PRIMARY_NAMES]).toEqual(['Rose', 'Amber', 'Sky blue']);
    expect(NAMES.length).toBe(18);
    expect(new Set(NAMES).size).toBe(18);
    expect(allRecipes().length).toBe(9 * 9 * 9 - 1); // 728 recipes
  });
});

describe('colour maths', () => {
  it('matches published OKLCH reference values for white, black, red, green and blue', () => {
    const w = srgbToOklch(255, 255, 255);
    expect(w.L).toBeCloseTo(1, 4);
    expect(w.C).toBeLessThan(1e-3);
    const k = srgbToOklch(0, 0, 0);
    expect(k.L).toBeCloseTo(0, 6);
    expect(k.C).toBeLessThan(1e-6);
    const red = srgbToOklch(255, 0, 0);
    expect(red.L).toBeCloseTo(0.628, 3);
    expect(red.C).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    const green = srgbToOklch(0, 255, 0);
    expect(green.L).toBeCloseTo(0.8664, 3);
    expect(green.C).toBeCloseTo(0.2948, 3);
    expect(green.h).toBeCloseTo(142.5, 0);
    const blue = srgbToOklch(0, 0, 255);
    expect(blue.L).toBeCloseTo(0.452, 3);
    expect(blue.C).toBeCloseTo(0.3132, 3);
    expect(blue.h).toBeCloseTo(264.05, 1);
  });
  it('round trips random sRGB colours through OKLCH', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 500; t++) {
      const [r, g, b] = [Math.floor(rng() * 256), Math.floor(rng() * 256), Math.floor(rng() * 256)];
      const back = oklchToSrgb(srgbToOklch(r, g, b));
      expect(back.r * 255).toBeCloseTo(r, 3);
      expect(back.g * 255).toBeCloseTo(g, 3);
      expect(back.b * 255).toBeCloseTo(b, 3);
      expect(back.inGamut).toBe(true);
    }
  });
  it('flags a colour outside the sRGB gamut and clips it into range', () => {
    const wild = oklchToSrgb({ L: 0.7, C: 0.37, h: 150 });
    expect(wild.inGamut).toBe(false);
    for (const v of [wild.r, wild.g, wild.b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('deltaE is zero for the same colour, symmetric, and the straight-line distance in OKLab', () => {
    const rng = mulberry32(8);
    const rand = (): Oklch => ({ L: rng(), C: rng() * 0.3, h: rng() * 360 });
    const ab = (c: Oklch) => [c.C * Math.cos((c.h * Math.PI) / 180), c.C * Math.sin((c.h * Math.PI) / 180)];
    for (let t = 0; t < 200; t++) {
      const x = rand();
      const y = rand();
      const z = rand();
      expect(deltaE(x, x)).toBe(0);
      expect(deltaE(x, y)).toBeCloseTo(deltaE(y, x), 12);
      const [xa, xb] = ab(x);
      const [ya, yb] = ab(y);
      expect(deltaE(x, y)).toBeCloseTo(Math.sqrt((x.L - y.L) ** 2 + (xa - ya) ** 2 + (xb - yb) ** 2), 12);
      expect(deltaE(x, z)).toBeLessThanOrEqual(deltaE(x, y) + deltaE(y, z) + 1e-12);
    }
  });
  it('writes a CSS oklch() string with a fixed shape and safe ranges', () => {
    expect(cssOklch({ L: 0.6491, C: 0.161, h: 53 })).toBe('oklch(64.91% 0.1610 53.00)');
    expect(cssOklch({ L: 1.5, C: -1, h: 400 })).toBe('oklch(100.00% 0.0000 40.00)');
    expect(cssOklch({ L: -1, C: 0.1, h: -90 })).toBe('oklch(0.00% 0.1000 270.00)');
  });
});

describe('the built-in fallback paints', () => {
  it('match the locked colour tokens in the site stylesheet', () => {
    FALLBACK_PRIMARIES.forEach((f, i) => {
      expect(f.L).toBeCloseTo(P[i].L, 3);
      expect(f.C).toBeCloseTo(P[i].C, 3);
      expect(circ(f.h, P[i].h)).toBeLessThan(0.1);
    });
  });
  it('rose is reddish, amber yellowish, sky blue blueish', () => {
    expect(P[0].h).toBeGreaterThan(10);
    expect(P[0].h).toBeLessThan(35);
    expect(P[1].h).toBeGreaterThan(75);
    expect(P[1].h).toBeLessThan(95);
    expect(P[2].h).toBeGreaterThan(220);
    expect(P[2].h).toBeLessThan(245);
  });
});

describe('colour string parser', () => {
  it('reads the forms a browser reports', () => {
    expect(parseCssColour('rgb(56, 189, 248)')).toEqual([56, 189, 248]);
    expect(parseCssColour('rgb(56 189 248)')).toEqual([56, 189, 248]);
    expect(parseCssColour('rgba(56, 189, 248, 1)')).toEqual([56, 189, 248]);
    expect(parseCssColour('rgb(56 189 248 / 50%)')).toEqual([56, 189, 248]);
    expect(parseCssColour('  rgb(0, 0, 0)  ')).toEqual([0, 0, 0]);
    const c = parseCssColour('color(srgb 1 0.5 0)') as number[];
    expect(c[0]).toBe(255);
    expect(c[1]).toBeCloseTo(127.5, 9);
    expect(c[2]).toBe(0);
  });
  it('refuses junk, out-of-range values and fully transparent colours', () => {
    for (const bad of ['', 'transparent', 'red', '#38bdf8', 'rgb(300, 0, 0)', 'rgb(-1, 0, 0)', 'rgb(1, 2)', 'rgba(1, 2, 3, 0)', 'rgb(1 2 3 / 0%)',
      'color(display-p3 1 0 0)', 'color(srgb 2 0 0)', 'oklch(0.5 0.1 50)', 'rgb(1, 2, 3', null, undefined, 5, {}, [], 'rgb(' + '1,'.repeat(100) + '1)']) {
      expect(parseCssColour(bad as unknown), String(bad).slice(0, 30)).toBeNull();
    }
  });
});

describe('drops', () => {
  it('cleanDrops makes whole numbers from 0 to 8 and turns junk into 0', () => {
    expect(cleanDrops([2, 3, 4])).toEqual([2, 3, 4]);
    expect(cleanDrops([1.6, -3, 99])).toEqual([2, 0, 8]);
    for (const bad of [null, undefined, 5, 'abc', {}, [], [NaN, Infinity, 'x'], [undefined, null, {}]]) expect(cleanDrops(bad as unknown)).toEqual([0, 0, 0]);
    expect(cleanDrops([1, 2])).toEqual([1, 2, 0]);
    expect(totalDrops([2, 3, 4])).toBe(9);
  });
  it('an empty dish has no colour and no name', () => {
    expect(mixDrops([0, 0, 0], P)).toBeNull();
    expect(mixDrops([NaN, 'x', null] as unknown as number[], P)).toBeNull();
    expect(nameMix([0, 0, 0])).toBeNull();
  });
});

describe('the mixing model', () => {
  it('a single paint comes out exactly as it went in, whatever the number of drops', () => {
    for (let i = 0; i < 3; i++) {
      for (let n = 1; n <= MAX_DROPS; n++) {
        const d: Drops = [0, 0, 0];
        d[i] = n;
        const m = mix(d);
        expect(m.L).toBeCloseTo(P[i].L, 12);
        expect(m.C).toBeCloseTo(P[i].C, 12);
        expect(circ(m.h, P[i].h)).toBeLessThan(1e-9);
      }
    }
  });
  it('only the shares matter: doubling or tripling every amount changes nothing', () => {
    for (const d of allRecipes()) {
      for (const k of [2, 3]) {
        const big = d.map((x) => x * k);
        if (big.some((x) => x > MAX_DROPS)) continue;
        const a = mix(d);
        const b = mix(big);
        expect(b.L).toBeCloseTo(a.L, 12);
        expect(b.C).toBeCloseTo(a.C, 12);
        expect(circ(a.h, b.h)).toBeLessThan(1e-9);
      }
    }
  });
  it('is symmetric: shuffling the paints together with their drops gives the same colour', () => {
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const d of allRecipes().filter((_, i) => i % 7 === 0)) {
      const base = mix(d);
      for (const p of perms) {
        const m = mixDrops(p.map((i) => d[i]), p.map((i) => P[i])) as Oklch;
        expect(m.L).toBeCloseTo(base.L, 12);
        expect(m.C).toBeCloseTo(base.C, 12);
        expect(circ(m.h, base.h)).toBeLessThan(1e-9);
      }
    }
  });
  it('every one of the 728 recipes gives a finite, sensible colour', () => {
    for (const d of allRecipes()) {
      const m = mix(d);
      expect(Number.isFinite(m.L) && Number.isFinite(m.C) && Number.isFinite(m.h), d.join()).toBe(true);
      expect(m.L).toBeGreaterThan(0.4);
      expect(m.L).toBeLessThanOrEqual(0.85);
      expect(m.C).toBeGreaterThan(0.04);
      expect(m.C).toBeLessThan(0.2);
      expect(m.h).toBeGreaterThanOrEqual(0);
      expect(m.h).toBeLessThan(360);
    }
  });
  it('two paints blend along the short arc of hues, steadily', () => {
    // [paint a, paint b, hue of a, hue of b]: for k drops of b and 8-k of a the hue moves from a to b one way round.
    for (const [ia, ib] of [[0, 1], [1, 2], [0, 2]]) {
      const ha = P[ia].h;
      const hb = P[ib].h;
      const arc = ((hb - ha + 540) % 360) - 180; // signed short way from a to b
      let last = -1;
      for (let k = 0; k <= MAX_DROPS; k++) {
        const d: Drops = [0, 0, 0];
        d[ia] = MAX_DROPS - k;
        d[ib] = k;
        const m = mix(d);
        const along = (((m.h - ha + 540) % 360) - 180) / arc; // 0 at a, 1 at b
        expect(along, `${ia}-${ib} k=${k}`).toBeGreaterThanOrEqual(-1e-9);
        expect(along).toBeLessThanOrEqual(1 + 1e-9);
        expect(along).toBeGreaterThan(last - 1e-9);
        last = along;
      }
      expect(last).toBeCloseTo(1, 9);
    }
  });
  it('adding more of a paint steadily turns the hue towards that paint', () => {
    for (const [ia, ib] of [[0, 1], [1, 0], [1, 2], [2, 1], [0, 2], [2, 0]]) {
      let last = Infinity;
      for (let k = 0; k <= MAX_DROPS; k++) {
        const d: Drops = [0, 0, 0];
        d[ia] = k;
        d[ib] = MAX_DROPS - k;
        const gap = circ(mix(d).h, P[ia].h);
        expect(gap, `${ia}<-${ib} k=${k}`).toBeLessThan(last);
        last = gap;
      }
      expect(last).toBeCloseTo(0, 9);
    }
  });
  it('seven drops of a paint with one of another look more like the first paint than the other way round', () => {
    for (const [ia, ib] of [[0, 1], [1, 0], [1, 2], [2, 1], [0, 2], [2, 0]]) {
      const mostlyA: Drops = [0, 0, 0];
      mostlyA[ia] = 7;
      mostlyA[ib] = 1;
      const mostlyB: Drops = [0, 0, 0];
      mostlyB[ia] = 1;
      mostlyB[ib] = 7;
      expect(deltaE(mix(mostlyA), P[ia])).toBeLessThan(deltaE(mix(mostlyB), P[ia]));
    }
  });
  it('mixing makes paint darker and duller: equal parts of two are darker than their average, all three much duller', () => {
    for (const [ia, ib] of [[0, 1], [1, 2], [0, 2]]) {
      const m = mix(ia === 0 && ib === 1 ? [1, 1, 0] : ia === 1 ? [0, 1, 1] : [1, 0, 1]);
      const avgL = (P[ia].L + P[ib].L) / 2;
      expect(m.L).toBeCloseTo(avgL - DARKEN * 0.25, 12); // spread is 1/2, squared 1/4
    }
    const brown = mix([1, 1, 1]);
    const avgC = (P[0].C + P[1].C + P[2].C) / 3;
    expect(brown.C).toBeLessThan(avgC * 0.5);
    expect(brown.L).toBeLessThan((P[0].L + P[1].L + P[2].L) / 3 - 0.15);
  });
  it('the three-way mix of equal parts is the one in the documented formula', () => {
    const w = 1 / 3;
    const spread = 1 - 3 * w * w;
    const x = P.reduce((s, p) => s + w * Math.cos((p.h * Math.PI) / 180), 0);
    const y = P.reduce((s, p) => s + w * Math.sin((p.h * Math.PI) / 180), 0);
    const R = Math.hypot(x, y);
    const expected: Oklch = {
      L: w * (P[0].L + P[1].L + P[2].L) - 0.5 * spread * spread,
      C: w * (P[0].C + P[1].C + P[2].C) * (0.8 + 0.2 * R) * (1 - 0.55 * 1),
      h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    };
    const m = mix([1, 1, 1]);
    expect(m.L).toBeCloseTo(expected.L, 12);
    expect(m.C).toBeCloseTo(expected.C, 12);
    expect(circ(m.h, expected.h)).toBeLessThan(1e-9);
  });
});

describe('names', () => {
  it('has the documented name for the classic mixes', () => {
    expect(nameMix([1, 0, 0])).toBe('Rose');
    expect(nameMix([0, 1, 0])).toBe('Amber');
    expect(nameMix([0, 0, 1])).toBe('Sky blue');
    expect(nameMix([1, 1, 0])).toBe('Orange');
    expect(nameMix([0, 1, 1])).toBe('Green');
    expect(nameMix([1, 0, 1])).toBe('Purple');
    expect(nameMix([1, 1, 1])).toBe('Brown');
  });
  it('pins the rest of the table', () => {
    expect(nameMix([2, 1, 0])).toBe('Coral');
    expect(nameMix([1, 2, 0])).toBe('Gold');
    expect(nameMix([0, 2, 1])).toBe('Lime');
    expect(nameMix([0, 1, 2])).toBe('Teal');
    expect(nameMix([2, 0, 1])).toBe('Magenta');
    expect(nameMix([1, 0, 2])).toBe('Blue');
    expect(nameMix([4, 1, 1])).toBe('Rust');
    expect(nameMix([1, 4, 1])).toBe('Ochre');
    expect(nameMix([1, 1, 4])).toBe('Slate');
    expect(nameMix([1, 2, 2])).toBe('Olive');
    expect(nameMix([2, 1, 2])).toBe('Plum');
  });
  it('a paint under a tenth of the drops is ignored (8 + 1 of a third paint is still a pair)', () => {
    expect(nameMix([8, 8, 1])).toBe('Orange');
    expect(nameMix([4, 4, 1])).toBe('Brown'); // 1 of 9 is over a tenth
    expect(nameMix([8, 0, 1])).toBe('Rose');
  });
  it('every recipe has a name, and every name can be made', () => {
    const seen = new Set<string>();
    for (const d of allRecipes()) {
      const n = nameMix(d);
      expect(n, d.join()).not.toBeNull();
      expect(nameIndex(n)).toBeGreaterThanOrEqual(0);
      seen.add(n as string);
    }
    expect([...seen].sort()).toEqual([...NAMES].sort());
  });
  it('each name has a recipe that really gives that name', () => {
    for (const n of NAMES) {
      expect(NAME_RECIPES[n], n).toBeDefined();
      expect(nameMix(NAME_RECIPES[n]), n).toBe(n);
      for (const x of NAME_RECIPES[n]) expect(x).toBeLessThanOrEqual(MAX_DROPS);
    }
    expect(Object.keys(NAME_RECIPES).length).toBe(18);
  });
  it('a name depends on shares only', () => {
    for (const d of allRecipes()) {
      for (const k of [2, 3]) {
        const big = d.map((x) => x * k);
        if (big.some((x) => x > MAX_DROPS)) continue;
        expect(nameMix(big), `${d.join()} x${k}`).toBe(nameMix(d));
      }
    }
  });
  it('nameIndex finds each name once and refuses others', () => {
    NAMES.forEach((n, i) => expect(nameIndex(n)).toBe(i));
    expect(nameIndex(null)).toBe(-1);
    expect(nameIndex('Mauve')).toBe(-1);
    expect(nameIndex('__proto__')).toBe(-1);
  });

  /**
   * Oracle independent of the naming rules: the hue the model really produces. Every name has a
   * rough place on the colour wheel, and no recipe may be named for a colour more than 65 degrees
   * away from where its swatch actually is.
   */
  const WHEEL: Record<string, number> = {
    Rose: 23, Coral: 39, Orange: 53, Gold: 65, Amber: 82, Ochre: 79, Brown: 57, Rust: 34, Lime: 102, Olive: 121,
    Green: 151, Teal: 207, 'Sky blue': 233, Slate: 231, Blue: 257, Purple: 315, Magenta: 5, Plum: 350,
  };
  it('every name sits within 65 degrees of the hue its swatch has (with the real tokens)', () => {
    for (const d of allRecipes()) {
      const n = nameMix(d) as string;
      expect(circ(mix(d).h, WHEEL[n]), `${d.join()} ${n}`).toBeLessThanOrEqual(65);
    }
  });
  it('the four classic names are what they look like', () => {
    for (const [d, lo, hi] of [[[1, 1, 0], 40, 65], [[2, 2, 0], 40, 65], [[0, 1, 1], 145, 170], [[0, 3, 3], 145, 170], [[1, 0, 1], 295, 320]] as [Drops, number, number][]) {
      const h = mix(d).h;
      expect(h, d.join()).toBeGreaterThanOrEqual(lo);
      expect(h).toBeLessThanOrEqual(hi);
    }
    const brown = mix([1, 1, 1]);
    expect(brown.h).toBeGreaterThan(40);
    expect(brown.h).toBeLessThan(75);
    expect(brown.C).toBeLessThan(0.11);
    expect(brown.L).toBeLessThan(0.62);
  });
  it('the names also hold with the built-in fallback paints', () => {
    for (const d of allRecipes()) {
      const a = mix(d, FALLBACK_PRIMARIES);
      const b = mix(d);
      expect(deltaE(a, b), d.join()).toBeLessThan(0.005);
    }
  });
});

describe('the challenge: targets', () => {
  it('has pools of 4, 10 and 88 targets', () => {
    expect(TARGET_POOLS.little.length).toBe(4);
    expect(TARGET_POOLS.middle.length).toBe(10);
    expect(TARGET_POOLS.big.length).toBe(88);
    expect(TARGET_POOLS.little.map((d) => nameMix(d))).toEqual(['Orange', 'Green', 'Purple', 'Brown']);
  });
  it('every target is whole drops within the dish, uses at least two paints, and no two share the same shares', () => {
    for (const level of LEVELS) {
      const pool = TARGET_POOLS[level];
      for (const d of pool) {
        expect(d.every((x) => Number.isInteger(x) && x >= 0 && x <= MAX_DROPS)).toBe(true);
        expect(d.filter((x) => x > 0).length).toBeGreaterThanOrEqual(2);
      }
      for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) expect(sameShares(pool[i], pool[j])).toBe(false);
    }
  });
  it('every target can be made exactly, and the exact mix scores three stars at 100 percent', () => {
    for (const level of LEVELS) {
      for (const d of TARGET_POOLS[level]) {
        // The player's dish can hold exactly these drops (or any multiple of them up to 8 each).
        const t = mix(d);
        expect(deltaE(t, mix(d))).toBe(0);
        expect(starsFor(level, 0)).toBe(3);
        expect(closeness(level, 0)).toBe(100);
        const multiples = [1, 2, 3, 4, 5, 6, 7, 8].filter((k) => d.every((x) => x * k <= MAX_DROPS));
        expect(multiples.length).toBeGreaterThanOrEqual(1);
        for (const k of multiples) expect(deltaE(t, mix(d.map((x) => x * k)))).toBeLessThan(1e-12);
      }
    }
  });
  it('the Little and Middle targets are far enough apart that no two matches overlap', () => {
    for (const primaries of [P, FALLBACK_PRIMARIES]) {
      for (const level of ['little', 'middle'] as Level[]) {
        const pool = TARGET_POOLS[level];
        for (let i = 0; i < pool.length; i++) {
          for (let j = i + 1; j < pool.length; j++) {
            const dist = deltaE(mix(pool[i], primaries), mix(pool[j], primaries));
            expect(dist, `${level} ${pool[i]} ${pool[j]}`).toBeGreaterThan(2 * TOLERANCE[level]);
          }
        }
      }
    }
  });
  it('no target can be matched by one plain paint', () => {
    for (const level of LEVELS) {
      for (const d of TARGET_POOLS[level]) {
        for (let i = 0; i < 3; i++) {
          const single: Drops = [0, 0, 0];
          single[i] = 1;
          expect(starsFor(level, deltaE(mix(d), mix(single))), `${level} ${d} vs paint ${i}`).toBe(0);
        }
      }
    }
  });
  it('rounds are deterministic by seed: five targets, none repeating the one before', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        const a = roundTargets(level, seed);
        expect(a).toEqual(roundTargets(level, seed));
        expect(a.length).toBe(5);
        a.forEach((d, i) => {
          expect(TARGET_POOLS[level].some((p) => sameShares(p, d))).toBe(true);
          if (i > 0) expect(sameShares(d, a[i - 1])).toBe(false);
        });
      }
    }
    expect(roundTargets('big', 1)).not.toEqual(roundTargets('big', 2));
  });
  it('over many seeds every Little and Middle target turns up', () => {
    for (const level of ['little', 'middle'] as Level[]) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 300; seed++) for (const d of roundTargets(level, seed)) seen.add(d.join());
      expect(seen.size).toBe(TARGET_POOLS[level].length);
    }
  });
  it('makeTarget honours avoid, copes with extreme random values and never mutates the pool', () => {
    const snapshot = JSON.stringify(TARGET_POOLS);
    for (const level of LEVELS) {
      for (const r of [0, 0.5, 0.999999999]) {
        const t = makeTarget(level, () => r);
        expect(TARGET_POOLS[level].some((p) => sameShares(p, t))).toBe(true);
        const t2 = makeTarget(level, () => r, t);
        expect(sameShares(t, t2)).toBe(false);
      }
    }
    expect(JSON.stringify(TARGET_POOLS)).toBe(snapshot);
  });
});

describe('the challenge: stars and closeness', () => {
  it('stars change at exactly a quarter, a half and all of the tolerance', () => {
    for (const level of LEVELS) {
      const tol = TOLERANCE[level];
      expect(starsFor(level, 0)).toBe(3);
      expect(starsFor(level, tol / 4)).toBe(3);
      expect(starsFor(level, tol / 4 + 1e-9)).toBe(2);
      expect(starsFor(level, tol / 2)).toBe(2);
      expect(starsFor(level, tol / 2 + 1e-9)).toBe(1);
      expect(starsFor(level, tol)).toBe(1);
      expect(starsFor(level, tol + 1e-9)).toBe(0);
      expect(starsFor(level, 5)).toBe(0);
      for (const bad of [NaN, -1, Infinity]) expect(starsFor(level, bad)).toBe(0);
    }
  });
  it('closeness is 100 at an exact match, 75 at the edge of a match, 0 at four times the tolerance', () => {
    for (const level of LEVELS) {
      const tol = TOLERANCE[level];
      expect(closeness(level, 0)).toBe(100);
      expect(closeness(level, tol)).toBe(75);
      expect(closeness(level, 4 * tol)).toBe(0);
      expect(closeness(level, 100)).toBe(0);
      expect(closeness(level, NaN)).toBe(0);
      let last = 101;
      for (let i = 0; i <= 50; i++) {
        const c = closeness(level, (i / 50) * 5 * tol);
        expect(c).toBeLessThanOrEqual(last);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(100);
        last = c;
      }
      // A match (one star or more) is exactly "75 percent close or more".
      expect(closeness(level, tol * 0.999)).toBeGreaterThanOrEqual(75);
      expect(closeness(level, tol * 1.01)).toBeLessThan(75);
      for (let i = 0; i <= 400; i++) {
        const dE = (i / 400) * 5 * tol;
        if (Math.abs(dE - tol) < 1e-6) continue;
        expect(starsFor(level, dE) >= 1, `${level} dE=${dE}`).toBe(closeness(level, dE) >= 75);
      }
    }
  });
  it('tolerances get stricter with the level', () => {
    expect(TOLERANCE.little).toBeGreaterThan(TOLERANCE.middle);
    expect(TOLERANCE.middle).toBeGreaterThan(TOLERANCE.big);
    expect(LEVEL_LABEL).toEqual({ little: 'Little', middle: 'Middle', big: 'Big' });
  });
});

describe('the hint', () => {
  const step = (d: Drops, h: { action: 'add' | 'remove'; primary: 0 | 1 | 2 }): Drops => {
    const out: Drops = [d[0], d[1], d[2]];
    out[h.primary] += h.action === 'add' ? 1 : -1;
    return out;
  };
  it('from every possible dish, following the hint arrives at the target shares, in range, in at most 24 steps', () => {
    let longest = 0;
    for (const level of LEVELS) {
      for (const target of TARGET_POOLS[level]) {
        for (const start of [[0, 0, 0] as Drops, ...allRecipes()]) {
          let d: Drops = [start[0], start[1], start[2]];
          let steps = 0;
          while (true) {
            const h = hintFor(d, target);
            if (!h) break;
            d = step(d, h);
            steps++;
            expect(d.every((x) => x >= 0 && x <= MAX_DROPS)).toBe(true);
            if (steps > 24) break;
          }
          expect(steps, `${level} ${target} from ${start}`).toBeLessThanOrEqual(24);
          expect(sameShares(d, target)).toBe(true);
          longest = Math.max(longest, steps);
        }
      }
    }
    expect(longest).toBeLessThanOrEqual(24);
  }, 60_000);
  it('is null exactly when the dish already has the target shares', () => {
    expect(hintFor([2, 2, 0], [1, 1, 0])).toBeNull();
    expect(hintFor([1, 1, 0], [1, 1, 0])).toBeNull();
    expect(hintFor([3, 0, 3], [1, 0, 1])).toBeNull();
    expect(hintFor([1, 1, 0], [0, 1, 1])).not.toBeNull();
    expect(hintFor([0, 0, 0], [0, 0, 0])).toBeNull();
  });
  it('starts an empty dish with the biggest part of the target, and prefers adding on a tie', () => {
    expect(hintFor([0, 0, 0], [1, 2, 0])).toEqual({ action: 'add', primary: 1 });
    expect(hintFor([0, 0, 0], [1, 1, 0])).toEqual({ action: 'add', primary: 0 });
    expect(hintFor([1, 0, 0], [1, 1, 0])).toEqual({ action: 'add', primary: 1 });
    expect(hintFor([0, 1, 1], [1, 1, 0])?.action).toBe('add');
    expect(hintFor([4, 1, 0], [1, 1, 0])).toEqual({ action: 'remove', primary: 0 });
  });
  it('words for the status line', () => {
    expect(hintText({ action: 'add', primary: 1 })).toBe('Try adding a drop of Amber.');
    expect(hintText({ action: 'remove', primary: 2 })).toBe('Try taking away a drop of Sky blue.');
    expect(hintText(null)).toBe('You already have the right mix of paints.');
  });
});

describe('saved progress', () => {
  it('keeps valid numbers and turns anything else into 0', () => {
    expect(sanitiseStore({ found: 5, little: 12, middle: 0, big: 15 })).toEqual({ found: 5, little: 12, middle: 0, big: 15 });
    expect(sanitiseStore({ found: FOUND_MAX })).toEqual({ found: 262143, little: 0, middle: 0, big: 0 });
    expect(FOUND_MAX).toBe(2 ** 18 - 1);
    expect(STARS_MAX).toBe(15);
    for (const bad of [null, undefined, 5, 'x', [], [5], {}, JSON.parse('{"__proto__":{"found":3}}')]) {
      expect(sanitiseStore(bad), JSON.stringify(bad)).toEqual(emptyStore());
    }
    expect(sanitiseStore({ found: -1, little: 16, middle: 1.5, big: NaN })).toEqual(emptyStore());
    expect(sanitiseStore({ found: '3', little: Infinity, middle: {}, big: [] })).toEqual(emptyStore());
    expect(sanitiseStore({ found: FOUND_MAX + 1 })).toEqual(emptyStore());
  });
  it('returns a fresh object with only the four fields', () => {
    const raw = { found: 3, evil: 'x', little: 1, middle: 2, big: 3 } as Record<string, unknown>;
    const out = sanitiseStore(raw);
    expect(Object.keys(out).sort()).toEqual(['big', 'found', 'little', 'middle']);
    expect(out).not.toBe(raw);
  });
  it('marks and counts the colours found', () => {
    let s = emptyStore();
    expect(foundCount(s)).toBe(0);
    s = markFound(s, 'Orange');
    expect(foundCount(s)).toBe(1);
    expect(s.found).toBe(1 << nameIndex('Orange'));
    s = markFound(s, 'Orange');
    expect(foundCount(s)).toBe(1);
    expect(markFound(s, 'Mauve')).toEqual(s);
    expect(markFound(s, null)).toEqual(s);
    for (const n of NAMES) s = markFound(s, n);
    expect(foundCount(s)).toBe(18);
    expect(s.found).toBe(FOUND_MAX);
  });
});

describe('copy text', () => {
  it('pluralises and describes the dish', () => {
    expect(plural(1, 'drop')).toBe('1 drop');
    expect(plural(0, 'drop')).toBe('0 drops');
    expect(recipeText([0, 0, 0])).toBe('Nothing yet');
    expect(recipeText([1, 0, 0])).toBe('1 drop: 1 Rose');
    expect(recipeText([2, 1, 0])).toBe('3 drops: 2 Rose, 1 Amber');
    expect(recipeText([1, 1, 1])).toBe('3 drops: 1 Rose, 1 Amber, 1 Sky blue');
    expect(recipeText([99, -1, NaN])).toBe('8 drops: 8 Rose');
  });
  it('the share line is correct in every state', () => {
    expect(shareLine({ mode: 'free', level: 'little', found: 0, roundsDone: 0, stars: 0 })).toBe('Colour Mixer - I have made 0 of 18 colours');
    expect(shareLine({ mode: 'free', level: 'little', found: 7, roundsDone: 0, stars: 0 })).toBe('Colour Mixer - I have made 7 of 18 colours');
    expect(shareLine({ mode: 'match', level: 'middle', found: 7, roundsDone: 0, stars: 0 })).toBe('Colour Mixer - Middle level, just started');
    expect(shareLine({ mode: 'match', level: 'middle', found: 7, roundsDone: 1, stars: 3 })).toBe('Colour Mixer - Middle level, 3 of 3 stars after 1 round');
    expect(shareLine({ mode: 'match', level: 'big', found: 0, roundsDone: 5, stars: 12 })).toBe('Colour Mixer - Big level, 12 of 15 stars after 5 rounds');
  });
});
