import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import {
  HINT_ARC,
  HINT_FLIGHT_MS,
  HINT_LIGHT_SIZE,
  HINT_SPARK_COUNT,
  HINT_SPARK_TRAVEL,
  HINT_SPARKS_MS,
} from '../constants/theme';

type Point = { x: number; y: number };

// One Hint's flight: from the Hint button's center to the target cell's
// center, in window coordinates (measured by App at tap time).
export type HintFlight = { id: number; origin: Point; target: Point };

// Fixed game-art greens, the same in both themes (a theme toggle mid-flight
// changes nothing). Never yellow — yellow means "wrong position".
const LIGHT_CORE = '#EFFFF2';
const LIGHT_GLOW = '#3DDC6E';
const SPARK = '#5BE584';
const HALO_SIZE = HINT_LIGHT_SIZE * 2;
const SPARK_SIZE = 5;
const PATH_STEPS = 16;

// The light's path: a quadratic Bézier bulging sideways by HINT_ARC of the
// flight's length, sampled into interpolation stops — RN's Animated can only
// follow a curve this way without a per-frame JS loop.
function samplePath(start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bulge = HINT_ARC * dist;
  const ctrl = { x: (start.x + end.x) / 2 + (-dy / dist) * bulge, y: (start.y + end.y) / 2 + (dx / dist) * bulge };
  const inputRange: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= PATH_STEPS; i++) {
    const t = i / PATH_STEPS;
    const mt = 1 - t;
    inputRange.push(t);
    xs.push(mt * mt * start.x + 2 * mt * t * ctrl.x + t * t * end.x);
    ys.push(mt * mt * start.y + 2 * mt * t * ctrl.y + t * t * end.y);
  }
  return { inputRange, xs, ys };
}

// The Hint's "magic flight": a glowing green light flies on a curve from the
// Hint button to the target cell (HINT_FLIGHT_MS), then HINT_SPARK_COUNT
// green sparks burst outward from the cell and fade (HINT_SPARKS_MS).
// Always mounted, full-screen, outside the SafeAreaView (window coordinates,
// like ArrowOverlay); every view is pre-mounted at opacity 0, so a Hint only
// starts animations. Opacity and transform only, on the native driver.
// `flight` going null (a board reset) stops it and hides everything at once.
// App lands the ghost itself after HINT_FLIGHT_MS (coupled timing).
export default function HintFlightOverlay({ flight }: { flight: HintFlight | null }) {
  const [travel] = useState(() => new Animated.Value(0)); // 0 -> 1 along the path
  const [burst] = useState(() => new Animated.Value(0)); // 0 -> 1: sparks out and gone

  useEffect(() => {
    if (!flight) return;
    travel.setValue(0);
    burst.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(travel, {
        toValue: 1,
        duration: HINT_FLIGHT_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(burst, {
        toValue: 1,
        duration: HINT_SPARKS_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      travel.setValue(0);
      burst.setValue(0);
    };
  }, [flight, travel, burst]);

  const path = useMemo(() => (flight ? samplePath(flight.origin, flight.target) : null), [flight]);
  const target = flight?.target ?? { x: 0, y: 0 };

  // The light shows only while in the air: in on take-off, out on landing.
  const lightOpacity = travel.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] });
  const lightX = path ? travel.interpolate({ inputRange: path.inputRange, outputRange: path.xs }) : 0;
  const lightY = path ? travel.interpolate({ inputRange: path.inputRange, outputRange: path.ys }) : 0;
  const sparkOpacity = burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[styles.light, { opacity: lightOpacity, transform: [{ translateX: lightX }, { translateY: lightY }] }]}
      >
        <View style={styles.halo} />
        <View style={styles.core} />
      </Animated.View>
      <View style={[styles.burstOrigin, { left: target.x, top: target.y }]}>
        {Array.from({ length: HINT_SPARK_COUNT }, (_, i) => {
          const angle = (i / HINT_SPARK_COUNT) * Math.PI * 2;
          const reach = HINT_SPARK_TRAVEL * (0.8 + (i % 3) * 0.1); // varied a little per spark
          return (
            <Animated.View
              key={i}
              style={[
                styles.spark,
                {
                  opacity: sparkOpacity,
                  transform: [
                    { translateX: Animated.multiply(burst, reach * Math.cos(angle)) },
                    { translateY: Animated.multiply(burst, reach * Math.sin(angle)) },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Anchored at the window's top-left; translateX/Y put its center on the path.
  light: {
    position: 'absolute',
    left: -HALO_SIZE / 2,
    top: -HALO_SIZE / 2,
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A soft glow without a blur or a big shadow: a larger, faint disc.
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: LIGHT_GLOW,
    opacity: 0.35,
  },
  core: {
    width: HINT_LIGHT_SIZE,
    height: HINT_LIGHT_SIZE,
    borderRadius: HINT_LIGHT_SIZE / 2,
    backgroundColor: LIGHT_CORE,
    borderWidth: 2,
    borderColor: LIGHT_GLOW,
  },
  burstOrigin: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  spark: {
    position: 'absolute',
    left: -SPARK_SIZE / 2,
    top: -SPARK_SIZE / 2,
    width: SPARK_SIZE,
    height: SPARK_SIZE,
    borderRadius: SPARK_SIZE / 2,
    backgroundColor: SPARK,
  },
});
