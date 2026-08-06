import type { JumpCloudCommon } from '@tetrascience-npm/jumpcloud-sso/core';
import type { RequestHandler } from 'express';

/**
 * Options for {@link createJumpCloudSSO}. Extends the framework-agnostic
 * {@link JumpCloudCommon} with the two Express-specific values.
 */
export interface JumpCloudExpressOptions extends JumpCloudCommon {
  /**
   * The public base URL of THIS app (not JumpCloud), e.g.
   * `http://localhost:3000` in development. JumpCloud redirects the browser
   * back to `${baseUrl}/callback` after login — that exact URL must be
   * registered as a redirect URI on the JumpCloud OIDC application.
   */
  baseUrl: string;
  /**
   * Secret used to encrypt and sign the session cookie. This is YOUR secret,
   * not the JumpCloud client secret — generate one with
   * `openssl rand -hex 32` and keep it out of git.
   */
  sessionSecret: string;
}

/** What {@link createJumpCloudSSO} returns. */
export interface JumpCloudSSO {
  /**
   * The configured express-openid-connect `auth()` middleware. Mount it once,
   * before any route that needs auth: `app.use(sso.authMiddleware)`.
   * It adds `req.oidc`, plus `/login`, `/logout`, and `/callback` routes.
   * Configured with `authRequired: false`, so routes are public unless you
   * add {@link requireAuth} or {@link requireGroup}.
   */
  authMiddleware: RequestHandler;
  /**
   * Route guard that triggers a login redirect (or 401 for XHR-style
   * requests, per express-openid-connect) when the user has no session.
   * This is express-openid-connect's `requiresAuth()`, re-exported.
   */
  requireAuth: RequestHandler;
  /**
   * Route guard factory for JumpCloud group gating: `401` JSON when
   * unauthenticated, `403` JSON when authenticated but not in any of the
   * allowed groups, `next()` otherwise.
   *
   * @param allowed - JumpCloud group NAMES (not IDs). An empty array means
   * "any signed-in user".
   */
  requireGroup: (allowed: string[]) => RequestHandler;
  /**
   * A ready-made `/api/me` handler for the BFF pattern: responds
   * `{ user, groups }` when signed in, `401` JSON otherwise. The SPA calls
   * this on load to learn who the user is — tokens never reach the browser.
   */
  meHandler: RequestHandler;
}
