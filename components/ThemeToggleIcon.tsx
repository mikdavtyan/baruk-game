import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { DEPTH_OFFSET, Highlight, OUTLINE, useSvgIds } from './gameIconArt';

const ICON_TRANSITION_MS = 260;
const ICON_SIZE = 20;

type Props = {
  isDark: boolean;
  // Kept for compatibility: the drawn sun and moon have fixed game-art colors.
  color: string;
};

// The cartoon moon and sun, in the fortune wheel's icon family
// (design-system.md). Fixed colors, so they never re-render on their own.
const MOON = 'M33.5 10 A23 23 0 1 0 55.6 37.1 A17.5 17.5 0 1 1 33.5 10 Z';
export const MoonArt = memo(function MoonArt() {
  const { id, ref } = useSvgIds();
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="3 3 60 60">
      <Defs>
        <LinearGradient id={id('moon')} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#FFF4B8" />
          <Stop offset="1" stopColor="#F5A524" />
        </LinearGradient>
      </Defs>
      <G transform={DEPTH_OFFSET}>
        <Path d={MOON} fill="#9A5A08" />
      </G>
      <Path d={MOON} fill={ref('moon')} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <Circle cx={21} cy={37} r={2.8} fill="#E8A21E" />
      <Circle cx={31} cy={47.5} r={2} fill="#E8A21E" />
      <Highlight d="M15 29 Q16.5 20 24 14.5" width={3.4} />
      {/* A tiny star beside the moon. */}
      <Path
        d="M51 9 Q52 14 57 15 Q52 16 51 21 Q50 16 45 15 Q50 14 51 9 Z"
        fill="#FFE066"
        stroke={OUTLINE}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
});

const RAYS = Array.from({ length: 8 }, (_, i) => i * 45);
export const SunArt = memo(function SunArt() {
  const { id, ref } = useSvgIds();
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="2 2 60 60">
      <Defs>
        <LinearGradient id={id('sun')} x1="0.2" y1="0.1" x2="0.8" y2="0.9">
          <Stop offset="0" stopColor="#FFF1A6" />
          <Stop offset="1" stopColor="#F5A524" />
        </LinearGradient>
      </Defs>
      {/* Rays: rounded strokes, an outline under a gold core. */}
      {RAYS.map((deg) => (
        <G key={deg} transform={`rotate(${deg} 32 32)`}>
          <Path d="M32 5.5 L32 10.5" stroke={OUTLINE} strokeWidth={7.5} strokeLinecap="round" />
          <Path d="M32 5.5 L32 10.5" stroke="#FFC93C" strokeWidth={3.6} strokeLinecap="round" />
        </G>
      ))}
      <G transform={DEPTH_OFFSET}>
        <Circle cx={32} cy={32} r={15} fill="#9A5A08" />
      </G>
      <Circle cx={32} cy={32} r={15} fill={ref('sun')} stroke={OUTLINE} strokeWidth={3.4} />
      <Highlight d="M22.5 29 A10 10 0 0 1 28.5 22.5" width={3.4} />
    </Svg>
  );
});

// Moon (light mode, tap to go dark) <-> sun (dark mode, tap to go light):
// both icons are stacked in place and swap with a small rotate + fade
// whenever isDark changes (transform/opacity only, native driver).
export default function ThemeToggleIcon({ isDark }: Props) {
  const [progress] = useState(() => new Animated.Value(isDark ? 1 : 0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: isDark ? 1 : 0,
      duration: ICON_TRANSITION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isDark, progress]);

  const moonOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const sunOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const moonScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });
  const sunScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={styles.stack}>
      <Animated.View style={[styles.layer, { opacity: moonOpacity, transform: [{ scale: moonScale }, { rotate }] }]}>
        <MoonArt />
      </Animated.View>
      <Animated.View style={[styles.layer, { opacity: sunOpacity, transform: [{ scale: sunScale }, { rotate }] }]}>
        <SunArt />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
});
