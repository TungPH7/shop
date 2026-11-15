# Spec: Danh mục sản phẩm

> **Epic:** SHOP-7 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-7 · **Status:** Draft

## Objective

Ba app của `shop` đều có phần sản phẩm lấy từ template, nhưng không khớp nhau. `api` lưu giá theo USD có số lẻ và trả cả danh sách một lần. `admin` tính giá bằng xu USD, và trang sửa nằm sau lớp đăng nhập của template. `user` gọi API NestJS cũ và còn nút xóa sản phẩm. Vì vậy chưa ai thêm được sản phẩm thật, và khách chưa xem được sản phẩm nào.

Epic này làm cho quản trị viên thêm, sửa, ẩn và xóa được sản phẩm trong `admin`, và cho khách tìm, sắp xếp và xem chi tiết sản phẩm trong `user`. Cả ba app dùng chung một hợp đồng API của `api`. Epic xong khi bản `v0.3.0` mang các việc này lên Production. Epic ghi `v0.2.0`, nhưng số đó đã thuộc bản chép kit của SHOP-6, lên Production ngày 2026-11-15.

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
  - chuyển hướng từ slug cũ sang slug mới: đổi slug thì đường dẫn cũ trả 404, và form cảnh báo trước khi lưu (AC12);
  - đăng nhập và phân quyền của `admin` và `user` (Epic đăng nhập), cùng hai E2E đăng nhập và đăng xuất còn bỏ qua (TW4);
  - mở Production cho mọi người.

### Product Rules

Các trường của một sản phẩm, theo chuẩn ngành (Shopify, Google Merchant Center). Form của `admin` và `api` kiểm cùng các quy tắc này, và `api` là chốt cuối.

| Trường | Quy tắc |
|---|---|
| Tên | Bắt buộc. Bỏ khoảng trắng ở đầu và cuối, rồi dài 1–150 ký tự. |
| Slug | Tự sinh từ tên khi thêm sản phẩm; quản trị viên sửa được. Chỉ gồm chữ thường a–z, số và dấu gạch ngang đơn, không bắt đầu hay kết thúc bằng gạch ngang, tối đa 100 ký tự. Không trùng, không phân biệt chữ hoa, chữ thường. Đổi tên không đổi slug. Đổi slug thì đường dẫn có slug cũ trả 404 (AC12). |
| Mô tả | Không bắt buộc. Chữ thường có xuống dòng, tối đa 5.000 ký tự. Lưu nguyên văn và luôn hiện như chữ, kể cả thẻ HTML, không bao giờ được hiểu là HTML (AC25). Không từ chối khi lưu, vì mô tả thường như "kích thước < 5 cm" cũng có các ký tự đó. |
| Giá bán | Bắt buộc. Đồng Việt Nam, số nguyên, từ 1 tới 999.999.999. |
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

**Ảnh giữ chỗ:** mọi sản phẩm dùng một ảnh giữ chỗ chung theo design system: chữ cái đầu của tên, viết hoa, trên nền một màu nhóm của design system. Mỗi sản phẩm giữ cố định một màu. Ảnh giữ chỗ không phải file ảnh, nên JSON-LD `Product` của AC27 không có `image`, và trang chi tiết dùng ảnh Open Graph chung đang có của site. Google có thể chưa hiện sản phẩm ở dạng "merchant listing" có ảnh, tới khi có ảnh thật.

**Tìm theo tên** (cả hai app): bỏ khoảng trắng thừa; không phân biệt chữ hoa, chữ thường hay dấu (`đ` khớp `d`). Mỗi từ của từ khóa phải khớp phần đầu của một từ trong tên, theo thứ tự bất kỳ. Vì vậy `ao th` ra "Áo thun", còn `ao` không ra "Bao tay". Từ khóa trống là không tìm. Từ khóa dài hơn 100 ký tự bị cắt ở 100.

**Sắp xếp của khách:** Mới nhất (theo ngày tạo, mặc định), Giá thấp đến cao, Giá cao đến thấp. Khi đang tìm thì có thêm Liên quan nhất, và đó là mặc định. Hai sản phẩm bằng giá thì sản phẩm mới hơn đứng trước. Thứ tự Liên quan nhất gồm ba nhóm, trong mỗi nhóm thì mới nhất trước:

