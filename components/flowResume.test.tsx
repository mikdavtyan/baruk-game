// Relaunch-resume regressions for WinFlow/LossFlow. On a relaunch App's live
// board is empty (it isn't persisted) and SECRET_WORD may already be a later
// day's word — so everything a resumed modal shows or carries over must come
// from the persisted pending record, never from those live props.
import React, { createRef } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LossFlow from './LossFlow';
import ModalBackdrop from './ModalBackdrop';
import ResultModal from './ResultModal';
import RewardModal from './RewardModal';
import SecondChanceModal from './SecondChanceModal';
import WinFlow from './WinFlow';
import { LetterState } from '../constants/theme';
import { WIN_FLOW_CONFIG } from '../constants/winFlow';
import { PendingLoss, PendingWin } from '../lib/gameStorage';
import { ThemeProvider } from '../lib/ThemeContext';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

// ResultModal reads safe-area insets.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

const LOST_WORD = ['բ', 'ե', 'տ', 'ո', 'ն'];
const TODAYS_WORD = ['գ', 'ա', 'ր', 'ու', 'ն'];
const row = (tokens: string[], states: LetterState[]) => ({ tokens, states });
// Two guesses at LOST_WORD: position 0 and 4 confirmed correct.
const LOST_BOARD = [
  row(['բ', 'ի', 'ծ', 'ա', 'կ'], ['correct', 'absent', 'absent', 'absent', 'absent']),
  row(['դ', 'ե', 'ղ', 'ի', 'ն'], ['absent', 'correct', 'absent', 'absent', 'correct']),
];

let root: any;
// The pending records the flows resume from — App reads them from storage
// before first render and passes them in as `resume`; these tests do too.
let seededWin: PendingWin | null = null;
let seededLoss: PendingLoss | null = null;
async function seedWin(p: PendingWin) {
  seededWin = p;
  await AsyncStorage.setItem('wordle:pendingWin', JSON.stringify(p));
}
async function seedLoss(p: PendingLoss) {
  seededLoss = p;
  await AsyncStorage.setItem('wordle:pendingLoss', JSON.stringify(p));
}

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  seededWin = null;
  seededLoss = null;
});
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
});

// Mounts, then lets the resume effect's AsyncStorage read resolve.
async function mount(element: React.ReactElement) {
  await act(async () => {
    root = TestRenderer.create(<ThemeProvider>{element}</ThemeProvider>);
  });
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
}

const sharedProps = () => ({
  headerCoinRef: createRef<View>(),
  coins: 0,
  onCoinsChange: jest.fn(),
  points: 0,
  onPointsChange: jest.fn(),
  streak: 0,
  bestStreak: 0,
  onStreakChange: jest.fn(),
});

describe('WinFlow resume', () => {
  it('offers the reward for the persisted guess count, not the (empty) live board', async () => {
    const pending: PendingWin = {
      wordKey: LOST_WORD.join(''),
      secretWordTokens: LOST_WORD,
      guessCount: 2,
      step: 'reward',
      emojiGrid: '',
    };
    await seedWin(pending);

    await mount(
      <WinFlow {...sharedProps()} boardAreaRef={createRef<View>()} active={!!seededWin} resume={seededWin} secretWordTokens={TODAYS_WORD} submittedGuesses={[]} onNextWord={jest.fn()} afterRetry={false} />,
    );

    expect(root.root.findByType(RewardModal).props.baseReward).toBe(WIN_FLOW_CONFIG.rewardsByGuessCount[1]);
  });
});

