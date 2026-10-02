import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useTheme } from './ThemeContext';

// Animates a displayed integer from its previous value up (or down) to a
// new one whenever it changes — used anywhere a number itself should visibly
// count rather than snap (header score/coins, the reward's "+N", the result
// modal's points/streak). Respects reduced motion: the number just jumps
// straight to the new value with no animation.
export function useCountUp(value: number, durationMs = 600): number {
  const { reduceMotion } = useTheme();
  const [displayed, setDisplayed] = useState(value);
  const anim = useRef(new Animated.Value(value)).current;
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value === prevValueRef.current) return;
    const from = prevValueRef.current;
    prevValueRef.current = value;

    if (reduceMotion) {
      // Deliberate: reduced motion snaps straight to the new value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayed(value);
      return;
    }

    anim.setValue(from);
    const listenerId = anim.addListener(({ value: v }) => setDisplayed(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: durationMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // driving a plain numeric listener, not a style prop
    }).start(() => {
      anim.removeListener(listenerId);
      setDisplayed(value);
    });
    return () => anim.removeListener(listenerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, reduceMotion]);

  return displayed;
}
