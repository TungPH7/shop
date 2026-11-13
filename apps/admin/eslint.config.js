import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import checkFile from 'eslint-plugin-check-file';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import prettier from 'eslint-config-prettier';

// Shared layer (anything under src/ that is NOT features/ or app/).
// One-way dependency rule: shared -> features -> app. Shared can't import up.
const SHARED_DIRS = [
  'components',
  'hooks',
  'lib',
  'stores',
  'types',
  'utils',
  'config',
  'assets',
  'testing',
];

const sharedZones = SHARED_DIRS.map((dir) => ({
  target: `./src/${dir}`,
  from: ['./src/features', './src/app'],
  message: `Shared layer (src/${dir}) must not import from features or app (one-way dependency: shared -> features -> app).`,
}));

export default tseslint.config(
  // 0) Never lint build output, generated reports, or hand-written docs.
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'study-guide-impl',
      'frontend-technical',
    ],
  },

  // 1) TypeScript source (browser) — type-aware rules + React + a11y + naming.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
      'check-file': checkFile,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Pairs with verbatimModuleSyntax: type-only imports must be marked.
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',

      // Consistency: kebab-case for every file & folder under src/.
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { 'src/**/': 'KEBAB_CASE' }],
      // No barrel files (index.ts re-exports) — import the target directly.
      'check-file/no-index': 'error',
    },
  },

  // 2) Node-side TS config files (e.g. vite.config.ts) run in Node, not browser.
  {
    files: ['*.ts'],
    languageOptions: { globals: globals.node },
  },

  // 3) Import boundaries (zone-based) — enforces one-way layering + no cross-feature.
  //    Resolves `@/*` and relative imports via the TypeScript resolver.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['./tsconfig.app.json', './tsconfig.node.json'],
          // We intentionally pass both leaf configs (app holds the `@/*` paths);
          // silence the "multiple projects" performance hint.
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            ...sharedZones,
            // A feature must not import the app layer (compose in app instead).
            {
              target: './src/features',
              from: './src/app',
              message:
                'Features must not import from the app layer. Compose features in the app layer instead.',
            },
            // Cross-feature: one feature must not import another feature.
            // Add one zone per feature (target = that feature, except = itself).
            {
              target: './src/features/product',
              from: './src/features',
              except: ['./product'],
              message:
                'Cross-feature import is not allowed. Lift shared code up to src/ (shared) or compose at the app layer.',
            },
            {
              target: './src/features/auth',
              from: './src/features',
              except: ['./auth'],
              message:
                'Cross-feature import is not allowed. Lift shared code up to src/ (shared) or compose at the app layer.',
            },
          ],
        },
      ],
    },
  },

  // 3b) Client-state seam: ONLY src/stores/** may import the Redux libraries.
  //     Everywhere else must consume domain-hook facades (useTheme, useSidebar…)
  //     so the store implementation stays swappable (locked decision: Zustand).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/stores/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-redux',
              message:
                'Do not import react-redux outside src/stores. Use a domain-hook facade from @/stores/* (e.g. useTheme) so the store stays swappable.',
            },
            {
              name: '@reduxjs/toolkit',
              message:
                'Do not import @reduxjs/toolkit outside src/stores. Define slices/store in src/stores and expose facades.',
            },
          ],
        },
      ],
    },
  },

  // 3c) Security: ban the raw XSS escape hatch. Untrusted HTML must go through
  //     <SafeHtml> (DOMPurify) — the single exempted file. A code scanner then has
  //     exactly one place to audit (folder 16).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/security/safe-html.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'XSS risk: render untrusted HTML via <SafeHtml> (sanitizes with DOMPurify), never raw dangerouslySetInnerHTML.',
        },
      ],
    },
  },

  // 4) Plain JS config files (e.g. eslint.config.js): Node + no type-aware rules.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // 4b) Test files & test utilities are never fast-refreshed (not in the app
  //     render tree) → exempt them from react-refresh. A test-util module like
  //     render.tsx legitimately exports helpers (and defines a local provider
  //     component) rather than only-components.
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/testing/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // 5) Turn OFF rules that conflict with Prettier — must stay last.
  prettier,
);
