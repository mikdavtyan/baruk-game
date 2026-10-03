// Whole-round integration: the real App + WinFlow/LossFlow wiring, driven the
// way a player would, asserting the economy rules (what's credited, what's
// reset and when), what a same-word retry keeps versus a real New Game, and
// which word each round uses. The playable list and the saved word bag are
// pinned, so the secret word of every round is known.
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import Board from './components/Board';
import BottomControls from './components/BottomControls';
import KeyboardKey from './components/KeyboardKey';
import ModalBackdrop from './components/ModalBackdrop';
import ResultModal from './components/ResultModal';
import RewardModal from './components/RewardModal';
import SecondChanceModal from './components/SecondChanceModal';
import SubmitButton from './components/SubmitButton';
import Tile from './components/Tile';
import Toast from './components/Toast';
import { HINT_FLIGHT_MS, HINT_SPARKS_MS } from './constants/theme';
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
const NO_OVERLAP_GUESSES = ['բլթել', 'բդեշխ', 'բեկել', 'բեհեզ', 'բեղիկ', 'բժիշկ'];

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
async function pressBackspace() {
  await act(async () => {
    tapKey(root, 'Ջնջել');
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
// What a board row actually shows in each cell: its typed letter, or else
// its ghost (rendered as that letter's label).
const rowTiles = (row: number) => root.root.findAllByType(unmemo(Tile)).slice(row * 5, row * 5 + 5);
const rowDisplay = (row: number) =>
  rowTiles(row).map((t: any) => {
    const shown = t.findAllByType(Text)[0]?.props.children; // an empty tile renders no text
    if (t.props.letter) return t.props.letter;
    return t.props.ghostLetter && shown === letterLabel(t.props.ghostLetter) ? `ghost:${t.props.ghostLetter}` : '';
  });

describe('win', () => {
  it('credits coins, points and streak by guess count once the reward is taken', async () => {
    await AsyncStorage.setItem('wordle:streak', JSON.stringify({ current: 2, best: 2 }));
    await renderApp();

    await submitWord('բդեշխ');
    await submitWord('գարուն'); // won in 2
    await advance(3000); // celebration, then the reward modal

    const reward = root.root.findByType(RewardModal);
    expect(reward.props.baseReward).toBe(WIN_FLOW_CONFIG.rewardsByGuessCount[1]);
    expect((await stored('wordle:pendingWin')).step).toBe('reward');

    await act(async () => {
      reward.props.onNext(reward.props.baseReward); // skip the ad
    });
    await advance(1000);

    expect(await stored('wordle:coins')).toBe(WIN_FLOW_CONFIG.rewardsByGuessCount[1]);
    expect(await stored('wordle:points')).toBe(WIN_FLOW_CONFIG.pointsByGuessCount[1]);
    expect(await stored('wordle:streak')).toEqual({ current: 3, best: 3 });
    expect((await stored('wordle:pendingWin')).step).toBe('result');

    await act(async () => {
      root.root.findByType(ResultModal).props.onNext();
    });
    await advance(1000);
    expect(await stored('wordle:pendingWin')).toBeNull();
  });

  it('ՀԱՋՈՐԴ ԲԱՌԸ takes the next word from the bag: five games, five different words', async () => {
    await renderApp();
    for (let game = 0; game < 5; game++) {
      // Winning in one guess with BAG_ORDER[game] proves it was the secret.
      await submitWord(BAG_ORDER[game]);
      await advance(3000);
      const reward = root.root.findByType(RewardModal);
      await act(async () => {
        reward.props.onNext(reward.props.baseReward);
      });
      await advance(1000);
      await act(async () => {
        root.root.findByType(ResultModal).props.onNext();
      });
      await advance(1000);
      expect((await stored('wordle:wordBag')).pos).toBe(game + 1);
    }
  });
});

describe('loss', () => {
  beforeEach(async () => {
    await AsyncStorage.multiSet([
      ['wordle:points', JSON.stringify(100)],
      ['wordle:streak', JSON.stringify({ current: 2, best: 4 })],
      ['wordle:coins', JSON.stringify(100)],
    ]);
  });

  it('does not touch points or streak at the moment of loss', async () => {
    await renderApp();
    await loseRound();

    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(await stored('wordle:points')).toBe(100);
    expect(await stored('wordle:streak')).toEqual({ current: 2, best: 4 });
  });

  it('after a retry, found letters are ghosts in every row: typing elsewhere keeps them, backspace restores them', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();

    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect((await stored('wordle:wordBag')).pos).toBe(0); // same word
    expect(keyState('ն')).toBe('correct'); // keyboard keeps its colors
    expect(keyState('բ')).toBe('absent');
    expect(rowDisplay(0)).toEqual(['', '', 'ghost:ր', '', 'ghost:ն']);

    // Typing the 1st and 2nd letters must not touch the ghost at position 3.
    await pressKey('բ');
    await pressKey('դ');
    expect(rowDisplay(0)).toEqual(['բ', 'դ', 'ghost:ր', '', 'ghost:ն']);
    // Typing into the ghost's own position hides it; backspace brings it back.
    await pressKey('ե');
    expect(rowDisplay(0)).toEqual(['բ', 'դ', 'ե', '', 'ghost:ն']);
    await pressBackspace();
    await advance(300); // the letter's exit animation
    expect(rowDisplay(0)).toEqual(['բ', 'դ', 'ghost:ր', '', 'ghost:ն']);

    // Every new row shows them again — including after the letter was typed
    // green (still "found in the correct position").
    await pressKey('ե');
    await pressKey('շ');
    await pressKey('խ');
    await act(async () => {
      root.root.findByType(SubmitButton).props.onPress(); // բդեշխ
    });
    await advance(1000);
    expect(rowDisplay(1)).toEqual(['', '', 'ghost:ր', '', 'ghost:ն']);
    await submitWord('բետոն'); // ն typed green at index 4
    expect(rowDisplay(2)).toEqual(['', '', 'ghost:ր', '', 'ghost:ն']);

    // A retry is not the end of the round: nothing is reset yet.
    expect(await stored('wordle:points')).toBe(100);
    expect(await stored('wordle:streak')).toEqual({ current: 2, best: 4 });
  });

  it('only one retry per word: losing the retry goes straight to the loss result', async () => {
    await renderApp();
    await loseRound();

    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onCoinRetry();
    });
    await advance(1000);
    expect(await stored('wordle:coins')).toBe(100 - WIN_FLOW_CONFIG.retryCoinPrice);

    await loseRound(NO_OVERLAP_GUESSES);
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(1);
    expect(await stored('wordle:points')).toBe(0);
    expect(await stored('wordle:streak')).toEqual({ current: 0, best: 4 });
  });

  it('declining resets points and streak (keeping best); ՆՈՐ ԽԱՂ clears everything and takes a new word', async () => {
    await renderApp();
    // Use Hint once so there's a hint ghost for New Game to clear too.
    await submitWord(LOSING_GUESSES[0]);
    await act(async () => {
      root.root.findAll((n: any) => n.props.label === 'Hint' && n.props.onPress)[0].props.onPress();
    });
    for (const word of LOSING_GUESSES.slice(1)) await submitWord(word);
    await advance(1000);

    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onDecline();
    });
    await advance(1000);

    expect(await stored('wordle:points')).toBe(0);
    expect(await stored('wordle:streak')).toEqual({ current: 0, best: 4 });
    expect((await stored('wordle:pendingLoss')).step).toBe('lossResult');

    await act(async () => {
      root.root.findByType(ResultModal).props.onNext();
    });
    await advance(1000);

    expect(await stored('wordle:pendingLoss')).toBeNull();
    expect((await stored('wordle:wordBag')).pos).toBe(1); // a new word
    expect(rowDisplay(0)).toEqual(['', '', '', '', '']); // no ghosts left
    expect(keyState('ն')).toBe('empty');
    expect(keyState('բ')).toBe('empty');
  });
});

