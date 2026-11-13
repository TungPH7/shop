# 13 — Error Handling & Observability

## 13.1 Hai tầng lỗi — `[MUST]`

| Tầng          | Class      | Ở đâu                       | Nghĩa                                                                                              |
| ------------- | ---------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Transport** | `ApiError` | `~/lib/http/api-error.ts`   | `network` / `http` / `validation` — lỗi khi nói chuyện với backend                                 |
| **Domain**    | `AppError` | `~/lib/errors/app-error.ts` | `kind` ∈ `not_found` · `unauthorized` · `forbidden` · `validation` · `rate_limited` · `unexpected` |

Cầu nối là **`normalizeError(unknown) → AppError`** (`~/lib/errors/normalize-error.ts`) — **nơi duy nhất** map HTTP status sang lỗi domain:

```
404 → NotFoundError    401 → UnauthorizedError    403 → ForbiddenError
400/422 → ValidationError    429 → RateLimitError    còn lại → UnexpectedError
```

```ts
// ✅
catch (e: unknown) {
  const error = normalizeError(e);
  if (error.kind === 'rate_limited') return renderRateLimited();
  throw error;
}

// ❌ đọc status rải rác khắp nơi
catch (e: any) { if (e.status === 429) … }
```

**[MUST]** Không nuốt lỗi — `normalizeError` luôn trả `AppError` và **giữ `cause`**.

## 13.2 `throw` hay `Result` — `[MUST]` đừng trộn

| Cách                                                                     | Dùng cho                                                        | Ai xử lý                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------- |
| **`throw`**                                                              | Lỗi **thật / bất ngờ**: network, 5xx, bug, lệch schema          | Error boundary                    |
| **`Result<T, E>`** (`~/lib/errors/result.ts`: `ok`/`err`/`isOk`/`isErr`) | Lỗi **dự kiến & phục hồi được**: 429 rate-limit, không tìm thấy | Xử lý **tại chỗ**, giữ trang sống |

⚠️ **`try/catch` phải nằm NGOÀI scope `'use cache'`** — bắt lỗi bên trong sẽ cache lại chính trạng thái lỗi đó (→ §07).

## 13.3 Error boundary — `[MUST]`

| File                         | Phạm vi                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `app/[locale]/error.tsx`     | Bọc page + con trong segment. `"use client"`, nhận `{ error, reset }`. **Không** bọc `layout.tsx` cùng segment            |
| `app/global-error.tsx`       | Lưới cuối cho lỗi ở **root layout**. Tự render `<html>/<body>`. Nằm **ngoài** provider i18n → dùng **fallback tiếng Anh** |
| `app/[locale]/not-found.tsx` | Đích của `notFound()`                                                                                                     |
| `loading.tsx` / `<Suspense>` | Skeleton                                                                                                                  |

- **[MUST]** Mỗi route có fetch dữ liệu phải có error boundary phía trên nó.
- ⚠️ **Production che `error.message`** (chỉ còn `digest`) → ❌ **không** rẽ nhánh theo `error.status`/message ở client boundary. Phân loại lỗi làm ở **server** bằng `normalizeError`.
- `notFound()` / `throw` bên trong `<Suspense>` trả HTTP **200** (soft, đúng bản chất PPR) nhưng boundary vẫn render — đây là hành vi mong đợi.
- `next dev` vẫn hiện overlay đỏ dù có boundary → verify trải nghiệm thật bằng `next start`.

## 13.4 Ba facade observability — `[MUST]`

Ba tầng **tách riêng**, tất cả 0-dependency ở lõi:

| Facade         | Module             | Dùng cho                     |
| -------------- | ------------------ | ---------------------------- |
| **Logger**     | `~/lib/logger`     | Ghi log có cấu trúc          |
| **Monitoring** | `~/lib/monitoring` | Báo lỗi / exception          |
| **Analytics**  | `~/lib/analytics`  | Sự kiện sản phẩm, Web Vitals |

**[MUST] Code nghiệp vụ (`lib` / `features` / `app`) không import SDK vendor.** Chỉ gọi facade; cắm vendor bằng `configure*` tại **một** chỗ (adapter). Nhờ vậy test dùng buffer-sink / fake transport, không cần service ngoài.

## 13.5 Logging — `[MUST]`

```ts
// ✅ structured + có ngữ cảnh
logger.info('product.deleted', { productId, userId });

// ❌
console.log('deleted product ' + productId);
```

- **[MUST]** `console` chỉ được dùng ở **một nơi duy nhất**: `consoleSink` trong `~/lib/logger` (có `eslint-disable no-console` kèm lý do). Mọi chỗ khác đi qua `logger`. ESLint đặt `no-console: warn` (chừa `warn`/`error`).
- Message dạng **event key** (`product.deleted`), dữ liệu đi vào `LogFields`, không nối chuỗi.
- `logger.child({ requestId })` để gắn ngữ cảnh chung.
- ❌ **Không** log secret, token, mật khẩu, PII.
- Sink: mặc định `consoleSink` (JSON hình pino, isomorphic); server Node swap sang `pino` qua `instrumentation.ts` — chi tiết là việc của seam, code gọi `logger` không đổi.

## 13.6 Báo lỗi — `[MUST]`

**`captureError`** (`~/lib/monitoring/capture-error.ts`) là **điểm vào duy nhất**:

```ts
// ✅ chạy normalizeError TRƯỚC → lỗi được tag theo `kind` domain
captureError(error, { source: 'product-actions' });

// ❌
console.error(error);
```

- Fire-and-forget — `captureError` không được ném tiếp.
- `error.tsx` và `global-error.tsx` báo lỗi qua `captureError`.
- **Double-capture server + client là cố ý**: server (`onRequestError`) có chi tiết đầy đủ; client có tín hiệu + `digest` để đối chiếu (prod che message).

## 13.7 `instrumentation.ts` — `[MUST]`

`src/instrumentation.ts` được Next tự nạp:

- `register()` — boot log, cấu hình sink server.
- `onRequestError(err, request, context)` — bắt **mọi lỗi phía server**: render RSC, Route Handler, Server Action, proxy → `captureError` với `routeType` / `routePath` / `renderSource` / `digest`.

**[MUST]** Không đặt logic nghiệp vụ ở đây — chỉ boot glue.

## 13.8 Analytics & Web Vitals — `[SHOULD]`

- `track(event, props)` / `identify(user)` qua `~/lib/analytics`. Sink mặc định theo `NODE_ENV`: dev → logger, test/prod → noop cho tới khi cắm vendor thật.
- Web Vitals: `~/components/web-vitals.tsx` (`"use client"`, trả `null`) dùng `useReportWebVitals` → `track('web_vital', …)`.
  Đây là **Analytics**, không phải Monitoring. Callback phải **ổn định ở module level** (tránh report trùng). Component này an toàn trong static shell (không đọc request-time).
