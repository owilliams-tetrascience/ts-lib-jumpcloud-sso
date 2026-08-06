import { describe, expect, it } from 'vitest';
import { createJumpCloudSSO } from './create-sso.js';

const validOptions = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'a-long-random-cookie-secret-string-1234567890',
};

describe('createJumpCloudSSO', () => {
  it('returns the four building blocks (exercises real express-openid-connect config validation)', () => {
    const sso = createJumpCloudSSO(validOptions);
    expect(typeof sso.authMiddleware).toBe('function');
    expect(typeof sso.requireAuth).toBe('function');
    expect(typeof sso.requireGroup).toBe('function');
    expect(typeof sso.requireGroup(['app-admins'])).toBe('function');
    expect(typeof sso.meHandler).toBe('function');
  });

  it('throws a helpful error when baseUrl is missing', () => {
    expect(() =>
      createJumpCloudSSO({ ...validOptions, baseUrl: '' }),
    ).toThrowError(/baseUrl/);
  });

  it('throws a helpful error when sessionSecret is missing', () => {
    expect(() =>
      createJumpCloudSSO({ ...validOptions, sessionSecret: '' }),
    ).toThrowError(/sessionSecret/);
  });
});
