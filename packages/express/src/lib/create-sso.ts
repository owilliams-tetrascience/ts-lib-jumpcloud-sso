import {
  DEFAULT_SCOPES,
  withDefaults,
} from '@tetrascience-npm/jumpcloud-sso/core';
// express-openid-connect is CommonJS and builds its module.exports with an
// object spread, which Node's CJS named-export detection cannot analyze —
// named ESM imports (`import { auth } from ...`) type-check but crash at
// runtime. Import the default and destructure instead.
import expressOpenidConnect from 'express-openid-connect';
import { createMeHandler, createRequireGroup } from './handlers.js';
import type { JumpCloudExpressOptions, JumpCloudSSO } from './types.js';

const { auth, requiresAuth } = expressOpenidConnect;

/** Base URLs that only ever resolve on the machine serving the request. */
const LOOPBACK_BASE_URL =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

/**
 * Creates everything an Express app needs for JumpCloud SSO with the BFF
 * pattern:
 *
 * - `authMiddleware` — express-openid-connect's `auth()` configured for
 *   JumpCloud: Authorization Code flow (`response_type: "code"`, which makes
 *   express-openid-connect apply PKCE S256 automatically), scope
 *   `openid email profile offline_access`, `authRequired: false` (routes are
 *   public unless guarded), `idpLogout: true` (logout also ends the
 *   JumpCloud session), and `client_secret_post` token-endpoint auth to match
 *   how TetraScience registers JumpCloud OIDC apps.
 * - `requireAuth` — express-openid-connect's `requiresAuth()`, re-exported.
 * - `requireGroup(allowed)` — JumpCloud group gating (401/403 JSON).
 * - `meHandler` — a `/api/me` endpoint returning `{ user, groups }`.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createJumpCloudSSO } from '@tetrascience-npm/jumpcloud-sso/express';
 * import { resolveEnv } from '@tetrascience-npm/jumpcloud-sso/core';
 *
 * const sso = createJumpCloudSSO({
 *   ...resolveEnv(),
 *   baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
 *   sessionSecret: process.env.SESSION_SECRET!,
 * });
 *
 * const app = express();
 * app.use(sso.authMiddleware);
 * app.get('/api/me', sso.meHandler);
 * app.get('/api/data', sso.requireAuth, (req, res) => res.json({ ok: true }));
 * app.get('/api/admin', sso.requireGroup(['app-admins']), (req, res) =>
 *   res.json({ admin: true }),
 * );
 * ```
 *
 * @param options - JumpCloud credentials plus `baseUrl` and `sessionSecret`
 * (see {@link JumpCloudExpressOptions}).
 * @returns The four building blocks described above.
 * @throws Error when `baseUrl` or `sessionSecret` is missing — these have no
 * sensible defaults — or when `baseUrl` is a loopback address while
 * `NODE_ENV=production`, which means `BASE_URL` was never set.
 */
export function createJumpCloudSSO(
  options: JumpCloudExpressOptions,
): JumpCloudSSO {
  if (!options.baseUrl) {
    throw new Error(
      '[jumpcloud-sso] `baseUrl` is required — the public URL of this app, ' +
        'e.g. http://localhost:3000 in development.',
    );
  }
  if (!options.sessionSecret) {
    throw new Error(
      '[jumpcloud-sso] `sessionSecret` is required — generate one with ' +
        '`openssl rand -hex 32`. (This is your cookie secret, not the ' +
        'JumpCloud client secret.)',
    );
  }
  // Apps conventionally write `process.env.BASE_URL ?? 'http://localhost:3000'`,
  // which means the check above never fires on a deployment that simply forgot
  // to set BASE_URL. The redirect_uri would silently become
  // http://localhost:3000/callback and every login would fail against a URI
  // that is only ever registered for local development.
  if (
    process.env['NODE_ENV'] === 'production' &&
    LOOPBACK_BASE_URL.test(options.baseUrl)
  ) {
    throw new Error(
      `[jumpcloud-sso] \`baseUrl\` is ${options.baseUrl}, which cannot be ` +
        'reached in production — BASE_URL is probably unset. Set it to the ' +
        'public URL of this app, and register `${BASE_URL}/callback` as a ' +
        'redirect URI on the JumpCloud OIDC application.',
    );
  }

  const resolved = withDefaults(options);
  // offline_access asks JumpCloud for a refresh token so the server can renew
  // access tokens without bouncing the user through login again. Requires the
  // "Refresh Token" grant on the JumpCloud OIDC application.
  const scopes = options.scopes ?? [...DEFAULT_SCOPES, 'offline_access'];

  const authMiddleware = auth({
    issuerBaseURL: resolved.issuer,
    baseURL: options.baseUrl,
    clientID: resolved.clientId,
    clientSecret: resolved.clientSecret,
    secret: options.sessionSecret,
    authRequired: false,
    idpLogout: true,
    // TetraScience registers JumpCloud OIDC apps with the "Client Secret
    // Post" client authentication type; express-openid-connect defaults to
    // Basic for the code flow.
    clientAuthMethod: 'client_secret_post',
    authorizationParams: {
      // Authorization Code flow. express-openid-connect enables PKCE (S256)
      // automatically whenever response_type includes "code".
      response_type: 'code',
      scope: scopes.join(' '),
    },
  });

  return {
    authMiddleware,
    requireAuth: requiresAuth(),
    requireGroup: createRequireGroup(resolved.groupsClaim),
    meHandler: createMeHandler(resolved.groupsClaim),
  };
}
