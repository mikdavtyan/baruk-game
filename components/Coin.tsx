import { memo, useId } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useThemeSnapshot } from '../lib/ThemeContext';
import { DEPTH_OFFSET, OUTLINE } from './gameIconArt';

type Props = {
  size?: number;
};

// The one reusable coin graphic. Rendered as real react-native-svg
// components (not a rasterized image, and not react-native-svg's XML-string
// APIs) specifically so multiple coins on screen at once — the header pill,
// price badges, a pile of them, a dozen mid-flight — never collide on their
// internal gradient ids: `useId()` gives every mounted Coin its own private id
// prefix.
export default function Coin({ size = 24 }: Props) {
  // The shadow color is the only themed part, so only this thin outer view
  // reads the snapshot; the SVG art (CoinArt) is memoized and never re-renders
  // on a theme toggle.
  const { theme } = useThemeSnapshot();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');

  return (
    <View
      pointerEvents="none"
      style={[
        { width: size, height: size },
        // Android's shadow (elevation) draws around the view's rectangular
        // bounding box, not the coin's own circular silhouette — visibly
        // wrong for a shape this small, so it's iOS-only, same reasoning as
        // ArrowOverlay's flying arrows.
        Platform.OS === 'ios' && {
          shadowColor: theme.coinShadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 1,
          shadowRadius: 1.5,
        },
      ]}
    >
      <CoinArt size={size} uid={uid} />
    </View>
  );
}

// The coin's SVG, in the fortune wheel's icon family (design-system.md): a
// darker offset edge for depth, a gold face with one thick brown outline, an
// inner ring, the Armenian Բ embossed in brown and a soft white highlight.
// Kept bold and simple so it reads at 14px. Fixed game-art colors, the same in
// both themes. `uid` prefixes its gradient ids (see above).
const LETTER = 'M26 43V25C26 20 29 17 33 17S39.6 20 39.6 24.6V27.6M26 31.3H34.6';
const CoinArt = memo(function CoinArt({ size, uid }: { size: number; uid: string }) {
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id={id('face')} cx="0.36" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FFF4B8" />
          <Stop offset="0.45" stopColor="#FFD24A" />
          <Stop offset="1" stopColor="#E79A12" />
        </RadialGradient>
        <LinearGradient id={id('field')} x1="0.2" y1="0.1" x2="0.8" y2="0.95">
          <Stop offset="0" stopColor="#F2AE1E" />
          <Stop offset="1" stopColor="#FFD95A" />
        </LinearGradient>
      </Defs>

      {/* Depth: the coin's edge, darker, offset down-left. */}
      <G transform={DEPTH_OFFSET}>
        <Circle cx={32} cy={31} r={27.5} fill="#A35A06" />
      </G>
      <Circle cx={32} cy={31} r={26} fill={ref('face')} stroke={OUTLINE} strokeWidth={3} />
      {/* A slightly sunken field inside a ring. */}
      <Circle cx={32} cy={31} r={19.5} fill={ref('field')} stroke="#C47A0B" strokeWidth={2.2} />
      {/* Բ, embossed: a light rim below-right, then the brown letter. */}
      <G fill="none" strokeLinejoin="round" strokeLinecap="round">
        <Path transform="translate(1.1 1.3)" stroke="#FFF3B0" strokeWidth={6} d={LETTER} />
        <Path stroke="#8A4B08" strokeWidth={5.6} d={LETTER} />
      </G>
      <Path
        d="M12.5 24 A20.5 20.5 0 0 1 22.5 12.8"
        stroke="#FFFFFF"
        strokeOpacity={0.7}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
});
