import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { RootLayout } from '@/app/layouts/root-layout';
import { renderWithRouter, screen, within } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

function buildRouter(initialEntry = '/') {
  return createMemoryRouter(
    [
      {
        Component: RootLayout,
        children: [
          { index: true, element: <h1>Home page</h1> },
          { path: '/products', element: <h1>Products page</h1> },
          { path: '/about', element: <h1>About page</h1> },
          { path: '/categories/new', element: <h1>Add category page</h1> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );
}

describe('RootLayout (S1.1)', () => {
  it('labels the main navigation and lists Home, Products and About', async () => {
    renderWithRouter(buildRouter());

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });

    expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Products' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'About' })).toBeInTheDocument();
  });

  it('lists Categories between Products and About (S1.1 of SHOP-81)', async () => {
    renderWithRouter(buildRouter());

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Home', 'Products', 'Categories', 'About']);
    expect(within(nav).getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });

  it('marks Categories as the current page on its add and edit pages too (S2.1 of SHOP-81)', async () => {
    renderWithRouter(buildRouter('/categories/new'));

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });

    expect(within(nav).getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks the link of the current page with aria-current=page', async () => {
    renderWithRouter(buildRouter('/products'));

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });

    expect(within(nav).getByRole('link', { name: 'Products' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('shows the app name without taking the h1 of the page', async () => {
    renderWithRouter(buildRouter());

    await screen.findByRole('heading', { level: 1, name: 'Home page' });

    expect(screen.getByRole('link', { name: 'tungph7 codebase' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('has no demo sidebar button and no sidebar', async () => {
    renderWithRouter(buildRouter());

    await screen.findByRole('navigation', { name: 'Main navigation' });

    expect(screen.queryByRole('button', { name: /sidebar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('keeps the language switch, the theme switch and the login link', async () => {
    renderWithRouter(buildRouter());

    await screen.findByRole('navigation', { name: 'Main navigation' });

    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });

  it('follows the system theme by default', async () => {
    renderWithRouter(buildRouter());

    const themeSelect = await screen.findByRole('combobox', { name: 'Theme' });

    expect(themeSelect).toHaveValue('system');
  });

  it('stores the theme picked in the theme switch', async () => {
    const { user, store } = renderWithRouter(buildRouter());

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Theme' }), 'dark');

    expect(store.getState().theme.theme).toBe('dark');
  });

  it('names the navigation and the theme options in Vietnamese', async () => {
    await testI18n.changeLanguage('vi');
    renderWithRouter(buildRouter());

    expect(await screen.findByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument();
    const themeSelect = screen.getByRole('combobox', { name: 'Giao diện' });
    expect(within(themeSelect).getByRole('option', { name: 'Sáng' })).toBeInTheDocument();
    expect(within(themeSelect).getByRole('option', { name: 'Tối' })).toBeInTheDocument();
    expect(within(themeSelect).getByRole('option', { name: 'Hệ thống' })).toBeInTheDocument();
  });
});
