import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import Button3D from './Button3D';
import CoinPillContent, { coinPillStyles } from './CoinPillContent';
import HomeLogo from './HomeLogo';
import LockIcon from './LockIcon';
import MenuBackground from './MenuBackground';
import PlayIcon from './PlayIcon';
import RiseIn from './RiseIn';
import ScreenGlow from './ScreenGlow';
import ShineSweep from './ShineSweep';
import StreakChip from './StreakChip';
import Toast from './Toast';
import WheelButton from './WheelButton';
import { Profile } from '../constants/profile';
import {
  FONTS,
  HOME_CARD_RISE_DELAY_MS,
  HOME_CARD_RISE_STAGGER_MS,
  HOME_PLAY_NUDGE,
  HOME_PLAY_NUDGE_MS,
  HOME_SHINE_INTERVAL_MS,
  TAB_BAR_SPACE,
} from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useAppActive } from '../lib/useAppActive';
import { useLoopWhile } from '../lib/useLoopWhile';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

export const COMING_SOON = 'ՇՈՒՏՈՎ';
const CLASSIC_HEIGHT = 96;
const DAILY_HEIGHT = 78;
const CARD_MAX_WIDTH = 360;
const CARD_SIDE_MARGIN = 20;
// The tab bar below owns the bottom safe area.
const EDGES = ['top', 'left', 'right'] as const;
// The intro (logo drop, cards rising) plays the first time Home appears per
// launch — not again after a progress reset remounts it.
let introPlayed = false;

type Props = {
  profile: Profile;
  points: number;
  coins: number;
  classicSubtitle: string; // ԽԱՂԱԼ / ՇԱՐՈՒՆԱԿԵԼ · N/6 / ՇԱՐՈՒՆԱԿԵԼ (App derives it)
  onOpenClassic: () => void;
  onOpenShop: () => void; // the coin pill: App switches to the Shop tab
  onOpenWheel: () => void; // the fortune wheel button: the wheel page
  onOpenProfile: () => void;
  backgroundPaused: boolean; // Home isn't what's on screen: its idle motion stops
  streak: number; // the current streak (the chip under the logo)
};

