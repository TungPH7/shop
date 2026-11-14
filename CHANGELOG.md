# Changelog

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
