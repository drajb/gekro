/**
 * games-drum-pad.test.ts - the engine behind `drum-pad`.
 *
 * Pinned: the scheduler's step-time arithmetic (exact at tempos whose step length is a
 * binary fraction, within 1e-9 elsewhere, and against a closed form), the swing offset,
 * the late-tick recovery and the per-tick cap; the 16 pads (unique names, keys, glyphs,
 * four families of four, a 4x4 keyboard layout); every voice recipe stays inside safe
 * numeric bounds and under one second; the master gain never passes 0.15 whatever is
 * passed in; the polyphony cap picks the oldest started voice and never a waiting one;
 * pattern toggling, counting and the 64-digit share code round trip; every preset parses
 * and sounds; and the sanitisers reject junk. The numbers quoted on the guide page are
 * asserted here.
 */
import { describe, it, expect } from 'vitest';
import {
  STEPS, PAD_COUNT, BPM_MIN, BPM_MAX, BPM_DEFAULT, SWING_MAX, MASTER_PEAK, MAX_VOICES, LOOKAHEAD, TICK_MS, LATE_LIMIT,
  MAX_EVENTS_PER_TICK, MAX_VOICE_SECONDS,
  PADS, PRESETS, mulberry32, noiseSamples, clampBpm, clampSwing, clampVolume, masterGain, midiToFreq,
  padForKey, recipeDuration, recipeProblems, pickVoiceToSteal,
  emptyPattern, stepOn, toggleStep, hitsAt, countHits, countHitsOnPad, tracksUsed, encodePattern, decodePattern,
  presetPattern, findPreset, readBeat, plural, shareLine,
  stepDuration, swingOffset, stepTimeFromStart, planSteps,
  type Pattern, type SchedState, type StepEvent,
} from '../src/components/apps-private/drum-pad/helpers';
import calculatorSource from '../src/components/apps-private/drum-pad/Calculator.astro?raw';

const rngFor = (seed: number) => mulberry32(seed);
const randomPattern = (rng: () => number): Pattern => Array.from({ length: PAD_COUNT }, () => Math.floor(rng() * 65536));

/** Independent step length: a beat lasts 60/bpm seconds, a step is a quarter of a beat. */
const refStep = (bpm: number): number => 60 / bpm / 4;

/**
 * Independent scheduler: simulate the page timer firing every 25 ms for `seconds`, the
 * way the page does, and collect every event with the tick time it was handed out at.
 */
const simulate = (bpm: number, swing: number, seconds: number, startAt = 0.06, tickMs = TICK_MS) => {
  let state: SchedState = { gridTime: startAt, index: 0 };
  const got: { ev: StepEvent; at: number }[] = [];
  for (let now = 0; now <= seconds; now += tickMs / 1000) {
    const r = planSteps(state, now, bpm, swing);
    state = r.next;
    for (const ev of r.events) got.push({ ev, at: now });
  }
  return got;
};

describe('constants the page relies on', () => {
  it('has the documented sizes and limits', () => {
    expect(STEPS).toBe(16);
    expect(PAD_COUNT).toBe(16);
    expect(BPM_MIN).toBe(60);
    expect(BPM_MAX).toBe(180);
    expect(SWING_MAX).toBe(50);
    expect(MASTER_PEAK).toBe(0.15);
    expect(MAX_VOICES).toBe(12);
    expect(LOOKAHEAD).toBe(0.1);
    expect(TICK_MS).toBe(25);
    expect(MAX_VOICE_SECONDS).toBe(1);
  });
});

