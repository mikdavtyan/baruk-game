import { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedIconButton } from './ThemedSnapshot';
import { FONTS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
const BACK_ICON = { ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' } as const;

const PAGE_EDGES = ['top', 'bottom', 'left', 'right'] as const;
const TAB_EDGES = ['top', 'left', 'right'] as const;

// A screen with nothing in it yet: the shop's top bar — title, and a back
// arrow when it's a push page (Settings) — and nothing else. As a tab (the
// wheel, tasks, leaderboard) it has no back arrow, and the tab bar below owns
// the bottom safe area.
function EmptyPage({ title, onBack, visible }: { title: string; onBack?: () => void; visible: boolean }) {
  const { color, textColor } = useTheme();
  return (
    <AnimatedSafeAreaView
      style={[styles.screen, { backgroundColor: color('background') }]}
      edges={onBack ? PAGE_EDGES : TAB_EDGES}
      accessibilityElementsHidden={!visible}
    >
      <View style={styles.header}>
        <View style={styles.side}>
          {onBack && <ThemedIconButton icon={BACK_ICON} label="Հետ" token="headerIconColor" onPress={onBack} />}
        </View>
        <Animated.Text style={[styles.title, { color: textColor('headerValueColor') }]} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Animated.Text>
        <View style={styles.side} />
      </View>
    </AnimatedSafeAreaView>
  );
}

export default memo(EmptyPage);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Same height and side widths as the game header and the shop's top bar.
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
  },
  title: {
    flex: 2,
    fontSize: 20,
    fontFamily: FONTS.title,
    fontWeight: '700',
    letterSpacing: 20 * 0.08,
    textAlign: 'center',
  },
});
