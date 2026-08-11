import {
  assertGatedGroups,
  assertStrongSecret,
  DEFAULT_SESSION_MAX_AGE_SECONDS,
  MIN_SECRET_LENGTH,
  withDefaults,
} from '@tetrascience-npm/jumpcloud-sso/core';
import NextAuth from 'next-auth';
import type { NextAuthConfig, NextAuthResult, Profile } from 'next-auth';
import type { OIDCConfig } from 'next-auth/providers';
import {
  applyGroupsToSession,
  applyGroupsToToken,
  applyIdTokenToToken,
} from './claims.js';
import { createSignOutTools } from './logout.js';
import type { SignOutTools } from './logout.js';
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
  const source = {
    name: 'AUTH_SECRET',
    generateWith: 'npx auth secret',
    note:
      'It is NOT the JumpCloud client secret. On Vercel, set it for every ' +
      'environment (Production, Preview, Development); use the same value ' +
      'across them so sessions survive promotion.',
  };

  // A secret handed in directly takes precedence over the environment, so it
  // is the one that has to hold up.
  if (typeof authConfig?.secret === 'string') {
    assertStrongSecret(authConfig.secret, {
      ...source,
      name: 'authConfig.secret',
    });
    return;
  }
  // Auth.js also accepts an array of secrets for rotation; every one of them
  // can decrypt a session, so a single weak entry is as bad as a weak secret.
  if (Array.isArray(authConfig?.secret)) {
    authConfig.secret.forEach((value, index) =>
      assertStrongSecret(value, {
        ...source,
        name: `authConfig.secret[${index}]`,
      }),
    );
    return;
  }

  // AUTH_SECRET_1..3 are Auth.js's rotation slots. Any of them may be the one
  // that decrypts a given cookie, so each present slot is validated.
  const present = [
    'AUTH_SECRET',
    'AUTH_SECRET_1',
    'AUTH_SECRET_2',
    'AUTH_SECRET_3',
  ].filter((name) => process.env[name]);

  if (present.length > 0) {
    for (const name of present) {
      assertStrongSecret(process.env[name], { ...source, name });
    }
    return;
  }

  if (process.env['NEXT_PHASE'] === NEXT_BUILD_PHASE) {
    console.warn(
      '[jumpcloud-sso] AUTH_SECRET is not set. The build will succeed, but ' +
        'sign-in will fail at runtime unless it is set in the deployment ' +
        `environment. It must be at least ${MIN_SECRET_LENGTH} characters.`,
    );
    return;
  }
  throw new Error(
    '[jumpcloud-sso] Missing required environment variable: AUTH_SECRET. ' +
      'This is the Auth.js session/JWT encryption secret — generate one with ' +
      `\`${source.generateWith}\` (or \`openssl rand -base64 32\`). ` +
      source.note,
  );
}

/**
 * Keeps `pkce` and `state` in the provider's `checks`, whatever a caller
 * overrides.
 *
 * Both are load-bearing here and neither is a preference: PKCE binds the
 * authorization code to this client, and JumpCloud rejects the request
 * outright without `state` (`invalid_state — Request parameter 'state' must
 * be at least be 8 characters long`). Silently re-adding them would hide a
 * caller's mistake; throwing names it.
 */
function assertRequiredChecks(checks: readonly string[]): void {
  const missing = (['pkce', 'state'] as const).filter(
    (required) => !checks.includes(required),
  );
  if (missing.length > 0) {
    throw new Error(
      `[jumpcloud-sso] \`checks\` is missing ${missing.join(' and ')}. ` +
        'PKCE binds the authorization code to this client, and JumpCloud ' +
        'refuses any authorization request without `state`. Both must stay ' +
        'in the list; you may add "nonce" alongside them.',
    );
  }
}

/**
 * Rejects a `routeGroups` entry whose allow-list is empty.
 *
 * `{'/admin': []}` reads like a gate and behaves like an open door — every
 * signed-in user satisfies it. That is almost always an env var or lookup that
 * came back empty, so it fails at wiring time instead of at 3am.
 */
function assertRouteGroups(routeGroups: RouteGroups): void {
  for (const [prefix, groups] of Object.entries(routeGroups)) {
    assertGatedGroups(groups, `routeGroups["${prefix}"]`);
  }
}

/**
 * What {@link createJumpCloudAuth} returns: everything `NextAuth()` returns
 * (`handlers`, `auth`, `signIn`, `signOut`, ...) plus the `routeGroups` map,
 * echoed back so it can be handed to `createAuthMiddleware` without repeating
 * yourself.
 */
/**
 * Rejects a session strategy this package cannot support.
 *
 * Pinning `strategy: 'jwt'` silently would leave a caller who asked for
 * database sessions with a config that ignores them; throwing says so. The
 * package has no adapter and reads groups off the JWT, so `database` would
 * hand the `session` callback an undefined `token` and resolve every user to
 * zero groups — gating that denies everyone.
 */
