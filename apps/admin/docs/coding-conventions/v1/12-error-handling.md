# 12 — Error Handling

> **Hai họ lỗi, hai bộ công cụ.** Error Boundary không bắt được lỗi bất đồng bộ — cần cả hai, không thay thế nhau.

## 12.1 Phân loại

### EH-001 [MUST] Chọn công cụ theo họ lỗi

| Họ lỗi | Ví dụ | Công cụ |
|---|---|---|
| **Render** (đồng bộ, trong cây React) | đọc thuộc tính của `undefined` khi render | **Error Boundary** |
| **Async** (server, event, timer) | request lỗi, handler ném lỗi | State của Query · `onError` · `try/catch` |
| **Ngoài React hoàn toàn** | promise bị reject không ai bắt | Global handler `error` / `unhandledrejection` (→ `13`) |

Error Boundary **không** bắt lỗi trong event handler, `setTimeout`, hay promise. Đừng trông chờ nó là lưới duy nhất.

## 12.2 Error Boundary

### EH-002 [MUST] Dùng thư viện error boundary, không tự viết class

Giá trị nằm ở `onReset` / `resetKeys` / hook ném lỗi từ async — tự viết sẽ thiếu.

### EH-003 [MUST] Hai tầng boundary

| Tầng | Đặt ở | Bắt gì | Kết quả |
|---|---|---|---|
| **Route** | Route cha (`ErrorBoundary` của route) | Lỗi render trong một nhánh route | Giữ nguyên vỏ app, chỉ vùng nội dung báo lỗi |
| **App** | Trên `RouterProvider` | Lỗi thoát khỏi router (layout gốc, chính router) | Lưới cuối — **không bao giờ trắng trang** |

### EH-004 [MUST] Nút "Thử lại" phải thật sự thử lại

Boundary cấp app bọc cơ chế reset của Query để `onReset` **refetch** dữ liệu, không chỉ reset state React (nếu không, bấm xong lỗi hiện lại ngay).

### EH-005 [MUST] Fallback lỗi phải tự chủ, không phụ thuộc hệ thống có thể đang hỏng

Màn hình fallback cấp app cố ý **không** dùng i18n và không phụ thuộc store — nếu chính i18n/store là thứ crash thì fallback vẫn phải hiển thị được.

## 12.3 Lỗi server

### EH-006 [MUST] Xử lý lỗi server tập trung ở cache của Query, không ở `defaultOptions`

Đăng ký `onError` trên `QueryCache` và `MutationCache` khi tạo `QueryClient`. Callback ở cache **luôn chạy đúng một lần** và không bị ghi đè bởi option truyền tại call-site.

Đây là nơi xử lý lỗi server **duy nhất**. Hệ quả: không toast trong interceptor (`API-003`), không lặp lại `onError` toast ở từng hook.

### EH-007 [MUST] Quy tắc hiển thị toast

| Nguồn | Toast? | Lý do |
|---|---|---|
| **Mutation** lỗi | Có (mặc định) | Người dùng vừa chủ động làm gì đó, phải được phản hồi |
| **Query** lỗi khi đã có dữ liệu cũ | Có | Refetch nền hỏng — màn hình vẫn dùng được, cần báo nhẹ |
| **Query** lỗi lần tải đầu | **Không** | Đã có `isError` tại chỗ hoặc nổi lên boundary; toast là thừa và gây nhiễu |

### EH-008 [MAY] Tắt toast cho một lời gọi cụ thể qua `meta`

Dùng `meta: { skipGlobalError: true }` (đã gắn kiểu bằng module augmentation). **Việc báo cáo lỗi vẫn luôn chạy** dù toast bị bỏ — tắt hiển thị không đồng nghĩa với giấu lỗi.

## 12.4 Thông báo & báo cáo

### EH-009 [MUST] Notification là store standalone, không nằm trong Redux

Phải gọi được từ **ngoài** React (callback của cache ở EH-006) ⇒ store pub/sub riêng ở `src/lib/notifications/`, React đọc bằng `useSyncExternalStore`. Đặt trong Redux sẽ vừa khó gọi từ ngoài, vừa ràng buộc vào seam client-state (`ST-010`).

### EH-010 [MUST] Vùng render thông báo đặt **ngoài** error boundary

Nếu nằm trong, app crash là mất luôn thông báo. Vùng này là ARIA live region (`aria-live`, `role="alert"` / `role="status"`).

### EH-011 [MUST] Mọi lỗi báo cáo qua đúng một cửa `captureError(error, ctx)`

Gọi từ: boundary cấp app, boundary cấp route, `onError` của query cache, `onError` của mutation cache. Đổi đích báo cáo (console → dịch vụ giám sát) chỉ sửa ruột hàm này, **không đổi call-site**. → `13-observability.md`

### EH-012 [MUST] Không nuốt lỗi

Cấm `catch {}` rỗng và cấm `catch` rồi chỉ `console.log`. Lỗi phải: hiển thị cho người dùng, **hoặc** báo cáo qua `captureError`, **hoặc** ném tiếp — thường là kết hợp.

### EH-013 [SHOULD] Thông báo lỗi cho người dùng phải hành động được

Nói rõ chuyện gì xảy ra và làm gì tiếp. Không hiển thị stack trace hay mã lỗi thô cho người dùng cuối.

✅ "Không tải được danh sách sản phẩm. Thử lại?"
❌ "Error: Request failed with status code 500"
