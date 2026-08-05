import { createJumpCloudAuth } from '@tetrascience-npm/jumpcloud-sso/next';

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
    // Gate /admin (and everything under it) to the JumpCloud group
    // "app-admins". Group NAMES, not IDs.
    routeGroups: {
      '/admin': ['app-admins'],
    },
  });
