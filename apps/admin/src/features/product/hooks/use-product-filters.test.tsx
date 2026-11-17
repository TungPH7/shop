import { type ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { describe, expect, it, vi } from 'vitest';

import { useProductFilters } from '@/features/product/hooks/use-product-filters';

// The hook is the facade of the URL state of the list (ST-015). The testing adapter
// of nuqs stands for the URL: it starts from `search` and reports each update.
function renderFilters(search = '') {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
        {children}
      </NuqsTestingAdapter>
    );
  }
  const view = renderHook(() => useProductFilters(), { wrapper: Wrapper });
  const lastSearch = () => onUrlUpdate.mock.lastCall?.[0].queryString;
  return { ...view, lastSearch };
}

describe('useProductFilters', () => {
  it('defaults to no keyword, every status and page 1', () => {
    const { result } = renderFilters();

    expect(result.current.filters).toEqual({ q: '', status: 'all', page: 1 });
  });

  it('reads the keyword, the status and the page from the URL', () => {
    const { result } = renderFilters('?q=ao+thun&status=hidden&page=2');

    expect(result.current.filters).toEqual({ q: 'ao thun', status: 'hidden', page: 2 });
  });

  it.each([
    ['an unknown status', '?status=HIDDEN', { status: 'all', page: 1 }],
    ['a page of 0', '?page=0', { status: 'all', page: 1 }],
    ['a negative page', '?page=-2', { status: 'all', page: 1 }],
    ['a page that is not a whole number', '?page=2.5', { status: 'all', page: 1 }],
    ['a page that is not a number', '?page=two', { status: 'all', page: 1 }],
    ['a page whose offset would not fit an int of the API', '?page=107374184', { page: 1 }],
    ['a page past the largest safe number', '?page=99999999999999999999', { page: 1 }],
  ])('uses the default for %s (S1.11)', (_, search, expected) => {
    const { result } = renderFilters(search);

    expect(result.current.filters).toMatchObject(expected);
  });

  it('reads the last page whose offset fits an int of the API', () => {
    const { result } = renderFilters('?page=107374183');

    expect(result.current.filters.page).toBe(107_374_183);
  });

  it('sets the status and goes back to page 1', async () => {
    const { result, lastSearch } = renderFilters('?q=ao&page=3');

    act(() => {
      result.current.setStatus('hidden');
    });

    expect(result.current.filters).toEqual({ q: 'ao', status: 'hidden', page: 1 });
    await waitFor(() => {
      expect(lastSearch()).toBe('?q=ao&status=hidden');
    });
  });

  it('drops status from the URL when All is picked', async () => {
    const { result, lastSearch } = renderFilters('?status=hidden');

    act(() => {
      result.current.setStatus('all');
    });

    await waitFor(() => {
      expect(lastSearch()).toBe('');
    });
  });

  it('sets the keyword and goes back to page 1', async () => {
    const { result, lastSearch } = renderFilters('?status=active&page=2');

    act(() => {
      result.current.setSearch('AO THUN');
    });

    expect(result.current.filters).toEqual({ q: 'AO THUN', status: 'active', page: 1 });
    await waitFor(() => {
      expect(lastSearch()).toBe('?status=active&q=AO+THUN');
    });
  });

  it('drops a blank keyword from the URL', async () => {
    const { result, lastSearch } = renderFilters('?q=ao');

    act(() => {
      result.current.setSearch('   ');
    });

    expect(result.current.filters.q).toBe('');
    await waitFor(() => {
      expect(lastSearch()).toBe('');
    });
  });

  it('clears the keyword, the status and the page', async () => {
    const { result, lastSearch } = renderFilters('?q=xyz&status=hidden&page=2');

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({ q: '', status: 'all', page: 1 });
    await waitFor(() => {
      expect(lastSearch()).toBe('');
    });
  });

  it('builds the link of a page that keeps the keyword and the status (AC4)', () => {
    const { result } = renderFilters('?q=ao&status=hidden');

    expect(result.current.hrefForPage(2)).toEqual({ search: '?q=ao&status=hidden&page=2' });
    expect(result.current.hrefForPage(1)).toEqual({ search: '?q=ao&status=hidden' });
  });
});
