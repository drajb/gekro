/**
 * games-typing-test.test.ts - the engine behind `typing-test`.
 *
 * Pinned: the sentence bank is plain ASCII with sane lengths and no duplicates,
 * the passage builder is deterministic and never repeats a sentence within a pass,
 * the character comparison survives hostile strings, the formulas give the known
 * values (300 correct characters in 60 s is 60 WPM, 50 correct of 100 typed is 50%),
 * zero time never divides by zero, the state machine counts mistakes at keystroke
 * time and ignores bulk input, a scripted replay produces the expected result, and
 * whatever comes out of localStorage is sanitised. Every number the content page
 * quotes is asserted here.
 */
import { describe, it, expect } from 'vitest';
import {
  CHARS_PER_WORD, DURATIONS, DEFAULT_DURATION, MIN_ELAPSED_MS, INITIAL_SENTENCES, EXTEND_SENTENCES, EXTEND_MARGIN,
  MAX_TYPED, MAX_TARGET, MAX_BURST, MIN_LEGIT_CHARS, MAX_WPM, MAX_TESTS,
  mulberry32, shuffled, pickSentences, buildPassage, needsMore,
  toChars, compare, compareChars, diffTyped, countNewMistakes, PENDING, CORRECT, WRONG,
  accuracy, stats, cleanDuration, initialState, reduce, resultOf,
  formatTime, formatWpm, formatPercent, resultSummary,
  emptySaved, sanitiseStored, toStorable, isLegitimate, recordResult, bestNotice,
  type TestState, type Result, type Action,
} from '../src/components/apps-private/typing-test/helpers';
import { PASSAGES } from '../src/components/apps-private/typing-test/passages';

const EM_DASH = String.fromCharCode(0x2014);
const wordsOf = (s: string): number => s.split(' ').filter(Boolean).length;

describe('constants quoted on the content page', () => {
  it('match the spec', () => {
    expect(CHARS_PER_WORD).toBe(5);
    expect([...DURATIONS]).toEqual([30, 60, 120]);
    expect(DEFAULT_DURATION).toBe(60);
    expect(MIN_ELAPSED_MS).toBe(1000);
    expect(INITIAL_SENTENCES).toBe(8);
    expect(EXTEND_SENTENCES).toBe(4);
    expect(EXTEND_MARGIN).toBe(100);
    expect(MAX_TYPED).toBe(6000);
    expect(MAX_BURST).toBe(30);
    expect(MIN_LEGIT_CHARS).toBe(5);
    expect(MAX_WPM).toBe(500);
    expect(MAX_TARGET).toBeGreaterThan(MAX_TYPED);
  });
});

describe('sentence bank', () => {
  it('has more than 60 sentences', () => {
    expect(PASSAGES.length).toBeGreaterThan(60);
  });
  it('is plain ASCII, using only letters, digits, spaces and . , : ? ! -', () => {
    for (const s of PASSAGES) {
      expect(/^[\x20-\x7e]+$/.test(s), s).toBe(true);
      expect(/^[A-Za-z0-9 .,:?!-]+$/.test(s), s).toBe(true);
    }
  });
  it('has 8 to 20 words per sentence and 40 to 140 characters', () => {
    for (const s of PASSAGES) {
      expect(wordsOf(s), s).toBeGreaterThanOrEqual(8);
      expect(wordsOf(s), s).toBeLessThanOrEqual(20);
      expect(s.length, s).toBeGreaterThanOrEqual(40);
      expect(s.length, s).toBeLessThanOrEqual(140);
    }
  });
  it('has clean spacing: no leading, trailing or doubled spaces', () => {
    for (const s of PASSAGES) {
      expect(s, s).toBe(s.trim());
      expect(s.includes('  '), s).toBe(false);
    }
  });
  it('starts with a capital and ends like a sentence', () => {
    for (const s of PASSAGES) {
      expect(/^[A-Z]/.test(s), s).toBe(true);
      expect(/[.?!]$/.test(s), s).toBe(true);
    }
  });
  it('has no duplicates, even ignoring case', () => {
    expect(new Set(PASSAGES).size).toBe(PASSAGES.length);
    expect(new Set(PASSAGES.map((s) => s.toLowerCase())).size).toBe(PASSAGES.length);
  });
  it('contains no em-dash, en-dash, quotation mark, apostrophe or curly character', () => {
    for (const s of PASSAGES) {
      expect(s.includes(EM_DASH)).toBe(false);
      expect(s.includes(String.fromCharCode(0x2013))).toBe(false);
      expect(/["'`‘’“”]/.test(s), s).toBe(false);
    }
  });
  it('has no text that looks like a broken value', () => {
    for (const s of PASSAGES) {
      expect(/NaN|undefined|null|Infinity/.test(s), s).toBe(false);
      expect(/undefined|null|infinity/i.test(s), s).toBe(false);
    }
  });
  it('mixes in capitals, numbers and other punctuation', () => {
    expect(PASSAGES.filter((s) => /\d/.test(s)).length).toBeGreaterThanOrEqual(5);
    expect(PASSAGES.filter((s) => /[A-Z]/.test(s.slice(1))).length).toBeGreaterThanOrEqual(5);
    expect(PASSAGES.filter((s) => s.endsWith('?')).length).toBeGreaterThanOrEqual(2);
    expect(PASSAGES.filter((s) => s.endsWith('!')).length).toBeGreaterThanOrEqual(1);
    expect(PASSAGES.filter((s) => s.includes(',')).length).toBeGreaterThanOrEqual(30);
  });
});

describe('shuffled', () => {
  it('is a permutation, does not mutate its input and survives a bad rng', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const out = shuffled(src, mulberry32(3));
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const bad of [NaN, Infinity, -4, 9]) expect(shuffled(src, () => bad).slice().sort()).toEqual(src);
  });
});

