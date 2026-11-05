/**
 * games-piano.test.ts - the engine behind `piano`.
 *
 * Pinned: the note frequency table (equal temperament, A4 = 440 Hz) against both the
 * formula and an independent repeated-multiplication table; note names that round trip;
 * the key layout for any window (25 keys, 15 white and 10 black for two octaves, no black
 * key between E and F or B and C); the computer-keyboard map (25 keys, each semitone once,
 * the black-key letters sitting on black pitches); the four tunes against hand-typed MIDI
 * lists (note counts 30, 42, 26 and 32; total beats 32, 48, 30 and 32); every tune fits
 * inside its keyboard window and uses only the white keys; instrument recipes stay inside
 * safe bounds; the master gain never passes 0.15; the voice cap picks the oldest; the
 * play-along judge advances only on the right note; and the stored progress is sanitised.
 * The numbers quoted on the guide page are asserted here.
 */
import { describe, it, expect } from 'vitest';
import {
  MASTER_PEAK, MAX_VOICES, MAX_PARTIAL_HZ, MIDI_LOW, MIDI_HIGH, OCTAVES, DEFAULT_OCTAVE, MAX_NARROW_WHITE_KEYS,
  clampVolume, clampOctave, masterGain, midiToFreq, isBlack, noteLetter, noteName, spokenName, colourLetter, parseNote,
  layoutKeys, whiteCount, freeWindow, KEY_ROWS, KEY_OFFSETS, mappingBase, keyToMidi, midiToKeyLabel,
  INSTRUMENTS, findInstrument, voiceTail, releaseSeconds, partialFreq, lowpassFreq, instrumentProblems, pickVoiceToSteal,
  TUNES, parseTune, findTune, startProgress, nextNote, judge, plural, STORE_MAX, sanitiseStore, markDone, doneCount, shareLine,
  type Progress,
} from '../src/components/apps-private/piano/helpers';

/** Small seeded generator so the fuzz is repeatable. */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);

describe('constants the page relies on', () => {
  it('has the documented limits', () => {
    expect(MASTER_PEAK).toBe(0.15);
    expect(MAX_VOICES).toBe(10);
    expect(MIDI_LOW).toBe(36);
    expect(MIDI_HIGH).toBe(96);
    expect([...OCTAVES]).toEqual([2, 3, 4, 5]);
    expect(DEFAULT_OCTAVE).toBe(4);
    expect(MAX_PARTIAL_HZ).toBe(18000);
  });
});

describe('sanitisers', () => {
  it('clamp volume and octave and refuse junk', () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(101)).toBe(100);
    expect(clampVolume('55')).toBe(55);
    for (const junk of [NaN, Infinity, '', 'x', null, undefined, [], {}, true]) expect(clampVolume(junk), String(junk)).toBe(70);
    expect(clampOctave(1)).toBe(2);
    expect(clampOctave(9)).toBe(5);
    expect(clampOctave('3')).toBe(3);
    for (const junk of [NaN, '', 'x', null, undefined, {}]) expect(clampOctave(junk), String(junk)).toBe(4);
  });
  it('master gain is volume/100 of 0.15 and never above it', () => {
    expect(masterGain(0)).toBe(0);
    expect(masterGain(100)).toBe(0.15);
    expect(masterGain(70)).toBeCloseTo(0.105, 12);
    for (const v of [-9, 0, 50, 100, 5000, Infinity, NaN, 'loud', null, undefined, {}]) {
      const g = masterGain(v);
      expect(Number.isFinite(g)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(MASTER_PEAK);
    }
  });
});

