import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SMOKE_PUFF_DURATION_MS, SMOKE_PUFF_STAGGER_MS } from '../constants/winFlow';

function Puff({ delay, dx, size }: { delay: number; dx: number; size: number }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, {
        toValue: 1,
        duration: SMOKE_PUFF_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const opacity = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.puff,
        { width: size, height: size, borderRadius: size / 2, opacity, transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    />
  );
}

// Three small gray smoke puffs rising and fading — a one-shot effect (not
// looped) for the loss result's streak flame "going out". Disabled under
// reduced motion by the caller simply not rendering this at all.
export default function SmokePuffs() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Puff delay={0} dx={-6} size={8} />
      <Puff delay={SMOKE_PUFF_STAGGER_MS} dx={0} size={10} />
      <Puff delay={SMOKE_PUFF_STAGGER_MS * 2} dx={6} size={7} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puff: {
    position: 'absolute',
    backgroundColor: 'rgba(140,140,140,0.6)',
  },
});
