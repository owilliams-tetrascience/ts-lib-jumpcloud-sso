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
   *
   * Must be at least 32 characters, must not look like a placeholder, and
   * must not be a repeated character. Anyone who recovers it can forge a
   * session cookie naming any user and claiming any JumpCloud group, which
   * every guard here will then honor.
   */
  sessionSecret: string;
  /**
   * Absolute session lifetime in seconds — the hard cap after which the user
   * must sign in again regardless of activity. Defaults to
   * `DEFAULT_SESSION_MAX_AGE_SECONDS` (8 hours).
   *
   * This is your deprovisioning lag: JumpCloud groups are read once at
   * sign-in, so removing someone from a group only takes effect for existing
   * sessions when they expire. Raising this raises that lag by the same
   * amount.
   */
  sessionMaxAge?: number;
  /**
   * Opt out of the production HTTPS requirement on `baseUrl`.
   *
   * With a plain-HTTP `baseUrl`, express-openid-connect refuses to set the
   * `Secure` attribute on the session cookie — so the cookie carrying your ID,
   * access, and refresh tokens travels in cleartext. Only set this for an app
   * genuinely reachable exclusively over a trusted internal network, and
   * prefer fixing the transport instead.
   *
   * @defaultValue false
   */
  allowInsecureBaseUrl?: boolean;
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
   * @param allowed - JumpCloud group NAMES (not IDs). Must contain at least
   * one name: an empty array throws at mount time rather than admitting every
   * signed-in user, since that is nearly always an unresolved config value.
   * Use {@link requireAuth} when you really do mean "any signed-in user".
   */
  requireGroup: (allowed: string[]) => RequestHandler;
  /**
   * A ready-made `/api/me` handler for the BFF pattern: responds
   * `{ user, groups }` when signed in, `401` JSON otherwise. The SPA calls
   * this on load to learn who the user is — tokens never reach the browser.
   */
  meHandler: RequestHandler;
}
