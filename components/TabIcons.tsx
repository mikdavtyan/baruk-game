import { memo, ReactNode } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { DEPTH_OFFSET, Highlight, OUTLINE, useSvgIds } from './gameIconArt';

// The tab bar's icons, in the fortune wheel's family (FortuneWheelIcon.tsx,
// design-system.md): a 64-unit viewBox; a darker copy of the silhouette
// offset down-left for depth; cheerful gradient fills; the same thick rounded
// brown outline (OUTLINE, 3 for the main shape, ~2 for details); a soft white
// highlight stroke on the upper left. Fixed game-art colors, the same in both
// themes (so a theme toggle never re-renders them). Built for 26–36px.

type GradientStops = [string, string];

// One icon: its gradients (by name), then its shapes. `ref` resolves a
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
  const { id, ref } = useSvgIds();
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
      {children(ref)}
    </Svg>
  );
}

// A digit drawn as a stroke: a brown outline under a white core, so it reads
// on any fill at 26px without depending on a font.
const Digit = ({ d }: { d: string }) => (
  <>
    <Path d={d} stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d={d} stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

// ԽԱՆՈՒԹ: a shopping cart — an apricot basket with a white grid and a gold
// coin peeking out, a brown handle frame and two pomegranate wheels.
const CART_BASKET = 'M14 21 L56 21 Q58.6 21 57.9 23.5 L53.8 39.5 Q53 42.5 50 42.5 L21.6 42.5 Q18.7 42.5 18.1 39.6 Z';
export const ShopCartIcon = memo(function ShopCartIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg
      size={size}
      gradients={{ basket: ['#FFC77A', '#F07F1E'], wheel: ['#FF8197', '#C8243F'], coin: ['#FFF1A6', '#F5A524'] }}
    >
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Path d={CART_BASKET} fill="#8A3F0A" />
          </G>
          {/* A gold coin peeking out of the basket. */}
          <Circle cx={39} cy={17} r={7.5} fill={ref('coin')} stroke={OUTLINE} strokeWidth={2.4} />
          <Path d="M39 13.5 L39 20.5" stroke="#C47A0B" strokeWidth={2.2} strokeLinecap="round" />
          {/* Handle and frame. */}
          <Path
            d="M5 11.5 L10.5 11.5 Q13 11.5 13.6 14 L19.2 45.5 Q19.8 48.5 22.8 48.5 L51 48.5"
            stroke={OUTLINE}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d={CART_BASKET} fill={ref('basket')} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          {/* The basket's grid. */}
          <Path
            d="M28 23.5 L28.8 40 M39 23.5 L39 40 M50 23.5 L48.6 40 M17.6 32 L55.6 32"
            stroke="#FFFFFF"
            strokeOpacity={0.7}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Highlight d="M19.5 25.5 L23.5 25.5" />
          <Circle cx={25} cy={54.5} r={5} fill={ref('wheel')} stroke={OUTLINE} strokeWidth={2.6} />
          <Circle cx={46} cy={54.5} r={5} fill={ref('wheel')} stroke={OUTLINE} strokeWidth={2.6} />
        </>
      )}
    </IconSvg>
  );
});

