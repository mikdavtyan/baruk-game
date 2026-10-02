import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { darkTheme, lightTheme, THEME_FADE_MS, ThemeTokens } from '../constants/theme';

// lightTheme/darkTheme (constants/theme.ts) are the design tokens. A theme
// toggle fades every themed color in place (docs/adr/0004):
// - View colors (backgroundColor, border*Color) — `color(key)`: one
//   interpolation per token of `progress`, on the NATIVE driver.
// - Text colors — `textColor(key)`: one interpolation per token of
//   `textProgress`, on the JS driver (native text color isn't confirmed to
//   repaint on Android). Started in the same tick, same duration and easing.
// - Everything that can't animate (icon tints, the status bar, gradients,
//   PNGs, text shadows…) reads the plain `theme`/`isDark` snapshot, which
//   flips once, at the fade's midpoint.
// The fade runs as two halves — ease-in to 0.5, ease-out to the end, which
// together are exactly Easing.inOut(Easing.quad) — so the snapshot flips in
// the callback between them, not on a timer. Taps mid-fade are ignored;
// reduced motion switches instantly. Nothing is remounted.

export type ColorFn = (key: keyof ThemeTokens) => Animated.AnimatedInterpolation<string>;

type ThemeContextValue = {
  theme: ThemeTokens; // plain snapshot — flips at the fade's midpoint
  isDark: boolean; // flips with `theme`
  toggleTheme: () => void;
  color: ColorFn; // View colors (native driver)
  textColor: ColorFn; // Text colors (JS driver)
  reduceMotion: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const TOKEN_KEYS = Object.keys(lightTheme) as (keyof ThemeTokens)[];

// One interpolation node per token, created once and shared by every view.
function interpolations(progress: Animated.Value) {
  const nodes = {} as Record<keyof ThemeTokens, Animated.AnimatedInterpolation<string>>;
  for (const key of TOKEN_KEYS) {
    nodes[key] = progress.interpolate({ inputRange: [0, 1], outputRange: [lightTheme[key], darkTheme[key]] });
  }
  return nodes;
}

// Defaults to light, matching the app's look before this toggle existed.
// Only the header's moon/sun button flips it.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0)); // 0 = light, 1 = dark — View colors
  const [textProgress] = useState(() => new Animated.Value(0)); // the same, for Text colors
  const [viewNodes] = useState(() => interpolations(progress));
  const [textNodes] = useState(() => interpolations(textProgress));
  // Where the current/last fade is heading (1 = dark), and whether one runs.
  const targetRef = useRef(0);
  const busyRef = useRef(false);

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

  const toggleTheme = useCallback(() => {
    if (busyRef.current) return;
    const to = targetRef.current === 1 ? 0 : 1;
    targetRef.current = to;
    if (reduceMotion) {
      progress.setValue(to);
      textProgress.setValue(to);
      setIsDark(to === 1);
      return;
    }
    busyRef.current = true;
    const half = (toValue: number, easing: (t: number) => number) =>
      Animated.parallel([
        Animated.timing(progress, { toValue, duration: THEME_FADE_MS / 2, easing, useNativeDriver: true }),
        Animated.timing(textProgress, { toValue, duration: THEME_FADE_MS / 2, easing, useNativeDriver: false }),
      ]);
    half(0.5, Easing.in(Easing.quad)).start(() => {
      setIsDark(to === 1); // the snapshot's one switch, mid-fade
      half(to, Easing.out(Easing.quad)).start(() => {
        // Pin both values to the end state, so the JS side of the native-driven
        // value never lags behind what's on screen (a later re-render reads it).
        progress.setValue(to);
        textProgress.setValue(to);
        busyRef.current = false;
      });
    });
  }, [reduceMotion, progress, textProgress]);

  const color = useCallback<ColorFn>((key) => viewNodes[key], [viewNodes]);
  const textColor = useCallback<ColorFn>((key) => textNodes[key], [textNodes]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme, color, textColor, reduceMotion }),
    [isDark, toggleTheme, color, textColor, reduceMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
