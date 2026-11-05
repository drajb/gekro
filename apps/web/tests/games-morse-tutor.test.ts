/**
 * games-morse-tutor.test.ts - the engine behind `morse-tutor`.
 *
 * Pinned: the International Morse table for A to Z and 0 to 9 matches two
 * independent constructions (the binary tree of the letters, and the pattern the
 * digits follow); every pattern is different, so decoding is unambiguous; encode
 * and decode round-trip; the timing is the standard 1 : 3 : 1 : 3 : 7 and the
 * word PARIS is 50 units; the tone never goes above 0.15 gain and the light never
 * flashes more than 3 times a second at any speed; quiz questions have four
 * different choices containing the answer once; the send-a-word state machine
 * accepts exactly the right letters; the page creates sound only after a click.
 */
import { describe, it, expect } from 'vitest';
import {
  MORSE, LETTERS, DIGITS, SYMBOLS, MAX_CODE_LEN, UNITS, SPEEDS, SPEED_LABEL, MAX_FLASHES_PER_SECOND, PEAK_GAIN, TONE_HZ, RAMP_SEC,
  QUIZ_LENGTH, QUIZ_POOL, SEND_ROUND, SEND_WORDS, LEVELS, LEVEL_LABEL,
  codeOf, decodeCode, encode, decode, describeCode, timeline, timelineOfCode, totalUnits, wordUnits, schedule, flashesPerSecond, gatePoints,
  makeQuiz, makeSendRound, newSend, pushMark, popMark, clearMarks, commitLetter, bestKey, sanitiseBest, plural, parseSeed, mulberry32, shuffled,
  type Level, type Segment,
} from '../src/components/apps-private/morse-tutor/helpers';
import calculatorSource from '../src/components/apps-private/morse-tutor/Calculator.astro?raw';

describe('the table', () => {
  it('has 26 letters and 10 digits, each with a pattern of dots and dashes only', () => {
    expect(LETTERS).toHaveLength(26);
    expect(DIGITS).toHaveLength(10);
    expect(SYMBOLS).toHaveLength(36);
    expect(Object.keys(MORSE)).toHaveLength(36);
    for (const s of SYMBOLS) expect(/^[.-]+$/.test(MORSE[s]), s).toBe(true);
  });

  it('every pattern is different, so no pattern can be decoded two ways', () => {
    expect(new Set(Object.values(MORSE)).size).toBe(36);
  });

  it('letters match the Morse binary tree (independent construction)', () => {
    // Level order of the tree: dot goes left, dash goes right. Empty strings are unused branches.
    const tree = ['E', 'T', 'I', 'A', 'N', 'M', 'S', 'U', 'R', 'W', 'D', 'K', 'G', 'O', 'H', 'V', 'F', '', 'L', '', 'P', 'J', 'B', 'X', 'C', 'Y', 'Z', 'Q', '', ''];
    const fromTree: Record<string, string> = {};
    // Node k (1 = root, no letter); the dot child of k is 2k and the dash child is 2k + 1; tree[k - 2] is the letter at node k.
    const walk = (k: number, code: string) => {
      if (k >= 2 && k - 2 < tree.length && tree[k - 2] !== '') fromTree[tree[k - 2]] = code;
      if (2 * k + 1 - 2 < tree.length) { walk(2 * k, code + '.'); walk(2 * k + 1, code + '-'); }
    };
    walk(1, '');
    expect(Object.keys(fromTree).sort().join('')).toBe(LETTERS);
    for (const ch of LETTERS) expect(MORSE[ch], ch).toBe(fromTree[ch]);
  });

  it('digits follow their rule: 1-5 are n dots then dashes, 6-9 are dashes then dots, 0 is five dashes (independent construction)', () => {
    const rule = (d: number): string => (d === 0 ? '-----' : d <= 5 ? '.'.repeat(d) + '-'.repeat(5 - d) : '-'.repeat(d - 5) + '.'.repeat(10 - d));
    for (let d = 0; d <= 9; d++) expect(MORSE[String(d)], String(d)).toBe(rule(d));
  });

  it('known examples from the standard', () => {
    expect(MORSE.A).toBe('.-');
    expect(MORSE.E).toBe('.');
    expect(MORSE.T).toBe('-');
    expect(MORSE.S).toBe('...');
    expect(MORSE.O).toBe('---');
    expect(MORSE.Q).toBe('--.-');
    expect(MORSE.Z).toBe('--..');
    expect(MORSE['5']).toBe('.....');
  });

  it('letters are 1 to 4 marks long and digits are 5, and the Easy letters all have three marks or fewer', () => {
    for (const ch of LETTERS) { expect(MORSE[ch].length).toBeGreaterThanOrEqual(1); expect(MORSE[ch].length).toBeLessThanOrEqual(4); }
    for (const d of DIGITS) expect(MORSE[d]).toHaveLength(5);
    expect(MAX_CODE_LEN).toBeGreaterThanOrEqual(5);
    const shortest = LETTERS.split('').filter((c) => MORSE[c].length <= 2).sort().join('');
    expect(shortest).toBe('AEIMNT'); // lengths 1 and 2
    expect(QUIZ_POOL.easy.slice().sort().join('')).toBe('AEIMNOST'); // plus S (...) and O (---), the two famous three-mark letters
    expect(QUIZ_POOL.easy.every((c) => MORSE[c].length <= 3)).toBe(true);
  });
});

