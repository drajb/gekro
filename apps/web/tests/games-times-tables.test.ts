/**
 * games-times-tables.test.ts - the engine behind `times-tables`.
 *
 * Pinned: the deck covers every fact of the chosen tables exactly once (12 per table, 24
 * with division), checked against an independent count; every answer is right, found by
 * repeated addition for a multiplication and by search for a division; the two wrong choices
 * are always whole numbers above zero, different from the answer and from each other, for
 * every fact; the right choice lands in each place about equally often; a practice round
 * never ends in failure (it always finishes, a missed fact is asked once more and listed to
 * review); a sprint takes nothing away; the Learn arrays hold exactly the product in dots;
 * the words said after an answer are kind and exact; and that what comes out of localStorage
 * is sanitised before the page sees it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TABLES, MAX_FACTOR, DEFAULT_TABLES, ROUND_LENGTH, SPRINT_SECONDS, REVIEW_SHOWN, MAX_SPRINT, MAX_ROUNDS, MODES, ANSWER_STYLES,
  parseMode, parseStyle, mulberry32, shuffle, plural, parseTables, tablesToString, tablesLabel, toggleTable, cleanTable, tableHue,
  factKey, makeQuestion, deckFor, buildRound, randomQuestion, distractors, choicesFor, parseTyped, isCorrect,
  arrayShape, arrayCaption, skipCount, tableRows,
  startPractice, currentQuestion, answerPractice, startSprint, answerSprint,
  equation, feedback, reviewText, practiceMessage, sprintMessage, practiceSummary, sprintSummary, learnSummary,
  cleanSprint, cleanRounds, sanitiseStored, toStorable, recordSprint, recordRound,
  type Fact, type Question, type Practice,
} from '../src/components/apps-private/times-tables/helpers';

const EM_DASH = String.fromCharCode(0x2014);

/** Multiplication by repeated addition: an independent oracle. */
const addUp = (a: number, b: number): number => { let t = 0; for (let i = 0; i < b; i++) t += a; return t; };
/** Division by search: the q with q times a equal to the product. */
const searchQuotient = (product: number, a: number): number => { for (let q = 1; q <= 1000; q++) if (addUp(a, q) === product) return q; return -1; };

describe('constants quoted on the content page', () => {
  it('match the spec', () => {
    expect([...TABLES]).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(MAX_FACTOR).toBe(12);
    expect([...DEFAULT_TABLES]).toEqual([2, 5, 10]);
    expect(ROUND_LENGTH).toBe(10);
    expect(SPRINT_SECONDS).toBe(60);
    expect(REVIEW_SHOWN).toBe(8);
    expect(MAX_SPRINT).toBe(999);
    expect(MAX_ROUNDS).toBe(9999);
    expect([...MODES]).toEqual(['learn', 'practice', 'sprint']);
    expect([...ANSWER_STYLES]).toEqual(['pick', 'type']);
  });
  it('parseMode and parseStyle fall back', () => {
    for (const m of MODES) expect(parseMode(m)).toBe(m);
    for (const bad of ['', 'play', null, undefined, 3, '__proto__']) { expect(parseMode(bad)).toBe('learn'); expect(parseStyle(bad)).toBe('pick'); }
    expect(parseStyle('type')).toBe('type');
  });
});

