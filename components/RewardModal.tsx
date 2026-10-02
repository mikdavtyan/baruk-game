import { useEffect, useId, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import Button3D from './Button3D';
import Coin from './Coin';
import Glow from './Glow';
import PlayIcon from './PlayIcon';
import Ribbon from './Ribbon';
import ShineSweep from './ShineSweep';
import { darken, FONTS } from '../constants/theme';
import { BUTTON_ENTER_STAGGER_MS, BUTTON_ENTER_START_MS, COIN_PILE_BOUNCE_MS, REWARD_COUNT_UP_MS } from '../constants/winFlow';
import { useTheme } from '../lib/ThemeContext';
import { useCountUp } from '../lib/useCountUp';

const RAY_COUNT = 16;
const SUNBURST_ROTATION_MS = 40000;

// A faint, slowly-rotating ring of rays behind the modal's content — RN's
// LinearGradient can't do a conic gradient, so this draws the rays directly
// as thin SVG wedges, masked by a radial gradient so they fade out by ~60%
// of the screen width instead of ending in a hard edge.
function SunburstRays() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const fadeId = `sunburst-fade-${uid}`;
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: SUNBURST_ROTATION_MS, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
    const a0 = (i / RAY_COUNT) * Math.PI * 2;
    const a1 = a0 + (Math.PI / RAY_COUNT) * 0.55; // ray width
    const R = 90;
    const x0 = 50 + Math.cos(a0) * R;
    const y0 = 50 + Math.sin(a0) * R;
    const x1 = 50 + Math.cos(a1) * R;
    const y1 = 50 + Math.sin(a1) * R;
    return `M50 50 L${x0} ${y0} L${x1} ${y1} Z`;
  }).join(' ');

  return (
    <Animated.View style={[styles.sunburst, { transform: [{ rotate }] }]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id={fadeId} cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFF6C8" stopOpacity={0.09} />
            <Stop offset="100%" stopColor="#FFF6C8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={rays} fill={`url(#${fadeId})`} />
      </Svg>
    </Animated.View>
  );
}

