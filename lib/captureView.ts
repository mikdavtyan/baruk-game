import { RefObject } from 'react';
import { View } from 'react-native';
import { makeImageFromView, SkImage } from '@shopify/react-native-skia';

export type ViewImage = SkImage;

// A Skia image of everything `ref`'s view currently draws (the theme
// reveal's "old look"). Resolves null when it can't be taken, so the caller
// falls back to an instant switch.
export function captureView(ref: RefObject<View | null>): Promise<ViewImage | null> {
  if (!ref.current) return Promise.resolve(null);
  return makeImageFromView(ref as RefObject<View>);
}
