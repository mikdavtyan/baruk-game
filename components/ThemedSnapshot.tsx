import { memo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import IconButton from './IconButton';
import ThemeToggleIcon from './ThemeToggleIcon';
import { ThemeTokens } from '../constants/theme';
import { useTheme, useThemeSnapshot } from '../lib/ThemeContext';

// The small leaf components that read the theme SNAPSHOT (useThemeSnapshot) —
// values that can't animate (icon tints, the status bar) and so switch once,
// at a theme toggle's midpoint. Keeping them tiny and separate means that
// midpoint flip re-renders only these, never their (large) parents.

// An SF Symbol / Material icon tinted with a theme token.
export const ThemedSymbol = memo(function ThemedSymbol({ name, size, token }: { name: SymbolViewProps['name']; size: number; token: keyof ThemeTokens }) {
  const { theme } = useThemeSnapshot();
  return <SymbolView name={name} size={size} tintColor={theme[token]} />;
});

// A header-style flat icon button tinted with a theme token.
export const ThemedIconButton = memo(function ThemedIconButton({
  icon,
  label,
  token,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  token: keyof ThemeTokens;
  onPress?: () => void;
}) {
  const { theme } = useThemeSnapshot();
  return <IconButton icon={icon} label={label} color={theme[token]} onPress={onPress} />;
});

// The header's moon/sun button, which toggles the theme.
export const ThemeToggleButton = memo(function ThemeToggleButton() {
  const { toggleTheme } = useTheme();
  const { theme, isDark } = useThemeSnapshot();
  return (
    <IconButton label="Toggle dark mode" color={theme.headerIconColor} onPress={toggleTheme}>
      <ThemeToggleIcon isDark={isDark} color={theme.headerIconColor} />
    </IconButton>
  );
});

// Follows the in-app theme: 'auto' would follow the system scheme, which
// app.json pins to light.
export const ThemedStatusBar = memo(function ThemedStatusBar() {
  const { isDark } = useThemeSnapshot();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
});
