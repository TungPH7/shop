import { onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductDeleteDialog } from '@/features/product/components/product-delete-dialog';
import { clearAll, getSnapshot } from '@/lib/notifications/notification-store';
import { server } from '@/testing/msw/server';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

// S3 of docs/specs/SHOP-7/design.md against a fake of DELETE /api/admin/products/{id}.
// jsdom has <dialog> but not its modal API: the stub below only toggles `open` and
// fires `close`, as in the test of <Dialog>. The real modal, the inert page behind and
// the focus back on S1.8 are checked in a browser (E2E).
Object.assign(HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  },
  close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  },
});

const jeans = { id: '019a8f2e-5b7c-7d10-9e3f-000000000002', name: 'Quần jean nam' };

afterEach(() => {
  clearAll();
  onlineManager.setOnline(true);
});

/** Records the id of each DELETE, answered by `answer`. */
function fakeDelete(
  answer: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 }),
) {
  const deleted: string[] = [];
  server.use(
    http.delete('*/admin/products/:id', ({ params }) => {
      deleted.push(String(params['id']));
      return answer();
    }),
  );
  return deleted;
}

function renderDialog(product: typeof jeans | null = jeans) {
  const onCancel = vi.fn();
  const onDeleted = vi.fn();
  const rendered = renderWithProviders(
    <ProductDeleteDialog product={product} onCancel={onCancel} onDeleted={onDeleted} />,
  );
  return { ...rendered, onCancel, onDeleted };
}

function toasts() {
  return getSnapshot().map(({ kind, message }) => ({ kind, message }));
}

describe('ProductDeleteDialog', () => {
  it('renders nothing without a product', () => {
    renderDialog(null);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('AC14 names the product, says it cannot be undone and suggests Hidden', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Quần jean nam”?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      "This can't be undone. To stop selling it for now, set its status to Hidden instead.",
    );
  });

  it('puts the first focus on Cancel, not on Delete (S3.1)', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('AC14 Cancel closes without deleting anything', async () => {
    const deleted = fakeDelete();
    const { user, onCancel, onDeleted } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
  });

  it('treats Esc as Cancel', () => {
    const deleted = fakeDelete();
    const { onCancel } = renderDialog();

    fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(deleted).toEqual([]);
  });

  it('treats the Close button as Cancel (S3.2)', async () => {
    const { user, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('AC15 deletes the product, then says "Product deleted"', async () => {
    const deleted = fakeDelete();
    const { user, onDeleted, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(deleted).toEqual([jeans.id]);
    expect(toasts()).toEqual([{ kind: 'success', message: 'Product deleted' }]);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('shows "Deleting…" and locks Close, Cancel, Esc and Delete while it deletes (S3.6)', async () => {
    let answer: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const deleted = fakeDelete(async () => {
      await held;
      return new HttpResponse(null, { status: 204 });
    });
    const { user, onCancel, onDeleted } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const deleting = await screen.findByRole('button', { name: 'Deleting…' });
    expect(deleting).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(deleting);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();

    answer?.();
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(deleted).toEqual([jeans.id]);
  });

  it('keeps the dialog and shows the error of S3.6 on a network error, sending the DELETE once', async () => {
    const deleted = fakeDelete(() => HttpResponse.error());
    const { user, onDeleted } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't delete. Please try again.",
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('aria-disabled');
    expect(deleted).toHaveLength(1);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
  });

  it('shows the error of S3.6 at once when the browser is offline, rather than wait locked for the network', async () => {
    fakeDelete(() => HttpResponse.error());
    onlineManager.setOnline(false);
    const { user, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't delete. Please try again.",
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows the error of S3.6 on a 5xx', async () => {
    fakeDelete(() => new HttpResponse(null, { status: 503 }));
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't delete. Please try again.",
    );
  });

  it('deletes on a second press after an error, and the error goes away', async () => {
    let calls = 0;
    fakeDelete(() => {
      calls += 1;
      return calls === 1 ? HttpResponse.error() : new HttpResponse(null, { status: 204 });
    });
    const { user, onDeleted } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('forgets the error of the last product when it is cancelled', async () => {
    fakeDelete(() => HttpResponse.error());
    const { user, rerender, onCancel } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    rerender(<ProductDeleteDialog product={null} onCancel={onCancel} onDeleted={vi.fn()} />);
    rerender(
      <ProductDeleteDialog
        product={{ id: '019a8f2e-5b7c-7d10-9e3f-000000000001', name: 'Áo thun cổ tròn' }}
        onCancel={onCancel}
        onDeleted={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('alertdialog', { name: 'Delete “Áo thun cổ tròn”?' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('speaks Vietnamese', async () => {
    await testI18n.changeLanguage('vi');
    fakeDelete();
    const { user, onDeleted } = renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Xóa “Quần jean nam”?' });
    expect(dialog).toHaveAccessibleDescription(
      'Việc xóa không hoàn tác được. Nếu chỉ muốn tạm ngừng bán, hãy chọn Ẩn.',
    );
    expect(screen.getByRole('button', { name: 'Hủy' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Xóa' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(toasts()).toEqual([{ kind: 'success', message: 'Đã xóa sản phẩm' }]);
  });
});
