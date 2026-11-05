/**
 * games-make-ten.test.ts - the engine behind `make-ten`.
 *
 * Pinned: for every target (5, 10, 20, 100) the question number and the answer add
 * up to the target exactly, checked by a brute-force search over all pairs; exactly
 * one of the four choices makes the target and none of the others does; choices are
 * distinct, in range, ascending, and sit near the answer; Make 100 works in whole
 * tens; the ten-frame has as many given cells as the number shown (and a tried
 * number or the answer fills the empties, counted a second way); the Learn list
 * holds every bond once with the right sums; the same seed gives the same round and
 * a round never repeats the last number; the step-up ladder offers once after five
 * first-time answers and a Try again breaks the row; stored scores are sanitised;
 * the kind wording never scolds and states the real sum; and the page source has no
 * timers, no sound and 56 px targets.
 */
import { describe, it, expect } from 'vitest';
import {
  mulberry32, randInt, shuffled, TARGETS, TARGET_LABEL, isTarget, stepOf, addends, nextTarget, OBJECT_KINDS, OBJECT_EMOJI, OBJECT_ONE, OBJECT_MANY,
  CHOICES, makeOptions, makeRound, isCorrect, judge, FRAME_COLS, frameSize, buildFrame, frameLabel, allBonds, bondText, bondSpeech, STEP_UP_AT,
  newLadder, ladderAfterWrong, ladderAfterRight, wantsStepUp, ladderAfterOffer, ROW_SIZE, CAPS, emptySaved, sanitiseSaved, addStar, recordRight,
  questionText, praise, tryAgain, offerText, rowText, learnTitle, shareSummary, type Target, type Round,
} from '../src/components/apps-private/make-ten/helpers';
import calculatorSource from '../src/components/apps-private/make-ten/Calculator.astro?raw';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 4099 + 11);

/** Independent oracle: every pair (a, b) in 0..target whose sum is the target and that a child could be asked about. */
const bruteBonds = (t: Target): [number, number][] => {
  const step = t === 100 ? 10 : 1;
  const out: [number, number][] = [];
  for (let a = 0; a <= t; a++) for (let b = 0; b <= t; b++) if (a + b === t && a > 0 && b > 0 && a % step === 0 && b % step === 0) out.push([a, b]);
  return out;
};

