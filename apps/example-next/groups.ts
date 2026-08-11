/**
 * The JumpCloud group NAMES (not IDs) this example gates on.
 *
 * Change ADMIN_GROUP here and every gate — middleware routeGroups, the
 * server-side check in /admin, and the <SignedIn> teaser on the home page —
 * follows, along with the labels the pages print.
 */
export const ADMIN_GROUP = 'TS-SSO-UX-ROADMAP-USERS';

/** Convenience for the array-shaped `groups` arguments the guards take. */
export const ADMIN_GROUPS = [ADMIN_GROUP];

/**
 * The ID-token claim our JumpCloud OIDC app emits group names in.
 *
 * Ours is `groups` — the name typed into the app's "Group Attribute" field in
 * the JumpCloud console — NOT the package default of `memberOf`. Get this
 * wrong and gating 403s everyone: the claim reads as `undefined`, so every
 * user looks like they belong to no groups.
 */
const DEFAULT_GROUPS_CLAIM = 'groups';

/**
 * The claim name actually in effect, env override applied.
 *
 * Resolved here rather than at each use site so that auth.ts (which configures
 * the lookup) and /debug (which reports on it) can never disagree — a /debug
 * page that inspects a different claim than the app configured would confirm
 * a working setup as broken, or the reverse.
 */
export const GROUPS_CLAIM =
  process.env.JUMPCLOUD_GROUPS_CLAIM ?? DEFAULT_GROUPS_CLAIM;
