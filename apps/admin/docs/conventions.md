# Conventions — tungph7 codebase

> ## ⚠️ Superseded
>
> **SSOT quy ước code hiện hành là [`docs/coding-conventions/v1/`](./coding-conventions/v1/README.md).**
> File này được giữ lại làm **ghi chép lịch sử** (nhật ký quy ước theo từng building block) và **không** còn là căn cứ khi review PR. Có mâu thuẫn ⇒ theo `docs/coding-conventions/`.

---

> **Đây là "what we actually do here".** Tài liệu **sống**: cập nhật tăng dần sau mỗi building block. Khác với `study-guide-impl/build-project/react-coding-convention-2026.md` (nghiên cứu "vì sao", ~60 nguồn) — file này ngắn gọn, là **luật thực thi** của repo và phần lớn được **enforce tự động** bằng ESLint/Prettier.
>
> Seed: folder `02-code-quality`. Mỗi folder sau bổ sung quy ước của phần đó.

---

## 1. Ngôn ngữ

| Thứ | Quy ước |
|---|---|
| Nội dung tài liệu (`study-guide-impl/`, comment giải thích trong doc) | Tiếng Việt |
| Tên file/folder, code, comment trong code, commit message | Tiếng Anh |

## 2. Naming (enforce: `eslint-plugin-check-file`)

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| **File & folder** (mọi loại) | **kebab-case** | `product-card.tsx`, `use-product-list.ts`, `features/product/` |
| Component (định danh trong code) | PascalCase | `export function ProductCard()` |
| Hook | `use` + camelCase | `useProductList` |
| Props type | `XxxProps` | `interface ProductCardProps` |
| Boolean | `is`/`has`/`should` | `isLoading` |
| Handler | `on*` (prop) / `handle*` (impl) | `onSubmit` / `handleSubmit` |
| Hằng số | UPPER_SNAKE_CASE | `MAX_RETRY` |
| Zod schema | `xxxSchema` | `productSchema` |

> *Tên file* kebab-case nhưng *component* PascalCase — không mâu thuẫn (React bắt buộc component viết hoa đầu).

## 3. No barrel files (enforce: `check-file/no-index`)

- **Không** tạo file `index.ts`/`index.tsx` re-export. Import **trực tiếp** tới file đích.
- ✅ `import { ProductCard } from '@/features/product/components/product-card';`
- ❌ `import { ProductCard } from '@/features/product';`

## 4. Imports & layering

- **Path alias:** dùng `@/*` (= `src/*`) cho absolute import; tránh `../../../`. (`@ui/*` thêm ở Phase 1.2.)
- **Dependency một chiều:** `shared → features → app`.
  - `shared/*` (components, hooks, lib, stores, types, utils, config, ui, assets, testing) **không** import `features/` hay `app/`.
  - `features/*` **không** import `app/`; **không** import feature khác (cross-feature) — nâng lên `shared` hoặc compose ở `app`.
- **Enforce:** zone-based `import-x/no-restricted-paths` (+ `eslint-import-resolver-typescript` để hiểu `@/`). Chặn: shared↛features/app, features↛app, **cross-feature** (feature A↛B). Thêm feature mới → thêm 1 zone cross-feature cho nó.
- **Cấu trúc feature-first** (bulletproof-react): mỗi feature `features/<x>/{api,components,hooks,model,store}` tự chứa; chỉ nâng lên `shared` khi dùng chung >1 feature; **không tạo thư mục rỗng** (tạo khi cần).

## 5. TypeScript

- **Tier "strictest"** ở `tsconfig.base.json` (app & node `extends`): ngoài `strict: true` còn bật `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `allowUnreachableCode:false`, `allowUnusedLabels:false`, `isolatedModules`.
- **Không `any`** (`@typescript-eslint/no-explicit-any`). Cần "thoát" kiểu → `unknown` + thu hẹp.
- **`interface`** cho object/props (mặc định, `consistent-type-definitions`); **`type`** cho union/tuple/mapped/hàm.
- Type-only import phải ghi rõ: `import { type Foo }` (do `verbatimModuleSyntax` + `consistent-type-imports`).
- Không `enum` (dùng `as const`/union) — `erasableSyntaxOnly`.
- **Type tại ranh giới:** dữ liệu ngoài (API/env/form/URL) validate khi *nhập* bằng **Zod**; trong app tin kiểu. `skipLibCheck:true` (nghiêm với code mình, khoan dung với lib).
- **Env (`src/config/env.ts`):** một module **duy nhất** đọc env, validate bằng **Zod** (`envSchema.safeParse(import.meta.env)`; URL dùng **`z.url()`** — *không* `z.string().url()` đã deprecated ở Zod 4) → **fail-fast lúc boot** với `z.prettifyError` (gom mọi lỗi, đọc được). App import object **`env`** (typed), không rải `import.meta.env` khắp nơi. **Ranh giới bảo mật:** Vite chỉ inline biến **`VITE_*`** vào bundle client → mọi giá trị ở đây là **PUBLIC**; secret thật chỉ ở server (xem `.env.example`). Mỗi `VITE_*` mới khai thêm ở `src/vite-env.d.ts`. (Validate boot-time kéo Zod vào initial bundle — chấp nhận được: Zod là core dep, response cũng validate khắp nơi.)
- **Env theo mode (Vite — bake lúc BUILD, không phải runtime):** Vite nạp `.env.[mode]` rồi **nướng `VITE_*` vào bundle khi build**: `.env.development` (`pnpm dev`), `.env.production` (`pnpm build`/`pnpm preview`). **Chỉ `.env.example` được commit**; `.env.development` + `.env.production` đều **gitignored** (mỗi máy tự tạo từ template). Giá trị production cấp ở **bước build trong CI/deploy** (CI set `VITE_API_URL` → build ra artifact riêng cho từng môi trường) — khác backend kiểu NestJS (đọc `.env` lúc *runtime* nên đổi môi trường không cần build lại; SPA tĩnh muốn vậy phải dùng runtime-config). `pnpm build` KHÔNG nạp `.env.development`; `pnpm preview` chỉ serve `dist` đã bake. ⇒ không cấp giá trị prod lúc build → bản prod thiếu `VITE_API_URL` → `env.ts` fail-fast (đúng ý đồ); muốn preview prod ở local thì tạo `.env.production` (gitignored).

## 6. Formatting (Prettier)

- Cấu hình: `singleQuote`, `semi`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`, `endOfLine: lf`.
- **Markdown KHÔNG bị Prettier format** (tránh phá bảng/prose) — xem `.prettierignore`.
- ESLint **không** lo format (đã tắt rule xung đột qua `eslint-config-prettier`); Prettier là nguồn sự thật về format.

## 7. Lệnh

```bash
pnpm dev          # dev server
pnpm build        # type-check (tsc -b) + build production
pnpm typecheck    # chỉ type-check
pnpm lint         # ESLint (boundaries, naming, hooks, a11y, type-aware)
pnpm lint:fix     # ESLint tự sửa
pnpm format       # Prettier ghi đè
pnpm format:check # Prettier kiểm tra (dùng trong CI)
```

