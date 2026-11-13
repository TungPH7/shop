import { setupServer } from 'msw/node';

import { handlers } from './handlers';

// MSW server for Node (Vitest). The browser worker (for Playwright/dev) is a
// separate concern set up in step 3 via `npx msw init`.
export const server = setupServer(...handlers);
