/**
 * @tetrascience-npm/jumpcloud-sso/core
 *
 * Framework-agnostic building blocks for JumpCloud OIDC SSO:
 * shared configuration types and defaults, group-claim normalization,
 * group-based access checks, and the TetraScience env var convention.
 */
export {
  DEFAULT_GROUPS_CLAIM,
  DEFAULT_ISSUER,
  DEFAULT_SCOPES,
  DEFAULT_SESSION_MAX_AGE_SECONDS,
  withDefaults,
} from './lib/config.js';
export type { JumpCloudCommon, ResolvedJumpCloudCommon } from './lib/config.js';
export {
  assertGatedGroups,
  hasAnyGroup,
  normalizeGroups,
} from './lib/groups.js';
export { JUMPCLOUD_ENV_VARS, resolveEnv } from './lib/env.js';
export {
  buildEndSessionUrl,
  DEFAULT_END_SESSION_ENDPOINT,
  resolvePostLogoutRedirect,
} from './lib/logout.js';
export type { EndSessionOptions } from './lib/logout.js';
export { assertStrongSecret, MIN_SECRET_LENGTH } from './lib/secrets.js';
export type { SecretSource } from './lib/secrets.js';
