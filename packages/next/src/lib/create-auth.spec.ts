import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextAuthConfig } from 'next-auth';
import type { OIDCConfig } from 'next-auth/providers';

// Capture the config handed to NextAuth() instead of standing up a real
// Auth.js instance — the factory's whole job is assembling that object.
const nextAuth = vi.hoisted(() =>
  vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
);
vi.mock('next-auth', () => ({ default: nextAuth }));

const { createJumpCloudAuth } = await import('./create-auth.js');

const validOptions = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
};

/** The NextAuthConfig the factory passed to NextAuth() on its last call. */
function lastConfig(): NextAuthConfig {
  return nextAuth.mock.calls.at(-1)?.[0] as unknown as NextAuthConfig;
}

/** The single JumpCloud provider from that config. */
function lastProvider(): OIDCConfig<never> {
  return lastConfig().providers[0] as unknown as OIDCConfig<never>;
}

beforeEach(() => {
  nextAuth.mockClear();
  vi.stubEnv('AUTH_SECRET', 'a-long-random-auth-secret-string-1234567890');
  vi.stubEnv('NEXT_PHASE', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createJumpCloudAuth provider config', () => {
  it('requests `state` alongside PKCE', () => {
    // REGRESSION: Auth.js defaults `checks` to ["pkce"] alone and omits the
    // `state` parameter. JumpCloud rejects that with
    //   invalid_state — "Request parameter 'state' must be at least be 8
    //   characters long to ensure sufficient entropy."
    // which Auth.js then masks as the generic OAuthCallbackError. Every
    // JumpCloud login fails without this.
    createJumpCloudAuth(validOptions);
    expect(lastProvider().checks).toEqual(['pkce', 'state']);
  });

  it('uses the JumpCloud issuer with its trailing slash', () => {
    createJumpCloudAuth(validOptions);
    expect(lastProvider().issuer).toBe('https://oauth.id.jumpcloud.com/');
  });

  it('authenticates to the token endpoint with client_secret_post', () => {
    createJumpCloudAuth(validOptions);
    expect(lastProvider().client?.token_endpoint_auth_method).toBe(
      'client_secret_post',
    );
  });

  it('requests the default scopes as a space-delimited string', () => {
    createJumpCloudAuth(validOptions);
    expect(lastProvider().authorization).toEqual({
      params: { scope: 'openid email profile' },
    });
  });

  it('keeps the provider id that determines the registered redirect URI', () => {
    // Renaming this changes the callback path to
    // /api/auth/callback/<id>, silently breaking the URI registered with
    // JumpCloud.
    createJumpCloudAuth(validOptions);
    expect(lastProvider().id).toBe('jumpcloud');
  });

  it('echoes routeGroups back for the middleware', () => {
    const routeGroups = { '/admin': ['app-admins'] };
    const result = createJumpCloudAuth({ ...validOptions, routeGroups });
    expect(result.routeGroups).toEqual(routeGroups);
  });

  it('defaults routeGroups to an empty object', () => {
    expect(createJumpCloudAuth(validOptions).routeGroups).toEqual({});
  });
});

describe('createJumpCloudAuth AUTH_SECRET validation', () => {
  it('throws when AUTH_SECRET is missing', () => {
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => createJumpCloudAuth(validOptions)).toThrowError(/AUTH_SECRET/);
  });

  it('accepts a numbered AUTH_SECRET_n for secret rotation', () => {
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('AUTH_SECRET_1', 'a-long-random-auth-secret-string-1234567890');
    expect(() => createJumpCloudAuth(validOptions)).not.toThrow();
  });

  it('accepts a secret passed through authConfig instead of the env', () => {
    vi.stubEnv('AUTH_SECRET', '');
    expect(() =>
      createJumpCloudAuth({
        ...validOptions,
        authConfig: { secret: 'a-long-random-auth-secret-string-1234567890' },
      }),
    ).not.toThrow();
  });

  it('does not throw during `next build`, which has no runtime secrets', () => {
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    expect(() => createJumpCloudAuth(validOptions)).not.toThrow();
  });
});
