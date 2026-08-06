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
