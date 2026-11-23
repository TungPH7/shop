# Implementation Plan: Thứ tự hiển thị danh mục

> **Epic:** SHOP-95 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-95 · **Spec:** [spec.md](spec.md) · **Design:** [design.md](design.md) · **Tasks:** tracked in Jira under SHOP-95

## Overview

Plan có đúng hai item, mỗi item một PR, chia theo lớp như mục Constraints của SPEC. Hai item làm lần lượt:

1. **Story 1, nền** (`be-dev`, bỏ review): migration V8 thêm cột thứ tự, API quản trị nhận và trả số thứ tự, và hai danh sách mà người dùng thấy xếp theo số đó. Khi Story 1 merge, `admin` và `user` chưa đổi dòng code nào, nhưng AC4, AC6, AC7 và AC8 đã đúng trên Development, vì cả hai app hiện danh sách đúng thứ tự mà `api` trả.
2. **Story 2, giao diện `admin`** (`fe-dev`, có review như mặc định): ô Thứ tự hiển thị trong form thêm và sửa (S2), và cột thứ tự trong bảng danh mục (S1). Story này mang AC1, AC2, AC3, AC5, và phần cột S1.4 của AC8.

Bản release đầu tiên có Epic mang cả hai Story lên Production. Đó là `v0.4.0` nếu bản đó được cắt sau khi hai Story merge, cùng với SHOP-81, hay `v0.5.0` nếu không. V8 chỉ là bước expand, và Epic không cần bước contract (Database Changes).

Mã item trong plan (Story 1, Story 2) là mã tạm. `ba` tạo các item trên Jira, rồi thêm key của mỗi item vào trước mã tạm của nó ở Task List.

## Architecture Decisions

1. **Hai item theo lớp, và Story 1 lớn hơn mức 5 file code.** SPEC đặt đúng hai item (Constraints), và bạn đã duyệt điều đó cùng bản nháp Epic. Story 2 có 5 file code. Story 1 có 8 file code, không tính file test: một file SQL, entity, hai DTO request, hai DTO response, repository và service. Bốn DTO là record vài dòng.
   - Task List chia Story 1 thành bốn bước theo thứ tự. Mỗi bước có tối đa 4 file code, là một commit hay vài commit, và để build, lint, typecheck và test của `api` xanh trước khi sang bước sau.
   - Plan không tách thêm item, vì hai item là điều kiện của lượt chạy thử review theo item. Vì vậy lượt review sau merge không đòi tách Story 1 chỉ vì nó quá 5 file.
2. **Chia AC giữa hai item**, theo đề xuất của SPEC và cách kiểm AC8 của `design.md`:
   - Story 1 mang AC4, AC6, AC7 và AC8. Các tiêu chí đó đúng ngay khi `api` xếp theo số thứ tự, không cần đổi giao diện: AC6 đọc ô Danh mục của form sản phẩm (S4.2 của SHOP-81), AC7 và AC8 đọc các liên kết danh mục ở `/vi/products` và `/en/products` (S7.4 của SHOP-81). Nửa `admin` của AC8 kiểm số 0 qua `GET /api/admin/categories`, và thứ tự theo tên trên các dòng của bảng S1 hiện có.
   - Story 2 mang AC1, AC2, AC3, AC5, và nửa "cột hiện 0" của AC8 ở S1.4, vì chỉ Story 2 có cột đó.
   - Phía `api` của AC1, AC2, AC3 và AC5 (lưu, trả và xếp theo số) được kiểm ở Story 1 bằng WebMvc test và integration test. E2E của chúng thuộc Story 2.
3. **Story 1 là một Story, dù chỉ có `be-dev`.** Nó giao trọn US2 (AC7, AC8) và AC6 cho người dùng mà không cần FE, nên `qa` kiểm nó theo AC trên Development như mọi Story. Không có Sub-task.
4. **Một thứ tự, viết ở một chỗ** (NFR11, ADR-0006). `CategoryQueryRepository` có một hằng `" ORDER BY c.display_order, c.name, c.id"`, dùng cho `findAdminList` và `findStoreList`. `c.name` giữ collation `app.vi_ci` của cột, nên cùng số thì xếp theo tên tiếng Việt như SHOP-81. `findSitemap` giữ `ORDER BY c.id` (Scope: Out). Không chỗ nào khác xếp lại danh sách danh mục, ở `api` cũng như ở hai app.
5. **Số thứ tự ở biên API** (NFR7), như giá ở quyết định 7 của plan SHOP-7:
   - `CreateCategoryRequest` và `UpdateCategoryRequest` đọc `displayOrder` thành `BigDecimal` có thể `null`, với `@Digits(integer = Integer.MAX_VALUE, fraction = 0, message = "must be a whole number")`, `@Min(value = 0, message = "must be at least 0")` và `@Max(value = 9999, message = "must be at most 9999")`. Nhờ vậy 1.5 là lỗi trường, không bị Jackson cắt còn 1, và 99999999999 là lỗi "at most", không phải 500. Lỗi của trường này nằm cùng 400 với các trường sai khác.
   - Một giá trị không phải số, như `"abc"`, là 400 `MALFORMED_REQUEST` mà `GlobalExceptionHandler` đang trả cho thân không đọc được, như giá. Plan chọn cách này thay cho lỗi trên trường: không thêm kiểu hay deserializer nào, và form của `admin` luôn gửi một số.
   - Một chuỗi số, như `"5"`, `api` đọc như với giá, theo cấu hình Jackson của dự án. Hợp đồng chỉ định nghĩa số của JSON. Dù Jackson đọc chuỗi đó thế nào, `api` không làm tròn, không lưu số ngoài 0–9999 và không trả 500.
   - Vắng và `null` là như nhau, nên không cần kiểu bọc phân biệt hai trường hợp như `categoryId` của plan SHOP-81. Service đổi số hợp lệ sang `int` bằng `intValueExact()`.
