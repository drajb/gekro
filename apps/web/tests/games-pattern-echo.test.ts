/**
 * games-pattern-echo.test.ts - the engine behind `pattern-echo`.
 *
 * Pinned: six pads with distinct shapes, colours and notes in a C major pentatonic scale
 * (frequencies equal the equal-temperament formula); the sequence never has the same pad three
 * times in a row, is uniform over the allowed pads, only grows at the end and replays exactly
 * from a seed; a run checks every press against an independent naive model, a mistake never ends
 * the run and shows the same sequence again, finishing a sequence adds exactly one pad, and 20
 * wins; step timing scales with speed and length and never lets a light flash more than three
 * times a second; the sound numbers keep every tone at or below the 0.15 gain ceiling; the
 * best-score bookkeeping and the text are pinned too.
 */
import { describe, it, expect } from 'vitest';
import {
  PADS, PAD_COUNT, MAX_LEN, SPEEDS, SPEED_LABEL, BASE_STEP_MS, MIN_STEP_MS, MAX_FLASHES_PER_SECOND, PEAK_GAIN, MAX_VOICES, GAIN_CEILING, SOFT_TONE,
  mulberry32, allowedPads, nextPad, extendSequence, makeSequence, newRun, beginInput, replay, pressPad,
  stepMs, litMs, gapMs, showMs, midiToFreq, padFrequency, toneEnvelope, envelopeAt,
  bestKey, parseBests, recordBest, parseSpeed, padLabel, watchMessage, turnMessage, okMessage, completeMessage, missMessage, winMessage, shareText,
  type Run,
} from '../src/components/apps-private/pattern-echo/helpers';
import calculatorSource from '../src/components/apps-private/pattern-echo/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');

