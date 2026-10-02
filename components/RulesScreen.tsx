import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconButton from './IconButton';
import RulesCard from './RulesCard';
import { FONTS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  onBack: () => void;
  revealTrigger: number;
  visible: boolean;
};

const HEADER_HEIGHT = 60;

// The "How to play" page. A real, separate full screen — not a modal — kept
// permanently mounted (see App.tsx) once opened, and pushed in/out by
// App.tsx's own animation, exactly like the main game screen underneath it.
export default function RulesScreen({ onBack, revealTrigger, visible }: Props) {
  const { theme, color } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* Same height/padding and the exact same IconButton component as the
          main screen's own header (see Header.tsx), so the back button never
          visibly moves between the two pages. */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <IconButton
            icon={{ ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' }}
            label="Back"
            color={theme.headerIconColor}
            onPress={onBack}
          />
        </View>
        <Animated.Text style={[styles.title, { color: color('text') }]} numberOfLines={1} adjustsFontSizeToFit>
          ԻՆՉՊԵ՞Ս ԽԱՂԱԼ
        </Animated.Text>
        <View style={styles.headerSide} />
      </View>
      {/* Centers the card vertically in whatever space is left under the
          header when it's short enough to fit; once it's taller than that
          (small phones), flexGrow lets the ScrollView just scroll from the
          top instead — the card is never cut off either way. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: HEADER_HEIGHT }]}
        showsVerticalScrollIndicator={false}
      >
        <RulesCard revealTrigger={revealTrigger} visible={visible} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerSide: {
    flex: 1,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: FONTS.title,
    fontWeight: '700',
    letterSpacing: 20 * 0.08,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 4,
  },
});
