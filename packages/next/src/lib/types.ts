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
   *
   * An entry with an empty array throws: `{'/admin': []}` reads like a gate
   * but admits every signed-in user, and is nearly always an unresolved
   * environment variable.
   */
  routeGroups?: RouteGroups;
  /**
   * OAuth checks sent on the authorization request. Defaults to
   * `['pkce', 'state']`; both are mandatory and cannot be removed.
   *
   * Add `'nonce'` for defense in depth once you have confirmed a login works
   * against your JumpCloud application with it enabled — JumpCloud must echo
   * the nonce back in the ID token, and a provider that does not will fail
   * every sign-in.
   */
  checks?: readonly ('pkce' | 'state' | 'nonce')[];
  /**
   * Keep the raw ID token on the session JWT so sign-out can present it to
   * JumpCloud as `id_token_hint`, ending the IdP session without an
   * interstitial.
   *
   * Turning this off makes `signOutEverywhere()` fall back to `client_id`,
   * which still works but may prompt. It saves roughly 1KB of session cookie
   * (which Auth.js chunks automatically, so it is rarely worth it).
   *
   * @defaultValue true
   */
  idpLogout?: boolean;
  /**
   * Where JumpCloud sends the browser after ending the session. A relative
   * path resolves against this app's origin; an off-origin value throws.
   *
   * ⚠️ The resulting absolute URL must be registered as a post-logout
   * redirect URI on the JumpCloud OIDC application, or JumpCloud rejects the
   * logout request. Leave it unset to omit the parameter and let JumpCloud
   * use its own default page, which always works.
   */
  postLogoutRedirect?: string;
  /**
   * Escape hatch: additional Auth.js configuration shallow-merged over the
   * generated config.
   *
   * `callbacks.jwt` and `callbacks.session` are **composed** with the
   * built-ins rather than replacing them: the groups handling runs first, and
   * your callback receives the already-populated `token` / `session` to build
   * on. So a `jwt` callback here cannot accidentally switch off group gating,
   * and you never need to re-implement `applyGroupsToToken` yourself. Every
   * other callback replaces its default outright.
   *
   * `session.strategy` is pinned to `'jwt'` and cannot be overridden — the
   * package ships no adapter and reads groups off the token. Passing anything
   * else throws; the remaining session options (`maxAge`, `updateAge`) apply
   * normally.
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
