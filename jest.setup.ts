// AsyncStorage's native module isn't available in the Jest test
// environment — this is the package's own official mock (an in-memory
// implementation), used only for tests; the real app still uses the real
// native module.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Worklets (Reanimated's UI-thread runtime) needs native code; its own
// official mock runs worklets on the JS thread instead. Reanimated then
// uses its JS implementation, driven by Jest's (fake) timers.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Skia (the theme switch's circle reveal) draws natively. Tests get a tiny
// stand-in: no snapshot can be taken (`makeImageFromView` resolves null), so a
// theme switch is instant, unless a test mocks it to return an image.
jest.mock('@shopify/react-native-skia', () => {
  const Noop = () => null;
  return {
    makeImageFromView: jest.fn(() => Promise.resolve(null)),
    Canvas: Noop,
    Group: Noop,
    Image: Noop,
    Skia: { Path: { Make: () => ({ addCircle: () => {} }) } },
  };
});

// MaskedView (the praise word's shine) is native; tests render its children.
jest.mock('@react-native-masked-view/masked-view', () => {
  const { View } = require('react-native');
  return function MaskedView({ children, style }: { children: unknown; style: unknown }) {
    return require('react').createElement(View, { style }, children);
  };
});

// expo-audio is native: tests get silent players.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ volume: 1, play: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn() })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
