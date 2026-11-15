# ADR-0003: Tách API sản phẩm cho quản trị và cho khách

> **Epic:** SHOP-7 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-7

## Status

Proposed with the plan of SHOP-7; it takes effect when you approve the plan at gate ②

## Date

2026-11-15

## Context

`admin` cần thấy và sửa mọi sản phẩm, cả Đang bán lẫn Ẩn; trang của khách chỉ được thấy sản phẩm Đang bán, và không chỗ nào được để lộ một sản phẩm Ẩn có tồn tại (NFR9). Tới Epic đăng nhập, `/api/**` của `api` vẫn `permitAll`, và chỉ mạng giữ các lệnh ghi (NFR8): `api` chỉ tới được qua `/api/*` của host `admin` (basic auth của VPS) và qua server của `user` (`API_URL`). Các endpoint cũ (`GET /api/products` trả hết một lần, `GET /api/products/{id}`, `PUT …/price`, `PUT …/bulk-price/{slug}`) không có app nào dùng được: `admin` đọc `priceCents`, `user` gọi API NestJS cũ.

## Decision

Hai nhóm endpoint, hai controller, hai bộ DTO:

- `/api/admin/products`: cho `admin` và helper E2E; danh sách có lọc trạng thái, chi tiết theo `id`, thêm, sửa có `version`, xóa;
- `/api/products` và `/api/sitemap/products`: cho server của `user`; chỉ GET và HEAD, luôn chỉ sản phẩm Đang bán, không có tham số trạng thái; chi tiết theo slug, với cùng một phản hồi 404 cho slug chưa từng có, sản phẩm Ẩn và sản phẩm đã xóa.

DTO của khách không có `status`, `version` hay `createdAt`. `v0.3.0` gỡ các endpoint cũ. Hợp đồng chi tiết nằm ở mục API Contract của `docs/specs/SHOP-7/plan.md`.

## Alternatives Considered

### Một endpoint có tham số `status`, mặc định Đang bán
- Pros: ít code hơn, một danh sách cho cả hai app.
- Cons: ai gọi được endpoint cũng mở được sản phẩm Ẩn bằng `?status=HIDDEN`; an toàn dựa vào việc `user` không bao giờ gửi tham số đó.
- Rejected: trái NFR9, vốn đòi lệnh đọc của khách không nhận tham số nào mở ra sản phẩm Ẩn.

### Một endpoint, lọc theo vai trò của người gọi
- Pros: một đường dẫn, quyền quyết định dữ liệu trả về.
- Cons: chưa có đăng nhập để biết vai trò; cùng một URL trả dữ liệu khác nhau khó cache và khó test.
- Rejected: phụ thuộc Epic đăng nhập chưa có.

### Giữ endpoint cũ bên cạnh endpoint mới
- Pros: không gỡ gì.
- Cons: `GET /api/products/{id}` đụng `GET /api/products/{slug}`; endpoint trả hết danh sách và endpoint đổi giá bằng số lẻ trái SPEC (TW2, Success Criteria).
- Rejected: không có app nào dùng chúng.

## Consequences

- Epic đăng nhập chỉ cần chặn `/api/admin/**`; nhóm của khách có thể ở lại công khai.
- Hai danh sách dùng chung `ProductQueryRepository`, nên quy tắc tìm và sắp xếp chỉ viết một lần; bộ lọc Đang bán của khách đặt ở service của khách, không nhận từ request.
- `user` không bao giờ gọi `/api/admin/**`: unit test cho thấy DAL sản phẩm của `user` chỉ gửi GET và HEAD tới `/api/products` và `/api/sitemap/products`, và `security` review các PR đó (NFR8).
- Đường dẫn sitemap nằm ngoài `/api/products/`, để không đụng một sản phẩm có slug `sitemap`.
