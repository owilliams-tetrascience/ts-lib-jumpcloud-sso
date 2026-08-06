# example-next

Minimal Next.js 15 App Router app consuming `@tetrascience-npm/jumpcloud-sso/next`.

- `/` — public home page
- `/dashboard` — any signed-in JumpCloud user
- `/admin` — requires the JumpCloud group `app-admins`

## Run it

1. Register a JumpCloud OIDC app (see the root README's checklist) with
   redirect URI `http://localhost:3000/api/auth/callback/jumpcloud`.
2. `cp apps/example-next/.env.example apps/example-next/.env.local` and fill
   in the values.
3. From the workspace root:

   ```bash
   npx nx dev example-next
   ```

4. Open <http://localhost:3000>.

This app is never published or deployed by CI — it exists for local
development and as living documentation.
