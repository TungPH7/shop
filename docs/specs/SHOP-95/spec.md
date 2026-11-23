# Spec: Thứ tự hiển thị danh mục

> **Epic:** SHOP-95 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-95 · **Status:** Draft

## Objective

Từ SHOP-81, mọi danh sách danh mục xếp theo tên A→Z, theo bảng chữ cái tiếng Việt, ở cả `user` lẫn `admin` (Category Rules, "Thứ tự danh mục", của SPEC SHOP-81). Quản trị viên chưa chọn được danh mục nào hiện trước. Epic này cho quản trị viên đặt một số thứ tự hiển thị cho từng danh mục, và mọi danh sách danh mục mà người dùng thấy xếp theo số đó, rồi theo tên.

Epic xong khi:

- quản trị viên đặt được số thứ tự cho một danh mục trong form thêm và form sửa của `admin`;
- bảng danh mục của `admin`, ô Danh mục của form sản phẩm, và các liên kết danh mục ở trang danh sách sản phẩm của `user` hiện theo thứ tự đó;
- hai danh mục cùng số thì xếp theo tên, như hiện nay;
- bản release chứa Epic lên Production.

Epic đụng tới giao diện của `admin`, nên `ux` viết màn hình ở `docs/specs/SHOP-95/design.md`: ô số thứ tự trong form danh mục (S2 của SHOP-81) và cột thứ tự trong bảng danh mục (S1 của SHOP-81). Trang của `user` không đổi giao diện: các liên kết danh mục (S7 của SHOP-81) chỉ đổi thứ tự. `sa` viết mục Non-functional requirements. Epic không có trang mới của `user`, và các liên kết danh mục chỉ đổi thứ tự, không đổi chữ, liên kết hay metadata, nên `seo` chỉ ghi "không đổi" trong mục `## SEO` của SPEC này.

Đây cũng là Epic chạy thử tính năng bật hay tắt review theo item của kit (bản `0e3c9ec`). Xem Constraints.

### Users

- **Quản trị viên của shop:** dùng `admin` trên máy tính, bằng tiếng Việt hoặc tiếng Anh, để đặt số thứ tự cho danh mục. Basic auth của host giữ `admin` ở cả ba môi trường, như SHOP-81.
- **Khách mua hàng:** dùng `user` trên máy tính và điện thoại, bằng tiếng Việt hoặc tiếng Anh. Khách chỉ thấy thứ tự mới, không có màn hình mới.

### Scope

- **In:**
  - một số thứ tự cho mỗi danh mục, lưu trong cơ sở dữ liệu bằng một migration;
  - API quản trị của danh mục nhận số thứ tự khi thêm và sửa, và trả số đó;
  - các danh sách danh mục của API xếp theo số thứ tự, rồi theo tên: danh sách của quản trị, mà bảng danh mục và ô Danh mục của form sản phẩm cùng đọc, và danh sách của khách, mà các liên kết danh mục đọc;
  - `admin`: ô nhập số thứ tự trong form thêm và form sửa danh mục, và cột thứ tự trong bảng danh mục.
- **Out:**
  - kéo thả, nút lên hay xuống, hay đổi thứ tự nhiều danh mục một lần;
  - bấm vào tiêu đề cột để xếp lại bảng danh mục của `admin`;
  - tự đánh số lại các danh mục;
  - thứ tự riêng theo từng ngôn ngữ;
  - thứ tự của sản phẩm trong một danh mục;
  - danh mục nhiều cấp;
  - thứ tự của các danh mục trong sitemap: `/api/sitemap/categories` giữ thứ tự theo `id` như hiện nay, vì máy tìm kiếm không dùng thứ tự của các mục trong sitemap, và khách không thấy sitemap. "Mọi danh sách danh mục của API" mà Epic nói là các danh sách người dùng thấy, ở mục In trên.

### Constraints

