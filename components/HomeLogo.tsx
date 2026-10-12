import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import {
  DISPLAY_LINE_HEIGHT_EM,
  FONTS,
  HOME_LOGO_DROP_STAGGER_MS,
  HOME_LOGO_FLOAT_LIFT,
  HOME_LOGO_FLOAT_MS,
  HOME_LOGO_FLOAT_PHASE,
  HOME_TAGLINE_DELAY_MS,
  HOME_TAGLINE_MS,
  KEY_EDGE_HEIGHT,
} from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { useTheme } from '../lib/ThemeContext';
import { useLoopWhile } from '../lib/useLoopWhile';

// The game's name, drawn as board tiles: Բ Ա Ռ ՈՒ Կ (5 tokens).
const TOKENS = ['բ', 'ա', 'ռ', 'ու', 'կ'];
const STATES = ['correct', 'present', 'correct', 'present', 'correct'] as const;
const EDGES = ['correctEdge', 'presentEdge', 'correctEdge', 'presentEdge', 'correctEdge'] as const;
const TILE_WIDTH = 50;
const TILE_HEIGHT = 56;
const LETTER_SIZE = 28;
const LETTER_SIZE_DIGRAPH = 20; // ՈՒ is two letters wide
const TAGLINE = 'ԲԱՌԵՐԻ ԽԱՂ';
// A sine wave sampled for `interpolate` (one float cycle: rest → up → rest).
const WAVE_IN = Array.from({ length: 13 }, (_, i) => i / 12);
const WAVE_OUT = WAVE_IN.map((t) => -HOME_LOGO_FLOAT_LIFT * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)));

// Home's logo: five candy tiles in the display font and the tagline. With
// `intro` the tiles drop in with a spring one after another and the tagline
// fades up (the first time Home appears per launch); while `running` they
// float in a gentle staggered wave (one native loop of a 0→1 clock, each tile
// a phase behind the one before). Transform/opacity only, native driver.
function HomeLogo({ intro, running }: { intro: boolean; running: boolean }) {
  const { color } = useTheme();
  const [drops] = useState(() => TOKENS.map(() => new Animated.Value(intro ? 0 : 1)));
  const [tagline] = useState(() => new Animated.Value(intro ? 0 : 1));
  const [clock] = useState(() => new Animated.Value(0));
  const [nodes] = useState(() =>
    drops.map((drop, i) => ({
      dropY: drop.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }),
      rotate: drop.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }),
      scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
      opacity: drop.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
      floatY: Animated.modulo(Animated.add(clock, i * HOME_LOGO_FLOAT_PHASE), 1).interpolate({
        inputRange: WAVE_IN,
        outputRange: WAVE_OUT,
      }),
    })),
  );
  const [taglineY] = useState(() => tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }));

  useEffect(() => {
    if (!intro) return;
    const drop = Animated.stagger(
      HOME_LOGO_DROP_STAGGER_MS,
      drops.map((v) => Animated.spring(v, { toValue: 1, friction: 5, tension: 55, useNativeDriver: true })),
    );
    const fade = Animated.timing(tagline, {
      toValue: 1,
      duration: HOME_TAGLINE_MS,
      delay: HOME_TAGLINE_DELAY_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    drop.start();
    fade.start();
    return () => {
      drop.stop();
      fade.stop();
      drops.forEach((v) => v.setValue(1));
      tagline.setValue(1);
    };
  }, [intro, drops, tagline]);

  useLoopWhile(
    running,
    () => Animated.loop(Animated.timing(clock, { toValue: 1, duration: HOME_LOGO_FLOAT_MS, easing: Easing.linear, useNativeDriver: true })),
    () => clock.setValue(0),
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.title} accessible accessibilityRole="header" accessibilityLabel="ԲԱՌՈՒԿ">
        {TOKENS.map((token, i) => (
          <Animated.View
            key={token}
            style={[
              styles.tile,
              { backgroundColor: color(EDGES[i]) },
              i % 2 === 1 && styles.tileLow,
              {
                opacity: nodes[i].opacity,
                transform: [
                  { translateY: nodes[i].dropY },
                  { translateY: nodes[i].floatY },
                  { rotate: nodes[i].rotate },
                  { scale: nodes[i].scale },
                ],
              },
            ]}
          >
            <Animated.View style={[styles.face, { backgroundColor: color(STATES[i]) }]}>
              <Animated.Text
                style={[styles.letter, token === 'ու' && styles.letterDigraph]}
                allowFontScaling={false}
              >
                {letterLabel(token)}
              </Animated.Text>
            </Animated.View>
          </Animated.View>
        ))}
      </View>
      <Animated.Text
        style={[styles.tagline, { color: color('textMuted'), opacity: tagline, transform: [{ translateY: taglineY }] }]}
      >
        {TAGLINE}
      </Animated.Text>
    </View>
  );
}

export default memo(HomeLogo);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  title: {
    flexDirection: 'row',
    gap: 7,
    height: TILE_HEIGHT + 14,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 14,
  },
  // Alternate tiles sit lower: a playful, hand-placed row.
  tileLow: {
    marginTop: 14,
  },
  // The face over its darker bottom edge, like a key.
  face: {
    height: TILE_HEIGHT - KEY_EDGE_HEIGHT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: FONTS.display,
    fontSize: LETTER_SIZE,
    lineHeight: Math.round(LETTER_SIZE * DISPLAY_LINE_HEIGHT_EM),
    color: '#FFFFFF', // white on scored tiles, in both themes
    includeFontPadding: false,
  },
  letterDigraph: {
    fontSize: LETTER_SIZE_DIGRAPH,
    lineHeight: Math.round(LETTER_SIZE_DIGRAPH * DISPLAY_LINE_HEIGHT_EM),
  },
  tagline: {
    marginTop: 14,
    fontFamily: FONTS.title,
    fontSize: 12,
    letterSpacing: 4,
  },
});
