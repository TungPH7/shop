# 08 — Data Access & Validation (BFF · Zod)

## 8.1 Kiến trúc BFF — `[MUST]`

```
Client ──► RSC / Server Action / Route Handler ──► DAL (features/<x>/server) ──► lib/http ──► Backend
                                                    server-only, giữ token
```

- **[MUST]** Trình duyệt không gọi backend trực tiếp (→ §05).
- **[MUST]** Mọi truy cập backend đi qua **DAL** đặt tại `features/<x>/server/*.ts`, mở đầu bằng `import 'server-only'`.
- **[MUST]** Secret / token / `process.env` chỉ đọc trong tầng server, không bao giờ trong component client.

## 8.2 HTTP client — `[MUST]`

Tất cả request ra ngoài đi qua `~/lib/http/client.ts`:

- Dùng **native `fetch`** (không axios) — hợp với `'use cache'`, 0 dependency.
- Base URL từ `env.API_URL` (biến **server**).
- **Validate response bằng Zod ngay tại đây**, lỗi chuẩn hoá thành `ApiError` với 3 loại: `network` / `http` / `validation` (→ §13).
- Token: đọc session **ngoài** scope cache rồi truyền qua `init.headers` — ❌ không gọi `cookies()` bên trong `'use cache'`.

```ts
// ✅ DAL gọi http client, nhận về dữ liệu ĐÃ validate
export async function getProducts(query: ProductQuery): Promise<Product[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('products');
  return httpGet('/products', productListSchema, { query });
}
```

## 8.3 "Parse, don't validate" ở 5 biên — `[MUST]`

Mọi dữ liệu lạ vào hệ thống phải qua Zod:

| #   | Biên                    | Nơi đặt schema                      | Kiểu schema                             |
| --- | ----------------------- | ----------------------------------- | --------------------------------------- |
| 1   | **Env**                 | `src/config/env/{client,server}.ts` | Chặt, fail-fast lúc boot                |
| 2   | **Response backend**    | `features/<x>/model/*.ts`           | Chặt — DTO tối thiểu                    |
| 3   | **Input Server Action** | `features/<x>/model/*.ts`           | Chặt — hiện lỗi cho user                |
| 4   | **searchParams (URL)**  | `features/<x>/model/*-query.ts`     | **Tha thứ** — `.catch()` / `.default()` |
| 5   | **Form**                | `features/<x>/model/*-form.ts`      | Chặt — dùng chung client + server       |

- **[MUST]** Dùng `safeParse` khi cần rẽ nhánh lỗi; `parse` chỉ khi lỗi = bug thật sự đáng ném.
- **[MUST]** Không nuốt lỗi. Lỗi dự kiến → trả state/sanitize; lỗi thật → ném cho error boundary (→ §13).

## 8.4 DTO tối thiểu — `[MUST]`

Schema chỉ khai **field UI thật sự cần**. Zod sẽ tự loại field còn lại.

```ts
// ✅ backend trả 20 field; ta chỉ nhận 4
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  basePrice: z.number(),
  images: z.array(z.string()),
});
```

Hai lợi ích: (1) field nội bộ của backend (`createdById`, `deletedById`, timestamps…) **không lọt vào render context** — đây là rào bảo mật dữ liệu; (2) khi backend đổi shape, Zod **bắt drift ngay** thay vì hỏng âm thầm.

## 8.5 searchParams — schema THA THỨ — `[MUST]`

URL là input người dùng: gõ sai không được làm sập trang.

```ts
// ✅ sanitize về mặc định an toàn
export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  view: z.enum(['grid', 'list']).catch('grid'),
});
```

Helper chuẩn hoá `string | string[] | undefined` nằm ở `~/lib/validation/parse-search-params.ts` (thuần, dùng được 2 phía).

Khác với **form**: form muốn _hiện_ lỗi → schema chặt.

## 8.6 Lỗi validation dùng CODE, không dùng câu chữ — `[MUST]`

Tầng schema **không** dính i18n. Schema phát mã ổn định; UI mới dịch.

```ts
// ✅ Zod 4 dùng { error }, không { message }
z.string().min(8, { error: 'too_short' });
```

- `~/lib/validation/format-zod-error.ts` → `getFieldErrorCodes(error)` trả `{ field: code }`.
- UI map `t('Validation.<code>')` (→ §11).
- Mã dùng chung với `reason` code của Server Action (→ §09).

## 8.7 Zod 4 — cú pháp đúng — `[MUST]`

| ✅ Zod 4                                  | ❌ Cũ / sai                |
| ----------------------------------------- | -------------------------- |
| `z.url()`, `z.email()`                    | `z.string().url()`         |
| `{ error: 'too_short' }`                  | `{ message: 'too_short' }` |
| `z.flattenError(e)` / `z.treeifyError(e)` | `e.flatten()` (deprecated) |
| `z.coerce.number()` cho searchParams      | `Number(param)` thủ công   |
| `z.infer<typeof schema>`                  | Khai type song song        |

## 8.8 Vị trí schema — `[MUST]`

| Loại                              | Nơi đặt                             |
| --------------------------------- | ----------------------------------- |
| Schema của một feature            | `features/<x>/model/*.ts`           |
| Helper validate dùng chung, thuần | `~/lib/validation/`                 |
| Schema env                        | `src/config/env/{client,server}.ts` |

❌ **Không** đặt schema trong file `"use server"` (file đó chỉ được export hàm async).

## 8.9 Chia sẻ schema client ↔ server — `[MUST]`

Một schema dùng cả hai phía: client validate để **UX** (hiện lỗi tức thì), server validate để **chốt** (client bỏ qua được). Đây là defense-in-depth, không phải trùng lặp — **không được bỏ bên nào**.

## 8.10 Cache ở DAL — `[SHOULD]`

Hàm DAL đọc dữ liệu ít đổi → `'use cache'` + `cacheLife` + `cacheTag` (→ §07). Lưu ý: prerender sẽ **fetch backend lúc build**, nên build phụ thuộc backend còn sống. Với dữ liệu phụ thuộc `searchParams`, phần đó thành dynamic hole — đúng thiết kế.
