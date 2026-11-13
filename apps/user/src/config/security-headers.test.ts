import { expect, test } from 'vitest';

import { buildContentSecurityPolicy, buildSecurityHeaders } from '~/config/security-headers';

test('CSP has the hardening directives and uses NO nonce (PPR-safe)', () => {
  const csp = buildContentSecurityPolicy(false);
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  // ⭐ Không nonce → giữ static shell/PPR (nonce ép dynamic — docs Next).
  expect(csp).not.toContain('nonce');
});

test('CSP connect-src is self-only (BFF: browser never calls the backend directly)', () => {
  expect(buildContentSecurityPolicy(false)).toContain("connect-src 'self'");
});

test('prod CSP omits unsafe-eval/ws; dev adds them (React debug + HMR)', () => {
  const prod = buildContentSecurityPolicy(false);
  expect(prod).not.toContain('unsafe-eval');
  expect(prod).not.toContain('ws:');

  const dev = buildContentSecurityPolicy(true);
  expect(dev).toContain("'unsafe-eval'");
  expect(dev).toContain('ws:');
});

test('security headers include CSP + HSTS + nosniff + Referrer + frame-options + permissions', () => {
  const keys = buildSecurityHeaders(false).map((header) => header.key);
  expect(keys).toEqual(
    expect.arrayContaining([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'X-Frame-Options',
      'Permissions-Policy',
    ]),
  );
});
