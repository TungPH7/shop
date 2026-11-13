# 20 — Quick Reference & PR Checklist

> Một trang để mở lúc code và lúc review. Chi tiết ở file chủ đề tương ứng.

## 20.1 Tôi cần làm X → đọc file nào

| Việc | File |
|---|---|
| Không biết đặt file mới ở đâu | `03-project-structure.md` |
| Đặt tên file/biến/commit | `04-naming-conventions.md` |
| Gọi API mới | `08-api-layer.md` → `09-state-management.md` |
| Thêm state | `09-state-management.md` (bảng §9.1 trước tiên) |
| Làm form | `10-forms-and-validation.md` |
| Thêm route | `07-routing.md` |
| Chặn quyền truy cập | `11-auth-and-rbac.md` |
| Xử lý lỗi | `12-error-handling.md` |
| Thêm chuỗi hiển thị | `14-i18n.md` |
| Viết test | `16-testing.md` |
| Render HTML từ người dùng | `17-security.md` |
| App chậm | `18-performance.md` |
| CI đỏ | `19-tooling-git-ci.md` |

## 20.2 Cheat sheet

**Đặt tên**

```
file/folder      kebab-case        product-card.tsx
component        PascalCase        ProductCard
hook             use + camelCase   useProductList
props type       XxxProps          ProductCardProps
boolean          is/has/should     isLoading
prop callback    on*               onSubmit
hàm xử lý        handle*           handleSubmit
hằng số          UPPER_SNAKE       MAX_RETRIES
zod schema       xxxSchema         productSchema
commit           type: subject     feat: add product edit form
```

**Đặt state đúng chỗ**

```
Dữ liệu từ server?          → TanStack Query        (KHÔNG Redux)
Cần chia sẻ/bookmark URL?   → nuqs
UI toàn cục (theme…)?       → Redux qua facade hook
Còn lại                     → useState
```

**Import**

```
✅ import { X } from '@/features/product/components/x';
❌ import { X } from '@/features/product';        (barrel)
❌ import { X } from '../../../features/...';     (relative dài)
❌ features/a → features/b                        (cross-feature)
❌ shared → features | features → app             (ngược chiều)
❌ react-redux ngoài src/stores/                  (phá seam)
```

**Lệnh trước khi mở PR**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

## 20.3 PR Checklist

**Kiến trúc**
- [ ] File đặt đúng tầng; không import ngược chiều, không cross-feature (`PS-001`, `PS-002`)
- [ ] Không tạo barrel `index.ts` (`PS-003`)
- [ ] Import xuyên thư mục dùng `@/` (`PS-004`)
- [ ] Feature mới đã thêm zone cross-feature vào `eslint.config.js` (`PS-002`)

**TypeScript**
- [ ] Không `any`, không `@ts-ignore` (`TY-003`, `TY-001`)
- [ ] Type suy ra từ Zod schema, không khai trùng (`NM-007`)
- [ ] Dữ liệu ngoài đã validate tại điểm nhập (`TY-010`)

**React**
- [ ] Không `useEffect` để fetch / tính giá trị dẫn xuất (`CH-013`)
- [ ] Không memo hóa thủ công (`PF-001`)
- [ ] `key` ổn định trong danh sách (`CH-006`)
- [ ] Component truy cập store/i18n qua facade (`CH-012`)

**Dữ liệu**
- [ ] Server state ở Query, không nhồi vào Redux (`ST-002`)
- [ ] Query key lấy từ factory (`ST-005`)
- [ ] Mutation đã invalidate/cập nhật cache đúng (`ST-007`)
- [ ] Đủ trạng thái pending / error / success (`ST-008`)

**Chất lượng**
- [ ] Hành vi mới có test; bug fix có test tái hiện (`TE-002`)
- [ ] Test không mock hook của chính mình, mock ở MSW (`TE-005`, `TE-008`)
- [ ] Coverage không tụt; không hạ ngưỡng (`TG-011`)

**A11y & i18n**
- [ ] Control có tên đọc được; vùng động có `role="status"`/`"alert"` (`UI-002`, `UI-003`)
- [ ] Không hardcode chuỗi hiển thị (`IN-004`)

**Bảo mật**
- [ ] Không `dangerouslySetInnerHTML` trực tiếp (`SE-001`)
- [ ] Không secret trong `src/` (`SE-005`)
- [ ] Token không lọt vào log/URL/analytics (`SE-008`)

**Quy trình**
- [ ] 4 lệnh gate xanh (`TG-008`)
- [ ] Commit đúng Conventional Commits (`NM-010`)
- [ ] Mô tả PR nêu cách verify (`TG-014`)
- [ ] Rule mới/đổi ⇒ đã cập nhật tài liệu + `CHANGELOG.md`

## 20.4 Anti-pattern hay gặp

| ❌ Thấy trong PR | ✅ Thay bằng |
|---|---|
| `useEffect(() => { fetch(...) }, [])` | `useQuery` (`ST-006`) |
| `dispatch(setProducts(data))` | Để Query giữ dữ liệu (`ST-002`) |
| `useSelector` trong component | Facade hook (`ST-010`) |
| `catch (e) { console.log(e) }` | `captureError` + hiển thị (`EH-012`) |
| `toast.error()` trong interceptor | `onError` ở cache của Query (`EH-006`) |
| `api.get<Product[]>('/products')` | Truyền Zod schema (`API-010`) |
| `<div onClick=…>` làm nút | `<button>` (`UI-001`) |
| `items[0]!` | Kiểm `undefined` (`TY-008`) |
| `key={index}` | `key={item.id}` (`CH-006`) |
| `import { X } from '@/features/other'` | Nâng lên shared / compose ở app (`PS-002`) |
