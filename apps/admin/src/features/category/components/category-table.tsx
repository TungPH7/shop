import { type ReactNode, type Ref } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { paths } from '@/config/paths';
import {
  type AdminCategoryListItem,
  type CategoryStatus,
} from '@/features/category/model/category';
import { useLocale } from '@/lib/i18n/use-locale';

// The category table of S1.4 of docs/specs/SHOP-81/design.md, in its glass card: Name,
// URL slug, Status (S1.5), Products (S1.6, right-aligned), Actions (Edit S1.7, Delete
// S1.8). The body is the rows, the skeleton or a message (S1.9, the error state); the
// header stays. Under 1024 px the table scrolls sideways inside its labelled, focusable
// region. Every class is one of the design system (docs/design-system/admin.md).

const COLUMNS = 5;
const SKELETON_ROWS = 6;

const STATUS_BADGE: Record<CategoryStatus, string> = {
  VISIBLE: 'badge badge--info',
  HIDDEN: 'badge badge--neutral',
};

interface CategoryTableProps {
  /** True while the rows are loading or about to change. */
  isBusy: boolean;
  children: ReactNode;
  /** The focusable region of the table, where focus goes after a delete (S3). */
  ref?: Ref<HTMLDivElement>;
}

export function CategoryTable({ isBusy, children, ref }: CategoryTableProps) {
  const { t } = useTranslation('category');

  return (
    <div
      ref={ref}
      className="table-wrap"
      role="region"
      aria-label={t('table.label')}
      aria-busy={isBusy}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reason: the table scrolls sideways under 1024 px, so a keyboard user must reach it (S1.4)
      tabIndex={0}
    >
      <table className="table">
        <caption className="visually-hidden">{t('table.label')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('table.name')}</th>
            <th scope="col">{t('table.slug')}</th>
            <th scope="col">{t('table.status')}</th>
            <th scope="col" className="table__num">
              {t('table.productCount')}
            </th>
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

interface CategoryRowsProps {
  categories: readonly AdminCategoryListItem[];
  /** Delete of a row (S1.8): opens S3 for its category. */
  onDelete: (category: AdminCategoryListItem) => void;
}

/** The rows in the order of the api, by name as Vietnamese sorts it: never sorted again. */
export function CategoryRows({ categories, onDelete }: CategoryRowsProps) {
  const { t } = useTranslation('category');
  const { locale } = useLocale();
  const count = new Intl.NumberFormat(locale);

  return categories.map((category) => (
    <tr key={category.id}>
      <td>
        <span className="table__name">{category.name}</span>
      </td>
      <td>
        <span className="table__sub">{category.slug}</span>
      </td>
      <td>
        <span className={STATUS_BADGE[category.status]}>{t(`status.${category.status}`)}</span>
      </td>
      <td className="table__num">{count.format(category.productCount)}</td>
      <td className="table__actions">
        <div className="table__row-actions">
          <Link
            className="btn btn--secondary btn--sm"
            to={paths.categoryEdit.getHref(category.id)}
            aria-label={t('actions.editLabel', { name: category.name })}
          >
            {t('actions.edit')}
          </Link>
          <button
            type="button"
            className="btn btn--secondary btn--sm btn--bad-text"
            aria-label={t('actions.deleteLabel', { name: category.name })}
            onClick={() => {
              onDelete(category);
            }}
          >
            {t('actions.delete')}
          </button>
        </div>
      </td>
    </tr>
  ));
}

/** The six rows of a loading table, named once for a screen reader in the first cell. */
export function CategoryRowsSkeleton() {
  const { t } = useTranslation('category');

  return Array.from({ length: SKELETON_ROWS }, (_, row) => (
    <tr key={row}>
      {Array.from({ length: COLUMNS }, (_, cell) => (
        <td key={cell}>
          {row === 0 && cell === 0 ? (
            <span className="visually-hidden">{t('list.loading')}</span>
          ) : null}
          <span className="skeleton table__skeleton-cell" />
        </td>
      ))}
    </tr>
  ));
}

interface CategoryTableMessageProps {
  /** `status` for an empty list (S1.9), `alert` for an error. */
  role: 'status' | 'alert';
  message: string;
  /** The button under the message, if any. */
  action?: ReactNode;
}

export function CategoryTableMessage({ role, message, action }: CategoryTableMessageProps) {
  return (
    <tr>
      <td colSpan={COLUMNS} className="table__message">
        <p role={role}>{message}</p>
        {action}
      </td>
    </tr>
  );
}