1. tên bắt đầu bằng nguyên cụm từ khóa;
2. tên có nguyên cụm từ khóa ở đầu một từ;
3. tên có đủ các từ của từ khóa, nhưng không liền nhau.

**Phân trang:** khách xem 24 sản phẩm mỗi lần, với nút "Xem thêm" thay cho số trang. `admin` có số trang, 20 sản phẩm mỗi trang, mới nhất trước.

**Độ trễ:** một thay đổi lưu ở `admin` hiện ở trang của khách, gồm danh sách, trang chi tiết và sitemap, trong vòng 60 giây. `admin` và `user` là hai app riêng, và `user` đang cache danh sách theo giờ, nên `sa` đã chọn cách đạt mốc này: cache ngắn ở `user` (NFR7).

**Sản phẩm có từ trước Epic này:** cột giá cũ là `NUMERIC(12,2)` ghi là USD, và cho phép giá 0. Khi nâng database:

- giá giữ nguyên con số và được coi là đồng, không quy đổi từ USD, làm tròn tới đồng;
- sản phẩm có giá 0 thành Ẩn, để khách không thấy giá 0 ₫; quản trị viên phải nhập giá lớn hơn 0 khi sửa nó;
- mọi sản phẩm cũ còn lại là Đang bán, và mọi sản phẩm cũ là Còn hàng;
- tên dài hơn 150 ký tự được giữ, và chỉ phải sửa khi quản trị viên lưu lại sản phẩm đó.

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

- **TW1 · Schema của `app.products`**, theo luật expand/contract, vì `v0.3.0` nâng một database Production đã có dữ liệu: giá bán số nguyên đồng, giá gốc, trạng thái, tình trạng, tên 150 ký tự, mô tả 5.000 ký tự, và chỗ để tìm không phân biệt dấu. `v0.3.0` chỉ thêm, giữ cột cũ để rollback về `v0.2.0`; bỏ cột cũ là việc của một bản sau. Dữ liệu cũ được chuyển theo mục "Sản phẩm có từ trước Epic này" ở Product Rules.
- **TW2 · Hợp đồng API sản phẩm**, dùng chung cho `api`, `admin` và `user`: danh sách có tìm, lọc trạng thái, sắp xếp và phân trang; chi tiết theo slug; thêm, sửa, xóa; kiểm dữ liệu vào; lỗi theo Problem Details như `api` đang làm. Hợp đồng này thay các endpoint cũ: danh sách trả hết một lần, `PUT /api/products/{id}/price` và `PUT /api/products/bulk-price/{slug}`. `sa` ghi hợp đồng trong plan.
- **TW3 · Design system của `user` và của `admin`**, theo token ở mục Reference Design của Epic. Chỉ lấy style, design token và cách bố trí của trang mẫu. Trang mẫu chỉ được đo ở giao diện tối, nên `ux` dựng bảng màu sáng từ cùng các vai trò màu (nền, bề mặt, chữ, nhấn, trạng thái), giữ độ tương phản WCAG AA. Mặc định vẫn theo giao diện của hệ thống, như hai app đang làm.
- **TW4 · Gỡ phần sản phẩm của API NestJS cũ:** DAL, model và mock MSW sản phẩm của `user`, nút xóa và Server Action xóa, mock origin `ecom-nest.t2g.io.vn` trong E2E của `admin`. Gỡ luôn phần demo của template trên trang sản phẩm của khách: nút đổi mật độ, nút đổi lưới hay danh sách, badge đếm sản phẩm cùng route `api/products/count`, nút làm mới, nút phóng ảnh và ảnh `picsum.photos`; dòng "Đã xem 24 trên 30 sản phẩm" của AC21 thay badge đếm. Viết lại `apps/user/e2e/products.spec.ts`, phần Products của `apps/user/e2e/accessibility.spec.ts` và `apps/admin/e2e/product-crud.spec.ts` theo các AC. Trong `apps/user/e2e/auth.spec.ts`, xóa hai test kiểm nút xóa trên trang của khách ("nút Xoá hiện trên /products" và "xoá sản phẩm E2E"). Hai test đăng nhập và đăng xuất còn lại vẫn bỏ qua, và giữ mock auth cũ cho Epic đăng nhập. `reason:` của chúng ghi "login Epic" tới khi Epic đó có key trên Jira, vì ngày 2026-11-15 SHOP chưa có Epic đăng nhập.
- **TW5 · Ba finding Low của review `shop` PR #10:** gom `isLocal` vào `apps/user/e2e/support/env.ts` và `apps/admin/e2e/support/env.ts`; `ActuatorProbesIntegrationTest` kiểm thêm `/actuator/health/db` trả 401; `reason:` của mọi test còn bỏ qua trỏ tới đúng Epic của chúng.
- **TW6 · Năm sản phẩm thử trên Production**, để lần nâng database chạy trên dữ liệu thật. Claude thêm chúng qua `POST /api/products` của `api` đang chạy trên Production, qua `/api` của `shop-admin` (có basic auth), sau gate ② và trước gate ④ của `v0.3.0`. Giá nhập là số nguyên đồng như `250000.00`, vì API cũ nhận giá có hai số lẻ. Trong năm sản phẩm có ít nhất một tên có dấu, một mô tả nhiều dòng và một slug do người gõ, để lần nâng database kiểm được cả các trường hợp đó.

