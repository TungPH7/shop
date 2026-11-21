# ADR-0004: Danh mục một cấp bằng cột `category_id` có `ON DELETE SET NULL`

> **Epic:** SHOP-81 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-81

## Status

Proposed with the plan of SHOP-81; it takes effect when you approve the plan at gate ②

## Date

2026-11-21

## Context

SHOP-81 thêm danh mục một cấp: mỗi sản phẩm thuộc tối đa một danh mục, hay không thuộc danh mục nào. Quản trị viên xóa được mọi danh mục, kể cả danh mục còn sản phẩm, và khi đó các sản phẩm của nó thành "Không có danh mục", không đổi trường nào khác (AC8). Không lúc nào được có sản phẩm trỏ tới một danh mục đã xóa, kể cả khi một quản trị viên khác đang gán sản phẩm vào danh mục đó (AC10, NFR15).

Schema mới phải là bước expand: `v0.3.0` đang chạy trên Production phải chạy đúng trên nó trong lúc deploy và sau một lần rollback, kể cả thêm, sửa và xóa sản phẩm (TW1, NFR16). Entity `Product` của `v0.3.0` không biết cột mới nào.

## Decision

Migration V7 tạo `app.categories` và thêm vào `app.products` một cột `category_id UUID` cho phép trống, có khóa ngoại `products_category_fk` tới `app.categories (id)` với `ON DELETE SET NULL`, và index `idx_products_category_id`. Chính lệnh `DELETE` của danh mục đặt `category_id` của các sản phẩm của nó về trống, trong cùng câu lệnh và cùng transaction:

- `updated_at` của các sản phẩm đó đổi thành lúc xóa, vì trigger `trg_products_set_updated_at` chạy cho cả UPDATE do khóa ngoại sinh ra;
- `version` của chúng giữ nguyên, nên một form sửa sản phẩm đang mở không nhận 409 sửa chồng;
- số sản phẩm của một danh mục đếm lúc đọc, không lưu thành cột (NFR18).

Lần gán sản phẩm chạy cùng lúc với lần xóa thì database xếp thứ tự: khóa ngoại của lệnh gán chờ lần xóa, rồi thất bại thành 400 trên trường `categoryId`; hay lệnh gán xong trước, rồi lần xóa đặt nó về trống.

## Alternatives Considered

### Ứng dụng tự đặt `category_id` về trống trước khi xóa, khóa ngoại `ON DELETE RESTRICT`
- Pros: `api` quyết được có đổi `updated_at` hay `version` không.
- Cons: hai câu lệnh; một lần gán chen giữa chúng làm lần xóa thất bại vì `RESTRICT`, hay phải khóa bảng `app.products` theo danh mục trước khi xóa.
- Rejected: `ON DELETE SET NULL` cho cùng kết quả trong một câu lệnh, và database tự lo thứ tự của hai lệnh chạy cùng lúc.

### `ON DELETE CASCADE`
- Pros: đơn giản nhất.
- Cons: xóa danh mục xóa luôn sản phẩm.
- Rejected: trái với AC8 và mục Never của SPEC.

### Bảng nối `product_categories`
- Pros: mở được đường cho một sản phẩm thuộc nhiều danh mục.
- Cons: thêm một bảng và một join ở mọi truy vấn, và cần thêm UNIQUE trên `product_id` để mỗi sản phẩm vẫn chỉ có một danh mục.
- Rejected: nhiều danh mục cho một sản phẩm nằm ngoài Scope; khi cần, một Epic sau thêm bảng nối bằng một bước expand khác.

### Cột `product_count` trên `app.categories`, giữ bằng trigger
- Pros: đọc danh sách danh mục không phải đếm.
- Cons: số lệch khi `v0.3.0` thêm hay xóa sản phẩm sau một lần rollback, vì nó không biết cột này; thêm một trigger để giữ.
- Rejected: với 200 danh mục và 10.000 sản phẩm, đếm qua index trong cùng câu SQL dưới 200 ms (NFR2).

## Consequences

- `v0.3.0` chạy đúng trên V7: Flyway của nó bỏ qua V7 (`*:future`), entity của nó không map `category_id`, nên khi nó sửa một sản phẩm thì danh mục còn nguyên, và khi nó xóa một sản phẩm thì khóa ngoại không cản. V7 không thay hay bỏ cột nào, nên không có bước contract.
- Xóa một danh mục có 5.000 sản phẩm là một UPDATE 5.000 dòng trong cùng transaction: NFR2 đòi xong trong 1 s, và integration test của Task nền đo nó.
- Sau một lần xóa danh mục, `lastmod` trong sitemap của các sản phẩm đó đổi, đúng với breadcrumb và JSON-LD mới của chúng.
- Mọi lệnh thêm và sửa sản phẩm phải đổi vi phạm khóa ngoại `products_category_fk` thành 400 trên trường `categoryId`, không phải 500 (NFR11).
- Muốn một sản phẩm thuộc nhiều danh mục, hay danh mục nhiều cấp, thì cần một ADR mới thay ADR này.
