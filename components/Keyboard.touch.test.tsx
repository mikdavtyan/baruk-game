// The keyboard's input model: every touch lands on one surface (so several
// fingers register at once), is hit-tested against the analytic key geometry
// (nearest key in the nearest row, so gaps hit too) and fires on TOUCH DOWN.
// Backspace repeats while held. Screen readers activate keys instead.
import React from 'react';
import { AccessibilityInfo, Dimensions, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Keyboard, { BACKSPACE_LABEL, computeKeyGeometry } from './Keyboard';
import KeyboardKey from './KeyboardKey';
import { BACKSPACE_REPEAT_DELAY_MS, BACKSPACE_REPEAT_INTERVAL_MS } from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { ThemeProvider } from '../lib/ThemeContext';
import {
  activateKeyAccessibly,
  fingerOn,
  touchCancel,
  touchEnd,
  touchMove,
  touchStart,
} from '../test-utils/keyboardTouch';
import { unmemo } from '../test-utils/unmemo';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  AndroidHaptics: { Keyboard_Tap: 'keyboard-tap' },
}));

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

let root: any;
let onKeyPress: jest.Mock;
let onBackspace: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  onKeyPress = jest.fn();
  onBackspace = jest.fn();
});
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
});

async function render() {
  await act(async () => {
    root = TestRenderer.create(
      <ThemeProvider>
        <Keyboard keyStates={{}} onKeyPress={onKeyPress} onBackspace={onBackspace} />
      </ThemeProvider>,
    );
  });
}
const L = letterLabel;
const pressed = (label: string) =>
  root.root.findAll((n: any) => n.type === unmemo(KeyboardKey) && n.props.label === label)[0].props.pressProgress.__getValue();

it('fires on touch down, before the finger lifts', async () => {
  await render();
  act(() => touchStart(root, fingerOn(L('ա'))));
  expect(onKeyPress.mock.calls).toEqual([['ա']]);
  act(() => touchEnd(root, fingerOn(L('ա'))));
  expect(onKeyPress).toHaveBeenCalledTimes(1); // nothing more on release
});

it('registers two overlapping touches on different keys, both, in order', async () => {
  await render();
  const first = fingerOn(L('գ'));
  const second = fingerOn(L('ու'));
  act(() => touchStart(root, first));
  act(() => touchStart(root, second)); // the first finger is still down
  act(() => touchEnd(root, first));
  act(() => touchEnd(root, second));
  expect(onKeyPress.mock.calls).toEqual([['գ'], ['ու']]);
});

it('registers two fingers landing in the same event, in their order', async () => {
  await render();
  act(() => touchStart(root, fingerOn(L('ս')), fingerOn(L('դ'))));
  expect(onKeyPress.mock.calls).toEqual([['ս'], ['դ']]);
});

it('a touch in the gap between two keys picks the nearest one', async () => {
  await render();
  const { width, height } = Dimensions.get('window');
  const a = computeKeyGeometry('ա', width, height)!;
  const s = computeKeyGeometry('ս', width, height)!;
  const gapLeft = a.x + a.width / 2; // ա's right edge; ս's left edge is 5px further
  const gapRight = s.x - s.width / 2;
  act(() => touchStart(root, { identifier: 901, locationX: gapLeft + 1, locationY: a.y }));
  act(() => touchStart(root, { identifier: 902, locationX: gapRight - 1, locationY: a.y }));
  // Vertical gap: just below row 2's ք key (row 2 → row 3 margin) is still ք.
  const q = computeKeyGeometry('ք', width, height)!;
  act(() => touchStart(root, { identifier: 903, locationX: q.x, locationY: q.y + q.height / 2 + 2 }));
  expect(onKeyPress.mock.calls).toEqual([['ա'], ['ս'], ['ք']]);
});

