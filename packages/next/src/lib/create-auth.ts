import { withDefaults } from '@tetrascience-npm/jumpcloud-sso/core';
import NextAuth from 'next-auth';
import type { NextAuthConfig, NextAuthResult, Profile } from 'next-auth';
import type { OIDCConfig } from 'next-auth/providers';
import { applyGroupsToSession, applyGroupsToToken } from './claims.js';
import type { JumpCloudAuthOptions, RouteGroups } from './types.js';

/**
 * What {@link createJumpCloudAuth} returns: everything `NextAuth()` returns
 * (`handlers`, `auth`, `signIn`, `signOut`, ...) plus the `routeGroups` map,
 * echoed back so it can be handed to `createAuthMiddleware` without repeating
 * yourself.
 */
export interface JumpCloudAuth extends NextAuthResult {
  /** The `routeGroups` passed to the factory (empty object when omitted). */
  routeGroups: RouteGroups;
}

/**
 * Creates a fully configured Auth.js (next-auth v5) instance for JumpCloud:
 *
 * - A custom OIDC provider (`id: "jumpcloud"`) pointing at the JumpCloud
 *   issuer, with PKCE (Auth.js default for OIDC) and `client_secret_post`
 *   token-endpoint authentication to match how TetraScience registers
 *   JumpCloud OIDC apps.
 * - JWT session strategy (no database required).
 * - A `jwt` callback that normalizes the JumpCloud groups claim — which is a
 *   bare string when the user is in exactly one group — onto the token, and a
 *   `session` callback that exposes it as `session.user.groups`.
 *
 * Auth.js reads `AUTH_SECRET` from the environment; generate one with
 * `npx auth secret` or `openssl rand -base64 32`.
 *
 * @example
 * ```ts
 * // auth.ts
 * import { createJumpCloudAuth } from '@tetrascience-npm/jumpcloud-sso/next';
 * import { resolveEnv } from '@tetrascience-npm/jumpcloud-sso/core';
 *
 * export const { handlers, auth, signIn, signOut, routeGroups } =
 *   createJumpCloudAuth({
 *     ...resolveEnv(),
 *     routeGroups: { '/admin': ['app-admins'] },
 *   });
 * ```
 *
 * @param options - JumpCloud credentials plus optional `routeGroups` and an
 * `authConfig` escape hatch (see {@link JumpCloudAuthOptions}).
 * @returns A {@link JumpCloudAuth}; re-export its `handlers` from
 * `app/api/auth/[...nextauth]/route.ts`.
 */
export function createJumpCloudAuth(
  options: JumpCloudAuthOptions,
): JumpCloudAuth {
  const resolved = withDefaults(options);
  const routeGroups = options.routeGroups ?? {};

  const provider: OIDCConfig<Profile> = {
    id: 'jumpcloud',
    name: 'JumpCloud',
    type: 'oidc',
    issuer: resolved.issuer,
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
    authorization: { params: { scope: resolved.scopes.join(' ') } },
    // TetraScience registers JumpCloud OIDC apps with the "Client Secret
    // Post" client authentication type; Auth.js defaults to Basic.
    client: { token_endpoint_auth_method: 'client_secret_post' },
  };

  const { callbacks: extraCallbacks, ...configOverrides } =
    options.authConfig ?? {};

  const config: NextAuthConfig = {
    providers: [provider],
    session: { strategy: 'jwt' },
    callbacks: {
      jwt({ token, profile }) {
        return applyGroupsToToken(token, profile, resolved.groupsClaim);
      },
      session({ session, token }) {
        return applyGroupsToSession(session, token);
      },
      ...extraCallbacks,
    },
    ...configOverrides,
  };

  return { ...NextAuth(config), routeGroups };
}
