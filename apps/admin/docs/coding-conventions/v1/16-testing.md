# 16 — Testing

> Test **hành vi người dùng**, mock ở **ranh giới mạng**. Nhiều unit/integration nhanh, ít E2E cho luồng tới hạn.

## 16.1 Nguyên tắc

### TE-001 [MUST] Test hành vi, không test chi tiết cài đặt

Truy vấn theo role/label/text như người dùng thấy. Không test state nội bộ, không test tên hàm private.

✅ `expect(screen.getByRole('alert')).toHaveTextContent(/price/i)`
❌ `expect(wrapper.state.errors.price).toBeDefined()`

### TE-002 [MUST] Code có hành vi mới ⇒ có test mới

Sửa bug ⇒ thêm test tái hiện bug đó trước. PR đổi hành vi mà không đụng test là dấu hiệu thiếu sót.

### TE-003 [MUST] Test nằm cạnh file được test

`x.tsx` ↔ `x.test.tsx`. Không có thư mục test tập trung. → `PS-009`

### TE-004 [MUST] Import tường minh các API của test runner

Dự án **không** bật globals (do `types: []` trong tsconfig) ⇒ phải `import { describe, it, expect, vi } from 'vitest'`. Dùng globals sẽ mất kiểu.

Hệ quả: dọn dẹp sau mỗi test được làm tường minh trong file setup, không dựa vào auto-cleanup.

## 16.2 Mock

### TE-005 [MUST] Mock ở ranh giới mạng bằng MSW, không mock `fetch`/axios

Test đi qua **tầng api thật** (interceptor, chuẩn hóa lỗi, validate Zod) ⇒ sát production. Mock từng hàm sẽ bỏ qua đúng phần dễ hỏng nhất.

❌ `vi.mock('@/lib/api/api')`

### TE-006 [MUST] Dữ liệu mock phải khớp Zod schema thật

Mock sai shape ⇒ tầng api ném lỗi validation và test hỏng vì lý do sai. Coi đây là tính năng: mock lệch schema tức là contract đã lệch.

### TE-007 [MUST] Override handler theo từng test và reset sau mỗi test

Dùng `server.use(...)` trong test cần trường hợp riêng; reset handler ở `afterEach` để test không rò rỉ sang nhau.

### TE-008 [SHOULD] Không mock hook của chính mình để giả trạng thái

Muốn test trạng thái đã đăng nhập ⇒ **đặt token trước khi render** rồi để luồng thật chạy qua MSW, thay vì `vi.mock('useAuth')`. Mock hook làm test luôn xanh kể cả khi luồng thật gãy.

## 16.3 Render

### TE-009 [MUST] Render qua helper chung, không tự lắp provider

`renderWithProviders` (và `renderWithRouter` cho test cấp route) dựng đúng chồng provider của app nhưng **mới và cô lập cho từng test**.

Helper trả về `{ store, queryClient, user, … }` để test tương tác tiếp.

### TE-010 [MUST] Mỗi test có store và query client riêng

`makeStore(preloadedState)` cho state khởi tạo; query client của test đặt `retry: false`. Dùng chung singleton giữa các test ⇒ rò rỉ trạng thái, test phụ thuộc thứ tự chạy.

### TE-011 [MUST] Test tôn trọng seam, không phá layering

Muốn preload state Redux ⇒ truyền store qua `StoreProvider`. `react-redux` vẫn chỉ được import trong `src/stores/**` (`ST-010`) — kể cả trong test.

### TE-012 [MUST] Chờ bằng `findBy*` / `waitFor`, không chờ bằng timeout cố định

❌ `await new Promise((r) => setTimeout(r, 500))`

### TE-013 [MUST] Test phải xác định (deterministic)

Thời gian, ngẫu nhiên, locale phải bơm được từ ngoài hoặc mock. Không để test phụ thuộc giờ máy hay ngôn ngữ trình duyệt.

## 16.4 Coverage

### TE-014 [MUST] Ngưỡng coverage là **lưới chống tụt**, không phải mục tiêu

Ngưỡng đặt thấp hơn mức đang đạt một khoảng nhỏ: fail khi có regression thật, không fail vặt. Đạt được mức cao hơn ⇒ nâng ngưỡng lên (cơ chế bánh cóc).

Coverage dùng để **tìm chỗ chưa test**, không phải điểm chất lượng. Ép % cao sẽ đẻ ra test rác.

### TE-015 [MUST] Không loại trừ file khỏi coverage để làm đẹp số

Chỉ loại trừ file **về bản chất không unit-test được**: entry point, bootstrap, vỏ route, file khai kiểu, singleton phụ thuộc env. Loại một file *đang có logic* ra khỏi coverage là gian lận chỉ số.

## 16.5 E2E

### TE-016 [MUST] E2E chỉ cho luồng tới hạn

Kim tự tháp: nhiều unit/integration, ít E2E. E2E chậm và dễ vỡ ⇒ dành cho luồng sống còn (đăng nhập, CRUD chính).

### TE-017 [MUST] E2E tách khỏi unit test

Spec E2E ở thư mục riêng, không nằm trong `src/`, không do Vitest chạy.

### TE-018 [MUST] Mock mạng trong E2E phải neo vào origin của backend

Mẫu khớp quá rộng (kiểu `**/products`) sẽ nuốt luôn điều hướng của chính SPA ⇒ test hỏng theo cách rất khó hiểu. Luôn neo vào origin backend.

### TE-019 [SHOULD] Test lỗi nên dùng status không kích hoạt retry

Dùng 4xx thay vì 5xx khi muốn kiểm màn hình lỗi — nếu không, test phải chờ hết chuỗi backoff của `API-006`.

### TE-020 [MUST] `pnpm test` và `pnpm e2e` không chạy ở pre-commit

Quá chậm cho vòng lặp local ⇒ để CI (`19-tooling-git-ci.md`).
