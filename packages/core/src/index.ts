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
  withDefaults,
} from './lib/config.js';
export type { JumpCloudCommon, ResolvedJumpCloudCommon } from './lib/config.js';
export { hasAnyGroup, normalizeGroups } from './lib/groups.js';
export { JUMPCLOUD_ENV_VARS, resolveEnv } from './lib/env.js';
