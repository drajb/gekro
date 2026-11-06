/**
 * games-chess.test.ts - the engine and computer player behind `chess`.
 *
 * Pinned:
 *  - PERFT leaf counts (the standard independent check of a move generator) for the start position
 *    to depth 5, the positions known as Kiwipete, 3, 4 (and its mirror), 5 and 6, and five more
 *    published test positions covering promotion, en passant, pins, check evasion and castling;
 *    plus the per-move split of the start position at depth 3
 *  - FEN parse and write round trip, rejection of malformed or impossible FENs, castling rights and
 *    en passant squares that do not fit the board being dropped
 *  - castling (every legality condition), en passant (including the pinned-pawn case), promotion
 *    (four pieces, capture promotions, rights lost when a rook is taken), pins, check evasion
 *  - algebraic notation: disambiguation by file, rank and both, captures, promotion, check, mate,
 *    castling; every legal move round trips through notation; the famous Opera Game replays to mate
 *  - game end: checkmate, stalemate, insufficient material, threefold (claimable) and fivefold
 *    (automatic) repetition, the fifty-move (claimable) and seventy-five-move (automatic) rules
 *  - make/unmake round trips with the incremental hash and evaluation checked against a rebuild,
 *    and evaluation symmetry between a position and its colour-flipped mirror
 *  - the computer: finds mate in one and mate in two (verified by exhaustive search, not by the
 *    engine itself), wins a hanging queen, refuses a poisoned pawn, never plays an illegal move over
 *    many seeded games, Hard beats Easy, the Hard time cap on busy positions, slicing, determinism,
 *    the opening book (every line legal)
 *  - sanitisers for the URL and saved win counts, the piece art data
 */
import { describe, it, expect } from 'vitest';
import {
  Position, Game, perft, perftDivide, moveToSan, sanToMove, uciToMove, moveToUci, makeMove, moveFrom, moveTo, movePromo, moveFlags,
  squareName, parseSquare, pieceOf, typeOf, colorOf, fileOf, rankOf, squareOf, pieceName, colorName, isCapture,
  START_FEN, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, FL_DOUBLE, FL_EP, FL_CASTLE, FL_CAPTURE,
  chooseMove, SearchJob, LEVEL_CONFIG, EASY_NOISE, MATE, BOOK_LINES, bookMoves, bookSize, seededRng,
  moveListText, materialPoints, describeOutcome, spokenMove, cleanSettings, cleanWins, winsToStorable, MAX_WINS,
  PIECE_SHAPES, BAND_PATH, PROMOTION_CHOICES, NOT_OVER, LEVELS,
  type Level, type Outcome, type SearchOptions,
} from '../src/components/apps-private/chess/helpers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8');
const sq = (name: string): number => parseSquare(name);
const pos = (fen: string): Position => Position.fromFen(fen);
const sans = (p: Position): string[] => p.legalMoves().map((m) => moveToSan(p, m)).sort();
const uci = (p: Position): string[] => p.legalMoves().map(moveToUci).sort();

// ── squares and move packing ────────────────────────────────────────────────

describe('squares and moves', () => {
  it('names all 64 squares and parses them back', () => {
    const names = new Set<string>();
    for (let s = 0; s < 64; s++) {
      const n = squareName(s);
      names.add(n);
      expect(parseSquare(n)).toBe(s);
      expect(squareOf(fileOf(s), rankOf(s))).toBe(s);
    }
    expect(names.size).toBe(64);
    expect(squareName(0)).toBe('a1');
    expect(squareName(7)).toBe('h1');
    expect(squareName(63)).toBe('h8');
    expect(squareName(28)).toBe('e4');
  });
  it('rejects text that is not a square', () => {
    for (const bad of ['', 'e', 'e9', 'i1', 'E4', 'e44', 'e0', '4e', ' e4']) expect(parseSquare(bad)).toBe(-1);
    expect(parseSquare(undefined as unknown as string)).toBe(-1);
    expect(parseSquare(42 as unknown as string)).toBe(-1);
  });
  it('packs and unpacks a move', () => {
    const m = makeMove(sq('e7'), sq('e8'), QUEEN, FL_CAPTURE);
    expect(moveFrom(m)).toBe(sq('e7'));
    expect(moveTo(m)).toBe(sq('e8'));
    expect(movePromo(m)).toBe(QUEEN);
    expect(moveFlags(m)).toBe(FL_CAPTURE);
    expect(isCapture(m)).toBe(true);
    expect(moveToUci(m)).toBe('e7e8q');
    expect(makeMove(0, 1)).not.toBe(0);
  });
  it('encodes pieces and colours', () => {
    expect(pieceOf(WHITE, KNIGHT)).toBe(2);
    expect(pieceOf(BLACK, KNIGHT)).toBe(10);
    expect(typeOf(pieceOf(BLACK, QUEEN))).toBe(QUEEN);
    expect(colorOf(pieceOf(BLACK, QUEEN))).toBe(BLACK);
    expect(colorOf(pieceOf(WHITE, KING))).toBe(WHITE);
    expect(pieceName(pieceOf(BLACK, KNIGHT))).toBe('black knight');
    expect(pieceName(0)).toBe('empty');
    expect(colorName(WHITE)).toBe('White');
  });
});

// ── FEN ─────────────────────────────────────────────────────────────────────

