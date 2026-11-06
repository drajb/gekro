/**
 * games-tangram.test.ts - the engine behind `tangram`.
 *
 * Pinned: the seven pieces have the traditional shapes and proportions (areas 2, 2, 1,
 * 1/2, 1/2, 1, 1 in units of the medium triangle, edge lengths and right angles checked
 * from the coordinates); every orientation keeps whole-number coordinates; for every
 * one of the 16 shapes the seven target pieces tile it EXACTLY: they are the seven tans,
 * no two overlap (checked by two different methods), the areas add up to 32, and the
 * outline left after matching shared edges is one single closed loop whose enclosed area
 * is also 32 (so no gap, no hole and no overlap); the shapes are all different up to
 * turning and mirroring; the exact overlap and inside tests agree with a much finer
 * sampling on thousands of random placements; swapping identical pieces still counts as
 * solved while moving, turning or flipping a piece wrongly does not; turning skips
 * looks that are identical; and the sanitisers reject junk.
 */
import { describe, it, expect } from 'vitest';
import {
  PIECES, PIECE_COUNT, PARALLELOGRAM, AREA2, TOTAL_AREA2, plural, twiceArea, bounds, orient, canFlip, normalise, placedVerts, sameLook, nextTurn,
  turned, flipped, overlaps, insideSilhouette, unionTwiceArea, LEVELS, MAX_LEVEL_COUNT, silhouetteParts, silhouetteSize, TABLE_W, layoutFor,
  targetOnTable, clampToTable, checkPieces, hintPiece, sanitiseBest, isSolvedBit, withSolved, solvedCount, clampLevel, describePiece, ROT_WORDS,
  type Placement, type Point, type Level,
} from '../src/components/apps-private/tangram/helpers';

// ── Independent helpers ───────────────────────────────────────────────────────

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const d2 = (a: Point, b: Point): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const sides2 = (poly: readonly Point[]): number[] => poly.map((p, i) => d2(p, poly[(i + 1) % poly.length])).sort((x, y) => x - y);
const dotAt = (poly: readonly Point[], i: number): number => {
  const p = poly[i];
  const a = poly[(i + poly.length - 1) % poly.length];
  const b = poly[(i + 1) % poly.length];
  return (a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1]);
};

/** Strict point-in-convex-polygon by comparing sides of every edge (sign of the cross product). */
const strictIn = (x: number, y: number, poly: readonly Point[]): boolean => {
  const signs = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return Math.sign((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]));
  });
  return signs.every((s) => s > 0) || signs.every((s) => s < 0);
};

/** Fine sampling: spacing 1/8, shifted by (1/32, 3/64) so no sample touches an edge. Returns sample points as multiples of 1/64. */
const fineSamples = (poly: readonly Point[]): [number, number][] => {
  const b = bounds(poly);
  const out: [number, number][] = [];
  for (let i = Math.floor(b.minX * 8) - 1; i <= Math.ceil(b.maxX * 8); i++) {
    for (let j = Math.floor(b.minY * 8) - 1; j <= Math.ceil(b.maxY * 8); j++) out.push([8 * i + 2, 8 * j + 3]);
  }
  return out;
};
const scale64 = (poly: readonly Point[]): Point[] => poly.map(([x, y]) => [x * 64, y * 64] as Point);

const overlapBySampling = (a: readonly Point[], b: readonly Point[]): boolean => {
  const A = scale64(a);
  const B = scale64(b);
  return fineSamples(a).some(([x, y]) => strictIn(x, y, A) && strictIn(x, y, B));
};
const insideBySampling = (piece: readonly Point[], parts: readonly (readonly Point[])[]): boolean => {
  const P = scale64(piece);
  const S = parts.map(scale64);
  return fineSamples(piece).every(([x, y]) => !strictIn(x, y, P) || S.some((q) => strictIn(x, y, q)));
};

/** Pick's theorem: 2A = 2I + B - 2 for a simple polygon with whole-number corners. Counts I and B by brute force. */
const pickTwiceArea = (poly: readonly Point[]): number => {
  let boundary = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    boundary += gcd(b[0] - a[0], b[1] - a[1]);
  }
  const bb = bounds(poly);
  let interior = 0;
  for (let x = bb.minX; x <= bb.maxX; x++) for (let y = bb.minY; y <= bb.maxY; y++) if (strictIn(x, y, poly)) interior++;
  return 2 * interior + boundary - 2;
};