### Non-functional requirements

Do `sa` ghi ngày 2026-11-15. Mỗi yêu cầu có mã NFR<n> để plan và Story trỏ tới, và nói cách kiểm. Các quyết định ở đây là đề xuất của `sa`, theo lời dặn của bạn cho các chặng sau; không quyết định nào cần quyền mà agent không có.

**Quy mô**

- **NFR1 · Quy mô thiết kế:** tới 10.000 sản phẩm; 1–2 quản trị viên cùng lúc, mỗi người tới 2 tab; trang của khách tới 10 yêu cầu/giây. Mọi môi trường, kể cả Production (`production_auth`), còn sau basic auth tới khi mở cho mọi người (ngoài Scope), nên lượng truy cập thật thấp hơn nhiều. Tài nguyên giữ như `deploy.yaml`: `api` 768 MB, database 256 MB.

**Hiệu năng**

- **NFR2 · `api`:** với 10.000 sản phẩm trong database, mỗi lệnh danh sách (tìm, lọc, mỗi kiểu sắp xếp, trang bất kỳ) và lệnh chi tiết xong trong 200 ms, lệnh thêm, sửa, xóa trong 300 ms, đo ở `api`. Mỗi lệnh danh sách chạy tối đa hai câu SQL (một trang và tổng số), không có N+1. Kiểm: integration test (Testcontainers) nạp 10.000 sản phẩm, chạy mỗi kiểu truy vấn 5 lần và lấy trung vị.
- **NFR3 · Giới hạn của mỗi lệnh:** một lệnh danh sách trả tối đa 100 sản phẩm (`admin` dùng 20, `user` 24). `api` bỏ khoảng trắng thừa của từ khóa rồi cắt ở 100 ký tự; kiểu sắp xếp và trạng thái chỉ nhận các giá trị đã định; số trang là số nguyên dương; giá trị sai trả 400. Mọi đường dẫn của khách, kể cả số đã xem rất lớn (AC22), chỉ gây ra một số lệnh tới `api` và một số dòng đọc có giới hạn, tính theo số sản phẩm Đang bán chứ không theo giá trị trong URL. Kiểm: WebMvc test cho 400 của từng tham số sai; E2E mở trang Sản phẩm với số đã xem bằng 999999 và thấy trang bình thường trong 2 s.
- **NFR4 · Trang của khách:** trên Staging, đo bằng performance trace của chrome-devtools, giả lập điện thoại (Slow 4G, CPU chậm 4 lần): S4 và S5 có LCP ≤ 2,5 s và CLS ≤ 0,1; bấm Xem thêm và đổi sắp xếp có INP ≤ 200 ms; khi dữ liệu đã có trong cache của `user`, TTFB ≤ 600 ms. Trang sản phẩm không thêm thư viện JavaScript nào chạy ở trình duyệt. Kiểm: `qa` ghi số đo vào báo cáo QA của Story US5 và US6.
- **NFR5 · Font:** file woff2 tự host trong bản build; tối đa ba độ đậm (500, 600, 700) hoặc một file variable; chỉ các subset `latin`, `latin-ext` và `vietnamese`; `font-display: swap`; font dự phòng có chỉnh cỡ (`size-adjust`) để lúc đổi font bố cục không nhảy (CLS ở NFR4). Một trang tải tối đa 150 KB font.
- **NFR6 · `admin`:** trên Staging, danh sách cập nhật trong 1 s sau 300 ms ngừng gõ, hay sau khi đổi bộ lọc hay trang; sau khi bấm Lưu hay Xóa, thông báo kết quả hiện trong 1 s.

