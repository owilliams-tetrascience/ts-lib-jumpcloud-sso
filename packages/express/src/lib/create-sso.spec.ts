import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJumpCloudSSO } from './create-sso.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  describe('loopback baseUrl in production', () => {
    // Apps default baseUrl to localhost, so the missing-baseUrl check above
    // never fires when BASE_URL is simply unset on a deployment.
    it.each([
      'http://localhost:3000',
      'http://localhost',
      'http://127.0.0.1:8080',
      'https://[::1]:3000',
      'http://LOCALHOST:3000/',
    ])('rejects %s', (baseUrl) => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createJumpCloudSSO({ ...validOptions, baseUrl }),
      ).toThrowError(/cannot be reached in production/);
    });

    it('allows a real public URL', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          baseUrl: 'https://roadmap.tetrascience.com',
        }),
      ).not.toThrow();
    });

    it('allows localhost outside production', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(() => createJumpCloudSSO(validOptions)).not.toThrow();
    });

    it('does not reject hostnames that merely start with localhost', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          baseUrl: 'https://localhost.tetrascience.com',
        }),
      ).not.toThrow();
    });
  });
});