describe('seeded randomness and noise', () => {
  it('same seed, same noise; different seed, different noise', () => {
    expect(noiseSamples(256, 7)).toEqual(noiseSamples(256, 7));
    expect(noiseSamples(256, 7)).not.toEqual(noiseSamples(256, 8));
  });
  it('noise is bounded, roughly centred and fills the range', () => {
    const n = noiseSamples(20000, 99);
    expect(n.length).toBe(20000);
    expect(n.every((x) => Number.isFinite(x) && x >= -1 && x < 1)).toBe(true);
    const mean = n.reduce((s, x) => s + x, 0) / n.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.min(...n)).toBeLessThan(-0.99);
    expect(Math.max(...n)).toBeGreaterThan(0.99);
  });
  it('rejects absurd lengths', () => {
    expect(() => noiseSamples(-1, 1)).toThrow(RangeError);
    expect(() => noiseSamples(1.5, 1)).toThrow(RangeError);
    expect(() => noiseSamples(2_000_000, 1)).toThrow(RangeError);
    expect(noiseSamples(0, 1)).toEqual([]);
  });
});

describe('sanitisers', () => {
  it('clamp tempo, swing and volume and refuse junk', () => {
    expect(clampBpm(59)).toBe(60);
    expect(clampBpm(181)).toBe(180);
    expect(clampBpm(100.4)).toBe(100);
    expect(clampBpm('120')).toBe(120);
    for (const junk of [NaN, Infinity, -Infinity, '', 'abc', null, undefined, [], {}, [90], true, '__proto__']) {
      expect(clampBpm(junk), String(junk)).toBe(BPM_DEFAULT);
    }
    expect(clampSwing(-5)).toBe(0);
    expect(clampSwing(99)).toBe(50);
    expect(clampSwing('33')).toBe(33);
    expect(clampSwing('x')).toBe(0);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(1000)).toBe(100);
    expect(clampVolume(NaN)).toBe(60);
  });
  it('master gain is volume/100 of 0.15 and never above it', () => {
    expect(masterGain(0)).toBe(0);
    expect(masterGain(100)).toBe(0.15);
    expect(masterGain(60)).toBeCloseTo(0.09, 12);
    for (const v of [-50, 0, 1, 50, 100, 101, 1e9, Infinity, NaN, 'loud', null, undefined, {}]) {
      const g = masterGain(v);
      expect(Number.isFinite(g), String(v)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(MASTER_PEAK);
    }
  });
});

describe('midiToFreq', () => {
  it('A4 is 440 Hz and an octave doubles', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(81)).toBeCloseTo(880, 9);
    expect(midiToFreq(57)).toBeCloseTo(220, 9);
  });
  it('the bass pads sit on C2, E2, G2 and C3', () => {
    expect(midiToFreq(36)).toBeCloseTo(65.4064, 3);
    expect(midiToFreq(40)).toBeCloseTo(82.4069, 3);
    expect(midiToFreq(43)).toBeCloseTo(97.9989, 3);
    expect(midiToFreq(48)).toBeCloseTo(130.8128, 3);
  });
});

describe('pads', () => {
  it('there are 16, with unique ids, names, glyphs and keys', () => {
    expect(PADS.length).toBe(16);
    for (const field of ['id', 'name', 'glyph', 'key'] as const) {
      expect(new Set(PADS.map((p) => p[field])).size, field).toBe(16);
    }
  });
  it('are four families of four, in rows', () => {
    const families = ['drums', 'cymbals', 'toms', 'bass'];
    families.forEach((f, row) => {
      for (let c = 0; c < 4; c++) expect(PADS[row * 4 + c].family).toBe(f);
    });
  });
  it('keys follow the 4x4 keyboard layout 1234 / QWER / ASDF / ZXCV', () => {
    expect(PADS.map((p) => p.key).join('')).toBe('1234qwerasdfzxcv');
    expect(padForKey('1')).toBe(0);
    expect(padForKey('Q')).toBe(4);
    expect(padForKey('q')).toBe(4);
    expect(padForKey('v')).toBe(15);
    for (const junk of ['', ' ', 'Enter', 'ab', 'p', '5', '[', null, undefined, 7, {}]) expect(padForKey(junk), String(junk)).toBe(-1);
  });
  it('every glyph is one character from the Geometric Shapes block', () => {
    for (const p of PADS) {
      expect(p.glyph.length).toBe(1);
      const cp = p.glyph.codePointAt(0) as number;
      expect(cp).toBeGreaterThanOrEqual(0x25a0);
      expect(cp).toBeLessThanOrEqual(0x25ff);
    }
  });
  it('names are short enough for a 56 px pad', () => {
    for (const p of PADS) expect(p.name.length).toBeLessThanOrEqual(12);
  });
});

