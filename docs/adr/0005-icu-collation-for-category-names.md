# ADR-0005: Collation ICU tiếng Việt cho tên danh mục

> **Epic:** SHOP-81 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-81

## Status

Proposed with the plan of SHOP-81; it takes effect when you approve the plan at gate ②

## Date

2026-11-21

## Context

Tên danh mục có hai quy tắc (Category Rules của SPEC SHOP-81):

- thứ tự theo tên A→Z theo cách xếp chữ tiếng Việt, không phân biệt chữ hoa, chữ thường, như "An toàn", "Áo khoác", "Ăn vặt", "Bao tay", "Dép", "Đầm", "quần" (NFR17);
- không trùng, không phân biệt chữ hoa, chữ thường nhưng phân biệt dấu: "Áo" trùng "áo", còn "Áo" và "Ao" là hai tên khác nhau (AC4, NFR14).

Database là chốt cuối cho tên trùng, vì hai lệnh thêm cùng lúc đều qua được bước kiểm của `api` (NFR11). Locale của database trên VPS quyết `lower()` và `citext` có đổi được chữ có dấu như "Á" hay không, và plan không được dựa vào nó. Hàm `app.search_fold` của ADR-0002 gộp ă với a, đ với d, nên không xếp được theo bảng chữ cái tiếng Việt. Epic không được thêm extension PostgreSQL nào (NFR13).

## Decision

Migration V7 tạo một collation ICU không tất định trong schema `app`:

```sql
CREATE COLLATION app.vi_ci (provider = icu, locale = 'vi-u-ks-level2', deterministic = false);
```

Cột `name` của `app.categories` dùng collation này, với ràng buộc `categories_name_unique UNIQUE (name)`. `ORDER BY name, id` cho thứ tự tiếng Việt, và UNIQUE so ở mức 2 của ICU: chữ hoa và chữ thường là một, còn dấu thì khác. Ngay sau đó, V7 tự kiểm collation: "Az" đứng trước "Ăn", "Dép" trước "Đầm", "áo" bằng "Áo", và "Ao" khác "Áo". Sai một điều thì V7 dừng lần deploy với một thông báo nêu điều sai, như V6 làm.

## Alternatives Considered

### `citext` cho tên, `ORDER BY app.search_fold(name), name, id`
- Pros: không cần dữ liệu ICU; giống slug.
- Cons: `citext` gấp chữ hoa theo locale của database, nên "Á" và "á" có thể là hai tên khác nhau trên VPS; thứ tự gộp ă với a và đ với d.
- Rejected: không giữ được quy tắc tên trùng một cách chắc chắn. Đây vẫn là đường lui, nếu `postgres:17-alpine` không có dữ liệu ICU của `vi` (mục Risks của plan).

### UNIQUE trên `lower(name)`, thứ tự do `api` xếp bằng `java.text.Collator`
- Pros: không đụng tới collation của database.
- Cons: `lower()` cũng theo locale của database; `admin` và `user` đọc danh sách đã xếp, nên mọi lệnh đọc phải xếp lại trong Java; một lệnh SQL viết tay sau này dễ quên.
- Rejected: hai nơi giữ một quy tắc, và database không còn là chốt cuối.

### Collation `und-u-ks-level2` (ICU gốc)
- Pros: có trong mọi bản dựng ICU.
- Cons: xếp ă như a có dấu, nên "Ăn vặt" đứng trước "Az".
- Rejected: sai thứ tự tiếng Việt của NFR17.

## Consequences

- Collation là một đối tượng của schema `app`, không phải extension. `CREATE COLLATION` chỉ cần quyền CREATE trên schema `app`, mà user của app có vì nó sở hữu schema đó (V1).
- Cột `name` không dùng được với `LIKE` hay index B-tree cho tiền tố; Epic không tìm theo tên danh mục. Một Epic muốn tìm theo tên thì thêm cột sinh như `name_search` của ADR-0002.
- Một bản PostgreSQL hay ICU mới có thể đổi thứ tự ở vài trường hợp hiếm. Khi nâng PostgreSQL, chạy `REINDEX INDEX app.categories_name_unique` và kiểm phiên bản collation (`pg_collation.collversion`), như mọi index trên collation ICU.
- `api` vẫn kiểm tên trùng trước khi ghi bằng cùng phép so (`WHERE name = :name` dùng collation của cột), và đổi vi phạm `categories_name_unique` thành 409 `CATEGORY_NAME_DUPLICATED`.
