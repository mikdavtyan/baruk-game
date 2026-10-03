// The shop page's contents: the live balance, what the player holds, item
// packs bought with coins (one atomic write), a daily-limited "watch an ad"
// coin reward, and coming-soon coin packs. Harness copied from
// App.inventory.test.tsx.
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import ShopScreen from './components/ShopScreen';
import Toast from './components/Toast';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

// The secret-word pool, in bag order: round 1's word is գարուն.
const BAG_ORDER = ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'];
jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
// RN's jest preset mocks measureInWindow as a bare jest.fn() that never calls
// back, so an awaited measureWindow() (WinFlow's celebration) would hang
// forever. Resolving null exercises the flows' real "couldn't measure" path.
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);


// Six full guesses through the real UI plus the flows' delays.
jest.setTimeout(60000);

let root: any;

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('wordle:rulesSeen', 'true'); // past the first launch's rules popup
  await AsyncStorage.setItem('wordle:wordBag', JSON.stringify({ order: BAG_ORDER, pos: 0 }));
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

// Stepped, flushing promises between steps: WinFlow/LossFlow chain
// `await new Promise(r => setTimeout(r, …))`, so each next timer is only
// scheduled once the previous one's continuation has run.
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
  await advance(50); // the word bag loads from AsyncStorage
  // react-test-renderer never fires onLayout; Board needs it to render.
  // (Fires every onLayout — the board area's among them.)
  const layoutViews = root.root.findAll((n: any) => typeof n.props.onLayout === 'function');
  await act(async () => {
    layoutViews.forEach((v: any) => v.props.onLayout({ nativeEvent: { layout: { width: 350, height: 400 } } }));
  });
}


// Simulates the app being killed mid-save: the next `writes` storage writes
// land, and every later one is silently dropped, as if the process had died
// before it. (All of the mock's writes go through these three.) Returns the
// relaunch: storage works again and App mounts fresh over what was saved.
//
// `at` is either a count of writes, or a match on the keys a write touches:
// writes land up to and including the first matching one (or up to just
// before it, with `before: true`), and every later write is dropped.
function crashAfterWrites(at: number | ((keys: string[]) => boolean), { before = false } = {}) {
  let crashed = false;
  let written = 0;
  const lands = (keys: string[]) => {
    if (crashed) return false;
    written += 1;
    if (typeof at === 'number' ? written < at : !at(keys)) return true;
    crashed = true; // this is the write the crash happens around
    return !before;
  };
  // The mock's methods are already jest.fn()s, so wrap their implementations
  // (spyOn would hand back the same mock) and put them back on relaunch.
  const restores = (['multiSet', 'multiRemove', 'multiMerge'] as const).map((method) => {
    const mock = (AsyncStorage as any)[method] as jest.Mock;
    const original = mock.getMockImplementation()!;
    mock.mockImplementation((...args: any[]) => {
      // multiRemove takes keys; multiSet / multiMerge take [key, value] pairs.
      const keys = (args[0] as any[]).map((entry) => (Array.isArray(entry) ? entry[0] : entry));
      return lands(keys) ? original(...args) : new Promise(() => {});
    });
    return () => mock.mockImplementation(original);
  });
  return async () => {
    restores.forEach((restore) => restore());
    // A matched write that never came means the crash this test is about
    // never happened — fail rather than pass without testing anything.
    if (typeof at !== 'number' && !crashed) throw new Error('crashAfterWrites: no write matched the crash point');
    await act(async () => root.unmount());
    await renderApp();
  };
}


const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) as string);
const relaunch = async () => {
  await act(async () => root.unmount());
  await renderApp();
};
const shop = () => root.root.findByType(ShopScreen);
// The text a host element (by testID) inside the shop page shows.
const textOf = (testID: string) => {
  const node = shop().findAll((n: any) => typeof n.type === 'string' && n.props.testID === testID)[0];
  const text = node.findAllByType(Text)[0].props.children;
  return Array.isArray(text) ? text.join('') : String(text);
};
const toasts = () => shop().findAllByType(Toast).map((t: any) => t.props.message);
const pressInShop = async (label: string) => {
  await act(async () => {
    shop().findAll((n: any) => n.props.accessibilityLabel === label && n.props.onPress)[0].props.onPress();
  });
  await advance(1500); // purchases are instant; the stub ad takes AD_FAKE_LOAD_MS
};
const openShop = async () => {
  await act(async () => {
    root.root.findAll((n: any) => n.props.accessibilityLabel === 'Խանութ' && n.props.onPress)[0].props.onPress();
  });
  await advance(1000);
};
const TODAY = new Date(2026, 9, 3, 12, 0, 0); // a local noon, 3 Oct 2026
const TODAY_KEY = '2026-10-03';

beforeEach(async () => {
  jest.setSystemTime(TODAY);
  await AsyncStorage.setItem('wordle:coins', JSON.stringify(1000));
});

it('the top bar shows the live balance, and the inventory section what the player holds', async () => {
  await renderApp();
  await openShop();
  expect(textOf('shop-balance')).toBe('1000');
  expect([textOf('shop-own-hint'), textOf('shop-own-darts')]).toEqual(['3', '3']);
});