## 8. Quality gate (mọi thay đổi phải xanh)

`pnpm lint` · `pnpm format:check` · `pnpm typecheck` · `pnpm build`.

## 9. Git hooks & commit (enforce: Husky + lint-staged + Commitlint)

- **pre-commit** → `pnpm lint-staged`: chạy `eslint --fix` + `prettier --write` trên **file staged**. Lỗi không sửa được → **chặn commit**.
- **commit-msg** → `commitlint`: ép **Conventional Commits**.
- **Cú pháp commit của dự án:** `feat: <folder-name>` (folder-name theo roadmap discuss-1 §7), **một dòng**, **không** có trailer `Co-Authored-By`.
  - Conventional Commits tổng quát: `type(scope?): subject` — type ∈ {feat, fix, docs, refactor, test, chore, build, ci, perf, style, revert}; subject chữ thường, không chấm cuối.
- Hook cài tự động qua script `prepare: husky` khi `pnpm install`. Khẩn cấp mới dùng `git commit --no-verify` (CI vẫn kiểm).
- `tsc` toàn dự án và test **không** ở pre-commit (chậm/toàn cục) → để pre-push/CI.

## 10. Routing (React Router v7 — enforce: review + boundaries)

- **Data router:** `createBrowserRouter` + `<RouterProvider/>`. **Không** dùng declarative `<BrowserRouter><Routes>` (kiểu cũ, không có data API/lazy).
- **File:** `app/routes.ts` (bảng route) → `app/router.ts` (instance) → `app/provider.tsx` (`AppProvider` bọc provider) → `main.tsx` (mount). Mỗi file một trách nhiệm.
- **Bảng route = dữ liệu thuần:** dùng `Component`/`ErrorBoundary` (không JSX). **Pathless layout route + `<Outlet/>`** cho layout dùng chung (vẽ một lần, không lặp/không remount).
- **Route table đặt ở `src/app/`** (tầng duy nhất được import `features/`). KHÔNG đặt ở `src/routes/` (shared) — sẽ vi phạm `no-restricted-paths`.
- **Typed paths:** mọi URL khai ở `@/config/paths.ts` (`as const`, kèm `getHref()` typed params). Tạo link **luôn** qua `paths.*.getHref(...)`; **không** magic string. (`config/` là shared → import được mọi nơi.)
- **Lazy & code-split:** route phụ/nặng dùng `lazy: async () => ({ Component })` với **dynamic import chuỗi literal** → mỗi route một chunk. **Eager** cho critical path (Home) và component nhỏ luôn cần (404).
- **App route mỏng:** route ở `app/` chỉ compose component của feature; UI + logic ở `features/<x>/components`.
- **Params:** `useParams()` trả `string | undefined` → `invariant(param, …)` thu hẹp trước khi dùng.
- **404:** route `path: '*'` đặt **cuối**, nằm trong layout (vẫn có nav).
- **Error cấp route:** `ErrorBoundary` (`useRouteError` + `isRouteErrorResponse`) ở route bố → không trắng trang. Error **toàn cục** là folder 12 (không làm trùng).
- **UX điều hướng:** `useNavigation().state === 'loading'` → hiện indicator (`role="status"`) khi tải chunk lazy.
- **Auth KHÔNG nằm ở routing:** guard/protected/RBAC cắm ở folder 10 (layout route con bọc nhánh, hoặc `loader` → `redirect`). Route hiện tại chừa seam, không trộn `isProtected` vào config.

## 11. API layer (axios — enforce: review + boundaries)

- **Client:** một `axios` instance qua **factory** `createApiClient(opts)` + **singleton** `api` (baseURL từ `env`, timeout, `withCredentials`). Đặt ở `src/lib/api/` (shared). Factory tách khỏi singleton để **test được** (point baseURL tới mock server, không đụng `import.meta.env`).
- **Bề mặt:** gọi `api.get/post/put/patch/delete<T>()` → trả **thẳng `T`** (data), **không** leak `AxiosResponse` ra feature.
- **Lỗi:** mọi lỗi **chuẩn hoá về `ApiError`** (`kind` ∈ network/timeout/canceled/validation/http/unknown + `status`/`code`/`details`) qua `normalizeError`; bắt bằng `isApiError`. **KHÔNG** hiển thị UI/toast trong interceptor (transport thuần; caller/Query/ErrorBoundary quyết cách hiện).
- **Auth (DI seam):** gắn `Bearer` token + refresh qua `configureApiAuth()` (`auth-bridge`); `lib/api` **KHÔNG** import auth/redux (giữ layering + tránh cycle). **401 → single-flight refresh → retry một lần**; fail → `onUnauthorized()`. Auth thật = folder 10 cắm vào seam.
- **Retry:** chỉ **idempotent** (GET/HEAD/OPTIONS/PUT/DELETE), statuses 408/429/5xx, **exp backoff + full jitter**, tôn trọng `Retry-After`; `MAX_RETRIES=2`. (Tự viết — minh bạch, không dep; `axios-retry` là lựa chọn thay thế.)
- **Validate tại biên (type-at-boundary):** truyền **Zod `schema`** vào request → trả `T` đã validate; sai shape → `ApiError(kind:'validation')`.
- **Model schema-first:** Zod schema là nguồn sự thật, `type = z.infer<...>`. Data access đặt ở **`features/<x>/api/*`** (service theo resource): fetch + validate, trả domain type. Folder 08 bọc bằng TanStack Query.

## 12. Server state (TanStack Query — enforce: review)

- **Seam #1:** server state (data API) qua **TanStack Query**, tách hẳn client state (Redux — §13/folder 09). **KHÔNG** nhồi data API vào Redux store.
- **QueryClient:** `createQueryClient` (factory, env-free) + `queryClient` (singleton) ở `src/lib/react-query/`. Defaults: `staleTime` 60s, `gcTime` 5m, **`retry: false`** (API layer §11 là nguồn retry duy nhất — tránh nhân đôi), `refetchOnWindowFocus: !DEV`, `refetchOnReconnect: true`, mutations `retry:false`.
- **Provider:** `QueryClientProvider` bọc `RouterProvider` trong `AppProvider`.
- **Devtools:** `@tanstack/react-query-devtools` là **`devDependencies`**, render **lazy + chỉ `import.meta.env.DEV`** → tree-shaken khỏi prod (Vercel `bundle-dynamic-imports`).
- **Query keys:** factory phân cấp ở `features/<x>/api/query-keys.ts` (`all`/`lists()`/`detail(id)`, `as const`) → invalidate chính xác theo cấp, không drift.
- **`queryOptions` (v5):** định nghĩa query tái dùng (useQuery + prefetch + loader). **Hook co-located** với fetcher ở `features/<x>/api/*` (`getX` + `xQueryOptions` + `useX`).
- **Mutation:** `useMutation` + `onSuccess → void queryClient.invalidateQueries({ queryKey: <factory> })`. Input type schema-first (`schema.omit(...)` → `z.infer`).
- **Prefetch:** preload on hover/focus qua `prefetchQuery(queryOptions)` (Vercel `bundle-preload`) → chống waterfall click→fetch.
- **States:** xử lý đủ `isPending`/`isError`/success; dùng `isApiError(error)` (§11) để đọc `message`/`status` (phân biệt 404). `role="status"`/`role="alert"` cho a11y.

