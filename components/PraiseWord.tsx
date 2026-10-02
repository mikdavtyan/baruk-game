import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import OutlinedWord from './OutlinedWord';
import { PRAISE_FLIP_DURATION_MS } from '../constants/winFlow';

type Point = { x: number; y: number };

type Props = {
  text: string;
  // Screen-space center to pop in at (over the board) — only its `y` is used
  // for vertical placement; the word is always horizontally centered on
  // screen (see OutlinedWord), never at `from.x`.
  from: Point;
  // Non-null once the reward modal should take over this element — triggers
  // the FLIP glide from `from` to `to`. The word is one continuous element
  // throughout (never remounted), so it visibly glides rather than swaps.
  flipTo: Point | null;
};

const MAX_FONT_SIZE = 44;
const SIDE_MARGIN = 24;
const GLYPH_WIDTH_EM = 0.66; // see OutlinedWord — only used here to place the sparkles

// A tiny 4-point sparkle (two crossed bars) that twinkles in place —
// scale 0 -> 1 -> 0, looped, each with its own start delay so the three
// around the word don't blink in unison.
function Sparkle({ x, y, delay, size = 8 }: { x: number; y: number; delay: number; size?: number }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(1100),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scale = anim;
  return (
    <Animated.View pointerEvents="none" style={[styles.sparkleWrap, { left: x, top: y, opacity: anim, transform: [{ scale }] }]}>
      <View style={[styles.sparkleArm, { width: size, height: Math.max(1.5, size * 0.22) }]} />
      <View style={[styles.sparkleArm, { height: size, width: Math.max(1.5, size * 0.22) }]} />
    </Animated.View>
  );
}

// The win-only praise word: OutlinedWord (the shared stroke+fill+pop text)
// plus three twinkling sparkles, positioned full-width over the board and
// able to glide (FLIP) into the reward modal's praise slot.
export default function PraiseWord({ text, from, flipTo }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [flip] = useState(() => new Animated.Value(0)); // 0 = at `from`, 1 = at `to`

  useEffect(() => {
    if (!flipTo) return;
    Animated.timing(flip, {
      toValue: 1,
      duration: PRAISE_FLIP_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipTo]);

  // The container spans the full screen width and is always centered — the
  // flip target's x is expressed relative to that same center, not to
  // `from.x` (which this component deliberately doesn't position itself at
  // horizontally).
  const screenCenterX = windowWidth / 2;
  const translateX = flipTo ? flip.interpolate({ inputRange: [0, 1], outputRange: [0, flipTo.x - screenCenterX] }) : 0;
  const translateY = flipTo ? flip.interpolate({ inputRange: [0, 1], outputRange: [0, flipTo.y - from.y] }) : 0;

  // A rough estimate purely to place the sparkles near the word's edges —
  // OutlinedWord computes the real font size itself independently; this only
  // needs to be approximately right.
  const maxTextWidth = windowWidth - SIDE_MARGIN * 2;
  const approxFontSize = Math.min(MAX_FONT_SIZE, maxTextWidth / (text.length * GLYPH_WIDTH_EM));
  const approxWidth = Math.min(maxTextWidth, text.length * GLYPH_WIDTH_EM * approxFontSize);
  const svgHeight = approxFontSize * 1.8;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        {
          top: from.y - svgHeight * 0.55,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    >
      <Sparkle x={screenCenterX - approxWidth / 2 - 16} y={svgHeight * 0.12} delay={0} size={9} />
      <Sparkle x={screenCenterX + approxWidth / 2 + 4} y={svgHeight * 0.5} delay={450} size={7} />
      <Sparkle x={screenCenterX - 5} y={-6} delay={900} size={8} />
      <OutlinedWord text={text} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
  },
  sparkleWrap: {
    position: 'absolute',
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleArm: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: '#FFD95A',
  },
});
