# Implementation Plan: Danh mục sản phẩm

> **Epic:** SHOP-81 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-81 · **Spec:** [spec.md](spec.md) · **Design:** [design.md](design.md) · **Tasks:** tracked in Jira under SHOP-81

## Overview

Plan có hai chặng và ba item, như mục Constraints của SPEC:

1. **Nền**, một Task của `be-dev` (T1): migration V7, `Slugs` dùng chung, và mọi API của TW2. Đó là API quản trị danh mục, danh mục trong lệnh thêm, sửa và chi tiết sản phẩm, API danh mục của khách, sản phẩm của một danh mục, và sitemap. Khi T1 merge, `admin` và `user` trên Development vẫn là bản của SHOP-7, nên bộ regression và E2E của SHOP-7 kiểm luôn hai app của `v0.3.0` chạy trên `api` mới (NFR19).
2. **Hai Story song song** của `fe-dev`, trong hai làn:
   - ADM cho `admin`: US1 và US2, các màn hình S1–S4;
   - USR cho `user`: US3 và US4, các màn hình S5–S8 và mục SEO.

   Mỗi Story chỉ phụ thuộc T1 và không sửa file nào của Story kia. E2E của mỗi Story tạo dữ liệu qua API quản trị của T1, không qua giao diện của Story kia.

Bản `v0.4.0` mang cả Epic lên Production. V7 chỉ là bước expand, và Epic không cần bước contract (Database Changes).

Mã item trong plan (T1, ADM, USR) là mã tạm. `ba` tạo các item trên Jira, rồi thêm key của mỗi item vào trước mã tạm của nó ở Task List.

## Architecture Decisions

1. **Ba item, mỗi item lớn hơn mức 5 file code, nên mỗi item chia thành các bước.** SPEC đặt tối đa 3 item cho lần chạy thật T14 (Constraints). Theo Task List, T1 có khoảng 30 file code, ADM khoảng 20 và USR khoảng 20, không tính file test, file JSON i18n và tài liệu. Đó là gấp bốn tới sáu lần mức "khoảng 5 file" của một Story.
   - Task List chia mỗi item thành các bước theo thứ tự. Mỗi bước có khoảng 5 file code trở xuống, là một commit hay vài commit, và để build, lint, typecheck và test của app xanh trước khi sang bước sau.
   - Agent làm lần lượt từng bước, và `reviewer` đọc PR theo từng commit.
   - Ngày 2026-11-21 bạn chọn giữ 3 item, thay vì tách thành 9 item nhỏ, nên plan không tách thêm. Vì vậy `reviewer` không đòi tách một item chỉ vì nó quá 5 file.
2. **T1 là một Task làm API**, như Architecture Decisions 4 của plan SHOP-7. Lý do: mọi E2E của hai Story, kể cả của `user`, tạo và dọn danh mục qua `POST` và `DELETE /api/admin/categories` (TW3), nên API này phải có trước Story đầu tiên. Vì vậy ADM và USR chỉ có phần `fe-dev`. Bạn duyệt ngoại lệ "Task làm API" cùng plan ở gate ②, để `reviewer` không đòi đổi T1 thành Story.
3. **Hai Story không chờ nhau.** AC5–AC9 có vế Then ở cả hai app: một phần ở `admin`, một phần "trong vòng 60 giây" ở trang khách. Plan chia mỗi tiêu chí theo app:
   - E2E của ADM làm thao tác qua giao diện `admin`, rồi kiểm phần của `admin`;
   - E2E của USR làm cùng thao tác qua API quản trị, bằng helper của TW3, rồi chờ trang khách bằng `expect.poll` tới 60 s.

   Test ở cả hai app đều bắt đầu bằng mã AC. Story merge trước không cần Story kia. Nhờ vậy, như Constraints mong, một PR merge được trong lúc item kia đang QA trên Development.
4. **Schema:**
   - khóa ngoại `ON DELETE SET NULL`: xóa danh mục làm sản phẩm của nó thành không có danh mục, `updated_at` của các sản phẩm đó đổi, còn `version` giữ nguyên (ADR-0004);
   - collation ICU `app.vi_ci` cho thứ tự và cho tên không trùng (ADR-0005).

   Chi tiết ở mục Database Changes. Nếu image không có dữ liệu ICU của `vi`, mục Risks có đường lui.
5. **Chiều phụ thuộc trong `api`.**
   - `feature/category` không import gì của `feature/product`. SQL đếm hay lọc sản phẩm của nó chỉ đọc bảng `app.products`.
   - `feature/product` dùng `CategoryRepository` cho ba việc: kiểm `categoryId` khi thêm và sửa sản phẩm, tìm danh mục Hiện của trang danh mục, và đọc danh mục trong chi tiết sản phẩm.
   - Vì vậy `GET /api/categories/{slug}/products` nằm ở `StoreProductController`, cạnh danh sách sản phẩm của khách.
6. **SQL.** Các danh sách danh mục viết tay qua `JdbcClient`, trong `CategoryQueryRepository`, như `ProductQueryRepository`.
   - Mỗi lệnh đọc chạy một câu SQL, trừ sản phẩm của một danh mục: câu tìm danh mục, rồi một trang và tổng số như danh sách sản phẩm, tức ba câu. Không lệnh nào có số câu tăng theo số danh mục hay số sản phẩm (NFR2).
   - Số sản phẩm của danh sách quản trị là một subquery `count(*)` trong cùng câu. Danh sách của khách và sitemap lọc bằng `EXISTS` sản phẩm `ACTIVE`.
   - So slug luôn bằng toán tử của `citext`, `OPERATOR(public.=)`, như `ProductRepository`: với `search_path` chỉ có `app`, `=` thường so như `text` và phân biệt chữ hoa.
   - So tên bằng `=` thường. Cột `name` có collation `app.vi_ci`, và collation của cột thắng collation mặc định của tham số, nên phép so không phân biệt chữ hoa, chữ thường, như UNIQUE.
7. **Danh mục trong lệnh sửa sản phẩm (NFR19): vắng `categoryId` là giữ danh mục đang có.** SPEC để plan chọn giữa hai cách: giữ danh mục, hay từ chối bằng 400. Plan chọn giữ.
   - Lý do: từ lúc T1 merge tới lúc ADM merge, `admin` trên Development còn form của SHOP-7, vốn không gửi `categoryId`. Nếu từ chối, form đó không lưu được sản phẩm nào, và E2E sửa sản phẩm của SHOP-7, là một phần DoD của T1, đỏ. Trên Production, một tab mở từ trước lần deploy cũng gặp đúng chuyện đó.
   - Hợp đồng gồm bốn trường hợp:
     - vắng trường `categoryId`: giữ danh mục đang có;
     - `null`: không có danh mục;
     - chuỗi UUID của một danh mục đang có, kể cả danh mục Ẩn: danh mục đó;
     - mọi giá trị khác: 400 trên trường `categoryId`.
   - DTO đọc `categoryId` là chuỗi rồi kiểm dạng UUID, nên `"abc"` là một lỗi trường trong `errors`, không phải `MALFORMED_REQUEST` của cả thân. Đó là cách quyết định 7 của plan SHOP-7 làm với giá.
   - `be-dev` chọn cách để Jackson phân biệt "vắng" với `null`. Ví dụ: một kiểu bọc có deserializer riêng, trong đó `getAbsentValue` và `getNullValue` trả hai giá trị khác nhau. Một WebMvc test ghim đủ bốn trường hợp trên.
   - Form của ADM luôn gửi `categoryId`. "Không có danh mục" gửi `null` một cách tường minh.
