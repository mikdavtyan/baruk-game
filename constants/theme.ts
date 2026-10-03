// ===========================================================================
// Design tokens — the single source of truth for all visual styling. This is
// React Native, which has no CSS custom properties, so this file *is* that
// system: one ThemeTokens object per theme, consumed everywhere via
// lib/ThemeContext.tsx's useTheme() instead of importing raw hex anywhere
// else. The header's sun/moon button switches between them.
// ===========================================================================

// 'neutral' is only for the loss result's revealed-answer tiles — a fixed,
// non-scored cream look (same in both themes, like INVALID_COLOR below),
// never produced by evaluateGuess.
export type LetterState = 'empty' | 'filled' | 'correct' | 'present' | 'absent' | 'neutral';

export type ThemeTokens = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  correct: string;
  present: string;
  absent: string;
  // Keyboard's unused ("not yet typed") keys.
  keyBackground: string;
  keyText: string;
  // 3D bottom-edge strips (see KeyboardKey.tsx / Tile.tsx's ghost-free scored
  // tiles don't need one, but keys do, and keep it once scored) — precomputed
  // per state via `darken` below, rather than derived at render time, so each
  // one is a plain static color that can be smoothly cross-faded through
  // ThemeContext's `color()` just like any other token.
  keyEdge: string; // unused ("empty") key
  correctEdge: string;
  presentEdge: string;
  absentEdge: string;
  // Tiles that haven't been submitted yet (empty or mid-typing): transparent
  // fill, just an outline. tileActiveBorder is used for every tile in the
  // row currently being typed; tileBorder for every other still-empty row.
  tileBorder: string;
  tileActiveBorder: string;
  // The letter's color while it's being typed (pre-submit) — kept separate
  // from `text` so it can run brighter than the app's general text color.
  typedLetter: string;
  // The header's icon buttons (back / theme toggle / rules) — icon color
  // only now; there's no button background any more (see Header.tsx).
  headerIconColor: string;
  // The header's score label + score number specifically (kept separate
  // from `text`/`textMuted` so light and dark can each keep their own
  // pairing here independent of what `text`/`textMuted` mean elsewhere).
  headerValueColor: string;
  // Coin counter pill.
  pill: string;
  pillText: string;
  primaryBackground: string;
  primaryText: string;
  // Submit button once the row is a full, submittable guess (5 letters) —
  // plus its own 3D bottom edge, same idea as keyEdge.
  submitOn: string;
  submitOnEdge: string;
  // The end-of-round result card (see ResultModal.tsx) — a dark,
  // gradient-filled card in BOTH themes, plus a 3D bottom edge like the
  // game's keys/buttons. The gradient itself can't run through `color()`
  // (no Animated support for a native LinearGradient's `colors` prop), so
  // it's read as a plain snapshot from `theme` and just snaps on a theme
  // toggle, same as e.g. icon tintColors.
  cardGradientStart: string;
  cardGradientEnd: string;
  cardBorder: string;
  cardEdge: string;
  cardText: string;
  cardTextMuted: string;
  cardTileFill: string;
  cardTileBorder: string;
  // The popup (PopupModal.tsx — "How to play"): its own light panel in the
  // light theme and dark panel in the dark theme, with a 3D
  // bottom edge like the game's keys/buttons. The rules' example rows'
  // neutral tiles (RulesCard.tsx) are solid fills in the panel's palette —
  // deliberately NOT the real board's (transparent) unsubmitted tiles.
  popupSurface: string;
  popupBorder: string;
  popupEdge: string;
  popupText: string;
  popupTextMuted: string;
  popupDivider: string;
  popupBadgeBg: string;
  popupBadgeText: string;
  popupTileFill: string;
  popupTileBorder: string;
  popupTileText: string;
  // The gold coin's own drop shadow (see Coin.tsx) — a fixed warm shadow in
  // both themes since the coin's own colors never change.
  coinShadow: string;
};

// Darkens a '#RRGGBB' color by `factor` (0–1; 1 = unchanged, 0 = black) —
// used to derive a state color's own 3D bottom-edge shade (keys, submit
// button) instead of hand-picking a separate edge color per state. 0.71
// matches the dark theme's own explicit correct/edge pair (#70B400 →
// #4F8000), so every derived edge stays visually consistent with that one.
export function darken(hex: string, factor = 0.71): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const lightCorrect = '#4A9D5B';
const lightPresent = '#E8A33D';
const lightAbsent = '#878580';
const lightPrimaryBackground = '#1F2328';

