import { withDefaults } from '@tetrascience-npm/jumpcloud-sso/core';
import NextAuth from 'next-auth';
import type { NextAuthConfig, NextAuthResult, Profile } from 'next-auth';
import type { OIDCConfig } from 'next-auth/providers';
import { applyGroupsToSession, applyGroupsToToken } from './claims.js';
import type { JumpCloudAuthOptions, RouteGroups } from './types.js';

/**
 * `next build` sets this phase, and CI legitimately builds without runtime
 * secrets — the Auth.js secret is only needed to serve a request.
 * @see next/dist/build/index.js, which assigns `PHASE_PRODUCTION_BUILD`
 */
const NEXT_BUILD_PHASE = 'phase-production-build';

/**
 * Fails fast when no Auth.js secret is configured.
 *
 * Auth.js reads `AUTH_SECRET` from the environment on its own and only
 * complains when it tries to serve a request, so a deployment missing it
 * builds green and then dies at the first sign-in with an error that points
 * at Auth.js rather than at the missing variable. Checking here surfaces it
 * at wiring time — module load of the app's `auth.ts` — instead.
 *
 * Accepts `AUTH_SECRET_1..3` as well, which Auth.js uses for secret rotation,
 * and a `secret` supplied through `authConfig`.
 */
function assertAuthSecret(authConfig: Partial<NextAuthConfig> | undefined) {
  if (authConfig?.secret) {
    return;
  }
  const fromEnv = [
    'AUTH_SECRET',
    'AUTH_SECRET_1',
    'AUTH_SECRET_2',
    'AUTH_SECRET_3',
  ].some((name) => process.env[name]);
  if (fromEnv) {
    return;
  }
  if (process.env['NEXT_PHASE'] === NEXT_BUILD_PHASE) {
    console.warn(
      '[jumpcloud-sso] AUTH_SECRET is not set. The build will succeed, but ' +
        'sign-in will fail at runtime unless it is set in the deployment ' +
        'environment.',
    );
    return;
  }
  throw new Error(
    '[jumpcloud-sso] Missing required environment variable: AUTH_SECRET. ' +
      'This is the Auth.js session/JWT encryption secret — generate one with ' +
      '`npx auth secret` (or `openssl rand -base64 32`). It is NOT the ' +
      'JumpCloud client secret. On Vercel, set it for every environment ' +
      '(Production, Preview, Development); use the same value across them so ' +
      'sessions survive promotion.',
  );
}

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
 *   issuer, with PKCE **and** `state` (JumpCloud requires both — see
 *   `checks` below) and `client_secret_post` token-endpoint authentication
 *   to match how TetraScience registers JumpCloud OIDC apps.
 * - JWT session strategy (no database required).
 * - A `jwt` callback that normalizes the JumpCloud groups claim — which is a
 *   bare string when the user is in exactly one group — onto the token, and a
 *   `session` callback that exposes it as `session.user.groups`.
 *
 * Auth.js reads `AUTH_SECRET` from the environment; generate one with
 * `npx auth secret` or `openssl rand -base64 32`. Its absence throws here
 * rather than at the first sign-in — except during `next build`, which warns.
 *
 * The redirect URI to register with JumpCloud is
 * `<origin>/api/auth/callback/jumpcloud` — Auth.js appends the provider `id`
 * to the callback path, so a bare `/api/auth/callback` will not match.
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
 * @throws Error when no Auth.js secret is configured (see `AUTH_SECRET`
 * above), outside of `next build`.
 */
export function createJumpCloudAuth(
  options: JumpCloudAuthOptions,
): JumpCloudAuth {
  assertAuthSecret(options.authConfig);

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
    // Auth.js defaults `checks` to ["pkce"] alone, treating PKCE as sufficient
    // CSRF protection and omitting `state` from the authorization request.
    // JumpCloud's OIDC layer rejects that outright:
    //   invalid_state — "Request parameter 'state' must be at least be 8
    //   characters long to ensure sufficient entropy."
    // so `state` must be requested explicitly alongside PKCE.
    checks: ['pkce', 'state'],
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
