# Hướng dẫn sử dụng `shop`, bản v0.3.0

Bản `v0.3.0` (phát hành ngày 18/11/2026) có danh mục sản phẩm:
- **Quản trị viên** xem, tìm, thêm, sửa, ẩn, đánh dấu hết hàng và xóa sản phẩm.
- **Khách** xem danh sách, tìm không cần dấu, sắp xếp theo giá, chia sẻ đường dẫn và xem chi tiết từng sản phẩm.

| Bạn là | Mở trang | Đọc |
|---|---|---|
| Quản trị viên | https://shop-admin.ao.t2g.io.vn | [quan-tri-vien.md](quan-tri-vien.md) |
| Khách | https://shop.ao.t2g.io.vn | [khach.md](khach.md) |

## Mở trang lần đầu

Cửa hàng chưa mở cho mọi người. Vì vậy, khi bạn mở một trong hai trang:
1. Trình duyệt hiện một hộp hỏi **tên đăng nhập** và **mật khẩu**.
2. Nhập tên và mật khẩu mà người quản trị hệ thống đưa cho bạn, rồi bấm **Đăng nhập** (hay **Sign in**, tùy trình duyệt).
3. Trình duyệt nhớ chúng tới khi bạn đóng trình duyệt.

Nhập sai thì hộp đó hiện lại. Đừng gửi mật khẩu này qua email hay tin nhắn công khai.

## Ngôn ngữ và giao diện

Cả hai trang có tiếng Việt và tiếng Anh, và có ba kiểu giao diện:
- **Sáng**;
- **Tối**;
- **Hệ thống**: theo cài đặt sáng hay tối của máy bạn.

Nút đổi nằm ở góc phải của thanh trên cùng:
- **Trang quản trị:** hai ô chọn, "Tiếng Việt" và "Hệ thống".
- **Trang của khách:** các nút **EN**, **VI** và **Sáng**, **Tối**, **Hệ thống**.

Giá luôn viết kiểu `1.250.000 ₫`, ở cả tiếng Việt lẫn tiếng Anh.

## Bản này chưa có gì

- **Tài khoản và đăng nhập:** nút "Đăng nhập" ở góc phải chưa dùng trong bản này.
- **Giỏ hàng và thanh toán.**
- **Danh mục nhóm sản phẩm.**
- **Ảnh sản phẩm thật:** mỗi sản phẩm có một ô màu với chữ cái đầu của tên.
- **Trang chủ và trang Giới thiệu:** vẫn là trang mẫu.

## Về ảnh trong hướng dẫn

Ảnh được chụp trong các lượt kiểm thử thật trên môi trường Development. Vì vậy tên sản phẩm trong ảnh có đuôi như "E2E yp8c9z". Trên trang thật, tên sản phẩm là đúng tên quản trị viên đã nhập.
