/**
 * @tetrascience-npm/jumpcloud-sso/next
 *
 * JumpCloud OIDC SSO for Next.js App Router apps, built on Auth.js
 * (next-auth v5): a preconfigured NextAuth factory plus a route-protecting
 * middleware helper with JumpCloud group gating.
 *
 * Requires the optional peer dependencies `next` and `next-auth`.
 */
export { createJumpCloudAuth } from './lib/create-auth.js';
export type { JumpCloudAuth } from './lib/create-auth.js';
export { createAuthMiddleware } from './lib/middleware.js';
export type { AuthMiddlewareOptions } from './lib/middleware.js';
export { applyGroupsToSession, applyGroupsToToken } from './lib/claims.js';
export {
  ALWAYS_PUBLIC_PATHS,
  decideAccess,
  isApiPath,
  matchesPathPrefix,
  requiredGroupsForPath,
} from './lib/route-guards.js';
export type { AccessDecision, AccessRequest } from './lib/route-guards.js';
export { createSessionTools } from './lib/session.js';
export type {
  RequireSessionOptions,
  SessionTools,
  SessionToolsOptions,
  SignedInProps,
  SignedOutProps,
} from './lib/session.js';
export type { JumpCloudAuthOptions, RouteGroups } from './lib/types.js';