describe('frequencies', () => {
  it('A4 is 440 Hz and known reference pitches match', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 4); // middle C
    expect(midiToFreq(21)).toBeCloseTo(27.5, 9); // lowest key of an 88-key piano
    expect(midiToFreq(108)).toBeCloseTo(4186.009, 3); // highest key
  });
  it('matches an independent table built by repeated multiplication by 2^(1/12)', () => {
    const r = Math.pow(2, 1 / 12);
    const table: number[] = new Array(128);
    table[69] = 440;
    for (let m = 70; m < 128; m++) table[m] = table[m - 1] * r;
    for (let m = 68; m >= 0; m--) table[m] = table[m + 1] / r;
    for (let m = 0; m < 128; m++) expect(midiToFreq(m) / table[m]).toBeCloseTo(1, 9);
  });
  it('every octave doubles the pitch and every semitone raises it by the same ratio', () => {
    for (let m = 0; m < 116; m++) expect(midiToFreq(m + 12) / midiToFreq(m)).toBeCloseTo(2, 12);
    for (let m = 0; m < 127; m++) expect(midiToFreq(m + 1) / midiToFreq(m)).toBeCloseTo(Math.pow(2, 1 / 12), 12);
  });
  it('rejects notes that are not integers from 0 to 127', () => {
    for (const bad of [-1, 128, 60.5, NaN, Infinity]) expect(() => midiToFreq(bad)).toThrow(RangeError);
  });
});

describe('note names', () => {
  it('60 is C4, 61 is C#4, 69 is A4, and the lowest and highest piano keys are A0 and C8', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(21)).toBe('A0');
    expect(noteName(108)).toBe('C8');
    expect(noteLetter(66)).toBe('F#');
    expect(spokenName(61)).toBe('C sharp 4');
    expect(spokenName(55)).toBe('G 3');
  });
  it('round trips every MIDI note from C0 up through its name', () => {
    expect(noteName(0)).toBe('C-1');
    for (let m = 12; m < 128; m++) {
      const name = noteName(m);
      expect(name).toBe(`${PC_NAMES[m % 12]}${Math.floor(m / 12) - 1}`);
      const back = parseNote(name);
      expect(back, name).toBe(m);
    }
  });
  it('parseNote reads flats and refuses junk', () => {
    expect(parseNote('Db4')).toBe(61);
    expect(parseNote('Bb3')).toBe(58);
    expect(parseNote('C#4')).toBe(61);
    expect(parseNote('G9')).toBe(127);
    for (const bad of ['', 'H4', 'C', 'C44', 'c4', '4C', 'C-1', null, undefined, 60, {}, 'G#9', 'A9', 'B9']) expect(parseNote(bad), String(bad)).toBeNull();
  });
  it('a black key takes its colour letter from the white key below', () => {
    expect(colourLetter(61)).toBe('C');
    expect(colourLetter(66)).toBe('F');
    expect(colourLetter(70)).toBe('A');
    expect(colourLetter(62)).toBe('D');
  });
});

describe('black and white keys', () => {
  it('an 88-key piano (A0 to C8) has 52 white and 36 black keys', () => {
    let black = 0;
    for (let m = 21; m <= 108; m++) if (isBlack(m)) black++;
    expect(black).toBe(36);
    expect(88 - black).toBe(52);
  });
  it('agrees with the pitch-class list on every note', () => {
    for (let m = 0; m < 128; m++) expect(isBlack(m)).toBe([1, 3, 6, 8, 10].includes(m % 12));
  });
});