describe('voice recipes', () => {
  it('every pad recipe is inside the safe numeric bounds', () => {
    for (const p of PADS) expect(recipeProblems(p.recipe), p.id).toEqual([]);
  });
  it('every pad ends within one second', () => {
    for (const p of PADS) {
      const d = recipeDuration(p.recipe);
      expect(d, p.id).toBeGreaterThan(0.03);
      expect(d, p.id).toBeLessThanOrEqual(MAX_VOICE_SECONDS);
    }
  });
  it('every number is finite and every gain is at most 1', () => {
    for (const p of PADS) {
      const nums: number[] = [];
      for (const o of p.recipe.oscs) nums.push(o.f0, o.f1, o.sweep, o.gain, o.attack, o.decay);
      if (p.recipe.noise) {
        const n = p.recipe.noise;
        nums.push(n.freq, n.q, n.gain, n.attack, n.decay, n.bursts, n.burstGap);
      }
      for (const x of nums) expect(Number.isFinite(x), p.id).toBe(true);
      for (const o of p.recipe.oscs) expect(o.gain).toBeLessThanOrEqual(1);
    }
  });
  it('the kick falls from 150 Hz to 45 Hz and the clap is three bursts', () => {
    const kick = PADS.find((p) => p.id === 'kick')!;
    expect(kick.recipe.oscs[0].f0).toBe(150);
    expect(kick.recipe.oscs[0].f1).toBe(45);
    const clap = PADS.find((p) => p.id === 'clap')!;
    expect(clap.recipe.noise?.bursts).toBe(3);
  });
  it('recipeProblems catches broken recipes (the checker itself works)', () => {
    const good = PADS[0].recipe;
    expect(recipeProblems({ oscs: [], noise: null })).toContain('silent recipe');
    expect(recipeProblems({ oscs: [{ ...good.oscs[0], f0: NaN }], noise: null })).toContain('frequency');
    expect(recipeProblems({ oscs: [{ ...good.oscs[0], f0: 5 }], noise: null })).toContain('frequency');
    expect(recipeProblems({ oscs: [{ ...good.oscs[0], gain: 2 }], noise: null })).toContain('gain');
    expect(recipeProblems({ oscs: [{ ...good.oscs[0], decay: 5 }], noise: null })).toContain('decay');
    expect(recipeProblems({ oscs: [{ ...good.oscs[0], sweep: 0 }], noise: null })).toContain('glide without a sweep time');
    expect(recipeProblems({ oscs: [], noise: { filter: 'bandpass', freq: 1000, q: 1, gain: 0.5, attack: 0.002, decay: 0.1, bursts: 3, burstGap: 0.001 } })).toContain('burst gap');
    expect(recipeProblems({ oscs: [], noise: { filter: 'bandpass', freq: 1000, q: 1, gain: 0.5, attack: 0.002, decay: 0.1, bursts: 9, burstGap: 0.01 } })).toContain('bursts');
  });
});