describe('choosing tables', () => {
  it('parses a list or a comma string into sorted whole numbers 2 to 12', () => {
    expect(parseTables('2,5,10')).toEqual([2, 5, 10]);
    expect(parseTables([10, 5, 2, 5])).toEqual([2, 5, 10]);
    expect(parseTables(' 3 , 12 ,7')).toEqual([3, 7, 12]);
    expect(parseTables('4')).toEqual([4]);
  });
  it('drops anything else and falls back to 2, 5 and 10 when nothing is left', () => {
    for (const bad of ['', 'x', '1', '13', '0', '-3', '2.5', '1e1', null, undefined, 5, {}, [], ['a'], [1, 13], '99999', '2;3']) {
      expect(parseTables(bad), String(bad)).toEqual([2, 5, 10]);
    }
    expect(parseTables('1,3,13,x')).toEqual([3]);
    expect(parseTables([2.5, 3, NaN, Infinity])).toEqual([3]);
  });
  it('tablesToString round-trips', () => {
    for (const t of [[2], [2, 5, 10], [...TABLES]]) expect(parseTables(tablesToString(t))).toEqual(t);
  });
  it('tablesLabel reads in plain words', () => {
    expect(tablesLabel([2])).toBe('2');
    expect(tablesLabel([2, 5])).toBe('2 and 5');
    expect(tablesLabel([2, 5, 10])).toBe('2, 5 and 10');
    expect(tablesLabel([...TABLES])).toBe('all of 2 to 12');
  });
  it('toggleTable adds and removes, keeps the list sorted, and keeps at least one table', () => {
    expect(toggleTable([2, 5, 10], 7)).toEqual([2, 5, 7, 10]);
    expect(toggleTable([2, 5, 10], 5)).toEqual([2, 10]);
    expect(toggleTable([4], 4)).toEqual([4]);
    expect(toggleTable([2, 5], 13)).toEqual([2, 5]);
    expect(toggleTable([2, 5], 1.5)).toEqual([2, 5]);
    expect(toggleTable([2, 5], NaN)).toEqual([2, 5]);
  });
  it('every table has a colour index from 0 to 5 and neighbouring tables differ', () => {
    for (const t of TABLES) { const h = tableHue(t); expect(Number.isInteger(h) && h >= 0 && h <= 5).toBe(true); }
    for (let t = 2; t < 12; t++) expect(tableHue(t)).not.toBe(tableHue(t + 1));
    expect(new Set([2, 3, 4, 5, 6, 7].map(tableHue)).size).toBe(6);
    expect(cleanTable(7)).toBe(7);
    for (const bad of [1, 13, 2.5, NaN, '7', null, undefined]) expect(cleanTable(bad)).toBe(2);
  });
});

describe('the deck: every fact once', () => {
  const subsets: number[][] = [[2], [2, 5, 10], [3, 4], [...TABLES], [7, 8, 9, 12]];
  it('has 12 multiplications per table, and 12 divisions more with division on, each fact exactly once', () => {
    for (const t of subsets) {
      for (const division of [false, true]) {
        const deck = deckFor(t, division);
        expect(deck).toHaveLength(t.length * 12 * (division ? 2 : 1));
        const keys = deck.map(factKey);
        expect(new Set(keys).size).toBe(deck.length);
        // The independent count: every (op, table, factor) combination is there.
        for (const a of t) for (let b = 1; b <= 12; b++) {
          expect(keys).toContain(`mul:${a}x${b}`);
          if (division) expect(keys).toContain(`div:${a}x${b}`);
          else expect(keys).not.toContain(`div:${a}x${b}`);
        }
        expect(deck.every((f) => t.includes(f.a) && f.b >= 1 && f.b <= 12)).toBe(true);
      }
    }
  });
  it('all 11 tables with division is 264 facts', () => {
    expect(deckFor([...TABLES], true)).toHaveLength(264);
    expect(deckFor([...TABLES], false)).toHaveLength(132);
  });
  it('a junk table list gives the default tables', () => {
    expect(deckFor([], false)).toEqual(deckFor([2, 5, 10], false));
  });
});

