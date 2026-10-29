/**
 * games-hangman.test.ts - the engine behind `hangman`.
 *
 * Pinned: the hand-written word list obeys its own rules (size, uniqueness,
 * characters, lengths, every category and difficulty has words), a guess is
 * applied exactly once and never mutates the old state, six wrong guesses lose,
 * a hint costs a guess and can never end the game, recent words are avoided, and
 * everything is deterministic for a seeded rng.
 */
import { describe, it, expect } from 'vitest';
import {
  WORD_LIST, CATEGORIES, CATEGORY_LABEL, DIFFICULTIES, DIFFICULTY_RANGE, DIFFICULTY_LABEL, LETTERS, MAX_WRONG, RECENT_LIMIT,
  mulberry32, pickWord, pushRecent, matchesFilters, newGame, applyGuess, applyHint, canHint, maskWord, describeWord,
  status, wrongCount, guessesLeft, misses, hiddenLetters, letterState, isLetter, knownLetters,
  sanitizeStreak, recordResult, streakAfterAbandon, shareSummary, hasStarted, letterKeyApplies,
  type Entry, type Game, type Filters,
} from '../src/components/apps-private/hangman/helpers';

const entry = (word: string, category: Entry['category'] = 'animals'): Entry => ({ word, category });
const play = (word: string, letters: string): Game => [...letters].reduce((g, l) => applyGuess(g, l), newGame(entry(word)));

describe('word list integrity', () => {
  const words = WORD_LIST.map((e) => e.word);

  it('has at least 500 words, and over 800 as the content page says', () => {
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(500);
    expect(WORD_LIST.length).toBeGreaterThan(800);
  });
  it('has more than 100 words in every category, as the content page says', () => {
    for (const c of CATEGORIES) expect(WORD_LIST.filter((e) => e.category === c).length, c).toBeGreaterThan(100);
  });
  it('has no duplicates, even across categories', () => {
    const seen = new Set<string>();
    const dupes = words.filter((w) => (seen.has(w) ? true : (seen.add(w), false)));
    expect(dupes).toEqual([]);
  });
  it('uses only lowercase a-z', () => {
    expect(words.filter((w) => !/^[a-z]+$/.test(w))).toEqual([]);
  });
  it('keeps every word between 4 and 11 letters', () => {
    expect(words.filter((w) => w.length < 4 || w.length > 11)).toEqual([]);
  });
  it('gives every entry one of the six known categories', () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(WORD_LIST.filter((e) => !CATEGORIES.includes(e.category))).toEqual([]);
    for (const c of CATEGORIES) expect(CATEGORY_LABEL[c].length).toBeGreaterThan(3);
  });
  it('has words in every category and every category and difficulty combination', () => {
    for (const c of CATEGORIES) {
      expect(WORD_LIST.filter((e) => e.category === c).length, c).toBeGreaterThanOrEqual(60);
      for (const d of DIFFICULTIES) {
        const n = WORD_LIST.filter((e) => matchesFilters(e, { category: c, difficulty: d })).length;
        expect(n, `${c} ${d}`).toBeGreaterThanOrEqual(30);
      }
    }
    for (const d of DIFFICULTIES) {
      expect(WORD_LIST.filter((e) => matchesFilters(e, { category: 'any', difficulty: d })).length, `any ${d}`).toBeGreaterThanOrEqual(100);
    }
  });
  it('splits cleanly into difficulties: every word belongs to exactly one', () => {
    for (const e of WORD_LIST) {
      const hits = DIFFICULTIES.filter((d) => matchesFilters(e, { category: 'any', difficulty: d }));
      expect(hits, e.word).toHaveLength(1);
    }
  });
  it('never contains a string the page could mistake for a bad value', () => {
    expect(words.filter((w) => /nan|null|undefined|infinity/.test(w))).toEqual([]);
  });
  it('labels each difficulty with the same bounds the code enforces', () => {
    expect(DIFFICULTY_RANGE.easy).toEqual({ min: 4, max: 5 });
    expect(DIFFICULTY_RANGE.medium).toEqual({ min: 6, max: 7 });
    expect(DIFFICULTY_RANGE.hard.min).toBe(8);
    expect(DIFFICULTY_LABEL.easy).toContain('4-5');
    expect(DIFFICULTY_LABEL.medium).toContain('6-7');
    expect(DIFFICULTY_LABEL.hard).toContain('8 or more');
  });
  it('has the same number of letter keys as the alphabet', () => {
    expect(LETTERS).toHaveLength(26);
    expect(LETTERS[0]).toBe('a');
    expect(LETTERS[25]).toBe('z');
  });
});