## 13. Client state (Redux Toolkit + nuqs — enforce: ESLint seam + review)

- **Seam #2:** client/UI state qua **Redux Toolkit**; server state KHÔNG ở đây (§12). Store **chỉ** giữ state UI/đồng bộ (theme, sidebar…), không nhồi data API.
- **Cấu trúc `src/stores/` (shared):** `store.ts` (`makeStore` factory + `store` singleton + `RootState`/`AppDispatch`), `hooks.ts` (typed `useAppSelector`/`useAppDispatch` qua `.withTypes()`), `store-provider.tsx` (`StoreProvider` bọc react-redux `Provider`), `<domain>/<domain>-slice.ts` + `<domain>/use-<domain>.ts` (facade), `persistence.ts`.
- **⭐ Domain-hook FACADE = seam:** component **chỉ** dùng facade (`useTheme`/`useSidebar`), **không bao giờ** import `react-redux`/`@reduxjs/toolkit` trực tiếp → đổi store impl (vd Zustand) chỉ sửa facade. **Enforce bằng ESLint** `no-restricted-imports` (chặn 2 lib đó ngoài `src/stores/**`). `StoreProvider` để app layer khỏi phải import react-redux.
- **Slice (RTK 2.x):** `createSlice` + Immer (viết "mutating"), co-located `selectors` (đọc root tại `state[name]`); export `actions`/`selectors`/`reducer`. **KHÔNG** `createAsyncThunk` cho data fetching (đó là server state → Query). Store compose qua `reducer: { ... }`.
- **Selector hẹp:** facade select primitive → component chỉ re-render khi đúng slice đó đổi (Vercel `rerender-defer-reads`).
- **Persistence:** tự viết, **versioned + tối thiểu** (`{ v, ... }`), validate khi đọc bằng **Zod** (localStorage = external input → type-at-boundary); shape lạ / version cũ → bỏ qua, fallback default. Ghi **chỉ khi đổi** (subscribe). KHÔNG `redux-persist` (nặng, phải hack `serializableCheck`). State ephemeral (sidebar) **không** persist.
- **URL state = nuqs:** state nên ở URL (search/filter/pagination) dùng **nuqs** (`useQueryState` + `parseAsString.withDefault`), bọc trong facade (`useProductFilters`). `NuqsAdapter` (`nuqs/adapters/react-router/v7`) đặt trong `root-layout` (cần React Router context). Set rỗng → ghi `null` để xoá param (URL sạch).
- **Provider order (`AppProvider`):** `StoreProvider` › `QueryClientProvider` › `RouterProvider`; `NuqsAdapter` trong layout.

## 14. Auth & RBAC (authentication + authorization — enforce: review + boundaries)

- **Token:** JWT access + refresh trong **localStorage** (`lib/auth/token-storage.ts`, shared) — khớp Bearer seam §11. Pub/sub + `useSyncExternalStore` (`useAccessToken`) để React phản ứng login/logout (localStorage không reactive trong tab). *(Tradeoff XSS; bản cứng = refresh httpOnly cookie + `withCredentials`, phụ thuộc BE — để deploy phase.)*
- **Cắm seam api (§11):** `app/configure-auth.ts` gọi `configureApiAuth` **1 lần** lúc bootstrap (Vercel `advanced-init-once`): `getAccessToken`←storage, `refreshTokens`→`POST /auth/refresh-token` (**bare axios**, tránh đệ quy interceptor) + lưu token, `onUnauthorized`→clear + removeQueries + `/login`. 401 single-flight refresh đã có ở §11.
- **currentUser = server state (TanStack Query), KHÔNG Redux/Context:** `useProfile` (`GET /profile` → user + `role.permissions[]`), `enabled` theo token (reactive). `isAuthenticated = !!profile` (verify bằng /profile, không chỉ "có token"). Login trả **chỉ token** → fetch profile riêng.
- **Facade:** `useAuth()` (`user/isAuthenticated/isLoading/login/logout`) + `usePermission()` (`hasPermission(method,path)`/`hasModule(module)`). Logic check là **hàm thuần** ở `features/auth/lib/permission.ts` (testable); hook/guard chỉ bọc mỏng.
- **RBAC 2 tầng (permission từ BE, KHÔNG hardcode FE):** route-level `ProtectedRoute` (chưa auth → `/login`) + `RequireModule({module})` (thiếu module → `/access-denied`); element-level `Can({method,path})` (ẩn UI). Compose lồng nhau: ProtectedRoute › RequireModule › page. `RequireModule` có prop → dùng `element` JSX (ngoại lệ có chủ đích của route-table thuần-data §10).
- **Cô lập contract:** model Zod (`User`/`Role`/`Permission{method,path,module}`) + api call gói ở `features/auth/` → swap backend chỉ sửa đây; validate response tại biên (§11). Học RBAC từ backend tham khảo nhưng implement FE chuẩn (Query + facade + pure helpers + Zod), KHÔNG bê pattern Context/manual-fetch của reference.

## 15. Forms (react-hook-form + zod resolver — enforce: review)

- **Stack:** `react-hook-form` (uncontrolled `register` → ít re-render) + `@hookform/resolvers/zod` `zodResolver`. **Schema-first dùng lại:** CÙNG một Zod schema validate form (client) **và** body request (boundary §11) → một nguồn, không drift (vd `loginCredentialsSchema`, `createProductSchema = productSchema.omit({id})`).
- **Pattern:** `useForm<T>({ resolver: zodResolver(schema), defaultValues })` → `register('field')` (spread cả `ref` qua React 19 ref-as-prop) + `formState.errors` + `handleSubmit`. Submit gọi mutation (`useLogin`/`useCreateProduct`); `onSubmit={(e) => void submit(e)}` (no-floating-promises); `noValidate` (zod validate, không dùng native).
- **Field tái dùng (`src/components/form/text-field.tsx`, shared):** label + input + error + a11y (`htmlFor`/`id`, `aria-invalid`, `aria-describedby`, `role="alert"`); nhận `{...register('x')}`. UI-agnostic (Phase 1.1) — UI lib thay markup ở Phase 1.2, contract props giữ nguyên.
- **Số/checkbox:** `register('price', { valueAsNumber: true })` cho input số (để schema `int`/`nonnegative` áp đúng); checkbox `register('flag')` → boolean.
- **Feedback:** mutation `onSuccess` → `reset()`/điều hướng; hiện `isPending`/`isError` (`isApiError`)/`isSuccess`. RHF ở **chunk lazy** (chỉ tải khi vào route form).

## 16. Error handling (xử lý lỗi toàn cục — enforce: review + boundaries)

