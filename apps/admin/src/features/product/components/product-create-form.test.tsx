import { describe, expect, it } from 'vitest';

import { ProductCreateForm } from '@/features/product/components/product-create-form';
import { renderWithProviders, screen } from '@/testing/render';

describe('ProductCreateForm', () => {
  it('rejects a negative price with a field error (no submit)', async () => {
    const { user } = renderWithProviders(<ProductCreateForm />);
    await user.type(screen.getByLabelText('Name'), 'Widget');
    const price = screen.getByLabelText('Price (cents)');
    await user.clear(price);
    await user.type(price, '-5');
    await user.click(screen.getByRole('button', { name: 'Create product' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Product created.')).not.toBeInTheDocument();
  });

  it('creates a product on valid input (MSW)', async () => {
    const { user } = renderWithProviders(<ProductCreateForm />);
    await user.type(screen.getByLabelText('Name'), 'Widget');
    const price = screen.getByLabelText('Price (cents)');
    await user.clear(price);
    await user.type(price, '1500');
    await user.click(screen.getByRole('button', { name: 'Create product' }));

    expect(await screen.findByText('Product created.')).toBeInTheDocument();
  });
});
