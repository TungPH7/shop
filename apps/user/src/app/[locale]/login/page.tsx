import { type Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { LoginForm } from '~/features/auth/components/login-form';
import { buildPageMetadata } from '~/lib/seo/metadata';

/** Trang đăng nhập = tiện ích → noindex (folder 21). Title đã dịch; KHÔNG khai hreflang. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return buildPageMetadata({ locale, title: t('loginTitle'), pathname: '/login', index: false });
}

/**
 * Trang đăng nhập (mỏng): shell tĩnh + form island. `setRequestLocale` giữ prerender (folder 09).
 *
 * ⭐ Bọc `<Suspense>` quanh `LoginForm`: form dùng `useActionState(loginAction)` (tham chiếu Server
 * Action) — nếu nằm trần trong static shell sẽ báo blocking-route ở `next dev` (bài học folder 14:
 * `build` dung thứ, chỉ `dev` enforce). Server map code lỗi → chuỗi đã dịch rồi truyền xuống (schema
 * locale-agnostic).
 */
export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const errorMessages: Record<string, string> = {
    invalid_email: t('Validation.invalid_email'),
    required: t('Validation.required'),
    credentials: t('Auth.credentials'),
    rateLimited: t('Auth.rateLimited'),
    unknown: t('Auth.unknown'),
  };

  return (
    <main>
      <h1>{t('Auth.loginTitle')}</h1>
      <Suspense fallback={null}>
        <LoginForm
          labels={{
            email: t('Auth.email'),
            password: t('Auth.password'),
            submit: t('Auth.submit'),
            submitting: t('Auth.submitting'),
          }}
          errorMessages={errorMessages}
        />
      </Suspense>
    </main>
  );
}
