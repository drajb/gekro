/**
 * games-clock-reader.test.ts - the engine behind `clock-reader`.
 *
 * Pinned: where both hands point for all 720 times of a 12 hour clock, checked against an
 * independent model (minutes since 12 o'clock) and against the textbook angle between the
 * hands, including the way the hour hand drifts half a degree a minute; that a hand dragged to
 * an angle gives back the right time at every level (hour, half hour, quarter, five minutes,
 * every minute); the tick marks, numbers and coloured ring the page draws; the words for every
 * time ("quarter past three", "twenty to four"); that the three choices for reading a clock are
 * always three different valid times, with the right one in each place about equally often and
 * the usual slip (hands swapped over) among them; the matching pairs (four different clocks,
 * time cards in a different order, solvable, no state that can break); the checks for setting a
 * clock; and that what comes out of localStorage is sanitised before the page sees it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CENTER, FACE_R, RING_INNER, RING_OUTER, NUMERAL_R, HOUR_HAND, MINUTE_HAND, MINUTE_DEG, HOUR_DEG, HOUR_HAND_DRIFT_DEG, MATCH_PAIRS, MAX_STREAK,
  MODES, LEVEL_KEYS, LEVELS, DEFAULT_LEVEL, parseMode, parseLevel, mulberry32, shuffle, plural,
  cleanTime, sameTime, timeKey, formatTime, numberWord, timeWords, normAngle, minuteAngle, hourAngle, polar, angleOfPoint,
  nearestMinute, minuteFromAngle, hourFromAngle, stepHour, stepMinute, ticks, numerals, ringPath, ringQuarters, handEnds, hourHandPhrase, handsWords,
  randomTime, timeChoices, makeMatch, tryMatch, setFeedback, setSuccess, readRight, readMiss, matchRight, matchMiss,
  cleanStreak, sanitiseStored, toStorable, recordStreak, resultSummary,
  type Time, type LevelKey,
} from '../src/components/apps-private/clock-reader/helpers';

const EM_DASH = String.fromCharCode(0x2014);

const allTimes = (): Time[] => {
  const out: Time[] = [];
  for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m++) out.push({ h, m });
  return out;
};
const levelTimes = (lv: LevelKey): Time[] => allTimes().filter((t) => LEVELS[lv].minutes.includes(t.m));

describe('constants quoted on the content page', () => {
  it('match the spec', () => {
    expect(CENTER).toBe(100);
    expect(FACE_R).toBe(94);
    expect(RING_INNER).toBe(80);
    expect(RING_OUTER).toBe(94);
    expect(NUMERAL_R).toBe(62);
    expect(HOUR_HAND).toBe(40);
    expect(MINUTE_HAND).toBe(62);
    expect(MINUTE_DEG).toBe(6);
    expect(HOUR_DEG).toBe(30);
    expect(HOUR_HAND_DRIFT_DEG).toBe(0.5);
    expect(MATCH_PAIRS).toBe(4);
    expect(MAX_STREAK).toBe(999);
    expect([...MODES]).toEqual(['read', 'set', 'match']);
    expect(DEFAULT_LEVEL).toBe('quarter');
  });
  it('the hour hand is shorter than the minute hand, and both fit inside the numbers and the face', () => {
    expect(HOUR_HAND).toBeLessThan(MINUTE_HAND);
    expect(MINUTE_HAND).toBeLessThanOrEqual(NUMERAL_R);
    expect(NUMERAL_R).toBeLessThan(RING_INNER);
    expect(RING_OUTER).toBeLessThanOrEqual(FACE_R);
  });
  it('five levels with the minutes the page quotes', () => {
    expect([...LEVEL_KEYS]).toEqual(['hours', 'half', 'quarter', 'five', 'minute']);
    expect(LEVELS.hours).toEqual({ label: 'On the hour', minutes: [0] });
    expect(LEVELS.half).toEqual({ label: 'Half hours', minutes: [0, 30] });
    expect(LEVELS.quarter).toEqual({ label: 'Quarter hours', minutes: [0, 15, 30, 45] });
    expect(LEVELS.five.label).toBe('Five minutes');
    expect(LEVELS.five.minutes).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(LEVELS.minute.label).toBe('Every minute');
    expect(LEVELS.minute.minutes).toHaveLength(60);
    expect(LEVELS.minute.minutes[59]).toBe(59);
  });
  it('parseMode and parseLevel fall back', () => {
    for (const m of MODES) expect(parseMode(m)).toBe(m);
    for (const bad of ['', 'play', null, undefined, 3, '__proto__']) { expect(parseMode(bad)).toBe('read'); expect(parseLevel(bad)).toBe('quarter'); }
    for (const k of LEVEL_KEYS) expect(parseLevel(k)).toBe(k);
  });
});

describe('times and their words', () => {
  it('cleanTime puts any numbers on a 12 hour clock', () => {
    expect(cleanTime({ h: 0, m: 0 })).toEqual({ h: 12, m: 0 });
    expect(cleanTime({ h: 13, m: 60 })).toEqual({ h: 1, m: 0 });
    expect(cleanTime({ h: -1, m: -1 })).toEqual({ h: 11, m: 59 });
    expect(cleanTime({ h: 3.9, m: 7.9 })).toEqual({ h: 3, m: 7 });
    expect(cleanTime(null)).toEqual({ h: 12, m: 0 });
    expect(cleanTime({ h: NaN, m: Infinity })).toEqual({ h: 12, m: 0 });
    for (const t of allTimes()) expect(cleanTime(t)).toEqual(t);
  });
  it('formatTime writes the hour plain and the minutes with two digits', () => {
    expect(formatTime({ h: 3, m: 5 })).toBe('3:05');
    expect(formatTime({ h: 12, m: 0 })).toBe('12:00');
    expect(formatTime({ h: 9, m: 45 })).toBe('9:45');
    expect(formatTime({ h: 1, m: 59 })).toBe('1:59');
    expect(new Set(allTimes().map(formatTime)).size).toBe(720);
  });
  it('numberWord covers 0 to 59', () => {
    expect(numberWord(0)).toBe('zero');
    expect(numberWord(7)).toBe('seven');
    expect(numberWord(13)).toBe('thirteen');
    expect(numberWord(20)).toBe('twenty');
    expect(numberWord(25)).toBe('twenty-five');
    expect(numberWord(40)).toBe('forty');
    expect(numberWord(59)).toBe('fifty-nine');
    expect(numberWord(99)).toBe('fifty-nine');
    expect(numberWord(NaN)).toBe('zero');
  });
  it('timeWords says every five-minute time the way people do', () => {
    const table: [Time, string][] = [
      [{ h: 3, m: 0 }, "three o'clock"], [{ h: 3, m: 5 }, 'five past three'], [{ h: 3, m: 10 }, 'ten past three'], [{ h: 3, m: 15 }, 'quarter past three'],
      [{ h: 3, m: 20 }, 'twenty past three'], [{ h: 3, m: 25 }, 'twenty-five past three'], [{ h: 3, m: 30 }, 'half past three'],
      [{ h: 3, m: 35 }, 'twenty-five to four'], [{ h: 3, m: 40 }, 'twenty to four'], [{ h: 3, m: 45 }, 'quarter to four'],
      [{ h: 3, m: 50 }, 'ten to four'], [{ h: 3, m: 55 }, 'five to four'],
      [{ h: 12, m: 0 }, "twelve o'clock"], [{ h: 12, m: 45 }, 'quarter to one'], [{ h: 11, m: 50 }, 'ten to twelve'], [{ h: 11, m: 55 }, 'five to twelve'],
      [{ h: 12, m: 30 }, 'half past twelve'], [{ h: 1, m: 0 }, "one o'clock"],
    ];
    for (const [t, words] of table) expect(timeWords(t), formatTime(t)).toBe(words);
  });
  it('and the other minutes in plain counting', () => {
    expect(timeWords({ h: 3, m: 7 })).toBe('seven minutes past three');
    expect(timeWords({ h: 3, m: 1 })).toBe('one minute past three');
    expect(timeWords({ h: 3, m: 29 })).toBe('twenty-nine minutes past three');
    expect(timeWords({ h: 3, m: 31 })).toBe('twenty-nine minutes to four');
    expect(timeWords({ h: 3, m: 53 })).toBe('seven minutes to four');
    expect(timeWords({ h: 3, m: 59 })).toBe('one minute to four');
    expect(timeWords({ h: 12, m: 59 })).toBe('one minute to one');
  });
  it('all 720 times have words, with no junk in them', () => {
    const seen = new Set<string>();
    for (const t of allTimes()) {
      const w = timeWords(t);
      expect(w.length).toBeGreaterThan(4);
      expect(w).not.toMatch(/NaN|undefined|null|Infinity|zero/);
      expect(w.includes(EM_DASH)).toBe(false);
      seen.add(w);
    }
    expect(seen.size).toBe(720);
  });
  it('sameTime and timeKey', () => {
    expect(sameTime({ h: 3, m: 5 }, { h: 3, m: 5 })).toBe(true);
    expect(sameTime({ h: 3, m: 5 }, { h: 3, m: 6 })).toBe(false);
    expect(new Set(allTimes().map(timeKey)).size).toBe(720);
  });
});

describe('where the hands point', () => {
  /** Independent model: minutes since 12 o'clock, the hour hand turns 360 degrees in 720 minutes and the minute hand in 60. */
  const model = (t: Time) => {
    const minutes = (t.h % 12) * 60 + t.m;
    return { hour: (minutes / 720) * 360, minute: ((minutes % 60) / 60) * 360 };
  };
  it('both hands match the model for all 720 times', () => {
    for (const t of allTimes()) {
      const want = model(t);
      expect(hourAngle(t.h, t.m), formatTime(t)).toBeCloseTo(want.hour, 9);
      expect(minuteAngle(t.m), formatTime(t)).toBeCloseTo(want.minute, 9);
    }
  });
  it('known positions', () => {
    expect(hourAngle(12, 0)).toBe(0);
    expect(minuteAngle(0)).toBe(0);
    expect(hourAngle(3, 0)).toBe(90);
    expect(hourAngle(6, 0)).toBe(180);
    expect(hourAngle(9, 0)).toBe(270);
    expect(minuteAngle(15)).toBe(90);
    expect(minuteAngle(30)).toBe(180);
    expect(minuteAngle(45)).toBe(270);
    expect(hourAngle(3, 15)).toBe(97.5);
    expect(hourAngle(12, 30)).toBe(15);
    expect(hourAngle(11, 59)).toBeCloseTo(359.5, 9);
    expect(minuteAngle(59)).toBe(354);
  });
  it('the hour hand drifts half a degree a minute and sits half way between two numbers at half past', () => {
    for (let h = 1; h <= 12; h++) {
      for (let m = 0; m < 59; m++) expect(hourAngle(h, m + 1) - hourAngle(h, m)).toBeCloseTo(0.5, 9);
      expect(hourAngle(h, 30)).toBeCloseTo(normAngle((h % 12) * 30 + 15), 9);
      // At the start of every hour it is exactly on a number; a quarter of the way at quarter past.
      expect(hourAngle(h, 0) % 30).toBe(0);
      expect(hourAngle(h, 15) - hourAngle(h, 0)).toBeCloseTo(7.5, 9);
    }
  });
  it('the angle between the hands matches the textbook formula |30h - 5.5m| for all 720 times', () => {
    for (const t of allTimes()) {
      let want = Math.abs(30 * (t.h % 12) - 5.5 * t.m);
      if (want > 180) want = 360 - want;
      let got = Math.abs(hourAngle(t.h, t.m) - minuteAngle(t.m));
      if (got > 180) got = 360 - got;
      expect(got, formatTime(t)).toBeCloseTo(want, 9);
    }
  });
  it('the hands only coincide at 12:00 among whole minutes (and never differ by a bad sign)', () => {
    const together = allTimes().filter((t) => Math.abs(hourAngle(t.h, t.m) - minuteAngle(t.m)) < 1e-9);
    expect(together.map(formatTime)).toEqual(['12:00']);
  });
  it('angles are always in 0 up to 360, even for odd input', () => {
    for (const t of allTimes()) {
      expect(hourAngle(t.h, t.m)).toBeGreaterThanOrEqual(0);
      expect(hourAngle(t.h, t.m)).toBeLessThan(360);
    }
    for (const bad of [NaN, Infinity, -Infinity, undefined as unknown as number]) {
      expect(minuteAngle(bad)).toBe(0);
      expect(hourAngle(bad, bad)).toBe(0);
    }
    expect(normAngle(-90)).toBe(270);
    expect(normAngle(720)).toBe(0);
    expect(normAngle(360)).toBe(0);
  });
  it('polar puts 12 at the top, 3 on the right, 6 at the bottom and 9 on the left', () => {
    expect(polar(50, 0)).toEqual({ x: 100, y: 50 });
    const r = polar(50, 90);
    expect(r.x).toBeCloseTo(150, 9);
    expect(r.y).toBeCloseTo(100, 9);
    const b = polar(50, 180);
    expect(b.x).toBeCloseTo(100, 9);
    expect(b.y).toBeCloseTo(150, 9);
    const l = polar(50, 270);
    expect(l.x).toBeCloseTo(50, 9);
    expect(l.y).toBeCloseTo(100, 9);
  });
  it('polar and angleOfPoint are inverses, and every point is the right distance from the centre', () => {
    for (let a = 0; a < 360; a += 0.5) {
      const p = polar(55, a);
      expect(Math.hypot(p.x - CENTER, p.y - CENTER)).toBeCloseTo(55, 9);
      const back = angleOfPoint(p.x, p.y);
      expect(Math.min(Math.abs(back - a), 360 - Math.abs(back - a))).toBeLessThan(1e-7);
    }
    expect(angleOfPoint(100, 100)).toBe(0);
    expect(angleOfPoint(100, 50)).toBe(0);
    expect(angleOfPoint(150, 100)).toBe(90);
    expect(angleOfPoint(NaN, NaN)).toBe(0);
  });
  it('handEnds gives the far end of each hand', () => {
    const t = handEnds({ h: 3, m: 0 });
    expect(t.minute.x).toBeCloseTo(100, 9);
    expect(t.minute.y).toBeCloseTo(100 - MINUTE_HAND, 9);
    expect(t.hour.x).toBeCloseTo(100 + HOUR_HAND, 9);
    expect(t.hour.y).toBeCloseTo(100, 9);
    for (const x of allTimes()) {
      const e = handEnds(x);
      expect(Math.hypot(e.hour.x - 100, e.hour.y - 100)).toBeCloseTo(HOUR_HAND, 9);
      expect(Math.hypot(e.minute.x - 100, e.minute.y - 100)).toBeCloseTo(MINUTE_HAND, 9);
    }
  });
});

