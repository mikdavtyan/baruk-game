import { memo } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { DEPTH_OFFSET, Highlight, OUTLINE, useSvgIds } from './gameIconArt';

// A cute padlock (a locked mode, e.g. the "word of the day" card), in the
// fortune wheel's icon family (design-system.md): a silver shackle, a chunky
// gold body with a brown keyhole. Fixed game-art colors, the same in both
// themes.
const SHACKLE = 'M20.5 30 L20.5 21 C20.5 14 25.5 8.5 32 8.5 C38.5 8.5 43.5 14 43.5 21 L43.5 30';
const KEYHOLE = 'M32 36.5 C34.6 36.5 36.2 38.4 36.2 40.6 C36.2 42.2 35.4 43.4 34.2 44.1 L35.2 49.2 Q35.4 50.5 34 50.5 L30 50.5 Q28.6 50.5 28.8 49.2 L29.8 44.1 C28.6 43.4 27.8 42.2 27.8 40.6 C27.8 38.4 29.4 36.5 32 36.5 Z';

function LockIcon({ size = 26 }: { size?: number }) {
  const { id, ref } = useSvgIds();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={id('shackle')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F2F6FB" />
          <Stop offset="1" stopColor="#8E9EB4" />
        </LinearGradient>
        <LinearGradient id={id('body')} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <Stop offset="0" stopColor="#FFE58A" />
          <Stop offset="1" stopColor="#F09A1A" />
        </LinearGradient>
      </Defs>
      <G transform={DEPTH_OFFSET}>
        <Path d={SHACKLE} stroke="#4A4F5C" strokeWidth={10} strokeLinecap="round" fill="none" />
        <Rect x={11} y={27} width={42} height={31} rx={9} fill="#9A5A08" />
      </G>
      {/* Shackle: an outline stroke under a silver one. */}
      <Path d={SHACKLE} stroke={OUTLINE} strokeWidth={10} strokeLinecap="round" fill="none" />
      <Path d={SHACKLE} stroke={ref('shackle')} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Rect x={11} y={27} width={42} height={31} rx={9} fill={ref('body')} stroke={OUTLINE} strokeWidth={3} />
      <Path d={KEYHOLE} fill="#6B3A0A" />
      <Highlight d="M16 34 L16 46" />
      <Path d="M20.5 31.5 L27 31.5" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export default memo(LockIcon);
