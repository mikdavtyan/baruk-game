// Hint and Darts inventory: 3 + 3 to start (also for saves from before it
// existed), used before coins, with a red count badge while any are left;
// at 0 the coin price applies, and if that isn't affordable a tap opens the
// shop. Using an item and keeping what it bought is one atomic write.
// Harness copied from App.persistence.test.tsx.
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import Board from './components/Board';
import BottomControls from './components/BottomControls';
import KeyboardKey from './components/KeyboardKey';
import PowerUpButton from './components/PowerUpButton';
import SubmitButton from './components/SubmitButton';
import { WIN_FLOW_CONFIG } from './constants/winFlow';
import { letterLabel } from './lib/letterDisplay';
import { tokenizeArmenianWord } from './lib/tokenizeArmenian';
import { unmemo } from './test-utils/unmemo';
import { tapKey } from './test-utils/keyboardTouch';

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

// All valid words against գարուն: դպրոց finds ր (index 2; its ո is not the
// ու token), բետոն finds ն (index 4). The rest share no token at all.
const LOSING_GUESSES = ['դպրոց', 'բետոն', 'բդեշխ', 'բեկել', 'բեհեզ', 'բեղիկ'];

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

async function pressKey(token: string) {
  await act(async () => {
    tapKey(root, letterLabel(token));
  });
}

async function submitWord(word: string) {
  for (const token of tokenizeArmenianWord(word)) await pressKey(token);
  await act(async () => {
    root.root.findByType(SubmitButton).props.onPress();
  });
  await advance(1000); // past ROW_REVEAL_DURATION_MS
}

async function loseRound(words = LOSING_GUESSES) {
  for (const word of words) await submitWord(word);
  await advance(1000); // LOSS_MODAL_DELAY_MS, then the second-chance modal or the result
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
const button = (label: 'Hint' | 'Darts') => root.root.findAll((n: any) => n.type === PowerUpButton && n.props.label === label)[0];
// What the button shows: its red count badge (or null) and whether the coin price is visible.
const badge = (label: 'Hint' | 'Darts') => {
  const found = button(label).findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'inventory-badge');
  return found.length ? found[0].findAllByType(Text)[0].props.children : null;
};
const priceShown = (label: 'Hint' | 'Darts') =>
  button(label).findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'power-up-price').length > 0;
const tap = async (label: 'Hint' | 'Darts') => {
  await act(async () => {
    root.root.findAll((n: any) => n.props.label === label && n.props.onPress)[0].props.onPress();
  });
  await advance(1000);
};
const ghosts = () => root.root.findByType(unmemo(Board)).props.ghostHints;
const grayKeys = () =>
  root.root.findAllByType(unmemo(KeyboardKey)).filter((k: any) => !k.props.icon && k.props.state === 'absent').length;
const shopShown = () => root.root.findAll((n: any) => typeof n.type === 'string' && n.props.children === 'ԽԱՆՈՒԹ').length > 0;
const setInventory = (hint: number, darts: number) =>
  AsyncStorage.setItem('wordle:inventory', JSON.stringify({ hint, darts }));

beforeEach(async () => {
  await AsyncStorage.setItem('wordle:coins', JSON.stringify(1000));
});

describe('starting inventory', () => {
  it('a fresh install starts with 3 Hints and 3 Darts, shown as badges with the price hidden', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('wordle:rulesSeen', 'true');
    await renderApp();
    expect([badge('Hint'), badge('Darts')]).toEqual([3, 3]);
    expect([priceShown('Hint'), priceShown('Darts')]).toEqual([false, false]);
  });

  it('a save from before the inventory existed also gets 3 and 3', async () => {
    await AsyncStorage.multiSet([['wordle:points', '250'], ['wordle:streak', JSON.stringify({ current: 4, best: 6 })]]);
    await renderApp();
    expect([badge('Hint'), badge('Darts')]).toEqual([3, 3]);
  });
});

