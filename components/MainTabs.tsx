import { memo, ReactNode, useLayoutEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import TabBar, { TabId, TABS } from './TabBar';
import { TAB_SLIDE_MS } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  active: TabId;
  onSelect: (tab: TabId) => void;
  contents: Record<TabId, ReactNode>; // memoized by App
};

// The main screen: the active tab's content above the always-visible tab bar.
// Tabs mount on their first visit and then stay mounted (keeping their state).
// A switch slides the old content out and the new one in toward the new tab's
// side (native driver, TAB_SLIDE_MS; reduced motion: instant). Once the slide
// is over, every inactive tab is display:'none' — never hidden by transform
// or opacity alone (on an Android device a view hidden only that way has
// been seen to stay on screen). The display switch sits on a plain outer
// view; the slide's transform on an inner Animated.View.
function MainTabs({ active, onSelect, contents }: Props) {
  const { reduceMotion } = useTheme();
  const { width } = useWindowDimensions();
  const [offsets] = useState(() => Object.fromEntries(TABS.map((t) => [t, new Animated.Value(0)])) as Record<TabId, Animated.Value>);
  const [visited, setVisited] = useState<TabId[]>([active]);
  // The tabs displayed: the active one, plus the one leaving during a slide.
  const [displayed, setDisplayed] = useState<TabId[]>([active]);
  const [switchFrom, setSwitchFrom] = useState<TabId | null>(null);
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (!visited.includes(active)) setVisited([...visited, active]);
    setDisplayed(reduceMotion ? [active] : [prevActive, active]);
    setSwitchFrom(reduceMotion ? null : prevActive);
  }

  // Layout effect: the new tab is placed off to its side before it's painted.
  useLayoutEffect(() => {
    if (switchFrom === null) {
      offsets[active].setValue(0);
      return;
    }
    const direction = TABS.indexOf(active) > TABS.indexOf(switchFrom) ? 1 : -1;
    offsets[active].setValue(direction * width);
    const slide = Animated.parallel([
      Animated.timing(offsets[switchFrom], {
        toValue: -direction * width,
        duration: TAB_SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(offsets[active], { toValue: 0, duration: TAB_SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    slide.start(({ finished }) => {
      if (!finished) return; // a newer switch took over
      setDisplayed([active]);
      setSwitchFrom(null);
    });
    return () => slide.stop();
    // `width` is read at switch time; a resize mid-slide doesn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, switchFrom, offsets]);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        {visited.map((tab) => {
          const isActive = tab === active;
          return (
            <View
              key={tab}
              testID={`tab-${tab}`}
              style={[StyleSheet.absoluteFill, !displayed.includes(tab) && styles.hidden]}
              pointerEvents={isActive ? 'auto' : 'none'}
              accessibilityElementsHidden={!isActive}
              importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
            >
              <Animated.View style={[styles.screen, { transform: [{ translateX: offsets[tab] }] }]}>{contents[tab]}</Animated.View>
            </View>
          );
        })}
      </View>
      <TabBar active={active} onSelect={onSelect} />
    </View>
  );
}

export default memo(MainTabs);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  hidden: {
    display: 'none',
  },
});
