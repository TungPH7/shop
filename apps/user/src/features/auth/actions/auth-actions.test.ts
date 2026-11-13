// @vitest-environment node
// Test ORCHESTRATION của Server Action (directive 'use server' vô hiệu ngoài Next bundler): validate
// → DAL → session → redirect. Mock các seam (login/logout DAL, session, redirect, getLocale); giữ
// isApiError + getFieldErrorCodes THẬT (pure). Chạy `node` vì chuỗi import đụng module server.
import { expect, test, vi } from 'vitest';

import { loginAction, logoutAction } from '~/features/auth/actions/auth-actions';
import { initialLoginState } from '~/features/auth/model/auth';
import { login } from '~/features/auth/server/login';
import { logout } from '~/features/auth/server/logout';
import { createSession, deleteSession, getSession } from '~/lib/auth/session';
import { ApiError } from '~/lib/http/api-error';
import { redirect } from '~/i18n/navigation';

vi.mock('~/features/auth/server/login', () => ({ login: vi.fn() }));
vi.mock('~/features/auth/server/logout', () => ({ logout: vi.fn() }));
vi.mock('~/lib/auth/session', () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('~/i18n/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next-intl/server', () => ({ getLocale: vi.fn().mockResolvedValue('en') }));

const mockedLogin = vi.mocked(login);
const mockedLogout = vi.mocked(logout);
const mockedCreate = vi.mocked(createSession);
const mockedDelete = vi.mocked(deleteSession);
const mockedGetSession = vi.mocked(getSession);
const mockedRedirect = vi.mocked(redirect);

const TOKENS = { accessToken: 'a', refreshToken: 'r' };
function fd(email: string | null, password: string | null): FormData {
  const f = new FormData();
  if (email !== null) f.set('email', email);
  if (password !== null) f.set('password', password);
  return f;
}

test('input sai (email rỗng) → validation + fieldErrors; KHÔNG gọi backend', async () => {
  const state = await loginAction(initialLoginState, fd('', 'secret'));
  expect(state).toEqual({
    status: 'error',
    reason: 'validation',
    fieldErrors: { email: 'invalid_email' },
  });
  expect(mockedLogin).not.toHaveBeenCalled();
});

test('sai mật khẩu (backend 401) → credentials; KHÔNG tạo phiên', async () => {
  mockedLogin.mockRejectedValue(new ApiError({ kind: 'http', status: 401, message: 'x' }));
  const state = await loginAction(initialLoginState, fd('a@b.com', 'wrong'));
  expect(state).toEqual({ status: 'error', reason: 'credentials' });
  expect(mockedCreate).not.toHaveBeenCalled();
});

test('rate-limit (429) → rateLimited (KHÔNG nuốt thành credentials)', async () => {
  mockedLogin.mockRejectedValue(new ApiError({ kind: 'http', status: 429, message: 'x' }));
  const state = await loginAction(initialLoginState, fd('a@b.com', 'secret'));
  expect(state).toEqual({ status: 'error', reason: 'rateLimited' });
});

test('đăng nhập OK → createSession(tokens) + redirect("/")', async () => {
  mockedLogin.mockResolvedValue(TOKENS);
  await loginAction(initialLoginState, fd('a@b.com', 'secret'));
  expect(mockedCreate).toHaveBeenCalledWith(TOKENS);
  expect(mockedRedirect).toHaveBeenCalledWith({ href: '/', locale: 'en' });
});

test('logout có phiên → thu hồi backend + xoá cookie + redirect', async () => {
  mockedGetSession.mockResolvedValue(TOKENS);
  mockedLogout.mockResolvedValue({ message: 'ok' });
  await logoutAction();
  expect(mockedLogout).toHaveBeenCalledWith(TOKENS);
  expect(mockedDelete).toHaveBeenCalled();
  expect(mockedRedirect).toHaveBeenCalledWith({ href: '/', locale: 'en' });
});

test('logout best-effort: backend lỗi vẫn xoá cookie', async () => {
  mockedGetSession.mockResolvedValue(TOKENS);
  mockedLogout.mockRejectedValue(new ApiError({ kind: 'http', status: 401, message: 'x' }));
  await logoutAction();
  expect(mockedDelete).toHaveBeenCalled();
});

test('logout không phiên → KHÔNG gọi backend, vẫn xoá cookie', async () => {
  mockedGetSession.mockResolvedValue(null);
  await logoutAction();
  expect(mockedLogout).not.toHaveBeenCalled();
  expect(mockedDelete).toHaveBeenCalled();
});
