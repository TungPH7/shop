# 13 — Observability

> Ba mối quan tâm tách bạch, mỗi cái một **seam** (interface + DI). Đổi được **đích đến** mà không đổi call-site.

## 13.1 Nguyên tắc chung

### OB-001 [MUST] Ba concern tách riêng, không gộp

| Concern | Trả lời câu hỏi | Module |
|---|---|---|
| **Logger** | "Lúc đó code chạy tới đâu, với dữ liệu gì?" | `src/lib/logger/` |
| **Monitoring** | "Có lỗi gì ở production, của ai, sau thao tác nào?" | `src/lib/monitoring/` |
| **Analytics** | "Người dùng làm gì trong sản phẩm?" | `src/lib/analytics/` |

### OB-002 [MUST] `lib/*` không import SDK của nhà cung cấp

Mỗi concern định nghĩa interface riêng (kiểu `LogSink` / `MonitoringTransport` / `AnalyticsSink`). SDK thật (dịch vụ giám sát, nền tảng analytics) chỉ được cắm vào **một chỗ duy nhất** ở tầng `app` lúc bootstrap.

Lợi ích: đổi nhà cung cấp không đụng call-site, test thay bằng sink giả, và SDK chưa dùng thì tree-shake khỏi bundle.

### OB-003 [MUST] Bootstrap gọi đúng một lần ở tầng app

`app/observability.ts` → `setupObservability()` gọi trong `main.tsx`, trước phần khởi tạo auth. Không cấu hình lại ở giữa vòng đời app.

## 13.2 Logger

### OB-004 [MUST] Log có level và có cấu trúc, không nối chuỗi

✅ `logger.warn('retrying request', { url, attempt, delayMs })`
❌ `console.log('retry ' + url + ' attempt ' + attempt)`

Log dạng object mới truy vấn/lọc được khi đưa lên hệ thống tập trung.

### OB-005 [MUST] Không dùng `console.*` trong `src/`

Dùng `logger`. Ngoại lệ: bản thân sink ghi ra console, và file cấu hình/scripts chạy ở Node.

### OB-006 [MUST] Factory thuần tách khỏi singleton đọc env

`createLogger({ minLevel, sink, bindings?, now? })` không đọc env ⇒ import được ở mọi nơi và test được (bơm `now` để log xác định). Singleton `logger` gắn level theo môi trường đặt ở file riêng.

Mức mặc định: dev = `debug`, production = `warn`.

### OB-007 [SHOULD] Dùng `child(bindings)` để mang context, không lặp field thủ công

✅ `const log = logger.child({ feature: 'product' });`

## 13.3 Monitoring

### OB-008 [MUST] Báo cáo lỗi đi qua `captureError` / `captureException`, không gọi SDK trực tiếp

Một cửa duy nhất (`EH-011`). Transport mặc định định tuyến qua logger ⇒ **không bao giờ nuốt lỗi**, kể cả khi chưa cắm dịch vụ giám sát.

### OB-009 [MUST] Có lưới cuối ở cấp `window`

Đăng ký handler `error` và `unhandledrejection` trong `setupObservability()` để bắt lỗi async/ngoài React mà Error Boundary bỏ sót (`EH-001`).

Bức tranh đầy đủ:

```
lỗi render        → Error Boundary (route/app) ─┐
lỗi query/mutation → onError ở cache           ─┼→ captureError → transport (console | dịch vụ)
lỗi async/global   → window handlers           ─┘
```

### OB-010 [MUST] Không đưa dữ liệu nhạy cảm vào báo cáo

Không log token, mật khẩu, thông tin định danh cá nhân. Context đính kèm phải kiểm trước khi thêm.

## 13.4 Analytics

### OB-011 [MUST] Tên sự kiện `snake_case`, ổn định

✅ `product_created` · `login_submitted` ❌ `ProductCreated` · `clicked the button`

Đổi tên sự kiện làm gãy báo cáo lịch sử ⇒ coi như breaking change.

### OB-012 [MUST] Analytics đi qua `track()` / `identify()` của seam, có bộ lọc

Bộ lọc là nơi cắm lấy mẫu, đồng ý người dùng (consent) và công tắc tắt khẩn cấp. Sink mặc định là no-op — analytics không phải thứ sống còn, mất sự kiện trước lúc bootstrap là chấp nhận được (khác hẳn báo cáo lỗi).

### OB-013 [SHOULD] Không đặt lời gọi analytics trong `useEffect` chỉ để "bắn khi mount"

Bắn sự kiện tại **hành động** (event handler) hoặc tại điều hướng — không tại vòng đời render.
