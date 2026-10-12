import { useEffect, useState } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import { MODAL_RISE_FRICTION, MODAL_RISE_FROM, MODAL_RISE_TENSION } from '../constants/winFlow';

// An end-of-round modal's entrance: it springs up from below the screen with a
// small bounce (translateY, native driver). `translateY` goes on the modal's
// wrapper; `play` starts it (call it in the same tick the modal is shown, so
// it mounts already below); reduced motion: in place at once. The window
// height is fed in with setValue, so the node is built once. A modal shown
// without `play` (a relaunch-resume) is simply in place.
export function useModalRise() {
  const { height } = useWindowDimensions();
  const [rise] = useState(() => new Animated.Value(0)); // 1 = below, 0 = in place
  const [distance] = useState(() => new Animated.Value(height * MODAL_RISE_FROM));
  const [translateY] = useState(() => Animated.multiply(rise, distance));
  useEffect(() => {
    distance.setValue(height * MODAL_RISE_FROM);
  }, [height, distance]);
  const [play] = useState(() => (reduceMotion: boolean, onDone?: () => void) => {
    if (reduceMotion) {
      rise.setValue(0);
      onDone?.();
      return;
    }
    rise.setValue(1);
    Animated.spring(rise, {
      toValue: 0,
      friction: MODAL_RISE_FRICTION,
      tension: MODAL_RISE_TENSION,
      useNativeDriver: true,
    }).start(() => onDone?.());
  });
  return { translateY, play };
}
