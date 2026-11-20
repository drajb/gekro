/**
 * games-word-chain.test.ts - the engine behind `word-chain`.
 *
 * Pinned: the hand-written list obeys its own rules (letters, lengths, no duplicates, nothing on
 * the blocklist, enough words for every starting letter); the rules for a word (right first letter,
 * on the list, not used) match a brute-force check; the computer only ever says a listed, unused
 * word that starts with the right letter, never leaves you without a word unless it had no choice,
 * and follows its level's strategy (checked against a plain loop); chains are the same for the same
 * seed and the same words; thousands of random games never break an invariant; hints and the
 * sanitisers behave. Numbers quoted on the guide page are asserted here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  WORDS, LEVELS, LEVEL_LABEL, LEVEL_NOTE, BLOCKED_EXACT, BLOCKED_PARTS, isBlocked, wordList, isListed, lastLetter, required, unusedStarting,
  newGame, normalise, playerMove, cpuChoice, cpuMove, endChain, hint, yourWords, totalWords, refusalText, endText, sanitiseBest,
  sanitiseSeed, sanitiseLevel, plural, mulberry32, pickIndex, type Level, type Game,
} from '../src/components/apps-private/word-chain/helpers';
import calculatorSource from '../src/components/apps-private/word-chain/Calculator.astro?raw';

vi.setConfig({ testTimeout: 60_000 });

/** Independent: unused list words starting with a letter, by a plain filter over the raw list. */
const brute = (g: Game, letter: string): string[] => WORDS.filter((w) => w.startsWith(letter) && !g.words.includes(w));

const pickRandomUnused = (g: Game, rng: () => number): string | null => {
  const opts = brute(g, required(g));
  return opts.length ? opts[pickIndex(opts.length, rng)] : null;
};

/** Play a whole game with a player who always says a random legal word. Returns the final game. */
const playOut = (level: Level, seed: number, maxTurns = 5000): Game => {
  const rng = mulberry32(seed);
  const cpu = mulberry32(seed * 7 + 1);
  let g = newGame(level, cpu);
  for (let t = 0; t < maxTurns && !g.over; t++) {
    const w = pickRandomUnused(g, rng);
    if (w === null) throw new Error('player had no word but the game was not over');
    const r = playerMove(g, w);
    if (!r.ok) throw new Error(`${w}: ${r.reason}`);
    g = r.game;
    if (g.over) break;
    g = cpuMove(g, cpu);
  }
  return g;
};

describe('word list', () => {
  it('has the counts quoted on the guide page', () => {
    expect(WORDS.length).toBe(1005);
    expect(WORDS.length).toBeGreaterThanOrEqual(800);
    const per: Record<string, number> = {};
    for (const w of WORDS) per[w[0]] = (per[w[0]] ?? 0) + 1;
    expect(Object.keys(per).sort().join('')).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(Math.min(...Object.values(per))).toBe(1); // only x has a single word
    expect(per.x).toBe(1);
    expect(Object.entries(per).filter(([, n]) => n < 7).map(([k]) => k)).toEqual(['x']);
  });
  it('uses only lower-case a-z, 3 to 9 letters, no duplicates, sorted, and the game drops nothing', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(WORDS.slice().sort()).toEqual([...WORDS]);
    for (const w of WORDS) {
      expect(/^[a-z]+$/.test(w), w).toBe(true);
      expect(w.length, w).toBeGreaterThanOrEqual(3);
      expect(w.length, w).toBeLessThanOrEqual(9);
    }
    expect(wordList()).toEqual([...WORDS]);
    expect(WORDS.every(isListed)).toBe(true);
    expect(isListed('zzzzz')).toBe(false);
  });
  it('has no word on the blocklist, whole or in part', () => {
    for (const w of WORDS) {
      expect(BLOCKED_EXACT.includes(w), w).toBe(false);
      for (const p of BLOCKED_PARTS) expect(w.includes(p), `${p} in ${w}`).toBe(false);
      expect(isBlocked(w), w).toBe(false);
    }
  });
  it('the blocklist really blocks the usual rude, hateful, violent and frightening words', () => {
    for (const bad of ['ass', 'sex', 'fag', 'gay', 'tit', 'pee', 'poo', 'hell', 'damn', 'kill', 'dead', 'fuck', 'shit', 'cunt', 'dick', 'cock', 'piss',
      'porn', 'slut', 'rape', 'turd', 'crap', 'butt', 'weed', 'nude', 'bomb', 'ghost', 'witch', 'devil', 'murder', 'knife', 'sword', 'stupid',
      'bitch', 'whore', 'fucking', 'shithead', 'bullshit']) {
      expect(isBlocked(bad), bad).toBe(true);
    }
    for (const fine of ['shell', 'hello', 'class', 'skill', 'peacock', 'saturday', 'grape', 'scrap']) expect(isBlocked(fine), fine).toBe(false);
    expect(BLOCKED_EXACT.length).toBeGreaterThan(80);
  });
  it('a letter that ends many words also starts many, so chains rarely end by accident', () => {
    const starts: Record<string, number> = {};
    const ends: Record<string, number> = {};
    for (const w of WORDS) { starts[w[0]] = (starts[w[0]] ?? 0) + 1; ends[lastLetter(w)] = (ends[lastLetter(w)] ?? 0) + 1; }
    // Every letter that ends 10 or more words also starts at least 10.
    for (const [l, n] of Object.entries(ends)) if (n >= 10) expect(starts[l] ?? 0, l).toBeGreaterThanOrEqual(10);
  });
  it('labels exist for every level', () => {
    expect(LEVELS.map((l) => LEVEL_LABEL[l])).toEqual(['Gentle', 'Normal', 'Tricky']);
    for (const l of LEVELS) expect(LEVEL_NOTE[l].length).toBeGreaterThan(5);
  });
});

