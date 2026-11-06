/**
 * games-balloon-maths.test.ts - the engine behind `balloon-maths`.
 *
 * Pinned: for every topic and size, over 300 seeded rounds, every question has exactly one right
 * balloon (found by re-checking each balloon against an independent predicate rebuilt from the
 * question's own numbers, not from the stored answer), all balloon numbers are whole, different,
 * and inside the stated range, subtraction is never negative, the sizes use the number ranges the
 * guide page states, patterns follow their stated rule (recomputed by repeated addition or
 * doubling), the same seed gives the same round and no question repeats inside a round, the right
 * balloon sits in each place about equally often, the round state machine (a wrong pop leaves the
 * balloon tried, a star only on a first-try win, nothing happens on junk), the offers to try bigger
 * numbers, saved best sanitising, and kind wording.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  TOPICS, SIZES, DEFAULT_TOPIC, DEFAULT_SIZE, ROUND_LENGTH, OPTION_CAP,
  topicById, sizeById, balloonCount, mulberry32, ruleTerm, describeRule, buildOptions, makeQuestion, makeRound, mixedTopics, dotAid,
  newPlay, popBalloon, advance, balloonsLeft, offerBigger, bestKey, sanitiseBest, parseSeedParam,
  plural, questionMessage, rightMessage, wrongMessage, finishMessage, bestMessage, balloonLabel, offerMessage, shareText,
  type Question, type TopicId, type SizeId, type Rule, type Play,
} from '../src/components/apps-private/balloon-maths/helpers';

const SIZE_IDS: SizeId[] = ['little', 'middle', 'big'];
const TOPIC_IDS: TopicId[] = ['add', 'sub', 'times', 'bigger', 'pattern', 'mixed'];

/** Independent: terms of a pattern by repeated addition or doubling, never by the formula in the engine. */
const termsByHand = (rule: Rule, count: number): number[] => {
  const out: number[] = [];
  let v = rule.start;
  for (let i = 0; i < count; i++) {
    out.push(v);
    if (rule.t === 'step') v += rule.step;
    else if (rule.t === 'double') v *= 2;
    else v += i % 2 === 0 ? rule.s1 : rule.s2;
  }
  return out;
};

/** Independent predicate: is balloon value n a right answer to this question, from the question's own numbers? */
const isRight = (q: Question, n: number): boolean => {
  switch (q.kind) {
    case 'add': return n === q.a! + q.b!;
    case 'sub': return n === q.a! - q.b!;
    case 'times': return n === q.a! * q.b!;
    case 'bigger': return q.options.every((o) => o <= n);
    case 'smaller': return q.options.every((o) => o >= n);
    case 'next':
    case 'gap': return n === termsByHand(q.rule!, q.terms!.length)[q.hole!];
  }
};

const cap = (kind: Question['kind'], size: SizeId): number => OPTION_CAP[kind][size];

