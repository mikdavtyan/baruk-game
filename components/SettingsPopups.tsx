import { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Button3D from './Button3D';
import PopupModal from './PopupModal';
import { APP_VERSION } from '../constants/app';
import { FONTS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

const BUTTON_HEIGHT = 50;
// The destructive button's red — the same in both themes (game art).
const DANGER_FACE = '#D64545';
const DANGER_EDGE = '#A33232';

// Settings' ՄԱՍԻՆ popup: what the game is, and its version.
export const AboutModal = memo(function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { textColor } = useTheme();
  return (
    <PopupModal open={open} onClose={onClose} title="ՄԱՍԻՆ">
      <View style={styles.body}>
        <Animated.Text style={[styles.appName, { color: textColor('popupText') }]}>ԲԱՌՈՒԿ</Animated.Text>
        <Animated.Text style={[styles.text, { color: textColor('popupText') }]}>
          Հայերեն բառախաղ. գուշակի՛ր հնգատառ բառը վեց փորձից։
        </Animated.Text>
        <Animated.Text style={[styles.version, { color: textColor('popupTextMuted') }]}>{`ՏԱՐԲԵՐԱԿ ${APP_VERSION}`}</Animated.Text>
      </View>
    </PopupModal>
  );
});

// Settings' reset confirmation. The X, Android back and ՉԵՂԱՐԿԵԼ cancel;
// only ԶՐՈՅԱՑՆԵԼ resets (App clears the progress and starts over).
export const ResetConfirmModal = memo(function ResetConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { color, textColor } = useTheme();
  return (
    <PopupModal open={open} onClose={onCancel} title="ԶՐՈՅԱՑՆԵ՞Լ">
      <View style={styles.body}>
        <Animated.Text style={[styles.text, { color: textColor('popupText') }]}>
          Մետաղադրամները, միավորները, հաղթական շարքը, պաշարը և ընթացիկ խաղը կջնջվեն։ Պրոֆիլն ու կարգավորումները կմնան։
        </Animated.Text>
        <View style={styles.buttons}>
          <Button3D
            pressScale
            height={BUTTON_HEIGHT}
            borderRadius={14}
            faceColor={DANGER_FACE}
            edgeColor={DANGER_EDGE}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="ԶՐՈՅԱՑՆԵԼ"
          >
            <Animated.Text style={styles.dangerText}>ԶՐՈՅԱՑՆԵԼ</Animated.Text>
          </Button3D>
          <Button3D
            pressScale
            height={BUTTON_HEIGHT}
            borderRadius={14}
            faceColor={color('keyBackground')}
            edgeColor={color('keyEdge')}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="ՉԵՂԱՐԿԵԼ"
          >
            <Animated.Text style={[styles.buttonText, { color: textColor('keyText') }]}>ՉԵՂԱՐԿԵԼ</Animated.Text>
          </Button3D>
        </View>
      </View>
    </PopupModal>
  );
});

const styles = StyleSheet.create({
  body: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  appName: {
    fontFamily: FONTS.title,
    fontSize: 22,
    letterSpacing: 2,
    textAlign: 'center',
  },
  text: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  version: {
    fontFamily: FONTS.title,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  buttons: {
    gap: 10,
    marginTop: 4,
  },
  dangerText: {
    fontFamily: FONTS.title,
    fontSize: 16,
    color: '#FFFFFF',
  },
  buttonText: {
    fontFamily: FONTS.title,
    fontSize: 16,
  },
});
