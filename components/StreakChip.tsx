import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { StreakFlame, streakFlameTier } from './StreakFlame';
import { FONTS, STREAK_COUNT_STEP_MS, STREAK_FLICKER_MS, STREAK_POP_SCALE } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useLoopWhile } from '../lib/useLoopWhile';

const FLAME_SIZE = 22;
const MAX_COUNT_STEPS = 8;
const LABEL = 'ՕՐ ԱՆԸՆԴՄԵՋ';

// Home's streak chip under the logo: a pomegranate-tinted pill with a soft
// glow, a flickering cartoon flame (its tier grows with the streak: 7+ days
// bigger, 30+ gold/purple) and "N ՕՐ ԱՆԸՆԴՄԵՋ". When the streak grew since
// Home was last on screen, the number counts up to it with a pop (a few
// stepped updates, never one per frame). At 0 the chip is invisible but keeps
// its place, so nothing below it moves when a streak starts. Reduced motion:
// no flicker, no pop.
function StreakChip({ streak, visible, running }: { streak: number; visible: boolean; running: boolean }) {
  const { color, reduceMotion } = useTheme();
  const [shown, setShown] = useState(streak);
  const lastSeenRef = useRef(streak);
  const [pop] = useState(() => new Animated.Value(1));
  const [flicker] = useState(() => new Animated.Value(0));
  const [flame] = useState(() => ({
    scaleX: flicker.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 1.08, 0.95, 1.05, 1] }),
    scaleY: flicker.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.94, 1.08, 0.97, 1] }),
    rotate: flicker.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-4deg', '0deg', '4deg', '0deg'] }),
  }));

  useEffect(() => {
    if (!visible) return;
    const from = lastSeenRef.current;
    lastSeenRef.current = streak;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (streak <= from || reduceMotion) {
      timers.push(setTimeout(() => setShown(streak), 0));
    } else {
      // Count up in at most MAX_COUNT_STEPS steps, each with a pop.
      const steps = Math.min(streak - from, MAX_COUNT_STEPS);
      for (let i = 1; i <= steps; i++) {
        const value = i === steps ? streak : from + Math.round(((streak - from) * i) / steps);
        timers.push(
          setTimeout(() => {
            setShown(value);
            pop.setValue(STREAK_POP_SCALE);
            Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
          }, i * STREAK_COUNT_STEP_MS + 300),
        );
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [visible, streak, reduceMotion, pop]);

  useLoopWhile(
    running && shown > 0,
    () => Animated.loop(Animated.timing(flicker, { toValue: 1, duration: STREAK_FLICKER_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true })),
    () => flicker.setValue(0),
  );

  const empty = shown <= 0;
  return (
    <View
      testID="streak-chip"
      style={[styles.chip, empty && styles.hidden]}
      accessible={!empty}
      accessibilityElementsHidden={empty}
      importantForAccessibility={empty ? 'no-hide-descendants' : 'auto'}
      accessibilityLabel={`${shown} ${LABEL}`}
    >
      <Animated.View style={[styles.halo, { backgroundColor: color('accent') }]} />
      <Animated.View style={[styles.tint, { backgroundColor: color('accent') }]} />
      <Animated.View
        style={[
          styles.flame,
          { transform: [{ rotate: flame.rotate }, { scaleX: flame.scaleX }, { scaleY: flame.scaleY }] },
        ]}
      >
        <StreakFlame size={FLAME_SIZE} tier={streakFlameTier(shown)} />
      </Animated.View>
      <Animated.Text style={[styles.text, { color: color('accent'), transform: [{ scale: pop }] }]}>{shown}</Animated.Text>
      <Animated.Text style={[styles.text, { color: color('accent') }]}>{LABEL}</Animated.Text>
    </View>
  );
}

export default memo(StreakChip);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 9,
    paddingRight: 14,
    height: 32,
    borderRadius: 16,
  },
  hidden: {
    opacity: 0,
  },
  tint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 16,
    opacity: 0.16,
  },
  // The soft glow: the same pill a little bigger and fainter.
  halo: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -4,
    right: -4,
    borderRadius: 20,
    opacity: 0.07,
  },
  flame: {
    width: FLAME_SIZE,
    height: FLAME_SIZE,
    transformOrigin: '50% 90%',
  },
  text: {
    fontFamily: FONTS.title,
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
