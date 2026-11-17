# Changelog

## [0.3.0] - 2026-11-17

### Added

- `admin`: danh sách sản phẩm có tìm theo tên (không phân biệt hoa thường và dấu), lọc theo trạng thái và phân trang (SHOP-19).
- `admin`: thêm sản phẩm bằng form, slug tự sinh từ tên đã bỏ dấu tiếng Việt và sửa được (SHOP-20).
- `admin`: sửa, ẩn và đánh dấu Hết hàng một sản phẩm. Khi hai người cùng sửa một sản phẩm, người lưu sau nhận lỗi sửa chồng (409) thay vì ghi đè (SHOP-34).
- `admin`: xóa hẳn sản phẩm sau hộp thoại xác nhận S3 (SHOP-37).
- `user`: danh sách sản phẩm Đang bán, mỗi lần 24 sản phẩm, có nút "Xem thêm" (SHOP-25).
- `user`: tìm không phân biệt hoa thường và dấu (gõ "ao thun" ra "Áo thun"). Sắp xếp theo Mới nhất, Giá thấp đến cao hay Giá cao đến thấp, và theo Liên quan nhất khi đang tìm. Đường dẫn giữ từ khóa, kiểu sắp xếp và số sản phẩm đã xem (SHOP-28).
- `user`: trang chi tiết theo slug có tên, giá bán, giá gốc gạch ngang kèm phần trăm giảm, tình trạng và mô tả. Mỗi sản phẩm có một ảnh giữ chỗ là chữ cái đầu của tên (SHOP-21).
- `user`: trang "Không tìm thấy sản phẩm" trả mã 404 khi slug không có, khi sản phẩm bị Ẩn và khi sản phẩm đã bị xóa (SHOP-24).
- `user`: thẻ meta, dữ liệu cấu trúc `Product` (JSON-LD) và sitemap của sản phẩm (SHOP-31).
- Design system của `admin`: token, font Urbanist, khung trang và các component (SHOP-8, SHOP-9).
- Design system của `user`: token, font, component, cùng khung trang có thanh điều hướng và chân trang. Có giao diện sáng và tối (SHOP-10, SHOP-11).
- `api`: hợp đồng API sản phẩm mới, theo ADR-0003. `/api/admin/products` cho quản trị: danh sách, chi tiết, thêm, sửa theo `version`, xóa. `/api/products` và `/api/sitemap/products` cho server của `user`: chỉ GET và HEAD, và chỉ trả sản phẩm Đang bán. Lỗi trả theo Problem Details (SHOP-14, SHOP-15, SHOP-16).
- Migration Flyway V4 (bước expand của `app.products`), theo ADR-0001 và ADR-0002. Bảng thêm giá bán và giá gốc tính bằng đồng (`BIGINT`), trạng thái, tình trạng, hàm `app.search_fold` với cột sinh `name_search` để tìm không dấu, và trigger giữ cột giá cũ khớp với giá mới để rollback được về v0.2.0 (SHOP-13).
- Migration V6: dừng lần deploy kèm thông báo rõ ràng khi `pgcrypto` không nằm ở schema `public` (SHOP-50).
- CI có thêm job `caddy-proxy`, kiểm Caddy của `admin` giữ header `X-Forwarded-*` (SHOP-57), và job `not-found`, kiểm bản build của `user` trả 404 cho trang S6 (SHOP-61). Hai job dừng khi bộ lọc pnpm không khớp project nào (SHOP-62).

### Changed