describe('the pads', () => {
  it('there are six, numbered 0 to 5, each with its own shape, colour and note', () => {
    expect(PAD_COUNT).toBe(6);
    expect(PADS.map((p) => p.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(PADS.map((p) => p.shape)).size).toBe(6);
    expect(new Set(PADS.map((p) => p.colour)).size).toBe(6);
    expect(new Set(PADS.map((p) => p.midi)).size).toBe(6);
    expect(new Set(PADS.map((p) => p.note)).size).toBe(6);
  });
  it('the notes are a C major pentatonic scale (C D E G A C), rising around the ring', () => {
    const classes = PADS.map((p) => p.midi % 12);
    expect(classes).toEqual([0, 2, 4, 7, 9, 0]);
    for (const c of classes) expect([0, 2, 4, 7, 9]).toContain(c);
    for (let i = 1; i < PADS.length; i++) expect(PADS[i].midi).toBeGreaterThan(PADS[i - 1].midi);
    expect(PADS.map((p) => p.note)).toEqual(['C4', 'D4', 'E4', 'G4', 'A4', 'C5']);
  });
  it('there are 6 pads, not four and not coloured in the four-quadrant way', () => {
    expect(PADS.length).not.toBe(4);
    expect(PADS.map((p) => p.colour)).toEqual(['sky blue', 'green', 'amber', 'rose', 'violet', 'orange']);
  });
  it('labels every pad with its number, shape, colour and note', () => {
    expect(padLabel(2)).toBe('Pad 3, triangle, amber, note E4');
    for (const p of PADS) expect(padLabel(p.id)).toContain(`Pad ${p.id + 1},`);
  });
});

describe('tone numbers', () => {
  it('midiToFreq is equal temperament with A4 = 440', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(81)).toBeCloseTo(880, 9);
    expect(midiToFreq(57)).toBeCloseTo(220, 9);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
    expect(midiToFreq(72)).toBeCloseTo(2 * midiToFreq(60), 9);
    // Every semitone is the same ratio.
    for (let m = 40; m < 90; m++) expect(midiToFreq(m + 1) / midiToFreq(m)).toBeCloseTo(Math.pow(2, 1 / 12), 12);
  });
  it('the pad frequencies match known pitches and rise', () => {
    const f = PADS.map((p) => padFrequency(p.id));
    const expected = [261.6256, 293.6648, 329.6276, 391.9954, 440, 523.2511];
    f.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 3));
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThan(f[i - 1]);
    expect(f.every((x) => x > 200 && x < 600)).toBe(true);
    expect(padFrequency(-4)).toBe(f[0]);
    expect(padFrequency(99)).toBe(f[5]);
  });
  it('every tone envelope fits the duration and stays at or under the gain ceiling', () => {
    expect(GAIN_CEILING).toBe(0.15);
    expect(PEAK_GAIN * MAX_VOICES).toBeLessThanOrEqual(GAIN_CEILING);
    for (const ms of [60, 150, 200, 300, 500, 2000]) {
      const e = toneEnvelope(ms);
      expect(e.attack + e.hold + e.release).toBeCloseTo(ms / 1000, 9);
      expect(e.attack).toBeGreaterThan(0);
      expect(e.release).toBeGreaterThan(0);
      expect(e.peak).toBeLessThanOrEqual(PEAK_GAIN);
      expect(e.peak).toBeLessThanOrEqual(GAIN_CEILING);
    }
  });
  it('clamps silly durations and loud peaks', () => {
    expect(toneEnvelope(NaN).attack + toneEnvelope(NaN).hold + toneEnvelope(NaN).release).toBeCloseTo(0.2, 9);
    expect(toneEnvelope(-5).peak).toBeLessThanOrEqual(PEAK_GAIN);
    expect(toneEnvelope(100, 5).peak).toBe(PEAK_GAIN);
    expect(toneEnvelope(100, -1).peak).toBe(0);
    const long = toneEnvelope(1e9);
    expect(long.attack + long.hold + long.release).toBeCloseTo(2, 9);
  });
  it('envelopeAt follows the scheduled attack, hold and release and never passes the peak', () => {
    for (const ms of [60, 200, 2000]) {
      const e = toneEnvelope(ms);
      expect(envelopeAt(e, 0)).toBe(0);
      expect(envelopeAt(e, e.attack / 2)).toBeCloseTo(e.peak / 2, 9);
      expect(envelopeAt(e, e.attack + e.hold / 2)).toBe(e.peak);
      expect(envelopeAt(e, e.attack + e.hold + e.release / 2)).toBeCloseTo(e.peak / 2, 9);
      expect(envelopeAt(e, e.attack + e.hold + e.release + 1)).toBe(0);
      for (let t = -0.1; t < ms / 1000 + 0.1; t += 0.003) {
        const g = envelopeAt(e, t);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(PEAK_GAIN);
      }
    }
    expect(envelopeAt(toneEnvelope(200), NaN)).toBe(0);
  });
  it('the soft tone after a mistake is quieter than a pad tone and short', () => {
    expect(SOFT_TONE.peak).toBeLessThan(PEAK_GAIN);
    expect(SOFT_TONE.peak).toBeLessThanOrEqual(GAIN_CEILING);
    expect(SOFT_TONE.ms).toBeLessThanOrEqual(500);
    expect(SOFT_TONE.freq).toBeLessThan(padFrequency(0));
  });
});