6. **Thêm cho 0, sửa giữ số** (AC4, NFR7, NFR12). Entity `Category` map `display_order` thành một `int`, và constructor nhận thêm số thứ tự.
   - `AdminCategoryService.create` truyền số đã gửi, hay 0 khi vắng.
   - `AdminCategoryService.update` chỉ gọi `setDisplayOrder` khi trường có giá trị. Hibernate ghi mọi cột trong UPDATE (entity không có `@DynamicUpdate`), nên khi trường vắng nó ghi lại đúng số đã đọc.
   - Một lệnh sửa chỉ đổi số thứ tự là một UPDATE bình thường: `version` tăng, trigger đặt `updated_at`, và `lastmod` của danh mục trong sitemap đổi theo (NFR13).
7. **Không có index cho thứ tự** (NFR2). V8 không thêm index nào. `CategoryPerformanceIntegrationTest` đo lại các ngưỡng của NFR3 với số thứ tự trải từ 0 tới 9.
8. **Database là chốt sau `api`** (NFR9). `api` kiểm số trước khi ghi, nên không lệnh nào của nó vi phạm `categories_display_order_range`. `ConstraintViolations` và `GlobalExceptionHandler` không thêm nhánh nào cho ràng buộc này.
9. **`admin`** (Story 2):
   - `adminCategorySchema` có `displayOrder` bắt buộc, số nguyên 0–9999. Một phản hồi thiếu trường này, từ một `api` trước Epic trong lúc chuyển bản, là lỗi tải của S1 hay S2 có nút "Thử lại", không bao giờ hiện "0" thay cho nó (NFR12).
   - Ô S2.3 giữ chữ đã gõ. Schema của form bỏ khoảng trắng đầu và cuối, kiểm theo phần validation của S2.3, rồi đổi thành số. Body của lệnh thêm và lệnh sửa luôn có `displayOrder`.
   - `CATEGORY_FORM_FIELDS` thêm `displayOrder`, sau `name` và `slug`, nên lỗi 400 của `api` trên trường này hiện dưới S2.3 với câu "Thứ tự là số nguyên từ 0 đến 9999" (S2.3, trạng thái api-invalid), và focus theo thứ tự Tên, Slug, Thứ tự.
   - Cache giữ như `useInvalidateCategories`: một lần thêm hay sửa làm mới mọi query có khóa bắt đầu bằng `categories`, gồm bảng S1 và ô Danh mục của form sản phẩm (NFR5). Feature `product` không đổi: schema lựa chọn danh mục của nó không strict, nên nó bỏ qua trường mới, và thứ tự của các lựa chọn đến từ `api`.
10. **Dữ liệu của E2E** (TW3):
    - Helper danh mục của `apps/admin/e2e/support/` và `apps/user/e2e/support/` nhận `displayOrder` không bắt buộc, và chỉ gửi trường đó khi test đặt nó. Danh mục của test không cần số thì không gửi số, như AC8.
    - Development dùng chung, nên mỗi test chỉ so thứ tự tương đối giữa các danh mục của lần chạy đó (tên kết thúc bằng `E2E <runId>`). Danh mục khác của môi trường có thể nằm xen giữa.
    - E2E của Epic nằm trong file mới `category-order.spec.ts` (Story 1, ở `admin` và `user`) và `category-order-form.spec.ts` (Story 2, ở `admin`). E2E của SHOP-81 cũng có test tên bắt đầu bằng AC5–AC8 (`apps/user/e2e/category-sync.spec.ts`, `apps/admin/e2e/categories.spec.ts`), nên khi chạy E2E của một tiêu chí của Epic này, lệnh nêu cả file, như `pnpm exec playwright test --project=admin e2e/category-order.spec.ts -g "AC6"`.
    - Mọi E2E của SHOP-81 vẫn pass. Chỉ helper `expectCells` của `apps/admin/e2e/categories.spec.ts` đổi ở Story 2: nó thêm ô `'0'` trước ô Thao tác, một chỗ sửa cho cả 8 lần gọi, vì danh mục của các test đó không đặt số (AC8).
