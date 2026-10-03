import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, GestureResponderEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import KeyboardKey from './KeyboardKey';
import {
  BACKSPACE_REPEAT_DELAY_MS,
  BACKSPACE_REPEAT_INTERVAL_MS,
  LetterState,
} from '../constants/theme';
import { triggerKeyHaptic } from '../lib/haptics';
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

// The view that receives every keyboard touch (see the input model below),
// and the Backspace key's accessibility label.
export const KEYBOARD_TOUCH_SURFACE_ID = 'keyboard-touch-surface';
export const BACKSPACE_LABEL = 'Ջնջել';

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
  // Every row is centered in the keyboard (which spans the window). Row 4's
  // 9 letter keys + the wider backspace key exactly fill `available` by
  // construction (row4Slot = available / (9 + BACKSPACE_UNITS)), and rows 2–3
  // (10 keys @ letterSlot) do too; row 1 (9 keys) comes out narrower. Up to
  // MAX_KEYBOARD_WIDTH that's H_PADDING from the edge; on a wider window
  // (tablet) the whole keyboard sits centered.
  const rowContentWidth = rowIndex === 3 ? available : rows[rowIndex].length * letterSlot;
  const startX = (windowWidth - rowContentWidth) / 2;

  const x = startX + colIndex * slot + slot / 2;
  const y = rowIndex * (keyHeight + ROW_MARGIN_BOTTOM) + keyHeight / 2;

  return { x, y, width: slot - KEY_GAP, height: keyHeight };
}

// The Backspace key's geometry, in the same space as computeKeyGeometry: the
// last slot of row 4, BACKSPACE_UNITS row-4 slots wide.
export function computeBackspaceGeometry(windowWidth: number, windowHeight: number): KeyGeometry {
  const last = computeKeyGeometry(ROW_4[ROW_4.length - 1], windowWidth, windowHeight)!;
  const slot = last.width + KEY_GAP;
  const x = last.x + slot / 2 + (slot * BACKSPACE_UNITS) / 2;
  return { x, y: last.y, width: slot * BACKSPACE_UNITS - KEY_GAP, height: last.height };
}

// Which key a touch at (x, y) — in the keyboard's own coordinates — means:
// the nearest row, then the nearest key center in that row. So the gaps
// between keys (and between rows) hit their nearest key too: every point of
// the keyboard is a target. Uses the same analytic geometry as Darts.
const BACKSPACE = '\u232B'; // the hit-test's (and pressed-state map's) name for Backspace
const KEY_ROWS = [ROW_1, ROW_2, ROW_3, ROW_4];
export function hitTestKey(x: number, y: number, windowWidth: number, windowHeight: number): string {
  const centers = (row: number) => {
    const keys = KEY_ROWS[row].map((token) => {
      const g = computeKeyGeometry(token, windowWidth, windowHeight)!;
      return { token, x: g.x, y: g.y };
    });
    if (row === 3) keys.push({ token: BACKSPACE, ...computeBackspaceGeometry(windowWidth, windowHeight) });
    return keys;
  };
  const nearest = <T,>(items: T[], distance: (item: T) => number) =>
    items.reduce((best, item) => (distance(item) < distance(best) ? item : best));
  const row = nearest([0, 1, 2, 3], (r) => Math.abs(centers(r)[0].y - y));
  return nearest(centers(row), (k) => Math.abs(k.x - x)).token;
}

// Constants, so the memoized keys see the same props every render.
const NO_TOKENS: string[] = [];
const BACKSPACE_ICON = { ios: 'delete.left', android: 'backspace', web: 'backspace' } as const;

// Input model. Keys have no touch handling of their own: every finger lands
// on the keyboard's one surface (pointerEvents box-only), so several fingers
// register at once — separate Pressables would let RN's responder system give
// the touch to only one of them. Each touch is hit-tested (hitTestKey) and
// fires on TOUCH DOWN: the letter appears at once, and a finger that slides
// a little can't cancel it. Its key shows pressed until that finger lifts.
// Holding Backspace repeats. Positions are the touch's location within the
// surface itself (every touch targets it), so they stay right after any
// layout change or resize. With a screen reader on, touches are ignored and
// each key is activated through its accessibility action instead.
function Keyboard({ keyStates, onKeyPress, onBackspace, dartsHitTokens = NO_TOKENS }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // One press value per key (0 = up, 1 = pressed), driven here directly —
  // a press never re-renders anything.
  const [pressValues] = useState(() =>
    Object.fromEntries([...ALL_LETTER_TOKENS, BACKSPACE].map((k) => [k, new Animated.Value(0)])),
  );
  const fingersRef = useRef(new Map<number, string>()); // touch identifier -> key
  const repeatRef = useRef<{ finger: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const screenReaderRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        if (mounted) screenReaderRef.current = on;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on: boolean) => {
      screenReaderRef.current = on;
    });
    const repeat = repeatRef;
    return () => {
      mounted = false;
      sub.remove();
      if (repeat.current) clearTimeout(repeat.current.timer);
    };
  }, []);

  const stopRepeat = () => {
    if (repeatRef.current) clearTimeout(repeatRef.current.timer);
    repeatRef.current = null;
  };
  const deleteOnce = () => {
    triggerKeyHaptic();
    onBackspace();
  };
  const handleTouchStart = (e: GestureResponderEvent) => {
    if (screenReaderRef.current) return;
    for (const touch of e.nativeEvent.changedTouches) {
      const key = hitTestKey(touch.locationX, touch.locationY, windowWidth, windowHeight);
      fingersRef.current.set(Number(touch.identifier), key);
      // Pressed and released instantly, like a system keyboard — no animation.
      pressValues[key].setValue(1);
      if (key === BACKSPACE) {
        deleteOnce();
        stopRepeat();
        const finger = Number(touch.identifier);
        const tick = (delay: number) => {
          repeatRef.current = {
            finger,
            timer: setTimeout(() => {
              deleteOnce();
              tick(BACKSPACE_REPEAT_INTERVAL_MS);
            }, delay),
          };
        };
        tick(BACKSPACE_REPEAT_DELAY_MS);
      } else {
        triggerKeyHaptic();
        onKeyPress(key);
      }
    }
  };
  const handleTouchEnd = (e: GestureResponderEvent) => {
    for (const touch of e.nativeEvent.changedTouches) {
      const finger = Number(touch.identifier);
      const key = fingersRef.current.get(finger);
      if (key === undefined) continue;
      fingersRef.current.delete(finger);
      if (repeatRef.current?.finger === finger) stopRepeat();
      // Another finger may still hold the same key.
      if (![...fingersRef.current.values()].includes(key)) pressValues[key].setValue(0);
    }
  };

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
      pressProgress={pressValues[letter]}
      slowFade={dartsHitTokens.includes(letter)}
    />
  );

  return (
    <View
      testID={KEYBOARD_TOUCH_SURFACE_ID}
      style={styles.keyboard}
      pointerEvents="box-only"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <View style={styles.row}>{ROW_1.map((l) => letterKey(l, letterSlot))}</View>
      <View style={styles.row}>{ROW_2.map((l) => letterKey(l, letterSlot))}</View>
      <View style={styles.row}>{ROW_3.map((l) => letterKey(l, letterSlot))}</View>
      <View style={styles.row}>
        {ROW_4.map((l) => letterKey(l, row4Slot))}
        <KeyboardKey
          label={BACKSPACE_LABEL}
          icon={BACKSPACE_ICON}
          width={row4Slot * BACKSPACE_UNITS - KEY_GAP}
          height={keyHeight}
          onPress={onBackspace}
          pressProgress={pressValues[BACKSPACE]}
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
