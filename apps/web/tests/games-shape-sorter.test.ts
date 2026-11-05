/**
 * games-shape-sorter.test.ts - the engine behind `shape-sorter`.
 *
 * Pinned: a round never asks the impossible (every hole is wanted by at least one
 * piece, every piece has exactly one right hole, checked against a second, table
 * based statement of the rule), the number of holes and pieces follows the level
 * (kinds, kinds + 2, size capped at three), the things a mode must not vary stay
 * fixed, the same seed gives the same round, a miss changes nothing but the miss
 * count, a right piece is stored once, a finished round ignores everything,
 * random play always finishes, the step-up ladder offers once after five first-try
 * pieces and a Try again breaks the row, stored scores are sanitised, the shape
 * drawings stay inside their box, every colour has its own mark, the kind wording
 * never scolds, and the page source has no timers, no sound and 56 px targets.
 */
import { describe, it, expect } from 'vitest';
import {
  mulberry32, randInt, shuffled, MODES, SHAPES, COLOURS, SIZES, MODE_NAME, COLOUR_NAME, SHAPE_NAME, SIZE_NAME, SIZE_SCALE, isMode,
  KINDS, SIZE_MODE_MAX, KINDS_NAME, isKinds, effectiveKinds, pieceCount, nextKinds, keyOf, makeRound, newGame, isPlaced, isDone, piecesLeft, holeContents,
  place, rightHole, STEP_UP_AT, newLadder, ladderAfterWrong, ladderAfterRight, wantsStepUp, ladderAfterOffer, SHELF_SIZE, CAPS, emptySaved,
  sanitiseSaved, addStar, recordRound, SHAPE_GEOMETRY, COLOUR_MARK, COLOUR_MARK_WORD, pieceName, holeName, kindsWord, instruction, pickedText,
  placedText, tryAgainText, doneText, offerText, shelfText, shareSummary, type Mode, type Piece, type Game, type Round,
} from '../src/components/apps-private/shape-sorter/helpers';
import calculatorSource from '../src/components/apps-private/shape-sorter/Calculator.astro?raw';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 6007 + 3);

/** A second statement of the sorting rule, as a table, to check the engine against. */
const RULE: Record<Mode, (p: Piece) => string> = {
  shape: (p) => p.shape,
  colour: (p) => p.colour,
  size: (p) => p.size,
};

describe('names, sizes and levels', () => {
  it('has six shapes, six colours and three sizes, each with its own word', () => {
    expect(SHAPES).toHaveLength(6);
    expect(COLOURS).toHaveLength(6);
    expect(SIZES).toEqual(['small', 'medium', 'big']);
    expect(new Set(SHAPES.map((s) => SHAPE_NAME[s])).size).toBe(6);
    expect(new Set(COLOURS.map((c) => COLOUR_NAME[c])).size).toBe(6);
    expect(new Set(SIZES.map((s) => SIZE_NAME[s])).size).toBe(3);
    expect(MODES.map((m) => MODE_NAME[m])).toEqual(['Shape', 'Colour', 'Size']);
  });
  it('makes bigger sizes strictly bigger and the biggest fill the box', () => {
    expect(SIZE_SCALE.small).toBeLessThan(SIZE_SCALE.medium);
    expect(SIZE_SCALE.medium).toBeLessThan(SIZE_SCALE.big);
    expect(SIZE_SCALE.big).toBe(1);
    expect(SIZE_SCALE.small).toBeGreaterThan(0.3);
  });
  it('validates modes and levels coming from the address bar', () => {
    for (const m of MODES) expect(isMode(m)).toBe(true);
    for (const junk of ['', 'SHAPE', 'sizes', '__proto__', 3, null, undefined, {}, []]) expect(isMode(junk)).toBe(false);
    for (const k of KINDS) expect(isKinds(k)).toBe(true);
    for (const junk of [0, 1, 5, 7, 2.5, NaN, '2', null, undefined, -2]) expect(isKinds(junk)).toBe(false);
    expect(KINDS).toEqual([2, 3, 4, 6]);
    expect(KINDS.map((k) => KINDS_NAME[k])).toEqual(['Two', 'Three', 'Four', 'Six']);
  });
  it('caps size at three kinds and leaves the others alone', () => {
    expect(SIZE_MODE_MAX).toBe(3);
    expect(effectiveKinds('size', 2)).toBe(2);
    expect(effectiveKinds('size', 3)).toBe(3);
    expect(effectiveKinds('size', 4)).toBe(3);
    expect(effectiveKinds('size', 6)).toBe(3);
    expect(effectiveKinds('shape', 6)).toBe(6);
    expect(effectiveKinds('colour', 4)).toBe(4);
  });
  it('asks the player to sort kinds + 2 pieces', () => {
    expect(KINDS.map(pieceCount)).toEqual([4, 5, 6, 8]);
  });
  it('steps 2 to 3 to 4 to 6 and stops, and size stops at 3', () => {
    expect(nextKinds('shape', 2)).toBe(3);
    expect(nextKinds('shape', 3)).toBe(4);
    expect(nextKinds('shape', 4)).toBe(6);
    expect(nextKinds('shape', 6)).toBeNull();
    expect(nextKinds('colour', 6)).toBeNull();
    expect(nextKinds('size', 2)).toBe(3);
    expect(nextKinds('size', 3)).toBeNull();
    expect(nextKinds('size', 6)).toBeNull();
  });
});