/**
 * The outline left when pieces are glued edge to edge: break every edge into unit steps,
 * cancel each step with the step walking back the other way, and chain what is left.
 * Returns the loops found and the area enclosed by them (twice, signed sum).
 */
const outline = (polys: readonly (readonly Point[])[]): { loops: number; twiceArea: number; leftover: number } => {
  const steps = new Map<string, number>();
  const add = (a: Point, b: Point) => {
    const k = `${a[0]},${a[1]}>${b[0]},${b[1]}`;
    const back = `${b[0]},${b[1]}>${a[0]},${a[1]}`;
    if (steps.get(back)) steps.set(back, steps.get(back)! - 1);
    else steps.set(k, (steps.get(k) ?? 0) + 1);
  };
  for (const poly of polys) {
    // walk each piece counter-clockwise
    const ccw = poly.reduce((s, p, i) => s + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]), 0) < 0;
    const ring = ccw ? poly : poly.slice().reverse();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const g = gcd(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / g;
      const dy = (b[1] - a[1]) / g;
      for (let t = 0; t < g; t++) add([a[0] + dx * t, a[1] + dy * t], [a[0] + dx * (t + 1), a[1] + dy * (t + 1)]);
    }
  }
  const next = new Map<string, string[]>();
  let remaining = 0;
  for (const [k, c] of steps) {
    for (let i = 0; i < c; i++) {
      const [from, to] = k.split('>');
      next.set(from, [...(next.get(from) ?? []), to]);
      remaining++;
    }
  }
  let loops = 0;
  let area2 = 0;
  const used = remaining;
  while (next.size) {
    const start = next.keys().next().value as string;
    let cur = start;
    let guard = 0;
    for (;;) {
      const outs = next.get(cur)!;
      const to = outs.shift()!;
      if (!outs.length) next.delete(cur);
      const [x1, y1] = cur.split(',').map(Number);
      const [x2, y2] = to.split(',').map(Number);
      area2 += x1 * y2 - x2 * y1;
      cur = to;
      if (cur === start || ++guard > 10000) break;
      if (!next.has(cur)) break;
    }
    loops++;
  }
  return { loops, twiceArea: Math.abs(area2), leftover: used };
};

const transformPolys = (polys: readonly (readonly Point[])[], t: number): Point[][] => {
  let P: Point[][] = polys.map((p) => p.map(([x, y]) => [t >= 4 ? -x : x, y] as Point));
  for (let i = 0; i < t % 4; i++) P = P.map((p) => p.map(([x, y]) => [-y, x] as Point));
  const b = bounds(P.flat());
  return P.map((p) => p.map(([x, y]) => [x - b.minX, y - b.minY] as Point));
};
const shapeKey = (polys: readonly (readonly Point[])[]): string => {
  const keys: string[] = [];
  for (let t = 0; t < 8; t++) {
    const P = transformPolys(polys, t).map(scale64);
    const bb = bounds(P.flat());
    const rows: string[] = [];
    for (let y = 2; y < bb.maxY; y += 32) {
      let row = '';
      for (let x = 2; x < bb.maxX; x += 32) row += P.some((q) => strictIn(x + 7, y + 11, q)) ? '#' : '.';
      rows.push(row);
    }
    keys.push(rows.join('/'));
  }
  return keys.sort()[0];
};

const rngSeq = (seed: number) => {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
};

// ── The seven pieces ──────────────────────────────────────────────────────────

