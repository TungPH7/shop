import { expect, test } from 'vitest';

import { type Product } from '~/features/product/model/product';
import { renderWithProviders, screen } from '~/testing/render';

import { ProductList } from './product-list';

const products: Product[] = [
  { id: 1, name: 'Sản phẩm A', priceVnd: 800000, originalPriceVnd: 1200000, images: [] }, // đang sale
  { id: 2, name: 'Sản phẩm B', priceVnd: 50000, originalPriceVnd: 50000, images: [] }, // không sale
];

test('render tên + giá bán + ảnh (alt=tên); gạch giá gốc khi đang sale', () => {
  renderWithProviders(<ProductList products={products} emptyLabel="No products" />);
  expect(screen.getByText('Sản phẩm A')).toBeInTheDocument();
  expect(screen.getByText('800.000 ₫')).toBeInTheDocument();
  expect(screen.getByText('1.200.000 ₫').tagName).toBe('DEL'); // giá gốc gạch ngang
  // folder 20: next/image render <img alt={name}> (ảnh placeholder picsum vì images rỗng).
  expect(screen.getByAltText('Sản phẩm A')).toBeInTheDocument();
});

test('KHÔNG gạch khi giá gốc = giá bán', () => {
  renderWithProviders(<ProductList products={[products[1]!]} emptyLabel="No products" />);
  expect(screen.getByText('50.000 ₫')).toBeInTheDocument();
  expect(screen.queryByText('50.000 ₫', { selector: 'del' })).not.toBeInTheDocument();
});

test('danh sách rỗng → hiện emptyLabel', () => {
  renderWithProviders(<ProductList products={[]} emptyLabel="Chưa có sản phẩm" />);
  expect(screen.getByText('Chưa có sản phẩm')).toBeInTheDocument();
});
