import 'server-only';

import { type ZodType } from 'zod';

import { env } from '~/config/env/server';
import { ApiError } from '~/lib/http/api-error';

/**
 * HTTP client của DAL — **native `fetch`** (server-first: hợp `use cache`, được Next bổ trợ;
 * KHÔNG axios như guide React SPA → 0 dependency).
 *
 * ⭐ `import 'server-only'`: build LỖI nếu module này lọt vào client bundle. Đúng đắn vì transport
 * gọi backend bằng `env.API_URL` (biến **SERVER**) — không bao giờ được ship xuống browser. (Vitest
 * stub `server-only` qua alias để test được — xem `vitest.config.ts`.)
 *
 * Validate Zod NGAY ở biên → trả kiểu đã kiểm chứng, hoặc ném `ApiError` chuẩn hoá
 * (network / http / validation).
 *
 * Auth seam (folder 15): caller đọc token httpOnly NGOÀI scope `use cache` rồi truyền qua
 * `init.headers` (vd `Authorization: Bearer …`) — KHÔNG gọi `cookies()` trong `use cache`
 * (luật cô lập folder 10). Mọi verb dưới đây đều forward `init.headers`.
 */
async function request<T>(
  method: string,
  path: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.API_URL}${path}`, {
      ...init,
      method,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch (cause) {
    throw new ApiError({
      kind: 'network',
      message: 'Network error — could not reach the server',
      cause,
    });
  }

  if (!response.ok) {
    throw new ApiError({
      kind: 'http',
      status: response.status,
      message: `Request failed with status ${response.status}`,
    });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new ApiError({ kind: 'validation', message: 'Response was not valid JSON', cause });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'validation',
      message: 'Response did not match the expected schema',
      details: parsed.error.issues,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/** GET + validate ở biên (folder 11). */
export function httpGet<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  return request('GET', path, schema, init);
}

/**
 * POST + validate response ở biên (folder 15: login/logout). Caller tự set `Content-Type` +
 * `body` (JSON) qua `init`; thêm `Authorization` qua `init.headers` khi endpoint cần token.
 */
export function httpPost<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  return request('POST', path, schema, init);
}

/** PUT + validate response ở biên (folder 16: cập nhật hồ sơ). Như `httpPost` về header/body. */
export function httpPut<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  return request('PUT', path, schema, init);
}

/**
 * DELETE + validate response ở biên (folder 12). Mutation THẬT đi qua đây từ DAL `server-only`,
 * được gọi bởi Server Action (sau khi action đã validate input + re-authorize).
 */
export function httpDelete<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  return request('DELETE', path, schema, init);
}
