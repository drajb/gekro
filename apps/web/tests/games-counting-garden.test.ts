/**
 * games-counting-garden.test.ts - the engine behind `counting-garden`.
 *
 * Pinned: every counting scene holds exactly the number of creatures its answer
 * says (recounted independently from the drawn items), creatures never share a
 * cell and stay inside the grid, decoys are other kinds and fit, the number
 * choices are distinct, in range and contain the answer once, "more or fewer"
 * never compares equal counts and its answer matches a second calculation, the
 * same seed gives the same scene, a round never repeats the previous answer, the
 * step-up ladder offers once after five clean answers and a Try again breaks the
 * row, the garden stops at ten plots, stored scores are sanitised into a fresh
 * bounded object, the kind wording never scolds, and the page source has no
 * timers, no sound and 56 px targets.
 */
import { describe, it, expect } from 'vitest';
import {
  mulberry32, randInt, shuffled, ITEM_KINDS, ITEM_EMOJI, ITEM_ONE, ITEM_MANY, countWord, LEVELS, LEVEL_NAME, LEVEL_RANGE, isLevel,
  COLS, COMPARE_MAX, COMPARE_ROWS, JITTER_STEPS, CONFIG, nextLevel, makeOptions, makeCountRound, makeCompareRound, makeRound, isCorrect,
  countOf, countLabels, STEP_UP_AT, newLadder, ladderAfterWrong, ladderAfterRight, wantsStepUp, ladderAfterOffer,
  GARDEN_SIZE, GARDEN_FLOWERS, CAPS, emptySaved, sanitiseSaved, plant, recordRight, question, praise, tryAgain, offerText, gardenText,
  shareSummary, type CountLevel, type Level, type Placed, type Round, type CountRound, type CompareRound,
} from '../src/components/apps-private/counting-garden/helpers';
import calculatorSource from '../src/components/apps-private/counting-garden/Calculator.astro?raw';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const COUNT_LEVELS: CountLevel[] = ['five', 'ten', 'twenty'];

/** Independent check of a placed list: inside the grid, one creature per cell, reading order. */
const checkPlacement = (items: readonly Placed[], cols: number, rows: number) => {
  const seen = new Set<string>();
  let last = -1;
  for (const it of items) {
    expect(Number.isInteger(it.col) && it.col >= 0 && it.col < cols, 'col').toBe(true);
    expect(Number.isInteger(it.row) && it.row >= 0 && it.row < rows, 'row').toBe(true);
    expect(Number.isInteger(it.jitter) && it.jitter >= 0 && it.jitter < JITTER_STEPS, 'jitter').toBe(true);
    expect(ITEM_KINDS.includes(it.kind)).toBe(true);
    const key = `${it.col},${it.row}`;
    expect(seen.has(key), `cell ${key} used twice`).toBe(false);
    seen.add(key);
    const idx = it.row * cols + it.col;
    expect(idx).toBeGreaterThan(last);
    last = idx;
  }
};

