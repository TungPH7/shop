import { Suspense } from 'react';

import { getTranslations } from 'next-intl/server';

import { getCachedSnapshot } from '../model/get-cached-snapshot';
import { LivePanel } from './live-panel';
import { RevalidateButton } from './revalidate-button';
import { SnapshotView } from './snapshot-view';

/**
 * Orchestrator demo rendering & caching (folder 10). ASYNC Server Component, prerender được
 * nhờ page đã `setRequestLocale`:
 *  - giải i18n MỘT LẦN ở đây (`getTranslations`) rồi truyền string xuống → cache fn & dynamic
 *    hole KHÔNG phải đụng request-scope (luật next-intl × `use cache`);
 *  - `await getCachedSnapshot()` (`use cache`) → data vào **static shell** (panel CACHED);
 *  - `<LivePanel>` bọc `<Suspense>` → **dynamic hole** stream lúc request (panel LIVE);
 *  - `<RevalidateButton>` (client) kích hoạt `revalidateTag`.
 *
 * Đây chính là PPR: 1 trang trộn phần tĩnh (shell) + phần động (hole) — bật bởi cacheComponents.
 */
export async function CachingDemo() {
  const t = await getTranslations('CachingDemo');
  const cached = await getCachedSnapshot();

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>

      {/* CACHED: vào static shell, đứng yên tới khi revalidate. */}
      <SnapshotView
        title={t('cachedTitle')}
        hint={t('cachedHint')}
        generatedAtLabel={t('generatedAtLabel')}
        generatedAt={cached.generatedAt}
        timeId="cached-time"
      />

      {/* LIVE: dynamic hole — stream trong Suspense, đổi mỗi request. */}
      <Suspense fallback={<p>{t('loading')}</p>}>
        <LivePanel
          title={t('liveTitle')}
          hint={t('liveHint')}
          generatedAtLabel={t('generatedAtLabel')}
        />
      </Suspense>

      <RevalidateButton label={t('revalidateButton')} hint={t('revalidateHint')} />
    </main>
  );
}
