# 02 — Core Principles

> 10 nguyên tắc nền. Mọi rule trong các file sau đều là hệ quả của chúng.
> Gặp tình huống tài liệu không nhắc tới → quyết định theo các nguyên tắc này.

### CP-001 [MUST] TypeScript-first, strict từ dòng đầu

Type là hợp đồng. Không có giai đoạn "code trước, thêm type sau", không `any` để cho qua. → `05-typescript.md`

### CP-002 [MUST] Dependency một chiều, feature là ranh giới

Code chảy đúng một chiều `shared → features → app`. Feature **không** import feature khác. Cần dùng chung ⇒ nâng lên `shared`, hoặc **compose ở tầng `app`**. → `03-project-structure.md`

### CP-003 [SHOULD] Colocation — thứ đổi cùng nhau nằm cạnh nhau

Component, hook, model, test, api call của một feature nằm trong chính feature đó. Chỉ nâng lên `shared` khi có **≥ 2** nơi dùng thật, không nâng vì "sau này chắc dùng".

### CP-004 [MUST] Server state ≠ client state

Dữ liệu từ API thuộc về TanStack Query. State UI thuộc về Redux. State chia sẻ/bookmark được thuộc về URL. **Không** nhồi data API vào Redux store. Đây là sai lầm kiến trúc đắt nhất và khó gỡ nhất. → `09-state-management.md`

### CP-005 [MUST] Validate tại ranh giới, tin kiểu ở bên trong

Mọi dữ liệu từ ngoài (API response, env, form, URL, localStorage) phải qua Zod **ngay tại điểm nhập**. Sau ranh giới đó, code tin vào type và không phòng thủ lặp lại.

### CP-006 [MUST] Seam & DI — đổi ruột không đổi call-site

Thư viện bên thứ ba đứng sau một **seam** (facade hook hoặc interface + hàm `configure*`). `lib/*` không import trực tiếp SDK của provider. Đổi Redux → Zustand, console → Sentry chỉ sửa đúng một chỗ.

✅ component gọi `useTheme()` ❌ component gọi `useSelector()` trực tiếp

### CP-007 [MUST] Rules of React là bất khả xâm phạm

Component và hook phải **pure**; không gọi hook có điều kiện; không mutate props/state. Tuân thủ ⇒ React Compiler tự tối ưu. Vi phạm ⇒ compiler bỏ qua hoặc app lỗi khó debug.

**Enforce:** `eslint-plugin-react-hooks` (preset `recommended-latest`).

### CP-008 [MUST] Đừng lạm dụng `useEffect`

Effect chỉ để **đồng bộ với hệ thống ngoài React**. Giá trị dẫn xuất → tính khi render. Phản ứng với hành động người dùng → event handler. Fetch dữ liệu → TanStack Query. → `06-components-and-hooks.md`

### CP-009 [MUST] Quality gate tự động, không dựa vào kỷ luật con người

Rule nào enforce được bằng lint/type-check/CI thì **phải** enforce. Review dành cho thứ máy không kiểm được (đặt tên có nghĩa, kiến trúc, đánh đổi). → `19-tooling-git-ci.md`

### CP-010 [MUST] Mọi thay đổi phải verify được

PR phải nêu được cách kiểm chứng: 4 lệnh gate xanh, test mới cho hành vi mới, hoặc số đo trước/sau cho thay đổi performance. "Chạy thử thấy ổn" không phải bằng chứng.

---

## Bảng quyết định nhanh

| Tình huống | Nguyên tắc chi phối |
|---|---|
| Không biết đặt file ở đâu | CP-002, CP-003 |
| Định gọi `useEffect` để fetch | CP-004, CP-008 |
| Định `import` từ feature khác | CP-002 |
| Nhận dữ liệu lạ từ ngoài | CP-005 |
| Định `import` SDK bên thứ ba vào component | CP-006 |
| Định thêm `eslint-disable` | CP-009 + `00-introduction.md §0.8` |
| Định tối ưu re-render bằng tay | CP-007, CP-010 |
