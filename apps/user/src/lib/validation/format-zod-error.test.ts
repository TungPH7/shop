import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { getFieldErrorCodes } from '~/lib/validation/format-zod-error';

describe('getFieldErrorCodes', () => {
  it('ZodError → { field: code } (lấy code đầu, để UI t())', () => {
    const schema = z.object({
      name: z.string().min(2, { error: 'too_short' }),
      email: z.email({ error: 'invalid_email' }),
    });
    const r = schema.safeParse({ name: 'a', email: 'nope' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(getFieldErrorCodes(r.error)).toEqual({ name: 'too_short', email: 'invalid_email' });
  });
});