function AdBadge() {
  const [wobble] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.sequence([
          Animated.timing(wobble, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(wobble, { toValue: -1, duration: 110, useNativeDriver: true }),
          Animated.timing(wobble, { toValue: 0, duration: 90, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wobble]);
  const rotate = wobble.interpolate({ inputRange: [-1, 0, 1], outputRange: ['9deg', '12deg', '15deg'] });

  return (
    <Animated.View style={[styles.adBadge, { transform: [{ rotate }] }]}>
      <Animated.Text style={styles.adBadgeText}>x3</Animated.Text>
    </Animated.View>
  );
}

type Props = {
  praiseSlotRef: React.RefObject<View | null>;
  onPraiseSlotLayout: () => void;
  // The coin pile's real on-screen container — measured by WinFlow so the
  // coin-flight animation can burst from its true center, not a guess (see
  // WinFlow.tsx's pileMeasureRef).
  pileRef: React.RefObject<View | null>;
  baseReward: number;
  adMultiplier: number;
  onWatchAd: () => Promise<boolean>;
  onNext: (finalAmount: number) => void;
  disabled: boolean;
};

// Full-screen overlay (not a card) — background dim + sunburst rays, ribbon,
// coin pile with a pulsing glow, the counting "+N", then the ad/next
// buttons. The header coin pill and the actual coin-flight/count-up happen
// one level up in WinFlow.tsx, which owns the shared coin total.
export default function RewardModal({
  praiseSlotRef,
  onPraiseSlotLayout,
  pileRef,
  baseReward,
  adMultiplier,
  onWatchAd,
  onNext,
  disabled,
}: Props) {
  const { theme, color } = useTheme();
  const [rewardAmount, setRewardAmount] = useState(baseReward);
  const [adLoading, setAdLoading] = useState(false);
  const displayedReward = useCountUp(rewardAmount, REWARD_COUNT_UP_MS);

  const [pileBounce] = useState(() => new Animated.Value(0));
  const [pileBob] = useState(() => new Animated.Value(0));
  const [buttonsAnim] = useState(() => new Animated.Value(0));
  const [buttonsAnim2] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pileBounce, {
        toValue: 1.08,
        duration: COIN_PILE_BOUNCE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pileBounce, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pileBob, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pileBob, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    const enter = (v: Animated.Value, delay: number) =>
      setTimeout(() => {
        Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }, delay);
    const t1 = enter(buttonsAnim, BUTTON_ENTER_START_MS);
    const t2 = enter(buttonsAnim2, BUTTON_ENTER_START_MS + BUTTON_ENTER_STAGGER_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!adLoading) return;
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [adLoading, spin]);

  const bobY = pileBob.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const buttonsTranslateY = buttonsAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const buttonsTranslateY2 = buttonsAnim2.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handleWatchAd = async () => {
    if (disabled || adLoading) return;
    setAdLoading(true);
    const succeeded = await onWatchAd();
    setAdLoading(false);
    if (succeeded) {
      const final = baseReward * adMultiplier;
      setRewardAmount(final);
      onNext(final);
    }
  };

  const handleSkipAd = () => {
    if (disabled) return;
    onNext(rewardAmount);
  };

  return (
    <View style={styles.fill}>
      <SunburstRays />
      <View style={styles.content}>
        <Ribbon
          text="ՀԱՂԹԱՆԱԿ"
          bandColors={[theme.correct, darken(theme.correct, 0.85)]}
          bandEdgeColor={color('correctEdge')}
          tailColor="#2E6B3A"
        />

        <View
          ref={praiseSlotRef}
          onLayout={onPraiseSlotLayout}
          style={styles.praiseSlot}
          collapsable={false}
        />

        <View style={styles.pileArea}>
          <Glow size={260} color="#FFD95A" opacity={0.55} />
          <Animated.View
            ref={pileRef}
            collapsable={false}
            style={[styles.pile, { transform: [{ translateY: bobY }, { scale: pileBounce }] }]}
          >
            <View style={[styles.pileCoin, styles.pileCoinBack]}>
              <Coin size={80} />
            </View>
            <View style={[styles.pileCoin, styles.pileCoinMid]}>
              <Coin size={80} />
            </View>
            <View style={styles.pileCoin}>
              <Coin size={96} />
            </View>
          </Animated.View>
          <Animated.Text style={styles.rewardAmount}>+{displayedReward}</Animated.Text>
        </View>

        <View style={styles.buttons}>
          <Animated.View style={{ opacity: buttonsAnim, transform: [{ translateY: buttonsTranslateY }] }}>
            <View style={styles.adButtonWrap}>
              <Button3D
                width="100%"
                height={56}
                borderRadius={16}
                faceColor="#F5B544"
                edgeColor="#B8701E"
                disabled={disabled || adLoading}
                onPress={handleWatchAd}
                accessibilityRole="button"
                accessibilityLabel="Watch an ad for x3 coins"
                contentStyle={styles.adButtonContent}
                faceBackground={
                  <>
                    <LinearGradient colors={['#F5B544', '#E8962A']} style={StyleSheet.absoluteFill} />
                    <ShineSweep />
                  </>
                }
              >
                {adLoading ? (
                  <Animated.View style={[styles.spinnerDot, { transform: [{ rotate: spinRotate }] }]} />
                ) : (
                  <>
                    <View style={styles.playIconChip}>
                      <PlayIcon size={14} color="#FFFFFF" />
                    </View>
                    <Animated.Text style={styles.actionButtonText}>x3 ԳՈՎԱԶԴՈՎ</Animated.Text>
                    <View style={styles.actionButtonCoinRow}>
                      <Coin size={16} />
                      <Animated.Text style={styles.actionButtonSubText}>{baseReward * adMultiplier}</Animated.Text>
                    </View>
                  </>
                )}
              </Button3D>
              <AdBadge />
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: buttonsAnim2, transform: [{ translateY: buttonsTranslateY2 }] }}>
            <Button3D
              width="100%"
              height={56}
              borderRadius={16}
              faceColor={color('correct')}
              edgeColor={color('correctEdge')}
              disabled={disabled}
              onPress={handleSkipAd}
              accessibilityRole="button"
              accessibilityLabel="Next word"
            >
              <Animated.Text style={styles.actionButtonText}>ՀԱՋՈՐԴԸ</Animated.Text>
            </Button3D>
          </Animated.View>
        </View>
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
  sunburst: {
    position: 'absolute',
    width: '220%',
    height: '220%',
    top: '-60%',
    left: '-60%',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  praiseSlot: {
    height: 56,
    width: '100%',
    marginTop: 12,
  },
  ribbon: {
    width: '86%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonBody: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  ribbonFold: {
    position: 'absolute',
    top: 6,
    width: 18,
    height: 44,
  },
  ribbonFoldLeft: { left: -8, transform: [{ rotate: '12deg' }] },
  ribbonFoldRight: { right: -8, transform: [{ rotate: '-12deg' }] },
  ribbonText: {
    fontFamily: FONTS.title,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  pileArea: {
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pile: {
    width: 120,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pileCoin: {
    position: 'absolute',
  },
  pileCoinBack: {
    transform: [{ translateX: -14 }, { translateY: 6 }, { rotate: '-10deg' }],
  },
  pileCoinMid: {
    transform: [{ translateX: 10 }, { translateY: -4 }, { rotate: '10deg' }],
  },
  rewardAmount: {
    marginTop: 12,
    fontFamily: FONTS.tile,
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(180,100,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  buttons: {
    width: '70%',
    marginTop: 32,
    gap: 12,
  },
  adButtonWrap: {
    width: '100%',
  },
  adButtonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 50,
  },
  playIconChip: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontFamily: FONTS.title,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionButtonCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonSubText: {
    fontFamily: FONTS.title,
    fontSize: 14,
    color: '#FFFFFF',
  },
  adBadge: {
    position: 'absolute',
    top: -12,
    right: -8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4B21F',
    borderWidth: 2,
    borderColor: '#FFF6C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBadgeText: {
    fontFamily: FONTS.title,
    fontSize: 13,
    fontWeight: '700',
    color: '#8E520A',
  },
  spinnerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
  },
});
