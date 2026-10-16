import { memo, useId, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { darkTheme, lightTheme } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

// The soft radial glow at the top of every screen (`backgroundGlow` fading
// into the screen's background). A gradient can't take an Animated color, so
// both themes' glows are drawn once and the theme picks one by opacity
// (native, set at a switch) — a switch re-renders nothing here.
function Glow({ color }: { color: string }) {
  const id = `glow-${useId().replace(/[^a-zA-Z0-9]/g, '_')}`;
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="0.5" cy="-0.1" rx="0.9" ry="1" fx="0.5" fy="-0.1">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function ScreenGlow() {
  const { darkness } = useTheme();
  const [lightOpacity] = useState(() => darkness.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  return (
    <Animated.View pointerEvents="none" style={styles.glow}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: lightOpacity }]}>
        <Glow color={lightTheme.backgroundGlow} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: darkness }]}>
        <Glow color={darkTheme.backgroundGlow} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
  },
});

export default memo(ScreenGlow);
