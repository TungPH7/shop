# Spec: Danh mục sản phẩm

> **Epic:** SHOP-81 · **Jira:** https://phunghuutung12b4.atlassian.net/browse/SHOP-81 · **Status:** Draft

## Objective

Từ SHOP-7 (`v0.3.0`, đã lên Production ngày 2026-11-17), khách của `user` chỉ thấy một danh sách sản phẩm chung, nên khó tìm theo loại hàng. `user` cũng chưa có trang nào gom sản phẩm theo loại để máy tìm kiếm lập chỉ mục.

Epic này thêm danh mục một cấp. Quản trị viên tạo danh mục trong `admin` và gán sản phẩm vào, còn khách xem được trang của từng danh mục trong `user`. Epic xong khi:

- khách mở `/vi/categories/<slug>` hay `/en/categories/<slug>` và thấy đúng các sản phẩm Đang bán của danh mục đó;
- trang chi tiết sản phẩm có breadcrumb dẫn về danh mục;
- trang danh mục có title, meta và breadcrumb riêng, và có trong sitemap;
- bản release chứa các việc này lên Production. Bản kế tiếp theo SemVer là `v0.4.0`.

Màn hình của Epic do `ux` viết ở `docs/specs/SHOP-81/design.md`. Màn hình của `admin` gồm danh sách danh mục, form danh mục, hộp thoại xóa, cùng ô Danh mục thêm vào form sản phẩm của SHOP-7. Màn hình của `user` gồm trang danh mục, trang "Không tìm thấy danh mục", các liên kết danh mục trên danh sách sản phẩm, và breadcrumb trên trang chi tiết sản phẩm. `user` có `seo: true`, nên `seo` viết mục `## SEO` của SPEC này cho các màn hình của `user`, gồm chữ vi và en của title, meta description và H1. `sa` viết mục Non-functional requirements. Chữ trong các AC dưới đây là bản tiếng Việt; bản tiếng Anh nằm trong `design.md` và mục SEO.

### Users

- **Quản trị viên của shop:** dùng `admin` trên máy tính để tạo, sửa, ẩn, xóa danh mục và gán sản phẩm vào danh mục, bằng tiếng Việt hoặc tiếng Anh như `admin` đang có. Tới khi có Epic đăng nhập, basic auth của host giữ `admin` ở cả ba môi trường.
- **Khách mua hàng:** dùng `user` trên máy tính và điện thoại, bằng tiếng Việt hoặc tiếng Anh.

### Scope

- **In:**
  - danh mục một cấp. Mỗi sản phẩm thuộc tối đa một danh mục, và có thể chưa thuộc danh mục nào;
  - `admin`: danh sách danh mục; tạo, sửa, ẩn và xóa danh mục, kể cả danh mục còn sản phẩm (AC8); chọn danh mục trong form sản phẩm;
  - `user`: trang `/[locale]/categories/<slug>` liệt kê sản phẩm của danh mục, với sắp xếp và "Xem thêm" như danh sách sản phẩm hiện có; liên kết tới các danh mục trên trang danh sách sản phẩm; breadcrumb trên trang chi tiết sản phẩm;
  - SEO của trang danh mục: title, meta description, canonical, hreflang, BreadcrumbList, và có trong sitemap; BreadcrumbList của trang chi tiết sản phẩm.
- **Out:**
  - danh mục nhiều cấp; một sản phẩm thuộc nhiều danh mục;
  - tên danh mục theo từng ngôn ngữ: danh mục nhập một lần và hiện như nhau ở hai ngôn ngữ, như sản phẩm của SHOP-7;
  - mô tả và ảnh của danh mục; kéo thả để đổi thứ tự danh mục;
  - lọc danh sách sản phẩm của `admin` theo danh mục (AC11, bỏ ngày 2026-11-21);
  - ô tìm trên trang danh mục, và lọc theo danh mục trên trang danh sách sản phẩm của khách: khách đi tới danh mục bằng liên kết (AC17);
  - chuyển hướng slug cũ của danh mục: đổi slug thì đường dẫn cũ trả 404;
  - đăng nhập và phân quyền;
  - bước contract của `app.products`, tức bỏ cột giá cũ `price NUMERIC(12,2)` (NFR22 của SHOP-7): Epic này không đụng tới nó.

### Constraints

- **Plan gọn cho lần chạy thật T14 của module C2 của kit:** tối đa 3 item. Bạn đề xuất:
  - một Task nền làm trước: bảng danh mục, migration và API (TW1, TW2);
  - rồi hai Story độc lập, chạy song song được trong hai làn: một Story cho `admin` (US1, US2) và một Story cho `user` (US3, US4).
- Mỗi item đủ nhỏ để một lượt dev làm xong, và cả Epic vẫn thử được các phần mới của C2: `/ao-run` chạy cả Epic; hai item chạy song song trong hai làn, có lúc hai agent cùng role; `reviewer` và `security` review cùng lúc; xem trước trong làn; một PR merge trong lúc item kia đang QA trên Development.

### Category Rules

Các trường của một danh mục. Form của `admin` và `api` kiểm cùng các quy tắc này, và `api` là chốt cuối.

| Trường | Quy tắc |
|---|---|
| Tên | Bắt buộc. Bỏ khoảng trắng ở đầu và cuối, rồi dài 1–60 ký tự. Không trùng với tên của danh mục khác, không phân biệt chữ hoa, chữ thường: có "Áo" thì không thêm được "áo". |
| Slug | Tự sinh từ tên khi thêm danh mục, và quản trị viên sửa được. Theo đúng các quy tắc slug của sản phẩm ở SPEC của SHOP-7: chỉ gồm chữ thường a–z, số và dấu gạch ngang đơn, không bắt đầu hay kết thúc bằng gạch ngang, tối đa 100 ký tự; cùng cách sinh slug, kể cả thêm `-2`, `-3`… khi slug sinh ra đã có. Không trùng với slug của danh mục khác, không phân biệt chữ hoa, chữ thường. Slug của danh mục và slug của sản phẩm là hai nhóm riêng, nên trùng nhau được. Đổi tên không đổi slug. Đổi slug thì đường dẫn có slug cũ trả 404. |
| Trạng thái | Hiện hoặc Ẩn. Danh mục mới mặc định là Hiện. |
| Số sản phẩm | Không nhập: là số sản phẩm thuộc danh mục, gồm cả sản phẩm Đang bán lẫn Ẩn. Chỉ `admin` thấy số này. |

**Danh mục của một sản phẩm:** ô Danh mục trong form sản phẩm có "Không có danh mục" và mọi danh mục, kể cả danh mục Ẩn, để quản trị viên chuẩn bị sản phẩm trước khi cho hiện danh mục. Sản phẩm mới mặc định là "Không có danh mục". Sản phẩm có từ trước Epic này đều không có danh mục.

**Khách thấy một danh mục khi** danh mục đó Hiện. Danh mục Ẩn, hay đã xóa, không hiện ở chỗ nào của trang khách: trang của nó trả 404, nó không có trong các liên kết danh mục, trong breadcrumb, trong JSON-LD hay trong sitemap. Sản phẩm Đang bán của một danh mục Ẩn vẫn hiện ở danh sách sản phẩm chung và có trang chi tiết như cũ.

**Danh mục Hiện mà chưa có sản phẩm Đang bán nào:** trang của nó mở được và báo chưa có sản phẩm (AC15). Nó không có trong các liên kết danh mục (AC17) và trong sitemap (AC19), để khách và máy tìm kiếm không gặp trang trống. `seo` quyết thẻ robots của trang này ở mục SEO.

**Thứ tự danh mục:** theo tên, A→Z, theo cách xếp chữ tiếng Việt và không phân biệt chữ hoa, chữ thường, ở cả `admin` lẫn `user`. Ví dụ: "Áo khoác", "Bao tay", "Đầm", "Quần".