describe('key layout', () => {
  it('two octaves from middle C: 25 keys, 15 white, 10 black', () => {
    const keys = layoutKeys(60, 84);
    expect(keys.length).toBe(25);
    expect(keys.filter((k) => !k.black).length).toBe(15);
    expect(keys.filter((k) => k.black).length).toBe(10);
    expect(whiteCount(keys)).toBe(15);
    expect(keys.map((k) => k.midi)).toEqual(Array.from({ length: 25 }, (_, i) => 60 + i));
  });
  it('white keys are numbered left to right and each black key sits on the white key just below it', () => {
    const keys = layoutKeys(60, 84);
    const whites = keys.filter((k) => !k.black);
    whites.forEach((k, i) => expect(k.white).toBe(i));
    for (const k of keys.filter((x) => x.black)) {
      const below = whites[k.white];
      const above = whites[k.white + 1];
      expect(below.midi).toBe(k.midi - 1);
      expect(above.midi).toBe(k.midi + 1);
    }
  });
  it('there is no black key between E and F or between B and C', () => {
    const keys = layoutKeys(60, 84);
    const whites = keys.filter((k) => !k.black);
    for (let i = 0; i + 1 < whites.length; i++) {
      const gap = whites[i + 1].midi - whites[i].midi;
      const blacksBetween = keys.filter((k) => k.black && k.white === i).length;
      expect(blacksBetween).toBe(gap === 2 ? 1 : 0);
    }
  });
  it('a window must run between two white keys', () => {
    expect(() => layoutKeys(61, 72)).toThrow(RangeError);
    expect(() => layoutKeys(60, 73)).toThrow(RangeError);
    expect(() => layoutKeys(72, 60)).toThrow(RangeError);
    expect(() => layoutKeys(60, 60)).toThrow(RangeError);
    expect(() => layoutKeys(-1, 12)).toThrow(RangeError);
  });
  it('free-play windows: 8 white keys when narrow and 15 when wide, ends white, inside the range', () => {
    for (const o of OCTAVES) {
      const narrow = freeWindow(o, false);
      const wide = freeWindow(o, true);
      expect(narrow.lo).toBe(12 * (o + 1));
      expect(narrow.hi - narrow.lo).toBe(12);
      expect(wide.hi - wide.lo).toBe(24);
      expect(whiteCount(layoutKeys(narrow.lo, narrow.hi))).toBe(8);
      expect(whiteCount(layoutKeys(wide.lo, wide.hi))).toBe(15);
      for (const w of [narrow, wide]) {
        expect(isBlack(w.lo)).toBe(false);
        expect(isBlack(w.hi)).toBe(false);
        expect(w.lo).toBeGreaterThanOrEqual(MIDI_LOW);
        expect(w.hi).toBeLessThanOrEqual(MIDI_HIGH);
      }
    }
    expect(freeWindow(4, true)).toEqual({ lo: 60, hi: 84 });
    expect(freeWindow('nonsense', false)).toEqual({ lo: 60, hi: 72 });
    expect(freeWindow(99, true)).toEqual({ lo: 72, hi: 96 });
  });
});

describe('computer keyboard map', () => {
  const keys = (KEY_ROWS as readonly string[]).join('');
  it('has 25 distinct single-character keys', () => {
    expect(keys.length).toBe(25);
    expect(new Set(keys).size).toBe(25);
    for (const ch of keys) expect(ch).toMatch(/^[a-z0-9]$/);
    expect(Object.keys(KEY_OFFSETS).length).toBe(25);
  });
  it('covers each semitone from 0 to 24 exactly once', () => {
    const offs = Object.values(KEY_OFFSETS).sort((a, b) => a - b);
    expect(offs).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });
  it('the black-key letters sit on black pitches and the rest on white ones', () => {
    const blackLetters = new Set(['s', 'd', 'g', 'h', 'j', '2', '3', '5', '6', '7']);
    for (const [ch, off] of Object.entries(KEY_OFFSETS)) {
      expect([1, 3, 6, 8, 10].includes(off % 12), ch).toBe(blackLetters.has(ch));
    }
  });
  it('Z plays the first note of the window and Q the C an octave up', () => {
    expect(keyToMidi('z', 60)).toBe(60);
    expect(keyToMidi('Z', 60)).toBe(60);
    expect(keyToMidi('m', 60)).toBe(71);
    expect(keyToMidi('q', 60)).toBe(72);
    expect(keyToMidi('i', 60)).toBe(84);
    expect(keyToMidi('z', 36)).toBe(36);
  });
  it('the mapping base is the C at or below the window start', () => {
    expect(mappingBase(60)).toBe(60);
    expect(mappingBase(55)).toBe(48);
    expect(mappingBase(36)).toBe(36);
    expect(keyToMidi('b', 55)).toBe(55); // G3 sits on the B key in the Frere Jacques window
  });
  it('refuses keys that are not piano keys, including prototype names', () => {
    for (const bad of ['', ' ', 'p', 'a', 'Enter', 'zz', '__proto__', 'constructor', 'toString', '1', '0', null, undefined, 5, {}]) {
      expect(keyToMidi(bad as unknown, 60), String(bad)).toBe(-1);
    }
  });
  it('labels round trip: the label printed on a key plays that key', () => {
    for (const lo of [36, 48, 55, 60, 72]) {
      for (const ch of keys) {
        const m = keyToMidi(ch, lo);
        expect(midiToKeyLabel(m, lo)).toBe(ch.toUpperCase());
      }
      expect(midiToKeyLabel(lo - 13, lo)).toBe('');
      expect(midiToKeyLabel(mappingBase(lo) + 25, lo)).toBe('');
    }
  });
});