describe('pickSentences and buildPassage', () => {
  it('returns the requested number of sentences, all from the bank', () => {
    const r = mulberry32(1);
    for (const n of [0, 1, 4, 8, 30]) {
      const out = pickSentences(r, n);
      expect(out).toHaveLength(n);
      for (const s of out) expect(PASSAGES).toContain(s);
    }
  });
  it('never repeats a sentence within one pass through the bank', () => {
    const out = pickSentences(mulberry32(2), PASSAGES.length);
    expect(new Set(out).size).toBe(PASSAGES.length);
    expect([...out].sort()).toEqual([...PASSAGES].sort());
  });
  it('beyond the bank it starts new passes and still never puts the same sentence twice in a row', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const out = pickSentences(mulberry32(seed), PASSAGES.length * 3 + 5);
      expect(out).toHaveLength(PASSAGES.length * 3 + 5);
      for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
    }
  });
  it('uses the sentences it was asked to avoid last', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const avoid = PASSAGES.slice(0, 12);
      const out = pickSentences(mulberry32(seed), 8, avoid);
      for (const s of out) expect(avoid).not.toContain(s);
    }
  });
  it('treats a bad count as zero and caps a huge one', () => {
    for (const bad of [0, -3, NaN, Infinity, -Infinity, 0.9]) expect(pickSentences(mulberry32(1), bad as number)).toEqual([]);
    expect(pickSentences(mulberry32(1), 1e9).length).toBe(400);
    expect(pickSentences(mulberry32(1), '5' as unknown as number)).toEqual([]);
  });
  it('is deterministic for a seed and differs across seeds', () => {
    expect(buildPassage(mulberry32(7), 8)).toBe(buildPassage(mulberry32(7), 8));
    expect(buildPassage(mulberry32(7), 8)).not.toBe(buildPassage(mulberry32(8), 8));
  });
  it('a misbehaving rng cannot break it', () => {
    for (const bad of [NaN, Infinity, -1, 5]) {
      const out = pickSentences(() => bad, 8);
      expect(out).toHaveLength(8);
      for (const s of out) expect(PASSAGES).toContain(s);
    }
  });
  it('the opening passage is long, plain ASCII and joined by single spaces', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const p = buildPassage(mulberry32(seed), INITIAL_SENTENCES);
      expect(p.length).toBeGreaterThanOrEqual(400);
      expect(/^[A-Za-z0-9 .,:?!-]+$/.test(p)).toBe(true);
      expect(p.includes('  ')).toBe(false);
      expect(p.split(/(?<=[.?!]) /)).toHaveLength(INITIAL_SENTENCES);
      expect(p.includes(EM_DASH)).toBe(false);
    }
  });
  it('an empty passage is an empty string', () => {
    expect(buildPassage(mulberry32(1), 0)).toBe('');
  });
});

describe('needsMore', () => {
  it('asks for more text within 100 characters of the end', () => {
    expect(needsMore(0, 700)).toBe(false);
    expect(needsMore(599, 700)).toBe(false);
    expect(needsMore(600, 700)).toBe(true);
    expect(needsMore(700, 700)).toBe(true);
    expect(needsMore(900, 700)).toBe(true);
  });
  it('survives bad numbers', () => {
    expect(needsMore(NaN, 700)).toBe(false);
    expect(needsMore(10, NaN)).toBe(true);
    expect(() => needsMore(Infinity, 700)).not.toThrow();
    expect(needsMore(0, 50, 100)).toBe(true);
  });
});

describe('compare', () => {
  it('marks each character pending, correct or wrong', () => {
    const c = compare('hello', 'hxl');
    expect(c.states).toEqual([CORRECT, WRONG, CORRECT, PENDING, PENDING]);
    expect(c).toMatchObject({ typed: 3, correct: 2, wrong: 1 });
  });
  it('is case and space sensitive', () => {
    expect(compare('Ab c', 'ab c').states).toEqual([WRONG, CORRECT, CORRECT, CORRECT]);
    expect(compare('a b', 'a  ').states).toEqual([CORRECT, CORRECT, WRONG]);
    expect(compare('a b', 'ab').states).toEqual([CORRECT, WRONG, PENDING]);
  });
  it('nothing typed: all pending, zero counts', () => {
    expect(compare('abc', '')).toEqual({ states: [PENDING, PENDING, PENDING], typed: 0, correct: 0, wrong: 0 });
  });
  it('a perfect and a fully wrong attempt', () => {
    expect(compare('abc', 'abc')).toMatchObject({ typed: 3, correct: 3, wrong: 0 });
    expect(compare('abc', 'xyz')).toMatchObject({ typed: 3, correct: 0, wrong: 3 });
  });
  it('characters beyond the end of the text count as typed and wrong, with no extra states', () => {
    const c = compare('ab', 'abcd');
    expect(c.states).toEqual([CORRECT, CORRECT]);
    expect(c).toMatchObject({ typed: 4, correct: 2, wrong: 2 });
  });
  it('an empty text has no states', () => {
    expect(compare('', 'abc')).toEqual({ states: [], typed: 3, correct: 0, wrong: 3 });
  });
  it('an emoji counts as one character, not two', () => {
    const c = compare('ab', '\u{1F600}b');
    expect(c).toMatchObject({ typed: 2, correct: 1, wrong: 1 });
    expect(toChars('\u{1F600}')).toHaveLength(1);
  });
  it('combining marks, newlines, tabs, zero-width and RTL text are just wrong characters', () => {
    const hostile = ['éé', 'a\nb\r\nc', '\t\t\t', 'x​x', '‮abc', '\u0000\u0001', '<script>alert(1)</script>', '"; DROP TABLE x;--', '%s%d{{7*7}}'];
    for (const h of hostile) {
      const c = compare('The quick brown fox', h);
      expect(c.states).toHaveLength('The quick brown fox'.length);
      expect(c.typed).toBe(Array.from(h).length);
      expect(c.correct + c.wrong).toBe(c.typed);
      expect(Object.values(c).every((v) => (Array.isArray(v) ? true : Number.isFinite(v)))).toBe(true);
    }
  });
  it('a lone surrogate does not throw', () => {
    expect(() => compare('abc', '\ud83d')).not.toThrow();
    expect(compare('abc', '\ud83d').wrong).toBe(1);
  });
  it('a million typed characters is handled quickly and the states array stays the length of the text', () => {
    const t = performance.now();
    const c = compare('The quick brown fox', '#'.repeat(1_000_000));
    expect(performance.now() - t).toBeLessThan(2000);
    expect(c.states).toHaveLength(19);
    expect(c).toMatchObject({ typed: 1_000_000, correct: 0, wrong: 1_000_000 });
  });
  it('non-string input is treated as empty', () => {
    expect(toChars(undefined)).toEqual([]);
    expect(toChars(42)).toEqual([]);
    expect(toChars(null)).toEqual([]);
    expect(compareChars(['a'], []).typed).toBe(0);
  });
  it('does not mutate its inputs', () => {
    const t = ['a', 'b'];
    const y = ['a', 'x'];
    compareChars(t, y);
    expect(t).toEqual(['a', 'b']);
    expect(y).toEqual(['a', 'x']);
  });
});

