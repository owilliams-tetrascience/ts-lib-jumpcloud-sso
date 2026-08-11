import { resolveEnv } from '@tetrascience-npm/jumpcloud-sso/core';
import { createSSORouter } from '@tetrascience-npm/jumpcloud-sso/express';
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_GROUP, ADMIN_GROUPS } from './groups.js';

/**
 * Minimal Express app demonstrating the BFF (backend-for-frontend) pattern:
 * the browser gets a static page and an encrypted session cookie; every
 * token stays on this server. The page talks to /api/* with fetch().
 */

const port = Number(process.env.PORT ?? 3000);
const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`;
// Must match the path of a redirect URI registered on the JumpCloud OIDC
// application. Ours registers /callback/jumpcloud so one application can
// serve both examples; express-openid-connect's own default is /callback.
const callbackPath = process.env.CALLBACK_PATH ?? '/callback';
// Ending the JumpCloud session on logout needs BASE_URL whitelisted as a
// post_logout_redirect_uri on the application; ours is not, so IDP_LOGOUT=false
// keeps logout local to this app.
const idpLogout = process.env.IDP_LOGOUT !== 'false';
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error(
    'SESSION_SECRET is required — generate one with `openssl rand -hex 32` ' +
      'and put it in apps/example-express/.env (see .env.example).',
  );
}

const sso = createSSORouter({
  ...resolveEnv(), // JUMPCLOUD_CLIENT_ID / _CLIENT_SECRET / _ISSUER / _GROUPS_CLAIM
  baseUrl,
  callbackPath,
  idpLogout,
  sessionSecret,
});

const app = express();

// One mount wires everything: the session middleware (req.oidc plus /login,
// /logout, and the callback route — routes stay public unless guarded) and
// the BFF identity endpoint /api/me (200 {user, groups} or 401).
app.use(sso.router);

// The "SPA": a single static HTML page (no bundler needed for the demo).
app.use(
  express.static(join(dirname(fileURLToPath(import.meta.url)), '../public')),
);

// Public: lets the static page label its button with the gated group name
// instead of hardcoding a second copy of it. Nothing secret here — the group
// name is already in the 403 body from requireGroup.
app.get('/api/config', (_req, res) => {
  res.json({ adminGroup: ADMIN_GROUP });
});

// Any signed-in user.
app.get('/api/data', sso.requireAuth, (req, res) => {
  res.json({
    message: `Hello ${String(req.oidc.user?.['name'] ?? 'there')} — this is protected data.`,
    fetchedAt: new Date().toISOString(),
  });
});

// Members of the admin group only (401/403 otherwise).
app.get('/api/admin', sso.requireGroup(ADMIN_GROUPS), (_req, res) => {
  res.json({ message: 'Welcome, admin. Imagine dangerous switches here.' });
});

app.listen(port, () => {
  console.log(`example-express listening on ${baseUrl}`);
  console.log(
    `JumpCloud redirect URI to register: ${baseUrl}${callbackPath} (login at ${baseUrl}/login)`,
  );
});
