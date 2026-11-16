# Implementation Plan: Danh mục sản phẩm

> **Epic:** SHOP-7 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-7 · **Spec:** [spec.md](spec.md) · **Design:** [design.md](design.md) · **Tasks:** tracked in Jira under SHOP-7

## Overview

Plan có bốn chặng:

1. **Design system** của `admin` và `user`, hai Task cho mỗi app, trước mọi Story có màn hình.
2. **Nền**:
   - năm sản phẩm thử trên Staging và Production (TW6);
   - schema V4 của `app.products` theo expand (TW1);
   - domain sản phẩm mới và truy vấn tìm không dấu của `api`;
   - API quản trị (thêm, danh sách, xóa), mà mọi E2E dùng để tạo và dọn dữ liệu;
   - gỡ phần sản phẩm cũ của template ở hai app (TW4, TW5).
3. **Thêm và xem**: S1 và S2 ở chế độ thêm của `admin`; S5, S6, S4, thẻ meta và sitemap của `user`.
4. **Sửa, ẩn và xóa** (US3, US4). Chúng đứng cuối vì AC9–AC12 và AC15 kiểm trang của khách.

Mỗi Story giữ mã AC của SPEC. US5 tách dọc thành hai Story và US6 thành ba, để mỗi Sub-task còn khoảng 5 file code. Bản `v0.3.0` mang cả Epic lên Production. Bước contract, bỏ cột giá cũ, ở một bản sau, sớm nhất `v0.4.0`.

Mã item trong plan (T1…T11, US1…US6c) là mã tạm. `ba` đã tạo các item ngày 2026-11-15: Task List ghi key Jira trước mã tạm, và bảng dưới cho key của mỗi mã.

| Mã | Key | Sub-task |
|---|---|---|
| T1 | SHOP-8 | Không có |
| T2 | SHOP-9 | Không có |
| T3 | SHOP-10 | Không có |
| T4 | SHOP-11 | Không có |
| T5 | SHOP-12 | Không có |
| T6 | SHOP-13 | Không có |
| T7 | SHOP-14 | Không có |
| T8 | SHOP-15 | Không có |
| T9 | SHOP-16 | Không có |
| T10 | SHOP-17 | Không có |
| T11 | SHOP-18 | Không có |
| US1 | SHOP-19 | Không có |
| US2 | SHOP-20 | Không có |
| US6a | SHOP-21 | BE SHOP-22, FE SHOP-23 |
| US6b | SHOP-24 | Không có |
| US5a | SHOP-25 | BE SHOP-26, FE SHOP-27 |
| US5b | SHOP-28 | BE SHOP-29, FE SHOP-30 |
| US6c | SHOP-31 | BE SHOP-32, FE SHOP-33 |
| US3 | SHOP-34 | BE SHOP-35, FE SHOP-36 |
| US4 | SHOP-37 | Không có |

## Architecture Decisions

1. **Expand/contract cho `app.products`, đồng bộ cột giá cũ bằng trigger** (ADR-0001). V4 thêm cột mới, chuyển dữ liệu cũ, và tạo một trigger `BEFORE INSERT OR UPDATE` giữ hai cột giá khớp nhau theo cả hai chiều, nên `v0.2.0` chạy đúng trên schema mới, lúc chuyển bản và sau rollback. Entity của `v0.3.0` không map cột `price` cũ, nên bước contract chỉ là một migration, không đổi Java.
2. **Tìm không dấu bằng hàm `app.search_fold` IMMUTABLE và cột sinh `name_search`** (ADR-0002), không dùng `unaccent`. Java gấp từ khóa theo đúng quy tắc của hàm, và một test so hai bên trên cùng bộ tên.
3. **Hai nhóm endpoint: `/api/admin/products` cho quản trị; `/api/products` và `/api/sitemap/products` cho khách** (ADR-0003). Nhóm của khách luôn lọc Đang bán và không có tham số trạng thái (NFR9). Epic đăng nhập về sau chỉ cần chặn `/api/admin/**`.
4. **API quản trị là phần nền, làm thành hai Task trước các Story** (T8, T9). Mọi E2E, kể cả của `user`, tạo và dọn sản phẩm qua `POST` và `DELETE /api/admin/products` (Testing Strategy, NFR23), nên các endpoint này phải có trước Story đầu tiên. Vì vậy US1, US2, US4 và US6b chỉ có phần `fe-dev`, còn US3, US5a, US5b, US6a và US6c có Sub-task BE cho endpoint riêng của chúng. API không có host công khai (NFR8). Bạn duyệt ngoại lệ "Task làm API" này cùng plan ở gate ②, để `reviewer` không đòi đổi T8, T9 thành Story.
5. **Kiểu dữ liệu giữa Java và TypeScript.** Monorepo không có gói type dùng chung: `api` là Java, và NFR13 không cho thêm dependency như trình sinh type từ OpenAPI. Hợp đồng nằm ở mục API Contract dưới đây. WebMvc test của `api` kiểm đúng tên trường của từng phản hồi; schema Zod của `admin` và `user` có unit test với các payload ví dụ ở đó; E2E chạy trên `api` thật. OpenAPI ở `/v3/api-docs` mô tả từng endpoint mới (Success Criteria).
6. **Truy vấn danh sách bằng SQL viết tay qua `JdbcClient`** (T7), vì cần cột sinh, `LIKE … ESCAPE`, nhóm Liên quan nhất bằng `CASE` và khóa cuối `id`. Mỗi lệnh danh sách chạy đúng hai câu SQL, một trang và tổng số (NFR2). `ORDER BY` chọn từ một enum cố định, và từ khóa chỉ đi vào tham số bind (NFR10).
7. **Giá ở biên API.** Trường giá của thân request đọc thành `BigDecimal` và kiểm bằng Bean Validation (`@Digits(integer = 9, fraction = 0)`, `@Min(1)`, `@Max(999_999_999)`), rồi đổi sang `long` bằng `longValueExact()`. Nhờ vậy `450000.5` là một lỗi trường, nằm cùng danh sách với các lỗi khác (AC7: nêu từng trường sai), thay vì Jackson cắt còn `450000` hay báo lỗi cả thân. Sau biên, giá là `long` trong Java và `BIGINT` trong database (NFR14).
8. **Mốc 60 giây** (NFR7). Profile `catalog` của `cacheLife` trong `apps/user/next.config.ts` là `{ stale: 30, revalidate: 10, expire: 25 }`. Server không phục vụ dữ liệu cũ hơn 25 s (`expire`), và cache router của trình duyệt giữ tối đa 30 s (`stale`, cũng là mức tối thiểu Next 16.4.6 cho phép), nên cộng lại tối đa 55 s. Vì `expire` dưới 5 phút, phần dữ liệu thành "dynamic hole" không có trong prerender (docs `cacheLife` của Next 16.4.6, mục Prerendering behavior). Vì vậy mọi phần đọc sản phẩm, kể cả phần đọc `params` của trang chi tiết, nằm trong `<Suspense>`, và `pnpm run build` không gọi `api`.
9. **404 thật của trang chi tiết đặt ở Proxy** (AC26, NFR9, NFR26). Với Cache Components, Next 16.4.6 gửi shell với mã 200 trước khi trang chạy, nên `notFound()` trong trang không đổi được mã nữa (docs `loading.md`, mục Status codes). `apps/user/src/proxy.ts` kiểm slug bằng `HEAD /api/products/{slug}`, thời hạn 5 s, trước khi render. Nó chỉ kiểm yêu cầu tải trang (không có header `RSC`), vì mã HTTP chỉ có nghĩa ở đó, và nhờ vậy prefetch của 24 thẻ không thành 24 lệnh tới `api`. Kết quả:
   - 200: chuyển tiếp cho middleware của next-intl như hiện nay;
   - 404: rewrite sang route `/[locale]/product-not-found`. Route này gọi `notFound()` lúc prerender, nên giữ mã 404 và hiện S6;
   - lỗi khác hay hết giờ: trả 503, `Retry-After: 30`, `Cache-Control: no-store`, với một trang lỗi ngắn theo ngôn ngữ của đường dẫn.

   Điều hướng phía client (có header `RSC`) đi thẳng vào trang: DAL trả `null` thì trang gọi `notFound()` và hiện cùng S6. E2E của AC26 kiểm `response.status()` là 404 trên bản build (`next build` rồi `next start`) và trên Development.
