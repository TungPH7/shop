import { setupServer } from 'msw/node';

import { handlers } from './handlers';

// MSW server cho Node (Vitest). Worker cho trình duyệt (Playwright/dev) là việc
// khác, dựng sau bằng `npx msw init` ở folder E2E khi cần.
export const server = setupServer(...handlers);
