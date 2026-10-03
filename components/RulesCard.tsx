import { ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Platform, StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import BowIcon from './BowIcon';
import Tile from './Tile';
import { FONTS, KEY_EDGE_HEIGHT, LetterState, RULES_TILE_REVEAL_STAGGER_MS, TILE_FLIP_DURATION_MS } from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { useTheme } from '../lib/ThemeContext';

// The rules themselves — the body of the "How to play" popup (RulesModal.tsx
// draws the panel, title and close button around it).
type Props = {
  // Bumped once the popup's open animation actually finishes, so the three
  // example rows' colored tile only flips in afterward — never while (or
  // before) the popup itself is still appearing.
  revealTrigger: number;
  // Whether the popup is open right now. Used only to snap the example tiles
  // back to neutral the instant this goes false (closing) or true (a fresh
  // open is about to start) — never to animate anything itself.
  visible: boolean;
};

const BADGE_SIZE = 36;
const HINT_BADGE_SIZE = 44;
const EXAMPLE_TILE_GAP = 4; // matches Tile's own marginHorizontal (4px each side = 8px between)
const DEFAULT_TILE_SIZE = 40;
const MIN_TILE_SIZE = 26;

// A caption/hint string as a sequence of plain vs. bold segments — the RN
// equivalent of wrapping part of the text in <strong>: nested Text spans,
// which (like <strong> inline in a paragraph) still wrap and lay out as one
// continuous run of text.
type TextPart = { text: string; bold?: boolean };

type Example = {
  tokens: string[];
  highlightIndex: number;
  state: Extract<LetterState, 'correct' | 'present' | 'absent'>;
  caption: TextPart[];
};

const EXAMPLES: Example[] = [
  {
    tokens: ['խ', 'ն', 'ձ', 'ո', 'ր'],
    highlightIndex: 0,
    state: 'correct',
    caption: [{ text: 'Խ', bold: true }, { text: ' ՏԱՌԸ ԲԱՌԻ ՃԻՇՏ ՏԵՂՈՒՄ Է' }],
  },
  {
    tokens: ['պ', 'ա', 'ն', 'ի', 'ր'],
    highlightIndex: 1,
    state: 'present',
    caption: [{ text: 'Ա', bold: true }, { text: ' ՏԱՌԸ ԲԱՌԻ ՄԵՋ ԿԱ, ԲԱՅՑ ՃԻՇՏ ՏԵՂՈՒՄ ՉԷ' }],
  },
  {
    tokens: ['գ', 'ա', 'ր', 'ու', 'ն'],
    highlightIndex: 3,
    state: 'absent',
    caption: [{ text: 'ՈՒ', bold: true }, { text: ' ՏԱՌԸ ԲԱՌԻ ՄԵՋ ՉԿԱ' }],
  },
];

const HINT_ROWS: { icon: 'search' | 'bow'; caption: TextPart[] }[] = [
  {
    icon: 'search',
    caption: [{ text: 'ՕԳՏԱԳՈՐԾԵՔ ' }, { text: '«ՀՈՒՇՈՒՄ»', bold: true }, { text: ' ՄԵԿ ՃԻՇՏ ՏԱՌ ԲԱՑԵԼՈՒ ՀԱՄԱՐ' }],
  },
  {
    icon: 'bow',
    caption: [{ text: 'ՕԳՏԱԳՈՐԾԵՔ ' }, { text: '«ՆԵՏ»', bold: true }, { text: ' ԵՐԵՔ ՍԽԱԼ ՏԱՌ ՀԵՌԱՑՆԵԼՈՒ ՀԱՄԱՐ' }],
  },
];

// A static, non-pressable copy of PowerUpButton's filled-circle-with-3D-edge
// look, scaled down — for the two hint-row badges. Not a Pressable at all
// (these icons are inert here, per the "no hint logic or animation" note).
// Deliberately keeps the general app `keyBackground`/`keyEdge` look (not the
// panel's own palette) — it's meant to read as a real in-game button.
function StaticBadge({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.hintBadge}>
      <Animated.View
        pointerEvents="none"
        style={[styles.hintBadgeFill, { backgroundColor: color('keyBackground'), borderBottomColor: color('keyEdge') }]}
      />
      {children}
    </View>
  );
}

