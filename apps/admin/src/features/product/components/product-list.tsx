import { useTranslation } from 'react-i18next';

// S1 of docs/specs/SHOP-7/design.md. Until US1 (SHOP-19) builds the list, the page
// shows only its title, S1.2: the template list read the old NestJS API (SHOP-17).
export function ProductList() {
  const { t } = useTranslation('product');

  return (
    <section>
      <h1>{t('title')}</h1>
    </section>
  );
}
