import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import ScreenGlow from './ScreenGlow';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Button3D from './Button3D';
import Coin from './Coin';
import CoinFlight from './CoinFlight';
import { COIN_FLIGHT_PIECES } from '../constants/winFlow';
import { TASK_DEFS, TaskId, TASKS_REFRESH_NOTE } from '../constants/tasks';
import {
  FONTS,
  TAB_BAR_SPACE,
  TASK_BAR_FILL_DELAY_MS,
  TASK_BAR_FILL_MS,
  TASK_CLAIM_PULSE_MS,
  TASK_STRIPES_MS,
} from '../constants/theme';
import { measureWindow, WindowRect } from '../lib/measureWindow';
import { DailyTasks, isClaimable } from '../lib/tasks';
import { useTheme } from '../lib/ThemeContext';
import { playSound } from '../lib/sounds';
import { useLoopWhile } from '../lib/useLoopWhile';
import TabEnter from './TabEnter';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
// The tab bar below owns the bottom safe area.
const EDGES = ['top', 'left', 'right'] as const;
const CLAIM_HEIGHT = 40;
const STRIPE_PERIOD = 16; // px between the progress fill's stripes

// A task's progress bar: the green fill slides in from the left to its share
// each time the tab is shown (a translateX of a full-width fill inside the
// clipped track — a transform, never a width animation, so its stripes stay
// undistorted), and a shimmer of diagonal stripes drifts along it. The track
// width is fed in with setValue, so the native nodes are built once.
function TaskProgress({ fraction, visible }: { fraction: number; visible: boolean }) {
  const { color, reduceMotion } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [fill] = useState(() => new Animated.Value(fraction));
  const [widthValue] = useState(() => new Animated.Value(0));
  const [fillX] = useState(() => Animated.multiply(Animated.add(fill, -1), widthValue));
  const [stripes] = useState(() => new Animated.Value(0));
  const [stripesX] = useState(() => stripes.interpolate({ inputRange: [0, 1], outputRange: [-STRIPE_PERIOD, 0] }));

  useEffect(() => {
    widthValue.setValue(trackWidth);
  }, [trackWidth, widthValue]);
  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      fill.setValue(fraction);
      return;
    }
    fill.setValue(0);
    const grow = Animated.timing(fill, {
      toValue: fraction,
      duration: TASK_BAR_FILL_MS,
      delay: TASK_BAR_FILL_DELAY_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    grow.start();
    return () => {
      grow.stop();
      fill.setValue(fraction);
    };
  }, [visible, fraction, reduceMotion, fill]);
  useLoopWhile(
    visible && !reduceMotion && fraction > 0,
    () => Animated.loop(Animated.timing(stripes, { toValue: 1, duration: TASK_STRIPES_MS, easing: Easing.linear, useNativeDriver: true })),
    () => stripes.setValue(0),
  );

  const stripeCount = Math.ceil(trackWidth / STRIPE_PERIOD) + 2;
  return (
    <Animated.View
      style={[styles.progressTrack, { backgroundColor: color('raised') }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && (
        <Animated.View style={[styles.progressFill, { backgroundColor: color('correct'), transform: [{ translateX: fillX }] }]}>
          <Animated.View style={[styles.stripes, { transform: [{ translateX: stripesX }] }]}>
            {Array.from({ length: stripeCount }, (_, i) => (
              <View key={i} style={styles.stripe} />
            ))}
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ՍՏԱՆԱԼ's pulse while a reward waits: a soft green ring growing out of the
// button and fading (native loop; reduced motion: none).
function ClaimPulse({ running }: { running: boolean }) {
  const { color } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => ({
    scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
    scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }),
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
  }));
  useLoopWhile(
    running,
    () => Animated.loop(Animated.timing(pulse, { toValue: 1, duration: TASK_CLAIM_PULSE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    () => pulse.setValue(0),
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.claimPulse,
        { backgroundColor: color('correct'), opacity: ring.opacity, transform: [{ scaleX: ring.scaleX }, { scaleY: ring.scaleY }] },
      ]}
    />
  );
}

type Props = {
  visible: boolean; // the Tasks tab is the one in front
  tasks: DailyTasks; // today's (App keeps it on the current day)
  coins: number;
  onClaim: (id: TaskId) => Promise<void>; // App credits and saves (coins + the claim), then resolves
};

const center = (r: WindowRect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// The Tasks tab (ԱՌԱՋԱԴՐԱՆՔՆԵՐ): today's tasks as cards — the title, a
// progress bar with n/target, the reward — and, once one is done, a green
// ՍՏԱՆԱԼ button; claimed ones say ՍՏԱՑՎԱԾ. A claim is credited and saved by
// App first; then coins fly from the button to the balance in the header
// (which steps up as they land). No measurement → no flight, the balance
// simply shows the new total.
function TasksScreen({ visible, tasks, coins, onClaim }: Props) {
  const { color, textColor, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const balanceRef = useRef<View>(null);
  const buttonRefs = useRef<Partial<Record<TaskId, View | null>>>({});
  const busyRef = useRef(false); // one claim at a time; double taps are ignored
  const [flight, setFlight] = useState<{ origin: { x: number; y: number }; target: { x: number; y: number }; from: number; amount: number } | null>(
    null,
  );
  const [arrived, setArrived] = useState(0);
  const pieces = flight ? Math.max(1, Math.min(flight.amount, COIN_FLIGHT_PIECES)) : 1;
  const shownCoins = flight ? flight.from + Math.round((flight.amount * arrived) / pieces) : coins;

  const claim = async (id: TaskId) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const from = coins;
    try {
      await onClaim(id);
      playSound('claim');
      const [buttonRect, balanceRect] = await Promise.all([
        measureWindow({ current: buttonRefs.current[id] ?? null }),
        measureWindow(balanceRef),
      ]);
      if (buttonRect && balanceRect) {
        setArrived(0);
        setFlight({ origin: center(buttonRect), target: center(balanceRect), from, amount: TASK_DEFS[id].reward });
      }
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <View style={styles.screen}>
      <AnimatedSafeAreaView
        style={[styles.screen, { backgroundColor: color('background') }]}
        edges={EDGES}
        accessibilityElementsHidden={!visible}
      >
        <ScreenGlow />
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Animated.Text style={[styles.title, { color: textColor('headerValueColor') }]} numberOfLines={1} adjustsFontSizeToFit>
            ԱՌԱՋԱԴՐԱՆՔՆԵՐ
          </Animated.Text>
          <View style={[styles.headerSide, styles.headerRight]}>
            <Animated.View ref={balanceRef} collapsable={false} testID="tasks-balance" style={[styles.balance, { backgroundColor: color('pill') }]}>
              <Animated.Text style={[styles.balanceText, { color: textColor('pillText') }]}>{shownCoins}</Animated.Text>
              <Coin size={20} />
            </Animated.View>
          </View>
        </View>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.Text style={[styles.note, { color: textColor('textMuted') }]}>{TASKS_REFRESH_NOTE}</Animated.Text>
          {tasks.tasks.map((task, index) => {
            const def = TASK_DEFS[task.id];
            return (
              <TabEnter key={task.id} visible={visible} index={index}>
              <Animated.View
                testID={`task-${task.id}`}
                style={[
                  styles.card,
                  { backgroundColor: color('popupSurface'), borderColor: color('popupBorder'), borderBottomColor: color('popupEdge') },
                  task.claimed && styles.claimedCard,
                ]}
              >
                <View style={styles.cardTop}>
                  <Animated.Text style={[styles.taskTitle, { color: textColor('popupText') }]} numberOfLines={2}>
                    {def.title}
                  </Animated.Text>
                  <View style={styles.reward}>
                    <Animated.Text style={[styles.rewardText, { color: textColor('popupText') }]}>{`+${def.reward}`}</Animated.Text>
                    <Coin size={18} />
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <View style={styles.progressWrap}>
                    <TaskProgress fraction={Math.min(task.progress, def.target) / def.target} visible={visible} />
                    <Animated.Text style={[styles.progressText, { color: textColor('textMuted') }]}>
                      {`${Math.min(task.progress, def.target)}/${def.target}`}
                    </Animated.Text>
                  </View>
                  {isClaimable(task) && (
                    <View ref={(v) => void (buttonRefs.current[task.id] = v)} collapsable={false}>
                      <ClaimPulse running={visible && !reduceMotion} />
                      <Button3D
                        pressScale
                        height={CLAIM_HEIGHT}
                        width={112}
                        borderRadius={12}
                        faceColor={color('correct')}
                        edgeColor={color('correctEdge')}
                        onPress={() => claim(task.id)}
                        accessibilityRole="button"
                        accessibilityLabel="ՍՏԱՆԱԼ"
                      >
                        <Animated.Text style={styles.claimText}>ՍՏԱՆԱԼ</Animated.Text>
                      </Button3D>
                    </View>
                  )}
                  {task.claimed && (
                    <Animated.Text style={[styles.claimedText, { color: textColor('textMuted') }]}>ՍՏԱՑՎԱԾ</Animated.Text>
                  )}
                </View>
              </Animated.View>
              </TabEnter>
            );
          })}
        </ScrollView>
      </AnimatedSafeAreaView>
      {/* Window-coordinate overlay for the coin flight (the tab sits at the
          window's origin). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {flight && (
          <CoinFlight
            origin={flight.origin}
            target={flight.target}
            amount={flight.amount}
            onArrival={() => setArrived((n) => n + 1)}
            onAllDone={() => setFlight(null)}
          />
        )}
      </View>
    </View>
  );
}

export default memo(TasksScreen);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Same height and sides as the shop's top bar.
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerSide: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 2,
    fontSize: 20,
    fontFamily: FONTS.display,
    fontWeight: '700',
    letterSpacing: 20 * 0.08,
    textAlign: 'center',
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  balanceText: {
    fontFamily: FONTS.title,
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  note: {
    fontFamily: FONTS.title,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 4,
    padding: 14,
    gap: 12,
  },
  claimedCard: {
    opacity: 0.6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  taskTitle: {
    flex: 1,
    fontFamily: FONTS.title,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    fontFamily: FONTS.title,
    fontSize: 16,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: CLAIM_HEIGHT,
  },
  progressWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 5,
    overflow: 'hidden',
  },
  stripes: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: 0,
    flexDirection: 'row',
  },
  stripe: {
    width: STRIPE_PERIOD / 2,
    marginRight: STRIPE_PERIOD / 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ skewX: '-45deg' }],
  },
  claimPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 4,
    borderRadius: 12,
  },
  progressText: {
    fontFamily: FONTS.title,
    fontSize: 13,
    minWidth: 30,
    textAlign: 'right',
  },
  claimText: {
    fontFamily: FONTS.title,
    fontSize: 15,
    color: '#FFFFFF', // white on the green, in both themes
  },
  claimedText: {
    fontFamily: FONTS.title,
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
