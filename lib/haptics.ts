import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Settings' ԹՐԹՌՈՑ switch: every haptic in the app goes through this file and
// checks this flag (App loads it from wordle:haptics before the first render).
let enabled = true;
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

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
  if (!enabled) return;
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap).catch(() => {});
  } else {
    Haptics.selectionAsync().catch(() => {});
  }
}

// The same light tap, for a Hint's light landing on its cell.
export function triggerHintLandingHaptic(): void {
  triggerLightImpact();
}

// A light impact (the flows' coin-pill pulses, the retry landing).
export function triggerLightImpact(): void {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// A warning buzz (e.g. a word that isn't in the list).
export function triggerWarningHaptic(): void {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
