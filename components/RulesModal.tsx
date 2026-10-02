import { useEffect, useState } from 'react';
import { Animated, BackHandler, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconButton from './IconButton';
import ModalBackdrop from './ModalBackdrop';
import RulesCard from './RulesCard';
import {
  FONTS,
  KEY_EDGE_HEIGHT,
  RULES_MODAL_CLOSE_MS,
  RULES_MODAL_OPEN_MS,
  RULES_MODAL_START_SCALE,
  RULES_REDUCED_MOTION_DURATION_MS,
} from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

// The "How to play" popup: a centered panel over the shared modal backdrop,
// holding the rules (RulesCard). Only the X button or Android's back button
// close it — tapping the backdrop doesn't. It fades in while scaling up, and
// back out, on the native driver; reduced motion is a plain short fade. It
// stays mounted until its close animation ends, then renders nothing.
export default function RulesModal({ open, onClose }: Props) {
  const { theme, color, reduceMotion } = useTheme();
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }
  const [progress] = useState(() => new Animated.Value(0)); // 0 = closed, 1 = open
  // Bumped when an open animation finishes: RulesCard's example tiles flip
  // in only then.
  const [revealTrigger, setRevealTrigger] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    const duration = reduceMotion ? RULES_REDUCED_MOTION_DURATION_MS : open ? RULES_MODAL_OPEN_MS : RULES_MODAL_CLOSE_MS;
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (open) setRevealTrigger((n) => n + 1);
      else setMounted(false);
    });
    return () => animation.stop();
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

  const scale = reduceMotion
    ? 1
    : progress.interpolate({ inputRange: [0, 1], outputRange: [RULES_MODAL_START_SCALE, 1] });

  return (
    // Fills the screen and takes every touch, so the backdrop blocks the game
    // underneath without closing the popup.
    <View style={StyleSheet.absoluteFill} pointerEvents="auto" accessibilityViewIsModal>
      <ModalBackdrop opacity={progress} />
      <SafeAreaView style={styles.center} edges={['top', 'bottom', 'left', 'right']} pointerEvents="box-none">
        {/* Opacity and scale (native driver) on this node; the themed colors on
            the inner one — never both on the same node. */}
        <Animated.View style={[styles.panelFrame, { opacity: progress, transform: [{ scale }] }]}>
          <Animated.View
            style={[
              styles.panel,
              {
                backgroundColor: color('rulesSurface'),
                borderColor: color('rulesBorder'),
                borderBottomColor: color('rulesEdge'),
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerSide} />
              <Animated.Text style={[styles.title, { color: color('rulesText') }]} numberOfLines={1} adjustsFontSizeToFit>
                ԻՆՉՊԵ՞Ս ԽԱՂԱԼ
              </Animated.Text>
              <View style={[styles.headerSide, styles.headerSideRight]}>
                <IconButton
                  icon={{ ios: 'xmark', android: 'close', web: 'close' }}
                  label="Փակել"
                  color={theme.rulesTextMuted}
                  onPress={onClose}
                />
              </View>
            </View>
            {/* Scrolls only on screens too short for the whole panel. */}
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <RulesCard revealTrigger={revealTrigger} visible={open} />
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
