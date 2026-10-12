import { createContext, ReactNode, RefObject, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import ThemeRevealOverlay, { RevealOrigin } from '../components/ThemeRevealOverlay';
import { darkTheme, lightTheme, ThemeTokens } from '../constants/theme';
import { captureView, ViewImage } from './captureView';
import { measureWindow } from './measureWindow';

// lightTheme/darkTheme (constants/theme.ts) are the design tokens. A theme
// switch is a circle reveal (docs/adr/0006): the old look is snapshotted,
// the theme switches INSTANTLY underneath, and a growing circular hole in the
// snapshot (Skia + Reanimated, on the UI thread) uncovers the new one from
// the control that was pressed. No JS work per frame, no color fade:
// - `color(key)` (View colors) and `textColor(key)` (Text colors) are one
//   shared interpolation per token of `progress`, a native-driven value that
//   is only ever SET (0 = light, 1 = dark), so a switch re-renders nothing.
// - Everything that can't take an Animated color (icon tints, the status bar,
//   gradients, text shadows…) reads the plain `theme`/`isDark` snapshot.
// Two contexts, so the snapshot's flip re-renders only its readers:
// `useTheme()` is the stable part (color, textColor, toggleTheme,
// reduceMotion, currentTheme — never changes on a switch); `useThemeSnapshot()`
// is `{ theme, isDark }`. Read the snapshot only in small leaf components.
// Taps on a theme control mid-reveal are ignored; reduced motion, or a
// snapshot that can't be taken, switches instantly. Nothing is remounted.

export type ColorFn = (key: keyof ThemeTokens) => Animated.AnimatedInterpolation<string>;

type ThemeColorsValue = {
  // `origin` (window coordinates) is where the new theme spreads from — the
  // pressed control's center; null → the screen's center.
  toggleTheme: (origin?: RevealOrigin | null) => void;
  color: ColorFn; // View colors (native driver)
  textColor: ColorFn; // Text colors (native driver)
  // 0 = light, 1 = dark — set at a switch, never animated. For things that
  // switch by opacity rather than color (ScreenGlow's two gradients).
  darkness: Animated.Value;
  reduceMotion: boolean;
  // The current snapshot WITHOUT subscribing to it — for render-time logic
  // that runs anyway for another reason (e.g. a key's own state-change fade).
  currentTheme: () => ThemeTokens;
  // Sets the theme at once, without a reveal and without reporting it to
  // `onDarkChange` — for restoring the saved choice before the first render.
  setDarkInstant: (dark: boolean) => void;
};

type ThemeSnapshotValue = {
  theme: ThemeTokens; // plain snapshot
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

type Reveal = { id: number; image: ViewImage; origin: RevealOrigin | null; dark: boolean };

// Defaults to light. `onDarkChange` hears every theme change a player makes
// (the header's toggle, Settings' switch), at the moment the theme switches
// under the reveal — App saves it.
export function ThemeProvider({ children, onDarkChange }: { children: ReactNode; onDarkChange?: (dark: boolean) => void }) {
  const [isDark, setIsDark] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0)); // 0 = light, 1 = dark — set, never animated
  const [nodes] = useState(() => interpolations(progress));
  const [reveal, setReveal] = useState<Reveal | null>(null);
  // Where the current/last switch is heading (true = dark), and whether a
  // reveal runs (from the tap until the circle has fully opened).
  const targetRef = useRef(false);
  const busyRef = useRef(false);
  const snapshotRef = useRef<ThemeTokens>(lightTheme);
  const rootRef = useRef<View>(null);
  const revealIdRef = useRef(0);
  const revealRef = useRef<Reveal | null>(null);

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

  const onDarkChangeRef = useRef(onDarkChange);
  useLayoutEffect(() => {
    onDarkChangeRef.current = onDarkChange;
  });

  // The switch itself: every native color at once, then the snapshot.
  const apply = useCallback(
    (dark: boolean) => {
      progress.setValue(dark ? 1 : 0);
      snapshotRef.current = dark ? darkTheme : lightTheme;
      setIsDark(dark);
    },
    [progress],
  );
  const applyByPlayer = useCallback(
    (dark: boolean) => {
      apply(dark);
      onDarkChangeRef.current?.(dark);
    },
    [apply],
  );

  const toggleTheme = useCallback(
    (origin?: RevealOrigin | null) => {
      if (busyRef.current) return;
      const dark = !targetRef.current;
      targetRef.current = dark;
      if (reduceMotion) {
        applyByPlayer(dark);
        return;
      }
      busyRef.current = true;
      captureView(rootRef)
        .catch(() => null)
        .then((image) => {
          if (!image) {
            applyByPlayer(dark);
            busyRef.current = false;
            return;
          }
          revealIdRef.current += 1;
          const next = { id: revealIdRef.current, image, origin: origin ?? null, dark };
          revealRef.current = next;
          setReveal(next);
        });
    },
    [reduceMotion, applyByPlayer],
  );

  // The overlay shows the old look over everything: switch underneath.
  const handleCovered = useCallback(() => {
    const r = revealRef.current;
    if (r) applyByPlayer(r.dark);
  }, [applyByPlayer]);
  const handleRevealDone = useCallback(() => {
    revealRef.current?.image.dispose?.();
    revealRef.current = null;
    setReveal(null);
    busyRef.current = false;
  }, []);

  const color = useCallback<ColorFn>((key) => nodes[key], [nodes]);
  const currentTheme = useCallback(() => snapshotRef.current, []);
  const setDarkInstant = useCallback(
    (dark: boolean) => {
      if (busyRef.current) return;
      targetRef.current = dark;
      apply(dark);
    },
    [apply],
  );

  const colors = useMemo<ThemeColorsValue>(
    () => ({ toggleTheme, color, textColor: color, darkness: progress, reduceMotion, currentTheme, setDarkInstant }),
    [toggleTheme, color, progress, reduceMotion, currentTheme, setDarkInstant],
  );
  const snapshot = useMemo<ThemeSnapshotValue>(() => ({ theme: isDark ? darkTheme : lightTheme, isDark }), [isDark]);
  return (
    <ThemeColorsContext.Provider value={colors}>
      <ThemeSnapshotContext.Provider value={snapshot}>
        {/* The snapshot's source: everything the app draws. */}
        <View ref={rootRef} collapsable={false} style={styles.root}>
          {children}
        </View>
        {reveal && (
          <ThemeRevealOverlay
            key={reveal.id}
            image={reveal.image}
            origin={reveal.origin}
            onCovered={handleCovered}
            onDone={handleRevealDone}
          />
        )}
      </ThemeSnapshotContext.Provider>
    </ThemeColorsContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

// The stable part — color/textColor/toggleTheme/reduceMotion/currentTheme. A
// theme switch never re-renders its readers.
export function useTheme(): ThemeColorsValue {
  const ctx = useContext(ThemeColorsContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

// The `{ theme, isDark }` snapshot — its readers re-render at every switch, so
// keep them small leaf components.
export function useThemeSnapshot(): ThemeSnapshotValue {
  const ctx = useContext(ThemeSnapshotContext);
  if (!ctx) throw new Error('useThemeSnapshot must be used within a ThemeProvider');
  return ctx;
}

// A theme control's press handler: the reveal spreads from the center of the
// view `ref` points at (measured at the tap), or the screen's center.
export function useToggleThemeFrom(ref: RefObject<View | null>): () => void {
  const { toggleTheme } = useTheme();
  return useCallback(() => {
    measureWindow(ref).then((r) => toggleTheme(r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null));
  }, [ref, toggleTheme]);
}
