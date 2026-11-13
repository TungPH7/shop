import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { type ZodType } from 'zod';

import { ApiError, normalizeError } from '@/lib/api/api-error';
import { getApiAuth } from '@/lib/api/auth-bridge';
import { getRetryDelayMs, isRetryableError, MAX_RETRIES } from '@/lib/api/retry';

// We stash per-request state on the Axios config so interceptors can track how
// many times a request has been retried and whether a refresh was already tried.
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _refreshed?: boolean;
}

export interface ApiClientOptions {
  baseURL: string;
  timeoutMs?: number;
  /** Send cookies (httpOnly auth) on cross-site requests. */
  withCredentials?: boolean;
}

export interface RequestOptions<T> extends AxiosRequestConfig {
  /**
   * Optional Zod schema. When provided, the response body is validated at the
   * boundary and the typed value is returned; a mismatch throws an
   * `ApiError(kind: 'validation')`. Omit it only when you accept an unchecked
   * cast to `T`.
   */
  schema?: ZodType<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWithSchema<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError({
      kind: 'validation',
      message: 'Response did not match the expected schema',
      details: result.error.issues,
      cause: result.error,
    });
  }
  return result.data;
}

/**
 * Factory for a configured Axios client with interceptors. Kept separate from
 * the app singleton (`api.ts`) so it can be instantiated with any base URL —
 * notably in tests, which point it at a local mock server.
 */
export function createApiClient(options: ApiClientOptions) {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeoutMs ?? 15_000,
    withCredentials: options.withCredentials ?? true,
    headers: { Accept: 'application/json' },
  });

  // Single-flight refresh: when many requests get 401 at once, refresh only
  // once and let them all await the same promise.
  let refreshPromise: Promise<void> | null = null;
  function refreshOnce(): Promise<void> {
    refreshPromise ??= getApiAuth()
      .refreshTokens()
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  }

  // --- Request interceptor: attach bearer token from the injected auth bridge.
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getApiAuth().getAccessToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  // --- Response error interceptor: transient retry → 401 refresh → normalize.
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryableConfig | undefined;

      // 1) Transient failure (network/timeout/5xx/429) on an idempotent method.
      if (config && isRetryableError(error, config.method)) {
        const attempt = config._retryCount ?? 0;
        if (attempt < MAX_RETRIES) {
          config._retryCount = attempt + 1;
          const rawRetryAfter: unknown = error.response?.headers['retry-after'];
          const retryAfter = typeof rawRetryAfter === 'string' ? rawRetryAfter : null;
          await sleep(getRetryDelayMs(attempt, retryAfter));
          return instance(config);
        }
      }

      // 2) Expired session: refresh once (single-flight), then retry the request
      //    a single time. Only attempt this if we were actually authenticated.
      if (
        config &&
        error.response?.status === 401 &&
        !config._refreshed &&
        getApiAuth().getAccessToken() !== null
      ) {
        config._refreshed = true;
        try {
          await refreshOnce();
          return instance(config);
        } catch {
          getApiAuth().onUnauthorized();
          return Promise.reject(normalizeError(error));
        }
      }

      // 3) Give up — hand back a single, normalized error shape.
      return Promise.reject(normalizeError(error));
    },
  );

  async function request<T>(config: RequestOptions<T>): Promise<T> {
    const { schema, ...axiosConfig } = config;
    const response = await instance.request<unknown>(axiosConfig);
    return schema ? parseWithSchema(schema, response.data) : (response.data as T);
  }

  return {
    /** The underlying Axios instance — escape hatch for advanced cases. */
    instance,
    request,
    get<T>(url: string, options?: RequestOptions<T>): Promise<T> {
      return request<T>({ ...options, method: 'get', url });
    },
    post<T>(url: string, data?: unknown, options?: RequestOptions<T>): Promise<T> {
      return request<T>({ ...options, method: 'post', url, data });
    },
    put<T>(url: string, data?: unknown, options?: RequestOptions<T>): Promise<T> {
      return request<T>({ ...options, method: 'put', url, data });
    },
    patch<T>(url: string, data?: unknown, options?: RequestOptions<T>): Promise<T> {
      return request<T>({ ...options, method: 'patch', url, data });
    },
    delete<T>(url: string, options?: RequestOptions<T>): Promise<T> {
      return request<T>({ ...options, method: 'delete', url });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
