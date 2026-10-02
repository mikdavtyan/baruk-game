// Coin flights: fast, never blocking, and never counted twice — pressing
// Next mid-flight lands the header pill on the exact final balance, and no
// coin still in the air may change it afterwards.
import React, { createRef, useState } from 'react';
import { Share, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Coin from './Coin';
import CoinFlight from './CoinFlight';
import ResultModal from './ResultModal';
import WinFlow from './WinFlow';
import { COIN_FLIGHT_DURATION_MS, COIN_FLIGHT_PIECES, COIN_FLIGHT_STAGGER_MS, WIN_FLOW_CONFIG } from '../constants/winFlow';
import { PendingWin } from '../lib/gameStorage';
import { ThemeProvider } from '../lib/ThemeContext';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// Real on-screen rects, so the flight actually flies (RN's jest preset never
// answers measureInWindow).
jest.mock('../lib/measureWindow', () => ({
  measureWindow: () => Promise.resolve({ x: 300, y: 40, width: 60, height: 28 }),
}));

let root: any;
beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
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

it('a whole flight takes at most 700ms with 6–8 coins', () => {
  expect(COIN_FLIGHT_PIECES).toBeGreaterThanOrEqual(6);
  expect(COIN_FLIGHT_PIECES).toBeLessThanOrEqual(8);
  expect((COIN_FLIGHT_PIECES - 1) * COIN_FLIGHT_STAGGER_MS + COIN_FLIGHT_DURATION_MS).toBeLessThanOrEqual(700);
});

it('Next during the share-bonus flight lands the pill on the exact balance, with no late recount', async () => {
  const START = 1000;
  const pending: PendingWin = { wordKey: 'գարուն', secretWordTokens: ['գ', 'ա', 'ր', 'ու', 'ն'], guessCount: 3, step: 'result', emojiGrid: '' };
  await AsyncStorage.setItem('wordle:pendingWin', JSON.stringify(pending));
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as never);

  // The real parent owns the balance: WinFlow credits it via onCoinsChange.
  function Harness() {
    const [coins, setCoins] = useState(START);
    return (
      <WinFlow
        active
        resume={pending}
        secretWordTokens={pending.secretWordTokens}
        submittedGuesses={[]}
        boardAreaRef={createRef<View>()}
        headerCoinRef={createRef<View>()}
        coins={coins}
        onCoinsChange={setCoins}
        onNextWord={(onBoardShown) => onBoardShown()}
        points={0}
        onPointsChange={() => {}}
        streak={0}
        bestStreak={0}
        onStreakChange={() => {}}
      />
    );
  }
  await act(async () => {
    root = TestRenderer.create(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
  });
  await act(async () => {
    jest.advanceTimersByTime(0); // resume + header pill measured
  });
  // The header pill WinFlow draws above its overlay: a 22pt coin + the count.
  const pill = () => root.root.findAll((n: any) => n.type === Coin && n.props.size === 22)[0]?.parent.findAllByType(Text)[0].props.children;
  expect(pill()).toBe(START);

  await act(async () => {
    await root.root.findByType(ResultModal).props.onShare();
  });
  expect(root.root.findAllByType(CoinFlight)).toHaveLength(1); // flying — the UI isn't blocked

  await act(async () => {
    root.root.findByType(ResultModal).props.onNext(); // mid-flight
  });
  expect(root.root.findAllByType(CoinFlight)).toHaveLength(0);
  const final = START + WIN_FLOW_CONFIG.shareBonus;
  expect(pill()).toBe(final);
  // Coins that were still in the air never land afterwards. (The overlay
  // fades out and unmounts with the pill; until then it must stay final.)
  for (let t = 0; t < 20; t++) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    if (pill() !== undefined) expect(pill()).toBe(final);
  }
  expect(JSON.parse((await AsyncStorage.getItem('wordle:coins')) as string)).toBe(final);
});
