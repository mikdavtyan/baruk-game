import { forwardRef, ReactNode, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Coin from './Coin';
import { FONTS, KEY_EDGE_HEIGHT } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  icon: ReactNode;
  label: string; // accessibility only — the button has no visible text label
  price: number;
  disabled: boolean;
  // Looks unavailable. May be set while still pressable — e.g. an exhausted
  // power-up whose tap only explains why, for free.
  dimmed?: boolean;
  onPress: () => void;
};

const SIZE = 48;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Neutral power-up button — Hint and Darts now share this exact style: a
// filled ~48px circle (theme.keyBackground, same chip color as an unused
// keyboard key) with the same 3D bottom edge as a key, instead of an
// outlined circle. The price is shown below as small muted text + coin icon,
// in normal flow, not an overlapping badge.
//
// Forwards its ref to the actual pressable button (not the outer wrapper),
// so the Darts instance in BottomControls.tsx can be measured (measureInWindow)
// by App.tsx to know exactly where its arrows should fly from.
const PowerUpButton = forwardRef<View, Props>(function PowerUpButton(
  { icon, label, price, disabled, dimmed = disabled, onPress },
  ref,
) {
  const { color } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.92,
      duration: 60,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.wrapper}>
      {/* Split into two layers on purpose: RN's Animated can't mix a
          native-driven animation (this press scale) with a JS-driven one
          (the themed fill/edge colors, via `color()`) on the *same* node —
          see Tile.tsx for the full explanation. */}
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={[styles.circle, { transform: [{ scale }] }, dimmed && styles.circleDisabled]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: color('keyBackground'), borderBottomColor: color('keyEdge') }]}
        />
        {icon}
      </AnimatedPressable>
      <View style={styles.priceRow}>
        <Coin size={18} />
        <Animated.Text style={[styles.priceText, { color: color('textMuted') }]}>{price}</Animated.Text>
      </View>
    </View>
  );
});

export default PowerUpButton;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  circle: {
    width: SIZE,
    // A flat 3D bottom edge (borderBottomWidth) doesn't read cleanly on a
    // perfect circle, so this is a rounded square instead — same idea as a
    // keyboard key, just bigger. Reserves the edge's height within the
    // button's existing SIZE footprint, so its total size doesn't change.
    height: SIZE - KEY_EDGE_HEIGHT,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDisabled: {
    opacity: 0.45,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderBottomWidth: KEY_EDGE_HEIGHT,
  },
  priceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceText: {
    fontSize: 11,
    fontFamily: FONTS.body,
  },
});