export const lightTheme: ThemeTokens = {
  background: '#F7F5F0',
  surface: '#FFFFFF',
  border: '#DDD9D0',
  text: '#1F2328',
  textMuted: '#6B6963',
  correct: lightCorrect,
  present: lightPresent,
  absent: lightAbsent,
  keyBackground: '#E6E3DC',
  keyText: '#1F2328',
  keyEdge: '#DDD9D0', // = border — already the right "slightly darker than keyBackground" neutral
  correctEdge: darken(lightCorrect),
  presentEdge: darken(lightPresent),
  absentEdge: darken(lightAbsent),
  tileBorder: '#DDD9D0', // = border, unchanged from the app's existing default tile border
  tileActiveBorder: '#1F2328', // = text, unchanged from the app's existing active-cell border
  typedLetter: '#1F2328', // = text, unchanged
  headerIconColor: '#1F2328', // = text, unchanged
  headerValueColor: '#1F2328', // = text, unchanged
  pill: '#E6E3DC', // = keyBackground, unchanged
  pillText: '#1F2328', // = text, unchanged
  primaryBackground: lightPrimaryBackground,
  primaryText: '#FFFFFF',
  submitOn: lightPrimaryBackground, // light keeps its existing submit-ready look
  submitOnEdge: darken(lightPrimaryBackground), // light had no 3D edge before, this is new
  cardGradientStart: '#34312C',
  cardGradientEnd: '#2A2724',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardEdge: '#1A1816',
  cardText: '#FFFFFF',
  cardTextMuted: '#BDB6AA',
  cardTileFill: '#3A3631',
  cardTileBorder: '#4A4640',
  popupSurface: '#FFFFFF', // = surface
  popupBorder: '#DDD9D0', // = border
  popupEdge: '#DDD9D0', // = keyEdge
  popupText: '#1F2328', // = text
  popupTextMuted: '#6B6963', // = textMuted
  popupDivider: '#E6E3DC', // = keyBackground
  popupBadgeBg: '#1F2328', // = text
  popupBadgeText: '#FFFFFF',
  popupTileFill: '#F7F5F0', // = background
  popupTileBorder: '#DDD9D0', // = border
  popupTileText: '#1F2328', // = typedLetter
  coinShadow: 'rgba(110,60,0,0.35)',
};

// Every value below (except where noted) is from the chat-provided dark
// palette: keyBackground/keyText are a light chip that stays constant
// whether a key has been used or not, while absent is its own dark charcoal
// — clearly different from both. Tile.tsx reads the same `absent` token, so
// the gameboard's wrong-letter tiles automatically match the keyboard's
// wrong-letter keys.
const darkCorrect = '#70B400';
const darkPresent = '#D6A500';
const darkAbsent = '#3B3B3B';

export const darkTheme: ThemeTokens = {
  background: '#2A2A2A',
  surface: '#1C1F22',
  border: '#33373B',
  text: '#EDEDED',
  textMuted: '#807F87',
  correct: darkCorrect,
  present: darkPresent,
  absent: darkAbsent,
  keyBackground: '#6A6D6E',
  keyText: '#FFFFFF',
  keyEdge: '#C0BCCC',
  correctEdge: darken(darkCorrect), // = #4F8000, matches the chat-provided submit-on-edge exactly
  presentEdge: darken(darkPresent),
  absentEdge: darken(darkAbsent),
  tileBorder: '#807F87',
  tileActiveBorder: '#FFFFFF',
  typedLetter: '#FFFFFF',
  headerIconColor: '#807F87',
  headerValueColor: '#807F87',
  pill: '#2F3138',
  pillText: '#FFFFFF',
  primaryBackground: '#EDEDED',
  primaryText: '#121416',
  submitOn: darkCorrect,
  submitOnEdge: darken(darkCorrect),
  cardGradientStart: '#252A2F',
  cardGradientEnd: '#1D2125',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardEdge: '#0A0B0C',
  cardText: '#EDEDED', // = text, unchanged
  cardTextMuted: '#807F87', // = textMuted, unchanged
  cardTileFill: '#16191C',
  cardTileBorder: '#33383D',
  popupSurface: '#1C1F22', // = surface
  popupBorder: '#33373B', // = border
  popupEdge: '#0A0B0C', // = cardEdge
  popupText: '#EDEDED', // = text
  popupTextMuted: '#9A99A1', // a step lighter than textMuted, for body text on the panel
  popupDivider: '#2A2E33',
  popupBadgeBg: '#EDEDED', // = primaryBackground
  popupBadgeText: '#121416', // = primaryText
  popupTileFill: '#16191C', // = cardTileFill
  popupTileBorder: '#33383D', // = cardTileBorder
  popupTileText: '#FFFFFF', // = typedLetter
  coinShadow: 'rgba(0,0,0,0.55)',
};

