import { Link } from '~/i18n/navigation';
import { type BreadcrumbLdItem } from '~/lib/seo/structured-data';

/** One crumb: what `breadcrumbLd` takes, and the path without the locale, as the Link of next-intl takes it. */
export type BreadcrumbItem = BreadcrumbLdItem & {
  /** The path without the locale: '/', '/categories/ao'. */
  href: string;
};

/**
 * The breadcrumb of the store (design.md of SHOP-81, S5.2 and S8.2): "Trang chủ › Áo › Áo thun cổ tròn". It takes the
 * very crumbs `breadcrumbLd` takes, so the trail on the page and its JSON-LD `BreadcrumbList` never differ (SPEC of
 * SHOP-81, Code Style). Styles: `.breadcrumb` in src/styles/components.css.
 *
 * - A `<nav>` named `label` ("Đường dẫn trang" / "Breadcrumb") holding an `<ol>`.
 * - Every crumb but the last is a real `<a href>`, which a search engine follows, built by the Link of next-intl from
 *   the path without the locale, as every link of the store (SPEC of SHOP-81, section SEO, S5, Internal links). The
 *   pages put the breadcrumb inside their `<Suspense>`, where that Link may read the path (see StaticLink).
 * - The last crumb is the current page: text with `aria-current="page"`, not a link.
 * - The separators › are `aria-hidden`, so a screen reader does not read them.
 *
 * Names are text nodes, never HTML (NFR10). A synchronous view with no hook, so it renders in any server component.
 */
export function Breadcrumb({ items, label }: { items: readonly BreadcrumbItem[]; label: string }) {
  const lastIndex = items.length - 1;

  return (
    <nav aria-label={label} className="breadcrumb">
      <ol className="breadcrumb__list">
        {items.map((item, index) => (
          <li key={item.url} className="breadcrumb__item">
            {index === lastIndex ? (
              <span className="breadcrumb__current" aria-current="page">
                {item.name}
              </span>
            ) : (
              <>
                <Link className="breadcrumb__link" href={item.href}>
                  {item.name}
                </Link>
                <span className="breadcrumb__separator" aria-hidden="true">
                  ›
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The place of a breadcrumb of one row while its page loads: as high as the row, with its margin, so the content under
 * it is not pushed down when the breadcrumb comes (SPEC of SHOP-81, section SEO, S8, Core Web Vitals). Styles:
 * `.breadcrumb-skeleton` in src/styles/components.css.
 */
export function BreadcrumbSkeleton() {
  return <span className="skeleton breadcrumb-skeleton" aria-hidden="true" />;
}
