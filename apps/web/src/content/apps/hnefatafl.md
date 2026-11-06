---
title: "Hnefatafl"
category: "fun"
job: "Play Hnefatafl, the old Scandinavian board game of a king and his guards against a ring of attackers, on a 9 by 9 or 7 by 7 board against the computer or a friend."
description: "Free Hnefatafl in your browser: attackers surround the king, the king runs for a corner. Play the computer at three levels or a friend. No signup."
aiSummary: "A free browser Hnefatafl, the historic Scandinavian strategy game. Two sizes: the full 9 by 9 board with 16 attackers, 8 defenders and a king, and a small 7 by 7 board with 8 attackers, 4 defenders and a king. Pieces slide like a rook over empty squares. Only the king may stop on the middle square (the throne) or on a corner, and any piece may slide over the empty throne. A piece is captured when the other side moves so that it is sandwiched in a straight line; a corner is hostile to every piece, the throne is hostile to attackers always and to defenders when empty, the king helps the defenders, and moving between two enemy pieces is safe. On the 9 by 9 board the king is captured by attackers on all four sides, or on the three open sides beside the throne, and never on the edge; on the 7 by 7 board, away from the throne, two attackers on opposite sides capture it. The defenders win when the king reaches a corner, the attackers win by capturing the king, a side with no move loses, and 80 moves in a row with no capture is a draw. The rules are checked against a separately written model in 1,600 random positions and 200 random games. You can play either side. The computer has three levels for both sides: Easy plays a random legal move, Medium runs an alpha-beta search up to 3 moves ahead with a limit of 30,000 positions, and Hard deepens one move at a time up to 5 moves with a limit of about 0.45 seconds or 60,000 positions. Win counts per difficulty are kept in the browser's local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The capture rules for the king are the part most likely to be wrong, so I wrote them a second time from the rule text and let the two versions check each other in thousands of random positions."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "♚"
---

## How to play

Two armies face each other on a square board. The **attackers** (rose triangles) start at the middle of each edge. The **defenders** (sky discs) stand around their **king** (an amber star), who starts on the middle square, the **throne**, which is marked with a cross. The four corner squares, marked with a diamond, are the king's way out. The attackers move first.

- **Moving:** every piece slides any distance along a row or a column over empty squares. Nothing jumps.
- **Special squares:** only the king may stop on the throne or on a corner. Any piece may slide across the empty throne.
- **Capturing:** you capture an enemy piece by moving a piece so that the enemy piece sits in a straight line between the piece you moved and another piece of yours. A corner counts as your piece against everybody. The throne counts as an attacker's enemy at all times, and as a defender's enemy while it is empty. The king helps the defenders capture. Moving between two enemy pieces is safe, and only the side that moves captures. One move can capture several pieces.
- **Capturing the king:** on the 9 by 9 board the attackers need to stand on all four sides of the king, or on the three open sides when the king is beside the throne. A king on the edge cannot be captured. On the 7 by 7 board, a king away from the throne is captured like any other piece, by two attackers on opposite sides; on or beside the throne it needs the same ring as on the large board.
- **Winning:** the defenders win when the king reaches a corner. The attackers win by capturing the king. A side that cannot move loses. The game is drawn after 80 moves in a row, counting both sides together, with no capture. The page shows that count.

The page warns you when the king has a clear line to a corner. As the defender, that is the move that wins. As the attacker, you have one move to block the line or capture the king.

Controls:

- **Opponent:** the computer, or two players on the same screen.
- **Difficulty:** Easy, Medium or Hard. It applies when you play the computer, and the menu is switched off in two-player games.
- **You play:** the attackers, who move first, or the defenders with the king. When you are the defenders the computer opens.
- **Board:** the full 9 by 9 game or the small 7 by 7 game, which is quicker.
- **Undo:** takes back your last move and the reply. Against a person it takes back one move. Once a game is over, undo is off.

Click one of your pieces (pieces that can move have a dashed outline) and then a square with a green dot. On the keyboard, arrow keys move around the board, Home and End jump to the ends of a row, Enter or Space selects a piece or moves it, and Escape puts the piece down. Every square is announced with its row, column, contents and whether it is the throne or a corner, and the status line says what each move did and what it captured. Pieces differ by shape, not just by colour: triangle, disc and star. The page address carries the opponent, difficulty, side and board size.