8. **Danh mục trong chi tiết sản phẩm của khách** (NFR6, NFR8). `GET /api/products/{slug}` đọc sản phẩm và danh mục trong một câu SQL, `LEFT JOIN app.categories c ON c.id = p.category_id AND c.status = 'VISIBLE'`. Danh mục Ẩn vì vậy ra `category: null`, giống hệt sản phẩm không có danh mục. `HEAD` của cùng đường dẫn không đổi.
9. **Ranh giới feature ở hai app.** ESLint của `admin` và `user` cấm một feature import feature khác: mỗi feature có một zone. Hai Story ghép ở tầng `app` và chuyển phần dùng chung xuống tầng shared.
   - **Zone mới:** mỗi Story thêm zone cho `features/category` vào config ESLint của app của nó (`apps/admin/eslint.config.js`, `apps/user/eslint.config.mjs`, danh sách `FEATURES`).
   - **`admin`:**
     - `slugFromName` chuyển từ `features/product/model/product-form.ts` sang `src/lib/text/slug.ts`, cho cả form sản phẩm lẫn form danh mục.
     - Ô Danh mục của form sản phẩm đọc danh sách lựa chọn bằng một query riêng của `features/product` (`GET /api/admin/categories`). Khóa query bắt đầu bằng `categories`, như khóa của `features/category`, nên một lần thêm, sửa hay xóa danh mục làm mới cả ô này.
   - **`user`:**
     - `isStoreSlug` chuyển sang `src/lib/validation/store-slug.ts`, cho Proxy, DAL sản phẩm và DAL danh mục (NFR9).
     - Route của S5 ghép `features/category` (tên, breadcrumb) với `features/product` (lưới, sắp xếp, Xem thêm).
     - Trang Sản phẩm ghép thêm hàng liên kết của `features/category`.
10. **Trang danh mục của `user`** (S5, S6), theo đúng mẫu trang chi tiết sản phẩm của SHOP-7, tức Architecture Decisions 8, 9 và 10 của plan đó.
    - **Proxy.**
      - `/{locale}/categories/{slug}` khớp `^\/([^/]+)\/categories\/([^/]+)\/?$`. `config.matcher` thêm `'/(en|vi)/categories/:slug'`, như với sản phẩm.
      - Chỉ một lần tải trang mới qua bước kiểm. Prefetch và điều hướng phía client đi thẳng vào trang, như với sản phẩm.
      - Slug không qua `isStoreSlug` thì là 404 ngay, không gửi lệnh nào. Slug hợp lệ thì gửi `HEAD /api/categories/{slug}`, thời hạn 5 s, `cache: 'no-store'`.
      - Kết quả 200: đi tiếp. 404: rewrite sang `/{locale}/category-not-found`, route gọi `notFound()` lúc prerender để giữ mã 404. Lỗi khác hay hết giờ: 503 như `unavailable()` (NFR20).
    - **Dữ liệu.**
      - Trang đọc `getStoreCategory(slug)`. Kết quả `null` thì gọi `notFound()`, cho cùng S6 khi điều hướng phía client.
      - Canonical, JSON-LD và khóa cache của sản phẩm dùng slug đã lưu mà API trả, không dùng slug trên đường dẫn. Nhờ vậy `/vi/categories/AO` có canonical `…/ao` (AC18) và dùng chung cache với `/vi/categories/ao`.
    - **Sản phẩm.**
      - `getStoreProducts` của SHOP-7 nhận thêm nguồn đọc: cả catalog như hiện nay, hay một danh mục theo slug, tức `/api/categories/{slug}/products`. Khối 96 sản phẩm, bỏ trùng `id`, dừng ở tổng số và giữ phần đã đọc khi khối sau lỗi vẫn như cũ (NFR3).
      - Lệnh sản phẩm của danh mục trả 404 khi danh mục vừa bị ẩn hay xóa sau lần đọc tên. Khi đó trang gọi `notFound()`.
      - Tham số trên URL là `?sort=newest|price-asc|price-desc&page=N`. Trang bỏ qua `q`, và `relevance` hay một giá trị sai trở về Mới nhất (AC13, AC14).
    - **Metadata.**
      - Title là bậc đầu tiên của mục SEO, S5, mà `chuỗi.length + 19` (hậu tố ` · tungph7 codebase`) không quá 60.
      - Meta description thêm câu 2 khi tổng không quá 160.
      - Khi danh mục chưa có sản phẩm Đang bán, `buildPageMetadata` nhận `index: false`. `generateMetadata` biết điều đó từ khối đầu, đọc với `NEWEST` và offset 0. Đó là cùng mục cache với trang ở sắp xếp mặc định, nên không thêm lệnh gọi `api` nào.
11. **Hàng liên kết danh mục (S7)** là một component async thứ hai trong cùng `<Suspense>` với kết quả của trang Sản phẩm. Trang Sản phẩm ghép hai component đó ở tầng `app`, nên hai lệnh tới `api` chạy song song, và hàng hiện cùng lúc với lưới, không đẩy lưới xuống (NFR4).
    - Khi lệnh `GET /api/categories` lỗi, component bắt lỗi, gọi `captureError`, và không hiện hàng. Hàm có `'use cache'` ném lỗi, và lỗi không vào cache, nên hàng hiện lại ở lần đọc kế tiếp (NFR20).
    - Khi danh sách trống, hàng cũng không hiện.
12. **Sitemap.** `sitemap.ts` đọc các danh mục qua `getCategorySitemapEntries()` (`GET /api/sitemap/categories`), song song với sản phẩm, và thêm chúng sau các trang sản phẩm.
    - `lastmod` là `updatedAt` mà API đã tính (AC19).
    - Mỗi mục có hreflang `vi` và `en` qua `addressesOf`, không có `priority` hay `changeFrequency`.
    - Một lệnh lỗi thì sitemap là 5xx (NFR20).
13. **Dữ liệu của E2E** (TW3, Testing Strategy).
    - Mỗi app có helper `e2e/support/categories.ts`, gọi `/api/admin/categories` qua host `admin` như helper sản phẩm. Helper sản phẩm nhận thêm `categoryId`.
    - Tên danh mục E2E là `<tên> E2E <runId>`, vừa 60 ký tự.
    - Trước mỗi lần chạy, helper xóa danh mục E2E tạo cách đây hơn 1 giờ, sau khi đã xóa sản phẩm E2E cũ. Helper đọc danh sách quản trị, vốn trả hết mọi danh mục, rồi lọc theo `E2E ` trong tên và theo `createdAt`.
    - Test thứ tự và số lượng (AC1, AC17) chỉ kiểm các danh mục của lần chạy đó. Test sitemap (AC19) chỉ kiểm có hay không có slug của lần chạy đó.
    - Nửa "chưa có danh mục nào" của AC1 mang tag `@local`.
14. **Design system.** Không có Task "Design system của <app>". `design.md` không có mục "mới" nào, cả hai app đã có `docs/design-system/<app>.md`, và bạn đã quyết ngày 2026-11-21.
    - USR dựng Breadcrumb (S5.2, S8.2) thành component dùng chung `src/components/ui/breadcrumb.tsx`. Component nhận đúng danh sách mục mà `breadcrumbLd` nhận, như đoạn code ở Code Style của SPEC.
    - USR dựng Hàng liên kết danh mục (S7.3) từ token có sẵn, và thêm cả hai khối vào `docs/design-system/user.md` trong cùng PR.
    - ADM chỉ dùng class có sẵn (`.pill__link`, `.table__num`), nên không sửa `docs/design-system/admin.md`, trừ khi nó thêm một class.

