import { useLocation, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Pagination } from '@/components/ui/pagination';
import { act, renderWithProviders, screen, within } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

function pageLabels() {
  const nav = screen.getByRole('navigation', { name: 'Pagination' });
  return within(nav)
    .getAllByRole('listitem', { hidden: true })
    .map((item) => item.textContent);
}

function hrefFor(page: number) {
  return `?page=${page}`;
}

// A list page as US1 builds it: the page comes from ?page= of the URL, and every link
// keeps the other parameters.
function ProductList({ totalItems }: { totalItems: number }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const page = Number(searchParams.get('page') ?? '1');

  return (
    <>
      <Pagination
        page={page}
        pageSize={20}
        totalItems={totalItems}
        hrefFor={(target) => `?q=lamp&page=${target}`}
      />
      <output aria-label="Location">{location.pathname + location.search}</output>
    </>
  );
}

describe('Pagination', () => {
  it('is a navigation landmark named Pagination with the range shown', () => {
    renderWithProviders(<Pagination page={1} pageSize={20} totalItems={25} hrefFor={hrefFor} />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText('Showing 1–20 of 25')).toBeInTheDocument();
  });

  it('shows the range of the last, partial page', () => {
    renderWithProviders(<Pagination page={2} pageSize={20} totalItems={25} hrefFor={hrefFor} />);

    expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument();
  });

  it('formats the numbers of the range in the language of the page', async () => {
    await act(() => testI18n.changeLanguage('vi'));
    renderWithProviders(
      <Pagination page={500} pageSize={20} totalItems={10000} hrefFor={hrefFor} />,
    );

    expect(screen.getByText('Hiển thị 9.981–10.000 trên 10.000')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument();
  });

  it('is hidden when everything fits on one page', () => {
    renderWithProviders(<Pagination page={1} pageSize={20} totalItems={20} hrefFor={hrefFor} />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('links every page to its URL, so it opens in a new tab or can be copied', () => {
    renderWithProviders(<ProductList totalItems={60} />, { route: '/products?q=lamp&page=2' });

    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'href',
      '/products?q=lamp&page=1',
    );
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/products?q=lamp&page=1',
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/products?q=lamp&page=3',
    );
  });

  it('marks the current page with aria-current', () => {
    renderWithProviders(<Pagination page={2} pageSize={20} totalItems={60} hrefFor={hrefFor} />);

    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
  });

  it('moves with Previous, Next and a page number', async () => {
    const { user } = renderWithProviders(<ProductList totalItems={100} />, {
      route: '/products?q=lamp&page=2',
    });
    const location = screen.getByRole('status', { name: 'Location' });

    await user.click(screen.getByRole('link', { name: 'Previous' }));
    expect(location).toHaveTextContent('/products?q=lamp&page=1');

    await user.click(screen.getByRole('link', { name: 'Next' }));
    expect(location).toHaveTextContent('/products?q=lamp&page=2');

    await user.click(screen.getByRole('link', { name: 'Page 4' }));
    expect(location).toHaveTextContent('/products?q=lamp&page=4');
    expect(screen.getByText('Showing 61–80 of 100')).toBeInTheDocument();
  });

  it('locks Previous on the first page and keeps it focusable', async () => {
    const { user } = renderWithProviders(<ProductList totalItems={60} />, {
      route: '/products?q=lamp&page=1',
    });

    const previous = screen.getByRole('link', { name: 'Previous' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(previous).not.toHaveAttribute('href');
    await user.click(previous);

    expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent(
      '/products?q=lamp&page=1',
    );
    previous.focus();
    expect(previous).toHaveFocus();
  });

  it('keeps focus on Next when the keyboard reaches the last page with it', async () => {
    const { user } = renderWithProviders(<ProductList totalItems={60} />, {
      route: '/products?q=lamp&page=1',
    });

    const next = screen.getByRole('link', { name: 'Next' });
    next.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent(
      '/products?q=lamp&page=3',
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('lists every page when there are seven or fewer', () => {
    renderWithProviders(<Pagination page={1} pageSize={20} totalItems={140} hrefFor={hrefFor} />);

    expect(pageLabels()).toEqual(['Previous', '1', '2', '3', '4', '5', '6', '7', 'Next']);
  });

  it('shortens a long list to the ends and the pages around the current one', () => {
    renderWithProviders(<Pagination page={10} pageSize={20} totalItems={400} hrefFor={hrefFor} />);

    expect(pageLabels()).toEqual(['Previous', '1', '…', '9', '10', '11', '…', '20', 'Next']);
  });

  it('shows a page number instead of an ellipsis that would hide a single page', () => {
    renderWithProviders(<Pagination page={4} pageSize={20} totalItems={400} hrefFor={hrefFor} />);

    expect(pageLabels()).toEqual(['Previous', '1', '2', '3', '4', '5', '…', '20', 'Next']);
  });

  // S1.11: an invalid page is page 1. The caller already reads ?page= that way, so this
  // only guards against a caller that does not.
  it.each([
    ['past the last page', 99],
    ['not a number', Number.NaN],
    ['zero', 0],
    ['not a whole number', 2.5],
  ])('shows page 1 for a page %s', (_, page) => {
    renderWithProviders(<Pagination page={page} pageSize={20} totalItems={60} hrefFor={hrefFor} />);

    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Showing 1–20 of 60')).toBeInTheDocument();
  });
});