describe('guess logic', () => {
  it('starts with nothing guessed and six wrong guesses allowed', () => {
    const g = newGame(entry('planet', 'science'));
    expect(MAX_WRONG).toBe(6);
    expect(g.maxWrong).toBe(6);
    expect(g.category).toBe('science');
    expect(status(g)).toBe('playing');
    expect(wrongCount(g)).toBe(0);
    expect(guessesLeft(g)).toBe(6);
    expect(hasStarted(g)).toBe(false);
  });
  it('reveals every occurrence of a correct letter without costing a guess', () => {
    const g = play('apple', 'p');
    expect(maskWord(g)).toEqual(['_', 'p', 'p', '_', '_']);
    expect(wrongCount(g)).toBe(0);
    expect(letterState(g, 'p')).toBe('hit');
  });
  it('counts a wrong letter once', () => {
    const g = play('apple', 'z');
    expect(wrongCount(g)).toBe(1);
    expect(misses(g)).toEqual(['z']);
    expect(letterState(g, 'z')).toBe('miss');
    expect(letterState(g, 'q')).toBe('unused');
  });
  it('ignores a repeated guess and returns the very same object', () => {
    const g1 = applyGuess(newGame(entry('apple')), 'z');
    expect(applyGuess(g1, 'z')).toBe(g1);
    const g2 = applyGuess(g1, 'p');
    expect(applyGuess(g2, 'p')).toBe(g2);
    expect(wrongCount(applyGuess(g1, 'z'))).toBe(1);
  });
  it('accepts upper case and treats it as the same letter', () => {
    const g = applyGuess(newGame(entry('apple')), 'P');
    expect(g.guessed).toEqual(['p']);
    expect(applyGuess(g, 'p')).toBe(g);
  });
  it('ignores anything that is not a single a-z letter', () => {
    const g = newGame(entry('apple'));
    for (const bad of ['', ' ', '1', '-', 'ab', 'é', 'ß', 'Enter', '\n']) expect(applyGuess(g, bad), JSON.stringify(bad)).toBe(g);
    expect(applyGuess(g, undefined as unknown as string)).toBe(g);
    expect(applyGuess(g, null as unknown as string)).toBe(g);
    expect(applyGuess(g, 5 as unknown as string)).toBe(g);
  });
  it('isLetter accepts exactly lowercase a-z', () => {
    expect(isLetter('a')).toBe(true);
    expect(isLetter('z')).toBe(true);
    expect(isLetter('A')).toBe(false);
    expect(isLetter('ab')).toBe(false);
    expect(isLetter(1)).toBe(false);
  });
  it('never mutates the previous state', () => {
    const g = Object.freeze(newGame(entry('apple')));
    const frozenGuessed = Object.freeze(g.guessed.slice());
    const next = applyGuess({ ...g, guessed: frozenGuessed }, 'p');
    expect(g.guessed).toEqual([]);
    expect(next.guessed).toEqual(['p']);
    expect(next).not.toBe(g);
  });
  it('wins when the last hidden letter is guessed, with wrong guesses left over', () => {
    const g = play('apple', 'plea');
    expect(status(g)).toBe('won');
    expect(maskWord(g).join('')).toBe('apple');
    expect(wrongCount(g)).toBe(0);
  });
  it('can win even after five wrong guesses', () => {
    const g = play('apple', 'bcdfg' + 'aple');
    expect(wrongCount(g)).toBe(5);
    expect(status(g)).toBe('won');
  });
  it('loses on exactly the sixth wrong guess, not the fifth', () => {
    const five = play('apple', 'bcdfg');
    expect(wrongCount(five)).toBe(5);
    expect(status(five)).toBe('playing');
    expect(guessesLeft(five)).toBe(1);
    const six = applyGuess(five, 'h');
    expect(wrongCount(six)).toBe(6);
    expect(status(six)).toBe('lost');
    expect(guessesLeft(six)).toBe(0);
  });
  it('ignores every guess once the game is lost or won', () => {
    const lost = play('apple', 'bcdfgh');
    expect(applyGuess(lost, 'a')).toBe(lost);
    expect(applyGuess(lost, 'z')).toBe(lost);
    const won = play('apple', 'aple');
    expect(applyGuess(won, 'z')).toBe(won);
  });
  it('reveals the whole word on request, for the lose screen', () => {
    const g = play('apple', 'bcdfgh');
    expect(maskWord(g)).toEqual(['_', '_', '_', '_', '_']);
    expect(maskWord(g, true).join('')).toBe('apple');
  });
  it('supports a different number of allowed wrong guesses', () => {
    let g = newGame(entry('apple'), 2);
    g = applyGuess(applyGuess(g, 'z'), 'y');
    expect(status(g)).toBe('lost');
  });
});

