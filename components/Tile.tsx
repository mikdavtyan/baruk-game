import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FONT_LINE_HEIGHT_EM,
  FONTS,
  LetterState,
  NEUTRAL_TILE_BG,
  NEUTRAL_TILE_EDGE,
  NEUTRAL_TILE_TEXT,
  TILE_FLIP_DURATION_MS,
  TILE_SHINE_DURATION_MS,
  TOKEN_POP_DURATION_MS,
  TOKEN_POP_SCALE,
} from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { ColorFn, useTheme } from '../lib/ThemeContext';

type Props = {
  letter: string;
  state: LetterState;
  revealDelay?: number; // ms to wait before flipping when a result arrives
  size?: number; // tile width/height in px, computed from the available space
  isCurrentRow?: boolean; // this tile belongs to the in-progress guess row
  isActiveCell?: boolean; // this exact tile is the next-input cursor position
  // A ghost letter for this slot (a Hint, or after a retry a letter already
  // found green) — a preview the player can type straight over. Only shown
  // while this tile has no real letter of its own, so backspace brings it back.
  ghostLetter?: string | null;
  // Which ghost it is, so the player can tell them apart at a glance:
  // 'hint' — a pale green letter (a Hint showed it);
  // 'carried' — found green before the retry ("I found this"): the letter at
  // full strength in the correct green, inside a correct-green outline. Not a
  // fill, so it never reads as a scored tile; never yellow.
  ghostKind?: GhostKind;
};

export type GhostKind = 'hint' | 'carried';

// GHEA Grapalat capitals are 0.765em tall, so 0.58 x tile size gives capitals ~44% of the tile.
const LETTER_SIZE_RATIO = 0.58;
const CORNER_RATIO = 0.24;
const TILE_BORDER_WIDTH = 3;
const TILE_MARGIN = 4;
const GHOST_OPACITY = 0.4;

// 'neutral' behaves like a scored tile for rendering purposes (no border,
// flips in) even though it isn't a real correct/present/absent result — the
// loss result's revealed-answer tiles (see constants/theme.ts).
const isResult = (s: LetterState) => s === 'correct' || s === 'present' || s === 'absent' || s === 'neutral';

// Background + letter color for a given (painted) state, read through
// `color()` (not `theme.X` directly), like every themed color. A submitted (scored) tile is a solid, colorful fill with a white
// letter — readable on every state's color (including present's amber) via
// the text-shadow applied below, not via picking a different text color per
// state, so 'white' is a plain constant, not itself something to animate. An
// unsubmitted tile (empty or mid-typing) has no fill at all — just its
// border — so `bg` is the plain constant 'transparent' for those too.
function tileColors(state: LetterState, color: ColorFn, textColor: ColorFn) {
  if (state === 'correct') return { bg: color('correct'), text: '#ffffff' };
  if (state === 'present') return { bg: color('present'), text: '#ffffff' };
  if (state === 'absent') return { bg: color('absent'), text: '#ffffff' };
  if (state === 'neutral') return { bg: NEUTRAL_TILE_BG, text: NEUTRAL_TILE_TEXT };
  return { bg: 'transparent', text: textColor('typedLetter') }; // empty / filled
}