- `api` gỡ các endpoint sản phẩm cũ: `GET /api/products` trả cả danh sách một lần, `GET /api/products/{id}`, `PUT /api/products/{id}/price` và `PUT /api/products/bulk-price/{slug}`. Không app nào còn dùng chúng (SHOP-14, ADR-0003).
- `admin` và `user` gỡ phần sản phẩm cũ của template, cùng các mock của API NestJS cũ. Trang sản phẩm của `admin` ra khỏi lớp đăng nhập của template, và `user` không còn nút xóa sản phẩm (SHOP-17, SHOP-18).
- Sản phẩm có từ trước bản này được chuyển khi nâng database. Giá giữ nguyên con số, được coi là đồng (không quy đổi từ USD) và làm tròn tới đồng. Sản phẩm có giá 0 hay lớn hơn 999.999.999 thành Ẩn, các sản phẩm còn lại là Đang bán, và mọi sản phẩm cũ là Còn hàng (SHOP-13).
- Khi trình duyệt offline, các lệnh ghi của `admin` hiện lỗi S2.5 thay vì đứng ở "Đang lưu…" (SHOP-66).
- `user` gấp từ khóa tìm (bỏ dấu, chữ thường) trước khi làm khóa cache, và đọc ký tự điều khiển trong từ khóa như khoảng trắng (SHOP-69).
- Chép kit có chạy song song (C2, `352b3df`) vào repo, với ba làn worktree. `jira-sync` chạy theo `pull_request_target` và lấy token từ environment `jira-sync`. Workflow mới `PR review` chuyển các review cho `jira-sync` mà không giữ secret nào (SHOP-38).
- `project.yaml`: `user` và `admin` nhận `API_URL` trỏ tới `api` Spring Boot, `api` nhận các origin CORS cục bộ, và `runs.min_free_ram_gb` hạ xuống 1,5 (SHOP-55).
- Sửa các finding Medium và Low sau review của design system, khung trang, domain sản phẩm, API quản trị, các trang `admin` và `user`, SEO và E2E (SHOP-39, SHOP-41, SHOP-42, SHOP-43, SHOP-45, SHOP-46, SHOP-47, SHOP-48, SHOP-49, SHOP-52, SHOP-53, SHOP-54, SHOP-58, SHOP-59, SHOP-60, SHOP-63, SHOP-64, SHOP-65, SHOP-67, SHOP-68). Bản sửa của SHOP-71 (E2E AC10 của `admin` chập chờn khi chạy cả bộ) nằm trong SHOP-39.

### Fixed

- `app.gen_uuid_v7()` lỗi khi `search_path` chỉ có `app`, vì `gen_random_bytes` không ghi schema. Migration V5 gọi `public.gen_random_bytes()` (SHOP-44).
- Log WARN của Hibernate ghi cả câu INSERT, kèm tên và mô tả sản phẩm, khi slug trùng. `api` tắt log này ở mọi profile (SHOP-51).
- `api` trả 403 "Invalid CORS request" cho mọi POST từ trình duyệt của `admin`, vì Caddy của `admin` làm mất `X-Forwarded-Proto` của proxy trên VPS (SHOP-56).

### Known Issues

