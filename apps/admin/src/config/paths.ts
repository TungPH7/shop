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
  productDetail: {
    path: '/products/:productId',
    getHref: (productId: string) => `/products/${productId}`,
  },
  productEdit: {
    path: '/admin/products/:productId/edit',
    getHref: (productId: string) => `/admin/products/${productId}/edit`,
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
