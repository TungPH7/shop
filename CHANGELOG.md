# Changelog

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