- **2 họ lỗi, 2 nhóm công cụ:** lỗi **render** (đồng bộ) → **Error Boundary**; lỗi **async** (server/event/timeout) → Query state / `onError` / try-catch. Boundary **KHÔNG** bắt lỗi async/event/`setTimeout` → cần cả hai.
- **Error Boundary = class component** (`getDerivedStateFromError`/`componentDidCatch`, không có hook). Dùng **`react-error-boundary`** (6.1.2, React-core author) — KHÔNG tự viết: giá trị ở `onReset`/`resetKeys` + `useErrorBoundary()` (ném từ async/event) + tích hợp `QueryErrorResetBoundary`.
- **2 tầng boundary (bù nhau):** **route-level** `RouteError` (folder 06) bắt lỗi trong route, giữ vỏ app; **app-level** `AppErrorBoundary` (`src/app/`, trên `RouterProvider`) là lưới cuối bắt lỗi **thoát** router (render `RootLayout`, router) → **không bao giờ trắng trang**. App-level bọc `QueryErrorResetBoundary` → `onReset={reset}` để "Try again" **refetch** thật (không chỉ reset React state); `onError → captureError`.
- **Lỗi server toàn cục ở CACHE, không `defaultOptions`:** `new QueryClient({ queryCache: new QueryCache({ onError }), mutationCache: new MutationCache({ onError }) })` — cache callback **luôn chạy đúng 1 lần**, không bị ghi đè (≠ defaultOptions). Đây là nguồn xử lý lỗi server **duy nhất** (sửa anti-pattern toast-trong-interceptor §11 & toast-lặp-mọi-hook).
- **Quy tắc toast:** query **chỉ** toast khi `query.state.data !== undefined` (refetch nền fail; lỗi tải-đầu để component `isError` (§12) hoặc nổi lên boundary); mutation toast **mặc định** (hành động user). Opt-out per-call qua `meta: { skipGlobalError: true }` — typed bằng **augment `Register.queryMeta`/`mutationMeta`** (interface **phải** `extends Record<string, unknown>`). **Report (`captureError`) LUÔN chạy** dù toast bị bỏ.
- **Notification surface = store standalone headless** (`src/lib/notifications/`, pub/sub + `useSyncExternalStore`), **KHÔNG Redux**: phải gọi được từ ngoài React (`notify.error(...)` trong cache handler) & độc lập seam đổi store (§13) — giống `token-storage` (§14). Renderer `Notifications` headless = ARIA live region (`aria-live`, `role="alert"`/`status`), render **ngoài** boundary (sống sót khi crash). UI toast thật → Phase 1.2 (contract giữ nguyên).
- **Seam report 1 cửa:** `captureError(error, ctx)` (`src/lib/monitoring/`) gọi từ app-boundary + route-boundary + 2 cache handler → mọi lỗi qua 1 chỗ; **folder 13** thay ruột bằng logger + Sentry (không đổi signature/call-site).

## 17. Logging & Monitoring (observability — enforce: review + boundaries)

- **3 concern tách biệt, mỗi cái 1 seam (interface + DI):** **Logger** (chẩn đoán dev, leveled+structured) · **Monitoring** (exception/user/breadcrumb, Sentry-ready) · **Analytics** (sự kiện sản phẩm). Mẫu chung: đổi **đích đến** (sink/transport), KHÔNG đổi call-site — như auth-bridge §11.
- **`lib/*` KHÔNG import SDK Sentry/analytics provider trực tiếp** — đứng sau interface (`LogSink`/`MonitoringTransport`/`AnalyticsSink`) → swappable + tree-shake + test được. Provider thật (Sentry/Segment) cắm **1 chỗ** lúc deploy (`app/observability.ts` có block code sẵn). Folder 13 = **seam thuần, 0 dep**.
- **Logger (`src/lib/logger/`):** `createLogger({minLevel,sink,bindings?,now?})` **thuần/env-free** (`logger.ts`) — gate theo level (return trước khi dựng record → rẻ ở prod), structured `LogFields` (log object, không nối chuỗi), `child(bindings)` kế thừa context, inject `now` (test). Singleton **`logger`** env-gated (`app-logger.ts`, tách riêng vì import `env` → không node-importable; dev=`debug`, prod=`warn`). `consoleSink` (dev) / `createBufferSink` (test). **Factory↔singleton** như api-client↔api.
- **Monitoring (`src/lib/monitoring/`):** `MonitoringTransport` (`captureException`/`captureMessage`/`setUser`/`addBreadcrumb`) + DI `configureMonitoring`/facade. Default = `createLoggerMonitoringTransport(logger)` (route qua logger → **không nuốt lỗi**), env-free để import an toàn mọi nơi. **`capture-error.ts` (folder 12) refactor → delegate `captureException`** (4 call-site folder 12 KHÔNG đổi — đúng cam kết "đổi ruột, không đổi call-site").
- **Analytics (`src/lib/analytics/`):** `AnalyticsSink` (`track`/`identify`) + `configureAnalytics(sink,{filter,now})`; `track(name,props)` name **snake_case** + `filter` (sampling/consent/kill-switch). Default `noopSink` (analytics ≠ safety-critical, drop trước bootstrap OK); dev→`consoleAnalyticsSink`.
- **Bootstrap (`app/observability.ts`):** `setupObservability()` gọi **1 lần** ở `main.tsx` (trước `setupAuth`, Vercel `advanced-init-once`): wire monitoring→app logger, analytics→console (dev), **+ global `window 'error'/'unhandledrejection'` handlers** = lưới cuối bắt lỗi async/event React boundary bỏ sót (hoàn thiện bức tranh §16). Bức tranh đầy đủ: render→boundary (§16) · query/mutation→cache onError (§16) · async/global→window handlers (§17) → tất cả về `captureError`/`captureException` → transport (console|Sentry).

## 18. i18n (internationalization — enforce: review + boundaries)

