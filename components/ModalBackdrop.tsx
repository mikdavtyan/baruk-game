import { Animated, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Vignette from './Vignette';

type Props = {
  opacity: Animated.Value | Animated.AnimatedInterpolation<number>;
};

// The shared full-screen backdrop for every post-game modal — win reward/
// result AND loss second-chance/result: a dark blur, a flat tint on top, and
// a soft vignette. `opacity` drives all three together (see A7).
export default function ModalBackdrop({ opacity }: Props) {
  return (
    <Animated.View style={[styles.fill, { opacity }]} pointerEvents="none">
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <Vignette />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tint: {
    backgroundColor: 'rgba(8,8,10,0.6)',
  },
});