**Độ trễ của dữ liệu**

- **NFR7 · Mốc 60 giây** (Product Rules, Độ trễ): `sa` chọn cache ngắn ở `user`, không có lệnh báo `user` làm mới. Mọi dữ liệu sản phẩm mà `user` cache phía server (danh sách, chi tiết, sitemap) hết hạn sau tối đa 30 s, và cache router của trình duyệt giữ tối đa 30 s, nên cộng lại không quá 60 s. Lý do: lệnh báo làm mới cần một secret chung mới giữa `admin` hay `api` và `user` trên VPS (mục Ask first), và lời gọi giữa hai app có thể hỏng mà không ai thấy; cache ngắn chỉ thêm tối đa một lệnh tới `api` mỗi 30 s cho mỗi đường dẫn đang được xem, nhỏ ở quy mô NFR1. Next có thể không đưa cache ngắn như vậy vào phần dựng sẵn (prerender), nên phần dữ liệu sản phẩm nằm trong `<Suspense>` và render lúc có yêu cầu; plan kiểm điều này với Next 16.4.6. Trang chi tiết phải quyết định 404 trước khi gửi phần đầu của trang, vì sau đó mã HTTP không đổi được nữa (AC26). Kiểm: E2E của AC9, AC10, AC11 và AC15 chờ bằng `expect.poll`, như Testing Strategy.

**Bảo mật**

- **NFR8 · Ai gọi được lệnh ghi:** tới Epic đăng nhập, `/api/**` của `api` vẫn `permitAll`, và chỉ mạng giữ các lệnh ghi. `api` không có host công khai (`deploy.yaml` không khai host cho nó), và chỉ hai đường tới được nó: `/api/*` của host `admin`, sau basic auth của VPS, và server của `user` qua `API_URL`. `user` chỉ gọi các lệnh đọc sản phẩm, và không có route hay Server Action nào ghi sản phẩm (TW4 gỡ Server Action xóa). Release note của `v0.3.0` ghi điều này ở Known Issues. Kiểm: `security` review các PR của TW2 và TW4; unit test cho thấy DAL sản phẩm của `user` chỉ gửi GET.
- **NFR9 · Sản phẩm Ẩn không lộ ra:** lệnh đọc dành cho khách của `api` luôn chỉ trả sản phẩm Đang bán, và không nhận tham số nào mở ra sản phẩm Ẩn; `admin` dùng lệnh đọc riêng có lọc trạng thái. Slug chưa từng có, slug của sản phẩm Ẩn và của sản phẩm đã xóa cho cùng một phản hồi 404, ở `api` lẫn ở trang của khách, để không ai đoán ra một sản phẩm Ẩn có tồn tại. Không chỗ nào của trang khách (danh sách, tổng số, chi tiết, meta, JSON-LD, sitemap) đếm hay nhắc tới sản phẩm Ẩn. Kiểm: WebMvc test so phản hồi 404 của ba trường hợp; E2E của AC10, AC16, AC26 và AC28.
- **NFR10 · Dữ liệu vào:** `api` kiểm mọi trường theo Product Rules bằng Bean Validation, và các tham số theo NFR3. Mọi câu SQL dùng tham số bind; từ khóa được thoát `%`, `_` và `\` trước khi vào `LIKE`, để tìm `%` hay `_` không ra mọi sản phẩm. Kiểm: unit và integration test với từ khóa `%`, `_`, `\` và `'`.
- **NFR11 · Dữ liệu ra:** tên và mô tả luôn hiện như chữ (AC25), ở cả `admin`. JSON-LD chỉ dựng qua `JsonLd` đang có của `user`, vốn đổi `<` thành `\u003c`; meta description đi qua Metadata API của Next. Kiểm: test của AC25 thêm một mô tả có `</script><script>alert(1)</script>`, và kiểm khối JSON-LD và thẻ meta không mở script nào.
- **NFR12 · Lỗi và log:** Problem Details không lộ stack trace, câu SQL hay tên ràng buộc, như `api` đang làm. Slug trùng trả 409 dựa vào ràng buộc UNIQUE của database, không chỉ nhờ bước kiểm trước, vì hai lần thêm cùng lúc đều qua được bước kiểm trước. `api` ghi log INFO cho mỗi lần thêm, sửa, xóa, gồm thao tác, `id`, slug và correlation id; không ghi mô tả, thân yêu cầu hay header `Authorization`. Header đó có thể mang basic auth của host `admin`, vì proxy `/api/*` của `admin` chuyển nó tới `api`. Kiểm: unit test của exception handler; `security` review.
- **NFR13 · Dependency và CSP:** dependency mới duy nhất là gói font (Tech Stack), ghim đúng phiên bản trong `pnpm-lock.yaml`, giấy phép OFL-1.1. Không nới CSP nào: `user` giữ `font-src 'self'` và `img-src 'self' blob: data:`, và bỏ `images.remotePatterns` của `picsum.photos`.

