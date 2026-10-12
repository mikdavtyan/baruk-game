import { ReactNode, useEffect, useState } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { TAB_ENTER_DISTANCE, TAB_ENTER_STAGGER_MS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

// A tab's card entrance, replayed each time the tab is shown (`visible`
// turns true): `rise` springs it up from a little lower, fading in; `pop`
// springs it from small (the shop's packs). `index` staggers the cards.
// Transform + opacity on the native driver; reduced motion: no motion.
export default function TabEnter({
  visible,
  index,
  kind = 'rise',
  style,
  children,
  testID,
}: {
  visible: boolean;
  index: number;
  kind?: 'rise' | 'pop';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
}) {
  const { reduceMotion } = useTheme();
  const [value] = useState(() => new Animated.Value(1));
  const [nodes] = useState(() => ({
    translateY: value.interpolate({ inputRange: [0, 1], outputRange: [kind === 'rise' ? TAB_ENTER_DISTANCE : 0, 0] }),
    scale: value.interpolate({ inputRange: [0, 1], outputRange: [kind === 'pop' ? 0.6 : 0.94, 1] }),
    opacity: value.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: 'clamp' }),
  }));
  useEffect(() => {
    if (!visible || reduceMotion) return;
    value.setValue(0);
    const enter = Animated.sequence([
      Animated.delay(index * TAB_ENTER_STAGGER_MS + 40),
      Animated.spring(value, { toValue: 1, friction: kind === 'pop' ? 5 : 7, tension: 80, useNativeDriver: true }),
    ]);
    enter.start();
    return () => {
      enter.stop();
      value.setValue(1);
    };
  }, [visible, reduceMotion, index, kind, value]);
  return (
    <Animated.View
      testID={testID}
      style={[style, { opacity: nodes.opacity, transform: [{ translateY: nodes.translateY }, { scale: nodes.scale }] }]}
    >
      {children}
    </Animated.View>
  );
}
