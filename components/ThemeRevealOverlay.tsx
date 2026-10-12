import { memo, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Group, Image, Skia, SkImage } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { THEME_REVEAL_MS } from '../constants/theme';

export type RevealOrigin = { x: number; y: number };

type Props = {
  image: SkImage; // the old look, over everything
  origin: RevealOrigin | null; // window coordinates; null → the screen's center
  onCovered: () => void; // the snapshot is on screen: switch the theme underneath
  onDone: () => void; // the circle has fully opened: unmount
};

// Two frames: the first commits, the second has painted.
function afterFrames(n: number, fn: () => void) {
  let id = 0;
  const step = (left: number) => {
    id = requestAnimationFrame(() => (left <= 1 ? fn() : step(left - 1)));
  };
  step(n);
  return () => cancelAnimationFrame(id);
}

// The theme switch's circle reveal (docs/adr/0006): a full-window Skia canvas
// shows the snapshot of the old look; once it has painted the theme switches
// underneath, and a circular hole grows from `origin` until the snapshot is
// gone. The radius is a Reanimated shared value, so every frame runs on the
// UI thread. Swallows touches while it runs. This is the one place the app
// uses Reanimated instead of Animated (Skia draws from shared values).
function ThemeRevealOverlay({ image, origin, onCovered, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const [{ cx, cy, maxRadius }] = useState(() => {
    const x = origin?.x ?? width / 2;
    const y = origin?.y ?? height / 2;
    return { cx: x, cy: y, maxRadius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 2 };
  });
  const radius = useSharedValue(0);
  const hole = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.addCircle(cx, cy, radius.value);
    return path;
  });

  useEffect(() => {
    let cancelSecond = () => {};
    const cancelFirst = afterFrames(2, () => {
      onCovered();
      // Let the new theme paint under the snapshot before opening it.
      cancelSecond = afterFrames(2, () => {
        radius.value = withTiming(
          maxRadius,
          { duration: THEME_REVEAL_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) },
          (finished) => {
            if (finished) scheduleOnRN(onDone);
          },
        );
      });
    });
    return () => {
      cancelFirst();
      cancelSecond();
    };
    // Runs once per reveal (the overlay is keyed by it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} testID="theme-reveal">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group clip={hole} invertClip>
          <Image image={image} x={0} y={0} width={width} height={height} fit="fill" />
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(ThemeRevealOverlay);