describe('diffTyped and countNewMistakes', () => {
  const chars = (s: string) => Array.from(s);
  it('typing one character at the end inserts exactly that character', () => {
    expect(diffTyped(chars('ab'), chars('abc'))).toEqual({ prefix: 2, insertedFrom: 2, insertedTo: 3 });
  });
  it('a backspace inserts nothing', () => {
    const d = diffTyped(chars('abc'), chars('ab'));
    expect(d.insertedTo - d.insertedFrom).toBe(0);
    expect(countNewMistakes(chars('abc'), d, chars('ab'))).toBe(0);
  });
  it('a character inserted in the middle shifts the rest but only the new character is judged', () => {
    const target = chars('hello world');
    const next = chars('hello world');
    const d = diffTyped(chars('hllo world'), next);
    expect(d.insertedTo - d.insertedFrom).toBe(1);
    expect(countNewMistakes(target, d, next)).toBe(0);
  });
  it('a replaced selection counts the new wrong characters', () => {
    const target = chars('the cat');
    const next = chars('tzz cat');
    const d = diffTyped(chars('the cat'), next);
    expect(countNewMistakes(target, d, next)).toBe(2);
  });
  it('the whole text replaced is all inserted', () => {
    const d = diffTyped(chars('abc'), chars('xyz'));
    expect(d).toEqual({ prefix: 0, insertedFrom: 0, insertedTo: 3 });
  });
  it('identical text inserts nothing', () => {
    const d = diffTyped(chars('abc'), chars('abc'));
    expect(d.insertedTo - d.insertedFrom).toBe(0);
  });
  it('from empty, everything is inserted; to empty, nothing', () => {
    expect(diffTyped([], chars('ab'))).toEqual({ prefix: 0, insertedFrom: 0, insertedTo: 2 });
    const d = diffTyped(chars('ab'), []);
    expect(d.insertedTo - d.insertedFrom).toBe(0);
  });
  it('the inserted range is always within the new text, for random edits', () => {
    const r = mulberry32(9);
    const alphabet = 'ab c';
    const rand = () => Array.from({ length: Math.floor(r() * 8) }, () => alphabet[Math.floor(r() * alphabet.length)]);
    for (let k = 0; k < 500; k++) {
      const a = rand();
      const b = rand();
      const d = diffTyped(a, b);
      expect(d.insertedFrom).toBeGreaterThanOrEqual(0);
      expect(d.insertedTo).toBeGreaterThanOrEqual(d.insertedFrom);
      expect(d.insertedTo).toBeLessThanOrEqual(b.length);
      // Everything before and after the inserted range is unchanged text.
      expect(a.slice(0, d.prefix)).toEqual(b.slice(0, d.prefix));
      const tail = b.length - d.insertedTo;
      expect(tail === 0 ? [] : a.slice(a.length - tail)).toEqual(tail === 0 ? [] : b.slice(d.insertedTo));
    }
  });
  it('characters past the end of the text are mistakes', () => {
    const next = chars('abc');
    const d = diffTyped(chars('ab'), next);
    expect(countNewMistakes(chars('ab'), d, next)).toBe(1);
  });
});

describe('the formulas', () => {
  it('300 correct characters in 60 s is 60 WPM', () => {
    const s = stats(300, 300, 60_000);
    expect(s.net).toBe(60);
    expect(s.gross).toBe(60);
    expect(s.accuracy).toBe(100);
  });
  it('one word is five characters: 5 in a minute is 1 WPM, 5 in a second is 60 WPM', () => {
    expect(stats(5, 5, 60_000).net).toBe(1);
    expect(stats(5, 5, 1000).net).toBe(60);
    expect(stats(1, 1, 60_000).net).toBeCloseTo(0.2, 10);
  });
  it('net uses correct characters, gross uses typed characters', () => {
    const s = stats(250, 300, 60_000);
    expect(s.net).toBe(50);
    expect(s.gross).toBe(60);
    expect(s.gross).toBeGreaterThanOrEqual(s.net);
  });
  it('time scales the rate: the same characters in half the time is double the WPM', () => {
    expect(stats(150, 150, 30_000).net).toBe(60);
    expect(stats(300, 300, 120_000).net).toBe(30);
  });
  it('50 correct of 100 typed is 50% accuracy', () => {
    expect(accuracy(50, 100)).toBe(50);
    expect(stats(50, 100, 60_000).accuracy).toBe(50);
  });
  it('accuracy is 100% when nothing is typed, and never NaN', () => {
    expect(accuracy(0, 0)).toBe(100);
    expect(stats(0, 0, 0).accuracy).toBe(100);
    expect(accuracy(NaN, NaN)).toBe(100);
    expect(accuracy(5, undefined as unknown as number)).toBe(100);
  });
  it('accuracy rounds down to one decimal, so 100 means exactly 100', () => {
    expect(accuracy(1, 3)).toBe(33.3);
    expect(accuracy(2, 3)).toBe(66.6);
    expect(accuracy(999, 1000)).toBe(99.9);
    expect(accuracy(9999, 10000)).toBe(99.9);
    expect(accuracy(1000, 1000)).toBe(100);
    expect(accuracy(29, 100)).toBe(29);
    expect(accuracy(0, 10)).toBe(0);
  });
  it('accuracy is clamped when correct exceeds typed', () => {
    expect(accuracy(200, 100)).toBe(100);
    expect(stats(200, 100, 60_000).net).toBe(20);
  });
  it('zero, negative and tiny elapsed time use the one-second floor instead of dividing by zero', () => {
    for (const e of [0, -5, 1, 999, NaN]) {
      const s = stats(5, 5, e);
      expect(s.net).toBe(60);
      expect(s.gross).toBe(60);
    }
    expect(stats(5, 5, 1000).net).toBe(60);
    expect(stats(5, 5, 1001).net).toBeLessThan(60);
  });
  it('infinite elapsed time gives 0, not NaN', () => {
    const s = stats(100, 100, Infinity);
    expect(s.net).toBe(0);
    expect(s.gross).toBe(0);
  });
  it('huge input stays finite', () => {
    const s = stats(1e12, 1e12, 60_000);
    expect(Number.isFinite(s.net)).toBe(true);
    expect(s.net).toBe(2e11);
    expect(s.accuracy).toBe(100);
    const t = stats(Number.MAX_VALUE, Number.MAX_VALUE, 1000);
    expect(Number.isFinite(t.net)).toBe(true);
    expect(Number.isFinite(t.gross)).toBe(true);
  });
  it('bad numbers are treated as zero', () => {
    for (const bad of [NaN, -5, Infinity, -Infinity, undefined, null, '12', {}] as unknown as number[]) {
      const s = stats(bad, bad, 60_000);
      expect(s).toEqual({ gross: 0, net: 0, accuracy: 100 });
    }
    expect(stats(10.9, 10.9, 60_000).net).toBe(2); // fractions are dropped: 10 characters
  });
  it('never returns NaN or Infinity for random input', () => {
    const r = mulberry32(21);
    const pool = [0, 1, 5, 99, 1e6, -1, NaN, Infinity, 0.5, 1e300];
    for (let k = 0; k < 500; k++) {
      const s = stats(pool[Math.floor(r() * pool.length)], pool[Math.floor(r() * pool.length)], pool[Math.floor(r() * pool.length)]);
      expect(Number.isFinite(s.net) && Number.isFinite(s.gross) && Number.isFinite(s.accuracy)).toBe(true);
      expect(s.accuracy).toBeGreaterThanOrEqual(0);
      expect(s.accuracy).toBeLessThanOrEqual(100);
    }
  });
});

