// The fortune wheel button on Home (under the coin pill): it opens the
// ԲԱԽՏԻ ԱՆԻՎ page, carries a green ՊՏՏԻ՛Ր badge, and idly spins once every
// WHEEL_IDLE_INTERVAL_MS on a pre-built native loop — which runs only while
// Home is what's on screen (not on another tab, under a page or popup, or
// with the app in the background), and never with reduced motion.
import React from 'react';
import { AccessibilityInfo, Animated, AppState, AppStateStatus, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { WHEEL_SPIN_MS } from './constants/theme';
import { menu, openClassic, page, PAGE, pageShown, pressable, pressLabel, selectTab } from './test-utils/navigation';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let root: any;
let appStateListeners: ((state: AppStateStatus) => void)[] = [];
// Every loop built around the wheel's spin: started / stopped.
let spinLoops: { started: number; stopped: number }[] = [];

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('wordle:rulesSeen', 'true');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) } as any;
  });
  spinLoops = [];
  const spinParts = new WeakSet<object>();
  const realTiming = Animated.timing;
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const animation = realTiming(value, config);
    if (config.duration === WHEEL_SPIN_MS) spinParts.add(animation);
    return animation;
  });
  const realSequence = Animated.sequence;
  jest.spyOn(Animated, 'sequence').mockImplementation((animations) => {
    const sequence = realSequence(animations);
    if (animations.some((a) => spinParts.has(a))) spinParts.add(sequence);
    return sequence;
  });
  const realLoop = Animated.loop;
  jest.spyOn(Animated, 'loop').mockImplementation((animation, config) => {
    const loop = realLoop(animation, config);
    if (!spinParts.has(animation)) return loop;
    const record = { started: 0, stopped: 0 };
    spinLoops.push(record);
    return { ...loop, start: (cb?: any) => (record.started++, loop.start(cb)), stop: () => (record.stopped++, loop.stop()) };
  });
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

const advance = async (ms: number) => {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
  }
};
async function renderApp() {
  await act(async () => {
    root = TestRenderer.create(<App />);
  });
  await advance(300);
}
const spinning = () => spinLoops.filter((l) => l.started > 0 && l.stopped === 0).length;
const setAppState = async (state: AppStateStatus) => {
  await act(async () => appStateListeners.forEach((l) => l(state)));
  await advance(100);
};
const wheelButton = () => pressable(menu(root), 'ԲԱԽՏԻ ԱՆԻՎ');

it('sits on Home with the ՊՏՏԻ՛Ր badge (՛ is U+055B)', async () => {
  await renderApp();
  const texts = wheelButton()
    .findAllByType(Text)
    .map((t: any) => [].concat(t.props.children).join(''));
  expect(texts).toEqual(['ՊՏՏԻ՛Ր']);
});

it('opens the ԲԱԽՏԻ ԱՆԻՎ page (its title and a back arrow), and back closes it', async () => {
  await renderApp();
  await pressLabel(root, 'ԲԱԽՏԻ ԱՆԻՎ', menu(root));
  expect(pageShown(root, PAGE.wheel)).toBe(true);
  const titles = page(root, PAGE.wheel)
    .findAllByType(Text)
    .map((t: any) => [].concat(t.props.children).join(''));
  expect(titles).toEqual(['ԲԱԽՏԻ ԱՆԻՎ']);
  await pressLabel(root, 'Հետ', page(root, PAGE.wheel));
  expect(pageShown(root, PAGE.wheel)).toBe(false);
});

it('idly spins on Home; the loop stops on another tab and restarts back on Home', async () => {
  await renderApp();
  expect(spinning()).toBe(1);
  await selectTab(root, 'leaders');
  expect(spinning()).toBe(0);
  await selectTab(root, 'home');
  expect(spinning()).toBe(1);
});

it('stops under a page (the game, its own page) and a popup (the profile), and restarts after', async () => {
  await renderApp();
  await openClassic(root);
  expect(spinning()).toBe(0);
  await pressLabel(root, 'Հետ', page(root, PAGE.game));
  expect(spinning()).toBe(1);
  await pressLabel(root, 'ԲԱԽՏԻ ԱՆԻՎ', menu(root));
  expect(spinning()).toBe(0);
  await pressLabel(root, 'Հետ', page(root, PAGE.wheel));
  expect(spinning()).toBe(1);
  await pressLabel(root, 'ՊՐՈՖԻԼ', menu(root));
  expect(spinning()).toBe(0);
  await pressLabel(root, 'Փակել');
  expect(spinning()).toBe(1);
});

it('stops when the app goes to the background, and restarts when it is back', async () => {
  await renderApp();
  await setAppState('background');
  expect(spinning()).toBe(0);
  await setAppState('active');
  expect(spinning()).toBe(1);
});

it('with reduced motion it never spins', async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  await renderApp();
  expect(spinLoops.every((l) => l.started === 0)).toBe(true);
  expect(wheelButton()).toBeTruthy();
});
