// The "How to play" popup through the real App: it opens by itself on the
// very first launch only (a flag persisted in AsyncStorage), the X and
// Android's back button close it, and the header's rules button still opens
// it any time. Harness copied from App.roundFlow.test.tsx.
import React from 'react';
import { BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import RulesCard from './components/RulesCard';

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
const relaunch = async () => {
  await act(async () => root.unmount());
  await renderApp();
};

const rulesShown = () => root.root.findAllByType(RulesCard).length === 1;
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

it('opens by itself on the very first launch', async () => {
  await renderApp();
  expect(rulesShown()).toBe(true);
});

it('the X closes it', async () => {
  await renderApp();
  await press('Փակել');
  expect(rulesShown()).toBe(false);
});

it("Android's back button closes it (and is used up doing so)", async () => {
  await renderApp();
  expect(await pressBack()).toBe(true);
  expect(rulesShown()).toBe(false);
  expect(await pressBack()).toBeFalsy(); // nothing left to close: back goes to the system
});

it('never opens by itself again after the first launch, even if the app was closed with it open', async () => {
  await renderApp();
  expect(rulesShown()).toBe(true);
  await relaunch(); // closed while it was still open
  expect(rulesShown()).toBe(false);
  await relaunch();
  expect(rulesShown()).toBe(false);
});

it('the header rules button opens it any time, and the X closes it again', async () => {
  await AsyncStorage.setItem('wordle:rulesSeen', JSON.stringify(true));
  await renderApp();
  expect(rulesShown()).toBe(false);
  await press('Rules');
  expect(rulesShown()).toBe(true);
  await press('Փակել');
  expect(rulesShown()).toBe(false);
});
