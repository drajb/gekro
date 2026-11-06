/**
 * games-bubble-pop.test.ts - the engine behind `bubble-pop`.
 *
 * Pinned: the three sizes and every number the content page quotes; that a bubble is never
 * narrower than 56 px; that the goal for a round depends only on the seed, the size and the
 * round number and stays inside the size's ranges; that the goal can always be reached
 * (while a goal is open the field always holds enough bubbles that count, and exactly one
 * different bubble in an odd-one-out round), checked by simulating thousands of steps with
 * bots that never pop, pop at random and pop only what counts; tap hit testing against a
 * brute-force check; that motion off means nothing moves; the words said after a pop; and
 * that what comes out of localStorage is sanitised before the page sees it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FIELD_W, FIELD_H, MIN_DIAMETER_PX, MAX_DIAMETER, HIT_SLACK, SWAY, SWAY_RATE, MAX_DT, MAX_ROUNDS,
  LEVELS, LEVEL_KEYS, DEFAULT_LEVEL, parseLevel, HUES, GOAL_KINDS, mulberry32, plural,
  goalForRound, goalText, goalNeed, isMatch, bubbleLabel, bubbleRadius, makeWorld, replenish, setRadius, step, hitTest, popBubble,
  isTappable, bubblesOnField, matchesOnField, requiredMatches, popMessage, levelOffer,
  cleanRounds, sanitiseStored, toStorable, recordRound, resultSummary,
  type World, type Goal, type LevelKey, type Bubble,
} from '../src/components/apps-private/bubble-pop/helpers';

const EM_DASH = String.fromCharCode(0x2014);
const WIDTHS = [200, 256, 288, 343, 600, 1000];

const goals = (level: LevelKey, seed: number, rounds = 6): Goal[] => Array.from({ length: rounds }, (_, r) => goalForRound(seed, level, r));

describe('constants quoted on the content page', () => {
  it('match the spec', () => {
    expect(FIELD_W).toBe(100);
    expect(FIELD_H).toBe(130);
    expect(MIN_DIAMETER_PX).toBe(56);
    expect(MAX_DIAMETER).toBe(44);
    expect(HIT_SLACK).toBe(1.12);
    expect(SWAY).toBe(1.4);
    expect(SWAY_RATE).toBe(0.7);
    expect(MAX_DT).toBe(0.05);
    expect(MAX_ROUNDS).toBe(9999);
    expect(DEFAULT_LEVEL).toBe('little');
    expect([...LEVEL_KEYS]).toEqual(['little', 'middle', 'big']);
    expect([...GOAL_KINDS]).toEqual(['colour', 'number', 'odd']);
  });
  it('the three sizes', () => {
    expect(LEVELS.little).toMatchObject({ label: 'Little', diameter: 34, count: 3, speed: 3, maxNumber: 5, needMin: 2, needMax: 3, minMatch: 2 });
    expect(LEVELS.middle).toMatchObject({ label: 'Middle', diameter: 25, count: 5, speed: 4.5, maxNumber: 9, needMin: 3, needMax: 5, minMatch: 2 });
    expect(LEVELS.big).toMatchObject({ label: 'Big', diameter: 20, count: 7, speed: 6, maxNumber: 12, needMin: 4, needMax: 8, minMatch: 2 });
    expect([...LEVELS.little.hues]).toEqual([0, 1, 2]);
    expect([...LEVELS.middle.hues]).toEqual([0, 1, 2, 3]);
    expect([...LEVELS.big.hues]).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('little is the biggest, slowest and fewest; big the smallest, quickest and most (but still calm)', () => {
    expect(LEVELS.little.diameter).toBeGreaterThan(LEVELS.middle.diameter);
    expect(LEVELS.middle.diameter).toBeGreaterThan(LEVELS.big.diameter);
    expect(LEVELS.little.speed).toBeLessThan(LEVELS.middle.speed);
    expect(LEVELS.middle.speed).toBeLessThan(LEVELS.big.speed);
    expect(LEVELS.little.count).toBeLessThan(LEVELS.middle.count);
    expect(LEVELS.middle.count).toBeLessThan(LEVELS.big.count);
    // Even the quickest size takes more than 20 seconds to cross the field.
    expect(FIELD_H / LEVELS.big.speed).toBeGreaterThan(20);
    // The slowest takes about 43 seconds.
    expect(Math.round(FIELD_H / LEVELS.little.speed)).toBe(43);
  });
  it('six colours, each with its own name and its own shape', () => {
    expect(HUES).toHaveLength(6);
    expect(new Set(HUES.map((h) => h.name)).size).toBe(6);
    expect(new Set(HUES.map((h) => h.shape)).size).toBe(6);
    expect(HUES.map((h) => h.name)).toEqual(['blue', 'yellow', 'pink', 'purple', 'green', 'orange']);
  });
  it('parseLevel falls back to little', () => {
    for (const k of LEVEL_KEYS) expect(parseLevel(k)).toBe(k);
    for (const bad of ['', 'huge', null, undefined, 3, {}, '__proto__', 'constructor']) expect(parseLevel(bad)).toBe('little');
  });
});

describe('bubble size', () => {
  it('is at least 56 px across for any field 130 px or wider, and never over 44 units', () => {
    for (const lv of LEVEL_KEYS) for (let w = 130; w <= 1400; w += 7) {
      const r = bubbleRadius(lv, w);
      expect((2 * r * w) / FIELD_W, `${lv} ${w}`).toBeGreaterThanOrEqual(MIN_DIAMETER_PX - 1e-9);
      expect(2 * r).toBeLessThanOrEqual(MAX_DIAMETER + 1e-9);
    }
  });
  it('is the size\'s own on a wide field and grows only when the field is narrow', () => {
    expect(bubbleRadius('little', 600)).toBe(17);
    expect(bubbleRadius('middle', 600)).toBe(12.5);
    expect(bubbleRadius('big', 600)).toBe(10);
    expect(bubbleRadius('big', 288)).toBe(10);
    expect(bubbleRadius('big', 200)).toBeCloseTo(14, 9);
    expect(bubbleRadius('little', 320)).toBe(17);
  });
  it('survives a bad width', () => {
    for (const bad of [NaN, Infinity, -4, 0, '300' as unknown as number, undefined as unknown as number]) {
      const r = bubbleRadius('big', bad);
      expect(Number.isFinite(r) && r > 0).toBe(true);
    }
  });
});

describe('goalForRound', () => {
  it('depends only on the seed, the size and the round (same in, same out)', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed < 40; seed++) {
      expect(goals(lv, seed)).toEqual(goals(lv, seed));
    }
    expect(JSON.stringify(goals('big', 1))).not.toBe(JSON.stringify(goals('big', 2)));
  });
  it('stays inside the size\'s ranges for 3 sizes x 700 seeds x 6 rounds', () => {
    for (const lv of LEVEL_KEYS) {
      const spec = LEVELS[lv];
      for (let seed = 1; seed <= 700; seed++) {
        for (let round = 0; round < 6; round++) {
          const g = goalForRound(seed * 7919, lv, round);
          expect(spec.hues).toContain(g.hue);
          if (g.kind === 'colour') {
            expect(g.need).toBeGreaterThanOrEqual(spec.needMin);
            expect(g.need).toBeLessThanOrEqual(spec.needMax);
          } else if (g.kind === 'number') {
            expect(g.need).toBeGreaterThanOrEqual(spec.needMin);
            expect(g.need).toBeLessThanOrEqual(spec.needMax);
            expect(Number.isInteger(g.n) && g.n >= 1 && g.n <= spec.maxNumber).toBe(true);
          } else {
            expect(g.need).toBe(1);
            expect(spec.hues).toContain(g.oddHue);
            expect(g.oddHue).not.toBe(g.hue);
          }
        }
      }
    }
  });
  it('never gives two rounds in a row of the same kind, and shows all three kinds in any three rounds', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed < 200; seed++) {
      const kinds = goals(lv, seed, 12).map((g) => g.kind);
      for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
      for (let i = 0; i + 2 < kinds.length; i++) expect(new Set(kinds.slice(i, i + 3)).size).toBe(3);
    }
  });
  it('uses every number and every colour of the size over many seeds', () => {
    for (const lv of LEVEL_KEYS) {
      const nums = new Set<number>();
      const hues = new Set<number>();
      for (let seed = 1; seed < 3000; seed++) for (let r = 0; r < 3; r++) {
        const g = goalForRound(seed, lv, r);
        if (g.kind === 'number') nums.add(g.n);
        hues.add(g.hue);
      }
      expect(nums.size).toBe(LEVELS[lv].maxNumber);
      expect(hues.size).toBe(LEVELS[lv].hues.length);
    }
  });
  it('survives junk input', () => {
    for (const bad of [NaN, Infinity, -5, 0, 1.5, 2 ** 40, undefined as unknown as number]) {
      const g = goalForRound(bad, 'little', bad);
      expect(GOAL_KINDS).toContain(g.kind);
      expect(g.need).toBeGreaterThanOrEqual(1);
    }
    expect(goalForRound(1, 'nope' as LevelKey, 0)).toEqual(goalForRound(1, 'little', 0));
  });
  it('goalNeed is the count of bubbles to pop', () => {
    expect(goalNeed({ kind: 'colour', hue: 1, need: 4 })).toBe(4);
    expect(goalNeed({ kind: 'odd', hue: 0, oddHue: 2, need: 1 })).toBe(1);
  });
});

describe('goal words', () => {
  it('says the goal in a short sentence', () => {
    expect(goalText({ kind: 'colour', hue: 3, need: 4 })).toBe('Pop 4 purple bubbles');
    expect(goalText({ kind: 'colour', hue: 0, need: 1 })).toBe('Pop 1 blue bubble');
    expect(goalText({ kind: 'number', n: 5, hue: 0, need: 3 })).toBe('Pop 3 bubbles with the number 5');
    expect(goalText({ kind: 'number', n: 2, hue: 0, need: 1 })).toBe('Pop 1 bubble with the number 2');
    expect(goalText({ kind: 'odd', hue: 0, oddHue: 1, need: 1 })).toBe('Find the bubble that is different');
  });
  it('labels a bubble by what is on it and never says whether it counts', () => {
    const colour: Goal = { kind: 'colour', hue: 3, need: 2 };
    expect(bubbleLabel(colour, { id: 1, x: 0, y: 0, bx: 0, hue: 3, num: 0, phase: 0 })).toBe('purple bubble with a triangle');
    expect(bubbleLabel(colour, { id: 1, x: 0, y: 0, bx: 0, hue: 0, num: 0, phase: 0 })).toBe('blue bubble with a circle');
    const number: Goal = { kind: 'number', n: 4, hue: 1, need: 2 };
    expect(bubbleLabel(number, { id: 1, x: 0, y: 0, bx: 0, hue: 1, num: 4, phase: 0 })).toBe('Bubble with the number 4');
  });
  it('no goal text has an em-dash, NaN, undefined or null', () => {
    for (const lv of LEVEL_KEYS) for (const g of goals(lv, 5, 9)) {
      const t = goalText(g);
      expect(t.includes(EM_DASH)).toBe(false);
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    }
  });
});

// ── The field ────────────────────────────────────────────────────────────────

const world = (lv: LevelKey, g: Goal, seed: number, widthPx = 288, motion = true): { w: World; rng: () => number } => {
  const rng = mulberry32(seed);
  return { w: makeWorld(lv, g, rng, { r: bubbleRadius(lv, widthPx), motion }), rng };
};

const oddCount = (w: World, tappableOnly = true): number =>
  w.bubbles.filter((b) => (!tappableOnly || isTappable(b)) && isMatch(w.goal, b)).length;

describe('a new field', () => {
  it('has the size\'s number of bubbles, all inside the field, none overlapping, enough that count', () => {
    for (const lv of LEVEL_KEYS) for (const width of [288, 343, 600]) for (let seed = 1; seed <= 60; seed++) {
      for (const g of goals(lv, seed, 3)) {
        const { w } = world(lv, g, seed, width);
        expect(w.bubbles, `${lv} ${width} ${seed}`).toHaveLength(LEVELS[lv].count);
        for (const b of w.bubbles) {
          expect(b.x - w.r).toBeGreaterThanOrEqual(-1e-9);
          expect(b.x + w.r).toBeLessThanOrEqual(FIELD_W + 1e-9);
          expect(b.y - w.r).toBeGreaterThanOrEqual(-1e-9);
          expect(b.y + w.r).toBeLessThanOrEqual(FIELD_H + 1e-9);
        }
        for (let i = 0; i < w.bubbles.length; i++) for (let j = i + 1; j < w.bubbles.length; j++) {
          expect(Math.hypot(w.bubbles[i].x - w.bubbles[j].x, w.bubbles[i].y - w.bubbles[j].y)).toBeGreaterThanOrEqual(2 * w.r - 1e-9);
        }
        expect(matchesOnField(w)).toBeGreaterThanOrEqual(requiredMatches(w));
        expect(new Set(w.bubbles.map((b) => b.id)).size).toBe(w.bubbles.length);
      }
    }
  });
  it('a colour round shows the goal colour and others; a number round has one colour and numbers 1 to max; an odd round has exactly one different bubble', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 80; seed++) for (const g of goals(lv, seed, 3)) {
      const { w } = world(lv, g, seed);
      const spec = LEVELS[lv];
      if (g.kind === 'colour') {
        expect(w.bubbles.every((b) => spec.hues.includes(b.hue) && b.num === 0)).toBe(true);
        expect(w.bubbles.filter((b) => b.hue === g.hue).length).toBeGreaterThanOrEqual(spec.minMatch);
      } else if (g.kind === 'number') {
        expect(w.bubbles.every((b) => b.hue === g.hue && b.num >= 1 && b.num <= spec.maxNumber)).toBe(true);
      } else {
        expect(oddCount(w)).toBe(1);
        expect(w.bubbles.filter((b) => b.hue === g.hue)).toHaveLength(spec.count - 1);
      }
    }
  });
  it('is the same for the same seed and different for another', () => {
    const g = goalForRound(5, 'middle', 0);
    const a = JSON.stringify(world('middle', g, 9).w);
    expect(JSON.stringify(world('middle', g, 9).w)).toBe(a);
    expect(JSON.stringify(world('middle', g, 10).w)).not.toBe(a);
  });
  it('still holds enough bubbles that count in a very narrow field where bubbles are crowded', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 40; seed++) for (const g of goals(lv, seed, 3)) {
      const { w } = world(lv, g, seed, 130);
      expect(matchesOnField(w)).toBeGreaterThanOrEqual(requiredMatches(w));
      for (const b of w.bubbles) expect(isTappable(b)).toBe(true);
    }
  });
});

describe('the goal can always be reached', () => {
  type Bot = 'idle' | 'random' | 'matching';
  const run = (lv: LevelKey, g: Goal, seed: number, width: number, bot: Bot, steps: number) => {
    const { w, rng } = world(lv, g, seed, width);
    const spec = LEVELS[lv];
    const act = mulberry32(seed * 31 + 7);
    const bad: string[] = [];
    let finishedAt = -1;
    for (let k = 0; k < steps && !w.done; k++) {
      step(w, 0.016 + (k % 5) * 0.01, rng);
      if (bot === 'random' && k % 7 === 0 && w.bubbles.length) popBubble(w, w.bubbles[Math.floor(act() * w.bubbles.length)].id, rng);
      if (bot === 'matching' && k % 9 === 0) {
        const m = w.bubbles.find((b) => isTappable(b) && isMatch(w.goal, b));
        if (m) popBubble(w, m.id, rng);
      }
      if (w.done) { finishedAt = k; break; }
      // The invariants after every step, collected so a failure names the step:
      const tag = `${lv} ${g.kind} w${width} seed ${seed} step ${k}`;
      if (matchesOnField(w) < requiredMatches(w)) bad.push(`${tag}: too few that count`);
      if (width >= 288 && bubblesOnField(w) < spec.count) bad.push(`${tag}: field not full`);
      if (w.bubbles.length > spec.count + 6) bad.push(`${tag}: too many bubbles`);
      if (g.kind === 'odd' && oddCount(w) !== 1) bad.push(`${tag}: odd count ${oddCount(w)}`);
      if (new Set(w.bubbles.map((b) => b.id)).size !== w.bubbles.length) bad.push(`${tag}: duplicate ids`);
      for (const b of w.bubbles) {
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || b.x < 0 || b.x > FIELD_W || b.y > FIELD_H) bad.push(`${tag}: bubble out of range ${b.x},${b.y}`);
      }
      if (bad.length > 5) break;
    }
    expect(bad).toEqual([]);
    return { w, finishedAt };
  };

  it('an idle player: for 1200 steps the field never runs out of bubbles that count (3 sizes x 4 widths x every kind)', () => {
    for (const lv of LEVEL_KEYS) for (const width of [200, 288, 343, 600]) for (let seed = 1; seed <= 6; seed++) {
      for (const g of goals(lv, seed, 3)) run(lv, g, seed, width, 'idle', 1200);
    }
  }, 60_000);
  it('a player who pops anything at random: the invariants hold and nothing breaks', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 8; seed++) {
      for (const g of goals(lv, seed, 3)) run(lv, g, seed, 288, 'random', 1500);
    }
  }, 60_000);
  it('a player who pops only what counts finishes every goal after exactly the number of pops it asks for', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 40; seed++) for (const g of goals(lv, seed, 3)) {
      for (const width of [256, 343]) {
        const { w, finishedAt } = run(lv, g, seed, width, 'matching', 4000);
        expect(w.done, `${lv} ${g.kind}`).toBe(true);
        expect(finishedAt).toBeGreaterThanOrEqual(0);
        expect(w.popped).toBe(g.need);
        expect(w.pops).toBe(g.need);
      }
    }
  }, 60_000);
  it('a bubble that does not count is popped and the goal is not finished by it', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 30; seed++) for (const g of goals(lv, seed, 3)) {
      const { w, rng } = world(lv, g, seed);
      const other = w.bubbles.find((b) => !isMatch(g, b));
      if (!other) continue;
      const before = w.popped;
      const r = popBubble(w, other.id, rng);
      expect(r).toMatchObject({ ok: true, match: false, complete: false });
      expect(w.popped).toBe(before);
      expect(w.done).toBe(false);
      expect(w.pops).toBe(1);
      expect(matchesOnField(w)).toBeGreaterThanOrEqual(requiredMatches(w));
    }
  });
  it('an odd-one-out round finishes with the single different bubble, and a pop of any other bubble never does', () => {
    const g: Goal = { kind: 'odd', hue: 0, oddHue: 2, need: 1 };
    const { w, rng } = world('little', g, 3);
    for (let k = 0; k < 25; k++) {
      const same = w.bubbles.find((b) => b.hue === 0);
      if (same) popBubble(w, same.id, rng);
      expect(w.done).toBe(false);
      expect(oddCount(w)).toBe(1);
    }
    const odd = w.bubbles.find((b) => b.hue === 2)!;
    expect(popBubble(w, odd.id, rng)).toMatchObject({ ok: true, match: true, complete: true });
    expect(w.done).toBe(true);
  });
  it('after the goal is done nothing else can be popped, and an unknown bubble is ignored', () => {
    const g: Goal = { kind: 'odd', hue: 0, oddHue: 2, need: 1 };
    const { w, rng } = world('little', g, 3);
    expect(popBubble(w, 99999, rng).ok).toBe(false);
    expect(popBubble(w, NaN, rng).ok).toBe(false);
    popBubble(w, w.bubbles.find((b) => b.hue === 2)!.id, rng);
    const left = w.bubbles.length;
    expect(popBubble(w, w.bubbles[0].id, rng)).toMatchObject({ ok: false, complete: false });
    expect(w.bubbles).toHaveLength(left);
    step(w, 0.016, rng);
    expect(w.bubbles).toHaveLength(left);
  });
  it('requiredMatches is at most the size\'s minimum and at most what is still needed', () => {
    const { w } = world('big', { kind: 'colour', hue: 0, need: 4 }, 2);
    expect(requiredMatches(w)).toBe(2);
    w.popped = 3;
    expect(requiredMatches(w)).toBe(1);
    w.popped = 4;
    expect(requiredMatches(w)).toBe(0);
    w.popped = 0;
    w.done = true;
    expect(requiredMatches(w)).toBe(0);
  });
  it('replenish is idempotent when the field is already right', () => {
    const { w, rng } = world('middle', { kind: 'colour', hue: 1, need: 4 }, 4);
    const before = JSON.stringify(w);
    replenish(w, rng);
    expect(JSON.stringify(w)).toBe(before);
  });
});

describe('motion', () => {
  it('with motion on, bubbles rise at the size\'s speed and sway within the limit', () => {
    for (const lv of LEVEL_KEYS) {
      const { w, rng } = world(lv, { kind: 'colour', hue: 0, need: 3 }, 6);
      const first = w.bubbles[0];
      const y0 = first.y;
      const t0 = w.time;
      for (let k = 0; k < 20; k++) step(w, 0.05, rng);
      const still = w.bubbles.find((b) => b.id === first.id);
      expect(w.time - t0).toBeCloseTo(1, 9);
      if (still) {
        expect(y0 - still.y).toBeCloseTo(LEVELS[lv].speed * 1, 6);
        expect(Math.abs(still.x - still.bx)).toBeLessThanOrEqual(SWAY + 1e-9);
      }
    }
  });
  it('a long frame counts for no more than 0.05 s', () => {
    const { w, rng } = world('little', { kind: 'colour', hue: 0, need: 2 }, 6);
    const y0 = w.bubbles[0].y;
    const id = w.bubbles[0].id;
    step(w, 10, rng);
    expect(w.time).toBeCloseTo(0.05, 9);
    expect(y0 - w.bubbles.find((b) => b.id === id)!.y).toBeCloseTo(LEVELS.little.speed * 0.05, 6);
    const t = w.time;
    for (const bad of [NaN, -3, Infinity]) step(w, bad, rng);
    expect(w.time).toBeGreaterThanOrEqual(t);
    expect(Number.isFinite(w.time)).toBe(true);
  });
  it('bubbles that drift off the top are removed and replaced, and the field stays full', () => {
    const { w, rng } = world('big', { kind: 'colour', hue: 2, need: 8 }, 8);
    const firstIds = new Set(w.bubbles.map((b) => b.id));
    for (let k = 0; k < 4000; k++) step(w, 0.05, rng);
    expect(w.bubbles.some((b) => firstIds.has(b.id))).toBe(false);
    expect(bubblesOnField(w)).toBeGreaterThanOrEqual(LEVELS.big.count);
    for (const b of w.bubbles) expect(b.y).toBeGreaterThan(-w.r * 1.2);
  });
  it('with motion off nothing moves and nothing leaves, however long it runs', () => {
    for (const lv of LEVEL_KEYS) {
      const { w, rng } = world(lv, { kind: 'number', n: 2, hue: 0, need: 3 }, 12, 288, false);
      const before = JSON.stringify(w.bubbles);
      for (let k = 0; k < 3000; k++) step(w, 0.05, rng);
      expect(JSON.stringify(w.bubbles)).toBe(before);
    }
  });
  it('with motion off a popped bubble is replaced where there is room and the field stays full', () => {
    const { w, rng } = world('middle', { kind: 'colour', hue: 1, need: 1_000_000 }, 5, 288, false);
    for (let k = 0; k < 200; k++) {
      popBubble(w, w.bubbles[k % w.bubbles.length].id, rng);
      expect(bubblesOnField(w)).toBeGreaterThanOrEqual(LEVELS.middle.count);
      expect(matchesOnField(w)).toBeGreaterThanOrEqual(2);
    }
  });
  it('setRadius keeps every bubble inside the field', () => {
    const { w } = world('big', { kind: 'colour', hue: 0, need: 4 }, 3);
    setRadius(w, 22);
    expect(w.r).toBe(22);
    for (const b of w.bubbles) {
      expect(b.bx - 22).toBeGreaterThanOrEqual(-1e-9);
      expect(b.bx + 22).toBeLessThanOrEqual(FIELD_W + 1e-9);
    }
    setRadius(w, NaN);
    expect(w.r).toBe(22);
    setRadius(w, 9999);
    expect(w.r).toBe(MAX_DIAMETER / 2);
  });
});

describe('tap hit testing', () => {
  const brute = (w: World, p: { x: number; y: number }): Bubble | null => {
    const inside = w.bubbles.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) <= w.r * HIT_SLACK);
    if (inside.length === 0) return null;
    let best = inside[0];
    for (const b of inside) if (Math.hypot(b.x - p.x, b.y - p.y) <= Math.hypot(best.x - p.x, best.y - p.y)) best = b;
    return best;
  };
  it('agrees with a brute-force check on a grid of taps over many fields', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 12; seed++) {
      const { w } = world(lv, goalForRound(seed, lv, 0), seed);
      for (let x = 0; x <= FIELD_W; x += 2.5) for (let y = 0; y <= FIELD_H; y += 2.5) {
        expect(hitTest(w, { x, y })?.id ?? null).toBe(brute(w, { x, y })?.id ?? null);
      }
    }
  });
  it('a tap on the centre hits that bubble; just inside the enlarged edge hits; just outside misses', () => {
    const { w } = world('little', { kind: 'colour', hue: 0, need: 2 }, 4);
    for (const b of w.bubbles) {
      expect(hitTest(w, { x: b.x, y: b.y })?.id).toBe(b.id);
      expect(hitTest(w, { x: b.x + w.r * HIT_SLACK - 0.01, y: b.y })?.id).toBe(b.id);
      const out = { x: b.x + w.r * HIT_SLACK + 0.01, y: b.y };
      const h = hitTest(w, out);
      expect(h === null || h.id !== b.id).toBe(true);
    }
  });
  it('of two overlapping bubbles the closer centre wins, and the later one on a tie', () => {
    const { w } = world('big', { kind: 'colour', hue: 0, need: 2 }, 4);
    w.bubbles = [
      { id: 1, x: 50, y: 50, bx: 50, hue: 0, num: 0, phase: 0 },
      { id: 2, x: 56, y: 50, bx: 56, hue: 1, num: 0, phase: 0 },
    ];
    expect(hitTest(w, { x: 52, y: 50 })?.id).toBe(1);
    expect(hitTest(w, { x: 55, y: 50 })?.id).toBe(2);
    expect(hitTest(w, { x: 53, y: 50 })?.id).toBe(2);
  });
  it('junk taps hit nothing and never throw', () => {
    const { w } = world('little', { kind: 'colour', hue: 0, need: 2 }, 4);
    for (const bad of [{ x: NaN, y: 3 }, { x: 5, y: Infinity }, { x: undefined as unknown as number, y: 1 }, { x: -50, y: -50 }, { x: 1e9, y: 1e9 }]) {
      expect(hitTest(w, bad)).toBeNull();
    }
  });
});

describe('what is said after a pop', () => {
  const pop = (w: World, rng: () => number, pick: (b: Bubble) => boolean) => popBubble(w, w.bubbles.find(pick)!.id, rng);
  it('colour: a match says how far along; a miss names the colour popped and the colour wanted; the last one celebrates', () => {
    const g: Goal = { kind: 'colour', hue: 3, need: 2 };
    const { w, rng } = world('middle', g, 11);
    const miss = pop(w, rng, (b) => b.hue !== 3);
    expect(popMessage(w, miss)).toMatch(/^Pop! That one was (blue|yellow|pink)\. We want purple ones\.$/);
    const one = pop(w, rng, (b) => b.hue === 3 && isTappable(b));
    expect(popMessage(w, one)).toBe('Yes! That is 1 of 2. 1 to go.');
    const two = pop(w, rng, (b) => b.hue === 3 && isTappable(b));
    expect(popMessage(w, two)).toBe('You popped 2 purple bubbles!');
  });
  it('number and odd rounds', () => {
    const gn: Goal = { kind: 'number', n: 4, hue: 0, need: 1 };
    const a = world('middle', gn, 2);
    const miss = pop(a.w, a.rng, (b) => b.num !== 4);
    expect(popMessage(a.w, miss)).toMatch(/^Pop! That one was number \d+\. We want number 4\.$/);
    expect(popMessage(a.w, pop(a.w, a.rng, (b) => b.num === 4))).toBe('You popped 1 bubble with the number 4!');
    const go: Goal = { kind: 'odd', hue: 0, oddHue: 1, need: 1 };
    const b = world('little', go, 2);
    expect(popMessage(b.w, pop(b.w, b.rng, (x) => x.hue === 0))).toBe('Pop! That one matches the others. Keep looking for the different one.');
    expect(popMessage(b.w, pop(b.w, b.rng, (x) => x.hue === 1))).toBe('You found the different bubble!');
  });
  it('nothing for a failed pop; and no message from any round has junk, an em-dash or a scolding word', () => {
    const { w, rng } = world('little', { kind: 'colour', hue: 0, need: 2 }, 1);
    expect(popMessage(w, popBubble(w, 12345, rng))).toBe('');
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 30; seed++) for (const g of goals(lv, seed, 3)) {
      const x = world(lv, g, seed);
      for (let k = 0; k < 12 && !x.w.done; k++) {
        const m = popMessage(x.w, popBubble(x.w, x.w.bubbles[k % x.w.bubbles.length].id, x.rng));
        expect(m.includes(EM_DASH)).toBe(false);
        expect(m).not.toMatch(/NaN|undefined|null|Infinity|wrong|bad|fail|incorrect/i);
        expect(m.length).toBeGreaterThan(0);
      }
    }
  });
  it('levelOffer comes after every fifth round, never on Big, and is only an offer', () => {
    expect(levelOffer('little', 5)).toBe('You have finished 5 rounds. If you like, try the Middle size next.');
    expect(levelOffer('middle', 10)).toBe('You have finished 10 rounds. If you like, try the Big size next.');
    for (const n of [0, 1, 4, 6, 9, 11, -5, NaN]) expect(levelOffer('little', n)).toBe('');
    expect(levelOffer('big', 5)).toBe('');
    expect(plural(1, 'round')).toBe('1 round');
    expect(plural(2, 'round')).toBe('2 rounds');
  });
});

describe('cleanRounds and sanitiseStored', () => {
  it('rounds are whole numbers from 1 to the cap', () => {
    for (const ok of [1, 5, 9999]) expect(cleanRounds(ok)).toBe(ok);
    for (const bad of [0, -1, 1.5, 10000, 1e300, NaN, Infinity, '5', null, undefined, {}, [], [3], true, 4n]) expect(cleanRounds(bad), String(bad)).toBeNull();
  });
  it('keeps a good payload, from an object or JSON text', () => {
    expect(sanitiseStored({ little: 12, big: 3 })).toEqual({ little: 12, big: 3 });
    expect(sanitiseStored('{"middle":40}')).toEqual({ middle: 40 });
  });
  it('returns nothing for a payload that is not a plain object', () => {
    for (const bad of [null, undefined, 42, true, '', 'not json', '[1,2]', '"x"', 'null', [], [1], NaN, () => 1, Symbol('x')]) expect(sanitiseStored(bad)).toEqual({});
  });
  it('drops unknown and prototype keys and bad values', () => {
    const s = sanitiseStored('{"__proto__":{"little":9},"constructor":3,"huge":5,"little":2,"middle":-1,"big":"4"}');
    expect(s).toEqual({ little: 2 });
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).little).toBeUndefined();
  });
  it('is quick on a hostile object', () => {
    const t = performance.now();
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 200000; i++) huge[`k${i}`] = 4;
    huge.big = 4;
    expect(sanitiseStored(huge)).toEqual({ big: 4 });
    expect(performance.now() - t).toBeLessThan(4000);
  }, 15_000);
  it('recordRound adds one, stops at the cap, ignores bad stored values and does not change what it was given', () => {
    const base = { little: 4 };
    const frozen = JSON.stringify(base);
    expect(recordRound(base, 'little')).toEqual({ little: 5 });
    expect(recordRound(base, 'big')).toEqual({ little: 4, big: 1 });
    expect(JSON.stringify(base)).toBe(frozen);
    expect(recordRound({ big: 9999 }, 'big')).toEqual({ big: 9999 });
    expect(recordRound({ big: -3 } as Record<string, number>, 'big')).toEqual({ big: 1 });
    expect(recordRound({}, 'nope' as LevelKey)).toEqual({ little: 1 });
  });
  it('toStorable round-trips through JSON and the sanitiser', () => {
    const r = { little: 3, middle: 8 };
    expect(sanitiseStored(JSON.stringify(toStorable(r)))).toEqual(r);
    expect(toStorable({ little: 3, junk: 4 } as Record<string, number>)).toEqual({ little: 3 });
  });
});

describe('the copy line', () => {
  it('reads right with nothing, one round and many', () => {
    expect(resultSummary('little', 0, 0)).toBe('Bubble Pop (Little): no rounds finished yet');
    expect(resultSummary('middle', 1, 1)).toBe('Bubble Pop (Middle): 1 round finished this time, 1 round in all');
    expect(resultSummary('big', 4, 30)).toBe('Bubble Pop (Big): 4 rounds finished this time, 30 rounds in all');
    expect(resultSummary('big', 4, 2)).toBe('Bubble Pop (Big): 4 rounds finished this time, 4 rounds in all');
    for (const t of [resultSummary('big', NaN, NaN), resultSummary('x' as LevelKey, -3, 5)]) {
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(t.includes(EM_DASH)).toBe(false);
    }
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/bubble-pop', f), 'utf8');
  it('no Math.random anywhere in the game', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
  });
  it('buttons are at least 56 px (3.5rem) tall and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.bbp-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.bbp-key \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/#bbp-app \.bbp-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('the page never turns off touch scrolling anywhere (a bubble field is tapped, not dragged)', () => {
    expect(read('Calculator.astro')).not.toMatch(/touch-action:\s*none/);
  });
  it('the page has a Pause button, so moving bubbles can be stopped', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/id="bbp-pause"/);
  });
});
