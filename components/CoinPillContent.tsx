import { Animated, StyleSheet, Text } from 'react-native';
import Coin from './Coin';
import { FONTS, KEY_EDGE_HEIGHT } from '../constants/theme';

type AnimatableColor = string | Animated.AnimatedInterpolation<string>;

type Props = {
  value: number;
  textColor: AnimatableColor;
  plusColor: AnimatableColor; // the "+" badge's fill (green)
  plusEdgeColor: AnimatableColor; // its 3D bottom edge
};

const COIN_SIZE = 26;
const PLUS_SIZE = 22;

// What the coin pill shows, left to right: the count, the B coin, and a green
// "+" badge (the shop's entry point). Shared by the header's pill and the
// duplicate WinFlow/LossFlow draw above their overlay, so all three always
// match; each wraps it in its own container styled with `coinPillStyles.pill`.
export default function CoinPillContent({ value, textColor, plusColor, plusEdgeColor }: Props) {
  return (
    <>
      <Animated.Text style={[styles.count, { color: textColor }]}>{value}</Animated.Text>
      <Coin size={COIN_SIZE} />
      <Animated.View style={[styles.plus, { backgroundColor: plusColor, borderBottomColor: plusEdgeColor }]}>
        <Text style={styles.plusText}>+</Text>
      </Animated.View>
    </>
  );
}

export const coinPillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 5,
  },
});

const styles = StyleSheet.create({
  count: {
    fontSize: 17,
    fontFamily: FONTS.title,
  },
  plus: {
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    borderRadius: PLUS_SIZE / 2,
    borderBottomWidth: KEY_EDGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#ffffff', // fixed, like the white letters on scored tiles
    fontSize: 16,
    lineHeight: 18,
    fontFamily: FONTS.title,
  },
});
