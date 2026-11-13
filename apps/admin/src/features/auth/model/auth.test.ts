import { describe, expect, it } from 'vitest';

import { httpMethodSchema, loginCredentialsSchema, permissionSchema, userSchema } from './auth';

describe('auth model schemas', () => {
  it('loginCredentialsSchema validates email + non-empty password', () => {
    expect(loginCredentialsSchema.safeParse({ email: 'a@b.com', password: 'pw' }).success).toBe(
      true,
    );
    expect(
      loginCredentialsSchema.safeParse({ email: 'not-an-email', password: 'pw' }).success,
    ).toBe(false);
    expect(loginCredentialsSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(
      false,
    );
  });

  it('httpMethodSchema only accepts known verbs', () => {
    expect(httpMethodSchema.safeParse('GET').success).toBe(true);
    expect(httpMethodSchema.safeParse('FETCH').success).toBe(false);
  });

  it('permissionSchema requires a numeric id', () => {
    const base = { name: 'p', path: '/x', method: 'GET', module: 'm' };
    expect(permissionSchema.safeParse({ id: 1, ...base }).success).toBe(true);
    expect(permissionSchema.safeParse({ id: '1', ...base }).success).toBe(false);
  });

  it('userSchema validates the nested role + permissions', () => {
    const user = {
      id: 1,
      email: 'a@b.com',
      name: 'Tester',
      role: {
        id: 1,
        name: 'admin',
        permissions: [{ id: 1, name: 'p', path: '/x', method: 'GET', module: 'm' }],
      },
    };
    expect(userSchema.safeParse(user).success).toBe(true);
    expect(userSchema.safeParse({ ...user, role: undefined }).success).toBe(false);
  });
});