// Real theme switching (the header's sun/moon button) is wired up via
// lib/ThemeContext.tsx's ThemeProvider/useTheme, which picks between
// lightTheme/darkTheme and is what every component actually renders with.
// This `theme` constant is now only a light-mode fallback for the couple of
// module-scope, non-reactive spots that can't call useTheme() (e.g. default
// prop values) — components rendering real UI should use useTheme(), not this.
export const theme: ThemeTokens = lightTheme;

// Deliberate, single exception to "only feedback colors are colorful": the
// submit button's third state — a complete guess that isn't a real
// dictionary word — needs a distinct alert color, not the same neutral
// treatment as merely-incomplete. Not part of ThemeTokens (used nowhere
// else, same value in both themes). Darkened slightly from the app's
// previous red (#E0483F, 4.06:1) so white text clears WCAG AA (4.5:1).
// Same value in both themes, so its 3D edge doesn't need to be a themed,
// cross-fadable token either — just a plain precomputed constant.
export const INVALID_COLOR = '#DC3026';
export const INVALID_EDGE_COLOR = darken(INVALID_COLOR);

// The loss result's revealed-answer tiles (LetterState 'neutral' above) — a
// fixed cream look, same in both themes, since this reveal isn't "scored"
// like a real guess.
export const NEUTRAL_TILE_BG = '#F7F5F0';
export const NEUTRAL_TILE_EDGE = '#D9D3C7';
export const NEUTRAL_TILE_TEXT = '#1F2328';

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
// Single bundled font for the entire app — tiles, header, buttons, modal
// title and body text. GHEA Grapalat, bundled at assets/fonts/GHEAGrapalat-
// Bold.otf. Only its Bold (700) weight is bundled, as a static (non-variable)
// .otf, so there is no 600 or 400/500 weight file to select — every token
// below currently resolves to the same physical 700 face. See chat for the
// full report; this is a placeholder for when/if lighter weight files are
// added, not a working weight scale today.
export const FONT_FAMILY = 'GHEAGrapalat-Bold';

export const FONTS = {
  tile: FONT_FAMILY, // board tiles & keyboard keys — nominally 700
  title: FONT_FAMILY, // buttons, headers, modal titles — nominally 600 (renders as 700, the only weight bundled)
  body: FONT_FAMILY, // body/message text — nominally 400–500 (renders as 700, the only weight bundled)
};

// Line height = the font's ascent + descent, so text is laid out the same on
// iOS and Android (with includeFontPadding: false). GHEA Grapalat: ascent
// 1.063em, descent 0.265em; its 0.765em capitals sit within 0.02em of the
// line's center, so no vertical shift is needed. Now used for all text, not
// just tile/key letters (renamed from LETTER_LINE_HEIGHT_EM accordingly).
export const FONT_LINE_HEIGHT_EM = 1.328;

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

// Tile reveal (flip) timing. Each tile flips for TILE_FLIP_DURATION_MS and
// starts TILE_REVEAL_STAGGER_MS after the tile to its left.
export const TILE_FLIP_DURATION_MS = 500;
export const TILE_REVEAL_STAGGER_MS = 100;
export const ROW_REVEAL_DURATION_MS = TILE_FLIP_DURATION_MS + TILE_REVEAL_STAGGER_MS * (WORD_LENGTH - 1);

// Keyboard key background color fade, run for all of a row's keys at once
// after the row's tile reveal has fully finished.
export const KEY_COLOR_FADE_MS = 150;

// The small pop of a freshly typed letter (see Tile.tsx). Deleting has no
// animation at all.
export const TOKEN_POP_SCALE = 1.1; // peak scale of a freshly-typed letter's little pop
export const TOKEN_POP_DURATION_MS = 90; // time to reach TOKEN_POP_SCALE; settles back via a spring

// Darts (bow & arrow) power-up — see components/ArrowOverlay.tsx / BowIcon.tsx.
// One arrow per eliminated letter (up to ARROW_COUNT), fired in sequence.
export const ARROW_COUNT = 3;
export const ARROW_STAGGER_MS = 250; // gap between each shot's launch
export const ARROW_LAUNCH_GROW_MS = 100; // arrow grows in (scale/opacity) as it leaves the bow
export const ARROW_FLIGHT_DURATION_MS = 600; // bow -> key, along the curved path
export const ICON_RECOIL_MS = 150; // bow icon recoils and springs back on each shot
export const KEY_IMPACT_BOUNCE_MS = 180; // hit key moves down + squashes, springs back
export const KEY_IMPACT_COLOR_MS = 250; // hit key's color fade to absent, starting on impact
export const PARTICLE_BURST_COUNT = 6;
export const PARTICLE_FADE_MS = 300;
export const ARROW_QUIVER_MS = 300; // stuck arrow quivers at the impact point
export const ARROW_STUCK_FADE_MS = 200; // then fades out
export const ICON_RELOAD_MS = 200; // bow's little reload flourish once the volley is done
export const ARROW_VISUAL_LENGTH = 44; // px, the flying arrow sprite's rendered length
export const REDUCED_MOTION_ARROW_STAGGER_MS = 150; // prefers-reduced-motion: keys just fade, staggered

