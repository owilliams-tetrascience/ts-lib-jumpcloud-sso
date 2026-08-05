# @tetrascience-npm/jumpcloud-sso

Plug-and-play JumpCloud OIDC SSO for TetraScience internal apps.

One package, three entry points:

| Import                                    | Use it in                        |
| ----------------------------------------- | -------------------------------- |
| `@tetrascience-npm/jumpcloud-sso/core`    | Anywhere (framework-agnostic)    |
| `@tetrascience-npm/jumpcloud-sso/next`    | Next.js App Router (Auth.js v5)  |
| `@tetrascience-npm/jumpcloud-sso/express` | Express (express-openid-connect) |

Framework dependencies (`next`, `next-auth`, `express`, `express-openid-connect`)
are **optional peer dependencies** — install only the ones your stack needs.

Full documentation, quickstarts, the JumpCloud app registration checklist, and
an SSO/OIDC primer live in the repository README:
<https://github.com/tetrascience/ts-lib-jumpcloud-sso>

Install from JFrog Artifactory:

```bash
npm install @tetrascience-npm/jumpcloud-sso
```

This directory is the publishable artifact of the Nx workspace. Its `dist/` is
composed from the built output of `packages/core`, `packages/next`, and
`packages/express` by `tools/scripts/compose-package.mjs` — do not edit `dist/`
by hand.