// ԱՌԱՋԱԴՐԱՆՔՆԵՐ (Tasks): a sky-blue clipboard with a gold clip and a cream
// sheet — two green ticked boxes and an empty one.
const CHECK_ROWS = [21.5, 33, 44.5];
export const BookIcon = memo(function BookIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg
      size={size}
      gradients={{ board: ['#8FD8FF', '#2E86E0'], clip: ['#FFF1A6', '#F5A524'], tick: ['#5EE3A6', '#22A066'] }}
    >
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Rect x={11} y={8} width={42} height={52} rx={8} fill="#1B4E86" />
          </G>
          <Rect x={11} y={8} width={42} height={52} rx={8} fill={ref('board')} stroke={OUTLINE} strokeWidth={3} />
          {/* The sheet. */}
          <Rect x={16.5} y={15} width={31} height={39.5} rx={4} fill="#FFF8E6" stroke={OUTLINE} strokeWidth={2} />
          {CHECK_ROWS.map((y, i) => (
            <G key={y}>
              <Rect
                x={20}
                y={y - 4.5}
                width={9}
                height={9}
                rx={2.5}
                fill={i < 2 ? ref('tick') : '#FFFFFF'}
                stroke={OUTLINE}
                strokeWidth={1.8}
              />
              {i < 2 && (
                <Path
                  d={`M22.2 ${y} L24 ${y + 2} L27 ${y - 2}`}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
              <Path d={`M32.5 ${y} L43.5 ${y}`} stroke="#D9C49A" strokeWidth={2.6} strokeLinecap="round" />
            </G>
          ))}
          {/* The clip. */}
          <Rect x={22} y={4} width={20} height={10} rx={4} fill={ref('clip')} stroke={OUTLINE} strokeWidth={2.4} />
          <Circle cx={32} cy={8.6} r={1.8} fill={OUTLINE} />
          <Highlight d="M14.5 20 L14.5 36" />
        </>
      )}
    </IconSvg>
  );
});

// ՄԵՆՅՈՒ (Home): a cozy house — a pomegranate roof, apricot walls, a green
// door, a sky window and a chimney.
const HOUSE_SHAPE = 'M5 31 L32 7 L59 31 L51 31 L51 55 Q51 58 48 58 L16 58 Q13 58 13 55 L13 31 Z';
export const HouseIcon = memo(function HouseIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg
      size={size}
      gradients={{ wall: ['#FFF3DC', '#FFC27A'], roof: ['#FF8197', '#C8243F'], door: ['#5EE3A6', '#22A066'] }}
    >
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Path d={HOUSE_SHAPE} fill="#8A3F0A" />
          </G>
          {/* Chimney. */}
          <Rect x={41} y={10} width={8} height={14} rx={1.5} fill={ref('roof')} stroke={OUTLINE} strokeWidth={2.4} />
          {/* Walls. */}
          <Path
            d="M13 28 L51 28 L51 55 Q51 58 48 58 L16 58 Q13 58 13 55 Z"
            fill={ref('wall')}
            stroke={OUTLINE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          {/* Roof: a solid, rounded triangle with eaves. */}
          <Path
            d="M6.5 33 Q3.5 33 5.2 30.3 L29.6 7.9 Q32 5.8 34.4 7.9 L58.8 30.3 Q60.5 33 57.5 33 Z"
            fill={ref('roof')}
            stroke={OUTLINE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Highlight d="M15 26.5 L29 13.5" />
          {/* Door and its knob. */}
          <Path
            d="M25.5 58 L25.5 44 Q25.5 39.5 32 39.5 Q38.5 39.5 38.5 44 L38.5 58 Z"
            fill={ref('door')}
            stroke={OUTLINE}
            strokeWidth={2.4}
          />
          <Circle cx={35.2} cy={49.5} r={1.5} fill="#FFE08A" />
          {/* Window. */}
          <Rect x={41.5} y={37.5} width={6.5} height={6.5} rx={1.5} fill="#BDE6FF" stroke={OUTLINE} strokeWidth={1.8} />
          <Rect x={16} y={37.5} width={6.5} height={6.5} rx={1.5} fill="#BDE6FF" stroke={OUTLINE} strokeWidth={1.8} />
        </>
      )}
    </IconSvg>
  );
});

