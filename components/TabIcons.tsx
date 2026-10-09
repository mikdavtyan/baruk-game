import { memo, ReactNode, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

// The tab bar's icons, in the fortune wheel's family (FortuneWheelIcon.tsx,
// design-system.md): a 64-unit viewBox; a darker copy of the silhouette
// offset down-left for depth; cheerful gradient fills; the same thick rounded
// brown outline (OUTLINE, 3 for the main shape, ~2 for details); a soft white
// highlight stroke on the upper left. Fixed game-art colors, the same in both
// themes (so a theme toggle never re-renders them). Built for 26–34px.
const OUTLINE = '#6B3A0A';
const DEPTH_OFFSET = 'translate(-1.5 3)';

type GradientStops = [string, string];

// One icon: its gradients (by name), then its shapes. `ids` resolves a
// gradient name to its url() for this instance.
function IconSvg({
  size,
  gradients,
  children,
}: {
  size: number;
  gradients: Record<string, GradientStops>;
  children: (ref: (name: string) => string) => ReactNode;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const id = (name: string) => `${uid}-${name}`;
  return (
    // A slightly tighter viewBox than the wheel's, so these (less round)
    // shapes fill their box as much as the wheel fills its own.
    <Svg width={size} height={size} viewBox="2 2 60 60">
      <Defs>
        {Object.entries(gradients).map(([name, [from, to]]) => (
          <LinearGradient key={name} id={id(name)} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        ))}
      </Defs>
      {children((name) => `url(#${id(name)})`)}
    </Svg>
  );
}

const Highlight = ({ d }: { d: string }) => (
  <Path d={d} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" fill="none" />
);

// ԽԱՆՈՒԹ: a supermarket cart — a red basket with a white grid, a dark handle
// frame and two gold wheels.
const CART_BASKET = 'M15 19 L57 19 Q59 19 58.5 21.5 L54.5 38.5 Q53.8 41.5 50.7 41.5 L21.5 41.5 Q18.6 41.5 18.1 38.6 Z';
export const ShopCartIcon = memo(function ShopCartIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg size={size} gradients={{ basket: ['#FF8A7A', '#D63C2F'], wheel: ['#FFE48A', '#E09A12'] }}>
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Path d={CART_BASKET} fill="#8E2A20" />
          </G>
          {/* Handle and frame. */}
          <Path
            d="M5 12 L11 12 Q13.5 12 14 14.5 L19.5 45 Q20 48 23.2 48 L51 48"
            stroke={OUTLINE}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d={CART_BASKET} fill={ref('basket')} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          {/* The basket's grid. */}
          <Path
            d="M28 21 L29 40 M39 21 L39 40 M50 21 L48.5 40 M17.5 30.5 L56 30.5"
            stroke="#FFFFFF"
            strokeOpacity={0.75}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Highlight d="M20 23.5 L25 23.5" />
          <Circle cx={25} cy={54} r={5} fill={ref('wheel')} stroke={OUTLINE} strokeWidth={2.4} />
          <Circle cx={46} cy={54} r={5} fill={ref('wheel')} stroke={OUTLINE} strokeWidth={2.4} />
        </>
      )}
    </IconSvg>
  );
});

// ԱՌԱՋԱԴՐԱՆՔՆԵՐ: a chunky blue book with cream pages and a red bookmark.
export const BookIcon = memo(function BookIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg size={size} gradients={{ cover: ['#7CCBFF', '#2E7FD0'], spine: ['#2E7FD0', '#1D5FA3'], ribbon: ['#FF7A6B', '#C93A2E'] }}>
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Rect x={12} y={7} width={42} height={50} rx={7} fill="#1B4E86" />
          </G>
          {/* Pages, peeking out on the right and bottom. */}
          <Rect x={16} y={11} width={40} height={47} rx={6} fill="#FFF6DA" stroke={OUTLINE} strokeWidth={2.4} />
          <Path d="M20 53 L52 53 M20 49.5 L52 49.5" stroke="#E2CFA0" strokeWidth={1.6} strokeLinecap="round" />
          {/* Cover and spine. */}
          <Rect x={12} y={7} width={40} height={44} rx={7} fill={ref('cover')} stroke={OUTLINE} strokeWidth={3} />
          <Path d="M19 8.5 L19 49.5" stroke={ref('spine')} strokeWidth={5} />
          <Path d="M21.8 8.5 L21.8 49.5" stroke={OUTLINE} strokeOpacity={0.45} strokeWidth={1.4} />
          {/* A title plate on the cover. */}
          <Rect x={27} y={17} width={18} height={8} rx={3} fill="#FFF6DA" stroke={OUTLINE} strokeWidth={1.8} />
          {/* Bookmark ribbon. */}
          <Path d="M40 49 L40 60 L43.5 56.5 L47 60 L47 49 Z" fill={ref('ribbon')} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
          <Highlight d="M26 32 Q27 38 26 44" />
        </>
      )}
    </IconSvg>
  );
});

