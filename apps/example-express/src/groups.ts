/**
 * The JumpCloud group NAMES (not IDs) this example gates on.
 *
 * Change ADMIN_GROUP here and every gate follows: the `requireGroup` guard on
 * /api/admin, the label the page prints on its button, and the group named in
 * the 403 body. The sibling example-next keeps the same constant in
 * apps/example-next/groups.ts.
 *
 * `app-admins` is a placeholder — point it at a group that is actually bound
 * to your JumpCloud application, or /api/admin 403s everyone.
 */
export const ADMIN_GROUP = 'app-admins';

/** Convenience for the array-shaped `groups` arguments the guards take. */
export const ADMIN_GROUPS = [ADMIN_GROUP];
