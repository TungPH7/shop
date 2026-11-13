import { createNavigation } from 'next-intl/navigation';

import { routing } from '~/i18n/routing';

/**
 * Wrapper navigation LOCALE-AWARE của next-intl — `Link`/`redirect`/`usePathname`/
 * `useRouter` tự thêm/giữ tiền tố locale theo `routing`. THAY việc nối `/${locale}/...`
 * thủ công ở folder 08: viết `<Link href="/about">` → ra `/en/about` hay `/vi/about`
 * tuỳ locale hiện tại.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
