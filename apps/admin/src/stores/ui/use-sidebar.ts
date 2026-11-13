import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import {
  closeSidebar as closeSidebarAction,
  openSidebar as openSidebarAction,
  selectSidebarOpen,
  toggleSidebar as toggleSidebarAction,
} from '@/stores/ui/ui-slice';

export interface UseSidebarResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

// Domain-hook FACADE for the sidebar (see use-theme.ts for the rationale).
export function useSidebar(): UseSidebarResult {
  const isOpen = useAppSelector(selectSidebarOpen);
  const dispatch = useAppDispatch();
  return {
    isOpen,
    open: () => dispatch(openSidebarAction()),
    close: () => dispatch(closeSidebarAction()),
    toggle: () => dispatch(toggleSidebarAction()),
  };
}
