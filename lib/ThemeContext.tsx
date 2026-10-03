import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { darkTheme, lightTheme, TEXT_COLOR_NATIVE, THEME_FADE_MS, ThemeTokens } from '../constants/theme';

// lightTheme/darkTheme (constants/theme.ts) are the design tokens. A theme
// toggle fades every themed color in place (docs/adr/0004), with NO JS work per
// frame (docs/adr/0005):
// - `color(key)` (View colors) and `textColor(key)` (Text colors) are one
//   shared interpolation per token of `progress`, which animates on the NATIVE
//   driver. With TEXT_COLOR_NATIVE false, text colors instead come from
//   `textProgress`, set once at the midpoint (a single switch, no per-frame work).
// - Everything that can't animate (icon tints, the status bar, gradients,
//   PNGs, text shadows…) reads the plain `theme`/`isDark` snapshot, which flips
//   once, at the fade's midpoint.
// Two contexts, so that midpoint flip re-renders only the snapshot's readers:
// `useTheme()` is the stable part (color, textColor, toggleTheme,
// reduceMotion, currentTheme — never changes on a toggle); `useThemeSnapshot()`
// is `{ theme, isDark }`. Read the snapshot only in small leaf components.
// The fade runs as two halves — ease-in to 0.5, ease-out to the end, which
// together are exactly Easing.inOut(Easing.quad) — and the snapshot flips in
// the callback between them, not on a timer. Taps mid-fade are ignored;
// reduced motion switches instantly. Nothing is remounted.

export type ColorFn = (key: keyof ThemeTokens) => Animated.AnimatedInterpolation<string>;

type ThemeColorsValue = {
  toggleTheme: () => void;
  color: ColorFn; // View colors (native driver)
  textColor: ColorFn; // Text colors (native driver, or a midpoint switch — TEXT_COLOR_NATIVE)
  reduceMotion: boolean;
  // The current snapshot WITHOUT subscribing to it — for render-time logic
  // that runs anyway for another reason (e.g. a key's own state-change fade).
  currentTheme: () => ThemeTokens;
};

type ThemeSnapshotValue = {
  theme: ThemeTokens; // plain snapshot — flips at the fade's midpoint
  isDark: boolean; // flips with `theme`
};

const ThemeColorsContext = createContext<ThemeColorsValue | null>(null);
const ThemeSnapshotContext = createContext<ThemeSnapshotValue | null>(null);

const TOKEN_KEYS = Object.keys(lightTheme) as (keyof ThemeTokens)[];

// One interpolation node per token, created once and shared by every view.
function interpolations(progress: Animated.Value) {
  const nodes = {} as Record<keyof ThemeTokens, Animated.AnimatedInterpolation<string>>;
  for (const key of TOKEN_KEYS) {
    nodes[key] = progress.interpolate({ inputRange: [0, 1], outputRange: [lightTheme[key], darkTheme[key]] });
  }
  return nodes;
}

// Defaults to light. Only the header's moon/sun button flips it.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0)); // 0 = light, 1 = dark — native-driven
  const [textProgress] = useState(() => new Animated.Value(0)); // only used with TEXT_COLOR_NATIVE false
  const [viewNodes] = useState(() => interpolations(progress));
  const [textNodes] = useState(() => (TEXT_COLOR_NATIVE ? viewNodes : interpolations(textProgress)));
  // Where the current/last fade is heading (1 = dark), and whether one runs.
  const targetRef = useRef(0);
  const busyRef = useRef(false);
  const snapshotRef = useRef<ThemeTokens>(lightTheme);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => setReduceMotion(v));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const flipSnapshot = (dark: boolean) => {
    snapshotRef.current = dark ? darkTheme : lightTheme;
    setIsDark(dark);
  };

  const toggleTheme = useCallback(() => {
    if (busyRef.current) return;
    const to = targetRef.current === 1 ? 0 : 1;
    targetRef.current = to;
    if (reduceMotion) {
      progress.setValue(to);
      textProgress.setValue(to);
      flipSnapshot(to === 1);
      return;
    }
    busyRef.current = true;
    const half = (toValue: number, easing: (t: number) => number) =>
      Animated.timing(progress, { toValue, duration: THEME_FADE_MS / 2, easing, useNativeDriver: true });
    half(0.5, Easing.in(Easing.quad)).start(() => {
      if (!TEXT_COLOR_NATIVE) textProgress.setValue(to); // text colors' one switch
      flipSnapshot(to === 1); // the snapshot's one switch, mid-fade
      half(to, Easing.out(Easing.quad)).start(() => {
        // Pin the end state, so the JS side of the native-driven value never
        // lags behind what's on screen (a later re-render reads it).
        progress.setValue(to);
        textProgress.setValue(to);
        busyRef.current = false;
      });
    });
  }, [reduceMotion, progress, textProgress]);

  const color = useCallback<ColorFn>((key) => viewNodes[key], [viewNodes]);
  const textColor = useCallback<ColorFn>((key) => textNodes[key], [textNodes]);
  const currentTheme = useCallback(() => snapshotRef.current, []);

  const colors = useMemo<ThemeColorsValue>(
    () => ({ toggleTheme, color, textColor, reduceMotion, currentTheme }),
    [toggleTheme, color, textColor, reduceMotion, currentTheme],
  );
  const snapshot = useMemo<ThemeSnapshotValue>(() => ({ theme: isDark ? darkTheme : lightTheme, isDark }), [isDark]);
  return (
    <ThemeColorsContext.Provider value={colors}>
      <ThemeSnapshotContext.Provider value={snapshot}>{children}</ThemeSnapshotContext.Provider>
    </ThemeColorsContext.Provider>
  );
}

// The stable part — color/textColor/toggleTheme/reduceMotion/currentTheme. A
// theme toggle never re-renders its readers.
export function useTheme(): ThemeColorsValue {
  const ctx = useContext(ThemeColorsContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

// The `{ theme, isDark }` snapshot — its readers re-render at every toggle's
// midpoint, so keep them small leaf components.
export function useThemeSnapshot(): ThemeSnapshotValue {
  const ctx = useContext(ThemeSnapshotContext);
  if (!ctx) throw new Error('useThemeSnapshot must be used within a ThemeProvider');
  return ctx;
}
