import { memo, ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FortuneWheelIcon from './FortuneWheelIcon';
import { ThemedSymbol } from './ThemedSnapshot';
import {
  FONTS,
  TAB_ACTIVATE_MS,
  TAB_BAR_HEIGHT,
  TAB_ICON_ACTIVE_SCALE,
  TAB_ICON_SIZE,
  TAB_LABEL_START_SCALE,
  TAB_PLATE_SIZE,
  TAB_RAISE,
} from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

// The main screen's tabs, left to right; Home (the menu) is the center one.
export const TABS = ['shop', 'wheel', 'home', 'tasks', 'leaders'] as const;
export type TabId = (typeof TABS)[number];
export const TAB_LABELS: Record<TabId, string> = {
  shop: 'ԽԱՆՈՒԹ',
  wheel: 'ԱՆԻՎ',
  home: 'ՄԵՆՅՈՒ',
  tasks: 'ԱՌԱՋԱԴՐԱՆՔՆԵՐ',
  leaders: 'ԱՌԱՋԱՏԱՐՆԵՐ',
};

const SYMBOLS: Record<Exclude<TabId, 'wheel'>, SymbolViewProps['name']> = {
  shop: { ios: 'bag.fill', android: 'shopping_bag', web: 'shopping_bag' },
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  tasks: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
  leaders: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
};
const icon = (tab: TabId): ReactNode =>
  tab === 'wheel' ? (
    <FortuneWheelIcon size={TAB_ICON_SIZE + 4} />
  ) : (
    <ThemedSymbol name={SYMBOLS[tab]} size={TAB_ICON_SIZE} token="headerIconColor" />
  );

// A mobile-game tab bar, always at the bottom of the main screen. The active
// tab's cell rises on a raised plate, its icon grows (TAB_ICON_ACTIVE_SCALE)
// and its name fades + scales in under it; inactive tabs are just their icon.
// A switch animates the new tab up and the old one back down together: one
// 0→1 value per tab on the native driver (transform/opacity only), built
// once; reduced motion sets them at once. Labels stay mounted only while
// shown (the active tab's, and the old one's until it has faded).
function TabBar({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  const { color, textColor, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [values] = useState(() => Object.fromEntries(TABS.map((t) => [t, new Animated.Value(t === active ? 1 : 0)])) as Record<TabId, Animated.Value>);
  const [nodes] = useState(() =>
    Object.fromEntries(
      TABS.map((t) => {
        const v = values[t];
        return [
          t,
          {
            raise: v.interpolate({ inputRange: [0, 1], outputRange: [0, -TAB_RAISE] }),
            iconScale: v.interpolate({ inputRange: [0, 1], outputRange: [1, TAB_ICON_ACTIVE_SCALE] }),
            labelScale: v.interpolate({ inputRange: [0, 1], outputRange: [TAB_LABEL_START_SCALE, 1] }),
          },
        ];
      }),
    ) as Record<TabId, { raise: Animated.AnimatedInterpolation<number>; iconScale: Animated.AnimatedInterpolation<number>; labelScale: Animated.AnimatedInterpolation<number> }>,
  );

  const [labelled, setLabelled] = useState<TabId[]>([active]);
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    setLabelled((shown) => (reduceMotion ? [active] : [...shown.filter((t) => t !== active), active]));
  }
  useEffect(() => {
    if (reduceMotion) {
      TABS.forEach((t) => values[t].setValue(t === active ? 1 : 0));
      return;
    }
    const switching = Animated.parallel(
      TABS.map((t) =>
        Animated.timing(values[t], {
          toValue: t === active ? 1 : 0,
          duration: TAB_ACTIVATE_MS,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ),
    );
    switching.start(({ finished }) => {
      if (finished) setLabelled([active]); // the old tab's name has faded
    });
    return () => switching.stop();
  }, [active, reduceMotion, values]);

  return (
    <Animated.View
      testID="tab-bar"
      style={[
        styles.bar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: color('popupSurface'),
          borderTopColor: color('popupBorder'),
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <Pressable
            key={tab}
            style={styles.cell}
            onPress={() => onSelect(tab)}
            accessibilityRole="tab"
            accessibilityLabel={TAB_LABELS[tab]}
            accessibilityState={{ selected: isActive }}
          >
            {/* The raised plate behind the active icon. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.plate,
                {
                  backgroundColor: color('popupSurface'),
                  borderColor: color('popupBorder'),
                  borderBottomColor: color('popupEdge'),
                  opacity: values[tab],
                  transform: [{ translateY: nodes[tab].raise }],
                },
              ]}
            />
            <Animated.View style={{ transform: [{ translateY: nodes[tab].raise }, { scale: nodes[tab].iconScale }] }}>
              {icon(tab)}
            </Animated.View>
            {labelled.includes(tab) && (
              <Animated.Text
                style={[
                  styles.label,
                  { color: textColor('headerValueColor'), opacity: values[tab], transform: [{ scale: nodes[tab].labelScale }] },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {TAB_LABELS[tab]}
              </Animated.Text>
            )}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

export default memo(TabBar);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    overflow: 'visible',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  plate: {
    position: 'absolute',
    width: TAB_PLATE_SIZE,
    height: TAB_PLATE_SIZE,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  label: {
    position: 'absolute',
    bottom: 3,
    left: 2,
    right: 2,
    textAlign: 'center',
    fontFamily: FONTS.title,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