// A plain, solidly-filled example tile — the panel's own neutral look, not
// the real board's (transparent) unsubmitted-tile look. The one highlighted
// tile per row is the real Tile component instead, in the real game color.
function NeutralTile({ letter, size }: { letter: string; size: number }) {
  const { color, textColor } = useTheme();
  return (
    <Animated.View
      style={[
        styles.neutralTile,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          backgroundColor: color('popupTileFill'),
          borderColor: color('popupTileBorder'),
        },
      ]}
    >
      <Animated.Text style={[styles.neutralTileText, { fontSize: size * 0.5, color: textColor('popupTileText') }]}>
        {letter}
      </Animated.Text>
    </Animated.View>
  );
}

function ExampleRow({ example, revealed }: { example: Example; revealed: boolean }) {
  const [tileSize, setTileSize] = useState(DEFAULT_TILE_SIZE);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    const perTile = Math.floor(width / 5) - EXAMPLE_TILE_GAP * 2;
    setTileSize(Math.max(MIN_TILE_SIZE, Math.min(DEFAULT_TILE_SIZE, perTile)));
  };

  return (
    <View style={styles.example}>
      <View style={styles.exampleTilesRow} onLayout={handleLayout}>
        {example.tokens.map((token, i) =>
          i === example.highlightIndex ? (
            <FlipExampleTile key={i} token={token} state={example.state} revealed={revealed} size={tileSize} />
          ) : (
            <NeutralTileLabel key={i} token={token} size={tileSize} />
          ),
        )}
      </View>
      <RulesText style={styles.exampleCaption}>{example.caption}</RulesText>
    </View>
  );
}