const check = (q: Question, size: SizeId): void => {
  const where = `${q.kind} ${q.text} (${size})`;
  expect(q.options, where).toHaveLength(balloonCount(size));
  expect(new Set(q.options).size, where).toBe(q.options.length);
  for (const o of q.options) {
    expect(Number.isInteger(o), where).toBe(true);
    expect(o, where).toBeGreaterThanOrEqual(0);
    expect(o, where).toBeLessThanOrEqual(cap(q.kind, size));
  }
  // Exactly one balloon is right, and it is the one the question points at.
  const right = q.options.map((o, i) => (isRight(q, o) ? i : -1)).filter((i) => i >= 0);
  expect(right, where).toEqual([q.correct]);
  expect(q.options[q.correct], where).toBe(q.answer);
  expect(Number.isInteger(q.answer), where).toBe(true);
  expect(q.fact, where).toContain(String(q.answer));
  expect(q.speak.length, where).toBeGreaterThan(5);
  // Ranges and text per kind.
  if (q.kind === 'add') {
    expect(q.text).toBe(`${q.a} + ${q.b} = ?`);
    expect(q.a!).toBeGreaterThanOrEqual(1);
    expect(q.b!).toBeGreaterThanOrEqual(1);
    expect(q.a! + q.b!).toBeLessThanOrEqual(size === 'little' ? 10 : size === 'middle' ? 20 : 100);
    if (size === 'big') expect(q.a!).toBeGreaterThanOrEqual(10);
  }
  if (q.kind === 'sub') {
    expect(q.text).toBe(`${q.a} − ${q.b} = ?`);
    expect(q.a! - q.b!).toBeGreaterThanOrEqual(1); // never negative, never zero
    expect(q.a!).toBeLessThanOrEqual(size === 'little' ? 10 : size === 'middle' ? 20 : 100);
    expect(q.b!).toBeGreaterThanOrEqual(1);
  }
  if (q.kind === 'times') {
    expect(q.text).toBe(`${q.a} × ${q.b} = ?`);
    expect(q.answer).toBeLessThanOrEqual(size === 'little' ? 20 : size === 'middle' ? 100 : 144);
    if (size === 'little') { expect(q.a!).toBeGreaterThanOrEqual(2); expect(q.a!).toBeLessThanOrEqual(4); expect(q.b!).toBeLessThanOrEqual(5); }
    if (size === 'middle') { expect([2, 3, 4, 5, 10]).toContain(q.a!); expect(q.b!).toBeLessThanOrEqual(10); }
    if (size === 'big') { expect(q.a!).toBeGreaterThanOrEqual(2); expect(q.a!).toBeLessThanOrEqual(12); expect(q.b!).toBeGreaterThanOrEqual(2); expect(q.b!).toBeLessThanOrEqual(12); }
  }
  if (q.kind === 'bigger') expect(q.text).toBe('Pop the BIGGEST number');
  if (q.kind === 'smaller') expect(q.text).toBe('Pop the SMALLEST number');
  if (q.kind === 'next' || q.kind === 'gap') {
    const terms = termsByHand(q.rule!, q.terms!.length);
    expect(q.terms, where).toEqual(terms);
    for (const t of terms) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(cap(q.kind, size)); }
    expect(q.text).toBe(terms.map((t, i) => (i === q.hole ? '?' : String(t))).join(', '));
    expect(q.text.split('?').length - 1).toBe(1);
    if (q.kind === 'next') { expect(q.hole).toBe(terms.length - 1); expect(terms.length).toBe(q.rule!.t === 'alt' ? 6 : 5); }
    if (q.kind === 'gap') { expect(q.hole!).toBeGreaterThanOrEqual(1); expect(q.hole!).toBeLessThanOrEqual(terms.length - 2); }
    // The engine's formula agrees with the hand-built terms.
    terms.forEach((t, i) => expect(ruleTerm(q.rule!, i)).toBe(t));
    if (size === 'little') expect(q.rule!.t === 'step' && q.rule!.step > 0 && q.rule!.step <= 5).toBe(true);
    if (size === 'middle') expect(q.rule!.t).toBe('step');
  }
};

describe('topics and sizes', () => {
  it('has six topics and three sizes with plain names', () => {
    expect(TOPICS.map((t) => t.id)).toEqual(['add', 'sub', 'times', 'bigger', 'pattern', 'mixed']);
    expect(TOPICS.map((t) => t.name)).toEqual(['Add', 'Take away', 'Times', 'Biggest', 'Patterns', 'Mixed']);
    expect(SIZES.map((s) => [s.id, s.name, s.range])).toEqual([['little', 'Little', 'add up to 10'], ['middle', 'Middle', 'add up to 20'], ['big', 'Big', 'add up to 100']]);
    expect(DEFAULT_TOPIC).toBe('add');
    expect(DEFAULT_SIZE).toBe('little');
    expect(ROUND_LENGTH).toBe(10);
    expect(new Set(TOPICS.map((t) => t.key)).size).toBe(6);
    expect(balloonCount('little')).toBe(3);
    expect(balloonCount('middle')).toBe(4);
    expect(balloonCount('big')).toBe(4);
  });

  it('looks topics and sizes up safely', () => {
    expect(topicById('times')!.name).toBe('Times');
    expect(sizeById('big')!.n).toBe(3);
    for (const junk of ['', 'ADD', '__proto__', 'constructor', 3, null, undefined, [], {}]) {
      expect(topicById(junk)).toBeNull();
      expect(sizeById(junk)).toBeNull();
    }
  });
});

