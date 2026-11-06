/**
 * games-dot-to-dot.test.ts - the engine behind `dot-to-dot`.
 *
 * Pinned: every picture passes the geometry check (10 to 50 dots, all distinct, spaced at least 9
 * units apart, inside the box, no line crossing or touching another, no dot hugging a foreign
 * line), numbering is contiguous 1..N across strokes, the lines that appear on each join
 * (closed strokes close on their last dot, a new stroke starts without a line), the segment
 * intersection test against an independent parametric oracle, tap matching (the nearest dot
 * within the radius is the one meant, a tap near the next dot always joins), drag matching,
 * arrow-key movement (every dot reachable), saved progress sanitising, kind wording, and the
 * numbers quoted on the guide page.
 */
import { describe, it, expect } from 'vitest';
import {
  PICTURES, PICTURE_IDS, BOX, HIT_RADIUS, DRAG_RADIUS, MIN_SPACING, MIN_DOTS, MAX_DOTS, LEVEL_NAMES,
  mulberry32, distance, segmentsIntersect, pointSegmentDistance, dotsOf, dotCount, strokeStart, edgesOnJoin, allEdges, edgesAfter,
  minSpacing, dotRadius, nearestDot, classifyTap, dragReached, keyTarget, validatePicture, pictureById, indexOfPicture,
  parsePictureParam, ALL_DONE_MASK, sanitiseDone, isDone, withDone, doneCount, nextPicture, surprisePicture,
  plural, joinedMessage, startMessage, finishedMessage, otherDotMessage, missMessage, dotLabel, shareText,
  type Picture, type Pt,
} from '../src/components/apps-private/dot-to-dot/helpers';

const COLOURS = ['sky', 'teal', 'green', 'lime', 'amber', 'orange', 'rose', 'violet', 'ink'];

