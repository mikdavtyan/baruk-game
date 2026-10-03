import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import KeyboardKey from './KeyboardKey';
import { LetterState } from '../constants/theme';
import { KeyStates } from '../lib/keyboardStates';
import { letterLabel } from '../lib/letterDisplay';

// Real Armenian phonetic keyboard layout (as opposed to alphabetical order).
// "ու" is one combined key, not two separate letters. "և" is not on the
// keyboard — it's not part of this game's alphabet. There is no Enter key —
// submitting a guess is the bottom ԸՆԴՈՒՆԵԼ button's job only (see
// components/BottomControls.tsx); both call the same App.tsx handler.
export const ROW_1 = ['է', 'թ', 'փ', 'ձ', 'ջ', 'ր', 'չ', 'ճ', 'ժ'];
export const ROW_2 = ['ք', 'ո', 'ե', 'ռ', 'տ', 'ու', 'ի', 'օ', 'պ', 'խ'];
export const ROW_3 = ['ա', 'ս', 'դ', 'ֆ', 'գ', 'հ', 'յ', 'կ', 'լ', 'ծ'];
export const ROW_4 = ['զ', 'ղ', 'ց', 'վ', 'բ', 'ն', 'մ', 'շ', 'ը'];

// Every letter token on the keyboard, in one flat list — e.g. for the Darts
// power-up to pick random targets from.
export const ALL_LETTER_TOKENS = [...ROW_1, ...ROW_2, ...ROW_3, ...ROW_4];

// Horizontal sizing. Rows 2–3 (10 letters each) span the full keyboard width;
// row 1 has 9 and comes out very slightly narrower, still centered.
// Row 4 fits 9 letters and a slightly wider Backspace into the same width,
// so its letter keys come out a bit narrower.
const KEY_GAP = 5; // horizontal space between keys (KeyboardKey uses half on each side)
const H_PADDING = 5; // plus half a gap, keys sit 7.5px from the screen edges
const MAX_KEYBOARD_WIDTH = 560; // keeps keys from growing huge on tablets
const BACKSPACE_UNITS = 1.3; // relative to a row-4 letter slot

// Vertical sizing, scaled with the screen within comfortable tap-size limits.
const KEY_HEIGHT_RATIO = 0.061;
const MIN_KEY_HEIGHT = 44;
const MAX_KEY_HEIGHT = 58;

// Letter font size follows the (row 1–3) key width, within 18–22px.
const LETTER_FONT_RATIO = 0.65;
const MIN_LETTER_FONT = 18;
const MAX_LETTER_FONT = 22;

type Props = {
  keyStates: KeyStates; // derived from submitted guesses (plus Darts reveals); missing keys are unused
  onKeyPress: (letter: string) => void;
  onBackspace: () => void;
  // Tokens Darts has eliminated — these keys use the slower, arrow-impact
  // color fade + a squash-bounce instead of the normal quick guess-scoring
  // fade (see KeyboardKey.tsx). Defaults to none for callers that don't care.
  dartsHitTokens?: string[];
};

const ROW_MARGIN_BOTTOM = 8; // must match styles.row.marginBottom below

export type KeyGeometry = { x: number; y: number; width: number; height: number };