**Sản phẩm trên trang danh mục:** chỉ sản phẩm Đang bán của danh mục. Sắp xếp và "Xem thêm" như danh sách sản phẩm của SHOP-7: Mới nhất (mặc định), Giá thấp đến cao, Giá cao đến thấp; hai sản phẩm bằng giá thì sản phẩm mới hơn đứng trước; mỗi lần 24 sản phẩm; đường dẫn giữ kiểu sắp xếp và số sản phẩm đã xem, và một giá trị sai trên đường dẫn trở về giá trị mặc định. Trang danh mục không có ô tìm, nên không có Liên quan nhất.

**Xóa danh mục:** xóa được mọi danh mục, kể cả danh mục còn sản phẩm, sau một bước xác nhận. Khi danh mục còn sản phẩm, hộp thoại xác nhận nêu số sản phẩm của nó, gồm cả sản phẩm Ẩn, và nói rằng các sản phẩm đó sẽ thành "Không có danh mục" (AC8). Xóa danh mục không bao giờ xóa sản phẩm nào, và không đổi trường nào khác của chúng: tên, slug, giá, trạng thái và tình trạng còn nguyên. Sản phẩm Đang bán của danh mục đã xóa vẫn ở danh sách sản phẩm chung, và breadcrumb của nó thành "Trang chủ › ‹tên sản phẩm›" (AC21).

**Độ trễ:** một thay đổi lưu ở `admin` hiện ở trang của khách, gồm trang danh mục, các liên kết danh mục, breadcrumb và sitemap, trong vòng 60 giây, như sản phẩm của SHOP-7 (NFR7 của SHOP-7).

### User Stories

#### US1 · Quản trị viên quản lý danh mục

Là quản trị viên, tôi muốn tạo, sửa, ẩn và xóa danh mục trong `admin`, để sắp sản phẩm theo loại.

- **AC1:** Given có danh mục "Áo" Hiện với 3 sản phẩm và danh mục "Phụ kiện" Ẩn chưa có sản phẩm nào, When mở trang Danh mục của `admin`, Then thấy cả hai, "Áo" trước "Phụ kiện", mỗi dòng có tên, slug, trạng thái và số sản phẩm ("3" và "0"); Given chưa có danh mục nào, When mở trang Danh mục, Then thấy "Chưa có danh mục nào." và nút Thêm danh mục.
- **AC2:** Given form Thêm danh mục, When gõ tên "Áo khoác nữ", Then ô slug tự điền `ao-khoac-nu`; When lưu, Then thấy "Đã thêm danh mục", và danh mục có trong danh sách với trạng thái Hiện và số sản phẩm "0".
- **AC3:** Given form Thêm danh mục hay form sửa một danh mục, When lưu với một trong các giá trị sai sau: tên trống hay chỉ có khoảng trắng, tên 61 ký tự, slug có chữ hoa, dấu, khoảng trắng hay gạch ngang ở đầu, Then danh mục không được lưu, ô sai có lỗi ngay bên dưới, và những gì đã nhập còn nguyên; When gửi thẳng các giá trị đó tới API của danh mục mà không qua form, Then API trả 400 dạng Problem Details, nêu từng trường sai, và không lưu gì.
- **AC4:** Given đã có danh mục "Áo thun" slug `ao-thun`, When thêm danh mục "Áo Thun", Then thấy lỗi "Tên danh mục này đã có" dưới ô tên; When thêm danh mục "Ao thun" mà không sửa ô slug, Then danh mục mới có slug `ao-thun-2`; When tự gõ slug `ao-thun` cho một danh mục khác rồi lưu, Then thấy lỗi "Slug này đã được dùng" dưới ô slug, và danh mục không được lưu.
- **AC5:** Given danh mục "Áo" slug `ao`, Hiện và có sản phẩm Đang bán, When đổi tên thành "Áo nam" rồi lưu, Then slug vẫn là `ao`, và trong vòng 60 giây H1 của trang `/vi/categories/ao` có "Áo nam"; When sửa ô slug thành `ao-nam`, Then form cảnh báo ngay rằng đường dẫn cũ sẽ không mở được nữa; When lưu, Then trong vòng 60 giây `/vi/categories/ao-nam` mở được, và `/vi/categories/ao` trả 404.
- **AC6:** Given danh mục "Áo" Hiện có sản phẩm Đang bán "Áo thun cổ tròn", When đổi trạng thái sang Ẩn rồi lưu, Then `admin` vẫn hiện danh mục với nhãn Ẩn; và trong vòng 60 giây trang `/vi/categories/ao` trả 404, "Áo" không còn trong các liên kết danh mục ở trang Sản phẩm và trong sitemap, "Áo thun cổ tròn" vẫn có trong danh sách sản phẩm chung, và breadcrumb của nó là "Trang chủ › Áo thun cổ tròn"; When đổi lại Hiện, Then trong vòng 60 giây danh mục hiện lại ở cùng đường dẫn.
- **AC7:** Given danh mục "Phụ kiện" không còn sản phẩm nào, When bấm Xóa, Then hộp thoại xác nhận nêu tên danh mục, nói việc xóa không hoàn tác được, và gợi ý chọn Ẩn nếu chỉ muốn tạm ẩn; When bấm Hủy, Then danh mục còn nguyên; When bấm Xóa lần nữa rồi bấm Xóa trong hộp thoại, Then thấy "Đã xóa danh mục", danh mục không còn trong `admin`, trong vòng 60 giây trang của nó ở trang khách trả 404, và slug của nó dùng lại được cho danh mục mới.
- **AC8:** Given danh mục "Áo" có 2 sản phẩm, "Áo thun cổ tròn" Đang bán và "Áo len" Ẩn, When bấm Xóa, Then hộp thoại xác nhận nêu tên danh mục, nói việc xóa không hoàn tác được, và báo "2 sản phẩm của danh mục này sẽ thành Không có danh mục."; When bấm Xóa trong hộp thoại, Then thấy "Đã xóa danh mục", danh mục không còn trong `admin`, và hai sản phẩm vẫn còn trong `admin` với danh mục "Không có danh mục", cùng tên, slug, giá, trạng thái và tình trạng như trước; và trong vòng 60 giây `/vi/categories/ao` trả 404, "Áo thun cổ tròn" vẫn có trong danh sách sản phẩm chung, và breadcrumb của nó là "Trang chủ › Áo thun cổ tròn".

#### US2 · Quản trị viên chọn danh mục cho sản phẩm

Là quản trị viên, tôi muốn chọn danh mục cho một sản phẩm ngay trong form sản phẩm, để sắp sản phẩm theo loại.

- **AC9:** Given có danh mục "Áo" Hiện và "Phụ kiện" Ẩn, When mở form Thêm sản phẩm, Then ô Danh mục đang chọn "Không có danh mục", và có "Áo" và "Phụ kiện (Ẩn)" theo tên A→Z; When thêm sản phẩm Đang bán "Áo thun cổ tròn" với danh mục "Áo", Then số sản phẩm của "Áo" ở trang Danh mục tăng 1, và trong vòng 60 giây sản phẩm hiện trên trang `/vi/categories/ao`; When sửa sản phẩm đó, chọn "Không có danh mục" rồi lưu, Then form sửa vẫn hiện "Không có danh mục" khi mở lại, và trong vòng 60 giây sản phẩm không còn trên trang `/vi/categories/ao`.
- **AC10:** Given form sửa một sản phẩm đang mở với danh mục "Phụ kiện" vừa chọn, When "Phụ kiện" bị xóa ở tab khác rồi bấm Lưu, Then sản phẩm không được lưu, thấy lỗi "Danh mục này không còn. Hãy chọn danh mục khác." dưới ô Danh mục, và những gì đã nhập còn nguyên; When gửi thẳng tới API thêm hay sửa sản phẩm một danh mục không tồn tại, Then API trả 400 dạng Problem Details nêu trường danh mục, và không lưu gì.
- **AC11 (bỏ):** lọc danh sách sản phẩm của `admin` theo danh mục. Bạn bỏ tiêu chí này ngày 2026-11-21: xóa được danh mục còn sản phẩm (AC8), nên quản trị viên không còn phải tìm các sản phẩm của một danh mục trước khi xóa nó.

