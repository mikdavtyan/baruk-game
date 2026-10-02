import { useId } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  size?: number;
};

// The one reusable coin graphic — see assets/coin.svg for the literal source
// markup this is translated from. Rendered as real react-native-svg
// components (not a rasterized image, and not react-native-svg's XML-string
// APIs) specifically so multiple coins on screen at once — the header pill,
// price badges, a pile of them, a dozen mid-flight — never collide on their
// internal gradient/clip ids: `useId()` gives every mounted Coin its own
// private id prefix, which is the RN-native way to get the same guarantee
// the spec's "don't inline it" was after on the web.
export default function Coin({ size = 24 }: Props) {
  const { theme } = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;

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
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <RadialGradient id={id('face')} cx="0.34" cy="0.28" r="0.85">
            <Stop offset="0" stopColor="#FFF6C4" />
            <Stop offset="0.28" stopColor="#FFD95A" />
            <Stop offset="0.68" stopColor="#F4B21F" />
            <Stop offset="1" stopColor="#D88A0C" />
          </RadialGradient>
          <LinearGradient id={id('edge')} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#C98114" />
            <Stop offset="1" stopColor="#8E520A" />
          </LinearGradient>
          <LinearGradient id={id('rim')} x1="0.15" y1="0.1" x2="0.85" y2="0.9">
            <Stop offset="0" stopColor="#FFF1A6" />
            <Stop offset="0.5" stopColor="#F7C23A" />
            <Stop offset="1" stopColor="#C47A0B" />
          </LinearGradient>
          <LinearGradient id={id('field')} x1="0.2" y1="0.1" x2="0.8" y2="0.95">
            <Stop offset="0" stopColor="#F9C338" />
            <Stop offset="1" stopColor="#DE9010" />
          </LinearGradient>
          <LinearGradient id={id('letter')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFBE6" />
            <Stop offset="1" stopColor="#FFE07A" />
          </LinearGradient>
          <ClipPath id={id('edgeClip')}>
            <Circle cx={30.5} cy={35} r={26} />
          </ClipPath>
          <ClipPath id={id('faceClip')}>
            <Circle cx={33} cy={31} r={26} />
          </ClipPath>
        </Defs>

        <Circle cx={30.5} cy={35} r={26} fill={ref('edge')} />
        <G clipPath={ref('edgeClip')} stroke="#7A4406" strokeOpacity={0.35} strokeWidth={1}>
          <Path d="M6 20l3 3M5 26l3 3M5 32l3 3M6 38l3 3M8 44l3 3M11 49l3 3M15 53l3 3M20 56l3 3M26 58l3 3" />
        </G>
        <Circle cx={33} cy={31} r={26} fill={ref('face')} />
        <Circle cx={33} cy={31} r={25.5} fill="none" stroke="#B8700A" strokeOpacity={0.55} strokeWidth={1} />
        <Circle
          cx={33}
          cy={31}
          r={23.7}
          fill="none"
          stroke="#FFF3B0"
          strokeOpacity={0.85}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="0 6.2046"
        />
        <Circle cx={33} cy={31} r={20.5} fill={ref('field')} />
        <Circle cx={33} cy={31} r={21.5} fill="none" stroke={ref('rim')} strokeWidth={2.4} />
        <Circle cx={33} cy={31} r={20.2} fill="none" stroke="#B8700A" strokeOpacity={0.45} strokeWidth={0.8} />
        <G fill="none" strokeWidth={5.6} strokeLinejoin="round">
          <Path
            transform="translate(1.2 1.5)"
            stroke="#8E520A"
            strokeOpacity={0.9}
            d="M27 43V25C27 20 30 17 34 17S40.6 20 40.6 24.6V27.6M27 31.3H35.6"
          />
          <Path
            transform="translate(-0.5 -0.5)"
            stroke="#FFFDF2"
            d="M27 43V25C27 20 30 17 34 17S40.6 20 40.6 24.6V27.6M27 31.3H35.6"
          />
          <Path stroke={ref('letter')} d="M27 43V25C27 20 30 17 34 17S40.6 20 40.6 24.6V27.6M27 31.3H35.6" />
        </G>
        <G clipPath={ref('faceClip')}>
          <Path d="M2 30L34 -2h9L11 30z" fill="#FFFFFF" opacity={0.22} />
        </G>
        <Path d="M49 11l1.3 3.6 3.6 1.3-3.6 1.3L49 20.8l-1.3-3.6-3.6-1.3 3.6-1.3z" fill="#FFFFFF" opacity={0.95} />
      </Svg>
    </View>
  );
}
