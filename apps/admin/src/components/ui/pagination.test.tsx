import { describe, expect, it, vi } from 'vitest';

import { Pagination } from '@/components/ui/pagination';
import { act, renderWithProviders, screen, within } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

function pageLabels() {
  const nav = screen.getByRole('navigation', { name: 'Pagination' });
  return within(nav)
    .getAllByRole('listitem', { hidden: true })
    .map((item) => item.textContent);
}

describe('Pagination', () => {
  it('is a navigation landmark named Pagination with the range shown', () => {
    renderWithProviders(
      <Pagination page={1} pageSize={20} totalItems={25} onPageChange={vi.fn()} />,
    );

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText('Showing 1–20 of 25')).toBeInTheDocument();
  });

  it('shows the range of the last, partial page', () => {
    renderWithProviders(
      <Pagination page={2} pageSize={20} totalItems={25} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument();
  });

  it('formats the numbers of the range in the language of the page', async () => {
    await act(() => testI18n.changeLanguage('vi'));
    renderWithProviders(
      <Pagination page={500} pageSize={20} totalItems={10000} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText('Hiển thị 9.981–10.000 trên 10.000')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument();
  });

  it('is hidden when everything fits on one page', () => {
    renderWithProviders(
      <Pagination page={1} pageSize={20} totalItems={20} onPageChange={vi.fn()} />,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('marks the current page with aria-current', () => {
    renderWithProviders(
      <Pagination page={2} pageSize={20} totalItems={60} onPageChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
  });

  it('locks Previous on the first page and keeps it focusable', async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(
      <Pagination page={1} pageSize={20} totalItems={60} onPageChange={onPageChange} />,
    );

    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    await user.click(previous);

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('locks Next on the last page', async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(
      <Pagination page={3} pageSize={20} totalItems={60} onPageChange={onPageChange} />,
    );

    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await user.click(next);

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('moves with Previous, Next and a page number', async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(
      <Pagination page={2} pageSize={20} totalItems={60} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(onPageChange.mock.calls).toEqual([[1], [3], [3]]);
  });

  it('does nothing when the current page is pressed', async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(
      <Pagination page={2} pageSize={20} totalItems={60} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('lists every page when there are seven or fewer', () => {
    renderWithProviders(
      <Pagination page={1} pageSize={20} totalItems={140} onPageChange={vi.fn()} />,
    );

    expect(pageLabels()).toEqual(['Previous', '1', '2', '3', '4', '5', '6', '7', 'Next']);
  });

  it('shortens a long list to the ends and the pages around the current one', () => {
    renderWithProviders(
      <Pagination page={10} pageSize={20} totalItems={400} onPageChange={vi.fn()} />,
    );

    expect(pageLabels()).toEqual(['Previous', '1', '…', '9', '10', '11', '…', '20', 'Next']);
  });

  it('shows a page number instead of an ellipsis that would hide a single page', () => {
    renderWithProviders(
      <Pagination page={4} pageSize={20} totalItems={400} onPageChange={vi.fn()} />,
    );

    expect(pageLabels()).toEqual(['Previous', '1', '2', '3', '4', '5', '…', '20', 'Next']);
  });

  it('treats a page past the end as the last page', () => {
    renderWithProviders(
      <Pagination page={99} pageSize={20} totalItems={60} onPageChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Showing 41–60 of 60')).toBeInTheDocument();
  });
});