#### US3 · Khách xem trang danh mục

Là khách, tôi muốn mở trang của một danh mục để chỉ thấy sản phẩm loại đó.

- **AC12:** Given danh mục "Áo" Hiện có "Áo thun cổ tròn" và "Áo len" Đang bán, "Áo lụa" Ẩn, và "Quần jean nam" Đang bán thuộc danh mục "Quần", When khách mở `/vi/categories/ao` hay `/en/categories/ao`, Then H1 của trang có tên danh mục "Áo" ở cả hai ngôn ngữ, và trang chỉ có "Áo thun cổ tròn" và "Áo len", sản phẩm mới nhất trước, mỗi thẻ như thẻ của danh sách sản phẩm; When bấm một thẻ, Then mở trang chi tiết của sản phẩm đó.
- **AC13:** Given danh mục có các sản phẩm Đang bán giá khác nhau và hai sản phẩm bằng giá, When chọn Giá thấp đến cao, Then giá bán tăng dần, và trong hai sản phẩm bằng giá thì sản phẩm mới hơn đứng trước; When chọn Giá cao đến thấp, Then giá bán giảm dần; When chọn Mới nhất, Then sản phẩm tạo sau đứng trước; và trang không có ô tìm hay lựa chọn Liên quan nhất.
- **AC14:** Given danh mục có 30 sản phẩm Đang bán, When mở trang danh mục, Then thấy 24 sản phẩm, dòng "Đã xem 24 trên 30 sản phẩm" và nút "Xem thêm"; When bấm Xem thêm, Then 6 sản phẩm còn lại hiện nối bên dưới và nút Xem thêm không còn; When chọn Giá thấp đến cao, bấm Xem thêm rồi tải lại trang hay mở cùng đường dẫn ở tab khác, Then thấy cùng kiểu sắp xếp và cùng các sản phẩm đã xem; When sửa tay đường dẫn thành giá trị không hợp lệ, Then trang dùng giá trị mặc định thay vì báo lỗi.
- **AC15:** Given danh mục "Phụ kiện" Hiện chưa có sản phẩm Đang bán nào, When khách mở `/vi/categories/phu-kien`, Then thấy H1 có "Phụ kiện", dòng "Chưa có sản phẩm nào trong danh mục này." và liên kết tới danh sách sản phẩm, với mã HTTP 200.
- **AC16:** Given slug chưa từng có, hay slug của một danh mục Ẩn, hay của một danh mục đã xóa, When khách mở `/vi/categories/<slug>` hay `/en/categories/<slug>`, Then nhận trang "Không tìm thấy danh mục" với mã HTTP 404 và liên kết về danh sách sản phẩm; và ba trường hợp cho cùng một trang, để không ai đoán ra một danh mục Ẩn có tồn tại.
- **AC17:** Given "Bao tay" và "Áo khoác" Hiện, mỗi danh mục có sản phẩm Đang bán, "Phụ kiện" Ẩn có sản phẩm Đang bán, và "Đầm" Hiện mà chỉ có sản phẩm Ẩn, When khách mở `/vi/products` hay `/en/products`, Then thấy liên kết "Áo khoác" rồi "Bao tay", và không có "Phụ kiện" hay "Đầm"; When bấm "Áo khoác", Then mở trang `/vi/categories/<slug của Áo khoác>` (trang tiếng Anh: `/en/categories/…`).
- **AC18:** Given danh mục "Áo" Hiện có sản phẩm Đang bán, When tải `/vi/categories/ao` hay `/en/categories/ao`, kể cả với `?sort=price-asc&page=2` hay với slug viết hoa như `/vi/categories/AO`, Then `<title>` và meta description theo mẫu ở mục SEO, có tên danh mục; canonical là địa chỉ của chính trang ở ngôn ngữ đang xem, với slug đã lưu và không có tham số; có hreflang `vi`, `en` và `x-default`; trang có breadcrumb "Trang chủ › Áo", trong đó "Trang chủ" là liên kết về trang chủ; và trang có một khối JSON-LD `BreadcrumbList` với hai mục đó, mỗi mục có URL tuyệt đối ở ngôn ngữ đang xem.
- **AC19:** Given "Áo" Hiện có sản phẩm Đang bán, "Phụ kiện" Ẩn, "Đầm" Hiện chỉ có sản phẩm Ẩn, và một danh mục đã xóa, When tải `/sitemap.xml`, Then có đường dẫn của "Áo", kèm hreflang `vi`, `en` và `lastmod` là lần sửa cuối của "Áo" hay của một sản phẩm Đang bán của nó, lấy lần muộn hơn; và không có ba danh mục kia.

#### US4 · Khách thấy danh mục trên trang chi tiết sản phẩm

Là khách, tôi muốn thấy danh mục của sản phẩm trên trang chi tiết, và quay về trang danh mục đó.

- **AC20:** Given "Áo thun cổ tròn" Đang bán thuộc danh mục "Áo" Hiện, When khách mở `/vi/products/ao-thun-co-tron` hay `/en/products/ao-thun-co-tron`, Then trang có breadcrumb "Trang chủ › Áo › Áo thun cổ tròn" (trang tiếng Anh: "Home" thay "Trang chủ"), trong đó "Trang chủ" là liên kết về trang chủ, "Áo" là liên kết tới `/vi/categories/ao` ở cùng ngôn ngữ, và tên sản phẩm không phải liên kết; và trang có một khối JSON-LD `BreadcrumbList` với ba mục đó, mỗi mục có URL tuyệt đối ở ngôn ngữ đang xem.
- **AC21:** Given "Quần jean nam" Đang bán không có danh mục, và "Khăn lụa" Đang bán thuộc danh mục "Phụ kiện" Ẩn, When khách mở trang chi tiết của từng sản phẩm, Then breadcrumb là "Trang chủ › ‹tên sản phẩm›", JSON-LD `BreadcrumbList` có đúng hai mục đó, và không chỗ nào của trang nhắc tới "Phụ kiện".

### Technical Work

Việc kỹ thuật đi cùng Epic. Plan đưa chúng vào Task nền và hai Story, và chúng không có AC riêng.

- **TW1 · Schema của danh mục:** migration Flyway V7, sau V6, không sửa V1–V6. Bảng `app.categories` có tên, slug `citext` UNIQUE như slug của sản phẩm, trạng thái, `version` và các cột của `BaseEntity`. `app.products` thêm cột `category_id` cho phép trống, có khóa ngoại tới `app.categories`, để không sản phẩm nào trỏ tới một danh mục đã xóa. Xóa một danh mục làm các sản phẩm của nó thành không có danh mục trong cùng transaction với lệnh xóa (AC8), kể cả khi một quản trị viên khác đang gán sản phẩm vào danh mục đó (AC10). `sa` chọn cách làm, như `ON DELETE SET NULL`, và ghi trong plan `updated_at` và `version` của các sản phẩm đó có đổi không. Đây chỉ là bước expand: `v0.3.0` đang chạy trên Production phải chạy được trên schema mới, trong lúc deploy và sau một lần rollback, kể cả sửa và xóa sản phẩm. Các sản phẩm có sẵn đều có `category_id` trống.
- **TW2 · Hợp đồng API của danh mục**, dùng chung cho `api`, `admin` và `user`, theo cách chia của ADR-0003: phần quản trị dưới `/api/admin/…`, và phần của khách chỉ có GET và HEAD, chỉ trả danh mục Hiện. Phần quản trị: danh sách danh mục có số sản phẩm; chi tiết, thêm, sửa theo `version` như sản phẩm, và xóa, kể cả danh mục còn sản phẩm (AC8); thêm và sửa sản phẩm nhận danh mục, và chi tiết sản phẩm của quản trị trả danh mục của nó. Phần của khách: các danh mục cho liên kết của AC17; một danh mục theo slug, kèm HEAD cho Proxy của `user` trả 404 thật trước khi render (AC16, như trang chi tiết sản phẩm của SHOP-24); sản phẩm Đang bán của một danh mục, có sắp xếp và phân trang; danh mục Hiện của một sản phẩm trong chi tiết sản phẩm, cho breadcrumb (AC20, AC21); các danh mục của sitemap (AC19). Lỗi theo Problem Details như `api` đang làm. `sa` ghi hợp đồng trong plan.
- **TW3 · Dữ liệu của E2E:** helper của `apps/admin/e2e/support/` và `apps/user/e2e/support/` tạo và xóa danh mục qua `/api` của host `admin`, như helper sản phẩm của SHOP-7. Tên danh mục của E2E kết thúc bằng `E2E <runId>` như tên sản phẩm, và vừa 60 ký tự. Trước mỗi lần chạy, E2E xóa các danh mục có tên E2E tạo cách đây hơn 1 giờ, sau khi đã xóa các sản phẩm E2E cũ (NFR23 của SHOP-7). E2E không ghi gì trên Production.

