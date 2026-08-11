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

describe('createJumpCloudAuth callback composition', () => {
  /** Invokes the assembled `jwt` callback as Auth.js would on sign-in. */
  async function runJwt(profile: Record<string, unknown> | undefined) {
    const jwt = lastConfig().callbacks?.jwt;
    return (await jwt?.({
      token: { sub: 'user-1' },
      profile,
    } as never)) as Record<string, unknown>;
  }

  /** Invokes the assembled `session` callback as Auth.js would on a read. */
  async function runSession(token: Record<string, unknown>) {
    const session = lastConfig().callbacks?.session;
    return (await session?.({
      session: { user: { email: 'ada@tetrascience.com' }, expires: 'never' },
      token,
    } as never)) as Record<string, unknown>;
  }

  it('copies groups onto the token with no caller callbacks', async () => {
    createJumpCloudAuth(validOptions);
    expect(await runJwt({ groups: 'app-admins' })).toMatchObject({
      groups: ['app-admins'],
    });
  });

  it('still copies groups when the caller supplies its own jwt callback', async () => {
    // REGRESSION: these callbacks used to be shallow-merged over the
    // built-ins, so any caller `jwt` callback silently replaced the groups
    // handling — gating then denied every user, including real members.
    createJumpCloudAuth({
      ...validOptions,
      authConfig: {
        callbacks: {
          jwt({ token }) {
            return { ...token, extra: 'from-caller' };
          },
        },
      },
    });
    expect(await runJwt({ groups: ['app-admins', 'eng'] })).toMatchObject({
      groups: ['app-admins', 'eng'],
      extra: 'from-caller',
    });
  });

  it('hands the caller a token that already has groups on it', async () => {
    let seen: unknown;
    createJumpCloudAuth({
      ...validOptions,
      authConfig: {
        callbacks: {
          jwt({ token }) {
            seen = token['groups'];
            return token;
          },
        },
      },
    });
    await runJwt({ groups: 'app-admins' });
    expect(seen).toEqual(['app-admins']);
  });

  it('composes the session callback the same way', async () => {
    createJumpCloudAuth({
      ...validOptions,
      authConfig: {
        callbacks: {
          session({ session }) {
            return { ...session, tag: 'from-caller' } as never;
          },
        },
      },
    });
    expect(await runSession({ groups: ['app-admins'] })).toMatchObject({
      user: { email: 'ada@tetrascience.com', groups: ['app-admins'] },
      tag: 'from-caller',
    });
  });

  it('passes other callbacks through untouched', () => {
    const signIn = vi.fn(() => true);
    createJumpCloudAuth({
      ...validOptions,
      authConfig: { callbacks: { signIn } },
    });
    expect(lastConfig().callbacks?.signIn).toBe(signIn);
  });
});

describe('createJumpCloudAuth session strategy', () => {
  it('uses the JWT strategy', () => {
    createJumpCloudAuth(validOptions);
    expect(lastConfig().session?.strategy).toBe('jwt');
  });

  it('keeps the JWT strategy when authConfig overrides other session options', () => {
    // The override spread used to land after `session`, so any `session` block
    // passed through authConfig replaced the pinned strategy wholesale.
    createJumpCloudAuth({
      ...validOptions,
      authConfig: { session: { maxAge: 60 } },
    });
    expect(lastConfig().session).toEqual({ strategy: 'jwt', maxAge: 60 });
  });

  it('throws on a database strategy rather than ignoring it', () => {
    expect(() =>
      createJumpCloudAuth({
        ...validOptions,
        authConfig: { session: { strategy: 'database' } },
      }),
    ).toThrowError(/Unsupported session strategy "database"/);
  });
});

describe('createJumpCloudAuth session lifetime', () => {
  it('caps the session well below the Auth.js 30-day default', () => {
    // With a JWT session this number IS the deprovisioning lag: groups are
    // read from the ID token once at sign-in and never re-read, so someone
    // removed from a JumpCloud group keeps passing every gate until their
    // session expires. 30 days of that is not an acceptable default for an
    // authorization package.
    createJumpCloudAuth(validOptions);
    expect(lastConfig().session?.maxAge).toBe(8 * 60 * 60);
  });

  it('lets a caller choose their own maxAge', () => {
    createJumpCloudAuth({
      ...validOptions,
      authConfig: { session: { maxAge: 900 } },
    });
    expect(lastConfig().session).toEqual({ strategy: 'jwt', maxAge: 900 });
  });
});

