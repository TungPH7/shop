# ADR-0006: Thứ tự hiển thị của danh mục là một số nguyên 0–9999, cho phép trùng

> **Epic:** SHOP-95 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-95

## Status

Proposed with the plan of SHOP-95; it takes effect when you approve the plan at gate ②

## Date

2026-11-23

## Context

Từ SHOP-81, mọi danh sách danh mục xếp theo tên, qua collation `app.vi_ci` (ADR-0005). SHOP-95 cho quản trị viên chọn danh mục nào hiện trước, bằng một số gõ trong form thêm và form sửa của `admin` (Category Rules của SPEC SHOP-95). Ba danh sách theo thứ tự mới: bảng danh mục và ô Danh mục của form sản phẩm ở `admin`, và các liên kết danh mục ở trang Sản phẩm của `user`.

Các ràng buộc:

- Kéo thả, nút lên hay xuống, đổi thứ tự nhiều danh mục một lần và tự đánh số lại đều nằm ngoài Scope. Quản trị viên sửa từng danh mục một, và mỗi lần sửa gửi `version` của danh mục đó (NFR12 của SHOP-81).
- Danh mục có sẵn và danh mục thêm mà không gửi số phải giữ thứ tự theo tên như trước Epic (AC8).
- Migration chỉ là bước expand: bản `api` trước Epic chạy đúng trên schema mới, trong lúc deploy và sau một lần rollback. Bản đó thêm và sửa danh mục mà không biết cột mới (TW1, NFR10).
- Quy mô tới 200 danh mục, mỗi danh sách trả hết trong một lệnh (NFR1).

## Decision

`app.categories` thêm cột `display_order INTEGER NOT NULL DEFAULT 0`, có CHECK `categories_display_order_range` nhận 0 tới 9999 và không có UNIQUE. Nhiều danh mục cùng số được. Mọi danh sách mà người dùng thấy xếp theo `display_order, name, id`, viết một lần trong `CategoryQueryRepository`. API gọi trường này là `displayOrder`. Một lệnh thêm không gửi số cho số 0, và một lệnh sửa không gửi số giữ số đang có.

## Alternatives Considered

### Vị trí liên tục 1…n, mỗi danh mục một số khác nhau (UNIQUE)
- Pros: thứ tự luôn rõ, không có hai danh mục cùng chỗ.
- Cons: chuyển một danh mục lên đầu phải đánh số lại mọi danh mục ở giữa, tức sửa nhiều dòng trong một lệnh. Lệnh đó đụng `version` của các danh mục khác, nên form sửa đang mở của chúng nhận 409. UNIQUE còn phải là DEFERRABLE để đổi chỗ hai danh mục. Bản `api` trước Epic thêm danh mục mà không gửi số, nên cột không thể vừa có DEFAULT vừa UNIQUE.
- Rejected: tự đánh số lại nằm ngoài Scope, và V8 không còn là bước expand mà bản trước chạy được.

### Thứ hạng dạng chữ hay số thực (fractional index, LexoRank)
- Pros: chèn vào giữa hai danh mục mà không đánh số lại; hợp với kéo thả.
- Cons: quản trị viên không gõ được một thứ hạng như vậy; cần thêm logic sinh và cân lại thứ hạng.
- Rejected: chỉ có ích khi có kéo thả, mà kéo thả nằm ngoài Scope.

### Một danh sách `id` theo thứ tự, lưu ở một bảng cài đặt hay một cột JSON
- Pros: một lần ghi đổi cả thứ tự.
- Cons: mọi lần thêm hay xóa danh mục phải sửa danh sách đó; hai quản trị viên đổi thứ tự cùng lúc ghi chồng lên nhau; SQL của các danh sách phải join theo vị trí trong mảng; bản `api` trước Epic thêm danh mục mà không đưa nó vào danh sách.
- Rejected: phức tạp hơn và không hợp với cách sửa từng danh mục của form.

### Thứ tự riêng theo từng ngôn ngữ
- Pros: mỗi ngôn ngữ một thứ tự.
- Cons: thêm một cột hay một bảng theo ngôn ngữ, và form có hai ô.
- Rejected: nằm ngoài Scope của Epic.

## Consequences

- V8 chỉ thêm một cột có DEFAULT là hằng số: PostgreSQL 17 không viết lại bảng, và không có bước contract. DEFAULT 0 là quy tắc lâu dài cho danh mục thêm mà không gửi số.
- Bản `api` trước Epic chạy đúng trên V8: danh mục nó thêm nhận 0 từ DEFAULT, và danh mục nó sửa giữ số, vì INSERT và UPDATE của entity `Category` có danh sách cột tường minh, không có `display_order`.
- Đổi thứ tự là sửa số của từng danh mục. Một lần đổi chỉ đổi `version` và `updated_at` của danh mục đó, nên `lastmod` của nó trong sitemap tiến lên (NFR13).
- Quản trị viên chừa khoảng giữa các số (như 10, 20, 30) để chèn sau này mà không phải sửa nhiều danh mục. Hai danh mục cùng số xếp theo tên, nên số trùng không phải lỗi.
- Lệnh sửa không được đặt lại số khi thiếu trường: một tab `admin` mở từ trước khi deploy gửi lệnh sửa không có `displayOrder`.
- Một Epic sau muốn kéo thả hay đánh số lại hàng loạt thì cần một ADR mới thay ADR này, kèm một bước expand khác.
- Không có index cho thứ tự: với 200 danh mục, PostgreSQL xếp trong bộ nhớ (NFR2). Epic nào thêm phân trang cho danh sách danh mục thì thêm index `(display_order, name, id)` cùng lúc.
