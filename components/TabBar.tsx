import { memo, ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookIcon, GearIcon, HouseIcon, PodiumIcon, ShopCartIcon } from './TabIcons';
import {
  FONTS,
  TAB_ACTIVATE_MS,
  TAB_BADGE_PULSE_MS,
  TAB_BAR_HEIGHT,
  TAB_BAR_INSET,
  TAB_BAR_RADIUS,
  TAB_BUBBLE_INSET,
  TAB_ICON_ACTIVE_SCALE,
  TAB_ICON_LIFT,
  TAB_ICON_SIZE,
  TAB_INACTIVE_OPACITY,
  TAB_LABEL_START_SCALE,
  TAB_WIGGLE_MS,
} from '../constants/theme';
import { useTheme, useThemeSnapshot } from '../lib/ThemeContext';
import { useLoopWhile } from '../lib/useLoopWhile';

// The main screen's tabs, left to right; Home (the menu) is the center one.
export const TABS = ['shop', 'tasks', 'home', 'leaders', 'settings'] as const;
export type TabId = (typeof TABS)[number];
export const TAB_LABELS: Record<TabId, string> = {
  shop: 'ԽԱՆՈՒԹ',
  tasks: 'ԱՌԱՋԱԴՐԱՆՔՆԵՐ',
  home: 'ՄԵՆՅՈՒ',
  leaders: 'ԱՌԱՋԱՏԱՐՆԵՐ',
  settings: 'ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ',
};

// Custom game icons in the fortune wheel's style (TabIcons.tsx): fixed
// colors, so a theme toggle never re-renders them.
const ICONS: Record<TabId, (props: { size?: number }) => ReactNode> = {
  shop: ShopCartIcon,
  tasks: BookIcon,
  home: HouseIcon,
  leaders: PodiumIcon,
  settings: GearIcon,
};
const icon = (tab: TabId): ReactNode => {
  const Icon = ICONS[tab];
  return <Icon size={TAB_ICON_SIZE} />;
};

// The main screen's floating tab bar: inset from the screen edges, rounded,
// a surface with a line border and a soft shadow (iOS: over a static blur;
// Android: near-opaque, no blur). A raised bubble springs between the tabs
// (one native index value → translateX); the active tab's icon lifts, grows
// and wiggles, its name appears under it; inactive icons are a little washed
// out. Per tab one 0→1 value (native, built once) drives the lift and the
// label; reduced motion sets everything at once. Labels stay mounted only
// while shown (the active tab's, and the old one's until it has faded).
export type TabBadges = Partial<Record<TabId, boolean>>;
const NO_BADGES: TabBadges = {};

type TabNodes = {
  lift: Animated.AnimatedInterpolation<number>;
  iconScale: Animated.AnimatedInterpolation<number>;
  iconOpacity: Animated.AnimatedInterpolation<number>;
  labelScale: Animated.AnimatedInterpolation<number>;
  wiggleRotate: Animated.AnimatedInterpolation<string>;
  wiggleScale: Animated.AnimatedInterpolation<number>;
};

// The iOS blur behind the bar — its tint follows the theme, so it's a small
// snapshot-reading leaf. Static: nothing animates the blur.
const BarBlur = memo(function BarBlur() {
  const { isDark } = useThemeSnapshot();
  return <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />;
});

