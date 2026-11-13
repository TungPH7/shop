import { describe, expect, it } from 'vitest';

import { buildCopyrightNotice } from '~/features/site/model/site';

// Logic THUẦN → test trực tiếp (không render, không MSW). Cũng chứng minh
// alias `~` resolve được vào `src/features/...` trong môi trường Vitest.
describe('buildCopyrightNotice', () => {
  it('ghép dòng bản quyền từ tên site + năm', () => {
    expect(buildCopyrightNotice({ name: 'tungph7 codebase' }, 2026)).toBe(
      '© 2026 tungph7 codebase. All rights reserved.',
    );
  });
});
