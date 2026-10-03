import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import {
  ARROW_FLIGHT_DURATION_MS,
  ARROW_LAUNCH_GROW_MS,
  ARROW_QUIVER_MS,
  ARROW_STAGGER_MS,
  ARROW_STUCK_FADE_MS,
  ARROW_VISUAL_LENGTH,
  PARTICLE_BURST_COUNT,
  PARTICLE_FADE_MS,
} from '../constants/theme';
import { useThemeSnapshot } from '../lib/ThemeContext';

const arrowLight = require('../assets/icons/arrow-light.png');
const arrowDark = require('../assets/icons/arrow-dark.png');
// The source sprite's own aspect ratio (see chat) — the arrow's rendered
// height follows from ARROW_VISUAL_LENGTH so it never looks stretched.
const ARROW_ASPECT = 92 / 237;
const ARROW_VISUAL_HEIGHT = ARROW_VISUAL_LENGTH * ARROW_ASPECT;

type Point = { x: number; y: number };
export type ArrowTarget = { token: string; x: number; y: number };

type Props = {
  volleyId: number;
  origin: Point | null;
  targets: ArrowTarget[];
};

// Samples a quadratic Bézier (start -> end, control point = the midpoint
// offset perpendicular to the line by 15% of its length, toward `side`)
// at `steps` points, returning both the curve position AND its tangent
// angle at each sample — this is what lets the arrow follow a curved path
// and keep its head pointed the right way using only Animated.interpolate
// (RN can't animate along an arbitrary path any other way without a raw
// per-frame loop). Positions are pre-adjusted so it's the arrow's TIP —
// not its center — that actually traces the curve and lands exactly on
// `end`, matching the sprite's own "tip at the right edge" orientation.
function sampleArrowPath(start: Point, end: Point, side: 1 | -1, steps = 24) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const px = -dy / dist;
  const py = dx / dist;
  const offset = 0.15 * dist * side;
  const ctrl = { x: (start.x + end.x) / 2 + px * offset, y: (start.y + end.y) / 2 + py * offset };

  const inputRange: number[] = [];
  const translateX: number[] = [];
  const translateY: number[] = [];
  const angles: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * start.x + 2 * mt * t * ctrl.x + t * t * end.x;
    const y = mt * mt * start.y + 2 * mt * t * ctrl.y + t * t * end.y;
    const tx = 2 * mt * (ctrl.x - start.x) + 2 * t * (end.x - ctrl.x);
    const ty = 2 * mt * (ctrl.y - start.y) + 2 * t * (end.y - ctrl.y);
    let angle = Math.atan2(ty, tx) * (180 / Math.PI);
    if (angles.length > 0) {
      // Unwrap so consecutive samples sweep the short way around, never
      // the long way (which would show as a wild spin for one frame).
      let d = angle - angles[angles.length - 1];
      while (d > 180) {
        angle -= 360;
        d = angle - angles[angles.length - 1];
      }
      while (d < -180) {
        angle += 360;
        d = angle - angles[angles.length - 1];
      }
    }
    angles.push(angle);
    const rad = (angle * Math.PI) / 180;
    // Back the anchor off by half the arrow's length along its current
    // heading, so the TIP (not the sprite's center) is what sits on (x, y).
    inputRange.push(t);
    translateX.push(x - (ARROW_VISUAL_LENGTH / 2) * Math.cos(rad) - ARROW_VISUAL_LENGTH / 2);
    translateY.push(y - (ARROW_VISUAL_LENGTH / 2) * Math.sin(rad) - ARROW_VISUAL_HEIGHT / 2);
  }

  return { inputRange, translateX, translateY, angles };
}