// ԱՌԱՋԱՏԱՐՆԵՐ: a winners' podium — gold 1 in the middle (tallest), silver 2
// on the left, bronze 3 on the right, and a pomegranate star over the winner.
const STEP_BOTTOM = 57;
const Step = ({ x, y, w, fill, digit }: { x: number; y: number; w: number; fill: string; digit: string }) => (
  <>
    <Rect x={x} y={y} width={w} height={STEP_BOTTOM - y} rx={4} fill={fill} stroke={OUTLINE} strokeWidth={3} />
    <Path d={`M${x + 4} ${y + 4.5} L${x + w - 4} ${y + 4.5}`} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2.2} strokeLinecap="round" />
    <G transform={`translate(${x + w / 2} ${(y + 5 + STEP_BOTTOM) / 2})`}>
      <Digit d={digit} />
    </G>
  </>
);
// Digits centered on (0, 0), about 11 units tall.
const ONE = 'M-2.2 -3.4 L0.6 -5.4 L0.6 5.4';
const TWO = 'M-3.2 -2.8 Q-2.6 -5.5 0 -5.5 Q3.2 -5.5 3.2 -2.6 Q3.2 -0.6 0.4 1.6 L-3.2 5.2 L3.4 5.2';
const THREE = 'M-3.2 -4.6 Q-1.6 -5.6 0.2 -5.5 Q3.2 -5.3 3 -2.6 Q2.8 -0.2 -0.4 0 Q3.4 0.1 3.3 2.8 Q3.1 5.6 -0.2 5.6 Q-2.2 5.6 -3.4 4.6';
export const PodiumIcon = memo(function PodiumIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg
      size={size}
      gradients={{
        gold: ['#FFE58A', '#F5A524'],
        silver: ['#EEF3FA', '#9DAFC6'],
        bronze: ['#FFC08A', '#C46A2A'],
        star: ['#FF8197', '#C8243F'],
      }}
    >
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Path d="M4 33 L22 33 L22 17 L42 17 L42 39 L60 39 L60 57 L4 57 Z" fill="#5A3A12" />
          </G>
          <Step x={4} y={33} w={19} fill={ref('silver')} digit={TWO} />
          <Step x={41} y={39} w={19} fill={ref('bronze')} digit={THREE} />
          <Step x={21} y={17} w={22} fill={ref('gold')} digit={ONE} />
          {/* A star above the winner. */}
          <Path
            d="M32 2.2 L34.3 6.6 L39.2 7.4 L35.7 10.8 L36.5 15.6 L32 13.4 L27.5 15.6 L28.3 10.8 L24.8 7.4 L29.7 6.6 Z"
            fill={ref('star')}
            stroke={OUTLINE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </>
      )}
    </IconSvg>
  );
});

// ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ: a friendly lilac gear — 8 rounded teeth in one outline,
// and a gold hub with a dark hole.
const TEETH = 8;
const R_OUT = 27;
const R_IN = 20.5;
function gearPath(): string {
  const p = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(32 + r * Math.cos(a)).toFixed(2)} ${(32 + r * Math.sin(a)).toFixed(2)}`;
  };
  const step = 360 / TEETH;
  let d = '';
  for (let i = 0; i < TEETH; i++) {
    const c = i * step - 90;
    // Tooth sides stay about parallel: wider angle at the root than at the tip.
    d += `${i === 0 ? 'M' : 'L'}${p(R_IN, c - 13)} L${p(R_OUT, c - 8.5)} A${R_OUT} ${R_OUT} 0 0 1 ${p(R_OUT, c + 8.5)} L${p(R_IN, c + 13)} A${R_IN} ${R_IN} 0 0 1 ${p(R_IN, c + step - 13)} `;
  }
  return `${d}Z`;
}
const GEAR = gearPath();
export const GearIcon = memo(function GearIcon({ size = 26 }: { size?: number }) {
  return (
    <IconSvg size={size} gradients={{ body: ['#D9C2FF', '#8A5CE0'], hub: ['#FFF1A6', '#F5A524'] }}>
      {(ref) => (
        <>
          <G transform={DEPTH_OFFSET}>
            <Path d={GEAR} fill="#4A2A8C" />
          </G>
          <Path d={GEAR} fill={ref('body')} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          <Circle cx={32} cy={32} r={10} fill={ref('hub')} stroke={OUTLINE} strokeWidth={2.4} />
          <Circle cx={32} cy={32} r={4} fill="#5A2E08" />
          <Highlight d="M15.5 26 A17 17 0 0 1 23 17.5" />
        </>
      )}
    </IconSvg>
  );
});