### Non-functional requirements

`sa` ghi mục này ngày 2026-11-21. Mỗi yêu cầu có mã NFR<n> để plan và item trỏ tới, và nói cách kiểm. Các mã ở đây là của SHOP-81. Những yêu cầu của SHOP-7 mà SPEC này nhắc, như "NFR7 của SHOP-7", vẫn giữ nguyên. Không quyết định nào ở đây cần quyền mà agent không có.

**Quy mô**

- **NFR1 · Quy mô thiết kế:** tới 200 danh mục và 10.000 sản phẩm (NFR1 của SHOP-7); 1–2 quản trị viên cùng lúc, mỗi người tới 2 tab; trang của khách tới 10 yêu cầu/giây. Ở quy mô này, mỗi danh sách sau trả hết trong một lệnh, không phân trang, như `design.md` đã chọn: danh sách danh mục của `admin` (S1.4), ô Danh mục của form sản phẩm (S4.2), các liên kết danh mục (S7.4) và các danh mục của sitemap. Nếu quá 200 danh mục, một Epic sau thêm phân trang. Tài nguyên giữ như `deploy.yaml`: `api` 768 MB, database 256 MB.

**Hiệu năng**

- **NFR2 · `api`:** đo ở `api`, với 200 danh mục và 10.000 sản phẩm, trong đó một danh mục có 5.000 sản phẩm:
  - danh sách danh mục của quản trị kèm số sản phẩm, các danh mục cho liên kết của khách, các danh mục của sitemap, một danh mục theo slug (GET và HEAD), và chi tiết sản phẩm kèm danh mục, ở cả quản trị lẫn khách: mỗi lệnh xong trong 200 ms;
  - sản phẩm Đang bán của một danh mục, với mỗi kiểu sắp xếp và ở trang bất kỳ: xong trong 200 ms;
  - thêm và sửa danh mục, thêm và sửa sản phẩm có danh mục: mỗi lệnh xong trong 300 ms;
  - xóa danh mục có 5.000 sản phẩm: xong trong 1 s, gồm cả lần đặt danh mục của các sản phẩm đó về trống (NFR15).

  Số câu SQL của mỗi lệnh không tăng theo số danh mục hay số sản phẩm, tức không có N+1. Danh sách danh mục đếm sản phẩm trong cùng câu SQL với danh sách, và chi tiết sản phẩm đọc danh mục trong cùng câu với sản phẩm. Kiểm: integration test (Testcontainers) nạp dữ liệu trên, chạy mỗi lệnh 5 lần và lấy trung vị như NFR2 của SHOP-7, và đếm câu SQL của từng lệnh.
- **NFR3 · Giới hạn của mỗi lệnh:** lệnh lấy sản phẩm của một danh mục nhận cùng tham số và giới hạn như danh sách sản phẩm của khách (NFR3 của SHOP-7): tối đa 100 sản phẩm mỗi lệnh (`user` dùng 24); kiểu sắp xếp chỉ là Mới nhất, Giá thấp đến cao hay Giá cao đến thấp; `offset` từ 0; giá trị sai trả 400 nêu tham số đó. Lệnh này không có từ khóa và không có Liên quan nhất (AC13). Trang danh mục của `user` đọc `page × 24` sản phẩm theo khối, như trang danh sách (Architecture Decisions 10 của plan SHOP-7), và dừng ở tổng số sản phẩm Đang bán của danh mục, nên `?page=999999` chỉ đọc tới hết danh mục. Kiểm: WebMvc test cho 400 của từng tham số sai; unit test của DAL với `page=999999`.
- **NFR4 · Trang của khách:** S5, S7 và S8 giữ ngưỡng NFR4 của SHOP-7. Đo trên Staging bằng performance trace của chrome-devtools, giả lập điện thoại (Slow 4G, CPU chậm 4 lần):
  - LCP ≤ 2,5 s và CLS ≤ 0,1;
  - trên S5, đổi sắp xếp và bấm Xem thêm có INP ≤ 200 ms;
  - TTFB ≤ 600 ms khi dữ liệu đã có trong cache của `user`.

  Hàng liên kết danh mục (S7.3) không được đẩy lưới sản phẩm xuống sau khi lưới đã hiện: nó hiện cùng lúc với lưới, hay trước lưới. Epic không thêm thư viện JavaScript nào chạy ở trình duyệt: ô sắp xếp và nút Xem thêm của S5 dùng lại component của danh sách sản phẩm. Kiểm: `qa` ghi số đo vào báo cáo QA của Story `user`.
- **NFR5 · `admin`:** trên Staging, trang Danh mục (S1) và ô Danh mục của form sản phẩm (S4.2) có dữ liệu trong 1 s sau khi mở. Sau khi bấm Lưu hay Xóa, thông báo kết quả hiện trong 1 s, như NFR6 của SHOP-7. Kiểm: `qa` ghi số đo vào báo cáo QA của Story `admin`.

**Độ trễ của dữ liệu**

- **NFR6 · Mốc 60 giây** (Category Rules, Độ trễ): như NFR7 của SHOP-7, không có lệnh báo `user` làm mới. Mọi lệnh đọc danh mục ở phía server của `user` dùng profile `catalog` của `cacheLife` đang có: trang danh mục, sản phẩm của danh mục, các liên kết danh mục, danh mục trong chi tiết sản phẩm và sitemap. Server phục vụ dữ liệu cũ tối đa 25 s, và cache router của trình duyệt giữ tối đa 30 s, nên cộng lại tối đa 55 s. Các lệnh đọc này nằm trong `<Suspense>`, và `pnpm run build` không gọi `api`. Bước HEAD của Proxy không cache (`no-store`), như với trang chi tiết sản phẩm. Trang chi tiết sản phẩm lấy danh mục từ chính phản hồi chi tiết sản phẩm, không qua một lệnh và một mục cache riêng, nên breadcrumb không lệch với phần còn lại của trang. Kiểm: E2E của AC5 tới AC9 chờ bằng `expect.poll` tới 60 s, như Testing Strategy.

**Bảo mật**

