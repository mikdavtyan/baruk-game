---
name: wordle-win-loss
description: End-of-round flows and economy in hy-wordle. Covers the WinFlow/LossFlow step machines, the reward, second-chance and result modals, coins, points (ՄԻԱՎՈՐՆԵՐ), streaks, loss retries, the share bonus, the rewarded-ad and leaderboard stubs, and AsyncStorage persistence and app-relaunch resume through lib/gameStorage.ts. Use when changing anything that happens after a round ends, or anything that is persisted.
---

# Win/loss flows & economy

## Structure
- `App.tsx` owns one `phase` (`lib/gamePhase.ts`: `playing → revealing → won | lost-awaiting-decision → finished`). `WinFlow` is `active` in `won`, `LossFlow` in `lost-awaiting-decision`/`finished`, and each runs an internal `step` machine:
  - WinFlow: `idle → celebrating → reward → result → (Next) idle`
  - LossFlow: `idle → lossMoment → secondChance → retry (→ idle) | decline (→ lossResult) → (New game) idle`. A loss after the retry goes straight to `lossResult`.
- They call back into App: `onNextWord(cb)`/`onNewGame(cb)` → `handleNewGame` (new word), `onRetry(lostGuesses, cb)` → `handleLossRetry` (same word).
- **Every exit (Next, New game, retry):** App resets and remounts the board under the still-opaque modal, then calls `cb` one frame after that board has painted. Only then do content and backdrop fade out **together** (`MODAL_EXIT_MS`). The retry's closing modal renders from `closingSnapshot`; its retry counter changes only after the exit ends.
- **Restoring animated values:** reset a modal's `Animated.Value`s (e.g. `contentOpacity` to 1) when it **opens** (LossFlow `openModal`, WinFlow's reward start), never in an exit callback (the modal flashes back for a frame) and never in an effect after unmount (the native side writes the faded value back when the view detaches, so the next modal mounted invisible under a visible backdrop; `App.roundFlow.test.tsx` "end-of-game flow always shows" guards this).
- **Resume:** App reads the pending win/loss before first render and passes it as `resume`; the flows initialise `step` and values from it synchronously. The phase is derived from it (`phaseFromPending`), so a relaunch shows the same modal, Try again included. With nothing to save (`hasSomethingToSave`) a loss skips Try again.
- **Coin flights** (`CoinFlight`, ≤700ms): never block the UI or chain the next step onto one. Anything that moves on mid-flight calls `finishCoinFlightNow` (the pill lands on the real `coins`). The balance is credited before the flight; arrivals only step the display, and cancelled coins must never land.
- **Guard patterns:** `wasActiveRef` stops a double start, `isTransitioning` ignores repeated taps, and a `cancelled` flag protects each async `run()`. New steps need all three.
- **Stale closures:** the live-loss effect calls helpers in the same tick it sets state, so pass values into those helpers as arguments (as `finishRound` does) instead of reading state.
- **Mirrored files:** WinFlow and LossFlow share the same coin-pill stepping, `coinFlightFinishRef`, duplicated header pill and share handler. A fix in one usually belongs in the other too.

## Economy rules
All numbers are in `WIN_FLOW_CONFIG` (`constants/winFlow.ts`); change them only there. `App.roundFlow.test.tsx` covers these rules.
- **Win:** coins by guess count (the ad multiplies them in RewardModal), points by guess count, streak +1 (best = max). All are credited in `handleRewardNext`, when the player leaves the reward modal.
- **Loss:** one retry per word (`maxLossRetries: 1`), by ad or `retryCoinPrice` coins. Points → 0 and streak → 0 (best kept) happen **only** in `finishRound` (decline or out of retries), never at the moment of loss, because a retry can still save the streak.
- **Share bonus:** once per `wordKey`, ever (`claimShareBonus`), only on `Share.sharedAction`.
- **Ordering:** persist first, then animate. The `coins` prop is updated and saved immediately. The header pill shows a separate `pillValue` that steps with each flying coin and snaps to `coins` at the end.
- **Hint/Darts** also spend coins — see `wordle-game-logic`.
- **Known risk:** `handleRewardNext` saves coins/points/streak before marking the pending win `result`; a kill in between re-offers the reward on relaunch (double credit).

## Persistence & resume (`lib/gameStorage.ts` is the only AsyncStorage caller)
- Keys are `wordle:{coins,points,streak,pendingWin,pendingLoss,shareClaims,wordBag}`. Reads fall back to defaults and writes swallow errors.
- A pending record is written when each modal step is entered and cleared on Next, New game or retry. On mount, each flow restores its modal from it. These resume effects run **before** App's own storage loads, so read storage directly inside them.
- **The resume rule:** after a relaunch the board is empty (it isn't persisted), and the current word may already differ (the bag advanced). Anything a resumed modal shows or carries over must therefore come from the pending record, or from LossFlow's `frozenBoard`/`frozenWordTokens`. Never read the live `secretWordTokens`/`submittedGuesses`/`finalGuesses` props for it. `components/flowResume.test.tsx` covers the three real bugs this caused.
- **Record shape:** changing `PendingWin`/`PendingLoss` means old records on devices are cast to the new type without checks, so make new fields optional.
- **Not persisted:** the board (guesses, keyboard colors, hints) and the theme. `pendingLoss` is cleared when a retry starts, so killing the app mid-retry also resets `retriesUsed`.

## Stubs
None of these are real integrations:
- `lib/rewardedAd.ts` always resolves `true` after `AD_FAKE_LOAD_MS`.
- `lib/leaderboard.ts` is mock rivals plus the player.
- `GAME_SHARE_URL` is a placeholder.
