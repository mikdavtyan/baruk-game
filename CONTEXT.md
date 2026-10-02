# Baruk

Baruk is an offline Armenian word-guessing game: the player has six guesses to find a five-letter secret word, with coins, points and streaks around each round.

## Words and guesses

**Token**:
One letter of the game's alphabet — one tile and one key. `ու` is a single token even though it is written with two characters.
_Avoid_: character, letter (when counting length)

**Secret word**:
The word the player is trying to find in the current round.
_Avoid_: answer, daily word, target

**Word bag**:
The player's personal shuffled order of all playable words; the secret word is its current entry.
_Avoid_: word list (that is the data), queue

**Guess**:
Five tokens the player enters for one row. Once submitted and scored it is a **submitted guess**.
_Avoid_: attempt, try, row (a row is where a guess is shown)

**Valid word**:
A word accepted as a guess. **Playable words** are the subset that can become a secret word.

## Rounds

**Round**:
Everything that happens with one secret word, from its first guess until the player moves on to a new word. A retry stays inside the same round.
_Avoid_: game, level, puzzle

**Saved round**:
The persisted state of the current round — submitted guesses, the guess being typed, retained guesses, ghosts, Darts eliminations and retries used — so a relaunch continues the round exactly where it was left.
_Avoid_: save game, snapshot

**Result**:
How a round's final submitted guess ended it: a **win** (all tokens correct) or a **loss** (the sixth guess without a win). A result counts the moment its guess is submitted.

**End-of-round record**:
The persisted state of the end-of-round screens after a result (pending win or pending loss), so a relaunch shows the same screen.
_Avoid_: pending state, modal state

**Retry**:
The one same-word second chance after a loss, paid with an ad or coins. Also called the **second chance** in the UI.
_Avoid_: continue, revive, extra life

**Retained guesses**:
The submitted guesses from before a retry, kept so the keyboard colors and found letters carry into the retry.

**New game**:
Leaving a finished round for the next secret word in the word bag.
_Avoid_: reset, restart (a retry also restarts the board)

## Power-ups

**Hint** (ՀՈՒՇՈՒՄ):
A paid power-up that shows one still-unknown letter of the secret word as a ghost in an empty cell.

**Darts** (ՆԵՏ):
A paid power-up that eliminates up to three keys that are not in the secret word.
_Avoid_: bow, arrows (those are its animation)

**Ghost**:
A pale letter shown in an empty cell of the row being typed — from a Hint, or a letter already found in that position before a retry. It is display only, never part of the guess.

## Economy

**Coins**:
The spendable currency: earned by winning and sharing, spent on Hint, Darts and coin retries.

**Points** (ՄԻԱՎՈՐՆԵՐ):
The running score earned by wins; it falls to zero when a round is finally lost.
_Avoid_: score (in code the header calls it score), XP

**Streak**:
The number of consecutive rounds won; **best streak** is the highest it has ever reached.

**Reward**:
The coins (optionally multiplied by watching an ad), points and streak credited for a win.

**Share bonus**:
Coins credited once per secret word for sharing a result, on platforms where the share can be confirmed.