describe('polyphony cap', () => {
  it('steals the oldest voice that has already started', () => {
    expect(pickVoiceToSteal([5, 1, 3], 10)).toBe(1);
    expect(pickVoiceToSteal([0.2, 0.1, 0.3], 0.25)).toBe(1);
  });
  it('never picks a voice that is only waiting to start', () => {
    expect(pickVoiceToSteal([5, 6, 7], 1)).toBe(-1);
    expect(pickVoiceToSteal([], 1)).toBe(-1);
    expect(pickVoiceToSteal([9, 2, 8], 2)).toBe(1);
    expect(pickVoiceToSteal([2], 2)).toBe(0); // starting exactly now counts as started
  });
  it('agrees with a naive minimum on random inputs', () => {
    const rng = rngFor(5);
    for (let t = 0; t < 500; t++) {
      const starts = Array.from({ length: Math.floor(rng() * 14) }, () => Math.round(rng() * 100) / 10);
      const now = Math.round(rng() * 100) / 10;
      const ok = starts.map((s, i) => ({ s, i })).filter((x) => x.s <= now);
      const k = pickVoiceToSteal(starts, now);
      if (ok.length === 0) expect(k).toBe(-1);
      else expect(starts[k]).toBe(Math.min(...ok.map((x) => x.s)));
    }
  });
});

describe('step timing arithmetic', () => {
  it('a step is 15 / bpm seconds, matching 60 / bpm / 4', () => {
    for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm++) {
      expect(stepDuration(bpm)).toBeCloseTo(refStep(bpm), 14);
    }
  });
  it('is exact at tempos whose step length is a binary fraction', () => {
    expect(stepDuration(60)).toBe(0.25);
    expect(stepDuration(120)).toBe(0.125);
    expect(stepDuration(96)).toBe(0.15625);
    expect(stepDuration(80)).toBe(0.1875);
    expect(stepDuration(150)).toBeCloseTo(0.1, 15);
  });
  it('swing holds back every second step by a percentage of one step', () => {
    expect(swingOffset(120, 0)).toBe(0);
    expect(swingOffset(120, 50)).toBe(0.0625);
    expect(swingOffset(120, 40)).toBeCloseTo(0.05, 15);
    expect(swingOffset(60, 25)).toBe(0.0625);
    for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm += 5) {
      // The swung step must stay before the next straight step so order never flips.
      expect(swingOffset(bpm, SWING_MAX)).toBeLessThan(stepDuration(bpm));
      expect(swingOffset(bpm, SWING_MAX)).toBeCloseTo(stepDuration(bpm) / 2, 15);
    }
  });
  it('closed form: step n starts at start + n*step, plus swing on odd n', () => {
    expect(stepTimeFromStart(1, 0, 120, 0)).toBe(1);
    expect(stepTimeFromStart(1, 4, 120, 0)).toBe(1.5);
    expect(stepTimeFromStart(0, 16, 120, 0)).toBe(2); // one bar of 16 steps = 4 beats = 2 s at 120 BPM
    expect(stepTimeFromStart(0, 1, 120, 50)).toBe(0.125 + 0.0625);
    expect(stepTimeFromStart(0, 2, 120, 50)).toBe(0.25);
    expect(stepTimeFromStart(0, 3, 120, 50)).toBe(0.375 + 0.0625);
  });
});

