/**
 * games-yacht-dice.test.ts - the engine behind `yacht-dice`.
 *
 * Pinned: the scorer for all 12 rows, checked against an independent brute-force table built over
 * all 7,776 ordered rolls of five dice with a differently written scorer (string patterns and a
 * run-of-faces test); the best possible card (317); the upper bonus (35 at 63); the scorecard rules
 * (a row is written once, junk dice are refused); the hold analysis (all 32 hold sets, checked against
 * a naive enumeration of every ordered re-roll, one roll left and two rolls left); the three computer
 * levels (they rank Hard > Medium > Easy on average score); whole games always finish with full
 * cards; the stored best scores (sanitised), the URL parsing and the text.
 */
import { describe, it, expect } from 'vitest';
import {
  CATS, CAT_LABEL, CAT_HELP, BONUS, BONUS_AT, MAX_TOTAL, PAR, UPPER_WEIGHT, DIE_PIPS, LEVELS, mulberry32, rollDie, rollDice, isValidDice,
  countFaces, scoreCat, newCard, openCats, isFull, filledCount, upperTotal, upperBonus, totalOf, writeScore, holdOptions, bestCat,
  parValue, rawValue, maskToHeld, heldToMask, easyHold, computerTurn, applyComputerTurn, playGame, winners, sanitizeStore,
  recordGame, parseSetup, plural, joinList, playerName, heldText, resultSentence, shareText, type Cat, type Card, type Level,
} from '../src/components/apps-private/yacht-dice/helpers';
import calculatorSource from '../src/components/apps-private/yacht-dice/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');

// ── Independent oracle: every ordered roll, scored a different way ───────────

const ALL_ROLLS: number[][] = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 6; d++) for (let e = 1; e <= 6; e++) ALL_ROLLS.push([a, b, c, d, e]);

const oracle = (cat: Cat, dice: number[]): number => {
  const sorted = [...dice].sort((x, y) => x - y);
  const text = sorted.join('');
  const sum = sorted.reduce((x, y) => x + y, 0);
  const faces = [...new Set(sorted)].join('');
  const pattern = [...new Set(sorted)].map((f) => sorted.filter((d) => d === f).length).sort().join('');
  const upper: Record<string, number> = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
  if (cat in upper) return sorted.filter((d) => d === upper[cat]).length * upper[cat];
  switch (cat) {
    case 'choice': return sum;
    case 'four': {
      const m = text.match(/(\d)\1\1\1/);
      return m ? 4 * Number(m[1]) : 0;
    }
    case 'house': return pattern === '23' ? sum : 0;
    case 'small': return /1234|2345|3456/.test(faces) ? 15 : 0;
    case 'large': return faces === '12345' || faces === '23456' ? 30 : 0;
    case 'yacht': return pattern === '5' ? 50 : 0;
  }
  return 0;
};