10. **Xem thêm là điều hướng, không phải fetch phía client.** Bấm Xem thêm (S4.10) gọi `router.replace` với `page + 1` trong một transition (`scroll: false`). Server render lại `page × 24` sản phẩm, rồi focus chuyển tới thẻ mới đầu tiên. URL luôn là nguồn sự thật, nên tải lại hay mở ở tab khác cho đúng các sản phẩm đã xem (AC22), và trình duyệt không cần route hay thư viện mới (NFR4, NFR8). DAL đọc `page × 24` sản phẩm theo từng khối 96 (dưới 100, NFR3), bỏ sản phẩm trùng `id` giữa các khối (NFR18), và dừng ở tổng số sản phẩm Đang bán. Vì vậy `page=999999` chỉ đọc tới hết danh mục (NFR3).
11. **Tham số trên URL.**
    - `user`: `/[locale]/products?q=&sort=newest|price-asc|price-desc|relevance&page=N`. `page` là số lần đã tải, mỗi lần 24, mặc định 1 và không ghi vào URL.
    - `admin`: `/products?q=&status=all|active|hidden&page=N`, và gửi `offset = (page − 1) × 20`.
    - Giá trị sai thì dùng mặc định, không báo lỗi (AC22, S1.11).
    - Đường dẫn của S2 chốt là `/products/new` và `/products/:productId/edit`, ngoài `ProtectedRoute`.
12. **Đường dẫn tới `api` từ `user`.** `request()` của `apps/user/src/lib/http/client.ts` dựng URL bằng `new URL(path, env.API_URL)`, và mọi đường dẫn sản phẩm bắt đầu bằng `/api/`. Nhờ vậy URL đúng dù `API_URL` có hay không có `/api` ở cuối. Mọi lệnh có thời hạn 5 s (`AbortSignal.timeout`, NFR26). Không đổi biến môi trường nào (NFR27).

    Ngày 2026-11-15 bạn đồng ý: `API_URL` của `user` trên ba môi trường được coi là trỏ tới `api` nội bộ, như `http://api:3001`, nên Epic không đổi secret nào. E2E đầu tiên của `user` trên Development (US6a) kiểm điều đó. Nếu nó cho thấy `API_URL` còn trỏ tới API NestJS cũ, `fe-dev` đánh dấu US6a "Needs you", vì đổi secret trên VPS cần quyền agent không có, và bạn đổi secret đó trước gate ④.
13. **`admin` không tự thử lại lệnh ghi** (NFR19). `apps/admin/src/lib/api/retry.ts` chỉ thử lại GET, HEAD và OPTIONS. `DELETE` của API idempotent (204 kể cả khi sản phẩm đã không còn), nên một lần xóa đã thành công mà mất phản hồi không thành lỗi giả.
14. **Design system bằng CSS variables và CSS thường**, không thêm Tailwind hay thư viện UI (NFR13).
    - Font là Be Vietnam Pro 500, 600 và 700, subset `latin`, `latin-ext` và `vietnamese` (Tech Stack): `user` qua `next/font/google`, `admin` qua `@fontsource/be-vietnam-pro` 5.3.0 ghim đúng phiên bản, kèm font dự phòng có `size-adjust` (NFR5).
    - Gỡ nút "thanh bên" demo và `<aside>` của nó khỏi khung trang của `admin`: `design.md` để `ba` hay `sa` quyết việc này. S1 và S2 không có nó, và nó chỉ là demo của template.
15. **Ô giữ chỗ giống nhau ở hai app.** Màu nhóm là `GROUPS[parseInt(id.slice(-8), 16) % 6]` với `GROUPS = [blue, coral, green, orange, teal, ink]`: 8 ký tự hex cuối của UUIDv7 là phần ngẫu nhiên. Chữ trên ô là ký tự đầu của tên đã bỏ khoảng trắng, qua `toLocaleUpperCase('vi')`. Đổi tên hay slug không đổi màu (`design.md`, component Ô giữ chỗ).
16. **Dữ liệu của E2E** (NFR23).
    - Tên mỗi sản phẩm E2E chứa hai từ `E2E <runId>`, với `runId` là 6 ký tự ngẫu nhiên của lần chạy. Hai từ này là "tiền tố" của NFR23, nhưng đặt ở cuối tên, để các tên của test thứ tự Liên quan nhất (AC19) vẫn bắt đầu bằng từ khóa.
    - Trước khi chạy, helper tìm `e2e` qua API quản trị và xóa sản phẩm E2E tạo cách đây hơn 1 giờ.
    - Test đếm (AC4, AC21) tìm theo `e2e <runId>`, để chỉ thấy sản phẩm của lần chạy đó. Test thứ tự chỉ kiểm thứ tự tương đối của các sản phẩm của nó.
    - Mỗi app có helper `e2e/support/products.ts`. Helper của `user` gọi `/api` của `admin` (`E2E_ADMIN_URL`), với basic auth chỉ cho origin đó.

Không đổi: stack và phiên bản như Tech Stack của SPEC, `deploy.yaml`, secret và biến môi trường. `api` đang ở Spring Boot 4.0.9 theo `apps/api/pom.xml` (SPEC ghi 4.0.6), và Epic không đổi bản này.

## Database Changes

### `v0.3.0`: V4, bước expand

File `apps/api/src/main/resources/db/migration/V4__expand_products_catalog.sql` (T6), một transaction. Không sửa V1–V3.

| Thay đổi | Chi tiết |
|---|---|
| Cột `price_vnd BIGINT NOT NULL` | Giá bán, đồng. Dòng cũ nhận `round(price)::bigint`. |
| Cột `compare_at_price_vnd BIGINT` | Giá gốc, có thể NULL. Dòng cũ để NULL. |
| Cột `status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'` | `ACTIVE` hay `HIDDEN`. Dòng cũ có giá làm tròn bằng 0 hay lớn hơn 999.999.999 thành `HIDDEN` (Product Rules, NFR16). |
| Cột `availability VARCHAR(16) NOT NULL DEFAULT 'IN_STOCK'` | `IN_STOCK` hay `OUT_OF_STOCK`. Mọi dòng cũ là `IN_STOCK`. |
| Hàm `app.search_fold(text)` | `IMMUTABLE STRICT PARALLEL SAFE`: `normalize(…, NFD)`, bỏ U+0300–U+036F, `translate` `đĐ` thành `dd`, `lower`, đổi mỗi chuỗi ký tự không phải `a–z0–9` thành một khoảng trắng, rồi bỏ khoảng trắng ở đầu và cuối. |
| Cột sinh `name_search TEXT GENERATED ALWAYS AS (' ' \|\| app.search_fold(name) \|\| ' ') STORED` | Hai khoảng trắng bao ngoài để "khớp đầu một từ" là `LIKE '% <từ>%'`. Cột tự điền cho cả dòng do `v0.2.0` ghi. |
| CHECK `products_price_vnd_valid` | `price_vnd >= 0 AND (status = 'HIDDEN' OR price_vnd BETWEEN 1 AND 999999999)`. NFR15 ("giá 0 chỉ có ở sản phẩm Ẩn") và NFR16 (giá cũ lớn hơn 999.999.999 được giữ và thành Ẩn) cùng đúng: sản phẩm Đang bán luôn có giá hợp lệ. |
| CHECK `products_compare_at_price_valid` | `compare_at_price_vnd IS NULL OR (compare_at_price_vnd > price_vnd AND compare_at_price_vnd <= 999999999)`. |
| CHECK `products_status_valid`, `products_availability_valid` | Chỉ các giá trị ở trên. |
| Hàm `app.products_sync_legacy_price()` và trigger `trg_products_sync_legacy_price` | `BEFORE INSERT OR UPDATE ... FOR EACH ROW`, theo bảng dưới. |
| Giữ nguyên | `price NUMERIC(12,2) NOT NULL` và CHECK `products_price_non_negative`; `name VARCHAR(255)`, vì tên cũ dài hơn 150 ký tự được giữ và `api` kiểm 150 khi lưu; `description TEXT`; `slug citext` với UNIQUE `products_slug_unique`; index và trigger `updated_at` của V3. |
| Không thêm index | 10.000 dòng quét tuần tự trong vài ms; test của NFR2 quyết. Nếu cần, một migration sau thêm index GIN `public.gin_trgm_ops` trên `name_search`. Việc đó chỉ thêm, nên an toàn ở mọi bản. |

