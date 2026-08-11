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