describe('every question has exactly one right balloon', () => {
  for (const size of SIZE_IDS) {
    for (const topic of TOPIC_IDS) {
      it(`${topic} / ${size}: 300 seeded rounds of ${ROUND_LENGTH}`, () => {
        for (let seed = 1; seed <= 300; seed++) {
          const round = makeRound(topic, size, seed);
          expect(round).toHaveLength(ROUND_LENGTH);
          for (const q of round) check(q, size);
        }
      }, 60_000);
    }
  }

  it('Little times uses 2, 3 or 4 times 1 to 5; Middle uses the 2, 3, 4, 5 and 10 tables up to 10; none of them is mixed into Little', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 100; seed++) for (const q of makeRound('times', 'middle', seed)) seen.add(q.a!);
    expect([...seen].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 10]);
    expect(mixedTopics('little')).toEqual(['add', 'sub', 'bigger', 'pattern']);
    expect(mixedTopics('middle')).toContain('times');
    for (let seed = 1; seed <= 100; seed++) for (const q of makeRound('mixed', 'little', seed)) expect(q.kind).not.toBe('times');
  });

  it('Big patterns include doubling and alternating steps as well as plain counting on', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) for (const q of makeRound('pattern', 'big', seed)) kinds.add(q.rule!.t);
    expect([...kinds].sort()).toEqual(['alt', 'double', 'step']);
    const dirs = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) for (const q of makeRound('pattern', 'middle', seed)) dirs.add((q.rule as { step: number }).step > 0 ? 'up' : 'down');
    expect([...dirs].sort()).toEqual(['down', 'up']);
  });

  it('both "biggest" and "smallest" questions turn up, and both next-number and missing-number patterns', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) for (const q of [...makeRound('bigger', 'middle', seed), ...makeRound('pattern', 'middle', seed)]) kinds.add(q.kind);
    expect([...kinds].sort()).toEqual(['bigger', 'gap', 'next', 'smaller']);
  });

  it('a mixed round uses every topic available to the size, spread evenly (each one 2 times in 10 for four topics, ~2 for five)', () => {
    for (const size of SIZE_IDS) {
      const pool = mixedTopics(size);
      for (let seed = 1; seed <= 50; seed++) {
        const counts = new Map<string, number>();
        for (const q of makeRound('mixed', size, seed)) {
          const t = q.kind === 'smaller' ? 'bigger' : q.kind === 'next' || q.kind === 'gap' ? 'pattern' : q.kind;
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        for (const t of pool) {
          expect(counts.get(t) ?? 0, `${size} seed ${seed} ${t}`).toBeGreaterThanOrEqual(1);
          expect(counts.get(t) ?? 0).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});

describe('seeds and variety', () => {
  it('the same seed gives the same round, different seeds give different rounds', () => {
    for (const size of SIZE_IDS) {
      expect(makeRound('mixed', size, 77)).toEqual(makeRound('mixed', size, 77));
      const seen = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) seen.add(makeRound('add', size, seed).map((q) => q.text).join('|'));
      expect(seen.size).toBeGreaterThan(35);
    }
  });

  it('no question repeats inside a round (for every topic and size, 300 seeds)', () => {
    for (const size of SIZE_IDS) {
      for (const topic of TOPIC_IDS) {
        for (let seed = 1; seed <= 300; seed++) {
          const round = makeRound(topic, size, seed);
          const keys = round.map((q) => (q.kind === 'bigger' || q.kind === 'smaller' ? `${q.text}|${q.options.join(',')}` : q.text));
          expect(new Set(keys).size, `${topic} ${size} seed ${seed}`).toBe(ROUND_LENGTH);
        }
      }
    }
  }, 60_000);

  it('the right balloon is in each place about equally often', () => {
    for (const size of ['little', 'big'] as const) {
      const n = balloonCount(size);
      const counts = new Array(n).fill(0);
      const rng = mulberry32(3);
      const total = 4000;
      for (let i = 0; i < total; i++) counts[makeQuestion('add', size, rng).correct]++;
      for (const c of counts) {
        expect(c).toBeGreaterThan((total / n) * 0.85);
        expect(c).toBeLessThan((total / n) * 1.15);
      }
    }
  });

  it('wrong balloons are near the answer: Little add keeps every number on the balloons within 0 to 10', () => {
    for (let seed = 1; seed <= 100; seed++) for (const q of makeRound('add', 'little', seed)) for (const o of q.options) { expect(o).toBeGreaterThanOrEqual(0); expect(o).toBeLessThanOrEqual(10); }
  });
});

describe('building balloon numbers', () => {
  it('always has the answer once, wrong numbers whole and different, inside the range, even in a tiny range', () => {
    const rng = mulberry32(9);
    for (let t = 0; t < 2000; t++) {
      const lo = Math.floor(rng() * 5);
      const hi = lo + 3 + Math.floor(rng() * 20);
      const answer = lo + Math.floor(rng() * (hi - lo + 1));
      const count = 3 + Math.floor(rng() * 2);
      const { options, correct } = buildOptions(rng, answer, count, lo, hi, [answer + 1, answer - 1, 0, hi]);
      expect(options).toHaveLength(count);
      expect(new Set(options).size).toBe(count);
      expect(options[correct]).toBe(answer);
      expect(options.filter((o) => o === answer)).toHaveLength(1);
      for (const o of options) { expect(Number.isInteger(o)).toBe(true); expect(o).toBeGreaterThanOrEqual(lo); expect(o).toBeLessThanOrEqual(hi); }
    }
  });

  it('is deterministic for a seed', () => {
    const a = buildOptions(mulberry32(5), 7, 4, 0, 20, [6, 8]);
    const b = buildOptions(mulberry32(5), 7, 4, 0, 20, [6, 8]);
    expect(a).toEqual(b);
  });
});

describe('patterns follow their rule', () => {
  it('terms by formula equal terms by repeated adding, for each rule', () => {
    expect(termsByHand({ t: 'step', start: 4, step: 3 }, 5)).toEqual([4, 7, 10, 13, 16]);
    expect(termsByHand({ t: 'step', start: 20, step: -5 }, 5)).toEqual([20, 15, 10, 5, 0]);
    expect(termsByHand({ t: 'double', start: 3 }, 5)).toEqual([3, 6, 12, 24, 48]);
    expect(termsByHand({ t: 'alt', start: 1, s1: 2, s2: 5 }, 6)).toEqual([1, 3, 8, 10, 15, 17]);
    const rules: Rule[] = [{ t: 'step', start: 4, step: 3 }, { t: 'step', start: 20, step: -5 }, { t: 'double', start: 3 }, { t: 'alt', start: 1, s1: 2, s2: 5 }, { t: 'alt', start: 0, s1: 9, s2: 1 }];
    for (const r of rules) termsByHand(r, 8).forEach((t, i) => expect(ruleTerm(r, i)).toBe(t));
  });

  it('describes a rule in words', () => {
    expect(describeRule({ t: 'step', start: 0, step: 3 })).toBe('add 3 each time');
    expect(describeRule({ t: 'step', start: 20, step: -5 })).toBe('take away 5 each time');
    expect(describeRule({ t: 'double', start: 1 })).toBe('double each time');
    expect(describeRule({ t: 'alt', start: 0, s1: 2, s2: 3 })).toBe('add 2, then add 3, again and again');
  });
});

describe('dots for the little numbers', () => {
  it('shows dots for Little add and take away only, matching the numbers', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const q of makeRound('add', 'little', seed)) expect(dotAid(q, 'little')).toEqual({ first: q.a, second: q.b, takeAway: false });
      for (const q of makeRound('sub', 'little', seed)) expect(dotAid(q, 'little')).toEqual({ first: q.a, second: q.b, takeAway: true });
      for (const q of makeRound('bigger', 'little', seed)) expect(dotAid(q, 'little')).toBeNull();
      for (const q of makeRound('add', 'middle', seed)) expect(dotAid(q, 'middle')).toBeNull();
    }
  });
});

