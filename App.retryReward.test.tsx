// After a loss retry: a win pays half the coins (points and streak as
// usual), also after a relaunch at the reward step or mid-retry, and the
// letters carried over from the lost board look different from Hint ghosts.
// Harness copied from App.persistence.test.tsx.
import React from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import KeyboardKey from './components/KeyboardKey';
import RewardModal from './components/RewardModal';
import SecondChanceModal from './components/SecondChanceModal';
import SubmitButton from './components/SubmitButton';
import Tile from './components/Tile';
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

async function retryByAd() {
  await act(async () => {
    root.root.findByType(SecondChanceModal).props.onAdRetrySucceeded();
  });
  await advance(1000);
}

const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) as string);


const keyState = (token: string) =>
  root.root.findAll((n: any) => n.type === unmemo(KeyboardKey) && n.props.label === letterLabel(token))[0].props.state;
const relaunch = async () => {
  await act(async () => root.unmount());
  await renderApp();
};
const REWARD_1 = WIN_FLOW_CONFIG.rewardsByGuessCount[0]; // won in 1 guess
const HALF_1 = Math.floor(REWARD_1 / 2);

// Something to save (so the loss offers Try again) and some coins.
beforeEach(async () => {
  await AsyncStorage.multiSet([
    ['wordle:points', JSON.stringify(100)],
    ['wordle:streak', JSON.stringify({ current: 2, best: 4 })],
    ['wordle:coins', JSON.stringify(1000)],
  ]);
});

const winInOne = async () => {
  await submitWord('գարուն');
  await advance(3000); // celebration, then the reward modal
};
const reward = () => root.root.findByType(RewardModal).props;
const skipAd = async () => {
  await act(async () => {
    reward().onNext(reward().baseReward);
  });
  await advance(1000);
};

describe('a win after a retry pays half the coins', () => {
  it('without the ad: the modal shows half and half is credited; points and streak as usual', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();
    await winInOne();

    expect(reward().baseReward).toBe(HALF_1);
    await skipAd();
    expect(await stored('wordle:coins')).toBe(1000 + HALF_1);
    expect(await stored('wordle:points')).toBe(100 + WIN_FLOW_CONFIG.pointsByGuessCount[0]);
    expect(await stored('wordle:streak')).toEqual({ current: 3, best: 4 });
  });

  it('with the ad: the multiplier applies to the halved base', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();
    await winInOne();

    await act(async () => {
      root.root.findAll((n: any) => n.props.accessibilityLabel === 'Watch an ad for x3 coins' && n.props.onPress)[0].props.onPress();
    });
    await advance(2000); // the (stub) ad, then the credit
    expect(await stored('wordle:coins')).toBe(1000 + HALF_1 * WIN_FLOW_CONFIG.adRewardMultiplier);
  });

  it('after a relaunch at the reward step, the same halved amount is shown and credited', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();
    await winInOne();
    await relaunch();

    expect(reward().baseReward).toBe(HALF_1);
    await skipAd();
    expect(await stored('wordle:coins')).toBe(1000 + HALF_1);
  });

  it('after a relaunch mid-retry, a win still pays half', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();
    await relaunch();
    await winInOne();

    expect(reward().baseReward).toBe(HALF_1);
    await skipAd();
    expect(await stored('wordle:coins')).toBe(1000 + HALF_1);
  });

  it('a win without a retry still pays the full amount', async () => {
    await renderApp();
    await winInOne();
    expect(reward().baseReward).toBe(REWARD_1);
    await skipAd();
    expect(await stored('wordle:coins')).toBe(1000 + REWARD_1);
  });
});

it('letters carried over from the lost board look different from Hint ghosts', async () => {
  await renderApp();
  await loseRound(); // ր (index 2) and ն (index 4) were found green
  await retryByAd();
  await act(async () => {
    root.root.findAll((n: any) => n.props.label === 'Hint' && n.props.onPress)[0].props.onPress();
  });
  await advance(100);

  const tiles = root.root.findAllByType(unmemo(Tile)).slice(0, 5);
  const kinds = tiles.map((t: any) => (t.props.ghostLetter ? t.props.ghostKind : null));
  expect(kinds.filter((k: any) => k === 'carried')).toHaveLength(2);
  expect(kinds[2]).toBe('carried');
  expect(kinds[4]).toBe('carried');
  expect(kinds.filter((k: any) => k === 'hint')).toHaveLength(1);

  // What differs on screen: the carried letter is at full strength, the
  // Hint ghost stays pale.
  const opacityOf = (testID: string) =>
    root.root.findAll((n: any) => typeof n.type === 'string' && n.props.testID === testID).map((n: any) => StyleSheet.flatten(n.props.style).opacity ?? 1);
  expect(opacityOf('ghost-carried')).toEqual([1, 1]);
  expect(opacityOf('ghost-hint')).toEqual([expect.any(Number)]);
  expect(opacityOf('ghost-hint')[0]).toBeLessThan(1);
  expect(keyState('ն')).toBe('correct'); // the retry itself behaves as before
});
