import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { FONTS } from '../constants/theme';

type Props = {
  text: string;
  // Available width to fit within — defaults to the full window width (the
  // praise word's own case). Modal titles pass their own (narrower) content
  // width instead.
  width?: number;
  maxFontSize?: number;
  minFontSize?: number;
};

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
export default function OutlinedWord({ text, width, maxFontSize = DEFAULT_MAX_FONT_SIZE, minFontSize = DEFAULT_MIN_FONT_SIZE }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [pop] = useState(() => new Animated.Value(0));

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

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ scale }, { rotate }] }]}>
      <View style={styles.shadowWrap}>
        <Svg width={svgWidth} height={svgHeight}>
          <SvgText
            x={centerX}
            y={baselineY}
            textAnchor="middle"
            fontFamily={FONTS.tile}
            fontSize={fontSize}
            fontWeight="700"
            fill="none"
            stroke="#141414"
            strokeWidth={6}
            strokeLinejoin="round"
            textLength={needsClamp ? available : undefined}
            lengthAdjust={needsClamp ? 'spacingAndGlyphs' : undefined}
          >
            {text}
          </SvgText>
          <SvgText
            x={centerX}
            y={baselineY}
            textAnchor="middle"
            fontFamily={FONTS.tile}
            fontSize={fontSize}
            fontWeight="700"
            fill="#FFFFFF"
            textLength={needsClamp ? available : undefined}
            lengthAdjust={needsClamp ? 'spacingAndGlyphs' : undefined}
          >
            {text}
          </SvgText>
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