describe('following a round', () => {
  const round = makeRound('add', 'little', 5);
  const wrongOnes = (q: Question): number[] => q.options.map((_, i) => i).filter((i) => i !== q.correct);

  it('a right pop on the first try wins a star and solves the question', () => {
    const p0 = newPlay(round);
    const { play, result } = popBalloon(p0, round[0].correct);
    expect(result).toBe('right');
    expect(play.solved).toBe(true);
    expect(play.stars).toBe(1);
    expect(play.firstTry).toEqual([true]);
    expect(p0.solved).toBe(false); // the old state is untouched
  });

  it('a wrong pop leaves the balloon tried, and a later right pop wins no star', () => {
    let p = newPlay(round);
    const w = wrongOnes(round[0])[0];
    let r = popBalloon(p, w);
    expect(r.result).toBe('wrong');
    expect(r.play.tried).toEqual([w]);
    expect(r.play.solved).toBe(false);
    expect(balloonsLeft(r.play)).toBe(2);
    p = r.play;
    r = popBalloon(p, w); // popping a tried balloon again does nothing
    expect(r.result).toBe('ignored');
    expect(r.play).toBe(p);
    r = popBalloon(p, round[0].correct);
    expect(r.result).toBe('right');
    expect(r.play.stars).toBe(0);
    expect(r.play.firstTry).toEqual([false]);
  });

  it('after the right balloon is popped nothing else can be popped until the next question', () => {
    let p = popBalloon(newPlay(round), round[0].correct).play;
    for (const i of [0, 1, 2]) expect(popBalloon(p, i).result).toBe('ignored');
    p = advance(p);
    expect(p.index).toBe(1);
    expect(p.solved).toBe(false);
    expect(p.tried).toEqual([]);
  });

  it('advance does nothing before the question is solved', () => {
    const p = newPlay(round);
    expect(advance(p)).toBe(p);
    const w = popBalloon(p, wrongOnes(round[0])[0]).play;
    expect(advance(w)).toBe(w);
  });

  it('ignores junk balloon numbers', () => {
    const p = newPlay(round);
    for (const i of [-1, 3, 99, 1.5, NaN, Infinity]) expect(popBalloon(p, i).result).toBe('ignored');
  });

  it('finishes after the tenth question and then ignores everything', () => {
    let p: Play = newPlay(round);
    for (let q = 0; q < ROUND_LENGTH; q++) {
      expect(p.finished).toBe(false);
      p = popBalloon(p, round[q].correct).play;
      p = advance(p);
    }
    expect(p.finished).toBe(true);
    expect(p.stars).toBe(10);
    expect(p.firstTry).toHaveLength(10);
    expect(popBalloon(p, 0).result).toBe('ignored');
    expect(advance(p)).toBe(p);
    expect(newPlay([]).finished).toBe(true);
  });

  it('random play always finishes, stars equal the questions answered on the first try, and a round takes at most 10 x balloons pops', () => {
    const rng = mulberry32(12);
    for (let g = 0; g < 400; g++) {
      const size = SIZE_IDS[g % 3];
      const qs = makeRound(TOPIC_IDS[g % 6], size, g + 1);
      let p: Play = newPlay(qs);
      let pops = 0;
      while (!p.finished && pops < 200) {
        const i = Math.floor(rng() * (balloonCount(size) + 1)) - (rng() < 0.1 ? 1 : 0); // sometimes junk
        const r = popBalloon(p, i);
        p = r.play;
        pops++;
        if (p.solved && !p.finished) p = advance(p);
        else if (p.solved && p.finished) break;
        expect(p.stars).toBeLessThanOrEqual(ROUND_LENGTH);
        expect(p.tried.length).toBeLessThan(balloonCount(size));
      }
      expect(p.finished).toBe(true);
      expect(p.firstTry).toHaveLength(ROUND_LENGTH);
      expect(p.stars).toBe(p.firstTry.filter(Boolean).length);
    }
  });

  it('never leaves a question with no way to win: after every wrong pop there is still the right balloon', () => {
    for (const size of SIZE_IDS) {
      for (const q of makeRound('mixed', size, 11)) {
        let p = newPlay([q]);
        for (const w of q.options.map((_, i) => i).filter((i) => i !== q.correct)) {
          p = popBalloon(p, w).play;
          expect(p.tried).not.toContain(q.correct);
          expect(balloonsLeft(p)).toBeGreaterThanOrEqual(1);
        }
        expect(popBalloon(p, q.correct).result).toBe('right');
      }
    }
  });
});

