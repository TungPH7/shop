# Spec: Danh mục sản phẩm

> **Epic:** SHOP-7 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-7 · **Status:** Draft

## Objective

Ba app của `shop` đều có phần sản phẩm lấy từ template, nhưng không khớp nhau. `api` lưu giá theo USD có số lẻ và trả cả danh sách một lần. `admin` tính giá bằng xu USD, và trang sửa nằm sau lớp đăng nhập của template. `user` gọi API NestJS cũ và còn nút xóa sản phẩm. Vì vậy chưa ai thêm được sản phẩm thật, và khách chưa xem được sản phẩm nào.

Epic này làm cho quản trị viên thêm, sửa, ẩn và xóa được sản phẩm trong `admin`, và cho khách tìm, sắp xếp và xem chi tiết sản phẩm trong `user`. Cả ba app dùng chung một hợp đồng API của `api`. Epic xong khi bản `v0.3.0` mang các việc này lên Production (Open Question 1).

Màn hình của Epic do `ux` viết ở `docs/specs/SHOP-7/design.md`, theo trang mẫu ở mục Reference Design của Epic và các ảnh trong `.ai/design-inbox/SHOP-7/`. Chữ trong các AC dưới đây là bản tiếng Việt; bản tiếng Anh ghi trong `design.md`.

### Users

- **Quản trị viên của shop:** dùng `admin` trên máy tính để nhập và sửa danh mục, bằng tiếng Việt hoặc tiếng Anh như `admin` đang có. Tới khi có Epic đăng nhập, basic auth của host giữ `admin` ở cả ba môi trường.
- **Khách mua hàng:** dùng `user` trên máy tính và điện thoại, bằng tiếng Việt hoặc tiếng Anh.

### Scope

- **In:** sáu user story US1–US6 dưới đây; các việc kỹ thuật ở mục Technical Work; giao diện của danh sách và form trong `admin`, và của danh sách và trang chi tiết trong `user`, theo trang mẫu qua Task design system của từng app.
- **Out:**
  - ảnh thật: tải ảnh lên, hay dán link ảnh ngoài;
  - danh mục (category), biến thể (size, màu), SKU, số lượng tồn kho;
  - giỏ hàng, đơn hàng, thanh toán, đánh giá; sắp xếp Bán chạy và Đánh giá;
  - nội dung sản phẩm theo từng ngôn ngữ: sản phẩm nhập một lần, hiện như nhau ở hai ngôn ngữ;
  - chuyển hướng từ slug cũ sang slug mới (Open Question 8);
  - đăng nhập và phân quyền của `admin` và `user` (Epic đăng nhập), cùng các E2E đăng nhập còn lại (Open Question 6);
  - mở Production cho mọi người.

### Product Rules

Các trường của một sản phẩm, theo chuẩn ngành (Shopify, Google Merchant Center). Form của `admin` và `api` kiểm cùng các quy tắc này, và `api` là chốt cuối.

| Trường | Quy tắc |
|---|---|
| Tên | Bắt buộc. Bỏ khoảng trắng ở đầu và cuối, rồi dài 1–150 ký tự. |
| Slug | Tự sinh từ tên khi thêm sản phẩm; quản trị viên sửa được. Chỉ gồm chữ thường a–z, số và dấu gạch ngang đơn, không bắt đầu hay kết thúc bằng gạch ngang, tối đa 100 ký tự. Không trùng, không phân biệt chữ hoa, chữ thường. Đổi tên không đổi slug. |
| Mô tả | Không bắt buộc. Chữ thường có xuống dòng, tối đa 5.000 ký tự. Không bao giờ được hiểu là HTML (Open Question 7). |
| Giá bán | Bắt buộc. Đồng Việt Nam, số nguyên, từ 1 tới 999.999.999 (Open Question 12). |
| Giá gốc | Không bắt buộc. Nếu có: số nguyên, lớn hơn giá bán, tối đa 999.999.999. |
| Trạng thái | Đang bán hoặc Ẩn. Sản phẩm mới mặc định Đang bán. Khách chỉ thấy sản phẩm Đang bán. |
| Tình trạng | Còn hàng hoặc Hết hàng. Sản phẩm mới mặc định Còn hàng. Sản phẩm Hết hàng vẫn có trong danh sách của khách. |

**Sinh slug:** bỏ dấu tiếng Việt (cả `đ`, `Đ` thành `d`), chuyển chữ thường, thay mỗi chuỗi ký tự không phải a–z hay số bằng một dấu gạch ngang, bỏ gạch ngang ở đầu và cuối, rồi cắt ở 100 ký tự. Nếu slug sinh ra đã có, thêm `-2`, `-3`… cho tới khi không trùng; còn slug quản trị viên tự gõ mà trùng thì báo lỗi. Ví dụ:

| Tên | Slug |
|---|---|
| Áo thun cổ tròn | `ao-thun-co-tron` |
| Đầm maxi đỏ 2026 | `dam-maxi-do-2026` |
| Quần jean (Nam) – Slim | `quan-jean-nam-slim` |

**Ô giá trong `admin`:** dấu chấm là dấu nhóm hàng nghìn như cách viết tiếng Việt, nên gõ `250.000` là 250000 đồng. Phần lẻ, như `250000,5`, là sai.

**Hiện giá:** kiểu `1.250.000 ₫` ở cả trang tiếng Việt lẫn tiếng Anh, của cả hai app (mục Code Style).

**Phần trăm giảm:** chỉ hiện khi có giá gốc, bằng `(giá gốc − giá bán) × 100 / giá gốc`, làm tròn xuống, tối thiểu 1. Làm tròn xuống để không bao giờ báo mức giảm cao hơn thật. Ví dụ 250.000 ₫ còn 200.000 ₫ là `-20%`; 1.500.000 ₫ còn 1.250.000 ₫ là `-16%`.

**Ảnh giữ chỗ:** mọi sản phẩm dùng một ảnh giữ chỗ chung theo design system: chữ cái đầu của tên, viết hoa, trên nền một màu nhóm của design system. Mỗi sản phẩm giữ cố định một màu.

**Tìm theo tên** (cả hai app): bỏ khoảng trắng thừa; không phân biệt chữ hoa, chữ thường hay dấu (`đ` khớp `d`). Mỗi từ của từ khóa phải khớp phần đầu của một từ trong tên, theo thứ tự bất kỳ. Vì vậy `ao th` ra "Áo thun", còn `ao` không ra "Bao tay". Từ khóa trống là không tìm. Từ khóa dài hơn 100 ký tự bị cắt ở 100.

**Sắp xếp của khách:** Mới nhất (theo ngày tạo, mặc định), Giá thấp đến cao, Giá cao đến thấp. Khi đang tìm thì có thêm Liên quan nhất, và đó là mặc định. Hai sản phẩm bằng giá thì sản phẩm mới hơn đứng trước. Thứ tự Liên quan nhất gồm ba nhóm, trong mỗi nhóm thì mới nhất trước (Open Question 3):

1. tên bắt đầu bằng nguyên cụm từ khóa;
2. tên có nguyên cụm từ khóa ở đầu một từ;
3. tên có đủ các từ của từ khóa, nhưng không liền nhau.

**Phân trang:** khách xem 24 sản phẩm mỗi lần, với nút "Xem thêm" thay cho số trang. `admin` có số trang, 20 sản phẩm mỗi trang, mới nhất trước.

**Độ trễ:** một thay đổi lưu ở `admin` hiện ở trang của khách, gồm danh sách, trang chi tiết và sitemap, trong vòng 60 giây (Open Question 11).

### User Stories

#### US1 · Quản trị viên xem và tìm danh sách sản phẩm

Là quản trị viên, tôi muốn xem, tìm và lọc mọi sản phẩm trong `admin`, để nhanh chóng thấy sản phẩm cần sửa.

- **AC1:** Given đã qua basic auth của host `admin` và chưa đăng nhập vào app, When mở trang Sản phẩm của `admin`, Then thấy danh sách gồm cả sản phẩm Đang bán lẫn Ẩn, mới nhất trước; mỗi dòng có ảnh giữ chỗ, tên, giá bán, trạng thái và tình trạng; và không bị chuyển sang trang đăng nhập.
- **AC2:** Given có "Áo thun cổ tròn" và "Quần jean nam", When gõ `AO THUN` vào ô tìm, Then chỉ còn "Áo thun cổ tròn"; When tìm `xyz`, Then thấy "Không có sản phẩm nào khớp" và nút xóa bộ lọc.
- **AC3:** Given có sản phẩm Đang bán và sản phẩm Ẩn, When chọn lọc "Ẩn", Then chỉ thấy sản phẩm Ẩn; When chọn "Tất cả", Then thấy cả hai.
- **AC4:** Given có 25 sản phẩm, When mở danh sách, Then trang 1 có 20 sản phẩm mới nhất và trang 2 có 5 sản phẩm còn lại; When tải lại trang, hay mở cùng đường dẫn ở tab khác, Then vẫn thấy cùng từ khóa, cùng bộ lọc và cùng trang.

#### US2 · Quản trị viên thêm sản phẩm

Là quản trị viên, tôi muốn thêm sản phẩm với các trường theo chuẩn ngành, để khách thấy được hàng mới.