- **Stack:** `react-i18next` (Vite SPA; reference dự án khác đều Next.js/next-intl = paradigm khác → theo official docs) + `i18next` core + `i18next-browser-languagedetector` + `i18next-resources-to-backend`.
- **⭐ State ngôn ngữ ở i18next, KHÔNG Redux:** `i18n.language` là nguồn sự thật; copy sang Redux = drift. Đồng nhất "server state ở Query, không Redux". Persist do LanguageDetector (localStorage key `tungph7.i18n.lang`), không slice. Component đọc/đổi qua **facade `useLocale()`** (`{ locale, locales, labels, setLocale }`) — như `useTheme`/`useAuth`, đổi lib chỉ sửa facade.
- **Namespace theo concern + lazy:** `common` (UI chung) **bundle eager** (shell luôn cần → không flash); feature namespace (`product`, `auth`…) **lazy** qua **`import.meta.glob(['./locales/*/*.json','!./locales/*/common.json'], { import:'default' })`** → mỗi locale/ns 1 chunk (Vercel `bundle-dynamic-imports`). Dùng `import.meta.glob` (KHÔNG template-literal `import()` — Vite analyzer cần glob tĩnh); negation loại `common` (tránh `INEFFECTIVE_DYNAMIC_IMPORT`). Locales tập trung `src/lib/i18n/locales/{lng}/{ns}.json` (không co-locate trong `features/` → tránh cross-feature).
- **Init (`src/lib/i18n/i18n.ts`, side-effect import ở `main.tsx`):** `use(LanguageDetector).use(resourcesToBackend(...)).use(initReactI18next).init({ resources:{eager common}, partialBundledLanguages:true, fallbackLng, supportedLngs, defaultNS:'common', detection:{order:[localStorage,navigator,htmlTag], lookupLocalStorage:'tungph7.i18n.lang', caches:[localStorage]}, interpolation:{escapeValue:false} })`. `escapeValue:false` vì React đã escape (chống double-escape).
- **Suspense 2 tầng:** `<Suspense>` ở `AppProvider` (quanh `RouterProvider`, trong ErrorBoundary) bắt suspense **init i18n lần đầu** (first render không crash); `<Suspense>` quanh `<Outlet/>` ở `root-layout` bắt **lazy namespace per-page** (shell đứng yên, chỉ vùng content "Loading"). Shell dùng `common` eager → không suspend.
- **Type-safe keys:** augment `CustomTypeOptions` (`i18next.d.ts`) với `resources: { common: typeof common; product: typeof product }` (từ EN JSON = nguồn key) → `t('nav.hom')` sai = lỗi compile; plural `t('product:count',{count})` hiểu `count_one`/`count_other`. Cần **`resolveJsonModule: true`** (tsconfig.app.json).
- **Đổi ngôn ngữ runtime:** `setLocale → i18n.changeLanguage` → react-i18next re-render (không reload). `LanguageSwitcher` headless (native `<select>`, UI-agnostic → Phase 1.2 thay markup, contract giữ). **`ErrorFallback` (folder 12) cố ý KHÔNG i18n** (English tĩnh) — robust nếu chính i18n init hỏng.

## 19. Testing (Vitest + RTL + MSW — enforce: review + CI) *(bước 1; mở rộng ở bước 2/3)*

- **Stack:** `vitest` (runner, dùng Vite) + `@testing-library/react` (+`/dom` peer, `/user-event`, `/jest-dom`) + `jsdom` (môi trường) + `msw` (mock network) + `@vitest/coverage-v8`. Lệnh: `pnpm test` (run 1 lần, CI), `test:watch`, `test:coverage`. **KHÔNG ở pre-commit** (chậm) → pre-push/CI (folder 18).
- **`vitest.config.ts` riêng** (KHÔNG mergeConfig vite.config) — `@vitejs/plugin-react` thuần (không kéo React Compiler vào test), tự khai `@/` alias (`fileURLToPath`), `environment:'jsdom'`, `setupFiles`, `include: src/**/*.test.{ts,tsx}`, `env.VITE_API_URL` (để `env.ts` không fail-fast khi import api singleton), `clearMocks`/`restoreMocks`. Thêm vào `tsconfig.node.json` include.
- **⭐ `globals: false` + import tường minh** (`import { describe, it, expect, vi } from 'vitest'`): vì `tsconfig.base.json` đặt **`types: []`** → không có ambient @types; dùng globals sẽ mất kiểu. jest-dom matchers qua **side-effect import** `@testing-library/jest-dom/vitest` trong setup (augment `Assertion` của vitest — không cần `types:[...]`).
- **`src/testing/setup.ts`:** jest-dom import + **MSW lifecycle** (`server.listen({onUnhandledRequest:'error'})` beforeAll / `resetHandlers` afterEach / `close` afterAll) + **cleanup thủ công** (RTL auto-cleanup cần globals, ta tắt) + reset giữa test (`localStorage.clear()` + `changeLanguage('en')`) + polyfill jsdom (matchMedia).
- **MSW mock ở network boundary** (`src/testing/msw/`, `http.get('*/path')` wildcard origin): KHÔNG mock fetch/axios → test đi qua **api layer thật** (interceptor/normalize/Zod) = sát production; `server.use(...)` override per-test. Shape mock **phải khớp Zod model** (`Permission/Role/User.id`=number, `Product.id`=string). pnpm `allowBuilds: { msw: false }` (postinstall chỉ copy *browser* worker; node `setupServer` không cần → deny, tránh deps-check chặn pre-commit; browser worker = `npx msw init`).
- **⭐ `renderWithProviders` (`src/testing/render.tsx`):** render kèm **full provider stack** (StoreProvider→Query→i18n→nuqs→MemoryRouter) — cùng composition `AppProvider` nhưng **fresh + isolated mỗi test**; trả `{store, queryClient, user, ...}`. **Tôn trọng seam Redux:** `StoreProvider` nhận optional `store` prop → test truyền `makeStore(preloadedState)` qua facade, react-redux **vẫn chỉ ở `src/stores`**. `createTestQueryClient` (`retry:false`+`gcTime:Infinity`). **`testI18n`** = `createInstance` resources inline thật + `useSuspense:false` (không đụng `i18n.ts` dùng `import.meta.glob`). Test infra **không** vào prod bundle (không reachable từ entry). **`renderWithRouter(router)`** (cùng `BaseProviders` nhưng `RouterProvider` thay MemoryRouter) cho test route-level (guard redirect, `createMemoryRouter`).
- **Patterns:** MSW override per-test (`server.use` + `resetHandlers` afterEach); auth state qua **set token TRƯỚC render** (`useProfile` enabled theo token → fetch /profile MSW → `isAuthenticated`/permissions, KHÔNG mock hook); tìm theo role/label (`getByRole`/`getByLabelText`) + `findBy*`/`waitFor` cho async; `act()` khi đẩy store ngoài React event (notify); mock thời gian/random/inject-now cho test xác định. **react-refresh tắt cho `src/testing/**` + `*.test.*`** (test không HMR).
- **Coverage = ratchet (`pnpm test:coverage`, v8):** `coverage.exclude` loại file KHÔNG unit-test được (entry/env/bootstrap+route-shell/glob-i18n/`*.d.ts`/env-coupled singletons) → % phản ánh logic test được (KHÔNG exclude file đã có test để gaming metric); `thresholds` đặt **floor ~2pt dưới baseline đạt được** (regression-fail nhưng không flaky), nâng dần. **Threshold là LƯỚI chống regress, KHÔNG phải target** (Fowler/Google: coverage tìm gap, không phải điểm chất lượng — ép % cao đẻ test rác); số cụ thể = baseline−margin của repo, KHÔNG phải chuẩn ngành (research phương pháp trước khi đặt). Enforce ở CI (folder 18).
- **E2E = Playwright** (`@playwright/test`, `e2e/*.spec.ts` tách Vitest, vào `tsconfig.node`): `webServer` auto-start `pnpm dev` (Vite dev → `.env.development`), `locale:'en-US'` (ngôn ngữ đầu xác định), chromium. **Smoke no-backend** (boot/nav/i18n = client thuần) → ổn định không mock. Browser binary tải tường minh `npx playwright install` (postinstall bị supply-chain policy chặn — như msw), KHÔNG qua pnpm. `pnpm e2e` KHÔNG ở pre-commit (chậm+cần browser) → CI/chạy tay. Pyramid: nhiều unit (Vitest) › ít E2E (Playwright).