describe('initialState and cleanDuration', () => {
  it('starts ready with nothing typed', () => {
    expect(initialState('abc', 30)).toEqual({
      phase: 'ready', target: 'abc', durationMs: 30_000, typed: '', startAt: null, endAt: null, mistakes: 0, rejected: 0,
    });
  });
  it('only 30, 60 and 120 are durations; anything else becomes 60', () => {
    for (const d of [30, 60, 120]) expect(cleanDuration(d)).toBe(d);
    for (const bad of [0, 45, -60, NaN, Infinity, '60', null, undefined, {}]) expect(cleanDuration(bad)).toBe(60);
    expect(initialState('x', 45).durationMs).toBe(60_000);
    expect(initialState('x').durationMs).toBe(60_000);
  });
  it('a non-string target becomes empty and a huge one is capped', () => {
    expect(initialState(undefined as unknown as string).target).toBe('');
    expect(initialState('a'.repeat(MAX_TARGET + 500)).target).toHaveLength(MAX_TARGET);
  });
});

describe('state machine: starting and typing', () => {
  const T = 'the quick brown fox jumps over the lazy dog';
  const ty = (s: TestState, typed: string, at: number): TestState => reduce(s, { type: 'input', typed, at });

  it('the clock starts on the first keystroke, not before', () => {
    const s0 = initialState(T, 60);
    expect(reduce(s0, { type: 'tick', at: 99_999 })).toBe(s0);
    const s1 = ty(s0, 't', 5000);
    expect(s1.phase).toBe('running');
    expect(s1.startAt).toBe(5000);
    expect(s1.typed).toBe('t');
    expect(s1.mistakes).toBe(0);
    expect(ty(s1, 'th', 5200).startAt).toBe(5000); // start time never moves
  });
  it('empty input while ready does nothing', () => {
    const s0 = initialState(T);
    expect(ty(s0, '', 10)).toBe(s0);
  });
  it('never mutates the state it was given', () => {
    const s0 = Object.freeze(initialState(T));
    const s1 = Object.freeze(ty(s0, 'tx', 1));
    expect(() => ty(s1, 'txy', 2)).not.toThrow();
    expect(s0.typed).toBe('');
    expect(s1.typed).toBe('tx');
  });
  it('counts a mistake at the moment it is typed, and a backspace does not erase it', () => {
    let s = ty(initialState(T), 'x', 0); // wrong
    expect(s.mistakes).toBe(1);
    s = ty(s, '', 100); // backspace
    expect(s.mistakes).toBe(1);
    expect(s.typed).toBe('');
    s = ty(s, 't', 200); // right
    expect(s.mistakes).toBe(1);
    s = ty(s, 'tz', 300); // wrong again
    s = ty(s, 't', 400);
    s = ty(s, 'th', 500);
    expect(s.mistakes).toBe(2);
    expect(compare(s.target, s.typed)).toMatchObject({ correct: 2, wrong: 0 });
  });
  it('typing the same wrong key twice counts twice', () => {
    let s = ty(initialState(T), 'x', 0);
    s = ty(s, 'xx', 50);
    expect(s.mistakes).toBe(2);
  });
  it('replacing a selection counts only the new wrong characters', () => {
    let s = ty(initialState(T), 't', 0);
    s = ty(s, 'th', 10);
    s = ty(s, 'the', 20);
    s = ty(s, 'tzz', 30); // "he" selected and overwritten
    expect(s.mistakes).toBe(2);
  });
  it('characters typed past the end of the text are mistakes', () => {
    let s = ty(initialState('ab'), 'a', 0);
    s = ty(s, 'ab', 10);
    s = ty(s, 'abc', 20);
    expect(s.mistakes).toBe(1);
    expect(compare(s.target, s.typed).wrong).toBe(1);
  });
  it('an input that is not a string or has a bad timestamp is ignored', () => {
    const s0 = initialState(T);
    expect(reduce(s0, { type: 'input', typed: 5 as unknown as string, at: 0 })).toBe(s0);
    expect(reduce(s0, { type: 'input', typed: 'a', at: NaN })).toBe(s0);
    expect(reduce(s0, { type: 'input', typed: 'a', at: Infinity })).toBe(s0);
    const run = ty(s0, 'a', 1000);
    expect(ty(run, 'ab', 500)).toBe(run); // before the start
  });
  it('text identical to what is already there does nothing', () => {
    const s = ty(initialState(T), 't', 0);
    expect(ty(s, 't', 100)).toBe(s);
  });
});

