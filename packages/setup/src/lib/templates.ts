/**
 * File-content generators for `jumpcloud-sso setup`. Pure string builders —
 * no filesystem access — so every scaffolded file is unit-testable.
 *
 * The generated code mirrors the example apps in this workspace
 * (apps/example-next, apps/example-express); when those change, keep these
 * in sync.
 */

const PKG = '@tetrascience-npm/jumpcloud-sso';

/** `auth.ts` — the single place a Next.js app configures SSO. */
export function nextAuthFile(): string {
  return `import { resolveEnv } from '${PKG}/core';
import { createJumpCloudAuth } from '${PKG}/next';

/**
 * One place to configure SSO for the whole app.
 *
 * \`resolveEnv()\` reads JUMPCLOUD_CLIENT_ID / _CLIENT_SECRET / _ISSUER /
 * _GROUPS_CLAIM and throws at module load if a required one is missing, so a
 * misconfigured deployment fails immediately with an actionable message
 * instead of at the first user's sign-in. The one exception is \`next build\`
 * (NEXT_PHASE=phase-production-build), where it warns and substitutes
 * placeholders — a build signs nobody in, so it need not hold credentials.
 * Do not swap in \`?? 'placeholder'\` fallbacks of your own to keep a build
 * green: those survive into production and defer the failure to the first
 * user's sign-in, which is exactly what the build-phase exception avoids.
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
  // Path prefix -> JumpCloud group NAMES allowed to access it, e.g.:
  // routeGroups: { '/admin': ['app-admins'] },
  routeGroups: {},
});
`;
}

/** `session.ts` — requireSession / SignedIn conveniences bound to auth. */
export function nextSessionFile(): string {
  return `import { createSessionTools } from '${PKG}/next';
import { auth } from './auth';

/**
 * Session-check conveniences bound to this app's \`auth\`:
 * - \`requireSession()\` for pages/layouts/server actions (redirects to
 *   sign-in, optionally enforces JumpCloud groups);
 * - \`getSessionUser()\` when you want to branch instead of bounce;
 * - \`<SignedIn>\` / \`<SignedOut>\` for conditional server-rendered UI.
 */
export const { requireSession, getSessionUser, SignedIn, SignedOut } =
  createSessionTools(auth);
`;
}

/** `middleware.ts` — route protection with JumpCloud group gating. */
export function nextMiddlewareFile(): string {
  return `import { createAuthMiddleware } from '${PKG}/next';
import { auth, routeGroups } from './auth';

/**
 * Route protection: everything requires a JumpCloud session except
 * \`publicPaths\` (and /api/auth, which is always public).
 *
 * Middleware is a convenience, not a security boundary — re-check the
 * session in every page/route that shows something sensitive, e.g. with
 * \`requireSession()\` from ./session.
 */
export default createAuthMiddleware(auth, {
  publicPaths: ['/'],
  routeGroups,
});

export const config = {
  // Run on everything except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
`;
}

/** `app/api/auth/[...nextauth]/route.ts` — mounts the Auth.js endpoints. */
export function nextRouteHandlerFile(): string {
  return `import { handlers } from '../../../../auth';

/**
 * Mounts every Auth.js endpoint under /api/auth/* — sign-in, sign-out, the
 * OIDC callback (/api/auth/callback/jumpcloud), and session reads.
 */
export const { GET, POST } = handlers;
`;
}

/** `sso.ts` for Express apps — one createSSORouter call, mounted once. */
export function expressSsoFile(): string {
  return `import { resolveEnv } from '${PKG}/core';
import { createSSORouter } from '${PKG}/express';

const port = Number(process.env.PORT ?? 3000);

/**
 * Everything JumpCloud SSO needs, in one object:
 * - \`sso.router\` — mount ONCE, before your routes: \`app.use(sso.router)\`.
 *   It wires the encrypted session cookie (req.oidc), the /login, /logout,
 *   and /callback routes, and the /api/me identity endpoint for your SPA.
 * - \`sso.requireAuth\` — guard for any signed-in user.
 * - \`sso.requireGroup(['group-name'])\` — guard by JumpCloud group.
 *
 * @example
 * \`\`\`ts
 * import express from 'express';
 * import { sso } from './sso';
 *
 * const app = express();
 * app.use(sso.router);
 * app.get('/api/data', sso.requireAuth, (req, res) => res.json({ ok: true }));
 * \`\`\`
 */
export const sso = createSSORouter({
  ...resolveEnv(), // JUMPCLOUD_CLIENT_ID / _CLIENT_SECRET / _ISSUER / _GROUPS_CLAIM
  baseUrl: process.env.BASE_URL ?? \`http://localhost:\${port}\`,
  sessionSecret: requireSessionSecret(),
});

function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is required — generate one with ' +
        '\`openssl rand -hex 32\` and put it in your environment ' +
        '(see .env.example).',
    );
  }
  return secret;
}
`;
}

/** The env-example block appended for a Next.js app. */
export function nextEnvExample(): string {
  return `# --- JumpCloud SSO (@tetrascience-npm/jumpcloud-sso) ---
# From your JumpCloud OIDC application (JumpCloud Admin Console -> SSO):
JUMPCLOUD_CLIENT_ID=
JUMPCLOUD_CLIENT_SECRET=
# Optional overrides (defaults: https://oauth.id.jumpcloud.com/ and groups):
# JUMPCLOUD_ISSUER=
# JUMPCLOUD_GROUPS_CLAIM=
# Auth.js cookie/JWT secret — generate with \`npx auth secret\`.
# At least 32 characters; anyone who recovers it can forge a session for any
# user in any JumpCloud group. Not the JumpCloud client secret.
AUTH_SECRET=

# Only for self-hosting BEHIND A PROXY THAT STRIPS inbound X-Forwarded-Host.
# It makes Auth.js derive its own origin from request headers, so a proxy that
# forwards an attacker's X-Forwarded-Host lets them steer the post-sign-in
# redirect to their own site. On Vercel, leave it unset. Elsewhere, prefer
# setting AUTH_URL to your canonical origin instead.
# AUTH_TRUST_HOST=true
`;
}

/** The env-example block appended for an Express app. */
export function expressEnvExample(): string {
  return `# --- JumpCloud SSO (@tetrascience-npm/jumpcloud-sso) ---
# From your JumpCloud OIDC application (JumpCloud Admin Console -> SSO):
JUMPCLOUD_CLIENT_ID=
JUMPCLOUD_CLIENT_SECRET=
# Optional overrides (defaults: https://oauth.id.jumpcloud.com/ and groups):
# JUMPCLOUD_ISSUER=
# JUMPCLOUD_GROUPS_CLAIM=
# Public URL of THIS app; \${BASE_URL}/callback must be registered as a
# redirect URI on the JumpCloud OIDC application:
BASE_URL=http://localhost:3000
# Session-cookie secret (yours, NOT the JumpCloud client secret) — generate
# with \`openssl rand -hex 32\`. At least 32 characters: this cookie holds your
# OIDC tokens and answers every auth check, so a guessable secret is a full
# authorization bypass.
SESSION_SECRET=
`;
}