11. **Design system.** Không có Task "Design system của admin": `design.md` không có mục "mới", và `docs/design-system/admin.md` đã có. Story 2 chỉ dùng `InputField`, `.field-hint`, `.field-error`, `.table__num` và `.skeleton` có sẵn, nên không sửa `docs/design-system/admin.md`.
12. **SEO.** SPEC không có mục `## SEO`, và `design.md` không có màn hình nào của app `seo: true`: S1 và S2 thuộc `admin` (`seo: false`). Vì vậy không item nào có `seo:`. Các liên kết danh mục của `user` chỉ đổi thứ tự, không đổi chữ, liên kết hay metadata.
13. **Level và effort.** Story 1 là `heavy`: V8 nằm trong `db/migration/`, một đường dẫn critical, nên PR của nó là heavy dù nhãn nói gì, và một lỗi ở lệnh sửa làm mất số mà quản trị viên đã đặt. Story 1 không có effort `xhigh`: V8 chỉ là một `ADD COLUMN` có DEFAULT, mỗi quy tắc khó (1.5, vắng trường, bản trước trên V8) có test ghim trong Task List, và Epic có trần chi phí 30–50 USD. Story 2 là `standard`: form và bảng của `admin`, sau basic auth, với `api` và database là chốt cuối.

Không đổi: stack và phiên bản ở Tech Stack của SPEC, `deploy.yaml`, secret, biến môi trường, CSP, dependency của ba app (NFR8, NFR14), và `apps/user/src/`.

## Database Changes

### Bản release đầu tiên có Epic: V8, bước expand

File `apps/api/src/main/resources/db/migration/V8__add_category_display_order.sql` (Story 1, bước 1). Flyway chạy cả file trong một transaction. File không sửa V1–V7 và không đụng `app.products` (NFR10).

| Thay đổi | Chi tiết |
|---|---|
| Thời hạn chờ khóa | `SET LOCAL lock_timeout = '5s';` ở đầu file. Nếu một transaction dài đang giữ `app.categories`, V8 lỗi sau 5 s và lần deploy dừng, thay vì mọi lệnh đọc danh mục xếp hàng sau nó. Flyway lùi cả V8, nên lần deploy sau chạy lại V8 từ đầu |
| Cột `app.categories.display_order` | `ALTER TABLE app.categories ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0 CONSTRAINT categories_display_order_range CHECK (display_order BETWEEN 0 AND 9999);` Một lệnh, không UPDATE dòng nào. DEFAULT là hằng số, nên PostgreSQL 17 không viết lại bảng, chỉ đọc các dòng có sẵn để kiểm CHECK (NFR9) |
| Không UNIQUE, không index | Nhiều danh mục cùng số được (ADR-0006). Không index cho thứ tự (NFR2) |
| `COMMENT ON COLUMN` | Cho cột mới: số nhỏ hiện trước, cùng số thì theo tên rồi `id`, chỉ `admin` thấy, như các comment của V7 |
| `app._app_migration_log` | Một dòng cho V8, như V7 |
| Giữ nguyên | Mọi cột, ràng buộc, trigger và index có sẵn của `app.categories` và `app.products`. `updated_at`, `updated_by` và `version` của mọi danh mục không đổi, vì V8 không UPDATE dòng nào: lần deploy không đổi `lastmod` nào của sitemap, và một form sửa mở từ trước không nhận 409 chỉ vì V8 |

V8 khóa `app.categories` (ACCESS EXCLUSIVE) tới hết transaction, nên trong lúc đó mọi lệnh đọc danh mục và mọi lệnh ghi sản phẩm có danh mục phải chờ. Với 200 danh mục, V8 xong trong 1 s (NFR10).

Bản `api` trước Epic chạy đúng trên V8, trong lúc chuyển bản và sau một lần rollback. Bản đó là `v0.3.0` của Production, hay bản có SHOP-81 nếu bản đó lên Production trước Epic này:

- Flyway của nó bỏ qua V8 như migration "future" (mặc định `*:future`; `application*.yml` không đặt `ignore-migration-patterns`).
- `ddl-auto: validate` không xét cột mà entity không map.
- `v0.3.0` không đọc `app.categories`.
- Entity `Category` của SHOP-81 viết INSERT và UPDATE với danh sách cột tường minh, không có `display_order`. Danh mục nó thêm nhận 0 từ DEFAULT, và danh mục nó sửa giữ số đang có.
- Sau rollback, các số đã đặt còn nguyên trong database, và hiện lại khi bản có Epic lên lại (NFR14).

Kiểm, ở bước 1 của Story 1, bằng Testcontainers PostgreSQL 17 (`postgres:17-alpine` theo digest của `deploy.yaml`), trong `V8AddCategoryDisplayOrderMigrationTest`, cạnh `V7CreateCategoriesMigrationTest`:

- **Cột và ràng buộc.** `display_order` là `integer`, `NOT NULL`, mặc định 0, có CHECK `categories_display_order_range` và comment. Ghi thẳng -1, 10000 và `NULL` bằng SQL thì database từ chối từng giá trị. 0 và 9999 được nhận (NFR9).
- **Dữ liệu có sẵn.** Trên schema V7 có 200 danh mục và có sản phẩm, V8 chạy dưới 1 s. Mọi danh mục có số 0. `updated_at`, `updated_by` và `version` của mọi danh mục không đổi. Danh sách quản trị và danh sách của khách, đọc trước và sau V8, ra cùng thứ tự (AC8, NFR10). Có một dòng V8 trong `app._app_migration_log`.
- **Bản trước Epic.**
  - Ở bước 1, chưa file Java nào đổi: `git diff origin/develop -- apps/api/src/main` chỉ có file V8. Vì vậy toàn bộ test danh mục và sản phẩm đang có chạy không sửa trên V8 là lần chạy code của SHOP-81 trên schema mới. `be-dev` ghi SHA của commit bước 1 và kết quả lần chạy đó vào mô tả PR.
  - Để kiểm này còn sau khi `Category` đổi, test chạy lại câu INSERT và câu UPDATE mà Hibernate của SHOP-81 viết cho `Category`, chép từ log SQL ở bước 1, trên một danh mục có số 7: INSERT cho số 0, UPDATE giữ số 7. Đó là cách `V7CreateCategoriesMigrationTest` đã làm với câu của `v0.3.0`.
  - Flyway chỉ với V1–V7, và Flyway của `v0.3.0` (`flywayOfV030` của `MigrationDatabase`), chạy `validate()` được và không migrate gì trên database đã có V8. `MigrationDatabase` thêm một hàm cho Flyway V1–V7, theo mẫu `flywayOfV030`.

### Không có bước contract

V8 chỉ thêm một cột có DEFAULT và một CHECK. Nó không thay, đổi kiểu hay bỏ cột nào, và DEFAULT 0 là quy tắc lâu dài cho danh mục thêm mà không gửi số (Category Rules). Không bản sau nào phải gỡ gì của V8.

## API Contract

Hợp đồng này chỉ ghi phần đổi so với API Contract của plan SHOP-81 (`ItemList<T>`, `CategoryStatus`, Problem Details, `VALIDATION_FAILED` với `errors`, `MALFORMED_REQUEST`). Story 1 làm phía `api`. Story 2 đọc nó cho `admin`, và helper E2E của hai app dùng API quản trị.

### API quản trị danh mục: `/api/admin/categories`

Đi qua `/api/*` của host `admin`, sau basic auth, như SHOP-81. Không thêm endpoint, mã lỗi hay lệnh ghi nào (NFR6).

```ts
/** Số thứ tự hiển thị: số nguyên 0–9999, số nhỏ hiện trước, nhiều danh mục cùng số được (ADR-0006). */
type DisplayOrder = number;

interface AdminCategory {
  id: Uuid;
  name: string;
  slug: string;
  status: CategoryStatus;
  displayOrder: DisplayOrder;    // mới, luôn có; danh mục có trước Epic là 0
  createdAt: Instant;
  updatedAt: Instant;
  version: number;
}

interface AdminCategoryListItem extends AdminCategory {
  productCount: number;
}

interface CreateCategoryInput {
  name: string;
  slug?: string | null;
  status?: CategoryStatus;
  displayOrder?: DisplayOrder | null;   // mới: vắng hay null là 0
}

interface UpdateCategoryInput {
  name: string;
  slug: string;
  status: CategoryStatus;
  displayOrder?: DisplayOrder | null;   // mới: vắng hay null là giữ số đang có
  version: number;
}
```

| Endpoint | Thay đổi |
|---|---|
| `GET /api/admin/categories` | Mỗi mục có `displayOrder`. Các mục xếp theo `displayOrder` tăng dần, rồi `name` theo `app.vi_ci`, rồi `id`, kể cả danh mục Ẩn (AC5) |
| `POST /api/admin/categories` | Nhận `displayOrder`; vắng hay `null` thì là 0 (AC1, AC4). 201 `AdminCategory` có `displayOrder` |
| `GET /api/admin/categories/{id}` | `AdminCategory` có `displayOrder` |
| `PUT /api/admin/categories/{id}` | Nhận `displayOrder`; vắng hay `null` thì giữ số đang có, không bao giờ đặt về 0 (AC4). 200 `AdminCategory` có `displayOrder` và `version` mới. Hai lệnh sửa cùng `version` vẫn là 409 `OPTIMISTIC_LOCK_CONFLICT` cho lệnh sau, kể cả khi cả hai chỉ đổi số (NFR12) |
| `DELETE /api/admin/categories/{id}` | Không đổi |

Giá trị của `displayOrder` trong `POST` và `PUT`:

| Gửi | Kết quả |
|---|---|
| Vắng, `null` | `POST`: 0. `PUT`: giữ số đang có |
| Số nguyên của JSON từ 0 tới 9999, như `0`, `7`, `9999` | Lưu đúng số đó |
| `-1` | 400 `VALIDATION_FAILED`, một mục `{ field: "displayOrder", message: "must be at least 0" }` trong `errors` |
| `10000`, `99999999999` | 400 `VALIDATION_FAILED`, `{ field: "displayOrder", message: "must be at most 9999" }` |
| `1.5` | 400 `VALIDATION_FAILED`, `{ field: "displayOrder", message: "must be a whole number" }`. Không làm tròn, không cắt |
| `"abc"`, hay giá trị khác mà Jackson không đọc được thành số | 400 `MALFORMED_REQUEST`, không nêu trường (Architecture Decisions 5). Không bao giờ 500 |

- Mọi lỗi trường của một lệnh nằm trong cùng một 400, cùng với lỗi của `name` và `slug` (AC3 của SHOP-81). Một số vừa âm vừa lẻ, như `-1.5`, cho hai mục trên `displayOrder`. Không lệnh 400 nào lưu gì.
- Thứ tự kiểm giữ như plan SHOP-81: lỗi trường (400) đến trước mọi lỗi khác.
- Log INFO của lệnh thêm và sửa giữ như SHOP-81. Log không ghi thân request.

### API danh mục của khách: `/api/categories` và `/api/sitemap/categories`

- `GET /api/categories`: thân không đổi, `ItemList<StoreCategory>` với `StoreCategory { name; slug }`, không có số thứ tự (NFR6). Các mục xếp theo `display_order`, rồi `name` theo `app.vi_ci`, rồi `id`, vẫn chỉ gồm danh mục Hiện có sản phẩm Đang bán (AC7, AC8).
- `GET` và `HEAD /api/categories/{slug}`: không đổi.
- `GET /api/sitemap/categories`: không đổi, `CategorySitemapEntry { slug; updatedAt }`, vẫn theo `id` (Scope: Out). `updatedAt` của một danh mục tiến lên khi số thứ tự của nó đổi (NFR13).

### OpenAPI

`/v3/api-docs` mô tả `displayOrder` (NFR7):

- trong `CreateCategoryRequest` và `UpdateCategoryRequest`: `type: integer`, `format: int32`, `minimum: 0`, `maximum: 9999`, `nullable: true`, không bắt buộc, với mô tả "vắng hay null: 0 khi thêm, giữ số đang có khi sửa". `@Schema` trên trường `BigDecimal` ghi kiểu `integer`, để OpenAPI không nói `number`;
- trong `AdminCategory` và `AdminCategoryListItem`: `integer`, bắt buộc.

### Cách `admin` hiện lỗi của trường mới

- Form kiểm S2.3 trước khi gửi, theo phần validation của S2.3: trống hay chỉ có khoảng trắng là "Nhập thứ tự hiển thị"; mọi giá trị sai khác là "Thứ tự là số nguyên từ 0 đến 9999". Lỗi của form không làm hiện banner S2.4.
- 400 `VALIDATION_FAILED` có mục `displayOrder`: câu "Thứ tự là số nguyên từ 0 đến 9999" dưới S2.3, giữ những gì đã nhập, focus về ô sai đầu tiên theo thứ tự Tên, Slug, Thứ tự.
- 400 `MALFORMED_REQUEST`: lỗi chung của S2.4, như mọi 400 không nêu trường nào của form. Form luôn gửi một số, nên lỗi này không xảy ra khi dùng bình thường.

## Task List

Mỗi item ghi:

- AC, khối của `design.md` và NFR;
- các bước theo thứ tự, mỗi bước kèm file code dự kiến, không tính file test, file JSON i18n và tài liệu;
- item phụ thuộc.

Đường dẫn của `api` bắt đầu từ `apps/api/src/main/java/com/tungph7/learnpostgres/feature/category/`. Đường dẫn của `admin` bắt đầu từ `apps/admin/`.

### Phase 1: Nền

