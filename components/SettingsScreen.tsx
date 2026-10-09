import { memo, ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import { ThemedSymbol } from './ThemedSnapshot';
import Toast from './Toast';
import { Profile } from '../constants/profile';
import { FONTS, SETTINGS_SWITCH_MS } from '../constants/theme';
import { useTheme, useThemeSnapshot } from '../lib/ThemeContext';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
// The tab bar below owns the bottom safe area.
const EDGES = ['top', 'left', 'right'] as const;
const CHEVRON = { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as const;
const COMING_SOON = 'ՇՈՒՏՈՎ';
const DANGER = '#D64545'; // the reset row's red — the same in both themes
const SWITCH_WIDTH = 50;
const SWITCH_HEIGHT = 30;
const KNOB_SIZE = 24;

type Props = {
  visible: boolean; // the Settings tab is the one in front
  profile: Profile;
  hapticsOn: boolean;
  onToggleHaptics: () => void;
  onOpenRules: () => void;
  onOpenAbout: () => void;
  onOpenProfile: () => void;
  onResetProgress: () => void; // opens the confirmation; App resets on confirm
};

// A game-style on/off switch: the track crossfades from the neutral key color
// to the correct green and the knob slides (native driver; reduced motion:
// at once). An accessible switch with its Armenian label.
function SettingsSwitch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  const { color, reduceMotion } = useTheme();
  const [value] = useState(() => new Animated.Value(on ? 1 : 0));
  const [knobX] = useState(() =>
    value.interpolate({ inputRange: [0, 1], outputRange: [0, SWITCH_WIDTH - KNOB_SIZE - 6] }),
  );
  useEffect(() => {
    if (reduceMotion) {
      value.setValue(on ? 1 : 0);
      return;
    }
    const slide = Animated.timing(value, {
      toValue: on ? 1 : 0,
      duration: SETTINGS_SWITCH_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    slide.start();
    return () => slide.stop();
  }, [on, reduceMotion, value]);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={6}
      style={styles.row}
    >
      <RowLabel text={label} />
      <View style={styles.switchTrack}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.switchFill, { backgroundColor: color('keyBackground') }]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.switchFill, { backgroundColor: color('correct'), opacity: value }]} />
        <Animated.View style={[styles.knob, { transform: [{ translateX: knobX }] }]} />
      </View>
    </Pressable>
  );
}

// The dark-theme switch reads the theme snapshot (it flips at the fade's
// midpoint), so it's its own leaf: a theme change re-renders only it.
const DarkModeSwitch = memo(function DarkModeSwitch() {
  const { toggleTheme } = useTheme();
  const { isDark } = useThemeSnapshot();
  return <SettingsSwitch label="ՄՈՒԳ ԹԵՄԱ" on={isDark} onToggle={toggleTheme} />;
});

function RowLabel({ text, danger }: { text: string; danger?: boolean }) {
  const { textColor } = useTheme();
  return (
    <Animated.Text
      style={[styles.rowLabel, { color: danger ? DANGER : textColor('popupText') }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {text}
    </Animated.Text>
  );
}

// A tappable row: its label, then a right-hand accessory (a chevron by default).
function Row({
  label,
  onPress,
  danger,
  dimmed,
  right,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  dimmed?: boolean;
  right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, dimmed && styles.dimmed, pressed && styles.pressed]}
    >
      <RowLabel text={label} danger={danger} />
      {right ?? <ThemedSymbol name={CHEVRON} size={16} token="textMuted" />}
    </Pressable>
  );
}

