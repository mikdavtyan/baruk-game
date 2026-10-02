import { useLayoutEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import Button3D from './Button3D';
import {
  FONT_LINE_HEIGHT_EM,
  FONTS,
  KEY_IMPACT_BOUNCE_MS,
  KEY_IMPACT_COLOR_MS,
  KEY_COLOR_FADE_MS,
  LetterState,
  ThemeTokens,
} from '../constants/theme';
import { triggerKeyHaptic } from '../lib/haptics';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  label: string;
  state?: LetterState;
  width: number;
  height: number;
  fontSize?: number; // letter size; the keyboard scales it with the key width
  icon?: SymbolViewProps['name']; // shown instead of the label text (label is still used for accessibility)
  onPress?: () => void;
  // True for a key Darts/the bow just eliminated — uses the slower
  // KEY_IMPACT_COLOR_MS fade (timed to the arrow's flight) plus a small
  // squash-bounce, instead of the normal quick guess-scoring fade.
  slowFade?: boolean;
};

const KEY_MARGIN = 2.5;
const KEY_RADIUS = 8;

// Shares its `absent` color with the gameboard's absent tiles (Tile.tsx
// reads the same theme token), and its own "empty" (unused) color needs to
// stay visibly different from `absent` — see constants/theme.ts for why dark
// mode keeps unused keys light and makes absent keys solid black instead of
// the two being easy-to-confuse near-identical grays. Darts-revealed keys go
// through this exact same `state`, so they always match too.
//
// A key's color depends on TWO independent things that can each change at
// their own moment — its LetterState (empty -> correct/present/absent, once
// a guess is scored) and the active theme (light/dark) — and RN's Animated
// can't compose two live color interpolations into one. So each is handled
// separately: `resting*Token` below picks which *theme token* currently
// applies for a given state, and is read through ThemeContext's `color()`,
// which fades with the theme toggle (lib/ThemeContext.tsx); the *snapshot*
// keyColors/keyEdgeColor pair further down is only used for the brief
// (KEY_COLOR_FADE_MS) transition right when a key's own state changes.
function keyColors(s: LetterState, theme: ThemeTokens) {
  if (s === 'correct') return { bg: theme.correct, text: '#ffffff' };
  if (s === 'present') return { bg: theme.present, text: '#ffffff' };
  if (s === 'absent') return { bg: theme.absent, text: '#ffffff' };
  return { bg: theme.keyBackground, text: theme.keyText }; // empty / filled
}

function keyEdgeColor(s: LetterState, theme: ThemeTokens): string {
  if (s === 'correct') return theme.correctEdge;
  if (s === 'present') return theme.presentEdge;
  if (s === 'absent') return theme.absentEdge;
  return theme.keyEdge; // empty / filled
}

function restingBgToken(s: LetterState): keyof ThemeTokens {
  if (s === 'correct') return 'correct';
  if (s === 'present') return 'present';
  if (s === 'absent') return 'absent';
  return 'keyBackground';
}

function restingEdgeToken(s: LetterState): keyof ThemeTokens {
  if (s === 'correct') return 'correctEdge';
  if (s === 'present') return 'presentEdge';
  if (s === 'absent') return 'absentEdge';
  return 'keyEdge';
}

const isResult = (s: LetterState): s is 'correct' | 'present' | 'absent' =>
  s === 'correct' || s === 'present' || s === 'absent';

