// Render-count measurements for the low-end-Android stutter: how many
// components render for one keystroke, one backspace, and a whole
// theme toggle. The counter (test-utils/renderCounter.ts) must load before
// react-test-renderer, so it's imported first.
import { describeCounts, startCounting, stopCounting } from './test-utils/renderCounter';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { THEME_FADE_MS } from './constants/theme';
import { letterLabel } from './lib/letterDisplay';
import { tapKey } from './test-utils/keyboardTouch';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let root: any;

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('wordle:rulesSeen', 'true');
  await AsyncStorage.setItem(
    'wordle:wordBag',
    JSON.stringify({ order: ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'], pos: 0 }),
  );
});
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
});

const advance = async (ms: number) => {
  for (let t = 0; t < ms; t += 10) {
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
  }
};

async function renderApp() {
  await act(async () => {
    root = TestRenderer.create(<App />);
  });
  await advance(50);
  const layoutViews = root.root.findAll((n: any) => typeof n.props.onLayout === 'function');
  await act(async () => {
    layoutViews.forEach((v: any) => v.props.onLayout({ nativeEvent: { layout: { width: 350, height: 400 } } }));
  });
  await advance(300); // everything settled
}
const press = async (label: string) => {
  await act(async () => {
    root.root.findAll((n: any) => n.props.accessibilityLabel === label && n.props.onPress)[0].props.onPress();
  });
};
// A keyboard key, by a finger's touch down + up.
const tap = async (label: string) => {
  await act(async () => tapKey(root, label));
};

// Runs `action` and returns what rendered while it (and its settling) ran.
async function measure(action: () => Promise<void>) {
  startCounting();
  await action();
  return stopCounting();
}

// Baseline before the fix (perf: low-end Android stutter): letter 1183,
// backspace 1177, toggle 1144 + 1442 (midpoint flip) + 1144 renders.
// Native-driven animations finish at once in Jest, so the whole theme fade —
// the midpoint snapshot flip included — lands inside one measurement; mid-fade
// there is no JS work at all (lib/ThemeContext.test.tsx checks every fade
// timing is native-driven).
const KEYSTROKE_MAX_RENDERS = 60;
const TOGGLE_MAX_RENDERS = 80;
// Never re-rendered by a keystroke or a theme toggle.
const UNTOUCHED = ['Keyboard', 'KeyboardKey', 'Header', 'BottomControls', 'WinFlow', 'LossFlow', 'ShopScreen'];

it('one keystroke re-renders only the typed row (at most 2 tiles), and a theme toggle only the snapshot leaves', async () => {
  await renderApp();
  const letter = await measure(async () => {
    await tap(letterLabel('ա'));
    await advance(300);
  });
  const backspace = await measure(async () => {
    await tap('Ջնջել');
    await advance(300);
  });
  const toggle = await measure(async () => {
    await press('Toggle dark mode');
    await advance(THEME_FADE_MS * 2);
  });
  console.log(
    [
      `[render-count] letter: ${describeCounts(letter)}`,
      `[render-count] backspace: ${describeCounts(backspace)}`,
      `[render-count] toggle: ${describeCounts(toggle)}`,
    ].join('\n'),
  );

  for (const keystroke of [letter, backspace]) {
    expect(keystroke.total).toBeLessThanOrEqual(KEYSTROKE_MAX_RENDERS);
    expect(keystroke.byComponent.Row ?? 0).toBeLessThanOrEqual(1);
    expect(keystroke.byComponent.Tile ?? 0).toBeLessThanOrEqual(2); // the typed cell + the cursor's old/new cell
    for (const name of UNTOUCHED) expect([name, keystroke.byComponent[name] ?? 0]).toEqual([name, 0]);
  }
  expect(toggle.total).toBeLessThanOrEqual(TOGGLE_MAX_RENDERS);
  for (const name of [...UNTOUCHED, 'AppInner', 'Board', 'Row', 'Tile', 'Animated(Text)']) {
    expect([name, toggle.byComponent[name] ?? 0]).toEqual([name, 0]);
  }
});
