import { z } from 'zod';

// Auth + RBAC models. Zod is the single source of truth (validated at the API
// boundary); the rest of the app depends on THESE types, not the transport. The
// shapes mirror the current backend contract but are isolated here — swapping
// backends means editing this file + the api calls, nothing downstream.

export const httpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);
export type HttpMethod = z.infer<typeof httpMethodSchema>;

// A permission grants one API operation. RBAC checks it two ways: by module
// (route-level guard) or by method+path (element-level guard). Permissions come
// from the backend — never hardcoded on the frontend.
export const permissionSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  method: httpMethodSchema,
  module: z.string(),
});
export type Permission = z.infer<typeof permissionSchema>;

export const roleSchema = z.object({
  id: z.number(),
  name: z.string(),
  permissions: z.array(permissionSchema),
});
export type Role = z.infer<typeof roleSchema>;

// The authenticated user (from GET /profile). `role.permissions` drives RBAC.
export const userSchema = z.object({
  id: z.number(),
  email: z.email(),
  name: z.string(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const loginCredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
