import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LOSS_SHINE_INTERVAL_MS } from '../constants/winFlow';

type Props = {
  intervalMs?: number;
};

// A skewed white highlight bar that periodically sweeps across an orange 3D
// button (the reward modal's ad button, the loss flow's ad-retry button) —
// the button's own Button3D face already clips to its rounded rect.
export default function ShineSweep({ intervalMs = LOSS_SHINE_INTERVAL_MS }: Props) {
  const [sweep] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(intervalMs),
        Animated.timing(sweep, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, intervalMs]);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-140, 220] });

  return (
    <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX }, { rotate: '20deg' }] }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 50,
  },
});
