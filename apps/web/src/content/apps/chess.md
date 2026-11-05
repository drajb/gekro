---
title: "Chess"
category: "fun"
job: "Play free Chess against the computer at three levels, or with a friend on the same screen, with every rule of the game including castling, en passant and promotion."
description: "Free Chess with every rule: castling, en passant, promotion, draws. Play the computer at three levels or a friend on one screen. No ads, no signup."
aiSummary: "A free browser Chess game with the complete rules: castling (refused out of, through or into check), en passant, promotion with a choice of piece, check, checkmate, stalemate, draw by repetition (claimable at three times, automatic at five), the fifty-move rule (claimable at 100 half-moves, automatic at 150) and draw by insufficient material. You can play the computer at Easy, Medium or Hard, or two players on one screen, with undo, resign, claim draw, a flip-board button and a move list in algebraic notation. The move generator is checked against published perft leaf counts: 20, 400, 8902, 197281 and 4865609 for depths 1 to 5 from the starting position, plus five other standard test positions to depths 4 to 6. The computer is an alpha-beta search: Easy looks one move ahead with a large random bonus, Medium searches 3 moves ahead with a capture search at the end, and Hard deepens up to 12 moves with a transposition table, null-move pruning, late move reductions, killer and history ordering, a hand-written opening book of 43 lines and a time cap of about 1.1 seconds, run in short slices so the page stays responsive. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. The interesting part is the engine: a from-scratch move generator checked against the standard perft counts, and a search that stops itself inside about a second."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "♞"
---

## How to play

White moves first and the aim is to checkmate the other king: attack it so that no move can save it. The board has 64 squares and each side starts with 16 pieces. Pieces are drawn as simple shapes in two colours, and the two sides are told apart by more than colour: sky pieces are White, amber pieces are Black, and Black pieces also carry a dark stripe across the body.

Click or tap one of your pieces to select it. Every square it can legally reach is marked: a dot is a plain move and a ring is a capture. Click a marked square to move. Click the same piece again, or press Escape, to put it down. Pieces that can move carry a small mark in the corner of their square, the last move is tinted, and a king in check has a rose-coloured square and a note under the board.

The rules the page enforces:

- **Castling** moves the king two squares towards a rook and the rook to the other side of the king. It is not allowed if the king or that rook has moved, if any square between them is occupied, if the king is in check, or if the king would pass over or land on an attacked square. Move the king two squares to castle.
- **En passant** lets a pawn take a pawn that has just advanced two squares, as if it had advanced one. It is only available on the very next move.
- **Promotion** happens when a pawn reaches the far row. A small panel asks for a queen, rook, bishop or knight, and Escape cancels it.
- **Check** must be answered at once. Only moves that leave your own king safe are offered.
- **Checkmate** ends the game. **Stalemate**, where the side to move has no legal move but is not in check, is a draw.
- **Draws by repetition:** the same position three times can be claimed with the Claim draw button, and at five times the game is drawn automatically. A position counts as the same only with the same side to move and the same castling and en passant chances.
- **Fifty-move rule:** after fifty moves by each side with no capture and no pawn move, a draw can be claimed. At seventy-five moves it is automatic. The page shows the count.
- **Insufficient material:** the game is drawn at once when neither side can ever give checkmate: bare kings, a king with a single bishop or knight, or only bishops that all stand on squares of one colour.

Controls:

- **Opponent:** the computer or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard, for the computer.
- **You play:** White or Black. If you play Black the board turns so your pieces are at the bottom and the computer moves first.
- **New game:** starts again. A change to the menus applies from the next new game, and the page says so; if no move has been played yet it starts at once.
- **Undo:** takes back your last move and the computer's reply, or one move in a two-player game. Once the game is over, undo is off.
- **Flip board:** turns the board round.
- **Claim draw:** available when the repetition or fifty-move rule allows it. The computer claims a draw itself only when it does not think it is winning.
- **Resign:** asks you to press it a second time within five seconds, so a stray tap does not end the game. In a two-player game the side to move resigns. Two players can also agree a draw with a button that asks twice.

Keyboard: arrow keys move around the board, Home and End jump to the ends of a row, Enter or Space selects a piece or moves it, and Escape puts a piece down. Every square is announced with its name, piece and whether it is a legal move, and each move is spoken in full, such as "Knight from g1 to f3". Moves are listed in standard algebraic notation (Nf3, exd5, O-O, e8=Q+). The board works at 320 pixels wide, and the page address stores your opponent, difficulty and side.

