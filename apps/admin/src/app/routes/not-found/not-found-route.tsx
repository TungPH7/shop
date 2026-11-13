import { Link } from 'react-router';

import { paths } from '@/config/paths';

// Catch-all 404 (route path '*'). Rendered inside the root layout, so the
// navigation stays available and the user can recover.
export function NotFoundRoute() {
  return (
    <section>
      <h2>404 — Page not found</h2>
      <p>The page you requested does not exist.</p>
      <Link to={paths.home.getHref()}>Go home</Link>
    </section>
  );
}
