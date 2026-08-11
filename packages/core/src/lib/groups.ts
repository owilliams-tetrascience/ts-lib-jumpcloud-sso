/**
 * Normalizes the raw JumpCloud groups claim into a `string[]`.
 *
 * ── JUMPCLOUD QUIRK — READ THIS BEFORE TOUCHING GROUP LOGIC ─────────────────
 * JumpCloud does NOT always emit the group claim (`groups` by default) as an
 * array. The claim's JSON type depends on how many groups the user is in:
 *
 *   - 0 groups   → the claim is missing (`undefined`) or empty
 *   - 1 group    → a BARE STRING:   "groups": "app-admins"
 *   - 2+ groups  → an array:        "groups": ["app-admins", "eng"]
 *
 * Code that assumes an array works fine in testing (where test users tend to
 * be in several groups) and then breaks in production the moment a user is in
 * exactly one group. Always route the raw claim through this function.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * @param raw - The claim value exactly as it appears in the ID token.
 * @returns `[]` for `null`/`undefined`/empty string (and any non-string,
 * non-array value), `[raw]` for a string, and the array as-is for arrays.
 */
export function normalizeGroups(raw: unknown): string[] {
  if (raw === null || raw === undefined || raw === '') {
    return [];
  }
  if (typeof raw === 'string') {
    return [raw];
  }
  if (Array.isArray(raw)) {
    // JumpCloud group members are always strings; pass the array through
    // as-is rather than filtering, so unexpected shapes surface loudly in
    // consuming code instead of silently disappearing.
    return raw as string[];
  }
  return [];
}

/**
 * Group-based access predicate used by every route-gating feature in this
 * package.
 *
 * @param userGroups - The user's JumpCloud groups (run the raw claim through
 * {@link normalizeGroups} first).
 * @param allowed - Group names that grant access. JumpCloud group NAMES, not
 * IDs — renaming a group in JumpCloud breaks gating until configs catch up.
 * @returns `true` when `allowed` is empty (no gating configured for the
 * route), or when at least one of `userGroups` appears in `allowed`.
 */
export function hasAnyGroup(userGroups: string[], allowed: string[]): boolean {
  if (allowed.length === 0) {
    return true;
  }
  const allowedSet = new Set(allowed);
  return userGroups.some((group) => allowedSet.has(group));
}