- [ ] SHOP-96 Story 1: Danh mục xếp theo số thứ tự: cột thứ tự, API quản trị và các danh sách · be-dev · level heavy: V8 nâng `app.categories` đang có dữ liệu và nằm trong `db/migration/`, một đường dẫn critical; một lỗi ở lệnh sửa làm mất số mà quản trị viên đã đặt · review: skip
  - AC4, AC6, AC7, AC8 (Architecture Decisions 2); phía `api` của AC1, AC2, AC3 và AC5. Không có khối nào của `design.md`: các màn hình mà Story này đổi thứ tự là S4.2 và S7.4 của SHOP-81, và chúng không đổi giao diện. TW1, TW2, TW3. NFR1–NFR3, NFR5 (phần `user`), NFR6–NFR15.
  - **Bước 1, migration:** V8 và các test ở mục Database Changes, kể cả lần chạy test danh mục và sản phẩm không sửa trên V8. File: `apps/api/src/main/resources/db/migration/V8__add_category_display_order.sql` (mới).
  - **Bước 2, đọc và xếp:** entity `Category` map `display_order` (`int`, constructor nhận thêm số); `AdminRow` có `displayOrder`; hằng thứ tự của Architecture Decisions 4 cho danh sách quản trị và danh sách của khách; `AdminCategory` và `AdminCategoryListItem` trả `displayOrder`.
    - Integration test (`CategoryQueryRepositoryIntegrationTest`): bốn danh mục của AC5 ra "Quần", "Bao tay", "Đầm", "Áo" ở cả hai danh sách, danh mục Ẩn có trong danh sách quản trị; ba danh mục số 0 của AC8 ra theo tên; số 9 đứng trước số 10; bảy tên của NFR17 của SHOP-81 ở cùng một số ra đúng thứ tự tên; sitemap vẫn theo `id` (NFR11).
    - WebMvc test (`StoreCategoryControllerWebMvcTest`): mỗi phần tử của `GET /api/categories` chỉ có đúng hai khóa `name` và `slug`, và mỗi mục của sitemap chỉ có `slug` và `updatedAt` (NFR6).
    - WebMvc test của danh sách và chi tiết quản trị: mỗi danh mục có `displayOrder`.
    - File: `domain/Category.java`, `repository/CategoryQueryRepository.java`, `dto/AdminCategory.java`, `dto/AdminCategoryListItem.java`.
  - **Bước 3, ghi:** `displayOrder` trong hai DTO request, theo Architecture Decisions 5, với `@Schema` của mục OpenAPI; thêm cho 0, sửa giữ số (Architecture Decisions 6).
    - Unit test viết theo TDD cho quy tắc kiểm của hai record: 0 và 9999 hợp lệ; -1, 10000, 1.5 và 99999999999 sai, mỗi giá trị đúng câu của API Contract; vắng và `null` hợp lệ.
    - WebMvc test của AC4 (`AdminCategoryControllerWebMvcTest`, `AdminCategoryEditWebMvcTest`), ở cả lệnh thêm lẫn lệnh sửa: 400 Problem Details nêu `displayOrder` cho -1, 10000, 1.5 và 99999999999, cùng lỗi của tên trống trong một phản hồi; `"abc"` là 400 `MALFORMED_REQUEST`; service không được gọi khi có lỗi.
    - Integration test (`AdminCategoryServiceIntegrationTest`, `AdminCategoryEditIntegrationTest`): thêm không gửi số, hay gửi `null`, được 0; thêm với 5 được 5; sửa tên một danh mục số 7 mà không gửi số, hay gửi `null`, giữ 7; sửa chỉ số thứ tự làm `version` tăng 1 và `updated_at` mới hơn (NFR13); hai lệnh sửa cùng `version` chỉ đổi số thì lệnh sau là 409 (NFR12).
    - `CategoryPerformanceIntegrationTest` nạp 200 danh mục với số thứ tự từ 0 tới 9, nhiều danh mục cùng số, và pass với các ngưỡng của NFR3 không nới, kể cả một lệnh sửa chỉ đổi số. Mỗi danh sách vẫn là đúng một câu SQL.
    - `CategoryApiDocsIntegrationTest`: `displayOrder` trong request và response như mục OpenAPI.
    - File: `dto/CreateCategoryRequest.java`, `dto/UpdateCategoryRequest.java`, `service/AdminCategoryService.java`.
  - **Bước 4, dữ liệu và E2E:** chỉ có file test.
    - Helper `createCategory` của `apps/admin/e2e/support/categories.ts` và `apps/user/e2e/support/categories.ts`, và `updateCategory` của `user`, nhận `displayOrder` không bắt buộc, gửi khi test đặt nó (Architecture Decisions 10). `E2eCategory` có `displayOrder`.
    - `apps/admin/e2e/category-order.spec.ts`:
      - AC4 qua request fixture tới `/api` của host `admin`: -1, 10000 và 1.5 là 400 nêu `displayOrder`, không có danh mục nào được thêm hay đổi; `"abc"` là 400; thêm không gửi số được 0; sửa tên một danh mục số 7 mà không gửi số thì tên đổi và số vẫn 7.
      - AC6: bốn danh mục của AC5, "Đầm" Ẩn, tạo qua API; ô Danh mục của form Thêm sản phẩm có "Không có danh mục" đầu tiên, rồi các danh mục của lần chạy theo thứ tự "Quần", "Bao tay", "Đầm (Ẩn)", "Áo".
      - AC8, phần `admin`: "Quần", "Bao tay" và "Áo khoác" thêm không gửi số; `GET /api/admin/categories` cho cả ba số 0, và các dòng của bảng S1 theo thứ tự "Áo khoác", "Bao tay", "Quần".
    - `apps/user/e2e/category-order.spec.ts`:
      - AC7 ở `/vi/products` và `/en/products`: các liên kết của lần chạy theo thứ tự "Quần", "Bao tay", "Đầm", "Áo"; sau khi đổi số của "Áo" thành 0 qua API, `expect.poll` tới 60 s thấy "Áo", "Quần", "Bao tay", "Đầm" (NFR5).
      - AC8 ở `/vi/products`: "Áo khoác", "Bao tay", "Quần", mỗi danh mục Hiện và có sản phẩm Đang bán, không gửi số.
    - Mỗi test tạo danh mục và sản phẩm riêng có `E2E <runId>`, và xóa chúng khi xong.
  - Phụ thuộc: không.