describe('the scorer', () => {
  it('matches an independent brute-force table for all 7,776 rolls and all 12 rows', () => {
    expect(ALL_ROLLS).toHaveLength(7776);
    for (const dice of ALL_ROLLS) {
      for (const cat of CATS) {
        if (scoreCat(cat, dice) !== oracle(cat, dice)) throw new Error(`${cat} ${dice.join('')}: ${scoreCat(cat, dice)} vs ${oracle(cat, dice)}`);
      }
    }
  });
  it('scores the same however the dice are ordered', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const dice = ALL_ROLLS[Math.floor(rng() * ALL_ROLLS.length)];
      const shuffled = [...dice].sort(() => rng() - 0.5);
      for (const cat of CATS) expect(scoreCat(cat, shuffled)).toBe(scoreCat(cat, dice));
    }
  });
  it('pins hand-checked examples', () => {
    expect(scoreCat('fives', [5, 5, 2, 5, 1])).toBe(15);
    expect(scoreCat('choice', [6, 6, 6, 6, 6])).toBe(30);
    expect(scoreCat('four', [3, 3, 3, 3, 6])).toBe(12);
    expect(scoreCat('four', [6, 6, 6, 6, 6])).toBe(24);
    expect(scoreCat('four', [3, 3, 3, 6, 6])).toBe(0);
    expect(scoreCat('house', [2, 2, 5, 5, 5])).toBe(19);
    expect(scoreCat('house', [4, 4, 4, 4, 4])).toBe(0);
    expect(scoreCat('house', [1, 1, 2, 2, 3])).toBe(0);
    expect(scoreCat('small', [1, 2, 3, 4, 6])).toBe(15);
    expect(scoreCat('small', [2, 3, 4, 4, 5])).toBe(15);
    expect(scoreCat('small', [1, 2, 3, 5, 6])).toBe(0);
    expect(scoreCat('large', [2, 3, 4, 5, 6])).toBe(30);
    expect(scoreCat('large', [1, 2, 3, 4, 6])).toBe(0);
    expect(scoreCat('yacht', [4, 4, 4, 4, 4])).toBe(50);
    expect(scoreCat('yacht', [4, 4, 4, 4, 3])).toBe(0);
  });
  it('counts the rolls that earn the big rows', () => {
    const n = (cat: Cat) => ALL_ROLLS.filter((d) => scoreCat(cat, d) > 0).length;
    expect(n('yacht')).toBe(6);
    expect(n('large')).toBe(240);
    expect(n('house')).toBe(300);
  });
  it('gives each row its best score, adding up to 317 with the bonus', () => {
    const best = (cat: Cat) => Math.max(...ALL_ROLLS.map((d) => scoreCat(cat, d)));
    const per = Object.fromEntries(CATS.map((c) => [c, best(c)]));
    expect(per).toEqual({ ones: 5, twos: 10, threes: 15, fours: 20, fives: 25, sixes: 30, choice: 30, four: 24, house: 28, small: 15, large: 30, yacht: 50 });
    expect(CATS.reduce((a, c) => a + per[c], 0) + BONUS).toBe(MAX_TOTAL);
    expect(MAX_TOTAL).toBe(317);
  });
  it('scores 0 for junk dice', () => {
    for (const bad of [[], [1, 2, 3], [1, 2, 3, 4, 7], [0, 1, 2, 3, 4], [1, 2, 3, 4, 5, 6], [1.5, 2, 3, 4, 5], [NaN, 1, 1, 1, 1]]) {
      for (const cat of CATS) expect(scoreCat(cat, bad), `${cat} ${bad}`).toBe(0);
      expect(isValidDice(bad)).toBe(false);
    }
    expect(isValidDice([1, 2, 3, 4, 5])).toBe(true);
  });
  it('counts faces', () => {
    expect(countFaces([1, 1, 3, 6, 6])).toEqual([0, 2, 0, 1, 0, 0, 2]);
  });
  it('has a name and a help line for every row and a die face for 1 to 6', () => {
    for (const c of CATS) { expect(CAT_LABEL[c].length).toBeGreaterThan(2); expect(CAT_HELP[c].length).toBeGreaterThan(5); }
    for (let v = 1; v <= 6; v++) expect(DIE_PIPS[v]).toHaveLength(v);
  });
});

describe('the dice', () => {
  it('maps the unit interval onto 1 to 6 and survives a broken generator', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.99999)).toBe(6);
    expect(rollDie(() => NaN)).toBe(1);
    expect(rollDie(() => -1)).toBe(1);
    expect(rollDie(() => 5)).toBe(6);
  });
  it('is close to fair over a long seeded run', () => {
    const rng = mulberry32(2);
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i++) c[rollDie(rng)]++;
    for (let f = 1; f <= 6; f++) expect(Math.abs(c[f] / 60000 - 1 / 6)).toBeLessThan(0.01);
  });
  it('keeps held dice, re-rolls the rest, and never changes its input', () => {
    const dice = [1, 2, 3, 4, 5];
    const held = [true, false, true, false, false];
    const rng = mulberry32(8);
    const out = rollDice(dice, held, rng);
    expect(out[0]).toBe(1);
    expect(out[2]).toBe(3);
    expect(dice).toEqual([1, 2, 3, 4, 5]);
    expect(isValidDice(out)).toBe(true);
    // A "held" die with a junk value is rolled instead of kept.
    expect(isValidDice(rollDice([9, 0, 3, 4, 5], [true, true, false, false, false], rng))).toBe(true);
  });
  it('converts between hold sets and masks', () => {
    for (let m = 0; m < 32; m++) expect(heldToMask(maskToHeld(m))).toBe(m);
    expect(maskToHeld(5)).toEqual([true, false, true, false, false]);
  });
});