- **Đúng hai item, mỗi item một PR**, để thử review theo item. Chia theo lớp như vậy là cố ý, để hai PR có hai lựa chọn review khác nhau:
  - **Item 1, phần nền** (`be-dev`): migration thêm cột thứ tự, API nhận số thứ tự, và mọi danh sách xếp theo nó (TW1, TW2, TW3). Item này **bỏ review**: dòng của nó trong plan ghi `review: skip`, và `ba` gắn nhãn `ao-review-skip` khi tạo item.
  - **Item 2, phụ thuộc item 1** (`fe-dev`): ô nhập và cột thứ tự trong `admin`. Item này **có review**, như mặc định.
  - `sa` đặt từng AC vào một trong hai item. Đề xuất: item 1 mang AC4, AC6, AC7 và AC8, vì các tiêu chí đó đúng ngay khi API xếp theo số thứ tự, không cần đổi giao diện; item 2 mang AC1, AC2, AC3 và AC5.
- **Lượt chạy thử phải kiểm được:**
  - dòng "bỏ review" trên PR của item 1;
  - dòng nhắc file `critical` ở cổng ③ của item 1, vì migration nằm trong `db/migration/`;
  - `/ao-run` dừng và nhắc gõ `/ao-review` của Epic khi hai item Done;
  - lượt review sau merge;
  - `/ao-release` chạy thử, không `--go`, liệt kê PR của item 1 trước lượt review sau merge, và hết liệt kê sau lượt đó.