export default function Tile({
  letter,
  state,
  revealDelay = 0,
  size = 56,
  isCurrentRow = false,
  ghostLetter = null,
  ghostKind = 'hint',
}: Props) {
  const { theme, color, textColor, reduceMotion } = useTheme();
  const [rotation] = useState(() => new Animated.Value(0)); // 0 = flat, 1 = edge-on
  // The state actually painted. When a scored result arrives it lags behind
  // `state` until the flip reaches its halfway point, so the color is never
  // visible before the tile turns.
  const [shownState, setShownState] = useState(state);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    // Only a fresh result (typed tile -> scored tile) is revealed with a flip;
    // typing, backspace and New Game resets update immediately.
    if (!(isResult(state) && !isResult(prevState))) setShownState(state);
  }

  useEffect(() => {
    if (!isResult(state) || shownState === state) return;
    const half = TILE_FLIP_DURATION_MS / 2;
    const flipIn = Animated.sequence([
      Animated.delay(revealDelay),
      Animated.timing(rotation, {
        toValue: 1,
        duration: half,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    flipIn.start(({ finished }) => {
      if (!finished) return;
      setShownState(state); // tile is edge-on here, so the color swap is hidden
      Animated.timing(rotation, {
        toValue: 0,
        duration: half,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      flipIn.stop();
      rotation.setValue(0);
    };
    // Only a change of the incoming state should (re)start a reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Typing pops the new letter in (scale only, on the native driver);
  // deleting is instant — no exit animation, so fast deletes can never leave
  // a fading letter behind.
  const [tokenScale] = useState(() => new Animated.Value(1));
  const lastLetterRef = useRef(letter);
  useEffect(() => {
    const prevLetter = lastLetterRef.current;
    lastLetterRef.current = letter;
    if (letter === '' || letter === prevLetter) return;
    tokenScale.setValue(1);
    const pop = Animated.sequence([
      Animated.timing(tokenScale, {
        toValue: TOKEN_POP_SCALE,
        duration: TOKEN_POP_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(tokenScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]);
    pop.start();
    return () => pop.stop();
  }, [letter, tokenScale]);

  // One white shine sweep across a ghost tile, only when its row becomes the
  // active one — never on typing, backspace or a new Hint. Deliberately no
  // fill color change: yellow means "wrong position" in this game. At rest
  // (0) the bar sits fully outside the tile, which clips it; it's reset to 0
  // when the sweep ends.
  const [shine] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!isCurrentRow || !ghostLetter || reduceMotion) return;
    shine.setValue(0);
    const sweep = Animated.timing(shine, {
      toValue: 1,
      duration: TILE_SHINE_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    sweep.start(() => shine.setValue(0));
    return () => {
      sweep.stop();
      shine.setValue(0);
    };
    // Deliberately not keyed on ghostLetter: a Hint added mid-row, typing
    // and backspace never replay the sweep — only the row becoming active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentRow, reduceMotion, shine]);
  const shineTranslateX = shine.interpolate({ inputRange: [0, 1], outputRange: [-size, size * 1.3] });

  const colors = tileColors(shownState, color, textColor);
  const fontSize = size * LETTER_SIZE_RATIO;
  const rotateX = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  // What the tile shows is derived from its props on every render: a typed
  // letter (ink, even if it matches the ghost — green only comes with the
  // flip reveal), else a ghost, else nothing. The ghost is its own static
  // layer, never animated, so it looks identical every time.
  const showGhost = letter === '' && !!ghostLetter;

  // Border: scored tiles are flat fills (no outline). Every other tile is
  // transparent with just an outline — tileActiveBorder for every tile in
  // the row currently being typed, tileBorder for every other (not yet
  // reached) row. A just-submitted tile is no longer in the current row but
  // keeps its active, filled look until its own flip reaches 90° (a later
  // tile in the row waits up to 400ms for its turn).
  const scored = isResult(shownState);
  const awaitingFlip = isResult(state) && !scored;
  const borderWidth = scored ? 0 : TILE_BORDER_WIDTH;
  const borderColor = scored
    ? colors.bg
    : showGhost && ghostKind === 'carried'
      ? color('correct')
      : isCurrentRow || awaitingFlip
      ? color('tileActiveBorder')
      : color('tileBorder');

  const radius = Math.round(size * CORNER_RATIO);

  return (
    // Split into nested layers on purpose: RN's Animated can't mix a
    // native-driven animation (this outer view's flip rotateX; the letter's
    // pop scale below) with a JS-driven one (the letter's themed color, via
    // `textColor()`) on the *same* node — doing so throws "Style property ...
    // is not supported by native animated module" and breaks the native-driven
    // one. So each layer here carries only one kind. (The fill/border layer's
    // themed `color()`s are native-driven, like the flip.)
    <Animated.View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius },
        { transform: [{ perspective: 600 }, { rotateX }] },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: colors.bg, borderWidth, borderColor }]}
      />
      {/* The loss result's revealed-answer tiles get a small 3D bottom edge
          (a plain static strip, not animated — these tiles are display-only,
          never pressed) that every other tile state doesn't have. */}
      {state === 'neutral' && (
        <View
          pointerEvents="none"
          style={[
            styles.neutralEdge,
            {
              height: Math.max(3, Math.round(size * 0.07)),
              borderBottomLeftRadius: radius,
              borderBottomRightRadius: radius,
            },
          ]}
        />
      )}
      {showGhost && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
          <Animated.View
            style={[styles.shine, { width: size * 0.45, transform: [{ translateX: shineTranslateX }, { rotate: '20deg' }] }]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      )}
      {showGhost && ghostKind === 'hint' && (
        <View testID="ghost-hint" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, styles.ghost]}>
          <Text style={[styles.letter, { fontSize, lineHeight: fontSize * FONT_LINE_HEIGHT_EM, color: theme.correct }]}>
            {letterLabel(ghostLetter!)}
          </Text>
        </View>
      )}
      {showGhost && ghostKind === 'carried' && (
        <View testID="ghost-carried" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <Animated.Text
            style={[styles.letter, { fontSize, lineHeight: fontSize * FONT_LINE_HEIGHT_EM, color: textColor('correct') }]}
          >
            {letterLabel(ghostLetter!)}
          </Animated.Text>
        </View>
      )}
      {letter !== '' && (
        <Animated.View style={{ transform: [{ scale: tokenScale }] }}>
          <Animated.Text
            style={[
              styles.letter,
              scored && styles.scoredLetter,
              { fontSize, lineHeight: fontSize * FONT_LINE_HEIGHT_EM, color: colors.text },
            ]}
          >
            {letterLabel(letter)}
          </Animated.Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginHorizontal: TILE_MARGIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    opacity: GHOST_OPACITY,
  },
  letter: {
    fontFamily: FONTS.tile,
    includeFontPadding: false, // Android: use the font's real ascent/descent so centering matches iOS
  },
  // A submitted tile's white letter gets a soft shadow so it stays readable
  // against every state's fill color, present's amber included.
  scoredLetter: {
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  neutralEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: NEUTRAL_TILE_EDGE,
  },
  shine: {
    position: 'absolute',
    top: '-30%',
    bottom: '-30%',
  },
});
