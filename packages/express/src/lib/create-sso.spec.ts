import type { Router } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJumpCloudSSO } from './create-sso.js';

/**
 * The paths express-openid-connect's `auth()` middleware registers — it is an
 * Express router underneath. The callback path here is exactly the path
 * appended to `baseURL` to form the `redirect_uri`, so asserting it needs no
 * network round trip to the issuer.
 */
function middlewarePaths(authMiddleware: unknown): string[] {
  const stack = (authMiddleware as Router).stack;
  return stack.filter((layer) => layer.route).map((l) => String(l.route?.path));
}

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

  describe('sessionSecret strength', () => {
    // req.oidc.isAuthenticated() is answered entirely from the encrypted
    // session cookie, with no call back to JumpCloud. Recover this secret and
    // you can mint a cookie naming any user in any group; requireAuth and
    // requireGroup both honor it. express-openid-connect's own floor is 8
    // characters, which is not a floor at all.
    it('rejects the 8-character secret express-openid-connect would accept', () => {
      expect(() =>
        createJumpCloudSSO({ ...validOptions, sessionSecret: 'hunter22' }),
      ).toThrowError(/at least 32 are required/);
    });

    it('rejects a padded-out placeholder', () => {
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          sessionSecret: 'changeme-changeme-changeme-changeme',
        }),
      ).toThrowError(/placeholder/);
    });

    it('rejects a long but repetitive value', () => {
      expect(() =>
        createJumpCloudSSO({ ...validOptions, sessionSecret: 'a'.repeat(64) }),
      ).toThrowError(/distinct characters/);
    });

    it('says it is not the JumpCloud client secret, the classic mix-up', () => {
      expect(() =>
        createJumpCloudSSO({ ...validOptions, sessionSecret: 'short' }),
      ).toThrowError(/not the JumpCloud client secret/);
    });
  });

  describe('plain-HTTP baseUrl in production', () => {
    // express-openid-connect derives the cookie's Secure attribute from the
    // baseURL scheme, and FORBIDS Secure on a non-https origin. So an http://
    // production baseUrl guarantees the cookie holding the ID, access, and
    // refresh tokens travels in cleartext. The loopback check above does not
    // catch a deliberately-configured internal hostname.
    it('rejects a non-loopback http:// URL', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          baseUrl: 'http://roadmap.internal.corp',
        }),
      ).toThrowError(/plain\s+HTTP/);
    });

    it('allows it behind an explicit opt-out', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          baseUrl: 'http://roadmap.internal.corp',
          allowInsecureBaseUrl: true,
        }),
      ).not.toThrow();
    });

    it('allows plain HTTP outside production', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          baseUrl: 'http://roadmap.internal.corp',
        }),
      ).not.toThrow();
    });

    it('still reports the loopback problem first, since it is the likelier cause', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() => createJumpCloudSSO(validOptions)).toThrowError(
        /cannot be reached in production/,
      );
    });
  });

  describe('callbackPath', () => {
    it('defaults to /callback', () => {
      const sso = createJumpCloudSSO(validOptions);
      expect(middlewarePaths(sso.authMiddleware)).toContain('/callback');
    });

    it('moves the callback route when overridden, so redirect_uri matches the registered URI', () => {
      const sso = createJumpCloudSSO({
        ...validOptions,
        callbackPath: '/callback/jumpcloud',
      });
      const paths = middlewarePaths(sso.authMiddleware);
      expect(paths).toContain('/callback/jumpcloud');
      expect(paths).not.toContain('/callback');
    });

    it('rejects a path without a leading slash, which would produce baseUrlcallback', () => {
      expect(() =>
        createJumpCloudSSO({ ...validOptions, callbackPath: 'callback' }),
      ).toThrowError(/must start with "\/"/);
    });
  });

  describe('logout', () => {
    // JumpCloud rejects RP-initiated logout unless post_logout_redirect_uri is
    // whitelisted on the application, so this has to be switchable.
    it.each([true, false, undefined])('accepts idpLogout: %s', (idpLogout) => {
      const sso = createJumpCloudSSO({ ...validOptions, idpLogout });
      expect(middlewarePaths(sso.authMiddleware)).toContain('/logout');
    });

    it('accepts a custom postLogoutRedirect', () => {
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          postLogoutRedirect: 'http://localhost:3000/goodbye',
        }),
      ).not.toThrow();
    });
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

    // The message tells the reader which URI to register; naming the default
    // path when the caller overrode it sends them to register the wrong one.
    it('names the configured callbackPath, not the default', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createJumpCloudSSO({
          ...validOptions,
          baseUrl: 'http://localhost:3000',
          callbackPath: '/api/auth/callback/jumpcloud',
        }),
      ).toThrowError('${BASE_URL}/api/auth/callback/jumpcloud');
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