describe('questions and answers', () => {
  it('every answer in the game is right, by repeated addition and by search', () => {
    for (const division of [false, true]) {
      for (const f of deckFor([...TABLES], division)) {
        const q = makeQuestion(f);
        expect(q.product).toBe(addUp(f.a, f.b));
        if (f.op === 'mul') expect(q.answer, factKey(f)).toBe(addUp(f.a, f.b));
        else expect(q.answer, factKey(f)).toBe(searchQuotient(q.product, f.a));
        expect(Number.isInteger(q.answer) && q.answer >= 1).toBe(true);
      }
    }
  });
  it('writes the question for the screen and for a screen reader', () => {
    expect(makeQuestion({ a: 7, b: 8, op: 'mul' })).toMatchObject({ text: '7 × 8', spoken: '7 times 8', answer: 56, product: 56 });
    expect(makeQuestion({ a: 8, b: 7, op: 'div' })).toMatchObject({ text: '56 ÷ 8', spoken: '56 divided by 8', answer: 7, product: 56 });
    expect(equation(makeQuestion({ a: 7, b: 8, op: 'mul' }))).toBe('7 × 8 = 56');
    expect(equation(makeQuestion({ a: 8, b: 7, op: 'div' }))).toBe('56 ÷ 8 = 7');
  });
  it('a division fact stays inside its table: the divisor is the table number', () => {
    for (const f of deckFor([...TABLES], true).filter((x) => x.op === 'div')) {
      const q = makeQuestion(f);
      expect(q.text.endsWith(`÷ ${f.a}`)).toBe(true);
    }
  });
});

describe('a practice round', () => {
  it('is ten different facts from the deck', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const qs = buildRound([2, 5, 10], false, mulberry32(seed));
      expect(qs).toHaveLength(10);
      expect(new Set(qs.map(factKey)).size).toBe(10);
      const deck = new Set(deckFor([2, 5, 10], false).map(factKey));
      for (const q of qs) expect(deck.has(factKey(q))).toBe(true);
    }
  });
  it('also works with one table (12 facts) and with division', () => {
    expect(buildRound([9], false, mulberry32(3))).toHaveLength(10);
    const ops = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const q of buildRound([9], true, mulberry32(seed))) ops.add(q.op);
    expect([...ops].sort()).toEqual(['div', 'mul']);
    for (let seed = 1; seed <= 50; seed++) {
      const qs = buildRound([3, 4], true, mulberry32(seed));
      expect(new Set(qs.map(factKey)).size).toBe(10);
    }
  });
  it('is the same for the same seed and different for another', () => {
    const a = buildRound([...TABLES], true, mulberry32(7)).map(factKey).join('|');
    expect(buildRound([...TABLES], true, mulberry32(7)).map(factKey).join('|')).toBe(a);
    expect(buildRound([...TABLES], true, mulberry32(8)).map(factKey).join('|')).not.toBe(a);
  });
  it('gives every fact its fair share: over many rounds each of the 12 facts of one table appears in about 10 of 12 rounds', () => {
    const counts = new Map<string, number>();
    const n = 6000;
    const rng = mulberry32(2026);
    for (let i = 0; i < n; i++) for (const q of buildRound([6], false, rng)) counts.set(factKey(q), (counts.get(factKey(q)) ?? 0) + 1);
    expect(counts.size).toBe(12);
    for (const [, c] of counts) expect(Math.abs(c / n - 10 / 12)).toBeLessThan(0.03);
  });
  it('shuffle keeps every item once and does not touch its input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = src.slice();
    const out = shuffle(src, mulberry32(1));
    expect(src).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(copy);
    for (const bad of [() => NaN, () => 1, () => -3, () => Infinity]) expect([...shuffle(src, bad)].sort((a, b) => a - b)).toEqual(copy);
  });
  it('randomQuestion avoids the fact just asked', () => {
    const rng = mulberry32(5);
    let prev: Fact | null = null;
    for (let i = 0; i < 500; i++) {
      const q = randomQuestion([2, 3], false, rng, prev);
      if (prev) expect(factKey(q)).not.toBe(factKey(prev));
      prev = q;
    }
    expect(factKey(randomQuestion([2], false, () => 0.999, { a: 2, b: 12, op: 'mul' }))).not.toBe('mul:2x12');
  });
});