// Where a given key token actually renders, in the SAME coordinate space
// Keyboard itself draws in (relative to its own top-left) — computed
// analytically from the exact layout math below rather than measured live,
// so ArrowOverlay (App.tsx measures the keyboard's own on-screen position
// once, then adds this offset) can aim real arrows at real keys without a
// ref per key. Keep this in sync with the render below if that layout ever
// changes.
export function computeKeyGeometry(token: string, windowWidth: number, windowHeight: number): KeyGeometry | null {
  const rows = [ROW_1, ROW_2, ROW_3, ROW_4];
  let rowIndex = -1;
  let colIndex = -1;
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].indexOf(token);
    if (c !== -1) {
      rowIndex = r;
      colIndex = c;
      break;
    }
  }
  if (rowIndex === -1) return null;

  const available = Math.min(windowWidth, MAX_KEYBOARD_WIDTH) - H_PADDING * 2;
  const letterSlot = available / 10;
  const row4Slot = available / (9 + BACKSPACE_UNITS);
  const keyHeight = Math.round(Math.min(MAX_KEY_HEIGHT, Math.max(MIN_KEY_HEIGHT, windowHeight * KEY_HEIGHT_RATIO)));

  const slot = rowIndex === 3 ? row4Slot : letterSlot;
  // Row 4's 9 letter keys + the wider backspace key exactly fill `available`
  // by construction (row4Slot = available / (9 + BACKSPACE_UNITS)), so it
  // never has a centering offset; rows 2–3 (10 keys @ letterSlot) also
  // exactly fill it. Only row 1 (9 keys @ letterSlot) comes out narrower
  // and gets centered — matches the comment in the layout constants above.
  const rowContentWidth = rowIndex === 3 ? available : rows[rowIndex].length * letterSlot;
  const startX = H_PADDING + (available - rowContentWidth) / 2;

  const x = startX + colIndex * slot + slot / 2;
  const y = rowIndex * (keyHeight + ROW_MARGIN_BOTTOM) + keyHeight / 2;

  return { x, y, width: slot - KEY_GAP, height: keyHeight };
}

// Constants, so the memoized keys see the same props every render.
const NO_TOKENS: string[] = [];
const BACKSPACE_ICON = { ios: 'delete.left', android: 'backspace', web: 'backspace' } as const;

function Keyboard({ keyStates, onKeyPress, onBackspace, dartsHitTokens = NO_TOKENS }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const available = Math.min(windowWidth, MAX_KEYBOARD_WIDTH) - H_PADDING * 2;
  const letterSlot = available / 10; // rows 1–3
  const row4Slot = available / (9 + BACKSPACE_UNITS);
  const keyHeight = Math.round(Math.min(MAX_KEY_HEIGHT, Math.max(MIN_KEY_HEIGHT, windowHeight * KEY_HEIGHT_RATIO)));
  const fontSize = Math.round(
    Math.min(MAX_LETTER_FONT, Math.max(MIN_LETTER_FONT, (letterSlot - KEY_GAP) * LETTER_FONT_RATIO)),
  );

  // One stable press handler per letter (onKeyPress itself is stable), so a
  // key re-renders only when its own state changes.
  const pressHandlers = useMemo(
    () => Object.fromEntries(ALL_LETTER_TOKENS.map((l) => [l, () => onKeyPress(l)])),
    [onKeyPress],
  );
  const stateFor = (letter: string): LetterState => keyStates[letter] ?? 'empty';
  const letterKey = (letter: string, slot: number) => (
    <KeyboardKey
      key={letter}
      label={letterLabel(letter)}
      state={stateFor(letter)}
      width={slot - KEY_GAP}
      height={keyHeight}
      fontSize={fontSize}
      onPress={pressHandlers[letter]}
      slowFade={dartsHitTokens.includes(letter)}
    />
  );

  return (
    <View style={styles.keyboard}>
      <View style={styles.row}>{ROW_1.map((l) => letterKey(l, letterSlot))}</View>
      <View style={styles.row}>{ROW_2.map((l) => letterKey(l, letterSlot))}</View>
      <View style={styles.row}>{ROW_3.map((l) => letterKey(l, letterSlot))}</View>
      <View style={styles.row}>
        {ROW_4.map((l) => letterKey(l, row4Slot))}
        <KeyboardKey
          label="Ջնջել"
          icon={BACKSPACE_ICON}
          width={row4Slot * BACKSPACE_UNITS - KEY_GAP}
          height={keyHeight}
          onPress={onBackspace}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No background or border: the page shows between the individual keys.
  keyboard: {
    width: '100%',
    paddingHorizontal: H_PADDING,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: ROW_MARGIN_BOTTOM,
  },
});

// Memoized: App re-renders on every keystroke (see the stable props there).
export default memo(Keyboard);
