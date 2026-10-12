import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { BowArt } from './ArcheryArt';
import {
  ARROW_FLIGHT_DURATION_MS,
  ARROW_QUIVER_MS,
  ARROW_STAGGER_MS,
  ARROW_STUCK_FADE_MS,
  ICON_RELOAD_MS,
} from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

// The drawn bow (BowArt, in the fortune wheel's icon family) — fixed game-art
// colors, so the icon never reads the theme. The whole icon reacts together
// (recoil, then a reload pulse) — see the note on the reload effect below.

type Props = {
  size?: number;
  volleyId: number; // bumped each time Darts actually fires
  shotCount: number; // how many arrows this volley has (0 before the first fire)
};

function totalVolleyMs(shotCount: number) {
  if (shotCount <= 0) return 0;
  return (shotCount - 1) * ARROW_STAGGER_MS + ARROW_FLIGHT_DURATION_MS + ARROW_QUIVER_MS + ARROW_STUCK_FADE_MS;
}

// The bow icon's own reaction to a volley: a small recoil (shift back-and-
// down + squash, springing back) on each shot, timed to when that arrow
// actually leaves — then, once every arrow has fully landed and faded, a
// brief reload pulse, played across the whole icon.
export default function BowIcon({ size = 24, volleyId, shotCount }: Props) {
  const { reduceMotion } = useTheme();
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
    <Animated.View
      style={[
        styles.icon,
        { width: size, height: size },
        { opacity: reload, transform: [{ translateX }, { translateY }, { scale: recoilScale }, { scale: reload }] },
      ]}
    >
      <BowArt size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: {},
});
