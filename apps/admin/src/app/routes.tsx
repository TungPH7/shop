import { type RouteObject } from 'react-router';

import { RootLayout } from '@/app/layouts/root-layout';
import { HomeRoute } from '@/app/routes/home/home-route';
import { NotFoundRoute } from '@/app/routes/not-found/not-found-route';
import { RouteError } from '@/app/routes/route-error';
import { paths } from '@/config/paths';
import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { RequireModule } from '@/features/auth/components/require-module';

// Pure-data route table (React Router v7 data router).
//
// - The pathless layout route renders the app shell (RootLayout) once and shows
//   each child through its <Outlet />, so the shell never remounts on navigation.
// - Eager routes use `Component`; secondary routes use `lazy` so each one lands
//   in its own JS chunk. Auth guards are eager (small) and compose as nested
//   pathless layout routes: ProtectedRoute (auth) → RequireModule (RBAC) → page.
// - `RequireModule` takes a prop, so it uses `element` (JSX) rather than
//   `Component`; that is the one intentional exception to the data-only style.
export const routes: RouteObject[] = [
  {
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: HomeRoute },
      {
        path: paths.products.path,
        lazy: async () => {
          const { ProductsRoute } = await import('@/app/routes/products/products-route');
          return { Component: ProductsRoute };
        },
      },
      {
        path: paths.productDetail.path,
        lazy: async () => {
          const { ProductDetailRoute } = await import('@/app/routes/products/product-detail-route');
          return { Component: ProductDetailRoute };
        },
      },
      {
        path: paths.about.path,
        lazy: async () => {
          const { AboutRoute } = await import('@/app/routes/about/about-route');
          return { Component: AboutRoute };
        },
      },
      // --- Public auth routes ---
      {
        path: paths.login.path,
        lazy: async () => {
          const { LoginRoute } = await import('@/app/routes/login/login-route');
          return { Component: LoginRoute };
        },
      },
      {
        path: paths.accessDenied.path,
        lazy: async () => {
          const { AccessDeniedRoute } =
            await import('@/app/routes/access-denied/access-denied-route');
          return { Component: AccessDeniedRoute };
        },
      },
      // --- Protected routes (authentication required) ---
      {
        Component: ProtectedRoute,
        children: [
          {
            path: paths.profile.path,
            lazy: async () => {
              const { ProfileRoute } = await import('@/app/routes/profile/profile-route');
              return { Component: ProfileRoute };
            },
          },
          // Module-gated (RBAC): the guard carries the required module.
          {
            element: <RequireModule module="role" />,
            children: [
              {
                path: paths.admin.path,
                lazy: async () => {
                  const { AdminRoute } = await import('@/app/routes/admin/admin-route');
                  return { Component: AdminRoute };
                },
              },
              {
                path: paths.productEdit.path,
                lazy: async () => {
                  const { ProductEditRoute } =
                    await import('@/app/routes/admin/product-edit-route');
                  return { Component: ProductEditRoute };
                },
              },
            ],
          },
        ],
      },
      { path: paths.notFound.path, Component: NotFoundRoute },
    ],
  },
];
