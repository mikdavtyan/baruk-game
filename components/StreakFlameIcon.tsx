import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { StreakFlame } from './StreakFlame';

type Props = {
  size?: number;
  // Kept for compatibility: the drawn flame has fixed game-art colors.
  litColor: string;
  extinguished?: boolean; // cross-fades to a gray, "gone out" look
};

const FADE_MS = 400;

// The small streak-stat flame icon — the drawn streak flame (StreakFlame) by
// default, or cross-faded to its gray copy + slightly shrunk when the streak
// has just been broken (the loss result). Two stacked layers cross-fade their
// opacity (native driver); the drawings themselves never change.
export default function StreakFlameIcon({ size = 18, extinguished = false }: Props) {
  const [progress] = useState(() => new Animated.Value(extinguished ? 1 : 0));
  useEffect(() => {
    Animated.timing(progress, { toValue: extinguished ? 1 : 0, duration: FADE_MS, useNativeDriver: true }).start();
  }, [extinguished, progress]);

  const litOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const grayOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });

  return (
    <Animated.View style={[styles.stack, { width: size, height: size, transform: [{ scale }] }]}>
      <Animated.View style={[styles.layer, { opacity: litOpacity }]}>
        <StreakFlame size={size} tier="small" />
      </Animated.View>
      <Animated.View style={[styles.layer, { opacity: grayOpacity }]}>
        <StreakFlame size={size} tier="small" gray />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
});
