import { forwardRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Coin from './Coin';
import IconButton from './IconButton';
import { useThemeToggle } from './ThemeTransition';
import ThemeToggleIcon from './ThemeToggleIcon';
import { FONTS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useCountUp } from '../lib/useCountUp';

type Props = {
  score: number;
  coins: number;
  onOpenRules: () => void;
};

// Forwards its ref to the coin pill specifically (not the whole header) —
// WinFlow.tsx measures it (measureInWindow) to know exactly where flying
// coins should land, and to place its own "stays visible above the overlay"
// duplicate at the same spot.
const Header = forwardRef<View, Props>(function Header({ score, coins, onOpenRules }, coinPillRef) {
  // `theme.headerIconColor` (a plain, instant value) is deliberately kept
  // for the small flat icons below — SymbolView's tintColor is a native
  // prop, not a style, so it can't be smoothly cross-faded the way an
  // Animated.Text/View's color/backgroundColor can. Everything else here
  // uses `color()` so it morphs in place with the rest of the app.
  const { theme, isDark, color } = useTheme();
  const toggleTheme = useThemeToggle();
  const displayedCoins = useCountUp(coins);

  // Left and right side groups share the center's flex weight, so the score
  // block always lands in the true middle third of the header no matter how
  // wide either side's content (icon buttons, coin pill) ends up being.
  return (
    <View style={styles.header}>
      <View style={styles.sideGroupLeft}>
        <IconButton
          icon={{ ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' }}
          label="Back"
          color={theme.headerIconColor}
          // Non-functional for now — no navigation logic yet.
        />
        <IconButton label="Toggle dark mode" color={theme.headerIconColor} onPress={toggleTheme}>
          <ThemeToggleIcon isDark={isDark} color={theme.headerIconColor} />
        </IconButton>
      </View>
      <View style={styles.scoreBlock}>
        <Animated.Text
          style={[styles.scoreLabel, { color: color('textMuted') }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ՄԻԱՎՈՐՆԵՐ
        </Animated.Text>
        <Animated.Text style={[styles.scoreValue, { color: color('headerValueColor') }]}>{score}</Animated.Text>
      </View>
      <View style={styles.sideGroupRight}>
        <IconButton
          icon={{ ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' }}
          label="Rules"
          color={theme.headerIconColor}
          onPress={onOpenRules}
        />
        <Animated.View ref={coinPillRef} collapsable={false} style={[styles.coinCounter, { backgroundColor: color('pill') }]}>
          <Coin size={22} />
          <Animated.Text style={[styles.coinCounterText, { color: color('pillText') }]}>
            {displayedCoins}
          </Animated.Text>
        </Animated.View>
      </View>
    </View>
  );
});

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
  coinCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  coinCounterText: {
    fontSize: 13,
    fontFamily: FONTS.title,
  },
});
