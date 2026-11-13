# 09 — Mutations: Server Actions & Forms

## 9.1 `'use server'` = endpoint POST CÔNG KHAI — `[MUST]` hiểu

Mỗi Server Action là một endpoint mà **bất kỳ ai cũng gọi được**, kể cả khi bạn đã ẩn nút trên UI. Vì vậy action phải tự bảo vệ mình.

- **[MUST]** File `"use server"` **chỉ export hàm async**. Schema/type đặt ở `model/` (→ §08).
- **[MUST]** Đặt tại `features/<x>/actions/` — **tách** khỏi `features/<x>/server/` (`server-only`, không bao giờ ra client).

## 9.2 Bốn bước bắt buộc trong mọi action — `[MUST]`

```ts
'use server';

export async function deleteProductAction(_prevState: State, formData: FormData): Promise<State> {
  // 1. VALIDATE input bằng Zod (client bỏ qua được → server phải làm lại)
  const parsed = deleteProductSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { status: 'error', reason: 'invalid_input' };

  // 2. RE-AUTHORIZE ở server (nút ẩn KHÔNG phải bảo mật)
  const user = await getCurrentUser();
  if (!user) return { status: 'error', reason: 'unauthorized' };

  // 3. DELEGATE cho DAL (server-only)
  const result = await deleteProduct(parsed.data.id);
  if (isErr(result)) return { status: 'error', reason: 'delete_failed' };

  // 4. INVALIDATE cache
  updateTag('products');
  return { status: 'success' };
}
```

- **[MUST]** Action **mỏng** — không chứa logic nghiệp vụ, không gọi backend trực tiếp.
- **[MUST]** `getCurrentUser` (`~/lib/auth/get-current-user`) là **điểm duy nhất** hỏi danh tính trong action.
- **[MUST]** Dùng `updateTag` (1 tham số) sau mutation, không `revalidateTag` (→ §07).

## 9.3 Lỗi: trả state, đừng `throw` — `[MUST]`

| Loại lỗi                                           | Cách xử lý                                    |
| -------------------------------------------------- | --------------------------------------------- |
| **Dự kiến** (sai mật khẩu, thiếu quyền, input sai) | `return` state có `reason` code → UI hiển thị |
| **Thật / bất ngờ** (5xx, network, bug)             | Để nó ném → error boundary bắt (→ §13)        |

- **[MUST]** `redirect(...)` đặt **ngoài** `try/catch` — redirect hoạt động bằng cách ném exception, `catch` sẽ nuốt mất nó.
- **[MUST]** `reason` là **code** ổn định (`credentials`, `invalid_input`), không phải câu chữ đã dịch.
- **[SHOULD]** Lỗi đăng nhập trả `credentials` chung, ❌ không nói rõ "sai email" hay "sai mật khẩu" — chống account enumeration.

## 9.4 Chọn kiểu form — `[MUST]`

| Loại form                                         | Dùng                                              | Vì sao                                            |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Đơn giản (login, xoá, toggle)                     | `<form action={serverAction}>` + `useActionState` | Progressive enhancement — chạy cả khi JS chưa tải |
| Phức tạp (prefill, validate tức thì, cross-field) | **react-hook-form + zodResolver**                 | UX tốt hơn; đánh đổi: cần JS                      |

## 9.5 Form đơn giản — `useActionState` — `[MUST]`

```tsx
'use client';
const [state, formAction, isPending] = useActionState(loginAction, initialState);
return <form action={formAction}>…</form>;
```

- Trạng thái pending: `isPending`, hoặc `useFormStatus` trong component **con** nằm trong `<form>`.
- **[MUST]** `<form action={serverAction}>` là request-time → **phải nằm trong `<Suspense>`** dưới `cacheComponents`. ⚠️ Chỉ `next dev` bắt lỗi này → **bắt buộc verify bằng `pnpm dev`** (→ §07).

## 9.6 Form phức tạp — RHF + zodResolver — `[MUST]`

**Một schema, hai phía:**

```tsx
// CLIENT — validate để UX
const form = useForm({ resolver: zodResolver(profileSchema), defaultValues });
const submitHandler = form.handleSubmit(async (values) => {
  await updateProfileAction(values);
});

// ⚠️ bọc void: gắn thẳng Promise vào onSubmit sẽ dính ESLint no-misused-promises
<form onSubmit={(e) => void submitHandler(e)}>…</form>;
```

```ts
// SERVER — cùng schema, RE-VALIDATE (đây mới là chốt)
const parsed = profileSchema.safeParse(input as unknown);
```

- **[MUST]** Không dùng `<form action={serverAction}>` với RHF — gọi action như RPC trong `handleSubmit`.
- **[MUST]** Validate liên-trường (vd `newPassword === confirmNewPassword`) bằng `superRefine`:
  ```ts
  .superRefine((d, ctx) => {
    if (d.newPassword !== d.confirmNewPassword)
      ctx.addIssue({ code: 'custom', path: ['confirmNewPassword'], message: 'password_mismatch' });
  })
  ```
- State của action loại này **không có `idle`** — luôn trả `success` hoặc `error` (thêm `idle` sẽ phá narrowing).

## 9.7 i18n cho lỗi form — `[MUST]`

next-intl chặn key động (`t(code)` với `code: string` sẽ lỗi type). Cách đúng:

```tsx
// ✅ SERVER (panel) build sẵn map với key TĨNH
const errorMessages = {
  too_short: t('Validation.too_short'),
  password_mismatch: t('Validation.password_mismatch'),
};
// ✅ CLIENT chỉ TRA MAP
<span>{errorMessages[code] ?? code}</span>;

// ❌ t(code) — TS2345
```

## 9.8 Sau mutation — `[MUST]`

| Tình huống                                              | Làm gì                                      |
| ------------------------------------------------------- | ------------------------------------------- |
| Dữ liệu cache bằng `'use cache'` đổi                    | `updateTag('<tag>')` trong action           |
| Dữ liệu hiển thị đổi, nguồn là `cache()` request-scoped | `router.refresh()` (từ `~/i18n/navigation`) |
| Không có dữ liệu hiển thị nào đổi (vd đổi mật khẩu)     | `form.reset()`                              |

## 9.9 Anatomy một mutation hoàn chỉnh — `[SHOULD]`

```
model/      schema dùng chung (client + server) + type state
server/     DAL: httpPut/httpDelete + authHeaders (server-only)
actions/    'use server': validate → re-authz → delegate → updateTag
components/ *-form.tsx   (client: RHF hoặc useActionState)
            *-panel.tsx  (server: guard requireUser + map i18n + prefill)
app/…/page  mỏng — mỗi panel bọc một <Suspense>
```