describe('a new chain', () => {
  it('starts with one listed word of 3 to 6 letters from the computer, with plenty of words after it', () => {
    for (const level of LEVELS) {
      for (let s = 1; s <= 300; s++) {
        const g = newGame(level, mulberry32(s * 31));
        expect(g.words.length).toBe(1);
        expect(g.by).toEqual(['cpu']);
        expect(isListed(g.words[0])).toBe(true);
        expect(g.words[0].length).toBeGreaterThanOrEqual(3);
        expect(g.words[0].length).toBeLessThanOrEqual(6);
        expect(unusedStarting(g, required(g)).length).toBeGreaterThanOrEqual(10);
        expect(g.over).toBeNull();
        expect(g.hints).toBe(0);
        expect(g.level).toBe(level);
      }
    }
  });
  it('is deterministic for a seed, differs across seeds, survives a degenerate rng and rejects an unknown level', () => {
    expect(newGame('medium', mulberry32(5))).toEqual(newGame('medium', mulberry32(5)));
    const firsts = new Set<string>();
    for (let s = 1; s <= 60; s++) firsts.add(newGame('medium', mulberry32(s)).words[0]);
    expect(firsts.size).toBeGreaterThan(30);
    for (const rng of [() => 0, () => 0.999999, () => NaN]) expect(isListed(newGame('easy', rng).words[0])).toBe(true);
    expect(() => newGame('wild' as Level, mulberry32(1))).toThrow(RangeError);
  });
});

