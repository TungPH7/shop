import { type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PlaceholderTile } from '@/components/ui/placeholder-tile';
import { paths } from '@/config/paths';
import {
  type AdminProductSummary,
  formatPrice,
  type ProductAvailability,
  type ProductStatus,
} from '@/features/product/model/product';

// The product table of S1.6, in its glass card: Product (tile, name, slug), Price,
// Status, Availability, Actions. The body is the rows, the skeleton or a message
// (S1.9, the error state); the header stays. Under 1024 px the table scrolls
// sideways inside its labelled, focusable region.

const COLUMNS = 5;
const SKELETON_ROWS = 6;

const STATUS_BADGE: Record<ProductStatus, string> = {
  ACTIVE: 'badge badge--info',
  HIDDEN: 'badge badge--neutral',
};

const AVAILABILITY_BADGE: Record<ProductAvailability, string> = {
  IN_STOCK: 'badge badge--good',
  OUT_OF_STOCK: 'badge badge--warn',
};

interface ProductTableProps {
  /** True while the rows are loading or about to change. */
  isBusy: boolean;
  children: ReactNode;
}

export function ProductTable({ isBusy, children }: ProductTableProps) {
  const { t } = useTranslation('product');

  return (
    <div
      className="table-wrap"
      role="region"
      aria-label={t('table.label')}
      aria-busy={isBusy}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reason: the table scrolls sideways under 1024 px, so a keyboard user must reach it (S1.6)
      tabIndex={0}
    >
      <table className="table">
        <caption className="visually-hidden">{t('table.label')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('table.product')}</th>
            <th scope="col" className="table__num">
              {t('table.price')}
            </th>
            <th scope="col">{t('table.status')}</th>
            <th scope="col">{t('table.availability')}</th>
            <th scope="col" className="table__actions">
              {t('table.actions')}
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function ProductRows({ products }: { products: readonly AdminProductSummary[] }) {
  const { t } = useTranslation('product');

  return products.map((product) => (
    <tr key={product.id}>
      <td>
        <div className="table__product">
          <PlaceholderTile id={product.id} name={product.name} />
          <div className="table__product-text">
            <span className="table__name">{product.name}</span>
            <span className="table__sub">{product.slug}</span>
          </div>
        </div>
      </td>
      <td className="table__num">{formatPrice(product.price)}</td>
      <td>
        <span className={STATUS_BADGE[product.status]}>{t(`status.${product.status}`)}</span>
      </td>
      <td>
        <span className={AVAILABILITY_BADGE[product.availability]}>
          {t(`availability.${product.availability}`)}
        </span>
      </td>
      <td className="table__actions">
        <Link
          className="btn btn--secondary btn--sm"
          to={paths.productEdit.getHref(product.id)}
          aria-label={t('actions.editLabel', { name: product.name })}
        >
          {t('actions.edit')}
        </Link>
      </td>
    </tr>
  ));
}

/** The six rows of a loading table, named once for a screen reader in the first cell. */
export function ProductRowsSkeleton() {
  const { t } = useTranslation('product');

  return Array.from({ length: SKELETON_ROWS }, (_, row) => (
    <tr key={row}>
      <td>
        {row === 0 ? <span className="visually-hidden">{t('list.loading')}</span> : null}
        <div className="table__product">
          <span className="skeleton table__skeleton-tile" />
          <span className="skeleton table__skeleton-text" />
        </div>
      </td>
      {Array.from({ length: COLUMNS - 1 }, (_, cell) => (
        <td key={cell}>
          <span className="skeleton table__skeleton-cell" />
        </td>
      ))}
    </tr>
  ));
}

interface ProductTableMessageProps {
  /** `status` for an empty list (S1.9), `alert` for an error. */
  role: 'status' | 'alert';
  message: string;
  /** The button or link under the message. */
  action: ReactNode;
}

export function ProductTableMessage({ role, message, action }: ProductTableMessageProps) {
  return (
    <tr>
      <td colSpan={COLUMNS} className="table__message">
        <p role={role}>{message}</p>
        {action}
      </td>
    </tr>
  );
}