- **AC5:** Given form Thêm sản phẩm, When gõ tên "Đầm maxi đỏ", Then ô slug tự điền `dam-maxi-do`; When nhập giá bán `450000` rồi lưu, Then thấy "Đã thêm sản phẩm", và sản phẩm đứng đầu danh sách với giá "450.000 ₫", Đang bán và Còn hàng.
- **AC6:** Given form Thêm sản phẩm, When lưu với một trong các giá trị sai sau: tên trống, tên 151 ký tự, slug có chữ hoa, dấu hay khoảng trắng, giá bán 0, giá bán có phần lẻ, giá gốc không lớn hơn giá bán, mô tả 5.001 ký tự, Then sản phẩm không được lưu, ô sai có lỗi ngay bên dưới, và những gì đã nhập còn nguyên.
- **AC7:** Given dữ liệu sai như ở AC6, When gửi thẳng tới API thêm sản phẩm mà không qua form, Then API trả 400 dạng Problem Details, nêu từng trường sai, và không lưu gì.
- **AC8:** Given đã có sản phẩm slug `ao-thun-co-tron`, When thêm một sản phẩm khác tên "Áo thun cổ tròn" mà không sửa ô slug, Then sản phẩm mới có slug `ao-thun-co-tron-2`; When tự gõ slug `ao-thun-co-tron` rồi lưu, Then thấy lỗi "Slug này đã được dùng" dưới ô slug, và sản phẩm không được lưu.

#### US3 · Quản trị viên sửa và ẩn sản phẩm

Là quản trị viên, tôi muốn sửa, ẩn và đánh dấu hết hàng một sản phẩm, để danh mục trên trang của khách luôn đúng.

- **AC9:** Given sản phẩm "Áo thun cổ tròn" Đang bán, giá 250.000 ₫, When mở form sửa, đổi tên thành "Áo thun cổ tròn basic", giá bán thành `200000`, giá gốc thành `250000`, rồi lưu, Then `admin` hiện tên và giá mới, slug vẫn là `ao-thun-co-tron`; và trong vòng 60 giây trang chi tiết của khách hiện tên mới, "200.000 ₫", "250.000 ₫" gạch ngang và "-20%".
- **AC10:** Given sản phẩm Đang bán, When đổi trạng thái sang Ẩn rồi lưu, Then `admin` vẫn hiện sản phẩm với nhãn Ẩn; trong vòng 60 giây sản phẩm không còn trong danh sách của khách, trang chi tiết của nó trả 404, và sitemap không còn nó; When đổi lại Đang bán, Then sản phẩm hiện lại ở cùng đường dẫn.
- **AC11:** Given sản phẩm Còn hàng, When đổi tình trạng sang Hết hàng rồi lưu, Then trong vòng 60 giây thẻ của nó trong danh sách và trang chi tiết của khách hiện "Hết hàng", và sản phẩm vẫn có trong danh sách.
- **AC12:** Given sản phẩm slug `ao-thun-co-tron`, When sửa ô slug thành `ao-thun-basic`, Then form cảnh báo ngay rằng đường dẫn cũ sẽ không mở được nữa; When lưu, Then trang chi tiết của khách mở ở slug `ao-thun-basic`, và đường dẫn có slug cũ trả 404.
- **AC13:** Given hai tab cùng mở form sửa một sản phẩm, When tab thứ nhất lưu rồi tab thứ hai lưu, Then tab thứ hai không ghi đè thay đổi của tab thứ nhất, thấy "Sản phẩm vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.", và những gì đã nhập ở tab thứ hai còn nguyên.

#### US4 · Quản trị viên xóa sản phẩm

Là quản trị viên, tôi muốn xóa hẳn một sản phẩm nhập nhầm, sau một bước xác nhận, để danh mục không còn nó.

- **AC14:** Given sản phẩm "Quần jean nam", When bấm Xóa, Then hộp thoại xác nhận nêu tên sản phẩm, nói việc xóa không hoàn tác được, và gợi ý chọn Ẩn nếu chỉ muốn tạm ngừng bán; When bấm Hủy, Then sản phẩm còn nguyên.
- **AC15:** Given hộp thoại xác nhận xóa "Quần jean nam", When bấm Xóa trong hộp thoại, Then thấy "Đã xóa sản phẩm" và sản phẩm không còn trong `admin`; trong vòng 60 giây trang chi tiết của nó ở trang khách trả 404; và slug của nó dùng lại được cho sản phẩm mới.

#### US5 · Khách tìm và sắp xếp danh sách sản phẩm

Là khách, tôi muốn tìm và sắp xếp danh sách sản phẩm, để nhanh chóng thấy món mình cần.