describe('the rules for your word', () => {
  const start = (): Game => ({ level: 'medium', words: ['apple'], by: ['cpu'], hints: 0, over: null });
  const why = (g: Game, raw: unknown): string => { const r = playerMove(g, raw); return r.ok ? 'ok' : r.reason; };
  it('accepts a listed, unused word that starts with the last letter', () => {
    const r = playerMove(start(), 'egg');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.words).toEqual(['apple', 'egg']);
    expect(r.game.by).toEqual(['cpu', 'you']);
    expect(start().words).toEqual(['apple']); // immutable
  });
  it('refuses everything else with a plain reason, and ignores case, spaces and marks', () => {
    const g = start();
    expect(why(g, '')).toBe('empty');
    expect(why(g, '   ')).toBe('empty');
    expect(why(g, 42)).toBe('empty');
    expect(why(g, null)).toBe('empty');
    expect(why(g, 'dog')).toBe('wrong-start');
    expect(why(g, 'eggz')).toBe('not-a-word');
    expect(why(g, 'enormouss')).toBe('not-a-word');
    expect(why(g, ' EGG! ')).toBe('ok');
    expect(why(g, 'e-g-g')).toBe('ok');
    expect(why({ ...g, words: ['apple', 'egg', 'goat'], by: ['cpu', 'you', 'cpu'] }, 'egg')).toBe('wrong-start'); // needs a T now
    expect(why({ ...g, words: ['apple', 'egg', 'goat', 'tent'], by: ['cpu', 'you', 'cpu', 'cpu'] }, 'tent')).toBe('used');
    expect(why({ ...g, words: ['egg', 'goat'], by: ['cpu', 'cpu'] }, 'goat')).toBe('wrong-start');
    expect(why({ ...g, words: ['tent', 'toad', 'door'], by: ['cpu', 'you', 'cpu'] }, 'rain')).toBe('ok');
    // Used word: toad again after a chain that comes back round to d.
    expect(why({ ...g, words: ['dog', 'goat', 'toad'], by: ['cpu', 'you', 'cpu'] }, 'dog')).toBe('used');
    expect(why({ ...g, over: 'ended' }, 'egg')).toBe('over');
    expect(why({ ...g, words: ['apple', 'egg'], by: ['cpu', 'you'] }, 'goat')).toBe('not-your-turn');
  });
  it('a word that starts with the right letter is checked against a brute-force filter (all 1,005 words, one state)', () => {
    const g = start();
    for (const w of WORDS) {
      const ok = w.startsWith('e') && !g.words.includes(w);
      expect(why(g, w) === 'ok', w).toBe(ok);
    }
  });
  it('ends the chain with "cpu-stuck" when no unused word is left for the computer', () => {
    // The only list word starting with x is xylophone. Once it is used, a word that ends in x leaves nothing.
    const g: Game = { level: 'medium', words: ['xylophone', 'tub'], by: ['you', 'cpu'], hints: 0, over: null };
    const r = playerMove(g, 'box');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.over).toBe('cpu-stuck');
    expect(endText('cpu-stuck')).toMatch(/win/i);
    // Before xylophone is used the computer can answer with it.
    const g2: Game = { level: 'medium', words: ['tub'], by: ['cpu'], hints: 0, over: null };
    const r2 = playerMove(g2, 'box');
    expect(r2.ok && r2.game.over).toBeNull();
    if (r2.ok) {
      const c = cpuMove(r2.game, mulberry32(1));
      expect(c.words[c.words.length - 1]).toBe('xylophone');
    }
  });
  it('refusal texts are plain, never contain typed text, and name the needed letter', () => {
    for (const r of ['over', 'empty', 'wrong-start', 'not-a-word', 'used', 'not-your-turn'] as const) {
      const t = refusalText(r, 'e');
      expect(t.length).toBeGreaterThan(8);
      expect(t.includes('—')).toBe(false);
    }
    expect(refusalText('wrong-start', 'e')).toContain('E');
    expect(refusalText('empty', 'q')).toContain('Q');
    for (const o of ['ended', 'cpu-stuck', 'no-words'] as const) expect(endText(o).length).toBeGreaterThan(8);
  });
  it('normalise keeps letters only, lower case, capped', () => {
    expect(normalise(' Egg! ')).toBe('egg');
    expect(normalise('a'.repeat(100)).length).toBe(24);
    for (const bad of [null, undefined, 5, {}, [], true]) expect(normalise(bad)).toBe('');
  });
});

