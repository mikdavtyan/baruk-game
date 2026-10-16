import { ReactNode, useEffect, useState } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

// Rises its content in with a spring (from a little lower and smaller,
// fading in) after `delay`, when `play` is true at mount; otherwise it just
// shows it. Transform + opacity on the native driver.
export default function RiseIn({
  play,
  delay = 0,
  distance = 40,
  style,
  children,
}: {
  play: boolean;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [value] = useState(() => new Animated.Value(play ? 0 : 1));
  const [nodes] = useState(() => ({
    translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
    scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
    opacity: value.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
  }));
  useEffect(() => {
    if (!play) return;
    const rise = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(value, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
    ]);
    rise.start();
    return () => {
      rise.stop();
      value.setValue(1);
    };
  }, [play, delay, value]);
  return (
    <Animated.View
      style={[style, { opacity: nodes.opacity, transform: [{ translateY: nodes.translateY }, { scale: nodes.scale }] }]}
    >
      {children}
    </Animated.View>
  );
}
