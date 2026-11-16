import { describe, expect, it } from 'vitest';

import { ProductList } from '@/features/product/components/product-list';
import { renderWithProviders, screen } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

describe('ProductList', () => {
  it('shows the page title S1.2 as the single h1', () => {
    renderWithProviders(<ProductList />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
  });

  it('names the page in Vietnamese', async () => {
    await testI18n.changeLanguage('vi');
    renderWithProviders(<ProductList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeInTheDocument();
  });

  it('shows nothing of the template list: no search box, no list, no status', () => {
    renderWithProviders(<ProductList />);

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
