import { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import Coin from './Coin';
import { CONFETTI_DURATION_MS, CONFETTI_PIECE_COUNT } from '../constants/winFlow';
import { useThemeSnapshot } from '../lib/ThemeContext';

// Simple closed-form projectile-with-linear-drag physics, sampled at a
// handful of points and fed through Animated.interpolate — the same
// "precompute a curve, then sample it" technique ArrowOverlay.tsx uses for
// its bow shots, chosen for the same reason: RN has no <canvas>, and running
// a live per-frame physics loop across ~140 pieces on the JS thread would be
// a real perf risk that a request-once, native-driven interpolation avoids.
const SAMPLES = 10;
const GRAVITY = 1400; // px/s^2
const DRAG = 1.1; // per second, linear air drag

function samplePhysics(x0: number, y0: number, vx0: number, vy0: number, durationS: number) {
  const inputRange: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * durationS;
    const decay = Math.exp(-DRAG * t);
    const x = x0 + (vx0 / DRAG) * (1 - decay);
    const y = y0 + ((vy0 + GRAVITY / DRAG) / DRAG) * (1 - decay) - (GRAVITY / DRAG) * t;
    inputRange.push(i / SAMPLES);
    xs.push(x);
    ys.push(y);
  }
  return { inputRange, xs, ys };
}

type Piece = {
  id: number;
  shape: 'rect' | 'circle' | 'coin';
  color: string;
  size: number;
  inputRange: number[];
  xs: number[];
  ys: number[];
  spinDeg: number;
  flipFreq: number;
  flipPhase: number;
};

type Props = {
  originX: number; // where the praise word is, for its own smaller burst
  originY: number;
  onDone: () => void;
};

export default function WinConfetti({ originX, originY, onDone }: Props) {
  const { theme } = useThemeSnapshot();
  const [progress] = useState(() => new Animated.Value(0));

  const [pieces] = useState<Piece[]>(() => {
    const { width, height } = Dimensions.get('window');
    const colors = [theme.correct, theme.present, '#F4B21F', '#FFF8E7', '#6FA8DC', '#C58BE0'];
    const durationS = CONFETTI_DURATION_MS / 1000;
    const cornerCount = Math.round(CONFETTI_PIECE_COUNT * 0.43); // ~60 from each bottom corner
    const centerCount = Math.max(0, CONFETTI_PIECE_COUNT - cornerCount * 2); // the rest, behind the praise word

    const list: Piece[] = [];
    const pushFrom = (x0: number, y0: number, baseAngle: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * (Math.PI * 0.7);
        const speed = 480 + Math.random() * 620;
        const vx0 = Math.cos(angle) * speed;
        const vy0 = Math.sin(angle) * speed; // negative = up, screen y-down convention
        const { inputRange, xs, ys } = samplePhysics(x0, y0, vx0, vy0, durationS);
        const isCoin = list.length % 24 === 0; // ~6 of ~140
        list.push({
          id: list.length,
          shape: isCoin ? 'coin' : Math.random() > 0.5 ? 'rect' : 'circle',
          color: colors[Math.floor(Math.random() * colors.length)],
          size: isCoin ? 10 : 6 + Math.random() * 5,
          inputRange,
          xs,
          ys,
          spinDeg: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540),
          flipFreq: 3 + Math.random() * 4,
          flipPhase: Math.random() * Math.PI * 2,
        });
      }
    };

    pushFrom(0, height, -Math.PI / 3, cornerCount); // bottom-left corner, fanning up-right
    pushFrom(width, height, -(Math.PI * 2) / 3, cornerCount); // bottom-right corner, fanning up-left
    pushFrom(originX, originY, -Math.PI / 2, centerCount); // behind the praise word, straight up

    return list;
    // Deliberately computed once, like the existing (simpler) Confetti.tsx —
    // a fresh random burst per mount, not meant to react to later changes.
  });

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: CONFETTI_DURATION_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => {
        const translateX = progress.interpolate({ inputRange: p.inputRange, outputRange: p.xs });
        const translateY = progress.interpolate({ inputRange: p.inputRange, outputRange: p.ys });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spinDeg}deg`] });
        const flipOutput = p.inputRange.map((t) => Math.cos(t * p.flipFreq * Math.PI * 2 + p.flipPhase));
        const scaleY = progress.interpolate({ inputRange: p.inputRange, outputRange: flipOutput });
        const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.piece,
              { opacity, transform: [{ translateX }, { translateY }, { rotate }, { scaleY }] },
            ]}
          >
            {p.shape === 'coin' ? (
              <Coin size={p.size} />
            ) : (
              <View
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: p.shape === 'circle' ? p.size / 2 : 1,
                }}
              />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
