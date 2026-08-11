import {
  assertGatedGroups,
  hasAnyGroup,
  normalizeGroups,
} from '@tetrascience-npm/jumpcloud-sso/core';
import type { Request, RequestHandler } from 'express';

/**
 * Reads the user's normalized JumpCloud groups from the ID-token claims that
 * express-openid-connect stores on `req.oidc`. Handles the JumpCloud quirk
 * where a single group arrives as a bare string instead of an array.
 */
function groupsFromRequest(req: Request, groupsClaim: string): string[] {
  return normalizeGroups(req.oidc?.idTokenClaims?.[groupsClaim]);
}

/**
 * Builds the `requireGroup` middleware factory for a given groups claim.
 *
 * The returned factory produces Express middleware that:
 * - responds `401` JSON when the request has no authenticated session;
 * - responds `403` JSON when the user is signed in but belongs to none of
 *   the `allowed` JumpCloud groups;
 * - calls `next()` otherwise.
 *
 * An empty `allowed` list throws when the middleware is built, rather than
 * degrading to "any signed-in user" — see core's `assertGatedGroups`.
 *
 * Exposed separately from {@link createJumpCloudSSO} so the gating behavior
 * is unit-testable with a mocked `req.oidc`.
 *
 * @param groupsClaim - Name of the ID-token claim carrying JumpCloud groups.
 */
export function createRequireGroup(
  groupsClaim: string,
): (allowed: string[]) => RequestHandler {
  return (allowed: string[]): RequestHandler => {
    // Fail at mount time, not per-request: `requireGroup([])` would otherwise
    // admit every signed-in user while reading like a group gate.
    assertGatedGroups(allowed, 'requireGroup()');
    return (req, res, next) => {
      if (!req.oidc?.isAuthenticated()) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Sign-in required. Visit /login to start SSO.',
        });
        return;
      }
      const groups = groupsFromRequest(req, groupsClaim);
      if (!hasAnyGroup(groups, allowed)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Requires membership in one of the JumpCloud groups: ${allowed.join(', ')}.`,
          requiredGroups: allowed,
        });
        return;
      }
      next();
    };
  };
}

/**
 * Builds the `/api/me` handler for the BFF (backend-for-frontend) pattern:
 * the SPA calls this endpoint on load to learn who is signed in, while ID
 * and access tokens stay server-side in the encrypted session cookie.
 *
 * Responds:
 * - `200` `{ user, groups }` when authenticated — `user` is the filtered
 *   claim set express-openid-connect exposes as `req.oidc.user`, `groups`
 *   is the normalized JumpCloud group list;
 * - `401` JSON when not authenticated.
 *
 * @param groupsClaim - Name of the ID-token claim carrying JumpCloud groups.
 */
export function createMeHandler(groupsClaim: string): RequestHandler {
  return (req, res) => {
    if (!req.oidc?.isAuthenticated()) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Not signed in.',
      });
      return;
    }
    res.json({
      user: req.oidc.user ?? null,
      groups: groupsFromRequest(req, groupsClaim),
    });
  };
}