// ՄԵՆՅՈՒ: a cozy house — a red roof, warm walls, a green door and a window.
const HOUSE_SHAPE = 'M5 31 L32 7 L59 31 L51 31 L51 55 Q51 58 48 58 L16 58 Q13 58 13 55 L13 31 Z';
export const HouseIcon = memo(function HouseIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg size={size} gradients={{ wall: ['#FFEFB8', '#F2C35A'], roof: ['#FF8A7A', '#D63C2F'], door: ['#7BD88A', '#3E9E52'] }}>
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Path d={HOUSE_SHAPE} fill="#8E520A" />
          </G>
          {/* Chimney. */}
          <Rect x={41} y={10} width={8} height={14} rx={1.5} fill={ref('roof')} stroke={OUTLINE} strokeWidth={2.4} />
          {/* Walls. */}
          <Path d="M13 28 L51 28 L51 55 Q51 58 48 58 L16 58 Q13 58 13 55 Z" fill={ref('wall')} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          {/* Roof: a solid, rounded triangle with eaves. */}
          <Path
            d="M6.5 33 Q3.5 33 5.2 30.3 L29.6 7.9 Q32 5.8 34.4 7.9 L58.8 30.3 Q60.5 33 57.5 33 Z"
            fill={ref('roof')}
            stroke={OUTLINE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M24 16.5 L32 10.5" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={2.6} strokeLinecap="round" />
          {/* Door and its knob. */}
          <Path d="M25.5 58 L25.5 44 Q25.5 39.5 32 39.5 Q38.5 39.5 38.5 44 L38.5 58 Z" fill={ref('door')} stroke={OUTLINE} strokeWidth={2.4} />
          <Circle cx={35.3} cy={49.5} r={1.4} fill="#FFE48A" />
          {/* Window. */}
          <Rect x={41} y={37} width={7} height={7} rx={1.5} fill="#BDE6FF" stroke={OUTLINE} strokeWidth={1.8} />
          <Highlight d="M17.5 37 L17.5 49" />
        </>
      )}
    </IconSvg>
  );
});

// ԱՌԱՋԱՏԱՐՆԵՐ: a winners' podium — gold 1 in the middle (tallest), silver 2
// on the left, bronze 3 on the right, each step with its number and a line.
export const PodiumIcon = memo(function PodiumIcon({ size = 26 }: { size?: number }) {
  const step = (x: number, y: number, w: number, fill: string, n: string) => (
    <>
      <Rect x={x} y={y} width={w} height={57 - y} rx={4} fill={fill} stroke={OUTLINE} strokeWidth={3} />
      <Path d={`M${x + 4} ${y + 5} L${x + w - 4} ${y + 5}`} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
      <SvgText
        x={x + w / 2}
        y={(y + 57) / 2 + 6} // centered in the step (baseline ≈ center + 6)
        textAnchor="middle"
        fontSize={16}
        fontWeight="900"
        fill="#FFFFFF"
        stroke={OUTLINE}
        strokeWidth={1.2}
      >
        {n}
      </SvgText>
    </>
  );
  return (
    <IconSvg size={size} gradients={{ gold: ['#FFE48A', '#E09A12'], silver: ['#E4EEF7', '#9DB0C4'], bronze: ['#F0B070', '#B8642A'] }}>
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Path d="M4 33 L22 33 L22 15 L42 15 L42 39 L60 39 L60 57 L4 57 Z" fill="#5A3A12" />
          </G>
          {step(4, 31, 19, ref('silver'), '2')}
          {step(41, 37, 19, ref('bronze'), '3')}
          {step(21, 13, 22, ref('gold'), '1')}
          {/* A little star above the winner. */}
          <Path
            d="M32 2.5 L33.9 6.3 L38 6.9 L35 9.8 L35.7 13.9 L32 12 L28.3 13.9 L29 9.8 L26 6.9 L30.1 6.3 Z"
            fill={ref('gold')}
            stroke={OUTLINE}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </>
      )}
    </IconSvg>
  );
});

// ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ: a friendly gear — 8 rounded teeth, a steel-blue body and a
// dark hub hole.
const GEAR_TEETH = Array.from({ length: 8 }, (_, i) => i * 45);
const gear = (fill: string, stroke?: string) => (
  <>
    {GEAR_TEETH.map((angle) => (
      <Rect
        key={angle}
        x={27}
        y={4.5}
        width={10}
        height={14}
        rx={3}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 3 : 0}
        transform={`rotate(${angle} 32 32)`}
      />
    ))}
    <Circle cx={32} cy={32} r={20} fill={fill} stroke={stroke} strokeWidth={stroke ? 3 : 0} />
  </>
);
export const GearIcon = memo(function GearIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg size={size} gradients={{ body: ['#DCE7F2', '#7F95AD'], hub: ['#55657A', '#2E3A4A'] }}>
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>{gear('#3E4B5C')}</G>
          {gear(ref('body'), OUTLINE)}
          {/* Cover the teeth's inner outlines where they meet the body. */}
          <Circle cx={32} cy={32} r={18.5} fill={ref('body')} />
          <Circle cx={32} cy={32} r={8} fill={ref('hub')} stroke={OUTLINE} strokeWidth={2.4} />
          <Circle cx={32} cy={32} r={13} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.6} />
          <Highlight d="M19.5 25 A14 14 0 0 1 26 19" />
        </>
      )}
    </IconSvg>
  );
});