describe('items and levels', () => {
  it('has five kinds with distinct emoji and plain words for each', () => {
    expect(ITEM_KINDS).toHaveLength(5);
    expect(new Set(Object.values(ITEM_EMOJI)).size).toBe(5);
    for (const k of ITEM_KINDS) {
      expect(ITEM_ONE[k].length).toBeGreaterThan(2);
      expect(ITEM_MANY[k].length).toBeGreaterThan(2);
    }
  });
  it('writes counts with the right singular and plural', () => {
    expect(countWord(1, 'bee')).toBe('1 bee');
    expect(countWord(2, 'bee')).toBe('2 bees');
    expect(countWord(1, 'butterfly')).toBe('1 butterfly');
    expect(countWord(7, 'butterfly')).toBe('7 butterflies');
  });
  it('lists the four levels the page names, in order, with names and ranges', () => {
    expect(LEVELS).toEqual(['five', 'ten', 'twenty', 'compare']);
    expect(LEVEL_NAME.compare).toBe('More or fewer');
    expect(LEVEL_RANGE.compare).not.toMatch(/[?.!]$/);
    expect(LEVEL_RANGE.five).toBe('1 to 5');
    expect(LEVEL_RANGE.ten).toBe('1 to 10');
    expect(LEVEL_RANGE.twenty).toBe('1 to 20');
  });
  it('validates level names from the address bar', () => {
    for (const l of LEVELS) expect(isLevel(l)).toBe(true);
    for (const junk of ['', 'FIVE', 'six', '__proto__', 5, null, undefined, {}, []]) expect(isLevel(junk)).toBe(false);
  });
  it('steps up five to ten to twenty and stops there', () => {
    expect(nextLevel('five')).toBe('ten');
    expect(nextLevel('ten')).toBe('twenty');
    expect(nextLevel('twenty')).toBeNull();
    expect(nextLevel('compare')).toBeNull();
  });
  it('gives every level a scene big enough for its biggest answer and its decoys', () => {
    for (const l of COUNT_LEVELS) expect(COLS * CONFIG[l].rows).toBeGreaterThanOrEqual(CONFIG[l].max + CONFIG[l].decoys);
    expect(COLS * COMPARE_ROWS).toBeGreaterThanOrEqual(COMPARE_MAX);
    expect(CONFIG.five.max).toBe(5);
    expect(CONFIG.ten.max).toBe(10);
    expect(CONFIG.twenty.max).toBe(20);
  });
});