// The pulsing notification dot (Tasks while a reward waits): a dot and a ring
// growing out of it and fading, one native loop.
function BadgeDot({ tab }: { tab: TabId }) {
  const { color, reduceMotion } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => ({
    scale: pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 2.2, 2.2] }),
    opacity: pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0, 0] }),
  }));
  useLoopWhile(
    !reduceMotion,
    () => Animated.loop(Animated.timing(pulse, { toValue: 1, duration: TAB_BADGE_PULSE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    () => pulse.setValue(0),
  );
  return (
    <View testID={`tab-badge-${tab}`} style={styles.badge} pointerEvents="none">
      <Animated.View
        style={[styles.badgeRing, { backgroundColor: color('accent'), opacity: ring.opacity, transform: [{ scale: ring.scale }] }]}
      />
      <Animated.View style={[styles.badgeDot, { backgroundColor: color('accent'), borderColor: color('surface') }]} />
    </View>
  );
}

// `badges`: a pulsing dot on a tab's icon (e.g. Tasks while a reward waits).
function TabBar({ active, onSelect, badges = NO_BADGES }: { active: TabId; onSelect: (tab: TabId) => void; badges?: TabBadges }) {
  const { color, textColor, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [values] = useState(
    () => Object.fromEntries(TABS.map((t) => [t, new Animated.Value(t === active ? 1 : 0)])) as Record<TabId, Animated.Value>,
  );
  const [wiggles] = useState(() => Object.fromEntries(TABS.map((t) => [t, new Animated.Value(1)])) as Record<TabId, Animated.Value>);
  const [nodes] = useState(
    () =>
      Object.fromEntries(
        TABS.map((t) => {
          const v = values[t];
          const w = wiggles[t];
          return [
            t,
            {
              lift: v.interpolate({ inputRange: [0, 1], outputRange: [0, -TAB_ICON_LIFT] }),
              iconScale: v.interpolate({ inputRange: [0, 1], outputRange: [1, TAB_ICON_ACTIVE_SCALE] }),
              iconOpacity: v.interpolate({ inputRange: [0, 1], outputRange: [TAB_INACTIVE_OPACITY, 1], extrapolate: 'clamp' }),
              labelScale: v.interpolate({ inputRange: [0, 1], outputRange: [TAB_LABEL_START_SCALE, 1] }),
              wiggleRotate: w.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: ['0deg', '-10deg', '6deg', '0deg'] }),
              wiggleScale: w.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [1, 1.08, 0.98, 1] }),
            },
          ];
        }),
      ) as Record<TabId, TabNodes>,
  );
  // The bubble: built once; the cell width is fed in with setValue (a resize
  // never rebuilds the native node — see PushPage.tsx's safety rule).
  const [bubbleIndex] = useState(() => new Animated.Value(TABS.indexOf(active)));
  const [cellWidth] = useState(() => new Animated.Value(0));
  const [bubbleX] = useState(() => Animated.multiply(bubbleIndex, cellWidth));
  const barWidth = width - TAB_BAR_INSET * 2;
  const cell = (barWidth - TAB_BUBBLE_INSET * 2) / TABS.length;
  useLayoutEffect(() => {
    cellWidth.setValue(cell);
  }, [cell, cellWidth]);

  const [labelled, setLabelled] = useState<TabId[]>([active]);
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    setLabelled((shown) => (reduceMotion ? [active] : [...shown.filter((t) => t !== active), active]));
  }
  useEffect(() => {
    if (reduceMotion) {
      TABS.forEach((t) => values[t].setValue(t === active ? 1 : 0));
      bubbleIndex.setValue(TABS.indexOf(active));
      return;
    }
    wiggles[active].setValue(0);
    const switching = Animated.parallel([
      ...TABS.map((t) =>
        Animated.timing(values[t], {
          toValue: t === active ? 1 : 0,
          duration: TAB_ACTIVATE_MS,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ),
      Animated.spring(bubbleIndex, { toValue: TABS.indexOf(active), friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(wiggles[active], { toValue: 1, duration: TAB_WIGGLE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    switching.start(({ finished }) => {
      if (finished) setLabelled([active]); // the old tab's name has faded
    });
    return () => switching.stop();
  }, [active, reduceMotion, values, wiggles, bubbleIndex]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { bottom: TAB_BAR_INSET + insets.bottom, left: TAB_BAR_INSET, right: TAB_BAR_INSET }]}
    >
      <Animated.View
        testID="tab-bar"
        style={[styles.bar, { backgroundColor: color('surface'), borderColor: color('border') }]}
      >
        <View style={styles.clip} pointerEvents="none">
          {Platform.OS === 'ios' && (
            <>
              <BarBlur />
              <Animated.View style={[StyleSheet.absoluteFill, styles.iosTint, { backgroundColor: color('surface') }]} />
            </>
          )}
          <Animated.View
            style={[
              styles.bubble,
              { width: cell, backgroundColor: color('raised'), borderBottomColor: color('keyEdge'), transform: [{ translateX: bubbleX }] },
            ]}
          />
        </View>
        {TABS.map((tab) => {
          const isActive = tab === active;
          const n = nodes[tab];
          return (
            <Pressable
              key={tab}
              style={styles.cell}
              onPress={() => onSelect(tab)}
              accessibilityRole="tab"
              accessibilityLabel={TAB_LABELS[tab]}
              accessibilityState={{ selected: isActive }}
            >
              <Animated.View
                style={{
                  opacity: n.iconOpacity,
                  transform: [{ translateY: n.lift }, { scale: n.iconScale }, { rotate: n.wiggleRotate }, { scale: n.wiggleScale }],
                }}
              >
                {icon(tab)}
              </Animated.View>
              {badges[tab] && <BadgeDot tab={tab} />}
              {labelled.includes(tab) && (
                <Animated.Text
                  style={[
                    styles.label,
                    { color: textColor('text'), opacity: values[tab], transform: [{ scale: n.labelScale }] },
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
    </View>
  );
}

export default memo(TabBar);

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    height: TAB_BAR_HEIGHT,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: TAB_BUBBLE_INSET,
    borderRadius: TAB_BAR_RADIUS,
    borderWidth: 1.5,
    // A soft shadow under the floating bar (static).
    shadowColor: '#05000F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: TAB_BAR_RADIUS,
    overflow: 'hidden',
  },
  iosTint: {
    opacity: 0.86,
  },
  bubble: {
    position: 'absolute',
    top: TAB_BUBBLE_INSET - 1.5,
    bottom: TAB_BUBBLE_INSET - 1.5,
    left: TAB_BUBBLE_INSET - 1.5,
    borderRadius: 20,
    borderBottomWidth: 3,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A pulsing pomegranate dot on the icon's top-right corner.
  badge: {
    position: 'absolute',
    top: 9,
    left: '50%',
    marginLeft: 8,
    width: 12,
    height: 12,
  },
  badgeRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 6,
  },
  badgeDot: {
    ...StyleSheet.absoluteFill,
    borderRadius: 6,
    borderWidth: 2,
  },
  label: {
    position: 'absolute',
    bottom: 8,
    left: 2,
    right: 2,
    textAlign: 'center',
    fontFamily: FONTS.title,
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
});
