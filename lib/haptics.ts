import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// The tick for one keyboard key, fired on touch down. A player presses many
// keys a game, so it must stay crisp, never buzzy:
// - Android: the system's own keyboard-tap haptic (the one Gboard uses). It
//   goes through the haptics engine rather than the Vibrator, so cheap motors
//   give a short click instead of a buzz, and it follows the system's touch-
//   feedback setting. (impactAsync on Android is a Vibrator pulse.)
// - iOS: the selection tick, lighter and sharper than a Light impact.
// Swallows failures (e.g. a simulator/platform with no haptics engine)
// rather than letting an unhandled promise rejection surface.
export function triggerKeyHaptic(): void {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap).catch(() => {});
  } else {
    Haptics.selectionAsync().catch(() => {});
  }
}

// The same light tap, for a Hint's light landing on its cell.
export function triggerHintLandingHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
