import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { createSSORouter } from './router.js';

const validOptions = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'a-long-random-cookie-secret-string-1234567890',
};

/** Route paths registered directly on an Express 5 router. */
function registeredPaths(router: Router): string[] {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => String(layer.route?.path));
}

describe('createSSORouter', () => {
  it('returns a mountable router plus all the createJumpCloudSSO pieces', () => {
    const sso = createSSORouter(validOptions);
    expect(typeof sso.router).toBe('function'); // Express routers are callable
    expect(typeof sso.authMiddleware).toBe('function');
    expect(typeof sso.requireAuth).toBe('function');
    expect(typeof sso.requireGroup).toBe('function');
    expect(typeof sso.meHandler).toBe('function');
  });

  it('mounts /api/me by default', () => {
    const sso = createSSORouter(validOptions);
    expect(registeredPaths(sso.router)).toContain('/api/me');
  });

  it('honors a custom mePath', () => {
    const sso = createSSORouter({ ...validOptions, mePath: '/api/whoami' });
    const paths = registeredPaths(sso.router);
    expect(paths).toContain('/api/whoami');
    expect(paths).not.toContain('/api/me');
  });

  it('skips the identity route when mePath is false', () => {
    const sso = createSSORouter({ ...validOptions, mePath: false });
    expect(registeredPaths(sso.router)).toHaveLength(0);
    // The handler is still available for manual mounting.
    expect(typeof sso.meHandler).toBe('function');
  });

  it('propagates createJumpCloudSSO validation errors', () => {
    expect(() =>
      createSSORouter({ ...validOptions, sessionSecret: '' }),
    ).toThrowError(/sessionSecret/);
  });
});