// The highlighted example tile: its letter in the panel's neutral look until
// revealed, then a flip to the real game color with the same letter — the
// swap happens edge-on, at the flip's midpoint, like the board's own reveal.
function FlipExampleTile({ token, state, revealed, size }: { token: string; state: LetterState; revealed: boolean; size: number }) {
  const { reduceMotion } = useTheme();
  const [rotation] = useState(() => new Animated.Value(0));
  const [showColor, setShowColor] = useState(revealed);
  const [prevRevealed, setPrevRevealed] = useState(revealed);
  if (revealed !== prevRevealed) {
    setPrevRevealed(revealed);
    if (!revealed) setShowColor(false); // snap back to neutral
    else if (reduceMotion) setShowColor(true); // no flip
  }

  useEffect(() => {
    if (!revealed || reduceMotion) return;
    const half = TILE_FLIP_DURATION_MS / 2;
    const flipIn = Animated.timing(rotation, { toValue: 1, duration: half, easing: Easing.in(Easing.quad), useNativeDriver: true });
    flipIn.start(({ finished }) => {
      if (!finished) return;
      setShowColor(true);
      Animated.timing(rotation, { toValue: 0, duration: half, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    return () => {
      flipIn.stop();
      rotation.setValue(0);
    };
  }, [revealed, reduceMotion, rotation]);

  const rotateX = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  return (
    <Animated.View style={{ transform: [{ perspective: 600 }, { rotateX }] }}>
      {showColor ? <Tile letter={token} state={state} size={size} /> : <NeutralTileLabel token={token} size={size} />}
    </Animated.View>
  );
}

// Uppercased the same way the real board/keyboard do (letterLabel), so e.g.
// "ու" reads as one ՈՒ tile here too.
function NeutralTileLabel({ token, size }: { token: string; size: number }) {
  return <NeutralTile letter={letterLabel(token)} size={size} />;
}

function RulesText({
  style,
  children,
}: {
  style?: StyleProp<TextStyle>;
  children: TextPart[];
}) {
  const { theme, textColor } = useTheme();
  return (
    <Animated.Text style={[styles.bodyText, { color: textColor('popupTextMuted') }, style]}>
      {children.map((part, i) =>
        part.bold ? (
          <Animated.Text
            key={i}
            style={[
              styles.boldText,
              { color: textColor('popupText') },
              // The game font only ships one (already-bold) weight, so
              // font-weight alone can't distinguish this from the rest of
              // the text — this faint doubled-up shadow is the RN stand-in
              // for the spec's -webkit-text-stroke fallback, adding a touch
              // of extra visual weight on top of the color change. RN has no
              // "currentColor" — reusing the same animated color keeps it in
              // sync instead.
              Platform.OS === 'ios' && {
                // Not on the native-animated allowlist, so a plain snapshot
                // (it switches at the theme fade's midpoint).
                textShadowColor: theme.popupText,
                textShadowOffset: { width: 0.5, height: 0 },
                textShadowRadius: 0,
              },
            ]}
          >
            {part.text}
          </Animated.Text>
        ) : (
          <Animated.Text key={i}>{part.text}</Animated.Text>
        ),
      )}
    </Animated.Text>
  );
}

export default function RulesCard({ revealTrigger, visible }: Props) {
  const { theme, color, textColor, reduceMotion } = useTheme();
  const [revealedCount, setRevealedCount] = useState(reduceMotion ? EXAMPLES.length : 0);

  // Snaps straight back to neutral — no animation to disable first, since
  // FlipExampleTile only animates the *forward* neutral -> colored flip —
  // the instant the popup starts closing and, as a safety net, again right
  // as a fresh open begins. Skipped entirely under reduced motion, where the
  // tiles are just always shown in their final colored state.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!reduceMotion) setRevealedCount(0);
  }

  // Also keyed on `visible` (not just revealTrigger) so its cleanup clears
  // any still-pending staggered reveal timers the instant the popup starts
  // closing — closing mid-flip can never leave a half-flipped tile.
  useEffect(() => {
    if (reduceMotion) return; // shown directly already — nothing to stagger
    if (!visible || revealTrigger === 0) return;
    const timers = EXAMPLES.map((_, i) =>
      setTimeout(() => setRevealedCount((n) => Math.max(n, i + 1)), i * RULES_TILE_REVEAL_STAGGER_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [revealTrigger, reduceMotion, visible]);

  return (
    <View>
      <View style={styles.attemptsRow}>
        <Animated.View style={[styles.attemptsBadge, { backgroundColor: color('popupBadgeBg') }]}>
          <Animated.Text style={[styles.attemptsBadgeText, { color: textColor('popupBadgeText') }]}>6</Animated.Text>
        </Animated.View>
        <RulesText style={styles.attemptsText}>
          {[{ text: 'ԴՈՒՔ ՈՒՆԵՔ 6 ՀՆԱՐԱՎՈՐՈՒԹՅՈՒՆ ԲԱՌԸ ԳՏՆԵԼՈՒ ՀԱՄԱՐ' }]}
        </RulesText>
      </View>

      <View style={styles.examplesBlock}>
        {EXAMPLES.map((example, i) => (
          <ExampleRow key={i} example={example} revealed={i < revealedCount} />
        ))}
      </View>

      <Animated.View style={[styles.divider, { backgroundColor: color('popupDivider') }]} />

      <View style={styles.hintRows}>
        {HINT_ROWS.map((row, i) => (
          <View key={i} style={styles.hintRow}>
            <StaticBadge>
              {row.icon === 'search' ? (
                <SymbolView
                  name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                  size={20}
                  tintColor={theme.keyText}
                />
              ) : (
                <BowIcon size={20} volleyId={0} shotCount={0} />
              )}
            </StaticBadge>
            <RulesText style={styles.hintText}>{row.caption}</RulesText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  attemptsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attemptsBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptsBadgeText: {
    fontSize: 16,
    fontFamily: FONTS.tile,
  },
  attemptsText: {
    flex: 1,
  },
  examplesBlock: {
    marginTop: 20,
  },
  example: {
    marginBottom: 20,
  },
  exampleTilesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  exampleCaption: {
    marginTop: 8,
    textAlign: 'center',
  },
  neutralTile: {
    marginHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neutralTileText: {
    fontFamily: FONTS.tile,
    includeFontPadding: false,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 20,
  },
  hintRows: {
    gap: 16,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hintBadge: {
    width: HINT_BADGE_SIZE,
    // Reserves the 3D edge's height within the badge's own footprint, same
    // technique as PowerUpButton/KeyboardKey.
    height: HINT_BADGE_SIZE - KEY_EDGE_HEIGHT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBadgeFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderBottomWidth: KEY_EDGE_HEIGHT,
  },
  hintText: {
    flex: 1,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 14 * 1.45,
    letterSpacing: 0.28, // 0.02em @ 14px
    fontFamily: FONTS.body,
  },
  boldText: {
    fontWeight: '700',
  },
});
