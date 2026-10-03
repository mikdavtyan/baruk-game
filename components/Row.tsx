import { RefObject, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Tile, { GhostKind } from './Tile';
import { LetterState, TILE_REVEAL_STAGGER_MS, WORD_LENGTH } from '../constants/theme';
import {
  CELEBRATION_TILE_JUMP_HEIGHT,
  CELEBRATION_TILE_JUMP_MS,
  CELEBRATION_TILE_JUMP_STAGGER_MS,
  LOSS_SHAKE_DURATION_MS,
} from '../constants/winFlow';

export type RowData = {
  letters: string[]; // length WORD_LENGTH, '' for empty cells
  states: LetterState[]; // length WORD_LENGTH
};

type Props = RowData & {
  celebrate?: boolean; // this row just won — subtle scale pulse
  shake?: boolean; // this row was the final losing guess — subtle shake
  // The 6th row's own distinct "3 wiggles, 300ms" loss shake (Part 1) —
  // separate from `shake` above (used for invalid-word rejection too, which
  // must keep its own unrelated timing).
  lossShake?: boolean;
  tileSize?: number;
  // The next-input cursor position within this row — only set (non-null)
  // for the one row currently being typed; every other row gets null, which
  // also tells Tile "this isn't the in-progress row" for its border styling.
  activeIndex?: number | null;
  // The ghosts for this row, if any — Hint ghosts and, after a retry, the
  // letters carried over from the lost board; several can coexist. Only
  // meaningful for the in-progress row; Board only ever passes a non-empty
  // array there.
  ghostHints?: GhostHint[];
  // The active row's tile refs (measured for the Hint light's landing) and
  // the current Hint landing (which tile plays its entrance).
  cellRefs?: RefObject<View | null>[];
  hintLanding?: HintLanding | null;
};

export type HintLanding = { id: number; index: number };

export type GhostHint = { index: number; letter: string; kind: GhostKind };

export default function Row({
  letters,
  states,
  celebrate,
  shake,
  lossShake,
  tileSize,
  activeIndex = null,
  ghostHints = [],
  cellRefs,
  hintLanding = null,
}: Props) {
  const [shakeX] = useState(() => new Animated.Value(0));
  // The winning row's own tiles jump one after another — not a whole-row
  // pulse — so each tile gets its own translateY, staggered.
  const [jumps] = useState(() => Array.from({ length: WORD_LENGTH }, () => new Animated.Value(0)));

  useEffect(() => {
    if (!celebrate) return;
    Animated.stagger(
      CELEBRATION_TILE_JUMP_STAGGER_MS,
      jumps.map((jump) =>
        Animated.sequence([
          Animated.timing(jump, {
            toValue: 1,
            duration: CELEBRATION_TILE_JUMP_MS / 2,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(jump, {
            toValue: 0,
            duration: CELEBRATION_TILE_JUMP_MS / 2,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);

  useEffect(() => {
    if (!shake) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 4, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -4, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  }, [shake, shakeX]);

  // The loss's own "3 wiggles, 300ms" — 4 equal segments (right, left,
  // right, center), distinct from the invalid-word `shake` above so that
  // one's own timing stays untouched.
  useEffect(() => {
    if (!lossShake) return;
    const seg = LOSS_SHAKE_DURATION_MS / 4;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: seg, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: seg, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: seg, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: seg, useNativeDriver: true }),
    ]).start();
  }, [lossShake, shakeX]);


  const cells = Array.from({ length: WORD_LENGTH }, (_, i) => i);
  return (
    <Animated.View style={[styles.row, { transform: [{ translateX: shakeX }] }]}>
      {cells.map((i) => {
        const translateY = jumps[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -CELEBRATION_TILE_JUMP_HEIGHT],
        });
        return (
          <Animated.View key={i} style={{ transform: [{ translateY }] }}>
            <Tile
              letter={letters[i] ?? ''}
              state={states[i] ?? 'empty'}
              revealDelay={i * TILE_REVEAL_STAGGER_MS}
              size={tileSize}
              isCurrentRow={activeIndex !== null}
              isActiveCell={i === activeIndex}
              ghostLetter={ghostHints.find((g) => g.index === i)?.letter ?? null}
              ghostKind={ghostHints.find((g) => g.index === i)?.kind}
              cellRef={cellRefs?.[i]}
              ghostEntranceId={hintLanding?.index === i ? hintLanding.id : undefined}
            />
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
});