describe('state machine: bulk and oversize input is ignored', () => {
  const T = 'the quick brown fox jumps over the lazy dog';
  it('up to MAX_BURST new characters at once is accepted, one more is not', () => {
    const ok = reduce(initialState(T), { type: 'input', typed: 'a'.repeat(MAX_BURST), at: 0 });
    expect(ok.phase).toBe('running');
    expect(ok.typed).toHaveLength(MAX_BURST);
    const s0 = initialState(T);
    const bad = reduce(s0, { type: 'input', typed: 'a'.repeat(MAX_BURST + 1), at: 0 });
    expect(bad.phase).toBe('ready');
    expect(bad.typed).toBe('');
    expect(bad.startAt).toBeNull();
    expect(bad.rejected).toBe(1);
    expect(s0.rejected).toBe(0);
  });
  it('a pasted block is rejected while running too, and the earlier typing survives', () => {
    let s = reduce(initialState(T), { type: 'input', typed: 'th', at: 0 });
    s = reduce(s, { type: 'input', typed: 'th' + T.slice(2), at: 100 });
    expect(s.typed).toBe('th');
    expect(s.rejected).toBe(1);
    expect(s.mistakes).toBe(0);
  });
  it('very long hostile strings are rejected quickly and change nothing else', () => {
    const t = performance.now();
    let s = initialState(T);
    for (const h of ['<script>alert(1)</script>'.repeat(5000), 'x'.repeat(5_000_000), '\u{1F600}'.repeat(100_000), '\n'.repeat(70_000)]) {
      s = reduce(s, { type: 'input', typed: h, at: 1 });
    }
    expect(performance.now() - t).toBeLessThan(2000);
    expect(s.phase).toBe('ready');
    expect(s.typed).toBe('');
    expect(s.rejected).toBe(4);
  });
  it('text longer than MAX_TYPED is rejected even when each step is small', () => {
    const base: TestState = { ...initialState(T), phase: 'running', startAt: 0, typed: 'a'.repeat(MAX_TYPED - 10) };
    const edge = reduce(base, { type: 'input', typed: 'a'.repeat(MAX_TYPED), at: 10 });
    expect(edge.typed).toHaveLength(MAX_TYPED);
    const over = reduce(edge, { type: 'input', typed: 'a'.repeat(MAX_TYPED + 1), at: 20 });
    expect(over.typed).toHaveLength(MAX_TYPED);
    expect(over.rejected).toBe(1);
  });
  it('short hostile strings are accepted as ordinary wrong characters and never break the state', () => {
    for (const h of ['<script>alert(1)</script>', '\u{1F600}\u{1F600}', 'é', '\n\n', '"; DROP', '{{7*7}}']) {
      const s = reduce(initialState(T), { type: 'input', typed: h, at: 0 });
      expect(s.typed).toBe(h);
      expect(s.mistakes).toBeGreaterThan(0);
      const r = resultOf(s, 1000);
      expect(Object.values(r).every((v) => Number.isFinite(v))).toBe(true);
    }
  });
});

describe('state machine: time', () => {
  const T = 'abcde'.repeat(60);
  const running = (): TestState => reduce(initialState(T, 30), { type: 'input', typed: 'a', at: 1000 });

  it('a tick before the end changes nothing; at the end the test is done', () => {
    const s = running();
    expect(reduce(s, { type: 'tick', at: 1000 })).toBe(s);
    expect(reduce(s, { type: 'tick', at: 30_999 })).toBe(s);
    const done = reduce(s, { type: 'tick', at: 31_000 });
    expect(done.phase).toBe('done');
    expect(done.endAt).toBe(31_000);
    expect(done.typed).toBe('a');
  });
  it('an input stamped at or after the end is not counted and ends the test', () => {
    const s = running();
    const late = reduce(s, { type: 'input', typed: 'ab', at: 31_000 });
    expect(late.phase).toBe('done');
    expect(late.typed).toBe('a');
    expect(late.mistakes).toBe(0);
    const justIn = reduce(s, { type: 'input', typed: 'ab', at: 30_999.9 });
    expect(justIn.phase).toBe('running');
    expect(justIn.typed).toBe('ab');
  });
  it('once done, nothing changes', () => {
    const done = reduce(running(), { type: 'tick', at: 40_000 });
    const acts: Action[] = [
      { type: 'input', typed: 'abc', at: 41_000 }, { type: 'tick', at: 50_000 }, { type: 'extend', text: ' more' },
    ];
    for (const a of acts) expect(reduce(done, a)).toBe(done);
  });
  it('a bad tick timestamp is ignored, and a tick while ready does nothing', () => {
    const s = running();
    expect(reduce(s, { type: 'tick', at: NaN })).toBe(s);
    const r = initialState(T);
    expect(reduce(r, { type: 'tick', at: 1e9 })).toBe(r);
  });
  it('an unknown action returns the same state', () => {
    const s = running();
    expect(reduce(s, { type: 'bogus' } as unknown as Action)).toBe(s);
  });
});

describe('state machine: extending the text', () => {
  it('appends text and leaves everything else alone', () => {
    const s = reduce(initialState('abc'), { type: 'input', typed: 'a', at: 0 });
    const e = reduce(s, { type: 'extend', text: ' def' });
    expect(e.target).toBe('abc def');
    expect(e.typed).toBe('a');
    expect(e.startAt).toBe(0);
    expect(s.target).toBe('abc');
  });
  it('ignores empty and non-string text', () => {
    const s = initialState('abc');
    expect(reduce(s, { type: 'extend', text: '' })).toBe(s);
    expect(reduce(s, { type: 'extend', text: 5 as unknown as string })).toBe(s);
  });
  it('never grows past MAX_TARGET', () => {
    let s = initialState('a'.repeat(MAX_TARGET - 3));
    s = reduce(s, { type: 'extend', text: 'bbbbbbbb' });
    expect(s.target).toHaveLength(MAX_TARGET);
    const same = reduce(s, { type: 'extend', text: 'more' });
    expect(same).toBe(s);
  });
  it('a real passage can be extended with sentences chosen to avoid the ones on screen', () => {
    const r = mulberry32(3);
    let sentences = pickSentences(r, INITIAL_SENTENCES);
    let s = initialState(sentences.join(' '));
    const startLen = s.target.length;
    const more = pickSentences(r, EXTEND_SENTENCES, sentences.slice(-12));
    for (const m of more) expect(sentences).not.toContain(m);
    sentences = [...sentences, ...more];
    s = reduce(s, { type: 'extend', text: ` ${more.join(' ')}` });
    expect(s.target.length).toBeGreaterThan(startLen + 100);
    expect(s.target).toBe(sentences.join(' '));
  });
});

