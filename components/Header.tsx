import { forwardRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import CoinPillContent, { coinPillStyles } from './CoinPillContent';
import IconButton from './IconButton';
import ThemeToggleIcon from './ThemeToggleIcon';
import { FONTS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useCountUp } from '../lib/useCountUp';

type Props = {
  score: number;
  coins: number;
  onOpenRules: () => void;
  onOpenShop: () => void; // the coin pill is the shop's entry point
};

// Forwards its ref to the coin pill specifically (not the whole header) —
// WinFlow/LossFlow measure it (measureInWindow) to know exactly where flying
// coins should land, and to place their own "stays visible above the overlay"
// duplicate at the same spot. Tapping the pill opens the shop.
const Header = forwardRef<View, Props>(function Header({ score, coins, onOpenRules, onOpenShop }, coinPillRef) {
  // `theme.headerIconColor` (a plain, instant value) is deliberately kept
  // for the small flat icons below — SymbolView's tintColor is a native
  // prop, not a style, so it can't be smoothly cross-faded the way an
  // Animated.Text/View's color/backgroundColor can. Everything else here
  // uses `color()` so it morphs in place with the rest of the app.
  const { theme, isDark, color, textColor, toggleTheme } = useTheme();
  const displayedCoins = useCountUp(coins);

  // The side groups take their content's width and the score block the
  // rest: the coin pill is too wide for an equal three-way split on small
  // phones, so the score sits centered in what's left rather than overlap.
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
          style={[styles.scoreLabel, { color: textColor('textMuted') }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ՄԻԱՎՈՐՆԵՐ
        </Animated.Text>
        <Animated.Text style={[styles.scoreValue, { color: textColor('headerValueColor') }]}>{score}</Animated.Text>
      </View>
      <View style={styles.sideGroupRight}>
        <IconButton
          icon={{ ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' }}
          label="Rules"
          color={theme.headerIconColor}
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
                plusEdgeColor={color('correctEdge')}
              />
            </Animated.View>
          )}
        </Pressable>
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
    gap: 8,
  },
  sideGroupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideGroupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  scoreBlock: {
    flex: 1,
    minWidth: 0,
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
