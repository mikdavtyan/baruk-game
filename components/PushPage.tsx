import { memo, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, PanResponder, PanResponderInstance, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  PAGE_CLOSE_MS,
  PAGE_GAME_PARALLAX_FRACTION,
  PAGE_OPEN_MS,
  PAGE_REDUCED_MOTION_MS,
  PAGE_SWIPE_CANCEL_DURATION_MS,
  PAGE_SWIPE_CANCEL_VELOCITY,
  PAGE_SWIPE_COMPLETE_MAX_MS,
  PAGE_SWIPE_COMPLETE_MIN_MS,
  PAGE_SWIPE_COMPLETE_PROGRESS,
  PAGE_SWIPE_COMPLETE_VELOCITY,
  PAGE_SWIPE_DIRECTION_LOCK_PX,
  PAGE_SWIPE_DIRECTION_RATIO,
  PAGE_SWIPE_EDGE_ZONE,
  PAGE_SWIPE_MIN_VELOCITY,
} from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useStableCallback } from '../lib/useStableCallback';

// A full page pushed in over the game like an iOS navigation push (the
// shop), recovered from the old "How to play" page (before b41380f). One
// Animated.Value (`push`, 0 = closed, 1 = open) drives both screens: the
// page slides in from the right while the game slides slightly left under a
// dim. It closes with its back button, Android's back button, or on iOS a
// swipe from the left edge — the drag IS the same animation, finger-driven.
// Once opened, the page stays mounted. Reduced motion: no movement, the page
// just fades in over the game. App owns one controller (`usePushPage`) per
// page, applies `gameTranslateX` to the game screen and renders the page
// inside `PushPageLayer`.

const PUSH_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export type PushPageController = {
  everOpened: boolean; // mounts the page the first time it opens, then keeps it
  onTop: boolean; // the page is the screen in front (drives inertness, not animation)
  // The page can be seen: from the moment open() starts until a close has
  // fully finished (a swipe's drag included). While false, PushPageLayer hides
  // the page with a plain opacity 0 + pointerEvents none, whatever its
  // transform says.
  shown: boolean;
  open: () => void;
  close: () => void;
  panHandlers: PanResponderInstance['panHandlers'];
  gameTranslateX: Animated.WithAnimatedValue<number>;
  dimOpacity: Animated.WithAnimatedValue<number>;
  pageTranslateX: Animated.WithAnimatedValue<number>;
  pageOpacity: Animated.WithAnimatedValue<number>;
};

