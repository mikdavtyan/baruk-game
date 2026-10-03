---
name: wordle-game-logic
description: Armenian Wordle rules and App.tsx game state in Baruk. Use when touching typing/backspace/submit, evaluateGuess, keyboard key colors, the "ու" token, validWords/playableWords, the secret word and its shuffled word bag, Hint or Darts power-ups, New Game vs same-word loss retry, or debugging any gameplay bug.
---

# Game logic

## Token model: the most common source of bugs
- A guess is a `string[]` of **tokens**, not characters. `ու` (ո + ւ, two code points) is ONE token, one tile and one key. `և` is not in the alphabet.
- Never measure or split a word with `.length`, `split('')` or `Array.from`. Use `tokenizeArmenianWord` (`lib/tokenizeArmenian.ts`).
- Tokens stay lowercase in all logic. Uppercase happens only at render, through `letterLabel` (`lib/letterDisplay.ts`); never `toUpperCase()`. The ZWNJ inside the `ու` label blocks the font's ՈՒ ligature on purpose.
- Keyboard input already arrives as tokens (`ROW_*` in `components/Keyboard.tsx`). `ALL_LETTER_TOKENS` is the whole alphabet.

## Word lists (`constants/*.json`)
- `validWords.json` holds accepted guesses; `playableWords.json` is the secret-word pool.
- `constants/wordLists.test.ts` enforces the invariants: normalized, exactly `WORD_LENGTH` tokens, typeable on the keyboard, no duplicates, playable ⊆ valid. Run `npx jest constants/wordLists` after any edit.
- `guessValidity` compares **token sequences** (`'incomplete' | 'invalid' | 'valid'`). Its lookup set is built once, when the module loads.

## Secret word (`lib/wordBag.ts`)
- The word is the current entry of a persisted, shuffled bag of all playable words (`wordle:wordBag`), held in App state as `wordBag`/`secretWord`. App renders nothing until it has loaded.
- Only `handleNewGame` (ՀԱՋՈՐԴ ԲԱՌԸ / ՆՈՐ ԽԱՂ) advances it. A loss retry keeps the word, and a relaunch returns the same word.
- A used-up bag is reshuffled, never starting with the word that ended the old one. A saved bag that isn't a permutation of the current list (after a word-list change) is replaced.

## App.tsx state invariants
- `guess` is `{ tokens: WORD_LENGTH slots, '' = empty; activeIndex }`, held in one `useState`. Always update it with a functional updater that reads `prev`, and that includes the "row full" guard. Reading outer closures here caused a real same-batch overwrite bug; `App.guessTyping.test.tsx` covers it.
- Hint can leave empty slots, so count entered tokens with `filter(t => t !== '')`.
- The only way to submit is the ԸՆԴՈՒՆԵԼ button; there's no Enter key. The flow is: validity gate → `evaluateGuess` → phase `revealing` for `ROW_REVEAL_DURATION_MS` → a `setTimeout` sets phase `won`, `lost-awaiting-decision` or back to `playing` (see `lib/gamePhase.ts`). The row being revealed is kept out of the keyboard colors until the reveal ends.
- `computeKeyStates` never downgrades a key (correct > present > absent). Retained guesses and Darts hits are fed in as pseudo-guesses, so add any new source of key colors the same way.
- New controls must respect `isGameLocked`.
- **Ghosts** are display-only (never written into `guess.tokens`) and render only on the active row, in empty cells, as their own static layer in `Tile.tsx` (never animated; a typed letter is always ink until its flip). Typing in that cell hides the ghost; backspace brings it back. `ghosts` (`GhostHint[]`, each with a `kind`) = `hintGhosts` (state; Hint presses, removed once scored correct; kind `'hint'`) plus, **after a retry only**, every position found green in any guess of this word (derived from `retainedGuesses` + `submittedGuesses`; kind `'carried'`). Where both land on one position, carried wins. In a first attempt, greens don't become ghosts. The two kinds look different on purpose — see `wordle-ui`.

What each reset keeps. New game state needs a row here, and both handlers need updating (`App.roundFlow.test.tsx` checks this):

Both handlers go through `resetBoard` (see `wordle-ui`), in one render, while the modal still covers the board:

| state | `handleNewGame(onBoardShown)` | `handleLossRetry(lostGuesses, onBoardShown)` (same word) |
|---|---|---|
| wordBag | advanced (new word) | unchanged |
| submittedGuesses, guess, phase, resultRowIndex, lossShakeRowIndex | reset | reset |
| retainedGuesses | cleared | appended with `lostGuesses` (keyboard colors + carried ghosts come from it) |
| hintGhosts | cleared | kept |
| dartsRevealedAbsent, paidDarts, isDartsFiring | cleared | kept |
| retriesUsed | 0 | +1 |
| roundId | +1 (LossFlow resets its retry count) | unchanged |
| keyboard colors | reset to neutral | kept |
| board | remounted (`boardKey` +1) | remounted (`boardKey` +1) |

`lostGuesses` comes from LossFlow's frozen board, not from `submittedGuesses`, which is empty after a relaunch.

## Power-ups
- **Hint:** a ghost of `secretWord[i]` at a random still-unknown position — not green in any guess of this word (retained guesses included), not already a ghost — and only in an empty cell (the only place a ghost shows). If unknown positions remain but none is empty, the button is dimmed, a tap is free and shows `HINT_NO_ROOM_TOAST`.
- **Darts:** up to 3 tokens that are not in `secretWord` and not already gray (fewer if fewer are left). Targets are decided before any animation and saved as paid (`paidDarts`) with the charge; a key turns absent when its arrow lands (`dartsRevealedAbsent`), and a relaunch shows every paid target absent.
- **Win after a retry:** pays `retryWinRewardFactor` (½, floored) of the coins before the ad multiplier; points and streak as usual. `retriesUsed > 0` is passed to WinFlow as `afterRetry` and frozen into the pending win (see `wordle-win-loss`).
- **Paying (`payFor(item, price, purchase)`):** a use that reveals something costs one item from the **inventory** (`wordle:inventory`, `{ hint, darts }`, starting at `WIN_FLOW_CONFIG.startingInventory` = 3/3, also for older saves) while any are held, else `WIN_FLOW_CONFIG.hintPrice`/`dartsPrice` coins. Either way it's saved in one atomic write with what was bought (the saved round's hint ghosts / paid Darts). A use that reveals nothing (exhausted, Hint's "no room") pays nothing and shows its toast. With no items and too few coins the button is dimmed but tappable, and a tap opens the shop. Only `isGameLocked` (and Darts mid-flight) disables the buttons. `PowerUpButton` shows a red count badge while `count > 0` and hides the price then (kept in the layout, so nothing shifts).