## 20. Security (enforce: review + ESLint + grep)

- **Defense-in-depth + sanitize/validate tại ranh giới** (cùng triết lý Zod-cho-data): nhiều lớp, không dựa 1 lớp.
- **XSS:** JSX `{value}` React escape sẵn (an toàn). Escape hatch DUY NHẤT = `dangerouslySetInnerHTML` → render qua **`<SafeHtml>` (`src/components/security/safe-html.tsx`)** sanitize bằng **DOMPurify** (`src/lib/security/sanitize-html.ts` — module GỌI DOMPurify duy nhất; **KHÔNG tự viết sanitizer**). **ESLint `no-restricted-syntax` CẤM raw `dangerouslySetInnerHTML`** ở mọi nơi trừ `safe-html.tsx` (0 dep, không cần eslint-plugin-react) → mọi render HTML qua 1 cửa, scanner audit 1 chỗ. DOMPurify **tree-shaken** khỏi prod tới khi `SafeHtml` được import.
- **CSP = HTTP header ở edge (deploy), KHÔNG `<meta>`, KHÔNG cho Vite dev:** `default-src 'self'` + `script-src 'self'` (chặn script inject), `connect-src` liệt kê backend; rollout qua **`Content-Security-Policy-Report-Only`** trước khi enforce. Kèm HSTS/`X-Content-Type-Options:nosniff`/`Referrer-Policy`/`Permissions-Policy`/`frame-ancestors`. Cấu hình ở Vercel/Netlify/nginx (folder 18).
- **Secrets:** `VITE_*` = **PUBLIC** (Vite nướng vào bundle) → **KHÔNG secret ở client/`src/`**; secret chỉ ở server; env qua `config/env.ts` (Zod, ranh giới duy nhất). Verify: **grep `src/` sạch** (không `sk_`/`AKIA`/`PRIVATE KEY`/`password=`/`api_key=`).
- **Token storage:** localStorage (tradeoff XSS — phòng bằng chặn XSS + CSP); bản cứng = refresh httpOnly cookie + `withCredentials` (deploy). Không để token ở log/URL/analytics.
- **Supply-chain:** pnpm `minimumReleaseAge` + `allowBuilds` (folder 09) + `pnpm audit` (CI folder 18) + pin exact version.

---

## 21. Performance (enforce: review + đo bằng build)

- **React Compiler** (auto-memo lúc build, `vite.config.ts` babel `reactCompilerPreset`) → KHÔNG `useMemo`/`useCallback`/`memo` thủ công trừ khi thật cần. Bằng chứng build: chunk `compiler-runtime` + `useMemoCache` trong các chunk app (9 chunk). Component dùng lib trả hàm không memoize được (vd `@tanstack/react-virtual`) → compiler tự bỏ qua; `eslint-disable react-hooks/incompatible-library` **kèm giải thích**, không tắt global.
- **Code-split**: theo route (`route.lazy`, 06) + feature nặng/ít dùng (devtools 08, RHF 11, i18n 14). **`manualChunks`: đo trước** (visualizer) — mặc định KHÔNG thêm (Rolldown tự tách hợp lý; gộp tay dễ phản tác dụng / lỗi thứ tự nạp); chỉ split có chủ đích khi treemap chỉ ra lib lớn+ít đổi phình entry (kèm số đo trước/sau).
- **Bundle analysis**: `rollup-plugin-visualizer` **gated** qua `ANALYZE` (Vite bỏ qua plugin falsy → 0 cost khi off; cast `as PluginOption`). `pnpm build:analyze` → `bundle-stats.html` (gitignore) **qua Node-script** `scripts/build-analyze.mjs` (mode=production để `.env.production` nạp, tránh crash env fail-fast; 0 dep cross-platform — không `cross-env`). Vite 8/Rolldown chạy được plugin Rollup.
- **Virtualization**: list dài (hàng trăm+) → `<VirtualList>` (`src/components/virtual/`, headless, wrap `@tanstack/react-virtual`). UI-agnostic Phase 1.1 (inline style = **chức năng** scroll/định vị, không thẩm mỹ; a11y keyboard-scroll = Phase 1.2). **Seam tree-shaken** khỏi prod tới khi được import (như DOMPurify). Test jsdom: mock **`offsetHeight`** (virtual-core đo bằng offsetHeight, KHÔNG getBoundingClientRect) + stub `ResizeObserver` (`src/testing/setup.ts`).
- **Re-render**: ưu tiên React Compiler; input lọc list dùng **`useDeferredValue`** (`ProductList` filter — input mượt, lọc ưu tiên thấp). Rule Vercel khác (`useTransition`, `content-visibility`, ref cho giá trị đổi liên tục…) = dụng cụ, chỉ dùng khi profiler chỉ ra điểm nghẽn.

---

## 22. CI/CD (GitHub Actions — enforce: CI required checks)

- **Workflow** `.github/workflows/ci.yml`: trigger push/PR `main` + `workflow_dispatch`; `concurrency` hủy run cũ cùng ref; `permissions: contents: read`. 2 job song song: **`verify`** (install `--frozen-lockfile` → lint → typecheck → format:check → `test:coverage` [enforce threshold] → build → `audit --audit-level=high`) + **`e2e`** (`playwright install --with-deps chromium` → `pnpm e2e` → upload report).
- **Single source of truth**: pnpm version ← `package.json packageManager`; Node ← `.nvmrc` (`node-version-file`). `pnpm/action-setup` TRƯỚC `setup-node` (cache:pnpm cần pnpm sẵn). `--frozen-lockfile` khóa lockfile (fail nếu lệch; không re-resolve → cooldown minimumReleaseAge không kích hoạt).
- **⭐ Inject `VITE_API_URL`** (`env: VITE_API_URL: ${{ vars.VITE_API_URL || '<public-url>' }}`): CI không có `.env` (gitignore hết); Vite bake `VITE_*` lúc BUILD từ shell env (ưu tiên hơn `.env`). Dùng **Variable (`vars`) KHÔNG `secrets`** vì `VITE_*` = PUBLIC; secret thật chỉ ở backend/`secrets` (không bao giờ vào `VITE_*`). `HUSKY=0` tắt hooks trên CI.
- **`audit --audit-level=high`**: fail high/critical (tránh nhiễu low/moderate); bổ sung minimumReleaseAge + allowBuilds (folder 09) + pin exact (folder 16).
- **"Pipeline xanh trên PR" hoàn chỉnh** = bật **branch protection** require checks `verify`+`e2e` (repo setting, UI/`gh`). **SHA-pin actions** = hardening (deploy phase). **CD/deploy** (Vercel/Netlify + CSP headers folder 16 + httpOnly cookie folder 10) = deploy phase, chưa làm (roadmap 18 chỉ CI).

---

## 23. Feature vertical slice (CRUD) — enforce: review + boundaries

