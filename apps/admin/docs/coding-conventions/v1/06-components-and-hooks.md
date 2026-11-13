# 06 — Components & Hooks

> Component thuần, hook nhỏ, `useEffect` là ngoại lệ chứ không phải mặc định.

## 6.1 Component

### CH-001 [MUST] Function component; không viết class mới

Ngoại lệ duy nhất: Error Boundary (React chưa có API hook tương đương) — và ta dùng thư viện sẵn thay vì tự viết. → `12-error-handling.md`

### CH-002 [SHOULD] Thứ tự trong file component

```tsx
// 1. imports
// 2. types (Props, type cục bộ)
// 3. hằng số module-level
// 4. component:
//    4.1 hooks (state, store, query, router)
//    4.2 giá trị dẫn xuất (tính khi render)
//    4.3 handlers
//    4.4 early return (loading / error / empty)
//    4.5 JSX
```

Thứ tự cố định giúp reviewer quét nhanh và giảm diff nhiễu.

### CH-003 [MUST] Props có type đặt tên `<Component>Props`, ưu tiên props bắt buộc

Chỉ để `?` khi thật sự có mặc định hợp lý. Optional bừa bãi đẩy việc xử lý `undefined` xuống mọi nơi dùng.

✅
```tsx
interface ProductCardProps {
  product: Product;
  onSelect?: (id: string) => void;
}
export function ProductCard({ product, onSelect }: ProductCardProps) { ... }
```

### CH-004 [MUST] Component nhận dữ liệu đã sẵn sàng; không tự đi lấy dữ liệu ở tầng lá

Component trình bày nhận `props`. Việc gọi query/mutation đặt ở component "cửa ngõ" của feature hoặc ở route, không rải xuống từng lá.

### CH-005 [SHOULD] Composition thay vì props phình to

Prop vượt ~7 cái, hoặc xuất hiện `variant` chồng `variant` ⇒ tách component / dùng slot `ReactNode` / `children`.

Slot cũng là cách hợp lệ duy nhất để một feature nhận UI của feature khác (`PS-002`).

### CH-006 [MUST] `key` phải ổn định và định danh phần tử

✅ `items.map((it) => <Row key={it.id} />)`
❌ `items.map((it, i) => <Row key={i} />)` khi list có thể thêm/xóa/sắp xếp.

### CH-007 [SHOULD] Early return cho loading / error / empty

Xử lý đủ ba trạng thái này trước khi render nội dung chính; không lồng ternary nhiều tầng trong JSX.

### CH-008 [MUST] `ref` là prop thường (React 19)

Không dùng `forwardRef` cho code mới.

✅ `function TextField({ ref, ...rest }: TextFieldProps) { ... }`

## 6.2 Hooks

### CH-009 [MUST] Tuân thủ Rules of Hooks

Gọi hook ở top level, không trong điều kiện/vòng lặp/sau early return. Component và hook phải pure.

**Enforce:** `eslint-plugin-react-hooks` (`recommended-latest`)

### CH-010 [MUST] Tách logic tái dùng thành custom hook, không copy giữa component

Hook đặt trong `features/<x>/hooks/` nếu riêng feature, `src/hooks/` nếu dùng chung ≥ 2 feature (`PS-005`).

### CH-011 [SHOULD] Hook trả về object có tên, không trả tuple dài

✅ `const { user, isAuthenticated, login, logout } = useAuth();`
❌ `const [user, isAuth, login, logout] = useAuth();`

Tuple chỉ hợp lý khi ≤ 2 phần tử và thứ tự hiển nhiên (kiểu `useState`).

### CH-012 [MUST] Hook facade là cửa duy nhất tới store/thư viện state

Component gọi `useTheme()`, `useAuth()`, `useLocale()` — không gọi thẳng `useSelector`, `useDispatch`, `i18n.changeLanguage`. → `CP-006`, `09-state-management.md`

**Enforce:** `no-restricted-imports` (chặn `react-redux` / `@reduxjs/toolkit` ngoài `src/stores/**`)

## 6.3 `useEffect`

### CH-013 [MUST] `useEffect` chỉ để đồng bộ với hệ thống ngoài React

Hợp lệ: subscribe/unsubscribe API trình duyệt, đo DOM, tích hợp thư viện non-React.

| Việc bạn định làm | Cách đúng |
|---|---|
| Tính giá trị từ props/state | Tính thẳng khi render |
| Fetch dữ liệu server | TanStack Query (`09`) |
| Phản ứng với hành động người dùng | Event handler |
| Reset state khi prop đổi | Đổi `key` của component |
| Đồng bộ hai state cho khớp nhau | Bỏ bớt một state, suy ra từ state kia |
| Đọc store ngoài React (localStorage, pub/sub) | `useSyncExternalStore` |

**Enforce (một phần):** `react-hooks` lint (vd `set-state-in-effect`)

### CH-014 [MUST] Đọc external store bằng `useSyncExternalStore`

`localStorage` và các store pub/sub tự viết **không** reactive. Đừng poll bằng effect — dùng `useSyncExternalStore` để React đăng ký đúng cách.

### CH-015 [MUST] Không tự tối ưu re-render bằng `useMemo`/`useCallback`/`memo`

React Compiler đã memo hóa tự động lúc build. Chỉ dùng thủ công khi **đo được** vấn đề và ghi lý do trong comment. → `18-performance.md`

## 6.4 Trạng thái bất đồng bộ trong UI

### CH-016 [MUST] Không nuốt lỗi và không bỏ promise trôi nổi

✅ `<form onSubmit={(e) => void handleSubmit(e)}>`
❌ `<form onSubmit={handleSubmit}>` khi `handleSubmit` là `async` (floating promise)

Lỗi phải đi tới một đích rõ ràng: state của Query, `onError`, hoặc ném ra Error Boundary. Không `catch {}` rỗng.

### CH-017 [MUST] Vùng trạng thái động phải có ngữ nghĩa a11y

Loading dùng `role="status"`, lỗi dùng `role="alert"`. → `15-ui-and-accessibility.md`