describe('the scorecard', () => {
  it('starts empty and totals zero', () => {
    const c = newCard();
    expect(c).toHaveLength(12);
    expect(openCats(c)).toEqual([...CATS]);
    expect(totalOf(c)).toBe(0);
    expect(isFull(c)).toBe(false);
  });
  it('writes a row once and refuses a second write, junk dice and a made-up row', () => {
    const c = newCard();
    const a = writeScore(c, 'sixes', [6, 6, 6, 1, 2]) as Card;
    expect(a[5]).toBe(18);
    expect(c[5]).toBeNull();
    expect(writeScore(a, 'sixes', [6, 6, 6, 6, 6])).toBeNull();
    expect(writeScore(c, 'sixes', [6, 6, 6])).toBeNull();
    expect(writeScore(c, 'nope' as Cat, [1, 1, 1, 1, 1])).toBeNull();
    expect(filledCount(a)).toBe(1);
  });
  it('writes a zero when the dice do not fit the row, and the row is then used up', () => {
    const a = writeScore(newCard(), 'yacht', [1, 2, 3, 4, 6]) as Card;
    expect(a[11]).toBe(0);
    expect(openCats(a)).not.toContain('yacht');
  });
  it('gives the 35 bonus at exactly 63 in the upper rows and not at 62', () => {
    const upper = (v: number[]): Card => [...v, null, null, null, null, null, null];
    expect(BONUS_AT).toBe(63);
    expect(upperTotal(upper([3, 6, 9, 12, 15, 18]))).toBe(63);
    expect(upperBonus(upper([3, 6, 9, 12, 15, 18]))).toBe(35);
    expect(upperBonus(upper([3, 6, 9, 12, 15, 17]))).toBe(0);
    expect(totalOf(upper([3, 6, 9, 12, 15, 18]))).toBe(63 + 35);
    expect(totalOf(upper([3, 6, 9, 12, 15, 17]))).toBe(62);
    // An unfinished upper section never earns the bonus early unless the points are already there.
    expect(upperBonus(upper([5, 10, 15, 20, 25, 30]))).toBe(35);
  });
});

// ── Hold analysis against a naive enumeration ────────────────────────────────

/** Average value of keeping the masked dice with `rollsLeft` more rolls, by enumerating every ordered re-roll. */
const naiveEv = (dice: number[], mask: number, rollsLeft: number, open: Cat[], value: (c: Cat, d: number[]) => number): number => {
  const free: number[] = [];
  for (let i = 0; i < 5; i++) if (!(mask & (1 << i))) free.push(i);
  const total = 6 ** free.length;
  let sum = 0;
  for (let n = 0; n < total; n++) {
    const d = dice.slice();
    let x = n;
    for (const i of free) { d[i] = (x % 6) + 1; x = Math.floor(x / 6); }
    if (rollsLeft === 1) {
      sum += Math.max(...open.map((c) => value(c, d)));
    } else {
      let best = -Infinity;
      for (let m = 0; m < 32; m++) best = Math.max(best, naiveEv(d, m, 1, open, value));
      sum += best;
    }
  }
  return sum / total;
};