describe('the sequence', () => {
  it('allows all six pads, or five when the last two are the same pad', () => {
    expect(allowedPads([])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(allowedPads([3])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(allowedPads([1, 2])).toHaveLength(6);
    expect(allowedPads([2, 2])).toEqual([0, 1, 3, 4, 5]);
    expect(allowedPads([0, 5, 5])).toEqual([0, 1, 2, 3, 4]);
    expect(allowedPads([4, 4, 1])).toHaveLength(6);
  });
  it('never has the same pad three times in a row (checked by scanning thousands of sequences)', () => {
    for (let seed = 1; seed <= 600; seed++) {
      const s = makeSequence(MAX_LEN, mulberry32(seed));
      expect(s).toHaveLength(MAX_LEN);
      for (let i = 2; i < s.length; i++) {
        expect(s[i] === s[i - 1] && s[i] === s[i - 2], `seed ${seed} position ${i}`).toBe(false);
      }
      expect(s.every((p) => Number.isInteger(p) && p >= 0 && p < PAD_COUNT)).toBe(true);
    }
  });
  it('can repeat a pad twice in a row, so the rule is no stricter than it says', () => {
    let pairs = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = makeSequence(MAX_LEN, mulberry32(seed));
      for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) pairs++;
    }
    // Chance of an equal pair is 1/6: about 633 of 3800 pairs.
    expect(pairs).toBeGreaterThan(500);
    expect(pairs).toBeLessThan(780);
  });
  it('each pad appears about a sixth of the time', () => {
    const c = new Array<number>(6).fill(0);
    let n = 0;
    for (let seed = 1; seed <= 3000; seed++) for (const p of makeSequence(MAX_LEN, mulberry32(seed))) { c[p]++; n++; }
    for (const x of c) expect(Math.abs(x / n - 1 / 6)).toBeLessThan(0.01);
  });
  it('after two equal pads the next one is spread evenly over the other five', () => {
    const c = new Array<number>(6).fill(0);
    const rng = mulberry32(99);
    const trials = 60000;
    for (let i = 0; i < trials; i++) c[nextPad([2, 2], rng)]++;
    expect(c[2]).toBe(0);
    for (const p of [0, 1, 3, 4, 5]) expect(Math.abs(c[p] / trials - 0.2)).toBeLessThan(0.01);
  });
  it('picks the first and last allowed pad at the ends of the random range, and survives a broken generator', () => {
    expect(nextPad([], () => 0)).toBe(0);
    expect(nextPad([], () => 0.9999999)).toBe(5);
    expect(nextPad([5, 5], () => 0.9999999)).toBe(4);
    expect(nextPad([0, 0], () => 0)).toBe(1);
    expect(nextPad([], () => NaN)).toBe(0);
    expect(nextPad([], () => -3)).toBe(0);
    expect(nextPad([], () => 9)).toBe(5);
  });
  it('only ever adds a pad at the end; earlier pads never change', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed);
      let s: number[] = [];
      for (let len = 1; len <= MAX_LEN; len++) {
        const longer = extendSequence(s, rng);
        expect(longer).toHaveLength(len);
        expect(longer.slice(0, -1)).toEqual(s);
        s = longer;
      }
    }
  });
  it('makeSequence clamps the length and a seed replays exactly', () => {
    expect(makeSequence(-3, mulberry32(1))).toEqual([]);
    expect(makeSequence(NaN, mulberry32(1))).toEqual([]);
    expect(makeSequence(500, mulberry32(1))).toHaveLength(MAX_LEN);
    expect(makeSequence(12, mulberry32(7))).toEqual(makeSequence(12, mulberry32(7)));
    expect(makeSequence(12, mulberry32(7))).not.toEqual(makeSequence(12, mulberry32(8)));
    // A shorter sequence from one seed is the start of a longer one.
    expect(makeSequence(20, mulberry32(7)).slice(0, 8)).toEqual(makeSequence(8, mulberry32(7)));
  });
});

// An independent model of one press, written from the rules in words.
const naivePress = (seq: number[], progress: number, pad: number): 'ok' | 'complete' | 'miss' => {
  if (pad !== seq[progress]) return 'miss';
  return progress + 1 === seq.length ? 'complete' : 'ok';
};

