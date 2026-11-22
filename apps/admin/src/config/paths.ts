/**
 * Centralised, typed route paths — the single source of truth for URLs.
 *
 * Why: avoid magic path strings scattered across the app. Components build links
 * via `paths.*.getHref()`, so a URL change happens in exactly one place and
 * TypeScript checks the params each link must pass.
 *
 * - `path`    — the pattern handed to React Router (may contain `:params`).
 * - `getHref` — builds a concrete URL for navigation/links (params are typed).
 */
export const paths = {
  home: {
    path: '/',
    getHref: () => '/',
  },
  products: {
    path: '/products',
    getHref: () => '/products',
  },
  /** S2 in add mode (US2). */
  productNew: {
    path: '/products/new',
    getHref: () => '/products/new',
  },
  /** S2 in edit mode (US3). */
  productEdit: {
    path: '/products/:productId/edit',
    getHref: (productId: string) => `/products/${encodeURIComponent(productId)}/edit`,
  },
  /** S1 of docs/specs/SHOP-81/design.md: the category list, with the delete dialog S3. */
  categories: {
    path: '/categories',
    getHref: () => '/categories',
  },
  /** S2 of SHOP-81 in add mode. */
  categoryNew: {
    path: '/categories/new',
    getHref: () => '/categories/new',
  },
  /** S2 of SHOP-81 in edit mode. */
  categoryEdit: {
    path: '/categories/:categoryId/edit',
    getHref: (categoryId: string) => `/categories/${encodeURIComponent(categoryId)}/edit`,
  },
  about: {
    path: '/about',
    getHref: () => '/about',
  },
  login: {
    path: '/login',
    getHref: () => '/login',
  },
  accessDenied: {
    path: '/access-denied',
    getHref: () => '/access-denied',
  },
  profile: {
    path: '/profile',
    getHref: () => '/profile',
  },
  admin: {
    path: '/admin',
    getHref: () => '/admin',
  },
  /** Catch-all (404). Must stay last in the route table. */
  notFound: {
    path: '*',
    getHref: () => '/404',
  },
} as const;