describe('LossFlow resume', () => {
  const pendingLoss = (step: PendingLoss['step']): PendingLoss => ({
    wordKey: LOST_WORD.join(''),
    secretWordTokens: LOST_WORD,
    finalGuesses: LOST_BOARD,
    step,
    retriesUsed: 0,
    pointsAtRisk: 40,
    streakAtRisk: 3,
    bestStreak: 5,
    emojiGrid: '',
  });

  const lossFlow = (secretWordTokens: string[], onRetry: jest.Mock, coins = 0) => (
    <LossFlow
      {...sharedProps()}
      coins={coins}
      active={!!seededLoss}
      resume={seededLoss}
      onFinished={jest.fn()}
      roundId={0}
      finalGuesses={[]}
      secretWordTokens={secretWordTokens}
      onRetry={onRetry}
      onRetryGranted={() => Promise.resolve()}
      initialRetriesUsed={0}
      onNewGame={jest.fn()}
    />
  );
  const mountLossFlow = (secretWordTokens: string[], onRetry = jest.fn(), coins = 0) =>
    mount(lossFlow(secretWordTokens, onRetry, coins));

  it('reveals the word that was lost, not a later day\'s secret word', async () => {
    await seedLoss(pendingLoss('lossResult'));
    await mountLossFlow(TODAYS_WORD);

    expect(root.root.findByType(ResultModal).props.secretWordTokens).toEqual(LOST_WORD);
  });

  it('declining after a resume persists the lost word and board, not the live ones', async () => {
    await seedLoss(pendingLoss('secondChance'));
    await mountLossFlow(TODAYS_WORD);

    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onDecline();
    });

    const saved: PendingLoss = JSON.parse((await AsyncStorage.getItem('wordle:pendingLoss')) as string);
    expect(saved.step).toBe('lossResult');
    expect(saved.secretWordTokens).toEqual(LOST_WORD);
    expect(saved.finalGuesses).toEqual(LOST_BOARD);
  });

  async function retryViaAd() {
    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onAdRetrySucceeded();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000); // content fade, then backdrop fade
    });
  }

  it('a same-day retry after a relaunch still carries over the lost board', async () => {
    await seedLoss(pendingLoss('secondChance'));
    const onRetry = jest.fn();
    await mountLossFlow(LOST_WORD, onRetry);

    await retryViaAd();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(LOST_BOARD, expect.any(Function));
  });

  it('a retry resumed on a later day carries nothing over (it would hint the wrong word)', async () => {
    await seedLoss(pendingLoss('secondChance'));
    const onRetry = jest.fn();
    await mountLossFlow(TODAYS_WORD, onRetry);

    await retryViaAd();

    expect(onRetry).toHaveBeenCalledWith([], expect.any(Function));
  });
});

describe('LossFlow retry transition', () => {
  const secondChance = (): PendingLoss => ({
    wordKey: LOST_WORD.join(''),
    secretWordTokens: LOST_WORD,
    finalGuesses: LOST_BOARD,
    step: 'secondChance',
    retriesUsed: 0,
    pointsAtRisk: 40,
    streakAtRisk: 3,
    bestStreak: 5,
    emojiGrid: '',
  });
  const lossFlow = (onRetry: jest.Mock, coins: number) => (
    <LossFlow
      {...sharedProps()}
      coins={coins}
      active={!!seededLoss}
      resume={seededLoss}
      onFinished={jest.fn()}
      roundId={0}
      finalGuesses={[]}
      secretWordTokens={LOST_WORD}
      onRetry={onRetry}
      onRetryGranted={() => Promise.resolve()}
      initialRetriesUsed={0}
      onNewGame={jest.fn()}
    />
  );

  it('keeps the backdrop up until App reports the fresh board is on screen', async () => {
    await seedLoss(secondChance());
    const onRetry = jest.fn();
    await mount(lossFlow(onRetry, 0));

    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onAdRetrySucceeded();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    // Board reset requested, but the board hasn't reported back yet.
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(root.root.findAllByType(ModalBackdrop)).toHaveLength(1);

    const onBoardShown = onRetry.mock.calls[0][1];
    await act(async () => {
      onBoardShown();
      jest.advanceTimersByTime(1000);
    });
    expect(root.root.findAllByType(ModalBackdrop)).toHaveLength(0);
  });

  it('renders the closing modal from a frozen snapshot (coins spent mid-fade change nothing)', async () => {
    await seedLoss(secondChance());
    const onRetry = jest.fn();
    await mount(lossFlow(onRetry, 100));
    expect(root.root.findByType(SecondChanceModal).props.canAffordCoinRetry).toBe(true);

    await act(async () => {
      root.root.findByType(SecondChanceModal).props.onCoinRetry();
    });
    // The parent's balance drops as the coins are spent, while the modal closes.
    await act(async () => {
      root.update(<ThemeProvider>{lossFlow(onRetry, 0)}</ThemeProvider>);
      jest.advanceTimersByTime(100);
    });
    const modal = root.root.findByType(SecondChanceModal).props;
    expect(modal.canAffordCoinRetry).toBe(true);
    expect(modal.coinPrice).toBe(WIN_FLOW_CONFIG.retryCoinPrice);
  });
});