- **Chi phí:** khoảng 30–50 USD cho cả Epic.
- `/ao-plan` chạy sau khi bản chép kit SHOP-94 (shop PR #93) đã merge, vì `sa` và `ba` cần bản kit mới để ghi và gắn lựa chọn review. Ngày viết SPEC này, `develop` mới có bản chép của SHOP-93 (#92).

### Category Rules

Quy tắc này thêm vào Category Rules của SPEC SHOP-81, và thay đoạn "Thứ tự danh mục" của SPEC đó. Form của `admin` và `api` kiểm cùng quy tắc, và `api` là chốt cuối.

| Trường | Quy tắc |
|---|---|
| Thứ tự hiển thị | Số nguyên từ 0 tới 9999. Số nhỏ hiện trước. Nhiều danh mục có cùng số được. Form thêm điền sẵn 0, và form sửa điền số đã lưu. Trong form, ô này bắt buộc: ô trống là lỗi dưới ô, như ô tên trống, không được hiểu là 0. Một số có phần lẻ, như 1.5, là lỗi, không được làm tròn. Chỉ `admin` thấy số này, như số sản phẩm: phản hồi của khách về một danh mục vẫn chỉ có tên và slug (NFR8 của SHOP-81). |

**Danh mục có sẵn và danh mục mới:** mọi danh mục có trước Epic nhận số 0 khi nâng database. Một lệnh thêm danh mục không gửi số thứ tự cho danh mục số 0, như helper E2E của SHOP-81 vẫn thêm danh mục. Vì vậy thứ tự không đổi, vẫn theo tên, cho tới khi quản trị viên đặt số (AC8).

**Thứ tự của mọi danh sách danh mục:** số thứ tự tăng dần; cùng số thì theo tên, như SHOP-81: bảng chữ cái tiếng Việt và không phân biệt chữ hoa, chữ thường, qua collation `app.vi_ci` (ADR-0005); cùng tên thì theo `id`. Thứ tự này áp dụng cho:

- bảng danh mục của `admin` (S1 của SHOP-81), kể cả danh mục Ẩn;
- ô Danh mục của form sản phẩm (S4.2 của SHOP-81), sau lựa chọn "Không có danh mục", vì ô này đọc cùng một API với bảng danh mục (AC6);
- các liên kết danh mục ở trang danh sách sản phẩm của `user` (S7 của SHOP-81), vẫn chỉ gồm danh mục Hiện có sản phẩm Đang bán (AC17 của SHOP-81).

`admin` và `user` không tự xếp lại danh sách: thứ tự đến từ `api`, như hiện nay.

**Độ trễ:** sau khi lưu, bảng danh mục và ô Danh mục của form sản phẩm ở `admin` hiện thứ tự mới ngay. Trang của khách hiện thứ tự mới trong vòng 60 giây, như mọi thay đổi danh mục của SHOP-81 (NFR6 của SHOP-81).

### User Stories

#### US1 · Quản trị viên đặt thứ tự hiển thị của danh mục

Là quản trị viên, tôi muốn đặt số thứ tự cho một danh mục trong `admin`, để chọn danh mục nào hiện trước.

- **AC1:** Given form Thêm danh mục, When mở form, Then ô thứ tự hiển thị có sẵn số 0; When thêm danh mục "Bao tay" với thứ tự 5 rồi lưu, Then thấy "Đã thêm danh mục", và dòng "Bao tay" trong bảng danh mục có thứ tự "5"; When thêm danh mục "Dép" mà để nguyên số 0, Then dòng "Dép" có thứ tự "0".
- **AC2:** Given danh mục "Áo" có thứ tự 0, When mở form sửa của "Áo", Then ô thứ tự hiện 0; When đổi thành 3 rồi lưu, Then thấy "Đã lưu danh mục", dòng "Áo" trong bảng có thứ tự "3", mở lại form sửa thì ô hiện 3, và tên, slug, trạng thái của "Áo" không đổi.
- **AC3:** Given form Thêm danh mục hay form sửa một danh mục, When lưu với ô thứ tự trống, -1, 10000 hay 1.5, Then danh mục không được lưu, ô thứ tự có lỗi ngay bên dưới, và những gì đã nhập còn nguyên; When sửa ô thành 0 hay 9999 rồi lưu, Then danh mục được lưu với đúng số đó.
- **AC4:** Given API quản trị của danh mục, When gửi thẳng lệnh thêm hay sửa với thứ tự -1, 10000 hay 1.5, Then API trả 400 dạng Problem Details nêu trường thứ tự, không làm tròn 1.5, và không lưu gì; When gửi thứ tự không phải số, như `"abc"`, Then API trả 400 dạng Problem Details và không lưu gì; When thêm một danh mục mà không gửi thứ tự, Then danh mục có thứ tự 0; When sửa tên một danh mục có thứ tự 7 mà không gửi thứ tự, như một tab `admin` mở từ trước khi deploy, Then tên đổi và thứ tự vẫn là 7.
- **AC5:** Given danh mục "Áo" thứ tự 2, "Bao tay" thứ tự 1, "Đầm" thứ tự 1 và "Quần" thứ tự 0, When mở trang Danh mục của `admin`, Then các dòng theo thứ tự "Quần", "Bao tay", "Đầm", "Áo", và cột thứ tự hiện "0", "1", "1", "2"; When đổi thứ tự của "Áo" thành 0 rồi lưu, Then bảng thành "Áo", "Quần", "Bao tay", "Đầm".
- **AC6:** Given cùng bốn danh mục của AC5, trong đó "Đầm" Ẩn, When mở form Thêm sản phẩm, Then ô Danh mục có "Không có danh mục" đầu tiên, rồi "Quần", "Bao tay", "Đầm (Ẩn)", "Áo".

#### US2 · Khách thấy danh mục theo thứ tự cửa hàng chọn

Là khách, tôi muốn thấy danh mục theo thứ tự cửa hàng chọn, để các loại hàng cửa hàng muốn giới thiệu hiện trước.

- **AC7:** Given danh mục "Áo" thứ tự 2, "Bao tay" thứ tự 1, "Đầm" thứ tự 1 và "Quần" thứ tự 0, mỗi danh mục Hiện và có sản phẩm Đang bán, When khách mở `/vi/products` hay `/en/products`, Then các liên kết danh mục theo thứ tự "Quần", "Bao tay", "Đầm", "Áo"; When quản trị viên đổi thứ tự của "Áo" thành 0 rồi lưu, Then trong vòng 60 giây các liên kết là "Áo", "Quần", "Bao tay", "Đầm".
- **AC8:** Given danh mục "Quần", "Bao tay" và "Áo khoác" thêm mà không đặt thứ tự, như mọi danh mục có từ trước Epic, mỗi danh mục Hiện và có sản phẩm Đang bán, When mở trang Danh mục của `admin` và trang `/vi/products`, Then cả ba có thứ tự 0, và cả hai trang hiện chúng theo tên như trước Epic: "Áo khoác", "Bao tay", "Quần".

### Technical Work

Việc kỹ thuật đi cùng Epic. Plan đưa chúng vào item 1, và chúng không có AC riêng.

- **TW1 · Schema:** migration Flyway V8, sau V7, không sửa V1–V7. `app.categories` thêm cột thứ tự số nguyên, `NOT NULL`, mặc định 0, có CHECK 0–9999, để database là chốt sau `api` như NFR14 của SHOP-81. Mọi danh mục có sẵn nhận 0. Đây chỉ là bước expand: bản `api` trước Epic chạy đúng trên schema mới, trong lúc deploy và sau một lần rollback. Bản đó gồm `v0.3.0` đang chạy trên Production, vốn chưa biết tới danh mục, và bản của `develop` có SHOP-81, vốn chưa biết tới cột thứ tự: khi nó thêm danh mục, danh mục nhận 0; khi nó sửa, số thứ tự còn nguyên. `sa` quyết có cần index cho thứ tự không, với quy mô 200 danh mục của NFR1 của SHOP-81. V8 nằm trong `db/migration/`, nên PR của item 1 có file `critical` (Constraints).
- **TW2 · Hợp đồng API:** phần quản trị, `/api/admin/categories`: danh sách, chi tiết, thêm và sửa trả số thứ tự; thêm và sửa nhận số đó theo Category Rules; mọi giá trị sai nêu trên trường thứ tự trong cùng một 400 với các trường sai khác (AC3 của SHOP-81). Thêm mà không gửi số thì số là 0. Sửa mà không gửi số thì giữ số đang có, vì một tab `admin` mở từ trước khi deploy gửi lệnh sửa không có trường này (AC4, như NFR19 của SHOP-81): `api` không được lặng lẽ đặt nó về 0. Danh sách của quản trị và danh sách của khách, `GET /api/categories`, xếp theo Category Rules; `/api/sitemap/categories` giữ thứ tự theo `id` (Scope: Out). Phản hồi của khách không thêm trường nào. OpenAPI ở `/v3/api-docs` mô tả trường mới. `sa` ghi hợp đồng trong plan, và xem việc đổi số thứ tự làm đổi `updated_at` của danh mục, nên đổi `lastmod` của nó trong sitemap (AC19 của SHOP-81), có chấp nhận được không.
- **TW3 · Dữ liệu của E2E:** helper danh mục của `apps/admin/e2e/support/` và `apps/user/e2e/support/` nhận thêm số thứ tự khi thêm danh mục qua `/api` của host `admin`, và không gửi số khi test không cần, như AC8. Tên danh mục của E2E vẫn kết thúc bằng `E2E <runId>`, và việc dọn danh mục E2E cũ giữ như TW3 của SHOP-81.

## Tech Stack

Không thêm framework, dependency hay extension PostgreSQL nào: stack như README gốc, README của từng app, và mục Tech Stack của SPEC SHOP-81. Epic thêm migration V8 sau V7 ở `api`, và chữ mới trong i18n của `admin`. Thứ tự tên giữ collation ICU `app.vi_ci` của V7 (ADR-0005).

## Commands

Không đổi so với README gốc:

```
pnpm run lint
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run test:e2e
pnpm exec playwright test --project=admin -g "AC5"   # E2E của một tiêu chí
```

Trong một làn của kit, chạy script của một app bằng `node .ai-orchestrator/scripts/run.mjs <app> <script>`, như `run.mjs api test -- -Dtest=CategoryQueryRepositoryIntegrationTest`.

## Project Structure

```
apps/api/src/main/resources/db/migration/                           → V8: cột thứ tự của app.categories
apps/api/src/main/java/com/tungph7/learnpostgres/feature/category/  → domain, dto, repository, service, controller: số thứ tự và thứ tự của danh sách
apps/api/src/test/java/com/tungph7/learnpostgres/feature/category/  → unit, WebMvc, DataJpa và integration test (Testcontainers)
apps/admin/src/features/category/                                   → model (schema Zod), form và bảng danh mục
apps/admin/src/lib/i18n/locales/{vi,en}/category.json               → chữ của ô và cột thứ tự
apps/admin/e2e/                                                     → E2E của AC1–AC6 và AC8; support/ có helper danh mục
apps/user/e2e/                                                      → E2E của AC7 và AC8; support/ có helper danh mục
docs/specs/SHOP-95/                                                 → spec.md, design.md, plan.md
docs/adr/                                                           → ADR, nếu sa ghi
```

`apps/user/src/` không đổi: trang của khách đọc các liên kết danh mục theo thứ tự của `api`.

## Code Style

Như CLAUDE.md và mục Code Style của SPEC SHOP-81. Thêm:

- Không chỗ nào ngoài `api` xếp lại danh sách danh mục. `admin` và `user` hiện danh sách đúng thứ tự `api` trả, như `CategoryRows` của `admin` đang làm ("in the order of the api: never sorted again").
- Thứ tự của một danh sách danh mục viết ở một chỗ trong `CategoryQueryRepository`, để danh sách của quản trị và của khách không lệch nhau.
- Tên E2E bắt đầu bằng mã AC và viết tiếng Anh, như `test('AC7 lists the category links by display order, then by name', …)`.

## Testing Strategy

- **`api`:** unit test viết theo TDD cho quy tắc kiểm số thứ tự: 0 và 9999 hợp lệ; -1, 10000 và 1.5 sai. WebMvc test cho 400 dạng Problem Details nêu trường thứ tự (AC4), cho thêm không gửi số được số 0, và cho sửa không gửi số giữ số đang có. Integration test với Testcontainers PostgreSQL 17 cho:
  - thứ tự của danh sách quản trị và danh sách của khách: số thứ tự, rồi tên theo `app.vi_ci`, rồi `id` (AC5, AC7, AC8), với các tên của NFR17 của SHOP-81 ở cùng một số;
  - phản hồi của khách không có số thứ tự;
  - CHECK của database từ chối -1 và 10000 ghi thẳng bằng SQL;
  - V8 chạy trên schema V7 có danh mục và sản phẩm: mọi danh mục nhận 0, và danh sách giữ đúng thứ tự trước khi nâng;
  - bản `api` trước Epic thêm và sửa danh mục trên schema V8 mà không làm mất số thứ tự (TW1). Plan chọn cách chạy, như một entity chỉ map các cột của V7.
- **`admin`:** Vitest, Testing Library và MSW cho ô thứ tự của form thêm và form sửa: số 0 điền sẵn, từng lỗi của AC3, lệnh thêm và sửa gửi số đã nhập; và cho cột thứ tự của bảng.
- **E2E:** mỗi AC một test Playwright trở lên, tên bắt đầu bằng mã AC, chạy trên app thật và `api` thật, không mock API. Development dùng chung, nên mỗi test tạo danh mục và sản phẩm riêng với tên có `E2E <runId>`, chỉ kiểm thứ tự tương đối giữa các danh mục của lần chạy đó, và xóa những gì nó tạo khi xong (TW3). Các danh mục khác trên môi trường có thể nằm xen giữa. AC7 chờ bằng `expect.poll` tới 60 giây. Mọi E2E của SHOP-81 vẫn pass mà không sửa, vì danh mục mới mặc định số 0 (AC8).
- **Accessibility:** axe (WCAG 2.0/2.1 A và AA) quét form danh mục có ô thứ tự và bảng danh mục có cột thứ tự, ở hai ngôn ngữ.

## Boundaries

- **Always:**
  - kiểm số thứ tự ở cả form của `admin` lẫn `api`, và coi `api` cùng database là chốt cuối;
  - xếp danh sách danh mục ở `api`, theo một thứ tự duy nhất: số thứ tự, tên, `id`;
  - giữ migration ở bước expand, để bản `api` trước Epic chạy được trên database đã nâng;
  - dọn dữ liệu mà E2E tạo trên môi trường.
- **Ask first:** chỉ những việc cần quyền mà agent không có:
  - đổi `deploy.yaml`, nằm trong đường dẫn được bảo vệ `.ai-orchestrator/**`, hay secret và biến môi trường của app trên VPS;
  - thêm extension PostgreSQL vào database đang chạy của một môi trường.
- **Never:**
  - sửa V1–V7, hay bỏ, đổi kiểu một cột có sẵn của `app.categories` hay `app.products`;
  - đặt lại số thứ tự của một danh mục khi lệnh sửa không gửi số đó;
  - cho số thứ tự vào phản hồi của khách, hay vào trang của `user`;
  - xếp lại danh sách danh mục ở `admin` hay `user`;
  - đổi thứ tự của sản phẩm;
  - mock API danh mục trong E2E chạy trên môi trường;
  - ghi basic auth của môi trường vào file, commit hay log.

## Success Criteria

Ngoài DoD của Epic trong `.ai-orchestrator/docs/sdlc.md`:

- Hai item đạt DoD: E2E của từng AC từ AC1 tới AC8 pass trên Development, bộ regression pass, và mọi E2E của SHOP-81 vẫn pass.
- V8 chạy không lỗi sau V7 trên bản sao dữ liệu của Production. Sau khi nâng, mọi danh mục có số 0 và các danh sách giữ thứ tự theo tên, và bản `api` trước Epic vẫn khởi động, thêm và sửa được danh mục trên database đã nâng, để rollback được.
- OpenAPI ở `/v3/api-docs` mô tả trường thứ tự.
- axe không báo vi phạm WCAG A/AA nào trên form và bảng danh mục của `admin`.
- Năm điểm của lượt chạy thử ở Constraints đều kiểm được, và chi phí của cả Epic được ghi lại để so với khoảng 30–50 USD.
- Bản release chứa Epic lên Production sau gate ⑤, và smoke test sau deploy pass.
- Mục Non-functional requirements của `sa` đạt, mỗi yêu cầu theo cách kiểm của nó.

## Open Questions

Không có. Ngày 2026-11-23 cả sáu đề xuất của `ba` được chọn, và mỗi câu trả lời đã thành quyết định ở mục của nó:

- Bạn đã duyệt bốn Open Points của Epic khi trả lời "OK" cho bản nháp Epic (Phiên 35 · Lượt 67): số thứ tự là số nguyên 0–9999, số nhỏ hiện trước, cùng số được (Category Rules, AC3, AC4); danh mục có sẵn và danh mục mới mang số 0, form thêm điền sẵn 0 (Category Rules, AC1, AC8, TW1); ô Danh mục của form sản phẩm theo thứ tự mới (Category Rules, AC6); `seo` chỉ ghi "không đổi" trong mục `## SEO` (Objective).
- Claude chọn hai đề xuất mới theo đề xuất của `ba`, vì bạn đã giao cổng ① của Epic này cho Claude (Phiên 35 · Lượt 67: "OK, tôi giao cổng 1, 2, 3 cho bạn"): sitemap giữ thứ tự theo `id` (Scope: Out, TW2), và ô thứ tự trống thì form báo lỗi dưới ô, không hiểu là 0 (Category Rules, AC3).
