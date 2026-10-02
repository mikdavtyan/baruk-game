import { useEffect, useState } from 'react';
import { Animated, DimensionValue, StyleSheet, View, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../constants/theme';
import { RIBBON_ENTER_DURATION_MS } from '../constants/winFlow';

type AnimatableColor = string | Animated.AnimatedInterpolation<string>;

type Props = {
  text: string;
  // Top -> bottom gradient fill. expo-linear-gradient's own `colors` prop
  // can't be Animated (no native support for interpolating it), so this is
  // always a plain snapshot — same accepted tradeoff as the result card's
  // own gradient tokens (see constants/theme.ts's cardGradientStart/End).
  bandColors: [string, string];
  bandEdgeColor: AnimatableColor; // the band's 3D bottom edge — may be a themed `color()`
  tailColor: string; // side tails + fold triangles
  // Size — defaults are the full-width modal ribbon; the folds scale with height.
  width?: DimensionValue;
  height?: number;
  fontSize?: number;
};

const DEFAULT_HEIGHT = 56;

// The "ՀԱՂԹԱՆԱԿ" / "ԽԱՂՆ ԱՎԱՐՏՎԵՑ" ribbon banner — shared by the win reward
// modal (green) and the loss second-chance modal (muted red), differing only
// in color. Entrance: scaleX 0 -> 1.05 -> 1.
export default function Ribbon({ text, bandColors, bandEdgeColor, tailColor, width = '86%', height = DEFAULT_HEIGHT, fontSize = 20 }: Props) {
  const k = height / DEFAULT_HEIGHT;
  const fold = { top: 6 * k, width: 18 * k, height: 44 * k };
  const [scaleX] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleX, {
        toValue: 1.05,
        duration: RIBBON_ENTER_DURATION_MS * 0.75,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleX, {
        toValue: 1,
        duration: RIBBON_ENTER_DURATION_MS * 0.25,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleX]);

  return (
    <Animated.View style={[styles.ribbon, { width, height, transform: [{ scaleX }] }]}>
      <View style={[styles.ribbonFold, fold, { left: -8 * k }, styles.ribbonFoldLeft, { backgroundColor: tailColor }]} />
      <View style={[styles.ribbonFold, fold, { right: -8 * k }, styles.ribbonFoldRight, { backgroundColor: tailColor }]} />
      <Animated.View style={[styles.ribbonBody, { borderBottomColor: bandEdgeColor }]}>
        <LinearGradient colors={bandColors} style={StyleSheet.absoluteFill} />
        <Animated.Text style={[styles.ribbonText, { fontSize }]}>{text}</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonBody: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottomWidth: 3,
  },
  ribbonFold: {
    position: 'absolute',
  },
  ribbonFoldLeft: { transform: [{ rotate: '12deg' }] },
  ribbonFoldRight: { transform: [{ rotate: '-12deg' }] },
  ribbonText: {
    fontFamily: FONTS.title,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