describe('a run', () => {
  it('starts with a sequence of one pad to watch', () => {
    const r = newRun(mulberry32(1));
    expect(r.seq).toHaveLength(1);
    expect(r).toMatchObject({ progress: 0, completed: 0, misses: 0, status: 'watch' });
  });
  it('only takes presses once the pattern has been shown', () => {
    const r = newRun(mulberry32(1));
    const p = pressPad(r, r.seq[0], mulberry32(2));
    expect(p.result).toBe('ignored');
    expect(p.run).toBe(r);
    const ready = beginInput(r);
    expect(ready.status).toBe('input');
    expect(pressPad(ready, ready.seq[0], mulberry32(2)).result).not.toBe('ignored');
  });
  it('beginInput only works from the watching state, and starts from the first pad', () => {
    const r = newRun(mulberry32(3));
    const input = beginInput({ ...r, progress: 0 });
    expect(beginInput(input)).toBe(input);
    expect(beginInput({ ...input, status: 'won' }).status).toBe('won');
  });
  it('ignores pads that do not exist', () => {
    const r = beginInput(newRun(mulberry32(1)));
    for (const bad of [-1, 6, 2.5, NaN, Infinity]) expect(pressPad(r, bad, mulberry32(1)).result, String(bad)).toBe('ignored');
  });
  it('the right pad moves on, finishing the sequence adds exactly one pad at the end', () => {
    let rng = mulberry32(11);
    let r = beginInput(newRun(rng));
    const first = r.seq.slice();
    const p = pressPad(r, first[0], rng);
    expect(p.result).toBe('complete');
    expect(p.run.seq).toHaveLength(2);
    expect(p.run.seq[0]).toBe(first[0]);
    expect(p.run).toMatchObject({ progress: 0, completed: 1, status: 'watch', misses: 0 });
    r = beginInput(p.run);
    const a = pressPad(r, r.seq[0], rng);
    expect(a.result).toBe('ok');
    expect(a.run.progress).toBe(1);
    expect(a.expected).toBe(r.seq[0]);
  });
  it('a wrong pad is a miss: the same sequence is shown again from the start, nothing is lost', () => {
    const rng = mulberry32(4);
    let r = newRun(rng);
    for (let round = 0; round < 3; round++) {
      r = beginInput(r);
      const shown = r.seq.slice();
      for (const p of shown) r = pressPad(r, p, rng).run;
    }
    expect(r.completed).toBe(3);
    r = beginInput(r);
    const seq = r.seq.slice();
    r = pressPad(r, seq[0], rng).run; // one right
    const wrong = (seq[1] + 1) % PAD_COUNT;
    const m = pressPad(r, wrong, rng);
    expect(m.result).toBe('miss');
    expect(m.expected).toBe(seq[1]);
    expect(m.run).toMatchObject({ seq, progress: 0, completed: 3, misses: 1, status: 'watch' });
  });
  it('misses never end the run: retries are unlimited and the best length is kept', () => {
    const rng = mulberry32(5);
    let r = newRun(rng);
    for (let i = 0; i < 50; i++) {
      r = beginInput(r);
      r = pressPad(r, (r.seq[0] + 1) % PAD_COUNT, rng).run;
    }
    expect(r.misses).toBe(50);
    expect(r.status).toBe('watch');
    expect(r.seq).toHaveLength(1);
    r = beginInput(r);
    expect(pressPad(r, r.seq[0], rng).result).toBe('complete');
  });
  it('replay shows the same sequence again from the start and does nothing to a win', () => {
    const rng = mulberry32(8);
    let r = beginInput(newRun(rng));
    r = pressPad(r, r.seq[0], rng).run;
    r = beginInput(r);
    r = pressPad(r, r.seq[0], rng).run; // progress 1 of 2
    const again = replay(r);
    expect(again).toMatchObject({ seq: r.seq, progress: 0, status: 'watch', completed: r.completed });
    const won: Run = { ...r, status: 'won' };
    expect(replay(won)).toBe(won);
  });
  it('a perfect player reaches the top: lengths climb one at a time to 20 and the run is won', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed);
      let r = newRun(rng);
      let presses = 0;
      for (let level = 1; level <= MAX_LEN; level++) {
        expect(r.seq).toHaveLength(level);
        expect(r.status).toBe('watch');
        r = beginInput(r);
        const shown = r.seq.slice();
        for (let i = 0; i < shown.length; i++) {
          const res = pressPad(r, shown[i], rng);
          presses++;
          r = res.run;
          if (i < level - 1) expect(res.result).toBe('ok');
          else expect(res.result).toBe(level === MAX_LEN ? 'win' : 'complete');
        }
        expect(r.completed).toBe(level);
      }
      expect(r.status).toBe('won');
      expect(r.misses).toBe(0);
      expect(presses).toBe((MAX_LEN * (MAX_LEN + 1)) / 2);
      // Nothing more is accepted after the win.
      expect(pressPad(r, 0, rng).result).toBe('ignored');
    }
  });
  it('agrees with the naive model on tens of thousands of random presses, keeping every invariant', () => {
    const rng = mulberry32(2025);
    const noise = mulberry32(77);
    let r = newRun(rng);
    let longest = 0;
    for (let n = 0; n < 40000; n++) {
      if (r.status === 'won') r = newRun(rng);
      if (r.status === 'watch') r = beginInput(r);
      // Mostly play well, sometimes slip.
      const slip = noise() < 0.12;
      const pad = slip ? Math.floor(noise() * 6) : r.seq[r.progress];
      const model = naivePress(r.seq, r.progress, pad);
      const before = r;
      const res = pressPad(r, pad, rng);
      r = res.run;
      expect(res.expected).toBe(before.seq[before.progress]);
      if (model === 'miss') {
        expect(res.result).toBe('miss');
        expect(r.seq).toEqual(before.seq);
        expect(r.misses).toBe(before.misses + 1);
      } else if (model === 'ok') {
        expect(res.result).toBe('ok');
        expect(r.progress).toBe(before.progress + 1);
      } else {
        expect(['complete', 'win']).toContain(res.result);
        expect(r.completed).toBe(before.seq.length);
        if (res.result === 'complete') expect(r.seq.slice(0, -1)).toEqual(before.seq);
      }
      // Invariants.
      expect(r.completed).toBeLessThanOrEqual(MAX_LEN);
      expect(r.completed).toBeGreaterThanOrEqual(before.completed);
      expect(r.seq.length).toBeGreaterThanOrEqual(1);
      expect(r.seq.length).toBeLessThanOrEqual(MAX_LEN);
      expect(r.progress).toBeLessThanOrEqual(r.seq.length);
      longest = Math.max(longest, r.completed);
    }
    expect(longest).toBeGreaterThan(5);
  }, 60_000);
  it('does not change the run it is given', () => {
    const rng = mulberry32(1);
    const r = beginInput(newRun(rng));
    const before = JSON.stringify(r);
    pressPad(r, r.seq[0], rng);
    pressPad(r, (r.seq[0] + 1) % 6, rng);
    replay(r);
    expect(JSON.stringify(r)).toBe(before);
  });
  it('the same seed gives the same run from start to finish', () => {
    const play = (seed: number) => {
      const rng = mulberry32(seed);
      let r = newRun(rng);
      const log: number[] = [];
      while (r.status !== 'won') {
        r = beginInput(r);
        log.push(...r.seq);
        for (const p of r.seq) r = pressPad(r, p, rng).run;
      }
      return log;
    };
    expect(play(31)).toEqual(play(31));
    expect(play(31)).not.toEqual(play(32));
  });
});