- **AC16:** Given có sản phẩm Đang bán và sản phẩm Ẩn, When khách mở `/vi/products` hay `/en/products`, Then chỉ thấy sản phẩm Đang bán, mới nhất trước, và không có nút xóa nào.
- **AC17:** Given sản phẩm Đang bán có giá bán 1.250.000 ₫, giá gốc 1.500.000 ₫ và Hết hàng, When khách xem thẻ của nó ở trang tiếng Việt và ở trang tiếng Anh, Then thẻ có ảnh giữ chỗ với chữ cái đầu của tên, tên, "1.250.000 ₫", "1.500.000 ₫" gạch ngang, "-16%" và nhãn "Hết hàng" (trang tiếng Anh: "Out of stock"), với giá giống hệt ở hai trang; When bấm thẻ, Then mở trang chi tiết của sản phẩm.
- **AC18:** Given có "Áo thun cổ tròn", "Bao tay len" và "Quần jean nam" Đang bán, When khách tìm `ao thun`, `ÁO THUN` hay `Áo Thun`, Then chỉ thấy "Áo thun cổ tròn"; When tìm `ao`, Then thấy "Áo thun cổ tròn" và không thấy "Bao tay len"; ô tìm giữ từ khóa, và kiểu sắp xếp là Liên quan nhất.
- **AC19:** Given "Áo thun cổ tròn" tạo trước, "Combo 3 áo thun" tạo sau, và "Áo khoác thun nỉ" tạo sau cùng, When tìm `ao thun` với Liên quan nhất, Then thứ tự là "Áo thun cổ tròn", "Combo 3 áo thun", "Áo khoác thun nỉ".
- **AC20:** Given các sản phẩm Đang bán có giá khác nhau và hai sản phẩm bằng giá, When chọn Giá thấp đến cao, Then giá bán tăng dần và trong hai sản phẩm bằng giá thì sản phẩm mới hơn đứng trước; When chọn Giá cao đến thấp, Then giá bán giảm dần; When chọn Mới nhất, Then sản phẩm tạo sau đứng trước; và khi không tìm thì không có lựa chọn Liên quan nhất.
- **AC21:** Given có 30 sản phẩm Đang bán, When mở trang Sản phẩm, Then thấy 24 sản phẩm, dòng "Đã xem 24 trên 30 sản phẩm" và nút "Xem thêm"; When bấm Xem thêm, Then 6 sản phẩm còn lại hiện nối bên dưới, 24 sản phẩm đầu vẫn ở đó, và nút Xem thêm không còn.
- **AC22:** Given đã tìm `ao`, chọn Giá thấp đến cao và bấm Xem thêm một lần, When tải lại trang, hay mở cùng đường dẫn ở tab khác, Then thấy cùng từ khóa, cùng kiểu sắp xếp và cùng các sản phẩm đã xem; When sửa tay đường dẫn thành giá trị không hợp lệ, Then trang dùng giá trị mặc định thay vì báo lỗi.
- **AC23:** Given không sản phẩm Đang bán nào khớp `xyz`, When tìm `xyz`, Then thấy "Không tìm thấy sản phẩm nào cho “xyz”" và liên kết xóa tìm kiếm; Given chưa có sản phẩm Đang bán nào, When mở trang Sản phẩm, Then thấy "Chưa có sản phẩm nào."

#### US6 · Khách xem chi tiết sản phẩm

Là khách, tôi muốn xem trang chi tiết của một sản phẩm, để biết giá, giá gốc, tình trạng và mô tả trước khi mua.

- **AC24:** Given sản phẩm Đang bán "Áo thun cổ tròn" có giá bán 200.000 ₫, giá gốc 250.000 ₫, Còn hàng và mô tả hai dòng, When khách mở `/vi/products/ao-thun-co-tron` hay `/en/products/ao-thun-co-tron`, Then thấy ảnh giữ chỗ, tên, "200.000 ₫", "250.000 ₫" gạch ngang, "-20%", "Còn hàng" (trang tiếng Anh: "In stock"), và mô tả đúng hai dòng; Given sản phẩm không có giá gốc, Then chỉ thấy giá bán, không có giá gạch ngang hay phần trăm.
- **AC25:** Given mô tả là `<b>Mới</b><script>alert(1)</script>`, When khách mở trang chi tiết, Then trang hiện đúng chuỗi đó như chữ, không có chữ in đậm, và không script nào chạy.
- **AC26:** Given slug chưa từng có, hay slug của một sản phẩm Ẩn, hay của một sản phẩm đã xóa, When khách mở trang chi tiết với slug đó, Then nhận trang "Không tìm thấy sản phẩm" với mã HTTP 404 và liên kết về danh sách sản phẩm.
- **AC27:** Given sản phẩm Đang bán, When tải trang chi tiết, Then `<title>` là "‹tên sản phẩm› | ‹tên site›"; meta description là tối đa 160 ký tự đầu của mô tả, hoặc câu chung của trang khi không có mô tả; trang có canonical và hreflang cho `vi` và `en`; và trang có một khối JSON-LD `Product` với `name`, `description`, `url` và `offers`, trong đó `price` là số nguyên, `priceCurrency` là `VND`, `availability` là `InStock` hay `OutOfStock` theo tình trạng.
- **AC28:** Given có hai sản phẩm Đang bán và một sản phẩm Ẩn, When tải `/sitemap.xml`, Then có đường dẫn chi tiết của hai sản phẩm Đang bán, mỗi đường dẫn kèm hreflang `vi`, `en` và `lastmod` là lần sửa cuối; và không có sản phẩm Ẩn.

