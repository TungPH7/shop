import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { setupAuth } from '@/app/configure-auth';
import { setupObservability } from '@/app/observability';
import { AppProvider } from '@/app/provider';
import '@/lib/i18n/i18n'; // side-effect: initialize i18next before render (folder 14)
import '@/styles/global.css';

// Wire cross-cutting seams once, before anything renders or fetches (Vercel
// `advanced-init-once`). Observability first so errors during the rest of
// bootstrap are captured; then the API auth seam (folder 07).
setupObservability();
setupAuth();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProvider />
  </StrictMode>,
);