describe('timing', () => {
  it('pins the step times at the start of a run', () => {
    expect(BASE_STEP_MS).toEqual({ easy: 800, medium: 600, hard: 440 });
    expect(SPEEDS.map((s) => stepMs(s, 1))).toEqual([800, 600, 440]);
    expect(SPEEDS.map((s) => stepMs(s, 4))).toEqual([800, 600, 440]);
  });
  it('gets 7 percent quicker every 4 pads', () => {
    expect(stepMs('easy', 5)).toBe(Math.round(800 * 0.93));
    expect(stepMs('easy', 9)).toBe(Math.round(800 * 0.93 * 0.93));
    expect(stepMs('medium', 13)).toBe(Math.round(600 * Math.pow(0.93, 3)));
  });
  it('is never slower for a longer sequence and always ordered Easy > Medium > Hard', () => {
    for (const s of SPEEDS) for (let len = 1; len < MAX_LEN; len++) {
      expect(stepMs(s, len + 1), `${s} ${len}`).toBeLessThanOrEqual(stepMs(s, len));
    }
    for (let len = 1; len <= MAX_LEN; len++) {
      expect(stepMs('easy', len)).toBeGreaterThanOrEqual(stepMs('medium', len));
      expect(stepMs('medium', len)).toBeGreaterThanOrEqual(stepMs('hard', len));
    }
  });
  it('no step is shorter than 340 ms, so a pad never flashes more than 3 times a second', () => {
    expect(MIN_STEP_MS).toBe(340);
    expect(MAX_FLASHES_PER_SECOND).toBe(3);
    for (const s of SPEEDS) for (let len = 1; len <= MAX_LEN + 5; len++) {
      expect(stepMs(s, len)).toBeGreaterThanOrEqual(MIN_STEP_MS);
      expect(1000 / stepMs(s, len)).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
    }
    // The fastest setting reaches the floor late in a run.
    expect(stepMs('hard', MAX_LEN)).toBe(MIN_STEP_MS);
  });
  it('a lit pad is on for 60 percent of its step and then dark for the rest', () => {
    for (const s of SPEEDS) for (const len of [1, 7, 13, 20]) {
      expect(litMs(s, len) + gapMs(s, len)).toBe(stepMs(s, len));
      expect(litMs(s, len)).toBe(Math.round(stepMs(s, len) * 0.6));
      expect(gapMs(s, len)).toBeGreaterThanOrEqual(130);
    }
  });
  it('showing a whole sequence takes length x step', () => {
    expect(showMs('easy', 1)).toBe(800);
    expect(showMs('medium', 8)).toBe(8 * stepMs('medium', 8));
    expect(showMs('easy', 0)).toBe(0);
  });
  it('survives silly lengths', () => {
    expect(stepMs('easy', 0)).toBe(800);
    expect(stepMs('easy', -5)).toBe(800);
    expect(stepMs('easy', NaN)).toBe(800);
    expect(stepMs('hard', 10_000)).toBe(MIN_STEP_MS);
  });
});

