import { useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, RootState } from '@/stores/store';

// Pre-typed Redux hooks (react-redux v9 `.withTypes`). This file + the rest of
// src/stores are the ONLY places allowed to import react-redux directly (enforced
// by `no-restricted-imports` in eslint.config.js). Components consume domain-hook
// facades (useTheme, useSidebar) instead, so the store stays swappable.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
