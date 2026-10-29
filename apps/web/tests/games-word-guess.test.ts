/**
 * games-word-guess.test.ts - the engine behind `word-guess`.
 *
 * Pinned: the accepted-guess list (ENABLE5) and the answer list obey their own rules,
 * every answer can be typed as a guess, the two-pass scoring never marks a letter more
 * often than the answer holds it, hard mode accepts and rejects the right guesses (and
 * never rejects the true answer), the daily word is the same for a date, never repeats
 * until the whole list is used, and follows local calendar dates; the streak rules,
 * the sanitising of stored numbers and the share text are exactly as the page says.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ENABLE5, ANSWERS, WORD_LENGTH, MAX_GUESSES, LETTERS, KEY_ROWS, MARK_CHAR, MAX_COUNT,
  mulberry32, hashString, shuffled, isLetter, isValidWord, scoreGuess, isWin, keyStates, checkHardMode, evaluateGuess, markSummary,
  ENTER_OWNERS, enterBelongsTo, randomAnswer, pushRecent, localIsoDate, dayNumber, isoToNumber, numberToIso, dailyOrder, dailyAnswer,
  emptyStats, encodeWord, decodeWord, sanitiseStats, updateStats, recordDailyProgress, currentStreak, winPercent, shareText,
  type Mark, type Row, type Stats,
} from '../src/components/apps-private/word-guess/helpers';

const C: Mark = 'correct';
const P: Mark = 'present';
const A: Mark = 'absent';
const row = (answer: string, guess: string): Row => ({ guess, marks: scoreGuess(answer, guess) });
const count = (s: string, ch: string): number => s.split(ch).length - 1;
const BAD = /NaN|undefined|null|Infinity/;

describe('accepted-guess list (ENABLE5)', () => {
  it('has exactly 8636 entries, all unique', () => {
    expect(ENABLE5).toHaveLength(8636);
    expect(new Set(ENABLE5).size).toBe(8636);
  });
  it('is sorted and every entry is five lowercase letters a-z', () => {
    expect([...ENABLE5]).toEqual([...ENABLE5].sort());
    expect(ENABLE5.filter((w) => !/^[a-z]{5}$/.test(w))).toEqual([]);
  });
  it('accepts exactly its own words', () => {
    expect(isValidWord('about')).toBe(true);
    expect(isValidWord('crane')).toBe(true);
    expect(isValidWord('zzzzz')).toBe(false);
    expect(isValidWord('abcde')).toBe(false);
    expect(ENABLE5.every((w) => isValidWord(w))).toBe(true);
  });
  it('is strict about case, length and type', () => {
    for (const bad of ['ABOUT', 'About', '', 'abou', 'aboutt', ' about', 'about ', 'ab out']) expect(isValidWord(bad), JSON.stringify(bad)).toBe(false);
    for (const bad of [undefined, null, 5, {}, [], ['about']]) expect(isValidWord(bad)).toBe(false);
  });
});

describe('answer list', () => {
  it('has more than 1,200 words, as the page says (and well over 800)', () => {
    expect(ANSWERS.length).toBeGreaterThan(1200);
    expect(ANSWERS.length).toBeGreaterThan(800);
  });
  it('has no duplicates', () => {
    const seen = new Set<string>();
    const dupes = ANSWERS.filter((w) => (seen.has(w) ? true : (seen.add(w), false)));
    expect(dupes).toEqual([]);
  });
  it('is five lowercase letters a-z for every word', () => {
    expect(ANSWERS.filter((w) => !/^[a-z]{5}$/.test(w))).toEqual([]);
  });
  it('is a subset of the accepted-guess list: every answer can be guessed', () => {
    expect(ANSWERS.filter((w) => !isValidWord(w))).toEqual([]);
  });
  it('lets every answer be reached: typed as a guess it is accepted and scores all correct', () => {
    for (const w of ANSWERS) {
      const r = evaluateGuess(w, [], w, false);
      expect(r.ok, w).toBe(true);
      if (r.ok) expect(isWin(r.marks), w).toBe(true);
      expect(evaluateGuess(w, [], w, true).ok, w).toBe(true);
    }
  });
  it('contains no word from a small blocklist of crude or offensive words', () => {
    const blocklist = [
      'bitch', 'whore', 'pussy', 'penis', 'dildo', 'boobs', 'nigga', 'negro', 'slave', 'queer', 'gypsy', 'spazz', 'wench',
      'tramp', 'sluts', 'rapes', 'bimbo', 'dicks', 'cunts', 'fagot', 'nazis', 'whack', 'crapy', 'poops', 'farts',
    ];
    expect(ANSWERS.filter((w) => blocklist.includes(w))).toEqual([]);
  });
  it('never contains a string the page could mistake for a bad value', () => {
    expect(ANSWERS.filter((w) => /nan|null|undefined|infinity/.test(w))).toEqual([]);
  });
  it('covers at least twenty different first letters', () => {
    const firsts = new Set(ANSWERS.map((w) => w[0]));
    expect(firsts.size).toBeGreaterThanOrEqual(20);
  });
  it('has twenty-six letters on the keyboard rows and in the alphabet', () => {
    expect(LETTERS).toHaveLength(26);
    expect(KEY_ROWS.join('').split('').sort().join('')).toBe(LETTERS.join(''));
    expect(KEY_ROWS.map((r) => r.length)).toEqual([10, 9, 7]);
  });
});

describe('scoring (two passes, repeated letters)', () => {
  const cases: [string, string, Mark[]][] = [
    // answer, guess, expected
    ['abbey', 'babes', [P, P, C, C, A]], // two b: one correct, one present; the lone a is present
    ['speed', 'erase', [P, A, A, P, P]], // two e in the answer, two e in the guess, both present
    ['llama', 'lilac', [C, A, P, P, A]], // l correct, second l present, one a present, c absent
    ['crane', 'crane', [C, C, C, C, C]],
    ['crane', 'dolly', [A, A, A, A, A]],
    ['robot', 'floor', [A, A, P, C, P]], // two o in the answer: one correct, one present
    ['eerie', 'geese', [A, C, P, A, C]], // three e in the answer, three in the guess
    ['abide', 'speed', [A, A, P, A, P]], // one e in the answer: only the first e is marked
    ['level', 'eerie', [P, C, A, A, A]], // the exact match uses one e, the leftover e goes to the first one
    ['those', 'geese', [A, A, A, C, C]], // exact matches claim the e before an earlier e can
    ['allot', 'llama', [P, C, P, A, A]], // one a in the answer: the second a in the guess is absent
    ['mummy', 'mommy', [C, A, C, C, C]],
    ['trace', 'crane', [P, C, C, A, C]],
    ['array', 'rarer', [P, P, C, A, A]], // two r in the answer: one correct, one present, the third r absent
  ];
  for (const [answer, guess, expected] of cases) {
    it(`${answer} vs ${guess}`, () => {
      expect(scoreGuess(answer, guess)).toEqual(expected);
    });
  }

  it('marks an extra copy of a letter absent, never present', () => {
    // one i and one e in "abide": a guess of five of the same letter marks exactly one of them.
    expect(scoreGuess('abide', 'iiiii')).toEqual([A, A, C, A, A]);
    expect(scoreGuess('abide', 'eeeee')).toEqual([A, A, A, A, C]);
    expect(scoreGuess('abide', 'eeiii')).toEqual([P, A, C, A, A]);
  });
  it('matches the answer exactly when every mark is correct', () => {
    expect(isWin(scoreGuess('crane', 'crane'))).toBe(true);
    expect(isWin(scoreGuess('crane', 'crate'))).toBe(false);
    expect(isWin([C, C, C, C])).toBe(false);
  });
  it('is not symmetric, and does not mutate or depend on anything but its two inputs', () => {
    expect(scoreGuess('abbey', 'babes')).toEqual(scoreGuess('abbey', 'babes'));
    expect(scoreGuess('crane', 'trace')).not.toEqual(scoreGuess('trace', 'crane'));
  });
  it('scores bad input as all absent instead of throwing', () => {
    for (const [a, g] of [['crane', 'cran'], ['crane', 'cranes'], ['', ''], ['crane', ''], ['', 'crane']] as [string, string][]) {
      expect(scoreGuess(a, g)).toEqual([A, A, A, A, A]);
    }
    expect(scoreGuess(undefined as unknown as string, 'crane')).toEqual([A, A, A, A, A]);
    expect(scoreGuess('crane', 5 as unknown as string)).toEqual([A, A, A, A, A]);
  });

  it('property: over many random pairs, correct+present per letter never exceeds the answer count and equals min(guess count, answer count)', () => {
    const rng = mulberry32(2026);
    const pick = (list: readonly string[]) => list[Math.floor(rng() * list.length)];
    for (let n = 0; n < 20000; n++) {
      const answer = pick(ANSWERS);
      const guess = pick(n % 2 ? ANSWERS : ENABLE5);
      const marks = scoreGuess(answer, guess);
      expect(marks).toHaveLength(5);
      for (const l of new Set(guess)) {
        let marked = 0;
        for (let i = 0; i < 5; i++) if (guess[i] === l && marks[i] !== A) marked++;
        expect(marked, `${answer} ${guess} ${l}`).toBeLessThanOrEqual(count(answer, l));
        expect(marked, `${answer} ${guess} ${l}`).toBe(Math.min(count(guess, l), count(answer, l)));
      }
      for (let i = 0; i < 5; i++) expect(marks[i] === C, `${answer} ${guess} @${i}`).toBe(guess[i] === answer[i]);
    }
  }, 30_000);
  it('property: a letter that is absent from the answer is never marked, and a repeated guess gives the same marks', () => {
    const rng = mulberry32(7);
    for (let n = 0; n < 3000; n++) {
      const answer = ANSWERS[Math.floor(rng() * ANSWERS.length)];
      const guess = ENABLE5[Math.floor(rng() * ENABLE5.length)];
      const marks = scoreGuess(answer, guess);
      for (let i = 0; i < 5; i++) if (!answer.includes(guess[i])) expect(marks[i]).toBe(A);
      expect(scoreGuess(answer, guess)).toEqual(marks);
    }
  });
});

describe('evaluateGuess', () => {
  it('rejects a short guess and a non-word without using up a row', () => {
    expect(evaluateGuess('crane', [], 'cra', false)).toEqual({ ok: false, message: 'Not enough letters' });
    expect(evaluateGuess('crane', [], '', false)).toEqual({ ok: false, message: 'Not enough letters' });
    expect(evaluateGuess('crane', [], 'zzzzz', false)).toEqual({ ok: false, message: 'Not in the word list' });
    expect(evaluateGuess('crane', [], 'abcde', true)).toEqual({ ok: false, message: 'Not in the word list' });
  });
  it('scores a valid guess and leaves the history alone', () => {
    const history: Row[] = [];
    const r = evaluateGuess('crane', history, 'crate', false);
    expect(r).toEqual({ ok: true, marks: [C, C, C, A, C] });
    expect(history).toEqual([]);
  });
  it('applies hard mode only when it is on', () => {
    const history = [row('trace', 'crane')];
    expect(evaluateGuess('trace', history, 'drone', false).ok).toBe(true);
    expect(evaluateGuess('trace', history, 'drone', true)).toEqual({ ok: false, message: 'Position 3 must be A' });
  });
  it('checks the word list before hard mode', () => {
    expect(evaluateGuess('trace', [row('trace', 'crane')], 'zzzzz', true)).toEqual({ ok: false, message: 'Not in the word list' });
  });
});

describe('hard mode', () => {
  const afterCrane = [row('trace', 'crane')]; // c present, r a e correct (positions 2, 3, 5), n absent

  it('allows anything on the first guess', () => {
    for (const w of ['crane', 'zebra', 'about']) expect(checkHardMode(w, [])).toBeNull();
  });
  it('accepts guesses that keep the correct letters and use the revealed ones', () => {
    for (const w of ['trace', 'brace', 'grace', 'crate', 'crane']) expect(checkHardMode(w, afterCrane), w).toBeNull();
  });
  it('rejects a moved correct letter, naming the position', () => {
    expect(checkHardMode('steed', afterCrane)).toBe('Position 2 must be R');
    expect(checkHardMode('drone', afterCrane)).toBe('Position 3 must be A');
    expect(checkHardMode('trick', afterCrane)).toBe('Position 3 must be A');
    expect(checkHardMode('tract', afterCrane)).toBe('Position 5 must be E');
  });
  it('reports the lowest position first when several are wrong', () => {
    expect(checkHardMode('abbey', afterCrane)).toBe('Position 2 must be R');
  });
  it('rejects a guess that drops a revealed letter, naming the letter', () => {
    expect(checkHardMode('frame', afterCrane)).toBe('Guess must contain C');
    expect(checkHardMode('grape', afterCrane)).toBe('Guess must contain C');
  });
  it('lets a revealed present letter go anywhere, including where it was', () => {
    // "crane" keeps c exactly where it was shown as present; "trace" moves it.
    expect(checkHardMode('crane', afterCrane)).toBeNull();
    expect(checkHardMode('trace', afterCrane)).toBeNull();
    const h = [row('lemon', 'melon')]; // m, e, l present; o and n correct at positions 4 and 5
    expect(checkHardMode('lemon', h)).toBeNull();
    expect(checkHardMode('melon', h)).toBeNull();
    expect(checkHardMode('demon', h)).toBe('Guess must contain L');
  });
  it('requires a repeated letter as many times as it was revealed in one guess', () => {
    const h = [row('speed', 'erase')]; // two e present, s present
    expect(checkHardMode('sweet', h)).toBeNull();
    expect(checkHardMode('seeds', h)).toBeNull();
    expect(checkHardMode('stone', h)).toBe('Guess must contain E 2 times');
    expect(checkHardMode('tests', h)).toBe('Guess must contain E 2 times');
    expect(checkHardMode('aloft', h)).toBe('Guess must contain E 2 times');
  });
  it('counts a repeated letter once per guess, not once per guess added together', () => {
    const h = [row('trace', 'crane'), row('trace', 'grace')]; // e revealed once in each
    expect(checkHardMode('trace', h)).toBeNull();
    const only = [row('lemon', 'melon'), row('lemon', 'level')];
    expect(checkHardMode('lemon', only)).toBeNull();
  });
  it('combines constraints from several earlier guesses', () => {
    const h = [row('trace', 'crane'), row('trace', 'brace')];
    expect(checkHardMode('trace', h)).toBeNull();
    expect(checkHardMode('grace', h)).toBeNull();
    expect(checkHardMode('crane', h)).toBe('Position 4 must be C');
    expect(checkHardMode('trade', h)).toBe('Position 4 must be C');
  });
  it('reports the lowest letter first when several are missing', () => {
    const h = [row('abbey', 'babes')]; // a b b e revealed; position 3 b, position 4 e
    expect(checkHardMode('xxbex', h)).toBe('Guess must contain A');
    expect(checkHardMode('tubes', h)).toBe('Guess must contain A');
  });
  it('tolerates odd input without throwing', () => {
    expect(checkHardMode(undefined as unknown as string, afterCrane)).toBeNull();
    expect(() => checkHardMode('crane', [{} as Row, null as unknown as Row, { guess: 5, marks: 1 } as unknown as Row])).not.toThrow();
  });
  it('property: the true answer is always allowed after any run of allowed guesses', () => {
    const rng = mulberry32(99);
    for (let g = 0; g < 400; g++) {
      const answer = ANSWERS[Math.floor(rng() * ANSWERS.length)];
      const history: Row[] = [];
      for (let step = 0; step < 5; step++) {
        expect(checkHardMode(answer, history), `${answer} after ${history.map((r) => r.guess).join(',')}`).toBeNull();
        // Find a random allowed guess by sampling the whole accepted list.
        let next: string | null = null;
        for (let tries = 0; tries < 400 && next === null; tries++) {
          const cand = ENABLE5[Math.floor(rng() * ENABLE5.length)];
          if (checkHardMode(cand, history) === null) next = cand;
        }
        if (next === null) break;
        history.push(row(answer, next));
      }
    }
  });
});

describe('key states', () => {
  it('starts empty and lists only letters that were used', () => {
    expect(keyStates([])).toEqual({});
    expect(Object.keys(keyStates([row('crane', 'dolly')])).sort()).toEqual(['d', 'l', 'o', 'y']);
  });
  it('takes the best state: correct beats present beats absent', () => {
    const k = keyStates([row('allot', 'llama')]); // l: present then correct; a: present then absent
    expect(k.l).toBe(C);
    expect(k.a).toBe(P);
    expect(k.m).toBe(A);
  });
  it('never downgrades, whatever the order of the rows', () => {
    const rows = [row('crane', 'crane'), row('crane', 'dolly'), row('crane', 'nacho')];
    expect(keyStates(rows).c).toBe(C);
    expect(keyStates([...rows].reverse()).c).toBe(C);
    expect(keyStates([row('abide', 'speed')]).e).toBe(P);
    expect(keyStates([row('abide', 'speed')]).p).toBe(A);
  });
  it('upgrades absent to present to correct as rows arrive', () => {
    const answer = 'trace';
    expect(keyStates([row(answer, 'dolly')]).d).toBe(A);
    expect(keyStates([row(answer, 'cough')]).c).toBe(P);
    expect(keyStates([row(answer, 'cough'), row(answer, 'brace')]).c).toBe(C);
  });
  it('uses the best state within a single guess too', () => {
    const k = keyStates([row('abbey', 'babes')]); // b: present at 1, correct at 3
    expect(k.b).toBe(C);
    expect(k.a).toBe(P);
    expect(k.s).toBe(A);
  });
  it('ignores malformed rows', () => {
    expect(keyStates([{ guess: 'crane', marks: ['bogus' as Mark, C, C, C, C] }]).c).toBeUndefined();
    expect(keyStates([null as unknown as Row, {} as Row])).toEqual({});
  });
});

describe('summary text', () => {
  it('describes a row in plain words', () => {
    expect(markSummary([A, A, A, A, A])).toBe('none of the letters are in the word');
    expect(markSummary([C, C, A, A, A])).toBe('2 in the right place');
    expect(markSummary([P, A, A, A, A])).toBe('1 in the word but in the wrong place');
    expect(markSummary([C, P, P, A, A])).toBe('1 in the right place, 2 in the word but in the wrong place');
  });
});

describe('dates', () => {
  it('formats a local date at month, year and leap-day boundaries', () => {
    expect(localIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(localIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(localIsoDate(new Date(2026, 1, 28))).toBe('2026-02-28');
    expect(localIsoDate(new Date(2026, 2, 1))).toBe('2026-03-01');
    expect(localIsoDate(new Date(2028, 1, 29))).toBe('2028-02-29');
    expect(localIsoDate(new Date(2028, 2, 1))).toBe('2028-03-01');
    expect(localIsoDate(new Date(2026, 9, 31))).toBe('2026-10-31');
    expect(localIsoDate(new Date(2026, 10, 1))).toBe('2026-11-01');
  });
  it('uses the local clock: the last second of a day and the first second of the next', () => {
    expect(localIsoDate(new Date(2026, 9, 25, 23, 59, 59, 999))).toBe('2026-10-25');
    expect(localIsoDate(new Date(2026, 9, 26, 0, 0, 0, 0))).toBe('2026-10-26');
    expect(localIsoDate(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
    expect(localIsoDate(new Date(2027, 0, 1, 0, 0, 0))).toBe('2027-01-01');
  });
  it('pads and survives an invalid date', () => {
    const d = new Date(2026, 4, 3);
    expect(localIsoDate(d)).toBe('2026-05-03');
    expect(localIsoDate(new Date(NaN))).toBe('1970-01-01');
  });
  it('turns a real date into a day count and rejects everything else', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('1969-12-31')).toBe(-1);
    expect(dayNumber('2026-03-01')! - dayNumber('2026-02-28')!).toBe(1);
    expect(dayNumber('2028-03-01')! - dayNumber('2028-02-28')!).toBe(2);
    expect(dayNumber('2027-01-01')! - dayNumber('2026-12-31')!).toBe(1);
    expect(dayNumber('2000-02-29')).not.toBeNull();
    for (const bad of ['2026-02-29', '2100-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-1', 'abc', '', '2026-10-25T00:00', 20261025, null, undefined]) {
      expect(dayNumber(bad), String(bad)).toBeNull();
    }
  });
  it('converts between a date string and a plain number', () => {
    expect(isoToNumber('2026-10-25')).toBe(20261025);
    expect(isoToNumber('2028-02-29')).toBe(20280229);
    expect(isoToNumber('2026-02-30')).toBe(0);
    expect(isoToNumber('nope')).toBe(0);
    expect(numberToIso(20261025)).toBe('2026-10-25');
    expect(numberToIso(20260230)).toBeNull();
    for (const bad of [0, -1, 1.5, NaN, Infinity, '20261025', null, 99999999, 20261301]) expect(numberToIso(bad), String(bad)).toBeNull();
  });
});

describe('daily word', () => {
  const addDays = (iso: string, n: number): string => {
    const [y, m, d] = iso.split('-').map(Number);
    return localIsoDate(new Date(y, m - 1, d + n));
  };

  it('is the same word every time for a date, and always an answer', () => {
    for (const d of ['2026-10-25', '2026-10-26', '2028-02-29', '1999-12-31', '2100-01-01']) {
      expect(dailyAnswer(d)).toBe(dailyAnswer(d));
      expect(ANSWERS).toContain(dailyAnswer(d));
    }
  });
  it('does not depend on the random generator or on any earlier call', () => {
    const first = dailyAnswer('2026-11-11');
    Math.random();
    dailyAnswer('2030-05-05');
    expect(dailyAnswer('2026-11-11')).toBe(first);
  });
  it('differs between consecutive dates, including across month, year and leap-day boundaries', () => {
    for (const start of ['2026-10-30', '2026-12-30', '2028-02-27', '2026-02-27', '2026-03-31']) {
      let d = start;
      for (let i = 0; i < 5; i++) {
        const next = addDays(d, 1);
        expect(dailyAnswer(d), `${d} vs ${next}`).not.toBe(dailyAnswer(next));
        d = next;
      }
    }
  });
  it('never repeats within any window of 365 consecutive days', () => {
    for (const start of ['2026-01-01', '2026-10-25', '2027-06-15', '2028-02-29', '2030-12-31']) {
      const seen = new Set<string>();
      let d = start;
      for (let i = 0; i < 365; i++) {
        seen.add(dailyAnswer(d));
        d = addDays(d, 1);
      }
      expect(seen.size, start).toBe(365);
    }
  });
  it('uses every answer exactly once before any word returns', () => {
    const n = ANSWERS.length;
    const days: string[] = [];
    let d = '2026-10-25';
    for (let i = 0; i < n + 3; i++) {
      days.push(d);
      d = addDays(d, 1);
    }
    const cycle = days.slice(0, n).map(dailyAnswer);
    expect(new Set(cycle).size).toBe(n);
    expect([...cycle].sort()).toEqual([...ANSWERS].sort());
    // The word that follows the last of the cycle is the first one again.
    expect(dailyAnswer(days[n])).toBe(cycle[0]);
    expect(dailyAnswer(days[n + 1])).toBe(cycle[1]);
  });
  it('is a fixed shuffle, not the list in order', () => {
    const order = dailyOrder();
    expect(order).toHaveLength(ANSWERS.length);
    expect(new Set(order).size).toBe(ANSWERS.length);
    expect(order.every((i) => Number.isInteger(i) && i >= 0 && i < ANSWERS.length)).toBe(true);
    let inOrder = 0;
    for (let i = 1; i < order.length; i++) if (order[i] === order[i - 1] + 1) inOrder++;
    expect(inOrder).toBeLessThan(20);
    expect(dailyOrder()).toBe(dailyOrder());
  });
  it('treats dates before 1970 and invalid dates without throwing', () => {
    expect(ANSWERS).toContain(dailyAnswer('1960-06-01'));
    expect(ANSWERS).toContain(dailyAnswer('not a date'));
    expect(ANSWERS).toContain(dailyAnswer('' as string));
    expect(dailyAnswer('1969-12-31')).not.toBe(dailyAnswer('1970-01-01'));
  });
});

describe('random word', () => {
  it('is deterministic for a seeded rng and comes from the answer list', () => {
    const run = (seed: number) => { const r = mulberry32(seed); return Array.from({ length: 12 }, () => randomAnswer(r)); };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
    for (const w of run(5)) expect(ANSWERS).toContain(w);
  });
  it('can reach every answer', () => {
    const r = mulberry32(1);
    const seen = new Set<string>();
    for (let i = 0; i < ANSWERS.length * 40; i++) seen.add(randomAnswer(r));
    expect(seen.size).toBe(ANSWERS.length);
  });
  it('avoids recent words while others exist and falls back when it must', () => {
    const recent = ANSWERS.slice(0, 50);
    const r = mulberry32(9);
    for (let i = 0; i < 300; i++) expect(recent).not.toContain(randomAnswer(r, recent));
    expect(ANSWERS).toContain(randomAnswer(mulberry32(1), ANSWERS));
  });
  it('survives a broken rng', () => {
    for (const bad of [() => NaN, () => 1, () => -3, () => Infinity]) expect(ANSWERS).toContain(randomAnswer(bad));
  });
  it('keeps the recent list newest-last, unique and capped', () => {
    expect(pushRecent(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(pushRecent(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
    const long = Array.from({ length: 50 }, (_, i) => `w${i}`);
    const out = pushRecent(long, 'new', 40);
    expect(out).toHaveLength(40);
    expect(out[39]).toBe('new');
    const original = ['a'];
    pushRecent(original, 'b');
    expect(original).toEqual(['a']);
  });
  it('has a seeded generator and string hash that behave', () => {
    const r = mulberry32(1);
    const xs = Array.from({ length: 1000 }, () => r());
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const h = hashString('word-guess');
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(shuffled(src, mulberry32(3)).slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(isLetter('a') && isLetter('z') && !isLetter('A') && !isLetter('ab') && !isLetter(1)).toBe(true);
  });
});

describe('word encoding for storage', () => {
  it('round-trips every accepted word', () => {
    for (const w of ENABLE5) expect(decodeWord(encodeWord(w)), w).toBe(w);
  });
  it('encodes to plain non-negative integers and rejects the rest', () => {
    expect(encodeWord('aaaaa')).toBe(0);
    expect(encodeWord('about')).toBeGreaterThan(0);
    for (const bad of ['', 'abcd', 'abcdef', 'ABOUT', 'ab0ut', 'a b c']) expect(encodeWord(bad), bad).toBe(-1);
    expect(encodeWord(5 as unknown as string)).toBe(-1);
  });
  it('decodes only numbers that are real accepted words', () => {
    expect(decodeWord(encodeWord('zzzzz'))).toBeNull(); // five letters but not a word
    for (const bad of [-1, 1.5, NaN, Infinity, 26 ** 5, 1e30, '5', null, undefined, [], {}]) expect(decodeWord(bad), String(bad)).toBeNull();
  });
});

describe('statistics and streaks', () => {
  const win = (n: number) => ({ won: true, guesses: n });
  const loss = { won: false, guesses: 6 };

  it('starts at zero with six distribution buckets', () => {
    const s = emptyStats();
    expect(s).toEqual({ played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], lastDaily: 0, today: { date: 0, hard: 0, guesses: [] } });
    expect(MAX_GUESSES).toBe(6);
    expect(WORD_LENGTH).toBe(5);
  });
  it('first game ever, a daily win: one played, one win, streak one', () => {
    const s = updateStats(emptyStats(), win(3), true, '2026-10-25');
    expect(s).toMatchObject({ played: 1, wins: 1, streak: 1, best: 1, lastDaily: 20261025 });
    expect(s.dist).toEqual([0, 0, 1, 0, 0, 0]);
  });
  it('first game ever, a daily loss: played one, streak zero, no distribution entry', () => {
    const s = updateStats(emptyStats(), loss, true, '2026-10-25');
    expect(s).toMatchObject({ played: 1, wins: 0, streak: 0, best: 0, lastDaily: 20261025 });
    expect(s.dist).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('wins on consecutive dates extend the streak, including over month, year and leap-day boundaries', () => {
    const runs: string[][] = [
      ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'],
      ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'],
      ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'],
      ['2026-02-27', '2026-02-28', '2026-03-01'],
    ];
    for (const dates of runs) {
      let s = emptyStats();
      dates.forEach((d, i) => {
        s = updateStats(s, win(4), true, d);
        expect(s.streak, d).toBe(i + 1);
      });
      expect(s.best).toBe(dates.length);
      expect(s.dist[3]).toBe(dates.length);
    }
  });
  it('a missed day restarts a winning streak at one and keeps the best', () => {
    let s = emptyStats();
    for (const d of ['2026-10-20', '2026-10-21', '2026-10-22']) s = updateStats(s, win(3), true, d);
    expect(s.streak).toBe(3);
    s = updateStats(s, win(3), true, '2026-10-24'); // 23rd missed
    expect(s.streak).toBe(1);
    expect(s.best).toBe(3);
    s = updateStats(s, win(3), true, '2026-10-25');
    expect(s.streak).toBe(2);
    expect(s.best).toBe(3);
  });
  it('a missed day followed by a loss leaves the streak at zero', () => {
    let s = emptyStats();
    for (const d of ['2026-10-20', '2026-10-21']) s = updateStats(s, win(3), true, d);
    s = updateStats(s, loss, true, '2026-10-24');
    expect(s.streak).toBe(0);
    expect(s.best).toBe(2);
  });
  it('a daily loss resets the streak, and a win the next day starts again at one', () => {
    let s = emptyStats();
    for (const d of ['2026-10-20', '2026-10-21']) s = updateStats(s, win(2), true, d);
    s = updateStats(s, loss, true, '2026-10-22');
    expect(s).toMatchObject({ streak: 0, best: 2, played: 3, wins: 2 });
    s = updateStats(s, win(5), true, '2026-10-23');
    expect(s).toMatchObject({ streak: 1, best: 2, played: 4, wins: 3 });
  });
  it('random games count toward played, wins and the distribution but never touch the daily streak', () => {
    let s = updateStats(emptyStats(), win(3), true, '2026-10-24');
    s = updateStats(s, win(4), true, '2026-10-25');
    const before = { streak: s.streak, best: s.best, lastDaily: s.lastDaily };
    s = updateStats(s, win(1), false, '2026-10-25');
    s = updateStats(s, loss, false, '2026-10-26');
    s = updateStats(s, win(6), false, 'random');
    expect(s.played).toBe(5);
    expect(s.wins).toBe(4);
    expect(s.dist).toEqual([1, 0, 1, 1, 0, 1]);
    expect({ streak: s.streak, best: s.best, lastDaily: s.lastDaily }).toEqual(before);
    // a random game in between does not break the chain either
    s = updateStats(s, win(2), true, '2026-10-26');
    expect(s.streak).toBe(3);
  });
  it('a random game as the very first game does not start a streak', () => {
    const s = updateStats(emptyStats(), win(2), false, '2026-10-25');
    expect(s).toMatchObject({ played: 1, wins: 1, streak: 0, best: 0, lastDaily: 0 });
    const d = updateStats(s, win(2), true, '2026-10-25');
    expect(d.streak).toBe(1);
  });
  it('counts a daily date only once', () => {
    const s = updateStats(emptyStats(), win(3), true, '2026-10-25');
    const again = updateStats(s, win(1), true, '2026-10-25');
    expect(again).toEqual(s);
    const loseAfter = updateStats(s, loss, true, '2026-10-25');
    expect(loseAfter).toEqual(s);
  });
  it('a daily dated before the last one adds to the totals and leaves the streak and last date alone', () => {
    let s = updateStats(emptyStats(), win(3), true, '2026-10-25');
    s = updateStats(s, win(2), true, '2026-10-26');
    const t = updateStats(s, win(4), true, '2026-10-24');
    expect(t).toMatchObject({ played: 3, wins: 3, streak: 2, best: 2, lastDaily: 20261026 });
    expect(t.dist).toEqual([0, 1, 1, 1, 0, 0]);
  });
  it('an invalid daily date still counts the game but changes no streak', () => {
    const s = updateStats(emptyStats(), win(3), true, 'garbage');
    expect(s).toMatchObject({ played: 1, wins: 1, streak: 0, lastDaily: 0 });
  });
  it('does not modify the stats it was given', () => {
    const s = emptyStats();
    Object.freeze(s);
    Object.freeze(s.dist);
    Object.freeze(s.today);
    Object.freeze(s.today.guesses);
    const next = updateStats(s, win(3), true, '2026-10-25');
    expect(next).not.toBe(s);
    expect(s.played).toBe(0);
    expect(s.dist).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('clamps a guess count outside 1 to 6 when filing a win', () => {
    expect(updateStats(emptyStats(), { won: true, guesses: 9 }, false, '').dist[5]).toBe(1);
    expect(updateStats(emptyStats(), { won: true, guesses: 0 }, false, '').dist[0]).toBe(1);
    expect(updateStats(emptyStats(), { won: true, guesses: NaN }, false, '').dist[5]).toBe(1);
  });
  it('stops counting at the cap', () => {
    const s: Stats = { ...emptyStats(), played: MAX_COUNT, wins: MAX_COUNT, streak: MAX_COUNT, best: MAX_COUNT, dist: [MAX_COUNT, 0, 0, 0, 0, 0], lastDaily: 20261024 };
    const t = updateStats(s, win(1), true, '2026-10-25');
    expect(t.played).toBe(MAX_COUNT);
    expect(t.wins).toBe(MAX_COUNT);
    expect(t.streak).toBe(MAX_COUNT);
    expect(t.dist[0]).toBe(MAX_COUNT);
  });
  it('property: against a plain reference, long random histories keep every total and streak consistent', () => {
    const rng = mulberry32(31);
    for (let trial = 0; trial < 60; trial++) {
      let s = emptyStats();
      let day = dayNumber('2026-01-01')!;
      let refStreak = 0;
      let refBest = 0;
      let refLast = -999;
      let played = 0;
      let wins = 0;
      const dist = [0, 0, 0, 0, 0, 0];
      for (let step = 0; step < 150; step++) {
        const daily = rng() < 0.5;
        const won = rng() < 0.7;
        const n = 1 + Math.floor(rng() * 6);
        if (daily) day += 1 + (rng() < 0.3 ? Math.floor(rng() * 3) : 0);
        const isoUtc = new Date(Date.UTC(1970, 0, 1 + day)).toISOString().slice(0, 10);
        s = updateStats(s, { won, guesses: won ? n : 6 }, daily, isoUtc);
        played++;
        if (won) { wins++; dist[n - 1]++; }
        if (daily) {
          refStreak = won ? (refLast === day - 1 ? refStreak + 1 : 1) : 0;
          refBest = Math.max(refBest, refStreak);
          refLast = day;
        }
        expect(s.played).toBe(played);
        expect(s.wins).toBe(wins);
        expect(s.dist).toEqual(dist);
        expect(s.streak).toBe(refStreak);
        expect(s.best).toBe(refBest);
        expect(s.dist.reduce((a, b) => a + b, 0)).toBe(s.wins);
        expect(s.wins).toBeLessThanOrEqual(s.played);
        expect(s.best).toBeGreaterThanOrEqual(s.streak);
        expect(s.streak).toBeLessThanOrEqual(s.wins);
      }
    }
  });

  it('shows the streak only while no whole day has been missed', () => {
    const s = updateStats(updateStats(emptyStats(), win(3), true, '2026-10-24'), win(3), true, '2026-10-25');
    expect(currentStreak(s, '2026-10-25')).toBe(2);
    expect(currentStreak(s, '2026-10-26')).toBe(2);
    expect(currentStreak(s, '2026-10-27')).toBe(0);
    expect(currentStreak(s, '2027-10-27')).toBe(0);
    expect(currentStreak(emptyStats(), '2026-10-25')).toBe(0);
    expect(currentStreak(s, '2026-10-24')).toBe(2); // clock set back: no reset
    expect(currentStreak(s, 'garbage')).toBe(2);
  });
  it('rounds the win percentage and handles no games', () => {
    expect(winPercent(emptyStats())).toBe(0);
    expect(winPercent({ ...emptyStats(), played: 4, wins: 3 })).toBe(75);
    expect(winPercent({ ...emptyStats(), played: 3, wins: 1 })).toBe(33);
    expect(winPercent({ ...emptyStats(), played: 3, wins: 2 })).toBe(67);
    expect(winPercent({ ...emptyStats(), played: 5, wins: 5 })).toBe(100);
  });
});

describe('saved daily game', () => {
  it('records the guesses as plain numbers and reads them back', () => {
    const s = recordDailyProgress(emptyStats(), '2026-10-25', true, ['crane', 'about']);
    expect(s.today.date).toBe(20261025);
    expect(s.today.hard).toBe(1);
    expect(s.today.guesses.every((n) => typeof n === 'number' && Number.isInteger(n))).toBe(true);
    const back = sanitiseStats(JSON.parse(JSON.stringify(s)));
    expect(back.today.guesses.map((n) => decodeWord(n))).toEqual(['crane', 'about']);
    expect(back.today.hard).toBe(1);
  });
  it('keeps at most six guesses and ignores an invalid date', () => {
    const seven = ['crane', 'about', 'house', 'plant', 'stone', 'light', 'water'];
    expect(recordDailyProgress(emptyStats(), '2026-10-25', false, seven).today.guesses).toHaveLength(6);
    expect(recordDailyProgress(emptyStats(), 'nope', false, ['crane'])).toEqual(emptyStats());
  });
  it('does not change the other statistics or the input', () => {
    const s = updateStats(emptyStats(), { won: true, guesses: 2 }, true, '2026-10-24');
    const t = recordDailyProgress(s, '2026-10-25', false, ['crane']);
    expect({ ...t, today: undefined }).toEqual({ ...s, today: undefined });
    expect(s.today.date).toBe(0);
  });
});

describe('sanitising stored statistics', () => {
  const zero = emptyStats();

  it('turns anything that is not an object into zeros', () => {
    for (const raw of [null, undefined, 0, 5, 'x', '{"played":3}', true, [], [1, 2, 3], () => 1, NaN]) {
      expect(sanitiseStats(raw), String(raw)).toEqual(zero);
    }
  });
  it('rejects strings, NaN, Infinity, negatives, fractions and booleans in every count', () => {
    for (const bad of ['5', 'abc', '', NaN, Infinity, -Infinity, -1, -0.5, 2.5, true, false, null, undefined, [], {}, [3]]) {
      const s = sanitiseStats({ played: bad, wins: bad, streak: bad, best: bad });
      expect(s.played, String(bad)).toBe(0);
      expect(s.wins).toBe(0);
      expect(s.streak).toBe(0);
      expect(s.best).toBe(0);
    }
  });
  it('clamps huge numbers to the cap', () => {
    const s = sanitiseStats({ played: 1e308, wins: 1e30, streak: 5e12, best: Number.MAX_SAFE_INTEGER, dist: [1e20, 2e9, 3, 4, 5, 6] });
    expect(s.played).toBe(MAX_COUNT);
    expect(s.wins).toBe(MAX_COUNT);
    expect(s.streak).toBe(MAX_COUNT);
    expect(s.best).toBe(MAX_COUNT);
    expect(s.dist).toEqual([MAX_COUNT, MAX_COUNT, 3, 4, 5, 6]);
  });
  it('keeps the numbers consistent: wins never above played, streak never above wins, best at least the streak', () => {
    expect(sanitiseStats({ played: 3, wins: 10 }).wins).toBe(3);
    expect(sanitiseStats({ played: 5, wins: 2, streak: 4 }).streak).toBe(2);
    expect(sanitiseStats({ played: 5, wins: 5, streak: 4, best: 1 }).best).toBe(4);
  });
  it('rebuilds the distribution as exactly six clean counts', () => {
    expect(sanitiseStats({ dist: 'abc' }).dist).toEqual([0, 0, 0, 0, 0, 0]);
    expect(sanitiseStats({ dist: null }).dist).toEqual([0, 0, 0, 0, 0, 0]);
    expect(sanitiseStats({ dist: { 0: 5 } }).dist).toEqual([0, 0, 0, 0, 0, 0]);
    expect(sanitiseStats({ dist: [1, 2] }).dist).toEqual([1, 2, 0, 0, 0, 0]);
    expect(sanitiseStats({ dist: [1, 'x', NaN, -3, Infinity, 2.5, 99, 99] }).dist).toEqual([1, 0, 0, 0, 0, 0]);
    expect(sanitiseStats({ dist: [[1], {}, null, undefined, '4', 7] }).dist).toEqual([0, 0, 0, 0, 0, 7]);
  });
  it('accepts only a real YYYYMMDD number for the last daily date', () => {
    expect(sanitiseStats({ lastDaily: 20261025 }).lastDaily).toBe(20261025);
    for (const bad of ['20261025', 20261301, 20260230, 0, -5, 1.5, NaN, Infinity, null, [], 99999999999]) expect(sanitiseStats({ lastDaily: bad }).lastDaily, String(bad)).toBe(0);
  });
  it('keeps a saved daily game only when its date is real and truncates at the first bad guess', () => {
    const ok = encodeWord('crane');
    const s = sanitiseStats({ today: { date: 20261025, hard: 1, guesses: [ok, encodeWord('about'), 'x', ok] } });
    expect(s.today.date).toBe(20261025);
    expect(s.today.hard).toBe(1);
    expect(s.today.guesses).toHaveLength(2);
    expect(sanitiseStats({ today: { date: '20261025', hard: 1, guesses: [ok] } }).today).toEqual({ date: 0, hard: 0, guesses: [] });
    expect(sanitiseStats({ today: { date: 20261025, hard: 'yes', guesses: 'crane' } }).today).toEqual({ date: 20261025, hard: 0, guesses: [] });
    expect(sanitiseStats({ today: { date: 20261025, guesses: [-1, ok] } }).today.guesses).toEqual([]);
    expect(sanitiseStats({ today: { date: 20261025, guesses: [encodeWord('zzzzz')] } }).today.guesses).toEqual([]);
    expect(sanitiseStats({ today: { date: 20261025, guesses: Array(20).fill(ok) } }).today.guesses).toHaveLength(6);
    for (const bad of [null, 5, 'x', [], [1, 2]]) expect(sanitiseStats({ today: bad }).today).toEqual(zero.today);
  });
  it('leaves clean stats unchanged through a JSON round trip', () => {
    let s = emptyStats();
    for (const d of ['2026-10-21', '2026-10-22', '2026-10-23']) s = updateStats(s, { won: true, guesses: 3 }, true, d);
    s = updateStats(s, { won: false, guesses: 6 }, false, '');
    s = recordDailyProgress(s, '2026-10-24', true, ['crane', 'about']);
    expect(sanitiseStats(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('survives hostile JSON text', () => {
    for (const text of ['{"played":1e999}', '{"played":"NaN"}', '{"dist":[1e999,-1e999]}', '{"__proto__":{"played":9}}', '[]', 'null', '{"played":9007199254740993}']) {
      const s = sanitiseStats(JSON.parse(text));
      expect(JSON.stringify(s)).not.toMatch(BAD);
      expect(Object.values(s).every((v) => typeof v === 'number' || Array.isArray(v) || typeof v === 'object')).toBe(true);
      expect(s.played).toBeLessThanOrEqual(MAX_COUNT);
    }
    expect(sanitiseStats(JSON.parse('{"__proto__":{"played":9}}')).played).toBe(0);
  });
  it('returns only plain numbers, never a string', () => {
    const s = sanitiseStats({ played: 4, wins: 3, streak: 2, best: 3, dist: [0, 1, 2, 0, 0, 0], lastDaily: 20261025, today: { date: 20261025, hard: 0, guesses: [encodeWord('crane')] } });
    const flat = JSON.stringify(s).replace(/[\[\]{}",:]|played|wins|streak|best|dist|lastDaily|today|date|hard|guesses/g, '');
    expect(flat).toMatch(/^[0-9.]*$/);
  });
});

describe('Enter belongs to interactive elements', () => {
  const make = (html: string, selector: string): Element => {
    document.body.innerHTML = html;
    return document.querySelector(selector) as Element;
  };
  it('a button, a summary, a link, a select, an input and a textarea keep their own Enter', () => {
    expect(enterBelongsTo(make('<button id="x">Go</button>', '#x'))).toBe(true);
    expect(enterBelongsTo(make('<details><summary id="x">How it works</summary><p>text</p></details>', '#x'))).toBe(true);
    expect(enterBelongsTo(make('<a id="x" href="/somewhere">link</a>', '#x'))).toBe(true);
    expect(enterBelongsTo(make('<select id="x"><option>a</option></select>', '#x'))).toBe(true);
    expect(enterBelongsTo(make('<input id="x">', '#x'))).toBe(true);
    expect(enterBelongsTo(make('<textarea id="x"></textarea>', '#x'))).toBe(true);
    expect(enterBelongsTo(make('<div id="x" role="button" tabindex="0">fake button</div>', '#x'))).toBe(true);
  });
  it('a child of a button or summary counts as that control', () => {
    expect(enterBelongsTo(make('<button><span id="x">K</span></button>', '#x'))).toBe(true);
    expect(enterBelongsTo(make('<details><summary><b id="x">How</b></summary></details>', '#x'))).toBe(true);
  });
  it('the page itself, plain text and a missing target do not, so Enter still submits there', () => {
    expect(enterBelongsTo(make('<div id="x">board</div>', '#x'))).toBe(false);
    expect(enterBelongsTo(make('<div><p id="x">help text</p></div>', '#x'))).toBe(false);
    expect(enterBelongsTo(document.body)).toBe(false);
    expect(enterBelongsTo(document.documentElement)).toBe(false);
    expect(enterBelongsTo(null)).toBe(false);
    expect(enterBelongsTo({})).toBe(false);
  });
  it('the page uses it for Enter and no longer tests the tag name', () => {
    const text = readFileSync(resolve(process.cwd(), 'src/components/apps-private/word-guess/Calculator.astro'), 'utf8');
    expect(text).toMatch(/if \(enterBelongsTo\(t\)\) return;/);
    expect(text).not.toMatch(/tagName === 'BUTTON'/);
    expect(ENTER_OWNERS).toContain('summary');
  });
});

describe('share text', () => {
  const won = [row('crane', 'about'), row('crane', 'trace'), row('crane', 'crane')];
  it('uses the documented format for a win', () => {
    const t = shareText('2026-10-25', won, true);
    const lines = t.split('\n');
    expect(lines[0]).toBe('Word Guess 2026-10-25 3/6');
    expect(lines).toHaveLength(4);
    for (const l of lines.slice(1)) expect(l).toMatch(/^[#+.]{5}$/);
    expect(lines[3]).toBe('#####');
  });
  it('maps each mark to its own character, in order', () => {
    expect(shareText('random', [row('abbey', 'babes')], true).split('\n')[1]).toBe('++##.');
    expect(MARK_CHAR).toEqual({ correct: '#', present: '+', absent: '.' });
  });
  it('shows X for a loss and labels a random game', () => {
    const lost = ['about', 'house', 'plant', 'stone', 'light', 'water'].map((g) => row('crane', g));
    const t = shareText('random', lost, false);
    expect(t.split('\n')[0]).toBe('Word Guess random X/6');
    expect(t.split('\n')).toHaveLength(7);
  });
  it('the grid lines contain no letters, and the md says so truthfully', () => {
    const md = readFileSync(resolve(process.cwd(), 'src/content/apps/word-guess.md'), 'utf8');
    expect(md).toContain('The grid lines contain no letters');
    expect(md).not.toContain('The result contains no letters');
  });
  it('never contains a letter from a guess or the answer, only the first line has any', () => {
    const t = shareText('random', won, true);
    expect(t.split('\n').slice(1).join('\n')).toMatch(/^[#+.\n]+$/);
    expect(t).not.toMatch(BAD);
    expect(t).not.toContain('crane');
  });
  it('handles an empty game', () => {
    expect(shareText('random', [], false)).toBe('Word Guess random X/6');
  });
});

describe('source hygiene', () => {
  const root = process.cwd();
  const files = [
    'src/components/apps-private/word-guess/helpers.ts',
    'src/components/apps-private/word-guess/answers.ts',
    'src/components/apps-private/word-guess/Calculator.astro',
    'src/content/apps/word-guess.md',
    'tests/games-word-guess.test.ts',
  ];
  const trademark = new RegExp('word' + 'le', 'i');
  for (const f of files) {
    it(`${f} has no em-dash, no trademark name`, () => {
      const text = readFileSync(resolve(root, f), 'utf8');
      expect(text.includes(String.fromCharCode(0x2014))).toBe(false);
      expect(trademark.test(text)).toBe(false);
    });
  }
  it('the component writes no innerHTML', () => {
    const text = readFileSync(resolve(root, 'src/components/apps-private/word-guess/Calculator.astro'), 'utf8');
    expect(text).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });
});
