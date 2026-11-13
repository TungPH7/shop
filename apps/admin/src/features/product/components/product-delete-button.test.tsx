import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ProductDeleteButton } from '@/features/product/components/product-delete-button';
import { renderWithProviders, screen, waitFor } from '@/testing/render';
import { server } from '@/testing/msw/server';

describe('ProductDeleteButton', () => {
  it('confirms then deletes (MSW DELETE)', async () => {
    let deletedId: string | null = null;
    server.use(
      http.delete('*/products/:id', ({ params }) => {
        deletedId = String(params['id']);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderWithProviders(<ProductDeleteButton productId="p-001" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' })); // confirm step

    await waitFor(() => {
      expect(deletedId).toBe('p-001');
    });
  });

  it('cancels without deleting', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('*/products/:id', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderWithProviders(<ProductDeleteButton productId="p-001" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument(); // back to start
    expect(deleteCalled).toBe(false);
  });

  it('shows an error when the delete request fails', async () => {
    // 400 (not 5xx) so the api layer does not retry → fails fast.
    server.use(
      http.delete('*/products/:id', () =>
        HttpResponse.json({ message: 'Bad request' }, { status: 400 }),
      ),
    );

    const { user } = renderWithProviders(<ProductDeleteButton productId="p-001" />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
