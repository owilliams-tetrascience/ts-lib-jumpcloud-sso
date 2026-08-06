/**
 * @tetrascience-npm/jumpcloud-sso/express
 *
 * JumpCloud OIDC SSO for Express apps serving React SPAs (the BFF pattern),
 * built on express-openid-connect: one factory returns the session
 * middleware, route guards, and a `/api/me` handler.
 *
 * Requires the optional peer dependencies `express` and
 * `express-openid-connect`.
 */
// Side-effect import: pulls in express-openid-connect's global augmentation
// of Express.Request (`req.oidc`). Side-effect imports survive in the emitted
// .d.ts, so every consumer of this entry point gets `req.oidc` typed without
// having to import express-openid-connect themselves.
import 'express-openid-connect';

export { createJumpCloudSSO } from './lib/create-sso.js';
export { createMeHandler, createRequireGroup } from './lib/handlers.js';
export type { JumpCloudExpressOptions, JumpCloudSSO } from './lib/types.js';
