import { normalizeGroups } from '@tetrascience-npm/jumpcloud-sso/core';
import type { Account, Profile, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

/**
 * The JWT field the raw ID token is stashed under, for later use as
 * `id_token_hint` on the JumpCloud logout URL.
 */
export const ID_TOKEN_FIELD = 'jumpcloudIdToken';

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
  const claims = profile as Record<string, unknown>;
  const raw = claims[groupsClaim];
  if (raw === undefined) {
    warnMissingGroupsClaim(groupsClaim, claims);
  }
  return { ...token, groups: normalizeGroups(raw) };
}

/**
 * Explains an absent groups claim at the moment of sign-in.
 *
 * Without this, a JumpCloud app that isn't emitting groups looks exactly like
 * a user who is in no groups: every gated route 403s and nothing says why.
 * Logs the claim names present in the ID token — names only, never values, so
 * no user attributes land in the logs.
 */
function warnMissingGroupsClaim(
  groupsClaim: string,
  claims: Record<string, unknown>,
): void {
  console.warn(
    `[jumpcloud-sso] The ID token has no "${groupsClaim}" claim, so this ` +
      'user is treated as belonging to no groups and every group-gated route ' +
      `will answer 403. Claims actually present: ${Object.keys(claims).join(', ')}. ` +
      'Either the JumpCloud OIDC app is not emitting the group attribute ' +
      '(Admin Console → SSO Applications → your app → Attributes → "Include ' +
      'group attribute in ID token", and note that JumpCloud only emits ' +
      'groups that are assigned to that application), or the attribute is ' +
      `emitted under a different name than "${groupsClaim}" — set ` +
      'JUMPCLOUD_GROUPS_CLAIM (or the `groupsClaim` option) to match.',
  );
}

/**
 * Pure `jwt`-callback logic: keeps the raw ID token on the Auth.js token so
 * sign-out can present it to JumpCloud as `id_token_hint`.
 *
 * Without a hint, JumpCloud cannot tell which session is being ended and shows
 * an interstitial instead of just ending it — so a "sign out everywhere" link
 * becomes a two-step flow users abandon halfway, leaving the IdP session
 * alive. The token adds roughly 1KB to the session cookie, which Auth.js
 * chunks transparently, so this is opt-out rather than opt-in.
 *
 * `account` is only present on the initial sign-in; later invocations keep
 * whatever was already stored.
 *
 * @param token - The Auth.js JWT being built or refreshed.
 * @param account - The OAuth account, if this is a sign-in.
 * @returns The token, with the ID token attached on sign-in.
 */
export function applyIdTokenToToken(
  token: JWT,
  account: Account | null | undefined,
): JWT {
  const idToken = account?.id_token;
  if (typeof idToken !== 'string') {
    return token;
  }
  return { ...token, [ID_TOKEN_FIELD]: idToken };
}

/**
 * Reads back what {@link applyIdTokenToToken} stored, or `undefined` when ID
 * token retention is switched off (or the session predates it).
 */
export function idTokenFromToken(token: JWT): string | undefined {
  const value = token[ID_TOKEN_FIELD];
  return typeof value === 'string' ? value : undefined;
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
