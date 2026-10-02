import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const PIECE_COLORS = ['#2e9e5b', '#f2b531', '#4f9df7', '#f76c6c', '#5d6472'];
const PIECE_COUNT = 14; // kept small — lightweight, not a full particle system

export default function Confetti() {
  // Lazy initializer so the random layout is only computed once, on mount.
  const [pieces] = useState(() =>
    Array.from({ length: PIECE_COUNT }, (_, i) => ({
      translateY: new Animated.Value(-10),
      translateX: Math.round(Math.random() * 160 - 80),
      rotate: new Animated.Value(0),
      color: PIECE_COLORS[i % PIECE_COLORS.length],
      left: Math.round(Math.random() * 90) + 5,
      delay: Math.round(Math.random() * 120),
    }))
  );

  useEffect(() => {
    const animations = pieces.map((p) =>
      Animated.parallel([
        Animated.timing(p.translateY, {
          toValue: 170,
          duration: 850,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: 1,
          duration: 850,
          delay: p.delay,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, [pieces]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {pieces.map((p, i) => {
        const rotate = p.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: `${p.left}%`,
                backgroundColor: p.color,
                transform: [{ translateY: p.translateY }, { translateX: p.translateX }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