describe('a scripted replay', () => {
  const T = 'abcde'.repeat(60); // 300 characters

  /** Feed typed prefixes with timestamps through the machine, then let the clock run out. */
  const replay = (script: [string, number][], target: string, durationSec: number, endTick: number): TestState => {
    let s = initialState(target, durationSec);
    for (const [typed, at] of script) s = reduce(s, { type: 'input', typed, at });
    return reduce(s, { type: 'tick', at: endTick });
  };

  it('perfect typing at 10 characters a second for 30 s: 300 characters, 120 WPM, 100%', () => {
    const script: [string, number][] = [];
    for (let i = 0; i < 300; i++) script.push([T.slice(0, i + 1), 1000 + i * 100]);
    const s = replay(script, T, 30, 31_000);
    expect(s.phase).toBe('done');
    expect(s.startAt).toBe(1000);
    expect(s.endAt).toBe(31_000);
    expect(s.mistakes).toBe(0);
    const r = resultOf(s);
    expect(r).toMatchObject({ durationSec: 30, elapsedMs: 30_000, typedChars: 300, correctChars: 300, wrongChars: 0, mistakes: 0, accuracy: 100 });
    expect(r.netWpm).toBe(120); // (300 / 5) words in half a minute
    expect(r.grossWpm).toBe(120);
  });

  it('a mistake that is corrected shows in mistakes made but not in errors left or accuracy', () => {
    const script: [string, number][] = [];
    let typed = '';
    let at = 0;
    const key = (next: string) => { typed = next; script.push([typed, at]); at += 50; };
    for (let i = 0; i < 300; i++) {
      if (i === 10) { key(`${typed}z`); key(typed); } // wrong key, then backspace
      key(T.slice(0, i + 1));
    }
    expect(script).toHaveLength(302);
    const s = replay(script, T, 30, 30_000);
    expect(s.phase).toBe('done');
    const r = resultOf(s);
    expect(r).toMatchObject({ typedChars: 300, correctChars: 300, wrongChars: 0, mistakes: 1, accuracy: 100 });
    expect(r.netWpm).toBe(120);
  });

  it('an uncorrected mistake lowers accuracy and net WPM: 149 correct of 150 typed in 60 s', () => {
    const script: [string, number][] = [];
    for (let i = 0; i < 150; i++) {
      const typed = T.slice(0, i + 1).split('');
      if (i >= 100) typed[100] = 'q'; // position 100 is wrong from the moment it is typed
      script.push([typed.join(''), 2000 + i * 300]);
    }
    expect(T[100]).not.toBe('q');
    const s = replay(script, T, 60, 62_000);
    expect(s.phase).toBe('done');
    const r = resultOf(s);
    expect(r).toMatchObject({ durationSec: 60, typedChars: 150, correctChars: 149, wrongChars: 1, mistakes: 1, accuracy: 99.3 });
    expect(r.netWpm).toBeCloseTo(29.8, 10);
    expect(r.grossWpm).toBe(30);
    expect(formatWpm(r.netWpm)).toBe('30');
    expect(formatPercent(r.accuracy)).toBe('99.3%');
  });

  it('keystrokes stamped after the time ran out are not counted', () => {
    const script: [string, number][] = [];
    for (let i = 0; i < 400; i++) script.push([T.slice(0, i + 1), 1000 + i * 100]); // 40 s of typing, 30 s test
    const s = replay(script, T, 30, 50_000);
    expect(s.phase).toBe('done');
    expect(s.typed).toHaveLength(300);
    expect(resultOf(s).netWpm).toBe(120);
  });

  it('typing nothing leaves the test ready with a zero result', () => {
    let s = initialState(T, 60);
    s = reduce(s, { type: 'tick', at: 1e9 });
    expect(s.phase).toBe('ready');
    const r = resultOf(s);
    expect(r).toMatchObject({ typedChars: 0, correctChars: 0, wrongChars: 0, mistakes: 0, accuracy: 100, netWpm: 0, grossWpm: 0, elapsedMs: 0 });
  });

  it('the live result while running uses the time since the first keystroke, floored at one second', () => {
    let s = initialState(T, 60);
    s = reduce(s, { type: 'input', typed: 'abcde', at: 10_000 });
    const early = resultOf(s, 10_000);
    expect(early.elapsedMs).toBe(0);
    expect(early.netWpm).toBe(60); // 5 characters, floored to one second
    const later = resultOf(s, 70_000);
    expect(later.elapsedMs).toBe(60_000);
    expect(later.netWpm).toBe(1);
    const beyond = resultOf(s, 500_000);
    expect(beyond.elapsedMs).toBe(60_000); // never beyond the duration
    expect(resultOf(s, NaN).elapsedMs).toBe(0);
    expect(resultOf(s).elapsedMs).toBe(0);
  });

  it('replays are deterministic', () => {
    const run = () => {
      const r = mulberry32(77);
      let s = initialState(T, 60);
      let typed = '';
      let at = 0;
      for (let i = 0; i < 2000; i++) {
        at += Math.floor(r() * 120);
        const k = r();
        if (k < 0.1) typed = typed.slice(0, -1);
        else typed += k < 0.2 ? 'z' : T[typed.length % T.length];
        s = reduce(s, { type: 'input', typed, at });
      }
      return JSON.stringify([s, resultOf(s, at)]);
    };
    expect(run()).toBe(run());
  });
});

describe('state machine: invariants under random input', () => {
  it('survives thousands of random actions without a bad state or a bad number', () => {
    const r = mulberry32(31337);
    const alphabet = ['a', 'b', 'c', ' ', 'z', '\u{1F600}', 'é', '\n', '<', '"'];
    let s = initialState('abc def ghi '.repeat(40), 30);
    let typed = '';
    let t = 1000;
    let wasDone: TestState | null = null;
    for (let i = 0; i < 4000; i++) {
      t += Math.floor(r() * 60);
      const k = r();
      let a: Action;
      if (k < 0.7) {
        if (r() < 0.2) typed = typed.slice(0, Math.max(0, typed.length - 1 - Math.floor(r() * 3)));
        else typed += alphabet[Math.floor(r() * alphabet.length)];
        if (r() < 0.01) typed = 'x'.repeat(Math.floor(r() * 100));
        a = { type: 'input', typed, at: t };
      } else if (k < 0.9) a = { type: 'tick', at: t };
      else a = { type: 'extend', text: ' hello' };
      s = reduce(s, a);
      typed = s.typed; // the box always shows what the machine accepted
      expect(['ready', 'running', 'done']).toContain(s.phase);
      expect(Array.from(s.typed).length).toBeLessThanOrEqual(MAX_TYPED);
      expect(s.target.length).toBeLessThanOrEqual(MAX_TARGET);
      expect(Number.isInteger(s.mistakes) && s.mistakes >= 0).toBe(true);
      expect(Number.isInteger(s.rejected) && s.rejected >= 0).toBe(true);
      const res = resultOf(s, t);
      for (const v of Object.values(res)) expect(Number.isFinite(v)).toBe(true);
      expect(res.accuracy).toBeGreaterThanOrEqual(0);
      expect(res.accuracy).toBeLessThanOrEqual(100);
      expect(res.correctChars + res.wrongChars).toBe(res.typedChars);
      if (s.phase === 'done') {
        if (wasDone) expect(s).toBe(wasDone);
        wasDone = s;
        expect(s.endAt).toBe((s.startAt as number) + s.durationMs);
      }
      if (s.phase === 'ready') expect(s.startAt).toBeNull();
    }
    expect(wasDone).not.toBeNull();
  });
});

