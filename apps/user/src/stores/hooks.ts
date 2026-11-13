import { useDispatch, useSelector, useStore } from 'react-redux';

import { type AppDispatch, type AppStore, type RootState } from '~/stores/store';

/**
 * Hook gõ-kiểu của seam (react-redux 9 `withTypes`). NỘI BỘ seam S1: các **facade hướng-domain** (vd
 * `use-density.ts`) build trên đây; feature/app KHÔNG import trực tiếp `react-redux` (ESLint cấm) →
 * dùng facade. Đổi RTK→Zustand = viết lại các file này + facade, feature không đổi.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
