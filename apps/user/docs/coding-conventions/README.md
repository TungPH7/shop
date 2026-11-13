# Coding Conventions — codebase1 UI (Next.js 16)

> **Single Source of Truth (SSOT)** về quy ước code cho team frontend.
> Tài liệu **evolve cùng codebase**: mỗi rule đều rút ra từ code thật trong `src/` và được sửa lại khi code đổi — không viết một lần rồi bỏ.

---

## 1. Tài liệu này là gì

Đây là nơi **duy nhất** định nghĩa cách viết code trong dự án. Khi có tranh luận về style/kiến trúc, tài liệu này là căn cứ cuối cùng.

Nguyên tắc biên soạn:

1. **Bám code thật** — mọi rule đều chỉ được ra file cụ thể trong `src/`. Không có rule "lý thuyết".
2. **Enforce bằng máy trước, bằng người sau** — rule nào ép được bằng TypeScript / ESLint / Prettier / Git hook / CI thì phải ép; phần còn lại mới dựa vào review.
3. **Ngắn để có người đọc** — mỗi chương 3–5 phút. Member chỉ mở đúng chương mình cần.

## 2. Mức độ bắt buộc của rule

| Nhãn         | Ý nghĩa                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| **[MUST]**   | Bắt buộc. Được enforce bằng lint / type-check / CI. Vi phạm = block merge. |
| **[SHOULD]** | Khuyến nghị mạnh. Lệch phải ghi rõ lý do trong PR.                         |
| **[MAY]**    | Tùy chọn theo ngữ cảnh.                                                    |

Code mẫu dùng `✅` (nên) và `❌` (tránh). Nội dung là suy luận hoặc chưa kiểm chứng được gắn nhãn `[Inference]` / `[Unverified]`.

## 3. Chính sách version

Convention và codebase cùng tiến hóa (iterative refinement). Có 2 cấp version:

- **Thư mục `vN/`** = một _snapshot lớn_ của bộ quy ước. Chỉ lên version mới (`v1/` → `v2/`) khi có **thay đổi lớn / breaking**: nâng major Next.js hoặc React kéo theo nhiều rule đổi, đổi kiến trúc nền (vd rời bỏ mô hình BFF), hoặc tái cấu trúc bộ tài liệu. Version cũ **giữ nguyên** để tra lịch sử.
- **Trong mỗi `vN/`**, số `vN.MINOR.PATCH` ghi ở `vN/README.md`:
  - **MINOR** — thêm rule/chương mới, không phá vỡ rule cũ.
  - **PATCH** — làm rõ câu chữ, sửa ví dụ, sửa lỗi.
  - Sửa **tại chỗ** trong thư mục version hiện hành.

Không tạo sẵn thư mục version rỗng. `v2/` chỉ xuất hiện khi thực sự bắt đầu v2.

## 4. Version đang active

| Version | Trạng thái | Thư mục                   |
| ------- | ---------- | ------------------------- |
| **v1**  | ✅ Active  | [`./v1/`](./v1/README.md) |

→ Bắt đầu đọc tại **[v1/README.md](./v1/README.md)**.

## 5. Quy trình cập nhật tài liệu

1. Thay đổi rule đi kèm **cùng PR** với code minh chứng (hoặc PR docs riêng tham chiếu commit code).
2. Cập nhật chương liên quan trong `vN/`.
3. Ghi vào [`CHANGELOG.md`](./CHANGELOG.md) và bump số version ở `vN/README.md`.
4. Reviewer kiểm tra: rule mới có enforce được bằng máy không? Nếu không → cân nhắc hạ xuống `[SHOULD]`.

**Rule bị vi phạm liên tục** là tín hiệu rule sai, không phải team sai — đưa ra thảo luận để sửa hoặc gỡ rule, đừng để rule chết nằm trong tài liệu.
