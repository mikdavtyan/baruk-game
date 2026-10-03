// Persistence and crash safety, through the real App over the mocked
// AsyncStorage: a relaunch is an unmount plus a fresh mount over the same
// storage; a crash is storage silently dropping every write after the first
// few (crashAfterWrites). See .scratch/round-integrity/spec.md and the ADRs
// in docs/adr/. Harness copied from App.roundFlow.test.tsx (kept in a file
// of its own: each test file gets a fresh module registry, and that file's
// tests already use most of the worker's heap).
import React from 'react';
import { Platform, Share, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import Board from './components/Board';
import KeyboardKey from './components/KeyboardKey';
import ResultModal from './components/ResultModal';
import RewardModal from './components/RewardModal';
import SecondChanceModal from './components/SecondChanceModal';
import SubmitButton from './components/SubmitButton';
import Tile from './components/Tile';
import { WIN_FLOW_CONFIG } from './constants/winFlow';
import { letterLabel } from './lib/letterDisplay';
import { tokenizeArmenianWord } from './lib/tokenizeArmenian';

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

const keyState = (token: string) =>
  root.root.findAll((n: any) => n.type === KeyboardKey && n.props.label === letterLabel(token))[0].props.state;
// What a board row actually shows in each cell: its typed letter, or else
// its ghost (rendered as that letter's label).
const rowTiles = (row: number) => root.root.findAllByType(Tile).slice(row * 5, row * 5 + 5);
const rowDisplay = (row: number) =>
  rowTiles(row).map((t: any) => {
    const shown = t.findAllByType(Text)[0]?.props.children; // an empty tile renders no text
    if (t.props.letter) return t.props.letter;
    return t.props.ghostLetter && shown === letterLabel(t.props.ghostLetter) ? `ghost:${t.props.ghostLetter}` : '';
  });

describe('a crash while saving never credits or charges twice', () => {
  it.each([1, 2, 3])('a crash after %i write(s) while the reward is credited, then a relaunch: credited exactly once', async (writes) => {
    await AsyncStorage.setItem('wordle:streak', JSON.stringify({ current: 2, best: 2 }));
    await renderApp();
    await submitWord('բդեշխ');
    await submitWord('գարուն'); // won in 2
    await advance(3000);

    const relaunch = crashAfterWrites(writes);
    await act(async () => {
      root.root.findByType(RewardModal).props.onNext(WIN_FLOW_CONFIG.rewardsByGuessCount[1]);
    });
    await advance(1000);
    await relaunch();
    await advance(3000);

    // Either nothing was credited and the reward is offered again, or it all
    // was and the result shows — so taking any offered reward is one credit.
    const offered = root.root.findAllByType(RewardModal)[0];
    if (offered) {
      await act(async () => {
        offered.props.onNext(offered.props.baseReward);
      });
      await advance(1000);
    }
    expect(await stored('wordle:coins')).toBe(WIN_FLOW_CONFIG.rewardsByGuessCount[1]);
    expect(await stored('wordle:points')).toBe(WIN_FLOW_CONFIG.pointsByGuessCount[1]);
    expect(await stored('wordle:streak')).toEqual({ current: 3, best: 3 });
    expect((await stored('wordle:pendingWin')).step).toBe('result');
  });

  describe('declining the Try again offer', () => {
    beforeEach(async () => {
      await AsyncStorage.multiSet([
        ['wordle:points', JSON.stringify(100)],
        ['wordle:streak', JSON.stringify({ current: 2, best: 4 })],
        ['wordle:coins', JSON.stringify(100)],
      ]);
    });

    it.each([1, 2])('a crash after %i write(s) while declining, then a relaunch: the loss is recorded fully or not at all', async (writes) => {
      await renderApp();
      await loseRound();

      const relaunch = crashAfterWrites(writes);
      await act(async () => {
        root.root.findByType(SecondChanceModal).props.onDecline();
      });
      await advance(1000);
      await relaunch();
      await advance(1000);

      const offerShown = root.root.findAllByType(SecondChanceModal).length === 1;
      const resultShown = root.root.findAllByType(ResultModal).length === 1;
      expect(offerShown !== resultShown).toBe(true); // exactly one of them
      if (offerShown) {
        expect(await stored('wordle:points')).toBe(100);
        expect(await stored('wordle:streak')).toEqual({ current: 2, best: 4 });
      } else {
        expect(await stored('wordle:points')).toBe(0);
        expect(await stored('wordle:streak')).toEqual({ current: 0, best: 4 });
      }
    });
  });
});

describe('the round survives a relaunch', () => {
  const relaunch = async () => {
    await act(async () => root.unmount()); // the app is closed…
    await renderApp(); // …and reopened over the same storage
  };
  const rowStates = (row: number) => rowTiles(row).map((t: any) => t.props.state);

  it('mid-round: the submitted guesses, the letters being typed and the keyboard colors come back', async () => {
    await renderApp();
    await submitWord('դպրոց'); // ր green
    await submitWord('բետոն'); // ն green
    await pressKey('ա');
    await pressKey('բ');

    await relaunch();

    expect(rowDisplay(0)).toEqual(['դ', 'պ', 'ր', 'ո', 'ց']);
    expect(rowStates(0)).toEqual(['absent', 'absent', 'correct', 'absent', 'absent']);
    expect(rowDisplay(1)).toEqual(['բ', 'ե', 'տ', 'ո', 'ն']);
    expect(rowStates(1)).toEqual(['absent', 'absent', 'absent', 'absent', 'correct']);
    expect(rowDisplay(2)).toEqual(['ա', 'բ', '', '', '']);
    expect(keyState('ր')).toBe('correct');
    expect(keyState('դ')).toBe('absent');
    expect((await stored('wordle:wordBag')).pos).toBe(0); // same word

    await pressKey('գ'); // typing carries on where it was
    expect(rowDisplay(2)).toEqual(['ա', 'բ', 'գ', '', '']);
  });

  // Types and submits a guess, then leaves only `ms` for what follows.
  const submitAndWait = async (word: string, ms: number) => {
    for (const token of tokenizeArmenianWord(word)) await pressKey(token);
    await act(async () => {
      root.root.findByType(SubmitButton).props.onPress();
    });
    await advance(ms);
  };
  const takeOfferedReward = async () => {
    const reward = root.root.findByType(RewardModal);
    expect(reward.props.baseReward).toBe(WIN_FLOW_CONFIG.rewardsByGuessCount[1]); // won in 2
    await act(async () => {
      reward.props.onNext(reward.props.baseReward);
    });
    await advance(1000);
  };

  it.each([
    ['the reveal', 100],
    ['the celebration', 1000],
  ])('a win still counts after a relaunch during %s: the reward is offered once and credited once', async (_when, ms) => {
    await renderApp();
    await submitWord('բդեշխ');
    await submitAndWait('գարուն', ms);

    await relaunch();
    await advance(3000);
    await takeOfferedReward();

    expect(await stored('wordle:coins')).toBe(WIN_FLOW_CONFIG.rewardsByGuessCount[1]);
    expect(await stored('wordle:points')).toBe(WIN_FLOW_CONFIG.pointsByGuessCount[1]);
    await relaunch(); // the result screen, not a second reward
    expect(root.root.findAllByType(RewardModal)).toHaveLength(0);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(1);
  });

  it('a sixth-guess loss still counts after a relaunch during its reveal', async () => {
    await AsyncStorage.multiSet([['wordle:points', '100'], ['wordle:streak', JSON.stringify({ current: 2, best: 4 })]]);
    await renderApp();
    for (const word of LOSING_GUESSES.slice(0, 5)) await submitWord(word);
    await submitAndWait(LOSING_GUESSES[5], 100);

    await relaunch();
    await advance(1500);

    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(await stored('wordle:points')).toBe(100);
  });

  it('a new game after a restored win starts clean on the next word, and stays clean after another relaunch', async () => {
    await renderApp();
    await submitWord('բդեշխ');
    await submitAndWait('գարուն', 100);
    await relaunch();
    await advance(3000);
    await takeOfferedReward();
    await act(async () => {
      root.root.findByType(ResultModal).props.onNext();
    });
    await advance(1000);

    expect((await stored('wordle:wordBag')).pos).toBe(1);
    expect(rowDisplay(0)).toEqual(['', '', '', '', '']);
    await relaunch();
    expect(root.root.findAllByType(ResultModal)).toHaveLength(0);
    expect(rowDisplay(0)).toEqual(['', '', '', '', '']);
    expect(keyState('բ')).toBe('empty');
  });

  it('a saved round for a different word is ignored', async () => {
    await renderApp();
    await submitWord('դպրոց');
    await act(async () => root.unmount());
    // As if an app update changed the word list and replaced the bag.
    await AsyncStorage.setItem('wordle:wordBag', JSON.stringify({ order: BAG_ORDER, pos: 1 }));
    await renderApp();

    expect(rowDisplay(0)).toEqual(['', '', '', '', '']);
    expect(keyState('ր')).toBe('empty');
  });
});

describe('a retry survives a relaunch and is paid for once', () => {
  beforeEach(async () => {
    await AsyncStorage.multiSet([
      ['wordle:points', JSON.stringify(100)],
      ['wordle:streak', JSON.stringify({ current: 2, best: 4 })],
      ['wordle:coins', JSON.stringify(100)],
    ]);
  });
  const relaunch = async () => {
    await act(async () => root.unmount());
    await renderApp();
  };

  // The coin retry's grant: the one write that saves the new balance together
  // with the retried round.
  const isRetryGrant = (keys: string[]) => keys.includes('wordle:coins') && keys.includes('wordle:round');
  const payCoinsForRetryThenRelaunch = async (relaunchAfterCrash: () => Promise<void>) => {
    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onCoinRetry();
    });
    await advance(1000);
    await relaunchAfterCrash();
    await advance(1500);
  };

  it('a crash right after the coin retry is saved: the relaunch is in the retry, charged exactly once', async () => {
    await renderApp();
    await loseRound();
    await payCoinsForRetryThenRelaunch(crashAfterWrites(isRetryGrant));

    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(rowDisplay(0)).toEqual(['', '', 'ghost:ր', '', 'ghost:ն']); // the retry board
    expect(await stored('wordle:coins')).toBe(100 - WIN_FLOW_CONFIG.retryCoinPrice);

    await loseRound(NO_OVERLAP_GUESSES); // the retry was used: no second offer
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(1);
    expect(await stored('wordle:coins')).toBe(100 - WIN_FLOW_CONFIG.retryCoinPrice);
  });

  it('a crash just before the coin retry is saved: Try again is offered again, coins untouched', async () => {
    await renderApp();
    await loseRound();
    await payCoinsForRetryThenRelaunch(crashAfterWrites(isRetryGrant, { before: true }));

    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(1);
    expect(await stored('wordle:coins')).toBe(100);
  });

  it('a relaunch mid-retry keeps the found letters as ghosts and allows no second retry', async () => {
    await renderApp();
    await loseRound();
    await retryByAd();
    await submitWord('բդեշխ'); // one guess into the retry

    await relaunch();
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(rowDisplay(0)).toEqual(['բ', 'դ', 'ե', 'շ', 'խ']);
    expect(rowDisplay(1)).toEqual(['', '', 'ghost:ր', '', 'ghost:ն']);
    expect(keyState('ն')).toBe('correct');

    await loseRound(NO_OVERLAP_GUESSES.slice(1));
    expect(root.root.findAllByType(SecondChanceModal)).toHaveLength(0);
    expect(root.root.findAllByType(ResultModal)).toHaveLength(1);
    expect(await stored('wordle:points')).toBe(0);
  });
});