describe('the look-ahead scheduler', () => {
  it('hands out exactly the steps inside the window, at 120 BPM from time 0', () => {
    let s: SchedState = { gridTime: 0, index: 0 };
    // Window is [now, now + 0.1). Step 0 is at 0, step 1 at 0.125.
    let r = planSteps(s, 0, 120, 0);
    expect(r.events).toEqual([{ index: 0, step: 0, time: 0 }]);
    s = r.next;
    expect(s).toEqual({ gridTime: 0.125, index: 1 });
    r = planSteps(s, 0.02, 120, 0); // horizon 0.12: the step at 0.125 is not inside yet
    expect(r.events).toEqual([]);
    expect(r.next).toEqual(s);
    s = r.next;
    r = planSteps(s, 0.05, 120, 0); // horizon 0.15
    expect(r.events).toEqual([{ index: 1, step: 1, time: 0.125 }]);
    s = r.next;
    r = planSteps(s, 0.075, 120, 0); // horizon 0.175, next step is at 0.25
    expect(r.events).toEqual([]);
    r = planSteps(s, 0.14, 120, 0); // horizon 0.24: still excluded
    expect(r.events).toEqual([]);
    r = planSteps(s, 0.16, 120, 0); // horizon 0.26
    expect(r.events).toEqual([{ index: 2, step: 2, time: 0.25 }]);
  });

  it('simulated page timer: every step exactly once, in order, at its exact time (120 BPM)', () => {
    const got = simulate(120, 0, 8);
    // Steps at 0.06 + k*0.125 for k = 0.. while time <= 8 + lookahead.
    got.forEach((g, k) => {
      expect(g.ev.index).toBe(k);
      expect(g.ev.step).toBe(k % 16);
      expect(g.ev.time).toBeCloseTo(0.06 + k * 0.125, 9);
      // Handed out before it is due, but never more than the look-ahead early.
      expect(g.at).toBeLessThanOrEqual(g.ev.time + 1e-9);
      expect(g.ev.time - g.at).toBeLessThan(LOOKAHEAD + 1e-9);
    });
    expect(got.length).toBeGreaterThanOrEqual(64);
  });

  it('is exact at 120 BPM when the start is a binary fraction', () => {
    const got = simulate(120, 0, 4, 0.5);
    got.forEach((g, k) => expect(g.ev.time).toBe(0.5 + k * 0.125));
  });

  it('agrees with the closed form at every tempo and swing, within 1e-9', () => {
    for (const bpm of [60, 61, 77, 96, 100, 124, 133, 150, 179, 180]) {
      for (const swing of [0, 20, 33, 50]) {
        const got = simulate(bpm, swing, 6, 0.06);
        expect(got.length, `${bpm}/${swing}`).toBeGreaterThan(10);
        got.forEach((g, k) => {
          expect(g.ev.index).toBe(k);
          expect(Math.abs(g.ev.time - stepTimeFromStart(0.06, k, bpm, swing)), `${bpm}/${swing}/${k}`).toBeLessThan(1e-9);
        });
      }
    }
  });

  it('swung steps stay in order and odd steps land later than the straight grid', () => {
    const got = simulate(120, 40, 4, 0);
    for (let k = 1; k < got.length; k++) expect(got[k].ev.time).toBeGreaterThan(got[k - 1].ev.time);
    got.forEach((g, k) => {
      const straight = k * 0.125;
      expect(g.ev.time).toBeCloseTo(k % 2 === 1 ? straight + 0.05 : straight, 12);
    });
  });

  it('a bar of 16 steps lasts 4 beats whatever the swing (even steps do not move)', () => {
    for (const swing of [0, 30, 50]) {
      const got = simulate(100, swing, 6, 0);
      expect(got[16].ev.time).toBeCloseTo((60 / 100) * 4, 9);
      expect(got[32].ev.time).toBeCloseTo((60 / 100) * 8, 9);
    }
  });

  it('follows a tempo change from the very next step', () => {
    let state: SchedState = { gridTime: 0, index: 0 };
    const times: number[] = [];
    let bpm = 120;
    for (let now = 0; now < 3; now += 0.025) {
      if (now >= 1.5) bpm = 60;
      const r = planSteps(state, now, bpm, 0);
      state = r.next;
      r.events.forEach((e) => times.push(e.time));
    }
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps[0]).toBeCloseTo(0.125, 12);
    expect(gaps[gaps.length - 1]).toBeCloseTo(0.25, 12);
    expect(gaps.every((x) => x > 0)).toBe(true);
    // Every gap is one of the two step lengths (a step handed out under the old tempo may already be queued).
    for (const gp of gaps) expect([0.125, 0.25].some((v) => Math.abs(v - gp) < 1e-9)).toBe(true);
  });

  it('caps one tick and re-anchors after a long stall instead of firing a burst', () => {
    const state: SchedState = { gridTime: 0, index: 6 };
    const r = planSteps(state, 30, 180, 0); // the tab was frozen for 30 seconds
    expect(r.events.length).toBeLessThanOrEqual(MAX_EVENTS_PER_TICK);
    expect(r.events[0].time).toBe(30); // re-anchored to now, not 30 seconds in the past
    expect(r.events[0].index).toBe(6);
    for (const e of r.events) {
      expect(e.time).toBeGreaterThanOrEqual(30);
      expect(e.time).toBeLessThan(30 + LOOKAHEAD + 1e-9);
    }
  });

  it('a step that is only slightly late is played immediately, never in the past', () => {
    const state: SchedState = { gridTime: 1, index: 0 };
    const r = planSteps(state, 1.1, 120, 0); // 100 ms late, inside LATE_LIMIT
    expect(LATE_LIMIT).toBeGreaterThan(0.1);
    expect(r.events[0].time).toBe(1.1);
    expect(r.next.gridTime).toBeCloseTo(1 + 0.125 * r.events.length, 12);
  });

  it('never throws and never goes backwards on random clocks, tempos and swings', () => {
    const rng = rngFor(11);
    let state: SchedState = { gridTime: 0, index: 0 };
    let now = 0;
    let lastIndex = -1;
    let lastTime = -Infinity;
    for (let t = 0; t < 4000; t++) {
      now += rng() * 0.2; // timer jitter, sometimes a long pause
      const bpm = 40 + Math.floor(rng() * 160);
      const swing = Math.floor(rng() * 70) - 10;
      const r = planSteps(state, now, bpm, swing);
      state = r.next;
      for (const e of r.events) {
        expect(Number.isFinite(e.time)).toBe(true);
        expect(e.index).toBe(lastIndex + 1);
        expect(e.step).toBe(e.index % 16);
        expect(e.time).toBeGreaterThanOrEqual(now);
        expect(e.time).toBeGreaterThanOrEqual(lastTime - 0.2); // swing can pull a step back only inside one step
        lastIndex = e.index;
        lastTime = Math.max(lastTime, e.time);
      }
      expect(r.events.length).toBeLessThanOrEqual(MAX_EVENTS_PER_TICK);
    }
  });
});

