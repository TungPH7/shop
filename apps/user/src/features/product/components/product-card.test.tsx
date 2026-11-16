import { type ComponentProps } from 'react';

import { describe, expect, test, vi } from 'vitest';

import { placeholderGroup } from '~/components/ui/placeholder-tile';
import type { StoreProductSummary } from '~/features/product/model/product';
import { renderWithProviders, screen } from '~/testing/render';

// The Link of next-intl reads the path through next/navigation, which does not resolve in Vitest: a plain <a> with the
// path of the locale stands in for it, as in product-detail.test.tsx.
vi.mock('~/i18n/navigation', () => ({
  Link: ({ href, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={`/vi${href}`} {...props} />
  ),
}));

import { ProductCard } from './product-card';

// The product of AC17. Testing Library collapses white space, so the U+00A0 of formatPrice reads as a space here.
const shirt: StoreProductSummary = {
  id: '0193a2b5-fce1-786a-b348-e4314aad4353',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 1250000,
  compareAtPrice: 1500000,
  availability: 'OUT_OF_STOCK',
};

const jeans: StoreProductSummary = {
  id: '0193a2b5-0091-770e-851f-c07d23ef7c9d',
  name: 'quần jean nam',
  slug: 'quan-jean-nam',
  price: 450000,
  compareAtPrice: null,
  availability: 'IN_STOCK',
};

describe('<ProductCard />', () => {
  test('is one link to the product page S5, named by the product name first (AC17)', () => {
    renderWithProviders(<ProductCard product={shirt} />, { locale: 'vi' });

    const link = screen.getByRole('link', { name: /^Áo thun cổ tròn/ });
    expect(link).toHaveAttribute('href', '/vi/products/ao-thun-co-tron');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  test('reads the name, the price, the original price, the discount and the stock, in that order', () => {
    renderWithProviders(<ProductCard product={shirt} />, { locale: 'vi' });

    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Áo thun cổ tròn 1.250.000\u00a0₫ Giá gốc: 1.500.000\u00a0₫ Giảm -16% Hết hàng',
    );
  });

  test('draws the 4:3 placeholder in the group colour of the id, with the initial, hidden from screen readers', () => {
    const { container } = renderWithProviders(<ProductCard product={jeans} />, { locale: 'vi' });

    const tile = container.querySelector('[data-variant="card"]');
    expect(tile).toHaveAttribute('data-group', placeholderGroup(jeans.id));
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile).toHaveTextContent('Q');
  });

  test('shows the price, the original price struck through and "-16%" (AC17)', () => {
    renderWithProviders(<ProductCard product={shirt} />, { locale: 'vi' });

    expect(screen.getByText('1.250.000 ₫')).toBeInTheDocument();
    const original = screen.getByText('1.500.000 ₫');
    expect(original.tagName).toBe('S');
    expect(screen.getByText('-16%')).toBeInTheDocument();
  });

  test('shows only the price when there is no original price', () => {
    const { container } = renderWithProviders(<ProductCard product={jeans} />, { locale: 'vi' });

    expect(screen.getByText('450.000 ₫')).toBeInTheDocument();
    expect(container.querySelector('s')).toBeNull();
    expect(screen.queryByText(/^-\d+%$/)).toBeNull();
    expect(screen.queryByText('Giảm')).toBeNull();
  });

  test.each([
    ['vi', 'Hết hàng'],
    ['en', 'Out of stock'],
  ] as const)('has the badge %s "%s" when out of stock (AC17)', (locale, label) => {
    renderWithProviders(<ProductCard product={shirt} />, { locale });

    expect(screen.getByText(label)).toHaveClass('badge', 'badge--warn');
  });

  test('has no stock badge when in stock', () => {
    const { container } = renderWithProviders(<ProductCard product={jeans} />, { locale: 'vi' });

    expect(screen.queryByText('Hết hàng')).toBeNull();
    expect(screen.queryByText('Còn hàng')).toBeNull();
    expect(container.querySelector('.badge')).toBeNull();
  });

  test('shows the same prices on the vi and en pages (AC17)', () => {
    renderWithProviders(<ProductCard product={shirt} />, { locale: 'en' });

    expect(screen.getByText('1.250.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('1.500.000 ₫').tagName).toBe('S');
    expect(screen.getByText('-16%')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Áo thun cổ tròn 1.250.000\u00a0₫ Original price: 1.500.000\u00a0₫ Off -16% Out of stock',
    );
  });

  test('shows a name with markup as text', () => {
    renderWithProviders(<ProductCard product={{ ...jeans, name: '<b>Mới</b>' }} />, {
      locale: 'vi',
    });

    expect(screen.getByRole('link', { name: /^<b>Mới<\/b>/ })).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });
});
