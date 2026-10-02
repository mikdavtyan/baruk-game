import { RefObject } from 'react';
import { View } from 'react-native';

export type WindowRect = { x: number; y: number; width: number; height: number };

// Promisified View.measureInWindow — RN's equivalent of DOM's
// getBoundingClientRect, used by the Darts/bow power-up to find real
// on-screen positions (the bow button, the keyboard) at the exact moment it
// fires, rather than computing them analytically. Resolves null if the ref
// isn't attached/laid out yet, so callers can fall back gracefully instead
// of throwing.
export function measureWindow(ref: RefObject<View | null>): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}