describe('patterns', () => {
  it('toggling flips exactly one bit and never changes the input', () => {
    const p = emptyPattern();
    const q = toggleStep(p, 3, 5);
    expect(p).toEqual(emptyPattern());
    expect(stepOn(q, 3, 5)).toBe(true);
    expect(countHits(q)).toBe(1);
    expect(toggleStep(q, 3, 5)).toEqual(emptyPattern());
    expect(q[3]).toBe(32);
    expect(toggleStep(emptyPattern(), 15, 15)[15]).toBe(0x8000);
  });
  it('rejects pads and steps out of range', () => {
    for (const bad of [-1, 16, 1.5, NaN]) {
      expect(() => toggleStep(emptyPattern(), bad, 0)).toThrow(RangeError);
      expect(() => toggleStep(emptyPattern(), 0, bad)).toThrow(RangeError);
      expect(() => stepOn(emptyPattern(), bad, 0)).toThrow(RangeError);
      expect(() => hitsAt(emptyPattern(), bad)).toThrow(RangeError);
      expect(() => countHitsOnPad(emptyPattern(), bad)).toThrow(RangeError);
    }
  });
  it('counts agree with a naive bit-by-bit count on random patterns', () => {
    const rng = rngFor(21);
    for (let t = 0; t < 300; t++) {
      const p = randomPattern(rng);
      let hits = 0;
      let tracks = 0;
      for (let pad = 0; pad < 16; pad++) {
        let onPad = 0;
        for (let s = 0; s < 16; s++) if (stepOn(p, pad, s)) onPad++;
        expect(countHitsOnPad(p, pad)).toBe(onPad);
        hits += onPad;
        if (onPad > 0) tracks++;
      }
      expect(countHits(p)).toBe(hits);
      expect(tracksUsed(p)).toBe(tracks);
    }
  });
  it('hitsAt lists exactly the pads that sound on a step, in order', () => {
    const rng = rngFor(22);
    for (let t = 0; t < 200; t++) {
      const p = randomPattern(rng);
      for (let s = 0; s < 16; s++) {
        const expected: number[] = [];
        for (let pad = 0; pad < 16; pad++) if (stepOn(p, pad, s)) expected.push(pad);
        expect(hitsAt(p, s)).toEqual(expected);
      }
    }
  });
  it('a full pattern has 256 hits', () => {
    const full = Array.from({ length: 16 }, () => 0xffff);
    expect(countHits(full)).toBe(256);
    expect(tracksUsed(full)).toBe(16);
  });
});