describe('using an item', () => {
  it('Hint with items left uses one item and charges no coins', async () => {
    await renderApp();
    await submitWord('դպրոց');
    await tap('Hint');
    expect(ghosts()).toHaveLength(1);
    expect(badge('Hint')).toBe(2);
    expect(await stored('wordle:inventory')).toEqual({ hint: 2, darts: 3 });
    expect(await stored('wordle:coins')).toBe(1000);
  });

  it('Darts with items left uses one item and charges no coins', async () => {
    await renderApp();
    await submitWord('դպրոց'); // 4 gray
    await tap('Darts');
    expect(grayKeys()).toBe(4 + 3);
    expect(badge('Darts')).toBe(2);
    expect(await stored('wordle:inventory')).toEqual({ hint: 3, darts: 2 });
    expect(await stored('wordle:coins')).toBe(1000);
  });

  it('a use that reveals nothing uses no item', async () => {
    await renderApp();
    await submitWord('դպրոց'); // ր known at index 2
    for (const token of ['ա', 'բ', 'գ', 'դ', 'ե']) await pressKey(token); // a full row: no room for a hint
    await tap('Hint');
    expect(badge('Hint')).toBe(3);
    expect(ghosts()).toHaveLength(0);
    expect(await AsyncStorage.getItem('wordle:inventory')).toBeNull(); // nothing was written
  });

  it('the inventory survives a relaunch', async () => {
    await renderApp();
    await submitWord('դպրոց');
    await tap('Hint');
    await relaunch();
    expect(badge('Hint')).toBe(2);
    expect(ghosts()).toHaveLength(1);
  });
});

describe('at 0', () => {
  it('the badge goes, the price shows, and using it charges coins as before', async () => {
    await setInventory(0, 0);
    await renderApp();
    expect([badge('Hint'), badge('Darts')]).toEqual([null, null]);
    expect([priceShown('Hint'), priceShown('Darts')]).toEqual([true, true]);
    await submitWord('դպրոց');
    await tap('Hint');
    expect(ghosts()).toHaveLength(1);
    expect(await stored('wordle:coins')).toBe(1000 - WIN_FLOW_CONFIG.hintPrice);
    expect(await stored('wordle:inventory')).toEqual({ hint: 0, darts: 0 });
  });

  it('not enough coins: the button is not disabled, and a tap opens the shop instead', async () => {
    await setInventory(0, 0);
    await AsyncStorage.setItem('wordle:coins', JSON.stringify(WIN_FLOW_CONFIG.dartsPrice - 1));
    await renderApp();
    await submitWord('դպրոց');
    const controls = root.root.findByType(unmemo(BottomControls)).props;
    expect([controls.hintDisabled, controls.dartsDisabled]).toEqual([false, false]);

    await tap('Hint');
    expect(shopShown()).toBe(true);
    expect(ghosts()).toHaveLength(0);
    expect(await stored('wordle:coins')).toBe(WIN_FLOW_CONFIG.dartsPrice - 1);
  });

  it('a locked game still disables both buttons', async () => {
    await renderApp();
    await loseRound(); // the round is over
    const controls = root.root.findByType(unmemo(BottomControls)).props;
    expect([controls.hintDisabled, controls.dartsDisabled]).toEqual([true, true]);
  });
});

describe('a crash while an item is used', () => {
  // The use: the one write that saves the inventory together with the round.
  const isItemUse = (keys: string[]) => keys.includes('wordle:inventory') && keys.includes('wordle:round');

  it.each([
    ['right after', false, 2, 1],
    ['just before', true, 3, 0],
  ])('%s the write, a relaunch shows a consistent count and effect', async (_when, before, count, ghostCount) => {
    await renderApp();
    await submitWord('դպրոց');
    const relaunchAfterCrash = crashAfterWrites(isItemUse, { before: before as boolean });
    await tap('Hint');
    await relaunchAfterCrash();
    expect(badge('Hint')).toBe(count);
    expect(ghosts()).toHaveLength(ghostCount as number);
    expect(await stored('wordle:coins')).toBe(1000);
  });
});