function assertJwtStrategy(strategy: string | undefined): void {
  if (strategy !== undefined && strategy !== 'jwt') {
    throw new Error(
      `[jumpcloud-sso] Unsupported session strategy "${strategy}". This ` +
        'package requires the JWT strategy: it ships no Auth.js adapter and ' +
        'reads JumpCloud groups off the token, so a database session would ' +
        'resolve every user to zero groups and deny every gated route. Other ' +
        '`session` options (maxAge, updateAge) are respected.',
    );
  }
}

/** The argument Auth.js hands the `session` callback. */
type SessionCallbackParams = Parameters<
  NonNullable<NonNullable<NextAuthConfig['callbacks']>['session']>
>[0];

export interface JumpCloudAuth extends NextAuthResult, SignOutTools {
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
  assertRouteGroups(routeGroups);

  // Auth.js defaults `checks` to ["pkce"] alone, treating PKCE as sufficient
  // CSRF protection and omitting `state` from the authorization request.
  // JumpCloud's OIDC layer rejects that outright:
  //   invalid_state — "Request parameter 'state' must be at least be 8
  //   characters long to ensure sufficient entropy."
  // so `state` must be requested explicitly alongside PKCE.
  //
  // `nonce` is deliberately NOT in the default. It is a genuine
  // defense-in-depth measure, but this is authorization-code flow with PKCE
  // S256 over a back-channel token exchange, so there is no ID-token
  // injection point left for a nonce to close. Turning it on by default would
  // stake every login in every consuming app on JumpCloud echoing the nonce
  // back — untested against this tenant, and a total sign-in outage if wrong.
  // Add it deliberately, after one successful login, via `checks`.
  const checks = options.checks ?? ['pkce', 'state'];
  assertRequiredChecks(checks);

  const provider: OIDCConfig<Profile> = {
    id: 'jumpcloud',
    name: 'JumpCloud',
    type: 'oidc',
    issuer: resolved.issuer,
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
    authorization: { params: { scope: resolved.scopes.join(' ') } },
    checks: [...checks] as OIDCConfig<Profile>['checks'],
    // TetraScience registers JumpCloud OIDC apps with the "Client Secret
    // Post" client authentication type; Auth.js defaults to Basic.
    client: { token_endpoint_auth_method: 'client_secret_post' },
  };

  const { callbacks: extraCallbacks, ...configOverrides } =
    options.authConfig ?? {};
  const { session: sessionOverrides, ...otherOverrides } = configOverrides;
  const {
    jwt: extraJwt,
    session: extraSession,
    ...otherCallbacks
  } = extraCallbacks ?? {};

  assertJwtStrategy(sessionOverrides?.strategy);

  const idpLogout = options.idpLogout ?? true;

  const config: NextAuthConfig = {
    providers: [provider],
    callbacks: {
      // `jwt` and `session` are COMPOSED, not replaced: the groups handling
      // always runs, then a caller-supplied callback receives the result to
      // build on. Shallow-merging these instead would silently disable every
      // group-gating feature in the package the moment a caller added an
      // unrelated `jwt` callback — a footgun that costs an afternoon, because
      // gating keeps "working" and just denies everyone.
      jwt(params) {
        let token = applyGroupsToToken(
          params.token,
          params.profile,
          resolved.groupsClaim,
        );
        if (idpLogout) {
          token = applyIdTokenToToken(token, params.account);
        }
        return extraJwt === undefined ? token : extraJwt({ ...params, token });
      },
      session(params) {
        const session = applyGroupsToSession(params.session, params.token);
        // Auth.js types these params as a union over session strategies, and
        // the adapter arm demands a non-optional `user`. This config pins
        // `strategy: 'jwt'`, so only the JWT arm is ever constructed — the
        // cast re-narrows what the spread widened.
        return extraSession === undefined
          ? session
          : extraSession({ ...params, session } as SessionCallbackParams);
      },
      // Every other callback (signIn, redirect, authorized, ...) has no
      // package behavior to preserve, so it passes straight through.
      ...otherCallbacks,
    },
    ...otherOverrides,
    // Pinned last so `strategy` survives the override spread, while the rest
    // of the session options (updateAge, generateSessionToken) still pass
    // through. The whole package reads groups off the JWT and ships no
    // adapter, so a database strategy would leave `token` undefined and every
    // user in no groups.
    //
    // `maxAge` gets a default rather than inheriting Auth.js's 30 days,
    // because with a JWT session that number IS the deprovisioning lag: groups
    // are read once at sign-in and never re-read, so a user removed from a
    // JumpCloud group keeps passing every gate until the session expires. A
    // caller-supplied `maxAge` still wins — the spread order below leaves it
    // in place.
    session: {
      maxAge: DEFAULT_SESSION_MAX_AGE_SECONDS,
      ...sessionOverrides,
      strategy: 'jwt',
    },
  };

  const nextAuth = NextAuth(config);

  return {
    ...nextAuth,
    ...createSignOutTools(nextAuth.auth, nextAuth.signOut, {
      endSessionEndpoint: resolved.endSessionEndpoint,
      clientId: resolved.clientId,
      postLogoutRedirect: options.postLogoutRedirect,
      // Omitted when the caller did not supply one, so the tools fall back to
      // AUTH_SECRET plus its rotation slots.
      secret: options.authConfig?.secret,
    }),
    routeGroups,
  };
}