describe('share code', () => {
  it('encodes 16 pads as 64 lower-case hex digits', () => {
    expect(encodePattern(emptyPattern())).toBe('0'.repeat(64));
    expect(encodePattern(toggleStep(emptyPattern(), 0, 0))).toBe('0001' + '0'.repeat(60));
    expect(encodePattern(toggleStep(emptyPattern(), 15, 15))).toBe('0'.repeat(60) + '8000');
    expect(encodePattern(Array.from({ length: 16 }, () => 0xffff))).toBe('f'.repeat(64));
  });
  it('round trips random patterns', () => {
    const rng = rngFor(31);
    for (let t = 0; t < 500; t++) {
      const p = randomPattern(rng);
      const s = encodePattern(p);
      expect(s).toMatch(/^[0-9a-f]{64}$/);
      expect(decodePattern(s)).toEqual(p);
    }
  });
  it('rejects junk instead of guessing', () => {
    const good = '0'.repeat(64);
    expect(decodePattern(good)).not.toBeNull();
    for (const bad of ['', '0'.repeat(63), '0'.repeat(65), 'g'.repeat(64), 'F'.repeat(64), ' ' + '0'.repeat(63), '__proto__', null, undefined, 5, [], {}, ['0'.repeat(64)], '0x' + '0'.repeat(62)]) {
      expect(decodePattern(bad as unknown), String(bad)).toBeNull();
    }
  });
});

describe('preset beats', () => {
  it('there are seven, with unique ids and names', () => {
    expect(PRESETS.length).toBe(7);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(7);
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(7);
  });
  it('every preset parses, names real pads, has sane tempo and swing and makes sound', () => {
    for (const pr of PRESETS) {
      const p = presetPattern(pr);
      expect(p.length).toBe(16);
      expect(countHits(p), pr.id).toBeGreaterThanOrEqual(8);
      expect(pr.bpm).toBeGreaterThanOrEqual(BPM_MIN);
      expect(pr.bpm).toBeLessThanOrEqual(BPM_MAX);
      expect(Number.isInteger(pr.bpm)).toBe(true);
      expect(pr.swing).toBeGreaterThanOrEqual(0);
      expect(pr.swing).toBeLessThanOrEqual(SWING_MAX);
      for (const id of Object.keys(pr.rows)) expect(PADS.some((x) => x.id === id), `${pr.id}/${id}`).toBe(true);
      // The share code round trips for every preset.
      expect(decodePattern(encodePattern(p))).toEqual(p);
    }
  });
  it('rows are placed on the right steps (the first character is step 1)', () => {
    const rock = presetPattern(PRESETS[0]);
    const kick = PADS.findIndex((p) => p.id === 'kick');
    const snare = PADS.findIndex((p) => p.id === 'snare');
    const hat = PADS.findIndex((p) => p.id === 'hat');
    expect([0, 8, 10].every((s) => stepOn(rock, kick, s))).toBe(true);
    expect(countHitsOnPad(rock, kick)).toBe(3);
    expect([4, 12].every((s) => stepOn(rock, snare, s))).toBe(true);
    expect(countHitsOnPad(rock, snare)).toBe(2);
    expect(countHitsOnPad(rock, hat)).toBe(8);
    expect(PRESETS[0].bpm).toBe(100);
  });
  it('the shuffle preset has swing and the dance preset is faster than the slow groove', () => {
    expect(findPreset('shuffle')?.swing).toBe(33);
    expect((findPreset('dance')?.bpm as number)).toBeGreaterThan(findPreset('slow')?.bpm as number);
    expect(findPreset('nope')).toBeUndefined();
    expect(findPreset(5)).toBeUndefined();
    expect(findPreset('__proto__')).toBeUndefined();
  });
  it('a malformed preset is rejected', () => {
    expect(() => presetPattern({ id: 'x', name: 'x', bpm: 100, swing: 0, rows: { nope: 'x...............' } })).toThrow(RangeError);
    expect(() => presetPattern({ id: 'x', name: 'x', bpm: 100, swing: 0, rows: { kick: 'x..............' } })).toThrow(RangeError);
    expect(() => presetPattern({ id: 'x', name: 'x', bpm: 100, swing: 0, rows: { kick: 'x...............y' } })).toThrow(RangeError);
  });
});

