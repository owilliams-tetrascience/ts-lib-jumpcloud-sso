import {
  assertStrongSecret,
  DEFAULT_SCOPES,
  DEFAULT_SESSION_MAX_AGE_SECONDS,
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
 * Whether a base URL is served over plain HTTP.
 *
 * This decides more than it looks like it does. express-openid-connect derives
 * the session cookie's `Secure` attribute from the baseURL scheme: with
 * `https` it defaults `secure` to true, and with anything else it *forbids*
 * `secure` outright. So an `http://` baseURL in production does not merely
 * skip a hardening flag — it guarantees that a cookie carrying the ID token,
 * access token, and refresh token is transmitted in cleartext, replayable by
 * anyone on the path.
 */
const INSECURE_BASE_URL = /^http:\/\//i;

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
  // The session cookie holds the entire OIDC token set, and
  // `req.oidc.isAuthenticated()` is answered from it without ever consulting
  // JumpCloud — so this secret is the only thing standing between a forged
  // cookie and full access. express-openid-connect would accept 8 characters.
  assertStrongSecret(options.sessionSecret, {
    name: 'sessionSecret',
    generateWith: 'openssl rand -hex 32',
    note: 'This is your cookie secret, not the JumpCloud client secret.',
  });

  const isProduction = process.env['NODE_ENV'] === 'production';

  // Apps conventionally write `process.env.BASE_URL ?? 'http://localhost:3000'`,
  // which means the check above never fires on a deployment that simply forgot
  // to set BASE_URL. The redirect_uri would silently become
  // http://localhost:3000/callback and every login would fail against a URI
  // that is only ever registered for local development.
  if (isProduction && LOOPBACK_BASE_URL.test(options.baseUrl)) {
    throw new Error(
      `[jumpcloud-sso] \`baseUrl\` is ${options.baseUrl}, which cannot be ` +
        'reached in production — BASE_URL is probably unset. Set it to the ' +
        'public URL of this app, and register `${BASE_URL}/callback` as a ' +
        'redirect URI on the JumpCloud OIDC application.',
    );
  }
  // Checked separately from the loopback case above, which only catches the
  // unset-BASE_URL mistake. A deliberately configured `http://internal.corp`
  // passes that check and still ships every token over cleartext.
  if (
    isProduction &&
    INSECURE_BASE_URL.test(options.baseUrl) &&
    options.allowInsecureBaseUrl !== true
  ) {
    throw new Error(
      `[jumpcloud-sso] \`baseUrl\` is ${options.baseUrl}, which is plain ` +
        'HTTP. The session cookie carries your ID, access, and refresh ' +
        'tokens, and express-openid-connect refuses to mark it `Secure` on a ' +
        'non-HTTPS origin — so it would travel in cleartext and be replayable ' +
        'by anyone on the network path. Serve this app over HTTPS. If it is ' +
        'genuinely reached only over a trusted internal network, opt out ' +
        'explicitly with `allowInsecureBaseUrl: true`.',
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
    session: {
      // express-openid-connect defaults to a 1-day ROLLING window with no
      // absolute cap, so a user who keeps clicking never has to sign in again
      // — and their JumpCloud groups, captured once at sign-in, never get
      // re-read. The absolute cap is what bounds how long a revoked group
      // membership keeps working. See DEFAULT_SESSION_MAX_AGE_SECONDS.
      absoluteDuration:
        options.sessionMaxAge ?? DEFAULT_SESSION_MAX_AGE_SECONDS,
    },
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
