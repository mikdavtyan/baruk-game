import { memo, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import Button3D from './Button3D';
import CoinPillContent, { coinPillStyles } from './CoinPillContent';
import MenuBackground from './MenuBackground';
import { ThemedIconButton } from './ThemedSnapshot';
import Toast from './Toast';
import { Profile } from '../constants/profile';
import { FONTS } from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { useTheme } from '../lib/ThemeContext';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

export const COMING_SOON = 'ՇՈՒՏՈՎ';
// The game's name, drawn as board tiles: Բ Ա Ռ ՈՒ Կ (5 tokens).
const TITLE_TOKENS = ['բ', 'ա', 'ռ', 'ու', 'կ'];
const TITLE_TILE_STATES = ['correct', 'present', 'correct', 'present', 'correct'] as const;
const TITLE_TILE_SIZE = 46;
const CARD_HEIGHT = 84;
const CARD_MAX_WIDTH = 340;
const CARD_WIDTH_FRACTION = 0.82;
const GEAR_ICON = { ios: 'gearshape.fill', android: 'settings', web: 'settings' } as const;
// The tab bar below owns the bottom safe area.
const EDGES = ['top', 'left', 'right'] as const;

type Props = {
  profile: Profile;
  points: number;
  coins: number;
  classicSubtitle: string; // ԽԱՂԱԼ / ՇԱՐՈՒՆԱԿԵԼ · N/6 / ՇԱՐՈՒՆԱԿԵԼ (App derives it)
  onOpenClassic: () => void;
  onOpenShop: () => void; // the coin pill: App switches to the Shop tab
  onOpenSettings: () => void; // the gear: Settings, a push page
  onOpenProfile: () => void;
  backgroundPaused: boolean; // a page covers the menu: its drifting tiles stop
};

// The Home tab (ՄԵՆՅՈՒ), where the app opens. Top: the profile (avatar, name,
// points), the Settings gear and the coin pill (the Shop tab). Center: the
// title and the two game cards — ԴԱՍԱԿԱՆ (the Classic game page) and ՕՐՎԱ ԲԱՌ
// (coming soon). The tab bar is below it (MainTabs). Memoized with stable
// props from App, so a keystroke in the game never re-renders it.
function MenuScreen({
  profile,
  points,
  coins,
  classicSubtitle,
  onOpenClassic,
  onOpenShop,
  onOpenSettings,
  onOpenProfile,
  backgroundPaused,
}: Props) {
  const { color, textColor } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth * CARD_WIDTH_FRACTION, CARD_MAX_WIDTH);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const showComingSoon = () => setToast((t) => ({ id: (t?.id ?? 0) + 1, message: COMING_SOON }));

  return (
    <Animated.View testID="menu" style={[styles.screen, { backgroundColor: color('background') }]}>
    {/* Behind everything, across the whole screen (outside the safe area). */}
    <MenuBackground paused={backgroundPaused} />
    <AnimatedSafeAreaView style={styles.screen} edges={EDGES}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel="ՊՐՈՖԻԼ"
          style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
        >
          <Avatar avatarId={profile.avatarId} name={profile.name} />
          <View style={styles.profileText}>
            <Animated.Text style={[styles.profileName, { color: textColor('headerValueColor') }]} numberOfLines={1}>
              {profile.name}
            </Animated.Text>
            <Animated.Text style={[styles.profilePoints, { color: textColor('textMuted') }]} numberOfLines={1}>
              {`${points} ՄԻԱՎՈՐ`}
            </Animated.Text>
          </View>
        </Pressable>
        <View style={styles.topRight}>
          <ThemedIconButton icon={GEAR_ICON} label="ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ" token="headerIconColor" onPress={onOpenSettings} />
          <Pressable onPress={onOpenShop} accessibilityRole="button" accessibilityLabel="Խանութ" hitSlop={6}>
            {({ pressed }) => (
              <Animated.View style={[coinPillStyles.pill, { backgroundColor: color('pill') }, pressed && styles.pressed]}>
                <CoinPillContent value={coins} textColor={textColor('pillText')} plusColor={color('correct')} />
              </Animated.View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.center}>
        <View style={styles.title} accessible accessibilityRole="header" accessibilityLabel="ԲԱՌՈՒԿ">
          {TITLE_TOKENS.map((token, i) => (
            <Animated.View
              key={token}
              style={[styles.titleTile, { backgroundColor: color(TITLE_TILE_STATES[i]) }, i % 2 === 1 && styles.titleTileLow]}
            >
              <Animated.Text style={styles.titleLetter}>{letterLabel(token)}</Animated.Text>
            </Animated.View>
          ))}
        </View>

        <View testID="menu-classic" style={styles.card}>
          <Button3D
            width={cardWidth}
            height={CARD_HEIGHT}
            borderRadius={20}
            faceColor={color('correct')}
            edgeColor={color('correctEdge')}
            onPress={onOpenClassic}
            accessibilityRole="button"
            accessibilityLabel="ԴԱՍԱԿԱՆ"
          >
            <Animated.Text style={styles.cardTitle}>ԴԱՍԱԿԱՆ</Animated.Text>
            <Animated.Text style={styles.cardSubtitle}>{classicSubtitle}</Animated.Text>
          </Button3D>
        </View>

        <View testID="menu-word-of-day" style={[styles.card, styles.dimmed]}>
          <Button3D
            width={cardWidth}
            height={CARD_HEIGHT}
            borderRadius={20}
            faceColor={color('keyBackground')}
            edgeColor={color('keyEdge')}
            onPress={showComingSoon}
            accessibilityRole="button"
            accessibilityLabel="ՕՐՎԱ ԲԱՌ"
          >
            <Animated.Text style={[styles.cardTitle, { color: textColor('keyText') }]}>ՕՐՎԱ ԲԱՌ</Animated.Text>
            <Animated.Text style={[styles.cardSubtitle, { color: textColor('keyText') }]}>{COMING_SOON}</Animated.Text>
          </Button3D>
        </View>
        {toast && <Toast key={toast.id} message={toast.message} onHidden={() => setToast(null)} />}
      </View>

    </AnimatedSafeAreaView>
    </Animated.View>
  );
}

export default memo(MenuScreen);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    marginRight: 12,
  },
  profileText: {
    flexShrink: 1,
  },
  profileName: {
    fontFamily: FONTS.title,
    fontSize: 17,
  },
  profilePoints: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  title: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 22,
  },
  titleTile: {
    width: TITLE_TILE_SIZE,
    height: TITLE_TILE_SIZE,
    borderRadius: Math.round(TITLE_TILE_SIZE * 0.24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Alternate tiles sit a little lower: a playful, hand-placed row.
  titleTileLow: {
    transform: [{ translateY: 6 }],
  },
  titleLetter: {
    fontFamily: FONTS.tile,
    fontSize: Math.round(TITLE_TILE_SIZE * 0.58),
    color: '#FFFFFF', // white on scored tiles, in both themes
    includeFontPadding: false,
  },
  card: {
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: FONTS.title,
    fontSize: 24,
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    marginTop: 4,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  dimmed: {
    opacity: 0.55,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
