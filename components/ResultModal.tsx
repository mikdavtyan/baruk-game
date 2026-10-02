import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button3D from './Button3D';
import Coin from './Coin';
import Ribbon from './Ribbon';
import SmokePuffs from './SmokePuffs';
import StreakFlameIcon from './StreakFlameIcon';
import Tile from './Tile';
import { FONTS, KEY_EDGE_HEIGHT, LetterState, MAX_GUESSES, WORD_LENGTH } from '../constants/theme';
import {
  LOSS_RESULT_ROLLDOWN_MS,
  RESULT_SECTION_RISE_PX,
  RESULT_SECTION_STAGGER_MS,
  RESULT_TILE_FLIP_STAGGER_MS,
} from '../constants/winFlow';
import { RankedEntry } from '../lib/leaderboard';
import { useTheme } from '../lib/ThemeContext';
import { useCountUp } from '../lib/useCountUp';

type Props = {
  variant: 'win' | 'loss';
  secretWordTokens: string[]; // lowercase tokens, e.g. ['բ','ա','ռ',...]
  finalGuesses?: { states: LetterState[] }[]; // loss only — drawn as the stats row's mini board map
  points: number; // win: the new total (rolls up); loss: the target (0 — rolls down from whatever this modal last showed)
  lostPoints?: number; // loss only — the frozen "previous" total, shown in a small sub-pill
  streak: number; // win: the new streak (rolls up); loss: the target (0)
  streakGrew: boolean; // win only — the floating "+1"
  bestStreak: number;
  leaderboard: RankedEntry[];
  shareBadgeVisible: boolean;
  onShare: () => void;
  onNext: () => void;
  nextLabel: string; // "ՀԱՋՈՐԴ ԲԱՌԸ" (win) or "ՆՈՐ ԽԱՂ" (loss) — same green button either way
  disabled: boolean;
  reduceMotion?: boolean;
};

function Section({ index, children }: { index: number; children: React.ReactNode }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, index * RESULT_SECTION_STAGGER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [RESULT_SECTION_RISE_PX, 0] });
  return <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// win: tiles flip to the real 'correct' (green) color, since the word really
// was solved. loss: the same flip, but to the neutral cream reveal color —
// this IS the answer, but it isn't a scored guess (see A2/Tile.tsx).
function WordReveal({ tokens, variant }: { tokens: string[]; variant: 'win' | 'loss' }) {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const timers = tokens.map((_, i) =>
      setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), i * RESULT_TILE_FLIP_STAGGER_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const revealedState = variant === 'win' ? 'correct' : 'neutral';
  return (
    <View style={styles.wordRow}>
      {tokens.map((t, i) => (
        <Tile key={i} letter={t} state={i < revealed ? revealedState : 'filled'} size={44} />
      ))}
    </View>
  );
}

function StreakFloatingPlus() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const opacity = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
  return (
    <Animated.Text style={[styles.streakPlusOne, { opacity, transform: [{ translateY }] }]}>+1</Animated.Text>
  );
}

function StatBlock({
  label,
  value,
  icon,
  sub,
  pill,
  tintWhileNonZero,
  countUpMs,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  sub?: string;
  pill?: string; // a small rounded chip under the value — distinct from `sub`'s plain text
  tintWhileNonZero?: string; // the loss result's points: reddish while rolling down, back to normal at 0
  countUpMs?: number;
}) {
  const { textColor } = useTheme();
  const displayed = useCountUp(value, countUpMs);
  const valueColor = tintWhileNonZero && displayed !== 0 ? tintWhileNonZero : textColor('cardText');
  return (
    <View style={styles.statBlock}>
      <Animated.Text style={[styles.statLabel, { color: textColor('cardTextMuted') }]}>{label}</Animated.Text>
      <View style={styles.statValueRow}>
        {icon}
        <Animated.Text style={[styles.statValue, { color: valueColor }]}>{displayed}</Animated.Text>
      </View>
      {sub ? <Animated.Text style={[styles.statSub, { color: textColor('cardTextMuted') }]}>{sub}</Animated.Text> : null}
      {pill ? (
        <View style={styles.statPill}>
          <Animated.Text style={styles.statPillText}>{pill}</Animated.Text>
        </View>
      ) : null}
    </View>
  );
}