// The Home tab (ՄԵՆՅՈՒ), where the app opens. Top: the profile (avatar, name,
// points) and the coin pill (the Shop tab); under the pill, on the right, the
// fortune wheel button (its own row, so it never overlaps the title or the
// cards on a small screen). Center: the title and the two game cards —
// ԴԱՍԱԿԱՆ (the Classic game page) and ՕՐՎԱ ԲԱՌ (coming soon). The tab bar is
// below it (MainTabs). Memoized with stable props from App, so a keystroke in
// the game never re-renders it.
function MenuScreen({
  profile,
  points,
  coins,
  classicSubtitle,
  onOpenClassic,
  onOpenShop,
  onOpenWheel,
  onOpenProfile,
  backgroundPaused,
  streak,
}: Props) {
  const { color, textColor, reduceMotion } = useTheme();
  const appActive = useAppActive();
  const running = !backgroundPaused && appActive && !reduceMotion;
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = Math.min(windowWidth - CARD_SIDE_MARGIN * 2, CARD_MAX_WIDTH);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const showComingSoon = () => setToast((t) => ({ id: (t?.id ?? 0) + 1, message: COMING_SOON }));
  const [intro] = useState(() => !introPlayed && !reduceMotion);
  useEffect(() => {
    introPlayed = true;
  }, []);

  // ԴԱՍԱԿԱՆ's play arrow nudges forward and back.
  const [nudge] = useState(() => new Animated.Value(0));
  const [nudgeX] = useState(() => nudge.interpolate({ inputRange: [0, 1], outputRange: [0, HOME_PLAY_NUDGE] }));
  useLoopWhile(
    running,
    () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(nudge, { toValue: 1, duration: HOME_PLAY_NUDGE_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(nudge, { toValue: 0, duration: HOME_PLAY_NUDGE_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    () => nudge.setValue(0),
  );

  return (
    <Animated.View testID="menu" style={[styles.screen, { backgroundColor: color('background') }]}>
      <ScreenGlow />
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
          <Pressable onPress={onOpenShop} accessibilityRole="button" accessibilityLabel="Խանութ" hitSlop={6}>
            {({ pressed }) => (
              <Animated.View
                style={[
                  coinPillStyles.pill,
                  styles.pill,
                  { backgroundColor: color('pill'), borderColor: color('border') },
                  pressed && styles.pressed,
                ]}
              >
                <CoinPillContent value={coins} textColor={textColor('pillText')} plusColor={color('correct')} />
              </Animated.View>
            )}
          </Pressable>
        </View>
        {/* Its own right-aligned row under the pill, so it never overlaps the logo. */}
        <RiseIn play={intro} delay={HOME_CARD_RISE_DELAY_MS + 2 * HOME_CARD_RISE_STAGGER_MS} style={styles.wheelRow}>
          <WheelButton onPress={onOpenWheel} paused={backgroundPaused} />
        </RiseIn>

        <View style={[styles.content, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}>
          <View style={styles.hero}>
            <HomeLogo intro={intro} running={running} />
            <View style={styles.streak}>
              <StreakChip streak={streak} visible={!backgroundPaused} running={running} />
            </View>
          </View>

          <RiseIn play={intro} delay={HOME_CARD_RISE_DELAY_MS}>
            <View testID="menu-classic" style={styles.card}>
              <Button3D
                pressScale
                width={cardWidth}
                height={CLASSIC_HEIGHT}
                borderRadius={26}
                faceColor={color('correct')}
                edgeColor={color('correctEdge')}
                faceBackground={
                  <>
                    <LinearGradient
                      colors={CLASSIC_SHEEN}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.7, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <ShineSweep intervalMs={HOME_SHINE_INTERVAL_MS} paused={!running} travel={cardWidth + 60} />
                  </>
                }
                contentStyle={styles.cardContent}
                onPress={onOpenClassic}
                accessibilityRole="button"
                accessibilityLabel="ԴԱՍԱԿԱՆ"
              >
                <View style={styles.playBox}>
                  <Animated.View style={{ transform: [{ translateX: nudgeX }] }}>
                    <PlayIcon size={30} />
                  </Animated.View>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.classicTitle}>ԴԱՍԱԿԱՆ</Text>
                  <Text style={styles.classicSubtitle}>{classicSubtitle}</Text>
                </View>
              </Button3D>
            </View>
          </RiseIn>

          <RiseIn play={intro} delay={HOME_CARD_RISE_DELAY_MS + HOME_CARD_RISE_STAGGER_MS}>
            <View testID="menu-word-of-day" style={styles.card}>
              <Button3D
                pressScale
                width={cardWidth}
                height={DAILY_HEIGHT}
                borderRadius={22}
                faceColor={color('surface')}
                edgeColor={color('keyEdge')}
                contentStyle={styles.cardContent}
                onPress={showComingSoon}
                accessibilityRole="button"
                accessibilityLabel="ՕՐՎԱ ԲԱՌ"
              >
                <Animated.View style={[styles.lockBox, { backgroundColor: color('raised') }]}>
                  <LockIcon size={28} />
                </Animated.View>
                <View style={styles.cardText}>
                  <Animated.Text style={[styles.dailyTitle, { color: textColor('text') }]}>ՕՐՎԱ ԲԱՌ</Animated.Text>
                  <Animated.Text style={[styles.dailySubtitle, { color: textColor('textMuted') }]}>{COMING_SOON}</Animated.Text>
                </View>
              </Button3D>
            </View>
          </RiseIn>
          {toast && <Toast key={toast.id} message={toast.message} onHidden={() => setToast(null)} />}
          {/* The space below the cards is kept free on purpose (more is coming). */}
        </View>
      </AnimatedSafeAreaView>
    </Animated.View>
  );
}

// A soft white light from the top left over ԴԱՍԱԿԱՆ's green.
const CLASSIC_SHEEN = ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)'] as const;

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
  pill: {
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.7,
  },
  wheelRow: {
    alignItems: 'flex-end',
    paddingRight: 16,
    marginTop: -4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 26,
  },
  streak: {
    marginTop: 14,
  },
  card: {
    alignItems: 'center',
    marginBottom: 14,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    gap: 16,
  },
  cardText: {
    flex: 1,
  },
  playBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classicTitle: {
    fontFamily: FONTS.title,
    fontSize: 23,
    letterSpacing: 1.2,
    color: '#FFFFFF', // white on the green card, in both themes
  },
  classicSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    letterSpacing: 1,
    marginTop: 3,
    color: '#FFFFFF',
    opacity: 0.88,
  },
  lockBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyTitle: {
    fontFamily: FONTS.title,
    fontSize: 16,
    letterSpacing: 0.8,
  },
  dailySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 3,
  },
});