// `isCovered` (read at back-press time): something above the page (a popup,
// another page) handles Android back first, so this page lets it.
export function usePushPage({ isCovered }: { isCovered?: () => boolean } = {}): PushPageController {
  const { reduceMotion } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [push] = useState(() => new Animated.Value(0));
  const [everOpened, setEverOpened] = useState(false);
  const [onTop, setOnTop] = useState(false);
  const [shown, setShown] = useState(false);
  // Guards against a second open/close firing mid-animation (the buttons,
  // the hardware back button and a swipe all check it).
  const animatingRef = useRef(false);

  // Stable identities (and a memoized controller below), so App's frequent
  // re-renders never re-render the page or rebuild its animated nodes.
  const open = useStableCallback(() => {
    if (animatingRef.current || onTop) return;
    animatingRef.current = true;
    setEverOpened(true);
    setOnTop(true);
    setShown(true); // visible before the two frames the slide waits for
    // Mount before animating, and wait two frames so the page is laid out
    // and styled first — it must never flash unstyled or empty.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Animated.timing(push, {
          toValue: 1,
          duration: reduceMotion ? PAGE_REDUCED_MOTION_MS : PAGE_OPEN_MS,
          easing: reduceMotion ? Easing.linear : PUSH_EASING,
          useNativeDriver: true,
        }).start(() => {
          animatingRef.current = false;
        });
      });
    });
  });

  const close = useStableCallback(() => {
    if (animatingRef.current || !onTop) return;
    animatingRef.current = true;
    Animated.timing(push, {
      toValue: 0,
      duration: reduceMotion ? PAGE_REDUCED_MOTION_MS : PAGE_CLOSE_MS,
      easing: reduceMotion ? Easing.linear : PUSH_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      animatingRef.current = false;
      if (finished) {
        setOnTop(false);
        setShown(false);
      }
    });
  });

  const isCoveredRef = useRef(isCovered);
  useLayoutEffect(() => {
    isCoveredRef.current = isCovered;
  });
  // Android's hardware/gesture back button closes the page (with the same
  // animation) instead of exiting the app, whenever it's the one on top.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!onTop || isCoveredRef.current?.()) return false;
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTop]);

  // A completed swipe has already moved `push` to 0 itself, so it must not
  // replay the close animation — just mark the page closed.
  const finishCloseNoAnimation = () => {
    animatingRef.current = false;
    setOnTop(false);
    setShown(false);
  };

  // iOS-only edge-swipe-to-go-back (Android has its back button). The
  // PanResponder is created once (a live gesture's handlers mustn't change
  // identity mid-drag), so it reads onTop/windowWidth from refs kept in sync
  // after every commit.
  const onTopRef = useRef(onTop);
  const windowWidthRef = useRef(windowWidth);
  useLayoutEffect(() => {
    onTopRef.current = onTop;
    windowWidthRef.current = windowWidth;
  });
  const swipeCancelledRef = useRef(false);

  const animateSwipeCancel = () => {
    Animated.timing(push, {
      toValue: 1,
      duration: PAGE_SWIPE_CANCEL_DURATION_MS,
      easing: PUSH_EASING,
      useNativeDriver: true,
    }).start(() => {
      animatingRef.current = false;
    });
  };

  // The handlers only read refs during gesture events, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [swipeResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (Platform.OS !== 'ios') return false;
        if (animatingRef.current || !onTopRef.current) return false;
        if (evt.nativeEvent.touches.length > 1) return false;
        if (gestureState.x0 > PAGE_SWIPE_EDGE_ZONE) return false;
        const { dx, dy } = gestureState;
        if (Math.abs(dx) < PAGE_SWIPE_DIRECTION_LOCK_PX) return false;
        return dx > 0 && Math.abs(dx) > Math.abs(dy) * PAGE_SWIPE_DIRECTION_RATIO;
      },
      onPanResponderGrant: () => {
        swipeCancelledRef.current = false;
        // Blocks the buttons and a second gesture from starting — exactly
        // like being mid-animation, since this drag *is* one.
        animatingRef.current = true;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (swipeCancelledRef.current) return;
        if (evt.nativeEvent.touches.length > 1) {
          // A second finger touched — cancel now rather than waiting for release.
          swipeCancelledRef.current = true;
          animateSwipeCancel();
          return;
        }
        const progress = Math.max(0, Math.min(1, gestureState.dx / windowWidthRef.current));
        push.setValue(1 - progress);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (swipeCancelledRef.current) return;
        const progress = Math.max(0, Math.min(1, gestureState.dx / windowWidthRef.current));
        const velocity = gestureState.vx;
        const shouldComplete =
          velocity < PAGE_SWIPE_CANCEL_VELOCITY
            ? false
            : progress > PAGE_SWIPE_COMPLETE_PROGRESS || velocity > PAGE_SWIPE_COMPLETE_VELOCITY;

        if (shouldComplete) {
          const remainingPx = windowWidthRef.current - gestureState.dx;
          const duration = Math.max(
            PAGE_SWIPE_COMPLETE_MIN_MS,
            Math.min(PAGE_SWIPE_COMPLETE_MAX_MS, remainingPx / Math.max(velocity, PAGE_SWIPE_MIN_VELOCITY)),
          );
          Animated.timing(push, {
            toValue: 0,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              finishCloseNoAnimation();
            } else {
              animatingRef.current = false;
            }
          });
        } else {
          animateSwipeCancel();
        }
      },
      onPanResponderTerminate: () => {
        if (swipeCancelledRef.current) return;
        swipeCancelledRef.current = true;
        animateSwipeCancel();
      },
    }),
  );

  // The animated nodes are built ONCE. The window width and reduced motion
  // are Animated.Values fed into them (setValue), never new nodes: swapping a
  // native-driven node makes RN restore the view's default props (translateX
  // 0) without re-applying the new node — a page could then sit on screen.
  const [widthValue] = useState(() => new Animated.Value(windowWidth));
  const [motion] = useState(() => new Animated.Value(reduceMotion ? 0 : 1)); // 0 = reduced motion
  useLayoutEffect(() => {
    widthValue.setValue(windowWidth);
  }, [windowWidth, widthValue]);
  useLayoutEffect(() => {
    motion.setValue(reduceMotion ? 0 : 1);
  }, [reduceMotion, motion]);
  const [nodes] = useState(() => {
    const remaining = push.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }); // 1 = fully out
    return {
      // Slides in from the right (no movement under reduced motion).
      pageTranslateX: Animated.multiply(Animated.multiply(remaining, widthValue), motion),
      // The screen under it drifts slightly left.
      gameTranslateX: Animated.multiply(
        Animated.multiply(push, widthValue),
        motion.interpolate({ inputRange: [0, 1], outputRange: [0, -PAGE_GAME_PARALLAX_FRACTION] }),
      ),
      dimOpacity: Animated.multiply(push.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }), motion),
      // Opaque normally; under reduced motion the page fades in instead.
      pageOpacity: Animated.add(push, motion).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    };
  });
  return useMemo(
    () => ({ everOpened, onTop, shown, open, close, panHandlers: swipeResponder.panHandlers, ...nodes }),
    [everOpened, onTop, shown, open, close, swipeResponder, nodes],
  );
}