it("a finger that moves a little doesn't cancel: one letter, the key stays pressed until it lifts", async () => {
  await render();
  const finger = fingerOn(L('ա'));
  act(() => touchStart(root, finger));
  expect(pressed(L('ա'))).toBe(1);
  act(() => touchMove(root, { ...finger, locationX: finger.locationX + 6, locationY: finger.locationY + 4 }));
  expect(pressed(L('ա'))).toBe(1);
  act(() => touchEnd(root, { ...finger, locationX: finger.locationX + 6 }));
  expect(onKeyPress.mock.calls).toEqual([['ա']]);
  expect(pressed(L('ա'))).toBe(0);
});

it("each key shows pressed while its own finger is down, and releases on that finger's end or cancel", async () => {
  await render();
  const one = fingerOn(L('գ'));
  const two = fingerOn(L('ն'));
  act(() => touchStart(root, one, two));
  expect([pressed(L('գ')), pressed(L('ն'))]).toEqual([1, 1]);
  act(() => touchEnd(root, one));
  expect([pressed(L('գ')), pressed(L('ն'))]).toEqual([0, 1]);
  act(() => touchCancel(root, two));
  expect(pressed(L('ն'))).toBe(0);
});

it('holding backspace repeats after a delay, then steadily, and stops on release', async () => {
  await render();
  const finger = fingerOn(BACKSPACE_LABEL);
  act(() => touchStart(root, finger));
  expect(onBackspace).toHaveBeenCalledTimes(1); // on touch down
  act(() => jest.advanceTimersByTime(BACKSPACE_REPEAT_DELAY_MS - 1));
  expect(onBackspace).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(1));
  expect(onBackspace).toHaveBeenCalledTimes(2);
  act(() => jest.advanceTimersByTime(BACKSPACE_REPEAT_INTERVAL_MS * 3));
  expect(onBackspace).toHaveBeenCalledTimes(5);
  act(() => touchEnd(root, finger));
  act(() => jest.advanceTimersByTime(BACKSPACE_REPEAT_INTERVAL_MS * 10));
  expect(onBackspace).toHaveBeenCalledTimes(5);
  expect(onKeyPress).not.toHaveBeenCalled();
});

it('a short backspace tap deletes once and never repeats', async () => {
  await render();
  const finger = fingerOn(BACKSPACE_LABEL);
  act(() => touchStart(root, finger));
  act(() => touchEnd(root, finger));
  act(() => jest.advanceTimersByTime(BACKSPACE_REPEAT_DELAY_MS * 3));
  expect(onBackspace).toHaveBeenCalledTimes(1);
});

it('haptics: Android uses its keyboard-tap haptic, iOS the selection tick', async () => {
  await render();
  jest.replaceProperty(Platform, 'OS', 'android');
  act(() => touchStart(root, fingerOn(L('ա'))));
  expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(Haptics.AndroidHaptics.Keyboard_Tap);
  jest.replaceProperty(Platform, 'OS', 'ios');
  act(() => touchStart(root, fingerOn(L('ս'))));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

it('with a screen reader on, touches do nothing and an accessibility activation inputs exactly once', async () => {
  (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(true);
  await render();
  await act(async () => {}); // the screen-reader check resolves
  act(() => {
    const finger = fingerOn(L('ա'));
    touchStart(root, finger); // the reader's synthesized touch, if any
    touchEnd(root, finger);
    activateKeyAccessibly(root, L('ա'));
    activateKeyAccessibly(root, BACKSPACE_LABEL);
  });
  expect(onKeyPress.mock.calls).toEqual([['ա']]);
  expect(onBackspace).toHaveBeenCalledTimes(1);
});

it('keys stay accessible buttons with their Armenian labels', async () => {
  await render();
  const buttons = root.root.findAll(
    (n: any) => typeof n.type === 'string' && n.props.accessibilityRole === 'button' && n.props.accessible,
  );
  const labels = buttons.map((b: any) => b.props.accessibilityLabel);
  expect(labels).toContain(L('ու'));
  expect(labels).toContain(BACKSPACE_LABEL);
  expect(labels).toHaveLength(39); // 38 letters + Backspace
});