// The loss result's final board as a tiny 6x5 map in the result colors;
// rows the player never reached are empty outlined squares.
const MAP_CELL = 10;
const MAP_GAP = 2;
function BoardMiniMap({ guesses }: { guesses: { states: LetterState[] }[] }) {
  const { color } = useTheme();
  const fill = (s: LetterState | undefined) =>
    s === 'correct' ? color('correct') : s === 'present' ? color('present') : s === 'absent' ? color('absent') : undefined;
  return (
    <View style={styles.miniMap} accessibilityLabel="Final board">
      {Array.from({ length: MAX_GUESSES }, (_, r) => (
        <View key={r} style={styles.miniMapRow}>
          {Array.from({ length: WORD_LENGTH }, (_, c) => {
            const bg = fill(guesses[r]?.states[c]);
            return (
              <Animated.View
                key={c}
                style={[styles.miniMapCell, bg ? { backgroundColor: bg } : { borderWidth: 1, borderColor: color('cardTileBorder') }]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const RANK_TINTS: Record<number, string> = { 1: '#F4B21F', 2: '#C7CBD1', 3: '#C58245' };
// The player's own rank circle when outside the tinted top 3.
const UNRANKED_CIRCLE = 'rgba(255,255,255,0.08)';
const UNRANKED_TEXT = '#BDB6AA';
const LOSS_RIBBON_HEIGHT = 40;

function LeaderboardRow({ rank, name, points, isPlayer }: { rank: number; name: string; points: number; isPlayer: boolean }) {
  const { theme, textColor } = useTheme();
  return (
    <Animated.View
      style={[
        styles.leaderRow,
        { backgroundColor: theme.cardTileFill, borderColor: isPlayer ? theme.correct : 'transparent' },
      ]}
    >
      <View style={[styles.rankCircle, { backgroundColor: RANK_TINTS[rank] ?? UNRANKED_CIRCLE }]}>
        <Animated.Text style={[styles.rankText, !RANK_TINTS[rank] && { color: UNRANKED_TEXT }]}>{rank}</Animated.Text>
      </View>
      <View style={[styles.avatarCircle, { backgroundColor: theme.cardTileBorder }]}>
        <Animated.Text style={[styles.avatarText, { color: textColor('cardText') }]}>{name.charAt(0)}</Animated.Text>
      </View>
      {/* The player's own row shows just one indicator, not both a "you" tag
          AND the leaderboard's placeholder "ԴՈՒՔ" name — the tag replaces
          the name slot entirely, standing out against the highlighted
          border. */}
      {isPlayer ? (
        <View style={styles.youTagWrap}>
          <View style={[styles.youTag, { backgroundColor: theme.correct }]}>
            <Animated.Text style={styles.youTagText}>ԴՈՒՔ</Animated.Text>
          </View>
        </View>
      ) : (
        <Animated.Text style={[styles.leaderName, { color: textColor('cardText') }]} numberOfLines={1}>
          {name}
        </Animated.Text>
      )}
      <Animated.Text style={[styles.leaderPoints, { color: textColor('cardText') }]}>{points}</Animated.Text>
    </Animated.View>
  );
}

// Shared by both the win and loss flows — same card, leaderboard, share
// button and layout throughout; only the word tiles' color, the points/
// streak roll direction (and the streak icon "going out"), and the primary
// button's label actually differ, all switched on `variant`.
export default function ResultModal({
  variant,
  secretWordTokens,
  finalGuesses = [],
  points,
  lostPoints,
  streak,
  streakGrew,
  bestStreak,
  leaderboard,
  shareBadgeVisible,
  onShare,
  onNext,
  nextLabel,
  disabled,
  reduceMotion = false,
}: Props) {
  const { theme, color, textColor } = useTheme();
  const insets = useSafeAreaInsets();
  const isLoss = variant === 'loss';

  const playerRankIndex = leaderboard.findIndex((r) => r.entry.id === 'player');
  const top3 = leaderboard.slice(0, 3);
  const playerRow = playerRankIndex >= 0 ? leaderboard[playerRankIndex] : null;
  const playerInTop3 = playerRankIndex >= 0 && playerRankIndex < 3;

  return (
    <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.scrollArea}>
        <Section index={0}>
          <View style={isLoss && styles.lossCardWrap}>
            <LinearGradient colors={[theme.cardGradientStart, theme.cardGradientEnd]} style={styles.cardGradient}>
              <Animated.View
                style={[styles.card, isLoss && styles.lossCard, { borderColor: color('cardBorder'), borderBottomColor: color('cardEdge') }]}
              >
                <Animated.Text style={[styles.cardLabel, { color: textColor('cardTextMuted') }]}>
                  ԹԱՔՆՎԱԾ ԲԱՌՆ ԷՐ
                </Animated.Text>
                <WordReveal tokens={secretWordTokens} variant={variant} />

                <View style={[styles.statsRow, isLoss && styles.lossStatsRow]}>
                  {isLoss && <BoardMiniMap guesses={finalGuesses} />}
                  <StatBlock
                    label="ՄԻԱՎՈՐՆԵՐ"
                    value={points}
                    countUpMs={isLoss ? LOSS_RESULT_ROLLDOWN_MS : undefined}
                    tintWhileNonZero={isLoss ? '#E07A5F' : undefined}
                    pill={isLoss && lostPoints ? `ՆԱԽՈՐԴԸ՝ ${lostPoints}` : undefined}
                  />
                  <StatBlock
                    label="ՀԱՂԹԱԿԱՆ ՇԱՐՔ"
                    value={streak}
                    countUpMs={isLoss ? LOSS_RESULT_ROLLDOWN_MS : undefined}
                    sub={`ԼԱՎԱԳՈՒՅՆԸ՝ ${bestStreak}`}
                    icon={<StreakFlameIcon size={18} litColor={theme.present} extinguished={isLoss} />}
                  />
                  {streakGrew && (
                    <View style={styles.streakPlusWrap}>
                      <StreakFloatingPlus />
                    </View>
                  )}
                  {isLoss && !reduceMotion && <SmokePuffs />}
                </View>
              </Animated.View>
            </LinearGradient>
            {/* Pinned across the card's top edge, half above it. */}
            {isLoss && (
              <View style={styles.lossRibbonWrap} pointerEvents="none">
                <Ribbon
                  text="ԽԱՂՆ ԱՎԱՐՏՎԵՑ"
                  bandColors={['#D0674F', '#A94632']}
                  bandEdgeColor="#8C3A28"
                  tailColor="#7C3324"
                  width="70%"
                  height={LOSS_RIBBON_HEIGHT}
                  fontSize={15}
                />
              </View>
            )}
          </View>
        </Section>

        <Section index={1}>
          <Animated.Text style={[styles.leaderTitle, { color: textColor('cardText') }]}>ԱՌԱՋԱՏԱՐՆԵՐ</Animated.Text>
          <View style={styles.leaderList}>
            {top3.map((r) => (
              <LeaderboardRow key={r.entry.id} rank={r.rank} name={r.entry.name} points={r.entry.points} isPlayer={r.entry.id === 'player'} />
            ))}
            {playerRow && !playerInTop3 && (
              <>
                <Animated.Text style={[styles.ellipsis, { color: textColor('textMuted') }]}>···</Animated.Text>
                <LeaderboardRow rank={playerRow.rank} name={playerRow.entry.name} points={playerRow.entry.points} isPlayer />
              </>
            )}
          </View>
        </Section>

        <Section index={2}>
          <View style={styles.bottomRow}>
            <View style={styles.shareWrap}>
              {shareBadgeVisible && (
                <Animated.View style={[styles.shareBadge, { backgroundColor: color('present') }]}>
                  <Animated.Text style={styles.shareBadgeText}>+200</Animated.Text>
                  <Coin size={12} />
                </Animated.View>
              )}
              <Button3D
                width={56}
                height={56}
                borderRadius={28}
                faceColor="#F7C23A"
                edgeColor="#A85F0A"
                disabled={disabled}
                onPress={onShare}
                accessibilityRole="button"
                accessibilityLabel="Share result"
                faceBackground={
                  <LinearGradient colors={['#FFE07A', '#D88A0C']} style={StyleSheet.absoluteFill} />
                }
              >
                <SymbolView
                  name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                  size={22}
                  tintColor="#FFFFFF"
                />
              </Button3D>
            </View>
            <View style={styles.nextButtonWrap}>
              <Button3D
                width="100%"
                height={56}
                borderRadius={16}
                faceColor={color('correct')}
                edgeColor={color('correctEdge')}
                disabled={disabled}
                onPress={onNext}
                accessibilityRole="button"
                accessibilityLabel="Next word"
              >
                <Animated.Text style={styles.nextButtonText}>{nextLabel}</Animated.Text>
              </Button3D>
            </View>
          </View>
        </Section>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lossCardWrap: {
    marginTop: LOSS_RIBBON_HEIGHT / 2,
  },
  lossCard: {
    paddingTop: 20 + LOSS_RIBBON_HEIGHT / 2,
  },
  lossRibbonWrap: {
    position: 'absolute',
    top: -LOSS_RIBBON_HEIGHT / 2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lossStatsRow: {
    gap: 20,
    alignItems: 'center',
  },
  miniMap: {
    gap: MAP_GAP,
  },
  miniMapRow: {
    flexDirection: 'row',
    gap: MAP_GAP,
  },
  miniMapCell: {
    width: MAP_CELL,
    height: MAP_CELL,
    borderRadius: 2,
  },
  fill: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollArea: {
    flex: 1,
    justifyContent: 'center',
  },
  cardGradient: {
    borderRadius: 20,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderBottomWidth: KEY_EDGE_HEIGHT,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontFamily: FONTS.body,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 32,
  },
  statBlock: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FONTS.body,
    letterSpacing: 1,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statValue: {
    fontSize: 32,
    fontFamily: FONTS.tile,
    fontWeight: '700',
  },
  statSub: {
    fontSize: 11,
    fontFamily: FONTS.body,
    marginTop: 2,
  },
  statPill: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statPillText: {
    fontSize: 10,
    fontFamily: FONTS.body,
    color: '#D8D2C6',
  },
  streakPlusWrap: {
    position: 'absolute',
    right: -8,
    top: -4,
  },
  streakPlusOne: {
    fontSize: 16,
    fontFamily: FONTS.title,
    fontWeight: '700',
    color: '#4A9D5B',
  },
  leaderTitle: {
    fontSize: 16,
    fontFamily: FONTS.title,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  leaderList: {
    gap: 8,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 2,
  },
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontFamily: FONTS.title,
    fontWeight: '700',
    color: '#1F2328',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: FONTS.title,
    fontWeight: '700',
  },
  leaderName: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.body,
  },
  youTagWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  youTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youTagText: {
    fontSize: 10,
    fontFamily: FONTS.title,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderPoints: {
    fontSize: 14,
    fontFamily: FONTS.tile,
    fontWeight: '700',
  },
  ellipsis: {
    textAlign: 'center',
    fontSize: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  shareWrap: {
    alignItems: 'center',
  },
  shareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  shareBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.title,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nextButtonWrap: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: FONTS.title,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
