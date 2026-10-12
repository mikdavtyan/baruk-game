import { memo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { DEPTH_OFFSET, OUTLINE, useSvgIds } from './gameIconArt';

// The Darts art, in the fortune wheel's icon family (design-system.md): a
// wooden bow with a cream string and a nocked arrow (BowIcon), and the flying
// arrow (ArrowOverlay). Static drawings — their owners animate them with
// transforms. Fixed game-art colors, the same in both themes.

// The bow, drawn in a 64 box, aiming up-right. The string runs between the
// tips; the arrow lies on the line through the string's middle.
const TIP_A = { x: 9, y: 24 };
const TIP_B = { x: 40, y: 55 };
const LIMB = `M${TIP_A.x} ${TIP_A.y} C28 4.5 59.5 36 ${TIP_B.x} ${TIP_B.y}`;
const STRING = `M${TIP_A.x} ${TIP_A.y} L${TIP_B.x} ${TIP_B.y}`;
// The nocked arrow in its own frame: x along the arrow, 0 at the string.
const ARROW_FRAME = 'translate(24.5 39.5) rotate(-45)';
const SHAFT = 'M-19 0 L37 0';
const HEAD = 'M46.5 0 L35 -6.5 Q37 0 35 6.5 Z';
const VANES = 'M-9 -1.2 L-14.5 -8.5 Q-19.5 -9.6 -21.5 -7.5 L-18 -1.2 Z M-9 1.2 L-14.5 8.5 Q-19.5 9.6 -21.5 7.5 L-18 1.2 Z';

export const BowArt = memo(function BowArt({ size }: { size: number }) {
  const { id, ref } = useSvgIds();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={id('wood')} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F2B66A" />
          <Stop offset="1" stopColor="#B4652A" />
        </LinearGradient>
        <LinearGradient id={id('steel')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F2F6FB" />
          <Stop offset="1" stopColor="#8E9EB4" />
        </LinearGradient>
        <LinearGradient id={id('feather')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF8197" />
          <Stop offset="1" stopColor="#C8243F" />
        </LinearGradient>
      </Defs>

      {/* Depth: the limb and the arrow, darker, offset down-left. */}
      <G transform={DEPTH_OFFSET}>
        <Path d={LIMB} stroke="#5A2E08" strokeWidth={9} strokeLinecap="round" fill="none" />
        <G transform={ARROW_FRAME}>
          <Path d={SHAFT} stroke="#5A2E08" strokeWidth={6} strokeLinecap="round" />
          <Path d={HEAD} fill="#5A2E08" />
        </G>
      </G>
      {/* String: an outline under a cream core. */}
      <Path d={STRING} stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round" />
      <Path d={STRING} stroke="#FFF1D6" strokeWidth={1.5} strokeLinecap="round" />
      {/* Limb: one thick outline stroke under the wood. */}
      <Path d={LIMB} stroke={OUTLINE} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Path d={LIMB} stroke={ref('wood')} strokeWidth={4.2} strokeLinecap="round" fill="none" />
      <Path d="M14 16.5 Q19 12.4 24.5 10.4" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      {/* Tips. */}
      <Circle cx={TIP_A.x} cy={TIP_A.y} r={3} fill="#8A4B1A" stroke={OUTLINE} strokeWidth={1.8} />
      <Circle cx={TIP_B.x} cy={TIP_B.y} r={3} fill="#8A4B1A" stroke={OUTLINE} strokeWidth={1.8} />
      {/* The nocked arrow. */}
      <G transform={ARROW_FRAME}>
        <Path d={SHAFT} stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" />
        <Path d={SHAFT} stroke="#E9B676" strokeWidth={2.6} strokeLinecap="round" />
        <Path d={VANES} fill={ref('feather')} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d={HEAD} fill={ref('steel')} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      </G>
      {/* The grip: a pomegranate wrap at the limb's middle, over the arrow. */}
      <Rect
        x={-5.5}
        y={-4.6}
        width={11}
        height={9.2}
        rx={3}
        fill={ref('feather')}
        stroke={OUTLINE}
        strokeWidth={2}
        transform="translate(38.6 25.4) rotate(45)"
      />
    </Svg>
  );
});

// The flying arrow: horizontal, its tip at the right edge, in a 237 × 92 box
// (ArrowOverlay's ARROW_ASPECT).
const FLY_SHAFT = 'M40 46 L196 46';
const FLY_HEAD = 'M231 46 L189 21 Q198 46 189 71 Z';
const FLY_VANES =
  'M84 42 L60 18 Q44 11 26 15 L46 42 Z M84 50 L60 74 Q44 81 26 77 L46 50 Z';

export const ArrowArt = memo(function ArrowArt({ width, height }: { width: number; height: number }) {
  const { id, ref } = useSvgIds();
  return (
    <Svg width={width} height={height} viewBox="0 0 237 92">
      <Defs>
        <LinearGradient id={id('steel')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F2F6FB" />
          <Stop offset="1" stopColor="#8E9EB4" />
        </LinearGradient>
        <LinearGradient id={id('feather')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF8197" />
          <Stop offset="1" stopColor="#C8243F" />
        </LinearGradient>
      </Defs>
      <Path d={FLY_SHAFT} stroke={OUTLINE} strokeWidth={20} strokeLinecap="round" />
      <Path d={FLY_SHAFT} stroke="#E9B676" strokeWidth={9} strokeLinecap="round" />
      <Path d={FLY_VANES} fill={ref('feather')} stroke={OUTLINE} strokeWidth={8} strokeLinejoin="round" />
      <Path d="M36 18 Q45 16 54 20" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d={FLY_HEAD} fill={ref('steel')} stroke={OUTLINE} strokeWidth={8} strokeLinejoin="round" />
      <Path d="M198 37 L213 37" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
});
