import { ReactNode, useEffect, useState } from 'react';
import { Animated, BackHandler, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconButton from './IconButton';
import ModalBackdrop from './ModalBackdrop';
import {
  FONTS,
  KEY_EDGE_HEIGHT,
  POPUP_CLOSE_MS,
  POPUP_OPEN_MS,
  POPUP_REDUCED_MOTION_MS,
  POPUP_START_SCALE,
} from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  // Called each time an open animation finishes (e.g. RulesCard's example
  // tiles flip in only then).
  onOpened?: () => void;
  children?: ReactNode;
};

// The popup shell ("How to play" — RulesModal): a centered panel over the
// shared modal backdrop, with a title and an X. Only the X or
// Android's back button close it — tapping the backdrop doesn't. It fades in
// while scaling up, and back out, on the native driver; reduced motion is a
// plain short fade. It stays mounted until its close animation ends, then
// renders nothing.
export default function PopupModal({ open, onClose, title, onOpened, children }: Props) {
  const { theme, color, textColor, reduceMotion } = useTheme();
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }
  const [progress] = useState(() => new Animated.Value(0)); // 0 = closed, 1 = open

  useEffect(() => {
    if (!mounted) return;
    const duration = reduceMotion ? POPUP_REDUCED_MOTION_MS : open ? POPUP_OPEN_MS : POPUP_CLOSE_MS;
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (open) onOpened?.();
      else setMounted(false);
    });
    return () => animation.stop();
    // onOpened is a fire-once notification, not something to restart for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted, reduceMotion, progress]);

  // Android's back button closes the popup while it's open (and is used up
  // doing so); otherwise back goes to the system as usual.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!mounted) return null;

  const scale = reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [POPUP_START_SCALE, 1] });

  return (
    // Fills the screen and takes every touch, so the backdrop blocks the game
    // underneath without closing the popup.
    <View style={StyleSheet.absoluteFill} pointerEvents="auto" accessibilityViewIsModal>
      <ModalBackdrop opacity={progress} />
      <SafeAreaView style={styles.center} edges={['top', 'bottom', 'left', 'right']} pointerEvents="box-none">
        {/* Opacity and scale on this node; the themed colors on the inner one. */}
        <Animated.View style={[styles.panelFrame, { opacity: progress, transform: [{ scale }] }]}>
          <Animated.View
            style={[
              styles.panel,
              {
                backgroundColor: color('popupSurface'),
                borderColor: color('popupBorder'),
                borderBottomColor: color('popupEdge'),
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerSide} />
              <Animated.Text style={[styles.title, { color: textColor('popupText') }]} numberOfLines={1} adjustsFontSizeToFit>
                {title}
              </Animated.Text>
              <View style={[styles.headerSide, styles.headerSideRight]}>
                <IconButton
                  icon={{ ios: 'xmark', android: 'close', web: 'close' }}
                  label="Փակել"
                  color={theme.popupTextMuted}
                  onPress={onClose}
                />
              </View>
            </View>
            {/* Scrolls only on screens too short for the whole panel. */}
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const HEADER_SIDE_WIDTH = 40; // = IconButton's own width, so the title stays centered

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  panelFrame: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '100%',
  },
  panel: {
    flexShrink: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderBottomWidth: KEY_EDGE_HEIGHT,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  headerSide: {
    width: HEADER_SIDE_WIDTH,
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
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
});
