# ADR-0002: Tìm không dấu bằng hàm `app.search_fold` và cột sinh `name_search`

> **Epic:** SHOP-7 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-7

## Status

Proposed with the plan of SHOP-7; it takes effect when you approve the plan at gate ②

## Date

2026-11-15

## Context

Hai app tìm sản phẩm theo tên mà không phân biệt chữ hoa, chữ thường hay dấu (`đ` khớp `d`), và mỗi từ của từ khóa phải khớp phần đầu của một từ trong tên (Product Rules, AC2, AC18, AC19). Ràng buộc:

- extension `unaccent` chưa có. Script trong `apps/api/docker/postgres/init` chỉ chạy trên volume mới, nên thêm extension vào database đang chạy của Development, Staging và Production cần quyền trên VPS (mục Ask first của SPEC);
- `unaccent()` là STABLE, nên không dùng thẳng được trong cột sinh hay index;
- dòng do `v0.2.0` ghi trong lúc chuyển bản hay sau rollback cũng phải tìm được (NFR17);
- tới 10.000 sản phẩm, mỗi lệnh danh sách xong trong 200 ms (NFR2).

## Decision

V4 tạo hàm SQL `app.search_fold(text)` IMMUTABLE chỉ dùng hàm có sẵn của PostgreSQL 17: `normalize(…, NFD)`, `regexp_replace` bỏ dấu kết hợp U+0300–U+036F, `translate` cho `đ` và `Đ`, `lower`, rồi thay mỗi chuỗi ký tự không phải `a–z0–9` bằng một khoảng trắng. Cột sinh `name_search TEXT GENERATED ALWAYS AS (' ' || app.search_fold(name) || ' ') STORED` giữ tên đã gấp. `api` gấp từ khóa theo cùng quy tắc bằng Java (`ProductSearchTerms`), tách thành từ, và so mỗi từ bằng `name_search LIKE '% ' || từ || '%' ESCAPE '\'` với tham số bind.

## Alternatives Considered

### Extension `unaccent`
- Pros: chuẩn của PostgreSQL, có từ điển bỏ dấu cho nhiều ngôn ngữ.
- Cons: cần quyền trên VPS cho ba database; STABLE nên phải bọc trong một hàm IMMUTABLE tự khai, vốn sai nếu từ điển đổi.
- Rejected: cần quyền agent không có, mà hàm có sẵn đã đủ cho tiếng Việt.

### Cột tên đã gấp do Java điền
- Pros: một bản cài đặt duy nhất, bằng Java.
- Cons: dòng do `v0.2.0` ghi không có giá trị, nên không tìm ra được sau rollback hay trong lúc chuyển bản.
- Rejected: không đạt NFR17.

### Full-text search (`tsvector`)
- Pros: có sẵn xếp hạng và index GIN.
- Cons: không có cấu hình tiếng Việt; vẫn cần bỏ dấu trước; quy tắc "khớp đầu từ" và ba nhóm Liên quan nhất phải viết lại bằng toán tử khác.
- Rejected: phức tạp hơn mà không gần quy tắc của SPEC hơn.

### Độ giống của `pg_trgm` (`similarity`)
- Pros: extension đã có, chịu được lỗi gõ.
- Cons: kết quả mờ, `ao` có thể ra "Bao tay", trái AC18.
- Rejected: khác quy tắc tìm của SPEC.

## Consequences

- Java và SQL phải gấp giống hệt nhau: một integration test so `ProductSearchTerms` với `app.search_fold` trên cùng bộ tên có dấu, ký hiệu và chữ hoa.
- Đổi định nghĩa của `app.search_fold` về sau không tự tính lại các giá trị đã lưu: migration đổi hàm phải bỏ và thêm lại cột `name_search`.
- `normalize()` cần database mã hóa UTF8, như database của kit.
- Không thêm index trong V4. Nếu test của NFR2 cho thấy cần, một migration sau thêm index GIN `public.gin_trgm_ops` trên `name_search`; việc đó chỉ thêm, an toàn ở mọi bản.