describe('best scores (longest pattern repeated, per speed)', () => {
  it('uses the speed name as the key', () => {
    expect(SPEEDS.map(bestKey)).toEqual(['easy', 'medium', 'hard']);
  });
  it('keeps only improvements', () => {
    let r = recordBest({}, 'easy', 6);
    expect(r).toEqual({ bests: { easy: 6 }, improved: true });
    expect(recordBest(r.bests, 'easy', 6).improved).toBe(false);
    expect(recordBest(r.bests, 'easy', 4).improved).toBe(false);
    r = recordBest(r.bests, 'easy', 9);
    expect(r.bests.easy).toBe(9);
    r = recordBest(r.bests, 'hard', 3);
    expect(r.bests).toEqual({ easy: 9, hard: 3 });
  });
  it('rejects bad lengths and speeds', () => {
    for (const bad of [0, -2, 1.5, NaN, Infinity, MAX_LEN + 1]) expect(recordBest({}, 'easy', bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'turbo', 5).improved).toBe(false);
    expect(recordBest({}, '__proto__', 5).improved).toBe(false);
    expect(recordBest({}, 'easy', MAX_LEN).improved).toBe(true);
  });
  it('sanitises stored data into a fresh object', () => {
    const stored = JSON.parse('{"easy": 7, "medium": 2.5, "hard": "9", "turbo": 4, "__proto__": {"a": 1}, "constructor": 3}');
    const out = parseBests(stored);
    expect(out).toEqual({ easy: 7 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(parseBests(JSON.parse('{"easy": 21, "hard": 0}'))).toEqual({});
    expect(parseBests([1])).toEqual({});
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
  });
});

describe('setup and text', () => {
  it('reads a speed and falls back to Easy', () => {
    expect(parseSpeed('hard')).toBe('hard');
    for (const bad of ['', 'HARD', 'turbo', null, undefined, 3, [], {}, '__proto__']) expect(parseSpeed(bad)).toBe('easy');
    expect(SPEED_LABEL).toEqual({ easy: 'Easy', medium: 'Medium', hard: 'Hard' });
  });
  it('writes the messages with the right plurals', () => {
    expect(watchMessage(1)).toBe('Watch the lights. 1 light this time.');
    expect(watchMessage(5)).toBe('Watch the lights. 5 lights this time.');
    expect(turnMessage(1)).toBe('Your turn. Repeat the 1 light.');
    expect(turnMessage(3)).toBe('Your turn. Repeat the 3 lights.');
    expect(okMessage(2, 3)).toBe('Good. 2 of 3.');
    expect(completeMessage(1)).toBe('Well done! You repeated 1 light. Next, 2.');
    expect(completeMessage(7)).toBe('Well done! You repeated 7 lights. Next, 8.');
    expect(missMessage(4)).toBe('Not quite. Watch again, then try from the start of the 4 lights.');
    expect(winMessage()).toBe('You repeated all 20! Wonderful.');
  });
  it('never scolds: no message says wrong, fail, lost or game over', () => {
    const all = [watchMessage(2), turnMessage(2), okMessage(1, 2), completeMessage(2), missMessage(2), winMessage()].join(' ');
    expect(all).not.toMatch(/wrong|fail|lost|game over|bad|incorrect/i);
  });
  it('writes the share line for every state', () => {
    expect(shareText('easy', 0, 0)).toBe('Pattern Echo (Easy): just started');
    expect(shareText('easy', 0, 5)).toBe('Pattern Echo (Easy): just started, best so far 5');
    expect(shareText('hard', 1, 1)).toBe('Pattern Echo (Hard): I repeated 1 light in a row');
    expect(shareText('medium', 6, 6)).toBe('Pattern Echo (Medium): I repeated 6 lights in a row');
    expect(shareText('medium', 6, 9)).toBe('Pattern Echo (Medium): I repeated 6 lights in a row, best 9');
  });
});

describe('the page (read from source)', () => {
  it('has a polite live status line, honours reduced motion and uses its own storage key', () => {
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/gk:game:pattern-echo/);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).toMatch(/crypto\.getRandomValues/);
  });
  it('sound is off to start, and the audio context is created only inside the sound button path', () => {
    expect(src).toMatch(/let soundOn = false;/);
    expect(src).toMatch(/aria-pressed="false"/);
    expect(src).toContain('Sound is off');
    const created = src.match(/new Ctor\(/g) ?? [];
    expect(created).toHaveLength(1);
    // ensureAudio() is called from exactly one place: setSound, which only the sound button's click handler calls with `true`.
    expect(src.match(/ensureAudio\(\)/g) ?? []).toHaveLength(1);
    expect(src.match(/setSound\(!soundOn\)/g) ?? []).toHaveLength(1);
    expect(src.match(/setSound\(/g) ?? []).toHaveLength(1); // the one click call (the definition is `const setSound = (on)`)
  });
  it('plays tones through oscillators only, at the quiet peak from the engine', () => {
    expect(src).toContain('createOscillator');
    expect(src).not.toMatch(/createBuffer|decodeAudioData|new Audio\(|AudioBufferSourceNode/);
    expect(src).toContain('toneEnvelope(ms, peak)');
    expect(src).toMatch(/peak: number = PEAK_GAIN/);
    // a tone is cut short without ever reading AudioParam.value (a fresh node answers 1, a loud blip)
    expect(src).not.toMatch(/gain.gain.value|.gain.value/);
    expect(src).toContain('cancelAndHoldAtTime');
    expect(src).toContain('envelopeAt(v.env');
  });
  it('has six pad buttons and no four-pad layout in the markup source', () => {
    expect(src).toContain('PADS.map');
    expect(src).not.toMatch(/data-i="6"/);
  });
});
