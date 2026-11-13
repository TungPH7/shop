import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
import checkFile from 'eslint-plugin-check-file';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import prettier from 'eslint-config-prettier';

// --- Kiến trúc tầng (folder 06) ------------------------------------------------
// Phụ thuộc MỘT CHIỀU: shared → features → app.
//   • shared (các thư mục liệt kê dưới): hạ tầng tái dùng, KHÔNG được biết tới
//     features/app → giữ nó tái dùng được + chặn vòng lặp.
//   • features/<x>: một domain nghiệp vụ "ốc đảo", chỉ import shared (+ chính nó).
//   • app: composition root — nơi DUY NHẤT được ghép nhiều feature lại.
// Liệt kê shared tường minh → sinh "zone" cấm cho từng cái (zone với target là
// thư mục chưa tồn tại sẽ đơn giản không khớp file nào → an toàn, đón sẵn tương lai).
const SHARED_DIRS = [
  'components',
  'config',
  'hooks',
  'i18n',
  'lib',
  'stores',
  'styles',
  'testing',
  'types',
  'ui',
  'utils',
];

// Mỗi feature là một ốc đảo: không feature nào import feature khác.
// Thêm feature mới ⇒ thêm tên vào mảng này (đúng 1 dòng) → tự có zone cấm chéo.
const FEATURES = ['site', 'caching-demo', 'product', 'auth', 'error-demo'];

const boundaryZones = [
  // (a) shared KHÔNG được import features/app.
  ...SHARED_DIRS.map((dir) => ({
    target: `./src/${dir}`,
    from: ['./src/features', './src/app'],
    message: `Tầng shared (src/${dir}) không được import từ features hoặc app (một chiều: shared → features → app).`,
  })),
  // (b) features KHÔNG được import app (app là nơi GHÉP, không phải nguồn để import).
  {
    target: './src/features',
    from: './src/app',
    message: 'features không được import từ app — hãy ghép feature ở tầng app.',
  },
  // (c) cấm import CHÉO feature: mỗi feature chỉ được import chính nó.
  ...FEATURES.map((name) => ({
    target: `./src/features/${name}`,
    from: './src/features',
    except: [`./${name}`],
    message:
      'Cấm import chéo giữa các feature. Nâng code dùng chung lên shared (src/*) hoặc ghép ở tầng app.',
  })),
];

export default tseslint.config(
  // 0) Never lint build output, Next-generated files, or hand-written docs.
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**', // báo cáo coverage do v8 sinh ra (flat config KHÔNG tự đọc .gitignore)
      'next-env.d.ts',
      'study-guide-impl/**',
      'frontend-technical/**',
    ],
  },

  // 1) Next.js base (flat). Bundles react, react-hooks, jsx-a11y, @next/next +
  //    core-web-vitals + a TypeScript layer. (folder 03)
  ...nextVitals,
  ...nextTs,

  // 2) Type-aware layer for our source: enables rules that need type info
  //    (no-floating-promises, no-misused-promises…) + project rules + kebab naming
  //    + no-barrel. projectService reads the nearest tsconfig.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'check-file': checkFile },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Quy ước `_`-prefix = "cố tình không dùng" (vd Server Action giữ chữ ký chuẩn
      // (prevState, formData) dù không đụng prevState). Mặc định recommended không có pattern này.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Pairs with verbatimModuleSyntax (folder 02): mark type-only imports so the
      // bundler can drop them. `--fix` rewrites them automatically.
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Consistency: kebab-case for every file & folder under src/.
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      // App Router: Next QUYẾT ĐỊNH tên folder dưới src/app (route segment, [param],
      // (group), @slot, _private) — không theo kebab. Nới src/app khỏi rule này (vẫn
      // kebab cho folder ngoài app + kebab cho FILE mọi nơi qua filename rule trên).
      'check-file/folder-naming-convention': ['error', { 'src/!(app)/**/': 'KEBAB_CASE' }],
      // No barrel files (index.ts re-exports) — import the target module directly.
      'check-file/no-index': 'error',
    },
  },

  // 2b) Ranh giới kiến trúc (folder 06): phụ thuộc một chiều + cấm import chéo
  //     feature + cấm vòng lặp import. Chỉ áp cho mã nguồn dưới src/.
  //     Cần TS resolver để hiểu alias `~/...` trỏ về ./src/* — KHÔNG có resolver thì
  //     no-restricted-paths "mù" với import qua alias (boundary vô tác dụng).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
    },
    rules: {
      'import-x/no-restricted-paths': ['error', { zones: boundaryZones }],
      // Vòng lặp import gây bug khó lần + vỡ tree-shaking/HMR. ignoreExternal: bỏ
      // qua node_modules cho nhanh (ta chỉ quan tâm vòng lặp trong src/).
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
    },
  },

  // 2c) Seam S1 (folder 14): CHỈ `src/stores/**` được import `react-redux` / `@reduxjs/toolkit` trực
  //     tiếp. Feature/app phải dùng FACADE hướng-domain (vd `~/stores/use-density`) → đổi RTK ↔ Zustand
  //     = viết lại nội bộ `src/stores/*`, KHÔNG đụng feature (giá trị của seam).
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
                'Seam S1: dùng facade ~/stores/* (vd useDensity), không import react-redux trực tiếp.',
            },
            {
              name: '@reduxjs/toolkit',
              message:
                'Seam S1: chỉ src/stores/** được dùng @reduxjs/toolkit. Feature/app dùng facade ~/stores/*.',
            },
          ],
        },
      ],
    },
  },

  // 2d) Security (folder 19): cấm `dangerouslySetInnerHTML` THÔ — vector XSS số 1. Ưu tiên React
  //     auto-escape; HTML không tin cậy phải đi qua MỘT seam sanitize (vd <SafeHtml> + DOMPurify —
  //     HOÃN tới khi có rich-text thật, §19). 0-dep: dùng `no-restricted-syntax` (selector JSX) thay
  //     vì cài plugin. Khi dựng <SafeHtml> → thêm `ignores: ['src/components/security/safe-html.tsx']`.
  //     ⭐ folder 21 (SEO): `<JsonLd>` BẮT BUỘC dùng dangerouslySetInnerHTML để nhúng JSON-LD (cách
  //     chính thống của Next; children sẽ bị React escape làm hỏng JSON) → đây là "chỗ DUY NHẤT được
  //     phép" đầu tiên dùng cơ chế ignores đã định ở folder 19. AN TOÀN: data typed (schema-dts), tự
  //     dựng + đã `.replace(/</g,'\\u003c')` chặn `</script>` (xem json-ld.tsx).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/seo/json-ld.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'Rủi ro XSS: KHÔNG dùng dangerouslySetInnerHTML thô. Ưu tiên auto-escape của React; HTML không tin cậy phải qua seam sanitize (SafeHtml + DOMPurify — folder 19).',
        },
      ],
    },
  },

  // 3) Node-side config files (eslint.config.mjs, postcss.config.mjs…) run in Node
  //    and are outside the TS program → turn type-aware rules off for them.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // 3b) Declaration files (*.d.ts): augmentation cần value-import + `typeof` (vd
  //     global.d.ts lấy kiểu từ messages/en.json) → tắt consistent-type-imports (dùng
  //     `import type` ở đây sẽ vỡ vì `typeof` cần binding GIÁ TRỊ).
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },

  // 4) Turn OFF rules that conflict with Prettier — MUST stay last.
  prettier,
);