describe('the three choices', () => {
  it('the two wrong answers are whole numbers above zero, never the answer, never each other: every fact, 60 seeds', () => {
    for (const division of [false, true]) {
      for (const f of deckFor([...TABLES], division)) {
        const q = makeQuestion(f);
        for (let seed = 1; seed <= 60; seed++) {
          const [x, y] = distractors(q, mulberry32(seed * 977));
          expect(Number.isInteger(x) && Number.isInteger(y), factKey(f)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(1);
          expect(x).not.toBe(q.answer);
          expect(y).not.toBe(q.answer);
          expect(x).not.toBe(y);
          expect(x).toBeLessThanOrEqual(999);
          expect(y).toBeLessThanOrEqual(999);
        }
      }
    }
  });
  it('even a broken random generator cannot produce a repeat or the answer', () => {
    for (const rng of [() => 0, () => 0.9999999, () => NaN, () => 0.5]) {
      for (const f of deckFor([...TABLES], true)) {
        const q = makeQuestion(f);
        const [x, y] = distractors(q, rng);
        expect(new Set([x, y, q.answer]).size).toBe(3);
      }
    }
  });
  it('choicesFor has the answer exactly once, three different numbers, and the right index', () => {
    const rng = mulberry32(11);
    for (const f of deckFor([...TABLES], true)) {
      const q = makeQuestion(f);
      for (let k = 0; k < 8; k++) {
        const c = choicesFor(q, rng);
        expect(c.options).toHaveLength(3);
        expect(new Set(c.options).size).toBe(3);
        expect(c.options.filter((o) => o === q.answer)).toHaveLength(1);
        expect(c.options[c.correctIndex]).toBe(q.answer);
      }
    }
  });
  it('the right answer lands in each place about a third of the time', () => {
    const rng = mulberry32(99);
    const q = makeQuestion({ a: 7, b: 8, op: 'mul' });
    const place = [0, 0, 0];
    const n = 6000;
    for (let i = 0; i < n; i++) place[choicesFor(q, rng).correctIndex] += 1;
    for (const c of place) expect(Math.abs(c / n - 1 / 3)).toBeLessThan(0.03);
  });
  it('wrong answers are mostly plausible: for 7 x 8 they come from the neighbouring facts or a near miss', () => {
    const q = makeQuestion({ a: 7, b: 8, op: 'mul' });
    const allowed = new Set([48, 64, 49, 63, 55, 57, 54, 58, 66, 46]);
    const rng = mulberry32(4);
    for (let i = 0; i < 400; i++) for (const d of distractors(q, rng)) expect(allowed.has(d), String(d)).toBe(true);
  });
});

describe('typed answers', () => {
  it('accepts one to three digits and nothing else', () => {
    expect(parseTyped('56')).toEqual({ valid: true, value: 56 });
    expect(parseTyped(' 7 ')).toEqual({ valid: true, value: 7 });
    expect(parseTyped('007')).toEqual({ valid: true, value: 7 });
    expect(parseTyped('144')).toEqual({ valid: true, value: 144 });
    for (const bad of ['', '  ', 'a', '5a', '-5', '5.5', '1e2', '1000', '1 2', '+5', null, undefined, 5, {}]) {
      expect(parseTyped(bad), String(bad)).toEqual({ valid: false, value: null });
    }
  });
  it('isCorrect compares with the answer', () => {
    const q = makeQuestion({ a: 6, b: 7, op: 'mul' });
    expect(isCorrect(q, 42)).toBe(true);
    expect(isCorrect(q, 41)).toBe(false);
    expect(isCorrect(q, null)).toBe(false);
  });
});

describe('Learn: arrays of dots and skip counting', () => {
  it('an array of a groups of b holds exactly a x b dots, for every fact', () => {
    for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) {
      const s = arrayShape(a, b);
      expect(s).toEqual({ rows: a, cols: b, total: addUp(a, b) });
    }
  });
  it('captions are exact and use the singular for one group', () => {
    expect(arrayCaption(3, 4)).toBe('3 groups of 4 make 12');
    expect(arrayCaption(1, 5)).toBe('1 group of 5 make 5');
    expect(arrayCaption(12, 12)).toBe('12 groups of 12 make 144');
  });
  it('bad numbers fall back to 1', () => {
    expect(arrayShape(0, 99)).toEqual({ rows: 1, cols: 1, total: 1 });
    expect(arrayShape(NaN, 2.5)).toEqual({ rows: 1, cols: 1, total: 1 });
  });
  it('skip counting runs a, 2a, 3a up to b steps and ends on the product', () => {
    expect(skipCount(3, 4)).toEqual([3, 6, 9, 12]);
    expect(skipCount(5, 1)).toEqual([5]);
    for (let a = 2; a <= 12; a++) for (let b = 1; b <= 12; b++) {
      const s = skipCount(a, b);
      expect(s).toHaveLength(b);
      expect(s[s.length - 1]).toBe(addUp(a, b));
      for (let i = 1; i < s.length; i++) expect(s[i] - s[i - 1]).toBe(a);
    }
  });
  it('the table for Learn has 12 rows with the right products', () => {
    for (let a = 2; a <= 12; a++) {
      const rows = tableRows(a);
      expect(rows).toHaveLength(12);
      rows.forEach((r, i) => {
        expect(r.b).toBe(i + 1);
        expect(r.product).toBe(addUp(a, i + 1));
        expect(r.text).toBe(`${a} × ${i + 1} = ${addUp(a, i + 1)}`);
      });
    }
    expect(tableRows(99)[0].text).toBe('2 × 1 = 2');
  });
});

