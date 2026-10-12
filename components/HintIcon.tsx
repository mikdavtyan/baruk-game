import { memo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { DEPTH_OFFSET, Highlight, OUTLINE, useSvgIds } from './gameIconArt';

// The Hint power-up: a glowing yellow lightbulb with a little brown screw
// base, in the fortune wheel's icon family (design-system.md). A soft glow
// disc (a gradient, no blur) and three little rays make it shine on both the
// dark and the light chip. Fixed game-art colors, the same in both themes.
const BULB =
  'M32 8.5 C41.9 8.5 49.5 16 49.5 25.5 C49.5 31.5 46.4 35.4 43.6 38.6 C42 40.4 41.2 42 41.2 44 L22.8 44 C22.8 42 22 40.4 20.4 38.6 C17.6 35.4 14.5 31.5 14.5 25.5 C14.5 16 22.1 8.5 32 8.5 Z';
const SILHOUETTE = `${BULB} M22.5 43 L41.5 43 L41.5 53 Q41.5 55 39.5 55 L37 55 Q36 59.5 32 59.5 Q28 59.5 27 55 L24.5 55 Q22.5 55 22.5 53 Z`;

function HintIcon({ size = 26 }: { size?: number }) {
  const { id, ref } = useSvgIds();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id={id('glow')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0.5" stopColor="#FFE066" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFE066" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id('glass')} cx="0.38" cy="0.3" r="0.75">
          <Stop offset="0" stopColor="#FFFDE6" />
          <Stop offset="0.45" stopColor="#FFE45C" />
          <Stop offset="1" stopColor="#F5A524" />
        </RadialGradient>
        <LinearGradient id={id('base')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#C98A52" />
          <Stop offset="1" stopColor="#7A4718" />
        </LinearGradient>
      </Defs>

      {/* The glow behind the glass. */}
      <Circle cx={32} cy={25} r={30} fill={ref('glow')} />
      {/* Rays. */}
      <G strokeLinecap="round">
        <Path d="M6 22 L2.5 21 M10.5 7.5 L8 5 M58 22 L61.5 21 M53.5 7.5 L56 5" stroke={OUTLINE} strokeWidth={5} />
        <Path d="M6 22 L2.5 21 M10.5 7.5 L8 5 M58 22 L61.5 21 M53.5 7.5 L56 5" stroke="#FFE066" strokeWidth={2.2} />
      </G>
      <G transform={DEPTH_OFFSET}>
        <Path d={SILHOUETTE} fill="#9A5A08" />
      </G>
      {/* The screw base: three threads and a rounded tip. */}
      <Path d="M27 54 Q28 59.5 32 59.5 Q36 59.5 37 54 Z" fill="#5A3410" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={22.5} y={42.5} width={19} height={12.5} rx={3} fill={ref('base')} stroke={OUTLINE} strokeWidth={2.4} />
      <Path d="M24 47 L40 46 M24 51 L40 50" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.8} />
      {/* The glass. */}
      <Path d={BULB} fill={ref('glass')} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      {/* The filament, glowing orange. */}
      <Path
        d="M27.5 42.5 L27.5 34 Q27.5 30.5 30 30.5 Q32 30.5 32 33 Q32 30.5 34 30.5 Q36.5 30.5 36.5 34 L36.5 42.5"
        stroke="#E8762A"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Highlight d="M20.5 25 Q20.5 18 26.5 14.5" width={3.4} opacity={0.85} />
    </Svg>
  );
}

export default memo(HintIcon);
