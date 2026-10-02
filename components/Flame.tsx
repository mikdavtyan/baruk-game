import { useEffect, useId, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { LOSS_FLAME_FLICKER_MS } from '../constants/winFlow';

type Props = {
  size?: number;
  flicker?: boolean; // disabled under reduced motion
};

// A simple flame silhouette filled with a warm gradient — the second-chance
// modal's hero icon. Flickers gently (scaleY 0.96 <-> 1.04, slight skewX)
// unless `flicker` is false.
const FLAME_PATH =
  'M50 6C38 22 24 34 24 56C24 76 36 94 50 94C64 94 76 76 76 56C76 40 66 30 62 18' +
  'C60 26 54 30 50 26C46 22 48 14 50 6Z';

export default function Flame({ size = 72, flicker = true }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const gradientId = `flame-fill-${uid}`;
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!flicker) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: LOSS_FLAME_FLICKER_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: LOSS_FLAME_FLICKER_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker, anim]);

  const scaleY = anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const skewX = anim.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scaleY }, { skewX }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gradientId} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#FFC24A" />
            <Stop offset="1" stopColor="#F0642E" />
          </LinearGradient>
        </Defs>
        <Path d={FLAME_PATH} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}
