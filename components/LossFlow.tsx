import { RefObject, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Coin from './Coin';
import CoinFlight from './CoinFlight';
import ModalBackdrop from './ModalBackdrop';
import ResultModal from './ResultModal';
import SecondChanceModal from './SecondChanceModal';
import { LetterState } from '../constants/theme';
import {
  LOSS_MODAL_DELAY_MS,
  LOSS_TITLE,
  LOSS_TITLE_CLOSE,
  MODAL_EXIT_MS,
  COIN_FLIGHT_PIECES,
  RETRY_COIN_FLIGHT_PIECES,
  WIN_FLOW_CONFIG,
} from '../constants/winFlow';
import {
  claimShareBonus,
  getPoints,
  hasClaimedShareBonus,
  PendingLoss,
  saveAtomically,
  setCoins as persistCoins,
  setPendingLoss,
} from '../lib/gameStorage';
import { hasSomethingToSave } from '../lib/gamePhase';
import { getLeaderboard, RankedEntry } from '../lib/leaderboard';
import { measureWindow } from '../lib/measureWindow';
import { showRewardedAd } from '../lib/rewardedAd';
import { buildEmojiGrid, buildShareText, shareBonusAvailable } from '../lib/shareText';
import { useTheme } from '../lib/ThemeContext';

type SubmittedGuess = { tokens: string[]; states: LetterState[] };
type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
// idle: nothing showing.
// lossMoment: the 500ms pause right after the board's own shake, before any
// modal mounts. secondChance / lossResult: the full-screen overlay.
type Step = 'idle' | 'lossMoment' | 'secondChance' | 'lossResult';

// The second-chance modal's content — see closingSnapshot.
type SecondChanceView = {
  titleText: string;
  pointsAtRisk: number;
  streakAtRisk: number;
  coinPrice: number;
  canAffordCoinRetry: boolean;
  finalGuesses: SubmittedGuess[];
};

type Props = {
  active: boolean; // gameStatus === 'lost'
  roundId: number; // bumped only by a genuine New Game — resets the retry count
  finalGuesses: SubmittedGuess[]; // App's submittedGuesses at the moment of loss
  secretWordTokens: string[];
  headerCoinRef: RefObject<View | null>;
  coins: number;
  onCoinsChange: (coins: number) => void;
  points: number;
  onPointsChange: (points: number) => void;
  streak: number;
  bestStreak: number;
  onStreakChange: (streak: { current: number; best: number }) => void;
  // App.tsx's handleLossRetry / handleNewGame: reset and remount the board
  // under this modal (retry: same word, keyboard kept; new game: new word,
  // keyboard too), calling back once the fresh board is on screen. The retry
  // gets the lost board to carry over (empty if it was a different word).
  onRetry: (lostGuesses: SubmittedGuess[], onBoardShown: () => void) => void;
  // Saves a granted retry before any animation (App.tsx's handleRetryGranted):
  // in one atomic write the pending loss is cleared, the saved round becomes
  // the retried round and, for a coin retry, the reduced balance is saved —
  // so a kill can never charge for a retry without granting it.
  onRetryGranted: (lostGuesses: SubmittedGuess[], coinsAfter?: number) => Promise<void>;
  initialRetriesUsed: number; // from the saved round — a relaunch mid-retry can't grant another
  onNewGame: (onBoardShown: () => void) => void;
  resume: PendingLoss | null; // a pending loss from before a relaunch (App reads it before first render)
  onFinished: () => void; // the loss result is decided — App's phase -> 'finished'
};

export default function LossFlow({
  active,
  roundId,
  finalGuesses,
  secretWordTokens,
  headerCoinRef,
  coins,
  onCoinsChange,
  points,
  onPointsChange,
  streak,
  bestStreak,
  onStreakChange,
  onRetry,
  onRetryGranted,
  initialRetriesUsed,
  onNewGame,
  resume,
  onFinished,
}: Props) {
  const { theme, reduceMotion } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // A pending loss from before a relaunch (read by App before first render)
  // restores the exact modal that was showing — synchronously, so the live
  // loss trigger below can never race it.
  const [step, setStep] = useState<Step>(resume?.step ?? 'idle');
  const [frozenBoard, setFrozenBoard] = useState<SubmittedGuess[]>(resume?.finalGuesses ?? []);
  // The lost word itself, frozen alongside the board — after a relaunch on a
  // later day, the `secretWordTokens` prop is already a different word.
  const [frozenWordTokens, setFrozenWordTokens] = useState<string[]>(resume?.secretWordTokens ?? []);
  const [pointsAtRisk, setPointsAtRisk] = useState(resume?.pointsAtRisk ?? 0);
  const [streakAtRisk, setStreakAtRisk] = useState(resume?.streakAtRisk ?? 0);
  const [bestStreakAtRisk, setBestStreakAtRisk] = useState(resume?.bestStreak ?? 0);
  const [wordKey, setWordKey] = useState(resume?.wordKey ?? '');
  const [emojiGrid, setEmojiGrid] = useState(resume?.emojiGrid ?? '');

  const [overlayOpacity] = useState(() => new Animated.Value(resume ? 1 : 0));
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const [contentScale] = useState(() => new Animated.Value(1));
  const [headerPillRect, setHeaderPillRect] = useState<Rect | null>(null);
  const [pillValue, setPillValue] = useState(coins);
  const [pillScale] = useState(() => new Animated.Value(1));
  const [pillShakeX] = useState(() => new Animated.Value(0));
  const [coinFlight, setCoinFlight] = useState<{
    origin: Point;
    target: Point;
    amount: number;
    pieceCount: number;
    direction: 'up' | 'down';
  } | null>(null);
  const [shareBadgeVisible, setShareBadgeVisible] = useState(true);
  const [leaderboard, setLeaderboard] = useState<RankedEntry[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // What the second-chance modal showed the moment a retry was granted — it
  // renders from this while closing, so nothing (price, affordability)
  // changes mid-fade.
  const [closingSnapshot, setClosingSnapshot] = useState<SecondChanceView | null>(null);

  const pendingFlightRef = useRef(false);
  const flightParamsRef = useRef({ start: 0, amount: 0, count: 1 });
  const departCountRef = useRef(0);
  const coinButtonRef = useRef<View>(null);
  const wasActiveRef = useRef(!!resume); // a resumed loss is already showing
  const retriesUsedRef = useRef(resume?.retriesUsed ?? initialRetriesUsed);
  const roundIdRef = useRef(roundId);

  useEffect(() => {
    if (pendingFlightRef.current) return;
    setPillValue(coins);
  }, [coins]);

  // A genuine New Game (not a same-word retry) resets the per-round retry count.
  useEffect(() => {
    if (roundIdRef.current === roundId) return;
    roundIdRef.current = roundId;
    retriesUsedRef.current = 0;
  }, [roundId]);

  // A resumed loss result needs its leaderboard.
  useEffect(() => {
    if (resume?.step !== 'lossResult') return;
    getPoints()
      .then((real) => getLeaderboard(real))
      .then(setLeaderboard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opens (or switches) the modal. Its content's animated values are reset
  // HERE, at open — never right after the previous close. An unmounting
  // native-driven view makes RN ask the native side for the value and write
  // the (stale, faded-out) answer back asynchronously (AnimatedValue's
  // __detach); a reset made just after an unmount was undone by that write,
  // so the next modal mounted invisible under a visible backdrop.
  const openModal = (next: 'secondChance' | 'lossResult') => {
    contentOpacity.setValue(1);
    contentScale.setValue(1);
    setStep(next);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: reduceMotion ? 150 : 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // --- Reset the round's points/streak to 0: "declining resets points and
  // streak" — the existing rule, now triggered exactly once, right when the
  // road to a loss actually ends (declined, or retries exhausted), instead
  // of the instant any loss happens (which would incorrectly break a streak
  // the player goes on to save with a retry). Save first, then animate. ---
  // board/wordTokens are passed in rather than read from state: the live
  // loss effect calls this in the same tick it sets that state.
  const persistLossResult = async (
    finalPoints: number,
    finalStreak: number,
    finalBest: number,
    key: string,
    grid: string,
    board: SubmittedGuess[],
    wordTokens: string[],
  ) => {
    const pending: PendingLoss = {
      wordKey: key,
      secretWordTokens: wordTokens,
      finalGuesses: board,
      step: 'lossResult',
      retriesUsed: retriesUsedRef.current,
      pointsAtRisk: finalPoints,
      streakAtRisk: finalStreak,
      bestStreak: finalBest,
      emojiGrid: grid,
    };
    // One atomic write: a kill mid-save must never leave points reset while
    // the Try again offer is still the saved step.
    await saveAtomically({ points: 0, streak: { current: 0, best: finalBest }, pendingLoss: pending });
    onPointsChange(0);
    onStreakChange({ current: 0, best: finalBest });
    getLeaderboard(0).then(setLeaderboard);
    onFinished();
  };
  const finishRound = async (...args: Parameters<typeof persistLossResult>) => {
    await persistLossResult(...args);
    openModal('lossResult');
  };

  // --- Start the flow the moment the game is actually lost ---
  useEffect(() => {
    if (!active) {
      wasActiveRef.current = false;
      return;
    }
    if (wasActiveRef.current) return;
    wasActiveRef.current = true;

    let cancelled = false;
    const guesses = finalGuesses;
    const key = secretWordTokens.join('');
    const grid = buildEmojiGrid(guesses);
    setFrozenBoard(guesses);
    setFrozenWordTokens(secretWordTokens);
    setWordKey(key);
    setEmojiGrid(grid);
    setPointsAtRisk(points);
    setStreakAtRisk(streak);
    setBestStreakAtRisk(bestStreak);

    // Always an end-of-round modal: the Try again offer if there's something
    // to save and a retry left, otherwise straight to the result. Decided and
    // persisted right away (not after the pause), so leaving the app now
    // resumes this exact modal on return.
    const toResult = retriesUsedRef.current >= WIN_FLOW_CONFIG.maxLossRetries || !hasSomethingToSave(points, streak);
    const run = async () => {
      setStep('lossMoment');
      const saved = toResult
        ? persistLossResult(points, streak, bestStreak, key, grid, guesses, secretWordTokens)
        : setPendingLoss({
            wordKey: key,
            secretWordTokens,
            finalGuesses: guesses,
            step: 'secondChance',
            retriesUsed: retriesUsedRef.current,
            pointsAtRisk: points,
            streakAtRisk: streak,
            bestStreak,
            emojiGrid: grid,
          });
      await Promise.all([saved, new Promise((r) => setTimeout(r, reduceMotion ? 0 : LOSS_MODAL_DELAY_MS))]);
      if (cancelled) return;
      openModal(toResult ? 'lossResult' : 'secondChance');
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The header pill's real position — same "stays visible above the
  // overlay" technique as WinFlow.tsx.
  useEffect(() => {
    if (step !== 'secondChance' && step !== 'lossResult') return;
    measureWindow(headerCoinRef).then((rect) => {
      if (rect) setHeaderPillRect(rect);
    });
  }, [step, headerCoinRef]);

  // --- Coin pill stepping — two shapes, sharing the same pulse/haptic tail:
  // `stepPillDown` (coin-retry spend, reverse flight — pill counts down as
  // each coin actually LEAVES it) and `stepPillUp` (the share bonus, forward
  // flight — same as WinFlow.tsx's own version, pill counts up as each coin
  // ARRIVES). ---
  const pulseAndBuzz = (i: number) => {
    Animated.sequence([
      Animated.timing(pillScale, { toValue: 1.15, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pillScale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    if (i % 2 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const stepPillDown = () => {
    departCountRef.current += 1;
    const { start, amount, count } = flightParamsRef.current;
    const i = Math.min(departCountRef.current, count);
    const cumulative = Math.round((amount * i) / count);
    setPillValue(start - cumulative);
    pulseAndBuzz(i);
  };
  const stepPillUp = () => {
    departCountRef.current += 1;
    const { start, amount, count } = flightParamsRef.current;
    const i = Math.min(departCountRef.current, count);
    const cumulative = Math.round((amount * i) / count);
    setPillValue(start + cumulative);
    pulseAndBuzz(i);
  };

  const shakeCoinPill = () => {
    Animated.sequence([
      Animated.timing(pillShakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(pillShakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(pillShakeX, { toValue: 4, duration: 45, useNativeDriver: true }),
      Animated.timing(pillShakeX, { toValue: -4, duration: 45, useNativeDriver: true }),
      Animated.timing(pillShakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  // --- Closing the modal (retry, ՆՈՐ ԽԱՂ): it stays fully up while App
  // resets and remounts the board under it; only once that fresh board has
  // been painted do content and backdrop fade out, together. ---
  const fadeOutModal = (onDone: () => void) =>
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: MODAL_EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 0, duration: MODAL_EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(onDone);

  // The lost board a retry carries over. A pending loss resumed after the
  // word changed was a different word — nothing to carry.
  const carriedBoard = () => (wordKey === secretWordTokens.join('') ? frozenBoard : []);

  // The retry counter and modal state change only after the exit finishes.
  // (The grant itself was already saved — see onRetryGranted.)
  const proceedWithGrantedRetry = () => {
    onRetry(carriedBoard(), () =>
      fadeOutModal(() => {
        retriesUsedRef.current += 1;
        setStep('idle');
        setClosingSnapshot(null);
        setHeaderPillRect(null);
        setIsTransitioning(false);
        if (!reduceMotion) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }),
    );
  };

  const handleAdRetrySucceeded = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setClosingSnapshot(secondChanceView);
    await onRetryGranted(carriedBoard());
    proceedWithGrantedRetry();
  };

  const handleCoinRetry = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setClosingSnapshot(secondChanceView);

    const price = WIN_FLOW_CONFIG.retryCoinPrice;
    const startValue = coins;
    const next = coins - price;
    pendingFlightRef.current = true;
    await onRetryGranted(carriedBoard(), next); // saved first, with the grant, before any animation
    onCoinsChange(next);

    if (reduceMotion || !headerPillRect) {
      setPillValue(next);
      pendingFlightRef.current = false;
      proceedWithGrantedRetry();
      return;
    }

    const buttonRect = await measureWindow(coinButtonRef);
    if (!buttonRect) {
      setPillValue(next);
      pendingFlightRef.current = false;
      proceedWithGrantedRetry();
      return;
    }

    flightParamsRef.current = { start: startValue, amount: price, count: RETRY_COIN_FLIGHT_PIECES };
    departCountRef.current = 0;
    setCoinFlight({
      origin: { x: headerPillRect.x + headerPillRect.width / 2, y: headerPillRect.y + headerPillRect.height / 2 },
      target: { x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + buttonRect.height / 2 },
      amount: price,
      pieceCount: RETRY_COIN_FLIGHT_PIECES,
      direction: 'down',
    });
    coinFlightFinishRef.current = proceedWithGrantedRetry;
  };

  // A ref (not state), same reasoning as WinFlow.tsx's own version — set up
  // fresh per flight, so onAllDone always calls whatever "finish" logic is
  // actually current (the coin-retry spend needs to proceed into the retry
  // transition; the share bonus flight needs nothing further).
  const coinFlightFinishRef = useRef<() => void>(() => {});

  const handleFlightDone = () => {
    setCoinFlight(null);
    pendingFlightRef.current = false;
    setPillValue(coins);
    coinFlightFinishRef.current();
  };

  // Ends a coin flight instantly with the pill on the true balance — e.g. the
  // player moves on mid-flight. The balance itself was credited (and saved)
  // before the flight started, so nothing is ever counted twice.
  const finishCoinFlightNow = () => {
    if (!coinFlight) return;
    setCoinFlight(null);
    pendingFlightRef.current = false;
    setPillValue(coins);
  };

  const handleInsufficientCoins = () => {
    shakeCoinPill();
  };

  const handleDecline = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    await finishRound(pointsAtRisk, streakAtRisk, bestStreakAtRisk, wordKey, emojiGrid, frozenBoard, frozenWordTokens);
    setIsTransitioning(false);
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({ message: buildShareText('X', emojiGrid) });
      if (shareBonusAvailable() && result.action === Share.sharedAction) {
        const already = await hasClaimedShareBonus(wordKey);
        if (!already) {
          await claimShareBonus(wordKey);
          const next = coins + WIN_FLOW_CONFIG.shareBonus;
          pendingFlightRef.current = true;
          onCoinsChange(next);
          await persistCoins(next);
          setShareBadgeVisible(false);
          if (!reduceMotion && headerPillRect) {
            const shareCount = Math.min(WIN_FLOW_CONFIG.shareBonus, COIN_FLIGHT_PIECES);
            flightParamsRef.current = { start: coins, amount: WIN_FLOW_CONFIG.shareBonus, count: shareCount };
            departCountRef.current = 0;
            setCoinFlight({
              origin: { x: headerPillRect.x, y: headerPillRect.y + 200 },
              target: { x: headerPillRect.x + headerPillRect.width / 2, y: headerPillRect.y + headerPillRect.height / 2 },
              amount: WIN_FLOW_CONFIG.shareBonus,
              pieceCount: shareCount,
              direction: 'up',
            });
          } else {
            setPillValue(next);
            pendingFlightRef.current = false;
          }
        }
      }
    } catch {
      // The share sheet failing to open isn't fatal to the flow.
    }
  };

  // ՆՈՐ ԽԱՂ: App resets and remounts the board under the modal, then the
  // modal fades out over it (see fadeOutModal). App also clears the pending
  // loss, in the same atomic write as the next word.
  const handleNewGame = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    finishCoinFlightNow();
    onNewGame(() =>
      fadeOutModal(() => {
        setStep('idle');
        setHeaderPillRect(null);
        setShareBadgeVisible(true);
        setIsTransitioning(false);
        retriesUsedRef.current = 0;
        wasActiveRef.current = false;
      }),
    );
  };

  const lastGuessGreenCount =
    frozenBoard.length > 0 ? frozenBoard[frozenBoard.length - 1].states.filter((s) => s === 'correct').length : 0;
  const secondChanceView: SecondChanceView = {
    titleText: lastGuessGreenCount >= 3 ? LOSS_TITLE_CLOSE : LOSS_TITLE,
    pointsAtRisk,
    streakAtRisk,
    coinPrice: WIN_FLOW_CONFIG.retryCoinPrice,
    canAffordCoinRetry: coins >= WIN_FLOW_CONFIG.retryCoinPrice,
    finalGuesses: frozenBoard,
  };
  const shownSecondChance = closingSnapshot ?? secondChanceView;

  if (step === 'idle') return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {step !== 'lossMoment' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          <ModalBackdrop opacity={overlayOpacity} />

          {step === 'secondChance' && (
            <Animated.View style={[styles.fill, { opacity: contentOpacity, transform: [{ scale: contentScale }] }]}>
              <SecondChanceModal
                {...shownSecondChance}
                coinButtonRef={coinButtonRef}
                onWatchAd={showRewardedAd}
                onAdRetrySucceeded={handleAdRetrySucceeded}
                onCoinRetry={handleCoinRetry}
                onInsufficientCoins={handleInsufficientCoins}
                onDecline={handleDecline}
                disabled={isTransitioning || !!coinFlight}
                reduceMotion={reduceMotion}
              />
            </Animated.View>
          )}

          {step === 'lossResult' && (
            <Animated.View style={[styles.fill, { opacity: contentOpacity, transform: [{ scale: contentScale }] }]}>
              <ResultModal
                variant="loss"
                secretWordTokens={frozenWordTokens}
                finalGuesses={frozenBoard}
                points={points}
                lostPoints={pointsAtRisk}
                streak={streak}
                streakGrew={false}
                bestStreak={bestStreakAtRisk}
                leaderboard={leaderboard}
                shareBadgeVisible={shareBadgeVisible && shareBonusAvailable()}
                onShare={handleShare}
                onNext={handleNewGame}
                nextLabel="ՆՈՐ ԽԱՂ"
                disabled={isTransitioning}
                reduceMotion={reduceMotion}
              />
            </Animated.View>
          )}

          {headerPillRect && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.duplicatePill,
                {
                  backgroundColor: theme.pill,
                  top: headerPillRect.y,
                  right: windowWidth - (headerPillRect.x + headerPillRect.width),
                  transform: [{ scale: pillScale }, { translateX: pillShakeX }],
                },
              ]}
            >
              <Coin size={22} />
              <Animated.Text style={[styles.duplicatePillText, { color: theme.pillText }]}>{pillValue}</Animated.Text>
            </Animated.View>
          )}

          {coinFlight && (
            <CoinFlight
              origin={coinFlight.origin}
              target={coinFlight.target}
              amount={coinFlight.amount}
              pieceCount={coinFlight.pieceCount}
              onDepart={coinFlight.direction === 'down' ? stepPillDown : undefined}
              onArrival={coinFlight.direction === 'up' ? stepPillUp : () => {}}
              onAllDone={handleFlightDone}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  duplicatePill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  duplicatePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