describe('a hand dragged to an angle gives the time', () => {
  it('the minute hand: every minute round-trips at the every-minute level', () => {
    for (let m = 0; m < 60; m++) expect(minuteFromAngle(minuteAngle(m), 'minute')).toBe(m);
  });
  it('and every allowed minute round-trips at every level', () => {
    for (const lv of LEVEL_KEYS) for (const m of LEVELS[lv].minutes) expect(minuteFromAngle(minuteAngle(m), lv), `${lv} ${m}`).toBe(m);
  });
  it('any angle gives an allowed minute, and the nearest one, checked by brute force', () => {
    for (const lv of LEVEL_KEYS) {
      const mins = LEVELS[lv].minutes;
      for (let a = 0; a < 360; a += 0.37) {
        const got = minuteFromAngle(a, lv);
        expect(mins, `${lv} ${a}`).toContain(got);
        const v = a / 6;
        const dist = (m: number) => { const d = Math.abs(v - m); return Math.min(d, 60 - d); };
        const best = Math.min(...mins.map(dist));
        expect(dist(got)).toBeLessThanOrEqual(best + 1e-9);
      }
    }
  });
  it('a hand dropped just before 12 on the five-minute level reads 0 and not 60', () => {
    expect(minuteFromAngle(359, 'five')).toBe(0);
    expect(minuteFromAngle(1, 'five')).toBe(0);
    expect(minuteFromAngle(356, 'minute')).toBe(59);
    expect(minuteFromAngle(-4, 'minute')).toBe(59);
    expect(minuteFromAngle(NaN, 'quarter')).toBe(0);
  });
  it('on the hour level the minute hand can only be at 12', () => {
    for (let a = 0; a < 360; a += 7) expect(minuteFromAngle(a, 'hours')).toBe(0);
  });
  it('nearestMinute rounds round the dial and survives junk', () => {
    expect(nearestMinute(29.4, 'half')).toBe(30);
    expect(nearestMinute(44.9, 'half')).toBe(30);
    expect(nearestMinute(45.1, 'half')).toBe(0);
    expect(nearestMinute(59.9, 'five')).toBe(0);
    expect(nearestMinute(-1, 'five')).toBe(0);
    expect(nearestMinute(NaN, 'five')).toBe(0);
    expect(nearestMinute(7.6, 'five')).toBe(10);
  });
  it('the hour hand: dragging it to where it should be gives the hour, for all 720 times', () => {
    for (const t of allTimes()) expect(hourFromAngle(hourAngle(t.h, t.m), t.m), formatTime(t)).toBe(t.h);
  });
  it('and it still gives the hour with up to 14 degrees of slip either way', () => {
    for (const t of allTimes()) {
      for (const slip of [-14, -7, 7, 14]) expect(hourFromAngle(hourAngle(t.h, t.m) + slip, t.m), `${formatTime(t)} ${slip}`).toBe(t.h);
    }
  });
  it('the hour is always 1 to 12', () => {
    for (let a = -400; a < 800; a += 3) for (const m of [0, 17, 59]) {
      const h = hourFromAngle(a, m);
      expect(Number.isInteger(h) && h >= 1 && h <= 12).toBe(true);
    }
    expect(hourFromAngle(NaN, NaN)).toBe(12);
  });
  it('stepHour goes round, 12 then 1 and 1 then 12', () => {
    expect(stepHour(12, 1)).toBe(1);
    expect(stepHour(1, -1)).toBe(12);
    expect(stepHour(5, 1)).toBe(6);
    expect(stepHour(5, -1)).toBe(4);
    let h = 3;
    for (let i = 0; i < 12; i++) h = stepHour(h, 1);
    expect(h).toBe(3);
    expect(stepHour(5, 0)).toBe(6);
  });
  it('stepMinute moves to the next allowed minute and wraps with no change of hour', () => {
    expect(stepMinute(0, 1, 'hours')).toBe(0);
    expect(stepMinute(0, -1, 'hours')).toBe(0);
    expect(stepMinute(0, 1, 'half')).toBe(30);
    expect(stepMinute(30, 1, 'half')).toBe(0);
    expect(stepMinute(0, -1, 'quarter')).toBe(45);
    expect(stepMinute(45, 1, 'quarter')).toBe(0);
    expect(stepMinute(55, 1, 'five')).toBe(0);
    expect(stepMinute(0, -1, 'five')).toBe(55);
    expect(stepMinute(59, 1, 'minute')).toBe(0);
    expect(stepMinute(0, -1, 'minute')).toBe(59);
    for (const lv of LEVEL_KEYS) {
      let m = 0;
      for (let i = 0; i < LEVELS[lv].minutes.length; i++) { m = stepMinute(m, 1, lv); expect(LEVELS[lv].minutes).toContain(m); }
      expect(m).toBe(0);
    }
  });
});

