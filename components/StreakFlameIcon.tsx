import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

type Props = {
  size?: number;
  litColor: string;
  extinguished?: boolean; // cross-fades to a gray, "gone out" look
};

const FADE_MS = 400;
const FLAME_ICON = { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' } as const;

// The small streak-stat flame icon — lit (the win result's own color) by
// default, or cross-faded to gray + slightly shrunk when the streak has just
// been broken (the loss result). A native SymbolView's tintColor can't cross-
// fade on its own (it's a native prop, not a style — see Header.tsx's own
// moon/sun toggle for the same reasoning), so this stacks two copies and
// cross-fades their opacity instead, exactly like that toggle does.
export default function StreakFlameIcon({ size = 18, litColor, extinguished = false }: Props) {
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
        <SymbolView name={FLAME_ICON} size={size} tintColor={litColor} />
      </Animated.View>
      <Animated.View style={[styles.layer, { opacity: grayOpacity }]}>
        <SymbolView name={FLAME_ICON} size={size} tintColor="#8A867E" />
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