describe('the hold analysis', () => {
  const pick = (rng: () => number, k: number): Cat[] => {
    const pool = [...CATS];
    const out: Cat[] = [];
    while (out.length < k) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  };

  it('has probabilities that add up to one for every hold set', () => {
    const rng = mulberry32(12);
    for (let i = 0; i < 20; i++) {
      const dice = Array.from({ length: 5 }, () => rollDie(rng));
      for (const rollsLeft of [1, 2] as const) {
        const opts = holdOptions(dice, rollsLeft, ['yacht'], () => 1);
        expect(opts).toHaveLength(32);
        for (const o of opts) expect(o.ev).toBeCloseTo(1, 9);
      }
    }
  });

  it('matches a naive enumeration of every ordered re-roll with one roll left, for all 32 hold sets', () => {
    const rng = mulberry32(55);
    for (let i = 0; i < 12; i++) {
      const dice = Array.from({ length: 5 }, () => rollDie(rng));
      const open = pick(rng, 1 + Math.floor(rng() * 12));
      for (const [name, value] of [['par', parValue], ['raw', rawValue]] as const) {
        const opts = holdOptions(dice, 1, open, value);
        for (const o of opts) expect(o.ev, `${name} ${dice} mask ${o.mask}`).toBeCloseTo(naiveEv(dice, o.mask, 1, open, value), 8);
      }
    }
  }, 120_000);

  it('matches a naive enumeration with two rolls left (cases that keep three or more dice, to keep the search small)', () => {
    const rng = mulberry32(77);
    let checked = 0;
    for (let i = 0; i < 4; i++) {
      const dice = Array.from({ length: 5 }, () => rollDie(rng));
      const open = pick(rng, 3 + Math.floor(rng() * 5));
      const opts = holdOptions(dice, 2, open, parValue);
      const keepers = opts.filter((o) => maskToHeld(o.mask).filter(Boolean).length >= 4).slice(0, 2);
      for (const o of keepers) {
        expect(o.ev, `${dice} mask ${o.mask}`).toBeCloseTo(naiveEv(dice, o.mask, 2, open, parValue), 7);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  }, 240_000);

  it('lists the best hold first, ties broken toward keeping more dice, and is never empty for a valid turn', () => {
    const opts = holdOptions([6, 6, 6, 6, 6], 2, ['yacht', 'choice']);
    expect(opts[0].mask).toBe(31);
    for (let i = 1; i < opts.length; i++) expect(opts[i - 1].ev).toBeGreaterThanOrEqual(opts[i].ev - 1e-9);
    expect(holdOptions([1, 2, 3, 4], 2, ['yacht'])).toEqual([]);
    expect(holdOptions([1, 2, 3, 4, 5], 2, [])).toEqual([]);
  });

  it('keeps the made straight and the made full house, and chases the yacht from four of a kind', () => {
    expect(holdOptions([2, 3, 4, 5, 6], 2, ['large', 'yacht'], rawValue)[0].mask).toBe(31);
    expect(holdOptions([3, 3, 3, 5, 5], 1, ['house'], rawValue)[0].mask).toBe(31);
    const four = holdOptions([4, 4, 4, 4, 1], 2, ['yacht'], rawValue)[0];
    expect(four.mask).toBe(0b01111);
  });

  it('picks the highest-value row, preferring the cheaper row on a tie', () => {
    expect(bestCat([5, 5, 5, 5, 5], [...CATS], rawValue)).toBe('yacht');
    expect(bestCat([1, 2, 3, 4, 5], ['ones', 'choice', 'small', 'large'], rawValue)).toBe('large');
    expect(bestCat([1, 1, 1, 1, 1], [], rawValue)).toBeNull();
    // Scoring zero everywhere: the row that is usually worth the least is used up first.
    expect(bestCat([1, 2, 3, 4, 6], ['yacht', 'house', 'large'], rawValue)).toBe('yacht');
    expect(PAR.yacht).toBeLessThan(PAR.large);
  });

  it('weights the upper rows so a spare six is worth more than a spare face value', () => {
    expect(UPPER_WEIGHT).toBe(1.5);
    expect(parValue('sixes', [6, 6, 6, 6, 1])).toBeCloseTo(1.5 * (24 - 18), 9);
    expect(parValue('choice', [6, 6, 6, 6, 1])).toBeCloseTo(25 - 22.5, 9);
  });
});

describe('the computer players', () => {
  const mean = (level: Level, n: number, seed: number) => {
    const rng = mulberry32(seed);
    let t = 0;
    for (let i = 0; i < n; i++) t += playGame([level], rng).totals[0];
    return t / n;
  };

  it('plays legal turns: at most three rolls, held dice stay, the row is open, the score is right', () => {
    const rng = mulberry32(21);
    for (const level of LEVELS) {
      let card = newCard();
      for (let turn = 0; turn < 12; turn++) {
        const t = computerTurn(level, card, rng);
        expect(t).not.toBeNull();
        const turnData = t as NonNullable<typeof t>;
        expect(turnData.steps.length).toBeGreaterThanOrEqual(1);
        expect(turnData.steps.length).toBeLessThanOrEqual(3);
        for (let s = 1; s < turnData.steps.length; s++) {
          const prev = turnData.steps[s - 1];
          for (let i = 0; i < 5; i++) if (prev.held[i]) expect(turnData.steps[s].dice[i]).toBe(prev.dice[i]);
        }
        for (const st of turnData.steps) expect(isValidDice(st.dice)).toBe(true);
        expect(openCats(card)).toContain(turnData.cat);
        const last = turnData.steps[turnData.steps.length - 1];
        expect(turnData.score).toBe(scoreCat(turnData.cat, last.dice));
        card = applyComputerTurn(card, turnData);
        expect(filledCount(card)).toBe(turn + 1);
      }
      expect(isFull(card)).toBe(true);
      expect(computerTurn(level, card, rng)).toBeNull();
    }
  }, 60_000);

  it('Easy keeps the most common face, higher face on a tie', () => {
    expect(easyHold([3, 3, 5, 1, 2])).toBe(0b00011);
    expect(easyHold([2, 2, 6, 6, 1])).toBe(0b01100);
    expect(easyHold([1, 2, 3, 4, 5])).toBe(0b10000);
  });

  it('ranks Hard above Medium above Easy on average score', () => {
    const easy = mean('easy', 150, 9);
    const medium = mean('medium', 100, 9);
    const hard = mean('hard', 100, 9);
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
    expect(easy).toBeGreaterThan(70);
    expect(hard).toBeGreaterThan(150);
    expect(hard).toBeLessThan(MAX_TOTAL);
  }, 240_000);

  it('plays whole multi-player games to the end: every card full, totals within bounds, a winner exists', () => {
    const rng = mulberry32(404);
    for (let g = 0; g < 60; g++) {
      const levels: Level[] = [LEVELS[g % 3], LEVELS[(g + 1) % 3], 'hard', 'easy'].slice(0, 1 + (g % 4)) as Level[];
      const { cards, totals } = playGame(levels, rng);
      cards.forEach((c, i) => {
        expect(isFull(c)).toBe(true);
        expect(totals[i]).toBe(totalOf(c));
        expect(totals[i]).toBeGreaterThanOrEqual(0);
        expect(totals[i]).toBeLessThanOrEqual(MAX_TOTAL);
      });
      expect(winners(totals).length).toBeGreaterThanOrEqual(1);
    }
  }, 120_000);

  it('is deterministic for a seed', () => {
    const a = playGame(['hard', 'medium'], mulberry32(5));
    const b = playGame(['hard', 'medium'], mulberry32(5));
    expect(a.totals).toEqual(b.totals);
  }, 60_000);

  it('survives a broken generator', () => {
    expect(() => playGame(['easy', 'medium'], () => NaN)).not.toThrow();
  }, 60_000);
});

describe('winners and text', () => {
  it('finds the top total, shared on a tie', () => {
    expect(winners([100, 120, 90])).toEqual([1]);
    expect(winners([100, 100, 90])).toEqual([0, 1]);
    expect(winners([])).toEqual([]);
  });
  it('words results, plurals and holds', () => {
    expect(plural(1, 'row')).toBe('1 row');
    expect(plural(3, 'row')).toBe('3 rows');
    expect(joinList([4, 4])).toBe('4 and 4');
    expect(playerName(0)).toBe('You');
    expect(playerName(2)).toBe('Computer 2');
    expect(heldText([1, 2, 3, 4, 5], 0)).toBe('rolls all five again');
    expect(heldText([1, 2, 3, 4, 5], 31)).toBe('keeps all five');
    expect(heldText([4, 4, 1, 2, 3], 0b00011)).toBe('keeps 4 and 4 and rolls 3 dice');
    expect(heldText([4, 4, 4, 4, 3], 0b01111)).toBe('keeps 4, 4, 4 and 4 and rolls 1 die');
    expect(resultSentence([200])).toBe('You scored 200.');
    expect(resultSentence([200, 150])).toBe('You win! You 200, Computer 1 150.');
    expect(resultSentence([150, 200])).toBe('Computer 1 wins! You 150, Computer 1 200.');
    expect(resultSentence([150, 150])).toBe('A tie between You and Computer 1 at 150. You 150, Computer 1 150.');
    expect(shareText({ computers: 0, level: 'hard', seed: 3 }, [200], true)).toBe('Yacht Dice (solo), game #3: You scored 200.');
    expect(shareText({ computers: 2, level: 'easy', seed: 3 }, [200], false)).toBe('Yacht Dice (2 computers, Easy), game #3: game in progress');
  });
});

describe('stored results', () => {
  it('reads junk safely', () => {
    const empty = { b: 0, n: 0, w: 0, y: 0 };
    expect(sanitizeStore(null)).toEqual(empty);
    expect(sanitizeStore('x')).toEqual(empty);
    expect(sanitizeStore([1])).toEqual(empty);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"b":5},"b":999,"n":1.5,"w":"2","y":-1}'))).toEqual(empty);
    const ok = sanitizeStore({ b: 250, n: 9, w: 4, y: 2, extra: 1 });
    expect(ok).toEqual({ b: 250, n: 9, w: 4, y: 2 });
    expect(Object.keys(ok).sort()).toEqual(['b', 'n', 'w', 'y']);
    expect(sanitizeStore({ n: 2, w: 8 }).w).toBe(2);
  });
  it('records a game, a best only without a hint, and a win only against computers', () => {
    const s = sanitizeStore(null);
    let r = recordGame(s, 180, true, true, 0, false);
    expect(r.record).toBe(true);
    expect(r.store).toEqual({ b: 180, n: 1, w: 1, y: 0 });
    r = recordGame(r.store, 170, false, true, 1, false);
    expect(r.record).toBe(false);
    expect(r.store).toEqual({ b: 180, n: 2, w: 1, y: 1 });
    r = recordGame(r.store, 300, true, true, 1, true);
    expect(r.record).toBe(false);
    expect(r.store.b).toBe(180);
    expect(r.store.w).toBe(1);
    r = recordGame(r.store, 200, true, false, 0, false);
    expect(r.store.w).toBe(1);
    expect(r.store.b).toBe(200);
    expect(recordGame(s, 999, true, true, 0, false).store).toBe(s);
    expect(recordGame(s, NaN, true, true, 0, false).store).toBe(s);
  });
  it('clamps junk URL parameters', () => {
    expect(parseSetup({}, 9)).toEqual({ computers: 1, level: 'medium', seed: 9 });
    expect(parseSetup({ c: '3', l: 'hard', s: '77' }, 1)).toEqual({ computers: 3, level: 'hard', seed: 77 });
    expect(parseSetup({ c: 0 }, 1).computers).toBe(0);
    for (const c of ['4', '-1', '1.5', 'x', '', 'Infinity']) expect(parseSetup({ c }, 1).computers, c).toBe(1);
    for (const s of ['0', '-3', 'abc', '4294967296', '1.5', '']) expect(parseSetup({ s }, 5).seed, s).toBe(5);
    expect(parseSetup({ l: 'extreme' }, 1).level).toBe('medium');
  });
});

describe('the page', () => {
  it('has the shell events, a live region, sound off by default and reduced motion', () => {
    expect(src).toMatch(/id="ycd-app"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/app:copy/);
    expect(src).toMatch(/app:export/);
    expect(src).toMatch(/app:reset/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/aria-pressed="false"/);
  });
});
