import { describe, expect, it } from 'vitest';

import { SafeHtml } from '@/components/security/safe-html';
import { renderWithProviders, screen } from '@/testing/render';

describe('SafeHtml', () => {
  it('renders the safe markup and strips dangerous nodes', () => {
    const { container } = renderWithProviders(
      <SafeHtml html="<p>safe text</p><script>alert(1)</script>" />,
    );
    expect(screen.getByText('safe text')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });
});