describe('the face', () => {
  it('has 60 tick marks, a major one at every fifth minute, all on the ring', () => {
    const t = ticks();
    expect(t).toHaveLength(60);
    t.forEach((k, i) => {
      expect(k.major).toBe(i % 5 === 0);
      const a = Math.hypot(k.x1 - 100, k.y1 - 100);
      const b = Math.hypot(k.x2 - 100, k.y2 - 100);
      expect(a).toBeGreaterThanOrEqual(RING_INNER - 1e-9);
      expect(b).toBeLessThanOrEqual(RING_OUTER + 1e-9);
      expect(a).toBeLessThan(b);
      const ang = angleOfPoint(k.x2, k.y2);
      expect(Math.min(Math.abs(ang - i * 6), 360 - Math.abs(ang - i * 6))).toBeLessThan(1e-7);
    });
    expect(t.filter((k) => k.major)).toHaveLength(12);
    const major = t[0];
    const minor = t[1];
    expect(Math.hypot(major.x2 - major.x1, major.y2 - major.y1)).toBeGreaterThan(Math.hypot(minor.x2 - minor.x1, minor.y2 - minor.y1));
  });
  it('has the numbers 1 to 12 in the right places', () => {
    const n = numerals();
    expect(n.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const at = (k: number) => n.find((x) => x.n === k)!;
    expect(at(12).x).toBeCloseTo(100, 9);
    expect(at(12).y).toBeCloseTo(100 - NUMERAL_R, 9);
    expect(at(3).x).toBeCloseTo(100 + NUMERAL_R, 9);
    expect(at(3).y).toBeCloseTo(100, 9);
    expect(at(6).y).toBeCloseTo(100 + NUMERAL_R, 9);
    expect(at(9).x).toBeCloseTo(100 - NUMERAL_R, 9);
    for (const x of n) expect(Math.hypot(x.x - 100, x.y - 100)).toBeCloseTo(NUMERAL_R, 9);
  });
  it('the numbers sit where the hour hand points at the start of each hour', () => {
    for (const x of numerals()) {
      const p = polar(NUMERAL_R, hourAngle(x.n, 0));
      expect(p.x).toBeCloseTo(x.x, 9);
      expect(p.y).toBeCloseTo(x.y, 9);
    }
  });
  it('has four coloured quarters of the ring that start and end on the ring', () => {
    const q = ringQuarters();
    expect(q.map((x) => x.q)).toEqual([0, 1, 2, 3]);
    q.forEach((x, i) => {
      expect(x.d.startsWith('M ')).toBe(true);
      expect(x.d.endsWith('Z')).toBe(true);
      expect(x.d).not.toMatch(/NaN|undefined|Infinity/);
      const m = x.d.match(/^M ([\d.-]+) ([\d.-]+)/)!;
      const p = polar(RING_OUTER, i * 90);
      expect(Number(m[1])).toBeCloseTo(p.x, 1);
      expect(Number(m[2])).toBeCloseTo(p.y, 1);
    });
    expect(ringPath(80, 94, 0, 270)).toContain(' 1 1 ');
  });
});

describe('words about the hands', () => {
  it('the short hand: on a number, just past it, half way, or nearly at the next', () => {
    expect(hourHandPhrase({ h: 3, m: 0 })).toBe('on the 3');
    expect(hourHandPhrase({ h: 3, m: 15 })).toBe('just past the 3');
    expect(hourHandPhrase({ h: 3, m: 29 })).toBe('just past the 3');
    expect(hourHandPhrase({ h: 3, m: 30 })).toBe('half way between the 3 and the 4');
    expect(hourHandPhrase({ h: 3, m: 45 })).toBe('nearly at the 4');
    expect(hourHandPhrase({ h: 12, m: 45 })).toBe('nearly at the 1');
    expect(hourHandPhrase({ h: 12, m: 30 })).toBe('half way between the 12 and the 1');
  });
  it('handsWords describes both hands without giving the reading', () => {
    expect(handsWords({ h: 3, m: 45 })).toBe('The short hour hand is nearly at the 4. The long minute hand is on the 9.');
    expect(handsWords({ h: 12, m: 0 })).toBe('The short hour hand is on the 12. The long minute hand is on the 12.');
    expect(handsWords({ h: 3, m: 7 })).toBe('The short hour hand is just past the 3. The long minute hand is between the 1 and the 2.');
    expect(handsWords({ h: 3, m: 58 })).toBe('The short hour hand is nearly at the 4. The long minute hand is between the 11 and the 12.');
    expect(handsWords({ h: 3, m: 2 })).toBe('The short hour hand is just past the 3. The long minute hand is between the 12 and the 1.');
    for (const t of allTimes()) {
      const w = handsWords(t);
      expect(w).not.toMatch(/NaN|undefined|null|Infinity|o'clock|past three/);
      expect(w.includes(EM_DASH)).toBe(false);
    }
  });
});

describe('making times and choices', () => {
  it('randomTime suits the level and reaches every hour and every minute of it', () => {
    for (const lv of LEVEL_KEYS) {
      const rng = mulberry32(5);
      const hours = new Set<number>();
      const mins = new Set<number>();
      for (let i = 0; i < 6000; i++) {
        const t = randomTime(lv, rng);
        expect(t.h >= 1 && t.h <= 12).toBe(true);
        expect(LEVELS[lv].minutes).toContain(t.m);
        hours.add(t.h);
        mins.add(t.m);
      }
      expect(hours.size).toBe(12);
      expect(mins.size).toBe(LEVELS[lv].minutes.length);
    }
  });

  it('three different valid times, the right one exactly once: every time at every level, 3 seeds', () => {
    for (const lv of LEVEL_KEYS) {
      for (const t of levelTimes(lv)) {
        for (let seed = 1; seed <= 3; seed++) {
          const c = timeChoices(t, lv, mulberry32(seed * 313 + t.h * 60 + t.m));
          expect(c.options).toHaveLength(3);
          expect(new Set(c.options.map(formatTime)).size, `${lv} ${formatTime(t)}`).toBe(3);
          expect(c.options.filter((o) => sameTime(o, t))).toHaveLength(1);
          expect(sameTime(c.options[c.correctIndex], t)).toBe(true);
          for (const o of c.options) {
            expect(o.h >= 1 && o.h <= 12).toBe(true);
            expect(LEVELS[lv].minutes).toContain(o.m);
          }
        }
      }
    }
  }, 60_000);
  it('the usual slip, the two hands swapped over, is one of the wrong choices when it is a valid time', () => {
    const rng = mulberry32(2);
    for (const t of [{ h: 3, m: 20 }, { h: 8, m: 55 }, { h: 12, m: 5 }, { h: 6, m: 35 }]) {
      const swapped: Time = { h: t.m / 5 || 12, m: (t.h % 12) * 5 };
      for (let k = 0; k < 40; k++) {
        const c = timeChoices(t, 'five', rng);
        expect(c.options.some((o) => sameTime(o, swapped)), `${formatTime(t)} -> ${formatTime(swapped)}`).toBe(true);
      }
    }
  });
  it('the right answer lands in each place about a third of the time', () => {
    const rng = mulberry32(21);
    const place = [0, 0, 0];
    const n = 6000;
    for (let i = 0; i < n; i++) place[timeChoices({ h: 4, m: 15 }, 'quarter', rng).correctIndex] += 1;
    for (const c of place) expect(Math.abs(c / n - 1 / 3)).toBeLessThan(0.03);
  });
  it('even a broken random generator gives three different times', () => {
    for (const rng of [() => 0, () => 0.9999999, () => NaN, () => 0.5]) {
      for (const lv of LEVEL_KEYS) {
        for (const t of levelTimes(lv).filter((_, i) => i % 7 === 0)) {
          expect(new Set(timeChoices(t, lv, rng).options.map(formatTime)).size).toBe(3);
        }
      }
    }
  });
  it('shuffle keeps every item once', () => {
    const src = [1, 2, 3, 4, 5];
    expect([...shuffle(src, mulberry32(1))].sort()).toEqual(src);
  });
});

describe('matching pairs', () => {
  it('has four different times valid for the level, and time cards in a different order from the clocks', () => {
    for (const lv of LEVEL_KEYS) for (let seed = 1; seed <= 200; seed++) {
      const m = makeMatch(lv, mulberry32(seed));
      expect(m.times).toHaveLength(MATCH_PAIRS);
      expect(new Set(m.times.map(formatTime)).size).toBe(MATCH_PAIRS);
      for (const t of m.times) expect(LEVELS[lv].minutes).toContain(t.m);
      expect([...m.order].sort()).toEqual([0, 1, 2, 3]);
      expect(m.order.every((v, i) => v === i)).toBe(false);
      expect(m).toMatchObject({ misses: 0, done: false });
      expect(m.matched).toEqual([false, false, false, false]);
    }
  });
  it('the on-the-hour level has enough different times for four pairs', () => {
    expect(new Set(makeMatch('hours', mulberry32(1)).times.map(formatTime)).size).toBe(4);
  });
  it('is the same for the same seed and different for another', () => {
    expect(JSON.stringify(makeMatch('five', mulberry32(4)))).toBe(JSON.stringify(makeMatch('five', mulberry32(4))));
    expect(JSON.stringify(makeMatch('five', mulberry32(4)))).not.toBe(JSON.stringify(makeMatch('five', mulberry32(5))));
  });
  it('a player who pairs every clock with its card finishes in four tries with no misses', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let m = makeMatch('quarter', mulberry32(seed));
      for (let clock = 0; clock < 4; clock++) {
        const card = m.order.indexOf(clock);
        const r = tryMatch(m, clock, card);
        expect(r.ok).toBe(true);
        m = r.match;
      }
      expect(m.done).toBe(true);
      expect(m.misses).toBe(0);
    }
  });
  it('a wrong pair only adds a miss; a pair already made says so', () => {
    let m = makeMatch('quarter', mulberry32(9));
    const wrongCard = m.order.findIndex((c) => c !== 0);
    const w = tryMatch(m, 0, wrongCard);
    expect(w).toMatchObject({ ok: false, already: false });
    expect(w.match.misses).toBe(1);
    expect(w.match.matched).toEqual([false, false, false, false]);
    expect(m.misses).toBe(0);
    m = tryMatch(m, 0, m.order.indexOf(0)).match;
    const again = tryMatch(m, 0, m.order.indexOf(0));
    expect(again).toMatchObject({ ok: false, already: true });
    expect(again.match).toBe(m);
  });
  it('bad indexes change nothing, and a finished game is left alone', () => {
    let m = makeMatch('quarter', mulberry32(9));
    for (const [a, b] of [[-1, 0], [0, -1], [4, 0], [0, 4], [1.5, 0], [NaN, 0], [0, NaN]] as [number, number][]) expect(tryMatch(m, a, b).match).toBe(m);
    for (let c = 0; c < 4; c++) m = tryMatch(m, c, m.order.indexOf(c)).match;
    expect(m.done).toBe(true);
    expect(tryMatch(m, 0, 0).match).toBe(m);
  });
  it('random play never breaks it: 2000 games of random pairs always end solved with consistent counts', () => {
    const rng = mulberry32(77);
    for (let g = 0; g < 2000; g++) {
      let m = makeMatch('five', rng);
      let tries = 0;
      let last = 0;
      let missesBefore = 0;
      while (!m.done && tries++ < 400) {
        const was = m.matched.slice();
        const r = tryMatch(m, Math.floor(rng() * 4), Math.floor(rng() * 4));
        m = r.match;
        const count = m.matched.filter(Boolean).length;
        expect(count).toBeGreaterThanOrEqual(last);
        last = count;
        expect(m.done).toBe(count === 4);
        // A pair that was made stays made; misses never go down.
        was.forEach((v, i) => { if (v) expect(m.matched[i]).toBe(true); });
        expect(m.misses).toBeGreaterThanOrEqual(missesBefore);
        missesBefore = m.misses;
      }
      expect(m.done).toBe(true);
    }
  });
});