describe('the pictures', () => {
  it('has 11 pictures with unique ids, names and emoji', () => {
    expect(PICTURES).toHaveLength(11);
    expect(new Set(PICTURE_IDS).size).toBe(11);
    expect(new Set(PICTURES.map((p) => p.name)).size).toBe(11);
    expect(new Set(PICTURES.map((p) => p.emoji)).size).toBe(11);
    for (const p of PICTURES) expect(p.id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('gives every level at least three pictures, and levels are named in plain words', () => {
    expect([...LEVEL_NAMES]).toEqual(['', 'Little', 'Middle', 'Big']);
    for (const level of [1, 2, 3]) expect(PICTURES.filter((p) => p.level === level).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the dot counts the guide page quotes (10 to 34 dots in all)', () => {
    const counts = PICTURES.map((p) => dotCount(p));
    expect(Math.min(...counts)).toBe(10);
    expect(Math.max(...counts)).toBe(34);
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(MIN_DOTS);
      expect(c).toBeLessThanOrEqual(MAX_DOTS);
    }
    // Pictures with more dots sit at higher levels.
    for (const p of PICTURES) {
      const c = dotCount(p);
      if (p.level === 1) expect(c).toBeLessThanOrEqual(14);
      if (p.level === 2) expect(c).toBeGreaterThanOrEqual(18);
      if (p.level === 2) expect(c).toBeLessThanOrEqual(22);
      if (p.level === 3) expect(c).toBeGreaterThanOrEqual(27);
    }
  });

  it.each(PICTURES.map((p) => [p.id, p] as const))('%s passes the geometry check', (_id, p) => {
    expect(validatePicture(p)).toEqual([]);
  });

  it.each(PICTURES.map((p) => [p.id, p] as const))('%s: dots are numbered 1..N without gaps, all positions distinct, spacing at least 9', (_id, p) => {
    const dots = dotsOf(p);
    expect(dots.map((d) => d.n)).toEqual(Array.from({ length: dots.length }, (_, i) => i + 1));
    expect(new Set(dots.map((d) => `${d.x},${d.y}`)).size).toBe(dots.length);
    // Independent brute-force spacing check.
    let min = Infinity;
    for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) min = Math.min(min, Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y));
    expect(min).toBeGreaterThanOrEqual(MIN_SPACING - 1e-9);
    expect(minSpacing(p)).toBeCloseTo(min, 9);
    for (const d of dots) {
      expect(d.x).toBeGreaterThanOrEqual(3);
      expect(d.x).toBeLessThanOrEqual(BOX - 3);
      expect(d.y).toBeGreaterThanOrEqual(3);
      expect(d.y).toBeLessThanOrEqual(BOX - 3);
    }
  });

  it.each(PICTURES.map((p) => [p.id, p] as const))('%s: strokes are the shape they say (closed loops fill, open lines do not)', (_id, p) => {
    for (const s of p.strokes) {
      if (s.tint !== undefined) {
        expect(s.closed).toBe(true);
        expect(COLOURS).toContain(s.tint);
      }
    }
    for (const sh of p.paint) expect(COLOURS).toContain(sh.c);
    // Every picture has at least one closed stroke that gets filled, so a finished picture is coloured in.
    expect(p.strokes.some((s) => s.closed && s.tint)).toBe(true);
    expect(p.paint.length).toBeGreaterThan(0);
  });

  it('draws the dots large enough to read yet never touching a neighbour', () => {
    for (const p of PICTURES) {
      const r = dotRadius(p);
      expect(r).toBeGreaterThanOrEqual(3.4);
      expect(r).toBeLessThanOrEqual(5.2);
      expect(2 * r).toBeLessThan(minSpacing(p));
    }
  });
});

describe('segment geometry against an independent oracle', () => {
  // Oracle: solve a + t(b-a) = c + u(d-c) for t, u in [0,1] with rational arithmetic via parametric form.
  const oracle = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
    const r = [b[0] - a[0], b[1] - a[1]];
    const s = [d[0] - c[0], d[1] - c[1]];
    const den = r[0] * s[1] - r[1] * s[0];
    const qp = [c[0] - a[0], c[1] - a[1]];
    if (den === 0) {
      // Parallel: intersect only if collinear and the projections overlap.
      if (qp[0] * r[1] - qp[1] * r[0] !== 0) return false;
      const rr = r[0] * r[0] + r[1] * r[1];
      if (rr === 0) {
        const ss = s[0] * s[0] + s[1] * s[1];
        if (ss === 0) return a[0] === c[0] && a[1] === c[1];
        const u = ((a[0] - c[0]) * s[0] + (a[1] - c[1]) * s[1]) / ss;
        return u >= 0 && u <= 1 && (c[0] + u * s[0]) === a[0] && (c[1] + u * s[1]) === a[1];
      }
      const t0 = (qp[0] * r[0] + qp[1] * r[1]) / rr;
      const t1 = t0 + (s[0] * r[0] + s[1] * r[1]) / rr;
      const lo = Math.min(t0, t1);
      const hi = Math.max(t0, t1);
      return hi >= 0 && lo <= 1;
    }
    const t = (qp[0] * s[1] - qp[1] * s[0]) / den;
    const u = (qp[0] * r[1] - qp[1] * r[0]) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };

  it('knows crossing, touching, parallel, collinear and separate segments', () => {
    expect(segmentsIntersect([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
    expect(segmentsIntersect([0, 0], [10, 0], [10, 0], [10, 10])).toBe(true); // share an end
    expect(segmentsIntersect([0, 0], [10, 0], [5, 0], [5, 10])).toBe(true); // T junction
    expect(segmentsIntersect([0, 0], [10, 0], [0, 5], [10, 5])).toBe(false); // parallel
    expect(segmentsIntersect([0, 0], [4, 0], [6, 0], [10, 0])).toBe(false); // collinear apart
    expect(segmentsIntersect([0, 0], [6, 0], [4, 0], [10, 0])).toBe(true); // collinear overlap
    expect(segmentsIntersect([0, 0], [4, 4], [5, 5], [9, 9])).toBe(false);
  });

  it('agrees with the oracle on 5000 random integer segment pairs', () => {
    const rng = mulberry32(11);
    const p = (): Pt => [Math.floor(rng() * 7), Math.floor(rng() * 7)];
    for (let i = 0; i < 5000; i++) {
      const a = p(), b = p(), c = p(), d = p();
      expect(segmentsIntersect(a, b, c, d), `${a} ${b} ${c} ${d}`).toBe(oracle(a, b, c, d));
    }
  });

  it('measures point to segment distance (end caps and middle)', () => {
    expect(pointSegmentDistance([5, 3], [0, 0], [10, 0])).toBeCloseTo(3, 9);
    expect(pointSegmentDistance([-3, 4], [0, 0], [10, 0])).toBeCloseTo(5, 9);
    expect(pointSegmentDistance([13, 4], [0, 0], [10, 0])).toBeCloseTo(5, 9);
    expect(pointSegmentDistance([2, 2], [1, 1], [1, 1])).toBeCloseTo(Math.SQRT2, 9);
    expect(distance([0, 0], [3, 4])).toBe(5);
  });

  it('the picture checker really catches bad pictures', () => {
    const base: Picture = {
      id: 'bad', name: 'Bad', emoji: 'x', level: 1, paint: [],
      strokes: [{ pts: Array.from({ length: 10 }, (_, i): Pt => [10 + i * 9, 50]), closed: false }],
    };
    expect(validatePicture(base)).toEqual([]);
    expect(validatePicture({ ...base, strokes: [{ pts: base.strokes[0].pts.slice(0, 9), closed: false }] }).join()).toMatch(/dot count/);
    const crossing: Picture = { ...base, strokes: [{ pts: [[10, 10], [60, 60], [60, 10], [10, 60], [90, 90], [90, 10], [20, 30], [40, 90], [70, 80], [80, 50]], closed: false }] };
    expect(validatePicture(crossing).join()).toMatch(/cross/);
    const same: Picture = { ...base, strokes: [{ pts: [...base.strokes[0].pts.slice(0, 9), [10, 50]], closed: false }] };
    expect(validatePicture(same).join()).toMatch(/repeats a position/);
    const close: Picture = { ...base, strokes: [{ pts: [...base.strokes[0].pts.slice(0, 9), [14, 54]], closed: false }] };
    expect(validatePicture(close).join()).toMatch(/closer than/);
    const edge: Picture = { ...base, strokes: [{ pts: [[1, 50], ...base.strokes[0].pts.slice(1)], closed: false }] };
    expect(validatePicture(edge).join()).toMatch(/edge/);
    const hug: Picture = { ...base, strokes: [{ pts: base.strokes[0].pts, closed: false }, { pts: [[19, 52], [19, 80]], closed: false }] };
    expect(validatePicture(hug).join()).toMatch(/too near line|closer than/);
    const outside: Picture = { ...base, paint: [{ k: 'circle', cx: 2, cy: 50, r: 5, c: 'sky' }] };
    expect(validatePicture(outside).join()).toMatch(/outside the box/);
    const openFill: Picture = { ...base, strokes: [{ pts: base.strokes[0].pts, closed: false, tint: 'sky' }] };
    expect(validatePicture(openFill).join()).toMatch(/tint but is open/);
  });
});

describe('edges that appear as dots are joined', () => {
  it('edge counts: an open stroke of k dots has k-1 lines, a closed one has k', () => {
    for (const p of PICTURES) {
      const expected = p.strokes.reduce((k, s) => k + (s.closed ? s.pts.length : s.pts.length - 1), 0);
      expect(allEdges(p)).toHaveLength(expected);
    }
  });

  it('dot 1 draws nothing; a stroke start draws no line from the previous stroke (the pen lifts)', () => {
    for (const p of PICTURES) {
      expect(edgesOnJoin(p, 1)).toEqual([]);
      for (const d of dotsOf(p)) if (d.first) expect(edgesOnJoin(p, d.n).filter(([a]) => a === d.n - 1)).toEqual([]);
    }
  });

  it('a closed stroke closes on its last dot, an open one does not', () => {
    const star = pictureById('star')!;
    expect(edgesOnJoin(star, 10)).toEqual([[9, 10], [10, 1]]);
    const cat = pictureById('cat')!;
    const dots = dotsOf(cat);
    const whiskerEnd = dots.filter((d) => d.stroke === 2 && d.last)[0];
    expect(edgesOnJoin(cat, whiskerEnd.n)).toEqual([[whiskerEnd.n - 1, whiskerEnd.n]]);
    expect(strokeStart(cat, whiskerEnd.n)).toBe(whiskerEnd.n - 2);
  });

  it('every line joins two different dots that exist, and edgesAfter grows by 0 to 2 lines a join', () => {
    for (const p of PICTURES) {
      const total = dotCount(p);
      let prev = 0;
      for (let j = 0; j <= total; j++) {
        const e = edgesAfter(p, j);
        expect(e.length - prev).toBeGreaterThanOrEqual(0);
        expect(e.length - prev).toBeLessThanOrEqual(2);
        prev = e.length;
        for (const [a, b] of e) {
          expect(a).not.toBe(b);
          expect(a).toBeGreaterThanOrEqual(1);
          expect(b).toBeLessThanOrEqual(total);
          expect(a).toBeLessThanOrEqual(j);
          expect(b).toBeLessThanOrEqual(j);
        }
      }
      expect(edgesAfter(p, total)).toEqual(allEdges(p));
      expect(edgesAfter(p, total + 5)).toEqual(allEdges(p));
      expect(edgesAfter(p, -3)).toEqual([]);
    }
  });

  it('ignores a dot number that does not exist', () => {
    const p = PICTURES[0];
    expect(edgesOnJoin(p, 0)).toEqual([]);
    expect(edgesOnJoin(p, 999)).toEqual([]);
  });
});

describe('tapping', () => {
  it('a tap at the centre of the next dot joins it, at any other dot says which dot it was, and far away is a miss', () => {
    for (const p of PICTURES) {
      const dots = dotsOf(p);
      for (let joined = 0; joined < dots.length; joined++) {
        for (const d of dots) {
          const t = classifyTap(p, joined, d.x, d.y);
          if (d.n === joined + 1) expect(t).toEqual({ kind: 'join' });
          else expect(t).toEqual({ kind: 'other', n: d.n, joined: d.n <= joined });
        }
      }
    }
  });

  it('a tap within 4 units of the next dot always joins it (spacing 9 means no other dot can be closer)', () => {
    const rng = mulberry32(5);
    for (const p of PICTURES) {
      const dots = dotsOf(p);
      for (let k = 0; k < 200; k++) {
        const joined = Math.floor(rng() * dots.length);
        const next = dots[Math.min(joined, dots.length - 1)];
        if (joined >= dots.length) continue;
        const ang = rng() * Math.PI * 2;
        const rad = rng() * 4;
        expect(classifyTap(p, joined, next.x + rad * Math.cos(ang), next.y + rad * Math.sin(ang))).toEqual({ kind: 'join' });
      }
    }
  });

  it('a tap further than the tap radius from every dot is a miss; NaN and Infinity never join', () => {
    const p = pictureById('star')!;
    expect(classifyTap(p, 0, 0, 0)).toEqual({ kind: 'miss' });
    expect(classifyTap(p, 0, 100, 100)).toEqual({ kind: 'miss' });
    expect(classifyTap(p, 0, NaN, 3)).toEqual({ kind: 'miss' });
    expect(classifyTap(p, 0, Infinity, 3)).toEqual({ kind: 'miss' });
    const d1 = dotsOf(p)[0];
    expect(classifyTap(p, 0, d1.x + HIT_RADIUS + 0.5, d1.y)).not.toEqual({ kind: 'join' });
  });

  it('is done once every dot is joined, and junk counts are treated as done rather than crashing', () => {
    const p = pictureById('house')!;
    const total = dotCount(p);
    expect(classifyTap(p, total, 50, 50)).toEqual({ kind: 'done' });
    expect(classifyTap(p, total + 3, 50, 50)).toEqual({ kind: 'done' });
    expect(classifyTap(p, -1, 50, 50)).toEqual({ kind: 'done' });
    expect(classifyTap(p, 1.5, 50, 50)).toEqual({ kind: 'done' });
  });

  it('finds the nearest dot', () => {
    const p = pictureById('house')!;
    expect(nearestDot(p, 18, 90)).toEqual({ n: 1, d: 0 });
    expect(nearestDot(p, 19, 89)!.n).toBe(1);
  });

  it('joining every dot in order finishes each picture with exactly N joins', () => {
    for (const p of PICTURES) {
      const dots = dotsOf(p);
      let joined = 0;
      let joins = 0;
      for (const d of dots) {
        const t = classifyTap(p, joined, d.x + 0.7, d.y - 0.7);
        expect(t.kind).toBe('join');
        joined += 1;
        joins += 1;
      }
      expect(joins).toBe(dots.length);
      expect(classifyTap(p, joined, dots[0].x, dots[0].y)).toEqual({ kind: 'done' });
    }
  });

  it('dragging reaches the next dot only when it is the nearest dot and close', () => {
    const p = pictureById('house')!;
    const dots = dotsOf(p);
    expect(dragReached(p, 1, dots[1].x, dots[1].y)).toBe(true);
    expect(dragReached(p, 1, dots[1].x + DRAG_RADIUS - 0.5, dots[1].y)).toBe(true);
    expect(dragReached(p, 1, dots[1].x + DRAG_RADIUS + 1, dots[1].y)).toBe(false);
    expect(dragReached(p, 1, dots[2].x, dots[2].y)).toBe(false); // the wrong dot
    expect(dragReached(p, 0, dots[0].x, dots[0].y)).toBe(false); // nothing joined yet: a drag cannot start the picture
    expect(dragReached(p, dots.length, dots[0].x, dots[0].y)).toBe(false);
    expect(dragReached(p, 1, NaN, 2)).toBe(false);
  });

  it('random taps never break the game: the joined count only grows by one on a join and stops at the total', () => {
    const rng = mulberry32(99);
    for (let round = 0; round < 40; round++) {
      const p = PICTURES[round % PICTURES.length];
      const total = dotCount(p);
      let joined = 0;
      for (let k = 0; k < 400; k++) {
        const t = classifyTap(p, joined, rng() * 110 - 5, rng() * 110 - 5);
        if (t.kind === 'join') joined += 1;
        expect(joined).toBeLessThanOrEqual(total);
        if (t.kind === 'other') {
          expect(t.n).toBeGreaterThanOrEqual(1);
          expect(t.n).toBeLessThanOrEqual(total);
          expect(t.n).not.toBe(joined + 1);
        }
        if (joined === total) expect(classifyTap(p, joined, 50, 50).kind).toBe('done');
      }
    }
  });
});

describe('keyboard movement between dots', () => {
  it('arrows and page keys walk the numbers, Home and End jump to the ends, N finds the next dot to join', () => {
    expect(keyTarget('ArrowRight', 3, 0, 10)).toBe(4);
    expect(keyTarget('ArrowDown', 3, 0, 10)).toBe(4);
    expect(keyTarget('PageDown', 3, 0, 10)).toBe(4);
    expect(keyTarget('ArrowLeft', 3, 0, 10)).toBe(2);
    expect(keyTarget('ArrowUp', 3, 0, 10)).toBe(2);
    expect(keyTarget('PageUp', 3, 0, 10)).toBe(2);
    expect(keyTarget('Home', 3, 0, 10)).toBe(1);
    expect(keyTarget('End', 3, 0, 10)).toBe(10);
    expect(keyTarget('n', 3, 6, 10)).toBe(7);
    expect(keyTarget('N', 3, 6, 10)).toBe(7);
    expect(keyTarget('n', 3, 0, 10)).toBe(1);
  });

  it('does nothing at the ends, for other keys, and for junk', () => {
    expect(keyTarget('ArrowLeft', 1, 0, 10)).toBeNull();
    expect(keyTarget('ArrowRight', 10, 0, 10)).toBeNull();
    expect(keyTarget('Home', 1, 0, 10)).toBeNull();
    expect(keyTarget('End', 10, 0, 10)).toBeNull();
    expect(keyTarget('n', 7, 6, 10)).toBeNull(); // already on the next dot
    expect(keyTarget('n', 3, 10, 10)).toBe(10); // all joined: N points at the last dot
    for (const k of ['a', 'Enter', ' ', 'Tab', 'Escape', '', 'ArrowRightX']) expect(keyTarget(k, 3, 0, 10)).toBeNull();
    expect(keyTarget('ArrowRight', 0, 0, 10)).toBeNull();
    expect(keyTarget('ArrowRight', 11, 0, 10)).toBeNull();
    expect(keyTarget('ArrowRight', 2.5, 0, 10)).toBeNull();
    expect(keyTarget('ArrowRight', NaN, 0, 10)).toBeNull();
  });

  it('every dot of every picture is reachable from dot 1 with the Right arrow alone, and back with Left', () => {
    for (const p of PICTURES) {
      const total = dotCount(p);
      const seen = new Set<number>([1]);
      let n = 1;
      for (let guard = 0; guard < total + 2; guard++) {
        const to = keyTarget('ArrowRight', n, 0, total);
        if (to === null) break;
        seen.add(to);
        n = to;
      }
      expect(seen.size).toBe(total);
      expect(n).toBe(total);
      while (n > 1) n = keyTarget('ArrowLeft', n, 0, total)!;
      expect(n).toBe(1);
    }
  });
});

describe('lookups and the page address', () => {
  it('finds a picture by id and rejects junk', () => {
    expect(pictureById('fish')!.name).toBe('Fish');
    expect(pictureById('nope')).toBeNull();
    expect(pictureById('__proto__')).toBeNull();
    expect(indexOfPicture('star')).toBe(0);
    expect(indexOfPicture('x')).toBe(-1);
    expect(parsePictureParam('boat')).toBe('boat');
    for (const junk of ['', 'BOAT', 'boat ', '__proto__', 'constructor', 5, null, undefined, [], {}]) expect(parsePictureParam(junk)).toBeNull();
  });
});

describe('saved progress', () => {
  it('keeps a whole-number mask in range and nothing else', () => {
    expect(ALL_DONE_MASK).toBe(2 ** 11 - 1);
    expect(sanitiseDone({ d: 5 })).toEqual({ d: 5 });
    expect(sanitiseDone({ d: ALL_DONE_MASK })).toEqual({ d: ALL_DONE_MASK });
    expect(sanitiseDone({ d: ALL_DONE_MASK + 1 })).toEqual({ d: 0 });
    for (const junk of [null, undefined, 3, 'x', [], [1], { d: -1 }, { d: 1.5 }, { d: NaN }, { d: Infinity }, { d: '5' }, { d: 1e12 }, { x: 4 }, JSON.parse('{"__proto__":{"d":3}}')]) {
      expect(sanitiseDone(junk)).toEqual({ d: 0 });
    }
    const out = sanitiseDone({ d: 3, extra: 'x' });
    expect(Object.keys(out)).toEqual(['d']);
  });

  it('sets, tests and counts finished pictures', () => {
    let mask = 0;
    expect(doneCount(mask)).toBe(0);
    mask = withDone(mask, 0);
    mask = withDone(mask, 4);
    mask = withDone(mask, 4);
    expect(isDone(mask, 0)).toBe(true);
    expect(isDone(mask, 4)).toBe(true);
    expect(isDone(mask, 1)).toBe(false);
    expect(doneCount(mask)).toBe(2);
    expect(withDone(mask, -1)).toBe(mask);
    expect(withDone(mask, 99)).toBe(mask);
    expect(isDone(mask, 99)).toBe(false);
    let all = 0;
    for (let i = 0; i < PICTURES.length; i++) all = withDone(all, i);
    expect(all).toBe(ALL_DONE_MASK);
    expect(doneCount(all)).toBe(PICTURES.length);
  });

  it('offers the next unfinished picture, wrapping round, and always something else when all are done', () => {
    expect(nextPicture(0, 0)).toBe(1);
    expect(nextPicture(withDone(0, 1), 0)).toBe(2);
    expect(nextPicture(ALL_DONE_MASK, 3)).toBe(4);
    expect(nextPicture(ALL_DONE_MASK, PICTURES.length - 1)).toBe(0);
    expect(nextPicture(ALL_DONE_MASK - 1, 5)).toBe(0); // only picture 0 is left
  });

  it('surprise picks from the unfinished pictures, never the current one, and is seeded', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 300; i++) {
      const mask = Math.floor(rng() * ALL_DONE_MASK);
      const not = Math.floor(rng() * PICTURES.length);
      const pick = surprisePicture(mask, not, rng);
      expect(pick).not.toBe(not);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThan(PICTURES.length);
      const anyOpen = PICTURES.some((_, j) => j !== not && !isDone(mask, j));
      if (anyOpen) expect(isDone(mask, pick)).toBe(false);
    }
    expect(surprisePicture(0, 0, mulberry32(3))).toBe(surprisePicture(0, 0, mulberry32(3)));
  });
});

describe('words for the child', () => {
  it('uses correct plurals', () => {
    expect(plural(1, 'dot')).toBe('1 dot');
    expect(plural(0, 'dot')).toBe('0 dots');
    expect(plural(2, 'dot')).toBe('2 dots');
  });

  it('praises every join, counts what is left, and says nothing on the last dot (the finish message takes over)', () => {
    expect(joinedMessage(1, 10)).toBe('You found dot 1. Now find dot 2.');
    expect(joinedMessage(9, 10)).toMatch(/Dot 9 joined\. 1 dot to go, find dot 10\./);
    expect(joinedMessage(5, 10)).toMatch(/Dot 5 joined\. 5 dots to go, find dot 6\./);
    expect(joinedMessage(10, 10)).toBe('');
    for (let n = 1; n < 30; n++) expect(joinedMessage(n, 30)).not.toMatch(/wrong|fail|bad|oops|no!/i);
  });

  it('wrong taps are kind and say what to do next', () => {
    expect(otherDotMessage(7, false, 5)).toBe('That is dot 7. Look for dot 5.');
    expect(otherDotMessage(2, true, 5)).toBe('Dot 2 is already joined. Find dot 5.');
    expect(missMessage(5)).toBe('Tap the dot with the number 5.');
    for (const m of [otherDotMessage(7, false, 5), otherDotMessage(2, true, 5), missMessage(5)]) expect(m).not.toMatch(/wrong|fail|bad|oops|incorrect/i);
  });

  it('start and finish messages name the picture', () => {
    expect(startMessage('Cat face')).toBe('Find dot 1 and tap it to start the cat face.');
    expect(finishedMessage('Fish', 18)).toBe('You joined all 18 dots. Look at your fish!');
  });

  it('labels a dot in each state for a screen reader', () => {
    expect(dotLabel(3, 10, 5)).toBe('Dot 3 of 10, joined');
    expect(dotLabel(6, 10, 5)).toBe('Dot 6 of 10, the next dot to join');
    expect(dotLabel(8, 10, 5)).toBe('Dot 8 of 10, not joined yet');
    expect(dotLabel(1, 10, 0)).toBe('Dot 1 of 10, the next dot to join');
  });

  it('share text is right unfinished, half finished and finished', () => {
    expect(shareText('Fish', 0, 18, 'U')).toBe('Dot to Dot - Fish: 0 of 18 dots joined\nU');
    expect(shareText('Fish', 7, 18, 'U')).toBe('Dot to Dot - Fish: 7 of 18 dots joined\nU');
    expect(shareText('Fish', 18, 18, 'U')).toBe('Dot to Dot - Fish: all 18 dots joined\nU');
  });
});

describe('seeded randomness', () => {
  it('gives the same numbers for the same seed and stays in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
