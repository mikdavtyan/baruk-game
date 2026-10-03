import { forwardRef, memo } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import CoinPillContent, { coinPillStyles } from './CoinPillContent';
import { ThemedIconButton, ThemeToggleButton } from './ThemedSnapshot';
import { FONTS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useCountUp } from '../lib/useCountUp';

const BACK_ICON = { ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' } as const;

type Props = {
  score: number;
  coins: number;
  onOpenRules: () => void;
  onOpenShop: () => void; // the coin pill is the shop's entry point
  onBack: () => void; // back to the menu (the game is a page pushed over it)
};

// Forwards its ref to the coin pill specifically (not the whole header) —
// WinFlow/LossFlow measure it (measureInWindow) to know exactly where flying
// coins should land, and to place their own "stays visible above the overlay"
// duplicate at the same spot. Tapping the pill opens the shop.
// Memoized (with stable props from App), so a keystroke never re-renders it.
const Header = memo(forwardRef<View, Props>(function Header({ score, coins, onOpenRules, onOpenShop, onBack }, coinPillRef) {
  // The flat icons' tint (a native prop, not a style) can't fade, so they read
  // the snapshot inside their own tiny components (ThemedSnapshot.tsx) — a
  // theme toggle re-renders those, never this header. Everything else here
  // uses color()/textColor(), which fade in place.
  const { color, textColor } = useTheme();
  const displayedCoins = useCountUp(coins);

  // Left and right side groups share the center's flex weight, so the score
  // block always lands in the true middle third of the header no matter how
  // wide either side's content (icon buttons, coin pill) ends up being.
  return (
    <View style={styles.header}>
      <View style={styles.sideGroupLeft}>
        <ThemedIconButton icon={BACK_ICON} label="Հետ" token="headerIconColor" onPress={onBack} />
        <ThemeToggleButton />
      </View>
      <View style={styles.scoreBlock}>
        <Animated.Text
          style={[styles.scoreLabel, { color: textColor('textMuted') }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ՄԻԱՎՈՐՆԵՐ
        </Animated.Text>
        <Animated.Text style={[styles.scoreValue, { color: textColor('headerValueColor') }]}>{score}</Animated.Text>
      </View>
      <View style={styles.sideGroupRight}>
        <ThemedIconButton
          icon={{ ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' }}
          label="Rules"
          token="headerIconColor"
          onPress={onOpenRules}
        />
        <Pressable onPress={onOpenShop} accessibilityRole="button" accessibilityLabel="Խանութ" hitSlop={6}>
          {({ pressed }) => (
            <Animated.View
              ref={coinPillRef}
              collapsable={false}
              style={[coinPillStyles.pill, { backgroundColor: color('pill') }, pressed && styles.pillPressed]}
            >
              <CoinPillContent
                value={displayedCoins}
                textColor={textColor('pillText')}
                plusColor={color('correct')}
              />
            </Animated.View>
          )}
        </Pressable>
      </View>
    </View>
  );
}));

export default Header;

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sideGroupLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideGroupRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  scoreBlock: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    fontFamily: FONTS.title,
    letterSpacing: 2,
  },
  scoreValue: {
    fontSize: 28,
    fontFamily: FONTS.title,
  },
  pillPressed: {
    opacity: 0.7,
  },
});