**Dữ liệu**

- **NFR14 · Kiểu của giá:** cột giá mới là `BIGINT` (Java `long`, TypeScript `number` nguyên), vì giá cũ `NUMERIC(12,2)` lên tới 9.999.999.999, vượt `INTEGER`. Cũng vì vậy, phép tính `(giá gốc − giá bán) × 100` (gần 10^11) vượt `int` của Java nếu `api` tính phần trăm giảm.
- **NFR15 · Ràng buộc trong database:** database là chốt sau `api`. CHECK cho giá bán (0 tới 999.999.999, và giá 0 chỉ có ở sản phẩm Ẩn), giá gốc (lớn hơn giá bán, tối đa 999.999.999), trạng thái và tình trạng (chỉ các giá trị của Product Rules); UNIQUE cho slug không phân biệt chữ hoa, chữ thường (`citext`, như V3). Tên và định dạng slug không có CHECK, vì dữ liệu cũ có thể sai các quy tắc đó và được giữ (Product Rules và NFR16); `api` kiểm chúng khi lưu.
- **NFR16 · Dữ liệu cũ ngoài Product Rules:** hai trường hợp mục "Sản phẩm có từ trước Epic này" chưa nêu, `sa` quyết như sau.
  - Giá cũ lớn hơn 999.999.999 (V3 nhận tới 9.999.999.999,99): sản phẩm giữ con số, làm tròn tới đồng, và thành Ẩn như sản phẩm giá 0; quản trị viên phải nhập giá hợp lệ khi sửa nó.
  - Slug cũ sai định dạng mới (V3 nhận `^[a-z0-9-]+$`, nên có thể có gạch ngang ở đầu, ở cuối hay hai gạch liền nhau): slug được giữ, và đường dẫn của nó vẫn mở được. Form và `api` chỉ kiểm định dạng slug khi quản trị viên đổi slug, để lưu lại sản phẩm cũ không bắt đổi đường dẫn của nó (AC12).
- **NFR17 · Migration** (TW1): chỉ bước expand. Mỗi file Flyway chạy trong một transaction; với 10.000 dòng, migration xong trong 10 s, và chỉ khóa bảng trong lúc `ALTER TABLE`. Deployer dựng bản mới trong khi bản cũ còn chạy, nên trong lúc chuyển và sau rollback, hai bản đọc và ghi đúng trên cùng một schema:
  - `v0.2.0` thêm sản phẩm hay sửa giá (cả `PUT /api/products/{id}/price` và `bulk-price`) thì các cột mới vẫn đúng, theo cùng quy tắc như dữ liệu cũ (Product Rules và NFR16);
  - `v0.3.0` ghi thì cột giá cũ vẫn đúng, để `v0.2.0` đọc được sau rollback;
  - `v0.2.0` khởi động được trên lịch sử Flyway có migration mới (Flyway mặc định bỏ qua migration "future") và với `ddl-auto: validate` của nó (cột cũ giữ kiểu).
  Plan chọn cơ chế, như trigger hay ghi cả hai cột, và nói bản nào bỏ cột giá cũ. Kiểm: integration test của migration ở Testing Strategy, cộng một test chạy các lệnh ghi của `v0.2.0` trên schema mới.
