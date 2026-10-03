// The loss retry (Try again) is offered whenever a retry is left for the
// word, even with nothing at stake (0 points, no streak). Then the
// second-chance modal is its "find the word" variant: the same title, the
// ՄԵԿ ՓՈՐՁ ԷԼ՝ ԲԱՌԸ ԳՏՆԵԼՈՒ ՀԱՄԱՐ subtitle, and a row of the letters found
// green anywhere on the lost board instead of the flame/points hero.
// Also guards the retry exit for both variants: the board resets and remounts
// under the opaque modal BEFORE its exit fade starts (the old "letters
// flicker on retry" bug).
import React from 'react';
import { Animated, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import Board from './components/Board';
import Flame from './components/Flame';
import ResultModal from './components/ResultModal';
import RewardModal from './components/RewardModal';
import SecondChanceModal from './components/SecondChanceModal';
import SubmitButton from './components/SubmitButton';
import Tile from './components/Tile';
import { MODAL_EXIT_MS, WIN_FLOW_CONFIG } from './constants/winFlow';
import { letterLabel } from './lib/letterDisplay';
import { tokenizeArmenianWord } from './lib/tokenizeArmenian';
import { tapKey } from './test-utils/keyboardTouch';
import { unmemo } from './test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

const BAG_ORDER = ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'];
jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.setTimeout(60000);

// Against գարուն: ազդում finds ու (position 4), դպրոց finds ր (position 3);
// the other four share nothing in place. Found: _ _ ր ու _.
const LOSING_GUESSES = ['ազդում', 'դպրոց', 'բդեշխ', 'բեկել', 'բեհեզ', 'բեղիկ'];
const FOUND_ROW = ['', '', letterLabel('ր'), letterLabel('ու'), ''];
const CARRIED_ROW = ['', '', 'ghost:ր', 'ghost:ու', ''];
const SUBTITLE = 'ՄԵԿ ՓՈՐՁ ԷԼ՝ ԲԱՌԸ ԳՏՆԵԼՈՒ ՀԱՄԱՐ'; // ՝ = U+055D, the Armenian comma

let root: any;

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ['wordle:rulesSeen', 'true'],
    ['wordle:wordBag', JSON.stringify({ order: BAG_ORDER, pos: 0 })],
    ['wordle:coins', JSON.stringify(1000)],
  ]); // points and streak: none saved, so 0 and 0
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
}
async function submitWord(word: string) {
  for (const token of tokenizeArmenianWord(word)) {
    await act(async () => tapKey(root, letterLabel(token)));
  }
  await act(async () => root.root.findByType(SubmitButton).props.onPress());
  await advance(1000);
}
async function loseRound() {
  for (const word of LOSING_GUESSES) await submitWord(word);
  await advance(1000);
}
const modal = () => root.root.findByType(SecondChanceModal);
const retryByAd = async () => {
  await act(async () => modal().props.onAdRetrySucceeded());
  await advance(1000);
};
const retryByCoins = async () => {
  await act(async () => modal().props.onCoinRetry());
  await advance(1000);
};
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) as string);
const texts = (node: any) => node.findAllByType(Text).map((t: any) => [].concat(t.props.children).join(''));
// The variant's found-letters row: what each of its 5 tiles shows.
const foundRow = () =>
  root.root
    .findByProps({ testID: 'found-letters' })
    .findAll((n: any) => typeof n.props.testID === 'string' && n.props.testID.startsWith('found-letter-') && typeof n.type === 'string')
    .map((tile: any) => texts(tile).join(''));
const rowTiles = (row: number) => root.root.findAllByType(unmemo(Tile)).slice(row * 5, row * 5 + 5);
const rowDisplay = (row: number) =>
  rowTiles(row).map((t: any) => {
    const shown = t.findAllByType(Text)[0]?.props.children;
    if (t.props.letter) return t.props.letter;
    return t.props.ghostLetter && shown === letterLabel(t.props.ghostLetter) ? `ghost:${t.props.ghostLetter}` : '';
  });
const winInOne = async () => {
  await submitWord('գարուն');
  await advance(3000);
};

