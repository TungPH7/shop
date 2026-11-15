// Puts the stored theme on <html> as data-theme before the first paint. index.html
// runs it as a classic script in <head>, which blocks rendering, so a page loaded
// with a picked theme never shows the system one first; module scripts such as
// main.tsx only run after the document is parsed. It reads what saveTheme of
// src/stores/persistence.ts writes (key, schema version, values), and then
// main.tsx keeps <html> in step with the store. A file rather than an inline
// script, so a CSP of script-src 'self' allows it.
(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('tungph7.theme') ?? 'null');
    if (stored?.v === 1 && (stored.theme === 'light' || stored.theme === 'dark')) {
      document.documentElement.dataset.theme = stored.theme;
    }
  } catch {
    // No storage, or a value that is not JSON: follow the system theme.
  }
})();
