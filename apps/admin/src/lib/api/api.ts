import { env } from '@/config/env';
import { createApiClient } from '@/lib/api/api-client';

// The app-wide API client. Base URL comes from validated env; authentication is
// wired in later by the auth module via `configureApiAuth()` (folder 10).
export const api = createApiClient({ baseURL: env.apiUrl });
