import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import {
  ARROW_FLIGHT_DURATION_MS,
  ARROW_QUIVER_MS,
  ARROW_STAGGER_MS,
  ARROW_STUCK_FADE_MS,
  ICON_RELOAD_MS,
} from '../constants/theme';
import { useTheme, useThemeSnapshot } from '../lib/ThemeContext';

// Provided art (see chat) — a flat raster per theme, not a multi-part SVG,
// so unlike the original spec's separately-animatable nocked-arrow glyph,
// the whole icon reacts together (recoil, then a reload pulse) — see the
// note on the reload effect below.
const bowLight = require('../assets/icons/bow-light.png');
const bowDark = require('../assets/icons/bow-dark.png');

type Props = {
  size?: number;
  volleyId: number; // bumped each time Darts actually fires
  shotCount: number; // how many arrows this volley has (0 before the first fire)
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

function totalVolleyMs(shotCount: number) {
  if (shotCount <= 0) return 0;
  return (shotCount - 1) * ARROW_STAGGER_MS + ARROW_FLIGHT_DURATION_MS + ARROW_QUIVER_MS + ARROW_STUCK_FADE_MS;
}

// The bow icon's own reaction to a volley: a small recoil (shift back-and-
// down + squash, springing back) on each shot, timed to when that arrow
// actually leaves — then, once every arrow has fully landed and faded, a
// brief reload pulse. The reference art is one flat image per theme rather
// than separable layers, so — unlike the original spec's nocked-arrow-
// fades-out/slides-back-in detail — this plays across the whole icon
// instead of isolating just the small arrow inside it.
export default function BowIcon({ size = 24, volleyId, shotCount }: Props) {
  const { reduceMotion } = useTheme();
  const { isDark } = useThemeSnapshot();
  const [recoil] = useState(() => new Animated.Value(0)); // 0 = rest, 1 = fully recoiled
  const [reload] = useState(() => new Animated.Value(1)); // dips to 0 then back to 1
  const isFirstRun = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (isFirstRun.current) {
      // Don't replay on mount — only on a real, later trigger.
      isFirstRun.current = false;
      return;
    }
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (shotCount <= 0 || reduceMotion) return;

    for (let i = 0; i < shotCount; i++) {
      timeoutsRef.current.push(
        setTimeout(() => {
          recoil.setValue(0);
          Animated.sequence([
            Animated.timing(recoil, {
              toValue: 1,
              duration: 60,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(recoil, { toValue: 0, friction: 4, useNativeDriver: true }),
          ]).start();
        }, i * ARROW_STAGGER_MS),
      );
    }

    timeoutsRef.current.push(
      setTimeout(() => {
        reload.setValue(0.55);
        Animated.timing(reload, {
          toValue: 1,
          duration: ICON_RELOAD_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }, totalVolleyMs(shotCount)),
    );
    // Only a fresh trigger (volleyId change) should replay this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volleyId]);

  // Recoil: shifts back-and-down (opposite the bow's own draw, down-left)
  // and squashes slightly, springing back.
  const translateX = recoil.interpolate({ inputRange: [0, 1], outputRange: [0, -1.4] });
  const translateY = recoil.interpolate({ inputRange: [0, 1], outputRange: [0, 1.4] });
  const recoilScale = recoil.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });

  return (
    <AnimatedImage
      source={isDark ? bowDark : bowLight}
      resizeMode="contain"
      style={[
        styles.icon,
        { width: size, height: size },
        { opacity: reload, transform: [{ translateX }, { translateY }, { scale: recoilScale }, { scale: reload }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {},
});
