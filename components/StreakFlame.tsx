import { memo } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { DEPTH_OFFSET, Highlight, OUTLINE, useSvgIds } from './gameIconArt';

// The streak flame, in the fortune wheel's icon family (design-system.md):
// three tiers that grow with the streak. A static drawing — a consumer that
// wants a flicker animates it with transforms. Fixed game-art colors, the same
// in both themes.
export type StreakFlameTier = 'small' | 'big' | 'legend';

export function streakFlameTier(days: number): StreakFlameTier {
  if (days >= 30) return 'legend';
  if (days >= 7) return 'big';
  return 'small';
}

type Palette = {
  outer: [string, string];
  middle: [string, string];
  core: string;
  depth: string;
  sparkle?: [string, string];
};
const PALETTES: Record<StreakFlameTier, Palette> = {
  small: { outer: ['#FFB13D', '#E8402D'], middle: ['#FFF0A0', '#FFC93C'], core: '#FFFBE6', depth: '#9A2A16' },
  big: { outer: ['#FFA43A', '#E0302A'], middle: ['#FFF0A0', '#FFB830'], core: '#FFFBE6', depth: '#8E2414' },
  legend: {
    outer: ['#E39BFF', '#7B2FE0'],
    middle: ['#FFF1A6', '#FFB020'],
    core: '#FFFFFF',
    depth: '#3E1880',
    sparkle: ['#FFF1A6', '#F5A524'],
  },
};
// A desaturated copy for a flame that has gone out (StreakFlameIcon).
const GRAY: Palette = { outer: ['#B9B4AC', '#7E7972'], middle: ['#DAD6CF', '#A9A49C'], core: '#EEEBE6', depth: '#4F4B46' };

type Shape = { outer: string; middle: string; core: string; highlight: string };
// small: one main tongue and a little one on the left.
const SMALL: Shape = {
  outer:
    'M32 59 C19.5 59 12.5 50.5 13 40.5 C13.5 32 19.5 26.5 22.5 17.5 C27 21.5 28.5 25.5 28.5 30 C32 23 36.5 14 35.5 5 C45.5 12 51.5 24 51.5 38 C51.5 50.5 44 59 32 59 Z',
  middle:
    'M32 55 C24.5 55 20.5 50 21 43.5 C21.5 38.5 25 35 27 30.5 C30 33 31 36 31 39 C33.5 35 36.5 30 37 24.5 C42 30 44 36.5 43.5 43 C43 50.5 38.5 55 32 55 Z',
  core: 'M32 54 C28 54 26.5 51 27 48 C27.5 45 30 43 31 40 C33 42 34.2 44 34.6 46 C35.6 45 36.2 44 36.6 42.6 C38.2 45 38.5 47.5 38 49.5 C37.2 52.5 35 54 32 54 Z',
  highlight: 'M18.5 38 Q18.8 33 21.5 29',
};
// big: wider, with three tongues and more fire inside.
const BIG: Shape = {
  outer:
    'M32 60 C17 60 8.5 51 9.5 39 C10 31.5 14.5 27 16.5 21.5 C17.2 18.5 17.5 15.5 19 12.5 C23.5 17.5 24.8 22 24.5 27 C27.5 20 30.5 12 32 2.5 C39.5 10 42 17.5 41.5 25 C43.5 21 45 16.5 45.5 11.5 C51.5 18.5 55.5 28 54.5 40 C53.5 52 45.5 60 32 60 Z',
  middle:
    'M32 56 C23 56 17.5 50.5 18 43 C18.5 37.5 22 34.5 23.5 30.5 C26.5 33 27.5 36 27.5 39 C30 34 32.5 28.5 32.5 22 C38.5 27.5 39.5 32 39 36.5 C40.5 34.5 41.8 32 42.2 29.5 C46 34 47 39 46.5 44 C45.5 51.5 40 56 32 56 Z',
  core: 'M32 54 C27.5 54 25 51 25.5 47.5 C26 44.5 28.5 42.5 29.5 39.5 C31.5 41.5 32.5 43.5 33 45.5 C34.2 44 35 42.5 35.4 40.5 C37.6 43 38.6 46 38.2 48.6 C37.5 52 35.2 54 32 54 Z',
  highlight: 'M14.5 38 Q14.8 31.5 18 27',
};
const SHAPES: Record<StreakFlameTier, Shape> = { small: SMALL, big: BIG, legend: BIG };

// A four-point sparkle centered on (0, 0), about 9 units across.
const SPARKLE = 'M0 -4.6 Q0.9 -0.9 4.6 0 Q0.9 0.9 0 4.6 Q-0.9 0.9 -4.6 0 Q-0.9 -0.9 0 -4.6 Z';

function StreakFlameArt({ size = 24, tier, gray = false }: { size?: number; tier: StreakFlameTier; gray?: boolean }) {
  const { id, ref } = useSvgIds();
  const pal = gray ? GRAY : PALETTES[tier];
  const shape = SHAPES[tier];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={id('outer')} x1="0.3" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={pal.outer[0]} />
          <Stop offset="1" stopColor={pal.outer[1]} />
        </LinearGradient>
        <LinearGradient id={id('middle')} x1="0.4" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={pal.middle[0]} />
          <Stop offset="1" stopColor={pal.middle[1]} />
        </LinearGradient>
        {pal.sparkle && (
          <LinearGradient id={id('sparkle')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={pal.sparkle[0]} />
            <Stop offset="1" stopColor={pal.sparkle[1]} />
          </LinearGradient>
        )}
      </Defs>
      <G transform={DEPTH_OFFSET}>
        <Path d={shape.outer} fill={pal.depth} />
      </G>
      <Path d={shape.outer} fill={ref('outer')} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <Path d={shape.middle} fill={ref('middle')} />
      <Path d={shape.core} fill={pal.core} opacity={0.9} />
      <Highlight d={shape.highlight} />
      {pal.sparkle && (
        <G fill={ref('sparkle')} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round">
          <Path d={SPARKLE} transform="translate(8 14) scale(1.1)" />
          <Path d={SPARKLE} transform="translate(56.5 8) scale(0.85)" />
          <Path d={SPARKLE} transform="translate(57 52)" />
        </G>
      )}
    </Svg>
  );
}

// `gray` draws the desaturated "gone out" flame (StreakFlameIcon's second layer).
export const StreakFlame = memo(StreakFlameArt);
export default StreakFlame;
