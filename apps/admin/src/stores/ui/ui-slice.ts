import { createSlice } from '@reduxjs/toolkit';

// Ephemeral UI state — intentionally NOT persisted (unlike theme). A fresh visit
// starts with the sidebar closed.
export interface UiState {
  sidebarOpen: boolean;
}

const initialState: UiState = { sidebarOpen: false };

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openSidebar: (state) => {
      state.sidebarOpen = true;
    },
    closeSidebar: (state) => {
      state.sidebarOpen = false;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
  selectors: {
    selectSidebarOpen: (state) => state.sidebarOpen,
  },
});

export const { openSidebar, closeSidebar, toggleSidebar } = uiSlice.actions;
export const { selectSidebarOpen } = uiSlice.selectors;
export const uiReducer = uiSlice.reducer;
