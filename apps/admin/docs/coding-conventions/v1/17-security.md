# 17 — Security

> SPA chạy hoàn toàn ở máy người dùng. Phòng thủ nhiều lớp, validate tại mọi ranh giới, và **không có bí mật nào an toàn trong bundle**.

## 17.1 XSS

### SE-001 [MUST] Không dùng `dangerouslySetInnerHTML` trực tiếp

Đây là lối thoát hiểm duy nhất khỏi cơ chế escape của JSX. Cần render HTML không tin cậy ⇒ dùng component `<SafeHtml>`.

**Enforce:** `no-restricted-syntax` chặn thuộc tính này ở mọi file, trừ đúng file hiện thực `SafeHtml`.

### SE-002 [MUST] Sanitize đi qua đúng một module, dùng thư viện chuẩn

`src/lib/security/sanitize-html.ts` là nơi **duy nhất** gọi thư viện sanitize. Không tự viết bộ lọc HTML — đây là bài toán đã có lời giải được kiểm chứng, tự viết gần như chắc chắn sót.

Lợi ích: kiểm toán bảo mật chỉ cần soi một file; thư viện sanitize tree-shake khỏi bundle cho tới khi thật sự dùng.

### SE-003 [MUST] Kiểm dữ liệu người dùng trước khi đưa vào `href` / `src`

Chặn scheme thực thi được (`javascript:`, `data:` với HTML). React **không** escape giúp ở vị trí này.

### SE-004 [MUST] Không dựng HTML từ nối chuỗi rồi mới sanitize

Sanitize là bước cuối trước khi render, không phải bước làm sạch nửa vời ở giữa.

## 17.2 Secrets & cấu hình

### SE-005 [MUST] Không có secret nào trong `src/`

Mọi biến `VITE_*` bị nướng vào bundle client lúc build ⇒ **công khai**. API key riêng tư, chuỗi kết nối, khóa ký chỉ được nằm ở backend.

**Verify:** grep `src/` không có `sk_`, `AKIA`, `PRIVATE KEY`, `password=`, `api_key=`.

### SE-006 [MUST] Giá trị cho môi trường production cấp lúc build ở CI

File `.env.*` không được commit (chỉ commit file mẫu). CI đặt biến khi build. Vì `VITE_*` là công khai, dùng **variable** của CI, không dùng secret store — đưa secret thật vào `VITE_*` là rò rỉ.

## 17.3 Token & phiên

### SE-007 [MUST] Token chỉ đi qua module token storage

Không đọc/ghi nơi lưu token ở chỗ khác (`AU-001`).

### SE-008 [MUST] Token không xuất hiện ở log, URL, analytics, hay báo cáo lỗi

Kiểm cả context đính kèm khi gọi `captureError` (`OB-010`).

### SE-009 [SHOULD] ⏳ Chuyển refresh token sang cookie `httpOnly` khi triển khai

Cách lưu hiện tại đánh đổi rủi ro XSS lấy sự đơn giản, và được bù bằng SE-001…SE-004 + CSP. Bản cứng hơn là refresh token trong cookie `httpOnly` + `Secure` + `SameSite`, phụ thuộc backend ⇒ làm ở giai đoạn triển khai.

## 17.4 Lớp hạ tầng

### SE-010 [MUST] ⏳ CSP đặt bằng HTTP header ở edge, không bằng thẻ `<meta>`

Tối thiểu `default-src 'self'` + `script-src 'self'` + liệt kê `connect-src` cho backend. Kèm `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`.

Triển khai theo hai bước: bật chế độ **report-only** trước, xử lý hết vi phạm, rồi mới cưỡng chế. Không bật CSP cho dev server.

**Trạng thái:** cấu hình ở lớp hosting — thực hiện ở giai đoạn triển khai.

### SE-011 [MUST] Quét lỗ hổng dependency trong CI

`pnpm audit` chạy ở mức `high` trở lên (mức thấp gây nhiễu và làm team quen bỏ qua cảnh báo).

### SE-012 [MUST] Phòng thủ supply-chain khi cài đặt

Pin exact version (`SK-001`), khóa lockfile trong CI, đặt thời gian chờ tối thiểu trước khi nhận bản phát hành mới, và chỉ cho phép script cài đặt của những gói thật sự cần.

## 17.5 Nguyên tắc chung

### SE-013 [MUST] Không tin dữ liệu từ client về mặt bảo mật

Ẩn nút, disable input, kiểm quyền ở frontend đều chỉ để trải nghiệm. Cưỡng chế thật nằm ở backend (`AU-012`).

### SE-014 [MUST] Validate mọi dữ liệu ngoài tại điểm nhập

Bao gồm cả `localStorage` và query param — chúng do người dùng sửa được. → `CP-005`, `TY-010`
