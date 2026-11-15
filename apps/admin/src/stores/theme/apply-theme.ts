import { type Theme } from '@/stores/theme/theme-slice';

// The visual theme lives in CSS (src/styles/tokens.css): light by default, dark under
// `prefers-color-scheme: dark`, and `data-theme` on <html> overrides both. So the
// `system` theme is the absence of the attribute, never a value of it.
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.dataset['theme'] = theme;
  }
}

interface ThemeStore {
  getState: () => { theme: { theme: Theme } };
  subscribe: (listener: () => void) => () => void;
}

// Called once in main.tsx before the first render. public/theme-init.js has already
// put the stored theme on <html> before the first paint; this keeps <html> in step
// with the store from then on. Returns the unsubscribe.
export function syncThemeToDocument(store: ThemeStore): () => void {
  let current = store.getState().theme.theme;
  applyTheme(current);
  return store.subscribe(() => {
    const next = store.getState().theme.theme;
    if (next !== current) {
      current = next;
      applyTheme(next);
    }
  });
}