// The dim over the game and the sliding page itself. Render it above the
// game screen (whose transform comes from `page.gameTranslateX`).
// `preMount` mounts the page right away (offscreen and inert) instead of on
// its first open — for a heavy page (the game) whose first push must not
// also pay for mounting it.
export const PushPageLayer = memo(function PushPageLayer({
  page,
  children,
  preMount = false,
  testID,
}: {
  page: PushPageController;
  children: ReactNode;
  preMount?: boolean;
  testID?: string;
}) {
  // The frame hides a page that isn't shown with a plain (non-animated)
  // opacity 0 + pointerEvents none — so a closed page can never cover what's
  // under it, even if its native transform were wrong. It stays mounted.
  return (
    <View
      testID={testID ? `${testID}-frame` : undefined}
      style={[StyleSheet.absoluteFill, !page.shown && styles.closed]}
      pointerEvents={page.shown ? 'box-none' : 'none'}
    >
      {page.shown && <Animated.View style={[styles.dim, { opacity: page.dimOpacity }]} pointerEvents="none" />}
      {(page.everOpened || preMount) && (
        <Animated.View
          testID={testID}
          style={[
            styles.page,
            { transform: [{ translateX: page.pageTranslateX }], opacity: page.pageOpacity },
            Platform.OS === 'ios' && styles.pageShadow,
          ]}
          pointerEvents={page.onTop ? 'auto' : 'none'}
          importantForAccessibility={page.onTop ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!page.onTop}
          {...page.panHandlers}
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  closed: {
    opacity: 0,
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // A solid background of its own — the page must never show the game (or
    // anything else) through it while sliding.
    backgroundColor: '#000',
  },
  // A soft shadow on the page's left edge while it slides — iOS only.
  // Android's `elevation` draws a shadow around the whole view, not just one
  // edge, so it's skipped there rather than looking wrong.
  pageShadow: {
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
});
