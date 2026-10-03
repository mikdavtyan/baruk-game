import { memo, RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import BowIcon from './BowIcon';
import PowerUpButton from './PowerUpButton';
import SubmitButton from './SubmitButton';
import { WIN_FLOW_CONFIG } from '../constants/winFlow';
import { GuessValidity } from '../lib/guessValidity';
import { ThemedSymbol } from './ThemedSnapshot';

const HINT_ICON = { ios: 'magnifyingglass', android: 'search', web: 'search' } as const;

// Each power-up shows its item count (a red badge) while any are held, and
// its coin price (WIN_FLOW_CONFIG) once none are left — see PowerUpButton.
type Props = {
  validity: GuessValidity;
  onSubmit: () => void;
  onClearInvalid: () => void;
  hintCount: number; // Hint items held (inventory)
  dartsCount: number; // Darts items held
  hintDisabled: boolean;
  hintDimmed: boolean;
  onHint: () => void;
  dartsDisabled: boolean;
  dartsDimmed: boolean;
  onDarts: () => void;
  dartsVolleyId: number; // bumped each time Darts actually fires — replays BowIcon's recoil/reload
  dartsShotCount: number; // how many arrows the current/last volley has
  dartsButtonRef: RefObject<View | null>; // measured by App.tsx to know where arrows should fly from
  hintButtonRef: RefObject<View | null>; // measured by App.tsx: where the Hint light takes off
};

// The bottom control bar: [ Hint ]  [ ԸՆԴՈՒՆԵԼ ]  [ Darts ]. ԸՆԴՈՒՆԵԼ is the
// only submit action in the app — both side buttons are power-ups, not
// alternate ways to submit. Hint and Darts now render through the exact
// same neutral PowerUpButton style — only their icon differs.
function BottomControls({
  validity,
  onSubmit,
  onClearInvalid,
  hintCount,
  dartsCount,
  hintDisabled,
  hintDimmed,
  onHint,
  dartsDisabled,
  dartsDimmed,
  onDarts,
  dartsVolleyId,
  dartsShotCount,
  dartsButtonRef,
  hintButtonRef,
}: Props) {
  return (
    <View style={styles.row}>
      <PowerUpButton
        icon={
          // A snapshot-tinted leaf (a SymbolView's tintColor can't take
          // `color()`), so a theme toggle re-renders only the icon.
          <ThemedSymbol name={HINT_ICON} size={24} token="keyText" />
        }
        ref={hintButtonRef}
        label="Hint"
        price={WIN_FLOW_CONFIG.hintPrice}
        count={hintCount}
        disabled={hintDisabled}
        dimmed={hintDimmed}
        onPress={onHint}
      />
      <View style={styles.submit}>
        <SubmitButton validity={validity} onPress={onSubmit} onClearInvalid={onClearInvalid} />
      </View>
      <PowerUpButton
        ref={dartsButtonRef}
        icon={<BowIcon size={24} volleyId={dartsVolleyId} shotCount={dartsShotCount} />}
        label="Darts"
        price={WIN_FLOW_CONFIG.dartsPrice}
        count={dartsCount}
        disabled={dartsDisabled}
        dimmed={dartsDimmed}
        onPress={onDarts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  submit: {
    flex: 1,
  },
});

// Memoized: App re-renders on every keystroke (see the stable props there).
export default memo(BottomControls);