Không đổi: stack và phiên bản ở Tech Stack của SPEC, `deploy.yaml`, secret, biến môi trường, CSP và dependency của ba app (NFR13, NFR21).

## Database Changes

### `v0.4.0`: V7, bước expand

File `apps/api/src/main/resources/db/migration/V7__create_categories.sql` (T1). File chạy trong một transaction, và không sửa V1–V6.

| Thay đổi | Chi tiết |
|---|---|
| Collation `app.vi_ci` | `CREATE COLLATION app.vi_ci (provider = icu, locale = 'vi-u-ks-level2', deterministic = false)` (ADR-0005). |
| Kiểm collation | Một khối `DO` kiểm bốn điều: `'Az' < 'Ăn'`, `'Dép' < 'Đầm'`, `'áo' = 'Áo'` và `'Ao' <> 'Áo'`, mỗi phép với `COLLATE app.vi_ci`. Sai một điều thì `RAISE EXCEPTION` nêu điều sai, với `HINT` rằng PostgreSQL thiếu dữ liệu ICU của `vi`, như V6. |
| Bảng `app.categories` | `id UUID PRIMARY KEY DEFAULT app.gen_uuid_v7()`; `name VARCHAR(60) COLLATE app.vi_ci NOT NULL`; `slug public.CITEXT NOT NULL`; `status VARCHAR(16) NOT NULL DEFAULT 'VISIBLE'`; `created_at`, `updated_at`, `created_by`, `updated_by` và `version` như V3. |
| Ràng buộc của `app.categories` | `categories_name_unique UNIQUE (name)`, theo collation của cột; `categories_slug_unique UNIQUE (slug)`; `categories_name_length CHECK (char_length(name) BETWEEN 1 AND 60)`; `categories_slug_format CHECK (slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug::text) <= 100)`; `categories_status_valid CHECK (status IN ('VISIBLE', 'HIDDEN'))`. Phép `~` chạy trên `slug::text`, vì toán tử `~` của `citext` không phân biệt chữ hoa, nên `AO` sẽ lọt qua. |
| Trigger `trg_categories_set_updated_at` | `BEFORE UPDATE … FOR EACH ROW EXECUTE FUNCTION app.set_updated_at()`, như `app.products`. |
| Cột `app.products.category_id` | `UUID`, cho phép trống, không có DEFAULT, nên không viết lại bảng, và mọi dòng có sẵn có `category_id` trống. |
| Khóa ngoại `products_category_fk` | `FOREIGN KEY (category_id) REFERENCES app.categories (id) ON DELETE SET NULL` (ADR-0004). Thêm cùng `ADD COLUMN` trong một `ALTER TABLE`; lần kiểm các dòng có sẵn chỉ đọc 10.000 giá trị trống. |
| Index `idx_products_category_id` | `ON app.products (category_id)`: cho lần đặt về trống khi xóa danh mục, cho số sản phẩm và cho trang danh mục. Không thêm index ghép: test của NFR2 quyết, và nếu cần, một migration sau thêm index, việc chỉ thêm và an toàn ở mọi bản. |
| `COMMENT ON` | Cho bảng, các cột mới, khóa ngoại và collation, như V3. |
| `app._app_migration_log` | Một dòng cho V7. |
| Giữ nguyên | Mọi cột, ràng buộc, trigger và index có sẵn của `app.products`, kể cả cột giá cũ `price` và trigger `trg_products_sync_legacy_price`. |

Thứ tự trong file:

1. Tạo collation, rồi kiểm nó. Nhờ vậy một database thiếu dữ liệu ICU dừng trước khi có bảng nào.
2. Tạo bảng `app.categories`, các ràng buộc và comment.
3. Tạo trigger `updated_at` của bảng mới.
4. `ALTER TABLE app.products ADD COLUMN category_id UUID CONSTRAINT products_category_fk REFERENCES app.categories (id) ON DELETE SET NULL`, rồi tạo index.
5. Ghi một dòng vào `app._app_migration_log`.

Bước 4 khóa `app.products` từ lệnh `ALTER TABLE` tới hết transaction. Integration test đo cả file trên 10.000 sản phẩm: dưới 10 s (NFR16).

Với một sản phẩm, xóa danh mục của nó làm như sau (NFR15):

| Cột | Sau lần xóa danh mục |
|---|---|
| `category_id` | `NULL`, do `ON DELETE SET NULL`, trong câu `DELETE` của danh mục |
| `updated_at` | Lúc xóa, do `trg_products_set_updated_at`, chạy cho cả UPDATE do khóa ngoại sinh ra |
| `version` | Giữ nguyên: database đặt `category_id`, không qua Hibernate |
| `price`, `price_vnd` và các cột còn lại | Giữ nguyên. `trg_products_sync_legacy_price` có chạy nhưng không làm gì, vì không cột giá nào đổi |

Rollback về `v0.3.0` (NFR16):

- Flyway của `v0.3.0` chỉ biết V1–V6, và bỏ qua V7 như migration "future". `application*.yml` không đặt `ignore-migration-patterns`.
- `ddl-auto: validate` không xét bảng hay cột mà entity không map.
- Entity `Product` của `v0.3.0` ghi INSERT và UPDATE với danh sách cột tường minh, không có `category_id`. Vì vậy:
  - sản phẩm nó thêm có `category_id` trống;
  - sản phẩm nó sửa giữ danh mục;
  - sản phẩm nó xóa không bị khóa ngoại cản, vì `app.products` là phía trỏ đi.
- Danh mục còn nguyên trong database để lần deploy sau dùng lại.

Kiểm, ở bước 1 của T1, bằng Testcontainers PostgreSQL 17:

- **Collation và V7.** Trên `postgres:17-alpine` theo đúng digest của `deploy.yaml`, V7 chạy xong, và khối kiểm collation qua. Đây là test đầu tiên của T1. Nếu nó đỏ vì thiếu dữ liệu ICU, xem mục Risks.
- **Dữ liệu giống Production.** Trên schema V6 có năm sản phẩm thử của SHOP-12 cùng 10.000 sản phẩm sinh ra, V7 chạy dưới 10 s. Mọi sản phẩm có `category_id` trống, các cột khác và `updated_at` không đổi, và trigger giá cũ vẫn chạy.
- **Ràng buộc.** Ghi thẳng bằng SQL từng giá trị sai của NFR14: tên rỗng, tên 61 ký tự, "áo" khi đã có "Áo", slug `AO`, slug `-ao`, slug 101 ký tự, trạng thái `X`, `category_id` trỏ tới một danh mục không có. Database từ chối từng giá trị. "Ao" khi đã có "Áo" thì được nhận.
- **Thứ tự.** Bảy tên của NFR17, "An toàn", "Áo khoác", "Ăn vặt", "Bao tay", "Dép", "Đầm" và "quần", ra đúng thứ tự đó với `ORDER BY name, id`.
- **Xóa.** Xóa một danh mục có sản phẩm Đang bán lẫn Ẩn, rồi so từng cột của các sản phẩm đó trước và sau, theo bảng trên (AC8).
- **Lệnh của `v0.3.0` (NFR16).**
  - Flyway chỉ với V1–V6, theo mẫu `flywayOfV020` của `MigrationDatabase`, chạy `validate()` được trên database đã có V7.
  - Ở bước 1, code sản phẩm của `api` còn đúng như tag `v0.3.0`: `git diff v0.3.0 -- apps/api/src/main` không có dòng nào. Vì vậy toàn bộ test sản phẩm đang có chạy không sửa trên V7 là lần chạy code `v0.3.0` trên schema mới. `be-dev` ghi SHA của commit bước 1 và kết quả lần chạy đó vào mô tả PR.
  - Để kiểm này còn sau khi code sản phẩm đổi, một integration test chạy lại các câu INSERT, UPDATE và DELETE mà Hibernate của `v0.3.0` ghi cho `Product`, chép từ log SQL ở bước 1, trên một sản phẩm có danh mục. Kết quả phải đúng như ở trên: INSERT cho danh mục trống, UPDATE giữ danh mục, DELETE xóa được.

