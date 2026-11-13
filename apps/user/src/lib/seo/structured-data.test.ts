import { describe, expect, test } from 'vitest';

import { breadcrumbLd, itemListLd, organizationLd, webSiteLd } from '~/lib/seo/structured-data';

// Test trên CHUỖI JSON đã serialize = đúng thứ crawler đọc + né type rộng của schema-dts (SchemaValue
// = T | T[]) khi index mảng. (siteUrl đọc clientEnv.NEXT_PUBLIC_SITE_URL = client var → jsdom OK.)
describe('structured-data builders → JSON-LD output', () => {
  test('organizationLd', () => {
    const json = JSON.stringify(organizationLd());
    expect(json).toContain('"@context":"https://schema.org"');
    expect(json).toContain('"@type":"Organization"');
    expect(json).toContain('"name":"tungph7 codebase"');
    expect(json).toMatch(/"url":"https:\/\//);
    expect(json).toContain('/icon.svg');
  });

  test('webSiteLd', () => {
    const json = JSON.stringify(webSiteLd());
    expect(json).toContain('"@type":"WebSite"');
    expect(json).toMatch(/"url":"https:\/\//);
  });

  test('itemListLd numbers items from 1 and omits url when absent', () => {
    const json = JSON.stringify(itemListLd([{ name: 'Alpha' }, { name: 'Beta' }], 'Products'));
    expect(json).toContain('"@type":"ItemList"');
    expect(json).toContain('"name":"Products"');
    expect(json).toContain('"position":1');
    expect(json).toContain('"position":2');
    expect(json).toContain('"name":"Alpha"');
    expect(json).not.toContain('"url"'); // không truyền url → KHÔNG có field url
  });

  test('itemListLd includes url when provided', () => {
    const json = JSON.stringify(itemListLd([{ name: 'A', url: 'https://x/a' }], 'L'));
    expect(json).toContain('"url":"https://x/a"');
  });

  test('breadcrumbLd uses `item` for url + sequential positions', () => {
    const json = JSON.stringify(
      breadcrumbLd([
        { name: 'Home', url: 'https://x/en' },
        { name: 'Products', url: 'https://x/en/products' },
      ]),
    );
    expect(json).toContain('"@type":"BreadcrumbList"');
    expect(json).toContain('"item":"https://x/en/products"');
    expect(json).toContain('"position":2');
    expect(json).toContain('"name":"Products"');
  });
});
