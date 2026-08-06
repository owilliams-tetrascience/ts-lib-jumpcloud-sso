import { describe, expect, it } from 'vitest';
import {
  decideAccess,
  isApiPath,
  matchesPathPrefix,
  requiredGroupsForPath,
} from './route-guards.js';

describe('matchesPathPrefix', () => {
  it('matches exact paths', () => {
    expect(matchesPathPrefix('/admin', '/admin')).toBe(true);
  });

  it('matches child paths on segment boundaries', () => {
    expect(matchesPathPrefix('/admin/settings', '/admin')).toBe(true);
  });

  it('does not match partial segments', () => {
    expect(matchesPathPrefix('/administrator', '/admin')).toBe(false);
  });

  it('treats "/" as the home page only, not a catch-all', () => {
    expect(matchesPathPrefix('/', '/')).toBe(true);
    expect(matchesPathPrefix('/anything/at/all', '/')).toBe(false);
  });

  it('never matches an empty prefix', () => {
    expect(matchesPathPrefix('/anything', '')).toBe(false);
  });

  it('ignores a trailing slash on the prefix', () => {
    expect(matchesPathPrefix('/admin/settings', '/admin/')).toBe(true);
    expect(matchesPathPrefix('/admin', '/admin/')).toBe(true);
  });
});

describe('isApiPath', () => {
  it('detects API paths', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/data')).toBe(true);
  });

  it('rejects non-API paths', () => {
    expect(isApiPath('/apiary')).toBe(false);
    expect(isApiPath('/dashboard')).toBe(false);
  });
});

describe('requiredGroupsForPath', () => {
  const routeGroups = {
    '/admin': ['app-admins'],
    '/admin/billing': ['finance'],
    '/reports': ['analysts'],
  };

  it('returns every matching rule', () => {
    expect(requiredGroupsForPath('/admin/billing/2024', routeGroups)).toEqual([
      ['app-admins'],
      ['finance'],
    ]);
  });

  it('returns a single matching rule', () => {
    expect(requiredGroupsForPath('/reports', routeGroups)).toEqual([
      ['analysts'],
    ]);
  });

  it('returns [] when nothing matches', () => {
    expect(requiredGroupsForPath('/dashboard', routeGroups)).toEqual([]);
  });
});

describe('decideAccess', () => {
  const routeGroups = { '/admin': ['app-admins'] };

  it('allows configured public paths without authentication', () => {
    expect(
      decideAccess({
        pathname: '/health',
        authenticated: false,
        groups: [],
        publicPaths: ['/health'],
      }),
    ).toEqual({ type: 'allow' });
  });

  it('supports a public home page without opening the rest of the site', () => {
    expect(
      decideAccess({
        pathname: '/',
        authenticated: false,
        groups: [],
        publicPaths: ['/'],
      }),
    ).toEqual({ type: 'allow' });
    expect(
      decideAccess({
        pathname: '/dashboard',
        authenticated: false,
        groups: [],
        publicPaths: ['/'],
      }),
    ).toEqual({ type: 'signin-redirect' });
  });

  it('always allows the Auth.js endpoints (prevents sign-in redirect loops)', () => {
    expect(
      decideAccess({
        pathname: '/api/auth/callback/jumpcloud',
        authenticated: false,
        groups: [],
      }),
    ).toEqual({ type: 'allow' });
  });

  it('redirects unauthenticated page navigations to sign-in', () => {
    expect(
      decideAccess({
        pathname: '/dashboard',
        authenticated: false,
        groups: [],
      }),
    ).toEqual({ type: 'signin-redirect' });
  });

  it('returns 401-style unauthorized for unauthenticated API requests', () => {
    expect(
      decideAccess({ pathname: '/api/data', authenticated: false, groups: [] }),
    ).toEqual({ type: 'unauthorized' });
  });

  it('allows authenticated users on ungated paths', () => {
    expect(
      decideAccess({
        pathname: '/dashboard',
        authenticated: true,
        groups: [],
        routeGroups,
      }),
    ).toEqual({ type: 'allow' });
  });

  it('allows authenticated users who satisfy the gate', () => {
    expect(
      decideAccess({
        pathname: '/admin/settings',
        authenticated: true,
        groups: ['app-admins', 'engineering'],
        routeGroups,
      }),
    ).toEqual({ type: 'allow' });
  });

  it('forbids authenticated users missing the required group', () => {
    expect(
      decideAccess({
        pathname: '/admin',
        authenticated: true,
        groups: ['engineering'],
        routeGroups,
      }),
    ).toEqual({ type: 'forbidden', requiredGroups: ['app-admins'] });
  });

  it('requires every matching rule to pass', () => {
    const nested = {
      '/admin': ['app-admins'],
      '/admin/billing': ['finance'],
    };
    expect(
      decideAccess({
        pathname: '/admin/billing',
        authenticated: true,
        groups: ['app-admins'],
        routeGroups: nested,
      }),
    ).toEqual({ type: 'forbidden', requiredGroups: ['finance'] });
    expect(
      decideAccess({
        pathname: '/admin/billing',
        authenticated: true,
        groups: ['app-admins', 'finance'],
        routeGroups: nested,
      }),
    ).toEqual({ type: 'allow' });
  });

  it('gates API paths with 403 for authenticated users without the group', () => {
    expect(
      decideAccess({
        pathname: '/api/admin/rotate-keys',
        authenticated: true,
        groups: ['engineering'],
        routeGroups: { '/api/admin': ['app-admins'] },
      }),
    ).toEqual({ type: 'forbidden', requiredGroups: ['app-admins'] });
  });
});