export default function KeyboardKey({
  label,
  state = 'empty',
  width,
  height,
  fontSize = 20,
  icon,
  onPress,
  slowFade = false,
}: Props) {
  const { theme, color, textColor: themedText } = useTheme();
  // 0 = showing fromState's colors, 1 = showing state's colors.
  const [progress] = useState(() => new Animated.Value(1));
  // The state the key is fading from. Key states only ever strengthen (see
  // computeKeyStates), so any fade here goes to a stronger color.
  const [fromState, setFromState] = useState(state);
  const [prevState, setPrevState] = useState(state);
  // True only for the brief KEY_COLOR_FADE_MS window right after `state`
  // itself changes — NOT the same thing as `fromState !== state`, which
  // (see keyColors/keyEdgeColor above) stays permanently true forever after
  // a key's very first scoring, long after that fade has actually finished.
  const [isStateFading, setIsStateFading] = useState(false);
  if (state !== prevState) {
    setPrevState(state);
    // New Game resets back to unused immediately, without a fade — so
    // nextFromState here equals `state` itself, and isStateFading is
    // correctly set false right away rather than needing the effect below
    // to reactively correct it a moment later.
    const nextFromState = isResult(state) ? prevState : state;
    setFromState(nextFromState);
    setIsStateFading(nextFromState !== state);
  }

  // Squash-bounce played only on a Darts/bow hit (see `slowFade`) — moves
  // down and squashes slightly, springing back, timed to when the arrow
  // actually lands rather than the normal instant guess-scoring update. Pure
  // transform, so (unlike the color fade above) this runs on the native
  // driver and can safely share the face's transform node with the press
  // feedback below.
  const [impactBounce] = useState(() => new Animated.Value(0));

  // Layout effect so the reset to 0 lands before paint — no one-frame flash
  // of the new color.
  useLayoutEffect(() => {
    if (fromState === state) {
      progress.setValue(1);
      return;
    }
    const isDartsHit = slowFade && state === 'absent';
    progress.setValue(0);
    const fade = Animated.timing(progress, {
      toValue: 1,
      duration: isDartsHit ? KEY_IMPACT_COLOR_MS : KEY_COLOR_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // the label's color rides this too, and Text colors stay on the JS side
    });
    fade.start(({ finished }) => finished && setIsStateFading(false));

    if (isDartsHit) {
      impactBounce.setValue(0);
      Animated.sequence([
        Animated.timing(impactBounce, {
          toValue: 1,
          duration: KEY_IMPACT_BOUNCE_MS * 0.4,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(impactBounce, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]).start();
    }

    return () => fade.stop();
  }, [fromState, state, progress, slowFade, impactBounce]);

  const from = keyColors(fromState, theme);
  const to = keyColors(state, theme);
  const stateFadeBg = progress.interpolate({ inputRange: [0, 1], outputRange: [from.bg, to.bg] });
  // The background fades smoothly, but the label switches color in one step
  // at the midpoint: fading dark ink -> white over a light -> gray key took
  // both through the same gray at once, blanking the label for a frame.
  const stateFadeText = progress.interpolate({
    inputRange: [0, 0.5, 0.5001, 1],
    outputRange: [from.text, from.text, to.text, to.text],
  });
  const stateFadeEdge = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [keyEdgeColor(fromState, theme), keyEdgeColor(state, theme)],
  });

  // At rest (the vast majority of the time, for every key), colors come from
  // the theme-reactive `color()` instead, so they follow a theme switch —
  // only the brief state-change window above uses the snapshot fade.
  const backgroundColor = isStateFading ? stateFadeBg : color(restingBgToken(state));
  const textColor = isStateFading ? stateFadeText : isResult(state) ? '#ffffff' : themedText('keyText');
  const edgeColor = isStateFading ? stateFadeEdge : color(restingEdgeToken(state));

  // One haptic tied directly to the same handler that actually processes
  // the press (not a separate onPressIn/onPressOut listener), so a single
  // physical press can never produce more than one.
  const handlePress = () => {
    triggerKeyHaptic();
    onPress?.();
  };

  const impactTranslateY = impactBounce.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const impactScale = impactBounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });

  return (
    <Animated.View style={{ transform: [{ translateY: impactTranslateY }, { scale: impactScale }] }}>
      <Button3D
        width={width}
        height={height}
        faceColor={backgroundColor}
        edgeColor={edgeColor}
        borderRadius={KEY_RADIUS}
        onPress={handlePress}
        style={styles.key}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {icon ? (
          // tintColor is a native prop, not a style, so it takes the
          // snapshot `theme` rather than `color()`.
          <SymbolView name={icon} size={22} tintColor={theme.keyText} />
        ) : (
          <Animated.Text
            style={[
              styles.label,
              styles.letterLabel,
              { fontSize, lineHeight: fontSize * FONT_LINE_HEIGHT_EM },
              { color: textColor },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Animated.Text>
        )}
      </Button3D>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  key: {
    marginHorizontal: KEY_MARGIN,
  },
  label: {
    includeFontPadding: false,
  },
  letterLabel: {
    fontFamily: FONTS.tile,
  },
});
