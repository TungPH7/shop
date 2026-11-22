import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryDeleteDialog } from '@/features/category/components/category-delete-dialog';
import { clearAll, getSnapshot } from '@/lib/notifications/notification-store';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen, waitFor } from '@/testing/render';
import { stubDialog } from '@/testing/stub-dialog';
import { testI18n } from '@/testing/test-i18n';

// S3 of docs/specs/SHOP-81/design.md against a fake of DELETE /api/admin/categories/{id}.
// jsdom has no modal API of <dialog>: see stubDialog. The real modal, the inert page
// behind and the focus back on S1.8 are checked in a browser (E2E).
stubDialog();

const accessories = {
  id: '019a9c41-2b3d-7e10-8f2a-000000000002',
  name: 'Phụ kiện',
  productCount: 0,
};
const shirts = { id: '019a9c41-2b3d-7e10-8f2a-000000000001', name: 'Áo', productCount: 2 };

afterEach(() => {
  clearAll();
});

/** Records the id of each DELETE, answered by `answer`. */
function fakeDelete(
  answer: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 }),
) {
  const deleted: string[] = [];
  server.use(
    http.delete('*/admin/categories/:id', ({ params }) => {
      deleted.push(String(params['id']));
      return answer();
    }),
  );
  return deleted;
}

function renderDialog(category: typeof accessories | null = accessories) {
  const onCancel = vi.fn();
  const onDeleted = vi.fn();
  const rendered = renderWithProviders(
    <CategoryDeleteDialog category={category} onCancel={onCancel} onDeleted={onDeleted} />,
  );
  return { ...rendered, onCancel, onDeleted };
}

function toasts() {
  return getSnapshot().map(({ kind, message }) => ({ kind, message }));
}

describe('CategoryDeleteDialog', () => {
  it('renders nothing without a category', () => {
    renderDialog(null);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('AC7 names the category, says it cannot be undone and suggests Hidden, with no product warning', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Phụ kiện”?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      "This can't be undone. To hide the category for now, set its status to Hidden when you edit it.",
    );
    expect(screen.queryByText(/will become No category/)).not.toBeInTheDocument();
  });

  it('AC8 says how many products become No category, between the two lines (S3.4)', () => {
    renderDialog(shirts);

    expect(screen.getByRole('alertdialog', { name: 'Delete “Áo”?' })).toHaveAccessibleDescription(
      "This can't be undone. 2 products in this category will become No category. To hide the category for now, set its status to Hidden when you edit it.",
    );
  });

  it('AC8 says it in Vietnamese, and in the singular for one product in English', async () => {
    await testI18n.changeLanguage('vi');
    const { unmount } = renderDialog(shirts);

    expect(
      screen.getByText('2 sản phẩm của danh mục này sẽ thành Không có danh mục.'),
    ).toBeInTheDocument();
    unmount();
    await testI18n.changeLanguage('en');
    renderDialog({ ...shirts, productCount: 1 });

    expect(
      screen.getByText('1 product in this category will become No category.'),
    ).toBeInTheDocument();
  });

  it('puts the first focus on Cancel, not on Delete (S3.1)', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('AC7 Cancel closes without deleting anything', async () => {
    const deleted = fakeDelete();
    const { user, onCancel, onDeleted } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
  });

  it('AC7 Delete deletes the category, says "Category deleted" and reports it', async () => {
    const deleted = fakeDelete();
    const { user, onDeleted } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(deleted).toEqual([accessories.id]);
    expect(toasts()).toEqual([{ kind: 'success', message: 'Category deleted' }]);
  });

  it('AC8 deletes a category that still has products the same way', async () => {
    const deleted = fakeDelete();
    const { user, onDeleted } = renderDialog(shirts);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(deleted).toEqual([shirts.id]);
  });

  it('says "Deleting…" and locks every button while the DELETE runs (S3.7)', async () => {
    let release: () => void = () => undefined;
    const deleted = fakeDelete(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve(new HttpResponse(null, { status: 204 }));
          };
        }),
    );
    const { user, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const deleting = await screen.findByRole('button', { name: 'Deleting…' });
    expect(deleting).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(deleting);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(deleted).toHaveLength(1);
    release();
  });

  it('keeps the dialog with an error when the DELETE fails, and deletes on a second try (S3.7)', async () => {
    let fail = true;
    const deleted = fakeDelete(() =>
      fail ? HttpResponse.error() : new HttpResponse(null, { status: 204 }),
    );
    const { user, onDeleted } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't delete. Please try again.",
    );
    expect(onDeleted).not.toHaveBeenCalled();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(deleted).toHaveLength(2);
  });

  it('NFR10 shows a name with markup as text', () => {
    renderDialog({ ...accessories, name: '</script><script>alert(1)</script>' });

    expect(
      screen.getByRole('alertdialog', { name: 'Delete “</script><script>alert(1)</script>”?' }),
    ).toBeInTheDocument();
    expect(document.querySelector('dialog script')).toBeNull();
  });
});