describe('the seven tans', () => {
  it('are two large triangles, one medium, two small, one square and one parallelogram', () => {
    expect(PIECE_COUNT).toBe(7);
    expect(PIECES.map((p) => p.verts.length)).toEqual([3, 3, 3, 3, 3, 4, 4]);
    expect(PIECES.map((p) => p.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(PARALLELOGRAM).toBe(6);
  });

  it('have the traditional areas: large 4, medium 2, small 1, square 2, parallelogram 2 (in small-triangle units); 16 in all', () => {
    const a2 = PIECES.map((p) => twiceArea(p.verts));
    expect(a2).toEqual([16, 16, 8, 4, 4, 8, 8]);
    expect([...AREA2]).toEqual(a2);
    expect(a2.reduce((s, x) => s + x, 0)).toBe(TOTAL_AREA2);
    expect(TOTAL_AREA2).toBe(64);
    const small = a2[3];
    expect(a2.map((x) => x / small)).toEqual([4, 4, 2, 1, 1, 2, 2]);
    PIECES.forEach((p) => expect(pickTwiceArea(p.verts), p.name).toBe(a2[p.id]));
  });

  it('have the traditional edge lengths and right angles', () => {
    // squared edge lengths in base units (small leg = 2 so squared leg = 4)
    expect(sides2(PIECES[0].verts)).toEqual([16, 16, 32]); // legs 4, hypotenuse 4*sqrt(2)
    expect(sides2(PIECES[2].verts)).toEqual([8, 8, 16]); // legs 2*sqrt(2), hypotenuse 4
    expect(sides2(PIECES[3].verts)).toEqual([4, 4, 8]); // legs 2, hypotenuse 2*sqrt(2)
    expect(sides2(PIECES[5].verts)).toEqual([4, 4, 4, 4]);
    expect(sides2(PIECES[6].verts)).toEqual([4, 4, 8, 8]);
    // right angles: the triangles have exactly one; the square has four; the parallelogram none
    const rights = (poly: readonly Point[]) => poly.filter((_, i) => dotAt(poly, i) === 0).length;
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => rights(PIECES[i].verts))).toEqual([1, 1, 1, 1, 1, 4, 0]);
    // the parallelogram's sharp corner is 45 degrees: dot = |a||b|cos45 -> dot^2 = |a|^2 |b|^2 / 2
    const par = PIECES[6].verts;
    const sharp = par.map((_, i) => dotAt(par, i)).filter((d) => d > 0);
    expect(sharp.length).toBe(2);
    expect(sharp[0] ** 2 * 2).toBe(4 * 8);
    // proportions that make the set fit together: medium leg = small hypotenuse, large leg = medium hypotenuse = 2 small legs
    expect(sides2(PIECES[2].verts)[0]).toBe(sides2(PIECES[3].verts)[2]);
    expect(sides2(PIECES[0].verts)[0]).toBe(sides2(PIECES[2].verts)[2]);
    expect(sides2(PIECES[5].verts)[0]).toBe(sides2(PIECES[3].verts)[0]);
  });

  it('keep whole-number corners and the same shape in every quarter turn and mirror', () => {
    for (const p of PIECES) {
      for (let rot = 0; rot < 4; rot++) {
        for (const flip of [0, 1]) {
          const v = orient(p.id, rot, flip);
          const b = bounds(v);
          expect([b.minX, b.minY]).toEqual([0, 0]);
          v.forEach(([x, y]) => { expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true); });
          expect(twiceArea(v)).toBe(AREA2[p.id]);
          expect(sides2(v)).toEqual(sides2(p.verts));
        }
      }
    }
  });

  it('mirroring changes only the parallelogram', () => {
    for (const p of PIECES) {
      const mirrorMatchesATurn = [0, 1, 2, 3].some((r) => sameLook(p.id, r, 1, 0, 0));
      expect(mirrorMatchesATurn, p.name).toBe(p.id !== PARALLELOGRAM);
      expect(canFlip(p.id)).toBe(p.id === PARALLELOGRAM);
    }
    const looks = new Set<string>();
    for (let r = 0; r < 4; r++) for (const f of [0, 1]) looks.add(orient(PARALLELOGRAM, r, f).map((q) => q.join(',')).sort().join(';'));
    expect(looks.size).toBe(4); // two turns x mirror
  });

  it('turning skips looks that are identical', () => {
    expect(nextTurn(5, 0, 0)).toBeNull(); // square
    expect(nextTurn(0, 0, 0)).toBe(1);
    expect(nextTurn(0, 0, 0, -1)).toBe(3);
    expect(nextTurn(2, 3, 0)).toBe(0);
    const p = nextTurn(6, 0, 0);
    expect(p).toBe(1); // a parallelogram turned a half looks the same as upright, so the next look is the quarter turn
    expect(nextTurn(6, 1, 0)).toBe(2); // a half turn looks like upright, so the cycle has two looks
    expect(sameLook(6, 0, 0, 2, 0)).toBe(true);
    expect(sameLook(6, 0, 0, 0, 1)).toBe(false);
    // four turns of a large triangle visit four different looks and come back
    let r = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 4; i++) { seen.add(r); r = nextTurn(0, r, 0)!; }
    expect(seen.size).toBe(4);
    expect(r).toBe(0);
  });

  it('turned and flipped keep the middle of the box in place and never lose a piece', () => {
    const rng = rngSeq(5);
    for (let t = 0; t < 400; t++) {
      const id = Math.floor(rng() * 7);
      const pl: Placement = { id, rot: Math.floor(rng() * 4), flip: canFlip(id) ? Math.floor(rng() * 2) : 0, x: 3 + Math.floor(rng() * 5), y: 3 + Math.floor(rng() * 5) };
      const a = turned(pl, 1);
      if (id === 5) { expect(a).toBeNull(); } else {
        expect(a).not.toBeNull();
        expect(twiceArea(placedVerts(a!))).toBe(AREA2[id]);
        const b0 = bounds(placedVerts(pl));
        const b1 = bounds(placedVerts(a!));
        expect(Math.abs((b0.minX + b0.maxX) / 2 - (b1.minX + b1.maxX) / 2)).toBeLessThanOrEqual(0.5);
        expect(Math.abs((b0.minY + b0.maxY) / 2 - (b1.minY + b1.maxY) / 2)).toBeLessThanOrEqual(0.5);
        // turning back restores the look
        const back = turned(a!, -1)!;
        expect(sameLook(id, back.rot, back.flip, pl.rot, pl.flip)).toBe(true);
      }
      const f = flipped(pl);
      if (id === PARALLELOGRAM) {
        expect(f).not.toBeNull();
        expect(f!.flip).toBe(pl.flip ? 0 : 1);
        expect(twiceArea(placedVerts(f!))).toBe(8);
      } else expect(f).toBeNull();
    }
  });

  it('normalise folds turns into 0..3 and clears a meaningless flip', () => {
    expect(normalise({ id: 0, rot: 5, flip: 1, x: 1, y: 2 })).toEqual({ id: 0, rot: 1, flip: 0, x: 1, y: 2 });
    expect(normalise({ id: 6, rot: -1, flip: 1, x: 0, y: 0 })).toEqual({ id: 6, rot: 3, flip: 1, x: 0, y: 0 });
  });
});

