import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyGroupsToSession, applyGroupsToToken } from './claims.js';

const baseToken: JWT = { sub: 'user-1', email: 'ada@tetrascience.com' };

describe('applyGroupsToToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes a bare-string claim (JumpCloud single-group quirk) on sign-in', () => {
    const token = applyGroupsToToken(
      baseToken,
      { groups: 'app-admins' },
      'groups',
    );
    expect(token['groups']).toEqual(['app-admins']);
  });

  it('keeps an array claim as-is on sign-in', () => {
    const token = applyGroupsToToken(
      baseToken,
      { groups: ['app-admins', 'engineering'] },
      'groups',
    );
    expect(token['groups']).toEqual(['app-admins', 'engineering']);
  });

  it('stores [] when the claim is missing from the profile', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const token = applyGroupsToToken(baseToken, { email: 'a@b.c' }, 'groups');
    expect(token['groups']).toEqual([]);
  });

  it('warns with the claim names present when the groups claim is absent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    applyGroupsToToken(baseToken, { sub: 'x', email: 'a@b.c' }, 'groups');
    expect(warn).toHaveBeenCalledOnce();
    const message = warn.mock.calls[0]?.[0] as string;
    expect(message).toContain('no "groups" claim');
    // Names, not values — an ID token carries user attributes.
    expect(message).toContain('sub, email');
    expect(message).not.toContain('JUMPCLOUD_CLIENT');
  });

  it('does not warn when the claim is present but empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const token = applyGroupsToToken(baseToken, { groups: '' }, 'groups');
    expect(token['groups']).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads the configured claim name', () => {
    const token = applyGroupsToToken(
      baseToken,
      { groups: ['custom-claim-group'] },
      'groups',
    );
    expect(token['groups']).toEqual(['custom-claim-group']);
  });

  it('leaves the token untouched on refresh (no profile present)', () => {
    const signedIn = applyGroupsToToken(
      baseToken,
      { groups: 'app-admins' },
      'groups',
    );
    const refreshed = applyGroupsToToken(signedIn, undefined, 'groups');
    expect(refreshed).toBe(signedIn);
    expect(refreshed['groups']).toEqual(['app-admins']);
  });
});

describe('applyGroupsToSession', () => {
  const baseSession = {
    user: { name: 'Ada', email: 'ada@tetrascience.com' },
    expires: '2099-01-01T00:00:00.000Z',
  } as Session;

  it('copies groups from the token onto session.user', () => {
    const session = applyGroupsToSession(baseSession, {
      ...baseToken,
      groups: ['app-admins'],
    });
    expect(session.user?.groups).toEqual(['app-admins']);
    expect(session.user?.email).toBe('ada@tetrascience.com');
  });

  it('defaults to an empty group list when the token has none', () => {
    const session = applyGroupsToSession(baseSession, baseToken);
    expect(session.user?.groups).toEqual([]);
  });

  it('normalizes a stray single-string value defensively', () => {
    const session = applyGroupsToSession(baseSession, {
      ...baseToken,
      groups: 'app-admins',
    });
    expect(session.user?.groups).toEqual(['app-admins']);
  });
});