### Technical Work

Việc kỹ thuật đi cùng Epic. Plan biến chúng thành Task, và chúng không có AC riêng.

- **TW1 · Schema của `app.products`**, theo luật expand/contract, vì `v0.3.0` nâng một database Production đã có dữ liệu: giá bán số nguyên đồng, giá gốc, trạng thái, tình trạng, tên 150 ký tự, mô tả 5.000 ký tự, và chỗ để tìm không phân biệt dấu. `v0.3.0` chỉ thêm, giữ cột cũ để rollback về `v0.2.0`; bỏ cột cũ là việc của một bản sau. Dữ liệu cũ được chuyển theo Open Question 5.
- **TW2 · Hợp đồng API sản phẩm**, dùng chung cho `api`, `admin` và `user`: danh sách có tìm, lọc trạng thái, sắp xếp và phân trang; chi tiết theo slug; thêm, sửa, xóa; kiểm dữ liệu vào; lỗi theo Problem Details như `api` đang làm. Hợp đồng này thay các endpoint cũ: danh sách trả hết một lần, `PUT /api/products/{id}/price` và `PUT /api/products/bulk-price/{slug}`. `sa` ghi hợp đồng trong plan.
- **TW3 · Design system của `user` và của `admin`**, theo token ở mục Reference Design của Epic, gồm cả giao diện sáng (Open Question 2). Chỉ lấy style, design token và cách bố trí của trang mẫu.
- **TW4 · Gỡ phần sản phẩm của API NestJS cũ:** DAL, model và mock MSW sản phẩm của `user`, nút xóa và Server Action xóa, mock origin `ecom-nest.t2g.io.vn` trong E2E của `admin`, cùng phần demo của template trên trang sản phẩm (Open Question 10). Viết lại `apps/user/e2e/products.spec.ts`, phần Products của `apps/user/e2e/accessibility.spec.ts` và `apps/admin/e2e/product-crud.spec.ts` theo các AC; hai test sản phẩm trong `apps/user/e2e/auth.spec.ts` theo Open Question 6.
- **TW5 · Ba finding Low của review `shop` PR #10:** gom `isLocal` vào `apps/user/e2e/support/env.ts` và `apps/admin/e2e/support/env.ts`; `ActuatorProbesIntegrationTest` kiểm thêm `/actuator/health/db` trả 401; `reason:` của mọi test còn bỏ qua trỏ tới đúng Epic của chúng.
- **TW6 · Năm sản phẩm thử trên Production**, trước gate ④ của `v0.3.0`, để lần nâng database chạy trên dữ liệu thật (Open Question 4).

## Tech Stack

Không thêm framework: stack như README gốc và README của từng app. Những điểm Epic này đụng tới:

- **`api`:** thêm migration Flyway sau `V3__create_products_table`, không sửa V1–V3. Tìm không phân biệt dấu cần một cách bỏ dấu ở phía `api` hay database. Extension `unaccent` chưa có: V1 chỉ kiểm `uuid-ossp`, `pgcrypto`, `citext` và `pg_trgm`, và script trong `apps/api/docker/postgres/init` chỉ chạy trên volume mới, nên database đang chạy của Development, Staging và Production không tự có extension mới. `sa` chọn cách, và thêm extension là việc phải hỏi trước (mục Boundaries).
- **`user` và `admin`:** font Urbanist (Google Fonts, giấy phép OFL), tự host để giữ CSP `font-src 'self'` của `user`; `user` có sẵn `next/font/google`. Cách dựng design system, như CSS variables hay Tailwind, do Task design system chọn.
- **`user`:** bỏ `images.remotePatterns` của `picsum.photos` trong `next.config.ts` khi không còn ảnh ngoài.

## Commands

Không đổi so với README gốc:

```
pnpm run lint
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run test:e2e
pnpm exec playwright test --project=user -g "AC18"   # E2E của một tiêu chí
```

