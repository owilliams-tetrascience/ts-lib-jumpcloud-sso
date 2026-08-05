# Contributing

## Setup

```bash
npm ci
npx nx run-many -t lint,test,build   # what CI runs
```

Node 20+, npm (the lockfile is npm's — don't use yarn/pnpm here).

## Commit format — this drives releases

We use [Conventional Commits](https://www.conventionalcommits.org/). The
commit type decides the next published version of
`@tetrascience-npm/jumpcloud-sso` (same convention as `ts-lib-ui-kit`):

| Commit                                         | Release                   |
| ---------------------------------------------- | ------------------------- |
| `fix: handle empty groups claim`               | **patch** (0.1.0 → 0.1.1) |
| `feat: add requireGroup helper`                | **minor** (0.1.0 → 0.2.0) |
| `feat!: …` or a `BREAKING CHANGE:` footer      | **major** (0.1.0 → 1.0.0) |
| `chore:`, `docs:`, `ci:`, `refactor:`, `test:` | no release                |

PR titles follow the same format (plus our Jira convention where applicable,
e.g. `TDP-1234: fix: …` — the conventional type is what the tooling parses).
Squash-merge so the commit that lands on `main` carries the right type.

## How CI works (`nx affected`)

CI does **not** rebuild the world on every PR. `nx affected` diffs your branch
against the merge-base with `main`, walks the project graph to find everything
that could be impacted, and runs `lint,test,build` only for those projects:

- touch `packages/core` → core, next, express, the composed package, and both
  example apps run (everything depends on core);
- touch `packages/express` → express + the composed package + examples run,
  but `packages/next` is skipped;
- touch only `README.md` → nothing runs.

`nrwl/nx-set-shas` supplies the correct base SHA (on `main` it is the commit
of the last _successful_ CI run, so nothing slips through between green
builds). Pushes to `main` run `nx run-many` — everything — because releases
start from there.

## How a release happens (automatically)

1. Your PR is squash-merged into `main` with a conventional title.
2. The **CI** workflow runs the full `lint,test,build` suite on `main`.
3. When CI succeeds, the **Release** workflow starts (`workflow_run` trigger).
   It runs `nx release`, which:
   - reads every commit since the last `v*` tag and computes the bump
     (`fix` → patch, `feat` → minor, breaking → major; none → no release),
   - updates `packages/jumpcloud-sso/package.json` and the root
     `CHANGELOG.md`,
   - commits (`chore(release): vX.Y.Z [skip ci]`) and tags `vX.Y.Z`,
   - pushes the commit + tag to `main`,
   - publishes to JFrog Artifactory
     (`https://tetrascience.jfrog.io/artifactory/api/npm/npm-local/`).

No human presses a button. If nothing releasable landed, the workflow no-ops.

### Secrets and the branch ruleset

Our org's branch ruleset (GH013) blocks direct pushes to `main`. The release
workflow therefore checks out with **`RELEASE_BOT_TOKEN`** — a bot/GitHub-App
token configured as a **bypass actor** on the ruleset — so the version-bump
commit and tag can land. Publishing authenticates with **`NPM_TOKEN`**
(a JFrog token), injected into `.npmrc` at runtime via `${NPM_TOKEN}` env
expansion. Neither secret ever appears in the repo.

### The very first release

Before any `v*` tag exists, run the Release workflow once by hand:
**Actions → Release → Run workflow**, ticking **first_release**. That passes
`--first-release` to `nx release`, which falls back to the version already in
`packages/jumpcloud-sso/package.json` instead of looking for a previous tag or
a published package.

## Working on the examples

The example apps run against a real JumpCloud OIDC application (there is no
mock IdP). Follow the checklist in the [README](README.md), copy the app's
`.env.example`, then:

```bash
npx nx dev example-next      # http://localhost:3000
npx nx dev example-express   # http://localhost:3000
```

They are never published or deployed by CI; they exist as living
documentation and a local test bed.

## Repo conventions

- TypeScript 5, `strict` mode, no `any` (`@ts-ignore` only with a reason).
- ESM everywhere (`"type": "module"`); relative imports carry `.js`
  extensions.
- Every exported function has TSDoc.
- Unit tests are Vitest (`*.spec.ts` next to the source); `nx test <project>`.
- `.env.example` documents every env var an app reads; real values never get
  committed.