describe('offers and saved results', () => {
  it('offers bigger numbers after 9 or 10 first-try stars, never from Big', () => {
    expect(offerBigger(10, 10, 'little')).toBe('middle');
    expect(offerBigger(9, 10, 'little')).toBe('middle');
    expect(offerBigger(9, 10, 'middle')).toBe('big');
    expect(offerBigger(8, 10, 'little')).toBeNull();
    expect(offerBigger(10, 10, 'big')).toBeNull();
    expect(offerBigger(0, 0, 'little')).toBeNull();
    expect(offerMessage('middle')).toBe('Ready for bigger numbers? Try Middle (add up to 20).');
  });

  it('builds the saved-best key from topic and size', () => {
    expect(bestKey('add', 'little')).toBe('a1');
    expect(bestKey('mixed', 'big')).toBe('m3');
    expect(bestKey('sub', 'middle')).toBe('s2');
    const keys = new Set<string>();
    for (const t of TOPIC_IDS) for (const s of SIZE_IDS) keys.add(bestKey(t, s));
    expect(keys.size).toBe(18);
  });

  it('keeps small whole numbers 1 to 10 under the 18 valid keys and nothing else', () => {
    expect(sanitiseBest({ a1: 7, m3: 10, s2: 1 })).toEqual({ a1: 7, m3: 10, s2: 1 });
    expect(sanitiseBest({ a1: 0, a2: 11, a3: 1.5, s1: NaN, s2: '5', s3: -2, z9: 4, x1: Infinity })).toEqual({});
    for (const junk of [null, undefined, 3, 'x', [], [1], JSON.parse('{"__proto__":{"a1":3}}')]) expect(sanitiseBest(junk)).toEqual({});
    expect(Object.keys(sanitiseBest({ a1: 3, extra: 9 }))).toEqual(['a1']);
  });

  it('reads a seed only as a whole number from 1 to 2^32 - 1', () => {
    expect(parseSeedParam('1')).toBe(1);
    expect(parseSeedParam('4294967295')).toBe(4294967295);
    for (const junk of ['', '0', '-3', '1.5', '4294967296', 'abc', '1e3', ' 5', '0x10', 5, null, undefined, [], {}]) expect(parseSeedParam(junk)).toBeNull();
  });
});