- **NFR7 · Ai gọi được lệnh ghi:** như NFR8 của SHOP-7 và ADR-0003, lệnh ghi danh mục chỉ nằm dưới `/api/admin/…`, sau basic auth của host `admin`, và `api` không có host công khai. Phần của khách chỉ có GET và HEAD. `user` chỉ gọi các lệnh đọc của khách, không gọi `/api/admin/**`, và không có route hay Server Action nào ghi danh mục. Chỉ helper E2E gọi API quản trị, qua host `admin` (TW3). Kiểm: `security` review PR của Task nền và hai Story; unit test cho thấy DAL danh mục của `user` chỉ gửi GET, và Proxy chỉ gửi HEAD.
- **NFR8 · Danh mục Ẩn không lộ ra:** lệnh đọc của khách chỉ trả danh mục Hiện, và không nhận tham số nào mở ra danh mục Ẩn.
  - Slug chưa từng có, slug của danh mục Ẩn và slug của danh mục đã xóa cho cùng một phản hồi 404, chỉ khác `instance`, `timestamp` và `correlationId`, như NFR9 của SHOP-7. Điều này đúng ở GET và HEAD của danh mục, ở lệnh lấy sản phẩm của danh mục, và ở trang của khách (AC16).
  - Phản hồi của khách về một danh mục chỉ có tên và slug, và ở sitemap thêm lần sửa cuối. Nó không có trạng thái, số sản phẩm (Category Rules: chỉ `admin` thấy số này) hay `version`. Tổng số trên trang danh mục ("Đã xem 24 trên 30 sản phẩm") chỉ đếm sản phẩm Đang bán.
  - Chi tiết sản phẩm của khách chỉ có danh mục khi danh mục đó Hiện. Khi danh mục Ẩn, trường danh mục là `null`, giống hệt sản phẩm không có danh mục (AC21).

  Kiểm: WebMvc test so phản hồi 404 của ba trường hợp, và so chi tiết của một sản phẩm thuộc danh mục Ẩn với một sản phẩm không có danh mục; E2E của AC6, AC16, AC17, AC19 và AC21.
- **NFR9 · Dữ liệu vào:**
  - `api` kiểm mọi trường theo Category Rules bằng Bean Validation, và nêu mọi trường sai trong cùng một 400 (AC3). Độ dài và khoảng trắng tính như ở sản phẩm (`FormText`, đơn vị UTF-16).
  - `categoryId` của lệnh thêm và sửa sản phẩm là UUID của một danh mục đang có, kể cả danh mục Ẩn, hay `null`. Mọi giá trị khác là 400 trên trường `categoryId` (AC10).
  - Slug lấy từ đường dẫn của khách chỉ đi tới `api` sau khi qua bước kiểm định dạng như `isStoreSlug` của sản phẩm, ở cả Proxy lẫn DAL của `user`. Nhờ vậy một slug như `..%2Fadmin%2Fcategories` không thành lệnh tới một đường dẫn khác của `api`.
  - Mọi câu SQL dùng tham số bind.

  Kiểm: unit test của validation; unit test của DAL và của Proxy với slug `..`, `%2F` và `%E0`.
- **NFR10 · Dữ liệu ra:** tên danh mục luôn hiện như chữ, ở cả `admin` lẫn `user`: trong bảng, hộp thoại, toast, `<option>`, `aria-label`, breadcrumb, H1, `<title>` và meta description (qua Metadata API của Next). JSON-LD chỉ dựng qua `JsonLd` đang có, vốn đổi `<` thành `<`. Kiểm: một test của `user` và một test của `admin` dùng tên danh mục `</script><script>alert(1)</script>` (34 ký tự, vừa 60), và thấy không script nào chạy, và khối JSON-LD và thẻ meta không mở thẻ mới.
- **NFR11 · Lỗi, trùng và log:** Problem Details không lộ stack trace, câu SQL hay tên ràng buộc, như `api` đang làm. Tên trùng, slug trùng và một danh mục vừa bị xóa đều dựa vào ràng buộc của database, không chỉ vào bước kiểm trước, vì hai lệnh chạy cùng lúc đều qua được bước kiểm trước:
  - vi phạm UNIQUE của tên hay của slug là 409, mỗi trường một mã riêng, để form hiện lỗi dưới đúng ô (AC4). Slug tự sinh mà thua một lần thêm cùng lúc thì thử số kế tiếp, như sản phẩm;
  - vi phạm khóa ngoại của danh mục khi thêm hay sửa sản phẩm là 400 trên trường `categoryId`, cùng thân với bước kiểm trước (AC10), không phải 500.

  `api` ghi log INFO cho mỗi lần thêm, sửa và xóa danh mục, gồm thao tác, `id`, slug và correlation id. Khi xóa, log có thêm số sản phẩm của danh mục lúc xóa. Log không ghi thân yêu cầu hay header `Authorization`. Kiểm: unit test của exception handler; integration test cho hai lần thêm cùng tên cùng lúc, và cho một lần gán chạy cùng lúc với lần xóa (Testing Strategy); `security` review.
- **NFR12 · Ghi chồng và thử lại:**
  - Lệnh sửa danh mục gửi `version` của `BaseEntity`, và `api` trả 409 khi `version` khác bản trong database (S2.4).
  - Xóa danh mục là idempotent: trả 204 cả khi danh mục đã không còn. Vì vậy một lần xóa ở tab khác (S3.7) và một lần gửi lại sau khi mất phản hồi cho cùng kết quả.
  - Thêm danh mục không cần idempotency key. Tên không được trùng (Category Rules), nên một lần thêm gửi lại sau khi lần trước đã thành công nhận 409 tên trùng, không tạo ra bản thứ hai.
  - `admin` không tự thử lại lệnh ghi (NFR19 của SHOP-7: `retry.ts` chỉ thử lại GET, HEAD và OPTIONS).

  Kiểm: WebMvc test của 409 và của hai lần DELETE liền nhau; unit test của hook ghi với MSW.
- **NFR13 · Dependency và CSP:** Epic không thêm dependency nào ở ba app, không nới CSP nào, và không thêm extension PostgreSQL nào. Collation ICU ở Tech Stack là một đối tượng của schema `app`, không phải extension. Kiểm: `security` review, và `apps/api/pom.xml`, `package.json` của các app, `pnpm-lock.yaml` cùng `next.config.ts` không đổi.

**Dữ liệu**

- **NFR14 · Ràng buộc trong database** (TW1): database là chốt sau `api`. `app.categories` có:
  - tên `NOT NULL`, CHECK dài 1–60 ký tự, và UNIQUE không phân biệt chữ hoa, chữ thường nhưng phân biệt dấu, bằng collation ở Tech Stack: "Áo" trùng "áo", còn "Áo" và "Ao" là hai tên khác nhau (AC4);
  - slug `citext` UNIQUE như slug của sản phẩm, có CHECK định dạng và tối đa 100 ký tự. Sản phẩm không có CHECK này vì có dữ liệu cũ sai định dạng (NFR15 của SHOP-7); danh mục thì không có dữ liệu cũ nào;
  - trạng thái `NOT NULL`, mặc định Hiện, có CHECK chỉ nhận hai giá trị;
  - `version` và các cột của `BaseEntity`, cùng trigger `updated_at` như ở `app.products`.

  `app.products.category_id` là `UUID` cho phép trống, có khóa ngoại tới `app.categories (id)` với `ON DELETE SET NULL` (NFR15). Cột này có index, vì lệnh xóa danh mục và trang danh mục tìm sản phẩm theo nó. Kiểm: integration test ghi thẳng bằng SQL từng giá trị sai, và thấy database từ chối.
