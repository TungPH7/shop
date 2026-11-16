# 11 — Auth & RBAC

> Authentication = "bạn là ai". Authorization = "bạn được làm gì". Quyền do **backend** cấp, frontend không tự bịa.

## 11.1 Token

### AU-001 [MUST] Token lưu và đọc qua đúng một module

`src/lib/auth/token-storage.ts` là nơi duy nhất đụng tới nơi lưu token. Không đọc `localStorage` trực tiếp ở component hay ở tầng api.

### AU-002 [MUST] React đọc trạng thái token qua `useSyncExternalStore`

Nơi lưu token không reactive ⇒ module token phát sự kiện (pub/sub) và hook đăng ký bằng `useSyncExternalStore`. Không polling bằng `useEffect`. → `CH-014`

### AU-003 [MUST] Token không được xuất hiện ở log, URL hay analytics

→ `17-security.md`

## 11.2 Cắm vào tầng API

### AU-004 [MUST] Cắm seam auth đúng một lần lúc bootstrap

`app/configure-auth.ts` gọi `configureApiAuth(...)` một lần ở `main.tsx`. Nội dung cắm vào:

| Hook của seam | Việc |
|---|---|
| `getAccessToken` | Đọc từ token storage |
| `refreshTokens` | Gọi endpoint refresh bằng **client trần** (tránh đệ quy interceptor), lưu token mới |
| `onUnauthorized` | Xóa token + xóa cache Query + điều hướng về trang đăng nhập |

Tầng api không import feature auth (`API-008`).

## 11.3 Người dùng hiện tại

### AU-005 [MUST] `currentUser` là **server state**, lấy qua TanStack Query

Không đặt user vào Redux, không đặt vào Context tự viết. Profile là dữ liệu của server ⇒ thuộc về Query (`ST-001`), có cache và refetch đúng cách.

### AU-006 [MUST] `isAuthenticated` xác định bằng profile hợp lệ, không phải bằng "có token"

Token có thể hết hạn hoặc bị thu hồi. Đăng nhập trả token → fetch profile riêng → có profile mới coi là đã xác thực.

✅ `const isAuthenticated = !!profile;`
❌ `const isAuthenticated = !!localStorage.getItem('token');`

### AU-007 [MUST] Query profile bật/tắt theo token

`enabled` phụ thuộc token (reactive theo `AU-002`) ⇒ đăng xuất là ngừng gọi, đăng nhập là tự gọi, không cần điều phối thủ công.

## 11.4 Bề mặt cho UI

### AU-008 [MUST] UI chỉ dùng facade `useAuth()` và `usePermission()`

`useAuth()` → `{ user, isAuthenticated, isLoading, login, logout }`
`usePermission()` → `{ hasModule(module) }`

Component không tự đọc token, không tự duyệt mảng permission.

Facade chưa có hàm kiểm quyền theo thao tác (`method` + `path`): tầng element đang tạm ngưng (`AU-011`). Khi cần lại, thêm hàm thuần vào `permission.ts` (`AU-009`) rồi mở rộng facade, không kiểm tại chỗ trong component.

### AU-009 [MUST] Logic kiểm quyền là hàm thuần, tách khỏi hook

Đặt ở `features/auth/lib/permission.ts` — không phụ thuộc React ⇒ unit-test trực tiếp, không cần render. Hook chỉ bọc mỏng.

## 11.5 Phân quyền

### AU-010 [MUST] Quyền lấy từ backend, không hardcode ở frontend

Frontend nhận danh sách permission trong profile và **kiểm theo dữ liệu đó**. Cấm viết cứng kiểu `if (user.role === 'admin')` rải rác.

### AU-011 [MUST] Chặn ở tầng route

Route cần đăng nhập hay cần quyền thì chặn bằng guard của `features/auth`, khai trong bảng route (`src/app/routes.tsx`):

| Tầng | Công cụ | Hành vi khi không đạt |
|---|---|---|
| Route — chưa đăng nhập | `<ProtectedRoute>` | Điều hướng tới trang đăng nhập |
| Route — thiếu quyền module | `<RequireModule module="…">` | Điều hướng tới trang từ chối truy cập |

Lồng nhau: `ProtectedRoute` › `RequireModule` › page.

⏳ **[PLANNED] Tầng element — tạm ngưng tới Epic đăng nhập.** Component `<Can method path>` của template đã gỡ ở SHOP-42 (PR #31), vì không còn nơi nào dùng. Epic Danh mục sản phẩm (SHOP-7) để các trang sản phẩm của admin ở ngoài `ProtectedRoute` (`docs/specs/SHOP-7/plan.md`), và tới Epic đăng nhập chỉ mạng giữ các lệnh ghi (NFR8 của `docs/specs/SHOP-7/spec.md`). Vì vậy review không đòi ẩn nút hay chặn thao tác theo quyền ở tầng element. Epic đăng nhập đưa lại công cụ của tầng này và cập nhật luật này.

### AU-012 [MUST] Chặn UI ở client không phải cơ chế bảo mật

Guard route, và mọi lần ẩn hay disable UI theo quyền, chỉ để trải nghiệm sạch. Quyền thật do backend cưỡng chế ở mỗi request. Không bao giờ dựa vào việc chặn ở client để bảo vệ dữ liệu.

### AU-013 [MUST] Feature khác không được import component hay hook của auth

Cần UI của feature X đổi theo quyền ⇒ X nhận slot `ReactNode`; tầng `app` đọc `usePermission()` rồi quyết định bơm gì vào slot. → `PS-002`

### AU-014 [SHOULD] Contract auth gói trong `features/auth/`

Schema (`User` / `Role` / `Permission`) + lời gọi API nằm trong feature. Đổi backend auth ⇒ chỉ sửa ở đây.
