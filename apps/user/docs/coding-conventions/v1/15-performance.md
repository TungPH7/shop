# 15 — Performance

## 15.1 Mục tiêu — `[MUST]`

| Chỉ số | Ngưỡng  |
| ------ | ------- |
| LCP    | < 2.5s  |
| INP    | < 200ms |
| CLS    | < 0.1   |

Đo bằng Web Vitals đã gắn sẵn (`~/components/web-vitals.tsx` → Analytics, → §13) và bằng build output.

## 15.2 Thứ tự đòn bẩy — `[MUST]` làm từ trên xuống

Đắt nhất trước; đừng nhảy xuống dưới khi trên còn vấn đề:

1. **Chống request waterfall** — `Promise.all`, preload, streaming.
2. **Giảm `"use client"`** — server-first đã giúp sẵn; mỗi island bớt đi là JS bớt đi.
3. **Cache đúng chỗ** — `'use cache'` + `cacheLife` + `cacheTag` (→ §07).
4. **Dedupe request phía client** — TanStack Query (→ §10).
5. **Bớt re-render** — React Compiler lo tự động.
6. **Virtualize** danh sách rất dài.

```ts
// ✅ song song
const [products, categories] = await Promise.all([getProducts(), getCategories()]);

// ❌ waterfall — tổng thời gian = tổng hai request
const products = await getProducts();
const categories = await getCategories();
```

## 15.3 React Compiler — `[MUST]`

`reactCompiler: true` đã bật (cần devDep `babel-plugin-react-compiler`).

- **[MUST]** ❌ Không thêm `useMemo` / `useCallback` / `React.memo` thủ công "cho chắc" — compiler đã memo hoá. Chỉ thêm khi **có số đo** chứng minh cần.
- Compiler bật thêm rule lint (vd `react-hooks/set-state-in-effect`) — sửa code theo rule, ❌ không disable (→ §12 có ví dụ dùng `useSyncExternalStore` thay `useEffect`).

## 15.4 `next/image` — `[MUST]`

- Luôn dùng `next/image`, ❌ không `<img>` thô.
- Host ảnh remote phải nằm trong `images.remotePatterns` (`next.config.ts`) — đây là allowlist phía **server**.
- **Bắt buộc** `width`/`height` **hoặc** `fill` + `sizes` → giữ chỗ, CLS = 0.
- Ảnh above-the-fold (ứng viên LCP) → thêm `priority` (preload, không lazy). Ảnh còn lại để lazy mặc định.
- SVG được `next/image` tự `unoptimized`.

> ⭐ Optimizer **fetch ảnh remote ở server** rồi phục vụ qua `/_next/image?...` (same-origin) → CSP `img-src 'self'` vẫn đủ, không cần nới host (→ §14).

## 15.5 `next/font` — `[MUST]`

Khai ở `src/config/fonts.ts`, dùng `next/font/google` (hiện: Inter variable).

- Font được **self-host lúc build** → 0 request runtime tới Google, và CSP `font-src 'self'` là đủ.
- **[MUST]** `display: 'swap'` + expose qua CSS variable (`variable: '--font-sans'`) để `globals.css` tham chiếu.
- Metric fallback khớp sẵn → CLS = 0. ❌ Không tự nhúng `@font-face` từ CDN ngoài.

## 15.6 `next/dynamic` — `[SHOULD]`

Lazy-load Client Component **nặng và ít dùng** (vd modal zoom ảnh):

```tsx
const ProductImageZoom = dynamic(() => import('./product-image-zoom'), {
  loading: () => <Spinner />,
});
```

- ⚠️ `ssr: false` **chỉ hợp lệ bên trong Client Component**. Đặt ở Server Component sẽ lỗi.
- Đặt trong dynamic hole (→ §07).
- ❌ Không dynamic-import mọi thứ — chunk vụn làm chậm hơn.

## 15.7 Phân tích bundle — `[SHOULD]`

```bash
pnpm analyze            # next experimental-analyze (Turbopack-native)
pnpm analyze:output     # ghi ra .next/diagnostics/analyze
```

❌ **Không** dùng `@next/bundle-analyzer` — plugin webpack-only, sẽ phân tích **sai bundler** so với Turbopack mà ta ship.

## 15.8 Kỷ luật đo — `[MUST]`

- PR có mục đích tối ưu phải kèm **số trước/sau** (build output, kết quả analyze, hoặc Web Vitals).
- ❌ Không thêm dependency tối ưu khi chưa có bằng chứng nút thắt.
- Build trên máy RAM thấp bị OOM → `NEXT_BUILD_LOW_MEM=1` (hạ worker); test OOM → `--no-file-parallelism`. Đây là escape hatch cho môi trường, ❌ không sửa cấu hình chung vì máy một người.