describe('encode and decode', () => {
  it('codeOf and decodeCode are inverses for all 36 symbols, in any case', () => {
    for (const s of SYMBOLS) {
      expect(decodeCode(codeOf(s)!)).toBe(s);
      expect(codeOf(s.toLowerCase())).toBe(MORSE[s]);
    }
  });
  it('rejects things that are not a symbol or a pattern', () => {
    for (const bad of ['', 'AB', '!', ' ', 'é', '__proto__', 'constructor']) expect(codeOf(bad)).toBeNull();
    for (const bad of ['', '.......', '-.-.-', '..--..', 'x', '__proto__', 'constructor', 'toString', '. .']) expect(decodeCode(bad), bad).toBeNull();
    expect(codeOf(5 as unknown as string)).toBeNull();
    expect(decodeCode(null as unknown as string)).toBeNull();
  });
  it('encodes words with a space between letters and " / " between words', () => {
    expect(encode('SOS')).toBe('... --- ...');
    expect(encode('cat dog')).toBe('-.-. .- - / -.. --- --.');
    expect(encode('  a   b ')).toBe('.- / -...');
    expect(encode('')).toBe('');
    expect(encode('?!')).toBe('');
    expect(encode('a-b')).toBe('.- -...'); // the dash is skipped, the letters stay in one word
  });
  it('decode(encode(x)) is x for every letter, every digit and for sentences', () => {
    for (const s of SYMBOLS) expect(decode(encode(s))).toBe(s);
    expect(decode(encode(LETTERS))).toBe(LETTERS);
    expect(decode(encode(DIGITS))).toBe(DIGITS);
    expect(decode(encode('hello world 2026'))).toBe('HELLO WORLD 2026');
    const rng = mulberry32(3);
    for (let t = 0; t < 500; t++) {
      const words = Array.from({ length: 1 + Math.floor(rng() * 4) }, () => Array.from({ length: 1 + Math.floor(rng() * 6) }, () => SYMBOLS[Math.floor(rng() * 36)]).join(''));
      expect(decode(encode(words.join(' ')))).toBe(words.join(' '));
    }
  });
  it('decode shows ? for a pattern that is not a symbol', () => {
    expect(decode('...... .-')).toBe('?A');
    expect(decode('')).toBe('');
  });
  it('describes a pattern in words for a screen reader', () => {
    expect(describeCode('.-')).toBe('dot dash');
    expect(describeCode('...')).toBe('dot dot dot');
    expect(describeCode('')).toBe('');
  });
});

/** Independent expansion: one character per unit of time, "1" while on and "0" while off. */
const expand = (text: string): string => {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  return words.map((w) => [...w].map((ch) => [...MORSE[ch]].map((m) => (m === '.' ? '1' : '111')).join('0')).join('000')).join('0000000');
};
const bits = (segs: Segment[]): string => segs.map((s) => (s.on ? '1' : '0').repeat(s.units)).join('');