// How long App.tsx keeps the invalid-word shake flag set (the losing row has
// its own LOSS_SHAKE_DURATION_MS). Row.tsx's shake itself is 5 x 45ms.
export const ROW_SHAKE_DURATION_MS = 260;

// The white shine that sweeps once across a ghost-letter tile when its row
// becomes the active one (see Tile.tsx).
export const TILE_SHINE_DURATION_MS = 450;

// The light/dark switch (lib/ThemeContext.tsx): every themed color fades in
// place over this long, eased in-out; the plain `theme` snapshot flips at the
// midpoint. Kept short on purpose — see docs/adr/0004.
export const THEME_FADE_MS = 300;

// Short game toasts (e.g. "no hint left") over the top of the board.
export const TOAST_FADE_MS = 180;
export const TOAST_HOLD_MS = 1600;

// Keyboard key 3D press feedback (see KeyboardKey.tsx / Button3D.tsx): normal
// resting edge height vs. the shrunk edge shown while a key is actively
// pressed down. The edge is a plain colored View sitting behind the face
// (never an animated borderBottomWidth — that style property can't run on
// the native driver and must never be mixed with a native-driven transform
// on the same node), so "pressed" is just the face's translateY sliding down
// by (KEY_EDGE_HEIGHT - KEY_EDGE_PRESSED_HEIGHT), uncovering less of the edge
// beneath it.
export const KEY_EDGE_HEIGHT = 4;
export const KEY_EDGE_PRESSED_HEIGHT = 1;
export const KEY_PRESS_MOVE_DISTANCE = KEY_EDGE_HEIGHT - KEY_EDGE_PRESSED_HEIGHT; // px the key face moves down while held
export const KEY_PRESS_DURATION_MS = 80;

// The game header's fixed height — shared with any full-screen overlay
// (e.g. ResultModal) that needs its own top row of controls to land at
// exactly the same height as the real header's buttons.
export const HEADER_HEIGHT = 60;

// Full pages pushed in over the game (PushPage.tsx — the shop): an iOS-style
// push from the right, the game sliding a little left under a dim. Reduced
// motion: no movement, the page just fades in.
export const PAGE_OPEN_MS = 280;
export const PAGE_CLOSE_MS = 240;
// The game screen's own subtle parallax slide while a page is open.
export const PAGE_GAME_PARALLAX_FRACTION = 0.25;
export const PAGE_REDUCED_MOTION_MS = 150;
// The page's iOS-only edge-swipe-to-go-back (Android has its back button).
export const PAGE_SWIPE_EDGE_ZONE = 24; // px from the left edge a drag must start within
export const PAGE_SWIPE_DIRECTION_LOCK_PX = 10; // movement needed before committing to a direction
export const PAGE_SWIPE_DIRECTION_RATIO = 1.2; // |dx| must exceed |dy| * this to count as horizontal
export const PAGE_SWIPE_COMPLETE_PROGRESS = 0.35;
export const PAGE_SWIPE_COMPLETE_VELOCITY = 0.5; // px/ms
export const PAGE_SWIPE_CANCEL_VELOCITY = -0.3; // px/ms, moving back left
export const PAGE_SWIPE_MIN_VELOCITY = 1.2; // px/ms, floor used only for the completion duration formula
export const PAGE_SWIPE_COMPLETE_MIN_MS = 120;
export const PAGE_SWIPE_COMPLETE_MAX_MS = 240;
export const PAGE_SWIPE_CANCEL_DURATION_MS = 200;

// The popup (PopupModal.tsx — "How to play"): fades in while scaling up from
// POPUP_START_SCALE, and back out on close. Reduced motion: a plain short
// fade, no scale.
export const POPUP_OPEN_MS = 260;
export const POPUP_CLOSE_MS = 200;
export const POPUP_START_SCALE = 0.94;
export const POPUP_REDUCED_MOTION_MS = 150;
// The popup's 3 example tiles flip once, this far apart, right after it
// finishes opening.
export const RULES_TILE_REVEAL_STAGGER_MS = 150;

