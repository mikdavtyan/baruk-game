// The Hint "magic flight": a green light flies from the Hint button to the
// target cell, the tile breathes, sparks burst and the ghost scales in. The
// hint itself is saved at tap time; the flight is purely visual (the ghost
// stays hidden until it lands), Submit is ignored meanwhile, and every
// fallback (reduced motion, unmeasurable layout, a board reset) lands safely.
// Harness copied from App.inventory.test.tsx.
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import Board from './components/Board';
import HintFlightOverlay from './components/HintFlightOverlay';
import LossFlow from './components/LossFlow';
import SubmitButton from './components/SubmitButton';
import Tile from './components/Tile';
import { HINT_FLIGHT_MS, HINT_REDUCED_FADE_MS, HINT_SPARKS_MS } from './constants/theme';
import { letterLabel } from './lib/letterDisplay';
import { tokenizeArmenianWord } from './lib/tokenizeArmenian';
import { unmemo } from './test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

// The secret-word pool, in bag order: round 1's word is գարուն.
const BAG_ORDER = ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'];
jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
// RN's jest preset mocks measureInWindow as a bare jest.fn() that never calls
// back, so an awaited measureWindow() (WinFlow's celebration) would hang
// forever. Resolving null exercises the flows' real "couldn't measure" path.
// Every measured rect is this square, unless a test makes measuring fail.
const RECT = { x: 100, y: 200, width: 40, height: 40 };
const mockMeasure = jest.fn();
jest.mock('./lib/measureWindow', () => ({ measureWindow: (ref: unknown) => mockMeasure(ref) }));
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

async function pressKey(token: string) {
  await act(async () => {
    root.root.findAll((n: any) => n.props.accessibilityLabel === letterLabel(token) && n.props.onPress)[0].props.onPress();
  });
}

async function submitWord(word: string) {
  for (const token of tokenizeArmenianWord(word)) await pressKey(token);
  await act(async () => {
    root.root.findByType(SubmitButton).props.onPress();
  });
  await advance(1000); // past ROW_REVEAL_DURATION_MS
}


const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) as string);
const relaunch = async () => {
  await act(async () => root.unmount());
  await renderApp();
};
const overlayFlight = () => root.root.findByType(unmemo(HintFlightOverlay)).props.flight;
const tapHint = async () => {
  await act(async () => {
    root.root.findAll((n: any) => n.props.label === 'Hint' && n.props.onPress)[0].props.onPress();
  });
};
// What each cell of the active row shows: a typed letter, `ghost:x`, or ''.
const activeRow = () => {
  const row = root.root.findByType(unmemo(Board)).props.activeRowIndex;
  return root.root
    .findAllByType(unmemo(Tile))
    .slice(row * 5, row * 5 + 5)
    .map((t: any) => {
      if (t.props.letter) return t.props.letter;
      const ghost = t.findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'ghost-hint');
      return ghost.length ? `ghost:${t.props.ghostLetter}` : '';
    });
};
const savedHint = async () => (await stored('wordle:round')).hintGhosts[0] as { index: number; letter: string };
const submittedCount = () => root.root.findByType(unmemo(Board)).props.activeRowIndex;

beforeEach(async () => {
  await AsyncStorage.setItem('wordle:coins', JSON.stringify(1000));
  mockMeasure.mockReset();
  mockMeasure.mockImplementation(() => Promise.resolve(RECT));
});

it('the hint is saved at tap time and shows only once the light lands', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  const hint = await savedHint(); // saved immediately, item charged
  expect(await stored('wordle:inventory')).toEqual({ hint: 2, darts: 3 });
  expect(overlayFlight()).not.toBeNull(); // flying
  expect(activeRow()[hint.index]).toBe(''); // not shown yet

  await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS);
  expect(activeRow()[hint.index]).toBe(`ghost:${hint.letter}`);
  expect(overlayFlight()).toBeNull();
});

it('a relaunch mid-flight still shows the hint, charged once', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  const hint = await savedHint();
  await relaunch();
  expect(activeRow()[hint.index]).toBe(`ghost:${hint.letter}`);
  expect(await stored('wordle:inventory')).toEqual({ hint: 2, darts: 3 });
  expect(await stored('wordle:coins')).toBe(1000);
});