Thứ tự trong file:

1. Thêm bốn cột, với `price_vnd` tạm cho phép NULL.
2. Tắt `trg_products_set_updated_at`, điền dữ liệu cũ, rồi bật lại trigger đó. Nhờ vậy lần chuyển dữ liệu không đổi `updated_at`, vốn là `lastmod` của sitemap.
3. `SET NOT NULL` cho `price_vnd`, rồi thêm các CHECK.
4. Tạo hàm `app.search_fold` và cột sinh `name_search`.
5. Tạo hàm và trigger đồng bộ.
6. Ghi một dòng vào `app._app_migration_log`.

Cả file là một transaction, nên khóa của `ALTER TABLE` đầu tiên giữ tới khi file xong: integration test đo cả file với 10.000 dòng, dưới 10 s (NFR17).

Trigger đồng bộ:

| Lệnh | Ai ghi | Nhận ra bằng | Trigger làm |
|---|---|---|---|
| INSERT | `v0.2.0` | `price_vnd` là NULL | `price_vnd := round(price)`; giá đó bằng 0 hay lớn hơn 999.999.999 thì `status := 'HIDDEN'` |
| INSERT | `v0.3.0` | `price` là NULL, vì entity không map cột này | `price := price_vnd` |
| UPDATE | `v0.3.0` | `price_vnd` đổi | `price := price_vnd` |
| UPDATE | `v0.2.0` (`PUT …/price`, `bulk-price`) | `price` đổi, `price_vnd` không đổi | `price_vnd := round(price)`; đặt `HIDDEN` như INSERT; giá gốc không còn lớn hơn giá mới thì `compare_at_price_vnd := NULL`, vì `v0.2.0` không biết giá gốc |
| UPDATE | lệnh khác (tên, trạng thái…) | không cột giá nào đổi | không làm gì |

NOT NULL và CHECK được kiểm sau trigger `BEFORE`, nên các lệnh trên qua được. Sản phẩm thành Ẩn vì giá vẫn Ẩn khi `v0.2.0` sửa lại giá cho hợp lệ: quản trị viên tự đổi nó về Đang bán.

Kiểm (T6), bằng Testcontainers PostgreSQL 17:

- dựng schema V3 với dữ liệu giống Production: năm sản phẩm của T5, cộng giá 9.999.999.999,99, giá có phần lẻ như 199.999,50, tên 255 ký tự và slug `-a--b-`. Chạy V4, rồi kiểm từng dòng theo Product Rules và NFR16, và `updated_at` không đổi;
- toàn bộ test sản phẩm đang có, tức code của `v0.2.0` (thêm, `updatePrice`, `bulkUpdatePriceBySlug`, `ddl-auto: validate`), chạy không sửa trên V4, cộng phần kiểm các cột mới sau mỗi lệnh ghi;
- Flyway chỉ với V1–V3, như bản `v0.2.0`, `validate()` được trên database đã có V4. `application*.yml` không đặt `ignore-migration-patterns`, nên mặc định `*:future` áp dụng;
- sau T7, một integration test ghi bằng entity mới rồi đọc cột `price` bằng SQL, và thấy nó bằng `price_vnd`: sau rollback, `v0.2.0` đọc đúng giá.

### `v0.3.0`: V5 và V6, `app.gen_uuid_v7()` với `search_path` chỉ có `app`

Server kết nối với `currentSchema=app`, nên `search_path` chỉ có `app`, còn `pgcrypto` và `citext` nằm ở schema `public`.

- `V5__gen_uuid_v7_qualify_pgcrypto.sql` (SHOP-44) thay `app.gen_uuid_v7()` bằng hàm cùng chữ ký gọi `public.gen_random_bytes()`. Không sửa file này: Flyway kiểm checksum của nó.
- `V6__assert_pgcrypto_in_public.sql` (SHOP-50) không đổi schema. Nó kiểm `public.gen_random_bytes(integer)` có, rồi gọi `app.gen_uuid_v7()` một lần. Thân hàm `plpgsql` chỉ được phân giải khi gọi, nên trên một database có `pgcrypto` ở schema khác, V5 vẫn chạy xong; V6 dừng lần deploy đó, với thông báo nêu schema của `pgcrypto`.
- Truy vấn trên `slug` gọi toán tử của `citext` tường minh, `OPERATOR(public.=)`: với `search_path` chỉ có `app`, `=` thường so sánh như `text`, phân biệt hoa thường và không dùng index `products_slug_unique`. Test Spring cũng kết nối với `currentSchema=app`, như server.

Rollback: `v0.2.0` và các bản `v0.3.0` trước V5 không biết V5 và bỏ qua nó; các bản trước V6 cũng bỏ qua V6 (mặc định `*:future` của Flyway). V5 giữ chữ ký của hàm và chỉ làm hàm chạy được với nhiều `search_path` hơn, V6 không đổi gì, nên không bản nào cần gỡ V5 hay V6. Comment Rollback trong file V5 ghi "v0.2.0 and v0.3.0 do not know V5 and ignore it": sai, vì V5 nằm trong `v0.3.0`; câu đúng là câu ở trên.

### Bản sau, sớm nhất `v0.4.0`: bước contract

Khi `v0.3.0` đã chạy ổn trên Production và không còn cần rollback về `v0.2.0` (NFR22), một migration (số kế tiếp, từ V7) bỏ:

- trigger `trg_products_sync_legacy_price` và hàm `app.products_sync_legacy_price()`;
- CHECK `products_price_non_negative`;
- cột `price`.

Java không đổi, vì entity của `v0.3.0` đã không map cột này, nên rollback từ bản đó về `v0.3.0` vẫn đúng. Việc này không thuộc Epic SHOP-7: `ba` tạo một Task riêng cho bản đó, và bạn duyệt Task đó khi lên kế hoạch bản đó.

## API Contract

Chung cho mọi endpoint dưới đây:

```ts
type ProductStatus = 'ACTIVE' | 'HIDDEN';
type ProductAvailability = 'IN_STOCK' | 'OUT_OF_STOCK';
type Uuid = string;     // UUIDv7
type Instant = string;  // ISO-8601 UTC, như "2026-11-15T03:22:11.123Z"

interface Page<T> {
  items: T[];
  totalItems: number;   // tổng số khớp bộ lọc, không phải số của trang
  offset: number;       // như request
  limit: number;        // như request
}
```

