---
name: wordle-testing
description: How to write, run and debug tests in Baruk (jest-expo + react-test-renderer). Covers rendering the full App or a single flow, the mocks they need, fake timers with awaited setTimeout chains, finding keys by Armenian accessibility labels, pinning the secret word through the word bag, and which warnings are known noise. Use when adding or fixing tests, or when verifying a change.
---

# Testing

Run everything with `npm test`; run one file with `npx jest lib/evaluateGuess`. The `not wrapped in act(...)` warnings from App's mount-time AsyncStorage loads are noise, not failures.

## Pick the closest existing test and copy its harness
- **Pure logic:** a colocated `lib/*.test.ts` or `constants/*.test.ts`. Always include an `ու` case, because that's where token bugs show up.
- **Typing and input races:** `App.guessTyping.test.tsx`.
- **Whole rounds (win, loss, retry, New Game, economy):** `App.roundFlow.test.tsx`. Reuse its helpers (`submitWord`, `loseRound`, `retryByAd`, `advance`, `stored`, `keyState`, `rowDisplay` for what each cell shows incl. ghosts) and its word pinning.
- **Relaunch and crash safety (saved round, atomic writes, share bonus per platform):** `App.persistence.test.tsx`. A relaunch is `root.unmount()` + `renderApp()` over the same storage; `crashAfterWrites(n)` lets n storage writes land and drops the rest, then relaunches. Mock the platform with `jest.replaceProperty(Platform, 'OS', …)` and the share sheet with `jest.spyOn(Share, 'share')`. Kept separate from `App.roundFlow.test.tsx` because each App test leaks heap and that file is near the worker's limit.
- **Second-chance modal (entrance order, button frames, ad loading, hero):** `components/SecondChanceModal.test.tsx`.
- **One flow in isolation, relaunch-resume, retry transition:** `components/flowResume.test.tsx`. It seeds a `wordle:pending*` record in AsyncStorage and then mounts WinFlow or LossFlow inside `ThemeProvider`.

## Gotchas (each one cost real debugging time)
- **Required mocks:** `expo-font` (`useFonts` → `[true, null]`) and `react-native-safe-area-context` (its jest mock). Without them nothing renders; ResultModal needs the safe-area mock too. AsyncStorage is already mocked globally in `jest.setup.ts`; call `AsyncStorage.clear()` in `beforeEach`.
- **Hanging measurements:** RN's jest preset mocks `measureInWindow` as a no-op that never calls back, so anything that awaits `measureWindow` (WinFlow's celebration) hangs forever. Mock `./lib/measureWindow` to resolve `null`.
- **Board never renders:** react-test-renderer never fires `onLayout`, so call the board area's `onLayout` by hand.
- **Awaited timer chains:** the flows chain `await new Promise(r => setTimeout(r, ms))`. A single `advanceTimersByTime` won't cross those; step in small increments inside `act` (see `advance` in `App.roundFlow.test.tsx`).
- **Finding keys:** use `accessibilityLabel === letterLabel(token)`. Backspace is `'Ջնջել'`. Submit with `findByType(SubmitButton).props.onPress()`.
- **Secret word:** it comes from a randomly shuffled, persisted bag. Pin it like `App.roundFlow.test.tsx`: `jest.mock('./constants/playableWords.json', …)` with a small list, plus a seeded `wordle:wordBag` (`{ order, pos: 0 }`, a permutation of that list). Guesses must be in `validWords.json`.
- **App renders nothing until the bag loads:** after `TestRenderer.create(<App />)`, flush once more inside `act` before looking for the board.
- **Native-driver animations finish almost immediately in Jest:** there's no native animation module, so you can't sample a fade or flip mid-way. Assert state before it starts and after it ends; check real timing on a device.
- **`onLayout`:** when rendering `<App />`, fire every `onLayout` (as the App tests do), not just the first.
- **Theme fade:** see `lib/ThemeContext.test.tsx`. The fade is fully native-driven, so it finishes at once in Jest; that file spies `Animated.timing` to run the same timings JS-side so the midpoint flip and the busy window can be timed (and asserts the real configs are all `useNativeDriver: true`). Read a node with `(node as any).__getValue()` and compare through `normalizeColor` (themed text colors render as `rgba()` strings). The theme is two hooks: `useTheme()` and `useThemeSnapshot()` (`isDark`/`theme`).
- **Memoized components:** `findByType`/`findAllByType`/`n.type ===` must use `unmemo(X)` (`test-utils/unmemo.ts`) for any `React.memo` component (Board, Row, Tile, Keyboard, KeyboardKey, BottomControls, the flows, ShopScreen…), or they find nothing.
- **Render counts:** `App.renderCount.test.tsx` counts per-component renders through the DevTools hook (`test-utils/renderCounter.ts`, imported before anything else) and caps a keystroke and a theme toggle. Keep it green when adding props to App's children.
- **`jest.spyOn` on RN's preset mocks** (e.g. `AccessibilityInfo.isReduceMotionEnabled`) is not undone by `restoreAllMocks`; reset it in `beforeEach`.
- **Effects start animations:** in one synchronous `act(() => { update(); advanceTimers(); })` the timers run *before* the effect that starts the animation. Update and advance in separate `act` calls.
- **Ghost hints:** they render only on the active row, so after a loss (no active row) the tiles show none even though the state still holds them.
- **Dependencies and lint:** `require('react-test-renderer')` typed as `any` is the pattern (no types installed). `@testing-library/*` is not a dependency. Lint allows `require` in test files.
