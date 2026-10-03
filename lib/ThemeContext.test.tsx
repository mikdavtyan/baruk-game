// The light/dark toggle: every themed color fades in place over
// THEME_FADE_MS, the plain `theme`/`isDark` snapshot (icons, status bar,
// gradients, PNGs) flips once at the midpoint, taps mid-fade are ignored, and
// reduced motion switches instantly.
import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { darkTheme, lightTheme, THEME_FADE_MS, ThemeTokens } from '../constants/theme';
import { ThemeProvider, useTheme, useThemeSnapshot } from './ThemeContext';

const normalizeColor: (c: unknown) => number | null = require('react-native/Libraries/StyleSheet/normalizeColor').default;
const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

let root: any;
let api: ReturnType<typeof useTheme> & ReturnType<typeof useThemeSnapshot>;
let darkHistory: boolean[] = []; // isDark after every commit where it changed

function Probe() {
  const colors = useTheme();
  const snapshot = useThemeSnapshot();
  useEffect(() => {
    const theme = { ...colors, ...snapshot };
    api = theme;
    if (darkHistory[darkHistory.length - 1] !== theme.isDark) darkHistory.push(theme.isDark);
  });
  return null;
}

// The fade is native-driven, and native-driven animations finish at once in
// Jest (no native module). Run the same timings on the JS side here, so they
// follow fake timers and the midpoint / busy window can be observed.
const realTiming = Animated.timing;
beforeEach(() => {
  jest.useFakeTimers();
  darkHistory = [];
  // RN's jest setup makes this a jest.fn, which restoreAllMocks doesn't reset.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest
    .spyOn(Animated, 'timing')
    .mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
});
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function render() {
  await act(async () => {
    root = TestRenderer.create(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
  });
}
const advance = async (ms: number) => {
  for (let t = 0; t < ms; t += 10) {
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
  }
};
const tap = async () => {
  await act(async () => {
    api.toggleTheme();
  });
};

// Every themed color node — both the View colors and the Text colors — shows
// exactly `tokens`' value.
function expectAllTokens(tokens: ThemeTokens) {
  for (const key of Object.keys(tokens) as (keyof ThemeTokens)[]) {
    const expected = normalizeColor(tokens[key]);
    expect([key, normalizeColor((api.color(key) as any).__getValue())]).toEqual([key, expected]);
    expect([key, normalizeColor((api.textColor(key) as any).__getValue())]).toEqual([key, expected]);
  }
}

it('fades: the snapshot theme flips at the midpoint, and every token is final at the end', async () => {
  await render();
  expectAllTokens(lightTheme);
  await tap();
  expect(api.isDark).toBe(false); // nothing snaps on the tap itself

  await advance(THEME_FADE_MS / 2 - 20);
  expect(api.isDark).toBe(false);
  expect(api.theme.background).toBe(lightTheme.background);

  await advance(40); // just past the midpoint
  expect(api.isDark).toBe(true);
  expect(api.theme.background).toBe(darkTheme.background);

  await advance(THEME_FADE_MS);
  expectAllTokens(darkTheme);
});

it('ignores taps mid-fade: rapid repeated taps are exactly one switch', async () => {
  await render();
  for (let i = 0; i < 10; i++) {
    await tap();
    await advance(20);
  }
  await advance(THEME_FADE_MS * 2);
  expect(darkHistory).toEqual([false, true]); // flipped exactly once
  expectAllTokens(darkTheme);

  await tap(); // once the fade is over, a tap works again
  await advance(THEME_FADE_MS * 2);
  expect(darkHistory).toEqual([false, true, false]);
  expectAllTokens(lightTheme);
});

it('reduced motion switches instantly, on the first render after the tap', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render();
  await tap(); // no timers advanced at all
  expect(api.isDark).toBe(true);
  expect(api.theme.background).toBe(darkTheme.background);
  expectAllTokens(darkTheme);
});

it('runs every fade timing on the native driver (no JS work per frame)', async () => {
  (Animated.timing as jest.Mock).mockClear();
  await render();
  await tap();
  await advance(THEME_FADE_MS * 2);
  const configs = (Animated.timing as jest.Mock).mock.calls.map(([, config]) => config);
  expect(configs.length).toBeGreaterThan(0);
  expect(configs.every((c) => c.useNativeDriver === true)).toBe(true);
  expectAllTokens(darkTheme);
});

it('with TEXT_COLOR_NATIVE false, text colors switch once at the midpoint and end correct', async () => {
  let Isolated = {} as typeof import('./ThemeContext');
  const ReactNative = require('react-native');
  jest.isolateModules(() => {
    // Share React and RN with the test (one React instance; the spied timing).
    jest.doMock('react', () => React);
    jest.doMock('react-native', () => ReactNative);
    jest.doMock('../constants/theme', () => ({ ...jest.requireActual('../constants/theme'), TEXT_COLOR_NATIVE: false }));
    Isolated = require('./ThemeContext');
  });
  const IsolatedProvider = Isolated.ThemeProvider;
  let iso = {} as ReturnType<typeof useTheme> & ReturnType<typeof useThemeSnapshot>;
  function IsoProbe() {
    const colors = Isolated.useTheme();
    const snapshot = Isolated.useThemeSnapshot();
    useEffect(() => {
      iso = { ...colors, ...snapshot };
    });
    return null;
  }
  await act(async () => {
    root = TestRenderer.create(
      <IsolatedProvider>
        <IsoProbe />
      </IsolatedProvider>,
    );
  });
  const text = (key: keyof ThemeTokens) => normalizeColor((iso.textColor(key) as any).__getValue());
  await act(async () => iso.toggleTheme());
  await advance(THEME_FADE_MS / 2 - 20);
  expect(text('keyText')).toBe(normalizeColor(lightTheme.keyText)); // no per-frame text fade
  await advance(40); // just past the midpoint: one switch
  expect(text('keyText')).toBe(normalizeColor(darkTheme.keyText));
  await advance(THEME_FADE_MS);
  for (const key of Object.keys(darkTheme) as (keyof ThemeTokens)[]) {
    expect([key, text(key)]).toEqual([key, normalizeColor(darkTheme[key])]);
    expect([key, normalizeColor((iso.color(key) as any).__getValue())]).toEqual([key, normalizeColor(darkTheme[key])]);
  }
});
