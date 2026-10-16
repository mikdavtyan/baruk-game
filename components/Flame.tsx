import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { StreakFlame } from './StreakFlame';
import { LOSS_FLAME_FLICKER_MS } from '../constants/winFlow';

type Props = {
  size?: number;
  flicker?: boolean; // disabled under reduced motion
};

// The second-chance modal's hero icon: the big drawn streak flame
// (StreakFlame, in the fortune wheel's icon family). Flickers gently
// (scaleY 0.96 <-> 1.04, slight skewX) unless `flicker` is false.
export default function Flame({ size = 72, flicker = true }: Props) {
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
      <StreakFlame size={size} tier="big" />
    </Animated.View>
  );
}