### Không có bước contract

V7 chỉ thêm: một collation, một bảng, một cột cho phép trống, một khóa ngoại và một index. Nó không thay hay bỏ cột nào, nên không bản sau nào phải gỡ gì của V7. Bước contract của SHOP-7, tức bỏ cột giá cũ `price`, vẫn là một Task riêng của một bản sau, ngoài Epic này (Scope: Out).

## API Contract

Chung cho mọi endpoint dưới đây, thêm vào phần chung của API Contract trong plan SHOP-7 (`Uuid`, `Instant`, `Page<T>`, Problem Details, `INVALID_PARAMETER`, độ dài theo UTF-16):

```ts
type CategoryStatus = 'VISIBLE' | 'HIDDEN';

/** Một danh sách trả hết trong một lệnh, không phân trang (NFR1). Bọc trong object để sau này thêm phân trang mà không đổi kiểu. */
interface ItemList<T> {
  items: T[];
}
```

- **Thứ tự danh mục:** `name` theo collation `app.vi_ci`, rồi `id` (NFR17). Ba danh sách theo thứ tự này: danh sách quản trị, các liên kết của khách, và lựa chọn của ô Danh mục. `admin` và `user` không xếp lại.
- **Mã lỗi mới** trong `ErrorCode`: `CATEGORY_NOT_FOUND` (404), `CATEGORY_NAME_DUPLICATED` (409) và `CATEGORY_SLUG_DUPLICATED` (409). `ConstraintViolations` có tên của `categories_name_unique`, `categories_slug_unique` và `products_category_fk`.
- **Chốt cuối là database** (NFR11), ở cả service lẫn `GlobalExceptionHandler`:
  - vi phạm `categories_name_unique` là 409 `CATEGORY_NAME_DUPLICATED`;
  - vi phạm `categories_slug_unique` là 409 `CATEGORY_SLUG_DUPLICATED`;
  - vi phạm `products_category_fk` là 400 `VALIDATION_FAILED` trên trường `categoryId`.
- **Log INFO** cho mỗi lần thêm, sửa và xóa danh mục: thao tác, `id`, slug và correlation id. Lần xóa ghi thêm `productCount` lúc xóa. Log không ghi thân request hay header `Authorization` (NFR11).
- **OpenAPI** ở `/v3/api-docs` mô tả từng endpoint mới, các trường mới và từng mã lỗi, như các endpoint sản phẩm (Success Criteria).

### API quản trị danh mục: `/api/admin/categories`

Đi qua `/api/*` của host `admin`, sau basic auth. `admin` (ADM) và helper E2E của hai app dùng API này.

```ts
interface AdminCategory {
  id: Uuid;
  name: string;
  slug: string;
  status: CategoryStatus;
  createdAt: Instant;
  updatedAt: Instant;
  version: number;               // gửi lại khi sửa
}

interface AdminCategoryListItem extends AdminCategory {
  productCount: number;          // mọi sản phẩm của danh mục, Đang bán lẫn Ẩn (AC1, AC8)
}

interface CreateCategoryInput {
  name: string;                  // bỏ khoảng trắng đầu và cuối, rồi 1–60 ký tự
  slug?: string | null;          // vắng hay null: api sinh từ tên, thêm -2, -3… khi trùng
  status?: CategoryStatus;       // mặc định VISIBLE
}

interface UpdateCategoryInput {
  name: string;
  slug: string;                  // bắt buộc; luôn kiểm định dạng
  status: CategoryStatus;
  version: number;
}
```

| Endpoint | Thành công | Lỗi |
|---|---|---|
| `GET /api/admin/categories` | 200 `ItemList<AdminCategoryListItem>`, mọi danh mục, cả Hiện lẫn Ẩn | Không có lỗi của request |
| `POST /api/admin/categories`, thân `CreateCategoryInput` | 201 `AdminCategory`, header `Location: /api/admin/categories/{id}` | 400 `VALIDATION_FAILED` kèm `errors`, mọi trường sai trong một phản hồi; 409 `CATEGORY_NAME_DUPLICATED`; 409 `CATEGORY_SLUG_DUPLICATED` khi slug tự gõ đã có, hay khi slug sinh từ tên đã có tới `-1000` |
| `GET /api/admin/categories/{id}` | 200 `AdminCategory` | 400 `INVALID_PARAMETER` khi `id` không phải UUID; 404 `CATEGORY_NOT_FOUND` |
| `PUT /api/admin/categories/{id}`, thân `UpdateCategoryInput` | 200 `AdminCategory` với `version` mới | 400 `VALIDATION_FAILED`; 404 `CATEGORY_NOT_FOUND`; 409 `OPTIMISTIC_LOCK_CONFLICT`; 409 `CATEGORY_NAME_DUPLICATED`; 409 `CATEGORY_SLUG_DUPLICATED` |
| `DELETE /api/admin/categories/{id}` | 204, kể cả khi danh mục đã không còn (NFR12) | 400 `INVALID_PARAMETER` |

Quy tắc của lệnh ghi:

- **Kiểm** theo Category Rules bằng Bean Validation trên DTO. Tên dùng `FormText` như sản phẩm (NFR9). Slug có thì phải theo `^[a-z0-9]+(?:-[a-z0-9]+)*$` và tối đa 100 ký tự. Trạng thái chỉ là `VISIBLE` hay `HIDDEN`.
- **Thứ tự kiểm khi thêm:**
  1. lỗi trường, 400;
  2. tên trùng với một danh mục khác, 409 `CATEGORY_NAME_DUPLICATED`;
  3. slug tự gõ đã có, 409 `CATEGORY_SLUG_DUPLICATED`.

  Không có slug thì `Slugs` sinh slug từ tên, với chữ dự phòng `danh-muc`, rồi chọn số trống đầu tiên trong các ứng viên `-2` tới `-1000` bằng một câu SQL, như `AdminProductService`. Một lần thêm cùng lúc lấy mất slug sinh ra thì thử số kế tiếp, tối đa 3 lần.
- **Thứ tự kiểm khi sửa:**
  1. lỗi trường, 400;
  2. danh mục không có, 404;
  3. `version` khác bản trong database, 409 `OPTIMISTIC_LOCK_CONFLICT`;
  4. tên trùng với một danh mục khác, trừ chính nó, 409 tên;
  5. slug đổi và đã có, 409 slug.

  Slug bằng slug đang lưu, không phân biệt chữ hoa, thì giữ slug đang lưu. Hai lần sửa cùng lúc với cùng `version`: `@Version` của Hibernate chặn lần thứ hai, cũng là 409.