describe('instruments', () => {
  it('there are four, with unique ids and names', () => {
    expect(INSTRUMENTS.map((i) => i.id)).toEqual(['soft', 'bell', 'organ', 'pluck']);
    expect(new Set(INSTRUMENTS.map((i) => i.name)).size).toBe(4);
  });
  it('every recipe is inside the safe numeric bounds', () => {
    for (const i of INSTRUMENTS) expect(instrumentProblems(i), i.id).toEqual([]);
  });
  it('peak times the sum of partial gains never exceeds 1 (before the master gain)', () => {
    for (const i of INSTRUMENTS) {
      const sum = i.partials.reduce((s, p) => s + p.gain, 0);
      expect(i.peak * sum, i.id).toBeLessThanOrEqual(1);
    }
  });
  it('the checker itself catches bad recipes', () => {
    const good = INSTRUMENTS[0];
    expect(instrumentProblems({ ...good, partials: [] })).toContain('partial count');
    expect(instrumentProblems({ ...good, attack: 0 })).toContain('attack');
    expect(instrumentProblems({ ...good, sustain: 2 })).toContain('sustain');
    expect(instrumentProblems({ ...good, release: 5 })).toContain('release');
    expect(instrumentProblems({ ...good, peak: 0.9 })).toContain('peak');
    expect(instrumentProblems({ ...good, peak: NaN })).toContain('peak');
    expect(instrumentProblems({ ...good, partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2, gain: 1 }, { type: 'sine', ratio: 3, gain: 1 }, { type: 'sine', ratio: 4, gain: 1 }], peak: 0.5 })).toContain('too loud before the master gain');
  });
  it('the bell uses the inharmonic ratios 2.76 and 5.4', () => {
    const bell = findInstrument('bell')!;
    expect(bell.partials.map((p) => p.ratio)).toEqual([1, 2.76, 5.4]);
  });
  it('lookup refuses junk', () => {
    expect(findInstrument('organ')?.name).toBe('Organ');
    for (const bad of ['', 'Organ', '__proto__', 'constructor', null, undefined, 3, {}]) expect(findInstrument(bad as unknown)).toBeUndefined();
  });
  it('notes with no sustain die away by themselves; notes with sustain hold', () => {
    for (const i of INSTRUMENTS) {
      if (i.sustain === 0) expect(voiceTail(i)).toBeCloseTo(i.attack + i.decay * 2, 12);
      else expect(voiceTail(i)).toBe(Infinity);
    }
    expect(voiceTail(findInstrument('bell')!)).toBeLessThan(3);
    expect(voiceTail(findInstrument('soft')!)).toBe(Infinity);
    expect(voiceTail(findInstrument('organ')!)).toBe(Infinity);
  });
  it('release is short, the sustain option makes it longer, and never above 2.5 seconds', () => {
    for (const i of INSTRUMENTS) {
      expect(releaseSeconds(i, false)).toBe(i.release);
      expect(releaseSeconds(i, true)).toBeGreaterThan(i.release);
      expect(releaseSeconds(i, true)).toBeLessThanOrEqual(2.5);
    }
  });
  it('no partial is ever sounded above 18 kHz, whatever the note', () => {
    for (const inst of INSTRUMENTS) {
      for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
        const hz = midiToFreq(m);
        inst.partials.forEach((p, i) => {
          const f = partialFreq(inst, i, hz);
          if (hz * p.ratio <= MAX_PARTIAL_HZ) expect(f).toBeCloseTo(hz * p.ratio, 9);
          else expect(f).toBeNull();
        });
        expect(partialFreq(inst, 99, hz)).toBeNull();
      }
    }
    // The limit is a safety net: the page's highest key (C7) keeps every overtone, the top of an 88-key piano does not.
    const bell = findInstrument('bell')!;
    expect(partialFreq(bell, 2, midiToFreq(96))).toBeCloseTo(midiToFreq(96) * 5.4, 9);
    expect(partialFreq(bell, 2, midiToFreq(108))).toBeNull();
    expect(partialFreq(bell, 2, midiToFreq(60))).not.toBeNull();
  });
  it('the low-pass cutoff stays between 600 Hz and 9 kHz, and is off for instruments without one', () => {
    const pluck = findInstrument('pluck')!;
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      const c = lowpassFreq(pluck, midiToFreq(m));
      expect(c).toBeGreaterThanOrEqual(600);
      expect(c).toBeLessThanOrEqual(9000);
    }
    expect(lowpassFreq(findInstrument('soft')!, 440)).toBe(0);
    expect(lowpassFreq(pluck, 440)).toBe(2200);
  });
});