- **NFR15 · Xóa danh mục còn sản phẩm** (AC8, AC10, TW1): `sa` chọn `ON DELETE SET NULL` của khóa ngoại. Chính lệnh `DELETE` của danh mục làm các sản phẩm của nó thành không có danh mục, trong cùng câu lệnh và cùng transaction. Một lần gán sản phẩm chạy cùng lúc có hai khả năng: chờ lần xóa xong rồi nhận 400 của NFR11, hoặc xong trước rồi bị lần xóa đặt lại về trống. Không lúc nào có sản phẩm trỏ tới danh mục đã xóa. Với các sản phẩm đó:
  - `category_id` thành trống. Tên, slug, mô tả, giá, giá gốc, trạng thái, tình trạng, `created_at`, `created_by` và `updated_by` giữ nguyên;
  - `updated_at` đổi thành lúc xóa, vì trigger `trg_products_set_updated_at` của V3 chạy cho mọi UPDATE, kể cả UPDATE do khóa ngoại sinh ra. Điều này đúng ý: trang chi tiết của các sản phẩm đó đổi breadcrumb và JSON-LD (AC21), nên `lastmod` của chúng trong sitemap cũng đổi;
  - `version` giữ nguyên. Nhờ vậy một form sửa sản phẩm đang mở không nhận 409 sửa chồng. Nếu form còn chọn danh mục đã xóa, nó nhận lỗi của AC10; nếu đã chọn danh mục khác hay "Không có danh mục", nó lưu được bình thường;
  - trigger giá cũ `trg_products_sync_legacy_price` có chạy nhưng không làm gì, vì không cột giá nào đổi.

  Kiểm: integration test xóa một danh mục có sản phẩm Đang bán lẫn Ẩn, rồi so từng cột của các sản phẩm đó trước và sau (Testing Strategy, AC8).
- **NFR16 · Migration V7** (TW1): chỉ bước expand. V7 chạy trong một transaction, không sửa V1–V6 và không đụng cột giá cũ. Với 10.000 sản phẩm, V7 xong trong 10 s, và chỉ khóa `app.products` trong lúc thêm cột, khóa ngoại và index. Cột mới không có DEFAULT nên không viết lại bảng, và mọi dòng có sẵn có `category_id` trống. Trong lúc chuyển bản, và sau một lần rollback, `v0.3.0` chạy đúng trên schema V7:
  - nó khởi động được: Flyway của nó bỏ qua V7 vì là migration "future" (mặc định `*:future`; `application*.yml` không đặt `ignore-migration-patterns`), và `ddl-auto: validate` không xét bảng hay cột mà entity không map;
  - nó đọc, thêm, sửa và xóa sản phẩm như trước. Khi nó thêm, `category_id` trống. Khi nó sửa, entity của nó không map `category_id`, nên danh mục của sản phẩm còn nguyên. Khi nó xóa, khóa ngoại không cản, vì `app.products` là phía trỏ đi;
  - nó không biết tới danh mục, nên `user` của nó không có trang danh mục. Danh mục còn nguyên trong database để bản sau dùng lại.

  Danh mục không cần bước contract: V7 không thay hay bỏ cột nào, nên không bản sau nào phải gỡ gì của V7. Kiểm: integration test của migration ở Testing Strategy, cộng một test chạy các lệnh đọc, thêm, sửa và xóa sản phẩm của `v0.3.0` trên schema V7. Plan chọn cách chạy các lệnh đó, như bộ test sản phẩm của tag `v0.3.0`, hay một entity chỉ map các cột của `v0.3.0`.
- **NFR17 · Thứ tự ổn định:** danh mục xếp theo tên với collation ở Tech Stack, rồi theo `id`. Sản phẩm của một danh mục xếp như danh sách của khách, với `id` (UUIDv7) làm khóa cuối, và Xem thêm bỏ những sản phẩm đã hiện, theo `id` (NFR18 của SHOP-7). Kiểm: integration test với các tên "An toàn", "Áo khoác", "Ăn vặt", "Bao tay", "Dép", "Đầm" và "quần" (chữ thường), mong đúng thứ tự đó; và với sản phẩm cùng giá, cùng `created_at`.
- **NFR18 · Số sản phẩm của danh mục:** đếm lúc đọc, trong câu SQL của danh sách, không lưu thành cột hay bộ đếm. Nhờ vậy số luôn đúng, kể cả khi `v0.3.0` thêm hay xóa sản phẩm sau một lần rollback. Kiểm: integration test của AC1.
- **NFR19 · Hai bản của các app chạy lẫn nhau:** trong lúc deployer chuyển bản, và sau một lần rollback, một app có thể gặp bản trước của app kia. Một tab `admin` đã mở từ trước khi deploy cũng vẫn chạy code cũ.
  - Khi `user` hay `admin` của `v0.3.0` gặp `api` mới: trường danh mục mới của chi tiết sản phẩm chỉ là phần thêm, và schema Zod cũ, vốn không strict, bỏ qua nó. Một tab `admin` của `v0.3.0` gửi lệnh sửa sản phẩm không có `categoryId`. Khi đó `api` không được lặng lẽ bỏ danh mục của sản phẩm: nó giữ danh mục đang có, hay từ chối bằng 400. Plan chọn một trong hai cách và ghi ở API Contract. Lựa chọn "Không có danh mục" của form mới luôn gửi `categoryId: null` một cách tường minh.
  - Khi `user` mới gặp `api` của `v0.3.0`: chi tiết sản phẩm thiếu trường danh mục thì được coi như không có danh mục (breadcrumb hai mục), không phải lỗi. Các lệnh danh mục trả 404, nên trang danh mục là S6, và hàng liên kết danh mục ẩn đi như NFR20.

  Kiểm: unit test của schema Zod với payload không có trường danh mục; WebMvc test của lệnh sửa sản phẩm không có `categoryId`.

**Khả dụng**

- **NFR20 · Khi `api` lỗi:** như NFR26 của SHOP-7, mỗi lệnh `user` gửi tới `api` có thời hạn 5 s, và lỗi hay hết giờ không bao giờ thành 404 hay một trang trống:
  - trang danh mục: Proxy trả 503, `Retry-After: 30`, `Cache-Control: no-store`, với một trang lỗi ngắn, như trang chi tiết sản phẩm. DAL ném lỗi thay vì trả `null`, nên trang là lỗi 5xx (S5.5), không phải S6 hay "Chưa có sản phẩm nào trong danh mục này.";
  - sitemap: trả 5xx thay vì một sitemap thiếu danh mục;
  - hàng liên kết danh mục của S7: `sa` chọn ẩn hàng và ghi log lỗi, còn danh sách sản phẩm vẫn hiện như cũ. Hàng này chỉ là lối tắt tới các trang danh mục, nên lỗi của nó không làm hỏng cả trang Sản phẩm. Lỗi không vào cache, nên hàng hiện lại ở lần đọc kế tiếp khi `api` chạy lại;
  - `admin`: hiện trạng thái lỗi của S1.4, S2.3 và S4.2.

  Kiểm: unit test của DAL với `api` chậm và với `api` trả 500; render test của S7 khi lệnh danh mục lỗi.
- **NFR21 · Deploy:** smoke test giữ như `deploy.yaml`. Epic không đổi `deploy.yaml`, secret hay biến môi trường nào, nên không cần mục Ask first nào. Deployer không tự dump database trước khi chạy migration, nên ở gate ⑤ bạn xác nhận bản backup mới nhất của Production cách đó không quá 24 giờ, như NFR27 của SHOP-7.

**Lưu giữ**

- **NFR22 · Danh mục đã xóa:** xóa là xóa hẳn dòng, không có thùng rác hay xóa mềm (AC7, AC8). Liên kết của các sản phẩm với danh mục đó mất cùng lúc. Nó chỉ lấy lại được từ các bản backup hằng ngày của kit (khoảng 4 tuần, như NFR20 của SHOP-7), bằng tay, bởi người có quyền trên VPS. Danh mục không chứa dữ liệu cá nhân, và `created_by`, `updated_by` vẫn là `system` tới Epic đăng nhập.
- **NFR23 · Công cụ tìm kiếm:** danh mục Ẩn, đã xóa hay vừa đổi slug rời các trang của khách và sitemap trong 60 s (NFR6). Đường dẫn cũ trả 404 và không chuyển hướng (Scope: Out), nên công cụ tìm kiếm bỏ nó ở lần thu thập sau. Việc đó nằm ngoài tầm của Epic.

## Tech Stack

