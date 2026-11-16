import { describe, expect, it } from 'vitest';

import { SiteFooter } from '~/features/site/components/site-footer';
import { renderWithProviders, screen } from '~/testing/render';

// SiteFooter là Server Component ĐỒNG BỘ (nhận `year` qua prop) → unit-test render được (folder 05).
// Test này còn xác nhận: feature → shared (`~/testing/render`) hợp lệ qua boundary.
describe('<SiteFooter />', () => {
  it('render dòng bản quyền với năm truyền vào + tên site', () => {
    renderWithProviders(<SiteFooter year={2026} />);

    expect(screen.getByText('© 2026 tungph7 codebase. All rights reserved.')).toBeInTheDocument();
  });

  // S4.11: the footer landmark of the page frame, drawn by .site-footer (hint 12.5px, centred) in components.css.
  it('is the footer landmark of the page frame', () => {
    renderWithProviders(<SiteFooter year={2026} />);

    expect(screen.getByRole('contentinfo')).toHaveClass('site-footer');
  });
});
