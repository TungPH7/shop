import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * `ui` slice — **client-UI state THUẦN** (folder 14): mật độ hiển thị danh sách. KHÔNG phải data
 * server (RSC/TanStack lo), KHÔNG phải URL state (nuqs lo) → đúng loại "global client state" mà Redux
 * (seam S1) phụ trách. Giữ store TỐI THIỂU (server-first: phần lớn state sống ở server).
 */
export type Density = 'comfortable' | 'compact';

export interface UiState {
  density: Density;
}

const initialState: UiState = { density: 'comfortable' };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDensity(state, action: PayloadAction<Density>) {
      state.density = action.payload;
    },
    toggleDensity(state) {
      state.density = state.density === 'comfortable' ? 'compact' : 'comfortable';
    },
  },
});

export const { setDensity, toggleDensity } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