describe('createJumpCloudAuth checks', () => {
  it('rejects a checks override that drops state', () => {
    // JumpCloud refuses any authorization request without `state`, so this
    // would break every login — and dropping pkce would unbind the code from
    // this client. Neither is a preference.
    expect(() =>
      createJumpCloudAuth({ ...validOptions, checks: ['pkce'] }),
    ).toThrowError(/missing state/);
  });

  it('rejects a checks override that drops pkce', () => {
    expect(() =>
      createJumpCloudAuth({ ...validOptions, checks: ['state'] }),
    ).toThrowError(/missing pkce/);
  });

  it('allows adding nonce alongside the mandatory two', () => {
    createJumpCloudAuth({
      ...validOptions,
      checks: ['pkce', 'state', 'nonce'],
    });
    expect(lastProvider().checks).toEqual(['pkce', 'state', 'nonce']);
  });
});

describe('createJumpCloudAuth routeGroups validation', () => {
  it('throws on an empty allow-list rather than opening the route', () => {
    // `{'/admin': []}` reads like a gate and admits every signed-in user.
    expect(() =>
      createJumpCloudAuth({ ...validOptions, routeGroups: { '/admin': [] } }),
    ).toThrowError(/routeGroups\["\/admin"\].*empty group list/s);
  });
});

describe('createJumpCloudAuth ID token retention for logout', () => {
  /** Invokes the assembled `jwt` callback as Auth.js would on sign-in. */
  async function runJwt(account: Record<string, unknown> | null) {
    const jwt = lastConfig().callbacks?.jwt;
    return (await jwt?.({
      token: { sub: 'user-1' },
      profile: { memberOf: 'app-admins' },
      account,
    } as never)) as Record<string, unknown>;
  }

  it('keeps the raw ID token so logout can send id_token_hint', async () => {
    createJumpCloudAuth(validOptions);
    expect(await runJwt({ id_token: 'header.payload.sig' })).toMatchObject({
      jumpcloudIdToken: 'header.payload.sig',
    });
  });

  it('omits it when idpLogout is switched off', async () => {
    createJumpCloudAuth({ ...validOptions, idpLogout: false });
    expect(await runJwt({ id_token: 'header.payload.sig' })).not.toHaveProperty(
      'jumpcloudIdToken',
    );
  });

  it('leaves the token alone when there is no account (not a sign-in)', async () => {
    createJumpCloudAuth(validOptions);
    expect(await runJwt(null)).not.toHaveProperty('jumpcloudIdToken');
  });
});

describe('createJumpCloudAuth AUTH_SECRET validation', () => {
  it('throws when AUTH_SECRET is missing', () => {
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => createJumpCloudAuth(validOptions)).toThrowError(/AUTH_SECRET/);
  });

  it('throws on a secret short enough to attack offline', () => {
    // Auth.js enforces no minimum — it runs whatever it is given through
    // HKDF, which stretches a weak secret without adding entropy. Forge this
    // JWT and `session.user.groups` is whatever the attacker wrote.
    vi.stubEnv('AUTH_SECRET', 'hunter22');
    expect(() => createJumpCloudAuth(validOptions)).toThrowError(
      /at least 32 are required/,
    );
  });

  it('throws on a padded-out placeholder', () => {
    vi.stubEnv('AUTH_SECRET', 'changeme-changeme-changeme-changeme');
    expect(() => createJumpCloudAuth(validOptions)).toThrowError(/placeholder/);
  });

  it('validates every rotation slot, not just the first', () => {
    // Any AUTH_SECRET_n can decrypt a session cookie, so one weak slot is as
    // bad as a weak AUTH_SECRET.
    vi.stubEnv('AUTH_SECRET', 'a-long-random-auth-secret-string-1234567890');
    vi.stubEnv('AUTH_SECRET_2', 'short');
    expect(() => createJumpCloudAuth(validOptions)).toThrowError(
      /AUTH_SECRET_2/,
    );
  });

  it('validates a secret passed through authConfig', () => {
    vi.stubEnv('AUTH_SECRET', '');
    expect(() =>
      createJumpCloudAuth({ ...validOptions, authConfig: { secret: 'short' } }),
    ).toThrowError(/authConfig\.secret/);
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