### Checkpoint: Nền

- [ ] Test của `api` xanh, gồm test của V8, lần chạy test danh mục và sản phẩm không sửa trên V8 ở bước 1, các câu INSERT và UPDATE của SHOP-81 chạy lại trên V8, và NFR3.
- [ ] `/v3/api-docs` mô tả `displayOrder` như API Contract.
- [ ] Trên Development, E2E của AC4, AC6, AC7 và AC8 pass. Bộ regression và mọi E2E của SHOP-81 pass không sửa, với `admin` và `user` chưa đổi: form sửa danh mục của SHOP-81 không gửi `displayOrder`, và số vẫn giữ.
- [ ] Lượt chạy thử: PR của Story 1 có dòng "bỏ review", và cổng ③ của Story 1 nhắc file `critical` của `db/migration/`.

### Phase 2: Giao diện `admin`

Story 2 phụ thuộc Story 1: schema của `admin` đòi `displayOrder` trong phản hồi, và E2E của nó chạy trên `api` thật. Mỗi vai chỉ có một item, nên không có hai item nào của cùng một vai làm cùng lúc được. `runs.agents_per_role` cho `fe-dev` 2 agent, nhưng giá trị nào của nó cũng không đổi thứ tự này. Nhánh của Story 2 cắt từ `develop` sau khi Story 1 merge.

- [ ] SHOP-97 Story 2: Quản trị viên đặt thứ tự hiển thị trong form danh mục và thấy cột thứ tự trong bảng · fe-dev · level standard
  - AC1, AC2, AC3, AC5, và nửa cột S1.4 của AC8. Màn hình S1 (S1.2, S1.3, S1.4) và S2 (S2.2, S2.3, S2.5). NFR4, NFR5 (phần `admin`), NFR8, NFR12 (phần `admin`).
  - **Bước 1, model:**
    - `adminCategorySchema` có `displayOrder` bắt buộc, số nguyên 0–9999 (Architecture Decisions 9);
    - schema của form có ô `displayOrder` dạng chữ, với hai mã lỗi `displayOrderRequired` và `displayOrderInvalid`, rồi đổi thành số; giá trị mặc định `'0'`; `categoryFormValuesOf` điền số đã lưu bằng chữ số thường;
    - `CATEGORY_FORM_FIELDS` thêm `displayOrder`, sau `slug`;
    - chữ vi và en của S1.3 và S2.3 trong `src/lib/i18n/locales/{vi,en}/category.json`.

    Unit test: phản hồi có và không có `displayOrder` (NFR12); form với trống, chỉ khoảng trắng, -1, 10000, 1.5, 1,5, `abc`, ` 7 `, `007` thành 7, 0 và 9999; body của lệnh thêm và lệnh sửa luôn có `displayOrder` là số; 400 nêu `displayOrder` thành lỗi trên trường đó. File: `src/features/category/model/category.ts`, `src/features/category/api/categories.ts`.
  - **Bước 2, S1 và S2:**
    - cột S1.3 và ô S1.4: sau Số sản phẩm, trước Thao tác, class `.table__num`, chữ số thường không qua `Intl`; khung xương và dòng trống trải 6 cột;
    - ô S2.3: `InputField` cuối form, `type=text`, `inputMode=numeric`, `autoComplete=off`, `required`, gợi ý và lỗi theo S2.3; focus về ô sai đầu tiên theo thứ tự Tên, Slug, Thứ tự; câu riêng cho lỗi 400 của `api`;
    - khung xương của form sửa có thêm một nhãn và một ô.

    Test của component với MSW: S2.3 điền sẵn 0 khi thêm và số đã lưu khi sửa; từng lỗi của AC3 hiện dưới ô, không gửi lệnh nào, những gì đã nhập còn nguyên; lệnh thêm và lệnh sửa gửi số đã nhập; 400 của `api` trên `displayOrder`; cột của bảng hiện "0", "1", "1000". File: `src/features/category/components/category-table.tsx`, `src/features/category/components/category-form.tsx`, `src/features/category/components/category-edit.tsx`.
  - **Bước 3, E2E:** chỉ có file test.
    - `expectCells` của `e2e/categories.spec.ts` thêm ô `'0'` trước ô Thao tác (Architecture Decisions 10).
    - `e2e/category-order-form.spec.ts`: AC1, AC2, AC3 ở form thêm lẫn form sửa, AC5, và AC8 với cột S1.4 hiện "0" cho ba danh mục thêm không gửi số.
    - axe (WCAG 2.0/2.1 A và AA) của S1 có cột thứ tự và S2 có ô thứ tự, kể cả khi ô có lỗi, ở hai ngôn ngữ.
  - Phụ thuộc: Story 1.

