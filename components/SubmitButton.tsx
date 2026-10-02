import { Animated, StyleSheet } from 'react-native';
import Button3D from './Button3D';
import { FONTS, INVALID_COLOR, INVALID_EDGE_COLOR } from '../constants/theme';
import { GuessValidity } from '../lib/guessValidity';
import { triggerKeyHaptic } from '../lib/haptics';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  validity: GuessValidity;
  onPress: () => void;
  onClearInvalid: () => void;
};

const LABEL: Record<GuessValidity, string> = {
  incomplete: 'ԸՆԴՈՒՆԵԼ',
  invalid: 'ԲԱՌ ՉԷ',
  valid: 'ԸՆԴՈՒՆԵԼ',
};

// Bottom submit button. This is a second entry point into the exact same
// submit handler the keyboard's Enter key calls — not a separate
// implementation — so its enabled/disabled state always matches what
// pressing Enter would actually do.
//
// The invalid ("ԲԱՌ ՉԷ") state is tappable, unlike incomplete: tapping it
// clears the unrecognized word so the player can immediately retype,
// instead of leaving them stuck staring at a red button they can't act on.
export default function SubmitButton({ validity, onPress, onClearInvalid }: Props) {
  const { color } = useTheme();
  const disabled = validity === 'incomplete';
  // Pressable never calls onPress at all while disabled, so this can't fire
  // a haptic for a press that didn't actually submit/clear anything.
  const handlePress = () => {
    triggerKeyHaptic();
    if (validity === 'invalid') {
      onClearInvalid();
    } else {
      onPress();
    }
  };

  // Same 3D bottom-edge treatment as the keyboard's keys, via Button3D.
  // INVALID_COLOR/its edge are plain constants (same in both themes
  // already), so only the other two need `color()`.
  const bg = validity === 'valid' ? color('submitOn') : validity === 'invalid' ? INVALID_COLOR : color('keyBackground');
  const edge = validity === 'valid' ? color('submitOnEdge') : validity === 'invalid' ? INVALID_EDGE_COLOR : color('keyEdge');
  const textColor = validity === 'incomplete' ? color('textMuted') : '#ffffff';

  return (
    <Button3D
      width="100%"
      height={52}
      faceColor={bg}
      edgeColor={edge}
      borderRadius={14}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Animated.Text style={[styles.text, { color: textColor }]}>{LABEL[validity]}</Animated.Text>
    </Button3D>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 17,
    fontFamily: FONTS.title,
    letterSpacing: 1.5,
  },
});
