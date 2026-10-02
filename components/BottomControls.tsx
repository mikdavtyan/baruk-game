import { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import BowIcon from './BowIcon';
import PowerUpButton from './PowerUpButton';
import SubmitButton from './SubmitButton';
import { WIN_FLOW_CONFIG } from '../constants/winFlow';
import { GuessValidity } from '../lib/guessValidity';
import { useTheme } from '../lib/ThemeContext';

// Temporary display prices — no real coin economy/persistence yet (see
// App.tsx's handleHint/handleDarts).Once an inventory system exists, these
// badges become quantity indicators instead of prices.
type Props = {
  validity: GuessValidity;
  onSubmit: () => void;
  onClearInvalid: () => void;
  hintDisabled: boolean;
  hintDimmed: boolean;
  onHint: () => void;
  dartsDisabled: boolean;
  dartsDimmed: boolean;
  onDarts: () => void;
  dartsVolleyId: number; // bumped each time Darts actually fires — replays BowIcon's recoil/reload
  dartsShotCount: number; // how many arrows the current/last volley has
  dartsButtonRef: RefObject<View | null>; // measured by App.tsx to know where arrows should fly from
};

// The bottom control bar: [ Hint ]  [ ԸՆԴՈՒՆԵԼ ]  [ Darts ]. ԸՆԴՈՒՆԵԼ is the
// only submit action in the app — both side buttons are power-ups, not
// alternate ways to submit. Hint and Darts now render through the exact
// same neutral PowerUpButton style — only their icon differs.
export default function BottomControls({
  validity,
  onSubmit,
  onClearInvalid,
  hintDisabled,
  hintDimmed,
  onHint,
  dartsDisabled,
  dartsDimmed,
  onDarts,
  dartsVolleyId,
  dartsShotCount,
  dartsButtonRef,
}: Props) {
  // theme.keyText (a plain snapshot) for the Hint icon — a native
  // SymbolView's tintColor isn't a style, so it can't take `color()`.
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <PowerUpButton
        icon={
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={24}
            tintColor={theme.keyText}
          />
        }
        label="Hint"
        price={WIN_FLOW_CONFIG.hintPrice}
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