// The Settings tab (ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ): cards of rows, in the shop's look.
// ՏԵՍՔ — the dark theme; ԽԱՂ — haptics, how to play; ՀԱՇԻՎ — the profile,
// save progress (coming soon), reset progress; ԱՅԼ — feedback (coming soon),
// about. Toggles take effect at once and are saved by App.
function SettingsScreen({
  visible,
  profile,
  hapticsOn,
  onToggleHaptics,
  onOpenRules,
  onOpenAbout,
  onOpenProfile,
  onResetProgress,
}: Props) {
  const { color, textColor } = useTheme();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const comingSoon = () => setToast((t) => ({ id: (t?.id ?? 0) + 1, message: COMING_SOON }));

  const section = (title: string, rows: ReactNode) => (
    <>
      <Animated.Text style={[styles.sectionTitle, { color: textColor('textMuted') }]}>{title}</Animated.Text>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: color('popupSurface'), borderColor: color('popupBorder'), borderBottomColor: color('popupEdge') },
        ]}
      >
        {rows}
      </Animated.View>
    </>
  );
  const divider = <Animated.View style={[styles.divider, { backgroundColor: color('popupBorder') }]} />;
  const soonTag = (
    <Animated.View style={[styles.soonTag, { backgroundColor: color('keyBackground') }]}>
      <Animated.Text style={[styles.soonText, { color: textColor('textMuted') }]}>{COMING_SOON}</Animated.Text>
    </Animated.View>
  );

  return (
    <AnimatedSafeAreaView
      style={[styles.screen, { backgroundColor: color('background') }]}
      edges={EDGES}
      accessibilityElementsHidden={!visible}
    >
      <View style={styles.header}>
        <Animated.Text style={[styles.title, { color: textColor('headerValueColor') }]} numberOfLines={1} adjustsFontSizeToFit>
          ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ
        </Animated.Text>
      </View>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {section('ՏԵՍՔ', <DarkModeSwitch />)}
        {section(
          'ԽԱՂ',
          <>
            <SettingsSwitch label="ԹՐԹՌՈՑ" on={hapticsOn} onToggle={onToggleHaptics} />
            {divider}
            <Row label="ԻՆՉՊԵ՞Ս ԽԱՂԱԼ" onPress={onOpenRules} />
          </>,
        )}
        {section(
          'ՀԱՇԻՎ',
          <>
            <Row
              label="ՊՐՈՖԻԼ"
              onPress={onOpenProfile}
              right={
                <View style={styles.profileRight}>
                  <Animated.Text style={[styles.profileName, { color: textColor('textMuted') }]} numberOfLines={1}>
                    {profile.name}
                  </Animated.Text>
                  <Avatar avatarId={profile.avatarId} name={profile.name} size={28} />
                </View>
              }
            />
            {divider}
            <Row label="ՊԱՀՊԱՆԵԼ ԱՐԴՅՈՒՆՔԸ" onPress={comingSoon} dimmed right={soonTag} />
            {divider}
            <Row label="ԶՐՈՅԱՑՆԵԼ ԱՌԱՋԸՆԹԱՑԸ" onPress={onResetProgress} danger />
          </>,
        )}
        {section(
          'ԱՅԼ',
          <>
            <Row label="ԱՌԱՋԱՐԿՆԵՐ ԵՎ ԿԱՐԾԻՔՆԵՐ" onPress={comingSoon} dimmed right={soonTag} />
            {divider}
            <Row label="ՄԱՍԻՆ" onPress={onOpenAbout} />
          </>,
        )}
      </ScrollView>
      {toast && <Toast key={toast.id} message={toast.message} onHidden={() => setToast(null)} />}
    </AnimatedSafeAreaView>
  );
}

export default memo(SettingsScreen);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Same height as the shop's top bar.
  header: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.title,
    fontWeight: '700',
    letterSpacing: 20 * 0.08,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: FONTS.title,
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 4,
    overflow: 'hidden',
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  rowLabel: {
    flexShrink: 1,
    fontFamily: FONTS.title,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
  dimmed: {
    opacity: 0.55,
  },
  divider: {
    height: 1,
    marginLeft: 16,
  },
  switchTrack: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    justifyContent: 'center',
  },
  switchFill: {
    borderRadius: SWITCH_HEIGHT / 2,
  },
  knob: {
    position: 'absolute',
    left: 3,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#FFFFFF', // the knob is white in both themes, like a system switch
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  profileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  profileName: {
    fontFamily: FONTS.body,
    fontSize: 14,
    maxWidth: 140,
  },
  soonTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soonText: {
    fontFamily: FONTS.title,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
