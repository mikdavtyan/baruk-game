import { ReactNode, useState } from 'react';
import { Animated, Easing, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { PRESS_SCALE, PRESS_SCALE_IN_MS } from '../constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// The press feeling of big buttons and cards: they shrink a little
// (PRESS_SCALE) while pressed and spring back on release — native driver.
// `usePressScale` gives the value and the handlers (Button3D uses it);
// `PressScale` is a Pressable that does it itself. Not for small text links,
// and never for the keyboard.
export function usePressScale() {
  const [scale] = useState(() => new Animated.Value(1));
  const [handlers] = useState(() => ({
    onPressIn: () =>
      Animated.timing(scale, {
        toValue: PRESS_SCALE,
        duration: PRESS_SCALE_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(),
    onPressOut: () => Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start(),
  }));
  return { scale, ...handlers };
}

export default function PressScale({
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const press = usePressScale();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.onPressOut();
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale: press.scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
