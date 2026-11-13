import { createBrowserRouter } from 'react-router';

import { routes } from '@/app/routes';

// The data router instance (React Router v7). Object/data routes unlock per-route
// code splitting (route.lazy), route-level error boundaries (ErrorBoundary), and
// the loader/action data APIs added in later folders.
export const router = createBrowserRouter(routes);