## How it works

The engine has no dependencies. The board is 64 squares and a move is a small whole number holding the start square, end square, promotion piece and flags. Moves are made and unmade in place on one board while the position's hash key, piece counts and evaluation are updated step by step. A generated move is kept only if it leaves the mover's own king unattacked.

The move generator is checked against perft, the standard independent test: count every position reachable in a fixed number of legal moves and compare with published figures. The test suite pins these counts, all of which pass:

| Position | Depth 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Starting position | 20 | 400 | 8,902 | 197,281 | 4,865,609 |
| The busy middlegame known as Kiwipete | 48 | 2,039 | 97,862 | 4,085,603 | |
| A rook and pawn ending with pins and en passant (position 3) | 14 | 191 | 2,812 | 43,238 | 674,624 |
| A position full of promotions and castling (position 4) | 6 | 264 | 9,467 | 422,333 | 15,833,292 |
| Position 5 | 44 | 1,486 | 62,379 | 2,103,487 | |
| Position 6 | 46 | 2,079 | 89,890 | 3,894,594 | |

Position 3 also reaches depth 6 at 11,030,083, and a mirrored copy of position 4 gives the same figures as the original to depth 4. Five more positions covering promotion, castling, check evasion, en passant and bishops and rooks together are checked to depth 3 or 4. The start position is also checked move by move at depth 3, such as 600 positions after 1.e4.

The tests also pin: FEN round trips and rejection of impossible positions; every castling condition, one at a time; the en passant capture that would expose the king along a rank or a diagonal being refused; promotion for both sides with all four pieces; notation with disambiguation by file, rank and full square, where every legal move of a dozen positions turns into text and back to the same move; a famous 17-move game replayed to its checkmate; stalemate, checkmate, dead positions, repetition and the fifty-move rules; take-back restoring the exact position; and a colour-flipped copy of a position always scoring the same.

The computer comes in three levels, all searching with the same engine:

- **Easy** looks one move ahead, scores the position after each move and adds a large random bonus. It grabs free pieces and sees a mate in one, but often walks into a recapture.
- **Medium** searches 3 moves ahead with alpha-beta pruning, then keeps going through captures so it never stops in the middle of an exchange. It picks at random among moves that score about the same, and it too runs in short slices.
- **Hard** deepens one move at a time up to 12 moves. It keeps what it has already worked out in a table, tries the most promising moves first (captures ranked by the value of the piece taken over the piece taking, then moves that caused cutoffs before), searches late quiet moves less deeply, and stops after about 1.1 seconds. The search checks the clock inside the tree and runs in slices of about 25 milliseconds, so the page paints the "thinking" message and stays responsive. In its first moves it plays from a hand-written book of 43 opening lines covering over 500 positions.

All three score a position by the pieces and where they stand, a bonus for two bishops, and in a won ending a bonus for driving the bare king to the edge and bringing the king close.

Checked by the suite: every level finds a mate in one and wins a hanging queen; Medium and Hard find a mate in two, verified by an exhaustive search rather than by the engine, and Hard finds a forced mate in five; Medium and Hard refuse a pawn that costs the queen; across 72 seeded games every move the computer chose was legal; Hard searching 4 moves deep never lost and won at least 5 of 6 games against Easy with the colours swapped, and Medium won at least 3 of 4. On busy positions the real Hard setting answers in about 0.7 to 1.1 seconds; the suite allows 2.5 seconds for a slow machine.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty is saved in your browser's local storage as small whole numbers in one small object. Clearing site data removes it. The session tally (your wins, the computer's, draws) lives only on the page. Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Hard is a fixed search with no learning. A careful player can beat it, and its opening book is small.
- The evaluation is hand-made: material, piece placement, the bishop pair and a mop-up bonus. It has no deep knowledge of pawn structure or king safety.
- A draw by repetition or the fifty-move rule must be claimed with the button, as in over-the-board play; it becomes automatic at five repetitions or seventy-five moves.
- A draw by agreement is only for two players on one screen. There is no online play and no clock.
- Moves are made by clicking or tapping; pieces cannot be dragged.
- The pieces are drawn in the page, in two colours with a stripe for Black, and do not follow any traditional set.

Everything runs locally in your browser.
