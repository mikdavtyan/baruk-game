// Typing through the real App with finger touches on the keyboard surface:
// a letter lands on TOUCH DOWN, "ու" is one token, a locked game ignores
// touches, and ԸՆԴՈՒՆԵԼ (like every other button) still fires on release.
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import SubmitButton from './components/SubmitButton';
import Tile from './components/Tile';
import { ROW_REVEAL_DURATION_MS } from './constants/theme';
import { letterLabel } from './lib/letterDisplay';
import { fingerOn, tapKey, touchEnd, touchStart } from './test-utils/keyboardTouch';
import { unmemo } from './test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

const WORDS = ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'];
jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let root: any;

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('wordle:rulesSeen', 'true');
  await AsyncStorage.setItem('wordle:wordBag', JSON.stringify({ order: WORDS, pos: 0 })); // secret: գարուն
});
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
});

const advance = async (ms: number) => {
  for (let t = 0; t < ms; t += 10) {
    await act(async () => {
      jest.advanceTimersByTime(10);
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

// What each cell of row `row` holds (tokens; '' = empty).
const rowLetters = (row: number) =>
  root.root
    .findAllByType(unmemo(Tile))
    .slice(row * 5, row * 5 + 5)
    .map((t: any) => t.props.letter);

const type = async (word: string[]) => {
  for (const token of word) {
    await act(async () => tapKey(root, letterLabel(token)));
  }
};

it('a letter lands on the board on touch down, before the finger lifts', async () => {
  await renderApp();
  const finger = fingerOn(letterLabel('բ'));
  await act(async () => touchStart(root, finger));
  expect(rowLetters(0)).toEqual(['բ', '', '', '', '']);
  await act(async () => touchEnd(root, finger));
  expect(rowLetters(0)).toEqual(['բ', '', '', '', '']);
});

it('the "ու" key inserts one token, into one cell', async () => {
  await renderApp();
  await type(['գ', 'ու']);
  expect(rowLetters(0)).toEqual(['գ', 'ու', '', '', '']);
});

it('a locked game (a row revealing) ignores touches', async () => {
  await renderApp();
  await type(['բ', 'ե', 'տ', 'ո', 'ն']);
  await act(async () => root.root.findByType(SubmitButton).props.onPress());
  await act(async () => tapKey(root, letterLabel('ա'))); // mid-reveal
  await advance(ROW_REVEAL_DURATION_MS + 200);
  expect(rowLetters(1)).toEqual(['', '', '', '', '']);
  await act(async () => tapKey(root, letterLabel('ա'))); // unlocked again
  expect(rowLetters(1)).toEqual(['ա', '', '', '', '']);
});

it('ԸՆԴՈՒՆԵԼ fires on release only: pressing it in submits nothing', async () => {
  await renderApp();
  await type(['բ', 'ե', 'տ', 'ո', 'ն']);
  const pressable = root.root
    .findByType(SubmitButton)
    .findAll((n: any) => typeof n.props.onPressIn === 'function' && typeof n.props.onPress === 'function')[0];
  await act(async () => pressable.props.onPressIn());
  await advance(ROW_REVEAL_DURATION_MS + 200);
  expect(rowLetters(0).every((t: string) => t !== '')).toBe(true);
  expect(root.root.findAllByType(unmemo(Tile)).slice(0, 5).map((t: any) => t.props.state)).toEqual(
    Array(5).fill('filled'), // still being typed, not scored
  );
  await act(async () => pressable.props.onPressOut());
  await act(async () => pressable.props.onPress());
  await advance(ROW_REVEAL_DURATION_MS + 200);
  expect(root.root.findAllByType(unmemo(Tile))[0].props.state).not.toBe('filled');
});