- Đăng nhập và đăng xuất của `user` chưa được kiểm trên Staging. 2 E2E dùng mock của API NestJS cũ, nên bị bỏ qua ngoài app dựng tại chỗ. Chúng chờ Epic Đăng nhập.
- Lỗi DELETE ở hộp thoại S3 của `admin` (NFR19, S3.6) chưa được kiểm trên Staging. 3 E2E của nó chỉ chạy với mock ở app dựng tại chỗ.
- Trạng thái rỗng AC23 ("Chưa có sản phẩm nào.") chưa được kiểm, vì nó cần một catalog không có sản phẩm Đang bán. Nhánh "không khớp từ khóa" của AC23 đã pass trên Staging.
- Cột giá cũ `price` và trigger đồng bộ của nó vẫn còn trong database, để rollback được về v0.2.0. Một bản sau, sớm nhất v0.4.0, gỡ chúng (bước contract).
- Production vẫn hỏi basic auth tới Epic Đăng nhập, và `/api/**` của `api` vẫn `permitAll`. Chỉ mạng giữ các lệnh ghi.
- Bạn chấp nhận rủi ro token CI của Jira còn là biến người dùng trên máy của bạn, tới khi nó rời máy (review của PR #21). Rủi ro High về login GitHub trong phiên agent vẫn được bạn chấp nhận tới 2026-12-31 (SHOP-6).
- `package.json` vẫn ghi phiên bản `0.1.0`.
- Chưa có buổi demo và UAT trên Staging.

## [0.2.0] - 2026-11-15

### Added

- App GitHub `ao-merge` riêng cho `merge-gate`: workflow `merge-gate.yml` nhận thêm secret `AO_MERGE_APP_KEY`, và `project.yaml` khai báo `merge: tungph7-ao-merge`, `merge_id: 5756976` (SHOP-6).
- File `.github/CODEOWNERS` (`* @TungPH7`), sinh từ `github.approvers`: các ruleset chỉ tính approval của code owner, nên không App nào approve PR thay bạn. File này vào danh sách đường dẫn được bảo vệ (SHOP-6).
- PR riêng cho báo cáo regression và changelog của bản release, từ `release-notes/vX.Y.Z` vào `release/vX.Y.Z`, do `merge-gate` merge khi CI xanh (SHOP-6).
- Bản sao backup mã hoá bằng `age` để máy của bạn kéo về, và tuỳ chọn `production_auth` giữ basic auth trên Production cho tới khi dự án mở cho mọi người (SHOP-6).

### Changed

- Chép kit Pilot 3 (`05da881`, sau ba vòng review) vào `.ai-orchestrator/`, `.claude/` và `.github/workflows/merge-gate.yml`: năm ruleset với approval của code owner, merge ngược từ `main` chỉ khi head của `main` là commit của một tag `v*`, và dòng trạng thái của `/ao-preview` (SHOP-6).
- Không đổi code của app `user`, `admin`, `api`, cũng không đổi `deploy.yaml` (SHOP-6).

### Fixed

Không có.

### Known Issues

- 8 E2E của template dùng mock của API NestJS cũ bị bỏ qua ngoài môi trường cục bộ (SHOP-5), giữ nguyên từ v0.1.0: đăng nhập, RBAC và CRUD sản phẩm chưa được kiểm trên Staging. Các test này chờ Epic Đăng nhập và Epic Danh mục sản phẩm.
- Rủi ro High về login GitHub: agent chạy dưới tài khoản Windows của bạn nên lấy được login GitHub của bạn. Bạn chấp nhận rủi ro này tới 2026-12-31, chờ tài khoản `ao-agent` sau Pilot 3 (SHOP-6).
- Chưa có buổi demo và UAT trên Staging.

## [0.1.0] - 2026-11-14

### Added

- App `api` (Spring Boot) dựng từ template Java, chạy với PostgreSQL riêng cho từng môi trường; schema tạo bằng migration Flyway `V1__init`, `V2__app_helpers` và `V3__create_products_table` (SHOP-3, phần scaffold).

### Changed

- Mở `/actuator/health/liveness` và `/actuator/health/readiness` cho truy cập không cần đăng nhập, để `HEALTHCHECK` của container `api` báo `healthy`; các endpoint actuator khác vẫn đóng (SHOP-5).
- E2E chạy được trên Development và Staging mà không dựng app tại chỗ: `playwright.config.ts` chỉ khởi động app cục bộ khi có test `@local` (SHOP-5).
- `api` nghe theo biến `PORT` và mỗi commit chạy một image chung cho mọi môi trường (SHOP-4, phần scaffold).
- App `user` và `admin` qua được các gate của kit, mỗi commit build một image (SHOP-1, phần scaffold).
- Cập nhật kit project-scaffold phần 3, gồm cấu hình CI (SHOP-2, phần scaffold).

### Fixed

Không có.

### Known Issues

- 8 E2E của template dùng mock của API NestJS cũ bị bỏ qua ngoài môi trường cục bộ (SHOP-5): đăng nhập, RBAC và CRUD sản phẩm chưa được kiểm trên Staging. Các test này chờ Epic Đăng nhập và Epic Danh mục sản phẩm.
- Chưa có buổi demo và UAT trên Staging.