describe('words for the child', () => {
  it('asks the question in words, and praises the right balloon with the actual fact', () => {
    const q = makeQuestion('add', 'little', mulberry32(1));
    expect(questionMessage(2, 10, q)).toBe(`Question 3 of 10. ${q.speak}`);
    const add: Question = { kind: 'add', text: '4 + 3 = ?', speak: 'What is 4 plus 3?', fact: '4 plus 3 is 7', answer: 7, options: [6, 7, 9], correct: 1, a: 4, b: 3 };
    expect(rightMessage(add, true, 0)).toBe('Yes! 4 plus 3 is 7. You earned a star!');
    expect(rightMessage(add, false, 1)).toBe('Well done! 4 plus 3 is 7. You found it!');
    expect(wrongMessage(6, 2)).toBe('That one is 6. Not this time, so try another balloon. 2 left.');
    expect(wrongMessage(6, 1)).toBe('That one is 6. Not this time, so try the last balloon.');
  });

  it('wrap-up messages are right for no stars, some stars and all stars', () => {
    expect(finishMessage(10, 10)).toBe('You popped all 10 balloons on the first try. 10 stars!');
    expect(finishMessage(7, 10)).toBe('You popped all 10 balloons and won 7 stars on the first try. Well done!');
    expect(finishMessage(1, 10)).toBe('You popped all 10 balloons and won 1 star on the first try. Well done!');
    expect(finishMessage(0, 10)).toBe('You popped all 10 balloons. Every one was a good try. Press Play again for new questions.');
    expect(bestMessage(8, 6)).toBe(' That is your best so far!');
    expect(bestMessage(8, 0)).toBe('');
    expect(bestMessage(6, 8)).toBe('');
  });

  it('never scolds', () => {
    const q: Question = { kind: 'add', text: '4 + 3 = ?', speak: 'What is 4 plus 3?', fact: '4 plus 3 is 7', answer: 7, options: [6, 7, 9], correct: 1, a: 4, b: 3 };
    const all = [rightMessage(q, true, 0), rightMessage(q, false, 3), wrongMessage(6, 2), wrongMessage(6, 1), finishMessage(0, 10), finishMessage(5, 10), finishMessage(10, 10), offerMessage('big')];
    for (const m of all) expect(m).not.toMatch(/wrong|fail|bad|oops|incorrect|mistake|error/i);
  });

  it('labels balloons in each state and writes share text for every state', () => {
    expect(balloonLabel(7, false, false)).toBe('Balloon with 7');
    expect(balloonLabel(7, true, false)).toBe('Balloon with 7, already tried');
    expect(balloonLabel(7, false, true)).toBe('Balloon with 7, popped');
    expect(shareText('Add', 'Little', 8, 10, true, 'U')).toBe('Balloon Maths - Add, little: 8 stars out of 10\nU');
    expect(shareText('Add', 'Little', 1, 10, true, 'U')).toBe('Balloon Maths - Add, little: 1 star out of 10\nU');
    expect(shareText('Add', 'Little', 0, 10, false, 'U')).toBe('Balloon Maths - Add, little: 0 stars so far, round not finished\nU');
    expect(shareText('Add', 'Little', 3, 10, false, 'U')).toBe('Balloon Maths - Add, little: 3 stars so far, round not finished\nU');
    expect(shareText('Add', 'Little', 1, 10, false, 'U')).toBe('Balloon Maths - Add, little: 1 star so far, round not finished\nU');
    expect(plural(1, 'star')).toBe('1 star');
    expect(plural(0, 'star')).toBe('0 stars');
  });
});

describe('calm motion', () => {
  it('the page turns the floating off under reduced motion', () => {
    const calc = readFileSync(join(resolve(__dirname, '..'), 'src/components/apps-private/balloon-maths/Calculator.astro'), 'utf8');
    const block = calc.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n  \}/);
    expect(block, 'a reduced-motion block').not.toBeNull();
    expect(block![1]).toMatch(/\.bm-slot[^{]*\{[^}]*animation:\s*none/);
    expect(calc).toMatch(/@keyframes bm-float/);
    expect(calc).not.toMatch(/setInterval|setTimeout\(/); // no timers: nothing happens unless a balloon is tapped
  });
});

describe('seeded randomness', () => {
  it('gives the same numbers for the same seed and stays in [0, 1)', () => {
    const a = mulberry32(9), b = mulberry32(9);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
