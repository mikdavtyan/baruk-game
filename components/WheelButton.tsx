import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import FortuneWheelIcon from './FortuneWheelIcon';
import {
  FONTS,
  WHEEL_BADGE_BOB,
  WHEEL_BADGE_BOB_MS,
  WHEEL_BUTTON_SIZE,
  WHEEL_IDLE_INTERVAL_MS,
  WHEEL_OVERSHOOT_TURNS,
  WHEEL_SETTLE_MS,
  WHEEL_SPIN_MS,
} from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useAppActive } from '../lib/useAppActive';
import { useLoopWhile } from '../lib/useLoopWhile';

// ՊՏՏԻ՛Ր — the ՛ is U+055B, the Armenian emphasis mark.
export const WHEEL_BADGE_TEXT = 'ՊՏՏԻ՛Ր';

// Home's fortune wheel button (ԲԱԽՏԻ ԱՆԻՎ): the wheel icon with a green
// pomegranate ՊՏՏԻ՛Ր badge under it, bobbing gently; a tap opens the wheel page. It idles with a spin
// every WHEEL_IDLE_INTERVAL_MS — one quick full turn with an ease-out that
// overshoots a little, then a small settle back, like a real wheel stopping.
// Only the wheel body turns: its shadow, highlight and pointer stay still
// (FortuneWheelIcon's layers). One pre-built native loop of a 0→1 turn value
// (rotate only); it runs only while `paused` is false (Home on screen, under
// the same rules as the menu background) and the app is active; reduced
// motion never spins. Each pause leaves the wheel at rest, upright.
function WheelButton({ onPress, paused }: { onPress: () => void; paused: boolean }) {
  const { color, reduceMotion } = useTheme();
  const appActive = useAppActive();
  const [turn] = useState(() => new Animated.Value(0));
  const [rotate] = useState(() => turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }));

  const running = !paused && appActive && !reduceMotion;
  useEffect(() => {
    if (!running) return;
    const spin = Animated.loop(
      Animated.sequence([
        Animated.timing(turn, {
          toValue: 1 + WHEEL_OVERSHOOT_TURNS,
          duration: WHEEL_SPIN_MS,
          delay: WHEEL_IDLE_INTERVAL_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(turn, {
          toValue: 1,
          duration: WHEEL_SETTLE_MS,
          easing: Easing.elastic(1.6),
          useNativeDriver: true,
        }),
      ]),
    );
    spin.start();
    return () => {
      spin.stop();
      turn.setValue(0); // a full turn and upright look the same
    };
  }, [running, turn]);

  const [bob] = useState(() => new Animated.Value(0));
  const [bobY] = useState(() => bob.interpolate({ inputRange: [0, 1], outputRange: [0, -WHEEL_BADGE_BOB] }));
  useLoopWhile(
    running,
    () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: WHEEL_BADGE_BOB_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: WHEEL_BADGE_BOB_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    () => bob.setValue(0),
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="ԲԱԽՏԻ ԱՆԻՎ"
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.wheel}>
        <View style={StyleSheet.absoluteFill}>
          <FortuneWheelIcon size={WHEEL_BUTTON_SIZE} layer="base" />
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
          <FortuneWheelIcon size={WHEEL_BUTTON_SIZE} layer="wheel" />
        </Animated.View>
        <View style={StyleSheet.absoluteFill}>
          <FortuneWheelIcon size={WHEEL_BUTTON_SIZE} layer="top" />
        </View>
      </View>
      <Animated.View style={[styles.badge, { backgroundColor: color('accent'), transform: [{ translateY: bobY }] }]}>
        <Animated.Text style={styles.badgeText} allowFontScaling={false}>
          {WHEEL_BADGE_TEXT}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export default memo(WheelButton);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  wheel: {
    width: WHEEL_BUTTON_SIZE,
    height: WHEEL_BUTTON_SIZE,
  },
  badge: {
    marginTop: -6, // tucked under the wheel's rim
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: FONTS.title,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#FFFFFF', // fixed white on the pomegranate badge
  },
});