describe('paid power-ups survive a relaunch', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('wordle:coins', JSON.stringify(1000));
    // No items held: these are about paying with coins (items: App.inventory.test.tsx).
    await AsyncStorage.setItem('wordle:inventory', JSON.stringify({ hint: 0, darts: 0 }));
  });
  const tapPowerUp = async (label: string) => {
    await act(async () => {
      root.root.findAll((n: any) => n.props.label === label && n.props.onPress)[0].props.onPress();
    });
  };
  const ghosts = () => root.root.findByType(Board).props.ghostHints;
  const grayKeys = () =>
    root.root.findAllByType(KeyboardKey).filter((k: any) => !k.props.icon && k.props.state === 'absent').length;
  const relaunch = async () => {
    await act(async () => root.unmount());
    await renderApp();
  };

  it('a Hint ghost is still shown after a relaunch, charged once', async () => {
    await renderApp();
    await submitWord('դպրոց');
    await tapPowerUp('Hint');
    await advance(100);
    const shown = ghosts();
    expect(shown).toHaveLength(1);

    await relaunch();
    expect(ghosts()).toEqual(shown);
    expect(await stored('wordle:coins')).toBe(1000 - WIN_FLOW_CONFIG.hintPrice);
  });

  it('Darts eliminations stay gray after a relaunch, even before the arrows have landed, charged once', async () => {
    await renderApp();
    await submitWord('դպրոց'); // դ պ ո ց gray
    expect(grayKeys()).toBe(4);
    await tapPowerUp('Darts'); // paid; no arrow has landed yet

    await relaunch();
    expect(grayKeys()).toBe(4 + 3);
    expect(await stored('wordle:coins')).toBe(1000 - WIN_FLOW_CONFIG.dartsPrice);
  });

  it('Darts eliminations stay gray after a relaunch once the arrows have landed, charged once', async () => {
    await renderApp();
    await submitWord('դպրոց'); // դ պ ո ց gray
    await tapPowerUp('Darts');
    await advance(1000); // every arrow has landed
    expect(grayKeys()).toBe(4 + 3);
    await pressKey('ա'); // play goes on, so the round is saved again after the landing

    await relaunch();
    expect(grayKeys()).toBe(4 + 3);
    expect(await stored('wordle:coins')).toBe(1000 - WIN_FLOW_CONFIG.dartsPrice);
  });

  it.each(['Hint', 'Darts'])('a crash while %s is paid for charges nothing or delivers what was paid for', async (label) => {
    await renderApp();
    await submitWord('դպրոց');
    const relaunchAfterCrash = crashAfterWrites(1);
    await tapPowerUp(label);
    await advance(100);
    await relaunchAfterCrash();

    const paid = (await stored('wordle:coins')) < 1000;
    const delivered = label === 'Hint' ? ghosts().length === 1 : grayKeys() === 4 + 3;
    expect(delivered).toBe(paid);
  });
});

