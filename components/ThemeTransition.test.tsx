import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import ThemeTransitionProvider, { useThemeToggle } from './ThemeTransition';
import { darkTheme } from '../constants/theme';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

let root: any;
let toggle: () => void = () => {};
let isDark = false;

// Exposes the toggle and the current theme to the test (after each commit).
function Probe() {
  const t = useThemeToggle();
  const dark = useTheme().isDark;
  useEffect(() => {
    isDark = dark;
    toggle = t;
  });
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  isDark = false;
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
        <ThemeTransitionProvider>
          <Probe />
        </ThemeTransitionProvider>
      </ThemeProvider>,
    );
  });
}
// The cover: the only full-screen Animated.View with a background color.
const covers = () =>
  root.root.findAll((n: any) => n.type === Animated.View && StyleSheet.flatten(n.props.style)?.backgroundColor);
const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
  }
};

it('covers the screen in the new theme color, switches under it, then uncovers', async () => {
  await render();
  await act(async () => toggle());
  expect(covers()).toHaveLength(1);
  expect(StyleSheet.flatten(covers()[0].props.style).backgroundColor).toBe(darkTheme.background);
  await settle();
  expect(isDark).toBe(true);
  expect(covers()).toHaveLength(0);
});

it('ignores extra taps while it runs — 10 fast taps are one clean switch', async () => {
  await render();
  await act(async () => {
    for (let i = 0; i < 10; i++) toggle();
  });
  await settle();
  expect(isDark).toBe(true);
  expect(covers()).toHaveLength(0);
  await act(async () => toggle()); // and it works again afterwards
  await settle();
  expect(isDark).toBe(false);
});

it('switches instantly with reduced motion', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render();
  await act(async () => toggle());
  expect(isDark).toBe(true);
  expect(covers()).toHaveLength(0);
});