describe('a loss with nothing at stake (0 points, no streak)', () => {
  it('offers Try again', async () => {
    await renderApp();
    await loseRound();
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(0);
    expect(await stored('wordle:pendingLoss')).toMatchObject({ step: 'secondChance', pointsAtRisk: 0, streakAtRisk: 0 });
  });

  it('shows the "find the word" variant: same title, the subtitle and the found letters, no flame or points', async () => {
    await renderApp();
    await loseRound();
    const shown = texts(modal());
    expect(modal().props.titleText).toBe('ԱՓՍՈ՜Ս'); // the last guess has no green: the plain title
    expect(shown).toContain(SUBTITLE);
    expect(foundRow()).toEqual(FOUND_ROW); // ու in one tile
    expect(modal().findAllByType(Flame)).toHaveLength(0);
  });

  it('a relaunch at the second-chance step shows the same variant and letters', async () => {
    await renderApp();
    await loseRound();
    await act(async () => root.unmount());
    await renderApp();
    await advance(1500);
    expect(texts(modal())).toContain(SUBTITLE);
    expect(foundRow()).toEqual(FOUND_ROW);
  });

  it('an ad retry works: the letters carry over, and a win then pays half the coins', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(rowDisplay(0)).toEqual(CARRIED_ROW);
    await winInOne();
    expect(root.root.findByType(RewardModal).props.baseReward).toBe(15); // half of a 1-guess win's 30
  });

  it('a coin retry works: charged once, the letters carry over', async () => {
    await renderApp();
    await loseRound();
    await retryByCoins();
    await advance(2000);
    expect(await stored('wordle:coins')).toBe(1000 - WIN_FLOW_CONFIG.retryCoinPrice);
    expect(rowDisplay(0)).toEqual(CARRIED_ROW);
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
  });

  it('declining goes to the loss result', async () => {
    await renderApp();
    await loseRound();
    await act(async () => modal().props.onDecline());
    await advance(1000);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(1);
    expect(await stored('wordle:points')).toBe(0);
    expect(await stored('wordle:pendingLoss')).toMatchObject({ step: 'lossResult' });
  });

  it('a second loss after the retry goes straight to the loss result', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();
    await loseRound();
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(1);
  });
});

it('a loss with points at stake shows the unchanged modal: the flame hero, no subtitle or found letters', async () => {
  await AsyncStorage.setItem('wordle:points', JSON.stringify(100));
  await renderApp();
  await loseRound();
  expect(modal().findAllByType(Flame)).toHaveLength(1);
  expect(texts(modal())).not.toContain(SUBTITLE);
  expect(root.root.findAllByProps({ testID: 'found-letters' })).toHaveLength(0);
});

// The moment the modal's exit fade starts (its MODAL_EXIT_MS fade to 0), the
// board must already be the fresh one: remounted, no lost letters in any row,
// only the carried ghosts on the active row.
describe.each([
  ['nothing at stake', null],
  ['points at stake', 100],
])('retry exit order (%s)', (_name, points) => {
  it.each([
    ['an ad retry', retryByAd],
    ['a coin retry', retryByCoins],
  ])('%s: the board is reset and remounted before the modal starts fading', async (_how, retry) => {
    if (points !== null) await AsyncStorage.setItem('wordle:points', JSON.stringify(points));
    await renderApp();
    await loseRound();
    const boardBefore = root.root.findByType(unmemo(Board));
    let atFadeStart: { remounted: boolean; rows: string[][] } | null = null;
    const realTiming = Animated.timing;
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      if (!atFadeStart && config.toValue === 0 && config.duration === MODAL_EXIT_MS) {
        atFadeStart = {
          remounted: root.root.findByType(unmemo(Board)) !== boardBefore,
          rows: [0, 1, 2, 3, 4, 5].map(rowDisplay),
        };
      }
      return realTiming(value, config);
    });
    await retry();
    expect(atFadeStart).toEqual({
      remounted: true,
      rows: [CARRIED_ROW, ...Array(5).fill(['', '', '', '', ''])],
    });
  });
});