describe('a practice round never ends in failure', () => {
  const qs = (n = 10): Question[] => buildRound([6], false, mulberry32(3), n);
  it('a perfect round: ten asked, ten right the first time, nothing to review', () => {
    let p = startPractice(qs());
    let asked = 0;
    while (!p.done) { p = answerPractice(p, true); asked++; }
    expect(asked).toBe(10);
    expect(p).toMatchObject({ firstTry: 10, length: 10, pos: 10, done: true });
    expect(p.review).toEqual([]);
    expect(p.queue).toHaveLength(10);
    expect(practiceMessage(p)).toBe('All 10 right the first time. Brilliant!');
  });
  it('a round of all wrong answers still finishes: each fact is asked once more and then left alone', () => {
    let p = startPractice(qs());
    let asked = 0;
    while (!p.done && asked < 100) { p = answerPractice(p, false); asked++; }
    expect(p.done).toBe(true);
    expect(asked).toBe(20);
    expect(p.queue).toHaveLength(20);
    expect(p.firstTry).toBe(0);
    expect(p.review).toHaveLength(10);
    expect(new Set(p.review.map(factKey)).size).toBe(10);
    expect(practiceMessage(p)).toMatch(/^You got 0 of 10 right the first time\. Well done for finishing the round\. Worth another look: /);
  });
  it('a missed fact comes back once, at the end, and being right the second time does not count as first try', () => {
    let p = startPractice(qs());
    const missedKey = factKey(p.queue[2]);
    for (let i = 0; i < 10; i++) {
      const q = currentQuestion(p)!;
      p = answerPractice(p, factKey(q) !== missedKey);
    }
    expect(p.done).toBe(false);
    expect(p.queue).toHaveLength(11);
    expect(factKey(currentQuestion(p)!)).toBe(missedKey);
    p = answerPractice(p, true);
    expect(p.done).toBe(true);
    expect(p.firstTry).toBe(9);
    expect(p.review.map(factKey)).toEqual([missedKey]);
  });
  it('a hint means it does not count as first try and is asked once more, even if the answer was right', () => {
    let p = startPractice(qs(3));
    p = answerPractice(p, true, true);
    expect(p.firstTry).toBe(0);
    expect(p.queue).toHaveLength(4);
    expect(p.review).toHaveLength(1);
    p = answerPractice(p, true);
    p = answerPractice(p, true);
    expect(p.firstTry).toBe(2);
    p = answerPractice(p, true, true);
    expect(p.done).toBe(true);
    expect(p.queue).toHaveLength(4);
    expect(p.firstTry).toBe(2);
  });
  it('random players always finish within twice the round, with sensible counts (3000 rounds)', () => {
    const rng = mulberry32(8);
    for (let k = 0; k < 3000; k++) {
      const chance = rng();
      let p: Practice = startPractice(buildRound([...TABLES], true, rng));
      let guard = 0;
      while (!p.done && guard++ < 100) p = answerPractice(p, rng() < chance, rng() < 0.1);
      expect(p.done).toBe(true);
      expect(p.queue.length).toBeLessThanOrEqual(20);
      expect(p.queue.length).toBe(10 + p.again.length);
      expect(p.pos).toBe(p.queue.length);
      expect(p.firstTry + p.again.length).toBe(10);
      expect(p.review).toHaveLength(p.again.length);
      expect(p.firstTry).toBeGreaterThanOrEqual(0);
      expect(p.firstTry).toBeLessThanOrEqual(10);
    }
  });
  it('answering a finished round, or an empty one, changes nothing', () => {
    let p = startPractice(qs(2));
    p = answerPractice(answerPractice(p, true), true);
    expect(p.done).toBe(true);
    expect(answerPractice(p, false)).toBe(p);
    const empty = startPractice([]);
    expect(empty.done).toBe(true);
    expect(currentQuestion(empty)).toBeNull();
    expect(answerPractice(empty, true)).toBe(empty);
  });
  it('does not change the questions it was given', () => {
    const given = qs();
    const copy = JSON.stringify(given);
    let p = startPractice(given);
    while (!p.done) p = answerPractice(p, false);
    expect(JSON.stringify(given)).toBe(copy);
  });
});

