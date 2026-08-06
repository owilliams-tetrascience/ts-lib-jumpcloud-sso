import { normalizeGroups } from '@tetrascience-npm/jumpcloud-sso/core';
import type { Profile, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

/**
 * Pure `jwt`-callback logic: copies the (normalized) JumpCloud groups claim
 * from the OIDC profile onto the Auth.js token.
 *
 * The `profile` argument is only present on the initial sign-in; on
 * subsequent invocations (session reads, token refreshes) it is `undefined`
 * and the previously stored groups are kept as-is.
 *
 * Extracted from {@link createJumpCloudAuth} so the behavior — including the
 * JumpCloud single-group-string quirk — is unit-testable without running
 * NextAuth.
 *
 * @param token - The Auth.js JWT being built or refreshed.
 * @param profile - The decoded ID token (OIDC profile), if this is a sign-in.
 * @param groupsClaim - Name of the claim carrying JumpCloud groups.
 * @returns The token, with `groups: string[]` set on sign-in.
 */
export function applyGroupsToToken(
  token: JWT,
  profile: Profile | undefined,
  groupsClaim: string,
): JWT {
  if (profile === undefined) {
    return token;
  }
  const raw = (profile as Record<string, unknown>)[groupsClaim];
  return { ...token, groups: normalizeGroups(raw) };
}

/**
 * Pure `session`-callback logic: copies `groups` from the token onto
 * `session.user`, so server components, route handlers, and the middleware
 * can all read `session.user.groups`.
 *
 * @param session - The session object being sent to the caller.
 * @param token - The Auth.js JWT (JWT session strategy).
 * @returns The session with `user.groups` guaranteed to be a `string[]`.
 */
export function applyGroupsToSession(session: Session, token: JWT): Session {
  const groups = normalizeGroups(token['groups']);
  return {
    ...session,
    user: { ...session.user, groups },
  };
}
