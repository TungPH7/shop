import { describe, expect, it } from 'vitest';

import { AdminRoute } from '@/app/routes/admin/admin-route';
import { renderWithProviders, screen } from '@/testing/render';

describe('AdminRoute', () => {
  it('no longer holds the product form of the template', () => {
    renderWithProviders(<AdminRoute />);

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
