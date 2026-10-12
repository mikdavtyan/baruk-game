import { useId } from 'react';
import { Path } from 'react-native-svg';

// Shared pieces of the game-icon family (design-system.md, in the fortune
// wheel's style): one thick rounded brown outline, a darker copy of the
// silhouette offset down-left for depth, and a soft white highlight on the
// upper left. Fixed game-art colors, the same in both themes — no icon reads
// the theme, so a theme toggle never re-renders one.
export const OUTLINE = '#6B3A0A';
export const DEPTH_OFFSET = 'translate(-1.5 3)';

// Per-instance gradient ids: many copies of an icon can be mounted at once
// (coins mid-flight, a shop grid), and SVG ids are global on some platforms.
export function useSvgIds() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;
  return { id, ref };
}

export const Highlight = ({ d, width = 3, opacity = 0.55 }: { d: string; width?: number; opacity?: number }) => (
  <Path d={d} stroke="#FFFFFF" strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" fill="none" />
);