describe('formatting', () => {
  it('formats the clock', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(30)).toBe('0:30');
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(120)).toBe('2:00');
    expect(formatTime(65.9)).toBe('1:05');
    for (const bad of [NaN, -5, Infinity, undefined as unknown as number]) expect(formatTime(bad)).toBe('0:00');
  });
  it('formats WPM as a whole number and survives bad input', () => {
    expect(formatWpm(59.4)).toBe('59');
    expect(formatWpm(59.5)).toBe('60');
    expect(formatWpm(0)).toBe('0');
    for (const bad of [NaN, Infinity, -3, null, undefined, '4']) expect(formatWpm(bad as unknown as number)).toBe('0');
  });
  it('formats a percentage and clamps it', () => {
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(50)).toBe('50%');
    expect(formatPercent(99.9)).toBe('99.9%');
    expect(formatPercent(133)).toBe('100%');
    expect(formatPercent(-4)).toBe('0%');
    for (const bad of [NaN, Infinity, undefined as unknown as number]) expect(formatPercent(bad)).toBe('-');
  });
  it('summarises a result in one line without any broken values or an em-dash', () => {
    const r: Result = {
      durationSec: 60, elapsedMs: 60_000, typedChars: 300, correctChars: 290, wrongChars: 10, mistakes: 14,
      accuracy: 96.6, netWpm: 58, grossWpm: 60,
    };
    expect(resultSummary(r)).toBe('Typing Speed Test (60 s): 58 net WPM, 96.6% accuracy');
    expect(resultSummary(r)).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(resultSummary(r).includes(EM_DASH)).toBe(false);
  });
});

describe('sanitiseStored', () => {
  it('keeps a good payload', () => {
    const raw = { best30: 70, tests30: 3, best60: 65, tests60: 10, best120: 60, tests120: 1 };
    expect(sanitiseStored(raw)).toEqual({ best: { 30: 70, 60: 65, 120: 60 }, tests: { 30: 3, 60: 10, 120: 1 } });
  });
  it('accepts the JSON string straight from localStorage', () => {
    expect(sanitiseStored('{"best60":55,"tests60":2}')).toEqual({ best: { 30: null, 60: 55, 120: null }, tests: { 30: 0, 60: 2, 120: 0 } });
  });
  it('returns an empty result for anything that is not a plain object', () => {
    for (const bad of [null, undefined, 42, true, '', 'not json', '[1,2,3]', '"x"', 'null', [], [1, 2], NaN, () => 1, Symbol('x')]) {
      expect(sanitiseStored(bad)).toEqual(emptySaved());
    }
  });
  it('drops strings, NaN, Infinity, objects and booleans', () => {
    const s = sanitiseStored({ best30: '70', tests30: '3', best60: NaN, tests60: Infinity, best120: {}, tests120: [5] });
    expect(s).toEqual(emptySaved());
    expect(sanitiseStored({ best30: true, best60: null, best120: [60], tests30: false })).toEqual(emptySaved());
  });
  it('clamps out-of-range numbers and rounds fractions', () => {
    const s = sanitiseStored({ best30: -20, best60: 1e9, best120: 59.6, tests30: -4, tests60: 1e12, tests120: 2.9 });
    expect(s.best).toEqual({ 30: 1, 60: MAX_WPM, 120: 60 });
    expect(s.tests).toEqual({ 30: 0, 60: MAX_TESTS, 120: 2 });
  });
  it('ignores unknown and prototype keys', () => {
    expect(sanitiseStored('{"__proto__":{"best60":100},"extra":5,"best90":50}')).toEqual(emptySaved());
    expect(({} as Record<string, unknown>).best60).toBeUndefined();
  });
  it('never yields a non-integer, non-finite or out-of-range number', () => {
    const r = mulberry32(5);
    const pool: unknown[] = [NaN, Infinity, -1, 0, 1, 499, 500, 501, 'a', null, {}, 123.456, 1e300, -1e300];
    for (let k = 0; k < 200; k++) {
      const raw: Record<string, unknown> = {};
      for (const d of DURATIONS) { raw[`best${d}`] = pool[Math.floor(r() * pool.length)]; raw[`tests${d}`] = pool[Math.floor(r() * pool.length)]; }
      const s = sanitiseStored(raw);
      for (const d of DURATIONS) {
        const b = s.best[d];
        if (b !== null) expect(Number.isInteger(b) && b >= 1 && b <= MAX_WPM).toBe(true);
        expect(Number.isInteger(s.tests[d]) && s.tests[d] >= 0 && s.tests[d] <= MAX_TESTS).toBe(true);
      }
    }
  });
});

describe('toStorable', () => {
  it('stores plain numbers only and omits empty bests', () => {
    const out = toStorable(emptySaved());
    expect(out).toEqual({ tests30: 0, tests60: 0, tests120: 0 });
    expect(JSON.stringify(out)).not.toMatch(/null|NaN|undefined/);
    const full = toStorable({ best: { 30: 70, 60: null, 120: 55 }, tests: { 30: 2, 60: 0, 120: 9 } });
    expect(full).toEqual({ best30: 70, tests30: 2, tests60: 0, best120: 55, tests120: 9 });
    for (const v of Object.values(full)) expect(typeof v).toBe('number');
  });
  it('round-trips through JSON and the sanitiser', () => {
    const s = { best: { 30: 70, 60: 65, 120: null }, tests: { 30: 3, 60: 10, 120: 1 } };
    expect(sanitiseStored(JSON.stringify(toStorable(s)))).toEqual(s);
  });
});