describe('voice cap', () => {
  it('cuts the note that started earliest', () => {
    expect(pickVoiceToSteal([5, 1, 3])).toBe(1);
    expect(pickVoiceToSteal([2])).toBe(0);
    expect(pickVoiceToSteal([])).toBe(-1);
    const rng = lcg(3);
    for (let t = 0; t < 300; t++) {
      const starts = Array.from({ length: 1 + Math.floor(rng() * 12) }, () => Math.round(rng() * 1000) / 10);
      expect(starts[pickVoiceToSteal(starts)]).toBe(Math.min(...starts));
    }
  });
});

/** The four tunes typed out by hand as MIDI numbers (C4 = 60). An oracle independent of parseTune. */
const HAND: Record<string, number[]> = {
  'ode-to-joy': [
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62,
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
  ],
  twinkle: [
    60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60,
    67, 67, 65, 65, 64, 64, 62, 67, 67, 65, 65, 64, 64, 62,
    60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60,
  ],
  mary: [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67, 64, 62, 60, 62, 64, 64, 64, 64, 62, 62, 64, 62, 60],
  frere: [
    60, 62, 64, 60, 60, 62, 64, 60, 64, 65, 67, 64, 65, 67, 67, 69, 67, 65, 64, 60, 67, 69, 67, 65, 64, 60,
    60, 55, 60, 60, 55, 60,
  ],
};

