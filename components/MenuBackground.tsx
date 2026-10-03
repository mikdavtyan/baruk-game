import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { FONTS, MENU_BG_TILE_BORDER, MENU_BG_TILE_CORNER_RATIO, MENU_BG_TILES } from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { useTheme } from '../lib/ThemeContext';

// The menu's calm background: a few very faint letter tiles (board-tile
// style) drifting slowly upward with a slight rotation, each at its own pace
// (MENU_BG_TILES), looping seamlessly — a tile leaves above the screen and
// comes back below it.
//
// Performance: every tile is pre-mounted; each one's position is a native
// Animated.loop of a 0→1 `clock` (transform only: translateY + rotate), so
// there's no JS work per frame and no setState. A tile's place in its climb
// is (clock + offset) mod 1: pausing records where the clock stopped into
// `offset` and resets the clock, so resuming continues from the same spot.
// The loops run only while `paused` is false (no page over the menu) and the
// app is in the foreground. Reduced motion: the tiles stay where they start.
function MenuBackground({ paused }: { paused: boolean }) {
  const { color, textColor, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const [appActive, setAppActive] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const [tiles] = useState(() =>
    MENU_BG_TILES.map((tile) => ({ clock: new Animated.Value(0), offset: new Animated.Value(tile.phase) })),
  );
  const offsetsRef = useRef(MENU_BG_TILES.map((tile) => tile.phase)); // the offsets' JS-side values
  const nodes = useMemo(
    () =>
      tiles.map(({ clock, offset }, i) => {
        const { size, rotateFrom, rotateTo } = MENU_BG_TILES[i];
        const progress = Animated.modulo(Animated.add(clock, offset), 1);
        return {
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height + size, -size * 1.5] }),
          rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [`${rotateFrom}deg`, `${rotateTo}deg`] }),
        };
      }),
    [tiles, height],
  );

  const running = !paused && appActive && !reduceMotion;
  useEffect(() => {
    if (!running) return;
    const loops = tiles.map(({ clock }, i) =>
      Animated.loop(
        Animated.timing(clock, { toValue: 1, duration: MENU_BG_TILES[i].periodMs, easing: Easing.linear, useNativeDriver: true }),
      ),
    );
    loops.forEach((loop) => loop.start());
    const offsets = offsetsRef.current;
    return () => {
      loops.forEach((loop) => loop.stop());
      tiles.forEach(({ clock, offset }, i) =>
        clock.stopAnimation((value) => {
          offsets[i] = (offsets[i] + value) % 1;
          offset.setValue(offsets[i]);
          clock.setValue(0);
        }),
      );
    };
  }, [running, tiles]);

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {MENU_BG_TILES.map((tile, i) => {
        const scored = tile.kind !== 'empty';
        return (
          <Animated.View
            key={i}
            testID="menu-bg-tile"
            style={[
              styles.tile,
              {
                left: tile.x * width - tile.size / 2,
                width: tile.size,
                height: tile.size,
                borderRadius: Math.round(tile.size * MENU_BG_TILE_CORNER_RATIO),
                opacity: tile.opacity,
                backgroundColor: scored ? color(tile.kind as 'correct' | 'present') : 'transparent',
                borderColor: scored ? 'transparent' : color('tileBorder'),
                transform: [{ translateY: nodes[i].translateY }, { rotate: nodes[i].rotate }],
              },
            ]}
          >
            <Animated.Text
              style={[
                styles.letter,
                { fontSize: Math.round(tile.size * 0.58), color: scored ? '#FFFFFF' : textColor('typedLetter') },
              ]}
              allowFontScaling={false}
            >
              {letterLabel(tile.token)}
            </Animated.Text>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

export default memo(MenuBackground);

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    top: 0,
    borderWidth: MENU_BG_TILE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: FONTS.tile,
    includeFontPadding: false,
  },
});
