# hy-wordle — ԲԱՌԲԱՅԹ, an Armenian Wordle

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict. One screen, no router, no backend, no auth.
`index.ts` → `App.tsx` (`AppInner` owns all game state) → `components/` (presentational, plus the two end-of-round orchestrators `WinFlow`/`LossFlow`). Pure logic in `lib/`, tunables in `constants/`. The only persistence is AsyncStorage, through `lib/gameStorage.ts`.

Expo-specific rules (`npx expo install`, versioned docs, never hand-edit `ios/`/`android/`) are in `AGENTS.md`.

Before investigating, planning or editing anything, load the matching project skill (more than one if the task spans areas). Do this before exploring or delegating: the skills replace most exploration, and sub-agents don't see them.
- gameplay, guesses, the `ու` token, word lists, keyboard colors, Hint/Darts, `App.tsx` state → `wordle-game-logic`
- colors/theme, animation, layout, fonts, icons, any component styling → `wordle-ui`
- win/loss screens, coins/points/streak, retries, share, anything persisted or resumed → `wordle-win-loss`
- writing, fixing or running tests → `wordle-testing`

Done means `npm run typecheck`, `npm test` and `npm run lint` all pass. Lint must stay at 0 warnings. Use `npm run lint`, not bare `npx expo lint`, which skips `App.tsx`, `lib/` and `constants/`.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/` (no remote tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