- **NFR18 · Thứ tự ổn định:** mọi kiểu sắp xếp lấy `id` (UUIDv7) làm khóa cuối, để phân trang không lặp hay sót sản phẩm khi nhiều sản phẩm cùng `created_at` hay cùng giá. Khi Xem thêm nối trang mới, `user` bỏ những sản phẩm đã hiện (theo `id`), vì một sản phẩm thêm vào giữa hai lần tải đẩy cả danh sách xuống một chỗ. Kiểm: integration test với sản phẩm cùng giá và cùng `created_at`; unit test của phần nối trang.
- **NFR19 · Ghi chồng và thử lại** (AC13): lệnh sửa gửi `version` có sẵn của `BaseEntity` (optimistic locking), và `api` trả 409 khi `version` khác bản trong database. `admin` không tự thử lại lệnh thêm, sửa, xóa sản phẩm. Hiện `api-client` của `admin` tự thử lại PUT và DELETE khi lỗi mạng: một lần sửa đã thành công mà mất phản hồi sẽ nhận 409 giả ở lần thử lại, và một lần xóa đã thành công sẽ nhận 404. Khi lỗi mạng hay hết giờ lúc ghi, form hiện "Không lưu được. Vui lòng thử lại." (S2.5) và hộp thoại hiện lỗi của S3.6. Kiểm: unit test của hook ghi với MSW; WebMvc test của 409.

**Lưu giữ**

- **NFR20 · Sản phẩm đã xóa:** sản phẩm còn tới khi quản trị viên xóa nó. Xóa là xóa hẳn dòng trong database, không có thùng rác hay xóa mềm (US4). Dòng đã xóa còn trong các bản backup hằng ngày của kit (mọi bản của 48 giờ gần nhất, một bản mỗi ngày của 7 ngày, một bản mỗi tuần của 4 tuần), nên lấy lại được trong khoảng 4 tuần, bằng tay, bởi người có quyền trên VPS. Sản phẩm không chứa dữ liệu cá nhân, nên không có yêu cầu xóa nó khỏi backup.
- **NFR21 · Cache và công cụ tìm kiếm:** sản phẩm Ẩn hay đã xóa rời mọi trang của khách và sitemap trong 60 s (NFR7). Công cụ tìm kiếm bỏ đường dẫn khi gặp 404 ở lần thu thập sau; việc đó ngoài tầm của Epic.
- **NFR22 · Cột giá cũ:** `price NUMERIC(12,2)` ở lại trong `v0.3.0` để rollback về `v0.2.0`. Bước contract bỏ nó ở một bản sau, sớm nhất là `v0.4.0`, khi `v0.3.0` đã chạy ổn trên Production và không còn cần rollback về `v0.2.0`; plan ghi bản đó.
- **NFR23 · Dữ liệu của E2E:** mỗi test xóa những gì nó tạo (Testing Strategy). Sản phẩm có tiền tố E2E còn sót lại sau một lần chạy hỏng bị lần chạy sau xóa: trước khi chạy, E2E xóa mọi sản phẩm có tiền tố E2E tạo cách đây hơn 1 giờ, để không đụng một lần chạy khác đang diễn ra. E2E không ghi gì trên Production.
- **NFR24 · Sản phẩm thử trên Production** (TW6): năm sản phẩm ở lại Production sau `v0.3.0`, và phải được xóa hay thay bằng sản phẩm thật trước khi mở Production cho mọi người. Release note của `v0.3.0` ghi việc này.
- **NFR25 · Dữ liệu cá nhân:** Epic không thêm dữ liệu cá nhân nào. `created_by` và `updated_by` vẫn là `system` tới Epic đăng nhập. Log của `api` vẫn có IP của người gọi (`X-Forwarded-For`) như hiện nay; Epic không thêm gì vào log ngoài NFR12.

**Khả dụng**