describe('the computer', () => {
  it('only says a listed, unused word that starts with the right letter, and never leaves you without a word unless it had no choice (2,000 random mid-game states)', () => {
    const rng = mulberry32(2024);
    let forced = 0;
    for (let t = 0; t < 2000; t++) {
      const level = LEVELS[t % 3];
      let g = newGame(level, rng);
      const turns = Math.floor(rng() * 60);
      for (let k = 0; k < turns && !g.over; k++) {
        const w = pickRandomUnused(g, rng)!;
        const r = playerMove(g, w);
        if (!r.ok) throw new Error(r.reason);
        g = r.game;
        if (g.over) break;
        g = cpuMove(g, rng);
      }
      if (g.over) continue;
      // g: it is the player's turn. Make a player move that is not final, then check the computer's reply.
      const w = pickRandomUnused(g, rng);
      if (w === null) continue;
      const r = playerMove(g, w);
      if (!r.ok || r.game.over) continue;
      const before = r.game;
      const need = required(before);
      const opts = brute(before, need);
      const after = cpuMove(before, rng);
      const said = after.words[after.words.length - 1];
      expect(after.by[after.by.length - 1]).toBe('cpu');
      expect(after.words.length).toBe(before.words.length + 1);
      expect(said.startsWith(need)).toBe(true);
      expect(isListed(said)).toBe(true);
      expect(before.words.includes(said)).toBe(false);
      expect(opts.includes(said)).toBe(true);
      // Room left for you after this word, by brute force.
      const roomOf = (word: string): number => brute({ ...before, words: [...before.words, word] }, lastLetter(word)).length;
      const anyRoom = opts.some((o) => roomOf(o) >= 1);
      if (anyRoom) expect(roomOf(said), `${level}: ${said}`).toBeGreaterThanOrEqual(1);
      else { forced++; expect(after.over).toBe('no-words'); }
      if (roomOf(said) === 0) expect(after.over).toBe('no-words'); else expect(after.over).toBeNull();
    }
    expect(forced).toBeGreaterThanOrEqual(0);
  });
  it('Gentle prefers a short word that leaves you at least 8 choices; Tricky leaves you the fewest; Normal avoids dead ends', () => {
    const rng = mulberry32(77);
    let gentleChecked = 0, trickyChecked = 0;
    for (let t = 0; t < 1000; t++) {
      let g = newGame('medium', rng);
      const turns = Math.floor(rng() * 40);
      for (let k = 0; k < turns && !g.over; k++) {
        const w = pickRandomUnused(g, rng)!;
        const r = playerMove(g, w);
        if (!r.ok) throw new Error(r.reason);
        g = r.game;
        if (g.over) break;
        g = cpuMove(g, rng);
      }
      if (g.over) continue;
      const r = playerMove(g, pickRandomUnused(g, rng)!);
      if (!r.ok || r.game.over) continue;
      const base = r.game;
      const opts = brute(base, required(base));
      const roomOf = (word: string): number => brute({ ...base, words: [...base.words, word] }, lastLetter(word)).length;
      // Gentle
      const easy = cpuChoice({ ...base, level: 'easy' }, rng)!;
      const shortRoomy = opts.filter((o) => o.length <= 6 && roomOf(o) >= 8);
      const roomy = opts.filter((o) => roomOf(o) >= 8);
      if (shortRoomy.length) { expect(shortRoomy.includes(easy), easy).toBe(true); gentleChecked++; }
      else if (roomy.length) expect(roomy.includes(easy), easy).toBe(true);
      // Tricky: minimal positive room
      const hard = cpuChoice({ ...base, level: 'hard' }, rng)!;
      const positive = opts.map(roomOf).filter((n) => n >= 1);
      if (positive.length) { expect(roomOf(hard)).toBe(Math.min(...positive)); trickyChecked++; }
      // Normal
      const med = cpuChoice({ ...base, level: 'medium' }, rng)!;
      expect(opts.includes(med)).toBe(true);
      if (positive.length) expect(roomOf(med)).toBeGreaterThanOrEqual(1);
    }
    expect(gentleChecked).toBeGreaterThan(150);
    expect(trickyChecked).toBeGreaterThan(150);
  });
  it('on average Tricky leaves you fewer choices than Normal, and Normal fewer than Gentle', () => {
    const avg = (level: Level): number => {
      const rng = mulberry32(5);
      let sum = 0, n = 0;
      for (let t = 0; t < 600; t++) {
        let g = newGame(level, rng);
        const turns = 1 + Math.floor(rng() * 25);
        for (let k = 0; k < turns && !g.over; k++) {
          const w = pickRandomUnused(g, rng)!;
          const r = playerMove(g, w);
          if (!r.ok) throw new Error(r.reason);
          g = r.game;
          if (g.over) break;
          g = cpuMove(g, rng);
          if (!g.over) { sum += unusedStarting(g, required(g)).length; n++; }
        }
      }
      return sum / n;
    };
    const [easy, medium, hard] = [avg('easy'), avg('medium'), avg('hard')];
    expect(hard).toBeLessThan(medium);
    expect(medium).toBeLessThan(easy);
  });
  it('only moves on its own turn and returns the same object when ignored', () => {
    const g: Game = { level: 'medium', words: ['apple'], by: ['cpu'], hints: 0, over: null };
    expect(cpuMove(g, mulberry32(1))).toBe(g);
    const done: Game = { ...g, words: ['apple', 'egg'], by: ['cpu', 'you'], over: 'ended' };
    expect(cpuMove(done, mulberry32(1))).toBe(done);
  });
  it('a worst-case reply (the list nearly used up) is fast', () => {
    // Use up most of the list, then ask the computer for a word 200 times.
    const used = WORDS.filter((w) => !'aeiou'.includes(w[0]) || w.length > 7);
    const g: Game = { level: 'hard', words: [...used.slice(0, 700), 'apple'], by: [...used.slice(0, 700).map(() => 'you' as const), 'you'], hints: 0, over: null };
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) cpuChoice(g, mulberry32(i + 1));
    expect((performance.now() - t0) / 200).toBeLessThan(50);
  }, 30_000);
});

