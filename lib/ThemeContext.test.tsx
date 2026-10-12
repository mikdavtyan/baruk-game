// The light/dark switch (docs/adr/0006): the old look is snapshotted, the
// theme switches instantly under the circle-reveal overlay once it covers the
// screen, the overlay unmounts when its circle has opened, taps mid-reveal are
// ignored, and reduced motion or a failed snapshot switch instantly.
import React, { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { makeImageFromView } from '@shopify/react-native-skia';
import { darkTheme, lightTheme, ThemeTokens } from '../constants/theme';
import { ThemeProvider, useTheme, useThemeSnapshot } from './ThemeContext';

// The overlay draws natively; here it only reports its props, so the test
// plays its two moments (covered, done) by hand.
let overlay: { origin: unknown; onCovered: () => void; onDone: () => void } | null = null;
jest.mock('../components/ThemeRevealOverlay', () => {
  return function MockOverlay(props: any) {
    overlay = props;
    return null;
  };
});

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

const image = { dispose: jest.fn() };
beforeEach(() => {
  darkHistory = [];
  overlay = null;
  // RN's jest setup makes this a jest.fn, which restoreAllMocks doesn't reset.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  (makeImageFromView as jest.Mock).mockImplementation(() => Promise.resolve(image));
  image.dispose.mockClear();
  (makeImageFromView as jest.Mock).mockClear();
});
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  (makeImageFromView as jest.Mock).mockImplementation(() => Promise.resolve(null));
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
const tap = async () => {
  await act(async () => {
    api.toggleTheme({ x: 10, y: 20 });
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

it('reveal: the theme switches once the snapshot covers the screen, and the overlay leaves when the circle opens', async () => {
  await render();
  expectAllTokens(lightTheme);
  await tap();
  expect(overlay).not.toBeNull();
  expect(overlay!.origin).toEqual({ x: 10, y: 20 });
  expect(api.isDark).toBe(false); // nothing switches before the snapshot is on screen

  await act(async () => overlay!.onCovered());
  expect(api.isDark).toBe(true);
  expectAllTokens(darkTheme); // every native color at once, under the snapshot

  await act(async () => overlay!.onDone());
  expect(image.dispose).toHaveBeenCalled();
  expect(root.root.findAll((n: any) => n.props.onCovered).length).toBe(0);
});

it('ignores taps mid-reveal: rapid repeated taps are exactly one switch', async () => {
  const saved: boolean[] = [];
  await act(async () => {
    root = TestRenderer.create(
      <ThemeProvider onDarkChange={(d) => saved.push(d)}>
        <Probe />
      </ThemeProvider>,
    );
  });
  for (let i = 0; i < 5; i++) await tap();
  await act(async () => overlay!.onCovered());
  for (let i = 0; i < 5; i++) await tap();
  await act(async () => overlay!.onDone());
  expect(darkHistory).toEqual([false, true]); // flipped exactly once
  expect(saved).toEqual([true]); // and saved once
  expect(makeImageFromView).toHaveBeenCalledTimes(1);

  await tap(); // once the reveal is over, a tap works again
  await act(async () => overlay!.onCovered());
  await act(async () => overlay!.onDone());
  expect(darkHistory).toEqual([false, true, false]);
  expect(saved).toEqual([true, false]);
  expectAllTokens(lightTheme);
});

it('a snapshot that cannot be taken switches instantly, without an overlay', async () => {
  (makeImageFromView as jest.Mock).mockImplementation(() => Promise.resolve(null));
  await render();
  await tap();
  expect(overlay).toBeNull();
  expect(api.isDark).toBe(true);
  expectAllTokens(darkTheme);
  await tap(); // not left busy
  expect(api.isDark).toBe(false);
});

it('reduced motion switches instantly, on the first render after the tap', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render();
  await tap();
  expect(overlay).toBeNull();
  expect(makeImageFromView).not.toHaveBeenCalled();
  expect(api.isDark).toBe(true);
  expect(api.theme.background).toBe(darkTheme.background);
  expectAllTokens(darkTheme);
});
