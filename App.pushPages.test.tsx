// Pages (the Classic game, the shop, the bottom bar's pages) over the menu:
// - A closed page is invisible and inert regardless of its transform: its
//   frame is a plain (non-animated) opacity 0 + pointerEvents none, shown only
//   from the moment open() starts until a close has fully finished. (On a
//   Redmi the pre-mounted game page covered the menu at launch.)
// - Its animated nodes are created once: a window size change must not swap
//   them (swapping a native-driven node can leave the view at its default
//   transform on Android).
// - Open, close, Android back and the iOS edge swipe still work for every page.
import React from 'react';
import { BackHandler, Dimensions, Platform, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { PAGE_SWIPE_EDGE_ZONE } from './constants/theme';
import { menu, page, PAGE, pageShown, pressLabel } from './test-utils/navigation';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let root: any;
type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackPressHandler[] = [];
const initialWindow = Dimensions.get('window');
const initialScreen = Dimensions.get('screen');

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('wordle:rulesSeen', 'true');
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
    Dimensions.set({ window: initialWindow, screen: initialScreen });
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
const pressBack = async () => {
  await act(async () => {
    [...backHandlers].reverse().reduce<boolean | null | undefined>((done, h) => done || h({} as any), false);
  });
  await advance(1000);
};

// The page's frame: the plain view that hides a closed page.
const frame = (id: string) => root.root.find((n: any) => n.props.testID === `${id}-frame` && typeof n.type === 'string');
const hidden = (id: string) => {
  const f = frame(id);
  return StyleSheet.flatten(f.props.style).opacity === 0 && f.props.pointerEvents === 'none';
};
const visible = (id: string) => {
  const f = frame(id);
  return StyleSheet.flatten(f.props.style).opacity !== 0 && f.props.pointerEvents !== 'none';
};
// The animated translateX node on the page's own view (not its resolved value).
const translateNode = (id: string) => {
  const views = root.root.findAll((n: any) => n.props.testID === id && typeof n.type !== 'string');
  for (const v of views) {
    const transform = StyleSheet.flatten(v.props.style)?.transform;
    const node = transform?.find((t: any) => 'translateX' in t)?.translateX;
    if (node && typeof node.__getValue === 'function') return node;
  }
  throw new Error(`no animated translateX on ${id}`);
};
const resizeWindow = async (width: number, height: number) => {
  await act(async () => {
    Dimensions.set({ window: { ...initialWindow, width, height }, screen: { ...initialScreen, width, height } });
  });
  await advance(100);
};

describe('a closed page is invisible and inert, whatever its transform', () => {
  it('the pre-mounted game page at launch', async () => {
    await renderApp();
    expect(hidden(PAGE.game)).toBe(true);
  });

  it('after a window size change right after launch, the game page stays hidden and the menu interactive', async () => {
    await renderApp();
    const node = translateNode(PAGE.game);
    await resizeWindow(initialWindow.width - 40, initialWindow.height - 60);
    expect(translateNode(PAGE.game)).toBe(node); // the same native-driven node, not a new one
    expect(hidden(PAGE.game)).toBe(true);
    const menuLayer = root.root.find(
      (n: any) => typeof n.type === 'string' && n.props.pointerEvents && n.findAll((c: any) => c.props.testID === 'menu').length > 0,
    );
    expect(menuLayer.props.pointerEvents).toBe('auto');
    await pressLabel(root, 'ԴԱՍԱԿԱՆ', menu(root)); // and it still opens
    expect(visible(PAGE.game)).toBe(true);
  });
});

describe.each([
  ['the game', PAGE.game, 'ԴԱՍԱԿԱՆ'],
  ['the shop', PAGE.shop, 'ԽԱՆՈՒԹ'],
  ['an info page', PAGE.info, 'ԱՌԱՋԱՏԱՐՆԵՐ'],
])('%s page', (_name, id, opener) => {
  it('is shown while open and hidden again once its close has finished (back arrow)', async () => {
    await renderApp();
    expect(page(root, id) ? hidden(id) : true).toBe(true); // never opened: not even mounted, or hidden
    await act(async () => menu(root).findAll((n: any) => n.props.accessibilityLabel === opener && n.props.onPress)[0].props.onPress());
    expect(visible(id)).toBe(true); // shown at once, before the slide starts
    await advance(1000);
    expect(pageShown(root, id)).toBe(true);
    await act(async () => page(root, id).findAll((n: any) => n.props.accessibilityLabel === 'Հետ' && n.props.onPress)[0].props.onPress());
    expect(visible(id)).toBe(true); // still shown while it slides out
    await advance(1000);
    expect(hidden(id)).toBe(true);
    expect(pageShown(root, id)).toBe(false);
  });

  it('Android back closes it, then it is hidden', async () => {
    await renderApp();
    await pressLabel(root, opener, menu(root));
    await pressBack();
    expect(hidden(id)).toBe(true);
  });

  it('the iOS edge swipe closes it: shown during the drag, hidden after', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderApp();
    await pressLabel(root, opener, menu(root));
    const view = page(root, id);
    const { width } = Dimensions.get('window');
    // A synthetic finger for PanResponder: it sums each event's move from the
    // previous position, so `previousPageX` is where the last event left it.
    let t = 1000;
    let lastX = 4;
    const touch = (x: number) => {
      t += 16;
      const record = { touchActive: true, startPageX: 4, startPageY: 300, startTimeStamp: 1000, currentPageX: x, currentPageY: 300, currentTimeStamp: t, previousPageX: lastX, previousPageY: 300, previousTimeStamp: t - 16 };
      lastX = x;
      return record;
    };
    const event = (x: number, active = true) => ({
      nativeEvent: { touches: active ? [{}] : [], changedTouches: [{}], pageX: x, pageY: 300, timestamp: t },
      touchHistory: { numberActiveTouches: active ? 1 : 0, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t, touchBank: [{ ...touch(x), touchActive: active }] },
    });
    expect(4).toBeLessThan(PAGE_SWIPE_EDGE_ZONE);
    await act(async () => {
      // The responder system's order: start capture, then each move's capture
      // phase (where PanResponder updates the gesture) before the bubble phase.
      view.props.onStartShouldSetResponderCapture(event(4));
      const firstMove = event(40);
      view.props.onMoveShouldSetResponderCapture(firstMove);
      expect(view.props.onMoveShouldSetResponder(firstMove)).toBe(true);
      view.props.onResponderGrant(firstMove);
      view.props.onResponderMove(event(width * 0.4));
    });
    expect(visible(id)).toBe(true); // the page shows under the finger
    await act(async () => view.props.onResponderRelease(event(width * 0.8, false)));
    await advance(1000);
    expect(hidden(id)).toBe(true);
    expect(pageShown(root, id)).toBe(false);
  });
});