### Checkpoint: Hoàn tất

- [ ] E2E của AC1–AC8 pass trên Development, cùng bộ regression. Mọi E2E của SHOP-81 pass, chỉ `expectCells` đổi.
- [ ] axe không báo vi phạm WCAG A/AA nào trên S1 và S2. `qa` ghi số đo NFR4 của S1 và S2 vào báo cáo QA của Story 2.
- [ ] NFR1–NFR15 đạt, mỗi yêu cầu theo cách kiểm của nó.
- [ ] Lượt chạy thử: khi hai Story Done, `/ao-run` dừng và nhắc gõ `/ao-review` của Epic; lượt review sau merge đọc PR của Story 1; `/ao-release` chạy thử, không `--go`, liệt kê PR của Story 1 trước lượt review đó và hết liệt kê sau lượt đó.
- [ ] Chi phí của cả Epic được ghi lại để so với khoảng 30–50 USD.
- [ ] Sẵn sàng cắt bản release ở gate ④. Ở gate ⑤, bạn xác nhận bản backup mới nhất của Production cách đó không quá 24 giờ (NFR14).

## New Libraries

Không có.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Bản `api` trước Epic không chạy được trên V8 sau một lần rollback, hay xóa mất số đã đặt khi sửa danh mục | High | V8 chỉ thêm một cột có DEFAULT. Bước 1 của Story 1 chạy test đang có không sửa trên V8, chạy lại câu INSERT và UPDATE của SHOP-81, và chạy `validate()` của Flyway V1–V7 và của `v0.3.0` trên V8. Development rồi Staging chạy V8 trước Production. Bản backup không quá 24 giờ ở gate ⑤ |
| Một tab `admin` mở từ trước khi deploy, hay form của SHOP-81 trên Development giữa lúc Story 1 và Story 2 merge, đặt lại số về 0 | Medium | Lệnh sửa vắng `displayOrder` giữ số đang có (Architecture Decisions 6), có integration test ghim; checkpoint Nền chạy E2E của SHOP-81 với form cũ |
| 1.5 bị làm tròn, hay một số quá lớn thành 500 | Medium | `BigDecimal` với `@Digits`, `@Min` và `@Max` (Architecture Decisions 5); unit test và WebMvc test với 1.5, -1, 10000 và 99999999999; CHECK của database là chốt sau |
| Story 1 merge không qua review, và một lỗi lên `develop` | Medium | Mỗi quy tắc có test ghim ở Task List, `qa` kiểm Story 1 trên Development, và lượt review sau merge đọc PR của nó trước khi `/ao-release` thôi liệt kê nó (Constraints của SPEC) |
| V8 chờ khóa sau một transaction dài lúc deploy, làm các lệnh đọc danh mục xếp hàng | Low | `SET LOCAL lock_timeout = '5s'`: V8 lỗi, lần deploy dừng, Flyway lùi V8, và lần deploy sau chạy lại. Test đo V8 trên 200 danh mục dưới 1 s |
| `-g "AC7"` chạy cả E2E của SHOP-81 có cùng mã, và báo kết quả lẫn nhau | Low | E2E của Epic nằm trong `category-order.spec.ts` và `category-order-form.spec.ts`; lệnh chạy một tiêu chí nêu cả file (Architecture Decisions 10) |
| `admin` mới gặp `api` trước Epic trong lúc chuyển bản | Low | Schema đòi `displayOrder`, nên S1 và S2 hiện lỗi tải có nút "Thử lại", không hiện "0" giả (NFR12) |
| Danh mục khác trên Development dùng chung nằm xen giữa danh mục của một lần chạy E2E | Low | Test chỉ so thứ tự tương đối giữa các danh mục `E2E <runId>` của lần chạy đó (Architecture Decisions 10) |
| Level `heavy` của Story 1 làm Epic vượt 30–50 USD | Low | Không đặt effort `xhigh` (Architecture Decisions 13); Story 1 chỉ có 8 file code nhỏ; chi phí được ghi lại ở checkpoint Hoàn tất |

## Open Questions

Không có. Bạn đã giao cổng ①②③ của Epic này cho Claude (Phiên 35 · Lượt 67), nên `sa` quyết theo đề xuất của mình, và mỗi quyết định nằm ở mục của nó:

- Story 1 mang AC4, AC6, AC7, AC8; Story 2 mang AC1, AC2, AC3, AC5 và nửa cột S1.4 của AC8 (Architecture Decisions 2).
- `"abc"` là 400 `MALFORMED_REQUEST`, không phải lỗi trên trường (Architecture Decisions 5).
- Bản `api` trước Epic được kiểm bằng lần chạy test không sửa ở bước 1 và câu SQL của SHOP-81 chạy lại trên V8 (Database Changes).
- Story 1 giữ hơn 5 file code, chia thành bốn bước (Architecture Decisions 1), và là `heavy` không có effort (Architecture Decisions 13).
- Thứ tự là một số nguyên cho phép trùng (ADR-0006).
