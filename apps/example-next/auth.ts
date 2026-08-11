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
 * The placeholder fallbacks keep `next build` working in CI, where no real
 * JumpCloud credentials exist (login itself would fail with placeholders).
 * For local development, put real values in `.env.local` — see .env.example.
 */
export const { handlers, auth, signIn, signOut, routeGroups } =
  createJumpCloudAuth({
    clientId: process.env.JUMPCLOUD_CLIENT_ID ?? 'placeholder-client-id',
    clientSecret:
      process.env.JUMPCLOUD_CLIENT_SECRET ?? 'placeholder-client-secret',
    // The package default, spelled out: `openid` is mandatory for OIDC, and
    // `email`/`profile` are what populate session.user. Groups do NOT ride on
    // a scope — JumpCloud emits them as an ID-token attribute (below).
    scopes: ['openid', 'email', 'profile'],
    // Our JumpCloud app emits groups in `groups`, not the package default of
    // `memberOf` — see ./groups. Deployments need no extra env var; set
    // JUMPCLOUD_GROUPS_CLAIM only to point at a differently configured app.
    groupsClaim: process.env.JUMPCLOUD_GROUPS_CLAIM ?? GROUPS_CLAIM,
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