- **Một resource = một bộ**: model Zod (single source) + `api/<operation>.ts` (1 file/thao tác: get-products/get-product/create/update/delete) + query hooks co-located (queryOptions + useMutation) + form (RHF + zodResolver) + route. Feature mới (Cart/Order) = copy bộ này.
- **Mutation cache strategy**: create → `invalidateQueries(lists())`; update → `invalidateQueries(lists())` + `setQueryData(detail(id), updated)` (detail tươi ngay); delete → `invalidateQueries(lists())` + `removeQueries(detail(id))`. PUT = full replace → reuse `createProductSchema` (không update-schema riêng để lệch).
- **⭐ Cross-feature composition**: feature KHÔNG import feature khác (`import-x/no-restricted-paths`). UI gated bằng feature khác (vd `<Can>` của auth trên trang product) → **compose ở APP layer** qua slot `actions?: ReactNode` (DI mức UI); feature nhận slot, vô can với feature kia. Đổi quyền = sửa app, không đụng feature.
- **Destructive UI headless**: delete = inline two-step confirm (KHÔNG `window.confirm`) → testable + E2E-able + no UI lib.
- **Feature E2E** (Playwright): mock API bằng `page.route` stateful, **anchor vào ORIGIN backend** (không `**/path` — sẽ nuốt SPA document navigation `page.goto`); seed auth bằng `addInitScript({ content })` (string, tránh DOM types ở spec node); test lỗi dùng status không-retry (400) để khỏi chờ backoff.

---

## Changelog quy ước

