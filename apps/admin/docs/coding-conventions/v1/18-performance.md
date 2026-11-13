# 18 — Performance

> Quy tắc số một: **đo trước, tối ưu sau**. Tối ưu theo cảm tính thường làm code khó đọc mà không nhanh hơn.

## 18.1 Re-render

### PF-001 [MUST] Không memo hóa thủ công

React Compiler đã tự memo lúc build. Không rải `useMemo` / `useCallback` / `memo` "cho chắc" — chúng làm code rối và tự nó cũng có chi phí.

Chỉ dùng khi **đo được** vấn đề, kèm comment nêu số đo.

### PF-002 [MUST] Tuân thủ Rules of React để compiler làm việc được

Component/hook không pure ⇒ compiler bỏ qua chính chỗ đó. Vi phạm im lặng đắt hơn là không có compiler. → `CP-007`

### PF-003 [MAY] Suppress khi thư viện không tương thích compiler

Thư viện trả về hàm mới mỗi lần render sẽ bị compiler báo không memo được. Suppress **theo dòng**, kèm giải thích. Không tắt rule ở cấp file hay cấp project. → `00-introduction.md §0.8`

### PF-004 [SHOULD] Selector hẹp thay vì chia nhỏ component để né re-render

→ `ST-012`

### PF-005 [MAY] `useDeferredValue` cho input lọc danh sách lớn

Giữ ô nhập mượt, để việc lọc chạy ở mức ưu tiên thấp. Các công cụ khác (`useTransition`, `content-visibility`…) là dụng cụ — chỉ dùng khi profiler chỉ ra điểm nghẽn cụ thể.

## 18.2 Bundle

### PF-006 [MUST] Code-split theo route

Route phụ/nặng dùng `lazy` với `import()` chuỗi literal. → `RT-008`

### PF-007 [MUST] Thư viện nặng và ít dùng phải nằm sau ranh giới tải lười

Áp dụng cho: devtools, thư viện form, bản dịch theo feature, thư viện sanitize, thư viện virtualization. Người dùng không vào màn hình đó thì không tải byte nào.

### PF-008 [MUST] Không thêm cấu hình chia chunk thủ công khi chưa đo

Bundler đã chia hợp lý. Gộp tay dễ phản tác dụng và dễ sinh lỗi thứ tự nạp. Muốn thêm ⇒ phải kèm **số đo trước/sau** từ báo cáo bundle.

### PF-009 [MUST] Công cụ phân tích bundle phải gated, không nằm trong build thường

Bật qua biến môi trường (`pnpm build:analyze`), chi phí bằng 0 khi tắt. Báo cáo sinh ra không commit.

### PF-010 [SHOULD] Import có chọn lọc, ưu tiên thư viện tree-shakeable

✅ `import { debounce } from 'lodash-es'` ❌ `import _ from 'lodash'`

## 18.3 Render danh sách & tài nguyên

### PF-011 [MUST] Danh sách hàng trăm phần tử trở lên phải virtualize

Dùng component virtual list dùng chung (`components/virtual/`), không tự viết logic đo và cắt.

### PF-012 [MUST] `key` ổn định trong danh sách

→ `CH-006`

### PF-013 [SHOULD] Ảnh khai kích thước, tải lười khi ngoài màn hình

Tránh nhảy layout (CLS) và tránh tải thứ người dùng chưa nhìn thấy.

### PF-014 [SHOULD] Prefetch dữ liệu cho tương tác đoán trước được

→ `ST-009`

## 18.4 Đo lường

### PF-015 [MUST] Thay đổi vì performance phải kèm số đo trước/sau

Nguồn hợp lệ: báo cáo bundle, React Profiler, Lighthouse/Core Web Vitals. "Cảm giác nhanh hơn" không phải bằng chứng. → `CP-010`

### PF-016 [SHOULD] Ngưỡng tham chiếu Core Web Vitals

LCP < 2.5s · INP < 200ms · CLS < 0.1.

### PF-017 [SHOULD] Theo dõi kích thước bundle khởi động qua thời gian

Chunk khởi động phình lên bất thường sau một PR là tín hiệu có thư viện lọt vào đường tải chính (thường do vô tình import từ module lẽ ra phải lười).