- **Giá** (`price`, `compareAtPrice`) là số nguyên đồng. `price` của một sản phẩm Ẩn có từ trước Epic có thể bằng 0 hay lớn hơn 999.999.999 (NFR16).
- **Lỗi** là Problem Details như `api` đang làm: `type`, `title`, `status`, `detail`, `instance`, `code`, `timestamp`, `correlationId`. Lỗi kiểm thân có thêm `errors: { field: string; rejectedValue: unknown; message: string }[]`; lỗi tham số có thêm `parameter`. Không có stack trace, SQL hay tên ràng buộc (NFR12). FE rẽ nhánh theo `status` và `code`, không theo `message`.
- **Từ khóa `q`**, cả hai nhóm endpoint:
  - bỏ khoảng trắng ở đầu và cuối, gộp các khoảng trắng liền nhau, cắt ở 100 ký tự, rồi gấp như `app.search_fold`;
  - mỗi chuỗi `a–z0–9` là một từ; từ trùng bị bỏ;
  - `q` trống sau khi bỏ khoảng trắng là không tìm;
  - `q` không trống mà không có từ nào, như `%` hay `!!!`, thì không khớp sản phẩm nào, để `%` hay `_` không ra mọi sản phẩm (NFR10);
  - một sản phẩm khớp khi mọi từ khớp đầu một từ của tên: `name_search LIKE '% ' || từ || '%' ESCAPE '\'`, với `%`, `_` và `\` của từ đã được thoát.
- **Thứ tự.** Khóa cuối luôn là `id DESC` (NFR18).
  - `NEWEST`: `created_at DESC`.
  - `PRICE_ASC`: `price_vnd ASC, created_at DESC`. `PRICE_DESC`: `price_vnd DESC, created_at DESC`.
  - `RELEVANCE`: nhóm, rồi `created_at DESC`. Với cụm `p` là các từ nối bằng một khoảng trắng: nhóm 1 khi `name_search LIKE ' ' || p || '%'`, nhóm 2 khi `name_search LIKE '% ' || p || '%'`, còn lại là nhóm 3.
- **Tham số sai** (sai kiểu, ngoài enum, `offset` âm, `limit` ngoài khoảng) trả 400 `INVALID_PARAMETER` kèm `parameter` (NFR3). Tham số lạ bị bỏ qua.
- **Độ dài chuỗi** tính bằng đơn vị UTF-16, tức `String.length()` của Java và `.length` của JavaScript, để form và `api` đếm như nhau.

### API quản trị: `/api/admin/products`

Đi qua `/api/*` của host `admin`, sau basic auth của VPS. Dùng bởi `admin` (US1–US4) và helper E2E của hai app.

```ts
interface AdminProductSummary {
  id: Uuid;
  name: string;
  slug: string;
  price: number;
  status: ProductStatus;
  availability: ProductAvailability;
  createdAt: Instant;
  updatedAt: Instant;
}

interface AdminProduct extends AdminProductSummary {
  description: string | null;
  compareAtPrice: number | null;
  version: number;                    // gửi lại khi sửa (AC13)
}

interface CreateProductInput {
  name: string;                       // bỏ khoảng trắng đầu và cuối, rồi 1–150 ký tự
  slug?: string | null;               // vắng hay null: api sinh từ tên, thêm -2, -3… khi trùng
  description?: string | null;        // tối đa 5.000 ký tự; chuỗi rỗng hay chỉ có khoảng trắng lưu là null
  price: number;                      // số nguyên 1–999.999.999
  compareAtPrice?: number | null;     // số nguyên lớn hơn price, tối đa 999.999.999
  status?: ProductStatus;             // mặc định ACTIVE
  availability?: ProductAvailability; // mặc định IN_STOCK
}

interface UpdateProductInput {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  status: ProductStatus;
  availability: ProductAvailability;
  version: number;
}
```

| Endpoint | Item | Thành công | Lỗi |
|---|---|---|---|
| `GET /api/admin/products?q=&status=ALL\|ACTIVE\|HIDDEN&offset=0&limit=20` | T9, dùng ở US1 | 200 `Page<AdminProductSummary>`, thứ tự `NEWEST`. `status` mặc định `ALL`; `limit` 1–100 | 400 `INVALID_PARAMETER` |
| `POST /api/admin/products`, thân `CreateProductInput` | T8, dùng ở US2 | 201 `AdminProduct`, header `Location: /api/admin/products/{id}` | 400 `VALIDATION_FAILED` kèm `errors`, mọi trường sai trong một phản hồi; 409 `PRODUCT_SLUG_DUPLICATED` khi slug tự gõ đã có, không phân biệt chữ hoa |
| `GET /api/admin/products/{id}` | US3 | 200 `AdminProduct`, cả sản phẩm Ẩn | 400 `INVALID_PARAMETER` khi `id` không phải UUID; 404 `PRODUCT_NOT_FOUND` |
| `PUT /api/admin/products/{id}`, thân `UpdateProductInput` | US3 | 200 `AdminProduct` với `version` mới | 400 `VALIDATION_FAILED` kèm `errors`; 404 `PRODUCT_NOT_FOUND`; 409 `PRODUCT_SLUG_DUPLICATED`; 409 `OPTIMISTIC_LOCK_CONFLICT` khi `version` khác bản trong database |
| `DELETE /api/admin/products/{id}` | T9, dùng ở US4 | 204, kể cả khi sản phẩm đã không còn | 400 `INVALID_PARAMETER` |

Quy tắc của lệnh ghi:

- **Kiểm** theo Product Rules bằng Bean Validation trên DTO. "Giá gốc lớn hơn giá bán" là một constraint cấp lớp, báo lỗi ở trường `compareAtPrice`, nên nằm cùng danh sách `errors`.
- **Slug khi thêm.** Có `slug` thì nó phải theo định dạng `^[a-z0-9]+(?:-[a-z0-9]+)*$` và dài tối đa 100 ký tự; trùng thì 409. Không có thì `api` sinh slug từ tên như Product Rules, bằng `java.text.Normalizer`:
  - slug sinh ra rỗng, khi tên chỉ có ký hiệu, thì dùng `san-pham`;
  - slug đã có thì thử `-2`, `-3`…, và cắt phần gốc để cả slug không quá 100 ký tự;
  - hai lần thêm cùng lúc ra cùng slug: lần thua gặp ràng buộc UNIQUE và thử lại với số kế tiếp, tối đa 3 lần (NFR12: UNIQUE là chốt cuối).
- **Slug khi sửa** là bắt buộc. Bằng slug đang lưu, không phân biệt chữ hoa, thì không kiểm định dạng, để một sản phẩm cũ có slug sai định dạng vẫn lưu được (NFR16). Khác slug đang lưu thì kiểm định dạng (400, lỗi ở trường `slug`) và kiểm trùng (409).
- **Sửa** luôn đòi giá 1–999.999.999, nên sản phẩm cũ giá 0 phải có giá mới khi được lưu lại (Product Rules). `version` khác bản trong database thì trả 409 và không ghi gì (AC13). Hai lệnh sửa cùng lúc với cùng `version` thì `@Version` của Hibernate chặn lệnh thứ hai, cũng là 409.
- **Log** INFO cho mỗi lần thêm, sửa và xóa: thao tác, `id`, slug, correlation id. Không ghi mô tả, thân request hay header `Authorization` (NFR12).

Ví dụ `AdminProduct`, để unit test của schema Zod ở `admin` parse:

```json
{
  "id": "019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f",
  "name": "Áo thun cổ tròn",
  "slug": "ao-thun-co-tron",
  "description": "Áo thun cotton 100%.\nCổ tròn, tay ngắn.",
  "price": 200000,
  "compareAtPrice": 250000,
  "status": "ACTIVE",
  "availability": "IN_STOCK",
  "createdAt": "2026-11-16T02:10:00.000Z",
  "updatedAt": "2026-11-16T02:15:30.000Z",
  "version": 1
}
```

Ví dụ lỗi 400 của `POST` (AC7):

```json
{
  "type": "https://docs.example.com/errors/VALIDATION_FAILED",
  "title": "Validation failed",
  "status": 400,
  "detail": "Validation failed for 2 field(s).",
  "instance": "/api/admin/products",
  "code": "VALIDATION_FAILED",
  "timestamp": "2026-11-16T02:10:00.000Z",
  "correlationId": "4b1f0c2a-…",
  "errors": [
    { "field": "name", "rejectedValue": "", "message": "…" },
    { "field": "price", "rejectedValue": 450000.5, "message": "…" }
  ]
}
```

Cách `admin` hiện lỗi:

- 400: đặt lỗi dưới ô theo `field`. Form đã kiểm trước theo cùng quy tắc, nên đây là chốt dự phòng.
- 409 `PRODUCT_SLUG_DUPLICATED`: "Slug này đã được dùng" dưới ô slug (S2.7).
- 409 `OPTIMISTIC_LOCK_CONFLICT`: banner xung đột của S2.5.
- 404 khi sửa: trạng thái not-found của S2.3.
- Lỗi mạng, hết giờ hay 5xx: "Không lưu được. Vui lòng thử lại." (S2.5), hay lỗi của S3.6 khi xóa.

### API của khách: `/api/products` và `/api/sitemap/products`

Chỉ server của `user` gọi, qua `API_URL`, và chỉ bằng GET và HEAD (NFR8). Mọi lệnh chỉ thấy sản phẩm `ACTIVE`. Không có tham số trạng thái, và `?status=HIDDEN` bị bỏ qua (NFR9).

```ts
interface StoreProductSummary {
  id: Uuid;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  availability: ProductAvailability;
}

interface StoreProduct extends StoreProductSummary {
  description: string | null;
  updatedAt: Instant;
}

interface SitemapEntry {
  slug: string;
  updatedAt: Instant;
}
```

| Endpoint | Item | Thành công | Lỗi |
|---|---|---|---|
| `GET /api/products/{slug}`, và `HEAD` cùng đường dẫn | US6a | 200 `StoreProduct`; `HEAD` không có thân | 404 `PRODUCT_NOT_FOUND` với `detail` "Product not found.", cùng một thân (trừ `instance`, `timestamp`, `correlationId`) cho slug chưa từng có, sản phẩm Ẩn và sản phẩm đã xóa |
| `GET /api/products?offset=0&limit=24` | US5a | 200 `Page<StoreProductSummary>`, thứ tự `NEWEST`; `limit` 1–100 | 400 `INVALID_PARAMETER` |
| `GET /api/products?q=&sort=NEWEST\|PRICE_ASC\|PRICE_DESC\|RELEVANCE&offset=&limit=` | US5b thêm `q` và `sort` | 200 như trên. `sort` mặc định `RELEVANCE` khi `q` có từ, ngược lại `NEWEST` | 400 `INVALID_PARAMETER`, kể cả `RELEVANCE` khi không có `q` |
| `GET /api/sitemap/products?offset=0&limit=1000` | US6c | 200 `Page<SitemapEntry>`, thứ tự `id`; `limit` 1–1000 | 400 `INVALID_PARAMETER` |

Slug được so không phân biệt chữ hoa (`citext`), và trang của khách đặt canonical theo slug đang lưu. Đường dẫn sitemap nằm ngoài `/api/products/`, để không đụng một sản phẩm có slug `sitemap`.

Ví dụ `StoreProduct`, để unit test của schema Zod ở `user` parse:

```json
{
  "id": "019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f",
  "name": "Áo thun cổ tròn",
  "slug": "ao-thun-co-tron",
  "price": 200000,
  "compareAtPrice": 250000,
  "availability": "IN_STOCK",
  "description": "Áo thun cotton 100%.\nCổ tròn, tay ngắn.",
  "updatedAt": "2026-11-16T02:15:30.000Z"
}
```

Cách `user` dùng: 404 của lệnh chi tiết thì DAL trả `null`. 5xx, lỗi mạng hay hết 5 s thì DAL ném lỗi, không bao giờ coi như danh sách trống (NFR26). Phần trăm giảm do FE tính bằng `discountPercent` (Code Style); `api` không trả nó.

## Task List

Mỗi item ghi AC, khối của `design.md`, NFR, file code dự kiến (không tính file test, file i18n JSON và file bị xóa) và item phụ thuộc. Mỗi role có WIP 1, nên `be-dev` làm T6–T9 song song với chặng 1 của `fe-dev`. E2E của `admin` ở `apps/admin/e2e/`, mỗi Story một file thay cho `product-crud.spec.ts`; E2E của `user` ở `apps/user/e2e/`. Mọi E2E dùng helper `e2e/support/products.ts` của app đó (Architecture Decisions, mục 16).

### Phase 1: Design system

- [ ] SHOP-8 (T1): Design system của admin (1/2): token, font, khung trang · fe-dev
  - Token sáng và tối của bảng Design System: màu, chữ, khoảng cách, bo góc, bóng, kính, chuyển động. Mặc định theo giao diện của hệ thống; nút đổi giao diện đặt `data-theme`.
  - Be Vietnam Pro qua `@fontsource/be-vietnam-pro` 5.3.0, ghim, OFL-1.1, lý do ghi trong mô tả PR; font dự phòng có `size-adjust`.
  - Class CSS cho nút chính, phụ và nguy hiểm, huy hiệu, thẻ kính, ô nhập, bảng, banner, khung xương.
  - Khung trang S1.1 (ba viên thuốc); gỡ nút "thanh bên" demo (mục 14). Viết `docs/design-system/admin.md`.
  - NFR5, NFR13. File: `apps/admin/src/styles/tokens.css` (mới), `src/styles/components.css` (mới), `src/styles/global.css`, `src/main.tsx`, `src/app/layouts/root-layout.tsx`.
  - Phụ thuộc: không.
- [ ] SHOP-9 (T2): Design system của admin (2/2): component · fe-dev
  - Component có hành vi, dùng token của T1, mỗi component có test cho các trạng thái của nó:
    - Field: nhãn, gợi ý, lỗi gắn `aria-describedby`, bộ đếm; ô nhập, vùng văn bản, ô chọn;
    - SegmentedControl: kiểu lọc với `aria-pressed` cho S1.4; kiểu chọn là nhóm radio trong `fieldset` cho S2.11 và S2.12;
    - Pagination (S1.11);
    - Dialog: `<dialog>` với `showModal()`, `role=alertdialog`, focus đầu ở nút an toàn, Esc như Hủy, trả focus khi đóng;
    - Toast: giao diện mới cho `notifications.tsx`, ở đáy giữa, 6 s, dừng khi rê chuột hay có focus;
    - PlaceholderTile (mục 15).
  - Cập nhật `docs/design-system/admin.md`.
  - File: `apps/admin/src/components/ui/field.tsx`, `ui/segmented-control.tsx`, `ui/pagination.tsx`, `ui/dialog.tsx`, `ui/placeholder-tile.tsx` (đều mới), `src/components/feedback/notifications.tsx`. Sáu file, đều là component trình bày nhỏ.
  - Phụ thuộc: SHOP-8 (T1).
- [ ] SHOP-10 (T3): Design system của user (1/2): token, font, component · fe-dev
  - Giữ tên các vai trò semantic của `tokens.css` (OKLCH), đổi giá trị theo bảng Design System, cả sáng lẫn tối.
  - Be Vietnam Pro qua `next/font/google` thay Inter: 500, 600, 700; `latin`, `latin-ext`, `vietnamese`; `display: 'swap'`; font dự phòng chỉnh cỡ.
  - Class CSS cho nút, huy hiệu, thẻ kính, ô "well", ô nhập, ô chọn, khung xương; PlaceholderTile (mục 15).
  - Viết `docs/design-system/user.md`. `fe-dev` đối chiếu bằng chrome-devtools các giá trị "ước lượng" của `design.md` với trang mẫu, và ghi số đo vào file đó.
  - NFR5, NFR13 (CSP giữ `font-src 'self'`). File: `apps/user/src/styles/tokens.css`, `src/styles/components.css` (mới), `src/config/fonts.ts`, `src/app/globals.css`, `src/components/ui/placeholder-tile.tsx` (mới).
  - Phụ thuộc: không.
- [ ] SHOP-11 (T4): Design system của user (2/2): khung trang · fe-dev
  - Thanh điều hướng S4.1, dùng cho mọi trang của `user`: Trang chủ, Sản phẩm, Giới thiệu; tài khoản, VI/EN, Sáng/Tối/Hệ thống; hai hàng dưới 768 px, không có menu ẩn. Chân trang S4.11. Ở 320 px không có thanh cuộn ngang.
  - File: `apps/user/src/app/[locale]/layout.tsx`, `src/features/site/components/site-nav.tsx` (mới), `src/components/language-switcher.tsx`, `src/components/theme-switcher.tsx`, `src/features/site/components/site-footer.tsx`.
  - Phụ thuộc: SHOP-10 (T3).

### Checkpoint: Design system
- [ ] `docs/design-system/admin.md` và `docs/design-system/user.md` có mọi dòng "mới" của bảng Design System, với giá trị đã đối chiếu.
- [ ] axe (WCAG A/AA) không báo vi phạm ở trang chủ và trang Giới thiệu của hai app, sáng lẫn tối; build, lint, typecheck xanh.

### Phase 2: Nền

- [ ] SHOP-12 (T5): Năm sản phẩm thử trên Staging và Production (TW6) · devops · effort xhigh: ghi lên Production đang chạy, bằng basic auth của host `shop-admin`.
  - Sau gate ② và trước gate ④ của `v0.3.0`, thêm năm sản phẩm dưới đây qua `POST /api/products` của `v0.2.0`, qua `/api` của `shop-admin-staging` rồi của `shop-admin`. Ghi `id` trả về vào comment của Task. Staging cũng có chúng, nên lần deploy `v0.3.0` lên Staging là lần chạy thử V4 trên cùng dữ liệu, trước Production. Basic auth chỉ nằm trong biến môi trường của lệnh, không vào file, log hay comment.
  - Basic auth, theo đề xuất bạn đồng ý ngày 2026-11-15: với Staging, `devops` dùng basic auth mà `/ao-qa` đã có; với Production, bạn đặt basic auth vào biến môi trường của phiên `devops` khi chạy T5. Phiên không có nó thì `devops` đánh dấu T5 "Needs you", và bạn đặt biến đó hay tự chạy năm lệnh dưới đây.
  - `Áo thun cổ tròn` · slug `ao-thun-co-tron` · giá `250000.00` · mô tả `Áo thun cotton 100%.` xuống dòng `Cổ tròn, tay ngắn.`: tên có dấu, mô tả nhiều dòng.
  - `Quần jean nam` · `quan-jean-nam` · `450000.00` · không có mô tả.
  - `Đầm maxi đỏ 2026` · `dam-maxi-do-2026` · `1250000.00` · mô tả `Kích thước < 5 cm`: ký tự `<` trong mô tả.
  - `Combo 3 áo thun` · `combo-3-ao` · `399000.00` · mô tả `Ba áo thun basic.`: slug do người gõ, khác slug sinh từ tên.
  - `Bao tay len` · `bao-tay-len` · `0.00` · không có mô tả: giá 0 thành Ẩn khi nâng database.
  - Phụ thuộc: gate ②.
- [ ] SHOP-13 (T6): Schema V4 của `app.products` (expand) · be-dev · effort xhigh: nâng database Production đã có dữ liệu, và `v0.2.0` phải chạy đúng trên schema mới cho tới khi bỏ được rollback.
  - Theo mục Database Changes, kể cả các integration test ở đó, với năm sản phẩm của T5 trong dữ liệu V3.
  - TW1, NFR14–NFR17, NFR22. File: `apps/api/src/main/resources/db/migration/V4__expand_products_catalog.sql` (mới).
  - Phụ thuộc: không.
- [ ] SHOP-14 (T7): api: domain sản phẩm mới, sinh slug và tìm không dấu; gỡ endpoint cũ · be-dev · effort xhigh: câu SQL dựng từ từ khóa của người dùng (injection, thoát `LIKE`) và bộ lọc sản phẩm Ẩn (NFR9, NFR10).
  - Entity `Product` map `price_vnd`, `compare_at_price_vnd`, `status` và `availability`, với enum `ProductStatus` và `ProductAvailability` lồng trong entity; không map `price` cũ.
  - `ProductSlugs`: sinh slug và kiểm định dạng, unit test với các ví dụ của Product Rules.
  - `ProductSearchTerms`: gấp từ khóa như `app.search_fold`, tách từ, thoát `LIKE`.
  - `ProductQueryRepository` qua `JdbcClient`: một trang và tổng số, lọc trạng thái, bốn kiểu sắp xếp với khóa cuối `id`.
  - Gỡ `ProductController`, `ProductService`, `ProductMapper`, ba DTO cũ và `bulkUpdatePriceBySlug`, cùng test của chúng. Không app nào dùng được chúng: `admin` đọc `priceCents`, `user` gọi API NestJS.
  - TW5: `ActuatorProbesIntegrationTest` kiểm thêm `/actuator/health/db` trả 401.
  - Integration test (Testcontainers): tìm không dấu (`đ` khớp `d`, `ao` không ra "Bao tay len"); ba nhóm Liên quan nhất (AC19); phân trang không lặp hay sót với sản phẩm cùng giá và cùng `created_at` (NFR18); với 10.000 sản phẩm, trung vị của mỗi kiểu truy vấn không quá 200 ms (NFR2); từ khóa `%`, `_`, `\` và `'` (NFR10); ghi bằng entity mới thì cột `price` bằng `price_vnd`; `ProductSearchTerms` và `app.search_fold` cho cùng kết quả trên cùng bộ tên.
  - NFR2, NFR10, NFR14, NFR18. File: `feature/product/domain/Product.java`, `domain/ProductSlugs.java` (mới), `repository/ProductSearchTerms.java` (mới), `repository/ProductQueryRepository.java` (mới), `repository/ProductRepository.java`.
  - Phụ thuộc: SHOP-13 (T6).
- [ ] SHOP-15 (T8): API quản trị sản phẩm (1/2): thêm sản phẩm · be-dev
  - `POST /api/admin/products` theo API Contract: kiểm Product Rules, slug tự sinh với `-2`, `-3`…, slug tự gõ mà trùng là 409, log INFO.
  - WebMvc test: 400 cho từng giá trị sai của AC6, với mọi trường sai trong một phản hồi (AC7); 409; tên trường của phản hồi. Integration test: hậu tố slug, và hai lần thêm cùng lúc ra cùng slug.
  - AC7 và AC8 phía `api`; NFR10, NFR12. File: `feature/product/controller/AdminProductController.java`, `service/AdminProductService.java`, `dto/CreateProductRequest.java`, `dto/AdminProduct.java`, `validation/ValidCompareAtPrice.java` (annotation và validator), đều mới.
  - Phụ thuộc: SHOP-14 (T7).
- [ ] SHOP-16 (T9): API quản trị sản phẩm (2/2): danh sách và xóa · be-dev
  - `GET /api/admin/products` (tìm, lọc trạng thái, phân trang) và `DELETE /api/admin/products/{id}` (204, idempotent), log INFO khi xóa.
  - `GlobalExceptionHandler` trả 400 `INVALID_PARAMETER` kèm `parameter` cho lỗi kiểm tham số (`HandlerMethodValidationException`) và giá trị enum sai, thay vì 500 như hiện nay. WebMvc test 400 cho từng tham số sai (NFR3).
  - NFR3, NFR12, NFR20. File: `controller/AdminProductController.java`, `service/AdminProductService.java`, `dto/AdminProductSummary.java` (mới), `dto/ProductPage.java` (mới), `common/error/GlobalExceptionHandler.java`.
  - Phụ thuộc: SHOP-15 (T8).
- [ ] SHOP-17 (T10): admin: gỡ phần sản phẩm cũ của template (TW4, TW5) · fe-dev
  - Gỡ model `priceCents`, các hàm API, form thêm và sửa, trang chi tiết và nút xóa cũ; route `/products/:productId` và `/admin/products/:productId/edit`; `ProductCreateForm` trong `admin-route.tsx`; handler MSW sản phẩm cũ; `e2e/product-crud.spec.ts` với mock origin `ecom-nest.t2g.io.vn`. Tới US1, `/products` chỉ có tiêu đề S1.2.
  - TW5: `isLocal` vào `apps/admin/e2e/support/env.ts`.
  - File: `src/app/routes.tsx`, `src/config/paths.ts`, `src/app/routes/admin/admin-route.tsx`, `src/features/product/components/product-list.tsx` (chỉ còn tiêu đề).
  - Phụ thuộc: không.
- [ ] SHOP-18 (T11): user: gỡ phần sản phẩm cũ của template, nền đọc catalog (TW4, TW5) · fe-dev
  - Gỡ (TW4): DAL, model và mock MSW sản phẩm của API NestJS; Server Action và nút xóa; route `api/products/count`, hook và badge đếm; nút mật độ, lưới hay danh sách, làm mới, phóng ảnh; `images.remotePatterns` của `picsum.photos`; các test cũ trong `e2e/products.spec.ts` và phần Products cũ của `e2e/accessibility.spec.ts`; hai test xóa trong `e2e/auth.spec.ts`. Tới US5a, trang `/[locale]/products` giữ shell tĩnh (tiêu đề S4.2, BreadcrumbList) và một `<Suspense>` rỗng.
  - Nền: `request()` dựng URL bằng `new URL(path, env.API_URL)` và có thời hạn 5 s (mục 12); profile `catalog` của `cacheLife` (mục 8).
  - TW5: `isLocal` vào `apps/user/e2e/support/env.ts`; `reason:` của hai test đăng nhập và đăng xuất còn bỏ qua ghi "login Epic".
  - NFR7, NFR8 (`user` không còn lệnh ghi sản phẩm nào), NFR13, NFR26. File: `src/app/[locale]/products/page.tsx`, `src/features/product/components/product-results.tsx` (chỉ còn khung), `next.config.ts`, `src/lib/http/client.ts`.
  - Phụ thuộc: không.

### Checkpoint: Nền
- [ ] Integration test của T6 xanh, cả test của code `v0.2.0` trên V4; sau T7, cột `price` vẫn đúng sau mỗi lệnh ghi mới.
- [ ] `/v3/api-docs` có `POST`, `GET` và `DELETE` của `/api/admin/products`, và không còn endpoint trả hết danh sách hay đổi giá.
- [ ] Hai app build, lint, typecheck và unit test xanh; regression của hai app pass trên Development.
- [ ] Năm sản phẩm thử có trên Staging và Production (T5).

### Phase 3: Thêm và xem sản phẩm

- [ ] SHOP-19 (US1): Quản trị viên xem và tìm danh sách sản phẩm · fe-dev
  - AC1–AC4; S1.2–S1.11. S1.3 và S1.7 là liên kết tới route của US2 và US3, nên trước khi chúng xong, hai liên kết này mở trang Not found trên Development. NFR6.
  - Model Zod theo API Contract, và `formatPrice`. Hook `?q=&status=&page=` qua nuqs; gõ xong 300 ms thì đổi `q` và về trang 1. Bảng S1.6 với PlaceholderTile, huy hiệu, khung xương và trạng thái lỗi; trạng thái trống S1.9 và S1.10; phân trang S1.11.
  - E2E: helper `apps/admin/e2e/support/products.ts`; `products-list.spec.ts` cho AC1–AC4; axe của S1, sáng lẫn tối. `admin` thêm devDependency `@axe-core/playwright` 4.12.1, cùng phiên bản `user` đang có trong `pnpm-lock.yaml`, nên không phải gói mới của repo.
  - File: `src/features/product/model/product.ts`, `api/get-products.ts`, `hooks/use-product-filters.ts`, `components/product-list.tsx`, `src/config/paths.ts`.
  - Phụ thuộc: SHOP-9 (T2), SHOP-16 (T9), SHOP-17 (T10).
- [ ] SHOP-20 (US2): Quản trị viên thêm sản phẩm · fe-dev
  - AC5–AC8; S2 ở chế độ thêm (S2.1–S2.14), S1.3, S1.12 ("Đã thêm sản phẩm").
  - Schema Zod của form theo cùng quy tắc với `api`. Ô giá: `250.000` là 250000, `250000,5` là lỗi, rời ô thì hiện lại có dấu nhóm. Ô slug tự điền bằng bản TypeScript của thuật toán sinh slug, kiểm bằng các ví dụ của Product Rules, cho tới khi quản trị viên sửa tay; chưa sửa tay thì form gửi `slug: null`. Lỗi của API hiện theo mục API Contract.
  - E2E `product-create.spec.ts` cho AC5–AC8, trong đó AC7 gửi thẳng bằng request fixture; axe của S2.
  - File: `src/features/product/model/product-form.ts` (mới), `components/product-form.tsx` (mới), `api/create-product.ts` (mới), `src/app/routes/products/product-new-route.tsx` (mới), `src/app/routes.tsx`.
  - Phụ thuộc: SHOP-19 (US1), SHOP-15 (T8).
- [ ] SHOP-21 (US6a): Khách xem chi tiết sản phẩm · be-dev, fe-dev (Sub-task)
  - AC24, AC25; S5. NFR4: `qa` đo LCP và CLS của S5 trên Staging. NFR7, NFR11, NFR26.
  - BE (SHOP-22): `GET` và `HEAD /api/products/{slug}`, chỉ sản phẩm Đang bán. WebMvc test so ba phản hồi 404 (NFR9) và tên trường. File: `controller/StoreProductController.java`, `service/StoreProductService.java`, `dto/StoreProduct.java`, đều mới.
  - FE (SHOP-23): model Zod của mọi kiểu `Store…` và `Page`, dùng luôn cho US5a và US6c; `formatPrice`, `discountPercent`. DAL `getStoreProduct(slug)` với `'use cache'` và `cacheLife('catalog')`; 404 thì trả `null`. Trang S5 trong `<Suspense>`; mô tả là text node với `white-space: pre-line` (AC25, NFR11). E2E: helper `apps/user/e2e/support/products.ts`; `product-detail.spec.ts` cho AC24, AC25; axe của S5 ở hai ngôn ngữ, sáng lẫn tối. File: `src/features/product/model/product.ts`, `server/get-product.ts` (mới), `components/product-detail.tsx` (mới), `src/app/[locale]/products/[slug]/page.tsx` (mới).
  - Phụ thuộc: SHOP-10 (T3), SHOP-11 (T4), SHOP-15 (T8), SHOP-16 (T9), SHOP-18 (T11).
- [ ] SHOP-24 (US6b): Khách gặp trang "Không tìm thấy sản phẩm" với mã 404 · fe-dev
  - AC26; S6. NFR9, NFR26.
  - Proxy theo Architecture Decisions, mục 9; route `/[locale]/product-not-found`; một component S6 dùng chung cho route đó và cho `not-found.tsx` của trang chi tiết. Unit test của Proxy với `api` trả 200, 404, 500 và quá 5 s. E2E: mã 404 và nội dung S6 cho slug chưa từng có, sản phẩm Ẩn và sản phẩm đã xóa; axe của S6.
  - File: `src/proxy.ts`, `src/app/[locale]/product-not-found/page.tsx` (mới), `src/app/[locale]/product-not-found/not-found.tsx` (mới), `src/app/[locale]/products/[slug]/not-found.tsx` (mới), `src/features/product/components/product-not-found.tsx` (mới).
  - Phụ thuộc: SHOP-21 (US6a).
- [ ] SHOP-25 (US5a): Khách xem danh sách sản phẩm Đang bán · be-dev, fe-dev (Sub-task)
  - AC16, AC17, AC21; S4.2, S4.5, S4.6, S4.9, S4.10. NFR3, NFR4 (`qa` đo LCP và CLS của S4, và INP của Xem thêm), NFR7, NFR9, NFR18, NFR26.
  - BE (SHOP-26): `GET /api/products?offset=&limit=`, thứ tự `NEWEST`. WebMvc test: 400 cho `offset` và `limit` sai; `?status=HIDDEN` không mở sản phẩm Ẩn. File: `StoreProductController.java`, `StoreProductService.java`, `dto/StoreProductSummary.java` (mới).
  - FE (SHOP-27): DAL đọc theo khối 96 tới `page × 24` và bỏ trùng `id` (mục 10). Lưới S4.5 với 1, 2, 3, 4 cột. Thẻ S4.6: cả thẻ là liên kết tới S5, huy hiệu Hết hàng, giá gốc gạch ngang và "-16%". Dòng tiến độ S4.9. Nút Xem thêm S4.10: `router.replace`, focus thẻ mới đầu tiên, trạng thái đang tải và lỗi. Khi `api` lỗi, trang hiện trạng thái lỗi của S4.5, không bao giờ là danh sách trống (NFR26). E2E `products.spec.ts` cho AC16, AC17, AC21, và mở `?page=999999` thấy trang bình thường trong 2 s (NFR3); axe của S4 thay phần Products của `accessibility.spec.ts`; 320 px không có thanh cuộn ngang.
  - File: `src/features/product/model/product-query.ts`, `server/get-products.ts`, `components/product-results.tsx`, `components/product-card.tsx` (mới), `components/load-more-button.tsx` (mới).
  - Phụ thuộc: SHOP-21 (US6a).
- [ ] SHOP-28 (US5b): Khách tìm và sắp xếp danh sách sản phẩm · be-dev, fe-dev (Sub-task)
  - AC18, AC19, AC20, AC22, AC23; S4.3, S4.4, S4.7, S4.8. NFR4 (`qa` đo INP của đổi sắp xếp), NFR10.
  - BE (SHOP-29): thêm `q` và `sort` vào `GET /api/products`. WebMvc test: 400 cho `sort` sai và cho `RELEVANCE` khi không có `q`. Integration test thứ tự của AC19 và AC20 qua endpoint. File: `StoreProductController.java`, `StoreProductService.java`.
  - FE (SHOP-30): đọc `q`, `sort`, `page`, giá trị sai thì dùng mặc định (AC22). Ô tìm S4.3 là `<form role=search>` kiểu GET. Ô chọn S4.4 áp dụng ngay, và chỉ có Liên quan nhất khi đang tìm. Đổi từ khóa hay sắp xếp thì về 24 sản phẩm đầu. Trạng thái trống S4.7 và liên kết S4.8. E2E cho AC18–AC20, AC22 và AC23; nửa "Chưa có sản phẩm nào." mang tag `@local`.
  - File: `src/features/product/model/product-query.ts`, `server/get-products.ts`, `components/product-filters.tsx`, `components/product-results.tsx`, `components/load-more-button.tsx`.
  - Phụ thuộc: SHOP-25 (US5a).
- [ ] SHOP-31 (US6c): Thẻ meta, JSON-LD và sitemap của sản phẩm · be-dev, fe-dev (Sub-task)
  - AC27, AC28. NFR7, NFR9, NFR11, NFR21, NFR26.
  - BE (SHOP-32): `GET /api/sitemap/products`. File: `StoreProductController.java`, `StoreProductService.java`, `dto/SitemapEntry.java` (mới).
  - FE (SHOP-33):
    - `generateMetadata` của S5: `title: { absolute: '‹tên› | ‹tên site›' }`, vì template `%s · …` của layout gốc không cho đúng AC27; meta description là 160 ký tự đầu của mô tả, gộp xuống dòng; canonical và hreflang qua `buildPageMetadata`;
    - `productLd` qua `JsonLd`: `name`, `description`, `url`, `offers` với `price` số nguyên, `priceCurrency: 'VND'` và `availability`; không có `image`;
    - `sitemap.ts` gọi `connection()` trước khi đọc, rồi đọc mọi khối 1.000 qua DAL; `lastmod` là `updatedAt`, kèm hreflang `vi` và `en`; khi `api` lỗi, sitemap trả 5xx (NFR26);
    - E2E cho AC27, gồm một mô tả có `</script><script>alert(1)</script>` (NFR11), và cho AC28.
  - File: `src/app/[locale]/products/[slug]/page.tsx`, `src/lib/seo/structured-data.ts`, `src/app/sitemap.ts`, `src/features/product/server/get-sitemap-entries.ts` (mới).
  - Phụ thuộc: SHOP-21 (US6a).

### Checkpoint: Thêm và xem
- [ ] E2E của AC1–AC8 và AC16–AC28 pass trên Development.
- [ ] `pnpm run build` của `user` không gọi `api`; bản build trả 404 thật cho AC26.

### Phase 4: Sửa, ẩn và xóa

- [ ] SHOP-34 (US3): Quản trị viên sửa và ẩn sản phẩm · be-dev, fe-dev (Sub-task)
  - AC9–AC13; S2 ở chế độ sửa (S2.3 đang tải và không tìm thấy, S2.5 xung đột, S2.7 cảnh báo đổi slug), S1.7, S1.12 ("Đã lưu sản phẩm"). NFR6, NFR7, NFR19.
  - BE (SHOP-35): `GET` và `PUT /api/admin/products/{id}` theo API Contract, gồm slug cũ sai định dạng và `version`. WebMvc test: 409 `OPTIMISTIC_LOCK_CONFLICT`, 409 slug trùng, 400 slug đổi sai định dạng, 404. File: `AdminProductController.java`, `AdminProductService.java`, `dto/UpdateProductRequest.java` (mới).
  - FE (SHOP-36): nạp sản phẩm theo `productId`; form của US2 ở chế độ sửa: slug không đổi theo tên, cảnh báo khi slug khác slug đã lưu, gửi `version`. Khi xung đột, dữ liệu đã nhập còn nguyên, và chỉ nút Tải lại mới nạp lại (AC13). Route ngoài `ProtectedRoute`. E2E `product-edit.spec.ts` cho AC9–AC13; các AC "trong vòng 60 giây" chờ bằng `expect.poll` tới 60 s trên danh sách, trang chi tiết và sitemap của khách.
  - File: `src/features/product/api/get-product.ts` (mới), `api/update-product.ts` (mới), `components/product-form.tsx`, `src/app/routes/products/product-edit-route.tsx` (mới), `src/app/routes.tsx`.
  - Phụ thuộc: SHOP-20 (US2), SHOP-25 (US5a), SHOP-24 (US6b), SHOP-31 (US6c).
- [ ] SHOP-37 (US4): Quản trị viên xóa sản phẩm · fe-dev
  - AC14, AC15; S3, S1.8, S1.12 ("Đã xóa sản phẩm"). NFR19, NFR20, NFR21.
  - Hộp thoại S3 dùng Dialog của T2: mở thì focus vào Hủy, đóng mà không xóa thì focus về S1.8. Xóa xong thì tải lại danh sách và hiện toast. `retry.ts` chỉ thử lại GET, HEAD và OPTIONS (mục 13). E2E `product-delete.spec.ts` cho AC14 và AC15: trang khách trả 404 trong vòng 60 s, và slug dùng lại được; axe của S3.
  - File: `src/features/product/api/delete-product.ts` (mới), `components/product-delete-dialog.tsx` (mới), `components/product-list.tsx`, `src/lib/api/retry.ts`.
  - Phụ thuộc: SHOP-19 (US1), SHOP-24 (US6b).

### Checkpoint: Hoàn tất
- [ ] E2E của AC1–AC28 pass trên Development. Chỉ còn hai test bỏ qua, đăng nhập và đăng xuất, với `reason:` "login Epic".
- [ ] NFR1–NFR27 đạt theo cách kiểm của từng yêu cầu; `qa` ghi số đo NFR4 vào báo cáo QA của US5a, US5b và US6a.
- [ ] Sẵn sàng cắt `v0.3.0` ở gate ④. Release note ghi ở Known Issues rằng tới Epic đăng nhập chỉ mạng giữ các lệnh ghi (NFR8), và năm sản phẩm thử phải được xóa trước khi mở Production cho mọi người (NFR24). Ở gate ⑤, bạn xác nhận bản backup mới nhất của Production cách đó không quá 24 giờ (NFR27).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| V4 lỗi trên Production, hay `v0.2.0` không chạy được sau rollback | High | T6 chạy V4 trên dữ liệu giống Production và chạy code `v0.2.0` trên V4; lần deploy lên Staging với cùng năm sản phẩm (T5) là lần chạy thử; backup không quá 24 giờ ở gate ⑤ |
| Trigger làm lệch giá giữa hai cột | High | Một integration test cho mỗi dòng của bảng trigger; T7 kiểm cột `price` sau mỗi lệnh ghi mới; bước contract bỏ trigger ở bản sau |
| Rewrite của Proxy không giữ được mã 404, hay Proxy làm chậm các trang | Medium | E2E kiểm `response.status()` trên bản build và trên Development. Proxy chỉ gọi `api` cho đường dẫn chi tiết sản phẩm, và chỉ khi tải trang. Nếu rewrite không giữ 404, `fe-dev` trả 404 thẳng từ Proxy và báo `sa` bằng `Cần sa:` để sửa plan |
| Cache của Next giữ dữ liệu lâu hơn 60 s | Medium | Profile `catalog` tối đa 25 s cộng 30 s; E2E của AC9–AC11 và AC15 chờ bằng `expect.poll` tới 60 s |
| `API_URL` trên VPS không trỏ tới `api` | Medium | URL dựng bằng `new URL`; E2E đầu tiên của `user` trên Development (US6a) cho biết ngay; nếu sai, US6a "Needs you" và bạn đổi secret trước gate ④ (mục 12) |
| E2E trên Development dùng chung đụng dữ liệu của lần chạy khác | Medium | Nhãn `E2E <runId>`, đếm bằng cách tìm theo nhãn, chỉ kiểm thứ tự tương đối, dọn sản phẩm E2E cũ hơn 1 giờ (mục 16) |
| Lúc deployer chuyển bản, `user` mới gặp `api` cũ hay ngược lại trong ít phút | Low | Danh sách hiện lỗi S4.5, trang chi tiết trả 503, không bao giờ là danh sách trống hay 404 (NFR26) |
| Truy vấn chậm hơn 200 ms với 10.000 sản phẩm | Low | Test của NFR2 ở T7; nếu cần, một migration sau thêm index GIN trên `name_search` |
| `devops` không có basic auth của `shop-admin` Production cho T5 | Low | Bạn đặt nó vào biến môi trường của phiên `devops`; thiếu thì T5 "Needs you" (T5) |

## Open Questions

Không có. Ngày 2026-11-15 bạn đồng ý cả hai đề xuất, và mỗi câu trả lời đã thành quyết định ở chỗ của nó: `API_URL` của `user` ở Architecture Decisions, mục 12; basic auth của `shop-admin` Production ở T5.

Câu hỏi mới ở các Task, Story và chặng sau của Epic: agent làm theo đề xuất của mình và ghi quyết định vào artifact của chặng đó. Agent chỉ hỏi bạn những việc cần quyền mà agent không có.
