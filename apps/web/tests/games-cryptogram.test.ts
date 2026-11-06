/**
 * games-cryptogram.test.ts - the engine behind `cryptogram`.
 *
 * Pinned: the hand-picked sayings obey their own rules (characters, length, no duplicates, no
 * attribution marks, nothing on the blocklist, enough for every level); the secret alphabet is a
 * bijection with no letter standing for itself; encoding then decoding with an independently built
 * inverse returns the saying; a generated puzzle keeps every mark in place, gives the stated number
 * of correct letters, is the same for the same seed and never starts solved; guesses behave (one
 * plain letter per code letter, locked letters stay, junk is refused); a player who enters the true
 * letters always solves it; wrong letters are reported exactly; hints and the answer are right;
 * the frequency table is an exact count. Numbers quoted on the guide page are asserted here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SAYINGS, LEVELS, LEVEL_SPEC, LEVEL_LABEL, LEVEL_NOTE, ALPHABET, BLOCKED_WORDS, makeKey, encode, invertKey, letterCount, sayingsFor,
  generate, codeLetters, setGuess, isSolved, wrongLetters, progress, hintLetter, revealAll, clearGuesses, restartGame, givenLetters,
  frequency, readout, guessText, sanitiseBest, sanitiseSeed, sanitiseLevel, plural, mulberry32, pickIndex,
  type Level, type Game,
} from '../src/components/apps-private/cryptogram/helpers';
import calculatorSource from '../src/components/apps-private/cryptogram/Calculator.astro?raw';

vi.setConfig({ testTimeout: 60_000 });

const idx = (c: string): number => c.charCodeAt(0) - 65;

describe('the sayings', () => {
  it('has the counts quoted on the guide page', () => {
    expect(SAYINGS.length).toBe(90);
    expect(LEVELS.map((l) => sayingsFor(l).length)).toEqual([29, 29, 32]);
    expect(LEVELS.map((l) => LEVEL_SPEC[l].maxLetters).slice(0, 2)).toEqual([21, 27]);
    expect(LEVELS.map((l) => LEVEL_SPEC[l].reveal)).toEqual([3, 1, 0]);
  });
  it('are unique, start with a capital and end with a full stop', () => {
    expect(new Set(SAYINGS).size).toBe(SAYINGS.length);
    expect(new Set(SAYINGS.map((s) => s.toLowerCase())).size).toBe(SAYINGS.length);
    for (const s of SAYINGS) {
      expect(/^[A-Z]/.test(s), s).toBe(true);
      expect(/\.$/.test(s), s).toBe(true);
    }
  });
  it('use only letters, spaces and the marks , . \' ! ? ; with no digits, quotes, dashes or credits', () => {
    for (const s of SAYINGS) {
      expect(/^[A-Za-z ,.'!?;]+$/.test(s), s).toBe(true);
      expect(s.includes('—') || s.includes('–') || s.includes(' - ') || s.includes('"'), s).toBe(false);
      expect(/\s{2,}/.test(s), s).toBe(false);
      expect(s.trim(), s).toBe(s);
    }
  });
  it('are between 12 and 60 letters', () => {
    for (const s of SAYINGS) {
      const n = letterCount(s);
      expect(n, s).toBeGreaterThanOrEqual(12);
      expect(n, s).toBeLessThanOrEqual(60);
    }
  });
  it('have no word on the blocklist', () => {
    const words = new Set<string>();
    for (const s of SAYINGS) for (const w of s.toLowerCase().match(/[a-z']+/g) ?? []) words.add(w);
    for (const w of words) expect(BLOCKED_WORDS.includes(w), w).toBe(false);
    for (const bad of ['fuck', 'shit', 'kill', 'dead', 'hate', 'sex', 'devil', 'bitch', 'murder', 'stupid']) {
      expect(BLOCKED_WORDS.includes(bad), bad).toBe(true);
    }
    expect(BLOCKED_WORDS.length).toBeGreaterThan(60);
  });
  it('every level has at least 12 sayings and the levels do not overlap', () => {
    const seen = new Set<string>();
    for (const l of LEVELS) {
      const pool = sayingsFor(l);
      expect(pool.length, l).toBeGreaterThanOrEqual(12);
      for (const s of pool) { expect(seen.has(s), s).toBe(false); seen.add(s); }
    }
    expect(seen.size).toBe(SAYINGS.length);
    for (const s of sayingsFor('easy')) expect(letterCount(s)).toBeLessThanOrEqual(21);
    for (const s of sayingsFor('medium')) { expect(letterCount(s)).toBeGreaterThan(21); expect(letterCount(s)).toBeLessThanOrEqual(27); }
    for (const s of sayingsFor('hard')) expect(letterCount(s)).toBeGreaterThan(27);
  });
  it('labels exist for every level', () => {
    expect(LEVELS.map((l) => LEVEL_LABEL[l])).toEqual(['Easy', 'Medium', 'Hard']);
    for (const l of LEVELS) expect(LEVEL_NOTE[l].length).toBeGreaterThan(5);
  });
});

describe('the secret alphabet', () => {
  it('is a permutation of A to Z in which no letter stands for itself (500 keys, plus degenerate rngs)', () => {
    const keys: string[] = [];
    for (let s = 1; s <= 500; s++) keys.push(makeKey(mulberry32(s * 977)));
    for (const rng of [() => 0, () => 0.999999, () => NaN, () => 0.5]) keys.push(makeKey(rng));
    for (const key of keys) {
      expect(key.length).toBe(26);
      expect([...key].sort().join('')).toBe(ALPHABET);
      for (let i = 0; i < 26; i++) expect(key[i], key).not.toBe(ALPHABET[i]);
    }
  });
  it('is a single cycle, and the same seed gives the same key', () => {
    for (let s = 1; s <= 100; s++) {
      const key = makeKey(mulberry32(s));
      let at = 0, steps = 0;
      do { at = key.charCodeAt(at) - 65; steps++; } while (at !== 0 && steps < 100);
      expect(steps).toBe(26);
      expect(makeKey(mulberry32(s))).toBe(key);
    }
    expect(makeKey(mulberry32(1))).not.toBe(makeKey(mulberry32(2)));
  });
  it('encode then decode with an independently built inverse returns every saying', () => {
    const rng = mulberry32(8);
    for (const s of SAYINGS) {
      const text = s.toUpperCase();
      const key = makeKey(rng);
      const code = encode(text, key);
      // Independent inverse: scan the key for each code letter.
      const back = [...code].map((c) => (c >= 'A' && c <= 'Z' ? ALPHABET[key.indexOf(c)] : c)).join('');
      expect(back).toBe(text);
      expect(code.length).toBe(text.length);
      for (let i = 0; i < text.length; i++) {
        if (!/[A-Z]/.test(text[i])) expect(code[i]).toBe(text[i]);
        else expect(code[i]).not.toBe(text[i]);
      }
      expect(invertKey(key).split('').map((p, i) => key[idx(p)] === ALPHABET[i]).every(Boolean)).toBe(true);
    }
  });
  it('the same plain letter always becomes the same code letter, and different letters differ', () => {
    for (let s = 1; s <= 50; s++) {
      const g = generate('hard', mulberry32(s));
      const map = new Map<string, string>();
      const rev = new Map<string, string>();
      for (let i = 0; i < g.text.length; i++) {
        if (!/[A-Z]/.test(g.text[i])) continue;
        const p = g.text[i], c = g.code[i];
        expect(map.get(p) ?? c).toBe(c);
        expect(rev.get(c) ?? p).toBe(p);
        map.set(p, c);
        rev.set(c, p);
      }
    }
  });
});

describe('a generated puzzle', () => {
  it('keeps every mark in place, uses a saying from the right level and gives the stated letters (1,500 puzzles)', () => {
    for (const level of LEVELS) {
      const pool = new Set(sayingsFor(level).map((s) => s.toUpperCase()));
      for (let seed = 1; seed <= 500; seed++) {
        const g = generate(level, mulberry32(seed * 31337));
        expect(pool.has(g.text), g.text).toBe(true);
        expect(g.level).toBe(level);
        expect(g.code.length).toBe(g.text.length);
        for (let i = 0; i < g.text.length; i++) if (!/[A-Z]/.test(g.text[i])) expect(g.code[i]).toBe(g.text[i]);
        const given = codeLetters(g).filter((c) => g.locked[idx(c)]);
        expect(given.length).toBe(LEVEL_SPEC[level].reveal);
        for (const c of given) expect(g.guess[idx(c)]).toBe(g.plainOf[idx(c)]);
        // Every unlocked letter starts empty.
        for (const c of codeLetters(g)) if (!g.locked[idx(c)]) expect(g.guess[idx(c)]).toBe('');
        expect(isSolved(g)).toBe(false);
        expect(g.aided).toBe(false);
        expect(g.gaveUp).toBe(false);
        // plainOf is right (checked against the text and code).
        for (let i = 0; i < g.text.length; i++) if (/[A-Z]/.test(g.text[i])) expect(g.plainOf[idx(g.code[i])]).toBe(g.text[i]);
      }
    }
  });
  it('is deterministic for a seed and differs across seeds', () => {
    for (const level of LEVELS) {
      expect(generate(level, mulberry32(9))).toEqual(generate(level, mulberry32(9)));
      const codes = new Set<string>();
      for (let s = 1; s <= 40; s++) codes.add(generate(level, mulberry32(s)).code);
      expect(codes.size).toBeGreaterThan(35);
    }
  });
  it('survives a degenerate rng and rejects an unknown level', () => {
    for (const level of LEVELS) for (const rng of [() => 0, () => 0.999999, () => NaN]) {
      const g = generate(level, rng);
      expect(isSolved(g)).toBe(false);
      expect(codeLetters(g).length).toBeGreaterThan(5);
    }
    expect(() => generate('wild' as Level, mulberry32(1))).toThrow(RangeError);
  });
  it('every saying turns up for some seed at its level (so none is unreachable)', () => {
    for (const level of LEVELS) {
      const want = new Set(sayingsFor(level).map((s) => s.toUpperCase()));
      const got = new Set<string>();
      for (let s = 1; s <= 3000 && got.size < want.size; s++) got.add(generate(level, mulberry32(s)).text);
      expect([...want].filter((t) => !got.has(t))).toEqual([]);
    }
  });
});

describe('guesses', () => {
  const fresh = (level: Level = 'hard', seed = 3): Game => generate(level, mulberry32(seed));
  const put = (g: Game, c: string, p: string): Game => {
    const r = setGuess(g, c, p);
    if (!r.ok) throw new Error(`${c}=${p}: ${r.reason}`);
    return r.game;
  };
  it('a player who enters the true letters solves it, in any order, at every level', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        let g = generate(level, mulberry32(seed));
        const order = codeLetters(g).filter((c) => !g.locked[idx(c)]);
        // Shuffle deterministically.
        const rng = mulberry32(seed);
        for (let i = order.length - 1; i > 0; i--) { const j = pickIndex(i + 1, rng); [order[i], order[j]] = [order[j], order[i]]; }
        for (const c of order) {
          const r = setGuess(g, c, g.plainOf[idx(c)]);
          if (!r.ok) throw new Error(r.reason);
          expect(r.moved).toBe('');
          g = r.game;
        }
        expect(isSolved(g)).toBe(true);
        expect(wrongLetters(g)).toEqual([]);
        expect(readout(g)).toBe(g.text);
        expect(progress(g).filled).toBe(progress(g).total);
      }
    }
  });
  it('gives each plain letter to one code letter only: the second use takes it from the first', () => {
    let g = fresh();
    const [a, b] = codeLetters(g);
    g = put(g, a, 'E');
    const r = setGuess(g, b, 'E');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.moved).toBe(a);
    expect(r.game.guess[idx(a)]).toBe('');
    expect(r.game.guess[idx(b)]).toBe('E');
    // Changing a guess to another letter frees the old one.
    const g2 = put(r.game, b, 'T');
    expect(g2.guess[idx(b)]).toBe('T');
    const again = setGuess(g2, a, 'E');
    expect(again.ok && again.moved).toBe('');
    // Clearing works, and clearing an empty one is fine.
    const cleared = put(g2, b, '');
    expect(cleared.guess[idx(b)]).toBe('');
    expect(setGuess(cleared, b, '').ok).toBe(true);
  });
  it('refuses a letter not in the puzzle, a bad letter, and any change to a given letter', () => {
    const g = generate('easy', mulberry32(4));
    const used = new Set(codeLetters(g));
    const unused = [...ALPHABET].find((c) => !used.has(c))!;
    const rn = (c: unknown, p: unknown) => { const r = setGuess(g, c, p); return r.ok ? 'ok' : r.reason; };
    expect(rn(unused, 'A')).toBe('not-used');
    expect(rn('a', 'A')).toBe('not-used');
    expect(rn('', 'A')).toBe('not-used');
    expect(rn(5, 'A')).toBe('not-used');
    expect(rn(null, 'A')).toBe('not-used');
    const free = codeLetters(g).find((c) => !g.locked[idx(c)])!;
    for (const bad of ['a', '1', '!', 'AB', 5, null, undefined, {}, []]) expect(rn(free, bad)).toBe('bad-letter');
    const given = codeLetters(g).find((c) => g.locked[idx(c)])!;
    expect(rn(given, 'A')).toBe('locked');
    expect(rn(given, '')).toBe('locked');
    // Using the plain letter of a given code letter on another code letter is refused.
    const takenPlain = g.guess[idx(given)];
    expect(rn(free, takenPlain)).toBe('plain-given');
    // A code letter is never its own answer.
    const own = codeLetters(g).filter((c) => !g.locked[idx(c)] && g.guess[idx(c)] === '');
    expect(own.length).toBeGreaterThan(0);
    for (const c of own) expect(rn(c, c)).toBe('self');
    for (const reason of ['not-used', 'locked', 'bad-letter', 'plain-given', 'self'] as const) expect(guessText(reason).length).toBeGreaterThan(10);
  });
  it('wrongLetters lists exactly the filled letters that differ from the answer (checked against a plain loop)', () => {
    const rng = mulberry32(21);
    for (let t = 0; t < 300; t++) {
      let g = generate(LEVELS[Math.floor(rng() * 3)], rng);
      for (let k = 0; k < 20; k++) {
        const used = codeLetters(g);
        const c = used[pickIndex(used.length, rng)];
        const p = rng() < 0.2 ? '' : ALPHABET[pickIndex(26, rng)];
        const r = setGuess(g, c, p);
        if (r.ok) g = r.game;
      }
      const want: string[] = [];
      for (const c of [...new Set(g.code.replace(/[^A-Z]/g, ''))].sort()) if (g.guess[idx(c)] && g.guess[idx(c)] !== g.plainOf[idx(c)]) want.push(c);
      expect(wrongLetters(g)).toEqual(want);
      expect(isSolved(g)).toBe(want.length === 0 && progress(g).filled === progress(g).total);
    }
  });
  it('no state ever holds one plain letter twice, and given letters stay right (6,000 random edits)', () => {
    const rng = mulberry32(99);
    for (let t = 0; t < 120; t++) {
      let g = generate(LEVELS[Math.floor(rng() * 3)], rng);
      for (let k = 0; k < 50; k++) {
        const c = rng() < 0.9 ? codeLetters(g)[pickIndex(codeLetters(g).length, rng)] : ALPHABET[pickIndex(26, rng)];
        const p = rng() < 0.1 ? '' : ALPHABET[pickIndex(26, rng)];
        const r = setGuess(g, c, p);
        if (r.ok) g = r.game;
        const filled = g.guess.filter(Boolean);
        expect(new Set(filled).size).toBe(filled.length);
        for (let i = 0; i < 26; i++) if (g.locked[i]) expect(g.guess[i]).toBe(g.plainOf[i]);
        expect(g.guess.length).toBe(26);
        for (const v of g.guess) expect(v === '' || /^[A-Z]$/.test(v)).toBe(true);
      }
    }
  });
  it('clearGuesses and restartGame keep only what they should', () => {
    let g = generate('medium', mulberry32(2));
    const given = givenLetters(g);
    const free = codeLetters(g).filter((c) => !g.locked[idx(c)]);
    g = put(g, free[0], 'Q');
    g = put(g, free[1], 'Z');
    const c1 = clearGuesses(g);
    for (const c of free) expect(c1.guess[idx(c)]).toBe('');
    for (const c of codeLetters(g)) if (g.locked[idx(c)]) expect(c1.guess[idx(c)]).toBe(g.guess[idx(c)]);
    const h = hintLetter(g, mulberry32(1))!;
    const r = restartGame(h.game, given);
    // Help stays on the record: starting over must not make a helped puzzle count as solved without help.
    expect(r.aided).toBe(true);
    expect(r.gaveUp).toBe(false);
    expect(r.locked).toEqual(g.locked);
    const shown = restartGame(revealAll(g), given);
    expect(shown.aided).toBe(true);
    expect(shown.gaveUp).toBe(true);
    const clean = restartGame(g, given);
    expect(clean.aided).toBe(false);
    expect(clean.gaveUp).toBe(false);
    expect(r.guess.filter(Boolean).length).toBe(given.filter(Boolean).length);
  });
});

describe('hints, the answer and the frequency table', () => {
  it('a hint reveals a correct, locked letter that was not right before, and marks the game aided', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 200; t++) {
      let g = generate(LEVELS[Math.floor(rng() * 3)], rng);
      // Add a few wrong guesses first.
      for (let k = 0; k < 4; k++) {
        const c = codeLetters(g)[pickIndex(codeLetters(g).length, rng)];
        const r = setGuess(g, c, ALPHABET[pickIndex(26, rng)]);
        if (r.ok) g = r.game;
      }
      const before = g;
      const h = hintLetter(g, rng)!;
      expect(h).not.toBeNull();
      expect(h.game.aided).toBe(true);
      expect(before.aided).toBe(false);
      expect(h.plain).toBe(g.plainOf[idx(h.cipher)]);
      expect(h.game.guess[idx(h.cipher)]).toBe(h.plain);
      expect(h.game.locked[idx(h.cipher)]).toBe(true);
      expect(before.locked[idx(h.cipher)]).toBe(false);
      expect(before.guess[idx(h.cipher)]).not.toBe(h.plain);
      // Nobody else still holds that plain letter.
      expect(h.game.guess.filter((v) => v === h.plain).length).toBe(1);
    }
  });
  it('enough hints solve the puzzle, and a hint on a solved puzzle returns null', () => {
    for (const level of LEVELS) {
      let g = generate(level, mulberry32(11));
      const total = progress(g).total;
      let guard = 0;
      while (!isSolved(g) && guard++ < 40) g = hintLetter(g, mulberry32(guard))!.game;
      expect(isSolved(g)).toBe(true);
      expect(guard).toBeLessThanOrEqual(total);
      expect(hintLetter(g, mulberry32(1))).toBeNull();
    }
  });
  it('revealAll solves it, locks everything, and marks the game as given up', () => {
    const g = generate('hard', mulberry32(6));
    const r = revealAll(g);
    expect(isSolved(r)).toBe(true);
    expect(r.gaveUp).toBe(true);
    expect(r.aided).toBe(true);
    expect(readout(r)).toBe(g.text);
    for (const c of codeLetters(r)) expect(r.locked[idx(c)]).toBe(true);
    expect(g.gaveUp).toBe(false);
  });
  it('the frequency table is an exact count, sorted by count then letter, and sums to the letters in the saying', () => {
    for (let s = 1; s <= 120; s++) {
      const g = generate(LEVELS[s % 3], mulberry32(s));
      const f = frequency(g);
      const want = new Map<string, number>();
      for (const ch of g.code.replace(/[^A-Z]/g, '')) want.set(ch, (want.get(ch) ?? 0) + 1);
      expect(f.length).toBe(want.size);
      for (const { cipher, count } of f) expect(want.get(cipher)).toBe(count);
      expect(f.reduce((a, b) => a + b.count, 0)).toBe(letterCount(g.text));
      for (let i = 1; i < f.length; i++) {
        expect(f[i - 1].count > f[i].count || (f[i - 1].count === f[i].count && f[i - 1].cipher < f[i].cipher)).toBe(true);
      }
      expect(f.map((x) => x.cipher).sort()).toEqual(codeLetters(g));
    }
  });
  it('readout shows underscores for empty code letters and keeps the marks', () => {
    const g = generate('hard', mulberry32(7));
    const out = readout(g);
    expect(out.length).toBe(g.text.length);
    for (let i = 0; i < out.length; i++) if (!/[A-Z]/.test(g.text[i])) expect(out[i]).toBe(g.text[i]);
    expect(/[A-Z]/.test(out.replace(/_/g, ''))).toBe(false); // nothing given at Hard: no letters yet
  });
});

describe('sanitisers and helpers', () => {
  it('sanitiseSeed accepts only whole numbers from 1 to 2^32 - 1', () => {
    expect(sanitiseSeed(1)).toBe(1);
    expect(sanitiseSeed('4294967295')).toBe(4294967295);
    for (const bad of [0, -1, 4294967296, 1.5, NaN, '0', '-1', '1.5', '1e3', ' 5', '', 'abc', '99999999999', null, undefined, {}, [], true]) {
      expect(sanitiseSeed(bad), String(bad)).toBe(0);
    }
  });
  it('sanitiseLevel falls back to easy', () => {
    expect(sanitiseLevel('medium')).toBe('medium');
    for (const bad of ['', 'HARD', '__proto__', 5, null, undefined, [], {}]) expect(sanitiseLevel(bad)).toBe('easy');
  });
  it('sanitiseBest keeps whole numbers 1 to 99,999 for the three level names only and returns a fresh object', () => {
    expect(sanitiseBest({ easy: 3, medium: 99999, hard: 1 })).toEqual({ easy: 3, medium: 99999, hard: 1 });
    expect(sanitiseBest({ easy: 0, medium: -3, hard: 1.5 })).toEqual({});
    expect(sanitiseBest({ easy: NaN, medium: Infinity, hard: 100000 })).toEqual({});
    expect(sanitiseBest({ easy: '5', medium: true, hard: [5] })).toEqual({});
    expect(sanitiseBest({ x: 5, easy: 2 })).toEqual({ easy: 2 });
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"easy": 5}, "constructor": 3}'));
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    const raw = { easy: 4 };
    const fresh = sanitiseBest(raw);
    expect(fresh).not.toBe(raw);
  });
  it('plural and letterCount', () => {
    expect(plural(1, 'letter')).toBe('1 letter');
    expect(plural(2, 'letter')).toBe('2 letters');
    expect(letterCount("All's well.")).toBe(8);
    expect(letterCount('')).toBe(0);
  });
});

describe('the page', () => {
  it('announces results, keeps scores under the right key and uses the shell events', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/gk:game:cryptogram/);
    expect(calculatorSource).toMatch(/_cgrmInit/);
    expect(calculatorSource).toMatch(/id="cgrm-app"/);
  });
});