- **NFR26 · Khi `api` lỗi:** mỗi lệnh `user` gửi tới `api` có thời hạn 5 s (hiện `httpGet` không có thời hạn nào). Khi `api` lỗi hay hết giờ, trang của khách không bao giờ hiện danh sách trống hay "Chưa có sản phẩm nào.", để khách không tưởng shop hết hàng: danh sách hiện trạng thái lỗi của S4.5; trang chi tiết là trang lỗi với mã 5xx, không phải 404, để công cụ tìm kiếm không bỏ sản phẩm; sitemap trả 5xx thay vì một sitemap thiếu sản phẩm. `admin` hiện trạng thái lỗi của S1.6 và S2.3. Kiểm: unit test của DAL với `api` chậm và `api` trả 500.
- **NFR27 · Deploy:** smoke test của deployer giữ như `deploy.yaml` (`/en`, `/`, `/actuator/health`). Epic không đổi `deploy.yaml`, secret hay biến môi trường nào trên VPS, nên không cần mục Ask first nào. Deployer không tự dump database trước khi chạy migration, nên ở gate ⑤ bạn xác nhận bản backup mới nhất của Production cách đó không quá 24 giờ; agent không được đọc backup.

## Tech Stack

Không thêm framework: stack như README gốc và README của từng app. Những điểm Epic này đụng tới:

- **`api`:** không thêm dependency: Java 21, Spring Boot 4.0.6, PostgreSQL 17 (`postgres:17-alpine`, cùng image ở `deploy.yaml` và ở Testcontainers). Thêm migration Flyway sau `V3__create_products_table`, không sửa V1–V3.
- **Tìm không dấu mà không thêm extension** (quyết định của `sa`): extension `unaccent` chưa có. V1 chỉ kiểm `uuid-ossp`, `pgcrypto`, `citext` và `pg_trgm`, và script trong `apps/api/docker/postgres/init` chỉ chạy trên volume mới, nên database đang chạy của Development, Staging và Production không tự có extension mới; thêm nó là việc phải hỏi trước (mục Boundaries). Hàm `unaccent()` lại là STABLE, nên không dùng thẳng được trong cột sinh hay index. Thay vào đó, một hàm SQL IMMUTABLE trong schema `app` bỏ dấu bằng các hàm có sẵn của PostgreSQL 17: `normalize(…, NFD)`, `regexp_replace` bỏ các dấu kết hợp U+0300–U+036F, `translate` cho `đ` và `Đ`, rồi `lower`. Hàm này dựng một cột sinh (`GENERATED ALWAYS AS … STORED`) chứa tên đã bỏ dấu, và cũng bỏ dấu từ khóa trong câu tìm, nên tên và từ khóa đi qua cùng một hàm. Cột sinh tự điền cho cả những dòng `v0.2.0` ghi trong lúc chuyển hay sau rollback (NFR17), điều mà một cột do Java điền không làm được. Nếu NFR2 cần index, dùng `pg_trgm` đã có. Slug sinh ở `api` bằng `java.text.Normalizer` của Java, kiểm bằng các ví dụ ở Product Rules.
- **`user` và `admin`:** font tự host để giữ CSP `font-src 'self'` của `user`. `user` dùng `next/font/google` của Next 16.4.6, vốn tải font lúc build, tự host nó trong bản build và dựng font dự phòng có chỉnh cỡ (NFR5); `admin` dùng gói Fontsource của cùng font, ghim đúng phiên bản. Urbanist (`@fontsource-variable/urbanist` 5.3.0, OFL-1.1, lấy từ Google Fonts) chỉ có subset `latin` và `latin-ext`, mà hai subset này bỏ trống U+1EA0–U+1EF1: phần lớn chữ có dấu thanh (ả, ầ, ẩ, ổ, ữ, ự…) sẽ hiện bằng font dự phòng, ngay giữa một từ như "Sản phẩm" hay "cổ". Đó là trường hợp "nhìn lệch" ở dòng Font family của `design.md`, nên `sa` đề xuất Be Vietnam Pro (`@fontsource/be-vietnam-pro` 5.3.0, OFL-1.1, có subset `vietnamese` và các độ đậm 500, 600, 700). `fe-dev` vẫn xem bằng mắt ở Task design system như `design.md` dặn, rồi ghi font đã chọn vào `docs/design-system/<app>.md` và mô tả PR. Cách dựng design system, như CSS variables hay Tailwind, do Task design system chọn. Tham số trên URL dùng `nuqs` 2.8.9 có sẵn ở cả hai app, không thêm thư viện.
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

