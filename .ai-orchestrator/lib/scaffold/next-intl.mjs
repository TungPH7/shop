// The health path of a Next.js app with next-intl (project-scaffold part 3, spec 2.6). With localePrefix 'always', the
// default of next-intl, / answers with a redirect to /<defaultLocale>, and the smoke test of the deployer does not
// follow a redirect: shop had to write health: /en by hand in part 2. ao-kit add reads the routing of the app instead.
// read(path) gives the text of a file of the app folder, or null. Returns null when / answers itself, { health, file }
// when it redirects, or { problem } when next-intl is there and its routing cannot be read.
import { posix } from 'node:path';

const ROUTING_FILES = ['src/i18n/routing.ts', 'src/i18n/routing.js', 'i18n/routing.ts', 'i18n/routing.js', 'src/i18n.ts', 'i18n.ts'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js'];
const LOCALE = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/;

// The files an import of `spec` from `from` may be: ~/ and @/ are src/, as in the templates; packages are not followed.
function candidates(spec, from) {
  let base;
  if (spec.startsWith('~/') || spec.startsWith('@/')) base = posix.join('src', spec.slice(2));
  else if (spec.startsWith('.')) base = posix.join(posix.dirname(from), spec);
  else return [];
  return [base, ...EXTENSIONS.map((extension) => `${base}${extension}`)];
}

// defaultLocale: 'en' in an object, or const defaultLocale = 'en' (with a type or not), in this file or one it imports.
function defaultLocaleOf(read, file, text) {
  const own = /defaultLocale\s*(?::\s*[\w.[\]|' ]+)?\s*[:=]\s*['"]([^'"]+)['"]/.exec(text)?.[1];
  if (own) return own;
  for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    if (!/\bdefaultLocale\b/.test(match[1])) continue;
    for (const path of candidates(match[2], file)) {
      const imported = read(path);
      const value = imported && /defaultLocale\s*(?::\s*[\w.[\]|' ]+)?\s*=\s*['"]([^'"]+)['"]/.exec(imported)?.[1];
      if (value) return value;
    }
  }
  return null;
}

export function nextIntlHealth(read) {
  let pkg;
  try {
    pkg = JSON.parse(read('package.json') ?? '{}');
  } catch {
    return null;
  }
  if (!pkg.dependencies?.['next-intl'] && !pkg.devDependencies?.['next-intl']) return null;
  const file = ROUTING_FILES.find((path) => /defineRouting\s*\(/.test(read(path) ?? ''));
  if (!file) {
    return { problem: `the app uses next-intl, and ao-kit add found no defineRouting in ${ROUTING_FILES.join(', ')}: if / redirects to a locale, write health: /<locale> for the app in project.yaml and deploy.yaml, and the same path in its smoke check` };
  }
  const text = read(file);
  // localePrefix: 'as-needed' | 'never', or { mode: … }, serves / itself; 'always' and no localePrefix redirect it.
  const prefix = /localePrefix\s*:\s*(?:\{\s*mode\s*:\s*)?['"]([a-z-]+)['"]/.exec(text)?.[1] ?? 'always';
  if (prefix !== 'always') return null;
  const locale = defaultLocaleOf(read, file, text);
  if (!locale || !LOCALE.test(locale)) {
    return { problem: `the app uses next-intl, and ao-kit add could not read the defaultLocale of ${file}: / redirects to /<defaultLocale>, so write that path as health of the app in project.yaml and deploy.yaml, and in its smoke check` };
  }
  return { health: `/${locale}`, file };
}
