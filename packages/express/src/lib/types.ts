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
   * Path where JumpCloud sends the browser back after login, relative to
   * `baseUrl`. Defaults to `/callback`. Set it when the redirect URI already
   * registered on the JumpCloud OIDC application uses a different path — e.g.
   * `/callback/jumpcloud` to share one application with a Next.js app, or
   * because the application predates this library. Must start with `/`.
   */
  callbackPath?: string;
  /**
   * Whether `/logout` also ends the JumpCloud session (RP-initiated logout),
   * rather than only clearing this app's session cookie. Defaults to `true`.
   *
   * RP-initiated logout sends `post_logout_redirect_uri`, and JumpCloud fails
   * the request — _"not whitelisted as a post_logout_redirect_uri for the
   * client"_ — unless that exact URL is registered on the OIDC application.
   * Set `false` when you cannot register one: the user is signed out of your
   * app, but their JumpCloud session survives, so a later `/login` signs them
   * straight back in without a prompt.
   */
  idpLogout?: boolean;
  /**
   * Where the browser lands after logout. Defaults to `baseUrl`. With
   * `idpLogout` this doubles as the `post_logout_redirect_uri` sent to
   * JumpCloud, so it must match a whitelisted URL on the OIDC application
   * exactly.
   */
  postLogoutRedirect?: string;
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
   * It adds `req.oidc`, plus `/login`, `/logout`, and the callback route
   * (`/callback` unless `callbackPath` says otherwise).
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