describe('board reset (retry, ՆՈՐ ԽԱՂ)', () => {
  beforeEach(async () => {
    // Points at stake, so the Try again offer is the normal (flame) modal.
    await AsyncStorage.multiSet([
      ['wordle:coins', JSON.stringify(100)],
      ['wordle:points', JSON.stringify(100)],
    ]);
  });
  // Checked right after the tap, before the one frame App waits for the
  // fresh board to be painted: the board must already be reset while the
  // modal is still fully up. (Jest can't time native-driver fades, so the
  // 250ms fade itself isn't sampled — only that the modal is then gone.)
  const lastRowFirstLetter = () => rowTiles(5)[0].props.letter;

  it('retry: the board resets and remounts while the modal still covers it, then the modal fades out', async () => {
    await renderApp();
    await loseRound();
    const boardBefore = root.root.findByType(unmemo(Board)).instance ?? root.root.findByType(unmemo(Board));
    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onAdRetrySucceeded();
    });
    expect(lastRowFirstLetter()).toBe('');
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(root.root.findByType(unmemo(Board))).not.toBe(boardBefore); // a fresh mount
    expect(keyState('ն')).toBe('correct'); // the keyboard keeps its colors on a retry
    await advance(400); // one frame + the 250ms fade
    expect(root.root.findAllByType(ModalBackdrop)).toHaveLength(0);
    expect(rowDisplay(0)).toEqual(['', '', 'ghost:ր', '', 'ghost:ն']);
  });

  it('ՆՈՐ ԽԱՂ: board and keyboard reset under the modal, then it fades out', async () => {
    await renderApp();
    await loseRound();
    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onDecline();
    });
    await advance(1000);
    await act(async () => {
      root.root.findByType(ResultModal).props.onNext();
    });
    expect(lastRowFirstLetter()).toBe('');
    expect(keyState('ն')).toBe('empty');
    expect(root.root.findAllByType(ResultModal)).toHaveLength(1);
    expect((await stored('wordle:wordBag')).pos).toBe(1);
    await advance(400);
    expect(root.root.findAllByType(ModalBackdrop)).toHaveLength(0);
  });
});