describe('tunes', () => {
  it('there are four traditional tunes with the documented titles', () => {
    expect(TUNES.map((t) => t.id)).toEqual(['ode-to-joy', 'twinkle', 'mary', 'frere']);
    expect(TUNES.map((t) => t.title)).toEqual(['Ode to Joy', 'Twinkle Twinkle', 'Mary Had a Little Lamb', 'Frere Jacques']);
    expect(new Set(TUNES.map((t) => t.id)).size).toBe(4);
  });
  it('each tune is exactly the hand-typed note list', () => {
    for (const t of TUNES) expect(t.notes, t.id).toEqual(HAND[t.id]);
  });
  it('note counts are 30, 42, 26 and 32', () => {
    expect(TUNES.map((t) => t.notes.length)).toEqual([30, 42, 26, 32]);
    for (const t of TUNES) expect(t.beats.length).toBe(t.notes.length);
  });
  it('total lengths are whole bars of four beats: 32, 48, 30 (7 bars and a half) and 32', () => {
    const total = (t: (typeof TUNES)[number]) => t.beats.reduce((s, b) => s + b, 0);
    expect(TUNES.map(total)).toEqual([32, 48, 30, 32]);
  });
  it('every note length is positive and at most 4 beats', () => {
    for (const t of TUNES) for (const b of t.beats) {
      expect(b).toBeGreaterThan(0);
      expect(b).toBeLessThanOrEqual(4);
    }
  });
  it('every tune uses only the white keys of C major and ends on C', () => {
    for (const t of TUNES) {
      for (const n of t.notes) expect(MAJOR_PCS.has(n % 12), `${t.id} ${n}`).toBe(true);
      expect(t.notes[t.notes.length - 1] % 12).toBe(0);
    }
  });
  it('first and last notes are what the tunes start and end on', () => {
    const t = (id: string) => findTune(id)!;
    expect(t('ode-to-joy').notes.slice(0, 4)).toEqual([64, 64, 65, 67]);
    expect(t('twinkle').notes.slice(0, 6)).toEqual([60, 60, 67, 67, 69, 69]);
    expect(t('mary').notes.slice(0, 3)).toEqual([64, 62, 60]);
    expect(t('frere').notes.filter((n) => n === 55).length).toBe(2);
  });
  it('each tune sits inside its keyboard window, between two white keys, narrow enough for a phone', () => {
    for (const t of TUNES) {
      expect(isBlack(t.lo)).toBe(false);
      expect(isBlack(t.hi)).toBe(false);
      for (const n of t.notes) {
        expect(n).toBeGreaterThanOrEqual(t.lo);
        expect(n).toBeLessThanOrEqual(t.hi);
      }
      const w = whiteCount(layoutKeys(t.lo, t.hi));
      expect(w, t.id).toBeLessThanOrEqual(MAX_NARROW_WHITE_KEYS);
      // At most 9 white keys: 28 px each fits a 320 px screen.
      expect(w * 28).toBeLessThanOrEqual(320);
    }
    expect(findTune('frere')).toMatchObject({ lo: 55, hi: 69 });
  });
  it('every tune note has a key in its window', () => {
    for (const t of TUNES) {
      const mids = new Set(layoutKeys(t.lo, t.hi).map((k) => k.midi));
      for (const n of t.notes) expect(mids.has(n)).toBe(true);
    }
  });
  it('lookup refuses junk', () => {
    expect(findTune('mary')?.title).toBe('Mary Had a Little Lamb');
    for (const bad of ['', 'Mary', '__proto__', 'constructor', null, undefined, 3, {}]) expect(findTune(bad as unknown)).toBeUndefined();
  });
});

describe('parseTune', () => {
  it('reads letters, sharps, octaves and lengths', () => {
    expect(parseTune('C D E')).toEqual({ notes: [60, 62, 64], beats: [1, 1, 1] });
    expect(parseTune('G3:2 C#5:0.5 F#')).toEqual({ notes: [55, 73, 66], beats: [2, 0.5, 1] });
    expect(parseTune('  C   D  ').notes).toEqual([60, 62]);
  });
  it('throws on junk instead of guessing', () => {
    for (const bad of ['', 'H', 'c', 'C:0', 'C:9', 'C:', 'C##', 'C4:x', 'C D H', '1', 'C:-1']) {
      expect(() => parseTune(bad), JSON.stringify(bad)).toThrow(RangeError);
    }
  });
});

