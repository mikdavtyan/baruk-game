import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { darkTheme, lightTheme, THEME_COVER_IN_MS, THEME_COVER_OUT_MS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

// The light/dark toggle's transition — cheap by design: a full-screen overlay
// in the NEW theme's background color fades in; the theme switches while the
// screen is fully covered; once that re-render has committed, one frame later
// the overlay fades out. Opacity only, on the native driver; nothing is
// captured or remounted. Each step starts from an effect after the previous
// state has committed (not from a timer), so it can't outrun the re-render.
// Extra taps are ignored while it runs; reduced motion switches instantly.

const ThemeToggleContext = createContext<() => void>(() => {});

export function useThemeToggle() {
  return useContext(ThemeToggleContext);
}

export default function ThemeTransitionProvider({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme, reduceMotion } = useTheme();
  const busyRef = useRef(false);
  const switchedRef = useRef(false);
  const [cover, setCover] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  const toggle = () => {
    if (busyRef.current) return;
    if (reduceMotion) {
      toggleTheme();
      return;
    }
    busyRef.current = true;
    opacity.setValue(0);
    setCover((isDark ? lightTheme : darkTheme).background);
  };

  // 1. The cover has mounted: fade it in, then switch the theme under it.
  useEffect(() => {
    if (!cover) return;
    Animated.timing(opacity, { toValue: 1, duration: THEME_COVER_IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      switchedRef.current = true;
      toggleTheme();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover]);

  // 2. The switched theme has committed under the cover: one frame later
  // (it has painted), fade the cover out.
  useEffect(() => {
    if (!switchedRef.current) return;
    switchedRef.current = false;
    const frame = requestAnimationFrame(() =>
      Animated.timing(opacity, { toValue: 0, duration: THEME_COVER_OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        setCover(null);
        busyRef.current = false;
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [isDark, opacity]);

  return (
    <ThemeToggleContext.Provider value={toggle}>
      {children}
      {cover && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: cover, opacity }]} />}
    </ThemeToggleContext.Provider>
  );
}