describe('whole games', () => {
  it('1,500 random games: every word links to the one before, nothing repeats, everything is listed, and the ending is true', () => {
    let totalLen = 0;
    const overs: Record<string, number> = { 'cpu-stuck': 0, 'no-words': 0 };
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 500; seed++) {
        const g = playOut(level, seed);
        expect(g.over, `${level} #${seed}`).not.toBeNull();
        expect(g.words.length).toBe(g.by.length);
        expect(new Set(g.words).size).toBe(g.words.length);
        for (let i = 0; i < g.words.length; i++) {
          expect(isListed(g.words[i]), g.words[i]).toBe(true);
          expect(g.by[i]).toBe(i % 2 === 0 ? 'cpu' : 'you');
          if (i > 0) expect(g.words[i][0]).toBe(lastLetter(g.words[i - 1]));
        }
        // The ending is true: nothing unused is left for whoever was to speak next.
        const left = brute(g, required(g));
        if (g.over === 'cpu-stuck') { expect(g.by[g.by.length - 1]).toBe('you'); expect(left).toEqual([]); }
        else if (g.over === 'no-words') { expect(g.by[g.by.length - 1]).toBe('cpu'); expect(left).toEqual([]); }
        else throw new Error(`unexpected ending ${String(g.over)}`);
        overs[g.over]++;
        totalLen += g.words.length;
      }
    }
    expect(totalLen / 1500).toBeGreaterThan(10);
    expect(overs['cpu-stuck'] + overs['no-words']).toBe(1500);
  }, 240_000);
  it('the same seed and the same words give the same chain', () => {
    for (const level of LEVELS) {
      expect(playOut(level, 99)).toEqual(playOut(level, 99));
      expect(playOut(level, 99)).not.toEqual(playOut(level, 100));
    }
  });
  it('endChain stops a chain and is idempotent; scores count your own words', () => {
    let g = newGame('medium', mulberry32(3));
    expect(yourWords(g)).toBe(0);
    expect(totalWords(g)).toBe(1);
    const r = playerMove(g, pickRandomUnused(g, mulberry32(1))!);
    if (!r.ok) throw new Error(r.reason);
    g = r.game;
    expect(yourWords(g)).toBe(1);
    const e = endChain(g);
    expect(e.over).toBe('ended');
    expect(endChain(e)).toBe(e);
    const nope = playerMove(e, 'anything');
    expect(nope.ok).toBe(false);
  });
});

describe('hints', () => {
  it('a hint is an unused word with the right first letter, and counts', () => {
    for (let s = 1; s <= 200; s++) {
      const g = newGame(LEVELS[s % 3], mulberry32(s));
      const h = hint(g, mulberry32(s + 1))!;
      expect(h).not.toBeNull();
      expect(isListed(h.word)).toBe(true);
      expect(h.word.startsWith(required(g))).toBe(true);
      expect(g.words.includes(h.word)).toBe(false);
      expect(h.game.hints).toBe(1);
      expect(g.hints).toBe(0);
      // And the hinted word is accepted.
      expect(playerMove(h.game, h.word).ok).toBe(true);
    }
  });
  it('no hint when the chain is over or it is not your turn', () => {
    const g = newGame('medium', mulberry32(2));
    expect(hint(endChain(g), mulberry32(1))).toBeNull();
    const r = playerMove(g, hint(g, mulberry32(1))!.word);
    if (!r.ok) throw new Error(r.reason);
    expect(hint(r.game, mulberry32(1))).toBeNull();
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
  it('sanitiseLevel falls back to medium', () => {
    expect(sanitiseLevel('hard')).toBe('hard');
    for (const bad of ['', 'HARD', '__proto__', 5, null, undefined, [], {}]) expect(sanitiseLevel(bad)).toBe('medium');
  });
  it('sanitiseBest keeps whole numbers 1 to 9,999 for the three level names only and returns a fresh object', () => {
    expect(sanitiseBest({ easy: 3, medium: 9999, hard: 1 })).toEqual({ easy: 3, medium: 9999, hard: 1 });
    expect(sanitiseBest({ easy: 0, medium: -3, hard: 1.5 })).toEqual({});
    expect(sanitiseBest({ easy: NaN, medium: Infinity, hard: 10000 })).toEqual({});
    expect(sanitiseBest({ easy: '5', medium: true, hard: [5] })).toEqual({});
    expect(sanitiseBest({ x: 5, easy: 2 })).toEqual({ easy: 2 });
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"easy": 5}, "constructor": 3}'));
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    const raw = { easy: 4 };
    expect(sanitiseBest(raw)).not.toBe(raw);
  });
  it('plural and pickIndex behave', () => {
    expect(plural(1, 'word')).toBe('1 word');
    expect(plural(0, 'word')).toBe('0 words');
    expect(pickIndex(5, () => 0.999999)).toBe(4);
    expect(pickIndex(5, () => NaN)).toBe(0);
  });
});

describe('the page', () => {
  it('announces results, keeps scores under the right key and uses the shell events', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/gk:game:word-chain/);
    expect(calculatorSource).toMatch(/_wchnInit/);
    expect(calculatorSource).toMatch(/id="wchn-app"/);
  });
});
