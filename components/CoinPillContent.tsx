import { Animated, StyleSheet, Text, View } from 'react-native';
import Coin from './Coin';
import { FONTS } from '../constants/theme';

type AnimatableColor = string | Animated.AnimatedInterpolation<string>;

type Props = {
  value: number;
  textColor: AnimatableColor;
  plusColor: AnimatableColor; // the small "+" badge's fill (green)
};

const COIN_SIZE = 22;
const PLUS_SIZE = 11;

// What the coin pill shows: the count, then the B coin with a small green "+"
// badge overlapping the coin's bottom-right corner (the shop's entry point).
// Shared by the header's pill and the duplicate WinFlow/LossFlow draw above
// their overlay, so all three always match; each wraps it in its own
// container styled with `coinPillStyles.pill`.
export default function CoinPillContent({ value, textColor, plusColor }: Props) {
  return (
    <>
      <Animated.Text style={[styles.count, { color: textColor }]}>{value}</Animated.Text>
      <View testID="pill-coin" style={styles.coinSlot}>
        <Coin size={COIN_SIZE} />
        <Animated.View testID="pill-plus-badge" style={[styles.plus, { backgroundColor: plusColor }]}>
          <Text style={styles.plusText}>+</Text>
        </Animated.View>
      </View>
    </>
  );
}

export const coinPillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

const styles = StyleSheet.create({
  count: {
    fontSize: 13,
    fontFamily: FONTS.title,
  },
  coinSlot: {
    width: COIN_SIZE,
    height: COIN_SIZE,
  },
  plus: {
    position: 'absolute',
    right: -PLUS_SIZE / 3,
    bottom: -PLUS_SIZE / 3,
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    borderRadius: PLUS_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#ffffff', // fixed, like the white letters on scored tiles
    fontSize: 10,
    lineHeight: 11,
    fontFamily: FONTS.title,
  },
});