describe('targets', () => {
  it('has the four targets the page names, in order, with labels', () => {
    expect(TARGETS).toEqual([5, 10, 20, 100]);
    expect(TARGETS.map((t) => TARGET_LABEL[t])).toEqual(['Make 5', 'Make 10', 'Make 20', 'Make 100']);
  });
  it('validates a target from the address bar', () => {
    for (const t of TARGETS) expect(isTarget(t)).toBe(true);
    for (const junk of [0, 1, 6, 50, 1000, 10.5, NaN, '10', null, undefined, [], {}, -10]) expect(isTarget(junk)).toBe(false);
  });
  it('works in ones, except Make 100 which works in whole tens', () => {
    expect(TARGETS.map(stepOf)).toEqual([1, 1, 1, 10]);
  });
  it('lists the numbers that can be one half of a bond (no zero, no whole target)', () => {
    expect(addends(5)).toEqual([1, 2, 3, 4]);
    expect(addends(10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(addends(20)).toHaveLength(19);
    expect(addends(100)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });
  it('steps 5 to 10 to 20 to 100 and stops', () => {
    expect(nextTarget(5)).toBe(10);
    expect(nextTarget(10)).toBe(20);
    expect(nextTarget(20)).toBe(100);
    expect(nextTarget(100)).toBeNull();
  });
});

describe('randomness helpers', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(9);
    const b = mulberry32(9);
    for (let i = 0; i < 200; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('randInt stays in bounds for a bad rng and shuffled keeps every element', () => {
    for (const bad of [NaN, Infinity, -Infinity, -3, 4]) {
      const v = randInt(() => bad, 1, 8);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(8);
    }
    const input = [1, 2, 3, 4, 5, 6];
    expect([...shuffled(input, mulberry32(2))].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('bond questions', () => {
  it('adds up exactly: the number shown and the answer make the target, for every target and seed', () => {
    for (const t of TARGETS) {
      const valid = new Set(bruteBonds(t).map(([a]) => a));
      for (const seed of SEEDS) {
        const r = makeRound(t, mulberry32(seed));
        expect(r.target).toBe(t);
        expect(r.a + r.answer, `${t} #${seed}`).toBe(t);
        expect(valid.has(r.a), `${t}: ${r.a} is a legal number to show`).toBe(true);
        expect(valid.has(r.answer)).toBe(true);
      }
    }
  });
  it('shows every legal number over many seeds, so no bond is never asked', () => {
    for (const t of TARGETS) {
      const seen = new Set<number>();
      for (const seed of SEEDS) seen.add(makeRound(t, mulberry32(seed)).a);
      expect([...seen].sort((x, y) => x - y), `${t}`).toEqual(addends(t));
    }
  });
  it('offers four choices (or every number when fewer exist) with exactly one that makes the target', () => {
    for (const t of TARGETS) {
      for (const seed of SEEDS) {
        const r = makeRound(t, mulberry32(seed));
        // Brute force: which choices complete the bond?
        const completing = r.options.filter((o) => r.a + o === t);
        expect(completing, `${t} #${seed}`).toEqual([r.answer]);
        expect(r.options).toHaveLength(Math.min(CHOICES, addends(t).length));
        expect(new Set(r.options).size).toBe(r.options.length);
        expect([...r.options].sort((x, y) => x - y)).toEqual(r.options);
        const legal = new Set(addends(t));
        for (const o of r.options) expect(legal.has(o)).toBe(true);
      }
    }
    expect(CHOICES).toBe(4);
  });
  it('keeps the other choices among the five numbers nearest the answer', () => {
    for (const t of [10, 20, 100] as Target[]) {
      for (const seed of SEEDS.slice(0, 150)) {
        const r = makeRound(t, mulberry32(seed));
        const s = stepOf(t);
        const nearest = addends(t)
          .filter((n) => n !== r.answer)
          .sort((x, y) => Math.abs(x - r.answer) - Math.abs(y - r.answer) || x - y)
          .slice(0, 5);
        for (const o of r.options) if (o !== r.answer) expect(nearest).toContain(o);
        expect(s).toBeGreaterThan(0);
      }
    }
  });
  it('gives every number 1 to 4 on Make 5', () => {
    for (const seed of SEEDS.slice(0, 40)) expect(makeRound(5, mulberry32(seed)).options).toEqual([1, 2, 3, 4]);
  });
  it('uses only multiples of ten on Make 100', () => {
    for (const seed of SEEDS) {
      const r = makeRound(100, mulberry32(seed));
      expect(r.a % 10).toBe(0);
      expect(r.answer % 10).toBe(0);
      for (const o of r.options) expect(o % 10).toBe(0);
    }
  });
  it('never shows the previous number again', () => {
    for (const t of TARGETS) {
      let prev = 0;
      const rng = mulberry32(5);
      for (let i = 0; i < 600; i++) {
        const r = makeRound(t, rng, prev);
        expect(r.a, `${t} round ${i}`).not.toBe(prev);
        prev = r.a;
      }
    }
  });
  it('accepts exactly the number that completes the bond', () => {
    for (const t of TARGETS) {
      for (const seed of SEEDS.slice(0, 40)) {
        const r = makeRound(t, mulberry32(seed));
        for (let c = -3; c <= t + 3; c++) expect(isCorrect(r, c), `${t}: ${r.a}+${c}`).toBe(r.a + c === t);
        expect(isCorrect(r, NaN)).toBe(false);
        expect(isCorrect(r, '3' as unknown as number)).toBe(false);
      }
    }
  });
  it('is deterministic for a seed and picks an object to show', () => {
    for (const t of TARGETS) expect(makeRound(t, mulberry32(33))).toEqual(makeRound(t, mulberry32(33)));
    const seen = new Set<string>();
    for (const seed of SEEDS) seen.add(makeRound(10, mulberry32(seed)).object);
    expect([...seen].sort()).toEqual([...OBJECT_KINDS].sort());
    expect(new Set(Object.values(OBJECT_EMOJI)).size).toBe(OBJECT_KINDS.length);
    for (const k of OBJECT_KINDS) {
      expect(OBJECT_ONE[k].length).toBeGreaterThan(2);
      expect(OBJECT_MANY[k].length).toBeGreaterThan(2);
    }
  });
  it('survives a broken rng', () => {
    for (const bad of [NaN, Infinity, -1, 7]) {
      for (const t of TARGETS) {
        const r = makeRound(t, () => bad);
        expect(r.a + r.answer).toBe(t);
        expect(r.options).toContain(r.answer);
      }
    }
  });
  it('makeOptions copes with every answer', () => {
    for (const t of TARGETS) for (const ans of addends(t)) {
      const o = makeOptions(t, ans, mulberry32(ans));
      expect(o.filter((x) => x === ans)).toHaveLength(1);
      expect(o.filter((x) => x + (t - ans) === t)).toEqual([ans]);
    }
  });
  it('judges a try as short, exact or over', () => {
    expect(judge(7, 2, 10)).toBe('less');
    expect(judge(7, 3, 10)).toBe('exact');
    expect(judge(7, 5, 10)).toBe('more');
    expect(judge(70, 20, 100)).toBe('less');
    expect(judge(70, 30, 100)).toBe('exact');
  });
});

describe('the frame of counters', () => {
  const countState = (cells: string[], s: string) => cells.filter((c) => c === s).length;

  it('has 5, 10, 20 and 10 cells in 5 columns, and 1, 2, 4 and 2 rows', () => {
    expect(TARGETS.map(frameSize)).toEqual([5, 10, 20, 10]);
    expect(FRAME_COLS).toBe(5);
    expect(TARGETS.map((t) => buildFrame(t, addends(t)[0]).rows)).toEqual([1, 2, 4, 2]);
  });
  it('draws as many given cells as the number shown, in value, for every number', () => {
    for (const t of TARGETS) {
      for (const a of addends(t)) {
        const f = buildFrame(t, a);
        expect(f.cells).toHaveLength(frameSize(t));
        // Value of the given cells, counted independently of the engine's own division.
        let value = 0;
        for (const c of f.cells) if (c === 'given') value += f.perCell;
        expect(value, `${t}: ${a}`).toBe(a);
        expect(countState(f.cells, 'empty')).toBe(frameSize(t) - a / stepOf(t));
        expect(f.over).toBe(0);
        // Given cells come first.
        expect(f.cells.slice(0, a / stepOf(t)).every((c) => c === 'given')).toBe(true);
      }
    }
  });
  it('fills every empty cell once the bond is found, so the frame totals the target', () => {
    for (const t of TARGETS) {
      for (const a of addends(t)) {
        const f = buildFrame(t, a, { solved: true });
        expect(countState(f.cells, 'empty')).toBe(0);
        expect(countState(f.cells, 'chosen')).toBe(0);
        let total = 0;
        for (const c of f.cells) total += f.perCell; // every cell is given or filled
        expect(total).toBe(t);
        expect(countState(f.cells, 'filled') * f.perCell).toBe(t - a);
        expect(f.over).toBe(0);
      }
    }
  });
  it('shows a tried number in the empties and counts the spill when it is too many', () => {
    for (const t of TARGETS) {
      const s = stepOf(t);
      for (const a of addends(t)) {
        for (const tried of addends(t)) {
          const f = buildFrame(t, a, { chosen: tried });
          const empties = (t - a) / s;
          expect(countState(f.cells, 'chosen')).toBe(Math.min(tried / s, empties));
          expect(countState(f.cells, 'given')).toBe(a / s);
          expect(f.over).toBe(Math.max(0, tried / s - empties));
          // A try that is exactly the answer fills every empty and spills nothing.
          if (a + tried === t) {
            expect(countState(f.cells, 'empty')).toBe(0);
            expect(f.over).toBe(0);
          }
          expect(f.cells).toHaveLength(frameSize(t));
        }
      }
    }
  });
  it('clamps junk input instead of throwing', () => {
    expect(buildFrame(10, -5).cells.every((c) => c === 'empty')).toBe(true);
    expect(buildFrame(10, 500).cells.every((c) => c === 'given')).toBe(true);
    expect(buildFrame(10, 3, { chosen: NaN }).cells.filter((c) => c === 'chosen')).toHaveLength(0);
    expect(buildFrame(10, 3, { chosen: -4 }).cells.filter((c) => c === 'chosen')).toHaveLength(0);
  });
  it('describes the frame for a screen reader', () => {
    expect(frameLabel(10, 7, 'apple', false)).toBe('Frame of 10: 7 apples and 3 empty places.');
    expect(frameLabel(10, 1, 'fish', false)).toBe('Frame of 10: 1 fish and 9 empty places.');
    expect(frameLabel(5, 4, 'strawberry', false)).toBe('Frame of 5: 4 strawberries and 1 empty place.');
    expect(frameLabel(10, 7, 'apple', true)).toBe('Frame of 10: all 10 places are full.');
    expect(frameLabel(100, 70, 'apple', false)).toBe('Frame of 100 shown in tens: 7 of 10 tens are filled and 3 are empty.');
    expect(frameLabel(100, 70, 'apple', true)).toBe('Frame of 100 shown in tens: all 10 tens are filled.');
  });
});

describe('Learn: every bond', () => {
  it('lists each bond once, equal to a brute-force search, with the right sums', () => {
    for (const t of TARGETS) {
      const bonds = allBonds(t);
      expect(bonds.map((b) => [b.a, b.b])).toEqual(bruteBonds(t));
      for (const b of bonds) expect(b.a + b.b).toBe(t);
      expect(new Set(bonds.map((b) => b.a)).size).toBe(bonds.length);
    }
    expect(allBonds(5)).toHaveLength(4);
    expect(allBonds(10)).toHaveLength(9);
    expect(allBonds(20)).toHaveLength(19);
    expect(allBonds(100)).toHaveLength(9);
  });
  it('lists the reverse of every bond too, so 3 + 7 and 7 + 3 both appear', () => {
    for (const t of TARGETS) {
      const set = new Set(allBonds(t).map((b) => `${b.a},${b.b}`));
      for (const b of allBonds(t)) expect(set.has(`${b.b},${b.a}`)).toBe(true);
    }
  });
  it('writes each bond as an equation and as speech', () => {
    expect(bondText(3, 7, 10)).toBe('3 + 7 = 10');
    expect(bondSpeech(3, 7, 10)).toBe('3 plus 7 makes 10');
    expect(bondText(30, 70, 100)).toBe('30 + 70 = 100');
  });
  it('titles the list for each target', () => {
    expect(learnTitle(10)).toBe('All the ways to make 10');
    expect(learnTitle(100)).toBe('All the ways to make 100 in tens');
  });
  it('draws a strip per bond whose two parts add up to the target', () => {
    for (const t of TARGETS) {
      for (const b of allBonds(t)) {
        const f = buildFrame(t, b.a, { solved: true });
        expect(f.cells.filter((c) => c === 'given').length * f.perCell).toBe(b.a);
        expect(f.cells.filter((c) => c === 'filled').length * f.perCell).toBe(b.b);
      }
    }
  });
});

describe('the gentle step-up ladder', () => {
  it('counts only first-time answers and offers after exactly five', () => {
    let l = newLadder();
    for (let i = 1; i <= STEP_UP_AT; i++) {
      expect(wantsStepUp(l, 5)).toBe(false);
      l = ladderAfterRight(l, 'clean');
      expect(l.streak).toBe(i);
    }
    expect(STEP_UP_AT).toBe(5);
    expect(wantsStepUp(l, 5)).toBe(true);
    expect(wantsStepUp(l, 20)).toBe(true);
  });
  it('does not offer at the top level', () => {
    let l = newLadder();
    for (let i = 0; i < 8; i++) l = ladderAfterRight(l, 'clean');
    expect(wantsStepUp(l, 100)).toBe(false);
  });
  it('a second-try answer neither adds to the row nor breaks it', () => {
    const l = ladderAfterRight(ladderAfterRight(newLadder(), 'clean'), 'clean');
    expect(ladderAfterRight(l, 'retry').streak).toBe(2);
  });
  it('a Try again breaks the row, the offer is made once, and again after a new five', () => {
    let l = newLadder();
    for (let i = 0; i < 5; i++) l = ladderAfterRight(l, 'clean');
    l = ladderAfterOffer(l);
    expect(wantsStepUp(l, 5)).toBe(false);
    l = ladderAfterWrong(l);
    expect(l).toEqual(newLadder());
    for (let i = 0; i < 5; i++) l = ladderAfterRight(l, 'clean');
    expect(wantsStepUp(l, 5)).toBe(true);
  });
  it('words the offer with the next target, and nothing at the top', () => {
    expect(offerText(5)).toBe('5 in a row! Want to try Make 10?');
    expect(offerText(10)).toBe('5 in a row! Want to try Make 20?');
    expect(offerText(20)).toBe('5 in a row! Want to try Make 100?');
    expect(offerText(100)).toBe('');
  });
});

describe('the row of stars and stored totals', () => {
  it('has ten stars and never adds an eleventh', () => {
    expect(ROW_SIZE).toBe(10);
    let n = 0;
    for (let i = 1; i <= 10; i++) {
      n = addStar(n);
      expect(n).toBe(i);
    }
    expect(addStar(n)).toBe(10);
    expect(addStar(-1)).toBe(1);
    expect(addStar(NaN)).toBe(1);
  });
  it('records a bond, a full row and the best run', () => {
    let s = emptySaved();
    s = recordRight(s, 2, false);
    s = recordRight(s, 1, false);
    expect(s).toEqual({ bonds: 2, rows: 0, best: 2 });
    s = recordRight(s, 5, true);
    expect(s).toEqual({ bonds: 3, rows: 1, best: 5 });
  });
  it('caps every stored number', () => {
    expect(recordRight({ bonds: CAPS.bonds, rows: CAPS.rows, best: CAPS.best }, 9000, true)).toEqual({ bonds: CAPS.bonds, rows: CAPS.rows, best: CAPS.best });
  });
  it('sanitises stored data into a fresh, bounded object', () => {
    expect(sanitiseSaved({ bonds: 12, rows: 1, best: 7 })).toEqual({ bonds: 12, rows: 1, best: 7 });
    for (const junk of [null, undefined, [], 'x', 5, true]) expect(sanitiseSaved(junk)).toEqual(emptySaved());
    expect(sanitiseSaved({ bonds: -1, rows: 1.5, best: NaN })).toEqual(emptySaved());
    expect(sanitiseSaved({ bonds: '3', rows: null, best: {} })).toEqual(emptySaved());
    expect(sanitiseSaved({ bonds: 1e12, rows: 1e12, best: 1e12 })).toEqual({ bonds: CAPS.bonds, rows: CAPS.rows, best: CAPS.best });
    const evil = JSON.parse('{"__proto__": {"bonds": 9}, "bonds": 4, "extra": 1}');
    const out = sanitiseSaved(evil);
    expect(out).toEqual({ bonds: 4, rows: 0, best: 0 });
    expect(Object.keys(out).sort()).toEqual(['best', 'bonds', 'rows']);
  });
});

describe('the words', () => {
  const never = /\b(wrong|incorrect|fail|failed|failure|bad|mistake|error|lose|lost|game over|stupid|silly|no!)\b/i;
  const allText = (): string[] => {
    const out: string[] = [];
    for (const t of TARGETS) {
      out.push(offerText(t), learnTitle(t));
      for (const seed of SEEDS.slice(0, 40)) {
        const r: Round = makeRound(t, mulberry32(seed));
        out.push(questionText(r), praise(r));
        for (const c of addends(t)) out.push(tryAgain(r, c));
      }
      for (const b of allBonds(t)) out.push(bondText(b.a, b.b, t), bondSpeech(b.a, b.b, t));
    }
    for (let n = 0; n <= 10; n++) out.push(rowText(n));
    out.push(shareSummary(emptySaved()), shareSummary({ bonds: 1, rows: 0, best: 1 }), shareSummary({ bonds: 40, rows: 4, best: 7 }));
    return out;
  };
  it('never scolds, never has an em-dash', () => {
    for (const t of allText()) {
      expect(t, t).not.toMatch(never);
      expect(t.includes('—')).toBe(false);
    }
  });
  it('asks the question with the real numbers', () => {
    const r = makeRound(10, mulberry32(3));
    expect(questionText(r)).toBe(`${r.a} plus what makes 10?`);
    expect(praise(r)).toBe(`Yes! ${r.a} and ${r.answer} make 10.`);
  });
  it('states the real sum of a try and which way to go, and the sum is correct', () => {
    for (const t of TARGETS) {
      for (const seed of SEEDS.slice(0, 30)) {
        const r = makeRound(t, mulberry32(seed));
        for (const c of addends(t)) {
          const text = tryAgain(r, c);
          if (r.a + c === t) expect(text).toBe(praise(r));
          else {
            expect(text).toContain(`${r.a} and ${c} make ${r.a + c}.`);
            expect(text).toContain(r.a + c < t ? 'Try a bigger number.' : 'Try a smaller number.');
          }
        }
      }
    }
  });
  it('says the row and the share line correctly in every state', () => {
    expect(rowText(0)).toBe('0 of 10 stars.');
    expect(rowText(7)).toBe('7 of 10 stars.');
    expect(rowText(10)).toBe('Your row is full: 10 stars.');
    expect(shareSummary(emptySaved())).toBe('Make Ten - I have not found a bond yet.');
    expect(shareSummary({ bonds: 1, rows: 0, best: 1 })).toBe('Make Ten - 1 bond found, 0 rows of stars full, best run 1.');
    expect(shareSummary({ bonds: 25, rows: 1, best: 6 })).toBe('Make Ten - 25 bonds found, 1 row of stars full, best run 6.');
  });
});

describe('the page source keeps its promises', () => {
  const src = calculatorSource.replace(/\r\n?/g, '\n');
  it('has no timer and no sound', () => {
    expect(src).not.toMatch(/\b(setTimeout|setInterval)\b/);
    expect(src).not.toMatch(/AudioContext|new Audio\(|speechSynthesis|oscillator/i);
  });
  it('makes answers, levels, tabs and buttons at least 56 px (3.5rem)', () => {
    for (const cls of ['mk-answer', 'mk-level', 'mk-tab', 'mk-big']) {
      expect(src, cls).toMatch(new RegExp(`\\.${cls}[^}]*min-height:\\s*3\\.5rem`));
    }
  });
  it('turns motion off under reduced motion', () => {
    expect(src).toMatch(/prefers-reduced-motion/);
    expect((src.match(/animation\s*:/g) ?? []).length).toBeGreaterThan(0);
  });
  it('has a live status line', () => {
    expect(src).toMatch(/aria-live="polite"/);
  });
});
