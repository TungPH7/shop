import NextLink from 'next/link';

import { type BreadcrumbLdItem } from '~/lib/seo/structured-data';

/**
 * The breadcrumb of the store (design.md of SHOP-81, S5.2 and S8.2): "Trang chủ › Áo › Áo thun cổ tròn". It takes the
 * very crumbs `breadcrumbLd` takes, so the trail on the page and its JSON-LD `BreadcrumbList` never differ (SPEC of
 * SHOP-81, Code Style). Styles: `.breadcrumb` in src/styles/components.css.
 *
 * - A `<nav>` named `label` ("Đường dẫn trang" / "Breadcrumb") holding an `<ol>`.
 * - Every crumb but the last is a real `<a href>`, which a search engine follows, to the path of its absolute URL: that
 *   path already holds the locale, so the link is next/link and not the Link of next-intl, which would add it again.
 * - The last crumb is the current page: text with `aria-current="page"`, not a link.
 * - The separators › are `aria-hidden`, so a screen reader does not read them.
 *
 * Names are text nodes, never HTML (NFR10). A synchronous view with no hook, so it renders in any server component.
 */
export function Breadcrumb({
  items,
  label,
}: {
  items: readonly BreadcrumbLdItem[];
  label: string;
}) {
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
                <NextLink className="breadcrumb__link" href={new URL(item.url).pathname}>
                  {item.name}
                </NextLink>
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
