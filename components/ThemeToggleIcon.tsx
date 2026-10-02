import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

const ICON_TRANSITION_MS = 260;

type Props = {
  isDark: boolean;
  color: string;
};

// Moon (light mode, tap to go dark) <-> sun (dark mode, tap to go light):
// both icons are stacked in place and swap with a small rotate + fade
// whenever isDark changes (transform/opacity only, native driver).
export default function ThemeToggleIcon({ isDark, color }: Props) {
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
        <SymbolView name={{ ios: 'moon', android: 'dark_mode', web: 'dark_mode' }} size={20} tintColor={color} />
      </Animated.View>
      <Animated.View style={[styles.layer, { opacity: sunOpacity, transform: [{ scale: sunScale }, { rotate }] }]}>
        <SymbolView name={{ ios: 'sun.max', android: 'light_mode', web: 'light_mode' }} size={20} tintColor={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
});