Trên Development hay Staging, `/ao-qa` đặt `E2E_USER_URL`, `E2E_ADMIN_URL`, `E2E_HTTP_USER` và `E2E_HTTP_PASSWORD` trước `pnpm run test:e2e`.

## Project Structure

```
apps/api/src/main/java/com/tungph7/learnpostgres/feature/product/  → controller, service, repository, dto, domain, mapper
apps/api/src/main/resources/db/migration/                          → migration mới, từ V4
apps/api/src/test/java/com/tungph7/learnpostgres/feature/product/  → unit, WebMvc, DataJpa và integration test (Testcontainers)
apps/admin/src/features/product/                                    → api, components, hooks, model của sản phẩm
apps/admin/src/app/routes/products/                                 → danh sách, thêm, sửa; ngoài ProtectedRoute
apps/admin/src/lib/i18n/locales/{vi,en}/product.json                → chữ của giao diện admin
apps/admin/e2e/                                                     → E2E của US1–US4; support/env.ts
apps/user/src/features/product/                                     → model, server (DAL), components
apps/user/src/app/[locale]/products/page.tsx                        → danh sách
apps/user/src/app/[locale]/products/[slug]/page.tsx                 → trang chi tiết
apps/user/src/app/sitemap.ts                                        → thêm trang chi tiết của sản phẩm Đang bán
apps/user/messages/{vi,en}.json                                     → chữ của giao diện user
apps/user/e2e/                                                      → E2E của US5–US6; support/env.ts
docs/specs/SHOP-7/                                                  → spec.md, design.md, design/, plan.md
docs/design-system/                                                 → user.md, admin.md
docs/adr/                                                           → ADR, nếu sa ghi
```

## Code Style

Giá được định dạng bằng một hàm duy nhất trong mỗi app, dùng ở mọi chỗ hiện giá, và luôn theo `vi-VN`, kể cả ở trang tiếng Anh. Phần trăm giảm tính bằng số nguyên trước khi chia, để tránh lỗi số thực: `0.29 * 100` cho `28.999999999999996`.

```ts
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

/** 1250000 → "1.250.000 ₫". Khoảng trắng trước ₫ là U+00A0, ở cả trang vi lẫn en. */
export function formatPrice(amount: number): string {
  return vnd.format(amount);
}

/** Làm tròn xuống, tối thiểu 1: 1.500.000 → 1.250.000 là 16. */
export function discountPercent(price: number, compareAtPrice: number): number {
  return Math.max(1, Math.floor(((compareAtPrice - price) * 100) / compareAtPrice));
}
```

- Giá là số nguyên ở mọi tầng: kiểu số nguyên trong PostgreSQL và Java, `number` nguyên trong TypeScript; không có `double`, `float`, hay `BigDecimal` có phần lẻ.
- Mô tả hiện bằng text node với `white-space: pre-line`, không qua `dangerouslySetInnerHTML` hay `SafeHtml`.
- Tên E2E bắt đầu bằng mã AC và viết tiếng Anh, như `test('AC18 finds products ignoring case and Vietnamese accents', …)`.

## Testing Strategy

- **`api`:** unit test viết theo TDD cho sinh slug (các ví dụ ở Product Rules), quy tắc kiểm dữ liệu, tìm và sắp xếp. WebMvc test cho Problem Details của từng lỗi: 400 kèm trường sai, 404, và 409 cho slug trùng hay sửa chồng (AC13). Integration test với Testcontainers PostgreSQL 17 cho tìm không dấu, ba nhóm Liên quan nhất, phân trang và migration: dựng schema V3 với dữ liệu giống Production, chạy migration mới, rồi kiểm từng dòng cũ theo Open Question 5.
- **`admin`:** Vitest, Testing Library và MSW cho form (từng lỗi của AC6), ô giá, slug tự điền, hộp thoại xóa và lọc trên URL.
- **`user`:** Vitest cho `formatPrice`, `discountPercent`, đọc tham số URL (AC22), meta và JSON-LD; render test cho thẻ, trang chi tiết và trang 404.
- **E2E:** mỗi AC một test Playwright trở lên, tên bắt đầu bằng mã AC, chạy trên app thật và `api` thật, không mock API sản phẩm. E2E của `admin` ở `apps/admin/e2e/`, của `user` ở `apps/user/e2e/`. Development dùng chung, nên mỗi test tạo sản phẩm riêng qua `/api` của `admin`, với tên có tiền tố riêng của lần chạy, tìm theo tiền tố đó để đếm (như AC21), và xóa những gì nó tạo khi xong. Các AC có "trong vòng 60 giây" chờ bằng `expect.poll` tới 60 giây. Nửa sau của AC23 (chưa có sản phẩm nào) chỉ chạy được trên app dựng tại chỗ, nên mang tag `@local`.
- **Accessibility:** axe (WCAG 2.0/2.1 A và AA) quét danh sách, trang chi tiết và trang 404 của `user` ở hai ngôn ngữ, giao diện sáng lẫn tối, cùng danh sách, form và hộp thoại xóa của `admin`. Test này thay phần Products đang bỏ qua của `accessibility.spec.ts`.