describe('power-ups', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('wordle:coins', JSON.stringify(1000));
    // No items held: these are about paying with coins (items: App.inventory.test.tsx).
    await AsyncStorage.setItem('wordle:inventory', JSON.stringify({ hint: 0, darts: 0 }));
  });
  const press = async (label: string) => {
    await act(async () => {
      root.root.findAll((n: any) => n.props.label === label && n.props.onPress)[0].props.onPress();
    });
    await advance(100);
  };
  const controls = () => root.root.findByType(unmemo(BottomControls)).props;
  const toastMessages = () => root.root.findAllByType(Toast).map((t: any) => t.props.message);

  it('Hint reveals only unknown positions, charges only then, and when none is left dims and explains for free', async () => {
    await renderApp();
    await submitWord('դպրոց'); // ր green at index 2
    await submitWord('բետոն'); // ն green at index 4

    for (let i = 1; i <= 3; i++) {
      await press('Hint');
      await advance(HINT_FLIGHT_MS + HINT_SPARKS_MS); // a Hint keeps the power-ups busy until it has played
      expect(await stored('wordle:coins')).toBe(1000 - i * WIN_FLOW_CONFIG.hintPrice);
    }
    const revealed = root.root.findByType(unmemo(Board)).props.ghostHints.map((g: any) => g.index).sort();
    expect(revealed).toEqual([0, 1, 3]); // never a known position, never twice

    expect(controls().hintDimmed).toBe(true);
    expect(controls().hintDisabled).toBe(false); // still tappable, to explain
    await press('Hint');
    expect(toastMessages()).toEqual(['ԲՈԼՈՐ ՏԱՌԵՐՆ ԱՐԴԵՆ ԲԱՑ ԵՆ']);
    expect(await stored('wordle:coins')).toBe(1000 - 3 * WIN_FLOW_CONFIG.hintPrice);
    expect(root.root.findByType(unmemo(Board)).props.ghostHints).toHaveLength(3);
  });

  it('Hint only reveals an empty unknown cell; with none in the row it is free, dimmed and explains why', async () => {
    const NO_ROOM_TOAST = 'ՀՈՒՇՄԱՆ ՀԱՄԱՐ ԴԱՏԱՐԿ ՎԱՆԴԱԿ ՉԿԱ';
    await renderApp();
    await submitWord('դպրոց'); // ր green at index 2
    await submitWord('բետոն'); // ն green at index 4

    // The only empty cell (4) is already known.
    for (const token of ['ա', 'բ', 'գ', 'դ']) await pressKey(token);
    expect(controls().hintDimmed).toBe(true);
    expect(controls().hintDisabled).toBe(false);
    await press('Hint');
    expect(toastMessages()).toEqual([NO_ROOM_TOAST]);
    expect(await stored('wordle:coins')).toBe(1000);
    expect(root.root.findByType(unmemo(Board)).props.ghostHints).toEqual([]);

    // A full row: nowhere to show a ghost either. (The first toast is gone
    // first, so the one asserted below can only come from this tap.)
    await advance(2500);
    expect(toastMessages()).toEqual([]);
    await pressKey('ե');
    await press('Hint');
    expect(toastMessages()).toEqual([NO_ROOM_TOAST]);
    expect(await stored('wordle:coins')).toBe(1000);
    expect(root.root.findByType(unmemo(Board)).props.ghostHints).toEqual([]);

    // Free cell 3 (unknown) and 4 (known): the hint must land in 3.
    await pressBackspace();
    await pressBackspace();
    expect(controls().hintDimmed).toBe(false);
    await press('Hint');
    expect(await stored('wordle:coins')).toBe(1000 - WIN_FLOW_CONFIG.hintPrice);
    expect(root.root.findByType(unmemo(Board)).props.ghostHints).toEqual([{ index: 3, letter: 'ու', kind: 'hint' }]);
    expect(rowDisplay(2)).toEqual(['ա', 'բ', 'գ', 'ghost:ու', '']);
  });

  it('the bow only ever targets letters that are not gray yet, and when none is left dims and explains for free', async () => {
    await renderApp();
    await submitWord('բդեշխ'); // 5 letters already gray
    const secret = ['գ', 'ա', 'ր', 'ու', 'ն'];
    const wrongLeft = () =>
      root.root.findAllByType(unmemo(KeyboardKey)).filter(
        (k: any) => !k.props.icon && k.props.state !== 'absent' && !secret.map(letterLabel).includes(k.props.label),
      ).length;
    expect(wrongLeft()).toBe(38 - 5 - 5);

    let volleys = 0;
    while (!controls().dartsDimmed) {
      const before = wrongLeft();
      await press('Darts');
      await advance(1000);
      volleys += 1;
      expect(before - wrongLeft()).toBe(Math.min(3, before)); // fewer than 3 left: only those
    }
    expect(volleys).toBe(Math.ceil(28 / 3));
    expect(secret.map(keyState)).not.toContain('absent');
    expect(await stored('wordle:coins')).toBe(1000 - volleys * WIN_FLOW_CONFIG.dartsPrice);

    await press('Darts');
    expect(toastMessages()).toEqual(['ՍԽԱԼ ՏԱՌԵՐ ԱՅԼԵՎՍ ՉԿԱՆ']);
    expect(await stored('wordle:coins')).toBe(1000 - volleys * WIN_FLOW_CONFIG.dartsPrice);
  });

  it('with no items and too few coins, a power-up is dimmed but still tappable (it opens the shop)', async () => {
    await AsyncStorage.setItem('wordle:coins', JSON.stringify(WIN_FLOW_CONFIG.dartsPrice - 1));
    await renderApp();
    expect([controls().hintDisabled, controls().dartsDisabled]).toEqual([false, false]);
    expect([controls().hintDimmed, controls().dartsDimmed]).toEqual([true, true]);
  });
});

