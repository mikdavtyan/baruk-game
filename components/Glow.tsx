import { useEffect, useId, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

type Props = {
  size?: number;
  color: string;
  opacity?: number;
};

// A soft, gently pulsing radial glow (SVG RadialGradient, no hard edge) —
// shared by the reward modal's coin pile glow (gold) and the second-chance
// modal's flame glow (orange). Scale 0.95 <-> 1.05, 2.4s per cycle.
export default function Glow({ size = 260, color, opacity = 0.55 }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const glowId = `glow-${uid}`;
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, transform: [{ scale }] }]} pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${glowId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