describe('recordResult', () => {
  const res = (over: Partial<Result> = {}): Result => ({
    durationSec: 60, elapsedMs: 60_000, typedChars: 300, correctChars: 290, wrongChars: 10, mistakes: 12,
    accuracy: 96.6, netWpm: 58, grossWpm: 60, ...over,
  });

  it('the first finished test sets the best and counts the test', () => {
    const r = recordResult(emptySaved(), 60, res());
    expect(r.kind).toBe('first');
    expect(r.previous).toBeNull();
    expect(r.saved.best[60]).toBe(58);
    expect(r.saved.tests[60]).toBe(1);
    expect(r.saved.best[30]).toBeNull();
    expect(r.saved.tests[30]).toBe(0);
  });
  it('a faster result is a new best, a slower or equal one is not, and the count goes up either way', () => {
    const base = recordResult(emptySaved(), 60, res({ netWpm: 58 })).saved;
    const faster = recordResult(base, 60, res({ netWpm: 61.2 }));
    expect(faster.kind).toBe('best');
    expect(faster.previous).toBe(58);
    expect(faster.saved.best[60]).toBe(61);
    expect(faster.saved.tests[60]).toBe(2);
    const equal = recordResult(base, 60, res({ netWpm: 58.4 }));
    expect(equal.kind).toBe('none');
    expect(equal.saved.best[60]).toBe(58);
    expect(equal.saved.tests[60]).toBe(2);
    const slower = recordResult(base, 60, res({ netWpm: 40 }));
    expect(slower.kind).toBe('none');
    expect(slower.saved.best[60]).toBe(58);
  });
  it('bests are kept per duration', () => {
    let s = recordResult(emptySaved(), 30, res({ durationSec: 30, elapsedMs: 30_000, netWpm: 70 })).saved;
    s = recordResult(s, 120, res({ durationSec: 120, elapsedMs: 120_000, netWpm: 55 })).saved;
    expect(s.best).toEqual({ 30: 70, 60: null, 120: 55 });
    expect(s.tests).toEqual({ 30: 1, 60: 0, 120: 1 });
  });
  it('a zero-WPM result counts as a test but sets no best', () => {
    const r = recordResult(emptySaved(), 60, res({ netWpm: 0.3, correctChars: 1, accuracy: 0.3 }));
    expect(r.kind).toBe('none');
    expect(r.saved.best[60]).toBeNull();
    expect(r.saved.tests[60]).toBe(1);
  });
  it('results that are not legitimate change nothing', () => {
    const base = emptySaved();
    const bad: [string, Result, number][] = [
      ['too little typed', res({ typedChars: 4 }), 60],
      ['cancelled early', res({ elapsedMs: 59_999 }), 60],
      ['impossibly fast', res({ grossWpm: MAX_WPM + 1, netWpm: MAX_WPM + 1 }), 60],
      ['NaN rate', res({ netWpm: NaN }), 60],
      ['infinite rate', res({ grossWpm: Infinity }), 60],
      ['not a real duration', res(), 45],
      ['zero duration', res(), 0],
    ];
    for (const [name, r, d] of bad) {
      const out = recordResult(base, d, r);
      expect(out.kind, name).toBe('uncounted');
      expect(out.saved, name).toBe(base);
      expect(isLegitimate(r, d), name).toBe(false);
    }
    expect(isLegitimate(res(), 60)).toBe(true);
    expect(isLegitimate(res({ typedChars: MIN_LEGIT_CHARS }), 60)).toBe(true);
  });
  it('does not mutate the saved object it was given', () => {
    const base = Object.freeze({ best: Object.freeze({ 30: null, 60: 50, 120: null }), tests: Object.freeze({ 30: 0, 60: 4, 120: 0 }) }) as ReturnType<typeof emptySaved>;
    const frozen = JSON.stringify(base);
    recordResult(base, 60, res({ netWpm: 99 }));
    expect(JSON.stringify(base)).toBe(frozen);
  });
  it('the test count stops at its cap', () => {
    const base = { best: { 30: null, 60: null, 120: null }, tests: { 30: 0, 60: MAX_TESTS, 120: 0 } };
    expect(recordResult(base, 60, res()).saved.tests[60]).toBe(MAX_TESTS);
  });
  it('the saved best is the same whole number the screen shows', () => {
    const r = res({ netWpm: 58.5 });
    expect(recordResult(emptySaved(), 60, r).saved.best[60]).toBe(Number(formatWpm(r.netWpm)));
  });
});

describe('bestNotice', () => {
  const r: Result = {
    durationSec: 60, elapsedMs: 60_000, typedChars: 300, correctChars: 290, wrongChars: 10, mistakes: 12,
    accuracy: 96.6, netWpm: 58, grossWpm: 60,
  };
  it('says the right thing for each outcome', () => {
    const first = recordResult(emptySaved(), 60, r);
    expect(bestNotice(first, 60, r)).toBe('First saved result for 60 s: 58 net WPM is now your best.');
    const better = recordResult(first.saved, 60, { ...r, netWpm: 64 });
    expect(bestNotice(better, 60, { ...r, netWpm: 64 })).toBe('New personal best for 60 s: 64 net WPM (previous best 58).');
    const worse = recordResult(first.saved, 60, { ...r, netWpm: 50 });
    expect(bestNotice(worse, 60, { ...r, netWpm: 50 })).toBe('Your best for 60 s stays 58 net WPM.');
    const zero = recordResult(emptySaved(), 60, { ...r, netWpm: 0 });
    expect(bestNotice(zero, 60, { ...r, netWpm: 0 })).toBe('No personal best saved for 60 s yet.');
    const unc = recordResult(emptySaved(), 60, { ...r, typedChars: 1 });
    expect(bestNotice(unc, 60, r)).toMatch(/Too little was typed/);
  });
  it('never contains a broken value or an em-dash', () => {
    for (const rec of [recordResult(emptySaved(), 60, r), recordResult(emptySaved(), 60, { ...r, typedChars: 0 })]) {
      const t = bestNotice(rec, 60, r);
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(t.includes(EM_DASH)).toBe(false);
    }
  });
});

describe('copy hygiene', () => {
  it('no generated text contains an em-dash', () => {
    const texts = [
      ...PASSAGES, buildPassage(mulberry32(1), 8), formatTime(65), formatWpm(NaN), formatPercent(NaN),
    ];
    for (const t of texts) expect(t.includes(EM_DASH)).toBe(false);
  });
});
