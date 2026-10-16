import { useEffect, useLayoutEffect, useRef } from 'react';
import { Animated } from 'react-native';

// Runs the (looping, native-driven) animation `make()` builds while `running`
// is true, and stops it when it turns false or on unmount, then calls
// `reset` (e.g. to set the value back to rest). Home's idle motion uses it
// with the menu background's rules: `running` = Home on screen, the app
// active and no reduced motion.
export function useLoopWhile(running: boolean, make: () => Animated.CompositeAnimation, reset?: () => void) {
  const makeRef = useRef(make);
  const resetRef = useRef(reset);
  useLayoutEffect(() => {
    makeRef.current = make;
    resetRef.current = reset;
  });
  useEffect(() => {
    if (!running) return;
    const animation = makeRef.current();
    animation.start();
    return () => {
      animation.stop();
      resetRef.current?.();
    };
  }, [running]);
}
