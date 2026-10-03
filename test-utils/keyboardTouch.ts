// Drives the in-game keyboard the way a finger does: touches land on the
// keyboard's one touch surface (Keyboard.tsx), at a key's analytic position
// (computeKeyGeometry — the same geometry the hit-test and Darts use). Call
// these inside `act`. Keys are found by their Armenian accessibility label.
import { Dimensions } from 'react-native';
import {
  ALL_LETTER_TOKENS,
  BACKSPACE_LABEL,
  computeBackspaceGeometry,
  computeKeyGeometry,
  KEYBOARD_TOUCH_SURFACE_ID,
} from '../components/Keyboard';
import { letterLabel } from '../lib/letterDisplay';

export type TestTouch = { identifier: number; locationX: number; locationY: number };

let nextIdentifier = 1;

// The center of the key with this label, in the keyboard's own coordinates.
export function keyCenter(label: string): { x: number; y: number } {
  const { width, height } = Dimensions.get('window');
  if (label === BACKSPACE_LABEL) return computeBackspaceGeometry(width, height);
  const token = ALL_LETTER_TOKENS.find((t) => letterLabel(t) === label);
  if (!token) throw new Error(`no keyboard key labelled ${label}`);
  return computeKeyGeometry(token, width, height)!;
}

// A new finger on the key with this label, optionally offset from its center.
export function fingerOn(label: string, dx = 0, dy = 0): TestTouch {
  const { x, y } = keyCenter(label);
  return { identifier: nextIdentifier++, locationX: x + dx, locationY: y + dy };
}

export function keyboardSurface(root: any) {
  return root.root.find((n: any) => n.props.testID === KEYBOARD_TOUCH_SURFACE_ID && typeof n.type === 'string');
}

// A phase the surface doesn't listen to (e.g. moves) does nothing, as on a device.
const fire = (root: any, handler: string, touches: TestTouch[]) =>
  keyboardSurface(root).props[handler]?.({ nativeEvent: { changedTouches: touches, touches } });

export const touchStart = (root: any, ...touches: TestTouch[]) => fire(root, 'onTouchStart', touches);
export const touchMove = (root: any, ...touches: TestTouch[]) => fire(root, 'onTouchMove', touches);
export const touchEnd = (root: any, ...touches: TestTouch[]) => fire(root, 'onTouchEnd', touches);
export const touchCancel = (root: any, ...touches: TestTouch[]) => fire(root, 'onTouchCancel', touches);

// A quick tap: finger down, finger up.
export function tapKey(root: any, label: string) {
  const finger = fingerOn(label);
  touchStart(root, finger);
  touchEnd(root, finger);
}

// A screen reader's activation of the key (VoiceOver/TalkBack double-tap).
export function activateKeyAccessibly(root: any, label: string) {
  root.root
    .find(
      (n: any) =>
        n.props.accessibilityLabel === label && typeof n.props.onAccessibilityAction === 'function' && typeof n.type === 'string',
    )
    .props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
}
