import { describe, expect, it } from 'vitest';

import { ProductList } from '@/features/product/components/product-list';
import { renderWithProviders, screen, waitFor } from '@/testing/render';

describe('ProductList', () => {
  it('renders products from the API (MSW) with i18n title + plural count', async () => {
    renderWithProviders(<ProductList />);

    expect(await screen.findByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Test Gadget')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument(); // product:title
    expect(screen.getByText('2 products')).toBeInTheDocument(); // product:count plural
  });

  it('filters the list by the search term (nuqs)', async () => {
    const { user } = renderWithProviders(<ProductList />);
    await screen.findByText('Test Widget');

    await user.type(screen.getByRole('searchbox'), 'gadget');

    await waitFor(() => {
      expect(screen.queryByText('Test Widget')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Test Gadget')).toBeInTheDocument();
  });
});
