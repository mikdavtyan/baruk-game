import { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SymbolView, SymbolViewProps } from 'expo-symbols';

// The small flat icon buttons (the header's theme toggle and rules button,
// the rules popup's close X) — no circle background, just the icon, with a
// dimmed press state. One shared component, so they all have the exact same
// size, shape and press effect.
export default function IconButton({
  icon,
  label,
  color,
  onPress = () => {},
  children,
}: {
  icon?: SymbolViewProps['name'];
  label: string;
  color: string;
  onPress?: () => void;
  // Overrides `icon` with custom content (e.g. Header's animated moon/sun swap).
  children?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
    >
      {children ?? (icon && <SymbolView name={icon} size={20} tintColor={color} />)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
});