it('Submit is ignored while the light flies, and works once it has landed', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  for (const token of tokenizeArmenianWord('բետոն')) await pressKey(token); // a valid full row, typed mid-flight
  await act(async () => {
    root.root.findByType(SubmitButton).props.onPress();
  });
  await advance(50);
  expect(submittedCount()).toBe(1); // ignored

  await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS);
  await act(async () => {
    root.root.findByType(SubmitButton).props.onPress();
  });
  await advance(1000);
  expect(submittedCount()).toBe(2);
});

it('typing into the target cell mid-flight hides the landed ghost, and backspace brings it back', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  const hint = await savedHint();
  const letters = ['ա', 'բ', 'գ', 'դ', 'ե'].slice(0, hint.index + 1);
  for (const token of letters) await pressKey(token); // up to and including the target cell
  expect(overlayFlight()).toBeTruthy(); // typed while the light is still flying
  await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS);
  expect(activeRow()[hint.index]).toBe(letters[hint.index]);

  await act(async () => {
    root.root.findAll((n: any) => n.props.accessibilityLabel === 'Ջնջել' && n.props.onPress)[0].props.onPress();
  });
  await advance(300);
  expect(activeRow()[hint.index]).toBe(`ghost:${hint.letter}`);
});

it('a double tap gives one hint', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await act(async () => {
    const hint = root.root.findAll((n: any) => n.props.label === 'Hint' && n.props.onPress)[0];
    hint.props.onPress();
    hint.props.onPress();
  });
  await advance(50);
  expect(overlayFlight()).toBeTruthy(); // one light in the air
  await tapHint(); // and a tap mid-flight is ignored too
  await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS + 100);
  expect((await stored('wordle:round')).hintGhosts).toHaveLength(1);
  expect(await stored('wordle:inventory')).toEqual({ hint: 2, darts: 3 });
});

it('reduced motion: no flight, and the ghost appears', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  const hint = await savedHint();
  expect(overlayFlight()).toBeNull();
  await advance(HINT_REDUCED_FADE_MS);
  expect(activeRow()[hint.index]).toBe(`ghost:${hint.letter}`);
});

it('if nothing can be measured, there is no flight and the ghost appears', async () => {
  mockMeasure.mockImplementation(() => Promise.resolve(null));
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  const hint = await savedHint();
  expect(overlayFlight()).toBeNull();
  await advance(HINT_SPARKS_MS);
  expect(activeRow()[hint.index]).toBe(`ghost:${hint.letter}`);
});

it('a theme toggle mid-flight changes nothing about the landing', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  const hint = await savedHint();
  await act(async () => {
    root.root.findAll((n: any) => n.props.accessibilityLabel === 'Toggle dark mode' && n.props.onPress)[0].props.onPress();
  });
  await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS);
  expect(activeRow()[hint.index]).toBe(`ghost:${hint.letter}`);
  expect(overlayFlight()).toBeNull();
});

it('a board reset mid-flight cancels the flight; nothing lands on the new board', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(50);
  await act(async () => {
    root.root.findByType(unmemo(LossFlow)).props.onNewGame(() => {}); // a new game, as the loss result's button does
  });
  expect(overlayFlight()).toBeNull();
  await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS + 100);
  expect(activeRow()).toEqual(['', '', '', '', '']);
  expect(overlayFlight()).toBeNull();
});

it('after the landing, submitting the row never replays the entrance on the next row', async () => {
  await renderApp();
  await submitWord('դպրոց');
  await tapHint();
  await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS + 100); // landed
  for (const token of tokenizeArmenianWord('բետոն')) await pressKey(token);
  await act(async () => {
    root.root.findByType(SubmitButton).props.onPress();
  });
  await advance(1000);
  const replaying = root.root.findAllByType(unmemo(Tile)).filter((t: any) => t.props.ghostEntranceId !== undefined);
  expect(replaying).toHaveLength(0);
});