describe('play-along judge', () => {
  const play = (tuneId: string, seq: number[]) => {
    const t = findTune(tuneId)!;
    let p: Progress = startProgress();
    const verdicts: string[] = [];
    for (const m of seq) {
      const r = judge(t, p, m);
      verdicts.push(r.verdict);
      p = r.progress;
    }
    return { p, verdicts };
  };
  it('playing every note in order finishes the tune on exactly the last note', () => {
    for (const t of TUNES) {
      const { p, verdicts } = play(t.id, t.notes);
      expect(p.done).toBe(true);
      expect(p.index).toBe(t.notes.length);
      expect(p.wrong).toBe(0);
      expect(verdicts.slice(0, -1).every((v) => v === 'right')).toBe(true);
      expect(verdicts[verdicts.length - 1]).toBe('done');
      expect(nextNote(t, p)).toBeNull();
    }
  });
  it('a wrong note never moves the tune on and never ends it', () => {
    const t = findTune('ode-to-joy')!;
    let p = startProgress();
    expect(nextNote(t, p)).toBe(64);
    const r = judge(t, p, 62);
    expect(r.verdict).toBe('wrong');
    expect(r.progress).toEqual({ index: 0, wrong: 1, done: false });
    p = r.progress;
    expect(judge(t, p, 64).progress).toEqual({ index: 1, wrong: 1, done: false });
  });
  it('the same pitch an octave away is wrong (the exact note is needed)', () => {
    const t = findTune('twinkle')!;
    expect(judge(t, startProgress(), 72).verdict).toBe('wrong');
    expect(judge(t, startProgress(), 48).verdict).toBe('wrong');
  });
  it('after the end every press is reported done and nothing changes', () => {
    const t = findTune('mary')!;
    const { p } = play('mary', t.notes);
    const r = judge(t, p, 60);
    expect(r.verdict).toBe('done');
    expect(r.progress).toEqual(p);
  });
  it('does not modify the progress it is given', () => {
    const t = findTune('mary')!;
    const p = startProgress();
    const copy = { ...p };
    judge(t, p, 64);
    judge(t, p, 1);
    expect(p).toEqual(copy);
  });
  it('random pressing agrees with a simple reference model and always terminates correctly', () => {
    const rng = lcg(41);
    for (const t of TUNES) {
      for (let run = 0; run < 40; run++) {
        let p: Progress = startProgress();
        let idx = 0;
        let wrong = 0;
        for (let step = 0; step < 4000 && !p.done; step++) {
          // Half the presses are the right note, the rest are random in the window.
          const m = rng() < 0.5 ? t.notes[idx] : t.lo + Math.floor(rng() * (t.hi - t.lo + 1));
          const r = judge(t, p, m);
          if (m === t.notes[idx]) idx++; else wrong++;
          p = r.progress;
          expect(p.index).toBe(idx);
          expect(p.wrong).toBe(wrong);
          expect(p.done).toBe(idx >= t.notes.length);
        }
        expect(p.done).toBe(true);
      }
    }
  });
});

describe('saved progress', () => {
  it('keeps a valid number and turns anything else into zero', () => {
    expect(sanitiseStore({ done: 5 })).toEqual({ done: 5 });
    expect(sanitiseStore({ done: STORE_MAX })).toEqual({ done: 15 });
    for (const bad of [null, undefined, 5, 'x', [], [5], {}, { done: -1 }, { done: 16 }, { done: 1.5 }, { done: NaN }, { done: '3' }, { done: Infinity }, { done: {} }, JSON.parse('{"__proto__":{"done":3}}')]) {
      expect(sanitiseStore(bad), JSON.stringify(bad)).toEqual({ done: 0 });
    }
  });
  it('returns a fresh object and never carries extra fields', () => {
    const raw = { done: 3, evil: 'x', __proto__: { polluted: true } } as Record<string, unknown>;
    const out = sanitiseStore(raw);
    expect(out).toEqual({ done: 3 });
    expect(Object.keys(out)).toEqual(['done']);
    expect(out).not.toBe(raw);
  });
  it('marks and counts tunes', () => {
    let s = { done: 0 };
    expect(doneCount(s)).toBe(0);
    s = markDone(s, 2);
    expect(s.done).toBe(4);
    s = markDone(s, 2);
    expect(doneCount(s)).toBe(1);
    s = markDone(markDone(markDone(s, 0), 1), 3);
    expect(s.done).toBe(15);
    expect(doneCount(s)).toBe(4);
    for (const bad of [-1, 4, 1.5, NaN]) expect(markDone({ done: 1 }, bad)).toEqual({ done: 1 });
  });
});

describe('copy text', () => {
  it('is correct in free play, mid-tune and finished', () => {
    expect(shareLine(null, false)).toBe('Piano - playing for fun');
    expect(shareLine(findTune('ode-to-joy')!, false)).toBe('Piano - learning Ode to Joy');
    expect(shareLine(findTune('ode-to-joy')!, true)).toBe('Piano - played Ode to Joy all the way through (30 notes)');
    expect(plural(1, 'note')).toBe('1 note');
    expect(plural(0, 'note')).toBe('0 notes');
  });
});
