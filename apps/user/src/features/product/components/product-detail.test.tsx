import { type ComponentProps } from 'react';

import { describe, expect, test, vi } from 'vitest';

import { placeholderGroup } from '~/components/ui/placeholder-tile';
import type { StoreProduct } from '~/features/product/model/product';
import { renderWithProviders, screen } from '~/testing/render';

// The Link of next-intl reads the path through next/navigation, which does not resolve in Vitest: a plain <a> with the
// path of the locale stands in for it, as getPathname does in site-nav.test.tsx.
vi.mock('~/i18n/navigation', () => ({
  Link: ({ href, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={`/vi${href}`} {...props} />
  ),
}));

import { ProductDetail, ProductDetailSkeleton } from './product-detail';

// Testing Library and jest-dom collapse white space, so the U+00A0 that formatPrice puts before ₫ reads as a space here;
// product.test.ts pins the U+00A0 itself.
const shirt: StoreProduct = {
  id: '0193a2b5-fce1-786a-b348-e4314aad4353',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 200000,
  compareAtPrice: 250000,
  availability: 'IN_STOCK',
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  updatedAt: '2026-11-16T02:15:30.000Z',
};

describe('<ProductDetail />', () => {
  test('has the name as the only h1', () => {
    renderWithProviders(<ProductDetail product={shirt} />, { locale: 'vi' });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Áo thun cổ tròn' })).toBeInTheDocument();
  });

  test('links back to the products page S4', () => {
    renderWithProviders(<ProductDetail product={shirt} />, { locale: 'vi' });

    expect(screen.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/vi/products');
  });

  test('draws the placeholder in the group colour of the id, hidden from screen readers', () => {
    const { container } = renderWithProviders(<ProductDetail product={shirt} />, { locale: 'vi' });

    const tile = container.querySelector('[data-variant="detail"]');
    expect(tile).toHaveAttribute('data-group', placeholderGroup(shirt.id));
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile).toHaveTextContent('Á');
  });

  test('shows the price, the original price struck through and the discount (AC24)', () => {
    renderWithProviders(<ProductDetail product={shirt} />, { locale: 'vi' });

    expect(screen.getByText('Giá bán')).toBeInTheDocument();
    expect(screen.getByText('200.000 ₫')).toBeInTheDocument();
    const original = screen.getByText('250.000 ₫');
    expect(original.tagName).toBe('S');
    expect(original.parentElement).toHaveTextContent('Giá gốc: 250.000 ₫');
    const discount = screen.getByText('-20%');
    expect(discount.parentElement).toHaveTextContent('Giảm -20%');
  });

  test('says the hidden words in English on the English page', () => {
    renderWithProviders(<ProductDetail product={shirt} />, { locale: 'en' });

    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('250.000 ₫').parentElement).toHaveTextContent(
      'Original price: 250.000 ₫',
    );
    expect(screen.getByText('-20%').parentElement).toHaveTextContent('Off -20%');
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Description' })).toBeInTheDocument();
  });

  test('shows only the price when there is no original price (AC24)', () => {
    renderWithProviders(<ProductDetail product={{ ...shirt, compareAtPrice: null }} />, {
      locale: 'vi',
    });

    expect(screen.getByText('200.000 ₫')).toBeInTheDocument();
    expect(screen.queryByText(/250\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Giá gốc:', { exact: false })).not.toBeInTheDocument();
  });

  test('says Còn hàng when in stock', () => {
    renderWithProviders(<ProductDetail product={shirt} />, { locale: 'vi' });

    expect(screen.getByText('Còn hàng')).toHaveClass('badge--good');
  });

  test('says Hết hàng when out of stock', () => {
    renderWithProviders(<ProductDetail product={{ ...shirt, availability: 'OUT_OF_STOCK' }} />, {
      locale: 'vi',
    });

    expect(screen.getByText('Hết hàng')).toHaveClass('badge--warn');
    expect(screen.queryByText('Còn hàng')).not.toBeInTheDocument();
  });

  test('keeps the line breaks of the description in one paragraph (AC24)', () => {
    renderWithProviders(<ProductDetail product={shirt} />, { locale: 'vi' });

    expect(screen.getByRole('heading', { level: 2, name: 'Mô tả' })).toBeInTheDocument();
    const description = screen.getByText(/Áo thun cotton 100%\./);
    expect(description.tagName).toBe('P');
    expect(description.textContent).toBe('Áo thun cotton 100%.\nCổ tròn, tay ngắn.');
    expect(description).toHaveClass('product-detail__description');
  });

  test('shows a description with HTML as text, without any element in it (AC25)', () => {
    const html = '<b>Mới</b><script>alert(1)</script>';
    renderWithProviders(<ProductDetail product={{ ...shirt, description: html }} />, {
      locale: 'vi',
    });

    const description = screen.getByText(html);
    expect(description.textContent).toBe(html);
    expect(description.children).toHaveLength(0);
  });

  test('hides the description heading when there is no description', () => {
    renderWithProviders(<ProductDetail product={{ ...shirt, description: null }} />, {
      locale: 'vi',
    });

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});

describe('<ProductDetailSkeleton />', () => {
  test('is a busy region without any heading', () => {
    const { container } = renderWithProviders(<ProductDetailSkeleton />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
