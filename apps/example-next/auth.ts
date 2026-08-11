import { createJumpCloudAuth } from '@tetrascience-npm/jumpcloud-sso/next';

import { ADMIN_GROUPS } from './groups';

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
    // Whatever the JumpCloud app calls its group attribute; the package
    // defaults to `memberOf` when this is unset. Gating silently 403s
    // everyone if this name does not match the ID token.
    ...(process.env.JUMPCLOUD_GROUPS_CLAIM
      ? { groupsClaim: process.env.JUMPCLOUD_GROUPS_CLAIM }
      : {}),
    // Gate /admin (and everything under it) to the admin group from
    // ./groups. Group NAMES, not IDs.
    routeGroups: {
      '/admin': ADMIN_GROUPS,
    },
  });