describe('share bonus (iOS only)', () => {
  const shareResolves = (action: string) => jest.spyOn(Share, 'share').mockResolvedValue({ action } as any);
  const resultModal = () => root.root.findByType(ResultModal).props;
  const share = async () => {
    await act(async () => {
      await resultModal().onShare();
    });
    await advance(1000);
  };
  const winAndTakeReward = async () => {
    await submitWord('գարուն'); // won in 1
    await advance(3000);
    const reward = root.root.findByType(RewardModal);
    await act(async () => {
      reward.props.onNext(reward.props.baseReward);
    });
    await advance(1000);
  };
  const reward1 = WIN_FLOW_CONFIG.rewardsByGuessCount[0];

  it('Android: sharing a win or a loss never credits the bonus, and no badge is shown', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    shareResolves(Share.sharedAction); // what Android always reports, even when dismissed
    await renderApp();

    await winAndTakeReward();
    expect(resultModal().shareBadgeVisible).toBe(false);
    await share();
    expect(Share.share).toHaveBeenCalledTimes(1); // sharing itself still works
    expect(await stored('wordle:coins')).toBe(reward1);

    await act(async () => {
      resultModal().onNext();
    });
    await advance(1000);
    await loseRound(['բետոն', 'բդեշխ', 'բեկել', 'բեհեզ', 'բեղիկ', 'բժիշկ']);
    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onDecline(); // the win left points to save
    });
    await advance(1000);
    expect(resultModal().shareBadgeVisible).toBe(false);
    await share();
    expect(await stored('wordle:coins')).toBe(reward1);
  });

  it('iOS: only a completed share credits +200, once per word', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderApp();
    await winAndTakeReward();
    expect(resultModal().shareBadgeVisible).toBe(true);

    shareResolves(Share.dismissedAction);
    await share();
    expect(await stored('wordle:coins')).toBe(reward1);

    shareResolves(Share.sharedAction);
    await share();
    expect(await stored('wordle:coins')).toBe(reward1 + WIN_FLOW_CONFIG.shareBonus);
    await share();
    expect(await stored('wordle:coins')).toBe(reward1 + WIN_FLOW_CONFIG.shareBonus);
  });
});
