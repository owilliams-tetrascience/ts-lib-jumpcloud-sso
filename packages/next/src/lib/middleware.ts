import { assertGatedGroups } from '@tetrascience-npm/jumpcloud-sso/core';
import type { NextAuthRequest, NextAuthResult } from 'next-auth';
import type { NextFetchEvent, NextMiddleware } from 'next/server';
import { decideAccess } from './route-guards.js';
import type { RouteGroups } from './types.js';

/** Options for {@link createAuthMiddleware}. */
export interface AuthMiddlewareOptions {
  /**
   * Path prefixes that skip authentication entirely (segment-boundary
   * matching; `'/'` means just the home page). `/api/auth` is always
   * public — see `ALWAYS_PUBLIC_PATHS`.
   */
  publicPaths?: string[];
  /** Path prefix → allowed JumpCloud group names. */
  routeGroups?: RouteGroups;
  /**
   * Where unauthenticated page navigations are redirected. Defaults to the
   * Auth.js sign-in page, `/api/auth/signin`, which forwards straight to
   * JumpCloud when it is the only provider.
   */
  signInPath?: string;
}

/**
 * Builds a Next.js middleware that protects routes with JumpCloud SSO:
 *
 * - allows `publicPaths` (plus `/api/auth`) through untouched;
 * - redirects unauthenticated PAGE requests to sign-in, preserving the
 *   original destination as `callbackUrl`;
 * - answers unauthenticated `/api/...` requests with `401` JSON;
 * - answers authenticated requests that fail a `routeGroups` rule with `403`.
 *
 * ⚠️ Middleware is a CONVENIENCE, not a security boundary. It improves UX by
 * bouncing users early, but data must be protected where it lives: re-check
 * `auth()` (and groups) in every server component, route handler, and server
 * action that touches something sensitive.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { createAuthMiddleware } from '@tetrascience-npm/jumpcloud-sso/next';
 * import { auth, routeGroups } from './auth';
 *
 * export default createAuthMiddleware(auth, {
 *   publicPaths: ['/', '/health'],
 *   routeGroups,
 * });
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 *
 * @param auth - The `auth` function returned by `createJumpCloudAuth` (or any
 * `NextAuth()` result).
 * @param options - Public paths, group gating, and sign-in path overrides.
 * @returns A middleware function to `export default` from `middleware.ts`.
 */
export function createAuthMiddleware(
  auth: NextAuthResult['auth'],
  options: AuthMiddlewareOptions = {},
): NextMiddleware {
  // Fail at module load rather than per-request: an empty allow-list reads
  // like a gate and admits every signed-in user.
  for (const [prefix, groups] of Object.entries(options.routeGroups ?? {})) {
    assertGatedGroups(groups, `routeGroups["${prefix}"]`);
  }

  // The explicit (request, event) signature selects NextAuth's middleware
  // overload rather than its route-handler overload.
  return auth((request: NextAuthRequest, _event: NextFetchEvent) => {
    const { pathname, search } = request.nextUrl;

    const decision = decideAccess({
      pathname,
      authenticated: request.auth !== null,
      groups: request.auth?.user?.groups ?? [],
      publicPaths: options.publicPaths,
      routeGroups: options.routeGroups,
    });

    switch (decision.type) {
      case 'allow':
        return undefined;
      case 'signin-redirect': {
        const signInUrl = new URL(
          options.signInPath ?? '/api/auth/signin',
          request.nextUrl,
        );
        signInUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
        return Response.redirect(signInUrl);
      }
      case 'unauthorized':
        return Response.json(
          { error: 'Unauthorized', message: 'Sign-in required.' },
          { status: 401 },
        );
      case 'forbidden':
        return Response.json(
          {
            error: 'Forbidden',
            message: `Requires membership in one of the JumpCloud groups: ${decision.requiredGroups.join(', ')}.`,
          },
          { status: 403 },
        );
    }
  });
}
