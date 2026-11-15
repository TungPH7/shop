import { describe, expect, it } from 'vitest';

import { paths } from '@/config/paths';

describe('paths', () => {
  it('builds the href of each page from its own pattern', () => {
    const { notFound, ...pages } = paths;

    for (const page of Object.values(pages)) {
      expect(page.getHref()).toBe(page.path);
    }
    expect(notFound.getHref()).toBe('/404');
  });

  it('keeps no path of the template product pages', () => {
    expect(Object.keys(paths)).not.toContain('productDetail');
    expect(Object.keys(paths)).not.toContain('productEdit');
  });
});