describe('a sprint takes nothing away', () => {
  const q = makeQuestion({ a: 7, b: 8, op: 'mul' });
  const r = makeQuestion({ a: 6, b: 9, op: 'mul' });
  it('counts right answers and lists a missed fact once', () => {
    let s = startSprint();
    s = answerSprint(s, q, true);
    s = answerSprint(s, r, false);
    s = answerSprint(s, r, false);
    s = answerSprint(s, q, true);
    expect(s.right).toBe(2);
    expect(s.asked).toBe(4);
    expect(s.review.map(factKey)).toEqual(['mul:6x9']);
  });
  it('a wrong answer never lowers the score', () => {
    let s = startSprint();
    let prev = 0;
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      s = answerSprint(s, q, rng() < 0.5);
      expect(s.right).toBeGreaterThanOrEqual(prev);
      prev = s.right;
    }
  });
  it('does not change the sprint it was given', () => {
    const s = startSprint();
    answerSprint(s, q, false);
    expect(s).toEqual({ right: 0, asked: 0, review: [] });
  });
});

describe('words', () => {
  const q = makeQuestion({ a: 7, b: 8, op: 'mul' });
  const d = makeQuestion({ a: 8, b: 7, op: 'div' });
  it('praise is specific; a miss shows the answer and promises another go', () => {
    expect(feedback(q, true)).toBe('Yes! 7 × 8 = 56.');
    expect(feedback(d, true)).toBe('Yes! 56 ÷ 8 = 7.');
    expect(feedback(q, true, { hint: true })).toBe('Got it, with a little help. 7 × 8 = 56.');
    expect(feedback(q, false)).toBe('Not quite. 7 × 8 = 56. We will try it again soon.');
    expect(feedback(q, false, { again: true })).toBe('Not quite. 7 × 8 = 56. We will look at it again in Learn.');
    expect(feedback(q, false, { sprint: true })).toBe('The answer was 56: 7 × 8 = 56. On to the next one.');
  });
  it('no message has a scolding word, an em-dash or junk', () => {
    const all: string[] = [];
    for (const f of deckFor([...TABLES], true)) {
      const x = makeQuestion(f);
      all.push(feedback(x, true), feedback(x, false), feedback(x, false, { again: true }), feedback(x, false, { sprint: true }), feedback(x, true, { hint: true }));
    }
    for (const m of all) {
      expect(m).not.toMatch(/wrong|bad|fail|incorrect|stupid|oops/i);
      expect(m).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(m.includes(EM_DASH)).toBe(false);
    }
  });
  it('reviewText lists each fact once and counts the rest beyond eight', () => {
    expect(reviewText([])).toBe('');
    expect(reviewText([q, q, d])).toBe('7 × 8, 56 ÷ 8');
    const many = deckFor([...TABLES], false).slice(0, 12).map(makeQuestion);
    expect(reviewText(many)).toBe(`${many.slice(0, 8).map((x) => x.text).join(', ')} and 4 more`);
  });
  it('practice and sprint messages are kind in every case', () => {
    let s = startSprint();
    expect(sprintMessage(s, false)).toBe('Time is up. No points this time, and that is fine. Learn mode shows every fact with dots.');
    s = answerSprint(answerSprint(s, q, true), d, false);
    expect(sprintMessage(s, false)).toBe('Time is up! 1 right answer in 60 seconds. Worth another look: 56 ÷ 8.');
    expect(sprintMessage(s, true)).toBe('Time is up! 1 right answer in 60 seconds. That is your best sprint yet. Worth another look: 56 ÷ 8.');
    for (const m of [sprintMessage(startSprint(), true), sprintMessage(s, true), plural(3, 'right answer')]) {
      expect(m).not.toMatch(/NaN|undefined|null|Infinity|wrong|fail/i);
      expect(m.includes(EM_DASH)).toBe(false);
    }
  });
  it('the copy lines say what happened, including when nothing has', () => {
    let p = startPractice(buildRound([3], false, mulberry32(1)));
    expect(practiceSummary([3], p)).toBe('Times Tables practice (3 times): not finished yet');
    expect(practiceSummary([3], null)).toBe('Times Tables practice (3 times): not finished yet');
    while (!p.done) p = answerPractice(p, true);
    expect(practiceSummary([2, 5, 10], p)).toBe('Times Tables practice (2, 5 and 10 times): 10 of 10 right the first time');
    expect(sprintSummary([2, 5, 10], null)).toBe('Times Tables sprint (2, 5 and 10 times): not played yet');
    expect(sprintSummary([2, 5, 10], { right: 14, asked: 15, review: [] })).toBe('Times Tables sprint (2, 5 and 10 times): 14 right in 60 seconds');
    expect(learnSummary(7)).toBe('Times Tables: learning the 7 times table');
    expect(learnSummary(99)).toBe('Times Tables: learning the 2 times table');
  });
});