Không thêm framework, dependency hay extension PostgreSQL nào (NFR13): stack như README gốc và README của từng app. Các phiên bản dưới đây đọc từ `apps/api/pom.xml`, `package.json` của từng app và `.ai-orchestrator/deploy.yaml` ngày 2026-11-21, và Epic không đổi bản nào. Những điểm Epic này đụng tới:

- **`api`:** Java 21; Spring Boot 4.0.9, theo `pom.xml` (SPEC của SHOP-7 ghi 4.0.6); springdoc-openapi 3.0.3 cho `/v3/api-docs`; Testcontainers 2.0.5. PostgreSQL 17: `postgres:17-alpine`, ghim theo digest ở `deploy.yaml`, và cùng tag đó ở Testcontainers. Thêm migration V7 sau V6.
- **Slug dùng chung** (quyết định của `sa`): phần chung của `ProductSlugs` chuyển sang `common/text/Slugs.java` của `api`, cạnh `FormText`. Phần chung đó gồm: bỏ dấu, `đ` thành `d`, gạch ngang, cắt ở 100 ký tự, kiểm định dạng và hậu tố `-2`, `-3`… `ProductSlugs` gọi `Slugs` mà vẫn giữ tên, hằng và hành vi của nó, nên test của nó chạy không cần sửa. Slug của danh mục gọi cùng `Slugs`. Mỗi bên chỉ giữ chữ dự phòng riêng, cho một tên không còn chữ hay số nào sau khi bỏ dấu: `san-pham` cho sản phẩm như cũ, `danh-muc` cho danh mục.
- **Thứ tự tên tiếng Việt và tên không trùng** (quyết định của `sa`): V7 tạo một collation ICU không tất định trong schema `app`, như `CREATE COLLATION app.vi_ci (provider = icu, locale = 'vi-u-ks-level2', deterministic = false)`, và cột tên của `app.categories` dùng collation đó. Một collation giữ cả hai quy tắc của Category Rules:
  - `ORDER BY name` xếp theo bảng chữ cái tiếng Việt: ă sau a, đ sau d, rồi tới dấu thanh, và không phân biệt chữ hoa, chữ thường. Ví dụ: "An toàn", "Áo khoác", "Ăn vặt", "Bao tay", "Dép", "Đầm", "quần" (NFR17). Hàm `app.search_fold` không xếp được như vậy, vì nó gộp ă với a và đ với d;
  - UNIQUE của tên so ở mức 2 của ICU: chữ hoa và chữ thường là một, còn dấu thì khác. Vì vậy "Áo" trùng "áo" mà không trùng "Ao" (AC4). Cách so này không phụ thuộc vào locale của database trên VPS, trong khi chính locale đó quyết định `lower()` và `citext` có đổi được chữ có dấu như "Á" hay không.

  ICU không phải một extension: PostgreSQL 16 trở đi dựng với ICU theo mặc định, và `CREATE COLLATION` chỉ cần quyền CREATE trên schema `app`, mà user của app có vì nó sở hữu schema đó (V1). V7 tự kiểm collation có xếp đúng tiếng Việt không, như "Az" phải đứng trước "Ăn", điều mà collation gốc của ICU làm ngược lại. Nếu không đúng, V7 dừng lần deploy với một thông báo rõ, như V6 làm, và Development gặp lỗi đó trước Staging và Production. Cột tên này không dùng được với `LIKE`, và Epic cũng không tìm theo tên danh mục. Nếu integration test đầu tiên trên `postgres:17-alpine` cho thấy image không có dữ liệu ICU của `vi`, plan đổi sang `ORDER BY app.search_fold(name), name, id` (khi đó đ xếp lẫn với d) và một UNIQUE trên tên do `api` gấp về chữ thường, rồi ghi rõ chỗ khác đó.
- **`admin`:** React 19.2.7, React Router 7.18.5, TanStack Query 5.101.0, nuqs 2.8.9, zod 4.6.7 và Vite 8.3.8, không đổi. Thêm route và chữ mới trong i18n của `admin`.
- **`user`:** Next 16.4.6, next-intl 4.13.0, React 19.2.7 và zod 4.6.7, không đổi. Thêm route `/[locale]/categories/[slug]`. Proxy của `user` (`src/proxy.ts`) thêm bước HEAD cho trang danh mục, như với trang chi tiết sản phẩm. JSON-LD dựng bằng `breadcrumbLd` và `JsonLd` đang có. Mọi lệnh đọc danh mục dùng profile `catalog` của `cacheLife` đang có (NFR6).

## Commands

Không đổi so với README gốc:

```
pnpm run lint
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run test:e2e
pnpm exec playwright test --project=user -g "AC12"   # E2E của một tiêu chí
```

Trên Development hay Staging, `/ao-qa` đặt `E2E_USER_URL`, `E2E_ADMIN_URL`, `E2E_HTTP_USER` và `E2E_HTTP_PASSWORD` trước `pnpm run test:e2e`.

## Project Structure

```
apps/api/src/main/java/com/tungph7/learnpostgres/feature/category/  → controller, service, repository, dto, domain của danh mục
apps/api/src/main/java/com/tungph7/learnpostgres/feature/product/   → danh mục trong sản phẩm, sản phẩm của một danh mục
apps/api/src/main/java/com/tungph7/learnpostgres/common/text/       → Slugs, phần chung của slug sản phẩm và danh mục
apps/api/src/main/resources/db/migration/                           → V7
apps/api/src/test/java/com/tungph7/learnpostgres/feature/category/  → unit, WebMvc, DataJpa và integration test (Testcontainers)
apps/admin/src/features/category/                                    → api, components, hooks, model của danh mục
apps/admin/src/features/product/                                     → ô Danh mục của form sản phẩm
apps/admin/src/app/routes/categories/                                → danh sách, thêm, sửa; mục Danh mục trên thanh điều hướng
apps/admin/src/lib/i18n/locales/{vi,en}/                             → chữ của danh mục
apps/admin/e2e/                                                      → E2E của US1–US2; support/ có helper danh mục
apps/user/src/features/category/                                     → model, server (DAL), components
apps/user/src/app/[locale]/categories/[slug]/                        → trang danh mục và not-found.tsx
apps/user/src/app/[locale]/products/                                 → liên kết danh mục; breadcrumb của trang chi tiết
apps/user/src/proxy.ts                                               → HEAD của trang danh mục
apps/user/src/app/sitemap.ts                                         → các danh mục Hiện có sản phẩm Đang bán
apps/user/messages/{vi,en}.json                                      → chữ của giao diện user và của mục SEO
apps/user/e2e/                                                       → E2E của US3–US4; support/ có helper danh mục
docs/specs/SHOP-81/                                                  → spec.md, design.md, design/, plan.md
docs/adr/                                                            → ADR, nếu sa ghi
```

## Code Style

Như CLAUDE.md và mục Code Style của SPEC của SHOP-7. Thêm:

- Tên danh mục luôn hiện như chữ, ở cả `admin` lẫn `user`, như tên sản phẩm.
- Breadcrumb hiện trên trang và JSON-LD `BreadcrumbList` dựng từ cùng một danh sách các mục, để hai bên không lệch nhau. Danh mục chỉ có trong danh sách khi API trả nó, tức khi nó Hiện:

```tsx
const crumbs = [
  { name: tSeo('home'), url: localizedUrl(locale, '/') },
  ...(product.category
    ? [{ name: product.category.name, url: localizedUrl(locale, `/categories/${product.category.slug}`) }]
    : []),
  { name: product.name, url: localizedUrl(locale, `/products/${product.slug}`) },
];

<JsonLd data={breadcrumbLd(crumbs)} />
```

- Tên E2E bắt đầu bằng mã AC và viết tiếng Anh, như `test('AC16 answers 404 for an unknown, hidden or deleted category', …)`.

## Testing Strategy