describe('randomness helpers', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('randInt stays in bounds for a bad rng and shuffled keeps every element', () => {
    for (const bad of [NaN, Infinity, -Infinity, -3, 4]) {
      const v = randInt(() => bad, 2, 6);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(6);
    }
    const input = [1, 2, 3, 4, 5];
    expect([...shuffled(input, mulberry32(9))].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('rounds are never impossible', () => {
  const rounds: Round[] = [];
  for (const mode of MODES) for (const k of KINDS) for (const seed of SEEDS) rounds.push(makeRound(mode, k, mulberry32(seed)));

  it('has as many holes as the level says, all different and all valid for the mode', () => {
    const valid: Record<Mode, readonly string[]> = { shape: SHAPES, colour: COLOURS, size: SIZES };
    for (const r of rounds) {
      expect(r.holes).toHaveLength(effectiveKinds(r.mode, r.kinds));
      expect(new Set(r.holes).size).toBe(r.holes.length);
      for (const h of r.holes) expect(valid[r.mode]).toContain(h);
    }
  });
  it('has kinds + 2 pieces with ids 0..n-1', () => {
    for (const r of rounds) {
      expect(r.pieces).toHaveLength(pieceCount(r.kinds));
      expect(r.pieces.map((p) => p.id)).toEqual(r.pieces.map((_, i) => i));
    }
  });
  it('gives every piece exactly one right hole, by the table rule', () => {
    for (const r of rounds) {
      for (const p of r.pieces) {
        const matching = r.holes.filter((h) => h === RULE[r.mode](p));
        expect(matching, `piece ${p.id}`).toHaveLength(1);
        expect(keyOf(p, r.mode)).toBe(RULE[r.mode](p));
      }
    }
  });
  it('wants every hole: each hole takes at least one piece', () => {
    for (const r of rounds) for (const h of r.holes) expect(r.pieces.some((p) => RULE[r.mode](p) === h), `${r.mode} ${h}`).toBe(true);
  });
  it('keeps size at 2 holes small and big, and 3 holes small, medium and big', () => {
    for (const r of rounds.filter((x) => x.mode === 'size')) {
      expect(r.holes).toEqual(r.kinds === 2 ? ['small', 'big'] : ['small', 'medium', 'big']);
    }
  });
  it('varies only what each mode should: colours in shape mode, shapes in colour mode, nothing else in size mode', () => {
    for (const r of rounds) {
      if (r.mode === 'shape') {
        expect(r.pieces.every((p) => p.size === 'big')).toBe(true);
        expect(r.pieces.every((p) => ['sky', 'amber', 'rose'].includes(p.colour))).toBe(true);
      }
      if (r.mode === 'colour') {
        expect(r.pieces.every((p) => p.size === 'big')).toBe(true);
        expect(r.pieces.every((p) => ['circle', 'square', 'triangle'].includes(p.shape))).toBe(true);
      }
      if (r.mode === 'size') {
        expect(new Set(r.pieces.map((p) => p.shape)).size).toBe(1);
        expect(new Set(r.pieces.map((p) => p.colour)).size).toBe(1);
      }
    }
  });
  it('varies the pieces: over many rounds shape mode shows several colours and colour mode several shapes', () => {
    const colours = new Set<string>();
    const shapes = new Set<string>();
    for (const r of rounds) {
      if (r.mode === 'shape') r.pieces.forEach((p) => colours.add(p.colour));
      if (r.mode === 'colour') r.pieces.forEach((p) => shapes.add(p.shape));
    }
    expect(colours.size).toBe(3);
    expect(shapes.size).toBe(3);
  });
  it('is the same round for the same seed, and different for a different seed', () => {
    for (const mode of MODES) expect(makeRound(mode, 4, mulberry32(77))).toEqual(makeRound(mode, 4, mulberry32(77)));
    expect(JSON.stringify(makeRound('shape', 6, mulberry32(1)))).not.toBe(JSON.stringify(makeRound('shape', 6, mulberry32(2))));
  });
  it('survives a broken rng', () => {
    for (const bad of [NaN, Infinity, -1, 9]) {
      for (const mode of MODES) {
        const r = makeRound(mode, 6, () => bad);
        expect(r.holes).toHaveLength(effectiveKinds(mode, 6));
        for (const h of r.holes) expect(r.pieces.some((p) => RULE[mode](p) === h)).toBe(true);
      }
    }
  });
});

describe('playing a round', () => {
  const fresh = (mode: Mode = 'shape', k = 4, seed = 5): Game => newGame(makeRound(mode, k, mulberry32(seed)));

  it('starts empty, not done, with every piece left', () => {
    const g = fresh();
    expect(g.placed).toEqual([]);
    expect(g.misses).toBe(0);
    expect(isDone(g)).toBe(false);
    expect(piecesLeft(g)).toEqual(g.round.pieces);
  });
  it('finds each piece its right hole, matching the table rule', () => {
    for (const mode of MODES) {
      for (const seed of SEEDS.slice(0, 50)) {
        const g = fresh(mode, 6, seed);
        for (const p of g.round.pieces) expect(g.round.holes[rightHole(g, p.id)]).toBe(RULE[mode](p));
      }
    }
    expect(rightHole(fresh(), 999)).toBe(-1);
  });
  it('stores a piece in its right hole once, and reports a first try', () => {
    for (const mode of MODES) {
      let g = fresh(mode, 3, 11);
      const p = g.round.pieces[0];
      const out = place(g, p.id, rightHole(g, p.id));
      expect(out.result).toBe('placed');
      expect(out.firstTry).toBe(true);
      expect(out.game.placed).toEqual([p.id]);
      expect(isPlaced(out.game, p.id)).toBe(true);
      // The old game is untouched.
      expect(g.placed).toEqual([]);
      // Putting it away again is ignored and returns the same object.
      const again = place(out.game, p.id, rightHole(g, p.id));
      expect(again.result).toBe('ignored');
      expect(again.game).toBe(out.game);
      g = out.game;
      expect(piecesLeft(g).some((x) => x.id === p.id)).toBe(false);
    }
  });
  it('counts a miss, changes nothing else, and the later right tap is not a first try', () => {
    const g = fresh('colour', 4, 3);
    const p = g.round.pieces[0];
    const right = rightHole(g, p.id);
    const wrong = (right + 1) % g.round.holes.length;
    const miss = place(g, p.id, wrong);
    expect(miss.result).toBe('miss');
    expect(miss.firstTry).toBe(false);
    expect(miss.game.placed).toEqual([]);
    expect(miss.game.misses).toBe(1);
    expect(miss.game.missed).toEqual([p.id]);
    expect(g.misses).toBe(0); // the old game is not mutated
    const miss2 = place(miss.game, p.id, wrong);
    expect(miss2.game.misses).toBe(2);
    expect(miss2.game.missed).toEqual([p.id]); // listed once
    const ok = place(miss2.game, p.id, right);
    expect(ok.result).toBe('placed');
    expect(ok.firstTry).toBe(false);
    expect(ok.game.misses).toBe(2);
  });
  it('ignores unknown pieces, bad hole numbers and a finished round', () => {
    const g = fresh('shape', 2, 4);
    for (const bad of [-1, 99, 1.5, NaN, Infinity]) {
      const out = place(g, g.round.pieces[0].id, bad);
      expect(out.result).toBe('ignored');
      expect(out.game).toBe(g);
    }
    expect(place(g, 999, 0).result).toBe('ignored');
    expect(place(g, -1, 0).result).toBe('ignored');
    let cur = g;
    for (const p of g.round.pieces) cur = place(cur, p.id, rightHole(cur, p.id)).game;
    expect(isDone(cur)).toBe(true);
    const after = place(cur, 0, 0);
    expect(after.result).toBe('ignored');
    expect(after.game).toBe(cur);
  });
  it('puts every piece away in its right hole and finishes, in any order', () => {
    for (const mode of MODES) {
      for (const seed of SEEDS.slice(0, 40)) {
        let g = fresh(mode, 6, seed);
        const order = shuffled(g.round.pieces.map((p) => p.id), mulberry32(seed));
        for (const id of order) {
          const out = place(g, id, rightHole(g, id));
          expect(out.result).toBe('placed');
          g = out.game;
        }
        expect(isDone(g)).toBe(true);
        expect(piecesLeft(g)).toEqual([]);
        // Each hole's contents are exactly the pieces the table rule sends there.
        g.round.holes.forEach((h, i) => {
          const expected = g.round.pieces.filter((p) => RULE[mode](p) === h).map((p) => p.id).sort();
          expect(holeContents(g, i).map((p) => p.id).sort()).toEqual(expected);
        });
      }
    }
  });
  it('random play never breaks an invariant and always finishes', () => {
    for (const mode of MODES) {
      for (const seed of SEEDS.slice(0, 25)) {
        const rng = mulberry32(seed + 1);
        let g = fresh(mode, 6, seed);
        let misses = 0;
        for (let step = 0; step < 4000 && !isDone(g); step++) {
          const id = randInt(rng, -1, g.round.pieces.length);
          const hole = randInt(rng, -1, g.round.holes.length);
          const out = place(g, id, hole);
          if (out.result === 'miss') misses += 1;
          g = out.game;
          expect(new Set(g.placed).size).toBe(g.placed.length);
          for (const pid of g.placed) {
            const piece = g.round.pieces[pid];
            expect(g.round.holes).toContain(RULE[mode](piece));
          }
          expect(g.misses).toBe(misses);
        }
        expect(isDone(g), `${mode} #${seed}`).toBe(true);
        // Everything in a hole belongs there.
        g.round.holes.forEach((h, i) => { for (const p of holeContents(g, i)) expect(RULE[mode](p)).toBe(h); });
      }
    }
  }, 60_000);
});

describe('the gentle step-up ladder', () => {
  it('counts only first-try pieces and offers after exactly five', () => {
    let l = newLadder();
    for (let i = 1; i <= STEP_UP_AT; i++) {
      expect(wantsStepUp(l, 'shape', 2)).toBe(false);
      l = ladderAfterRight(l, 'clean');
      expect(l.streak).toBe(i);
    }
    expect(STEP_UP_AT).toBe(5);
    expect(wantsStepUp(l, 'shape', 2)).toBe(true);
    expect(wantsStepUp(l, 'shape', 4)).toBe(true);
  });
  it('does not offer at the top: six shapes, or three sizes', () => {
    let l = newLadder();
    for (let i = 0; i < 6; i++) l = ladderAfterRight(l, 'clean');
    expect(wantsStepUp(l, 'shape', 6)).toBe(false);
    expect(wantsStepUp(l, 'colour', 6)).toBe(false);
    expect(wantsStepUp(l, 'size', 3)).toBe(false);
    expect(wantsStepUp(l, 'size', 6)).toBe(false);
    expect(wantsStepUp(l, 'size', 2)).toBe(true);
  });
  it('a second-try piece neither adds to the row nor breaks it', () => {
    const l = ladderAfterRight(ladderAfterRight(newLadder(), 'clean'), 'clean');
    expect(ladderAfterRight(l, 'retry').streak).toBe(2);
  });
  it('a Try again breaks the row, the offer is made once, and again after a new five', () => {
    let l = newLadder();
    for (let i = 0; i < 5; i++) l = ladderAfterRight(l, 'clean');
    l = ladderAfterOffer(l);
    expect(wantsStepUp(l, 'shape', 2)).toBe(false);
    l = ladderAfterWrong(l);
    expect(l).toEqual(newLadder());
    for (let i = 0; i < 5; i++) l = ladderAfterRight(l, 'clean');
    expect(wantsStepUp(l, 'shape', 2)).toBe(true);
  });
  it('words the offer with the next number of shapes, colours or sizes', () => {
    expect(offerText('shape', 2)).toBe('5 in a row! Want to try 3 shapes?');
    expect(offerText('colour', 4)).toBe('5 in a row! Want to try 6 colours?');
    expect(offerText('size', 2)).toBe('5 in a row! Want to try 3 sizes?');
    expect(offerText('shape', 6)).toBe('');
    expect(offerText('size', 3)).toBe('');
    expect(kindsWord('shape', 3)).toBe('3 shapes');
  });
});

describe('the shelf and stored totals', () => {
  it('has five star places and never adds a sixth', () => {
    expect(SHELF_SIZE).toBe(5);
    let n = 0;
    for (let i = 1; i <= 5; i++) {
      n = addStar(n);
      expect(n).toBe(i);
    }
    expect(addStar(n)).toBe(5);
    expect(addStar(-2)).toBe(1);
    expect(addStar(NaN)).toBe(1);
  });
  it('records a round, a full shelf and the best row', () => {
    let s = emptySaved();
    s = recordRound(s, 3, false);
    s = recordRound(s, 1, false);
    expect(s).toEqual({ stars: 2, shelves: 0, row: 3 });
    s = recordRound(s, 9, true);
    expect(s).toEqual({ stars: 3, shelves: 1, row: 9 });
  });
  it('caps every stored number', () => {
    expect(recordRound({ stars: CAPS.stars, shelves: CAPS.shelves, row: CAPS.row }, 5000, true)).toEqual({ stars: CAPS.stars, shelves: CAPS.shelves, row: CAPS.row });
  });
  it('sanitises stored data into a fresh, bounded object', () => {
    expect(sanitiseSaved({ stars: 12, shelves: 2, row: 7 })).toEqual({ stars: 12, shelves: 2, row: 7 });
    for (const junk of [null, undefined, [], 'x', 5, true]) expect(sanitiseSaved(junk)).toEqual(emptySaved());
    expect(sanitiseSaved({ stars: -1, shelves: 2.5, row: NaN })).toEqual(emptySaved());
    expect(sanitiseSaved({ stars: '3', shelves: null, row: {} })).toEqual(emptySaved());
    expect(sanitiseSaved({ stars: 1e12, shelves: 1e12, row: 1e12 })).toEqual({ stars: CAPS.stars, shelves: CAPS.shelves, row: CAPS.row });
    const evil = JSON.parse('{"__proto__": {"stars": 9}, "stars": 4, "extra": 1}');
    const out = sanitiseSaved(evil);
    expect(out).toEqual({ stars: 4, shelves: 0, row: 0 });
    expect(Object.keys(out).sort()).toEqual(['row', 'shelves', 'stars']);
  });
});

describe('the drawings', () => {
  const numbers = (s: string): number[] => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

  it('draws every shape inside a 4 to 96 box so an outline is never clipped', () => {
    for (const s of SHAPES) {
      const geo = SHAPE_GEOMETRY[s];
      let nums: number[] = [];
      if (geo.tag === 'circle') {
        const { cx, cy, r } = geo.attrs;
        expect(Number(cx) - Number(r)).toBeGreaterThanOrEqual(4);
        expect(Number(cx) + Number(r)).toBeLessThanOrEqual(96);
        expect(Number(cy) - Number(r)).toBeGreaterThanOrEqual(4);
        expect(Number(cy) + Number(r)).toBeLessThanOrEqual(96);
        continue;
      }
      if (geo.tag === 'rect') {
        const a = geo.attrs;
        nums = [Number(a.x), Number(a.y), Number(a.x) + Number(a.width), Number(a.y) + Number(a.height)];
      } else if (geo.tag === 'polygon') nums = numbers(geo.attrs.points);
      else nums = numbers(geo.attrs.d);
      expect(nums.length, s).toBeGreaterThanOrEqual(4);
      for (const n of nums) {
        expect(n, `${s} ${n}`).toBeGreaterThanOrEqual(4);
        expect(n, `${s} ${n}`).toBeLessThanOrEqual(96);
      }
    }
  });
  it('draws the polygons with the right number of corners and a star that is a real star', () => {
    const count = (s: ShapeId) => (SHAPE_GEOMETRY[s] as { attrs: { points: string } }).attrs.points.split(' ').length;
    expect(count('triangle')).toBe(3);
    expect(count('hexagon')).toBe(6);
    expect(count('star')).toBe(10);
    // The star alternates outer and inner points: inner points are closer to the middle.
    const pts = (SHAPE_GEOMETRY.star as { attrs: { points: string } }).attrs.points.split(' ').map((p) => p.split(',').map(Number));
    const dist = pts.map(([x, y]) => Math.hypot(x - 50, y - 54));
    dist.forEach((d, i) => expect(d).toBeCloseTo(i % 2 === 0 ? 46 : 19, 1));
  });
  it('gives every colour its own mark, drawn near the middle of a shape', () => {
    expect(new Set(COLOURS.map((c) => COLOUR_MARK[c])).size).toBe(6);
    expect(new Set(COLOURS.map((c) => COLOUR_MARK_WORD[c])).size).toBe(6);
    for (const c of COLOURS) {
      expect(COLOUR_MARK[c]).toMatch(/^M/);
      for (const n of numbers(COLOUR_MARK[c])) {
        expect(n).toBeGreaterThanOrEqual(34);
        expect(n).toBeLessThanOrEqual(70);
      }
    }
  });
});

describe('the words', () => {
  const never = /\b(wrong|incorrect|fail|failed|failure|bad|mistake|error|lose|lost|game over|stupid|silly|no!)\b/i;
  const allText = (): string[] => {
    const out: string[] = [];
    for (const mode of MODES) {
      out.push(instruction(mode), tryAgainText(mode));
      for (const k of KINDS) {
        out.push(offerText(mode, k));
        const g = newGame(makeRound(mode, k, mulberry32(k)));
        for (const p of g.round.pieces) {
          out.push(pickedText(p, mode), placedText(p, keyOf(p, mode), mode, 0), placedText(p, keyOf(p, mode), mode, 3));
        }
        out.push(doneText(g));
      }
    }
    for (let n = 0; n <= 5; n++) out.push(shelfText(n));
    out.push(shareSummary(emptySaved()), shareSummary({ stars: 1, shelves: 0, row: 1 }), shareSummary({ stars: 12, shelves: 2, row: 6 }));
    return out;
  };
  it('never scolds, never has an em-dash', () => {
    for (const t of allText()) {
      expect(t, t).not.toMatch(never);
      expect(t.includes('—')).toBe(false);
    }
  });
  it('names pieces and holes in plain words', () => {
    const p: Piece = { id: 0, shape: 'star', colour: 'rose', size: 'small' };
    expect(pieceName(p, 'shape')).toBe('red star');
    expect(pieceName(p, 'size')).toBe('small red star');
    expect(holeName('star', 'shape')).toBe('star hole');
    expect(holeName('sky', 'colour')).toBe('blue box');
    expect(holeName('big', 'size')).toBe('big box');
    expect(placedText(p, 'rose', 'colour', 0)).toBe('Yes! The red star goes in the red box.');
    expect(placedText(p, 'star', 'shape', 2)).toBe('Yes! The red star goes in the star hole. 2 left.');
    expect(pickedText(p, 'shape')).toBe('Picked the red star. Now tap where it goes.');
  });
  it('points at what to look at after a miss', () => {
    expect(tryAgainText('shape')).toBe('Try again. Look at the shape.');
    expect(tryAgainText('colour')).toBe('Try again. Look at the colour.');
    expect(tryAgainText('size')).toBe('Try again. Look at the size.');
  });
  it('celebrates the exact number of pieces', () => {
    for (const k of KINDS) {
      const g = newGame(makeRound('shape', k, mulberry32(1)));
      expect(doneText(g)).toBe(`You sorted all ${pieceCount(k)} pieces!`);
    }
  });
  it('says the shelf and the share line correctly in every state', () => {
    expect(shelfText(0)).toBe('0 of 5 stars on the shelf.');
    expect(shelfText(3)).toBe('3 of 5 stars on the shelf.');
    expect(shelfText(5)).toBe('Your shelf is full: 5 stars.');
    expect(shareSummary(emptySaved())).toBe('Shape Sorter - I have not finished a round yet.');
    expect(shareSummary({ stars: 1, shelves: 0, row: 1 })).toBe('Shape Sorter - 1 round sorted, 0 shelves full, best row 1.');
    expect(shareSummary({ stars: 12, shelves: 1, row: 6 })).toBe('Shape Sorter - 12 rounds sorted, 1 shelf full, best row 6.');
  });
});

describe('the page source keeps its promises', () => {
  const src = calculatorSource.replace(/\r\n?/g, '\n');
  it('has no timer and no sound', () => {
    expect(src).not.toMatch(/\b(setTimeout|setInterval)\b/);
    expect(src).not.toMatch(/AudioContext|new Audio\(|speechSynthesis|oscillator/i);
  });
  it('makes pieces, holes, levels, modes and buttons at least 56 px (3.5rem)', () => {
    for (const cls of ['ss-piece', 'ss-hole', 'ss-level', 'ss-mode', 'ss-big']) {
      expect(src, cls).toMatch(new RegExp(`\\.${cls}[^}]*min-height:\\s*(3\\.5rem|4\\.5rem|5\\.5rem)`));
    }
  });
  it('turns motion off under reduced motion', () => {
    expect(src).toMatch(/prefers-reduced-motion/);
    expect((src.match(/animation\s*:/g) ?? []).length).toBeGreaterThan(0);
  });
  it('has a live status line and no drag-only controls', () => {
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).not.toMatch(/draggable|dragstart|ondrop/);
  });
});

type ShapeId = (typeof SHAPES)[number];
