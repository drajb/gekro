---
title: "Word Chain"
category: "fun"
job: "Play a free word chain game against the computer: take turns saying a word that starts with the last letter of the one before."
description: "Free word chain game with 1,005 everyday words. Take turns with the computer, three levels, optional gentle timer and hints. No ads. No signup."
aiSummary: "A free browser word chain game. The computer says a word, and the player replies with a word that starts with the last letter of the previous word; no word can be used twice. Both sides use only a hand-written list of 1,005 everyday words, so the computer never says an obscure word, and a typed word that is not on the list is refused without being shown back. The player cannot lose: pressing the stuck button ends the chain and counts it, and if the computer has no unused word for a letter the player wins the chain. Gentle picks a short word that leaves the player at least 8 unused choices, Normal picks any word that leaves at least one choice, and Tricky picks one of the words that leaves the fewest choices. An optional timer shows 20 seconds a word and never penalises. The computer is deterministic for a puzzle number and the words typed. The longest chain without a hint is kept per level in local storage; nothing is uploaded."
personalUse: "Anyone is welcome to play and learn with this, with no ads. The interesting part is Tricky: it counts the unused words left for every letter and picks the reply that leaves you the fewest options."
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "🔗"
---

## How to play

The computer says a word to start the chain, for example **table**. Your word has to start with the last letter of that word, which here is **E**, so you might say **egg**. Then the computer answers with a word that starts with **G**, and so on. A word can be used only once in a chain. The big tile above the box always shows the letter your next word must start with.

Type your word into the box and press **Enter** or the **Add word** button. If the word is refused, the page says why in plain words: it does not start with the right letter, it is already in the chain, or it is not on my list. A word that is not on the list is refused even if it is a real word, and it is never shown back to you.

You do not lose at this game. When you run out of ideas you have three choices.

- **Hint: show me a word** names a word you could say. A chain where you used a hint does not count as your longest.
- **I am stuck, end the chain** finishes the chain and counts how many words you said.
- Keep going. If the computer cannot find an unused word that starts with your letter, you win the chain.

**Levels.** *Gentle* makes the computer pick a short word, and one that leaves you plenty of unused words to choose from. *Normal* picks any unused word that leaves you at least one choice. *Tricky* looks at every word it could say, counts how many unused words would be left for you after each one, and picks one of the words that leave the fewest. It still never leaves you with no word at all unless it had no other option.

**Gentle timer.** Tick the box to show a 20-second clock for each of your words. It is only a pace: when it reaches zero the page tells you to take your time and keeps waiting. Words you say before it runs out are counted as quick words. The clock stops while the tab is hidden.

Your words are rounded pills with a green outline, the computer's words have square corners and a violet outline, and each word is also labelled You or Computer, so the two sides are never told apart by colour alone. The last letter of every word is underlined to show what comes next. The page announces each reply, and the chain list can be scrolled with the keyboard.

**Sharing.** Copy result puts a short line on your clipboard with the level, the puzzle number and the length of the chain. The page address holds the level, the puzzle number and the timer setting. The same puzzle number gives the same opening word, and the same replies if you say the same words.

## How it works

The list was written by hand: 1,005 everyday words of three to nine letters, all lower case, with no names or brands and nothing rude, scary, violent or unkind. The tests check every word against a blocklist, and they pin that every letter of the alphabet starts at least one word (only x has just one), that each letter that ends many words also starts at least ten, and that the game drops no word from the list. The test run caught one blocked word that I had written into the list, and it was taken out.

The rules are simple to state and are checked against a plain filter of the whole list: a word counts if it starts with the last letter of the previous word, is on the list and is not already in the chain. After your word, the game checks whether any unused word still starts with its last letter. If none does, you win. After the computer's word, it checks the same for you.

The computer opens with a word of three to six letters whose last letter still has at least ten unused words after it, so the first turn is never a trap. For its replies it works out, for each candidate, how many unused words would start with that candidate's last letter. Gentle chooses among short candidates that leave at least 8; Normal chooses among candidates that leave at least 1; Tricky chooses among the candidates with the smallest count that is at least 1. All of this uses only the list and the words already used, plus the puzzle's seeded random numbers, so the computer cannot see anything it should not and it plays the same way every time for the same input.

### What the tests check

| Claim | How it is checked |
|---|---|
| The list has 1,005 clean words | counted, deduplicated, matched against the blocklist whole and in part |
| The computer's word always follows the rules | 2,000 random mid-game positions: right first letter, on the list, unused, compared with a brute-force filter |
| The computer leaves you a word unless it had no choice | the same 2,000 positions, with the room left counted by brute force |
| Each level follows its strategy | 1,000 more positions: Gentle, Normal and Tricky choices compared with a plain loop |
| Tricky leaves fewer choices than Normal, and Normal fewer than Gentle | average choices left over 600 games at each level |
| Whole games are valid | 1,500 games against a player who says random legal words: every word links to the one before, nothing repeats, and the ending is true |
| The same input gives the same chain | the same puzzle number and words, run twice |
| Saved records | only whole numbers from 1 to 9,999 for the three level names survive |

## Privacy and storage

Nothing is uploaded and there is no account. Your longest chain without a hint is stored in your browser for each level as a small whole number. Clearing site data removes it.

## Limits

- Only the 1,005 words on the list are accepted, so plenty of real words are refused. The list favours words a young reader knows.
- Words with an unkind or rude second meaning were left out, even when they are common.
- The computer answers instantly. There is no pretend thinking pause.
- The chain cannot be longer than the list allows, since no word may be used twice.
