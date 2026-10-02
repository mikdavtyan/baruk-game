import { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { darkTheme, lightTheme, ThemeTokens } from '../constants/theme';

// lightTheme/darkTheme (constants/theme.ts) are the design tokens. Every
// themed color is read through `color(key)`, an interpolation of one shared
// Animated value (`progress`: 0 = light, 1 = dark). The switch is INSTANT —
// no crossfade: a fade takes each key's dark-on-light text and light-on-dark
// background through the same mid-gray at the same moment (letters vanish),
// and the whole screen through a gray veil. `progress` is set in a layout
// effect, so the Animated-driven colors and the `theme` snapshot change in
// the same frame. Nothing is ever remounted on a theme change. The visible
// transition — a brief cover in the new theme's color — is
// components/ThemeTransition.tsx, layered over this instant switch.

export type ColorFn = (key: keyof ThemeTokens) => Animated.AnimatedInterpolation<string>;

type ThemeContextValue = {
  theme: ThemeTokens; // instantaneous, non-animated — only for non-color logic (e.g. which icon to show)
  isDark: boolean;
  toggleTheme: () => void;
  // Every themed *color* used in a style should come from here, not from
  // `theme` above.
  color: ColorFn;
  reduceMotion: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Defaults to light, matching the app's look before this toggle existed.
// Only the header's moon/sun button (see Header.tsx — its own animation is
// untouched here) flips it.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0)); // 0 = light, 1 = dark

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

  const toggleTheme = () => setIsDark((d) => !d);
  useLayoutEffect(() => {
    progress.setValue(isDark ? 1 : 0);
  }, [isDark, progress]);

  const color: ColorFn = (key) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [lightTheme[key], darkTheme[key]] });

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme, color, reduceMotion }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, reduceMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
