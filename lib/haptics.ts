import * as Haptics from 'expo-haptics';

// Very light, fast tap feedback for a single key press. Deliberately the
// lightest impact style available — a player may press many keys during one
// game, so this needs to stay subtle rather than announce every keystroke.
// Swallows failures (e.g. a simulator/platform with no haptics engine)
// rather than letting an unhandled promise rejection surface.
export function triggerKeyHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
