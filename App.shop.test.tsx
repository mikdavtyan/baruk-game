// The coin shop's entry point: tapping the header coin pill opens the shop
// window (ԽԱՆՈՒԹ), and its X or Android's back button closes it.
// Harness copied from App.rulesModal.test.tsx.
import React from 'react';
import { BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let root: any;
// Android's back button: the jest preset's BackHandler is a no-op stub, so
// capture what's registered and press "back" by calling the newest handler,
// the way Android does.
type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackPressHandler[] = [];

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('wordle:rulesSeen', 'true'); // past the first launch's rules popup
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler);
    return { remove: () => (backHandlers = backHandlers.filter((h) => h !== handler)) };
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
  await advance(50); // storage loads
  const layoutViews = root.root.findAll((n: any) => typeof n.props.onLayout === 'function');
  await act(async () => {
    layoutViews.forEach((v: any) => v.props.onLayout({ nativeEvent: { layout: { width: 350, height: 400 } } }));
  });
  await advance(1000); // the popup's open animation, if it opens
}

const shopShown = () => root.root.findAll((n: any) => typeof n.type === 'string' && n.props.children === 'ԽԱՆՈՒԹ').length > 0;
const press = async (label: string) => {
  await act(async () => {
    root.root.findAll((n: any) => n.props.accessibilityLabel === label && n.props.onPress)[0].props.onPress();
  });
  await advance(1000); // the close/open animation
};
const pressBack = async () => {
  let handled: boolean | null | undefined;
  await act(async () => {
    handled = [...backHandlers].reverse().reduce<boolean | null | undefined>((done, h) => done || h({} as any), false);
  });
  await advance(1000);
  return handled;
};

it('tapping the coin pill opens the shop, and the X closes it', async () => {
  await renderApp();
  expect(shopShown()).toBe(false);
  await press('Խանութ');
  expect(shopShown()).toBe(true);
  await press('Փակել');
  expect(shopShown()).toBe(false);
});

it("Android's back button closes the shop (and is used up doing so)", async () => {
  await renderApp();
  await press('Խանութ');
  expect(await pressBack()).toBe(true);
  expect(shopShown()).toBe(false);
  expect(await pressBack()).toBeFalsy();
});
