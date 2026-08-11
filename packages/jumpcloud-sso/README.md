# @tetrascience-npm/jumpcloud-sso

Plug-and-play JumpCloud OIDC SSO for TetraScience internal apps.

One package, three entry points:

| Import                                    | Use it in                        |
| ----------------------------------------- | -------------------------------- |
| `@tetrascience-npm/jumpcloud-sso/core`    | Anywhere (framework-agnostic)    |
| `@tetrascience-npm/jumpcloud-sso/next`    | Next.js App Router (Auth.js v5)  |
| `@tetrascience-npm/jumpcloud-sso/express` | Express (express-openid-connect) |

Framework dependencies (`next`, `next-auth`, `react`, `express`,
`express-openid-connect`) are **optional peer dependencies** — install only
the ones your stack needs.

The `next` range starts at **14.2.25 / 15.2.3** for a security reason, not a
compatibility one: CVE-2025-29927 lets any request skip Next.js middleware via
an `x-middleware-subrequest` header, which would turn this package's
`createAuthMiddleware` into a no-op.

Two more defaults worth knowing before you wire this up:

- `AUTH_SECRET` / `sessionSecret` must be **at least 32 characters** and not a
  placeholder — the package refuses to start otherwise. That secret is the
  session, so a guessable one is a full authorization bypass.
- Sessions expire after **8 hours** by default. JumpCloud groups are read once
  at sign-in and never re-read, so that number is also how long a revoked group
  membership keeps working.

Fastest start — scaffold the integration into an existing Next.js or Express
project with the bundled CLI:

```bash
npx @tetrascience-npm/jumpcloud-sso setup
```

Full documentation, quickstarts, the JumpCloud app registration checklist, and
an SSO/OIDC primer live in the repository README:
<https://github.com/tetrascience/ts-lib-jumpcloud-sso>

Install from JFrog Artifactory:

```bash
npm install @tetrascience-npm/jumpcloud-sso
```

This directory is the publishable artifact of the Nx workspace. Its `dist/` is
composed from the built output of `packages/core`, `packages/next`,
`packages/express`, and `packages/setup` (the CLI bin) by
`tools/scripts/compose-package.mjs` — do not edit `dist/` by hand.
