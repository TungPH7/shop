# Chạy dự án từ số 0 — hướng dẫn cho người không rành code

> **Tài liệu này dành cho ai:** khách hàng, QA, PM, designer, sinh viên — **bất kỳ ai chưa từng lập trình** nhưng cần mở được ứng dụng lên xem trên máy mình.
>
> **Bạn cần:** một máy Windows / macOS / Linux, kết nối Internet, và **khoảng 20–30 phút** (phần lớn là chờ máy tải).
>
> **Bạn KHÔNG cần:** biết React, biết TypeScript, hay hiểu code trong repo.
>
> Cách dùng: làm **lần lượt từng bước**, mỗi bước có phần *"Làm sao biết là đã đúng?"*. Nếu kết quả không giống mô tả, nhảy xuống [Xử lý sự cố](#xử-lý-sự-cố) tìm đúng dòng lỗi rồi quay lại.

---

## Bước 0. Vài khái niệm trong 60 giây

| Từ | Hiểu nôm na |
|---|---|
| **Source code** | Bộ file chữ mô tả ứng dụng. Máy cần "dựng" nó lên thì mới thành trang web xem được. |
| **Terminal** (Command Prompt / PowerShell / Terminal) | Cửa sổ đen để **gõ lệnh** cho máy. Ta sẽ gõ khoảng 6 lệnh, chỉ vậy thôi. |
| **Node.js** | Bộ máy chạy JavaScript trên máy tính. Không có nó thì không dựng được app. |
| **pnpm** | Công cụ tải các "linh kiện" (thư viện) mà app cần. |
| **Dev server** | Chương trình chạy tại máy bạn, phục vụ trang web ở địa chỉ `http://localhost:5173`. Chỉ **máy bạn** vào được, không ai bên ngoài thấy. |

> 💡 **Quy tắc gõ lệnh:** copy nguyên dòng lệnh → dán vào terminal → nhấn `Enter` → **chờ cho tới khi con trỏ nhấp nháy trở lại** rồi mới gõ lệnh kế tiếp. Đừng gõ tay (dễ sai một ký tự).

---

## Bước 1. Cài Node.js phiên bản 24

Dự án chạy đúng trên **Node 24.17.0**. Bản quá cũ hoặc quá mới đều có thể lỗi.

**Cách đơn giản nhất (khuyến nghị cho người không rành code):**

1. Vào **https://nodejs.org** → tải bản **LTS** (nút bên trái, có chữ *Recommended For Most Users*).
2. Mở file vừa tải → bấm **Next / Continue** cho tới hết → **Finish**.
3. **Đóng hẳn mọi cửa sổ terminal đang mở** (bước này hay bị quên — terminal cũ sẽ không thấy Node mới cài).

<details>
<summary>Nếu máy bạn đang có sẵn nhiều phiên bản Node (dành cho dev)</summary>

Repo đã ghi sẵn phiên bản trong file `.nvmrc`. Dùng `nvm` (hoặc `fnm`) thì chỉ cần vào thư mục dự án rồi gõ:

```bash
nvm use          # nvm-windows: nvm use 24.17.0
```

</details>

---

## Bước 2. Mở terminal

| Hệ điều hành | Cách mở |
|---|---|
| **Windows** | Nhấn phím `Windows` → gõ `powershell` → `Enter` |
| **macOS** | `Command + Space` → gõ `terminal` → `Enter` |
| **Linux** | `Ctrl + Alt + T` |

Gõ lệnh sau để kiểm tra Node đã cài xong:

```bash
node -v
```

✅ **Đúng khi:** màn hình in ra `v24.17.0` (hoặc `v24.x.x`).
❌ **Sai khi:** báo `command not found` / `not recognized` → xem [Lỗi 1](#lỗi-1-máy-báo-không-tìm-thấy-lệnh-node).

---

## Bước 3. Lấy source code về máy

**Cách A — Người gửi cho bạn file `.zip`:** giải nén vào một thư mục dễ nhớ, ví dụ `D:\projects\`. **Không** để trong thư mục có dấu tiếng Việt hoặc ký tự lạ.

**Cách B — Lấy từ Git (nếu bạn được cấp link repo):**

```bash
git clone <đường-dẫn-repo> 00-tungph7-codebase1-ui-reactjs
```

> Nếu báo `git: command not found`, tải Git tại **https://git-scm.com/downloads**, cài (bấm Next tới hết), mở lại terminal, rồi chạy lại lệnh.

---

## Bước 4. Đi vào thư mục dự án

Terminal cần "đứng" đúng chỗ chứa source thì lệnh mới chạy. Dùng lệnh `cd` (change directory):

```bash
cd D:\Document\1Khoahoc\4LapTrinh\reactjs\00-tungph7-codebase1-ui-reactjs
```

> 🪄 **Mẹo đỡ phải gõ đường dẫn:** gõ `cd ` (có dấu cách ở cuối) rồi **kéo thả thư mục dự án** từ File Explorer / Finder vào cửa sổ terminal → đường dẫn tự điền → `Enter`.

Kiểm tra đã đứng đúng chỗ:

```bash
ls        # Windows PowerShell cũng dùng được `ls`
```

✅ **Đúng khi:** thấy trong danh sách có `package.json`, `src`, `README.md`.

---

## Bước 5. Bật pnpm

```bash
corepack enable
```

Lệnh này thường **không in ra gì cả** — im lặng là thành công. Kiểm tra:

```bash
pnpm -v
```

✅ **Đúng khi:** in ra `11.8.0`.
❌ Nếu báo lỗi → xem [Lỗi 2](#lỗi-2-máy-báo-không-tìm-thấy-lệnh-pnpm-hoặc-corepack).

---

## Bước 6. Tạo file cấu hình (BƯỚC QUAN TRỌNG NHẤT)

Dự án **cố tình không** kèm sẵn file cấu hình vì lý do bảo mật. **Bỏ qua bước này thì app sẽ hiện trang trắng.** Bạn chỉ cần copy file mẫu ra thành file thật:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env.development
Copy-Item .env.example .env.production
```

**macOS / Linux:**

```bash
cp .env.example .env.development
cp .env.example .env.production
```

✅ **Đúng khi:** lệnh không báo lỗi. (Hai file mới này bị ẩn khỏi Git — đúng như thiết kế.)

> **File đó chứa gì?** Đúng một dòng: địa chỉ máy chủ dữ liệu mà app sẽ gọi tới —
> `VITE_API_URL=https://ecom-nest.t2g.io.vn`. Đây là địa chỉ **công khai**, không phải mật khẩu. Nếu team bạn có máy chủ riêng, mở file `.env.development` bằng Notepad và thay địa chỉ này.

---

## Bước 7. Tải các thư viện

```bash
pnpm install
```

⏳ **Lần đầu mất khoảng 2–5 phút** và in ra rất nhiều dòng chữ — **hoàn toàn bình thường**. Chữ vàng `WARN` cũng bình thường, cứ để yên cho nó chạy xong.

✅ **Đúng khi:** dòng cuối đại loại `Done in 2m 13s` và con trỏ nhấp nháy trở lại.
❌ Nếu dừng giữa chừng vì mạng → chỉ cần chạy lại đúng lệnh đó.

---

## Bước 8. Chạy app

```bash
pnpm dev
```

Sau vài giây, terminal in ra:

```txt
  VITE v8.0.16  ready in 1200 ms

  ➜  Local:   http://localhost:5173/
```

Mở trình duyệt (Chrome / Edge / Safari) và vào: **http://localhost:5173**

✅ **Đúng khi:** thấy tiêu đề **tungph7 codebase**, một thanh menu (Home · Products · About · Login) và một ô chọn ngôn ngữ.

> ### "Sao trang trông trơ trụi, không màu mè gì vậy?"
>
> **Đúng như thiết kế, không phải lỗi.** Giai đoạn hiện tại (Phase 1.1) cố ý **chưa lắp thư viện giao diện** để phần lõi có thể ghép với *bất kỳ* bộ UI nào sau này (Ant Design, Headless…). Phần đang chạy là **bộ khung kỹ thuật**: điều hướng, đa ngôn ngữ, đăng nhập, phân quyền, gọi API, xử lý lỗi. Giao diện đẹp thuộc Phase 1.2.

---

## Bước 9. Thử xem cho biết là nó chạy thật

Không cần tài khoản, làm được ngay:

| Thử cái này | Kết quả mong đợi |
|---|---|
| Bấm menu **About**, rồi **Home** | Trang đổi ngay, **URL trên thanh địa chỉ đổi theo**, không nháy tải lại |
| Đổi ô **Language** từ `en` sang `vi` | Chữ trên menu đổi sang tiếng Việt **tức thì** (Home → Trang chủ) |
| Đóng hẳn trình duyệt rồi mở lại `localhost:5173` | Vẫn còn tiếng Việt — app **nhớ** lựa chọn của bạn |
| Bấm nút **Sidebar / Theme** | Chữ trên nút đổi trạng thái (chưa đổi màu — theming thuộc Phase 1.2) |
| Gõ bừa một địa chỉ sai, ví dụ `localhost:5173/abcxyz` | Hiện trang **404**, menu vẫn còn, app **không chết** |
| Vào **Products** | Xem ghi chú ngay bên dưới 👇 |

> **Trang Products báo `Failed to load products: Response did not match the expected schema` — đây là kết quả ĐÚNG, không phải hỏng.**
> Máy chủ demo đang trả dữ liệu theo định dạng **khác** với định dạng mà app yêu cầu. App phát hiện sai lệch **ngay tại cửa vào** và báo lỗi rõ ràng, thay vì hiển thị dữ liệu sai lệch rồi vỡ ở chỗ khác. Đây chính là cơ chế an toàn dữ liệu của dự án đang hoạt động. Phần Product ở đây là **feature mẫu** để lập trình viên nhân bản, chưa phải tích hợp thật với máy chủ đó.

**Muốn đăng nhập thử?** Cần một tài khoản do người quản trị **máy chủ dữ liệu** cấp (repo này không tự tạo tài khoản). Có tài khoản rồi thì vào **Login**, nhập email + mật khẩu; đăng nhập xong menu sẽ hiện email của bạn, và các trang quản trị chỉ mở ra nếu tài khoản **đủ quyền**.

---

## Bước 10. Tắt app / mở lại lần sau

**Tắt:** bấm vào cửa sổ terminal → nhấn `Ctrl + C`. (Đóng cửa sổ terminal cũng được.)

**Lần sau mở lại — chỉ còn 2 lệnh, không phải làm lại từ đầu:**

```bash
cd D:\Document\1Khoahoc\4LapTrinh\reactjs\00-tungph7-codebase1-ui-reactjs
pnpm dev
```

<details>
<summary><b>Tuỳ chọn:</b> xem bản "production" (bản thật sẽ đem đi deploy)</summary>

Bản `pnpm dev` là bản dành cho lập trình viên. Muốn xem bản đã tối ưu (nhẹ và nhanh hơn):

```bash
pnpm build      # đóng gói, ~1-2 phút, tạo ra thư mục dist/
pnpm preview    # xem thử, địa chỉ hiện ngay trên terminal (thường là cổng 4173)
```

⚠️ Phải có file `.env.production` (đã tạo ở [Bước 6](#bước-6-tạo-file-cấu-hình-bước-quan-trọng-nhất)) **trước khi** chạy `pnpm build`, nếu không bản build sẽ ra trang trắng.

</details>

---

## Xử lý sự cố

### Lỗi 1. Máy báo không tìm thấy lệnh node

(`command not found` / `'node' is not recognized`)

Node chưa cài xong, **hoặc** terminal đang mở từ trước lúc cài. → **Đóng hẳn terminal, mở lại**, thử lại. Vẫn lỗi thì cài lại Node ([Bước 1](#bước-1-cài-nodejs-phiên-bản-24)) và nhớ bấm hết các bước Next → Finish.

### Lỗi 2. Máy báo không tìm thấy lệnh pnpm hoặc corepack

Chạy lệnh thay thế sau (Windows: mở PowerShell bằng chuột phải → *Run as administrator*):

```bash
npm install -g pnpm@11.8.0
```

Rồi kiểm tra lại `pnpm -v`.

### Lỗi 3. Trang trắng tinh, không có chữ nào

99% là **thiếu file cấu hình** ở [Bước 6](#bước-6-tạo-file-cấu-hình-bước-quan-trọng-nhất). Kiểm chứng: trong trình duyệt nhấn `F12` → tab **Console** → nếu thấy dòng đỏ `[env] Invalid environment variables` thì đúng là nó.

→ Tắt app (`Ctrl + C`), tạo file `.env.development`, chạy lại `pnpm dev`.

### Lỗi 4. Windows báo `cp : The term 'cp' is not recognized`

Bạn đang dùng PowerShell — nó không hiểu lệnh kiểu macOS. Dùng bản Windows:

```powershell
Copy-Item .env.example .env.development
```

### Lỗi 5. Báo `Port 5173 is in use` (cổng đang bị chiếm)

Có một bản app khác còn chạy. Hoặc tắt cửa sổ terminal cũ đi, hoặc chạy ở cổng khác:

```bash
pnpm dev --port 5174
```

Rồi mở `http://localhost:5174`.

### Lỗi 6. `pnpm install` chạy giữa chừng thì đứt mạng

Chạy lại đúng lệnh `pnpm install` — nó tiếp tục từ chỗ dở, không tải lại từ đầu. Nếu công ty bạn dùng proxy/VPN chặn mạng ngoài, cần nhờ IT mở hoặc cấu hình proxy cho pnpm.

### Lỗi 7. Lỗi kỳ lạ, đã thử hết vẫn không được — dọn dẹp và cài lại

```bash
# Windows PowerShell
Remove-Item -Recurse -Force node_modules
pnpm install

# macOS / Linux
rm -rf node_modules
pnpm install
```

### Lỗi 8. Vẫn không chạy được

Chụp màn hình **toàn bộ cửa sổ terminal** (nhìn thấy cả lệnh bạn gõ lẫn dòng lỗi) rồi gửi cho lập trình viên, kèm kết quả 2 lệnh này:

```bash
node -v
pnpm -v
```

…và tên hệ điều hành (Windows 10/11, macOS…). Có đủ 3 thứ đó thì việc chẩn đoán thường mất chưa tới 1 phút.

---

## Câu hỏi hay gặp

**App có gửi dữ liệu máy tôi đi đâu không?**
Không. Toàn bộ chạy trên máy bạn tại `localhost`. App chỉ gọi tới địa chỉ máy chủ ghi trong file `.env.development` để lấy dữ liệu sản phẩm / đăng nhập.

**Người khác có vào xem trang của tôi được không?**
Không. `localhost` chỉ máy bạn truy cập được.

**Cài xong có làm hỏng máy / phần mềm khác không?**
Không. Node.js và pnpm là công cụ lập trình phổ biến; toàn bộ thư viện của dự án nằm gọn trong thư mục `node_modules` bên trong dự án. Muốn gỡ sạch: xoá thư mục dự án là xong.

**Tôi có phải chạy lại `pnpm install` mỗi lần mở máy không?**
Không. Chỉ chạy lại khi lập trình viên báo là *"đã cập nhật thư viện"* (sau khi bạn nhận source mới / `git pull`).

**Tôi sửa vài chữ trong code thì sao?**
Cứ lưu file, trang trong trình duyệt **tự cập nhật ngay** (không cần tắt/mở lại). Nếu lỡ làm hỏng, Git cho phép khôi phục toàn bộ.

**Tôi muốn hiểu sâu hơn về dự án?**
Đọc **[../README.md](../README.md)** (tổng quan kỹ thuật, 5–10 phút) → **[conventions.md](./conventions.md)** (luật code) → **[../study-guide-impl/build-project/](../study-guide-impl/build-project/)** (giải thích *vì sao* từng quyết định).
