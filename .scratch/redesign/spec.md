# Baruk redesign — master prompt

Status: ready-for-agent

> Paste this whole file into a fresh session as the prompt (or say "implement `.scratch/redesign/spec.md`").
> Visual reference: `.scratch/redesign/prototype.html` (open it in a browser; also published at https://claude.ai/artifact/4HHexjVfyHhFRiUoYfDhXd). Every decision below was agreed with the owner on 2026-10-12. Don't re-open them.

## Your task

Redesign Baruk's look and motion to match the prototype, **without changing how the game plays**. Do it in one session, in the six steps below, **without pausing for approval**. After each step, `npm run typecheck`, `npm test` and `npm run lint` (0 warnings) must pass. Then make **one commit per step** on a branch `redesign` (create it from `main` first), with repo-style messages ("Theme: …", "Icons: …"). If a step can't fully land, commit what passes, write what's left under `## Comments` at the bottom of this file, and keep going.

Before anything, load the project skills `wordle-ui`, `wordle-game-logic`, `wordle-win-loss` and `wordle-testing`. They hold the rules this work must respect: the native-driver-only animation rules, the render-count test, coupled timings, reduced motion, `measureWindow` overlays, and the Redmi `display: none` / build-nodes-once safety rules. Sub-agents don't see skills, so paste the relevant sections into any sub-agent prompt.

**Performance bar:** a **Redmi 10C in Expo Go**. Every animation runs on the native/UI thread (transform, opacity, colors). No per-frame `setState`, no animated blur, no big animated shadows. Every new motion has a reduced-motion path.

## What must NOT change

- **The Classic game's behavior.** Board, typing, the keyboard's whole input model (touch-down surface, multi-touch, Backspace repeat, hit-testing, geometry), the `ու` token, evaluation, Hint and Darts logic, retries, word bag, persistence and resume all stay. **The Hint flight and the bow/arrow (Darts) animations keep their exact choreography and timings.** Only their drawings and colors change.
- **The bottom ԸՆԴՈՒՆԵԼ button and its "not a word" state.** Same three states and same behavior. New colors only. The ready state must not be red, so the red "not a word" state stays unmistakable. Use `correct` green for ready.
- **Win/loss flow steps and economy.** Same step machines, modals, order, coins, points, streak, retries and share. They get new colors and new animations only (step 5).
- **Navigation:** the tabs + push pages model. The game page still **slides in from the right**, with the iOS edge swipe-back.
- Home's two mode cards (ԴԱՍԱԿԱՆ, ՕՐՎԱ ԲԱՌ) stay where they are and keep what they do. ՕՐՎԱ ԲԱՌ still shows ՇՈՒՏՈՎ. Leave room below them: the owner will add things there later.
- The Leaderboard tab stays an empty page with its title. Don't add fake players.
- **Never use emoji anywhere in the UI.** Use only drawn SVG icons.

## Palette (put into `ThemeTokens` in `constants/theme.ts`)

Map these onto the existing tokens and derive the edges like today. Add tokens only where needed (e.g. `accent`, `raised`), in both themes. Game-art colors (coin gold, confetti, avatars, icons) stay fixed literals, the same in both themes.

| Role | Dark: "pomegranate night" (default look) | Light: "apricot" |
|---|---|---|
| background | `#170B26` (+ top glow `#2A1142`) | `#FFF1E2` (+ top glow `#FFD9B8`) |
| surface / card | `#25133A` | `#FFFFFF` |
| raised (chips, inner fills) | `#33204B` | `#FFE6CC` |
| border / line | `#45305F` | `#F0D2B4` |
| text / muted | `#F7EEFF` / `#A994C6` | `#2B1638` / `#8B6B84` |
| correct / edge | `#2FBF7A` / `#1A7A4C` | `#27AE68` / `#16774A` |
| present / edge | `#F5A524` / `#A5680B` | `#F29A12` / `#A86509` |
| absent / edge | `#45355A` / `#2C2140` | `#A897B3` / `#7B6A87` |
| key / key edge / key text | `#4A3766` / `#2B1D3F` / `#F7EEFF` | `#FFFFFF` / `#E8C6A6` / `#2B1638` |
| tile border / active border | `#5A4478` / `#C9B3EA` | `#EBC9A8` / `#7A5470` |
| accent (pomegranate) / edge | `#E8405F` / `#93203A` | `#DD3452` / `#9A1C35` |

Yellow/gold still means only "wrong position". Keep tile letters readable on `present` in both themes (check contrast; adjust the fill a little if needed). The background is a soft radial glow at the top on every screen. **Home only** also gets the moving ornament and drifting tiles (step 3). The Classic page gets the glow only.

**Font:** bundle **Noto Serif Armenian** (OFL; ExtraBold/Black `.ttf` in `assets/fonts/`, loaded through `expo-font` like GHEA Grapalat) as a new `FONTS.display`. Use it for the Home logo tiles, page titles and praise words. Everything else, including board tiles and keys, stays GHEA Grapalat Bold.

## Step 1 — Colors and the circle-reveal theme switch

1. Apply the palette in both themes and restyle every screen's colors through tokens: Classic page, header, board, keys, BottomControls, popups, Shop, Tasks, Settings, Profile, the wheel page and the flows' cards. **No layout or behavior changes in Classic.**
2. **Replace the theme fade with the prototype's circle reveal.** The new theme spreads in a growing circle from the pressed control: the Settings ՄՈՒԳ ԹԵՄԱ switch or the sun/moon button in the game header, which must stay. It takes about 650 ms with ease-out (`cubic-bezier(.22,1,.36,1)` feel) and must be fully smooth on the Redmi. Suggested approach, all Expo Go compatible:
   1. Snapshot the root view (`@shopify/react-native-skia` `makeImageFromView`, or `react-native-view-shot`).
   2. Mount a full-window Skia canvas showing that snapshot.
   3. Switch the theme **instantly** underneath (`setDarkInstant`).
   4. Animate a growing circular **hole** in the snapshot (clip with a circle difference) on the UI thread with a Reanimated shared value. Reanimated 4 is installed; this is an allowed, documented exception to "Animated only".
   5. Unmount the canvas when done.

   Details:
   - The origin comes from `measureWindow` on the pressed control; `null` → reveal from the screen center.
   - Taps mid-reveal are ignored, the theme choice still saves (`wordle:darkMode`), and the status bar flips.
   - Reduced motion → instant switch.

   Install with `npx expo install`. Remove the dead fade machinery (`THEME_FADE_MS` halves, `TEXT_COLOR_NATIVE`) only if nothing else needs it. Write an ADR in `docs/adr/` that supersedes the fade decisions of 0004/0005 (keep the split context from 0005 if it's still useful), and update the `wordle-ui` skill's theme section.

## Step 2 — One new icon set (sub-agent in parallel; see "Order and parallelism")

Redraw **every** custom icon as one matching set, in the prototype's style, which follows `design-system.md`:
- a 64-unit viewBox
- a darker silhouette copy offset down-left for depth
- cheerful gradients
- one thick rounded brown outline `#6B3A0A`
- a soft white highlight on the upper left

They're fixed game-art colors but must look **beautiful on both the plum and the apricot grounds**: check each at 26–36 px on both.

The set:
- Tab icons: shop cart, tasks, home, podium, settings gear
- Coin
- Streak flame, in three tiers (see step 3)
- Hint (lightbulb)
- Bow and arrow
- Shop pack items (Hint packs, Darts packs)
- Power-up buttons
- **The fortune wheel: make it the best icon in the app.** Rich wedges, a glossy rim with studs, a pointer, depth. It keeps its `layer` split (`base` / `wheel` / `top`) so only the wheel body spins.

**Bow and Hint:** new drawings, but **keep each component's props, structure and every animated part** (string, arrow, glow, etc.), so `BowIcon`, `ArrowOverlay`, `HintFlightOverlay` and the coupled timings are untouched. Replace any remaining `expo-symbols` glyphs that read as generic UI icons in game areas where a drawn icon fits. Small utility glyphs (back arrow, X) may stay.

## Step 3 — Home

Match the prototype's Home:
- **Background (Home only):** a slowly rotating Armenian eight-pointed star rosette in gold at about 13% opacity (one native rotate loop, ~90 s per turn), plus the existing drifting letter tiles restyled to the new palette. Keep `MenuBackground`'s rules: pre-mounted, transform only, pause when off screen or the app is inactive, no group opacity.
- **Logo:** the five tiles Բ Ա Ռ ՈՒ Կ in `FONTS.display`. They drop in with a spring and stagger the first time Home appears per launch, then gently float in a staggered wave. Under the logo, the tagline ԲԱՌԵՐԻ ԽԱՂ fades in.
- **Streak chip** under the logo, using the real `streak.current`:
  - a pomegranate-tinted pill with a soft glow, showing the flickering cartoon flame and "N ՕՐ ԱՆԸՆԴՄԵՋ"
  - the number pops (counts up with a scale bump) when the streak grew since Home was last seen
  - flame tiers: small at 1–2 days, bigger at 7+, gold/purple at 30+
  - hidden or a calm "start" state at 0; your call, keep it tasteful
- **ԴԱՍԱԿԱՆ card:** the green gradient card with the play icon, a shine sweep every few seconds (reuse `ShineSweep`) and a gently nudging play arrow. Same position, same subtitle logic.
- **ՕՐՎԱ ԲԱՌ card:** surface card with a drawn lock icon and ՇՈՒՏՈՎ. Same position and toast behavior.
- **Wheel button:** keep it in its own right-aligned row under the coin pill, never overlapping the logo (push the hero down if needed). Use the prototype's motion: a periodic quick spin overshooting then settling, plus the bobbing ՊՏՏԻ՛Ր badge. Keep the existing pause rules.
- Cards rise in with a spring on first appearance.

## Step 4 — Tab bar and tabs

- **Floating tab bar:** inset from the screen edges, rounded about 26, a surface color with a line border and a soft shadow. Use a static `BlurView` on iOS only; Android gets a near-opaque surface, no blur.
- **Bubble:** a raised plate slides between tabs with a spring (one native value for the index → translateX).
- **Active tab:** the icon lifts and scales with a little wiggle, the label appears (same label rules as today), and inactive icons are slightly desaturated.
- The Tasks badge dot pulses.
- Tab content gets bottom padding for the floating bar.
- Keep every rule from the skill: `display: none` when inactive, memoization, accessibility.
- **Tab entrances:** each time a tab is shown, its cards rise in with a staggered spring.
  - Tasks progress bars fill with a stripe shimmer, using a **`scaleX` transform, not width**.
  - The ՍՏԱՆԱԼ button pulses while claimable.
  - Settings switches spring their knob.
  - Shop packs pop in.
- **Press feeling:** add one shared pressable-scale wrapper. Big buttons and cards (mode cards, shop packs, task claim, Settings rows, modal buttons) scale to about 0.96 while pressed and spring back (native). Don't apply it to small text links, and don't touch the keyboard.

## Step 5 — Win and loss: new colors, new animations, same steps

Some of these exist today (e.g. the celebration tile jump, the praise pop). Upgrade them, don't duplicate them.

**Win:**
1. The winning row's tiles jump in a wave.
2. The praise word (in `FONTS.display`) gets a moving gold → pomegranate shine. Use a native-driven translate of a gradient behind a text mask, or a sweep; no per-frame JS.
3. The modals spring up from the bottom with a bounce.
4. The result card's answer tiles pop in one by one.

Confetti and coin flights stay.

**Loss:**
1. The answer tiles flip one by one to reveal the word.
2. Then a gentle "sad" settle: the tiles drop slightly and dim. Nothing harsh, no confetti.

If any timing changes, update the coupled `setTimeout` sums in `App.tsx` and the flow constants in `constants/winFlow.ts`, and keep the flow and resume tests green.

## Step 6 — Sounds and haptics (sub-agent in parallel for the sound assets)

- **Haptics** (through `lib/haptics.ts`, gated by ԹՐԹՌՈՑ): add a celebration pattern on a win and a soft bump on a loss. No haptic per tile flip.
- **Sounds:**
  - Install `expo-audio` with `npx expo install`.
  - Add `lib/sounds.ts` mirroring `lib/haptics.ts`: an enabled flag persisted as `wordle:sounds`, **default on**, loaded before the first render.
  - Add a **ՁԱՅՆԵՐ** switch in Settings' ԽԱՂ section.
  - Use a quiet master volume (about 0.4). Respect the iPhone silent switch (don't play in silent mode).
  - Preload everything, and pool the key-tap player so fast typing never lags or drops input.
  - Sound fails silently (`.catch`), like haptics.
- **Character:**
  - Bubbly and playful for typing (soft pop), the tile flip, invalid shake, coins landing, tab switch, task claim and buttons.
  - The **win jingle is a short duduk or kanon phrase**, Baruk's signature.
  - The loss sound is soft and short.
- **Sources:** free-to-use sounds that are allowed in a commercial app (e.g. Kenney CC0 packs, Pixabay content license, Freesound CC0). Put them in `assets/sounds/` and list each file's source, author and license in `assets/sounds/CREDITS.md`. Keep files small (short `.mp3`/`.m4a`). If no fitting duduk/kanon clip can be found, use the best placeholder and say so in `## Comments`. The owner will replace sounds later, so keep the mapping in one place.
- Add tests for the switch persistence, and make sure the render-count test still passes.

## Order and parallelism

1. **Before any code:** create the `redesign` branch.
2. **In parallel:** spawn two sub-agents in their own worktrees:
   - the **icon set** (step 2), touching only icon components
   - the **sound assets** (finding, downloading and trimming files + `CREDITS.md`; no app code)

   Give each the rules it needs from the skills.
3. **Meanwhile:** do step 1 yourself.
4. Merge the icons in as the step 2 commit.
5. Do steps 3, 4 and 5.
6. Do step 6, using the sound assets the sub-agent collected.

**Verification per step:** typecheck, tests, lint at 0 warnings, then commit. At the end:
- run the app once if you can, and check light and dark themes, Home, a full round (win and loss), every tab, and the theme switch from both controls
- update the `wordle-ui` / `wordle-win-loss` skills and `CONTEXT.md` where conventions changed (fonts, sounds, theme switch, press wrapper, tab bar)

## Out of scope (later, don't build)

The splash screen (the owner has an idea), a new app icon, holiday themes, a stats popup, the streak week calendar popup, the word-of-the-day mode, leaderboard content.

## Comments

All six steps landed on `redesign`, one commit each (89df8bc theme, a64c9ba icons, f171145 Home, b0037d4 tabs, 1d60c41 flows, 58d07b7 sounds, plus a docs commit). Typecheck, all tests (302) and lint (0 warnings) pass after every step. Left over, or worth knowing:

- **Not run on a device.** This machine has no emulator or device, so nothing was checked by eye or ear. Please check on the Redmi 10C in Expo Go: the circle reveal (Skia `makeImageFromView` on Android), the praise word's masked shine (MaskedView on Android), the iOS tab-bar blur, both themes on every screen, a full win and loss, and every tab.
- **Present color:** deepened a little (dark `#E9961C`, light `#E08B12`) so the white letter stays about as readable as on green. Edges are the spec's.
- **Result cards** (reward, result, second chance) stay a deep plum in the light theme too. Their art and light text are drawn for a dark card.
- **Tasks progress:** the fill is a full-width bar translated in from the left inside the clipped track, rather than `scaleX`. It's still a native transform and never a width animation, but this way the stripes don't get squashed.
- **Inactive tab icons** are washed out with opacity, because React Native has no saturation filter.
- **Streak chip:** invisible at 0 days but keeps its space, so the cards don't jump when a streak starts.
- **Sounds:** all CC0 (`assets/sounds/CREDITS.md`). The win jingle is built from single-note kanun and duduk recordings, not taken from a performance. A CC0 clip of both instruments playing together, which might be better, is muri_kuri's "duduk, kanun. loop.wav" (Freesound #690455). Nothing was checked by ear. On players that ignore the MP3 gapless header, the key tap may start about 25 ms late; check this on a device.
- **Status (2026-10-16):** `redesign` is pushed but not merged into `main`; merge it after the device checks above. For the later app icon, the owner liked an Armenian Բ on green.