describe('cleanSprint, cleanRounds and sanitiseStored', () => {
  it('whole numbers within the caps', () => {
    expect(cleanSprint(1)).toBe(1);
    expect(cleanSprint(999)).toBe(999);
    expect(cleanRounds(9999)).toBe(9999);
    for (const bad of [0, -1, 1.5, NaN, Infinity, '5', null, undefined, {}, [], true, 5n]) { expect(cleanSprint(bad), String(bad)).toBeNull(); expect(cleanRounds(bad)).toBeNull(); }
    expect(cleanSprint(1000)).toBeNull();
    expect(cleanRounds(10000)).toBeNull();
    expect(cleanRounds(1000)).toBe(1000);
  });
  it('keeps a good payload and reads JSON text', () => {
    expect(sanitiseStored({ sprint: 14, rounds: 3 })).toEqual({ sprint: 14, rounds: 3 });
    expect(sanitiseStored('{"sprint":21}')).toEqual({ sprint: 21 });
  });
  it('returns nothing for anything that is not a plain object', () => {
    for (const bad of [null, undefined, 42, true, '', 'not json', '[1]', '"x"', 'null', [], [1], NaN, () => 1, Symbol('x')]) expect(sanitiseStored(bad)).toEqual({});
  });
  it('drops unknown and prototype keys and bad values', () => {
    const s = sanitiseStored('{"__proto__":{"sprint":5},"constructor":3,"extra":9,"sprint":12,"rounds":-4}');
    expect(s).toEqual({ sprint: 12 });
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).sprint).toBeUndefined();
  });
  it('is quick on a hostile object', () => {
    const t = performance.now();
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 200000; i++) huge[`k${i}`] = 4;
    huge.sprint = 4;
    expect(sanitiseStored(huge)).toEqual({ sprint: 4 });
    expect(performance.now() - t).toBeLessThan(4000);
  }, 15_000);
  it('recordSprint keeps the first and the highest score and ignores zero and junk', () => {
    expect(recordSprint({}, 10)).toEqual({ saved: { sprint: 10 }, improved: false });
    expect(recordSprint({ sprint: 10 }, 12)).toEqual({ saved: { sprint: 12 }, improved: true });
    expect(recordSprint({ sprint: 10 }, 10)).toEqual({ saved: { sprint: 10 }, improved: false });
    expect(recordSprint({ sprint: 10 }, 4)).toEqual({ saved: { sprint: 10 }, improved: false });
    expect(recordSprint({ sprint: 10, rounds: 2 }, 0)).toEqual({ saved: { sprint: 10, rounds: 2 }, improved: false });
    for (const bad of [-1, NaN, 1.5, 5000, '9' as unknown as number]) expect(recordSprint({ rounds: 2 }, bad)).toEqual({ saved: { rounds: 2 }, improved: false });
    expect(recordSprint({ rounds: 2 }, 7).saved).toEqual({ rounds: 2, sprint: 7 });
  });
  it('recordRound adds one, stops at the cap and does not change its input', () => {
    const base = { sprint: 9 };
    const frozen = JSON.stringify(base);
    expect(recordRound(base)).toEqual({ sprint: 9, rounds: 1 });
    expect(JSON.stringify(base)).toBe(frozen);
    expect(recordRound({ rounds: 9999 })).toEqual({ rounds: 9999 });
    expect(recordRound({ rounds: -3 } as { rounds: number })).toEqual({ rounds: 1 });
  });
  it('toStorable round-trips through JSON and the sanitiser', () => {
    const s = { sprint: 5, rounds: 7 };
    expect(sanitiseStored(JSON.stringify(toStorable(s)))).toEqual(s);
    expect(toStorable({ sprint: 5, junk: 1 } as { sprint: number })).toEqual({ sprint: 5 });
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/times-tables', f), 'utf8');
  it('no Math.random anywhere in the game', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
  });
  it('buttons are at least 56 px (3.5rem) tall and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.ttb-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.ttb-key \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.ttb-choice \{[^}]*min-height: 4\.5rem;/);
    expect(text).toMatch(/#ttb-app \.ttb-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('the typing box takes digits only and does not suggest earlier answers', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/id="ttb-input"[^>]*inputmode="numeric"/);
    expect(text).toMatch(/id="ttb-input"[^>]*autocomplete="off"/);
    expect(text).toMatch(/id="ttb-input"[^>]*maxlength="3"/);
  });
  it('a sprint ignores an answer in the first 300 ms of a question (double tap guard)', () => {
    expect(read('Calculator.astro')).toMatch(/mode === 'sprint' && performance\.now\(\) - shownAt < 300/);
  });
  it('a control that hides or disables itself hands focus to a visible one (Stop, Show me in Learn, Show dots)', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/prev\.closest\('\[hidden\]'\)/); // renderPanels rescues focus from a hidden panel
    expect(text).toMatch(/dotsBtn\.disabled = true;[\s\S]{0,200}choiceBtns\[0\]\.focus/); // Show dots keeps focus in the game
  });
});
