// The menu's drifting letter tiles: one native Animated.loop per tile, all
// pre-mounted; the loops run only while the menu is what's on screen — they
// stop when a page (the game) covers it or the app leaves the foreground, and
// start again after. Reduced motion never starts them (a static layout).
import React from 'react';
import { AccessibilityInfo, Animated, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { MENU_BG_TILES } from './constants/theme';
import { menu, openClassic, page, PAGE, pressLabel } from './test-utils/navigation';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let root: any;
let appStateListeners: ((state: AppStateStatus) => void)[] = [];
// Every loop over one of the background's tile timings: started / stopped.
let loops: { started: number; stopped: number }[] = [];

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
  loops = [];
  const periods = new Set(MENU_BG_TILES.map((t) => t.periodMs));
  const tileTimings = new WeakSet<object>();
  const realTiming = Animated.timing;
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const animation = realTiming(value, config);
    if (periods.has(config.duration as number)) tileTimings.add(animation);
    return animation;
  });
  const realLoop = Animated.loop;
  jest.spyOn(Animated, 'loop').mockImplementation((animation, config) => {
    const loop = realLoop(animation, config);
    if (!tileTimings.has(animation)) return loop;
    const record = { started: 0, stopped: 0 };
    loops.push(record);
    return {
      ...loop,
      start: (cb?: Animated.EndCallback) => {
        record.started += 1;
        loop.start(cb);
      },
      stop: () => {
        record.stopped += 1;
        loop.stop();
      },
    };
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
const running = () => loops.filter((l) => l.started > 0 && l.stopped === 0).length;
const setAppState = async (state: AppStateStatus) => {
  await act(async () => appStateListeners.forEach((l) => l(state)));
  await advance(100);
};

it('every tile drifts on its own loop while the menu is on screen', async () => {
  await renderApp();
  expect(running()).toBe(MENU_BG_TILES.length);
});

it('the loops stop while the game page is open, and start again back on the menu', async () => {
  await renderApp();
  await openClassic(root);
  expect(running()).toBe(0);
  await pressLabel(root, 'Հետ', page(root, PAGE.game));
  expect(running()).toBe(MENU_BG_TILES.length);
});

it('the loops stop while any page (the shop) covers the menu', async () => {
  await renderApp();
  await pressLabel(root, 'ԽԱՆՈՒԹ', menu(root));
  expect(running()).toBe(0);
  await pressLabel(root, 'Հետ', page(root, PAGE.shop));
  expect(running()).toBe(MENU_BG_TILES.length);
});

it('the loops stop when the app goes to the background, and start again when it is back', async () => {
  await renderApp();
  await setAppState('background');
  expect(running()).toBe(0);
  await setAppState('active');
  expect(running()).toBe(MENU_BG_TILES.length);
});

it('with reduced motion no loop ever starts (a static layout)', async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  await renderApp();
  expect(loops.every((l) => l.started === 0)).toBe(true);
  expect(menu(root).findAll((n: any) => n.props.testID === 'menu-bg-tile' && typeof n.type === 'string')).toHaveLength(
    MENU_BG_TILES.length,
  ); // still drawn, just still
});