- **`api`:** unit test viết theo TDD cho sinh slug (các ví dụ ở Product Rules), quy tắc kiểm dữ liệu, tìm và sắp xếp. WebMvc test cho Problem Details của từng lỗi: 400 kèm trường sai, 404, và 409 cho slug trùng hay sửa chồng (AC13). Integration test với Testcontainers PostgreSQL 17 cho tìm không dấu, ba nhóm Liên quan nhất, phân trang và migration: dựng schema V3 với dữ liệu giống Production, chạy migration mới, rồi kiểm từng dòng cũ theo mục "Sản phẩm có từ trước Epic này" ở Product Rules.
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
  - dọn dữ liệu mà E2E tạo trên môi trường;
  - khi thêm dependency, như gói font, thư viện UI hay Tailwind, hay khi đổi CSP: ghi lý do trong mô tả PR, để reviewer và security xét.
- **Ask first:** chỉ những việc cần quyền mà agent không có.
  - thêm extension PostgreSQL vào database đang chạy của Development, Staging hay Production: việc này cần quyền trên VPS; script init trong repo sửa được, nhưng chỉ chạy trên volume mới;
  - đổi `deploy.yaml`, nằm trong đường dẫn được bảo vệ `.ai-orchestrator/**`, hay secret và biến môi trường của app trên VPS.
- **Never:**
  - lưu hay tính giá bằng số thực;
  - render mô tả như HTML;
  - làm `v0.2.0` không chạy được trên database đã nâng, như bỏ cột cũ của `app.products` trong `v0.3.0`;
  - chép code, logo, ảnh, icon riêng hay tên của template trang mẫu;
  - gọi API NestJS cũ, hay mock API sản phẩm trong E2E chạy trên môi trường;
  - ghi basic auth của môi trường vào file, commit hay log.

## Success Criteria

Ngoài DoD của Epic trong `.ai-orchestrator/docs/sdlc.md`:

- Mọi Story của US1–US6 đạt DoD: E2E của từng AC từ AC1 tới AC28 pass trên Development.
- Không mock nào, trong E2E hay unit test của `admin` và `user`, còn trả sản phẩm theo dạng của API NestJS cũ. Chỉ còn hai test bỏ qua, thay vì tám: đăng nhập và đăng xuất trong `apps/user/e2e/auth.spec.ts`, với `reason:` trỏ tới Epic đăng nhập (TW4).
- Ba finding Low của PR #10 đã sửa như TW5.
- `api` không còn endpoint trả cả danh sách một lần, hay endpoint đổi giá cũ; OpenAPI ở `/v3/api-docs` mô tả đúng hợp đồng mới.
- axe không báo vi phạm WCAG A/AA nào trên các trang ở mục Testing Strategy. Ở bề rộng 320 px, danh sách và trang chi tiết của `user` không có thanh cuộn ngang.
- Lần nâng database chạy không lỗi trên bản sao dữ liệu của Production, với năm sản phẩm thử. Sau khi nâng, mỗi sản phẩm cũ còn đủ tên, slug, mô tả, và có giá, trạng thái, tình trạng theo mục "Sản phẩm có từ trước Epic này" ở Product Rules. Bản `v0.2.0` vẫn khởi động và đọc được sản phẩm trên database đã nâng, để rollback được.
- `v0.3.0` lên Production sau gate ⑤, và smoke test sau deploy pass.
- Các yêu cầu NFR1–NFR27 ở mục Non-functional requirements đạt, mỗi yêu cầu theo cách kiểm của nó.

## Open Questions

Không có. Ngày 2026-11-15 bạn đồng ý cả 12 đề xuất, và mỗi câu trả lời đã thành quyết định ở mục của nó.

`sa` không có câu hỏi: các quyết định của `sa` (cache ngắn, tìm không dấu mà không thêm extension, font có tiếng Việt, kiểu `BIGINT` của giá, hai trường hợp dữ liệu cũ ở NFR16) ghi ở mục Non-functional requirements và Tech Stack, và không quyết định nào cần quyền mà agent không có.

Câu hỏi mới ở các chặng sau của Epic: agent làm theo đề xuất của mình và ghi quyết định vào artifact của chặng đó. Agent chỉ hỏi bạn những việc cần quyền mà agent không có (mục Boundaries, Ask first).
