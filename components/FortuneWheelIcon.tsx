import { memo } from 'react';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { DEPTH_OFFSET, Highlight, OUTLINE, useSvgIds } from './gameIconArt';

// The fortune wheel (ԲԱԽՏԻ ԱՆԻՎ) game icon — the reference of the icon family
// (design-system.md): a darker offset base for depth, a glossy gold rim with
// white studs and a thick rounded outline, 8 cheerful wedges (each shaded
// darker toward the hub), a gold hub with a pomegranate gem, a glass sheen and
// a rounded pomegranate pointer on top. Fixed game-art colors, the same in
// both themes.
const CX = 32;
const CY = 33;
const RIM_RADIUS = 26;
const SEGMENT_RADIUS = 20;
const STUD_RADIUS = 23;
// [light (outer edge), deep (toward the hub)] per wedge, alternating warm and cool.
const SEGMENTS: [string, string][] = [
  ['#FF6F86', '#D42F4E'], // pomegranate
  ['#FFE08A', '#F5A524'], // gold
  ['#5EE3A6', '#22A066'], // green
  ['#7CC8FF', '#2E86E0'], // sky
  ['#FF6F86', '#D42F4E'],
  ['#FFE08A', '#F5A524'],
  ['#5EE3A6', '#22A066'],
  ['#7CC8FF', '#2E86E0'],
];
const STEP = (Math.PI * 2) / SEGMENTS.length;
const polar = (r: number, a: number) => `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;

// One wedge of the wheel, `i` of 8, centered on the top for i = 0.
function wedge(i: number): string {
  const a0 = -Math.PI / 2 + i * STEP - STEP / 2;
  return `M${CX} ${CY} L${polar(SEGMENT_RADIUS, a0)} A${SEGMENT_RADIUS} ${SEGMENT_RADIUS} 0 0 1 ${polar(SEGMENT_RADIUS, a0 + STEP)} Z`;
}
const WEDGES = SEGMENTS.map((_, i) => wedge(i));
const DIVIDERS = SEGMENTS.map((_, i) => `M${polar(6, -Math.PI / 2 + (i - 0.5) * STEP)} L${polar(SEGMENT_RADIUS, -Math.PI / 2 + (i - 0.5) * STEP)}`).join(' ');
// 16 studs on the rim: one on each divider, one mid-wedge.
const STUDS = Array.from({ length: 16 }, (_, i) => {
  const a = -Math.PI / 2 + (i - 1) * (STEP / 2);
  return { x: CX + STUD_RADIUS * Math.cos(a), y: CY + STUD_RADIUS * Math.sin(a), big: i % 2 === 1 };
});

// `layer` draws one part, for Home's spinning wheel button (WheelButton): the
// `base` (the offset depth disc), the `wheel` (rim, segments, studs, hub — the
// part that turns) and the `top` (sheen, highlight and pointer, which stay
// still, as on a real wheel). Stacked, they make the whole icon; their viewBox
// is shifted by 1 so the wheel's center is the view's center (its rotation
// axis). Every shading of the turning part is radial around that center, so
// the wheel looks the same at any angle while it spins.
export type WheelLayer = 'base' | 'wheel' | 'top';

function FortuneWheelIcon({ size = 28, layer }: { size?: number; layer?: WheelLayer }) {
  const show = (part: WheelLayer) => layer === undefined || layer === part;
  const { id, ref } = useSvgIds();
  return (
    <Svg width={size} height={size} viewBox={layer ? '0 1 64 64' : '0 0 64 64'}>
      <Defs>
        {/* The rim: a radial gold band, bright in the middle of the band. */}
        <RadialGradient id={id('rim')} cx={CX} cy={CY} r={RIM_RADIUS} gradientUnits="userSpaceOnUse">
          <Stop offset="0.74" stopColor="#C47A0B" />
          <Stop offset="0.86" stopColor="#FFE58A" />
          <Stop offset="0.93" stopColor="#F7C23A" />
          <Stop offset="1" stopColor="#B86E08" />
        </RadialGradient>
        {SEGMENTS.map(([light, deep], i) => (
          <RadialGradient key={i} id={id(`seg${i}`)} cx={CX} cy={CY} r={SEGMENT_RADIUS} gradientUnits="userSpaceOnUse">
            <Stop offset="0.25" stopColor={deep} />
            <Stop offset="0.8" stopColor={light} />
            <Stop offset="1" stopColor={deep} />
          </RadialGradient>
        ))}
        <RadialGradient id={id('hub')} cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FFF6C4" />
          <Stop offset="0.6" stopColor="#FFC93C" />
          <Stop offset="1" stopColor="#D88A0C" />
        </RadialGradient>
        <RadialGradient id={id('gem')} cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FF9AAA" />
          <Stop offset="1" stopColor="#C8243F" />
        </RadialGradient>
        <LinearGradient id={id('pointer')} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor="#FF8197" />
          <Stop offset="1" stopColor="#C8243F" />
        </LinearGradient>
        <ClipPath id={id('face')}>
          <Circle cx={CX} cy={CY} r={RIM_RADIUS - 1.5} />
        </ClipPath>
      </Defs>

      {/* Depth: the same disc, darker, offset down-left. */}
      {show('base') && (
        <G transform={DEPTH_OFFSET}>
          <Circle cx={CX} cy={CY} r={RIM_RADIUS + 1.5} fill="#7A3E06" />
        </G>
      )}
      {show('wheel') && (
        <G>
          {/* Rim. */}
          <Circle cx={CX} cy={CY} r={RIM_RADIUS} fill={ref('rim')} stroke={OUTLINE} strokeWidth={3} />
          {/* Wedges, each shaded toward the hub. */}
          {WEDGES.map((d, i) => (
            <Path key={i} d={d} fill={ref(`seg${i}`)} />
          ))}
          <Path d={DIVIDERS} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={1.6} strokeLinecap="round" />
          <Circle cx={CX} cy={CY} r={SEGMENT_RADIUS} fill="none" stroke={OUTLINE} strokeWidth={2} />
          {/* Rim studs: little white lights. */}
          {STUDS.map((s, i) => (
            <Circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.big ? 1.9 : 1.3}
              fill="#FFFFFF"
              stroke={s.big ? '#B86E08' : undefined}
              strokeWidth={s.big ? 0.6 : 0}
              opacity={s.big ? 1 : 0.85}
            />
          ))}
          {/* Hub with a pomegranate gem. */}
          <Circle cx={CX} cy={CY} r={6.2} fill={ref('hub')} stroke={OUTLINE} strokeWidth={2} />
          <Circle cx={CX} cy={CY} r={2.6} fill={ref('gem')} />
        </G>
      )}
      {show('top') && (
        <G>
          {/* A still glass sheen over the upper-left of the face… */}
          <G clipPath={ref('face')}>
            <Path d="M2 36 C10 18 22 10 44 6 L4 4 Z" fill="#FFFFFF" opacity={0.18} />
          </G>
          {/* …and the family's soft highlight stroke on the rim. */}
          <Highlight d="M13.5 26 A19.5 19.5 0 0 1 22.5 15.6" />
          {/* Pointer: a rounded drop pointing down into the wheel, with its own depth. */}
          <G transform={DEPTH_OFFSET}>
            <Path
              d="M25.6 3.8 Q32 0.8 38.4 3.8 Q40 5.3 38.9 7.3 L33.8 15.2 Q32 17.3 30.2 15.2 L25.1 7.3 Q24 5.3 25.6 3.8 Z"
              fill="#7A1E2E"
              opacity={0.55}
            />
          </G>
          <Path
            d="M25.6 3.8 Q32 0.8 38.4 3.8 Q40 5.3 38.9 7.3 L33.8 15.2 Q32 17.3 30.2 15.2 L25.1 7.3 Q24 5.3 25.6 3.8 Z"
            fill={ref('pointer')}
            stroke={OUTLINE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Circle cx={29.6} cy={5.6} r={1.5} fill="#FFFFFF" fillOpacity={0.8} />
        </G>
      )}
    </Svg>
  );
}

export default memo(FortuneWheelIcon);
