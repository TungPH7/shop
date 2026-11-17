# 15 — UI & Accessibility

> Accessibility và styling đều là **[MUST]**. Accessibility được lint kiểm. Styling theo design system của `admin`: CSS variables và CSS thường, không Tailwind hay thư viện UI, mô tả ở [`docs/design-system/admin.md`](../../../../../docs/design-system/admin.md).

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

## 15.2 Hợp đồng props của component dùng chung

### UI-008 [MUST] Component dùng chung giữ contract props ổn định, độc lập cách vẽ

Component ở `src/components/` vẽ bằng class của `components.css` (15.3). Khi đổi markup hay class bên trong, **props không đổi** ⇒ call-site không phải sửa.

Hệ quả khi viết mới: props mô tả **ý định** (`label`, `error`, `isLoading`), không mô tả **cách vẽ** (`className`, `borderColor`).

### UI-009 [MUST] Component headless bọc thư viện đặt trong `src/components/<nhóm>/`

Thư viện chỉ được import trong đúng file wrapper đó, không rải ra feature. Wrapper chưa dùng tới phải tree-shake được khỏi bundle.

### UI-010 [MAY] Inline style chỉ cho giá trị tính lúc chạy

Chấp nhận inline style khi giá trị là **chức năng** và chỉ biết lúc chạy (chiều cao/vị trí do đo đạc, transform của virtualization). Không dùng inline style cho quyết định **thẩm mỹ**.

## 15.3 Styling

Design system của `admin` là CSS variables và CSS thường, không có Tailwind hay thư viện UI: mục 14 của Architecture Decisions trong `docs/specs/SHOP-7/plan.md`, và NFR13 của SPEC. Từng token, từng class và chỗ của chúng trong code nằm ở [`docs/design-system/admin.md`](../../../../../docs/design-system/admin.md).

| File | Nội dung |
|---|---|
| `src/styles/tokens.css` | Mọi token: màu, chữ, khoảng cách, bo góc, bóng, kính, chuyển động |
| `src/styles/global.css` | Nền trang, chữ thân, h1–h3, liên kết, vòng focus |
| `src/styles/components.css` | Class dùng chung: nút, huy hiệu, thẻ kính, ô nhập, bảng, banner, khung xương, khung trang |
| `src/styles/list-page.css` | Class riêng của trang danh sách sản phẩm (S1), nạp sau `components.css` |
| `src/styles/form-page.css` | Class riêng của trang form sản phẩm (S2), nạp sau `components.css` |

### UI-011 [MUST] Chỉ dùng token của `tokens.css`, không tự đặt giá trị

Màu, cỡ chữ, độ đậm, khoảng cách, bo góc, bóng và thời gian chuyển động lấy từ biến của `tokens.css`. CSS của màn hình không viết mã màu hay số `px`, `rem` tự đặt. Cần một giá trị mới thì thêm token vào `tokens.css` và một dòng vào `docs/design-system/admin.md`, trong cùng PR.

✅ `color: var(--muted); padding: var(--space-3);` ❌ `color: #3b475a; padding: 13px;`

### UI-012 [MUST] Dùng class của `components.css` trước khi viết CSS mới

Nút, huy hiệu, thẻ, ô nhập, bảng, banner và khung trang dùng class sẵn có. Một biến thể mới khai ở `components.css`, cạnh class gốc, không rải ở từng màn hình. Trạng thái lấy từ thuộc tính ngữ nghĩa khi có, như `[aria-current='page']`, `[aria-invalid='true']` hay `:disabled`, không thêm một class `--active` song song.

### UI-013 [MUST] Không thêm thư viện styling hay thư viện UI

Không Tailwind, CSS-in-JS, preprocessor hay thư viện component. Dependency duy nhất của design system là gói font mà SPEC cho phép (NFR13).

### UI-014 [MUST] Sáng và tối đi qua token, không qua component

Token màu viết bằng `light-dark(sáng, tối)`. Component không đọc theme và không có CSS riêng cho giao diện tối. Giá trị nào `light-dark()` không chở được, như bóng, thì khai ở `tokens.css`. Theme đổi qua facade `useTheme()` (`09-state-management.md`). Chỉ `public/theme-init.js` và `syncThemeToDocument` đặt `data-theme` trên `<html>`.
