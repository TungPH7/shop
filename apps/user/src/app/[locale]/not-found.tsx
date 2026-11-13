import { useTranslations } from 'next-intl';

// UI 404 trong segment [locale] — render bên trong [locale]/layout (đã `setRequestLocale`)
// nên `useTranslations` (Server Component đồng bộ) đọc đúng locale hiện tại. Đã dịch (09).
export default function NotFound() {
  const t = useTranslations('NotFound');
  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </main>
  );
}
