import { memo, RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Row, { GhostHint, HintLanding, RowData } from './Row';
import { MAX_GUESSES } from '../constants/theme';

// Shared empty arrays: a fresh `[]` per render would defeat Row's memo.
const NO_GHOSTS: GhostHint[] = [];
const NO_CELLS: never[] = [];

type Props = {
  rows: RowData[]; // should have length MAX_GUESSES
  celebrateRowIndex?: number | null; // row index to pulse (win)
  shakeRowIndex?: number | null; // row index to shake (final loss)
  lossShakeRowIndex?: number | null; // row index to play the loss's own "3 wiggles" (Part 1)
  tileSize?: number;
  activeRowIndex?: number | null; // Hint's ghosts only ever apply to this row
  activeCellIndex?: number | null; // next-input cursor position within activeRowIndex
  ghostHints?: GhostHint[];
  activeCellRefs?: RefObject<View | null>[]; // the active row's tiles, for the Hint light's landing
  hintLanding?: HintLanding | null; // the Hint landing on the active row, if one is playing
};

function Board({
  rows,
  celebrateRowIndex = null,
  shakeRowIndex = null,
  lossShakeRowIndex = null,
  tileSize,
  activeRowIndex = null,
  activeCellIndex = null,
  ghostHints = NO_GHOSTS,
  activeCellRefs,
  hintLanding = null,
}: Props) {
  const padded = Array.from({ length: MAX_GUESSES }, (_, i) => rows[i]);
  return (
    <View style={styles.board}>
      {padded.map((row, i) => {
        const isActiveRow = i === activeRowIndex;
        return (
          <Row
            key={i}
            letters={row?.letters ?? NO_CELLS}
            states={row?.states ?? NO_CELLS}
            celebrate={i === celebrateRowIndex}
            shake={i === shakeRowIndex}
            lossShake={i === lossShakeRowIndex}
            tileSize={tileSize}
            activeIndex={isActiveRow ? activeCellIndex : null}
            ghostHints={isActiveRow ? ghostHints : NO_GHOSTS}
            cellRefs={isActiveRow ? activeCellRefs : undefined}
            hintLanding={isActiveRow ? hintLanding : null}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignItems: 'center',
  },
});

// Memoized: App re-renders on every keystroke (see the stable props there).
export default memo(Board);