describe('FEN', () => {
  const FENS = [
    START_FEN,
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
    '4k3/8/8/8/8/8/8/4K3 w - - 99 120',
    'r3k3/8/8/8/8/8/8/4K2R b Kq - 12 40',
    '7k/8/8/8/8/8/8/K7 b - - 0 1',
  ];
  it('writes back exactly what it parsed', () => {
    for (const fen of FENS) expect(pos(fen).toFen(), fen).toBe(fen);
  });
  it('the starting position', () => {
    expect(Position.start().toFen()).toBe(START_FEN);
    const p = Position.start();
    expect(p.side).toBe(WHITE);
    expect(p.castling).toBe(15);
    expect(p.ep).toBe(-1);
    expect(p.kingSq).toEqual([sq('e1'), sq('e8')]);
    expect(p.board[sq('d1')]).toBe(pieceOf(WHITE, QUEEN));
    expect(p.board[sq('d8')]).toBe(pieceOf(BLACK, QUEEN));
    expect(p.selfCheck()).toEqual([]);
  });
  it('accepts a FEN with only four fields and fills the counters', () => {
    const p = pos('4k3/8/8/8/8/8/8/4K3 w - -');
    expect(p.halfmove).toBe(0);
    expect(p.fullmove).toBe(1);
    expect(pos('4k3/8/8/8/8/8/8/4K3   b   -   -   5   9').toFen()).toBe('4k3/8/8/8/8/8/8/4K3 b - - 5 9');
  });
  it('rejects malformed text', () => {
    const bad = [
      '', 'x', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR/8 w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1',
      'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/ppppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQxq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e9 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - -1 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 extra',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      'a'.repeat(500),
    ];
    for (const fen of bad) expect(() => Position.fromFen(fen), fen).toThrow(Error);
    expect(() => Position.fromFen(null as unknown as string)).toThrow(Error);
    expect(() => Position.fromFen(7 as unknown as string)).toThrow(Error);
  });
  it('rejects positions that cannot exist', () => {
    expect(() => pos('8/8/8/8/8/8/8/4K3 w - - 0 1')).toThrow(/king/);
    expect(() => pos('4k3/8/8/8/8/8/8/4KK2 w - - 0 1')).toThrow(/king/);
    expect(() => pos('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')).not.toThrow();
    expect(() => pos('P3k3/8/8/8/8/8/8/4K3 w - - 0 1')).toThrow(/pawn/);
    expect(() => pos('4k3/8/8/8/8/8/8/p3K3 w - - 0 1')).toThrow(/pawn/);
    expect(() => pos('4k3/pppppppp/p7/8/8/8/8/4K3 w - - 0 1')).toThrow(/pawns/);
    // the side that is not to move is in check
    expect(() => pos('4k3/8/8/8/8/8/8/4RK2 w - - 0 1')).toThrow(/check/);
    expect(() => pos('4k3/8/8/8/8/8/8/4RK2 b - - 0 1')).not.toThrow();
    // two sets of pieces: 17 pieces is too many
    expect(() => pos('4k3/8/8/8/QQQQQQQQ/QQQQQQQQ/8/4K3 w - - 0 1')).toThrow();
  });
  it('drops castling rights that the pieces cannot support', () => {
    expect(pos('4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1').toFen()).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(pos('r3k3/8/8/8/8/8/8/R3K2R w KQkq - 0 1').toFen()).toBe('r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1');
    expect(pos('4k2r/8/8/8/8/8/8/R2K3R w KQkq - 0 1').toFen()).toBe('4k2r/8/8/8/8/8/8/R2K3R w k - 0 1');
  });
  it('drops an en passant square no pawn could have created', () => {
    expect(pos('4k3/8/8/8/8/8/8/4K3 w - e6 0 1').toFen()).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(pos('4k3/8/8/4P3/8/8/8/4K3 w - e6 0 1').ep).toBe(-1);
    expect(pos('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1').ep).toBe(sq('d6'));
    expect(pos('4k3/8/8/3pP3/8/8/8/4K3 b - d6 0 1').ep).toBe(-1);
  });
  it('clone is independent of the original', () => {
    const a = Position.start();
    const b = a.clone();
    b.make(uciToMove(b, 'e2e4'));
    expect(a.toFen()).toBe(START_FEN);
    expect(b.toFen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    expect(a.plies).toBe(0);
    expect(b.plies).toBe(1);
    b.unmake();
    expect(b.toFen()).toBe(START_FEN);
    expect(b.hashLo).toBe(a.hashLo);
    expect(b.hashHi).toBe(a.hashHi);
  });
});

// ── PERFT: the independent oracle ───────────────────────────────────────────

const SUITE: { name: string; fen: string; counts: number[] }[] = [
  { name: 'start position', fen: START_FEN, counts: [20, 400, 8902, 197281, 4865609] },
  { name: 'Kiwipete', fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', counts: [48, 2039, 97862, 4085603] },
  { name: 'position 3', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', counts: [14, 191, 2812, 43238, 674624, 11030083] },
  { name: 'position 4', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', counts: [6, 264, 9467, 422333, 15833292] },
  { name: 'position 4 mirrored', fen: 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1', counts: [6, 264, 9467, 422333] },
  { name: 'position 5', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', counts: [44, 1486, 62379, 2103487] },
  { name: 'position 6', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', counts: [46, 2079, 89890, 3894594] },
  { name: 'promotions', fen: 'n1n5/PPPk4/8/8/8/8/4Kppp/5N1N b - - 0 1', counts: [24, 496, 9483, 182838] },
  { name: 'castling both sides', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', counts: [26, 568, 13744, 314346] },
  { name: 'check evasion and pins', fen: '3k4/3p4/8/K1P4r/8/8/8/8 b - - 0 1', counts: [18, 92, 1670, 10138] },
  { name: 'en passant', fen: '8/8/1k6/2b5/2pP4/8/5K2/8 b - d3 0 1', counts: [15, 126, 1928, 13931] },
  { name: 'two bishops and two rooks', fen: 'r3k2r/1b4bq/8/8/8/8/7B/R3K2R w KQkq - 0 1', counts: [26, 1141, 27826] },
];
/** Depth at or below which a count runs in well under a second. */
const FAST = 3;

describe('perft (quick depths)', () => {
  for (const { name, fen, counts } of SUITE) {
    it(`${name}: depths 1 to ${Math.min(FAST, counts.length)}`, () => {
      const p = pos(fen);
      for (let d = 1; d <= Math.min(FAST, counts.length); d++) expect(perft(p, d), `${name} depth ${d}`).toBe(counts[d - 1]);
      // the walk leaves the position exactly as it was
      expect(p.toFen()).toBe(fen);
      expect(p.selfCheck()).toEqual([]);
    });
  }
  it('start position to depth 4 is 20, 400, 8902, 197281', () => {
    const p = Position.start();
    expect([1, 2, 3, 4].map((d) => perft(p, d))).toEqual([20, 400, 8902, 197281]);
  }, 60_000);
  it('divide of the start position at depth 3 matches the published split', () => {
    const want: Record<string, number> = {
      a2a3: 380, b2b3: 420, c2c3: 420, d2d3: 539, e2e3: 599, f2f3: 380, g2g3: 420, h2h3: 380,
      a2a4: 420, b2b4: 421, c2c4: 441, d2d4: 560, e2e4: 600, f2f4: 401, g2g4: 421, h2h4: 420,
      b1a3: 400, b1c3: 440, g1f3: 440, g1h3: 400,
    };
    const got = perftDivide(Position.start(), 3);
    expect(got).toEqual(want);
    expect(Object.values(got).reduce((a, b) => a + b, 0)).toBe(8902);
    expect(Object.values(perftDivide(Position.start(), 1)).every((n) => n === 1)).toBe(true);
  });
  it('depth 0 is one position', () => {
    expect(perft(Position.start(), 0)).toBe(1);
  });
});

describe('perft (deeper, slower)', () => {
  for (const { name, fen, counts } of SUITE) {
    for (let d = FAST + 1; d <= counts.length; d++) {
      if (name === 'start position' && d === 4) continue; // pinned in the quick group
      it(`${name}: depth ${d} is ${counts[d - 1]}`, () => {
        expect(perft(pos(fen), d)).toBe(counts[d - 1]);
      }, 240_000);
    }
  }
});

// ── castling ────────────────────────────────────────────────────────────────

describe('castling', () => {
  const both = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  const castles = (p: Position): string[] => p.legalMoves().filter((m) => (moveFlags(m) & FL_CASTLE) !== 0).map(moveToUci).sort();

  it('is offered on both sides when nothing is in the way', () => {
    expect(castles(pos(both))).toEqual(['e1c1', 'e1g1']);
    expect(castles(pos('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'))).toEqual(['e8c8', 'e8g8']);
  });
  it('moves the king two squares and the rook beside it', () => {
    const p = pos(both);
    p.make(uciToMove(p, 'e1g1'));
    expect(p.toFen()).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1');
    p.unmake();
    expect(p.toFen()).toBe(both);
    p.make(uciToMove(p, 'e1c1'));
    expect(p.toFen()).toBe('r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1');
    const q = pos('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
    q.make(uciToMove(q, 'e8g8'));
    expect(q.toFen()).toBe('r4rk1/8/8/8/8/8/8/R3K2R w KQ - 1 2');
    q.unmake();
    q.make(uciToMove(q, 'e8c8'));
    expect(q.toFen()).toBe('2kr3r/8/8/8/8/8/8/R3K2R w KQ - 1 2');
  });
  it('is refused when the king is in check', () => {
    expect(castles(pos('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1'))).toEqual([]);
    expect(castles(pos('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')).length).toBe(2);
  });
  it('is refused through an attacked square, on that side only', () => {
    // a rook on f8 covers f1: the short way passes through it, the long way does not
    expect(castles(pos('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).toEqual(['e1c1']);
    // a rook on d8 covers d1: the long way passes through it
    expect(castles(pos('3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).toEqual(['e1g1']);
  });
  it('is refused when the king would land on an attacked square', () => {
    expect(castles(pos('6r1/4k3/8/8/8/8/8/R3K2R w KQ - 0 1'))).toEqual(['e1c1']); // g1 covered
    expect(castles(pos('2r1k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).toEqual(['e1g1']); // c1 covered
  });
  it('is allowed when only the rook passes over an attacked square', () => {
    // b1 is attacked, but b1 is only crossed by the rook
    expect(castles(pos('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).toEqual(['e1c1', 'e1g1']);
  });
  it('is refused with a piece between the king and the rook', () => {
    expect(castles(pos('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1'))).toEqual(['e1g1']);
    expect(castles(pos('r3k2r/8/8/8/8/8/8/R2QK2R w KQkq - 0 1'))).toEqual(['e1g1']);
    expect(castles(pos('r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1'))).toEqual(['e1c1']);
    expect(castles(pos('r3k2r/8/8/8/8/8/8/R3K1NR w KQkq - 0 1'))).toEqual(['e1c1']);
  });
  it('is lost for good once the king has moved, even if it comes back', () => {
    const p = pos(both);
    p.make(uciToMove(p, 'e1e2'));
    p.make(uciToMove(p, 'a8a7'));
    p.make(uciToMove(p, 'e2e1'));
    p.make(uciToMove(p, 'a7a8'));
    expect(p.toFen()).toBe('r3k2r/8/8/8/8/8/8/R3K2R w k - 4 3'); // Black's a-rook also moved, so it lost the long side too
    expect(castles(p)).toEqual([]);
  });
  it('is lost on one side once that rook has moved', () => {
    const p = pos(both);
    p.make(uciToMove(p, 'h1h2'));
    expect(p.castling & 1).toBe(0);
    expect(p.castling & 2).toBe(2);
    p.make(uciToMove(p, 'h8h7'));
    p.make(uciToMove(p, 'h2h1'));
    p.make(uciToMove(p, 'h7h8'));
    expect(castles(p)).toEqual(['e1c1']);
  });
  it('is lost when the rook is captured on its home square', () => {
    const p = pos('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1');
    p.make(uciToMove(p, 'g2h1'));
    expect(p.toFen()).toBe('r3k2r/8/8/8/8/8/8/R3K2b w Qkq - 0 2');
    const rookTakesRook = pos('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    rookTakesRook.make(uciToMove(rookTakesRook, 'a1a8'));
    expect(rookTakesRook.castling).toBe(1 | 4); // White's rook left a1 and Black's was taken on a8: both long sides are gone
  });
  it('promotion that takes a rook on its home square removes that right', () => {
    const p = pos('r3k2r/1P6/8/8/8/8/8/4K3 w kq - 0 1');
    p.make(uciToMove(p, 'b7a8q'));
    expect(p.castling).toBe(4); // only black's king side is left
  });
  it('short and long castling are written O-O and O-O-O, with check marks', () => {
    const p = pos(both);
    expect(moveToSan(p, uciToMove(p, 'e1g1'))).toBe('O-O');
    expect(moveToSan(p, uciToMove(p, 'e1c1'))).toBe('O-O-O');
    const checking = pos('3k3r/8/8/8/8/8/8/R3K3 w Q - 0 1');
    expect(moveToSan(checking, uciToMove(checking, 'e1c1'))).toBe('O-O-O+'); // the rook lands on d1 and attacks the king on d8
    expect(sanToMove(p, 'O-O')).toBe(uciToMove(p, 'e1g1'));
    expect(sanToMove(p, '0-0-0')).toBe(uciToMove(p, 'e1c1'));
    expect(sanToMove(p, 'O-O+')).toBe(uciToMove(p, 'e1g1'));
  });
  it('is not possible without the rights even with the pieces in place', () => {
    expect(castles(pos('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1'))).toEqual([]);
    expect(castles(pos('r3k2r/8/8/8/8/8/8/R3K2R w Kkq - 0 1'))).toEqual(['e1g1']);
  });
});

// ── en passant ──────────────────────────────────────────────────────────────

describe('en passant', () => {
  it('a two-square push sets the square that was passed over', () => {
    const p = Position.start();
    p.make(uciToMove(p, 'e2e4'));
    expect(p.ep).toBe(sq('e3'));
    p.make(uciToMove(p, 'a7a6'));
    expect(p.ep).toBe(-1);
    p.make(uciToMove(p, 'a2a3'));
    expect(p.ep).toBe(-1);
  });
  it('takes the pawn that passed, and only for one move', () => {
    const p = pos('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    const m = uciToMove(p, 'e5d6');
    expect(m).not.toBe(0);
    expect(moveFlags(m) & FL_EP).toBe(FL_EP);
    expect(isCapture(m)).toBe(true);
    p.make(m);
    expect(p.toFen()).toBe('4k3/8/3P4/8/8/8/8/4K3 b - - 0 1');
    p.unmake();
    expect(p.toFen()).toBe('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    // decline it, and the chance is gone
    const q = pos('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    q.make(uciToMove(q, 'e1e2'));
    q.make(uciToMove(q, 'e8e7'));
    expect(uciToMove(q, 'e5d6')).toBe(0);
  });
  it('works for Black as well', () => {
    const p = pos('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1');
    p.make(uciToMove(p, 'd4e3'));
    expect(p.toFen()).toBe('4k3/8/8/8/8/4p3/8/4K3 w - - 0 2');
  });
  it('is illegal when it would uncover the own king along the rank', () => {
    const p = pos('7k/8/8/KPp4r/8/8/8/8 w - c6 0 1');
    expect(uciToMove(p, 'b5c6')).toBe(0);
    expect(uci(p)).toContain('b5b6');
  });
  it('is illegal when the capturing pawn is pinned on a diagonal', () => {
    // the bishop on b2 pins the pawn on e5 against the king on h8
    const pinned = pos('7K/8/8/3pP3/8/8/1b6/k7 w - d6 0 1');
    expect(uciToMove(pinned, 'e5d6')).toBe(0);
    expect(uci(pinned).filter((u) => u.startsWith('e5'))).toEqual([]);
    // with the bishop on a different diagonal the same capture is fine
    const free = pos('7K/8/8/3pP3/8/1b6/8/k7 w - d6 0 1');
    expect(uciToMove(free, 'e5d6')).not.toBe(0);
  });
  it('can capture the checking pawn en passant', () => {
    // the pawn that just advanced gives check; taking it removes the check
    const p = pos('8/8/8/4k3/3Pp3/8/8/4K3 b - d3 0 1'); // the pawn on d4 checks the king on e5
    expect(p.inCheck()).toBe(true);
    expect(uci(p)).toContain('e4d3');
  });
  it('the hash only holds the en passant file when a capture is possible', () => {
    const a = Position.start();
    a.make(uciToMove(a, 'e2e4'));
    const noCapture = a.hashLo;
    const b = Position.fromFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(b.hashLo).toBe(noCapture);
    const c = pos('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1');
    const d = pos('4k3/8/8/8/3pP3/8/8/4K3 b - - 0 1');
    expect(c.hashLo === d.hashLo && c.hashHi === d.hashHi).toBe(false);
  });
});

// ── promotion ───────────────────────────────────────────────────────────────

describe('promotion', () => {
  it('offers all four pieces for a push and for a capture', () => {
    const p = pos('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const pushes = p.legalMoves().filter((m) => moveFrom(m) === sq('a7') && moveTo(m) === sq('a8'));
    expect(pushes.map(movePromo).sort()).toEqual([KNIGHT, BISHOP, ROOK, QUEEN]);
    const q = pos('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const caps = q.legalMoves().filter((m) => moveFrom(m) === sq('a7') && moveTo(m) === sq('b8'));
    expect(caps.map(movePromo).sort()).toEqual([KNIGHT, BISHOP, ROOK, QUEEN]);
    expect(caps.every(isCapture)).toBe(true);
    expect(pushes.every((m) => !isCapture(m))).toBe(true);
  });
  it('a pawn that is not on the seventh rank never promotes', () => {
    const p = pos('4k3/8/P7/8/8/8/8/4K3 w - - 0 1');
    expect(p.legalMoves().filter((m) => movePromo(m) !== 0)).toEqual([]);
  });
  it('replaces the pawn and unmake puts the pawn back', () => {
    for (const piece of PROMOTION_CHOICES) {
      const p = pos('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
      const m = p.legalMoves().find((x) => moveTo(x) === sq('a8') && movePromo(x) === piece) as number;
      p.make(m);
      expect(p.board[sq('a8')]).toBe(pieceOf(WHITE, piece));
      expect(p.board[sq('a7')]).toBe(0);
      expect(p.selfCheck()).toEqual([]);
      p.unmake();
      expect(p.toFen()).toBe('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
      expect(p.selfCheck()).toEqual([]);
    }
  });
  it('black promotes on the first rank', () => {
    const p = pos('4k3/8/8/8/8/8/p7/4K3 b - - 0 1');
    p.make(uciToMove(p, 'a2a1n'));
    expect(p.toFen()).toBe('4k3/8/8/8/8/8/8/n3K3 w - - 0 2');
  });
  it('is written with = and the piece letter, and underpromotion that gives check is marked', () => {
    const p = pos('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(moveToSan(p, uciToMove(p, 'a7a8q'))).toBe('a8=Q'); // the knight on b8 blocks the rank
    expect(moveToSan(p, uciToMove(p, 'a7b8q'))).toBe('axb8=Q+');
    expect(moveToSan(p, uciToMove(p, 'a7a8n'))).toBe('a8=N');
    const r = pos('7k/4P1pp/8/8/8/8/8/K7 w - - 0 1');
    expect(moveToSan(r, uciToMove(r, 'e7e8q'))).toBe('e8=Q#');
    expect(moveToSan(r, uciToMove(r, 'e7e8r'))).toBe('e8=R#');
    expect(moveToSan(r, uciToMove(r, 'e7e8n'))).toBe('e8=N');
    expect(moveToSan(r, uciToMove(r, 'e7e8b'))).toBe('e8=B');
  });
  it('reads promotions in the forms players write', () => {
    const p = pos('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(sanToMove(p, 'a8=Q')).toBe(uciToMove(p, 'a7a8q'));
    expect(sanToMove(p, 'a8Q')).toBe(uciToMove(p, 'a7a8q'));
    expect(sanToMove(p, 'axb8=N')).toBe(uciToMove(p, 'a7b8n'));
    expect(sanToMove(p, 'a8')).toBe(0); // a promotion piece is required
  });
});

// ── pins, check and double check ────────────────────────────────────────────

describe('check, pins and evasion', () => {
  it('a pinned piece cannot leave the line, but can move along it', () => {
    const p = pos('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1');
    expect(p.legalMoves().filter((m) => moveFrom(m) === sq('e2'))).toEqual([]);
    const q = pos('4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1');
    const rookMoves = uci(q).filter((u) => u.startsWith('e2'));
    expect(rookMoves).toEqual(['e2e3', 'e2e4', 'e2e5', 'e2e6', 'e2e7']);
  });
  it('the only legal answers to a check are capture, block or step away', () => {
    const p = pos('4k3/8/8/8/8/8/3r4/R3K3 w - - 0 1'); // not check: rook d2 attacks e2 only
    expect(p.inCheck()).toBe(false);
    const q = pos('4k3/8/8/8/8/8/4r3/R3K3 w - - 0 1'); // rook e2 checks the king: take it with the king, nothing blocks
    expect(q.inCheck()).toBe(true);
    expect(uci(q)).toEqual(['e1d1', 'e1e2', 'e1f1']);
  });
  it('a double check can only be answered by a king move', () => {
    const dbl = pos('4k3/8/8/8/1b6/5n2/8/R3K2R w KQ - 0 1'); // bishop b4 attacks e1 via d2; knight f3 attacks e1
    expect(dbl.inCheck()).toBe(true);
    const moves = dbl.legalMoves();
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => moveFrom(m) === sq('e1'))).toBe(true);
    expect(moves.some((m) => (moveFlags(m) & FL_CASTLE) !== 0)).toBe(false);
  });
  it('the king may not step next to the other king or onto an attacked square', () => {
    const p = pos('8/8/8/8/8/3k4/8/3K4 w - - 0 1');
    expect(uci(p)).toEqual(['d1c1', 'd1e1'].sort());
  });
  it('detects checks from every kind of piece', () => {
    expect(pos('4k3/8/8/8/8/8/8/4K2r w - - 0 1').inCheck()).toBe(true); // rook
    expect(pos('4k3/8/8/8/7b/8/8/4K3 w - - 0 1').inCheck()).toBe(true); // bishop
    expect(pos('4k3/8/8/8/8/8/4q3/4K3 w - - 0 1').inCheck()).toBe(true); // queen
    expect(pos('4k3/8/8/8/8/3n4/8/4K3 w - - 0 1').inCheck()).toBe(true); // knight
    expect(pos('4k3/8/8/8/8/8/3n4/4K3 w - - 0 1').inCheck()).toBe(false);
    expect(pos('4k3/8/8/8/8/5n2/8/4K3 w - - 0 1').inCheck()).toBe(true); // knight the other side
    expect(pos('4k3/8/8/8/8/8/3p4/4K3 w - - 0 1').inCheck()).toBe(true); // pawn
    expect(pos('4k3/8/8/8/8/8/5p2/4K3 w - - 0 1').inCheck()).toBe(true); // pawn the other side
    expect(pos('4k3/8/8/8/8/8/4p3/4K3 w - - 0 1').inCheck()).toBe(false); // pawn straight ahead does not attack
    expect(pos('4k3/3P4/8/8/8/8/8/4K3 b - - 0 1').inCheck()).toBe(true); // white pawn attacks diagonally up
    expect(pos('4k3/8/8/8/8/8/8/R3K3 b - - 0 1').inCheck()).toBe(false);
  });
  it('a slider is blocked by a piece in between', () => {
    expect(pos('4k3/8/8/8/8/8/4P3/R3K2r w - - 0 1').inCheck()).toBe(true);
    expect(pos('4k3/8/8/8/8/8/8/R3K1Br w - - 0 1').inCheck()).toBe(false);
  });
});

// ── notation ────────────────────────────────────────────────────────────────

describe('algebraic notation', () => {
  it('lists the twenty opening moves', () => {
    expect(sans(Position.start())).toEqual([
      'Na3', 'Nc3', 'Nf3', 'Nh3', 'a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4', 'f3', 'f4', 'g3', 'g4', 'h3', 'h4',
    ].sort());
  });
  it('disambiguates by file when two pieces can go to a square', () => {
    const p = pos('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1');
    expect(sans(p)).toContain('Nbd2');
    expect(sans(p)).toContain('Nfd2');
    expect(sans(p)).not.toContain('Nd2');
    const q = pos('4k3/8/8/8/8/8/8/1N1NK3 w - - 0 1');
    expect(sans(q)).toContain('Nbc3');
    expect(sans(q)).toContain('Ndc3');
  });
  it('disambiguates by rank when the files are the same', () => {
    const p = pos('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1');
    expect(sans(p)).toContain('R1a3');
    expect(sans(p)).toContain('R5a3');
    expect(sans(p)).not.toContain('Ra3');
  });
  it('uses the full square when file and rank are both shared', () => {
    const p = pos('6k1/8/8/8/8/Q7/8/Q1Q4K w - - 0 1');
    expect(sans(p)).toContain('Qa1b2');
    expect(sans(p)).toContain('Q3b2');
    expect(sans(p)).toContain('Qcb2');
  });
  it('only disambiguates when another piece could really make the move', () => {
    // the rook on a1 is pinned by nothing, but the rook on h1 cannot reach d1 through the king on e1
    const p = pos('4k3/8/8/8/8/8/8/R3K2R w - - 0 1');
    expect(sans(p)).toContain('Rd1');
    expect(sans(p)).not.toContain('Rad1');
    // a pinned piece does not count as a second candidate
    const q = pos('4r1k1/8/8/8/8/8/4N3/1N2K3 w - - 0 1'); // the e2 knight is pinned by the rook on e8
    expect(sans(q)).toContain('Nc3');
    expect(sans(q)).not.toContain('Nbc3');
    expect(sans(q)).not.toContain('Nec3');
  });
  it('writes captures, pawn captures and check marks', () => {
    const p = pos('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    expect(sans(p)).toContain('exd5');
    const q = pos('4k3/8/8/8/8/8/4q3/R3K3 w - - 0 1');
    expect(sans(q)).toContain('Kxe2');
    const r = pos('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    expect(moveToSan(r, uciToMove(r, 'a1a8'))).toBe('Rxa8+');
    const mate = pos('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    expect(moveToSan(mate, uciToMove(mate, 'a1a8'))).toBe('Ra8#');
  });
  it('an en passant capture is written like any pawn capture', () => {
    const p = pos('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    expect(moveToSan(p, uciToMove(p, 'e5d6'))).toBe('exd6');
  });
  it('every legal move of a dozen positions survives a trip through notation', () => {
    const fens = [START_FEN, ...SUITE.map((s) => s.fen), '1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1', '6k1/8/8/8/8/Q7/8/Q1Q4K w - - 0 1'];
    for (const fen of fens) {
      const p = pos(fen);
      const legal = p.legalMoves();
      const texts = legal.map((m) => moveToSan(p, m));
      expect(new Set(texts).size, `${fen}: notation must be unique`).toBe(legal.length);
      legal.forEach((m, i) => expect(sanToMove(p, texts[i]), `${fen} ${texts[i]}`).toBe(m));
      legal.forEach((m) => expect(uciToMove(p, moveToUci(m))).toBe(m));
      expect(p.toFen()).toBe(fen);
    }
  });
  it('refuses text that is not exactly one legal move', () => {
    const p = Position.start();
    for (const bad of ['', 'e5', 'Ke2', 'Nf6', 'O-O', 'zz', 'e2e4x', 'Nd2', 'N', 'exd5', 'e9', null, 5, undefined]) {
      expect(sanToMove(p, bad as unknown as string), String(bad)).toBe(0);
    }
    const q = pos('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1');
    expect(sanToMove(q, 'Nd2')).toBe(0); // two knights can go: ambiguous
    expect(sanToMove(q, 'Nbd2')).not.toBe(0);
    expect(uciToMove(p, 'e2e5')).toBe(0);
    expect(uciToMove(p, 'e7e8q')).toBe(0);
    expect(uciToMove(p, 'e2e4q')).toBe(0);
    expect(uciToMove(p, 'garbage')).toBe(0);
  });
  it('a bare square names a pawn push; a capture needs the file letter', () => {
    const p = pos('4k3/8/8/8/3p4/2P5/4P3/4K3 b - - 0 1'); // black pawn d4: can take c3 or push
    expect(sanToMove(p, 'dxc3')).not.toBe(0);
    const q = pos('4k3/8/8/8/8/3p4/2P1P3/4K3 w - - 0 1'); // both c2 and e2 pawns can capture d3, none can push to d3
    expect(sanToMove(q, 'cxd3')).not.toBe(0);
    expect(sanToMove(q, 'exd3')).not.toBe(0);
    expect(sanToMove(q, 'd3')).toBe(0);
    const r = pos('4k3/8/8/8/3p4/4P3/2P5/4K3 w - - 0 1');
    expect(sanToMove(r, 'c3')).not.toBe(0);
  });
  it('replays the Opera Game to its checkmate', () => {
    const line = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 ' +
      '11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#';
    const tokens = line.split(' ').filter((t) => !/^\d+\.$/.test(t));
    const g = new Game();
    tokens.forEach((t) => expect(g.playSan(t), t).toBe(t));
    expect(g.moves.length).toBe(33);
    const out = g.outcome();
    expect(out).toEqual({ over: true, winner: WHITE, reason: 'checkmate' });
    expect(g.moveText().startsWith('1. e4 e5 2. Nf3 d6')).toBe(true);
    expect(g.moveText().endsWith('17. Rd8#')).toBe(true);
    expect(g.pos.selfCheck()).toEqual([]);
    expect(g.undo(33)).toBe(33);
    expect(g.pos.toFen()).toBe(START_FEN);
  });
});

// ── game end ────────────────────────────────────────────────────────────────

describe('how a game ends', () => {
  const out = (fen: string): Outcome => new Game(fen).outcome();

  it("fool's mate is checkmate won by Black", () => {
    const g = new Game();
    for (const t of ['f3', 'e5', 'g4', 'Qh4#']) expect(g.playSan(t)).toBe(t);
    expect(g.outcome()).toEqual({ over: true, winner: BLACK, reason: 'checkmate' });
    expect(g.legalMoves()).toEqual([]);
  });
  it('the shortest game with White winning (scholar mate)', () => {
    const g = new Game();
    for (const t of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']) expect(g.playSan(t)).toBe(t);
    expect(g.outcome()).toEqual({ over: true, winner: WHITE, reason: 'checkmate' });
  });
  it('a back-rank mate and a mate that needs a block to be impossible', () => {
    expect(out('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1').reason).toBe('checkmate');
    expect(out('R5k1/5pp1/7p/8/8/8/8/6K1 b - - 0 1').over).toBe(false); // h7 is open: not mate
    expect(out('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1').over).toBe(false);
  });
  it('a check with a capture, block or escape is not mate', () => {
    expect(out('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1').over).toBe(false); // the king takes the rook
    expect(out('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1').winner).toBe(WHITE);
  });
  it('stalemate: no legal move and not in check', () => {
    const o = out('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(o).toEqual({ over: true, winner: null, reason: 'stalemate' });
    expect(out('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1').reason).toBe('stalemate');
    expect(out('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1').over).toBe(false);
  });
  it('stalemate is a draw even when one side is far ahead', () => {
    const g = new Game('k7/8/1K6/8/8/8/8/2Q5 w - - 0 1');
    expect(g.playSan('Qc7')).toBe('Qc7');
    expect(g.outcome().reason).toBe('stalemate');
    expect(g.outcome().winner).toBeNull();
  });
  it('insufficient material: bare kings, one minor piece, bishops all on one colour', () => {
    const dead = [
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      '4k3/8/8/8/8/8/8/3BK3 w - - 0 1',
      '4k3/8/8/8/8/8/8/3NK3 w - - 0 1',
      '3bk3/8/8/8/8/8/8/4K3 w - - 0 1',
      '3nk3/8/8/8/8/8/8/4K3 w - - 0 1',
      '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1', // f8 and c1 are both dark squares
      '4k3/8/8/8/8/4B3/8/2B1K3 w - - 0 1', // c1 and e3 are both dark squares
    ];
    for (const fen of dead) expect(pos(fen).insufficientMaterial(), fen).toBe(true);
    // bishops on opposite colours can still be mated
    expect(pos('2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1').insufficientMaterial()).toBe(false);
    expect(pos('4k3/8/8/8/8/8/8/2BBK3 w - - 0 1').insufficientMaterial()).toBe(false);
  });
  it('enough material to mate is never called dead', () => {
    const alive = [
      '4k3/8/8/8/8/8/8/2NNK3 w - - 0 1',
      '4k3/8/8/8/8/8/8/2NBK3 w - - 0 1',
      '4k3/8/8/8/8/8/P7/4K3 w - - 0 1',
      '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
      '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1',
      '4k3/p7/8/8/8/8/8/4K3 w - - 0 1',
      '3nk3/8/8/8/8/8/8/3NK3 w - - 0 1',
      '2bnk3/8/8/8/8/8/8/4K3 w - - 0 1',
      '4k3/8/8/8/8/8/8/2B1K1n1 w - - 0 1',
    ];
    for (const fen of alive) expect(pos(fen).insufficientMaterial(), fen).toBe(false);
  });
  it('a dead position ends the game on the move that makes it', () => {
    const dead = new Game('4k3/8/8/8/8/8/3p4/4K3 w - - 0 1');
    expect(dead.outcome().over).toBe(false);
    expect(dead.playSan('Kxd2')).toBe('Kxd2');
    expect(dead.outcome()).toEqual({ over: true, winner: null, reason: 'insufficient' });
    dead.undo(1);
    expect(dead.outcome().over).toBe(false);
    // taking the last minor piece leaves a rook: still playable
    const alive = new Game('4k3/8/8/8/8/8/3b4/3RK3 w - - 0 1');
    expect(alive.playSan('Rxd2')).toBe('Rxd2');
    expect(alive.outcome()).toEqual({ over: false, winner: null, reason: 'none' });
  });
  it('threefold repetition can be claimed and the fifth is automatic', () => {
    const g = new Game();
    const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8'];
    expect(g.repetitions()).toBe(1);
    for (const t of cycle) g.playSan(t);
    expect(g.repetitions()).toBe(2); // the start position again
    expect(g.claimable()).toBeNull();
    for (const t of cycle) g.playSan(t);
    expect(g.repetitions()).toBe(3);
    expect(g.claimable()).toBe('repetition');
    expect(g.outcome().over).toBe(false);
    expect(g.claim()).toEqual({ over: true, winner: null, reason: 'repetition' });
    for (const t of cycle) g.playSan(t);
    expect(g.repetitions()).toBe(4);
    expect(g.outcome().over).toBe(false);
    for (const t of cycle) g.playSan(t);
    expect(g.repetitions()).toBe(5);
    expect(g.outcome()).toEqual({ over: true, winner: null, reason: 'repetition', auto: true });
    expect(g.claim()).toBeNull(); // already over
    g.undo(1);
    expect(g.outcome().over).toBe(false);
  });
  it('the same position with the other side to move is not a repetition', () => {
    const g = new Game();
    for (const t of ['Nf3', 'Nf6', 'Ng1']) g.playSan(t);
    expect(g.repetitions()).toBe(1); // start position with Black to move is a new position
  });
  it('losing castling rights makes the position a different one', () => {
    const g = new Game();
    for (const t of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) g.playSan(t);
    expect(g.repetitions()).toBe(2);
    const h = new Game();
    for (const t of ['e4', 'e5', 'Ke2', 'Ke7', 'Ke1', 'Ke8']) h.playSan(t);
    // the pieces are where they were after 1.e4 e5, but both sides gave up castling
    expect(h.pos.toFen().split(' ')[0]).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
    expect(h.repetitions()).toBe(1);
    for (const t of ['Ke2', 'Ke7', 'Ke1', 'Ke8']) h.playSan(t);
    expect(h.repetitions()).toBe(2);
  });
  it('a pawn move or capture resets the repetition window', () => {
    const g = new Game();
    for (const t of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'e4', 'e5', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) g.playSan(t);
    expect(g.repetitions()).toBe(2); // only the position after e4 e5 repeated
  });
  it('the fifty-move rule is claimable at 100 half-moves and automatic at 150', () => {
    const g = new Game('4k3/8/8/8/8/8/8/R3K3 w - - 98 80');
    expect(g.claimable()).toBeNull();
    g.playSan('Ra2');
    expect(g.pos.halfmove).toBe(99);
    expect(g.claimable()).toBeNull();
    g.playSan('Kd7');
    expect(g.pos.halfmove).toBe(100);
    expect(g.claimable()).toBe('fifty');
    expect(g.outcome().over).toBe(false);
    expect(g.claim()).toEqual({ over: true, winner: null, reason: 'fifty' });
    const h = new Game('4k3/8/8/8/8/8/8/R3K3 w - - 150 80');
    expect(new Game('4k3/8/8/8/8/8/8/R3K3 w - - 149 80').outcome().over).toBe(false);
    expect(h.outcome().over).toBe(true);
    expect(h.outcome().reason).toBe('fifty');
    const j = new Game('4k3/8/8/8/8/8/8/R3K3 w - - 148 80');
    expect(j.outcome().over).toBe(false);
    j.playSan('Ra2');
    expect(j.outcome().over).toBe(false);
    j.playSan('Kd7');
    expect(j.pos.halfmove).toBe(150);
    expect(j.outcome()).toEqual({ over: true, winner: null, reason: 'fifty', auto: true });
  });
  it('a pawn move or a capture clears the fifty-move count', () => {
    const g = new Game('4k3/8/8/8/8/8/P7/R3K3 w - - 90 80');
    g.playSan('a3');
    expect(g.pos.halfmove).toBe(0);
    const h = new Game('r3k3/8/8/8/8/8/8/R3K3 w - - 90 80');
    h.playSan('Rxa8+');
    expect(h.pos.halfmove).toBe(0);
    const k = new Game('4k3/8/8/8/8/8/8/R3K3 w - - 90 80');
    k.playSan('Ra2');
    expect(k.pos.halfmove).toBe(91);
  });
  it('checkmate outranks the seventy-five-move rule', () => {
    const g = new Game('6k1/5ppp/8/8/8/8/8/R5K1 w - - 149 90');
    expect(g.playSan('Ra8#')).toBe('Ra8#');
    expect(g.pos.halfmove).toBe(150);
    expect(g.outcome()).toEqual({ over: true, winner: WHITE, reason: 'checkmate' });
  });
  it('stalemate outranks claimable draws and the count of a finished game stays stable', () => {
    const g = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 120 90');
    expect(g.outcome().reason).toBe('stalemate');
    expect(g.claimable()).toBeNull();
  });
});

// ── game record ─────────────────────────────────────────────────────────────

describe('Game record', () => {
  it('plays, records and takes back moves exactly', () => {
    const g = new Game();
    const fens = [g.pos.toFen()];
    for (const t of ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']) { g.playSan(t); fens.push(g.pos.toFen()); }
    expect(g.moves.length).toBe(10);
    expect(g.sans.join(' ')).toBe('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6');
    expect(g.movers).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
    for (let i = 9; i >= 0; i--) {
      expect(g.undo(1)).toBe(1);
      expect(g.pos.toFen()).toBe(fens[i]);
    }
    expect(g.undo(1)).toBe(0);
    expect(g.moves).toEqual([]);
    expect(g.pos.selfCheck()).toEqual([]);
  });
  it('refuses an illegal move without changing anything', () => {
    const g = new Game();
    const bad = makeMove(sq('e2'), sq('e5'));
    expect(() => g.play(bad)).toThrow(RangeError);
    expect(g.playSan('e5')).toBeNull();
    expect(g.moves).toEqual([]);
    expect(g.pos.toFen()).toBe(START_FEN);
  });
  it('movesFrom lists only that square, and a side with the move in a custom start is respected', () => {
    const g = new Game();
    expect(g.movesFrom(sq('e2')).map(moveToUci).sort()).toEqual(['e2e3', 'e2e4']);
    expect(g.movesFrom(sq('e7'))).toEqual([]);
    expect(g.movesFrom(sq('e4'))).toEqual([]);
    const b = new Game('4k3/8/8/8/8/8/8/4K3 b - - 0 7');
    expect(b.turn).toBe(BLACK);
    b.playSan('Kd8');
    expect(b.moveText()).toBe('7... Kd8');
    b.playSan('Kd2');
    expect(b.moveText()).toBe('7... Kd8 8. Kd2');
  });
  it('writes a move list with numbers', () => {
    expect(moveListText([])).toBe('');
    expect(moveListText(['e4'])).toBe('1. e4');
    expect(moveListText(['e4', 'e5', 'Nf3'])).toBe('1. e4 e5 2. Nf3');
  });
  it('an undone game plays on identically', () => {
    const a = new Game();
    const b = new Game();
    for (const t of ['d4', 'd5', 'c4', 'e6']) { a.playSan(t); b.playSan(t); }
    b.playSan('Nc3');
    b.undo(1);
    expect(b.pos.hashLo).toBe(a.pos.hashLo);
    expect(b.pos.hashHi).toBe(a.pos.hashHi);
    expect(b.legalMoves()).toEqual(a.legalMoves());
  });
});

// ── make/unmake integrity ───────────────────────────────────────────────────

/** The same position with the colours swapped and the board turned upside down. */
const mirrorFen = (fen: string): string => {
  const [board, side, castle, ep, half, full] = fen.split(' ');
  const rows = board.split('/').reverse().map((r) => [...r].map((c) => (/[a-z]/.test(c) ? c.toUpperCase() : /[A-Z]/.test(c) ? c.toLowerCase() : c)).join(''));
  const c2 = castle === '-' ? '-' : [...castle].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).sort((a, b) => 'KQkq'.indexOf(a) - 'KQkq'.indexOf(b)).join('');
  const e2 = ep === '-' ? '-' : ep[0] + String(9 - Number(ep[1]));
  return `${rows.join('/')} ${side === 'w' ? 'b' : 'w'} ${c2} ${e2} ${half} ${full}`;
};

describe('make and unmake', () => {
  it('random walks leave every counter, the hash and the evaluation exactly as a rebuild would', () => {
    const fens = [START_FEN, ...SUITE.slice(1, 7).map((s) => s.fen)];
    const rng = seededRng(7);
    let steps = 0;
    for (const fen of fens) {
      for (let run = 0; run < 12; run++) {
        const p = pos(fen);
        const trail: string[] = [p.toFen()];
        const played: number[] = [];
        for (let ply = 0; ply < 60; ply++) {
          const moves = p.legalMoves();
          if (moves.length === 0) break;
          const m = moves[Math.floor(rng() * moves.length)];
          p.make(m);
          played.push(m);
          trail.push(p.toFen());
          steps++;
          expect(p.selfCheck(), `${fen} after ${p.toFen()}`).toEqual([]);
          // the side that just moved never leaves its king attacked
          expect(p.isAttacked(p.kingSq[p.side ^ 1], p.side)).toBe(false);
        }
        while (played.length) {
          trail.pop();
          p.unmake();
          played.pop();
          expect(p.toFen()).toBe(trail[trail.length - 1]);
        }
        expect(p.toFen()).toBe(fen);
        expect(p.selfCheck()).toEqual([]);
      }
    }
    expect(steps).toBeGreaterThan(2000);
  }, 120_000);
  it('a null move passes the turn and unmake restores everything', () => {
    const p = pos('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    const before = { lo: p.hashLo, hi: p.hashHi, fen: p.toFen() };
    p.makeNull();
    expect(p.side).toBe(WHITE);
    expect(p.ep).toBe(-1);
    expect(p.hashLo === before.lo && p.hashHi === before.hi).toBe(false);
    p.unmake();
    expect(p.toFen()).toBe(before.fen);
    expect(p.hashLo).toBe(before.lo);
    expect(p.hashHi).toBe(before.hi);
  });
  it('transposed move orders reach the same hash', () => {
    const a = Position.start();
    const b = Position.start();
    for (const t of ['Nf3', 'Nf6', 'Nc3', 'Nc6']) a.make(sanToMove(a, t));
    for (const t of ['Nc3', 'Nc6', 'Nf3', 'Nf6']) b.make(sanToMove(b, t));
    expect(a.hashLo).toBe(b.hashLo);
    expect(a.hashHi).toBe(b.hashHi);
    expect(a.toFen().split(' ')[0]).toBe(b.toFen().split(' ')[0]);
  });
  it('evaluation is the same for a position and its colour-flipped mirror', () => {
    const rng = seededRng(11);
    let checked = 0;
    for (const s of SUITE) {
      const p = pos(s.fen);
      for (let ply = 0; ply < 40; ply++) {
        const fen = p.toFen();
        const m = pos(mirrorFen(fen));
        expect(m.evaluate(), fen).toBe(p.evaluate());
        expect(pos(mirrorFen(mirrorFen(fen))).toFen()).toBe(fen);
        checked++;
        const moves = p.legalMoves();
        if (!moves.length) break;
        p.make(moves[Math.floor(rng() * moves.length)]);
      }
    }
    expect(checked).toBeGreaterThan(150);
  });
  it('the starting position evaluates to the small bonus for the side to move', () => {
    const p = Position.start();
    expect(p.evaluate()).toBe(6);
    expect(pos('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1').evaluate()).toBe(6);
  });
  it('material shows in the score, from the side to move point of view', () => {
    const up = pos('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1'); // White lacks the queen
    expect(up.evaluate()).toBeLessThan(-700);
    const asBlack = pos('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1');
    expect(asBlack.evaluate()).toBeGreaterThan(700);
    expect(materialPoints(Position.start(), WHITE)).toBe(39);
    expect(materialPoints(Position.start(), BLACK)).toBe(39);
    expect(materialPoints(up, WHITE)).toBe(30);
  });
});

// ── the computer ────────────────────────────────────────────────────────────

/** Exhaustive check, independent of the search: can the side to move force checkmate within `n` of its own moves? */
const forcedMate = (p: Position, n: number): boolean => {
  if (n <= 0) return false;
  for (const m of p.legalMoves()) {
    p.make(m);
    let wins: boolean;
    const replies = p.legalMoves();
    if (replies.length === 0) wins = p.inCheck();
    else if (n === 1) wins = false;
    else wins = replies.every((r) => { p.make(r); const w = forcedMate(p, n - 1); p.unmake(); return w; });
    p.unmake();
    if (wins) return true;
  }
  return false;
};
const playsForcedMate = (fen: string, move: number, n: number): boolean => {
  const p = pos(fen);
  p.make(move);
  const replies = p.legalMoves();
  if (replies.length === 0) return p.inCheck();
  if (n <= 1) return false;
  return replies.every((r) => { p.make(r); const w = forcedMate(p, n - 1); p.unmake(); return w; });
};

describe('computer: tactics', () => {
  const MATE_IN_1 = [
    '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    'k7/8/1K6/8/8/8/8/7R w - - 0 1',
  ];
  const MATE_IN_2 = [
    'k7/8/2K5/8/8/8/8/6Q1 w - - 0 1',
    '7k/8/5K2/8/8/8/8/R2Q4 w - - 0 1',
  ];
  const levels: Level[] = ['easy', 'medium', 'hard'];

  it('the exhaustive checker agrees that these are mates in one and two', () => {
    for (const fen of MATE_IN_1) expect(forcedMate(pos(fen), 1), fen).toBe(true);
    for (const fen of MATE_IN_2) expect(forcedMate(pos(fen), 2), fen).toBe(true);
    expect(forcedMate(pos(START_FEN), 2)).toBe(false);
  });
  it('every level finds a mate in one', () => {
    for (const fen of MATE_IN_1) {
      for (const level of levels) {
        const p = pos(fen);
        const m = chooseMove(p, level, seededRng(3), { book: false });
        expect(p.legalMoves(), `${level} ${fen}`).toContain(m);
        expect(playsForcedMate(fen, m, 1), `${level} ${fen} ${moveToUci(m)}`).toBe(true);
      }
    }
  });
  it('Medium and Hard find a mate in two, and prove it by playing a move that forces it', () => {
    for (const fen of MATE_IN_2) {
      for (const level of ['medium', 'hard'] as Level[]) {
        const p = pos(fen);
        const m = chooseMove(p, level, seededRng(4), { book: false });
        expect(playsForcedMate(fen, m, 2), `${level} ${fen} ${moveToUci(m)}`).toBe(true);
      }
    }
  }, 60_000);
  it('Hard reports a mate score and stops early when it sees one', () => {
    const p = pos('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    const job = new SearchJob(p, 'hard', seededRng(1), { book: false });
    while (!job.step(100));
    expect(job.score).toBeGreaterThanOrEqual(MATE - 10);
    expect(job.used).toBeLessThan(500);
  });
  it('every level wins a hanging queen', () => {
    const fen = '4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1';
    for (const level of levels) {
      const p = pos(fen);
      const m = chooseMove(p, level, seededRng(9), { book: false });
      expect(moveToUci(m), level).toBe('c3d5');
    }
  });
  it('Medium and Hard refuse a poisoned pawn that costs the queen', () => {
    const fen = '3q2k1/8/8/3p4/8/8/8/3Q2K1 w - - 0 1';
    for (const level of ['medium', 'hard'] as Level[]) {
      const p = pos(fen);
      const m = chooseMove(p, level, seededRng(2), { book: false });
      expect(moveToUci(m), level).not.toBe('d1d5');
    }
  });
  it('Medium and Hard see a one-move threat to a piece and move or defend it', () => {
    // the queen on d4 is attacked by a pawn: leaving it there loses it
    const fen = '4k3/8/8/4p3/3Q4/8/8/4K3 w - - 0 1'; // a black pawn on e5 attacks d4
    for (const level of ['medium', 'hard'] as Level[]) {
      const p = pos(fen);
      const m = chooseMove(p, level, seededRng(2), { book: false });
      expect(moveFrom(m), level).toBe(sq('d4'));
      const q = pos(fen);
      q.make(m);
      expect(q.board[moveTo(m)]).toBe(pieceOf(WHITE, QUEEN));
    }
  }, 30_000);
  it('Hard finds a forced mate in five in a king and pawn ending, and exhaustive search confirms the move', () => {
    const fen = '8/P7/8/8/8/8/k7/2K5 w - - 0 1';
    const job = new SearchJob(pos(fen), 'hard', seededRng(1), { book: false });
    while (!job.step(1000));
    expect(job.score).toBeGreaterThanOrEqual(MATE - 12); // a mate within five of its own moves
    expect(playsForcedMate(fen, job.move, 5)).toBe(true);
  }, 120_000);
  it('the weakest level really is weak: with the noise at its size it often misses a free pawn', () => {
    // winning a pawn is worth 100 and the bonus can be up to EASY_NOISE, so some seeds decline it
    const fen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
    let took = 0;
    for (let s = 1; s <= 40; s++) if (moveToUci(chooseMove(pos(fen), 'easy', seededRng(s))) === 'e4d5') took++;
    expect(EASY_NOISE).toBeGreaterThan(100);
    expect(took).toBeGreaterThan(0);
    expect(took).toBeLessThan(40);
  });
});

describe('computer: levels, time and slicing', () => {
  it('the level settings are the ones the page describes', () => {
    expect(LEVEL_CONFIG.easy.maxDepth).toBe(1);
    expect(LEVEL_CONFIG.medium.maxDepth).toBe(3);
    expect(LEVEL_CONFIG.hard.maxDepth).toBe(12);
    expect(LEVEL_CONFIG.hard.timeMs).toBeGreaterThanOrEqual(1000);
    expect(LEVEL_CONFIG.hard.timeMs).toBeLessThanOrEqual(1200);
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
    const calc = page('src/components/apps-private/chess/Calculator.astro');
    expect(calc).toContain('up to 12 moves');
    expect(calc).toContain('3 moves ahead');
    expect(calc).toContain('one move ahead');
  });
  it('returns 0 when there is no legal move and the only move at once', () => {
    expect(chooseMove(pos('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'hard', seededRng(1))).toBe(0);
    expect(chooseMove(pos('6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1'), 'medium', seededRng(1))).not.toBe(0);
    // one legal move (the king steps to b8): chosen at once, with no search
    const lone = pos('k7/8/1K6/8/8/8/8/R7 b - - 0 1');
    expect(lone.legalMoves().map(moveToUci)).toEqual(['a8b8']);
    const job = new SearchJob(lone, 'hard', seededRng(1));
    expect(job.step(40)).toBe(true);
    expect(moveToUci(job.move)).toBe('a8b8');
    expect(job.nodes).toBe(0);
  });
  it('Hard answers inside its time cap on the busiest positions we know', () => {
    const fens = [SUITE[1].fen, SUITE[3].fen, SUITE[5].fen, SUITE[6].fen, 'r1bq1rk1/ppp2ppp/2n2n2/3pp3/1bB1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7', START_FEN];
    for (const fen of fens) {
      const p = pos(fen);
      const t = performance.now();
      const job = new SearchJob(p, 'hard', seededRng(5), { book: false });
      while (!job.step(1_000_000));
      const ms = performance.now() - t;
      expect(ms, `${fen}: ${Math.round(ms)} ms`).toBeLessThan(2500);
      expect(job.used).toBeLessThanOrEqual(LEVEL_CONFIG.hard.timeMs + 50);
      expect(p.legalMoves()).toContain(job.move);
      expect(job.depth).toBeGreaterThanOrEqual(3);
      expect(job.nodes).toBeGreaterThan(1000);
      expect(p.toFen()).toBe(fen); // the caller's position is never touched
    }
  }, 60_000);
  it('Medium and Easy answer far faster', () => {
    for (const level of ['easy', 'medium'] as Level[]) {
      for (const fen of [SUITE[1].fen, SUITE[6].fen]) {
        const t = performance.now();
        chooseMove(pos(fen), level, seededRng(5));
        expect(performance.now() - t, `${level} ${fen}`).toBeLessThan(level === 'easy' ? 300 : 1500);
      }
    }
  }, 30_000);
  it('can be run in short slices, which together stay inside the budget', () => {
    const p = pos(SUITE[1].fen);
    const job = new SearchJob(p, 'hard', seededRng(5), { book: false, timeMs: 400 });
    let steps = 0;
    let longest = 0;
    const t = performance.now();
    while (!job.done) {
      const s = performance.now();
      job.step(20);
      longest = Math.max(longest, performance.now() - s);
      steps++;
      expect(steps).toBeLessThan(1000);
    }
    expect(steps).toBeGreaterThan(3);
    expect(longest).toBeLessThan(250); // one slice never freezes the page for long
    expect(job.used).toBeLessThanOrEqual(450);
    expect(performance.now() - t).toBeLessThan(2000);
    expect(p.legalMoves()).toContain(job.move);
    expect(job.step(20)).toBe(true); // asking again changes nothing
  }, 30_000);
  it('Medium can be sliced as well and then gives the same move as one long run', () => {
    const fen = SUITE[1].fen;
    // A generous budget, so the comparison is about the search and not about how busy the machine is.
    const whole = new SearchJob(pos(fen), 'medium', seededRng(33), { timeMs: 20_000 });
    while (!whole.step(1e9));
    const sliced = new SearchJob(pos(fen), 'medium', seededRng(33), { timeMs: 20_000 });
    let steps = 0;
    let longest = 0;
    while (!sliced.done) {
      const s0 = performance.now();
      sliced.step(5);
      longest = Math.max(longest, performance.now() - s0);
      steps++;
      expect(steps).toBeLessThan(2000);
    }
    expect(steps).toBeGreaterThan(2);
    expect(longest).toBeLessThan(400);
    expect(moveToUci(sliced.move)).toBe(moveToUci(whole.move));
    expect(sliced.depth).toBe(3);
  }, 60_000);
  it('Medium stops inside a move when its slice is used up, not only between moves', () => {
    // Kiwipete is rich in captures: one root move there costs tens of thousands of nodes, several slices' worth.
    const job = new SearchJob(pos(SUITE[1].fen), 'medium', seededRng(8), { timeMs: 20_000 });
    const taken: number[] = [];
    while (!job.done) {
      const s0 = performance.now();
      job.step(25);
      taken.push(performance.now() - s0);
      expect(taken.length).toBeLessThan(2000);
    }
    taken.sort((a, b) => a - b);
    expect(taken.length).toBeGreaterThan(5); // it was cut into many slices
    // A typical slice is about the 25 ms asked for. Only the largest allow for a slow machine and for the rule that
    // a slice may grow when a sub-tree is bigger than one slice.
    expect(taken[Math.floor(taken.length / 2)]).toBeLessThan(120);
    expect(taken[taken.length - 1]).toBeLessThan(600);
    expect(pos(SUITE[1].fen).legalMoves()).toContain(job.move);
  }, 60_000);
  it('a sliced search plays a sound move too: it finds the mate in two', () => {
    const fen = 'k7/8/2K5/8/8/8/8/6Q1 w - - 0 1';
    const job = new SearchJob(pos(fen), 'hard', seededRng(5), { book: false, timeMs: 800 });
    while (!job.step(5));
    expect(playsForcedMate(fen, job.move, 2)).toBe(true);
  }, 30_000);
  it('the same seed gives the same move for every level', () => {
    for (const level of ['easy', 'medium', 'hard'] as Level[]) {
      const opts = { book: false, maxDepth: 4, timeMs: 1e9 };
      const a = chooseMove(pos(SUITE[3].fen), level, seededRng(17), opts);
      const b = chooseMove(pos(SUITE[3].fen), level, seededRng(17), opts);
      expect(moveToUci(a)).toBe(moveToUci(b));
    }
  }, 60_000);
  it('a depth or node limit overrides the level defaults', () => {
    const p = pos(SUITE[1].fen);
    const job = new SearchJob(p, 'hard', seededRng(1), { book: false, maxDepth: 2, timeMs: 1e9 });
    while (!job.step(1e9));
    expect(job.depth).toBe(2);
    const capped = new SearchJob(p, 'hard', seededRng(1), { book: false, maxNodes: 3000, timeMs: 1e9 });
    while (!capped.step(1e9));
    expect(capped.nodes).toBeLessThan(6000);
    expect(p.legalMoves()).toContain(capped.move);
  }, 30_000);
});

describe('computer: opening book', () => {
  it('every book line is a legal run of moves from the start', () => {
    expect(BOOK_LINES.length).toBe(43); // the guide page says 43 lines
    const bad: string[] = [];
    for (const line of BOOK_LINES) {
      const g = new Game();
      // the engine adds the check marks; the lines are written without them
      for (const t of line.split(' ')) {
        if (g.playSan(t)?.replace(/[+#]/g, '') !== t) { bad.push(`${line} -> ${t}`); break; }
      }
    }
    expect(bad).toEqual([]);
  });
  it('knows plenty of positions and offers only legal moves in each', () => {
    expect(bookSize()).toBeGreaterThan(500); // the guide page says over 500 positions
    const p = Position.start();
    const first = bookMoves(p);
    expect(first.length).toBeGreaterThanOrEqual(4);
    for (const m of first) expect(p.legalMoves()).toContain(m);
    // walk down the main line and check every step
    const g = new Game();
    for (const t of BOOK_LINES[0].split(' ')) {
      const here = bookMoves(g.pos);
      const legal = g.legalMoves();
      expect(here.length).toBeGreaterThan(0);
      for (const m of here) expect(legal).toContain(m);
      g.playSan(t);
    }
  });
  it('Hard plays a book move at once in the opening and never from the book once out of it', () => {
    const t = performance.now();
    const job = new SearchJob(Position.start(), 'hard', seededRng(8));
    expect(job.step(20)).toBe(true);
    expect(job.fromBook).toBe(true);
    expect(performance.now() - t).toBeLessThan(500);
    expect(bookMoves(Position.start())).toContain(job.move);
    const g = new Game();
    g.playSan('e4');
    const reply = new SearchJob(g.pos, 'hard', seededRng(8));
    reply.step(20);
    expect(reply.fromBook).toBe(true);
    expect(g.legalMoves()).toContain(reply.move);
    const out = new Game('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(bookMoves(out.pos)).toEqual([]);
    const o = new SearchJob(out.pos, 'hard', seededRng(8), { timeMs: 100 });
    while (!o.step(50));
    expect(o.fromBook).toBe(false);
  });
  it('different seeds can pick different book moves, and the book can be switched off', () => {
    const seen = new Set<number>();
    for (let s = 1; s <= 60; s++) seen.add(chooseMove(Position.start(), 'hard', seededRng(s)));
    expect(seen.size).toBeGreaterThan(1);
    const job = new SearchJob(Position.start(), 'hard', seededRng(1), { book: false, timeMs: 80 });
    while (!job.step(40));
    expect(job.fromBook).toBe(false);
  });
  it('Easy and Medium do not use the book', () => {
    const job = new SearchJob(Position.start(), 'medium', seededRng(1));
    job.step(1e9);
    expect(job.fromBook).toBe(false);
  });
});

// ── the computer never plays an illegal move, and Hard beats Easy ───────────

interface GameResult { outcome: Outcome; plies: number; game: Game }

/** Plays a whole game between two level settings, checking every chosen move is legal. */
const playGame = (
  white: { level: Level; opts?: SearchOptions },
  black: { level: Level; opts?: SearchOptions },
  seed: number,
  maxPlies = 240,
): GameResult => {
  const g = new Game();
  const rng = seededRng(seed);
  let plies = 0;
  while (plies < maxPlies) {
    const o = g.outcome();
    if (o.over) return { outcome: o, plies, game: g };
    const side = g.turn === WHITE ? white : black;
    const legal = g.legalMoves();
    const m = chooseMove(g.pos, side.level, rng, side.opts);
    if (!legal.includes(m)) throw new Error(`${side.level} chose an illegal move ${m} at ply ${plies}: ${g.pos.toFen()}`);
    g.play(m);
    plies++;
    if (plies % 25 === 0 && g.pos.selfCheck().length) throw new Error(`position counters broken at ${g.pos.toFen()}`);
  }
  return { outcome: NOT_OVER, plies, game: g };
};
const lead = (g: Game, color: number): number => materialPoints(g.pos, color) - materialPoints(g.pos, color ^ 1);

describe('computer: fuzz and strength', () => {
  it('Easy against Easy: 60 seeded games, every move legal, every game ends or reaches the cap sanely', () => {
    const reasons: Record<string, number> = {};
    let plies = 0;
    for (let s = 1; s <= 60; s++) {
      const r = playGame({ level: 'easy' }, { level: 'easy' }, s, 300);
      plies += r.plies;
      reasons[r.outcome.over ? r.outcome.reason : 'cap'] = (reasons[r.outcome.over ? r.outcome.reason : 'cap'] ?? 0) + 1;
      expect(r.game.pos.selfCheck()).toEqual([]);
      // undoing the whole game returns to the start exactly
      expect(r.game.undo(r.game.moves.length)).toBe(r.plies);
      expect(r.game.pos.toFen()).toBe(START_FEN);
    }
    expect(plies).toBeGreaterThan(1500);
    expect(Object.keys(reasons).length).toBeGreaterThanOrEqual(2); // several different kinds of ending
  }, 120_000);
  it('Medium and Hard against random-ish opposition: legal moves in 12 more seeded games', () => {
    for (let s = 1; s <= 4; s++) {
      playGame({ level: 'medium', opts: { maxDepth: 2 } }, { level: 'easy' }, 100 + s, 120);
      playGame({ level: 'easy' }, { level: 'hard', opts: { maxDepth: 3, timeMs: 120 } }, 200 + s, 120);
      playGame({ level: 'hard', opts: { maxDepth: 3, timeMs: 120, book: false } }, { level: 'medium', opts: { maxDepth: 2 } }, 300 + s, 100);
    }
  }, 240_000);
  it('Hard (four moves deep) beats Easy: never loses and wins nearly all of six games with the colours swapped', () => {
    let wins = 0;
    let losses = 0;
    for (let g = 0; g < 6; g++) {
      const hardIsWhite = g % 2 === 0;
      const hard = { level: 'hard' as Level, opts: { maxDepth: 4, timeMs: 400 } };
      const easy = { level: 'easy' as Level };
      const r = playGame(hardIsWhite ? hard : easy, hardIsWhite ? easy : hard, 500 + g, 250);
      const hardColor = hardIsWhite ? WHITE : BLACK;
      if (r.outcome.over && r.outcome.winner === hardColor) wins++;
      else if (r.outcome.over && r.outcome.winner === (hardColor ^ 1)) losses++;
      else if (!r.outcome.over && lead(r.game, hardColor) >= 5) wins++; // unfinished but far ahead
    }
    expect(losses).toBe(0);
    expect(wins).toBeGreaterThanOrEqual(5);
  }, 240_000);
  it('Medium beats Easy: wins most of four games with the colours swapped', () => {
    let wins = 0;
    let losses = 0;
    for (let g = 0; g < 4; g++) {
      const medIsWhite = g % 2 === 0;
      const med = { level: 'medium' as Level };
      const easy = { level: 'easy' as Level };
      const r = playGame(medIsWhite ? med : easy, medIsWhite ? easy : med, 700 + g, 250);
      const c = medIsWhite ? WHITE : BLACK;
      if (r.outcome.over && r.outcome.winner === c) wins++;
      else if (r.outcome.over && r.outcome.winner === (c ^ 1)) losses++;
      else if (!r.outcome.over && lead(r.game, c) >= 5) wins++;
    }
    expect(losses).toBe(0);
    expect(wins).toBeGreaterThanOrEqual(3);
  }, 240_000);
  it('Hard converts a won ending: king and queen against a bare king ends in mate', () => {
    const g = new Game('8/8/8/4k3/8/8/8/K2Q4 w - - 0 1');
    const rng = seededRng(21);
    let plies = 0;
    while (!g.outcome().over && plies < 80) {
      const m = chooseMove(g.pos, g.turn === WHITE ? 'hard' : 'easy', rng, { book: false, maxDepth: 6, timeMs: 400 });
      expect(g.legalMoves()).toContain(m);
      g.play(m);
      plies++;
    }
    expect(g.outcome()).toEqual({ over: true, winner: WHITE, reason: 'checkmate' });
  }, 120_000);
});

// ── words, sanitisers, art ──────────────────────────────────────────────────

describe('wording', () => {
  it('describes every way a game can end, for the player and for two players', () => {
    const o = (reason: Outcome['reason'], winner: 0 | 1 | null): Outcome => ({ over: true, winner, reason });
    expect(describeOutcome(NOT_OVER, 0)).toBe('Game in progress.');
    expect(describeOutcome(o('checkmate', WHITE), WHITE)).toBe('Checkmate. You win.');
    expect(describeOutcome(o('checkmate', WHITE), BLACK)).toBe('Checkmate. The computer wins.');
    expect(describeOutcome(o('checkmate', BLACK), null)).toBe('Checkmate. Black wins.');
    expect(describeOutcome(o('resign', BLACK), WHITE)).toBe('You resigned. The computer wins.');
    expect(describeOutcome(o('resign', WHITE), WHITE)).toBe('The computer resigned. You win.');
    expect(describeOutcome(o('resign', WHITE), null)).toBe('Black resigned. White wins.');
    expect(describeOutcome(o('stalemate', null), WHITE)).toMatch(/stalemate/);
    expect(describeOutcome(o('insufficient', null), null)).toMatch(/enough pieces/);
    // A claimed draw names the claim rule; a draw that ends the game by itself names the automatic rule.
    expect(describeOutcome(o('repetition', null), null)).toMatch(/three times/);
    expect(describeOutcome(o('fifty', null), null)).toMatch(/fifty moves/);
    expect(describeOutcome({ ...o('repetition', null), auto: true }, null)).toMatch(/five times/);
    expect(describeOutcome({ ...o('fifty', null), auto: true }, null)).toMatch(/seventy-five moves/);
    // The text really follows the engine: claim() has no auto flag, outcome() does.
    const rep = new Game();
    for (let i = 0; i < 2; i++) for (const t of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) rep.playSan(t);
    expect(describeOutcome(rep.claim() as Outcome, null)).toMatch(/three times/);
    for (let i = 0; i < 2; i++) for (const t of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) rep.playSan(t);
    expect(describeOutcome(rep.outcome(), null)).toMatch(/five times/);
    const old = new Game('4k3/8/8/8/8/8/8/R3K3 w - - 100 80');
    expect(describeOutcome(old.claim() as Outcome, null)).toMatch(/fifty moves/);
    expect(describeOutcome(new Game('4k3/8/8/8/8/8/8/R3K3 w - - 150 80').outcome(), null)).toMatch(/seventy-five moves/);
    expect(describeOutcome(o('agreement', null), null)).toMatch(/agreement/);
  });
  it('describes a move for a screen reader', () => {
    const p = Position.start();
    expect(spokenMove(p, uciToMove(p, 'g1f3'))).toBe('Knight from g1 to f3');
    const c = pos('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(spokenMove(c, uciToMove(c, 'e1g1'))).toBe('castles king side');
    expect(spokenMove(c, uciToMove(c, 'e1c1'))).toBe('castles queen side');
    expect(spokenMove(c, uciToMove(c, 'a1a8'))).toBe('Rook from a1 to a8, capturing');
    const q = pos('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(spokenMove(q, uciToMove(q, 'a7b8q'))).toBe('Pawn from a7 to b8, capturing, becoming a queen');
  });
});

describe('sanitisers', () => {
  it('turns anything in the address bar into valid settings', () => {
    expect(cleanSettings({})).toEqual({ opp: 'computer', d: 'medium', me: 'white' });
    expect(cleanSettings({ opp: 'two', d: 'hard', me: 'black' })).toEqual({ opp: 'two', d: 'hard', me: 'black' });
    expect(cleanSettings({ opp: 'two', d: 'easy', me: 'white' })).toEqual({ opp: 'two', d: 'easy', me: 'white' });
    for (const junk of [null, undefined, 5, NaN, [], {}, '__proto__', 'HARD', 'drop table', '<script>', 1e9, ['hard']]) {
      expect(cleanSettings({ opp: junk, d: junk, me: junk }), String(junk)).toEqual({ opp: 'computer', d: 'medium', me: 'white' });
    }
  });
  it('reads saved wins into a fresh, bounded object', () => {
    expect(cleanWins(null)).toEqual({ easy: 0, medium: 0, hard: 0 });
    expect(cleanWins({ wins_easy: 3, wins_medium: 12, wins_hard: 1 })).toEqual({ easy: 3, medium: 12, hard: 1 });
    expect(cleanWins({ wins_easy: -1, wins_medium: 1.5, wins_hard: NaN })).toEqual({ easy: 0, medium: 0, hard: 0 });
    expect(cleanWins({ wins_easy: '5', wins_medium: [3], wins_hard: { a: 1 } })).toEqual({ easy: 0, medium: 0, hard: 0 });
    expect(cleanWins({ wins_easy: MAX_WINS + 1, wins_medium: Infinity, wins_hard: MAX_WINS })).toEqual({ easy: 0, medium: 0, hard: MAX_WINS });
    for (const junk of [[], 'x', 7, true, undefined]) expect(cleanWins(junk)).toEqual({ easy: 0, medium: 0, hard: 0 });
    const poisoned = JSON.parse('{"__proto__": {"wins_easy": 9}, "wins_hard": 2}');
    const w = cleanWins(poisoned);
    expect(w).toEqual({ easy: 0, medium: 0, hard: 2 });
    expect(Object.getPrototypeOf(w)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).wins_easy).toBeUndefined();
    const input = { wins_easy: 4 };
    expect(cleanWins(input)).not.toBe(input);
  });
  it('writes only small whole numbers back', () => {
    expect(winsToStorable({ easy: 1, medium: 2, hard: 3 })).toEqual({ wins_easy: 1, wins_medium: 2, wins_hard: 3 });
    expect(winsToStorable({ easy: -5, medium: 1e12, hard: NaN })).toEqual({ wins_easy: 0, wins_medium: MAX_WINS, wins_hard: 0 });
    expect(winsToStorable({ easy: 2.9, medium: 0, hard: 0 }).wins_easy).toBe(2);
  });
});

describe('piece art', () => {
  it('has a drawing for each of the six pieces, built only from simple parts inside the 45 x 45 box', () => {
    const tags = new Set(['path', 'circle', 'rect']);
    expect(Object.keys(PIECE_SHAPES).map(Number).sort()).toEqual([PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING]);
    for (const [type, shapes] of Object.entries(PIECE_SHAPES)) {
      expect(shapes.length, `piece ${type}`).toBeGreaterThanOrEqual(3);
      for (const [tag, attrs] of shapes) {
        expect(tags.has(tag), `${type}: ${tag}`).toBe(true);
        for (const [k, v] of Object.entries(attrs)) {
          if (k === 'class') expect(String(v)).toMatch(/^ch-(eye|cut)$/);
          else if (k === 'd') expect(String(v)).toMatch(/^[MLCHVZ0-9 .,-]+$/);
          else { expect(typeof v).toBe('number'); expect(Number.isFinite(v as number)).toBe(true); expect(v as number).toBeGreaterThanOrEqual(0); expect(v as number).toBeLessThanOrEqual(45); }
        }
      }
    }
    expect(BAND_PATH).toMatch(/^M[0-9. ]+H[0-9.]+$/);
    expect(JSON.stringify(PIECE_SHAPES)).not.toMatch(/http|url\(|#/i);
  });
  it('the page carries the claims the guide makes about its controls', () => {
    const calc = page('src/components/apps-private/chess/Calculator.astro');
    for (const id of ['ch-new', 'ch-undo', 'ch-flip', 'ch-claim', 'ch-resign', 'ch-agree', 'ch-moves', 'ch-promo', 'ch-over', 'ch-status']) expect(calc).toContain(`id="${id}"`);
    expect(calc).toMatch(/aria-live="polite"/);
    expect(calc).toMatch(/role="grid"/);
    expect(calc).toMatch(/inert/);
    expect(calc).toMatch(/gk:game:chess/);
  });
});