## Boundaries

- **Always:**
  - kiểm dữ liệu ở cả form của `admin` lẫn `api`, và coi `api` là chốt cuối;
  - lọc sản phẩm Đang bán ở `api` và ở phía server của `user`, không chỉ ẩn trên giao diện;
  - hiện mô tả như chữ thường;
  - định dạng giá bằng một hàm duy nhất trong mỗi app;
  - dọn dữ liệu mà E2E tạo trên môi trường.
- **Ask first:**
  - thêm extension PostgreSQL, hay sửa script init của database;
  - thêm dependency, như gói font, thư viện UI hay Tailwind;
  - đổi CSP, `deploy.yaml` hay biến môi trường của app;
  - bất kỳ thay đổi nào làm `v0.2.0` không chạy được trên database đã nâng.
- **Never:**
  - lưu hay tính giá bằng số thực;
  - render mô tả như HTML;
  - bỏ cột cũ của `app.products` trong `v0.3.0`;
  - chép code, logo, ảnh, icon riêng hay tên của template trang mẫu;
  - gọi API NestJS cũ, hay mock API sản phẩm trong E2E chạy trên môi trường;
  - ghi basic auth của môi trường vào file, commit hay log.

## Success Criteria

Ngoài DoD của Epic trong `.ai-orchestrator/docs/sdlc.md`:

- Mọi Story của US1–US6 đạt DoD: E2E của từng AC từ AC1 tới AC28 pass trên Development.
- Không mock nào, trong E2E hay unit test của `admin` và `user`, còn trả sản phẩm theo dạng của API NestJS cũ. Các test còn bỏ qua chỉ là test đăng nhập (Open Question 6), với `reason:` trỏ tới Epic đăng nhập.
- Ba finding Low của PR #10 đã sửa như TW5.
- `api` không còn endpoint trả cả danh sách một lần, hay endpoint đổi giá cũ; OpenAPI ở `/v3/api-docs` mô tả đúng hợp đồng mới.
- axe không báo vi phạm WCAG A/AA nào trên các trang ở mục Testing Strategy. Ở bề rộng 320 px, danh sách và trang chi tiết của `user` không có thanh cuộn ngang.
- Lần nâng database chạy không lỗi trên bản sao dữ liệu của Production, với năm sản phẩm thử. Sau khi nâng, mỗi sản phẩm cũ còn đủ tên, slug, mô tả, và có giá theo Open Question 5. Bản `v0.2.0` vẫn khởi động và đọc được sản phẩm trên database đã nâng, để rollback được.
- `v0.3.0` lên Production sau gate ⑤, và smoke test sau deploy pass.
- Yêu cầu phi chức năng, như thời gian tải trang, cache và giới hạn của API, do `sa` ghi; Epic đạt khi chúng đạt.

## Open Questions

1. **Bản phát hành.** Epic ghi `v0.2.0`, nhưng `v0.2.0` đã lên Production ngày 2026-11-15 với SHOP-6 (chép kit), như `CHANGELOG.md` ghi. Đề xuất: Epic vào `v0.3.0`, và các sản phẩm thử có trước gate ④ của `v0.3.0`. SPEC này đã viết theo đề xuất đó.
2. **Giao diện sáng** (Open Point của Epic). Trang mẫu chỉ được đo ở giao diện tối, mà `user` và `admin` có cả sáng lẫn tối. Đề xuất: `ux` dựng bảng màu sáng từ cùng các vai trò màu (nền, bề mặt, chữ, nhấn, trạng thái), giữ độ tương phản WCAG AA; mặc định vẫn theo hệ thống như hai app đang làm.
3. **Thứ tự Liên quan nhất** (Open Point của Epic). Đề xuất của Epic là tên bắt đầu bằng từ khóa, rồi tên chứa từ khóa, rồi mới nhất trước. Tôi đề xuất thêm hai điều: tìm theo từng từ, nên tên có đủ các từ, dù không liền nhau, vẫn ra kết quả và đứng ở nhóm thứ ba; và một từ chỉ khớp phần đầu của một từ trong tên, nên `ao` không ra "Bao tay". Product Rules, AC18 và AC19 đã viết theo đề xuất này.
4. **Sản phẩm thử trên Production** (Open Point của Epic). Đề xuất của Epic: Claude thêm năm sản phẩm qua `POST /api/products` của `api` đang chạy, qua `/api` của `shop-admin` (có basic auth). Tôi đề xuất thêm: làm sau khi bạn duyệt plan và trước gate ④ của `v0.3.0`; giá nhập là số nguyên đồng như `250000.00`, vì API cũ nhận giá có hai số lẻ; trong năm sản phẩm có ít nhất một tên có dấu, một mô tả nhiều dòng, và một slug do người gõ. Như vậy lần nâng database kiểm được cả các trường hợp đó.
5. **Dữ liệu cũ khi nâng database.** Cột giá cũ là `NUMERIC(12,2)` ghi là USD, và cho phép giá 0. Đề xuất:
   - giữ nguyên con số và coi là đồng, không quy đổi từ USD, làm tròn tới đồng;
   - sản phẩm cũ có giá 0 thành Ẩn, để khách không thấy giá 0 ₫, và quản trị viên phải nhập giá lớn hơn 0 khi sửa;
   - mọi sản phẩm cũ còn lại là Đang bán, và mọi sản phẩm cũ là Còn hàng;
   - tên cũ dài hơn 150 ký tự được giữ, và chỉ phải sửa khi quản trị viên lưu lại sản phẩm đó.