describe('setting a clock', () => {
  it('nothing to say when the clock is right', () => {
    expect(setFeedback({ h: 4, m: 15 }, { h: 4, m: 15 })).toBe('');
  });
  it('says kindly which hand to look at', () => {
    expect(setFeedback({ h: 4, m: 30 }, { h: 4, m: 15 })).toBe('The short hand is right. Now move the long hand: it should point at the 3.');
    expect(setFeedback({ h: 4, m: 17 }, { h: 4, m: 20 })).toBe('The short hand is right. Now move the long hand: it should point at the 4.');
    expect(setFeedback({ h: 4, m: 15 }, { h: 4, m: 7 })).toBe('The short hand is right. Now move the long hand: it should point just past the 1.');
    expect(setFeedback({ h: 5, m: 15 }, { h: 4, m: 15 })).toBe('The long hand is right. Now move the short hand: it should be just past the 4.');
    expect(setFeedback({ h: 5, m: 0 }, { h: 4, m: 0 })).toBe('The long hand is right. Now move the short hand: it should be on the 4.');
    expect(setFeedback({ h: 5, m: 0 }, { h: 4, m: 45 })).toBe('Look at the short hand and the long hand again. Nearly there!');
    expect(setFeedback({ h: 6, m: 30 }, { h: 4, m: 45 })).toBe('Look at the short hand and the long hand again. Nearly there!');
  });
  it('every message is kind, exact and free of junk for every pair of times at the quarter level', () => {
    const times = levelTimes('quarter');
    for (const a of times) for (const b of times) {
      const m = setFeedback(a, b);
      expect(m).not.toMatch(/NaN|undefined|null|Infinity|wrong|bad|fail|incorrect/i);
      expect(m.includes(EM_DASH)).toBe(false);
      expect(m === '').toBe(sameTime(a, b));
    }
  });
  it('praise names the time in numbers and words', () => {
    expect(setSuccess({ h: 4, m: 15 })).toBe('You set the clock to 4:15, quarter past four.');
    expect(readRight({ h: 9, m: 30 })).toBe('Yes! 9:30 is half past nine.');
    expect(matchRight({ h: 9, m: 30 })).toBe('Yes! 9:30 is half past nine.');
    expect(readMiss({ h: 9, m: 30 })).toBe('Not quite. The clock shows 9:30, half past nine. Have another go with the next one.');
    expect(matchMiss).toBe('Not that pair. Look at the hands again and try another.');
    for (const s of [setSuccess({ h: 1, m: 1 }), readRight({ h: 1, m: 1 }), readMiss({ h: 1, m: 1 }), matchMiss]) {
      expect(s).not.toMatch(/NaN|undefined|null|Infinity|wrong|bad|fail|incorrect/i);
      expect(s.includes(EM_DASH)).toBe(false);
    }
  });
});

