import { Link } from 'react-router';

import { paths } from '@/config/paths';

export function AccessDeniedRoute() {
  return (
    <section>
      <h2>Access denied</h2>
      <p>You don’t have permission to view this page.</p>
      <Link to={paths.home.getHref()}>Back home</Link>
    </section>
  );
}