6. **Bốn E2E đăng nhập đang bỏ qua.** Epic để chúng ngoài phạm vi, nhưng hai trong bốn test của `apps/user/e2e/auth.spec.ts` ("nút Xoá hiện trên /products" và "xoá sản phẩm E2E") kiểm nút xóa trên trang của khách, mà Epic này gỡ, và dùng mock sản phẩm cũ. Đề xuất: xóa hai test đó trong Epic này; giữ hai test đăng nhập và đăng xuất, vẫn bỏ qua, cùng mock auth cũ cho Epic đăng nhập; `reason:` ghi "login Epic" tới khi Epic đó có key trên Jira, vì hôm nay SHOP chưa có Epic đăng nhập. Sau Epic này còn hai test bỏ qua, thay vì tám.
7. **Mô tả có thẻ HTML.** "Không nhận HTML" có thể là từ chối khi lưu, hoặc lưu nguyên văn và hiện như chữ. Đề xuất: lưu nguyên văn và hiện như chữ, như AC25, vì từ chối sẽ chặn cả mô tả thường như "kích thước < 5 cm".
8. **Đổi slug.** Đề xuất: đường dẫn có slug cũ trả 404 và không chuyển hướng; form cảnh báo trước khi lưu, như AC12. Chuyển hướng từ slug cũ, như Shopify có, để một Epic sau nếu cần.
9. **Ảnh trong dữ liệu cấu trúc.** Ảnh giữ chỗ là chữ trên nền màu chứ không phải file ảnh, nên JSON-LD `Product` của AC27 không có `image`. Hệ quả: Google có thể chưa hiện sản phẩm ở dạng "merchant listing" có ảnh, tới khi có ảnh thật. Đề xuất: chấp nhận điều đó, và dùng ảnh Open Graph chung đang có của site cho trang chi tiết. Cách khác là sinh một ảnh cho mỗi sản phẩm (chữ cái đầu trên nền màu), nhưng việc này thêm phạm vi.
10. **Phần demo của template trên trang sản phẩm của khách.** Trang đang có nút đổi mật độ, nút đổi lưới hay danh sách, badge đếm sản phẩm (route `api/products/count`), nút làm mới, nút phóng ảnh và ảnh `picsum.photos`. Đề xuất: gỡ hết, vì không khách nào cần, và chúng gắn với API cũ. Dòng "Đã xem 24 trên 30 sản phẩm" của AC21 thay badge đếm.
11. **Độ trễ từ `admin` tới trang khách.** `admin` và `user` là hai app riêng, và `user` đang cache danh sách theo giờ. Đề xuất: thay đổi hiện ở trang khách trong vòng 60 giây; `sa` chọn cách, như cache ngắn hay báo `user` làm mới. Nếu bạn muốn thấy ngay ở lần tải trang kế tiếp, các AC có "trong vòng 60 giây" sẽ đổi theo.
12. **Các giới hạn tôi tự đặt theo chuẩn ngành**, vì Epic chưa nêu: giá bán và giá gốc tối đa 999.999.999 ₫; slug tối đa 100 ký tự, như `api` đang kiểm; từ khóa tìm tối đa 100 ký tự; `admin` hiện 20 sản phẩm mỗi trang, mới nhất trước; sản phẩm mới mặc định Đang bán và Còn hàng. Đề xuất: giữ như vậy.