describe('end-of-game flow always shows', () => {
  // The Animated.Value driving the opacity of the layer holding a modal's content.
  const contentOpacityValue = (modal: any) => {
    for (let n = modal.parent; n; n = n.parent) {
      const styles = [n.props?.style].flat(Infinity);
      const o = styles.find((st: any) => st && st.opacity && typeof st.opacity.__getValue === 'function');
      if (o) return o.opacity;
    }
    return undefined;
  };
  const contentOpacity = (modal: any) => contentOpacityValue(modal)?.__getValue();

  it('a loss after ՆՈՐ ԽԱՂ still shows its modal content (not just the backdrop)', async () => {
    await AsyncStorage.multiSet([['wordle:points', '100'], ['wordle:streak', JSON.stringify({ current: 2, best: 4 })]]);
    await renderApp();
    await loseRound();
    expect(contentOpacity(root.root.findByType(SecondChanceModal))).toBe(1);
    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onDecline();
    });
    await advance(1000);
    const content = contentOpacityValue(root.root.findByType(ResultModal));
    await act(async () => {
      root.root.findByType(ResultModal).props.onNext(); // ՆՈՐ ԽԱՂ: the modal fades out and unmounts
    });
    await advance(1000);
    // On a device (New Architecture), unmounting makes RN read the faded-out
    // native value back into JS asynchronously, *after* anything reset right
    // at unmount. Simulate that stale write-back — the modal must still open
    // visibly, i.e. be reset when it opens, not when the last one closed.
    content._value = 0;
    await AsyncStorage.setItem('wordle:points', '100'); // something to save again
    await act(async () => {
      root.update(<App />); // (points are only read at mount — remount to pick them up)
    });
    await loseRound(['բետոն', 'բդեշխ', 'բեկել', 'բեհեզ', 'բեղիկ', 'բժիշկ']);
    const modal = root.root.findAllByType(SecondChanceModal)[0] ?? root.root.findByType(ResultModal);
    expect(contentOpacity(modal)).toBe(1);
  });

  it('points > 0: lose, Try again (ad), then win — the reward modal shows', async () => {
    await AsyncStorage.multiSet([['wordle:points', '100'], ['wordle:streak', JSON.stringify({ current: 2, best: 4 })]]);
    await renderApp();
    await loseRound();
    await retryByAd();
    await submitWord('գարուն');
    await advance(3000);
    expect(root.root.findAllByType(RewardModal)).toHaveLength(1);
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(await stored('wordle:points')).toBe(100); // not reset — the retry saved the round
  });

  it('with nothing at stake (0 points, no streak) a loss still offers Try again, visibly', async () => {
    await renderApp();
    await loseRound();
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(0);
    expect(contentOpacity(root.root.findByType(SecondChanceModal))).toBe(1);
  });

  it('leaving and coming back while the Try again offer is up shows it again, points untouched', async () => {
    await AsyncStorage.multiSet([['wordle:points', '100'], ['wordle:streak', JSON.stringify({ current: 2, best: 4 })]]);
    await renderApp();
    await loseRound();
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    await act(async () => root.unmount()); // the app is closed
    await renderApp(); // …and reopened
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(await stored('wordle:points')).toBe(100);
  });

  it('closing the app in the pause right after the loss still resumes that loss', async () => {
    await AsyncStorage.multiSet([['wordle:points', '100'], ['wordle:streak', JSON.stringify({ current: 2, best: 4 })]]);
    await renderApp();
    for (const word of LOSING_GUESSES) await submitWord(word); // lost; the modal isn't up yet
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    await act(async () => root.unmount());
    await renderApp();
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(await stored('wordle:points')).toBe(100);
  });
});
