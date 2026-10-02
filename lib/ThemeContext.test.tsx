// The light/dark toggle: every themed color fades in place over
// THEME_FADE_MS, the plain `theme`/`isDark` snapshot (icons, status bar,
// gradients, PNGs) flips once at the midpoint, taps mid-fade are ignored, and
// reduced motion switches instantly.
import React, { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { darkTheme, lightTheme, THEME_FADE_MS, ThemeTokens } from '../constants/theme';
import { ThemeProvider, useTheme } from './ThemeContext';

const normalizeColor: (c: unknown) => number | null = require('react-native/Libraries/StyleSheet/normalizeColor').default;
const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

let root: any;
let api: ReturnType<typeof useTheme>;
let darkHistory: boolean[] = []; // isDark after every commit where it changed

function Probe() {
  const theme = useTheme();
  useEffect(() => {
    api = theme;
    if (darkHistory[darkHistory.length - 1] !== theme.isDark) darkHistory.push(theme.isDark);
  });
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  darkHistory = [];
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
