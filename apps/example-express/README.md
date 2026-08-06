# example-express

Minimal Express app consuming `@tetrascience-npm/jumpcloud-sso/express`,
demonstrating the BFF pattern with a single static HTML page (no bundler):

- `GET /api/me` — `{ user, groups }` or 401 (the page calls this on load)
- `GET /api/data` — any signed-in user (`requireAuth`)
- `GET /api/admin` — JumpCloud group `app-admins` only (`requireGroup`)
- `/login`, `/logout`, `/callback` — mounted by the auth middleware

## Run it

1. Register a JumpCloud OIDC app (see the root README's checklist) with
   redirect URI `http://localhost:3000/callback`.
2. `cp apps/example-express/.env.example apps/example-express/.env` and fill
   in the values.
3. From the workspace root:

   ```bash
   npx nx dev example-express
   ```

4. Open <http://localhost:3000>.

This app is never published or deployed by CI — it exists for local
development and as living documentation.
