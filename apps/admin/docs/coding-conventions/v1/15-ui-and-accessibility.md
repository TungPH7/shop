# 15 — UI & Accessibility

> Accessibility là **[MUST] ngay hôm nay** và được lint kiểm. Phần styling là **[PLANNED]** — codebase đang ở giai đoạn UI-agnostic.

## 15.1 Accessibility

### UI-001 [MUST] Dùng HTML ngữ nghĩa trước khi nghĩ tới ARIA

Nút bấm là `<button>`, điều hướng là `<a>`/`<Link>`, tiêu đề là `<h1>`–`<h6>` theo thứ bậc. ARIA để **bổ sung**, không để vá cho `<div>` giả làm nút.

✅ `<button onClick={handleDelete}>` ❌ `<div role="button" tabIndex={0} onClick={…}>`

**Enforce:** `eslint-plugin-jsx-a11y`

### UI-002 [MUST] Mọi control tương tác phải có tên đọc được

`<label htmlFor>` cho input, `aria-label` cho nút chỉ có icon, `alt` cho ảnh có nghĩa (`alt=""` cho ảnh trang trí).

### UI-003 [MUST] Vùng nội dung động phải là live region

| Loại | Thuộc tính |
|---|---|
| Đang tải / trạng thái nền | `role="status"` |
| Lỗi / cảnh báo cần chú ý ngay | `role="alert"` |

Áp dụng cho: chỉ báo tải, lỗi form, toast, chỉ báo điều hướng. → `CH-017`, `EH-010`

### UI-004 [MUST] Trạng thái lỗi của field nối được với field

`aria-invalid` + `aria-describedby` trỏ tới id của thông báo lỗi. Component field chung đã làm sẵn — dùng nó (`FM-007`).

### UI-005 [MUST] Thao tác được bằng bàn phím

Mọi luồng chính (điều hướng, gửi form, xác nhận xóa) phải làm được không cần chuột. Không đặt `tabIndex` dương. Không xóa outline focus mà không thay bằng chỉ báo focus rõ ràng khác.

### UI-006 [MUST] Không truyền thông tin **chỉ** bằng màu sắc

Trạng thái lỗi/thành công phải kèm chữ hoặc icon, không chỉ đổi màu viền.

### UI-007 [SHOULD] Test truy vấn theo role/label

Nếu không `getByRole` / `getByLabelText` được thì thường chính component đó chưa accessible. Test và a11y củng cố lẫn nhau. → `16-testing.md`

## 15.2 Hợp đồng UI-agnostic

### UI-008 [MUST] Component dùng chung giữ contract props ổn định, độc lập thư viện UI

Component ở `src/components/` hiện dùng markup tối giản, chưa gắn thư viện UI nào. Khi thay markup bằng thư viện UI, **props không đổi** ⇒ call-site không phải sửa.

Hệ quả khi viết mới: props mô tả **ý định** (`label`, `error`, `isLoading`), không mô tả **cách vẽ** (`className`, `borderColor`).

### UI-009 [MUST] Component headless bọc thư viện đặt trong `src/components/<nhóm>/`

Thư viện chỉ được import trong đúng file wrapper đó, không rải ra feature. Wrapper chưa dùng tới phải tree-shake được khỏi bundle.

### UI-010 [MAY] Inline style chỉ cho giá trị tính lúc chạy

Chấp nhận inline style khi giá trị là **chức năng** và chỉ biết lúc chạy (chiều cao/vị trí do đo đạc, transform của virtualization). Không dùng inline style cho quyết định **thẩm mỹ**.

## 15.3 Styling ⏳ [PLANNED]

Chưa áp dụng vào codebase. Đã chốt hướng, sẽ chuyển thành rule `[MUST]` khi lớp UI adapter được thực hiện:

| Hạng mục | Hướng đã chốt |
|---|---|
| Engine | Utility-first (Tailwind v4) + gom biến thể bằng `cva` |
| Theming | CSS variables — độc lập engine, đổi adapter không phải viết lại token |
| Component | Mô hình "own-your-code" trên nền primitive accessible |
| Nguyên tắc | Không rải chuỗi class ma; biến thể khai tập trung tại component |

**Cho tới lúc đó:** không thêm thư viện styling mới, không thêm CSS toàn cục ngoài reset, không tự dựng hệ thống token song song. Giữ `UI-008` để lần chuyển đổi chỉ đụng markup bên trong component.
