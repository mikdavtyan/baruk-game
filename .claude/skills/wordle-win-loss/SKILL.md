---
name: wordle-win-loss
description: End-of-round flows and economy in Baruk. Covers the WinFlow/LossFlow step machines, the reward, second-chance and result modals, coins, points (ՄԻԱՎՈՐՆԵՐ), streaks, loss retries, the share bonus, the rewarded-ad and leaderboard stubs, and AsyncStorage persistence and app-relaunch resume through lib/gameStorage.ts. Use when changing anything that happens after a round ends, or anything that is persisted.
---

# Win/loss flows & economy

## Structure
- `App.tsx` owns one `phase` (`lib/gamePhase.ts`: `playing → revealing → won | lost-awaiting-decision → finished`). `WinFlow` is `active` in `won`, `LossFlow` in `lost-awaiting-decision`/`finished`, and each runs an internal `step` machine:
  - WinFlow: `idle → celebrating → reward → result → (Next) idle`
  - LossFlow: `idle → lossMoment → secondChance → retry (→ idle) | decline (→ lossResult) → (New game) idle`. A loss after the retry goes straight to `lossResult`.
- They call back into App: `onNextWord(cb)`/`onNewGame(cb)` → `handleNewGame` (new word), `onRetry(lostGuesses, cb)` → `handleLossRetry` (same word).
- **Every exit (Next, New game, retry):** App resets and remounts the board under the still-opaque modal, then calls `cb` one frame after that board has painted. Only then do content and backdrop fade out **together** (`MODAL_EXIT_MS`). The retry's closing modal renders from `closingSnapshot`; its retry counter changes only after the exit ends.
- **Restoring animated values:** reset a modal's `Animated.Value`s (e.g. `contentOpacity` to 1) when it **opens** (LossFlow `openModal`, WinFlow's reward start), never in an exit callback (the modal flashes back for a frame) and never in an effect after unmount (the native side writes the faded value back when the view detaches, so the next modal mounted invisible under a visible backdrop; `App.roundFlow.test.tsx` "end-of-game flow always shows" guards this).
- **Resume:** App reads the pending win/loss before first render and passes it as `resume`; the flows initialise `step` and values from it synchronously. The phase is derived from it (`phaseFromPending`), so a relaunch shows the same modal, Try again included. Without a pending record, the saved round's last guess decides (all green → `won`, six misses → `lost-awaiting-decision`) and the flow runs from the start: a result counts from the moment it's submitted. With nothing to save (`hasSomethingToSave`) a loss skips Try again.
- **Coin flights** (`CoinFlight`, ≤700ms): never block the UI or chain the next step onto one. Anything that moves on mid-flight calls `finishCoinFlightNow` (the pill lands on the real `coins`). The balance is credited before the flight; arrivals only step the display, and cancelled coins must never land.
- **Guard patterns:** `wasActiveRef` stops a double start, `isTransitioning` ignores repeated taps, and a `cancelled` flag protects each async `run()`. New steps need all three.
- **Stale closures:** the live-loss effect calls helpers in the same tick it sets state, so pass values into those helpers as arguments (as `finishRound` does) instead of reading state.
- **Mirrored files:** WinFlow and LossFlow share the same coin-pill stepping, `coinFlightFinishRef`, duplicated header pill and share handler. A fix in one usually belongs in the other too.

## Economy rules
All numbers are in `WIN_FLOW_CONFIG` (`constants/winFlow.ts`); change them only there. `App.roundFlow.test.tsx` covers these rules.
- **Win:** coins by guess count (the ad multiplies them in RewardModal), points by guess count, streak +1 (best = max). A win after a loss retry pays `retryWinRewardFactor` of the coins (floored, before the ad); points and streak are unaffected. Whether it came after a retry is the optional `PendingWin.afterRetry` (WinFlow's `afterRetry` prop = App's `retriesUsed > 0`), so a resume shows and credits the same amount. All are credited in `handleRewardNext`, when the player leaves the reward modal.
- **Loss:** one retry per word (`maxLossRetries: 1`), by ad or `retryCoinPrice` coins. Points → 0 and streak → 0 (best kept) happen **only** in `finishRound` (decline or out of retries), never at the moment of loss, because a retry can still save the streak.
- **Share bonus:** iOS only (`shareBonusAvailable()`; Android reports `sharedAction` even when dismissed, so it never credits there and hides the badge). Once per `wordKey`, ever (`claimShareBonus`), only on `Share.sharedAction`. See `docs/adr/0002-share-bonus-ios-only.md`.
- **Ordering:** persist first, then animate. Anything that moves coins/points/streak together with a round, pending or word-bag record is saved in ONE `saveAtomically` call (a single `multiSet`), then the props are updated: the win reward, the final loss, a retry grant (`onRetryGranted`, before the coin flight), a power-up use (coins or an inventory item) and a new game. Keep records in those writes under 1024 UTF-16 units (iOS only writes that atomically); see `docs/adr/0003-economy-writes-are-atomic.md`. The header pill shows a separate `pillValue` that steps with each flying coin and snaps to `coins` at the end.
- **Hint/Darts** spend an inventory item while any are held, else coins — see `wordle-game-logic`. The inventory is in the atomic-write family: an item use and what it bought are one `saveAtomically` write.

## Persistence & resume (`lib/gameStorage.ts` is the only AsyncStorage caller)
- Keys are `wordle:{coins,points,streak,pendingWin,pendingLoss,shareClaims,wordBag,round,rulesSeen,inventory}`. Reads fall back to defaults and writes swallow errors.
- A pending record is written when each modal step is entered and cleared on Next, New game or retry. On mount, each flow restores its modal from it. These resume effects run **before** App's own storage loads, so read storage directly inside them.
- **The resume rule:** after a relaunch the board comes back from the saved round only if it's still the same word, and a resumed pending record may belong to an earlier word. Anything a resumed modal shows or carries over must therefore come from the pending record, or from LossFlow's `frozenBoard`/`frozenWordTokens`. Never read the live `secretWordTokens`/`submittedGuesses`/`finalGuesses` props for it. `components/flowResume.test.tsx` covers the three real bugs this caused.
- **Record shape:** changing `PendingWin`/`PendingLoss` means old records on devices are cast to the new type without checks, so make new fields optional.
- **Saved round** (`wordle:round`, `getRound`/`setRound`): submitted guesses, the guess being typed, retained guesses, hint ghosts, paid Darts targets and retries used, stored compactly. App autosaves it whenever it changes and restores it on launch when its `wordKey` is the current word; a new game clears it with the pending records in one atomic write. LossFlow's retry count starts from it (`initialRetriesUsed`). See `docs/adr/0001-rounds-survive-relaunch.md`.
- **Not persisted:** the theme. Known accepted gap: on iOS the word bag is too large to write atomically, so a kill mid-new-game can skip one word (never a double credit).

## Stubs
None of these are real integrations:
- `lib/rewardedAd.ts` always resolves `true` after `AD_FAKE_LOAD_MS`.
- `lib/leaderboard.ts` is mock rivals plus the player.
- `GAME_SHARE_URL` is a placeholder.
