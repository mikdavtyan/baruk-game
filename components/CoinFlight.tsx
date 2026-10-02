import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Coin from './Coin';
import { COIN_FLIGHT_DURATION_MS, COIN_FLIGHT_PIECES, COIN_FLIGHT_STAGGER_MS } from '../constants/winFlow';

type Point = { x: number; y: number };

// A quadratic Bézier from origin to target, bowed to one side, sampled into
// breakpoints for interpolate() — the whole path runs on the native driver.
function buildPath(origin: Point, target: Point, side: 1 | -1) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = (0.22 + Math.random() * 0.12) * dist * side;
  const ctrl = { x: (origin.x + target.x) / 2 + (-dy / dist) * bow, y: (origin.y + target.y) / 2 + (dx / dist) * bow };
  const steps = 16;
  const inputRange: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    inputRange.push(t);
    xs.push(mt * mt * origin.x + 2 * mt * t * ctrl.x + t * t * target.x);
    ys.push(mt * mt * origin.y + 2 * mt * t * ctrl.y + t * t * target.y);
  }
  return { inputRange, xs, ys };
}

function FlyingCoin({
  origin,
  target,
  side,
  delayMs,
  onDepart,
  onArrive,
}: {
  origin: Point;
  target: Point;
  side: 1 | -1;
  delayMs: number;
  onDepart?: () => void;
  onArrive: () => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const [{ inputRange, xs, ys }] = useState(() => buildPath(origin, target, side));

  useEffect(() => {
    const flight = Animated.timing(progress, {
      toValue: 1,
      duration: COIN_FLIGHT_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const t = setTimeout(() => {
      onDepart?.();
      flight.start(({ finished }) => {
        if (finished) onArrive();
      });
    }, delayMs);
    // Stopping (not just un-scheduling) matters: a flight cut short must
    // never report a late landing that would recount the pill.
    return () => {
      clearTimeout(t);
      flight.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateX = progress.interpolate({ inputRange, outputRange: xs });
  const translateY = progress.interpolate({ inputRange, outputRange: ys });
  const scale = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0.6] });

  return (
    <Animated.View pointerEvents="none" style={[styles.coin, { transform: [{ translateX }, { translateY }, { scale }] }]}>
      <Coin size={26} />
    </Animated.View>
  );
}

type Props = {
  origin: Point;
  target: Point;
  amount: number;
  // Overrides the piece count (default: min(amount, COIN_FLIGHT_PIECES)).
  pieceCount?: number;
  // Called once per coin the moment IT starts moving — e.g. the loss flow's
  // "reverse" flight counts the pill down as each coin actually leaves it.
  onDepart?: () => void;
  onArrival: () => void; // once per coin that lands — step the pill's count + pulse here
  onAllDone: () => void;
};

// A few coins flying curved paths (alternating sides) from origin to target,
// staggered — transform-only, on the native driver, never blocking the UI.
// Unmounting it ends the flight at once; nothing lands afterwards.
export default function CoinFlight({ origin, target, amount, pieceCount, onDepart, onArrival, onAllDone }: Props) {
  const count = pieceCount ?? Math.max(1, Math.min(amount, COIN_FLIGHT_PIECES));
  const arrivedRef = useRef(0);

  const handleArrive = () => {
    arrivedRef.current += 1;
    onArrival();
    if (arrivedRef.current >= count) onAllDone();
  };

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <FlyingCoin
          key={i}
          origin={origin}
          target={target}
          side={i % 2 === 0 ? -1 : 1}
          delayMs={i * COIN_FLIGHT_STAGGER_MS}
          onDepart={onDepart}
          onArrive={handleArrive}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  coin: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
