import type { JumpCloudCommon } from '@tetrascience-npm/jumpcloud-sso/core';
import type { NextAuthConfig } from 'next-auth';

/**
 * Maps a path prefix to the JumpCloud group names allowed to access it.
 *
 * Prefixes match on segment boundaries: `'/admin'` covers `/admin` and
 * `/admin/settings` but not `/administrator`. `'/'` matches only the home
 * page itself. Values are JumpCloud group NAMES (not IDs) — renaming a group
 * in JumpCloud silently breaks gating until the config is updated to match.
 *
 * @example
 * ```ts
 * const routeGroups: RouteGroups = {
 *   '/admin': ['app-admins'],
 *   '/billing': ['finance', 'app-admins'],
 * };
 * ```
 */
export type RouteGroups = Record<string, string[]>;

/**
 * Options for {@link createJumpCloudAuth}. Extends the framework-agnostic
 * {@link JumpCloudCommon} with Next.js specifics.
 */
export interface JumpCloudAuthOptions extends JumpCloudCommon {
  /**
   * Path prefix → allowed JumpCloud groups. Stored on the factory result so
   * it can be passed straight to `createAuthMiddleware`, and used by the
   * session callback consumers for in-app checks.
   */
  routeGroups?: RouteGroups;
  /**
   * Escape hatch: additional Auth.js configuration shallow-merged over the
   * generated config. `callbacks` you provide here are merged alongside (and
   * may override) the built-in `jwt`/`session` callbacks — override those two
   * only if you re-implement the groups handling yourself.
   */
  authConfig?: Partial<NextAuthConfig>;
}

declare module 'next-auth' {
  /**
   * Auth.js module augmentation: every signed-in JumpCloud user carries their
   * normalized group list, so `session.user?.groups` is typed app-wide.
   */
  interface User {
    /** Normalized JumpCloud group names (see core's `normalizeGroups`). */
    groups?: string[];
  }
}
