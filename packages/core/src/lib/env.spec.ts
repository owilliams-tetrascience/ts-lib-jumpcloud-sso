import { describe, expect, it } from 'vitest';
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
