import { render } from '@testing-library/react';
import { type WebSite, type WithContext } from 'schema-dts';
import { describe, expect, test } from 'vitest';

import { JsonLd } from '~/components/seo/json-ld';

describe('JsonLd', () => {
  test('renders a <script type="application/ld+json"> with serialized data', () => {
    const data: WithContext<WebSite> = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'X',
      url: 'https://x',
    };
    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('"@type":"WebSite"');
  });

  test('escapes "<" so a "</script>" payload cannot break out of the tag (XSS guard)', () => {
    const data: WithContext<WebSite> = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '</script><b>pwn',
      url: 'https://x',
    };
    const { container } = render(<JsonLd data={data} />);
    // Raw breakout sequence must NOT appear in the serialized HTML…
    expect(container.innerHTML).not.toContain('</script><b>');
    // …because every "<" is escaped to < inside the script text.
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toContain('\\u003c');
  });
});