- **Xóa** là hai câu trong một transaction. Câu đầu đếm sản phẩm của danh mục, cho log. Câu sau là `DELETE FROM app.categories WHERE id = :id`, và khóa ngoại đặt sản phẩm về trống. Xóa một danh mục đã không còn thì trả 204 và ghi log "already gone", như sản phẩm.

Ví dụ một mục của `GET /api/admin/categories`, để unit test của schema Zod ở `admin` parse:

```json
{
  "id": "019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b",
  "name": "Áo khoác",
  "slug": "ao-khoac",
  "status": "VISIBLE",
  "productCount": 3,
  "createdAt": "2026-11-22T02:10:00.000Z",
  "updatedAt": "2026-11-22T02:15:30.000Z",
  "version": 0
}
```

Cách `admin` hiện lỗi:

- 400: lỗi đặt dưới ô theo `field`. `name` và `slug` dưới ô của chúng; trường khác, hay 400 không nêu trường nào, là lỗi chung của S2.4.
- 409 `CATEGORY_NAME_DUPLICATED`: "Tên danh mục này đã có" dưới ô tên, và focus về ô tên (S2.5).
- 409 `CATEGORY_SLUG_DUPLICATED`: hai trường hợp (S2.6).
  - Form đã gửi một slug: "Slug này đã được dùng" dưới ô slug.
  - Form gửi `slug: null`: "Các slug tự sinh từ tên này đều đã được dùng. Hãy tự nhập một slug."
- 409 `OPTIMISTIC_LOCK_CONFLICT`: banner xung đột của S2.4.
- 404 khi sửa: trạng thái not-found của S2.3. 404 khi xóa không xảy ra, vì xóa là 204.
- Lỗi mạng, hết giờ hay 5xx: "Không lưu được. Vui lòng thử lại." (S2.4), hay lỗi của S3.7 khi xóa.

### Danh mục trong API quản trị sản phẩm: `/api/admin/products`

Thêm vào các kiểu của plan SHOP-7. Mọi trường mới là phần thêm.

```ts
interface AdminProduct {          // GET /{id}, và phản hồi của POST và PUT
  // …các trường của SHOP-7
  categoryId: Uuid | null;        // cả khi danh mục Ẩn
}

interface CreateProductInput {
  // …các trường của SHOP-7
  categoryId?: Uuid | null;       // vắng hay null: không có danh mục
}

interface UpdateProductInput {
  // …các trường của SHOP-7
  categoryId?: Uuid | null;       // vắng: giữ danh mục đang có; null: bỏ danh mục (Architecture Decisions 7)
}
```

`AdminProductSummary` của danh sách không đổi, vì S1.6 của SHOP-7 không có cột Danh mục.

| Endpoint | Thay đổi | Lỗi mới |
|---|---|---|
| `POST /api/admin/products` | Nhận `categoryId` | 400 `VALIDATION_FAILED`, lỗi trên trường `categoryId`, khi nó không phải UUID hay không phải một danh mục đang có |
| `PUT /api/admin/products/{id}` | Nhận `categoryId`, theo bốn trường hợp của Architecture Decisions 7 | Như `POST` |
| `GET /api/admin/products/{id}` | Trả `categoryId` | Không có |

Ví dụ lỗi 400 của AC10:

```json
{
  "type": "https://docs.example.com/errors/VALIDATION_FAILED",
  "title": "Validation failed",
  "status": 400,
  "detail": "Validation failed for 1 field(s).",
  "instance": "/api/admin/products/019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f",
  "code": "VALIDATION_FAILED",
  "timestamp": "2026-11-22T02:10:00.000Z",
  "correlationId": "4b1f0c2a-…",
  "errors": [
    { "field": "categoryId", "rejectedValue": "019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b", "message": "must be an existing category" }
  ]
}
```

Lần kiểm trước (`existsById`) và lần vi phạm `products_category_fk`, khi danh mục bị xóa giữa lần kiểm và lần ghi, cho cùng thân này. `admin` hiện lỗi của S4.2 khi 400 có lỗi trên `categoryId`.

### API danh mục của khách: `/api/categories` và `/api/sitemap/categories`

Chỉ server của `user` gọi API này, qua `API_URL`, và chỉ bằng GET và HEAD (NFR7). Mọi lệnh chỉ thấy danh mục `VISIBLE`. API không có tham số trạng thái, và bỏ qua tham số lạ (NFR8).

```ts
interface StoreCategory {
  name: string;
  slug: string;                   // slug đã lưu
}

interface CategorySitemapEntry {
  slug: string;
  updatedAt: Instant;             // lần muộn hơn giữa updated_at của danh mục và của các sản phẩm ACTIVE của nó (AC19)
}
```

| Endpoint | Thành công | Lỗi |
|---|---|---|
| `GET /api/categories` | 200 `ItemList<StoreCategory>`: danh mục `VISIBLE` có ít nhất một sản phẩm `ACTIVE` (AC17) | Không có lỗi của request |
| `GET /api/categories/{slug}`, và `HEAD` cùng đường dẫn | 200 `StoreCategory` cho danh mục `VISIBLE`, kể cả khi chưa có sản phẩm `ACTIVE` (AC15); `HEAD` không có thân | 404 `CATEGORY_NOT_FOUND`, `detail` "Category not found.". Thân giống nhau, trừ `instance`, `timestamp` và `correlationId`, cho slug chưa từng có, danh mục Ẩn và danh mục đã xóa (NFR8). `HEAD` dựng 404 trong controller, không ném lỗi, như `StoreProductController` |
| `GET /api/categories/{slug}/products?sort=NEWEST\|PRICE_ASC\|PRICE_DESC&offset=0&limit=24` | 200 `Page<StoreProductSummary>`: sản phẩm `ACTIVE` của danh mục. `sort` mặc định `NEWEST`, thứ tự như API Contract của SHOP-7, khóa cuối `id DESC`. `limit` 1–100. `totalItems` chỉ đếm sản phẩm `ACTIVE` | 400 `INVALID_PARAMETER` nêu tham số, kể cả `sort=RELEVANCE` (NFR3); 404 `CATEGORY_NOT_FOUND`, cùng thân như trên |
| `GET /api/sitemap/categories` | 200 `ItemList<CategorySitemapEntry>`: danh mục `VISIBLE` có ít nhất một sản phẩm `ACTIVE`, theo `id` | Không có lỗi của request |

So slug không phân biệt chữ hoa (`citext`). Đường dẫn sitemap nằm ngoài `/api/categories/`, nên một danh mục có slug `sitemap` vẫn có trang của nó (ADR-0003).

### Danh mục trong chi tiết sản phẩm của khách: `GET /api/products/{slug}`

```ts
interface StoreProduct {
  // …các trường của SHOP-7
  category: StoreCategory | null; // null khi sản phẩm không có danh mục, hay danh mục của nó Ẩn (AC21, NFR8)
}
```

Ví dụ, để unit test của schema Zod ở `user` parse:

```json
{
  "id": "019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f",
  "name": "Áo thun cổ tròn",
  "slug": "ao-thun-co-tron",
  "price": 200000,
  "compareAtPrice": 250000,
  "availability": "IN_STOCK",
  "description": "Áo thun cotton 100%.",
  "updatedAt": "2026-11-22T02:15:30.000Z",
  "category": { "name": "Áo", "slug": "ao" }
}
```

Cách `user` dùng API này:

- **Chi tiết sản phẩm.** Schema Zod của `user` coi trường `category` vắng như `null`. Đó là trường hợp `user` mới gặp `api` của `v0.3.0` (NFR19).
- **Đọc danh mục.** `getStoreCategory` trả `null` cho 404. 5xx, lỗi mạng, hết 5 s hay một thân sai thì DAL ném lỗi, không bao giờ coi như "không có danh mục" hay danh sách trống (NFR20).
- **Kiểm slug trước khi gọi.** Mọi lệnh có slug chỉ được gửi sau khi slug qua `isStoreSlug`. Slug không qua thì DAL trả `null` ngay, không gửi lệnh nào (NFR9).

## Task List

Mỗi item ghi các mục sau:

- AC, khối của `design.md` và NFR;
- các bước theo thứ tự, mỗi bước kèm file code dự kiến, không tính file test, file JSON i18n và tài liệu;
- item phụ thuộc.

Đường dẫn của `api` bắt đầu từ `apps/api/src/main/java/com/tungph7/learnpostgres/`. Sau T1, ADM và USR chạy song song trong hai làn, mỗi làn một `fe-dev`.

### Phase 1: Nền

- [ ] T1: api: schema V7 và API của danh mục · be-dev · level heavy: V7 nâng database Production đang có sản phẩm, xóa danh mục đổi các sản phẩm đang có, và API của khách không được lộ danh mục Ẩn · effort xhigh: migration trên dữ liệu Production phải để `v0.3.0` chạy được sau rollback, và lần xóa danh mục chạy cùng lúc với lần gán sản phẩm (NFR15, NFR16)
  - TW1, TW2; phía `api` của AC1–AC10 và AC12–AC21. NFR2, NFR3, NFR7–NFR9, NFR11, NFR12, NFR14–NFR19, NFR22.
  - **Bước 1, migration:** V7 và các test ở mục Database Changes, kể cả lần chạy test sản phẩm không sửa trên V7. File: `apps/api/src/main/resources/db/migration/V7__create_categories.sql` (mới).
  - **Bước 2, slug dùng chung:** `Slugs` theo Tech Stack của SPEC, gồm bỏ dấu, `đ` thành `d`, cắt 100 ký tự, kiểm định dạng và hậu tố. `ProductSlugs` gọi nó, và `ProductSlugsTest` chạy không sửa. Unit test của `Slugs` có các ví dụ của Category Rules, kể cả `Áo khoác nữ` thành `ao-khoac-nu` và chữ dự phòng `danh-muc`. File: `common/text/Slugs.java` (mới), `feature/product/domain/ProductSlugs.java`.
  - **Bước 3, domain danh mục:** entity `Category`, với enum `CategoryStatus` lồng trong entity, và slug `@Type(CitextType.class)`. `CategoryRepository`: `existsById`, tên trùng trừ một `id`, slug trùng, slug trong một mảng ứng viên, id của danh mục `VISIBLE` theo slug, và xóa bằng một câu. `CategoryQueryRepository`: danh sách quản trị có số sản phẩm. DataJpa và integration test: thứ tự, số sản phẩm và tên trùng. File: `feature/category/domain/Category.java`, `repository/CategoryRepository.java`, `repository/CategoryQueryRepository.java`, đều mới.
  - **Bước 4, mã lỗi:** ba mã lỗi mới, tên của ba ràng buộc, và nhánh của `GlobalExceptionHandler` cho chúng, theo API Contract. Unit test của exception handler: thân lỗi không có tên ràng buộc, câu SQL hay giá trị của dòng (NFR11). File: `common/error/ErrorCode.java`, `common/error/ConstraintViolations.java`, `common/error/GlobalExceptionHandler.java`.
  - **Bước 5, API quản trị, thêm và danh sách:** `GET` và `POST /api/admin/categories`. WebMvc test cho 400 của từng giá trị sai của AC3 trong một phản hồi, 409 tên và 409 slug của AC4, và tên trường của phản hồi. Integration test cho hậu tố `-2` của AC4, và cho hai lần thêm cùng tên cùng lúc. File: `feature/category/controller/AdminCategoryController.java`, `service/AdminCategoryService.java`, `dto/` (`CreateCategoryRequest`, `AdminCategory`, `AdminCategoryListItem`, `ItemList`: bốn record nhỏ), đều mới.
  - **Bước 6, API quản trị, chi tiết, sửa và xóa:** theo API Contract. WebMvc test: 409 `OPTIMISTIC_LOCK_CONFLICT`, 404, và hai lần `DELETE` liền nhau đều trả 204. Integration test: xóa danh mục còn sản phẩm (AC8), và log có `productCount`. File: `AdminCategoryController.java`, `AdminCategoryService.java`, `dto/UpdateCategoryRequest.java` (mới).
  - **Bước 7, danh mục trong API quản trị sản phẩm:** entity `Product` map `category_id` là một `UUID`, không dùng `@ManyToOne`; `categoryId` trong lệnh thêm, lệnh sửa và chi tiết (Architecture Decisions 7).
    - WebMvc test với bốn trường hợp của `categoryId` trong lệnh sửa, và với `"abc"`.
    - Integration test chạy một lần gán và một lần xóa danh mục cùng lúc trên hai kết nối. Kết quả là 400 trên `categoryId`, hay sản phẩm về trống, và không lúc nào sản phẩm trỏ tới danh mục đã xóa (AC10, NFR15).
    - Mọi test sản phẩm đang có vẫn xanh.
    - File: `feature/product/domain/Product.java`, `dto/CreateProductRequest.java`, `dto/UpdateProductRequest.java`, `dto/AdminProduct.java`, `service/AdminProductService.java`, cùng kiểu bọc của `categoryId` nếu `be-dev` chọn cách đó.
  - **Bước 8, API danh mục của khách:** `GET /api/categories`, `GET` và `HEAD /api/categories/{slug}`, `GET /api/sitemap/categories`. WebMvc test so ba phản hồi 404 ở GET và ở HEAD (NFR8), và kiểm phản hồi không có `status`, `version` hay số sản phẩm. Integration test: điều kiện có sản phẩm `ACTIVE`, và `updatedAt` của sitemap (AC19). File: `feature/category/controller/StoreCategoryController.java`, `service/StoreCategoryService.java`, `dto/StoreCategory.java`, `dto/CategorySitemapEntry.java`, đều mới, và `repository/CategoryQueryRepository.java`.
  - **Bước 9, sản phẩm của một danh mục và danh mục trong chi tiết của khách:** `GET /api/categories/{slug}/products`; `Criteria` của `ProductQueryRepository` thêm `categoryId`; câu SQL của chi tiết của khách có `LEFT JOIN` (Architecture Decisions 8).
    - WebMvc test: 400 cho từng tham số sai, kể cả `RELEVANCE`; 404 như bước 8. Chi tiết của một sản phẩm thuộc danh mục Ẩn giống hệt chi tiết của một sản phẩm không có danh mục.
    - Integration test: thứ tự với sản phẩm cùng giá và cùng `created_at` (NFR17).
    - File: `feature/product/controller/StoreProductController.java`, `service/StoreProductService.java`, `repository/ProductQueryRepository.java`, `dto/StoreProduct.java`.
  - **Bước 10, hiệu năng:** integration test của NFR2 với 200 danh mục và 10.000 sản phẩm, một danh mục có 5.000.
    - Mỗi lệnh chạy 5 lần, lấy trung vị: dưới 200 ms cho lệnh đọc, dưới 300 ms cho lệnh ghi, dưới 1 s cho xóa danh mục có 5.000 sản phẩm.
    - Test đếm số câu SQL của từng lệnh, như Architecture Decisions 6.
    - Chỉ có file test.
  - Phụ thuộc: không.

