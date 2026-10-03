// The main screen's tab bar: ԽԱՆՈՒԹ, ԱՆԻՎ, ՄԵՆՅՈՒ (Home, the center, where the
// app opens), ԱՌԱՋԱԴՐԱՆՔՆԵՐ, ԱՌԱՋԱՏԱՐՆԵՐ. The active tab is selected and shows
// its name; inactive tabs show no text and their content is display:'none'
// once the switch is over (never hidden by transform/opacity alone). Settings
// is a push page from Home's gear; Classic a push page over everything.
import React from 'react';
import { AccessibilityInfo, Animated, BackHandler, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import ShopScreen from './components/ShopScreen';
import { MENU_BG_TILES } from './constants/theme';
import { letterLabel } from './lib/letterDisplay';
import { tapKey } from './test-utils/keyboardTouch';
import {
  menu,
  openClassic,
  page,
  PAGE,
  pageShown,
  pressable,
  pressLabel,
  selectTab,
  TAB,
  TabId,
  tabBar,
  tabContent,
  tabShown,
} from './test-utils/navigation';
import { unmemo } from './test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.setTimeout(30000);

const BAG = ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'];
const TABS = Object.keys(TAB) as TabId[];
let root: any;
type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackPressHandler[] = [];

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ['wordle:rulesSeen', 'true'],
    ['wordle:wordBag', JSON.stringify({ order: BAG, pos: 0 })],
    ['wordle:coins', JSON.stringify(1000)],
  ]);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
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
  await advance(50);
  const layoutViews = root.root.findAll((n: any) => typeof n.props.onLayout === 'function');
  await act(async () => {
    layoutViews.forEach((v: any) => v.props.onLayout({ nativeEvent: { layout: { width: 350, height: 400 } } }));
  });
  await advance(300);
}
const pressBack = async () => {
  let handled: boolean | null | undefined;
  await act(async () => {
    handled = [...backHandlers].reverse().reduce<boolean | null | undefined>((done, h) => done || h({} as any), false);
  });
  await advance(1000);
  return handled;
};
const textsIn = (node: any): string[] => node.findAllByType(Text).map((t: any) => [].concat(t.props.children).join(''));
const tabButton = (tab: TabId) =>
  tabBar(root).find((n: any) => typeof n.type === 'string' && n.props.accessibilityLabel === TAB[tab] && n.props.accessibilityRole === 'tab');
const selected = (tab: TabId) => tabButton(tab).props.accessibilityState?.selected === true;
const shownTabs = () => TABS.filter((t) => tabShown(root, t));
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) as string);

it('opens on Home, with the bar visible and only Home selected and labelled', async () => {
  await renderApp();
  expect(tabBar(root)).toBeTruthy();
  expect(shownTabs()).toEqual(['home']);
  expect(TABS.filter(selected)).toEqual(['home']);
  expect(textsIn(tabBar(root))).toEqual(['ՄԵՆՅՈՒ']); // only the active tab's name
  expect(menu(root)).toBeTruthy(); // Home is the menu
});

it.each(TABS.filter((t) => t !== 'home'))(
  'the %s tab shows its content, is selected and labelled, and every other tab is display:none after the switch',
  async (tab) => {
    await renderApp();
    await selectTab(root, tab);
    expect(shownTabs()).toEqual([tab]);
    expect(TABS.filter(selected)).toEqual([tab]);
    expect(textsIn(tabBar(root))).toEqual([TAB[tab]]);
    expect(tabBar(root)).toBeTruthy(); // always there
    expect(tabShown(root, 'home')).toBe(false); // mounted, kept, but display:none
    expect(tabContent(root, 'home')).toBeTruthy();
  },
);

it('the empty tabs show only their title — no back arrow, no placeholder', async () => {
  await renderApp();
  for (const [tab, title] of [
    ['wheel', 'ԲԱԽՏԻ ԱՆԻՎ'],
    ['tasks', 'ԱՌԱՋԱԴՐԱՆՔՆԵՐ'],
    ['leaders', 'ԱՌԱՋԱՏԱՐՆԵՐ'],
  ] as const) {
    await selectTab(root, tab);
    expect(textsIn(tabContent(root, tab))).toEqual([title]);
    expect(tabContent(root, tab).findAll((n: any) => n.props.accessibilityLabel === 'Հետ')).toHaveLength(0);
  }
});

it('tabs mount on their first visit and stay mounted', async () => {
  await renderApp();
  expect(tabContent(root, 'shop')).toBeUndefined();
  await selectTab(root, 'shop');
  await selectTab(root, 'home');
  expect(tabContent(root, 'shop')).toBeTruthy();
  expect(tabShown(root, 'shop')).toBe(false);
});

