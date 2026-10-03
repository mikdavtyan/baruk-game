import { ReactNode, RefObject, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button3D from './Button3D';
import Coin from './Coin';
import Flame from './Flame';
import Glow from './Glow';
import OutlinedWord from './OutlinedWord';
import PlayIcon from './PlayIcon';
import Ribbon from './Ribbon';
import ShineSweep from './ShineSweep';
import { FONTS, HEADER_HEIGHT, LetterState, NEUTRAL_TILE_BG, NEUTRAL_TILE_EDGE, NEUTRAL_TILE_TEXT, WORD_LENGTH } from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { useTheme } from '../lib/ThemeContext';
import {
  FOUND_TILE_ENTER_MS,
  FOUND_TILE_STAGGER_MS,
  LOSS_HERO_COUNT_UP_MS,
  LOSS_SUBTITLE_FIND_WORD,
  LOSS_HERO_FLAME_DROP_MS,
  SECOND_CHANCE_ENTER_DELAYS_MS,
  SECOND_CHANCE_ENTER_MS,
} from '../constants/winFlow';
import { useCountUp } from '../lib/useCountUp';

// Every button in this modal shares one frame: 82% of the screen (max 340),
// 56 tall, a fixed icon slot on the left, a centered label, and a fixed slot
// on the right for the price or the ԱՆՎՃԱՐ pill.
const BUTTON_HEIGHT = 56;
const BUTTON_MAX_WIDTH = 340;
const BUTTON_WIDTH_FRACTION = 0.82;
const BUTTON_PADDING_H = 18;
const BUTTON_SLOT_WIDTH = 64;
const TITLE_SLOT_HEIGHT = 80; // OutlinedWord's tallest render (44 * 1.8)
const HERO_TILE_SIZE = 32;

// Entrance stages, in order. The ribbon (mounted first) animates itself.
const STAGE = { title: 1, hero: 2, ad: 3, coin: 4, decline: 5 } as const;
const STAGE_DELAYS = [
  SECOND_CHANCE_ENTER_DELAYS_MS.title,
  SECOND_CHANCE_ENTER_DELAYS_MS.hero,
  SECOND_CHANCE_ENTER_DELAYS_MS.ad,
  SECOND_CHANCE_ENTER_DELAYS_MS.coin,
  SECOND_CHANCE_ENTER_DELAYS_MS.decline,
];

// Stays mounted (so nothing shifts as parts appear) but invisible and
// untappable until `visible`, then fades + rises in.
function Enter({ visible, reduceMotion, children }: { visible: boolean; reduceMotion: boolean; children: ReactNode }) {
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, { toValue: 1, duration: SECOND_CHANCE_ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [visible, reduceMotion, anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ opacity: anim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function ButtonSlots({ left, label, right, textStyle }: { left?: ReactNode; label: string; right?: ReactNode; textStyle?: object }) {
  return (
    <View style={styles.slotsRow}>
      <View style={[styles.slot, styles.slotLeft]}>{left}</View>
      <Animated.Text style={[styles.actionButtonText, textStyle]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Animated.Text>
      <View style={[styles.slot, styles.slotRight]}>{right}</View>
    </View>
  );
}

function Spinner() {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[styles.spinnerDot, { transform: [{ rotate }] }]} />;
}

type Guess = { tokens: string[]; states: LetterState[] };

// Each position's letter if any guess on the lost board found it green, else
// null. From the board the caller froze (LossFlow's frozenBoard / the pending
// record), so a relaunch shows the same letters.
function foundLetters(guesses: Guess[]): (string | null)[] {
  return Array.from({ length: WORD_LENGTH }, (_, i) => guesses.find((g) => g.states[i] === 'correct')?.tokens[i] ?? null);
}

// The "find the word" hero: 5 small tiles, found letters as scored green
// tiles (white letter, like the board's), unknown ones empty outlines. They
// pop in one after another once `shown` (native driver); reduced motion: at once.
function FoundLettersRow({ letters, shown, reduceMotion }: { letters: (string | null)[]; shown: boolean; reduceMotion: boolean }) {
  const { color } = useTheme();
  const [enter] = useState(() => letters.map(() => new Animated.Value(reduceMotion ? 1 : 0)));
  // Created once (Easing.back overshoots, so opacity is clamped).
  const [nodes] = useState(() =>
    enter.map((v) => ({
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
      scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
    })),
  );
  useEffect(() => {
    if (!shown || reduceMotion) return;
    Animated.stagger(
      FOUND_TILE_STAGGER_MS,
      enter.map((v) =>
        Animated.timing(v, { toValue: 1, duration: FOUND_TILE_ENTER_MS, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      ),
    ).start();
  }, [shown, reduceMotion, enter]);
  return (
    <View testID="found-letters" style={styles.miniTiles}>
      {letters.map((letter, i) => (
        <Animated.View
          key={i}
          testID={`found-letter-${i}`}
          style={[
            styles.foundTile,
            {
              backgroundColor: letter ? color('correct') : 'transparent',
              borderColor: letter ? color('correct') : color('tileBorder'),
              opacity: nodes[i].opacity,
              transform: [{ scale: nodes[i].scale }],
            },
          ]}
        >
          {letter && <Animated.Text style={styles.foundTileLetter}>{letterLabel(letter)}</Animated.Text>}
        </Animated.View>
      ))}
    </View>
  );
}

type Props = {
  titleText: string; // LOSS_TITLE_CLOSE or LOSS_TITLE — computed by the caller from the last guess's green count
  pointsAtRisk: number;
  streakAtRisk: number;
  coinPrice: number;
  canAffordCoinRetry: boolean;
  finalGuesses: Guess[]; // the (frozen) board that just lost — the nothing-at-stake hero shows its found letters
  coinButtonRef: RefObject<View | null>;
  onWatchAd: () => Promise<boolean>;
  onAdRetrySucceeded: () => void;
  onCoinRetry: () => void; // only ever called while affordable
  onInsufficientCoins: () => void; // tapping coin-retry while it isn't
  onDecline: () => void;
  disabled: boolean;
  reduceMotion: boolean;
};

export default function SecondChanceModal({
  titleText,
  pointsAtRisk,
  streakAtRisk,
  coinPrice,
  canAffordCoinRetry,
  finalGuesses,
  coinButtonRef,
  onWatchAd,
  onAdRetrySucceeded,
  onCoinRetry,
  onInsufficientCoins,
  onDecline,
  disabled,
  reduceMotion,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const buttonWidth = Math.min(windowWidth * BUTTON_WIDTH_FRACTION, BUTTON_MAX_WIDTH);

  const [stage, setStage] = useState<number>(reduceMotion ? STAGE.decline : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const timers = STAGE_DELAYS.map((delay, i) => setTimeout(() => setStage((s) => Math.max(s, i + 1)), delay));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const heroShown = stage >= STAGE.hero;

  // Points count up from 0 once the hero appears.
  const shownPoints = useCountUp(heroShown ? pointsAtRisk : 0, LOSS_HERO_COUNT_UP_MS);
  const [flameDrop] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (!heroShown || reduceMotion) return;
    Animated.sequence([
      Animated.timing(flameDrop, { toValue: 1.1, duration: LOSS_HERO_FLAME_DROP_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(flameDrop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }, [heroShown, reduceMotion, flameDrop]);
  const flameTranslateY = flameDrop.interpolate({ inputRange: [0, 1.1], outputRange: [-40, 0] });

  // The ad's loading state lives here so every button can be disabled
  // until it resolves.
  const [adLoading, setAdLoading] = useState(false);
  const buttonsDisabled = disabled || adLoading;
  const handleWatchAd = async () => {
    if (buttonsDisabled) return;
    setAdLoading(true);
    const succeeded = await onWatchAd();
    setAdLoading(false);
    if (succeeded) onAdRetrySucceeded();
  };
  const handleCoinPress = () => {
    if (buttonsDisabled) return;
    if (canAffordCoinRetry) onCoinRetry();
    else onInsufficientCoins();
  };
  const handleDecline = () => {
    if (buttonsDisabled) return;
    onDecline();
  };

  const hasPoints = pointsAtRisk > 0;
  // Nothing at stake (from the pending record's numbers, so a relaunch shows
  // the same variant): the retry is about finding the word.
  const nothingAtStake = pointsAtRisk === 0 && streakAtRisk === 0;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.top}>
        <Ribbon text="ԽԱՂՆ ԱՎԱՐՏՎԵՑ" bandColors={['#D0674F', '#A94632']} bandEdgeColor="#8C3A28" tailColor="#7C3324" />
        <View style={styles.titleSlot}>{stage >= STAGE.title && <OutlinedWord text={titleText} />}</View>
        {nothingAtStake && (
          <Enter visible={stage >= STAGE.title} reduceMotion={reduceMotion}>
            <Animated.Text style={styles.subtitle}>{LOSS_SUBTITLE_FIND_WORD}</Animated.Text>
          </Enter>
        )}
      </View>

      <View style={styles.middle}>
        <Enter visible={heroShown} reduceMotion={reduceMotion}>
          {nothingAtStake ? (
            <View style={styles.heroCenter}>
              <FoundLettersRow letters={foundLetters(finalGuesses)} shown={heroShown} reduceMotion={reduceMotion} />
            </View>
          ) : (
            <View style={styles.heroCenter}>
              <View style={styles.hero}>
                <Animated.View style={{ transform: [{ translateY: flameTranslateY }] }}>
                  <View style={styles.flameWrap}>
                    <Glow size={140} color="#FF8A3D" opacity={0.45} />
                    <Flame size={72} flicker={!reduceMotion} />
                  </View>
                </Animated.View>
                {hasPoints && <Animated.Text style={styles.heroPoints}>{shownPoints}</Animated.Text>}
              </View>
              {hasPoints && (
                <View style={styles.streakPill}>
                  <Animated.Text style={styles.streakPillText}>{`ՀԱՂԹԱԿԱՆ ՇԱՐՔ՝ ${streakAtRisk}`}</Animated.Text>
                </View>
              )}
              <Animated.Text style={styles.sentence}>
                {hasPoints ? 'ՇԱՐՈՒՆԱԿԵ՛Ք ՇԱՐՔԸ, ԱՅԼԱՊԵՍ ՄԻԱՎՈՐՆԵՐԸ ԿԶՐՈՅԱՑՎԵՆ' : 'ՓՈՐՁԻ՛Ր ԵՎՍ ՄԵԿ ԱՆԳԱՄ'}
              </Animated.Text>
            </View>
          )}
        </Enter>
      </View>

      <View style={[styles.buttons, { width: buttonWidth }]}>
        <Enter visible={stage >= STAGE.ad} reduceMotion={reduceMotion}>
          <Button3D
            width={buttonWidth}
            height={BUTTON_HEIGHT}
            borderRadius={16}
            faceColor="#F5B544"
            edgeColor="#B8701E"
            disabled={buttonsDisabled}
            onPress={handleWatchAd}
            accessibilityRole="button"
            accessibilityLabel="Watch an ad to retry"
            faceBackground={
              <>
                <LinearGradient colors={['#F5B544', '#E8962A']} style={StyleSheet.absoluteFill} />
                <ShineSweep />
              </>
            }
          >
            {adLoading ? (
              <Spinner />
            ) : (
              <ButtonSlots
                left={
                  <View style={styles.playIconChip}>
                    <PlayIcon size={14} color="#FFFFFF" />
                  </View>
                }
                label="ԿՐԿԻՆ ՓՈՐՁԵԼ"
                right={
                  <View style={styles.freePill}>
                    <Animated.Text style={styles.freePillText}>ԱՆՎՃԱՐ</Animated.Text>
                  </View>
                }
              />
            )}
          </Button3D>
        </Enter>

        <Enter visible={stage >= STAGE.coin} reduceMotion={reduceMotion}>
          <View style={!canAffordCoinRetry && styles.dimmed}>
            <Button3D
              ref={coinButtonRef}
              width={buttonWidth}
              height={BUTTON_HEIGHT}
              borderRadius={16}
              faceColor={NEUTRAL_TILE_BG}
              edgeColor={NEUTRAL_TILE_EDGE}
              disabled={buttonsDisabled}
              onPress={handleCoinPress}
              accessibilityRole="button"
              accessibilityLabel="Spend coins to retry"
            >
              <ButtonSlots
                label={canAffordCoinRetry ? 'ԿՐԿԻՆ ՓՈՐՁԵԼ' : 'ՊԱԿԱՍՈՒՄ Է'}
                textStyle={styles.darkButtonText}
                right={
                  <View style={styles.coinRow}>
                    <Coin size={16} />
                    <Animated.Text style={[styles.actionButtonSubText, styles.darkButtonText]}>{coinPrice}</Animated.Text>
                  </View>
                }
              />
            </Button3D>
          </View>
        </Enter>

        <Enter visible={stage >= STAGE.decline} reduceMotion={reduceMotion}>
          <Pressable
            onPress={handleDecline}
            disabled={buttonsDisabled}
            accessibilityRole="button"
            accessibilityLabel="Decline the retry"
            style={[styles.declineButton, { width: buttonWidth }]}
          >
            <Animated.Text style={[styles.declineText, buttonsDisabled && styles.dimmedText]}>ՈՉ, ՇՆՈՐՀԱԿԱԼՈՒԹՅՈՒՆ</Animated.Text>
          </Pressable>
        </Enter>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  top: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingTop: 8,
  },
  titleSlot: {
    width: '100%',
    height: TITLE_SLOT_HEIGHT,
    marginTop: 8,
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  heroCenter: {
    alignItems: 'center',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 100,
  },
  flameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPoints: {
    fontFamily: FONTS.tile,
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  miniTiles: {
    flexDirection: 'row',
    gap: 6,
  },
  foundTile: {
    width: HERO_TILE_SIZE,
    height: HERO_TILE_SIZE,
    borderRadius: Math.round(HERO_TILE_SIZE * 0.24),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundTileLetter: {
    fontFamily: FONTS.tile,
    fontSize: Math.round(HERO_TILE_SIZE * 0.58),
    color: '#FFFFFF', // white on a scored tile, in both themes (fixed game art)
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 4,
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 20,
    color: '#D8D2C6',
  },
  streakPill: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  streakPillText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#EFEAE0',
    letterSpacing: 0.3,
  },
  sentence: {
    marginTop: 14,
    maxWidth: 280,
    textAlign: 'center',
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 20,
    color: '#D8D2C6',
  },
  buttons: {
    gap: 12,
  },
  slotsRow: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BUTTON_PADDING_H,
  },
  slot: {
    width: BUTTON_SLOT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotLeft: {
    justifyContent: 'flex-start',
  },
  slotRight: {
    justifyContent: 'flex-end',
  },
  dimmed: {
    opacity: 0.5,
  },
  playIconChip: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freePill: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  freePillText: {
    fontFamily: FONTS.title,
    fontSize: 11,
    fontWeight: '700',
    color: '#B8701E',
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.title,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  darkButtonText: {
    color: NEUTRAL_TILE_TEXT,
  },
  actionButtonSubText: {
    fontFamily: FONTS.title,
    fontSize: 14,
    color: '#FFFFFF',
  },
  spinnerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
  },
  declineButton: {
    height: BUTTON_HEIGHT,
    paddingHorizontal: BUTTON_PADDING_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#BDB6AA',
  },
  dimmedText: {
    opacity: 0.5,
  },
});
