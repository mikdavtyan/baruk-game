import { memo, RefObject, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import CoinPillContent, { coinPillStyles } from './CoinPillContent';
import CoinFlight from './CoinFlight';
import ModalBackdrop from './ModalBackdrop';
import PraiseWord from './PraiseWord';
import RewardModal from './RewardModal';
import ResultModal from './ResultModal';
import WinConfetti from './WinConfetti';
import { LetterState } from '../constants/theme';
import {
  CELEBRATION_START_DELAY_MS,
  COIN_FLIGHT_PIECES,
  MODAL_EXIT_MS,
  PRAISE_WORDS,
  REWARD_MODAL_DELAY_MS,
  WIN_FLOW_CONFIG,
} from '../constants/winFlow';
import {
  claimShareBonus,
  getPoints,
  hasClaimedShareBonus,
  PendingWin,
  saveAtomically,
  setCoins as persistCoins,
  setPendingWin,
} from '../lib/gameStorage';
import { getLeaderboard, RankedEntry } from '../lib/leaderboard';
import { measureWindow } from '../lib/measureWindow';
import { showRewardedAd } from '../lib/rewardedAd';
import { buildEmojiGrid, buildShareText, shareBonusAvailable } from '../lib/shareText';
import { useTheme } from '../lib/ThemeContext';

type SubmittedGuess = { tokens: string[]; states: LetterState[] };
type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
// idle: nothing showing. celebrating: praise word + confetti over the board,
// modal not mounted yet. reward/result: the full-screen overlay, showing one
// modal or (briefly, while one fades out and the other fades in) both.
type Step = 'idle' | 'celebrating' | 'reward' | 'result';

type Props = {
  active: boolean; // gameStatus === 'won'
  secretWordTokens: string[];
  submittedGuesses: SubmittedGuess[];
  boardAreaRef: RefObject<View | null>;
  headerCoinRef: RefObject<View | null>;
  coins: number;
  onCoinsChange: (coins: number) => void;
  // App.tsx's handleNewGame: resets and remounts the board under this modal
  // for the next word, calling back once the fresh board is on screen.
  onNextWord: (onBoardShown: () => void) => void;
  resume: PendingWin | null; // a pending win from before a relaunch (App reads it before first render)
  points: number; // ՄԻԱՎՈՐՆԵՐ — the running points total; this flow credits it on each win
  onPointsChange: (points: number) => void;
  // Streak is lifted to App.tsx (not owned here) since LossFlow.tsx also
  // needs to read and reset the exact same persisted value.
  streak: number;
  bestStreak: number;
  onStreakChange: (streak: { current: number; best: number }) => void;
  // This win came after a loss retry (App's retriesUsed > 0) — it pays
  // reduced coins. Frozen into the pending win, so a resume pays the same.
  afterRetry: boolean;
};

// The reward's coins before any ad, by guess count — reduced (floored) for a
// win after a loss retry. What RewardModal shows is exactly what it credits.
function rewardBase(guessCount: number, afterRetry: boolean): number {
  const full = WIN_FLOW_CONFIG.rewardsByGuessCount[Math.min(guessCount, 6) - 1] ?? 5;
  return afterRetry ? Math.floor(full * WIN_FLOW_CONFIG.retryWinRewardFactor) : full;
}

function WinFlow({
  active,
  secretWordTokens,
  submittedGuesses,
  boardAreaRef,
  headerCoinRef,
  coins,
  onCoinsChange,
  onNextWord,
  points,
  onPointsChange,
  streak,
  bestStreak,
  onStreakChange,
  resume,
  afterRetry,
}: Props) {
  const { reduceMotion, color, textColor } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // A pending win from before a relaunch (read by App before first render)
  // restores the exact modal that was showing — synchronously, so the live
  // win trigger below can never race it.
  const [step, setStep] = useState<Step>(resume?.step ?? 'idle');
  const [showReward, setShowReward] = useState(resume?.step === 'reward');
  const [showResult, setShowResult] = useState(resume?.step === 'result');
  const [pending, setPending] = useState<PendingWin | null>(resume);
  const [praiseText, setPraiseText] = useState('');
  const [praiseFrom, setPraiseFrom] = useState<Point | null>(null);
  const [praiseFlipTo, setPraiseFlipTo] = useState<Point | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [headerPillRect, setHeaderPillRect] = useState<Rect | null>(null);
  const [pileRect, setPileRect] = useState<Rect | null>(null);
  const [overlayOpacity] = useState(() => new Animated.Value(resume ? 1 : 0));
  const [rewardOpacity] = useState(() => new Animated.Value(resume?.step === 'result' ? 0 : 1));
  const [rewardScale] = useState(() => new Animated.Value(1));
  const [resultOpacity] = useState(() => new Animated.Value(resume?.step === 'result' ? 1 : 0));
  const [resultScale] = useState(() => new Animated.Value(1));
  const [coinFlight, setCoinFlight] = useState<{ origin: Point; target: Point; amount: number } | null>(null);
  const [shareBadgeVisible, setShareBadgeVisible] = useState(true);
  const [streakGrew, setStreakGrew] = useState(false);
  const [leaderboard, setLeaderboard] = useState<RankedEntry[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false); // ignore repeated taps
  // The header's coin pill DISPLAY value while the overlay is up — driven
  // step-by-step by each arriving coin (see handleCoinArrival), not by the
  // real `coins` prop directly, which updates (and persists) immediately.
  // Kept in sync with `coins` whenever no flight is in flight.
  const [pillValue, setPillValue] = useState(coins);
  const [pillScale] = useState(() => new Animated.Value(1));
  const pendingFlightRef = useRef(false);
  const flightParamsRef = useRef({ start: 0, amount: 0, count: 1 });
  const arrivalCountRef = useRef(0);
  const rewardPraiseSlotRef = useRef<View>(null);
  const pileMeasureRef = useRef<View>(null);
  const wasActiveRef = useRef(!!resume); // a resumed win is already showing

  useEffect(() => {
    if (pendingFlightRef.current) return;
    setPillValue(coins);
  }, [coins]);

  // A resumed result needs its leaderboard — read fresh from storage, since
  // App's own points load may not have landed yet.
  useEffect(() => {
    if (resume?.step !== 'result') return;
    getPoints()
      .then((real) => getLeaderboard(real))
      .then(setLeaderboard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Start the flow the moment the game is actually won ---
  useEffect(() => {
    if (!active) {
      wasActiveRef.current = false;
      return;
    }
    if (wasActiveRef.current) return;
    wasActiveRef.current = true;

    const guessCount = submittedGuesses.length;
    const pair = PRAISE_WORDS[Math.min(Math.max(guessCount, 1), PRAISE_WORDS.length) - 1];
    const text = pair[Math.round(Math.random())];
    const emojiGrid = buildEmojiGrid(submittedGuesses);
    const wordKey = secretWordTokens.join('');
    const nextPending: PendingWin = {
      wordKey,
      secretWordTokens,
      guessCount,
      step: 'reward',
      emojiGrid,
      ...(afterRetry ? { afterRetry: true } : {}),
    };

    let cancelled = false;

    const run = async () => {
      await new Promise((r) => setTimeout(r, reduceMotion ? 0 : CELEBRATION_START_DELAY_MS));
      if (cancelled) return;
      setStep('celebrating');

      const boardRect = await measureWindow(boardAreaRef);
      if (cancelled) return;
      const origin = boardRect
        ? { x: boardRect.x + boardRect.width / 2, y: boardRect.y + boardRect.height / 2 }
        : { x: 0, y: 0 };
      setPraiseText(text);
      setPraiseFrom(origin);
      if (!reduceMotion) setShowConfetti(true);

      await new Promise((r) => setTimeout(r, reduceMotion ? 0 : REWARD_MODAL_DELAY_MS));
      if (cancelled) return;

      await setPendingWin(nextPending);
      setPending(nextPending);
      // The modals' animated values are reset here, at open — never right
      // after the previous close (see LossFlow's openModal for why).
      rewardOpacity.setValue(1);
      rewardScale.setValue(1);
      resultOpacity.setValue(0);
      resultScale.setValue(1);
      setStep('reward');
      setShowReward(true);

      // Mounted now — measure its praise slot and pile one frame later, then glide.
      requestAnimationFrame(async () => {
        const [slotRect, pileMeasuredRect] = await Promise.all([
          measureWindow(rewardPraiseSlotRef),
          measureWindow(pileMeasureRef),
        ]);
        if (cancelled) return;
        if (slotRect) setPraiseFlipTo({ x: slotRect.x + slotRect.width / 2, y: slotRect.y + slotRect.height / 2 });
        if (pileMeasuredRect) setPileRect(pileMeasuredRect);
      });

      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: reduceMotion ? 150 : 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The header pill's real position — needed both as the coin-flight target
  // and to place the "stays visible above the overlay" duplicate.
  useEffect(() => {
    if (step !== 'reward' && step !== 'result') return;
    measureWindow(headerCoinRef).then((rect) => {
      if (rect) setHeaderPillRect(rect);
    });
  }, [step, headerCoinRef]);

  const creditCoins = async (amount: number) => {
    const next = coins + amount;
    onCoinsChange(next);
    await persistCoins(next); // saved first, per spec — the display just follows
  };

  // Each arriving coin steps the header pill's DISPLAYED value up by its
  // share of the total (the real balance was already credited — and
  // persisted — the moment the flight started), landing on the exact total
  // by construction once every coin has arrived, and gives the pill a quick
  // scale pulse plus a light haptic on every second arrival.
  const handleCoinArrival = () => {
    arrivalCountRef.current += 1;
    const { start, amount, count } = flightParamsRef.current;
    const i = Math.min(arrivalCountRef.current, count);
    const cumulative = Math.round((amount * i) / count);
    setPillValue(start + cumulative);

    Animated.sequence([
      Animated.timing(pillScale, { toValue: 1.15, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pillScale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    if (i % 2 === 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleRewardNext = async (finalAmount: number) => {
    if (isTransitioning || !pending) return;
    setIsTransitioning(true);

    // ՄԻԱՎՈՐՆԵՐ — awarded on every win, by guess count (see A9's spec).
    const pointsGain = WIN_FLOW_CONFIG.pointsByGuessCount[Math.min(pending.guessCount, 6) - 1] ?? 0;
    const nextPoints = points + pointsGain;
    const coinStart = coins;
    const nextCoins = coins + finalAmount;
    const nextStreak = streak + 1;
    const nextBest = Math.max(bestStreak, nextStreak);
    const resultPending: PendingWin = { ...pending, step: 'result' };

    // Saved first, all in one atomic write — a kill mid-save must never let a
    // relaunch offer this reward again on top of a partial credit.
    await saveAtomically({
      points: nextPoints,
      coins: nextCoins,
      streak: { current: nextStreak, best: nextBest },
      pendingWin: resultPending,
    });
    onPointsChange(nextPoints);
    pendingFlightRef.current = true;
    onCoinsChange(nextCoins);
    setStreakGrew(true);
    onStreakChange({ current: nextStreak, best: nextBest });
    setPending(resultPending);
    getLeaderboard(nextPoints).then(setLeaderboard);

    // Sequential, not a crossfade: the reward content fades + shrinks to
    // 0.96 first, fully, THEN the result content enters — the backdrop
    // (dim/blur/vignette) is untouched throughout, so it never looks like
    // the screen is empty mid-transition.
    const finishCrossFade = () => {
      Animated.parallel([
        Animated.timing(rewardOpacity, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rewardScale, { toValue: 0.96, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        setShowReward(false);
        setStep('result');
        setShowResult(true);
        resultOpacity.setValue(0);
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(() => setIsTransitioning(false));
      });
    };

    // The result modal comes in right away — the coin flight never blocks
    // the UI; it lands in the header pill (above the overlay) meanwhile.
    finishCrossFade();
    if (reduceMotion || !headerPillRect) {
      setPillValue(coinStart + finalAmount);
      pendingFlightRef.current = false;
      return;
    }

    const flightCount = Math.min(finalAmount, COIN_FLIGHT_PIECES);
    flightParamsRef.current = { start: coinStart, amount: finalAmount, count: flightCount };
    arrivalCountRef.current = 0;

    // The coin pile's real measured center (see pileMeasureRef above) — not
    // a guess from the header pill's position, which sits nowhere near it.
    const pileOrigin = pileRect
      ? { x: pileRect.x + pileRect.width / 2, y: pileRect.y + pileRect.height / 2 }
      : { x: headerPillRect.x + headerPillRect.width / 2, y: headerPillRect.y + 260 };
    const target = { x: headerPillRect.x + headerPillRect.width / 2, y: headerPillRect.y + headerPillRect.height / 2 };
    setCoinFlight({ origin: pileOrigin, target, amount: finalAmount });
    coinFlightFinishRef.current = () => {};
  };

  // A ref (not state) purely so the CoinFlight's onAllDone callback — set up
  // once per flight — always calls whatever "finish" logic is current.
  const coinFlightFinishRef = useRef<() => void>(() => {});

  // Ends a coin flight instantly with the pill on the true balance — e.g. the
  // player moves on mid-flight. The balance itself was credited (and saved)
  // before the flight started, so nothing is ever counted twice.
  const finishCoinFlightNow = () => {
    if (!coinFlight) return;
    setCoinFlight(null);
    pendingFlightRef.current = false;
    setPillValue(coins);
  };

  const handleFlightDone = () => {
    setCoinFlight(null);
    pendingFlightRef.current = false;
    // `coins` has already reflected the credited total since before the
    // flight even started — snapping the display to it here (rather than
    // trusting the arrivals' own rounding) guarantees it lands on the exact
    // total, per spec.
    setPillValue(coins);
    coinFlightFinishRef.current();
  };

  const handleShare = async () => {
    if (!pending) return;
    try {
      const result = await Share.share({ message: buildShareText(pending.guessCount, pending.emojiGrid) });
      if (shareBonusAvailable() && result.action === Share.sharedAction) {
        const already = await hasClaimedShareBonus(pending.wordKey);
        if (!already) {
          const startValue = coins;
          await claimShareBonus(pending.wordKey);
          pendingFlightRef.current = true;
          await creditCoins(WIN_FLOW_CONFIG.shareBonus);
          setShareBadgeVisible(false);
          if (!reduceMotion && headerPillRect) {
            const amount = WIN_FLOW_CONFIG.shareBonus;
            flightParamsRef.current = { start: startValue, amount, count: Math.max(1, Math.min(amount, COIN_FLIGHT_PIECES)) };
            arrivalCountRef.current = 0;
            setCoinFlight({
              origin: { x: headerPillRect.x, y: headerPillRect.y + 200 },
              target: {
                x: headerPillRect.x + headerPillRect.width / 2,
                y: headerPillRect.y + headerPillRect.height / 2,
              },
              amount,
            });
            coinFlightFinishRef.current = () => {};
          } else {
            setPillValue(startValue + WIN_FLOW_CONFIG.shareBonus);
            pendingFlightRef.current = false;
          }
        }
      }
      // A cancelled/dismissed share gives nothing — nothing else to do.
    } catch {
      // The share sheet failing to open isn't fatal to the flow.
    }
  };

  // ՀԱՋՈՐԴ ԲԱՌԸ: App resets and remounts the board under the still-opaque
  // modal; once that fresh board is on screen, the result content and the
  // backdrop fade out together. App also clears the pending win, in the same
  // atomic write as the next word.
  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    finishCoinFlightNow();
    onNextWord(() =>
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: MODAL_EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(resultOpacity, { toValue: 0, duration: MODAL_EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        setStep('idle');
        setShowReward(false);
        setShowResult(false);
        setPending(null);
        setPraiseText('');
        setPraiseFrom(null);
        setPraiseFlipTo(null);
        setShareBadgeVisible(true);
        setStreakGrew(false);
        setHeaderPillRect(null);
        setPileRect(null);
        setIsTransitioning(false);
        wasActiveRef.current = false;
      }),
    );
  };

  if (step === 'idle') return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {step === 'celebrating' ? (
        <>
          {praiseText && praiseFrom && <PraiseWord text={praiseText} from={praiseFrom} flipTo={null} />}
          {showConfetti && praiseFrom && (
            <WinConfetti originX={praiseFrom.x} originY={praiseFrom.y} onDone={() => setShowConfetti(false)} />
          )}
        </>
      ) : (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          {/* The rays-only part of the reward's own look fade out once the
              result modal takes over (B5) — this shared backdrop stays for
              both. */}
          <ModalBackdrop opacity={overlayOpacity} />

          {showConfetti && praiseFrom && (
            <WinConfetti originX={praiseFrom.x} originY={praiseFrom.y} onDone={() => setShowConfetti(false)} />
          )}

          {showReward && (
            <Animated.View
              style={[styles.fill, { opacity: rewardOpacity, transform: [{ scale: rewardScale }] }]}
              pointerEvents={step === 'reward' ? 'auto' : 'none'}
            >
              {/* Unmounted the instant the reward content leaves (showReward
                  goes false right after this same fade finishes) — never
                  lingers into the result modal (A3). */}
              {praiseText && praiseFrom && <PraiseWord text={praiseText} from={praiseFrom} flipTo={praiseFlipTo} />}
              <RewardModal
                praiseSlotRef={rewardPraiseSlotRef}
                onPraiseSlotLayout={() => {}}
                pileRef={pileMeasureRef}
                // From the pending record, not the live board — after a
                // relaunch-resume the board is empty.
                baseReward={rewardBase(pending?.guessCount ?? submittedGuesses.length, !!pending?.afterRetry)}
                adMultiplier={WIN_FLOW_CONFIG.adRewardMultiplier}
                onWatchAd={showRewardedAd}
                onNext={handleRewardNext}
                disabled={isTransitioning || !!coinFlight}
              />
            </Animated.View>
          )}

          {showResult && pending && (
            <Animated.View
              style={[styles.fill, { opacity: resultOpacity, transform: [{ scale: resultScale }] }]}
              pointerEvents={step === 'result' ? 'auto' : 'none'}
            >
              <ResultModal
                variant="win"
                secretWordTokens={pending.secretWordTokens}
                points={points}
                streak={streak}
                streakGrew={streakGrew}
                bestStreak={bestStreak}
                leaderboard={leaderboard}
                shareBadgeVisible={shareBadgeVisible && shareBonusAvailable()}
                onShare={handleShare}
                onNext={handleNext}
                nextLabel="ՀԱՋՈՐԴ ԲԱՌԸ"
                disabled={isTransitioning}
              />
            </Animated.View>
          )}

          {headerPillRect && (
            // Anchored by its RIGHT edge (matching the real header pill's own
            // flex-end position) and otherwise unconstrained — no fixed
            // width/height, so it sizes itself to whatever `pillValue`
            // actually needs and never gets clipped as the digit count
            // grows, instead of being boxed into its size at the moment it
            // was first measured.
            <Animated.View
              pointerEvents="none"
              style={[
                coinPillStyles.pill,
                styles.duplicatePill,
                {
                  backgroundColor: color('pill'),
                  top: headerPillRect.y,
                  right: windowWidth - (headerPillRect.x + headerPillRect.width),
                  transform: [{ scale: pillScale }],
                },
              ]}
            >
              <CoinPillContent
                value={pillValue}
                textColor={textColor('pillText')}
                plusColor={color('correct')}
              />
            </Animated.View>
          )}

          {coinFlight && (
            <CoinFlight
              origin={coinFlight.origin}
              target={coinFlight.target}
              amount={coinFlight.amount}
              onArrival={handleCoinArrival}
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
  // Positioned over the real header pill; its look is coinPillStyles.pill
  // plus CoinPillContent, exactly like the header's (see CoinPillContent.tsx).
  duplicatePill: {
    position: 'absolute',
  },
});

// Memoized: App re-renders on every keystroke (see the stable props there).
export default memo(WinFlow);
