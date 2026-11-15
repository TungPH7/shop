import { describe, expect, it } from 'vitest';

import { HomeRoute } from '@/app/routes/home/home-route';
import { renderWithProviders, screen } from '@/testing/render';

describe('HomeRoute', () => {
  it('owns the single h1 of the page, since the app name in the shell is a link', () => {
    renderWithProviders(<HomeRoute />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Phase 1.1 — Core foundation (UI-agnostic)' }),
    ).toBeInTheDocument();
  });

  it('shows the API base URL and links to the products demo', () => {
    renderWithProviders(<HomeRoute />);

    expect(screen.getByText('http://localhost:3000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'products' })).toHaveAttribute('href', '/products');
  });
});
