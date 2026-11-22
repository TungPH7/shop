import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Breadcrumb } from './breadcrumb';

// The crumbs as breadcrumbLd takes them: absolute URLs in the locale of the page (SPEC of SHOP-81, Code Style).
const threeCrumbs = [
  { name: 'Trang chủ', url: 'https://site.example.test/vi' },
  { name: 'Áo', url: 'https://site.example.test/vi/categories/ao' },
  { name: 'Áo thun cổ tròn', url: 'https://site.example.test/vi/products/ao-thun-co-tron' },
];

describe('<Breadcrumb />', () => {
  test('is a <nav> with its label, holding an <ol> of the crumbs in order (S5.2, S8.2)', () => {
    render(<Breadcrumb items={threeCrumbs} label="Đường dẫn trang" />);

    const nav = screen.getByRole('navigation', { name: 'Đường dẫn trang' });
    const items = within(within(nav).getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Trang chủ›', 'Áo›', 'Áo thun cổ tròn']);
  });

  test('links every crumb but the last to its path in the locale of the page (AC20)', () => {
    render(<Breadcrumb items={threeCrumbs} label="Đường dẫn trang" />);

    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/vi');
    expect(screen.getByRole('link', { name: 'Áo' })).toHaveAttribute('href', '/vi/categories/ao');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  test('shows the last crumb as text, the current page', () => {
    render(<Breadcrumb items={threeCrumbs} label="Đường dẫn trang" />);

    const current = screen.getByText('Áo thun cổ tròn');
    expect(current.closest('a')).toBeNull();
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  test('hides the separators › from screen readers', () => {
    const { container } = render(<Breadcrumb items={threeCrumbs} label="Breadcrumb" />);

    const separators = container.querySelectorAll('.breadcrumb__separator');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator).toHaveAttribute('aria-hidden', 'true');
      expect(separator.textContent).toBe('›');
    }
  });

  test('has two crumbs for a product with no category, or a category page (AC18, AC21)', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'Home', url: 'https://site.example.test/en' },
          { name: 'Áo', url: 'https://site.example.test/en/categories/ao' },
        ]}
        label="Breadcrumb"
      />,
    );

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
    expect(screen.getByText('Áo')).toHaveAttribute('aria-current', 'page');
  });

  test('shows a name holding markup as text (NFR10)', () => {
    const name = '</script><script>alert(1)</script>';
    const { container } = render(
      <Breadcrumb
        items={[
          { name: 'Trang chủ', url: 'https://site.example.test/vi' },
          { name, url: 'https://site.example.test/vi/categories/ao' },
        ]}
        label="Đường dẫn trang"
      />,
    );

    expect(screen.getByText(name)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });
});
