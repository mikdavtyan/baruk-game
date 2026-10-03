import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

// The fortune wheel (ԲԱԽՏԻ ԱՆԻՎ) game icon, in the coin's family
// (design-system.md): a darker offset base for depth, a chunky gold rim with a
// thick rounded outline, 8 cheerful segments, a gold hub and a rounded red
// pointer on top. Fixed game-art colors, the same in both themes.
const CX = 32;
const CY = 33;
const SEGMENT_RADIUS = 20;
const SEGMENT_COLORS = ['#F2564B', '#FFC93C', '#3FA9F5', '#5CC167', '#F2564B', '#FFC93C', '#3FA9F5', '#5CC167'];
const OUTLINE = '#6B3A0A';

// One wedge of the wheel, `i` of 8, starting at the top.
function wedge(i: number): string {
  const step = (Math.PI * 2) / SEGMENT_COLORS.length;
  const a0 = -Math.PI / 2 + i * step - step / 2;
  const a1 = a0 + step;
  const x0 = CX + SEGMENT_RADIUS * Math.cos(a0);
  const y0 = CY + SEGMENT_RADIUS * Math.sin(a0);
  const x1 = CX + SEGMENT_RADIUS * Math.cos(a1);
  const y1 = CY + SEGMENT_RADIUS * Math.sin(a1);
  return `M${CX} ${CY} L${x0.toFixed(2)} ${y0.toFixed(2)} A${SEGMENT_RADIUS} ${SEGMENT_RADIUS} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}
const WEDGES = SEGMENT_COLORS.map((_, i) => wedge(i));
const DIVIDERS = SEGMENT_COLORS.map((_, i) => {
  const a = -Math.PI / 2 + i * ((Math.PI * 2) / SEGMENT_COLORS.length) - Math.PI / SEGMENT_COLORS.length;
  return `M${CX} ${CY} L${(CX + SEGMENT_RADIUS * Math.cos(a)).toFixed(2)} ${(CY + SEGMENT_RADIUS * Math.sin(a)).toFixed(2)}`;
}).join(' ');

function FortuneWheelIcon({ size = 28 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={id('rim')} x1="0.15" y1="0.1" x2="0.85" y2="0.9">
          <Stop offset="0" stopColor="#FFF1A6" />
          <Stop offset="0.5" stopColor="#F7C23A" />
          <Stop offset="1" stopColor="#C47A0B" />
        </LinearGradient>
        <RadialGradient id={id('hub')} cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FFF6C4" />
          <Stop offset="1" stopColor="#E09A12" />
        </RadialGradient>
        <LinearGradient id={id('pointer')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF7A6B" />
          <Stop offset="1" stopColor="#C93A2E" />
        </LinearGradient>
      </Defs>

      {/* Depth: the same disc, darker, offset down-left. */}
      <Circle cx={CX - 1.5} cy={CY + 3} r={26} fill="#8E520A" />
      {/* Rim. */}
      <Circle cx={CX} cy={CY} r={26} fill={ref('rim')} stroke={OUTLINE} strokeWidth={3} />
      {/* Segments, divided by soft white spokes. */}
      <G stroke={OUTLINE} strokeWidth={0.8} strokeOpacity={0.35}>
        {WEDGES.map((d, i) => (
          <Path key={i} d={d} fill={SEGMENT_COLORS[i]} />
        ))}
      </G>
      <Path d={DIVIDERS} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={CX} cy={CY} r={SEGMENT_RADIUS} fill="none" stroke={OUTLINE} strokeOpacity={0.6} strokeWidth={1.6} />
      {/* Rim studs. */}
      <Circle
        cx={CX}
        cy={CY}
        r={23}
        fill="none"
        stroke="#FFF7CC"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray="0 9.03"
      />
      {/* A soft highlight on the upper left. */}
      <Path d="M17 24 A17 17 0 0 1 28 15" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* Hub. */}
      <Circle cx={CX} cy={CY} r={5.5} fill={ref('hub')} stroke={OUTLINE} strokeWidth={2} />
      {/* Pointer: a rounded drop pointing down into the wheel. */}
      <Path
        d="M26 3.5 Q32 1 38 3.5 Q39.5 5 38.5 7 L33.6 14.5 Q32 16.4 30.4 14.5 L25.5 7 Q24.5 5 26 3.5 Z"
        fill={ref('pointer')}
        stroke={OUTLINE}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Circle cx={30} cy={5.6} r={1.4} fill="#FFFFFF" fillOpacity={0.7} />
    </Svg>
  );
}

export default memo(FortuneWheelIcon);