describe('cleanStreak and sanitiseStored', () => {
  it('whole numbers from 1 to the cap', () => {
    expect(cleanStreak(1)).toBe(1);
    expect(cleanStreak(999)).toBe(999);
    for (const bad of [0, -1, 1.5, 1000, NaN, Infinity, '5', null, undefined, {}, [], true, 5n]) expect(cleanStreak(bad), String(bad)).toBeNull();
  });
  it('keeps a good payload and reads JSON text', () => {
    expect(sanitiseStored({ hours: 4, minute: 12 })).toEqual({ hours: 4, minute: 12 });
    expect(sanitiseStored('{"quarter":7}')).toEqual({ quarter: 7 });
  });
  it('returns nothing for anything that is not a plain object', () => {
    for (const bad of [null, undefined, 42, true, '', 'not json', '[1]', '"x"', 'null', [], [1], NaN, () => 1, Symbol('x')]) expect(sanitiseStored(bad)).toEqual({});
  });
  it('drops unknown and prototype keys and bad values', () => {
    const s = sanitiseStored('{"__proto__":{"hours":5},"constructor":3,"all":9,"hours":2,"half":-4,"five":"3"}');
    expect(s).toEqual({ hours: 2 });
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).hours).toBeUndefined();
  });
  it('is quick on a hostile object', () => {
    const t = performance.now();
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 200000; i++) huge[`k${i}`] = 4;
    huge.five = 4;
    expect(sanitiseStored(huge)).toEqual({ five: 4 });
    expect(performance.now() - t).toBeLessThan(4000);
  }, 15_000);
  it('recordStreak keeps the first and the longest run per level and ignores zero and junk', () => {
    expect(recordStreak({}, 'half', 3)).toEqual({ saved: { half: 3 }, improved: false });
    expect(recordStreak({ half: 3 }, 'half', 5)).toEqual({ saved: { half: 5 }, improved: true });
    expect(recordStreak({ half: 5 }, 'half', 5)).toEqual({ saved: { half: 5 }, improved: false });
    expect(recordStreak({ half: 5 }, 'half', 2)).toEqual({ saved: { half: 5 }, improved: false });
    expect(recordStreak({ half: 5 }, 'five', 2)).toEqual({ saved: { half: 5, five: 2 }, improved: false });
    for (const bad of [0, -1, NaN, 1.5, 5000, '9' as unknown as number]) expect(recordStreak({ half: 5 }, 'half', bad)).toEqual({ saved: { half: 5 }, improved: false });
    expect(recordStreak({}, 'nope' as LevelKey, 4).saved).toEqual({ quarter: 4 });
  });
  it('does not change the object it was given, and toStorable round-trips', () => {
    const base = { half: 5 };
    const frozen = JSON.stringify(base);
    recordStreak(base, 'half', 9);
    expect(JSON.stringify(base)).toBe(frozen);
    const s = { hours: 3, minute: 8 };
    expect(sanitiseStored(JSON.stringify(toStorable(s)))).toEqual(s);
    expect(toStorable({ hours: 3, junk: 1 } as { hours: number })).toEqual({ hours: 3 });
  });
});

