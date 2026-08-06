// Default-import express for the same reason as express-openid-connect in
// create-sso.ts: express is CommonJS, and depending on Node's named-export
// lexer for `Router` is fragile across express majors. `express.Router` is
// always present on the default export.
import express from 'express';
import type { Router } from 'express';
import { createJumpCloudSSO } from './create-sso.js';
import type { JumpCloudExpressOptions, JumpCloudSSO } from './types.js';

/** Options for {@link createSSORouter}. */
export interface SSORouterOptions extends JumpCloudExpressOptions {
  /**
   * Where to serve the BFF identity endpoint, relative to wherever the
   * router is mounted. Defaults to `/api/me`. Pass `false` to skip mounting
   * it (the handler is still returned as `meHandler`).
   */
  mePath?: string | false;
}

/** What {@link createSSORouter} returns: the router plus everything from
 * {@link createJumpCloudSSO}, so ad-hoc guards stay available. */
export interface JumpCloudSSORouter extends JumpCloudSSO {
  /**
   * An Express router with the session middleware and `/api/me` already
   * mounted. `app.use(sso.router)` is the only wiring an app needs.
   */
  router: Router;
}

/**
 * The one-line-mount variant of {@link createJumpCloudSSO}: returns an
 * Express router that bundles everything SSO needs into a single
 * `app.use()`:
 *
 * - the express-openid-connect session middleware (adds `req.oidc` and the
 *   `/login`, `/logout`, `/callback` routes);
 * - the `/api/me` BFF identity endpoint (configurable via `mePath`).
 *
 * The individual pieces (`requireAuth`, `requireGroup`, `meHandler`,
 * `authMiddleware`) are returned alongside the router so protected routes
 * can still be guarded per-route.
 *
 * Mount it BEFORE any route that reads `req.oidc` or uses a guard —
 * middleware order is mount order in Express.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createSSORouter } from '@tetrascience-npm/jumpcloud-sso/express';
 * import { resolveEnv } from '@tetrascience-npm/jumpcloud-sso/core';
 *
 * const sso = createSSORouter({
 *   ...resolveEnv(),
 *   baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
 *   sessionSecret: process.env.SESSION_SECRET!,
 * });
 *
 * const app = express();
 * app.use(sso.router); // session + /login + /logout + /callback + /api/me
 * app.get('/api/data', sso.requireAuth, (req, res) => res.json({ ok: true }));
 * app.get('/api/admin', sso.requireGroup(['app-admins']), (req, res) =>
 *   res.json({ admin: true }),
 * );
 * ```
 *
 * @param options - Everything {@link createJumpCloudSSO} takes, plus
 * `mePath`.
 * @returns The mounted router plus the individual SSO building blocks.
 */
export function createSSORouter(options: SSORouterOptions): JumpCloudSSORouter {
  const { mePath = '/api/me', ...ssoOptions } = options;
  const sso = createJumpCloudSSO(ssoOptions);

  const router = express.Router();
  router.use(sso.authMiddleware);
  if (mePath !== false) {
    router.get(mePath, sso.meHandler);
  }

  return { ...sso, router };
}
