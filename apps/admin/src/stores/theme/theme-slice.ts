import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Domain values live with the slice (single source of truth). `as const` gives a
// readonly tuple reused by the Zod persistence schema (see persistence.ts).
export const themeValues = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themeValues)[number];

export interface ThemeState {
  theme: Theme;
}

const initialState: ThemeState = { theme: 'system' };

export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    // Immer lets us "mutate" the draft; a new immutable state is produced.
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
  },
  // Slice selectors receive the slice state; RTK wires them to read root state
  // at `state[name]` (the slice is mounted under the `theme` key, see store.ts).
  selectors: {
    selectTheme: (state) => state.theme,
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export const { selectTheme } = themeSlice.selectors;
export const themeReducer = themeSlice.reducer;
