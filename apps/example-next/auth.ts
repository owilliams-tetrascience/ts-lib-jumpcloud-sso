import { resolveEnv } from '@tetrascience-npm/jumpcloud-sso/core';
import { createJumpCloudAuth } from '@tetrascience-npm/jumpcloud-sso/next';

import { ADMIN_GROUPS, GROUPS_CLAIM } from './groups';

/**
 * Whether to keep the raw ID-token claims on the session for /debug.
 *
 * Development only, and deliberately so: these claims are the user's
 * directory attributes, they inflate the session cookie, and a page that
 * prints them has no business existing in a deployed app. `next build` sets
 * NODE_ENV=production, so this is false in every deployment.
 */
const debugClaims = process.env.NODE_ENV !== 'production';

/**
 * One place to configure SSO for the whole app.
 *
 * `resolveEnv()` throws at module load when JUMPCLOUD_CLIENT_ID or
 * _CLIENT_SECRET is missing. That is deliberate, and it is why there are no
 * `?? 'placeholder-client-id'` fallbacks here: a fallback keeps CI builds
 * green by deferring the failure to the first real user's sign-in, in
 * production, with an error that points at JumpCloud rather than at the unset
 * variable. Set the variables in CI too — any non-empty value works for a
 * build that never signs anyone in.
 *
 * For local development, put real values in `.env.local` — see .env.example.
 */
export const {
  handlers,
  auth,
  signIn,
  signOut,
  signOutEverywhere,
  routeGroups,
} = createJumpCloudAuth({
  ...resolveEnv(),
  // The package default, spelled out: `openid` is mandatory for OIDC, and
  // `email`/`profile` are what populate session.user. Groups do NOT ride on
  // a scope — JumpCloud emits them as an ID-token attribute (below).
  scopes: ['openid', 'email', 'profile'],
  // Our JumpCloud app emits groups in `groups`, which is also the package
  // default. ./groups applies the JUMPCLOUD_GROUPS_CLAIM override, so
  // deployments need no extra env var and /debug reports the same name this
  // lookup uses.
  groupsClaim: GROUPS_CLAIM,
  // Gate /admin (and everything under it) to the admin group from
  // ./groups. Group NAMES, not IDs.
  routeGroups: {
    '/admin': ADMIN_GROUPS,
  },
  authConfig: {
    // These two compose with the package's own callbacks rather than
    // replacing them: `token` and `session` arrive with groups already
    // populated, so this only has to add the /debug extras.
    callbacks: {
      jwt({ token, profile }) {
        if (debugClaims && profile !== undefined) {
          return { ...token, idTokenClaims: profile };
        }
        return token;
      },
      session({ session, token }) {
        if (debugClaims) {
          return { ...session, idTokenClaims: token['idTokenClaims'] };
        }
        return session;
      },
    },
  },
});