describe('the copy line', () => {
  it('reads right at the start, mid run and after a best', () => {
    expect(resultSummary('quarter', 0, 0)).toBe('Clock Reader (Quarter hours): just getting started');
    expect(resultSummary('quarter', 3, 7)).toBe('Clock Reader (Quarter hours): 3 in a row this time, best run 7');
    expect(resultSummary('five', 6, 2)).toBe('Clock Reader (Five minutes): 6 in a row this time, best run 6');
    expect(resultSummary('hours', 0, 4)).toBe('Clock Reader (On the hour): 0 in a row this time, best run 4');
    for (const s of [resultSummary('minute', NaN, NaN), resultSummary('x' as LevelKey, -3, 5)]) {
      expect(s).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(s.includes(EM_DASH)).toBe(false);
    }
    expect(plural(1, 'clock')).toBe('1 clock');
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/clock-reader', f), 'utf8');
  it('no Math.random anywhere in the game', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
  });
  it('buttons are at least 56 px (3.5rem) tall and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.clk-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.clk-key \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.clk-choice \{[^}]*min-height: 4\.5rem;/);
    expect(text).toMatch(/#clk-app \.clk-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('only the clock face in Set mode turns off touch scrolling', () => {
    const text = read('Calculator.astro');
    const hits = [...text.matchAll(/([^{}]*)\{[^{}]*touch-action:\s*none[^{}]*\}/g)].map((m) => m[1].trim());
    expect(hits.length).toBeGreaterThan(0);
    for (const sel of hits) expect(sel, sel).toMatch(/\.clk-face-wrap\[data-drag="true"\]/);
  });
  it('a control that hides, disables or is rebuilt hands focus on (Next clock in Set, rebuilt cards)', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/const keepFocus = \(prev: Element \| null\)/);
    // newRead, newSet, buildMatch and startMode each remember the focused element and call keepFocus at the end.
    expect((text.match(/keepFocus\(prev\);/g) ?? []).length).toBe(4);
  });
  it('the status says where the hands ended up when a drag ends', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/const endDrag = \(e: PointerEvent\) => \{[\s\S]{0,160}say\(`The clock shows/);
  });
});
