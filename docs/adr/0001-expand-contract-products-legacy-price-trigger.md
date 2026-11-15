# ADR-0001: Nâng schema `app.products` theo expand/contract, đồng bộ cột giá cũ bằng trigger

> **Epic:** SHOP-7 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-7

## Status

Proposed with the plan of SHOP-7; it takes effect when you approve the plan at gate ②

## Date

2026-11-15

## Context

`v0.3.0` nâng một database Production đã có dữ liệu: bảng `app.products` của V3 có `price NUMERIC(12,2)` ghi là USD và cho phép giá 0, mà Epic cần giá bán và giá gốc là số nguyên đồng, trạng thái và tình trạng (SPEC, TW1 và Product Rules).

Ràng buộc (NFR17, NFR22):

- deployer dựng bản mới trong khi bản cũ còn chạy, và có thể rollback về `v0.2.0`, nên hai bản phải đọc và ghi đúng trên cùng một schema;
- `v0.2.0` không sửa được nữa: nó ghi `price` bằng `BigDecimal` qua `POST /api/products`, `PUT /api/products/{id}/price` và `PUT /api/products/bulk-price/{slug}` (JPQL, không qua entity), và khởi động với `ddl-auto: validate`, nên cột `price` phải giữ kiểu;
- lệnh ghi của `v0.2.0` phải làm đúng các cột mới, theo cùng quy tắc như lúc chuyển dữ liệu cũ (giá 0 hay lớn hơn 999.999.999 thành Ẩn);
- lệnh ghi của `v0.3.0` phải giữ cột `price` đúng, để `v0.2.0` đọc được sau rollback.

## Decision

Migration V4 chỉ thêm: các cột `price_vnd`, `compare_at_price_vnd`, `status`, `availability`, điền chúng từ dữ liệu cũ, và một trigger `BEFORE INSERT OR UPDATE` (`trg_products_sync_legacy_price`) giữ `price` và `price_vnd` khớp nhau theo cả hai chiều. Entity của `v0.3.0` không map cột `price`. Một bản sau, sớm nhất `v0.4.0`, bỏ trigger, hàm của nó và cột `price` bằng một migration, không đổi Java. Bảng chi tiết của trigger nằm ở mục Database Changes của `docs/specs/SHOP-7/plan.md`.

## Alternatives Considered

### `v0.3.0` tự ghi cả hai cột trong Java
- Pros: logic nằm trong code Java, dễ đọc và dễ test bằng unit test.
- Cons: không phủ được lệnh ghi của `v0.2.0` (lúc chuyển bản và sau rollback), nên vẫn cần trigger cho chiều đó; hai cơ chế cho một việc; bước contract phải sửa cả Java.
- Rejected: không đạt NFR17 nếu thiếu trigger, mà có trigger rồi thì ghi đôi trong Java là thừa.

### Đổi kiểu cột `price` tại chỗ sang `BIGINT`
- Pros: không có cột thừa, không cần bước contract.
- Cons: `v0.2.0` không khởi động được với `ddl-auto: validate`, và đọc giá sai sau rollback.
- Rejected: phá rollback về `v0.2.0` (Boundaries của SPEC: Never).

### `price_vnd` là cột sinh từ `price`
- Pros: không cần trigger, database luôn tự tính.
- Cons: `v0.3.0` không ghi được cột sinh, nên vẫn phải ghi `price` bằng số có phần lẻ (trái Code Style); bước contract phải đổi cột sinh thành cột thường và sửa Java.
- Rejected: đẩy cột cũ vào code mới, đúng điều expand/contract muốn tránh.

### Bảng mới `products_v2` và view tương thích cho `v0.2.0`
- Pros: tách hẳn schema cũ và mới.
- Cons: view có thể cập nhật phải viết trigger `INSTEAD OF` cho mọi lệnh ghi của `v0.2.0`, phức tạp hơn một trigger trên bảng; `v0.2.0` validate entity với một view.
- Rejected: nặng hơn nhiều cho cùng một kết quả.

## Consequences

- Trigger là logic trong database: mỗi dòng của bảng trigger trong plan có một integration test (Testcontainers PostgreSQL 17), và toàn bộ test sản phẩm của code `v0.2.0` chạy không sửa trên V4 trước khi code mới thay nó.
- Khi `v0.2.0` sửa giá của một sản phẩm, trigger có thể đặt sản phẩm thành Ẩn (giá 0 hay quá lớn) và bỏ giá gốc không còn lớn hơn giá mới, vì `v0.2.0` không biết hai trường đó.
- Code của `v0.3.0` không bao giờ đọc hay ghi cột `price`; reviewer chặn mọi lần map lại nó.
- Bước contract là một Task riêng cho bản sau, ngoài Epic SHOP-7, chỉ chạy khi không còn cần rollback về `v0.2.0`.