function ParticleBurst({ x, y, delayMs, dotColor }: { x: number; y: number; delayMs: number; dotColor: string }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: PARTICLE_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View style={[styles.burstOrigin, { left: x, top: y }]} pointerEvents="none">
      {Array.from({ length: PARTICLE_BURST_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_BURST_COUNT) * Math.PI * 2;
        const travel = 10 + (i % 3) * 2; // 10-14px, varied per dot
        const dotSize = 5 + (i % 2);
        const translateX = Animated.multiply(progress, travel * Math.cos(angle));
        const translateY = Animated.multiply(progress, travel * Math.sin(angle));
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                marginLeft: -dotSize / 2,
                marginTop: -dotSize / 2,
                backgroundColor: dotColor,
                opacity,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function FlyingArrow({
  origin,
  target,
  side,
  delayMs,
  source,
}: {
  origin: Point;
  target: Point;
  side: 1 | -1;
  delayMs: number;
  source: ReturnType<typeof require>;
}) {
  const [grow] = useState(() => new Animated.Value(0)); // 0.5x/opacity 0 -> full, first ARROW_LAUNCH_GROW_MS
  const [flight] = useState(() => new Animated.Value(0)); // 0 -> 1 across the curve
  const [quiver] = useState(() => new Animated.Value(0)); // stuck-in wobble
  const [stuck] = useState(() => new Animated.Value(1)); // 1 -> 0 fade once quiver ends

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        Animated.timing(grow, {
          toValue: 1,
          duration: ARROW_LAUNCH_GROW_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        Animated.timing(flight, {
          toValue: 1,
          duration: ARROW_FLIGHT_DURATION_MS,
          // CSS cubic-bezier(0.22, 0.61, 0.36, 1) — a gentle ease-out.
          easing: Easing.bezier(0.22, 0.61, 0.36, 1),
          useNativeDriver: true,
        }).start();
      }, delayMs),
    );
    timers.push(
      setTimeout(() => {
        Animated.timing(quiver, {
          toValue: 1,
          duration: ARROW_QUIVER_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      }, delayMs + ARROW_FLIGHT_DURATION_MS),
    );
    timers.push(
      setTimeout(() => {
        Animated.timing(stuck, {
          toValue: 0,
          duration: ARROW_STUCK_FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }, delayMs + ARROW_FLIGHT_DURATION_MS + ARROW_QUIVER_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { inputRange, translateX, translateY, angles } = sampleArrowPath(origin, target, side);
  const flightTranslateX = flight.interpolate({ inputRange, outputRange: translateX });
  const flightTranslateY = flight.interpolate({ inputRange, outputRange: translateY });
  const flightAngle = flight.interpolate({ inputRange, outputRange: angles.map((a) => `${a}deg`) });
  // Quivers around the stuck tip: +6°, -4°, +2°, 0° over ARROW_QUIVER_MS.
  const quiverAngle = quiver.interpolate({
    inputRange: [0, 0.25, 0.55, 0.8, 1],
    outputRange: ['0deg', '6deg', '-4deg', '2deg', '0deg'],
  });
  const growScale = grow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const opacity = Animated.multiply(grow, stuck);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.arrow,
        {
          width: ARROW_VISUAL_LENGTH,
          height: ARROW_VISUAL_HEIGHT,
          opacity,
          transform: [
            { translateX: flightTranslateX },
            { translateY: flightTranslateY },
            { rotate: flightAngle },
            { rotate: quiverAngle },
            { scale: growScale },
          ],
        },
      ]}
    >
      <Image
        source={source}
        resizeMode="contain"
        style={{ width: ARROW_VISUAL_LENGTH, height: ARROW_VISUAL_HEIGHT }}
      />
    </Animated.View>
  );
}

// Fixed, full-screen, touch-transparent overlay — flies one arrow per
// eliminated letter from the bow icon to that key, along a curved path, and
// leaves a brief particle burst + quivering-stuck-arrow at each impact.
// Positions are resolved by App.tsx at the moment Darts fires (measuring the
// real bow button and keyboard positions), not computed here.
function ArrowOverlay({ volleyId, origin, targets }: Props) {
  const { isDark, theme } = useThemeSnapshot();
  if (!origin || targets.length === 0) return null;

  const arrowSource = isDark ? arrowDark : arrowLight;
  const dotColor = theme.present;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {targets.map((t, i) => {
        const side: 1 | -1 = i % 2 === 0 ? -1 : 1; // left, right, left, ...
        const delayMs = i * ARROW_STAGGER_MS;
        return (
          <FlyingArrow
            key={`${volleyId}-${i}`}
            origin={origin}
            target={{ x: t.x, y: t.y }}
            side={side}
            delayMs={delayMs}
            source={arrowSource}
          />
        );
      })}
      {targets.map((t, i) => (
        <ParticleBurst
          key={`burst-${volleyId}-${i}`}
          x={t.x}
          y={t.y}
          delayMs={i * ARROW_STAGGER_MS + ARROW_FLIGHT_DURATION_MS}
          dotColor={dotColor}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: {
    position: 'absolute',
    left: 0,
    top: 0,
    // The reference art has no built-in shadow, so RN's own shadow props
    // stand in for the spec's `filter: drop-shadow(...)` — visible against
    // both themes since it's a plain dark, soft-edged offset shadow. iOS
    // only: RN's Android equivalent (`elevation`) draws a shadow around the
    // view's rectangular bounding box rather than the arrow's own silhouette
    // (no alpha-aware shadows on that platform), which would look like a
    // visible gray box — worse than no shadow, so it's skipped there.
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3 } }),
  },
  burstOrigin: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  dot: {
    position: 'absolute',
  },
});

// Memoized: App re-renders on every keystroke (see the stable props there).
export default memo(ArrowOverlay);
