import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseSearchParams } from '~/lib/validation/parse-search-params';

// Schema inline (KHÔNG import schema feature — `lib` shared KHÔNG được import `features`, boundary
// folder 06). Forgiving (`.catch`) như mọi schema searchParams.
const schema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  sortBy: z.enum(['createdAt', 'price']).catch('createdAt'),
});

describe('parseSearchParams', () => {
  it('value mảng → lấy phần tử đầu', () => {
    const q = parseSearchParams(schema, { page: ['2', '9'], sortBy: 'price' });
    expect(q.page).toBe(2);
    expect(q.sortBy).toBe('price');
  });

  it('param hỏng → sanitize, KHÔNG ném', () => {
    const q = parseSearchParams(schema, { page: '-1', sortBy: 'zzz' });
    expect(q.page).toBe(1);
    expect(q.sortBy).toBe('createdAt');
  });

  it('rỗng → mặc định', () => {
    expect(parseSearchParams(schema, {})).toEqual({ page: 1, sortBy: 'createdAt' });
  });
});
