// @vitest-environment node
import { EncryptJWT } from 'jose';
import { expect, test } from 'vitest';

import { openSession, sealSession, type SessionTokens } from '~/lib/auth/session-seal';

const TOKENS: SessionTokens = {
  accessToken: 'access.jwt.value',
  refreshToken: 'refresh.jwt.value',
};
// Phải KHỚP AUTH_SECRET trong vitest.config → tự dẫn khoá GIỐNG HỆT để dựng JWE "độc hại".
const TEST_SECRET = 'test-secret-at-least-32-characters-long';

async function keyFrom(secret: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
}
const nowSec = (): number => Math.floor(Date.now() / 1000);

test('seal → open: khứ hồi trả lại ĐÚNG cặp token', async () => {
  const sealed = await sealSession(TOKENS);
  expect(sealed).not.toContain('access.jwt.value'); // ⭐ payload đã MÃ HOÁ → không lộ token
  await expect(openSession(sealed)).resolves.toEqual(TOKENS);
});

test('open(undefined) → null (không có cookie)', async () => {
  await expect(openSession(undefined)).resolves.toBeNull();
});

test('open(rác) → null', async () => {
  await expect(openSession('not-a-jwe')).resolves.toBeNull();
});

test('open(bị sửa) → null (A256GCM phát hiện giả mạo)', async () => {
  const sealed = await sealSession(TOKENS);
  // JWE compact (dir) = header.''.iv.ciphertext.tag → đổi ký tự đầu của CIPHERTEXT (đổi byte
  // thật) → tag GCM không khớp → giải mã thất bại. (Đổi ký tự CUỐI tag không chắc đổi byte vì
  // base64url có bit thừa.)
  const parts = sealed.split('.');
  const ciphertext = parts[3] ?? '';
  parts[3] = `${ciphertext.startsWith('A') ? 'B' : 'A'}${ciphertext.slice(1)}`;
  await expect(openSession(parts.join('.'))).resolves.toBeNull();
});

test('open(sai khoá) → null (mã hoá bằng secret KHÁC)', async () => {
  const foreign = await new EncryptJWT({ ...TOKENS })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setExpirationTime(nowSec() + 3600)
    .encrypt(await keyFrom('a-totally-different-secret-32-characters'));
  await expect(openSession(foreign)).resolves.toBeNull();
});

test('open(hết hạn) → null', async () => {
  const expired = await new EncryptJWT({ ...TOKENS })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setExpirationTime(nowSec() - 3600) // đã hết hạn 1 giờ trước
    .encrypt(await keyFrom(TEST_SECRET));
  await expect(openSession(expired)).resolves.toBeNull();
});
