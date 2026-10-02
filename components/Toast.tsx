import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { FONTS, TOAST_FADE_MS, TOAST_HOLD_MS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  message: string;
  onHidden: () => void;
};

// A short message pill that fades in over the top of the board, holds, and
// fades out. Mount it with a fresh `key` to show it again.
export default function Toast({ message, onHidden }: Props) {
  const { reduceMotion } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const fade = reduceMotion ? 0 : TOAST_FADE_MS;
    const sequence = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: fade, useNativeDriver: true }),
      Animated.delay(TOAST_HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: fade, useNativeDriver: true }),
    ]);
    sequence.start(({ finished }) => finished && onHidden());
    return () => sequence.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite">
      <Animated.Text style={styles.text}>{message}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,22,0.9)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: {
    fontFamily: FONTS.title,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
