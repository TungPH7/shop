import { Link } from 'react-router';

import { env } from '@/config/env';
import { paths } from '@/config/paths';

// Eagerly bundled: the landing page is on the critical path, so there is no
// benefit to lazy-loading the first screen every visitor sees.
export function HomeRoute() {
  return (
    <section>
      <h2>Phase 1.1 — Core foundation (UI-agnostic)</h2>
      <p>
        API base URL: <code>{env.apiUrl}</code>
      </p>
      <p>
        Open the <Link to={paths.products.getHref()}>products</Link> demo to see lazy-loaded,
        code-split routes in action.
      </p>
    </section>
  );
}
