import { forwardRef, ReactNode, useRef } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { KEY_EDGE_HEIGHT, KEY_PRESS_DURATION_MS, KEY_PRESS_MOVE_DISTANCE } from '../constants/theme';

type AnimatableColor = string | Animated.AnimatedInterpolation<string>;

type Props = {
  width?: ViewStyle['width'];
  height: number; // the button's total footprint, edge included
  faceColor: AnimatableColor;
  edgeColor: AnimatableColor;
  borderRadius?: number;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  // Rendered absolutely-filled on top of the plain faceColor fill, under the
  // content — e.g. a <LinearGradient> face (the x3 ad button) that a flat
  // faceColor alone can't express. faceColor is still required alongside it
  // (a plain fallback color, painted first).
  faceBackground?: ReactNode;
  children?: ReactNode;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean };
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Shared 3D "pressed" chrome for every edged button in the app (keyboard
// keys, the submit button, the reward/result modals' buttons, ...).
//
// Never animates borderBottomWidth or any other layout property — that
// can't run on the native driver, and mixing a JS-driven style with a
// native-driven one on the *same node* throws ("Style property ... is not
// supported by native animated module") and silently breaks the
// native-driven animation (see KeyboardKey.tsx's old crash). Instead: an
// outer View is filled with the edge color at the button's full (face +
// edge) height; a face wrapper sits on top of it and only ever carries a
// native-driven translateY for the press feedback; the face's own (possibly
// still-fading, JS-driven) color lives on a separate inner View underneath
// the content — same three-layer split Tile.tsx/PowerUpButton.tsx already
// use for the same reason.
export default forwardRef<View, Props>(function Button3D(
  {
    width,
    height,
    faceColor,
    edgeColor,
    borderRadius = 14,
    disabled,
    onPress,
    onPressIn,
    onPressOut,
    style,
    contentStyle,
    faceBackground,
    children,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
  },
  ref,
) {
  const pressProgress = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: KEY_PRESS_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    onPressIn?.();
  };
  const handlePressOut = () => {
    Animated.timing(pressProgress, {
      toValue: 0,
      duration: KEY_PRESS_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    onPressOut?.();
  };

  const translateY = pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, KEY_PRESS_MOVE_DISTANCE] });
  const faceHeight = height - KEY_EDGE_HEIGHT;

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: edgeColor }, style]}>
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={[styles.face, { height: faceHeight, borderRadius, transform: [{ translateY }] }]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, backgroundColor: faceColor }]} />
        {faceBackground ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
            {faceBackground}
          </View>
        ) : null}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </AnimatedPressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  face: {
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