describe('page address state', () => {
  it('a valid code wins and tempo and swing are clamped', () => {
    const p = presetPattern(PRESETS[2]);
    const r = readBeat('999', '99', encodePattern(p));
    expect(r.fromUrl).toBe(true);
    expect(r.pattern).toEqual(p);
    expect(r.bpm).toBe(180);
    expect(r.swing).toBe(50);
  });
  it('anything else falls back to the first preset', () => {
    for (const code of ['', 'zz', undefined, null, 12, '0'.repeat(63)]) {
      const r = readBeat(77, 20, code);
      expect(r.fromUrl).toBe(false);
      expect(r.pattern).toEqual(presetPattern(PRESETS[0]));
      expect(r.bpm).toBe(PRESETS[0].bpm);
      expect(r.swing).toBe(PRESETS[0].swing);
    }
  });
});

describe('copy text', () => {
  it('pluralises and is correct for an empty beat', () => {
    expect(plural(1, 'hit')).toBe('1 hit');
    expect(plural(0, 'hit')).toBe('0 hits');
    expect(plural(2, 'hit')).toBe('2 hits');
    expect(shareLine(emptyPattern(), 100, 0)).toBe('Drum Pad - an empty beat at 100 BPM');
    expect(shareLine(toggleStep(emptyPattern(), 0, 0), 120, 30)).toBe('Drum Pad - a beat with 1 hit on 1 sound, 120 BPM, swing 30%');
    expect(shareLine(presetPattern(PRESETS[0]), 100, 0)).toBe('Drum Pad - a beat with 13 hits on 3 sounds, 100 BPM, swing 0%');
    expect(shareLine(emptyPattern(), 9999, 9999)).toBe('Drum Pad - an empty beat at 180 BPM');
  });
});

describe('fuzz', () => {
  it('thousands of random edits keep the pattern valid and the code round tripping', () => {
    const rng = rngFor(77);
    let p = emptyPattern();
    for (let t = 0; t < 5000; t++) {
      p = toggleStep(p, Math.floor(rng() * 16), Math.floor(rng() * 16));
      expect(p.length).toBe(16);
      expect(p.every((m) => Number.isInteger(m) && m >= 0 && m <= 0xffff)).toBe(true);
      if (t % 97 === 0) expect(decodePattern(encodePattern(p))).toEqual(p);
    }
  });
});

describe('page source: sound toggles and the legend', () => {
  const src = calculatorSource;
  it('cancels waiting voices and restarts the grid on every sound toggle, resume and clock change', () => {
    expect(src).toMatch(/const cancelPending = /);
    expect(src).toMatch(/if \(mode !== lastMode \|\| gridDirty\)/);
    expect((src.match(/gridDirty = true/g) ?? []).length).toBe(2);
    expect((src.match(/cancelPending\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it('keeps each legend swatch with its label in one unbreakable item', () => {
    expect((src.match(/<span class="dp-leg">/g) ?? []).length).toBe(3);
    expect(src).toMatch(/\.dp-leg \{[^}]*white-space: nowrap/);
  });
});