## How it works

The engine keeps, for every square and each of the four directions, the list of squares met going outward. A piece's moves are those lists cut off at the first piece, with the throne and corners skipped for everyone but the king. After a move it looks at the four squares around the landing square for enemy pieces that are now sandwiched, and it asks a separate question about the king.

The test suite pins the rules in several ways:

- **The openings:** 16 attackers, 8 defenders and the king on 9 by 9, and 8, 4 and the king on 7 by 7, both unchanged by turning the board a quarter turn or flipping it. The opening has 72 moves for the attackers and 56 for the defenders on 9 by 9, and 40 and 24 on 7 by 7.
- **Each rule, by hand-built positions:** sliding blocked by pieces, the throne and corners kept for the king, sandwiches in a row and a column, safe stepping between two enemies, capture against a corner, against the empty throne and not against the throne when the king stands on it, the armed king, three pieces taken in one move, each way of capturing the king on both boards, a king that steps into a ring being safe, the king reaching a corner, a side with no move, and the draw.
- **A second implementation:** a separately written model, with coordinates and loops instead of lookup lists, lists every legal move, works out what each move captures and decides every ending. It agrees with the engine in 1,600 random positions on both sizes, including every capture of every legal move, and move by move through 200 random games, with the king, corners and throne rules holding all the way.
- **Illegal input:** moves onto pieces, through pieces, diagonally, to corners or the throne, of the wrong side, and junk values are all refused without changing the position.

The computer comes in three levels and plays either side:

- **Easy** picks any legal move at random.
- **Medium** runs an alpha-beta search up to 3 moves ahead, looking at no more than 30,000 positions and stopping after about 0.9 of a second.
- **Hard** searches up to 5 moves ahead, one move deeper at a time (iterative deepening), and stops deepening after about 0.45 of a second or 60,000 positions, whichever comes first, so a move never ties up the page for long even on a slow device. The deepest finished search decides the move.

Both searches score a position from the attackers' side and the defenders play for the opposite score. The score counts pieces (a defender is worth more than twice an attacker), how far the king is from a corner, how many squares it can reach, a large penalty for each corner the king has a clear line to, a bonus for attackers touching the king and a small one for pieces on the squares next to the corners. A defender to move with a clear line to a corner is counted as a win at once. Captures and king runs are tried first, and moves that tie for best are chosen between at random.

The alpha-beta search is checked against a plain minimax with no pruning, which gives the same value at depths 0 to 2 on 9 by 9 and 0 to 3 on 7 by 7 in positions from random games. In the test suite, Hard defenders searching 3 moves ahead won at least 5 of 6 small-board games against Easy attackers, and Medium attackers lost at most 1 of 6 against Easy defenders. In the suite's test positions, the defenders slide the king to a corner when the line is open, the attackers capture the king when they can, and when the king threatens a corner the attackers block it. The suite asserts that Hard answers every position it is asked about in under 5 seconds, a bound loose enough for a slow machine; the design limit is about 0.45 of a second. The computer waits about 0.45 seconds before moving so you can follow along, and moves at once if you have asked for reduced motion.

## Privacy and storage

Nothing is uploaded and there is no account. Against the computer, your win count for each difficulty (for both sides and both boards added together) is saved in your browser's local storage, as small whole numbers inside a small JSON object, under one key. Clearing site data removes it. The session tally lives only on the page and resets when you leave it. Two-player games are not saved.

Only finished games count. A game in which you used Undo is not counted against the computer, so the saved figures are not inflated.

## Limits

- Many rule sets exist for this family of games. These are the page's own: corner escape, a king that needs four attackers on the large board, no rule that lets the attackers win by surrounding all the defenders, and a draw after 80 quiet moves in a row instead of a repetition rule.
- Hard is a fixed search of at most 5 moves with no learning and no opening book, and the evaluation is a simple hand-made one. A careful player can beat it.
- The small board plays quickly but is not balanced by any proof. I have not measured which side wins more often.
- Two-player mode is for one screen only; there is no online play.
- Difficulty and side are only used against the computer.
