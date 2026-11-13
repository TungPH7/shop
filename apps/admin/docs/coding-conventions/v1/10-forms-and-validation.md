# 10 — Forms & Validation

> react-hook-form (uncontrolled) + Zod resolver. **Một schema dùng cho cả form và request** — không có hai nguồn sự thật.

## 10.1 Stack & pattern

### FM-001 [MUST] Form dùng `useForm` + `zodResolver`, không tự viết validation

✅
```tsx
const form = useForm<CreateProductInput>({
  resolver: zodResolver(createProductSchema),
  defaultValues: { name: '', price: 0 },
});
```
❌ Tự kiểm tra `if (!name) setError('name required')`.

### FM-002 [MUST] Dùng lại đúng schema đã dùng ở ranh giới API

Schema validate form **phải** là schema (hoặc schema phái sinh) dùng cho body request. Hai schema song song sẽ lệch nhau.

✅ `createProductSchema = productSchema.omit({ id: true })` — dùng cho cả form và `createProduct()`
❌ `productFormSchema` riêng, `createProductBodySchema` riêng.

### FM-003 [MUST] Ưu tiên uncontrolled qua `register`

Chỉ dùng `Controller` cho component không nhận `ref` (thường là component của thư viện UI). Controlled toàn bộ ⇒ re-render mỗi phím gõ.

### FM-004 [MUST] `defaultValues` phải khai đầy đủ

Thiếu `defaultValues` ⇒ field chuyển từ uncontrolled sang controlled giữa chừng, sinh cảnh báo và bug khó lần.

### FM-005 [MUST] Đặt `noValidate` trên `<form>`

Zod là nguồn validation duy nhất; validation native của trình duyệt sẽ báo song song, khác ngôn ngữ và khác nội dung.

### FM-006 [MUST] Ép kiểu tại `register` cho input không phải chuỗi

✅ `register('price', { valueAsNumber: true })`
❌ Nhận `"12"` rồi để schema `z.number()` báo lỗi kiểu sai.

## 10.2 Field & a11y

### FM-007 [MUST] Dùng field component chung, không tự lắp `<label>` + `<input>` + lỗi

`src/components/form/text-field.tsx` đã gói: `label` ↔ `htmlFor`/`id`, `aria-invalid`, `aria-describedby`, thông báo lỗi `role="alert"`.

✅ `<TextField label="Name" error={errors.name?.message} {...register('name')} />`

Cần loại field mới ⇒ thêm component cùng chuẩn vào `components/form/`, không lắp thủ công tại chỗ.

### FM-008 [MUST] Field component giữ contract props ổn định, không phụ thuộc thư viện UI

Component nhận `{...register(...)}` và props trung lập. Khi thay markup bằng thư viện UI, **contract props không đổi** ⇒ call-site không phải sửa. → `15-ui-and-accessibility.md`

## 10.3 Submit

### FM-009 [MUST] Submit gọi mutation, không gọi thẳng hàm API

✅ `const { mutate, isPending } = useCreateProduct();`
Mutation lo invalidate cache (`ST-007`) và đi qua đường xử lý lỗi chung (`12`).

### FM-010 [MUST] Không để promise trôi nổi ở `onSubmit`

✅ `<form noValidate onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>`

### FM-011 [MUST] Hiển thị đủ trạng thái gửi

`isPending` → khóa nút + chỉ báo; `isError` → thông báo đọc được (qua `isApiError`); thành công → `reset()` hoặc điều hướng.

### FM-012 [SHOULD] Lỗi cấp field từ server phải map về đúng field

Backend trả lỗi theo field → `setError('fieldName', …)`, không đổ tất cả vào một dòng lỗi chung.

### FM-013 [SHOULD] Màn hình chứa form nên nằm ở chunk lazy

react-hook-form chỉ cần khi người dùng vào trang có form ⇒ để route đó `lazy` (`RT-008`), không kéo vào bundle khởi động.