### Checkpoint: Nền
- [ ] Test của `api` xanh, gồm test migration của V7, lần chạy test sản phẩm không sửa trên V7 ở bước 1, các câu lệnh của `v0.3.0` chạy lại trên V7, và NFR2.
- [ ] `/v3/api-docs` có mọi endpoint của API Contract, với các trường mới.
- [ ] Trên Development, bộ regression và mọi E2E của SHOP-7 pass với `admin` và `user` chưa đổi. Form sửa sản phẩm của SHOP-7 lưu được, nhờ Architecture Decisions 7.

### Phase 2: Quản trị và trang khách, song song

- [ ] ADM: Quản trị viên quản lý danh mục và chọn danh mục cho sản phẩm · fe-dev · level standard
  - Phạm vi:
    - AC1–AC4 và AC10;
    - phần ở `admin` của AC5–AC9: phần ở trang khách thuộc USR (Architecture Decisions 3);
    - nửa gọi thẳng API của AC3 và AC10, bằng request fixture qua `/api` của host `admin`.
  - Màn hình S1–S4. NFR5; NFR10 với tên `</script><script>alert(1)</script>` trong bảng, hộp thoại, toast và `<option>`; NFR12 (`retry.ts` không đổi); NFR19 (form luôn gửi `categoryId`); NFR20 (trạng thái lỗi của S1.4, S2.3 và S4.2).
  - **Bước 1, nền:**
    - `slugFromName` chuyển sang shared;
    - zone ESLint của `features/category`;
    - namespace i18n `category`;
    - model Zod theo API Contract, cả schema của form với các quy tắc của Category Rules;
    - các hàm API và hook TanStack Query của danh mục.

    Unit test của schema với các ví dụ ở API Contract. File: `src/lib/text/slug.ts` (mới), `src/features/product/model/product-form.ts`, `src/features/category/model/category.ts` (mới), `src/features/category/api/categories.ts` (mới), `eslint.config.js`, cùng khai báo namespace trong `src/lib/i18n/i18n.ts` và `i18next.d.ts`.
  - **Bước 2, S1 và S3:**
    - bảng danh mục có huy hiệu, số sản phẩm và các trạng thái đang tải, lỗi và trống;
    - mục Danh mục trên thanh điều hướng;
    - hộp thoại xóa dùng Dialog có sẵn: focus đầu ở Hủy, khối S3.4 chỉ hiện khi danh mục còn sản phẩm, và focus về nút Xóa của dòng khi đóng;
    - toast.

    File: `src/features/category/components/category-list.tsx`, `category-delete-dialog.tsx`, `src/app/routes/categories/categories-route.tsx`, đều mới; `src/app/routes.tsx`, `src/config/paths.ts`, `src/app/layouts/root-layout.tsx`.
  - **Bước 3, S2:**
    - form thêm và sửa với Field có sẵn;
    - slug tự điền cho tới khi sửa tay. Chưa sửa tay thì form gửi `slug: null`;
    - cảnh báo khi slug khác slug đã lưu (AC5), gửi `version`, và banner xung đột;
    - lỗi của API theo API Contract;
    - not-found và lỗi tải của chế độ sửa.

    File: `src/features/category/components/category-form.tsx`, `src/app/routes/categories/category-new-route.tsx`, `category-edit-route.tsx`, đều mới; `src/app/routes.tsx`.
  - **Bước 4, S4:**
    - ô `<select>` gốc nằm giữa ô Slug và ô Mô tả, với "Không có danh mục" đứng đầu và "(Ẩn)" bằng chữ;
    - form luôn gửi `categoryId`, và "Không có danh mục" là `null`;
    - lỗi của AC10: đọc lại danh sách lựa chọn, ô về "Không có danh mục", và lỗi ở lại cho tới khi chọn lại;
    - khi đang tải hay tải lỗi, ô khóa và nút Lưu khóa bằng `aria-disabled`.

    File: `src/features/product/api/get-category-options.ts` (mới), `src/features/product/model/product.ts`, `model/product-form.ts`, `components/product-form.tsx`, `api/create-product.ts`. `PRODUCT_FORM_FIELDS` có thêm `categoryId`.
  - **Bước 5, E2E:**
    - helper `e2e/support/categories.ts`, và `categoryId` trong `e2e/support/products.ts` (Architecture Decisions 13);
    - `e2e/categories.spec.ts` cho AC1–AC8, với nửa trống của AC1 mang tag `@local`;
    - `e2e/product-category.spec.ts` cho AC9 và AC10;
    - axe của S1, S2 và S3, sáng lẫn tối;
    - test của NFR10.

    Chỉ có file test.
  - Phụ thuộc: T1.
