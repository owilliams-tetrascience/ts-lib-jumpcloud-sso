import { resolveEnv } from '@tetrascience-npm/jumpcloud-sso/core';
import { createJumpCloudSSO } from '@tetrascience-npm/jumpcloud-sso/express';
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Minimal Express app demonstrating the BFF (backend-for-frontend) pattern:
 * the browser gets a static page and an encrypted session cookie; every
 * token stays on this server. The page talks to /api/* with fetch().
 */

const port = Number(process.env.PORT ?? 3000);
const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`;
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error(
    'SESSION_SECRET is required — generate one with `openssl rand -hex 32` ' +
      'and put it in apps/example-express/.env (see .env.example).',
  );
}

const sso = createJumpCloudSSO({
  ...resolveEnv(), // JUMPCLOUD_CLIENT_ID / _CLIENT_SECRET / _ISSUER / _GROUPS_CLAIM
  baseUrl,
  sessionSecret,
});

const app = express();

// Session middleware first: adds req.oidc and mounts /login, /logout,
// /callback. Routes stay public unless guarded (authRequired: false).
app.use(sso.authMiddleware);

// The "SPA": a single static HTML page (no bundler needed for the demo).
app.use(
  express.static(join(dirname(fileURLToPath(import.meta.url)), '../public')),
);

// BFF identity endpoint: 200 {user, groups} or 401.
app.get('/api/me', sso.meHandler);

// Any signed-in user.
app.get('/api/data', sso.requireAuth, (req, res) => {
  res.json({
    message: `Hello ${String(req.oidc.user?.['name'] ?? 'there')} — this is protected data.`,
    fetchedAt: new Date().toISOString(),
  });
});

// Members of the JumpCloud group "app-admins" only (401/403 otherwise).
app.get('/api/admin', sso.requireGroup(['app-admins']), (_req, res) => {
  res.json({ message: 'Welcome, admin. Imagine dangerous switches here.' });
});

app.listen(port, () => {
  console.log(`example-express listening on ${baseUrl}`);
  console.log(
    `JumpCloud redirect URI to register: ${baseUrl}/callback (login at ${baseUrl}/login)`,
  );
});