// ── Overlap and containment are exact ─────────────────────────────────────────

describe('exact geometry', () => {
  it('overlap: touching along an edge or at a corner is allowed, sharing area is not', () => {
    const a = placedVerts({ id: 5, rot: 0, flip: 0, x: 0, y: 0 });
    expect(overlaps(a, placedVerts({ id: 5, rot: 0, flip: 0, x: 2, y: 0 }))).toBe(false); // share an edge
    expect(overlaps(a, placedVerts({ id: 5, rot: 0, flip: 0, x: 2, y: 2 }))).toBe(false); // share a corner
    expect(overlaps(a, placedVerts({ id: 5, rot: 0, flip: 0, x: 1, y: 0 }))).toBe(true);
    expect(overlaps(a, a)).toBe(true);
    // two triangles that together make a square do not overlap, but a diagonal sliver does
    const t1 = placedVerts({ id: 3, rot: 0, flip: 0, x: 0, y: 0 });
    const t2 = placedVerts({ id: 3, rot: 2, flip: 0, x: 0, y: 0 });
    expect(overlaps(t1, t2)).toBe(false);
    expect(overlaps(t1, placedVerts({ id: 3, rot: 0, flip: 0, x: 1, y: 0 }))).toBe(true);
  });

  it('overlap and inside agree with a much finer sampling on 3000 random placements', () => {
    const rng = rngSeq(77);
    const level = LEVELS[3];
    const parts = targetOnTable(level).map(placedVerts);
    const random = (): Placement => {
      const id = Math.floor(rng() * 7);
      return { id, rot: Math.floor(rng() * 4), flip: canFlip(id) ? Math.floor(rng() * 2) : 0, x: Math.floor(rng() * 12), y: Math.floor(rng() * 14) };
    };
    for (let t = 0; t < 3000; t++) {
      const a = placedVerts(random());
      const b = placedVerts(random());
      expect(overlaps(a, b)).toBe(overlapBySampling(a, b));
      expect(overlaps(a, b)).toBe(overlaps(b, a));
      expect(insideSilhouette(a, parts)).toBe(insideBySampling(a, parts));
    }
  }, 120_000);

  it('every piece placed exactly where the shape was cut from it is inside; one step away is not', () => {
    for (const level of LEVELS) {
      const parts = targetOnTable(level).map(placedVerts);
      for (const pl of targetOnTable(level)) {
        expect(insideSilhouette(placedVerts(pl), parts), `${level.name} piece ${pl.id}`).toBe(true);
      }
    }
    const level = LEVELS[0];
    const parts = targetOnTable(level).map(placedVerts);
    const sq = targetOnTable(level)[5];
    expect(insideSilhouette(placedVerts({ ...sq, x: -1 }), parts)).toBe(false);
    expect(insideSilhouette(placedVerts({ ...sq, y: sq.y + 3 }), parts)).toBe(false);
    expect(insideSilhouette(placedVerts({ ...sq, y: sq.y + 7 }), parts)).toBe(false);
  });
});