describe('randomness helpers', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('randInt stays inside its bounds even for bad rng output', () => {
    for (const bad of [NaN, Infinity, -Infinity, -5, 2, 1]) {
      const v = randInt(() => bad, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
  it('shuffled keeps every element and does not touch the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7];
    const out = shuffled(input, mulberry32(3));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('counting rounds', () => {
  it('draws exactly as many of the target creature as the answer says, at every level and seed', () => {
    for (const level of COUNT_LEVELS) {
      for (const seed of SEEDS) {
        const r = makeCountRound(level, mulberry32(seed));
        // Recount from the drawn items without using the engine's own helper.
        let recount = 0;
        for (const it of r.items) if (it.kind === r.target) recount += 1;
        expect(recount, `${level} #${seed}`).toBe(r.answer);
        expect(countOf(r.items, r.target)).toBe(r.answer);
        expect(r.answer).toBeGreaterThanOrEqual(1);
        expect(r.answer).toBeLessThanOrEqual(CONFIG[level].max);
      }
    }
  });
  it('keeps decoys to other kinds, within the level limit, and every creature in its own cell', () => {
    for (const level of COUNT_LEVELS) {
      for (const seed of SEEDS) {
        const r = makeCountRound(level, mulberry32(seed));
        const decoys = r.items.filter((i) => i.kind !== r.target);
        expect(decoys.length).toBeLessThanOrEqual(CONFIG[level].decoys);
        expect(r.items.length).toBeLessThanOrEqual(r.cols * r.rows);
        expect(r.cols).toBe(COLS);
        expect(r.rows).toBe(CONFIG[level].rows);
        checkPlacement(r.items, r.cols, r.rows);
      }
    }
    // The Little level has no decoys at all.
    for (const seed of SEEDS) {
      const r = makeCountRound('five', mulberry32(seed));
      expect(r.items.every((i) => i.kind === r.target)).toBe(true);
    }
  });
  it('covers every number from 1 to the maximum, and sometimes has decoys, at every level', () => {
    for (const level of COUNT_LEVELS) {
      const answers = new Set<number>();
      let withDecoys = 0;
      for (const seed of SEEDS) {
        const r = makeCountRound(level, mulberry32(seed));
        answers.add(r.answer);
        if (r.items.some((i) => i.kind !== r.target)) withDecoys += 1;
      }
      expect(answers.size, level).toBe(CONFIG[level].max);
      if (CONFIG[level].decoys > 0) expect(withDecoys, level).toBeGreaterThan(20);
      else expect(withDecoys).toBe(0);
    }
  });
  it('offers number choices that are distinct, in range, ascending, the right count, and contain the answer once', () => {
    for (const level of COUNT_LEVELS) {
      for (const seed of SEEDS) {
        const r = makeCountRound(level, mulberry32(seed));
        const o = r.options;
        expect(o).toHaveLength(CONFIG[level].choices);
        expect(new Set(o).size).toBe(o.length);
        expect(o.filter((v) => v === r.answer)).toHaveLength(1);
        expect(o.every((v) => Number.isInteger(v) && v >= 1 && v <= CONFIG[level].max)).toBe(true);
        expect([...o].sort((a, b) => a - b)).toEqual(o);
      }
    }
  });
  it('shows every number 1 to 5 on the Little level', () => {
    for (const seed of SEEDS.slice(0, 50)) expect(makeCountRound('five', mulberry32(seed)).options).toEqual([1, 2, 3, 4, 5]);
  });
  it('keeps the other choices among the five numbers nearest the answer', () => {
    for (const [level, max] of [['ten', 10], ['twenty', 20]] as [CountLevel, number][]) for (const seed of SEEDS) {
      const r = makeCountRound(level, mulberry32(seed));
      const nearest = Array.from({ length: max }, (_, i) => i + 1)
        .filter((v) => v !== r.answer)
        .sort((a, b) => Math.abs(a - r.answer) - Math.abs(b - r.answer) || a - b)
        .slice(0, 5);
      for (const v of r.options) if (v !== r.answer) expect(nearest).toContain(v);
    }
  });
  it('never asks the previous answer again', () => {
    for (const level of COUNT_LEVELS) {
      let prev = 0;
      const rng = mulberry32(99);
      for (let i = 0; i < 600; i++) {
        const r = makeCountRound(level, rng, prev);
        expect(r.answer, `${level} round ${i}`).not.toBe(prev);
        prev = r.answer;
      }
    }
  });
  it('makeOptions copes with a tiny range', () => {
    expect(makeOptions(1, 1, 4, mulberry32(1))).toEqual([1]);
    expect(makeOptions(2, 3, 5, mulberry32(1))).toEqual([1, 2, 3]);
    expect(makeOptions(5, 5, 5, mulberry32(1))).toEqual([1, 2, 3, 4, 5]);
  });
  it('gives the same scene for the same seed and a different one for another seed', () => {
    for (const level of COUNT_LEVELS) {
      expect(makeCountRound(level, mulberry32(123))).toEqual(makeCountRound(level, mulberry32(123)));
    }
    const a = JSON.stringify(makeCountRound('twenty', mulberry32(1)));
    const b = JSON.stringify(makeCountRound('twenty', mulberry32(2)));
    expect(a).not.toBe(b);
  });
  it('survives a broken rng without throwing or leaving the bounds', () => {
    for (const bad of [NaN, Infinity, -1, 5]) {
      for (const level of COUNT_LEVELS) {
        const r = makeCountRound(level, () => bad);
        expect(r.answer).toBeGreaterThanOrEqual(1);
        expect(r.answer).toBeLessThanOrEqual(CONFIG[level].max);
        expect(countOf(r.items, r.target)).toBe(r.answer);
        checkPlacement(r.items, r.cols, r.rows);
      }
    }
  });
  it('labels exactly the target creatures 1..n in reading order for count-with-me', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const r = makeCountRound('ten', mulberry32(seed));
      const labels = countLabels(r.items, r.target);
      expect(labels).toHaveLength(r.items.length);
      const shown = labels.filter((n) => n > 0);
      expect(shown).toEqual(Array.from({ length: r.answer }, (_, i) => i + 1));
      r.items.forEach((it, i) => expect(labels[i] > 0).toBe(it.kind === r.target));
    }
  });
});

describe('more or fewer rounds', () => {
  it('never compares equal counts, and the answer matches a second calculation', () => {
    for (const seed of SEEDS) {
      const r = makeCompareRound(mulberry32(seed));
      expect(r.left.count).not.toBe(r.right.count);
      expect(r.left.count).toBeGreaterThanOrEqual(1);
      expect(r.left.count).toBeLessThanOrEqual(COMPARE_MAX);
      expect(r.right.count).toBeGreaterThanOrEqual(1);
      expect(r.right.count).toBeLessThanOrEqual(COMPARE_MAX);
      // Recount both groups from the drawn items.
      expect(r.left.items.length).toBe(r.left.count);
      expect(r.right.items.length).toBe(r.right.count);
      const l = r.left.items.length;
      const rr = r.right.items.length;
      const bigger = l > rr ? 'left' : 'right';
      const smaller = l < rr ? 'left' : 'right';
      expect(r.answer).toBe(r.ask === 'more' ? bigger : smaller);
    }
  });
  it('draws each group as one kind in its own cells, and the two groups are different kinds', () => {
    for (const seed of SEEDS) {
      const r = makeCompareRound(mulberry32(seed));
      expect(r.left.kind).not.toBe(r.right.kind);
      for (const g of [r.left, r.right]) {
        expect(g.items.every((i) => i.kind === g.kind)).toBe(true);
        expect(g.cols).toBe(COLS);
        expect(g.rows).toBe(COMPARE_ROWS);
        checkPlacement(g.items, g.cols, g.rows);
      }
    }
  });
  it('asks both more and fewer, and puts the answer on both sides', () => {
    const asks = new Set<string>();
    const sides = new Set<string>();
    for (const seed of SEEDS) {
      const r = makeCompareRound(mulberry32(seed));
      asks.add(r.ask);
      sides.add(r.answer);
    }
    expect([...asks].sort()).toEqual(['fewer', 'more']);
    expect([...sides].sort()).toEqual(['left', 'right']);
  });
  it('is deterministic for a seed', () => {
    expect(makeCompareRound(mulberry32(5))).toEqual(makeCompareRound(mulberry32(5)));
  });
});

describe('makeRound and isCorrect', () => {
  it('builds the right kind of round for each level', () => {
    for (const l of LEVELS) {
      const r = makeRound(l as Level, mulberry32(8));
      expect(r.type).toBe(l === 'compare' ? 'compare' : 'count');
    }
  });
  it('accepts exactly the answer and nothing else for a counting round', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const r = makeCountRound('ten', mulberry32(seed));
      for (let v = -2; v <= 25; v++) expect(isCorrect(r, v)).toBe(v === r.answer);
      expect(isCorrect(r, 'left')).toBe(false);
      expect(isCorrect(r, NaN)).toBe(false);
    }
  });
  it('accepts exactly the answer side for a comparing round', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const r = makeCompareRound(mulberry32(seed));
      const other = r.answer === 'left' ? 'right' : 'left';
      expect(isCorrect(r, r.answer)).toBe(true);
      expect(isCorrect(r, other)).toBe(false);
      expect(isCorrect(r, 3)).toBe(false);
    }
  });
});

