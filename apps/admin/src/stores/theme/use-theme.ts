import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import {
  selectTheme,
  setTheme as setThemeAction,
  toggleTheme as toggleThemeAction,
  type Theme,
} from '@/stores/theme/theme-slice';

export interface UseThemeResult {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

// Domain-hook FACADE: components depend on this, never on react-redux or the
// slice. Swapping the store implementation (e.g. to Zustand) means rewriting this
// file only — call sites stay unchanged. The selector is narrow (returns a
// primitive), so consumers re-render only when `theme` changes, not on any store
// update (Vercel `rerender-defer-reads`).
export function useTheme(): UseThemeResult {
  const theme = useAppSelector(selectTheme);
  const dispatch = useAppDispatch();
  return {
    theme,
    setTheme: (next) => dispatch(setThemeAction(next)),
    toggle: () => dispatch(toggleThemeAction()),
  };
}
