import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Text as SvgText } from 'react-native-svg';
import { FONTS } from '../constants/theme';
import { PRAISE_SHINE_MS } from '../constants/winFlow';
import { useTheme } from '../lib/ThemeContext';
import { useLoopWhile } from '../lib/useLoopWhile';

type Props = {
  text: string;
  // Available width to fit within — defaults to the full window width (the
  // praise word's own case). Modal titles pass their own (narrower) content
  // width instead.
  width?: number;
  maxFontSize?: number;
  minFontSize?: number;
  // The praise word: the display font, and a moving gold → pomegranate shine
  // instead of the white fill (a wide gradient translated natively behind the
  // word's mask; reduced motion: it stands still).
  shine?: boolean;
};

// Fixed game-art colors (the same in both themes). The pattern repeats every
// word-width, so translating by one width loops seamlessly.
const SHINE_COLORS = ['#FFD166', '#E8405F', '#FFD166', '#E8405F', '#FFD166', '#E8405F', '#FFD166'] as const;
const STROKE = '#2A0E2E';

const DEFAULT_MAX_FONT_SIZE = 44;
const DEFAULT_MIN_FONT_SIZE = 22;
const SIDE_MARGIN = 24; // used only when `width` isn't given — 24px each side
// Rough average glyph width (as a fraction of font size) for this bold,
// all-caps-styled Armenian font — close enough to size the word right on the
// first try. `textLength` below is what actually *guarantees* it never
// overflows, regardless of how accurate this estimate is.
const GLYPH_WIDTH_EM = 0.66;

// The shared "outlined, popped-in" word/title look — a dark stroke layer
// under a white fill layer (RN's Text can't stroke, hence react-native-svg),
// with a soft shadow and a spring pop-in (scale 0.3 -> 1.12 -> 1, rotate -8deg
// -> 0deg). Used both by PraiseWord (which additionally positions and flies
// this) and inline by the loss flow's second-chance title.
export default function OutlinedWord({
  text,
  width,
  maxFontSize = DEFAULT_MAX_FONT_SIZE,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
  shine = false,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const { reduceMotion } = useTheme();
  const [pop] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));
  useLoopWhile(
    shine && !reduceMotion,
    () => Animated.loop(Animated.timing(sweep, { toValue: 1, duration: PRAISE_SHINE_MS, easing: Easing.linear, useNativeDriver: true })),
    () => sweep.setValue(0),
  );
  const fontFamily = shine ? FONTS.display : FONTS.tile;
  const fontWeight = shine ? undefined : '700';

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4.5, tension: 170, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.3, 1.12, 1] });
  const rotate = pop.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] });
  const opacity = pop.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });

  const available = width ?? windowWidth - SIDE_MARGIN * 2;
  const rawFontSize = available / (text.length * GLYPH_WIDTH_EM);
  const fontSize = Math.max(minFontSize, Math.min(maxFontSize, rawFontSize));
  const estimatedWidth = text.length * GLYPH_WIDTH_EM * fontSize;
  const needsClamp = estimatedWidth > available;
  const svgWidth = width ?? windowWidth;
  const centerX = svgWidth / 2;
  const svgHeight = fontSize * 1.8;
  const baselineY = fontSize * 1.2;
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, -svgWidth] });
  const textProps = {
    x: centerX,
    y: baselineY,
    textAnchor: 'middle' as const,
    fontFamily,
    fontSize,
    fontWeight,
    textLength: needsClamp ? available : undefined,
    lengthAdjust: needsClamp ? ('spacingAndGlyphs' as const) : undefined,
  };

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ scale }, { rotate }] }]}>
      <View style={styles.shadowWrap}>
        <Svg width={svgWidth} height={svgHeight}>
          <SvgText {...textProps} fill="none" stroke={STROKE} strokeWidth={6} strokeLinejoin="round">
            {text}
          </SvgText>
          {!shine && (
            <SvgText {...textProps} fill="#FFFFFF">
              {text}
            </SvgText>
          )}
        </Svg>
        {shine && (
          <MaskedView
            style={[styles.shine, { width: svgWidth, height: svgHeight }]}
            maskElement={
              <Svg width={svgWidth} height={svgHeight}>
                <SvgText {...textProps} fill="#FFFFFF">
                  {text}
                </SvgText>
              </Svg>
            }
          >
            <Animated.View style={{ width: svgWidth * 3, height: svgHeight, transform: [{ translateX: sweepX }] }}>
              <LinearGradient colors={SHINE_COLORS} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </MaskedView>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
