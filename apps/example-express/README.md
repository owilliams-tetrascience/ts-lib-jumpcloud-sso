# example-express

Minimal Express app consuming `@tetrascience-npm/jumpcloud-sso/express`,
demonstrating the BFF pattern with a single static HTML page (no bundler):

- `GET /api/me` — `{ user, groups }` or 401 (the page calls this on load)
- `GET /api/data` — any signed-in user (`requireAuth`)
- `GET /api/admin` — `ADMIN_GROUP` from [src/groups.ts](src/groups.ts) only
  (`requireGroup`)
- `GET /api/config` — public; tells the page which group `/api/admin` gates on
- `/login`, `/logout`, and the callback route (`/callback`, or `CALLBACK_PATH`)
  — mounted by the auth middleware

## Run it

1. Register a JumpCloud OIDC app (see the root README's checklist) with
   redirect URI `http://localhost:3000/callback`. If the application already
   registers a different path — ours uses `/api/auth/callback/jumpcloud`,
   shared with example-next — set `CALLBACK_PATH` in `.env` to match instead.
   Whitelist `http://localhost:3000` as a post-logout redirect URI too, or set
   `IDP_LOGOUT=false` to log out of this app only.
2. `cp apps/example-express/.env.example apps/example-express/.env` and fill
   in the values.
3. From the workspace root:

   ```bash
   npx nx dev example-express
   ```

4. Open <http://localhost:3000>.

This app is never published or deployed by CI — it exists for local
development and as living documentation.
