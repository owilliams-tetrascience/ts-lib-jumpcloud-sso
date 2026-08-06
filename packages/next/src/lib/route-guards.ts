import { hasAnyGroup } from '@tetrascience-npm/jumpcloud-sso/core';
import type { RouteGroups } from './types.js';

/**
 * Paths that must always stay public for login to work: Auth.js mounts its
 * sign-in, callback, and session endpoints under `/api/auth`. Blocking these
 * would trap users in an infinite redirect loop.
 */
export const ALWAYS_PUBLIC_PATHS: readonly string[] = ['/api/auth'];

/**
 * Segment-boundary path-prefix matching.
 *
 * `'/admin'` matches `/admin` and `/admin/settings` but NOT `/administrator`.
 * `'/'` matches ONLY the root path itself — listing `'/'` in `publicPaths`
 * makes just the home page public, not the whole site. To cover a whole
 * subtree, use its prefix (e.g. `'/docs'`). A trailing slash on the prefix is
 * ignored.
 *
 * @param pathname - The request pathname (e.g. `req.nextUrl.pathname`).
 * @param prefix - The configured path prefix.
 */
export function matchesPathPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') {
    return pathname === '/';
  }
  const normalized = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  if (normalized === '') {
    return false;
  }
  return pathname === normalized || pathname.startsWith(`${normalized}/`);
}

/**
 * Whether a pathname belongs to the API surface (`/api/...`). Unauthenticated
 * API requests receive `401` JSON instead of a sign-in redirect, because
 * redirecting a `fetch()` to an HTML login page helps nobody.
 */
export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/**
 * Collects every group rule whose path prefix matches the pathname.
 *
 * A request must satisfy ALL matching rules (each rule is satisfied by having
 * ANY of its listed groups). With `{'/admin': ['app-admins'],
 * '/admin/billing': ['finance']}`, a request to `/admin/billing` requires
 * membership in `app-admins` AND in `finance`.
 *
 * @returns One `string[]` of allowed groups per matching rule.
 */
export function requiredGroupsForPath(
  pathname: string,
  routeGroups: RouteGroups,
): string[][] {
  return Object.entries(routeGroups)
    .filter(([prefix]) => matchesPathPrefix(pathname, prefix))
    .map(([, groups]) => groups);
}

/** Everything {@link decideAccess} needs to know about a request. */
export interface AccessRequest {
  /** Request pathname, e.g. `/admin/settings`. */
  pathname: string;
  /** Whether the request carries a valid session. */
  authenticated: boolean;
  /** The user's normalized JumpCloud groups (empty when unauthenticated). */
  groups: string[];
  /** Additional path prefixes that skip auth entirely. */
  publicPaths?: string[];
  /** Path prefix → allowed groups (see {@link RouteGroups}). */
  routeGroups?: RouteGroups;
}

/**
 * The verdict for a request, as pure data. The middleware maps this to HTTP
 * responses; tests assert on it directly.
 */
export type AccessDecision =
  | { type: 'allow' }
  | { type: 'signin-redirect' }
  | { type: 'unauthorized' }
  | { type: 'forbidden'; requiredGroups: string[] };

/**
 * The complete, framework-free access-control decision used by
 * {@link createAuthMiddleware}:
 *
 * 1. Public paths (including {@link ALWAYS_PUBLIC_PATHS}) are always allowed.
 * 2. Unauthenticated requests are told to sign in — `401` for API paths,
 *    a redirect for page navigations.
 * 3. Authenticated requests must satisfy every matching `routeGroups` rule,
 *    otherwise the decision is `403 forbidden`.
 *
 * Keeping this pure makes the gating rules unit-testable without NextAuth,
 * `Request` objects, or a running server.
 */
export function decideAccess(request: AccessRequest): AccessDecision {
  const publicPaths = [...ALWAYS_PUBLIC_PATHS, ...(request.publicPaths ?? [])];
  if (
    publicPaths.some((prefix) => matchesPathPrefix(request.pathname, prefix))
  ) {
    return { type: 'allow' };
  }

  if (!request.authenticated) {
    return isApiPath(request.pathname)
      ? { type: 'unauthorized' }
      : { type: 'signin-redirect' };
  }

  for (const allowed of requiredGroupsForPath(
    request.pathname,
    request.routeGroups ?? {},
  )) {
    if (!hasAnyGroup(request.groups, allowed)) {
      return { type: 'forbidden', requiredGroups: allowed };
    }
  }

  return { type: 'allow' };
}