describe('timing: dot 1, dash 3, gap inside a letter 1, between letters 3, between words 7', () => {
  it('the proportions are the standard ones', () => {
    expect(UNITS).toEqual({ dot: 1, dash: 3, gapMark: 1, gapLetter: 3, gapWord: 7 });
  });
  it('A is on 1, off 1, on 3', () => {
    expect(timeline('A')).toEqual([{ on: true, units: 1 }, { on: false, units: 1 }, { on: true, units: 3 }]);
    expect(timelineOfCode('.-')).toEqual(timeline('A'));
  });
  it('a gap of 3 between letters and 7 between words', () => {
    expect(bits(timeline('ET'))).toBe('1' + '000' + '111');
    expect(bits(timeline('E T'))).toBe('1' + '0000000' + '111');
    expect(timeline('E  T')).toEqual(timeline('E T'));
  });
  it('matches an independent unit-by-unit expansion for every symbol and 2000 random messages', () => {
    for (const s of SYMBOLS) expect(bits(timeline(s)), s).toBe(expand(s));
    const rng = mulberry32(8);
    for (let t = 0; t < 2000; t++) {
      const n = 1 + Math.floor(rng() * 14);
      let msg = '';
      for (let k = 0; k < n; k++) msg += rng() < 0.18 ? ' ' : SYMBOLS[Math.floor(rng() * 36)];
      if (msg.trim() === '') continue;
      expect(bits(timeline(msg)), msg).toBe(expand(msg));
    }
  }, 30_000);
  it('never starts or ends with silence, and on and off segments alternate', () => {
    for (const msg of ['SOS', 'A B', 'E', '5 4 3', 'HELLO WORLD']) {
      const t = timeline(msg);
      expect(t[0].on).toBe(true);
      expect(t[t.length - 1].on).toBe(true);
      for (let i = 1; i < t.length; i++) expect(t[i].on).not.toBe(t[i - 1].on);
    }
    expect(timeline('')).toEqual([]);
    expect(timeline('   ')).toEqual([]);
    expect(timeline('?!')).toEqual([]);
  });
  it('the standard test word PARIS, with the gap after it, is 50 units', () => {
    expect(totalUnits(timeline('PARIS'))).toBe(43);
    expect(wordUnits('PARIS')).toBe(50);
  });
  it('schedule gives contiguous start times and durations in milliseconds', () => {
    const s = schedule(timeline('A'), 200);
    expect(s).toEqual([{ on: true, start: 0, dur: 200 }, { on: false, start: 200, dur: 200 }, { on: true, start: 400, dur: 600 }]);
    for (let i = 1; i < s.length; i++) expect(s[i].start).toBe(s[i - 1].start + s[i - 1].dur);
    expect(schedule([{ on: true, units: 1 }], NaN)[0].dur).toBe(SPEEDS.normal);
    expect(schedule([{ on: true, units: 1 }], -5)[0].dur).toBe(SPEEDS.normal);
  });
});

