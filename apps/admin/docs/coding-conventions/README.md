# Coding Conventions — codebase1 UI (React)

> **Single Source of Truth (SSOT)** về quy ước code cho team frontend.
> Tài liệu **evolve cùng codebase**: mỗi thay đổi rule đi kèm code minh chứng, không viết một lần rồi bỏ.

---

## 1. Tài liệu này là gì

Đây là nơi **duy nhất** định nghĩa cách viết code trong dự án. Khi có tranh luận về style/kiến trúc, tài liệu này là căn cứ cuối cùng. Mọi rule đều bám sát code thực tế trong `src/` và được enforce bằng công cụ ở mức tối đa.

Tài liệu này trả lời **"làm gì"** (the rule). Nó **không** giải thích dài dòng "vì sao chọn" — phần rationale/nghiên cứu nằm ở tài liệu khác và không phải căn cứ khi review.

## 2. Cách dùng

| Tình huống | Làm gì |
|---|---|
| **Viết code** | Đọc `v1/00-introduction.md` (4 phút), sau đó tra cứu theo chủ đề |
| **Review PR** | Cite rule ID trong comment (vd `NM-004`, `ST-012`) để tác giả tra ngược |
| **Onboarding** | Đọc theo lộ trình "Mới vào team" ở [`v1/README.md`](./v1/README.md) (~45 phút) |
| **Thêm/sửa rule** | Theo quy trình ở §7 bên dưới |

## 3. Cấu trúc

```
docs/coding-conventions/
├── README.md        (file này) — index, chính sách version, severity, rule ID
├── CHANGELOG.md     — log thay đổi giữa các version
└── v1/              — version hiện hành
    ├── README.md    — mục lục + lộ trình đọc + scope
    └── 00..20-*.md  — 21 tài liệu rule theo chủ đề
```

## 4. Nhãn mức độ (severity)

| Nhãn | Ý nghĩa | Khi vi phạm |
|---|---|---|
| 🔴 **[MUST]** | Bắt buộc. Enforce bằng lint / type-check / CI ở mức tối đa. | **Block merge** — fix ngay |
| 🟡 **[SHOULD]** | Khuyến nghị mạnh. | Comment trong PR; lệch phải nêu rõ lý do |
| 🟢 **[MAY]** | Tùy chọn theo ngữ cảnh. | Không block |

Code mẫu dùng `✅` (nên) và `❌` (tránh). Mục chưa áp dụng vào codebase được gắn nhãn **[PLANNED]** kèm mốc dự kiến.

## 5. Rule ID scheme

Mỗi rule có ID **grep được**, dạng `<PREFIX>-<3 chữ số>` — prefix theo file chủ đề:

| Prefix | Chủ đề | Prefix | Chủ đề |
|---|---|---|---|
| `CP-` | Core Principles | `EH-` | Error Handling |
| `SK-` | Tech Stack | `OB-` | Observability |
| `PS-` | Project Structure | `IN-` | i18n |
| `NM-` | Naming | `UI-` | UI & Accessibility |
| `TY-` | TypeScript | `TE-` | Testing |
| `CH-` | Components & Hooks | `SE-` | Security |
| `RT-` | Routing | `PF-` | Performance |
| `API-` | API Layer | `TG-` | Tooling · Git · CI |
| `ST-` | State Management | | |
| `FM-` | Forms & Validation | | |
| `AU-` | Auth & RBAC | | |

**ID không bao giờ được tái sử dụng cho ý nghĩa khác.** Rule bị bỏ thì đánh dấu deprecated, không cấp lại số — nếu không, comment ở PR cũ sẽ trỏ sai.

## 6. Chính sách version

Convention và codebase cùng tiến hóa (iterative refinement). Có 2 cấp version:

- **Thư mục `vN/`** = một *snapshot lớn* của bộ quy ước. Chỉ lên version mới (`v1/` → `v2/`) khi có **thay đổi phá vỡ**: rule cũ bị đảo ngược/xóa gây conflict với code hiện có, nâng major framework kéo theo nhiều rule đổi, hoặc tái cấu trúc bộ tài liệu. Version cũ **giữ nguyên, không xóa** — PR cũ vẫn tra được rule mà nó tuân theo lúc merge.
- **Trong mỗi `vN/`**, số `vN.MINOR.PATCH` ghi ở `vN/README.md`:
  - **MINOR** — thêm rule/mục mới, không phá rule cũ.
  - **PATCH** — làm rõ câu chữ, sửa ví dụ, sửa lỗi, sửa link.
  - Sửa **tại chỗ** trong thư mục version hiện hành.

Không tạo sẵn thư mục version rỗng — `v2/` chỉ xuất hiện khi thực sự bắt đầu v2.

| Loại thay đổi | Hành động |
|---|---|
| Thêm rule mới, không conflict | Sửa trong `v1/` → bump MINOR + ghi CHANGELOG |
| Làm rõ wording / sửa ví dụ / typo | Sửa trong `v1/` → bump PATCH + ghi CHANGELOG |
| Đảo ngược hoặc xóa rule cũ | Tạo `v2/` (copy `v1/` + sửa) → đánh dấu `v1/` là `Superseded by v2` |

## 7. Version đang active

| Version | Trạng thái | Thư mục |
|---|---|---|
| **v1** (1.0.0) | ✅ Active | [`./v1/`](./v1/README.md) |

→ Bắt đầu đọc tại **[v1/README.md](./v1/README.md)**.

## 8. Quy trình cập nhật tài liệu

1. Đề xuất thay đổi rule đi kèm **code minh chứng trong cùng PR** (hoặc PR docs riêng tham chiếu commit code đã merge).
2. Sửa file convention liên quan trong `vN/` — thêm rule mới thì cấp ID kế tiếp của prefix đó.
3. Bump số version ở `vN/README.md` và ghi vào [`CHANGELOG.md`](./CHANGELOG.md) (ngày + tóm tắt + lý do).
4. Reviewer kiểm tra: rule mới có **enforce tự động** được không? Nếu không → cân nhắc hạ xuống `[SHOULD]`, hoặc mở task thêm ESLint rule / CI check.
5. Rule bị gỡ → đánh dấu deprecated kèm ID thay thế, không xóa trắng khỏi lịch sử.
