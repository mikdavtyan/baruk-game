import { memo, ReactNode, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import BowIcon from './BowIcon';
import Coin from './Coin';
import IconButton from './IconButton';
import PlayIcon from './PlayIcon';
import Toast from './Toast';
import {
  AD_REWARD_COINS,
  AD_REWARDS_PER_DAY,
  COIN_PACKS_COMING_SOON,
  ITEM_NAMES,
  ITEM_PACKS,
  ItemPack,
  SHOP_ADS_USED_UP_TOAST,
  SHOP_NOT_ENOUGH_COINS_TOAST,
} from '../constants/shop';
import { FONTS, HEADER_HEIGHT, KEY_EDGE_HEIGHT } from '../constants/theme';
import type { Inventory } from '../lib/gameStorage';
import { packDiscountPercent } from '../lib/shop';
import { useTheme, useThemeSnapshot } from '../lib/ThemeContext';

type Props = {
  // The push page's back arrow. Without it (the Shop tab) there's no arrow,
  // and the tab bar below owns the bottom safe area.
  onBack?: () => void;
  visible: boolean; // the page (or tab) is the one in front
  coins: number;
  inventory: Inventory;
  adsLeft: number; // rewarded ads still available today
  // App pays and saves (coins and inventory in one atomic write); only
  // called for an affordable pack.
  onBuyPack: (pack: ItemPack) => void | Promise<void>;
  // App shows the ad and, if it was watched, credits and saves it; only
  // called while ads are left today.
  onWatchAd: () => Promise<void>;
};

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
const ITEM_ICON_SIZE = 20;
const DIMMED_OPACITY = 0.45;

// A push page has the bottom safe area; as a tab, the tab bar below owns it.
const PAGE_EDGES = ['top', 'bottom', 'left', 'right'] as const;
const TAB_EDGES = ['top', 'left', 'right'] as const;

// The shop (ԽԱՆՈՒԹ): the Shop tab, and the page pushed over the game. A top bar
// (back arrow on the page only, title, live balance), then in a scroll view what the player
// holds (ՔՈ ՊԱՇԱՐԸ), item packs (ՀԶՈՐՈՒԹՅՈՒՆՆԵՐ) and coins (ՄԵՏԱՂԱԴՐԱՄՆԵՐ:
// a daily-limited rewarded ad, and real-money packs coming soon). An
// unaffordable pack or a used-up ad is dimmed but tappable, and explains why
// in a toast.
function ShopScreen({ onBack, visible, coins, inventory, adsLeft, onBuyPack, onWatchAd }: Props) {
  const { color, textColor } = useTheme();
  const { theme } = useThemeSnapshot();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const showToast = (message: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, message }));
  const [adLoading, setAdLoading] = useState(false);
  const adBusyRef = useRef(false); // a second tap while the ad loads is ignored

  const handlePack = (pack: ItemPack) => {
    if (coins < pack.price) {
      showToast(SHOP_NOT_ENOUGH_COINS_TOAST);
      return;
    }
    onBuyPack(pack);
  };

  const handleAd = async () => {
    if (adBusyRef.current) return;
    if (adsLeft <= 0) {
      showToast(SHOP_ADS_USED_UP_TOAST);
      return;
    }
    adBusyRef.current = true;
    setAdLoading(true);
    try {
      await onWatchAd();
    } finally {
      adBusyRef.current = false;
      setAdLoading(false);
    }
  };

  const itemIcon = (item: keyof Inventory) =>
    item === 'hint' ? (
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={ITEM_ICON_SIZE} tintColor={theme.keyText} />
    ) : (
      <BowIcon size={ITEM_ICON_SIZE} volleyId={0} shotCount={0} />
    );

  const card = (children: ReactNode, style?: object) => (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: color('popupSurface'), borderColor: color('popupBorder'), borderBottomColor: color('popupEdge') },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  const sectionTitle = (title: string) => (
    <Animated.Text style={[styles.sectionTitle, { color: textColor('textMuted') }]}>{title}</Animated.Text>
  );

  return (
    <AnimatedSafeAreaView
      style={[styles.screen, { backgroundColor: color('background') }]}
      edges={onBack ? PAGE_EDGES : TAB_EDGES}
      accessibilityElementsHidden={!visible}
    >
      {/* Same height and the same IconButton as the game's own header, so the
          back arrow lines up with the header's buttons. */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {onBack && (
            <IconButton
              icon={{ ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' }}
              label="Հետ"
              color={theme.headerIconColor}
              onPress={onBack}
            />
          )}
        </View>
        <Animated.Text style={[styles.title, { color: textColor('text') }]} numberOfLines={1} adjustsFontSizeToFit>
          ԽԱՆՈՒԹ
        </Animated.Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Animated.View testID="shop-balance" style={[styles.balance, { backgroundColor: color('pill') }]}>
            <Animated.Text style={[styles.balanceText, { color: textColor('pillText') }]}>{coins}</Animated.Text>
            <Coin size={20} />
          </Animated.View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {sectionTitle('ՔՈ ՊԱՇԱՐԸ')}
        <View style={styles.row}>
          {(['hint', 'darts'] as const).map((item) => (
            <View key={item} style={styles.half}>
              {card(
                <View style={styles.ownRow}>
                  <View style={styles.iconBadge}>{itemIcon(item)}</View>
                  <Animated.Text style={[styles.cardLabel, { color: textColor('popupText') }]}>{ITEM_NAMES[item]}</Animated.Text>
                  <View testID={`shop-own-${item}`}>
                    <Animated.Text style={[styles.ownCount, { color: textColor('popupText') }]}>{inventory[item]}</Animated.Text>
                  </View>
                </View>,
              )}
            </View>
          ))}
        </View>

        {sectionTitle('ՀԶՈՐՈՒԹՅՈՒՆՆԵՐ')}
        <View style={[styles.row, styles.wrap]}>
          {ITEM_PACKS.map((pack) => {
            const name = `${pack.quantity} ${ITEM_NAMES[pack.item]}`;
            const discount = packDiscountPercent(pack);
            const affordable = coins >= pack.price;
            return (
              <Pressable
                key={`${pack.item}-${pack.quantity}`}
                style={({ pressed }) => [styles.half, pressed && styles.pressed, !affordable && styles.dimmed]}
                onPress={() => handlePack(pack)}
                accessibilityRole="button"
                accessibilityLabel={`Գնել ${name}`}
              >
                {card(
                  <View style={styles.packContent}>
                    <View style={styles.iconBadge}>{itemIcon(pack.item)}</View>
                    <Animated.Text style={[styles.cardLabel, { color: textColor('popupText') }]}>{name}</Animated.Text>
                    <View style={styles.priceRow}>
                      <Coin size={16} />
                      <Animated.Text style={[styles.price, { color: textColor('popupTextMuted') }]}>{pack.price}</Animated.Text>
                    </View>
                  </View>,
                )}
                {discount > 0 && (
                  <Animated.View testID="pack-discount" style={[styles.tag, { backgroundColor: color('correct') }]}>
                    <Text style={styles.tagText}>{`-${discount}%`}</Text>
                  </Animated.View>
                )}
              </Pressable>
            );
          })}
        </View>

        {sectionTitle('ՄԵՏԱՂԱԴՐԱՄՆԵՐ')}
        <Pressable
          style={({ pressed }) => [pressed && styles.pressed, adsLeft <= 0 && styles.dimmed]}
          onPress={handleAd}
          accessibilityRole="button"
          accessibilityLabel="Դիտել գովազդ"
          accessibilityState={{ busy: adLoading }}
        >
          {card(
            <View style={styles.adRow}>
              <Animated.View style={[styles.playBadge, { backgroundColor: color('correct') }]}>
                <PlayIcon size={14} />
              </Animated.View>
              <View style={styles.adText}>
                <Animated.Text style={[styles.cardLabel, { color: textColor('popupText') }]}>
                  {adLoading ? 'ԲԵՌՆՎՈՒՄ Է…' : 'ԴԻՏԵԼ ԳՈՎԱԶԴ'}
                </Animated.Text>
                <View style={styles.adLeftRow}>
                  <Animated.Text style={[styles.price, { color: textColor('popupTextMuted') }]}>ԱՅՍՕՐ՝ </Animated.Text>
                  <View testID="ad-left">
                    <Animated.Text style={[styles.price, { color: textColor('popupTextMuted') }]}>
                      {adsLeft}/{AD_REWARDS_PER_DAY}
                    </Animated.Text>
                  </View>
                </View>
              </View>
              <View style={styles.priceRow}>
                <Animated.Text style={[styles.reward, { color: textColor('popupText') }]}>{`+${AD_REWARD_COINS}`}</Animated.Text>
                <Coin size={18} />
              </View>
            </View>,
          )}
        </Pressable>

        <View style={[styles.row, styles.coinPacks]}>
          {COIN_PACKS_COMING_SOON.map((amount) => (
            <View
              key={amount}
              testID="coin-pack"
              style={[styles.third, styles.dimmed]}
              accessible
              accessibilityLabel={`${amount} ՄԵՏԱՂԱԴՐԱՄ, ՇՈՒՏՈՎ`}
              accessibilityState={{ disabled: true }}
            >
              {card(
                <View style={styles.packContent}>
                  <Coin size={24} />
                  <Animated.Text style={[styles.cardLabel, { color: textColor('popupText') }]}>{amount}</Animated.Text>
                  <Text style={[styles.soon, { color: theme.popupTextMuted }]}>ՇՈՒՏՈՎ</Text>
                </View>,
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      {toast && <Toast key={toast.id} message={toast.message} onHidden={() => setToast(null)} />}
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
  headerSideRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: FONTS.title,
    fontWeight: '700',
    letterSpacing: 20 * 0.08,
    textAlign: 'center',
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  balanceText: {
    fontSize: 13,
    fontFamily: FONTS.title,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: FONTS.title,
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  half: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  third: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: KEY_EDGE_HEIGHT,
    padding: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  dimmed: {
    opacity: DIMMED_OPACITY,
  },
  ownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ownCount: {
    fontSize: 20,
    fontFamily: FONTS.title,
  },
  iconBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: FONTS.title,
  },
  packContent: {
    alignItems: 'center',
    gap: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    fontSize: 13,
    fontFamily: FONTS.body,
  },
  tag: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    color: '#ffffff', // fixed white on the green tag, like scored tiles
    fontSize: 11,
    fontFamily: FONTS.title,
  },
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adText: {
    flex: 1,
    gap: 2,
  },
  adLeftRow: {
    flexDirection: 'row',
  },
  reward: {
    fontSize: 16,
    fontFamily: FONTS.title,
  },
  coinPacks: {
    marginTop: 12,
  },
  soon: {
    fontSize: 11,
    fontFamily: FONTS.title,
    letterSpacing: 1,
  },
});

// Memoized: App re-renders on every keystroke (see the stable props there).
export default memo(ShopScreen);