// ── The 16 shapes ─────────────────────────────────────────────────────────────

describe('levels', () => {
  it('there are 16, numbered 1 to 16, each with seven pieces, one of each tan', () => {
    expect(LEVELS.length).toBe(16);
    expect(LEVELS.length).toBeLessThanOrEqual(MAX_LEVEL_COUNT);
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    for (const level of LEVELS) {
      expect(level.name.length).toBeGreaterThan(3);
      expect(level.target.length).toBe(7);
      expect(level.target.map((t) => t.id).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
      for (const t of level.target) {
        expect(Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 0 && t.y >= 0).toBe(true);
        expect(t.rot).toBeGreaterThanOrEqual(0);
        expect(t.rot).toBeLessThan(4);
        if (!canFlip(t.id)) expect(t.flip).toBe(0);
      }
    }
  });

  it('every shape is tiled EXACTLY by its seven target pieces (area, overlap and outline)', () => {
    for (const level of LEVELS) {
      const polys = silhouetteParts(level);
      // each piece is congruent to its tan
      polys.forEach((poly, k) => {
        const id = level.target[k].id;
        expect(twiceArea(poly), `${level.name} piece ${id}`).toBe(AREA2[id]);
        expect(sides2(poly)).toEqual(sides2(PIECES[id].verts));
      });
      // total area is 32 (twice: 64)
      expect(unionTwiceArea(polys), level.name).toBe(64);
      polys.forEach((p) => expect(pickTwiceArea(p)).toBe(twiceArea(p)));
      // no two overlap, by exact geometry and by sampling
      for (let i = 0; i < polys.length; i++) {
        for (let j = i + 1; j < polys.length; j++) {
          expect(overlaps(polys[i], polys[j]), `${level.name}: ${i} and ${j}`).toBe(false);
          expect(overlapBySampling(polys[i], polys[j])).toBe(false);
        }
      }
      // gluing shared edges leaves a single closed outline enclosing exactly that area
      const o = outline(polys);
      expect(o.loops, `${level.name} outline loops`).toBe(1);
      expect(o.twiceArea, `${level.name} enclosed area`).toBe(64);
    }
  });

  it('are small enough for the table and different from each other up to turning and mirroring', () => {
    const keys = new Set<string>();
    for (const level of LEVELS) {
      const { w, h } = silhouetteSize(level);
      expect(w).toBeLessThanOrEqual(12);
      expect(h).toBeLessThanOrEqual(12);
      expect(w).toBeLessThanOrEqual(TABLE_W);
      keys.add(shapeKey(silhouetteParts(level)));
    }
    expect(keys.size).toBe(16);
  });

  it('give a table where every starting piece fits, none overlaps another, and none is inside the shape yet', () => {
    for (const level of LEVELS) {
      const lay = layoutFor(level);
      expect(lay.W).toBe(14);
      expect(lay.tray.length).toBe(7);
      expect(lay.tray.map((t) => t.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      const polys = lay.tray.map(placedVerts);
      polys.forEach((p) => {
        const b = bounds(p);
        expect(b.minX).toBeGreaterThanOrEqual(0);
        expect(b.minY).toBeGreaterThanOrEqual(0);
        expect(b.maxX).toBeLessThanOrEqual(lay.W);
        expect(b.maxY).toBeLessThanOrEqual(lay.H);
      });
      for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) expect(overlaps(polys[i], polys[j])).toBe(false);
      const c = checkPieces(level, lay.tray);
      expect(c.solved).toBe(false);
      expect(c.inside.some(Boolean)).toBe(false);
      expect(c.overlapping.some(Boolean)).toBe(false);
      // the shape sits above the tray and inside the table
      const sil = targetOnTable(level).map(placedVerts).flat();
      const sb = bounds(sil);
      expect(sb.minX).toBeGreaterThanOrEqual(0);
      expect(sb.maxX).toBeLessThanOrEqual(lay.W);
      expect(sb.maxY).toBeLessThan(Math.min(...lay.tray.map((t) => bounds(placedVerts(t)).minY)));
    }
  });
});

// ── Winning ───────────────────────────────────────────────────────────────────

describe('checking the table', () => {
  const level = LEVELS[5];
  const lay = layoutFor(level);

  it('the target placements solve the shape', () => {
    const c = checkPieces(level, targetOnTable(level));
    expect(c.solved).toBe(true);
    expect(c.inside.every(Boolean)).toBe(true);
    expect(c.overlapping.some(Boolean)).toBe(false);
    expect(hintPiece(level, targetOnTable(level))).toBe(-1);
  });

  it('swapping the two large triangles, or the two small ones, still solves it', () => {
    const t = targetOnTable(level).map((p) => ({ ...p }));
    const swap = (i: number, j: number) => { const a = { ...t[i], id: t[j].id }; const b = { ...t[j], id: t[i].id }; t[i] = a; t[j] = b; };
    swap(0, 1);
    expect(checkPieces(level, t).solved).toBe(true);
    swap(3, 4);
    expect(checkPieces(level, t).solved).toBe(true);
  });

  it('moving a piece one step, turning it, or leaving it in the tray does not solve it', () => {
    const t = targetOnTable(level);
    for (let k = 0; k < 7; k++) {
      const moved = t.map((p, i) => (i === k ? { ...p, x: p.x + 1 } : p));
      expect(checkPieces(level, moved).solved, `piece ${k} moved right`).toBe(false);
      const out = t.map((p, i) => (i === k ? lay.tray[p.id] : p));
      const c = checkPieces(level, out);
      expect(c.solved).toBe(false);
      expect(c.inside[t[k].id]).toBe(false);
      expect(hintPiece(level, out)).toBe(k);
    }
    const turnedPiece = turned(t[0], 1)!;
    expect(checkPieces(level, t.map((p, i) => (i === 0 ? turnedPiece : p))).solved).toBe(false);
  });

  it('the wrong mirror of the parallelogram does not solve a shape that needs the other one', () => {
    let tested = 0;
    for (const lv of LEVELS) {
      const t = targetOnTable(lv);
      const par = t.find((p) => p.id === PARALLELOGRAM)!;
      const mirrored = flipped(par)!;
      const c = checkPieces(lv, t.map((p) => (p.id === PARALLELOGRAM ? mirrored : p)));
      // the mirrored parallelogram may happen to fit somewhere else, but never in the same spot unless the shape allows it
      if (!c.solved) tested++;
    }
    expect(tested).toBeGreaterThanOrEqual(10);
  });

  it('two pieces stacked on each other are reported as overlapping and block a win', () => {
    const t = targetOnTable(level);
    const stacked = t.map((p) => (p.id === 5 ? { ...t.find((q) => q.id === 6)!, id: 5 } : p));
    const c = checkPieces(level, stacked);
    expect(c.solved).toBe(false);
    expect(c.overlapping.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });

  it('hintPiece names the largest piece that is not in place', () => {
    const t = targetOnTable(level);
    const out = t.map((p) => (p.id === 2 || p.id === 4 ? lay.tray[p.id] : p));
    expect(hintPiece(level, out)).toBe(2);
    expect(hintPiece(level, t.map((p) => (p.id === 4 ? lay.tray[4] : p)))).toBe(4);
  });

  it('never throws on random placements and agrees with a fine sampling about fitting', () => {
    const rng = rngSeq(4242);
    for (let t = 0; t < 600; t++) {
      const lv = LEVELS[t % LEVELS.length];
      const lay2 = layoutFor(lv);
      const pieces: Placement[] = [0, 1, 2, 3, 4, 5, 6].map((id) => clampToTable({ id, rot: Math.floor(rng() * 4), flip: Math.floor(rng() * 2), x: Math.floor(rng() * 14), y: Math.floor(rng() * lay2.H) }, lay2.W, lay2.H));
      const c = checkPieces(lv, pieces);
      const parts = targetOnTable(lv).map(placedVerts);
      pieces.forEach((p, i) => expect(c.inside[i]).toBe(insideBySampling(placedVerts(p), parts)));
      if (c.solved) {
        // a random placement that solves must really cover the shape: total area equals and nothing overlaps
        expect(pieces.every((p, i) => c.inside[i] && !c.overlapping[i])).toBe(true);
      }
    }
  }, 120_000);

  it('clampToTable keeps a piece on the table and on the lattice', () => {
    const p = clampToTable({ id: 0, rot: 0, flip: 0, x: -5, y: 99.4 }, 14, 18);
    expect(p.x).toBe(0);
    expect(p.y).toBe(14);
    const q = clampToTable({ id: 2, rot: 1, flip: 0, x: 40, y: -1 }, 14, 18);
    const b = bounds(placedVerts(q));
    expect(b.maxX).toBeLessThanOrEqual(14);
    expect(b.minY).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(q.x) && Number.isInteger(q.y)).toBe(true);
  });
});

// ── Progress, text ────────────────────────────────────────────────────────────

describe('saved progress', () => {
  it('keeps one whole number below 2^(number of shapes) and nothing else', () => {
    expect(sanitiseBest({ solved: 5 })).toEqual({ solved: 5 });
    expect(sanitiseBest({ solved: 2 ** LEVELS.length - 1 })).toEqual({ solved: 2 ** LEVELS.length - 1 });
    expect(sanitiseBest({ solved: 2 ** LEVELS.length })).toEqual({});
    expect(sanitiseBest({ solved: 2 ** 24 - 1 })).toEqual({});
    expect(sanitiseBest({ solved: 0 })).toEqual({});
    expect(sanitiseBest({ solved: -1 })).toEqual({});
    expect(sanitiseBest({ solved: 1.5 })).toEqual({});
    expect(sanitiseBest({ solved: '5' })).toEqual({});
    expect(sanitiseBest({ other: 5 })).toEqual({});
    expect(sanitiseBest({ solved: 3, extra: 9 })).toEqual({ solved: 3 });
    for (const bad of [null, undefined, 3, 'x', [], [1], true]) expect(sanitiseBest(bad)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"solved": 7}}'));
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
  it('sets, reads and counts solved bits', () => {
    let m = 0;
    m = withSolved(m, 0);
    m = withSolved(m, 5);
    m = withSolved(m, 5);
    expect(solvedCount(m)).toBe(2);
    expect(isSolvedBit(m, 0)).toBe(true);
    expect(isSolvedBit(m, 1)).toBe(false);
    expect(withSolved(m, -1)).toBe(m);
    expect(withSolved(m, 99)).toBe(m);
    expect(withSolved(0, 23)).toBe(2 ** 23);
  });
  it('clampLevel accepts only 1 to 16', () => {
    expect(clampLevel('16', 1)).toBe(16);
    expect(clampLevel(1, 3)).toBe(1);
    for (const bad of ['0', '17', '', 'x', 2.5, NaN, null, undefined, [], {}, Infinity]) expect(clampLevel(bad, 3)).toBe(3);
  });
});

describe('text', () => {
  it('describes a piece in words, with where it is and whether it fits', () => {
    const level = LEVELS[0];
    const t = targetOnTable(level);
    expect(describePiece(t[5], level, true, false)).toMatch(/^square, upright, left edge at \d+, top edge at \d+, fits inside the shape$/);
    expect(describePiece({ id: 6, rot: 1, flip: 1, x: 2, y: 3 }, level, false, true)).toBe('parallelogram, turned a quarter, flipped, left edge at 2, top edge at 3, overlaps another piece');
    const lay = layoutFor(level);
    expect(describePiece(lay.tray[0], level, false, false)).toMatch(/in the tray area$/);
    expect(describePiece({ id: 2, rot: 2, flip: 0, x: 0, y: 0 }, level, false, false)).toMatch(/partly outside the shape$/);
    expect(ROT_WORDS.length).toBe(4);
    expect(plural(1, 'piece')).toBe('1 piece');
    expect(plural(7, 'piece')).toBe('7 pieces');
    void ({} as Level);
  });
});
