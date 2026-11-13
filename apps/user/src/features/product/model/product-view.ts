import { parseAsStringLiteral } from 'nuqs';

/**
 * Chế độ xem danh sách — **URL state** (nuqs): shareable/bookmarkable/back-forward (copy URL `?view=grid`
 * → mở ra đúng lưới). KHÁC **density** (Redux S1) = *preference* lưu localStorage, KHÔNG ở URL. Đây là
 * tương phản cốt lõi folder 14: URL state (nuqs) vs persisted client state (Redux).
 *
 * Contract dùng CHUNG cho `ViewToggle` (ghi) + `ViewScope` (đọc): cùng key + cùng parser → đồng bộ.
 */
export const VIEW_MODES = ['list', 'grid'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const VIEW_QUERY_KEY = 'view';

/** Parser nuqs (literal union, mặc định 'list'). `parseAsStringLiteral` → giá trị lạ tự về default. */
export const viewParser = parseAsStringLiteral(VIEW_MODES).withDefault('list');