- **02-code-quality** — seed file này: ngôn ngữ, naming (kebab-case), no-barrel, layering & imports, TS cơ bản, Prettier, lệnh, quality gate.
- **03-git-hooks-commit** — thêm mục 9: Husky + lint-staged (pre-commit) + Commitlint (commit-msg); cú pháp commit `feat: <folder-name>`, không trailer.
- **04-typescript-config** — mở rộng mục 5: tier strictest ở `tsconfig.base.json` (app/node extends), interface vs type, type tại ranh giới.
- **05-architecture-structure** — mục 4 nâng cấp: cấu trúc feature-first + boundary zone-based `import-x/no-restricted-paths` (shared/feature/app + cross-feature).
- **06-routing** — thêm mục 10: data router (createBrowserRouter + RouterProvider), route table dữ liệu thuần ở `app/`, pathless layout + Outlet, typed paths `@/config/paths`, `route.lazy` code-split, params/404/error boundary cấp route; auth tách sang folder 10.
- **10-auth-authz** — thêm mục 14: token localStorage + pub/sub (`useSyncExternalStore`), cắm `configureApiAuth` (refresh bare-axios single-flight, onUnauthorized), profile qua **TanStack Query** (không Redux/Context), facade `useAuth`/`usePermission` + pure `permission.ts`, RBAC 2 tầng `ProtectedRoute`/`RequireModule`/`Can` (permission từ BE), contract cô lập ở `features/auth` (Zod). `VITE_API_URL`→`https://ecom-nest.t2g.io.vn` (bỏ `/api` — backend không có global prefix). Áp Vercel `advanced-init-once`/`client-swr-dedup`/`rerender-defer-reads`. +cross-feature zone `auth`.
- **11-forms** — thêm mục 15: react-hook-form 7.80.0 + `@hookform/resolvers` 5.4.0 (`zodResolver`, hợp Zod 4). Reusable `TextField` (a11y, RHF-register, React 19 ref-as-prop); nâng `LoginForm` + thêm `ProductCreateForm` (tái dùng `createProductSchema`+`useCreateProduct` folder 08, gắn `/admin` module-gated). Schema-first dùng lại (form ↔ boundary). RHF ở chunk lazy. Verify 9/9: zodResolver validate Zod 4 runtime (login + product).
- **07-api-layer** — thêm mục 11: axios factory+singleton (`src/lib/api/`), `ApiError`+`normalizeError`, DI auth seam (`configureApiAuth`) + 401 single-flight refresh+retry, retry idempotent+backoff+jitter, Zod validate tại biên + model schema-first (`z.infer`), data access ở `features/<x>/api/*`.
- **08-server-state** — thêm mục 12: TanStack Query (seam #1 server≠client), QueryClient factory+singleton (`src/lib/react-query/`, retry:false vì api owns retry), devtools lazy DEV-only (tree-shaken), key factory phân cấp, `queryOptions` v5 + hook co-located, mutation+invalidation, prefetch on hover (`bundle-preload`). Áp Vercel react-best-practices.
- **refactor: validate env with zod** — nâng mục 5: `src/config/env.ts` từ check thủ công (`required()`) → **Zod** (`safeParse` + `z.url()` + `z.prettifyError`, fail-fast lúc boot); nêu rõ ranh giới bảo mật `VITE_*` = PUBLIC (React vs Next: Next phải tách schema server/client). Refactor độc lập (không phải folder roadmap), shape `env` giữ nguyên.
- **19-feature-example-product** — thêm mục 23 (KẾT Phase 1.1): hoàn thiện Product CRUD (0 dep mới). **Update** `update-product` (PUT, reuse createProductSchema; `useUpdateProduct` invalidate lists + `setQueryData` detail) + `ProductEditForm` pre-filled + route `/admin/products/:id/edit` RBAC-gated. **Delete** `delete-product` (DELETE; `useDeleteProduct` invalidate lists + removeQueries detail) + `ProductDeleteButton` (inline two-step confirm). **⭐ Cross-feature composition**: product-detail KHÔNG import auth `<Can>` (cross-feature cấm) → `ProductDetail` nhận slot `actions?: ReactNode`, `product-detail-route` (app) bơm `<Can>`-gated Edit/Delete (DI mức UI). **E2E** `product-crud.spec.ts` (Playwright `page.route` stateful + seed token `addInitScript` + mock /profile perms) đi create→read→update→delete. Bug→fix: regex `/products` rộng nuốt SPA `goto('/products')` document nav → **anchor mock vào origin backend**. Verify: gate 0; **96 test** (+8); coverage branch 68.59→**75.36** sau khi lấp gap bằng test thật (không gaming); **E2E 4 xanh** Chromium. **PHASE 1.1 (00–19) HOÀN TẤT** — kế Phase 1.2 UI adapters 20–25.
- **18-ci-cd** — thêm mục 22: `.github/workflows/ci.yml` (GitHub Actions; 0 dep). 2 job song song: `verify` (install --frozen-lockfile→lint→typecheck→format:check→`test:coverage` [enforce threshold folder 15]→build→`audit --audit-level=high`) + `e2e` (`playwright install --with-deps chromium`→`pnpm e2e`→upload report). `pnpm/action-setup` TRƯỚC `setup-node`; version single-source (`packageManager`+`.nvmrc`); concurrency cancel; permissions read; `workflow_dispatch`. **⭐ inject `VITE_API_URL` qua `vars` (PUBLIC, KHÔNG secrets)** vì CI không có `.env` (Vite bake VITE_* lúc build từ shell env, ưu tiên hơn .env); `HUSKY=0`. `--audit-level=high` (tránh nhiễu low/moderate). "Pipeline xanh trên PR" hoàn chỉnh = branch protection require checks (repo setting); SHA-pin actions + CD/deploy + CSP headers = deploy phase. Verify (GH Actions không chạy trong sandbox → chứng minh cục bộ): YAML hợp lệ (js-yaml) + cấu trúc khớp roadmap; rehearsal 7 bước job verify xanh (install "Already up to date"/lint/typecheck/format/`test:coverage` 88 pass 82.87/70.68/78.26/82.42/build/audit "No known vulnerabilities"); **env-injection: shell `VITE_API_URL` bake vào dist đè .env** (build exit 0 kể cả thiếu var — env.ts fail-fast ở runtime, không build-time).
- **17-performance** — thêm mục 21: `rollup-plugin-visualizer 7.0.1` (dev) + `@tanstack/react-virtual 3.14.3`. **Bundle analysis** gated `ANALYZE` (Vite bỏ qua plugin falsy; `as PluginOption`) qua **Node-script** `scripts/build-analyze.mjs` (mode=production → `.env.production` nạp, tránh crash; 0 dep cross-platform; Rolldown chạy plugin Rollup) → `bundle-stats.html` (gitignore). **`<VirtualList>`** headless (`src/components/virtual/`, wrap react-virtual) — seam **tree-shaken** tới khi dùng; compiler tự bỏ qua (incompatible-library, suppress có giải thích); test jsdom mock **offsetHeight** (không phải getBoundingClientRect) + stub ResizeObserver. **`useDeferredValue`** cho `ProductList` filter. `manualChunks`: đo-trước, không thêm. Verify: **Build có compiler** (chunk compiler-runtime + useMemoCache 9 chunk), **chunk tách** (17 chunk route-split), **report bundle** (bundle-stats.html ~312KB qua build:analyze), 88 test (1 mới windowing), index 416.37 kB không đổi (react-virtual tree-shaken), coverage 82.87/70.68/78.26/82.42.
- **16-security** — thêm mục 20: `dompurify 3.4.11` (types bundled). XSS seam **`SafeHtml`** + `sanitizeHtml` (module gọi DOMPurify duy nhất; đừng tự viết) + **ESLint `no-restricted-syntax` cấm raw `dangerouslySetInnerHTML`** (trừ safe-html.tsx; 0 dep) → encapsulate+auditable, DOMPurify tree-shaken tới khi dùng. CSP = headers edge (không meta/dev; `default-src`/`script-src 'self'` + Report-Only rollout) → deploy/folder 18. `VITE_*`=PUBLIC→không secret client (grep src sạch); token localStorage tradeoff (httpOnly cookie=hardened deploy); supply-chain `pnpm audit`. Verify: demo sanitize (5 test strip script/onerror/javascript:), ESLint ban probe (raw danger→error), grep secret sạch.
- **15-testing (3 bước)** — thêm mục 19: harness Vitest 4.1.9 + RTL 16.3.2 (+dom/user-event/jest-dom) + jsdom 29.1.1 + MSW 2.14.6 + coverage-v8 + Playwright 1.61.0. `vitest.config.ts` riêng (no React Compiler, `@/` alias, jsdom, **`globals:false`** vì `types:[]` → import tường minh; `env.VITE_API_URL`); setup (jest-dom side-effect augment + MSW lifecycle + cleanup/reset); MSW mock ở network boundary (shape khớp Zod, `allowBuilds:{msw:false}`); **`renderWithProviders`**/**`renderWithRouter`** full stack fresh-per-test (StoreProvider nhận `store` prop → tôn trọng seam Redux), `testI18n` sync. **coverage threshold ratchet** (exclude non-unit, floor 80/70/75/80 — Fowler "tool không phải target"). **E2E Playwright** (`e2e/` tách, webServer auto-start dev, smoke no-backend, browser tải tường minh). `pnpm test`/`e2e` KHÔNG ở pre-commit → CI. **82 unit + 3 E2E xanh.** react-refresh tắt cho test files.
- **14-i18n** — thêm mục 18: react-i18next 17.0.8 + i18next 26.3.1 + browser-languagedetector 8.2.1 + resources-to-backend 1.2.1. State ngôn ngữ ở **i18next (không Redux)**, facade `useLocale`; namespace `common` eager + feature lazy qua **`import.meta.glob`** (negation loại common → tránh INEFFECTIVE_DYNAMIC_IMPORT; mỗi locale/ns 1 chunk); Suspense 2 tầng (init ở AppProvider + per-page ở Outlet); **type-safe keys** augment `CustomTypeOptions` (+`resolveJsonModule`); detector persist localStorage; `escapeValue:false`; `LanguageSwitcher` headless; `ErrorFallback` cố ý không i18n (robust). Reference đều Next.js/next-intl (paradigm khác) → theo official docs. Verify 15/15 runtime (switch en↔vi + interpolation + plural + fallback).
- **13-logging-monitoring** — thêm mục 17: 3 concern observability tách (logger/monitoring/analytics), mỗi cái seam interface+DI (`lib/*` không import SDK Sentry → swappable/tree-shake/test; provider cắm lúc deploy ở `app/observability.ts`); **0 dep mới**. Logger leveled+structured+`child` (factory thuần `logger.ts` ↔ singleton env-gated `app-logger.ts`, `consoleSink`/`createBufferSink`). `MonitoringTransport` Sentry-ready + default logger-backed; **`capture-error.ts` folder 12 refactor → delegate `captureException`** (call-site bất biến). Analytics `track`/`identify`/sink/`filter`. `setupObservability()` bootstrap 1 lần + **global `window error`/`unhandledrejection`** (lưới cuối ngoài React). Học MFE observability (sink/buffer/now/filter), bỏ event-bus (đặc thù MFE). Verify 16/16 runtime.
- **12-error-handling** — thêm mục 16: 2 họ lỗi (render→boundary / async→Query·onError); `react-error-boundary` 6.1.2 (KHÔNG tự viết); **2 tầng boundary** (route-level giữ vỏ + app-level chống trắng trang, bọc `QueryErrorResetBoundary`); lỗi server toàn cục ở **CACHE** `QueryCache`/`MutationCache.onError` (luôn chạy 1 lần ≠ defaultOptions); quy tắc toast (query chỉ refetch-nền / mutation mặc định) + `meta.skipGlobalError` (augment `Register`, `extends Record<string,unknown>`); **notification store standalone headless** (không Redux, gọi ngoài React) + renderer ARIA-live; seam `captureError` 1 cửa → folder 13. Sửa anti-pattern toast-trong-interceptor & toast-lặp-mọi-hook. Verify 10/10 runtime (QueryClient thật qua query/mutation lỗi).
- **09-client-state** — thêm mục 13: Redux Toolkit (seam #2 client≠server), `src/stores/` (makeStore factory + typed hooks `.withTypes` + StoreProvider), ⭐ domain-hook facade (`useTheme`/`useSidebar`) **enforce bằng ESLint** `no-restricted-imports` (react-redux/RTK chỉ trong stores) → swap Zustand được; slice RTK 2.x + co-located selectors (không asyncThunk/data); persistence tự viết versioned + Zod (không redux-persist); URL state nuqs (`useProductFilters`, NuqsAdapter ở root-layout). Áp Vercel `rerender-defer-reads` + `client-localstorage-schema`.