it('the shop tab is the shop without a back arrow, and buys exactly like the shop page', async () => {
  await renderApp();
  await selectTab(root, 'shop');
  const shop = tabContent(root, 'shop');
  expect(shop.findAllByType(unmemo(ShopScreen))).toHaveLength(1);
  expect(shop.findAll((n: any) => n.props.accessibilityLabel === 'Հետ')).toHaveLength(0);
  await pressLabel(root, 'Գնել 1 ՀՈՒՇՈՒՄ', shop);
  expect(await stored('wordle:coins')).toBe(900);
  expect(await stored('wordle:inventory')).toEqual({ hint: 4, darts: 3 });
});

it('the coin pill on Home switches to the Shop tab', async () => {
  await renderApp();
  await pressLabel(root, 'Խանութ', menu(root));
  expect(shownTabs()).toEqual(['shop']);
  expect(selected('shop')).toBe(true);
  expect(page(root, PAGE.shop) ? pageShown(root, PAGE.shop) : false).toBe(false); // not the push page
});

it("the gear on Home opens Settings as a page, and its back arrow closes it", async () => {
  await renderApp();
  await pressLabel(root, 'ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ', menu(root));
  expect(pageShown(root, PAGE.settings)).toBe(true);
  expect(textsIn(page(root, PAGE.settings))).toEqual(['ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ']);
  await pressLabel(root, 'Հետ', page(root, PAGE.settings));
  expect(pageShown(root, PAGE.settings)).toBe(false);
  expect(shownTabs()).toEqual(['home']);
});

it('Classic opens over the tabs (the bar covered and inert) and returns to Home', async () => {
  await renderApp();
  await openClassic(root);
  expect(pageShown(root, PAGE.game)).toBe(true);
  const tabsLayer = root.root.find(
    (n: any) => typeof n.type === 'string' && n.props.pointerEvents && n.findAll((c: any) => c.props.testID === 'tab-bar').length > 0,
  );
  expect(tabsLayer.props.pointerEvents).toBe('none');
  expect(tabsLayer.props.accessibilityElementsHidden).toBe(true);
  await act(async () => tapKey(root, letterLabel('ա')));
  await pressLabel(root, 'Հետ', page(root, PAGE.game));
  expect(pageShown(root, PAGE.game)).toBe(false);
  expect(shownTabs()).toEqual(['home']);
  expect(selected('home')).toBe(true);
});

it('inside the game, the coin pill still opens the shop page over the game', async () => {
  await renderApp();
  await openClassic(root);
  await pressLabel(root, 'Խանութ', page(root, PAGE.game));
  expect(pageShown(root, PAGE.shop)).toBe(true);
  expect(page(root, PAGE.shop).findAll((n: any) => n.props.accessibilityLabel === 'Հետ' && n.props.onPress).length).toBeGreaterThan(0);
});

it('Android back on another tab goes to Home; on Home it is not handled (the app exits)', async () => {
  await renderApp();
  await selectTab(root, 'leaders');
  expect(await pressBack()).toBe(true);
  expect(shownTabs()).toEqual(['home']);
  expect(selected('home')).toBe(true);
  expect(await pressBack()).toBeFalsy();
});

it('a page over Home still handles Android back first', async () => {
  await renderApp();
  await pressLabel(root, 'ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ', menu(root));
  expect(await pressBack()).toBe(true);
  expect(pageShown(root, PAGE.settings)).toBe(false);
  expect(shownTabs()).toEqual(['home']);
});

describe('the menu background runs only on Home', () => {
  let loops: { started: number; stopped: number }[];
  beforeEach(() => {
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
      return { ...loop, start: (cb?: any) => (record.started++, loop.start(cb)), stop: () => (record.stopped++, loop.stop()) };
    });
  });
  const running = () => loops.filter((l) => l.started > 0 && l.stopped === 0).length;

  it('pauses on another tab and resumes back on Home', async () => {
    await renderApp();
    expect(running()).toBe(MENU_BG_TILES.length);
    await selectTab(root, 'tasks');
    expect(running()).toBe(0);
    await selectTab(root, 'home');
    expect(running()).toBe(MENU_BG_TILES.length);
  });
});

it('reduced motion switches tabs instantly: the old tab is display:none at once', async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  await renderApp();
  await act(async () => {
    pressable(tabBar(root), TAB.wheel).props.onPress();
  });
  expect(shownTabs()).toEqual(['wheel']); // no timers advanced
  expect(selected('wheel')).toBe(true);
});
