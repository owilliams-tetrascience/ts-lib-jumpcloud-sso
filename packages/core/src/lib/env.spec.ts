import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GROUPS_CLAIM, DEFAULT_ISSUER } from './config.js';
import { resolveEnv } from './env.js';

describe('resolveEnv', () => {
  it('throws a single error listing every missing required variable', () => {
    expect(() => resolveEnv({})).toThrowError(
      /JUMPCLOUD_CLIENT_ID, JUMPCLOUD_CLIENT_SECRET/,
    );
  });

  it('lists only the variables that are actually missing', () => {
    expect(() => resolveEnv({ JUMPCLOUD_CLIENT_ID: 'abc' })).toThrowError(
      /Missing required environment variable\(s\): JUMPCLOUD_CLIENT_SECRET\./,
    );
  });

  it('treats empty strings as missing', () => {
    expect(() =>
      resolveEnv({ JUMPCLOUD_CLIENT_ID: '', JUMPCLOUD_CLIENT_SECRET: 's' }),
    ).toThrowError(/JUMPCLOUD_CLIENT_ID/);
  });

  it('applies the JumpCloud defaults for issuer and groups claim', () => {
    const config = resolveEnv({
      JUMPCLOUD_CLIENT_ID: 'client-id',
      JUMPCLOUD_CLIENT_SECRET: 'client-secret',
    });
    expect(config).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      issuer: DEFAULT_ISSUER,
      groupsClaim: DEFAULT_GROUPS_CLAIM,
    });
    expect(config.issuer.endsWith('/')).toBe(true);
  });

  it('respects explicit overrides', () => {
    const config = resolveEnv({
      JUMPCLOUD_CLIENT_ID: 'client-id',
      JUMPCLOUD_CLIENT_SECRET: 'client-secret',
      JUMPCLOUD_ISSUER: 'https://sso.example.test/',
      JUMPCLOUD_GROUPS_CLAIM: 'groups',
    });
    expect(config.issuer).toBe('https://sso.example.test/');
    expect(config.groupsClaim).toBe('groups');
  });
});

describe('resolveEnv during `next build`', () => {
  // CI builds the app long before it has JumpCloud credentials. Without this
  // exception, apps write `?? 'placeholder-client-id'` fallbacks to keep the
  // build green — and those fallbacks survive into production, where they turn
  // a boot-time config error into a first-sign-in failure that points at
  // JumpCloud instead of at the unset variable.
  const buildEnv = { NEXT_PHASE: 'phase-production-build' };

  it('warns instead of throwing when credentials are absent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => resolveEnv(buildEnv)).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('still throws outside the build phase', () => {
    expect(() => resolveEnv({})).toThrowError(/Missing required environment/);
  });

  it('uses real values during a build when they ARE present', () => {
    const resolved = resolveEnv({
      ...buildEnv,
      JUMPCLOUD_CLIENT_ID: 'real-id',
      JUMPCLOUD_CLIENT_SECRET: 'real-secret',
    });
    expect(resolved.clientId).toBe('real-id');
    expect(resolved.clientSecret).toBe('real-secret');
  });

  it('substitutes a self-describing placeholder, not a plausible-looking one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // If this ever reaches a token request, the error should name the cause.
    expect(resolveEnv(buildEnv).clientId).toMatch(/unset-at-build-time/);
    warn.mockRestore();
  });
});
