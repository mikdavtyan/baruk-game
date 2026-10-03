import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconButton from './IconButton';
import { FONTS, HEADER_HEIGHT } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  onBack: () => void;
  visible: boolean; // the page is the one on top
};

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

// The shop page (ԽԱՆՈՒԹ), pushed in over the game by PushPage.tsx: a top bar
// with a back arrow and the title, then the shop's sections in a scroll view.
export default function ShopScreen({ onBack, visible }: Props) {
  const { theme, color, textColor } = useTheme();
  return (
    <AnimatedSafeAreaView
      style={[styles.screen, { backgroundColor: color('background') }]}
      edges={['top', 'bottom', 'left', 'right']}
      accessibilityElementsHidden={!visible}
    >
      {/* Same height and the same IconButton as the game's own header, so the
          back arrow lines up with the header's buttons. */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <IconButton
            icon={{ ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' }}
            label="Հետ"
            color={theme.headerIconColor}
            onPress={onBack}
          />
        </View>
        <Animated.Text style={[styles.title, { color: textColor('text') }]} numberOfLines={1} adjustsFontSizeToFit>
          ԽԱՆՈՒԹ
        </Animated.Text>
        <View style={styles.headerSide} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} />
    </AnimatedSafeAreaView>
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
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
