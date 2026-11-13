# 19 — Tooling · Git · CI

> Hai tầng kiểm tra: **nhanh ở local** (file staged), **đầy đủ ở CI** (toàn bộ repo).

## 19.1 Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Type-check + build production |
| `pnpm build:analyze` | Build kèm báo cáo bundle |
| `pnpm preview` | Serve bản build |
| `pnpm typecheck` | Chỉ type-check |
| `pnpm lint` / `pnpm lint:fix` | ESLint (boundaries, naming, hooks, a11y, type-aware) |
| `pnpm format` / `pnpm format:check` | Prettier ghi đè / kiểm tra |
| `pnpm test` / `test:watch` / `test:coverage` | Unit & component test |
| `pnpm e2e` | E2E |

### TG-001 [MUST] Dùng pnpm, không dùng npm/yarn

Lockfile của trình quản lý khác lọt vào repo là lỗi. Version pnpm lấy từ `packageManager` (`SK-003`).

## 19.2 Phân vai công cụ

### TG-002 [MUST] Prettier quyết định format, ESLint quyết định chất lượng

Không bật rule format trong ESLint (đã tắt bằng config tương thích Prettier). Tranh luận về dấu phẩy, xuống dòng, độ dài dòng ⇒ để công cụ xử, không mang vào review.

Cấu hình đang dùng: dấu nháy đơn, có `;`, `trailingComma: all`, rộng 100 cột, thụt 2 space, `endOfLine: lf`.

### TG-003 [MUST] Không sửa cấu hình lint/format để né lỗi

Muốn nới một rule ⇒ đề xuất kèm lý do, sửa cả tài liệu này (`00-introduction.md §0.6`). Sửa lén config trong PR tính năng sẽ bị từ chối.

### TG-004 [MUST] Markdown không bị Prettier format

Tài liệu (kể cả bộ convention này) nằm ngoài phạm vi Prettier để tránh phá bảng và văn bản đã căn chỉnh tay.

## 19.3 Git hooks

### TG-005 [MUST] Không bỏ qua hook

`pre-commit` chạy lint + format trên **file staged**; `commit-msg` kiểm định dạng commit. Hook cài tự động khi `pnpm install`.

`git commit --no-verify` chỉ dùng cho tình huống khẩn cấp thật và phải nói rõ trong PR — CI vẫn chặn.

### TG-006 [MUST] Việc chậm không đặt ở pre-commit

Type-check toàn dự án, unit test, E2E **không** chạy ở pre-commit (vòng lặp local phải nhanh, nếu không sẽ bị bỏ qua). Chúng thuộc về CI.

### TG-007 [MUST] Commit theo Conventional Commits, một dòng

→ `NM-010`. Không thêm dòng trailer tự sinh vào message.

## 19.4 Quality gate

### TG-008 [MUST] Bốn lệnh phải xanh trước khi mở PR

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

Đỏ ở bất kỳ lệnh nào ⇒ chưa sẵn sàng review.

### TG-009 [MUST] CI là điều kiện bắt buộc để merge

Workflow chạy hai job song song:

| Job | Các bước |
|---|---|
| `verify` | install (khóa lockfile) → lint → typecheck → format:check → test kèm coverage → build → audit |
| `e2e` | cài browser → chạy E2E → upload báo cáo |

### TG-010 [MUST] CI không có file `.env` — biến build phải inject tường minh

File môi trường không được commit ⇒ CI đặt biến `VITE_*` khi build (giá trị công khai, dùng variable chứ không dùng secret — `SE-006`). Thiếu biến ⇒ app fail-fast lúc chạy chứ không phải lúc build, nên đây là lỗi dễ lọt nếu không để ý.

### TG-011 [MUST] Không hạ ngưỡng coverage để cho CI xanh

Coverage tụt ⇒ viết test, không sửa ngưỡng. Nâng ngưỡng thì được (`TE-014`).

### TG-012 [SHOULD] Bật branch protection yêu cầu cả hai job

"CI xanh trên PR" chỉ trọn vẹn khi repo bắt buộc check trước khi merge.

## 19.5 Pull request

### TG-013 [MUST] PR nhỏ, một mục đích

Một PR = một tính năng/bug/refactor. Trộn refactor lớn vào PR tính năng làm review mất tác dụng.

### TG-014 [MUST] Mô tả PR nêu **cách verify**

Liệt kê: gate đã chạy, test nào thêm/đổi, cách kiểm thủ công nếu có, số đo nếu là thay đổi performance. → `CP-010`

### TG-015 [SHOULD] Review cite rule ID

Nhận xét dạng *"vi phạm `ST-010`"* giúp tác giả tra ngược và giúp phát hiện rule nào trong tài liệu đang mơ hồ.

### TG-016 [SHOULD] Refactor không đi kèm thay đổi hành vi trong cùng commit

Tách commit "refactor" và commit "đổi hành vi" để `git bisect` còn dùng được.