- [ ] USR: Khách xem trang danh mục và danh mục của sản phẩm · fe-dev · level standard · seo: S5, S6, S7, S8
  - Phạm vi:
    - AC12–AC21;
    - phần ở trang khách của AC5–AC9: H1 mới, đường dẫn mới, 404, liên kết, breadcrumb và sitemap, trong vòng 60 s, sau khi thao tác qua API quản trị.
  - Màn hình S5–S8, và toàn bộ mục SEO của SPEC: chữ, title theo bậc, meta, canonical, hreflang, `noindex` của danh mục trống, BreadcrumbList và sitemap. NFR3, NFR4 (`qa` đo trên Staging), NFR6, NFR7, NFR8, NFR9, NFR10, NFR19, NFR20.
  - **Bước 1, nền:**
    - `isStoreSlug` chuyển sang shared;
    - zone ESLint của `features/category`;
    - model Zod: `StoreCategory`, `ItemList`, `CategorySitemapEntry`, và `category` trong `StoreProduct`, vắng thì là `null`;
    - DAL `getStoreCategory`, `getStoreCategories` và `getCategorySitemapEntries`, mỗi hàm với `'use cache'` và `cacheLife('catalog')`;
    - `getStoreProducts` nhận nguồn đọc là một danh mục.

    Unit test của DAL: 404 thì `null`; 500, quá 5 s và thân sai thì ném lỗi; slug `..`, `%2F` và `%E0` thì không gửi lệnh nào; chỉ gửi GET. File: `src/lib/validation/store-slug.ts` (mới), `src/features/product/model/product.ts`, `src/features/category/model/category.ts` (mới), `src/features/category/server/get-categories.ts` (mới), `src/features/product/server/get-products.ts`, cùng `eslint.config.mjs`.
  - **Bước 2, S5:**
    - route `/[locale]/categories/[slug]` với `generateMetadata` theo mục SEO (Architecture Decisions 10);
    - Breadcrumb dùng chung và JSON-LD từ cùng danh sách mục;
    - lưới, sắp xếp không có Liên quan nhất, Xem thêm và dòng tiến độ của SHOP-7, dùng lại component có sẵn với nguồn là danh mục, và không có ô tìm;
    - trạng thái trống S5.9 và S5.10;
    - CSS của Breadcrumb.

    File: `src/app/[locale]/categories/[slug]/page.tsx` (mới), `src/components/ui/breadcrumb.tsx` (mới), `src/features/product/components/product-results.tsx`, `product-filters.tsx`, `src/styles/components.css`.
  - **Bước 3, S6 và Proxy:**
    - bước kiểm của Proxy và route `/[locale]/category-not-found`;
    - một component S6 dùng chung cho route đó và cho `not-found.tsx` của trang danh mục.

    Unit test của Proxy: `api` trả 200, 404, 500 và quá 5 s; slug `..`, `%2F` và `%E0`; chỉ gửi HEAD; prefetch không gửi lệnh. File: `src/proxy.ts`, `src/app/[locale]/category-not-found/page.tsx`, `src/app/[locale]/category-not-found/not-found.tsx`, `src/app/[locale]/categories/[slug]/not-found.tsx`, `src/features/category/components/category-not-found.tsx`. Bốn file sau đều mới.
  - **Bước 4, S7, S8 và sitemap:**
    - hàng liên kết trong cùng `<Suspense>` với kết quả (Architecture Decisions 11);
    - breadcrumb và `BreadcrumbList` của trang chi tiết, đặt trên liên kết "← Sản phẩm" (S8.3); khối `Product` giữ nguyên;
    - các danh mục trong sitemap (Architecture Decisions 12).

    Render test của S7 khi lệnh danh mục lỗi. Unit test của sitemap. File: `src/features/category/components/category-links.tsx` (mới), `src/app/[locale]/products/page.tsx`, `src/app/[locale]/products/[slug]/page.tsx`, `src/app/sitemap.ts`.
  - **Bước 5, chữ, tài liệu và E2E:**
    - chữ vi và en của mục SEO và `design.md` trong `messages/{vi,en}.json`;
    - Breadcrumb và Hàng liên kết danh mục trong `docs/design-system/user.md`;
    - helper `e2e/support/categories.ts`, và `categoryId` trong `e2e/support/products.ts`;
    - `e2e/category-page.spec.ts` cho AC12–AC16;
    - `e2e/category-links.spec.ts` cho AC17;
    - `e2e/category-seo.spec.ts` cho AC18 và AC19, đọc HTML thô theo tám điểm "Kiểm" của mục SEO, S5;
    - `e2e/product-breadcrumb.spec.ts` cho AC20 và AC21;
    - `e2e/category-sync.spec.ts` cho phần trang khách của AC5–AC9;
    - axe của S5, S6 và S8 ở hai ngôn ngữ, sáng lẫn tối;
    - 320 px không có thanh cuộn ngang;
    - test của NFR10.

    E2E của AC16 kiểm `response.status()` là 404 trên bản build và trên Development. Bước này không có file code.
  - Phụ thuộc: T1.

### Checkpoint: Hoàn tất
- [ ] E2E của AC1–AC21, trừ AC11 đã bỏ, pass trên Development, ở cả `admin` lẫn `user`.
- [ ] Mọi E2E của SHOP-7 vẫn pass.
- [ ] `pnpm run build` của `user` không gọi `api`. Bản build trả 404 thật cho AC16.
- [ ] NFR1–NFR23 và mục SEO đạt, mỗi mục theo cách kiểm của nó. `qa` ghi số đo NFR4 vào báo cáo QA của USR, và số đo NFR5 vào báo cáo QA của ADM.
- [ ] Sẵn sàng cắt `v0.4.0` ở gate ④. Ở gate ⑤, bạn xác nhận bản backup mới nhất của Production cách đó không quá 24 giờ (NFR21).

## New Libraries

Không có.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `postgres:17-alpine` không có dữ liệu ICU của `vi`, nên V7 dừng ở bước kiểm collation | Medium | Test đầu tiên của T1, bước 1, cho biết ngay, trước Development. Khi đó `be-dev` comment `Cần sa:` trên T1, và `sa` đổi plan và ADR-0005 sang đường lui của Tech Stack trong SPEC: `ORDER BY app.search_fold(name), name, id`, và UNIQUE trên tên do `api` gấp về chữ thường. Với đường lui, "đ" xếp lẫn với "d", và plan ghi rõ chỗ khác đó |
| V7 lỗi trên Production, hay `v0.3.0` không chạy được sau rollback | High | V7 chỉ thêm. Test của bước 1 chạy V7 trên dữ liệu giống Production, và chạy code `v0.3.0` trên V7. Lần deploy lên Development rồi Staging chạy V7 trước Production. Bản backup không quá 24 giờ ở gate ⑤ |
| Ba item lớn làm PR dài, review lâu và nhiều vòng sửa hơn | Medium | Các bước của Task List, mỗi bước khoảng 5 file và xanh trước bước sau. `reviewer` đọc theo commit. Bạn đã chọn giữ 3 item (Architecture Decisions 1) |
| Một lần gán sản phẩm chạy cùng lúc với lần xóa danh mục thành 500, hay để lại sản phẩm trỏ tới danh mục đã xóa | High | Khóa ngoại là chốt cuối (ADR-0004). Vi phạm `products_category_fk` thành 400 trên `categoryId`. Integration test hai kết nối ở bước 7 của T1 |
| Danh mục Ẩn lộ ra ở trang khách: trong JSON-LD, chữ ẩn hay một 404 khác | High | API của khách lọc `VISIBLE` trong SQL. WebMvc test so ba phản hồi 404 và so chi tiết sản phẩm. E2E của AC16 và AC21 tìm tên danh mục Ẩn trong HTML thô. `security` review cả ba PR |
| Slug trên đường dẫn của khách đi tới một đường dẫn khác của `api`, như `/api/admin/categories` | Medium | `isStoreSlug` ở cả Proxy lẫn DAL, trước mọi lệnh. Unit test với `..`, `%2F` và `%E0` (NFR9) |
| Một tab `admin` mở từ trước khi deploy, hay form của SHOP-7 trên Development giữa lúc T1 và ADM merge, xóa mất danh mục của sản phẩm | Medium | Vắng `categoryId` là giữ danh mục đang có (Architecture Decisions 7), có WebMvc test ghim |
| Hai Story chạy E2E cùng lúc trên Development dùng chung, đụng dữ liệu của nhau | Medium | Tên `E2E <runId>`. Test chỉ kiểm danh mục và sản phẩm của lần chạy đó, và dọn những gì nó tạo (Architecture Decisions 13) |
| Cache của Next giữ danh mục cũ quá 60 s | Medium | Profile `catalog`: tối đa 25 s cộng 30 s. Proxy không cache. E2E của phần trang khách của AC5–AC9 chờ tới 60 s |
| Hàng liên kết làm trang Sản phẩm chậm hay xô lệch | Low | Hàng được đọc song song với khối sản phẩm đầu, trong cùng `<Suspense>`. `qa` đo NFR4 trên Staging |

## Open Questions

Không có. Ngày 2026-11-21 bạn trả lời câu duy nhất, về ba item lớn hơn mức 5 file: giữ 3 item. Câu trả lời đã thành quyết định ở Architecture Decisions 1.

Câu hỏi mới ở các item của Epic: agent làm theo đề xuất của mình và ghi quyết định vào artifact của chặng đó. Agent chỉ hỏi bạn những việc cần quyền mà agent không có.
