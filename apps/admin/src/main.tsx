import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { setupAuth } from '@/app/configure-auth';
import { setupObservability } from '@/app/observability';
import { AppProvider } from '@/app/provider';
import '@/lib/i18n/i18n'; // side-effect: initialize i18next before render (folder 14)
import { store } from '@/stores/store';
import { syncThemeToDocument } from '@/stores/theme/apply-theme';
// Be Vietnam Pro 500, 600, 700: each file holds the latin, latin-ext and vietnamese
// subsets, woff2 with font-display: swap (NFR5). The fallback is in tokens.css.
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import '@/styles/components.css';
import '@/styles/list-page.css';

// Wire cross-cutting seams once, before anything renders or fetches (Vercel
// `advanced-init-once`). Observability first so errors during the rest of
// bootstrap are captured; then the API auth seam (folder 07); then the theme:
// public/theme-init.js already put the stored one on <html> before the first
// paint, and from here <html> follows every change of the store.
setupObservability();
setupAuth();
syncThemeToDocument(store);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProvider />
  </StrictMode>,
);