describe('item packs', () => {
  it.each([
    ['1 ՀՈՒՇՈՒՄ', 100, { hint: 4, darts: 3 }],
    ['5 ՀՈՒՇՈՒՄ', 400, { hint: 8, darts: 3 }],
    ['1 ՆԵՏ', 50, { hint: 3, darts: 4 }],
    ['5 ՆԵՏ', 200, { hint: 3, darts: 8 }],
  ])('buying %s costs %i coins and adds it to the inventory', async (pack, price, inventory) => {
    await renderApp();
    await openShop();
    await pressInShop(`Գնել ${pack}`);
    expect(await stored('wordle:coins')).toBe(1000 - (price as number));
    expect(await stored('wordle:inventory')).toEqual(inventory);
    expect(textOf('shop-balance')).toBe(String(1000 - (price as number)));
    expect(textOf('shop-own-hint')).toBe(String((inventory as any).hint));
  });

  it('the 5-packs show a -20% tag', async () => {
    await renderApp();
    await openShop();
    const tags = shop().findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'pack-discount');
    expect(tags.map((t: any) => t.findAllByType(Text)[0].props.children)).toEqual(['-20%', '-20%']);
  });

  it('an unaffordable pack shows the toast and changes nothing', async () => {
    await AsyncStorage.setItem('wordle:coins', JSON.stringify(60));
    await renderApp();
    await openShop();
    await pressInShop('Գնել 1 ՀՈՒՇՈՒՄ');
    expect(toasts()).toEqual(['ԲԱՎԱՐԱՐ ՄԵՏԱՂԱԴՐԱՄ ՉԿԱ']);
    expect(await stored('wordle:coins')).toBe(60);
    expect(await AsyncStorage.getItem('wordle:inventory')).toBeNull();
  });

  it.each([
    ['right after', false, 1000 - 400, { hint: 8, darts: 3 }],
    ['just before', true, 1000, null],
  ])('a crash %s the purchase write: a relaunch shows both changes or neither', async (_when, before, coins, inventory) => {
    await renderApp();
    await openShop();
    const isPurchase = (keys: string[]) => keys.includes('wordle:coins') && keys.includes('wordle:inventory');
    const relaunchAfterCrash = crashAfterWrites(isPurchase, { before: before as boolean });
    await pressInShop('Գնել 5 ՀՈՒՇՈՒՄ');
    await relaunchAfterCrash();
    expect(await stored('wordle:coins')).toBe(coins);
    expect(await stored('wordle:inventory')).toEqual(inventory);
  });
});

describe('the ad reward', () => {
  it('gives +50 and counts down what is left today, saved together', async () => {
    await renderApp();
    await openShop();
    expect(textOf('ad-left')).toBe('5/5');
    await pressInShop('Դիտել գովազդ');
    expect(await stored('wordle:coins')).toBe(1050);
    expect(await stored('wordle:adRewards')).toEqual({ day: TODAY_KEY, count: 1 });
    expect(textOf('ad-left')).toBe('4/5');
  });

  it('a double tap while the ad is loading pays once', async () => {
    await renderApp();
    await openShop();
    const adCard = () => shop().findAll((n: any) => n.props.accessibilityLabel === 'Դիտել գովազդ' && n.props.onPress)[0];
    await act(async () => {
      adCard().props.onPress();
      adCard().props.onPress();
    });
    await advance(1500);
    expect(await stored('wordle:coins')).toBe(1050);
  });

  it('stops at 5 a day with the toast', async () => {
    await AsyncStorage.setItem('wordle:adRewards', JSON.stringify({ day: TODAY_KEY, count: 5 }));
    await renderApp();
    await openShop();
    expect(textOf('ad-left')).toBe('0/5');
    await pressInShop('Դիտել գովազդ');
    expect(toasts()).toEqual(['ԱՅՍՕՐՎԱ ԳՈՎԱԶԴՆԵՐԸ ՍՊԱՌՎԵԼ ԵՆ']);
    expect(await stored('wordle:coins')).toBe(1000);
  });

  it('resets on a new local day', async () => {
    await AsyncStorage.setItem('wordle:adRewards', JSON.stringify({ day: '2026-10-02', count: 5 }));
    await renderApp();
    await openShop();
    expect(textOf('ad-left')).toBe('5/5');
    await pressInShop('Դիտել գովազդ');
    expect(await stored('wordle:adRewards')).toEqual({ day: TODAY_KEY, count: 1 });
  });

  it('what is left today survives a relaunch', async () => {
    await renderApp();
    await openShop();
    await pressInShop('Դիտել գովազդ');
    await relaunch();
    await openShop();
    expect(textOf('ad-left')).toBe('4/5');
  });
});

it('the real-money coin packs are coming soon and do nothing', async () => {
  await renderApp();
  await openShop();
  const packs = shop().findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'coin-pack');
  expect(packs).toHaveLength(3);
  for (const pack of packs) {
    expect(pack.findAll((n: any) => n.props.onPress)).toHaveLength(0);
    expect(pack.findAllByType(Text).map((t: any) => t.props.children)).toContain('ՇՈՒՏՈՎ');
  }
});