describe('masking and text equivalent', () => {
  it('matches the documented format', () => {
    const g = play('planet', 'ae');
    expect(maskWord(g)).toEqual(['_', '_', 'a', '_', 'e', '_']);
    expect(describeWord(g)).toBe('6 letters: _ _ a _ e _');
  });
  it('shows blanks only at the start and the full word when revealed', () => {
    const g = newGame(entry('kettle', 'home'));
    expect(describeWord(g)).toBe('6 letters: _ _ _ _ _ _');
    expect(describeWord(g, true)).toBe('6 letters: k e t t l e');
  });
  it('reveals both repeated letters from one guess', () => {
    expect(maskWord(play('kettle', 't')).join('')).toBe('__tt__');
  });
});

describe('hints', () => {
  it('reveals a letter that is in the word and counts as exactly one wrong guess', () => {
    const g0 = newGame(entry('planet', 'science'));
    const g1 = applyHint(g0, mulberry32(1));
    expect(g1).not.toBe(g0);
    expect(g1.hinted).toHaveLength(1);
    const letter = g1.hinted[0];
    expect('planet').toContain(letter);
    expect(wrongCount(g1)).toBe(1);
    expect(guessesLeft(g1)).toBe(5);
    expect(maskWord(g1)).toContain(letter);
    expect(status(g1)).toBe('playing');
    expect(letterState(g1, letter)).toBe('hint');
    expect(g1.guessed).toEqual([]);
    expect(g0.hinted).toEqual([]); // old state untouched
  });
  it('treats a hinted letter as already used', () => {
    const g1 = applyHint(newGame(entry('planet')), mulberry32(2));
    const l = g1.hinted[0];
    expect(applyGuess(g1, l)).toBe(g1);
    expect(hiddenLetters(g1)).not.toContain(l);
    expect(knownLetters(g1).has(l)).toBe(true);
  });
  it('shows every occurrence of the hinted letter', () => {
    // "kettle" has hidden letters e, k, l, t. Whatever is chosen, all its positions show.
    for (let s = 1; s <= 8; s++) {
      const g = applyHint(newGame(entry('kettle')), mulberry32(s));
      const l = g.hinted[0];
      expect(maskWord(g).filter((c) => c === l).length).toBe('kettle'.split(l).length - 1);
    }
  });
  it('is deterministic for a seed and varies across seeds', () => {
    const pick = (seed: number) => applyHint(newGame(entry('chemistry', 'science')), mulberry32(seed)).hinted[0];
    expect(pick(7)).toBe(pick(7));
    const letters = new Set(Array.from({ length: 40 }, (_, i) => pick(i + 1)));
    expect(letters.size).toBeGreaterThan(2);
  });
  it('only picks hidden letters, even after some guesses', () => {
    let g = play('planet', 'ape');
    for (let s = 1; s <= 10; s++) {
      const h = applyHint(g, mulberry32(s));
      expect(['l', 'n', 't']).toContain(h.hinted[0]);
    }
    g = applyHint(g, mulberry32(3));
    expect(g.hinted).toHaveLength(1);
  });
  it('is refused, with the same object returned, when it would be the losing guess', () => {
    const five = play('planet', 'xzqjk'); // five wrong guesses, nothing right
    expect(wrongCount(five)).toBe(5);
    expect(canHint(five)).toBe(false);
    expect(applyHint(five, mulberry32(1))).toBe(five);
    const four = play('planet', 'xzqj');
    expect(canHint(four)).toBe(true);
    expect(wrongCount(applyHint(four, mulberry32(1)))).toBe(5);
  });
  it('counts toward the same six wrong guesses as misses', () => {
    let g = play('planet', 'xz');
    g = applyHint(g, mulberry32(1));
    g = applyHint(g, mulberry32(2));
    expect(wrongCount(g)).toBe(4);
    g = applyGuess(applyGuess(g, 'q'), 'j');
    expect(wrongCount(g)).toBe(6);
    expect(status(g)).toBe('lost');
  });
  it('is refused when only one distinct letter is still hidden, so it never finishes the word', () => {
    const g = play('apple', 'apl'); // only "e" left
    expect(hiddenLetters(g)).toEqual(['e']);
    expect(canHint(g)).toBe(false);
    expect(applyHint(g, mulberry32(1))).toBe(g);
  });
  it('is refused once the game is over', () => {
    expect(canHint(play('apple', 'bcdfgh'))).toBe(false);
    expect(canHint(play('apple', 'aple'))).toBe(false);
  });
  it('survives a broken rng without throwing or choosing a letter outside the word', () => {
    for (const bad of [() => NaN, () => 1, () => -3, () => Infinity]) {
      const g = applyHint(newGame(entry('planet')), bad);
      expect('planet').toContain(g.hinted[0]);
    }
  });
  it('can never turn a game into a win or a loss on its own', () => {
    // Every word in every category, not a sample: no run of hints may win or lose a game.
    expect(new Set(WORD_LIST.map((e) => e.category)).size).toBe(CATEGORIES.length);
    for (const e of WORD_LIST) {
      let g = newGame(e);
      for (let i = 0; i < 12; i++) g = applyHint(g, mulberry32(i + 1));
      expect(status(g), e.word).toBe('playing');
      expect(wrongCount(g), e.word).toBeLessThanOrEqual(MAX_WRONG - 1);
      expect(hiddenLetters(g).length, e.word).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('word choice', () => {
  const small: Entry[] = [entry('lion'), entry('wolf'), entry('hawk'), entry('apple', 'food'), entry('banana', 'food'), entry('elephant')];

  it('returns only words that match the filters', () => {
    for (let s = 1; s <= 60; s++) {
      for (const f of [
        { category: 'animals', difficulty: 'easy' },
        { category: 'any', difficulty: 'hard' },
        { category: 'technology', difficulty: 'medium' },
      ] as Filters[]) {
        const e = pickWord(WORD_LIST, f, mulberry32(s))!;
        expect(e, JSON.stringify(f)).not.toBeNull();
        expect(matchesFilters(e, f)).toBe(true);
        if (f.category !== 'any') expect(e.category).toBe(f.category);
        const { min, max } = DIFFICULTY_RANGE[f.difficulty];
        expect(e.word.length).toBeGreaterThanOrEqual(min);
        expect(e.word.length).toBeLessThanOrEqual(max);
      }
    }
  });
  it('returns null for an empty list or a filter with no matches', () => {
    expect(pickWord([], { category: 'any', difficulty: 'easy' }, mulberry32(1))).toBeNull();
    expect(pickWord(small, { category: 'science', difficulty: 'easy' }, mulberry32(1))).toBeNull();
  });
  it('is deterministic for a seed', () => {
    const f: Filters = { category: 'any', difficulty: 'medium' };
    const run = (seed: number) => { const r = mulberry32(seed); return Array.from({ length: 10 }, () => pickWord(WORD_LIST, f, r)!.word); };
    expect(run(99)).toEqual(run(99));
    expect(run(99)).not.toEqual(run(100));
  });
  it('can reach every matching word', () => {
    const f: Filters = { category: 'animals', difficulty: 'easy' };
    const pool = WORD_LIST.filter((e) => matchesFilters(e, f)).map((e) => e.word);
    const r = mulberry32(5);
    const seen = new Set<string>();
    for (let i = 0; i < pool.length * 60; i++) seen.add(pickWord(WORD_LIST, f, r)!.word);
    expect(seen.size).toBe(pool.length);
  });
  it('skips recent words while others are available', () => {
    const f: Filters = { category: 'animals', difficulty: 'easy' };
    const recent = ['lion', 'wolf'];
    for (let s = 1; s <= 80; s++) expect(recent).not.toContain(pickWord(small, f, mulberry32(s), recent)!.word);
  });
  it('falls back to the least recently used word when every match is recent', () => {
    const f: Filters = { category: 'animals', difficulty: 'easy' };
    expect(pickWord(small, f, mulberry32(1), ['wolf', 'hawk', 'lion'])!.word).toBe('wolf');
    expect(pickWord(small, f, mulberry32(1), ['lion', 'hawk', 'wolf'])!.word).toBe('lion');
    // Other words in `recent` that do not match the filters do not matter.
    expect(pickWord(small, f, mulberry32(1), ['apple', 'hawk', 'wolf', 'lion'])!.word).toBe('hawk');
  });
  it('never gives a repeat within the last 20 picks when the pool is big enough', () => {
    for (const f of [
      { category: 'any', difficulty: 'medium' },
      { category: 'any', difficulty: 'easy' },
      { category: 'animals', difficulty: 'easy' },
    ] as Filters[]) {
      expect(WORD_LIST.filter((e) => matchesFilters(e, f)).length).toBeGreaterThan(RECENT_LIMIT);
      const r = mulberry32(2026);
      let recent: string[] = [];
      const history: string[] = [];
      for (let i = 0; i < 400; i++) {
        const w = pickWord(WORD_LIST, f, r, recent)!.word;
        expect(history.slice(-RECENT_LIMIT), `${JSON.stringify(f)} pick ${i}`).not.toContain(w);
        history.push(w);
        recent = pushRecent(recent, w);
      }
    }
  });
  it('survives a broken rng', () => {
    for (const bad of [() => NaN, () => 1, () => -1, () => Infinity]) {
      expect(pickWord(WORD_LIST, { category: 'any', difficulty: 'hard' }, bad)).not.toBeNull();
    }
  });
  it('pushRecent keeps newest last, drops duplicates and caps the length', () => {
    expect(pushRecent(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(pushRecent(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
    const long = Array.from({ length: 25 }, (_, i) => `w${i}`);
    const out = pushRecent(long, 'new');
    expect(out).toHaveLength(RECENT_LIMIT);
    expect(out[out.length - 1]).toBe('new');
    expect(out[0]).toBe('w6');
    const original = ['a', 'b'];
    pushRecent(original, 'c');
    expect(original).toEqual(['a', 'b']);
  });
});

describe('determinism and invariants over whole games', () => {
  const simulate = (seed: number) => {
    const r = mulberry32(seed);
    const e = pickWord(WORD_LIST, { category: 'any', difficulty: 'medium' }, r)!;
    let g = newGame(e);
    const order = [...LETTERS].sort(() => r() - 0.5);
    const trace: string[] = [];
    for (const l of order) {
      if (r() < 0.1) g = applyHint(g, r);
      g = applyGuess(g, l);
      trace.push(`${l}${wrongCount(g)}${status(g)[0]}`);
      if (status(g) !== 'playing') break;
    }
    return { g, trace };
  };

  it('replays identically from the same seed', () => {
    expect(simulate(31).trace).toEqual(simulate(31).trace);
    expect(simulate(31).g).toEqual(simulate(31).g);
  });
  it('always ends within the alphabet, never over six wrong, and never both won and lost', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { g } = simulate(seed);
      expect(status(g), `seed ${seed}`).not.toBe('playing');
      expect(wrongCount(g)).toBeLessThanOrEqual(MAX_WRONG);
      if (status(g) === 'lost') expect(wrongCount(g)).toBe(MAX_WRONG);
      if (status(g) === 'won') expect(maskWord(g)).not.toContain('_');
      expect(g.guessed.length).toBeLessThanOrEqual(26);
      expect(new Set(g.guessed).size).toBe(g.guessed.length);
    }
  });
});

describe('streaks', () => {
  it('a win adds one, a loss resets to zero, best never drops', () => {
    let s = { current: 0, best: 0 };
    s = recordResult(s, true);
    s = recordResult(s, true);
    s = recordResult(s, true);
    expect(s).toEqual({ current: 3, best: 3 });
    s = recordResult(s, false);
    expect(s).toEqual({ current: 0, best: 3 });
    s = recordResult(s, true);
    expect(s).toEqual({ current: 1, best: 3 });
  });
  it('does not mutate the old streak', () => {
    const s = Object.freeze({ current: 2, best: 5 });
    expect(recordResult(s, true)).toEqual({ current: 3, best: 5 });
    expect(s).toEqual({ current: 2, best: 5 });
  });
  it('turns anything odd from storage into safe whole numbers', () => {
    expect(sanitizeStreak(null)).toEqual({ current: 0, best: 0 });
    expect(sanitizeStreak('x')).toEqual({ current: 0, best: 0 });
    expect(sanitizeStreak({})).toEqual({ current: 0, best: 0 });
    expect(sanitizeStreak({ current: 'abc', best: NaN })).toEqual({ current: 0, best: 0 });
    expect(sanitizeStreak({ current: -4, best: 2.5 })).toEqual({ current: 0, best: 0 });
    expect(sanitizeStreak({ current: Infinity, best: 3 })).toEqual({ current: 0, best: 3 });
    expect(sanitizeStreak({ current: 4, best: 2 })).toEqual({ current: 4, best: 4 }); // best is at least current
    expect(sanitizeStreak({ current: '7', best: '9' })).toEqual({ current: 7, best: 9 });
    expect(sanitizeStreak({ current: 1e12, best: 1e12 }).current).toBeLessThanOrEqual(1_000_000);
  });
  it('giving up after guessing counts as a loss, giving up before guessing does not', () => {
    const s = { current: 4, best: 6 };
    expect(streakAfterAbandon(newGame(entry('apple')), s)).toBe(s);
    expect(streakAfterAbandon(play('apple', 'z'), s)).toEqual({ current: 0, best: 6 });
    expect(streakAfterAbandon(applyHint(newGame(entry('planet')), mulberry32(1)), s)).toEqual({ current: 0, best: 6 });
  });
  it('leaving a finished game changes nothing, because its result was already recorded', () => {
    const s = { current: 4, best: 6 };
    expect(streakAfterAbandon(play('apple', 'aple'), s)).toBe(s);
    expect(streakAfterAbandon(play('apple', 'bcdfgh'), s)).toBe(s);
  });
});

describe('keyboard scope', () => {
  it('counts a letter typed on the page body or inside the game', () => {
    expect(letterKeyApplies(true, false)).toBe(true);
    expect(letterKeyApplies(false, true)).toBe(true);
  });
  it('ignores a letter typed while focus is on some other control on the page', () => {
    expect(letterKeyApplies(false, false)).toBe(false);
  });
});

describe('share text', () => {
  it('never contains the word or a bad value', () => {
    const lost = play('kettle', 'xzqjwv');
    const won = play('kettle', 'kelt');
    for (const g of [newGame(entry('kettle', 'home')), lost, won]) {
      const t = shareSummary(g, 'medium', { current: 3, best: 5 });
      expect(t).not.toContain('kettle');
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(t).toContain('6 letters');
      expect(t).toContain('win streak 3, best 5');
    }
    expect(shareSummary(won, 'hard', { current: 0, best: 0 })).toContain('solved');
    expect(shareSummary(lost, 'hard', { current: 0, best: 0 })).toContain('not solved');
  });
});