describe('the gentle step-up ladder', () => {
  it('counts only clean answers, and offers after exactly five', () => {
    let l = newLadder();
    for (let i = 1; i <= STEP_UP_AT; i++) {
      expect(wantsStepUp(l, 'five')).toBe(false);
      l = ladderAfterRight(l, 'clean');
      expect(l.streak).toBe(i);
    }
    expect(STEP_UP_AT).toBe(5);
    expect(wantsStepUp(l, 'five')).toBe(true);
    expect(wantsStepUp(l, 'ten')).toBe(true);
  });
  it('does not offer at the top level or on More or fewer', () => {
    let l = newLadder();
    for (let i = 0; i < 8; i++) l = ladderAfterRight(l, 'clean');
    expect(wantsStepUp(l, 'twenty')).toBe(false);
    expect(wantsStepUp(l, 'compare')).toBe(false);
  });
  it('a retried or helped answer neither adds to the row nor breaks it', () => {
    let l = ladderAfterRight(ladderAfterRight(newLadder(), 'clean'), 'clean');
    expect(ladderAfterRight(l, 'retry').streak).toBe(2);
    expect(ladderAfterRight(l, 'helped').streak).toBe(2);
    l = ladderAfterRight(l, 'retry');
    expect(l.streak).toBe(2);
  });
  it('a Try again breaks the row and lets the offer come again later', () => {
    let l = newLadder();
    for (let i = 0; i < 5; i++) l = ladderAfterRight(l, 'clean');
    l = ladderAfterOffer(l);
    expect(wantsStepUp(l, 'five')).toBe(false); // asked once, not nagged
    l = ladderAfterRight(l, 'clean');
    expect(wantsStepUp(l, 'five')).toBe(false);
    l = ladderAfterWrong(l);
    expect(l).toEqual(newLadder());
    for (let i = 0; i < 5; i++) l = ladderAfterRight(l, 'clean');
    expect(wantsStepUp(l, 'five')).toBe(true);
  });
  it('words the offer with the next range, and nothing at the top', () => {
    expect(offerText('five')).toBe('5 in a row! Want to try 1 to 10?');
    expect(offerText('ten')).toBe('5 in a row! Want to try 1 to 20?');
    expect(offerText('twenty')).toBe('');
  });
  it('the row is bounded', () => {
    let l = { streak: 9999, offered: false };
    l = ladderAfterRight(l, 'clean');
    expect(l.streak).toBe(9999);
  });
});

