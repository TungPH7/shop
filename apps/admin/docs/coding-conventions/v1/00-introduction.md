# 00 — Introduction

> Đọc file này trước. Nó định nghĩa cách đọc 20 file còn lại.

## 0.1 Mục đích

Tài liệu này là **luật thực thi** của codebase — nguồn căn cứ duy nhất khi review PR và khi tranh luận về style/kiến trúc. Ba mục tiêu:

1. **Nhất quán** — người mới đọc code của người cũ không phải đoán.
2. **Enforce được bằng máy** — ưu tiên rule mà lint/type-check/CI bắt được, thay vì trông chờ review thủ công.
3. **Tiến hóa cùng code** — rule sinh ra từ code thật, và đổi khi code đổi.

Tài liệu trả lời **"làm gì"**. Nó cố ý **không** trình bày dài dòng "vì sao chọn X thay vì Y" — mỗi rule chỉ giữ đúng phần lý do cần để áp dụng đúng.

## 0.2 Phạm vi

Áp dụng cho toàn bộ code trong `src/`, `e2e/`, `scripts/` và file cấu hình ở gốc repo. Không áp dụng cho `node_modules/`, output build (`dist/`, `coverage/`, `playwright-report/`) và thư mục tài liệu nghiên cứu.

## 0.3 Nhãn mức độ

| Nhãn | Ý nghĩa | Khi vi phạm |
|---|---|---|
| 🔴 **[MUST]** | Bắt buộc | Block merge |
| 🟡 **[SHOULD]** | Khuyến nghị mạnh | Comment trong PR; lệch phải nêu lý do |
| 🟢 **[MAY]** | Tùy chọn theo ngữ cảnh | Không block |
| ⏳ **[PLANNED]** | Đã chốt nhưng **chưa** áp dụng vào codebase | Không áp dụng khi review |

Quy ước dùng từ theo tinh thần RFC 2119: **MUST** = "phải", **SHOULD** = "nên", **MAY** = "có thể".

## 0.4 Cấu trúc một rule

```markdown
### NM-004 [MUST] File & folder dùng kebab-case

Mọi file/folder trong `src/` đặt tên kebab-case, kể cả file chứa component.

✅ `product-card.tsx` → `export function ProductCard()`
❌ `ProductCard.tsx` · `productCard.tsx`

**Enforce:** `eslint-plugin-check-file` → `pnpm lint`
```

Dòng **Enforce** cho biết rule được kiểm tự động bằng gì. Rule không có dòng này ⇒ phụ thuộc review thủ công ⇒ thường chỉ ở mức `[SHOULD]`.

## 0.5 Rule ID

Dạng `<PREFIX>-<3 chữ số>`, prefix theo file chủ đề (`NM-` naming, `ST-` state…). Bảng prefix đầy đủ ở `../README.md`.

- Cite ID khi comment PR: *"Chỗ này vi phạm `ST-006`"* — tác giả tra ngược được ngay.
- Số **không** cần liên tiếp và **không bao giờ** được tái sử dụng cho ý nghĩa khác.

## 0.6 Thứ tự ưu tiên khi xung đột

Khi hai nguồn nói khác nhau, ưu tiên từ trên xuống:

1. **Rule `[MUST]` trong tài liệu này.**
2. **Cấu hình đang chạy** (`eslint.config.js`, `tsconfig.*.json`, `.prettierrc.json`). Nếu config chặt hơn tài liệu → theo config, đồng thời mở PR sửa tài liệu.
3. **Code hiện có ở cùng module** — viết cho giống hàng xóm.
4. **Official docs của thư viện.**

Nếu tài liệu **mâu thuẫn** với config đang chạy, đó là **bug của tài liệu** → phải sửa trong PR gần nhất, không im lặng bỏ qua.

## 0.7 Ngôn ngữ

| Đối tượng | Ngôn ngữ |
|---|---|
| Nội dung tài liệu này | Tiếng Việt |
| Tên file/folder, code, comment trong code, commit message, tên test | **Tiếng Anh** |

## 0.8 Ngoại lệ

Rule `[MUST]` được phép lệch khi có lý do kỹ thuật thật. Điều kiện:

1. Comment ngay tại chỗ lệch, nêu **lý do** (không chỉ ghi `eslint-disable` trống).
2. Suppress **hẹp nhất có thể** — theo dòng, không theo file; tuyệt đối không tắt rule ở cấp global.
3. Nêu trong mô tả PR để reviewer thấy.

✅
```ts
// react-virtual returns a fresh measure fn each render; the compiler can't memoize it.
// eslint-disable-next-line react-hooks/incompatible-library
```
❌ `/* eslint-disable */` ở đầu file.
