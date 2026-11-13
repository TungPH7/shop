# 01 — Core Principles

> 8 nguyên tắc nền. Mọi rule cụ thể ở các chương sau đều suy ra từ đây. Khi gặp tình huống tài liệu chưa phủ, quyết định theo các nguyên tắc này.

## 1.1 Server-first — `[MUST]`

Mặc định mọi thứ chạy ở server. Chỉ đẩy sang client khi **thật sự** cần tương tác (event handler, state, browser API).

- Component mặc định là Server Component; `"use client"` là **ngoại lệ có chủ đích**, phạm vi nhỏ nhất có thể ("island").
- Data đọc ở server (DAL), không fetch ở client trừ khi có lý do (→ §08, §10).

**Vì sao:** bundle nhỏ hơn, secret không rời server, ít waterfall, SEO tốt hơn.

## 1.2 Enforce bằng máy, không bằng niềm tin — `[MUST]`

Rule nào ép được bằng TypeScript / ESLint / Prettier / Git hook / CI thì **phải** ép. Rule chỉ nằm trong tài liệu sẽ bị vi phạm và không ai biết.

Thứ tự ưu tiên khi thêm một rule mới:

1. Ép bằng **type** (compile error) → tốt nhất.
2. Ép bằng **lint rule** (`eslint .`).
3. Ép bằng **test** hoặc **CI gate**.
4. Chỉ khi cả 3 đều không được mới ghi thành `[SHOULD]` cho reviewer.

## 1.3 Parse, don't validate — `[MUST]`

Dữ liệu từ ngoài hệ thống phải đi qua Zod ở **biên**, đổi thành kiểu đã kiểm chứng — không phải "kiểm tra rồi tin".

Năm biên bắt buộc: **env** · **response từ backend** · **input của Server Action** · **searchParams** · **form**. (→ §08)

Hệ quả: **schema là nguồn sự thật của type** (`z.infer`), không khai type song song.

## 1.4 Ranh giới phụ thuộc một chiều — `[MUST]`

`shared → features → app`. Không có chiều ngược, không có import chéo giữa các feature. Enforce bằng `import-x/no-restricted-paths` (→ §02).

Song song đó là ranh giới thứ hai — **server / client** — chốt bằng `import 'server-only'`. Đừng nhầm hai trục này với nhau.

## 1.5 Vendor đứng sau seam — `[MUST]`

Code nghiệp vụ **không import trực tiếp SDK của bên thứ ba**. Luôn có một facade mỏng của ta ở giữa:

| Vendor                      | Seam                                  | Ai được import vendor                      |
| --------------------------- | ------------------------------------- | ------------------------------------------ |
| Redux Toolkit / react-redux | `~/stores/*`                          | chỉ `src/stores/**` (ESLint chặn nơi khác) |
| pino                        | `~/lib/logger`                        | chỉ `src/lib/logger/pino-sink.ts`          |
| Monitoring / Analytics SDK  | `~/lib/monitoring`, `~/lib/analytics` | chỉ file adapter tương ứng                 |
| HTTP (fetch)                | `~/lib/http`                          | chỉ `src/lib/http/**`                      |

**Vì sao:** đổi vendor = viết lại nội bộ seam, không đụng feature. Và test được bằng fake transport, không cần service ngoài.

## 1.6 Không tin client — `[MUST]`

Ẩn nút, `disabled`, kiểm tra ở form **không phải** bảo mật. Mọi quyết định bảo mật phải lặp lại ở server:

- Server Action **luôn** re-validate input + re-authorize, dù client đã làm (→ §09).
- Authz thật nằm ở DAL / Server Action, **không** ở `proxy.ts` (→ §14).
- Backend là chốt cuối — vẫn phải 401/403 nếu ai đó gọi thẳng.

## 1.7 Đo trước khi tối ưu — `[SHOULD]`

Không thêm cache / memo / code-split / thư viện tối ưu vì "nghe nói nhanh hơn". Có số đo trước (build output, bundle analyze, Web Vitals) rồi mới tối ưu, và ghi lại số trước–sau trong PR.

## 1.8 Đừng lắp seam sớm — `[SHOULD]`

Chỉ dựng abstraction khi đã có **≥2 người dùng thật** hoặc một nhu cầu đã xác nhận. Trong repo này, những thứ cố ý **chưa** làm: sanitize HTML (chưa có rich-text), switcher brand runtime (chưa có brand thứ hai), tách file messages theo feature (chưa đủ feature).

Ngược lại: khi nhu cầu thứ hai xuất hiện → **nâng lên shared ngay**, đừng copy-paste.

## 1.9 Tài liệu sống cùng code — `[MUST]`

Rule đổi thì tài liệu đổi trong **cùng PR**. Rule bị vi phạm liên tục là dấu hiệu rule sai → sửa hoặc gỡ, đừng để rule chết.
