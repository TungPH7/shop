import { describe, expect, it } from 'vitest';

import { closeSidebar, openSidebar, toggleSidebar, uiReducer } from './ui-slice';

describe('ui slice', () => {
  it('opens, closes and toggles the sidebar', () => {
    expect(uiReducer({ sidebarOpen: false }, openSidebar())).toEqual({ sidebarOpen: true });
    expect(uiReducer({ sidebarOpen: true }, closeSidebar())).toEqual({ sidebarOpen: false });
    expect(uiReducer({ sidebarOpen: false }, toggleSidebar())).toEqual({ sidebarOpen: true });
    expect(uiReducer({ sidebarOpen: true }, toggleSidebar())).toEqual({ sidebarOpen: false });
  });
});
