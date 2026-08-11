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
 * the JumpCloud console — NOT the package default of `memberOf`. Get
 * this wrong and gating 403s everyone: the claim reads as `undefined`, so
 * every user looks like they belong to no groups. `JUMPCLOUD_GROUPS_CLAIM`
 * overrides this per environment.
 */
export const GROUPS_CLAIM = 'groups';