describe('the garden and stored totals', () => {
  it('has ten plots and never plants an eleventh', () => {
    expect(GARDEN_SIZE).toBe(10);
    expect(GARDEN_FLOWERS).toHaveLength(10);
    let p = 0;
    for (let i = 1; i <= 10; i++) {
      p = plant(p);
      expect(p).toBe(i);
    }
    expect(plant(p)).toBe(10);
    expect(plant(-4)).toBe(1);
    expect(plant(NaN)).toBe(1);
    expect(plant(3.9)).toBe(4);
  });
  it('records one flower per right answer, a garden when it fills, and the best row', () => {
    let s = emptySaved();
    s = recordRight(s, 1, false);
    s = recordRight(s, 2, false);
    expect(s).toEqual({ flowers: 2, gardens: 0, row: 2 });
    s = recordRight(s, 0, true);
    expect(s).toEqual({ flowers: 3, gardens: 1, row: 2 });
  });
  it('caps every stored number', () => {
    const s = recordRight({ flowers: CAPS.flowers, gardens: CAPS.gardens, row: CAPS.row }, 5000, true);
    expect(s).toEqual({ flowers: CAPS.flowers, gardens: CAPS.gardens, row: CAPS.row });
  });
  it('sanitises stored data into a fresh, bounded object', () => {
    expect(sanitiseSaved({ flowers: 12, gardens: 1, row: 7 })).toEqual({ flowers: 12, gardens: 1, row: 7 });
    expect(sanitiseSaved(null)).toEqual(emptySaved());
    expect(sanitiseSaved([])).toEqual(emptySaved());
    expect(sanitiseSaved('{"flowers":9}')).toEqual(emptySaved());
    expect(sanitiseSaved({ flowers: -1, gardens: 1.5, row: NaN })).toEqual(emptySaved());
    expect(sanitiseSaved({ flowers: '9', gardens: null, row: {} })).toEqual(emptySaved());
    expect(sanitiseSaved({ flowers: 1e9, gardens: 1e9, row: 1e9 })).toEqual({ flowers: CAPS.flowers, gardens: CAPS.gardens, row: CAPS.row });
    const evil = JSON.parse('{"__proto__": {"flowers": 5}, "flowers": 2, "extra": 1}');
    const out = sanitiseSaved(evil);
    expect(out).toEqual({ flowers: 2, gardens: 0, row: 0 });
    expect(Object.keys(out).sort()).toEqual(['flowers', 'gardens', 'row']);
    expect(out).not.toBe(evil);
  });
});