describe('the light never flashes more than 3 times a second', () => {
  it('at every speed a run of dots flashes at most 3 times a second', () => {
    expect(MAX_FLASHES_PER_SECOND).toBe(3);
    for (const [name, ms] of Object.entries(SPEEDS)) expect(flashesPerSecond(ms), name).toBeLessThanOrEqual(3);
    expect(Object.keys(SPEEDS)).toEqual(['slow', 'normal', 'fast']);
    expect(Object.keys(SPEED_LABEL)).toEqual(Object.keys(SPEEDS));
    expect(SPEEDS.fast).toBeGreaterThanOrEqual(1000 / 6); // two dot-lengths per flash
  });
  it('counting real on-switches in any one-second window of the fastest message', () => {
    for (const ms of Object.values(SPEEDS)) {
      const s = schedule(timeline('EEEEEEEEEEEEEEEEEEEE'), ms).filter((x) => x.on);
      // Plain E letters are separated by letter gaps, so use dots inside one letter too.
      const dots = schedule(timelineOfCode('.........'), ms).filter((x) => x.on);
      for (const list of [s, dots]) {
        for (let i = 0; i < list.length; i++) {
          const inWindow = list.filter((x) => x.start >= list[i].start && x.start < list[i].start + 1000).length;
          expect(inWindow, `${ms} ms`).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});

describe('the sound', () => {
  it('peaks at no more than 0.15 and stays in a pleasant range', () => {
    expect(PEAK_GAIN).toBeGreaterThan(0);
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    expect(TONE_HZ).toBeGreaterThanOrEqual(300);
    expect(TONE_HZ).toBeLessThanOrEqual(1000);
  });
  it('the gain plan is silent at both ends, never above the peak, never backwards in time, and rises and falls once per mark', () => {
    for (const msg of ['SOS', 'A B', '5', 'HELLO WORLD']) {
      for (const unit of [0.175, 0.22, 0.3, 0.001, NaN, -1]) {
        const segs = timeline(msg);
        const pts = gatePoints(segs, unit, 1.5);
        expect(pts[0]).toEqual({ time: 1.5, gain: 0 });
        expect(pts[pts.length - 1].gain).toBe(0);
        expect(pts).toHaveLength(1 + 4 * segs.filter((s) => s.on).length);
        for (let i = 0; i < pts.length; i++) {
          expect(pts[i].gain).toBeGreaterThanOrEqual(0);
          expect(pts[i].gain).toBeLessThanOrEqual(0.15);
          expect(Number.isFinite(pts[i].time)).toBe(true);
          if (i > 0) expect(pts[i].time).toBeGreaterThanOrEqual(pts[i - 1].time);
        }
        expect(Math.max(...pts.map((p) => p.gain))).toBe(PEAK_GAIN);
      }
    }
  });
  it('the last point is when the message ends', () => {
    const u = 0.2;
    const pts = gatePoints(timeline('A'), u, 0);
    expect(pts[pts.length - 1].time).toBeCloseTo(5 * u, 10);
    expect(RAMP_SEC).toBeLessThan(0.05);
    expect(gatePoints([], 0.2, 0)).toEqual([{ time: 0, gain: 0 }]);
  });
  it('the page creates the audio context only inside a function called from a click, keeps sound off at the start and uses the limited gain', () => {
    const matches = calculatorSource.match(/new\s+(?:window\.)?(?:AudioContext|webkitAudioContext)|new\s+Ctor/g) ?? [];
    expect(matches.length).toBe(1);
    const at = calculatorSource.indexOf('const ensureAudio');
    expect(at).toBeGreaterThan(0);
    expect(calculatorSource.indexOf('new Ctor')).toBeGreaterThan(at);
    expect(calculatorSource).toMatch(/let soundOn = false/);
    expect(calculatorSource).toMatch(/PEAK_GAIN/);
    expect(calculatorSource).not.toMatch(/gain\.value\s*=\s*(?:1|0?\.[3-9])/);
    expect(calculatorSource).toMatch(/aria-pressed/);
  });
});

describe('quiz', () => {
  const seeds = Array.from({ length: 400 }, (_, i) => i + 1);
  it('pools: 8 letters at Easy, 26 at Medium, 36 symbols at Hard', () => {
    expect(QUIZ_POOL.easy).toHaveLength(8);
    expect(QUIZ_POOL.medium).toHaveLength(26);
    expect(QUIZ_POOL.hard).toHaveLength(36);
    expect(QUIZ_LENGTH).toBe(10);
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
    for (const l of LEVELS) expect(LEVEL_LABEL[l].length).toBeGreaterThan(5);
  });
  it('each question has four different choices from the level pool that include the answer exactly once, in table order', () => {
    for (const l of LEVELS) for (const s of seeds) {
      const qs = makeQuiz(l, mulberry32(s * 13));
      expect(qs).toHaveLength(10);
      for (const q of qs) {
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1);
        for (const c of q.choices) expect(QUIZ_POOL[l]).toContain(c);
        expect(q.choices).toEqual(q.choices.slice().sort((a, b) => SYMBOLS.indexOf(a) - SYMBOLS.indexOf(b)));
        expect(MORSE[q.answer]).toBeDefined();
      }
    }
  }, 30_000);
  it('answers do not repeat until the pool is used up (Medium and Hard never repeat in ten) and never come twice in a row', () => {
    for (const s of seeds) {
      for (const l of ['medium', 'hard'] as Level[]) expect(new Set(makeQuiz(l, mulberry32(s)).map((q) => q.answer)).size).toBe(10);
      const easy = makeQuiz('easy', mulberry32(s));
      expect(new Set(easy.slice(0, 8).map((q) => q.answer)).size).toBe(8);
      for (let i = 1; i < 10; i++) expect(easy[i].answer).not.toBe(easy[i - 1].answer);
    }
  }, 30_000);
  it('every symbol of a pool turns up as an answer across many rounds', () => {
    for (const l of LEVELS) {
      const seen = new Set<string>();
      for (const s of seeds) for (const q of makeQuiz(l, mulberry32(s))) seen.add(q.answer);
      expect(seen.size).toBe(QUIZ_POOL[l].length);
    }
  });
  it('is deterministic and varies', () => {
    expect(makeQuiz('medium', mulberry32(5))).toEqual(makeQuiz('medium', mulberry32(5)));
    expect(makeQuiz('medium', mulberry32(5))).not.toEqual(makeQuiz('medium', mulberry32(6)));
  });
  it('rejects a bad level, clamps a silly length, survives a degenerate rng', () => {
    expect(() => makeQuiz('extreme' as Level, mulberry32(1))).toThrow(RangeError);
    expect(makeQuiz('easy', mulberry32(1), 0)).toHaveLength(10);
    expect(makeQuiz('easy', mulberry32(1), 999)).toHaveLength(10);
    expect(makeQuiz('easy', mulberry32(1), 4)).toHaveLength(4);
    for (const rng of [() => 0, () => 0.999999, () => NaN]) for (const l of LEVELS) {
      for (const q of makeQuiz(l, rng)) { expect(new Set(q.choices).size).toBe(4); expect(q.choices).toContain(q.answer); }
    }
  });
});

describe('send a word', () => {
  const RUDE = ['ASS', 'SEX', 'FAG', 'TIT', 'CUM', 'ARSE', 'SHIT', 'FUCK', 'CUNT', 'DICK', 'COCK', 'CRAP', 'PISS', 'SLUT', 'WHORE', 'BITCH', 'NAZI', 'RAPE', 'PORN', 'ANUS', 'DAMN', 'KILL', 'DEAD', 'FART'];
  it('the lists have the sizes the guide page quotes: 18, 22 and 18 words, 58 in all', () => {
    expect(LEVELS.map((l) => SEND_WORDS[l].length)).toEqual([18, 22, 18]);
  });
  it('word lists: capital letters only, the right lengths, no duplicates, nothing rude', () => {
    const len: Record<Level, number> = { easy: 3, medium: 4, hard: 5 };
    const all: string[] = [];
    for (const l of LEVELS) {
      expect(SEND_WORDS[l].length).toBeGreaterThanOrEqual(12);
      for (const w of SEND_WORDS[l]) {
        expect(/^[A-Z]+$/.test(w), w).toBe(true);
        expect(w.length, w).toBe(len[l]);
        for (const r of RUDE) expect(w.includes(r) || w.split('').reverse().join('').includes(r), `${w} / ${r}`).toBe(false);
        all.push(w);
      }
    }
    expect(new Set(all).size).toBe(all.length);
  });
  it('a round is five different words of the level length', () => {
    expect(SEND_ROUND).toBe(5);
    for (const l of LEVELS) for (let s = 1; s <= 200; s++) {
      const r = makeSendRound(l, mulberry32(s));
      expect(r).toHaveLength(5);
      expect(new Set(r).size).toBe(5);
      for (const w of r) expect(SEND_WORDS[l]).toContain(w);
    }
    expect(makeSendRound('easy', mulberry32(1), 0)).toHaveLength(5);
    expect(makeSendRound('easy', mulberry32(1), 999)).toHaveLength(5);
    expect(makeSendRound('easy', mulberry32(1), 2)).toHaveLength(2);
    expect(() => makeSendRound('x' as Level, mulberry32(1))).toThrow(RangeError);
  });

  /** Tap out a pattern as the page would. */
  const tap = (s: ReturnType<typeof newSend>, code: string) => [...code].reduce((st, m) => pushMark(st, m as '.' | '-'), s);

  it('sending the right pattern for each letter completes every word in every list', () => {
    for (const l of LEVELS) for (const w of SEND_WORDS[l]) {
      let st = newSend(w);
      for (let i = 0; i < w.length; i++) {
        st = tap(st, MORSE[w[i]]);
        const { state, result } = commitLetter(st);
        st = state;
        expect(result.kind, `${w}[${i}]`).toBe(i === w.length - 1 ? 'complete' : 'ok');
        expect(st.done).toBe(w.slice(0, i + 1));
        expect(st.cur).toBe('');
      }
    }
  });
  it('a wrong letter is cleared and nothing is added; the next right one still works', () => {
    let st = tap(newSend('CAT'), MORSE.D);
    let r = commitLetter(st);
    expect(r.result).toEqual({ kind: 'wrong', letter: 'D', wanted: 'C' });
    expect(r.state).toEqual({ target: 'CAT', done: '', cur: '' });
    st = tap(r.state, MORSE.C);
    r = commitLetter(st);
    expect(r.result).toEqual({ kind: 'ok', letter: 'C' });
  });
  it('an unknown pattern is cleared; an empty commit does nothing; a finished word accepts nothing more', () => {
    const r = commitLetter(tap(newSend('CAT'), '......'));
    expect(r.result).toEqual({ kind: 'unknown' });
    expect(r.state.cur).toBe('');
    const empty = newSend('CAT');
    expect(commitLetter(empty)).toEqual({ state: empty, result: { kind: 'empty' } });
    let done = newSend('E');
    done = commitLetter(tap(done, '.')).state;
    expect(done.done).toBe('E');
    expect(pushMark(done, '.')).toBe(done);
    expect(commitLetter(done).result.kind).toBe('empty');
  });
  it('marks are capped, can be taken back and cleared, and never change the old state', () => {
    let st = newSend('CAT');
    const first = pushMark(st, '.');
    expect(st.cur).toBe('');
    for (let i = 0; i < 20; i++) st = pushMark(st, i % 2 ? '-' : '.');
    expect(st.cur).toHaveLength(MAX_CODE_LEN);
    expect(popMark(first).cur).toBe('');
    expect(popMark(newSend('A'))).toEqual(newSend('A'));
    expect(clearMarks(st).cur).toBe('');
    expect(st.cur).toHaveLength(MAX_CODE_LEN);
  });
  it('random tapping never throws and never leaves a letter that does not belong', () => {
    const rng = mulberry32(17);
    for (let t = 0; t < 1000; t++) {
      let st = newSend(SEND_WORDS.medium[Math.floor(rng() * SEND_WORDS.medium.length)]);
      for (let k = 0; k < 60; k++) {
        const r = rng();
        if (r < 0.55) st = pushMark(st, rng() < 0.5 ? '.' : '-');
        else if (r < 0.7) st = popMark(st);
        else if (r < 0.75) st = clearMarks(st);
        else st = commitLetter(st).state;
        expect(st.target.startsWith(st.done)).toBe(true);
        expect(st.cur.length).toBeLessThanOrEqual(MAX_CODE_LEN);
        expect(/^[.-]*$/.test(st.cur)).toBe(true);
      }
    }
  }, 30_000);
});

describe('saved bests', () => {
  it('keys are quiz and level', () => {
    expect(bestKey('hard')).toBe('quiz-hard');
  });
  it('keeps whole scores from 1 to 10 for known levels and drops everything else', () => {
    expect(sanitiseBest({ 'quiz-easy': 10, 'quiz-hard': 1 })).toEqual({ 'quiz-easy': 10, 'quiz-hard': 1 });
    expect(sanitiseBest({ 'quiz-easy': 11, 'quiz-medium': 0, 'quiz-hard': -2 })).toEqual({});
    expect(sanitiseBest({ 'quiz-easy': 2.5, 'quiz-medium': NaN, 'quiz-hard': Infinity, 'quiz-wild': 4, x: 1 })).toEqual({});
  });
  it('rejects strings, booleans, arrays, null, non-objects and prototype tricks', () => {
    expect(sanitiseBest({ 'quiz-easy': '5', 'quiz-medium': true, 'quiz-hard': [5] })).toEqual({});
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"quiz-easy": 5}, "constructor": 3}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
});

describe('small helpers', () => {
  it('pluralises', () => {
    expect(plural(1, 'letter')).toBe('1 letter');
    expect(plural(2, 'letter')).toBe('2 letters');
  });
  it('parseSeed accepts only whole numbers from 1 to 2^32 - 1', () => {
    expect(parseSeed('9')).toBe(9);
    for (const bad of ['0', '-1', '4294967296', '1.5', '', 'x', NaN, null, undefined, {}]) expect(parseSeed(bad)).toBeNull();
  });
  it('shuffle keeps every item once', () => {
    const a = Array.from({ length: 36 }, (_, i) => i);
    expect(shuffled(a, mulberry32(2)).sort((x, y) => x - y)).toEqual(a);
  });
});
