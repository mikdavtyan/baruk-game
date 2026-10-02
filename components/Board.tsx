import { StyleSheet, View } from 'react-native';
import Row, { GhostHint, RowData } from './Row';
import { MAX_GUESSES } from '../constants/theme';

type Props = {
  rows: RowData[]; // should have length MAX_GUESSES
  celebrateRowIndex?: number | null; // row index to pulse (win)
  shakeRowIndex?: number | null; // row index to shake (final loss)
  lossShakeRowIndex?: number | null; // row index to play the loss's own "3 wiggles" (Part 1)
  tileSize?: number;
  activeRowIndex?: number | null; // Hint's ghosts only ever apply to this row
  activeCellIndex?: number | null; // next-input cursor position within activeRowIndex
  ghostHints?: GhostHint[];
};

export default function Board({
  rows,
  celebrateRowIndex = null,
  shakeRowIndex = null,
  lossShakeRowIndex = null,
  tileSize,
  activeRowIndex = null,
  activeCellIndex = null,
  ghostHints = [],
}: Props) {
  const padded = Array.from({ length: MAX_GUESSES }, (_, i) => rows[i]);
  return (
    <View style={styles.board}>
      {padded.map((row, i) => {
        const isActiveRow = i === activeRowIndex;
        return (
          <Row
            key={i}
            letters={row?.letters ?? []}
            states={row?.states ?? []}
            celebrate={i === celebrateRowIndex}
            shake={i === shakeRowIndex}
            lossShake={i === lossShakeRowIndex}
            tileSize={tileSize}
            activeIndex={isActiveRow ? activeCellIndex : null}
            ghostHints={isActiveRow ? ghostHints : []}
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