describe('the words', () => {
  const never = /\b(wrong|incorrect|fail|failed|failure|bad|mistake|error|lose|lost|game over|stupid|silly|no!)\b/i;
  const allText = (): string[] => {
    const out: string[] = [];
    for (const seed of SEEDS.slice(0, 120)) {
      for (const l of LEVELS) {
        const r: Round = makeRound(l, mulberry32(seed));
        out.push(question(r), praise(r));
        if (r.type === 'count') for (const v of [0, 1, r.answer - 1, r.answer + 1, 30]) out.push(tryAgain(r, v));
        else out.push(tryAgain(r, 'left'), tryAgain(r, 'right'));
      }
    }
    for (const l of LEVELS) out.push(offerText(l));
    for (let p = 0; p <= 10; p++) out.push(gardenText(p));
    out.push(shareSummary(emptySaved()), shareSummary({ flowers: 1, gardens: 0, row: 1 }), shareSummary({ flowers: 40, gardens: 4, row: 9 }));
    return out;
  };
  it('never scolds anywhere', () => {
    for (const t of allText()) expect(t, t).not.toMatch(never);
  });
  it('never contains an em-dash', () => {
    for (const t of allText()) expect(t.includes('—')).toBe(false);
  });
  it('asks a short question with the plural creature name', () => {
    const r = makeCountRound('ten', mulberry32(4));
    expect(question(r)).toBe(`How many ${ITEM_MANY[r.target]}?`);
    const c = makeCompareRound(mulberry32(4));
    expect(question(c)).toBe(c.ask === 'more' ? 'Which group has MORE?' : 'Which group has FEWER?');
  });
  it('praises with the specific count that was found', () => {
    const r = makeCountRound('five', mulberry32(11)) as CountRound;
    expect(praise(r)).toBe(`Yes! You counted ${countWord(r.answer, r.target)}.`);
    for (const seed of SEEDS.slice(0, 40)) {
      const c = makeCompareRound(mulberry32(seed)) as CompareRound;
      const text = praise(c);
      const win = c.answer === 'left' ? c.left : c.right;
      const other = c.answer === 'left' ? c.right : c.left;
      expect(text).toContain(countWord(win.count, win.kind));
      expect(text).toContain(countWord(other.count, other.kind));
      expect(text).toContain(`The ${c.answer} group has ${c.ask === 'more' ? 'more' : 'fewer'}`);
    }
  });
  it('points the way after a miss: more than the guess, or fewer than it', () => {
    const r = makeCountRound('ten', mulberry32(21)) as CountRound;
    expect(tryAgain(r, r.answer - 1)).toBe(`Try again. There are more than ${r.answer - 1}.`);
    expect(tryAgain(r, r.answer + 1)).toBe(`Try again. There are fewer than ${r.answer + 1}.`);
    const c = makeCompareRound(mulberry32(21));
    expect(tryAgain(c, c.answer === 'left' ? 'right' : 'left')).toBe('Try again. Look at the other group.');
  });
  it('says the garden state with the right numbers', () => {
    expect(gardenText(0)).toBe('0 of 10 flowers planted.');
    expect(gardenText(4)).toBe('4 of 10 flowers planted.');
    expect(gardenText(10)).toBe('Your garden is full: 10 flowers.');
  });
  it('writes a share line that is right for a new player, one flower and many', () => {
    expect(shareSummary(emptySaved())).toBe('Counting Garden - I have not planted a flower yet.');
    expect(shareSummary({ flowers: 1, gardens: 0, row: 1 })).toBe('Counting Garden - 1 flower planted, 0 gardens full, best row 1.');
    expect(shareSummary({ flowers: 25, gardens: 1, row: 8 })).toBe('Counting Garden - 25 flowers planted, 1 garden full, best row 8.');
  });
});

describe('the page source keeps its promises', () => {
  const src = calculatorSource.replace(/\r\n?/g, '\n');
  it('has no timer, no sound and no fixed pixel board', () => {
    expect(src).not.toMatch(/\b(setTimeout|setInterval)\b/);
    expect(src).not.toMatch(/AudioContext|new Audio\(|speechSynthesis|oscillator/i);
  });
  it('makes every answer, level and next button at least 56 px (3.5rem) tall', () => {
    expect(src).toMatch(/\.cgd-answer[^}]*min-height:\s*3\.5rem/);
    expect(src).toMatch(/\.cgd-level[^}]*min-height:\s*3\.5rem/);
    expect(src).toMatch(/\.cgd-big[^}]*min-height:\s*3\.5rem/);
    expect(src).toMatch(/\.cgd-side[^}]*min-height:\s*3\.5rem/);
  });
  it('turns motion off under reduced motion', () => {
    expect(src).toMatch(/prefers-reduced-motion/);
    const animations = src.match(/animation\s*:/g) ?? [];
    expect(animations.length).toBeGreaterThan(0);
  });
  it('says how counting is shown to a screen reader without giving the answer', () => {
    expect(src).toMatch(/role="img"/);
    expect(src).toMatch(/aria-live="polite"/);
  });
});