- **`api`:** unit test viết theo TDD cho quy tắc kiểm dữ liệu của danh mục và sinh slug. WebMvc test cho Problem Details: 400 kèm trường sai (AC3, AC10), 404, 409 cho tên trùng, slug trùng và sửa chồng (AC4); và cho thấy 404 của danh mục chưa từng có, Ẩn và đã xóa giống nhau (AC16). Integration test với Testcontainers PostgreSQL 17 cho: số sản phẩm, sản phẩm Đang bán của một danh mục, thứ tự tên tiếng Việt; xóa danh mục còn sản phẩm Đang bán lẫn Ẩn làm chúng thành không có danh mục và không đổi trường nào khác của chúng (AC8), và một lần gán sản phẩm chạy cùng lúc với lần xóa không để lại sản phẩm nào trỏ tới danh mục đã xóa (AC10); danh mục Ẩn không lộ ra ở API của khách, các danh mục của sitemap; và migration V7 chạy trên schema V6 có dữ liệu giống Production, rồi các lệnh đọc, sửa, xóa sản phẩm của `v0.3.0` vẫn chạy trên schema mới (TW1).
- **`admin`:** Vitest, Testing Library và MSW cho form danh mục (từng lỗi của AC3 và AC4), slug tự điền và cảnh báo đổi slug, hộp thoại xóa của danh mục không có sản phẩm và của danh mục còn sản phẩm (AC7, AC8), ô Danh mục của form sản phẩm và lỗi của AC10.
- **`user`:** Vitest cho đọc tham số URL của trang danh mục (AC14), meta, canonical và JSON-LD (AC18, AC20, AC21), sitemap (AC19); render test cho trang danh mục, trạng thái trống, trang 404 và breadcrumb.
- **E2E:** mỗi AC một test Playwright trở lên, tên bắt đầu bằng mã AC, chạy trên app thật và `api` thật, không mock API. Development dùng chung, nên mỗi test tạo danh mục và sản phẩm riêng qua `/api` của `admin` với tên có `E2E <runId>`, chỉ kiểm thứ tự và số lượng trong các danh mục của lần chạy đó (như AC1 và AC17), và xóa những gì nó tạo khi xong (TW3). Các AC có "trong vòng 60 giây" chờ bằng `expect.poll` tới 60 giây. Nửa sau của AC1 (chưa có danh mục nào) chỉ chạy được trên app dựng tại chỗ, nên mang tag `@local`.
- **Accessibility:** axe (WCAG 2.0/2.1 A và AA) quét trang danh mục, trang "Không tìm thấy danh mục" và trang chi tiết có breadcrumb của `user` ở hai ngôn ngữ, giao diện sáng lẫn tối, cùng danh sách danh mục, form danh mục và hộp thoại xóa của `admin`.

## Boundaries

- **Always:**
  - kiểm dữ liệu ở cả form của `admin` lẫn `api`, và coi `api` cùng database là chốt cuối;
  - lọc danh mục Hiện và sản phẩm Đang bán ở `api` và ở phía server của `user`, không chỉ ẩn trên giao diện;
  - hiện tên danh mục như chữ thường;
  - dọn dữ liệu mà E2E tạo trên môi trường;
  - giữ migration ở bước expand, để `v0.3.0` chạy được trên database đã nâng.
- **Ask first:** chỉ những việc cần quyền mà agent không có:
  - thêm extension PostgreSQL vào database đang chạy của Development, Staging hay Production;
  - đổi `deploy.yaml`, nằm trong đường dẫn được bảo vệ `.ai-orchestrator/**`, hay secret và biến môi trường của app trên VPS.
- **Never:**
  - xóa sản phẩm khi xóa danh mục, như `ON DELETE CASCADE`, hay đổi trường nào của sản phẩm ngoài danh mục của nó;
  - để danh mục Ẩn hay đã xóa hiện ở bất kỳ chỗ nào của trang khách: liên kết, breadcrumb, JSON-LD, sitemap, hay một phản hồi 404 khác với của slug chưa từng có;
  - bỏ hay đổi kiểu một cột có sẵn của `app.products`, hay sửa V1–V6;
  - mock API danh mục hay sản phẩm trong E2E chạy trên môi trường;
  - ghi basic auth của môi trường vào file, commit hay log.

## Success Criteria

Ngoài DoD của Epic trong `.ai-orchestrator/docs/sdlc.md`:

- Story của `admin` và Story của `user` đạt DoD: E2E của từng AC từ AC1 tới AC21, trừ AC11 đã bỏ, pass trên Development.
- Task nền đạt DoD: bộ regression pass, và mọi E2E của SHOP-7 vẫn pass.
- axe không báo vi phạm WCAG A/AA nào trên các trang ở mục Testing Strategy. Ở bề rộng 320 px, trang danh mục, các liên kết danh mục và breadcrumb của `user` không làm trang có thanh cuộn ngang.
- OpenAPI ở `/v3/api-docs` mô tả đúng hợp đồng của danh mục.
- Migration V7 chạy không lỗi trên bản sao dữ liệu của Production. Sau khi nâng, mọi sản phẩm còn nguyên và không có danh mục, và `v0.3.0` vẫn khởi động, đọc, sửa và xóa được sản phẩm trên database đã nâng, để rollback được.
- Bản release chứa Epic lên Production sau gate ⑤, và smoke test sau deploy pass.
- Mục SEO của `seo` và mục Non-functional requirements của `sa` đạt, mỗi yêu cầu theo cách kiểm của nó.

## Open Questions

Không có. Ngày 2026-11-21 bạn trả lời cả 11 câu, và mỗi câu trả lời đã thành quyết định ở mục của nó:

- Bạn đồng ý 9 đề xuất: danh mục Ẩn (Category Rules, AC6, AC16, AC17, AC19, AC21), slug (AC2, AC5), thứ tự tên tiếng Việt (AC1, AC17), breadcrumb của sản phẩm không có danh mục (AC21), danh mục Hiện chưa có sản phẩm Đang bán (AC15, AC17, AC19), trang danh mục không có ô tìm (AC13), không có mô tả danh mục (Scope, AC18), tên dài 1–60 ký tự và không trùng (AC3, AC4), và `lastmod` của danh mục (AC19).
- Bạn đổi đề xuất về xóa danh mục còn sản phẩm: xóa được, sau hộp thoại xác nhận nêu số sản phẩm, và các sản phẩm đó thành "Không có danh mục" (Category Rules, AC8, TW1).
- Vì vậy bạn bỏ bộ lọc Danh mục của danh sách sản phẩm trong `admin`: AC11 giữ số với "(bỏ)", và Scope ghi nó ở phần Out.

`seo` quyết thẻ robots của trang danh mục Hiện chưa có sản phẩm Đang bán ở mục SEO. `sa` đã quyết cách làm sản phẩm thành không có danh mục khi xóa danh mục (TW1) ở NFR15, và plan ghi chi tiết của cách đó.

`sa` không có câu hỏi cho bạn. Các quyết định của `sa` nằm ở mục Non-functional requirements và Tech Stack, và không quyết định nào cần quyền mà agent không có. Bạn duyệt chúng cùng SPEC ở gate ①:

- quy mô 200 danh mục, với các danh sách danh mục không phân trang (NFR1);
- `ON DELETE SET NULL` khi xóa danh mục: `updated_at` của các sản phẩm đó đổi, còn `version` của chúng giữ nguyên (NFR15);
- collation ICU tiếng Việt cho thứ tự tên và cho tên không trùng, có đường lui nếu image không có dữ liệu ICU (Tech Stack);
- `Slugs` dùng chung cho hai loại slug, với slug dự phòng `danh-muc` của danh mục (Tech Stack);
- lệnh sửa từ một tab `admin` cũ không làm mất danh mục của sản phẩm (NFR19);
- hàng liên kết danh mục ẩn đi khi `api` lỗi, còn danh sách sản phẩm vẫn hiện (NFR20).
