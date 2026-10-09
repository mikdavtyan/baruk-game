import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Whether the app is in the foreground — idle animations (the menu
// background, Home's wheel) stop while it isn't.
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}
